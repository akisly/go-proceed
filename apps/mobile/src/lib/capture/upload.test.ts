import { describe, it, expect } from "vitest";
import {
  uploadCapture, GENERIC_FAILURE, type FetchLike, type PostLike, type HashLike, type PickedPhoto,
} from "./upload";
import type { ClientState } from "./state";

/**
 * PORT of apps/app/src/lib/capture/upload.test.ts, adapted for the two
 * deltas `upload.ts`'s own header names: create/finalize are driven through
 * a fake `PostLike` (standing in for `apiPost`) instead of a bare
 * `fetchImpl`, and the hasher is a fake `HashLike` passed explicitly rather
 * than the real `sha256Hex` (which this suite cannot import at all — see
 * `hash.ts`'s header). The raw PUT still goes through a fake `FetchLike`,
 * unchanged from source. Every assertion this file makes has a source
 * counterpart; nothing here tests new behaviour source does not have.
 */

const HASH = "b".repeat(64);
const fakeHash: HashLike = async () => HASH;

const PHOTO: PickedPhoto = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer,
  mediaType: "image/jpeg",
  fileName: "фото.jpg",
  lastModifiedMs: new Date("2026-08-10T09:00:00Z").getTime(),
  byteSize: 4,
};

const OCCURRENCE_ID = "11111111-1111-4111-8111-111111111111";
const ASSIGNMENT_ID = "22222222-2222-4222-8222-222222222222";
const PHOTO_ID = "33333333-3333-4333-8333-333333333333";

type PostCall = { path: string; body: unknown; idempotencyKey: string; signal: AbortSignal | undefined };
type FetchCall = { url: string; init: RequestInit | undefined };

/**
 * A sequential fake for the two authenticated calls (create, finalize): the
 * Nth call gets the Nth queued `Response`, and every call is recorded for
 * the request-shape assertions below.
 */
function fakePost(responses: Response[]): { postImpl: PostLike; calls: PostCall[] } {
  const calls: PostCall[] = [];
  let i = 0;
  const postImpl: PostLike = async (path, body, idempotencyKey, signal) => {
    calls.push({ path, body, idempotencyKey, signal });
    const res = responses[i];
    i += 1;
    if (!res) throw new Error(`fakePost: no response queued for call #${i} (${path})`);
    return res;
  };
  return { postImpl, calls };
}

/** The same kind of sequential fake, for the one raw PUT call. */
function fakeFetch(responses: Response[]): { fetchImpl: FetchLike; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  let i = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const res = responses[i];
    i += 1;
    if (!res) throw new Error(`fakeFetch: no response queued for call #${i} (${url})`);
    return res;
  };
  return { fetchImpl, calls };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });
}

const CREATED = {
  uploadIntentId: "intent-1", workspaceId: "ws-1", status: "intent_authorized",
  expiresAt: "2026-08-11T00:00:00.000Z",
  storage: { bucket: "evidence", key: "k1/k2" },
  upload: { signedUrl: "https://storage.example/put/evidence/k1/k2?token=tok", token: "tok" },
};

const AVAILABLE = {
  uploadIntentId: "intent-1", status: "available", evidenceObjectId: "evidence-1",
  contentHash: "a".repeat(64), serverReceivedAt: "2026-08-11T00:05:00.000Z", failureCode: null,
};

function problem(userAction: string, detail = "Помилка."): unknown {
  return {
    type: "about:blank", title: "error", status: 422, code: "VALIDATION_FAILED",
    detail, requestId: "req-1", retryable: false, userAction,
  };
}

async function run(postResponses: Response[], putResponses: Response[], signal?: AbortSignal) {
  const { postImpl, calls: postCalls } = fakePost(postResponses);
  const { fetchImpl, calls: putCalls } = fakeFetch(putResponses);
  const states: ClientState[] = [];
  const outcome = await uploadCapture(
    PHOTO, OCCURRENCE_ID, ASSIGNMENT_ID, PHOTO_ID, (s) => states.push(s),
    fakeHash, signal, postImpl, fetchImpl,
  );
  return { outcome, states, postCalls, putCalls };
}

describe("uploadCapture — the happy path", () => {
  it("emits exactly sending → awaiting_receipt → server_confirmed, in that order", async () => {
    const { outcome, states } = await run(
      [jsonResponse(201, CREATED), jsonResponse(200, AVAILABLE)],
      [new Response(null, { status: 200 })],
    );

    expect(states).toEqual(["sending", "awaiting_receipt", "server_confirmed"]);
    expect(outcome.state).toBe("server_confirmed");
    if (outcome.state === "server_confirmed") {
      expect(outcome.evidenceObjectId).toBe("evidence-1");
      expect(outcome.contentHash).toBe(AVAILABLE.contentHash);
      expect(outcome.serverReceivedAt).toBe(AVAILABLE.serverReceivedAt);
    }
  });

  it("PUTs to the create response's signedUrl, unmodified, and with no extra auth header", async () => {
    const { putCalls } = await run(
      [jsonResponse(201, CREATED), jsonResponse(200, AVAILABLE)],
      [new Response(null, { status: 200 })],
    );

    const put = putCalls[0]!;
    expect(put.url).toBe(CREATED.upload.signedUrl);
    expect(put.init?.method).toBe("PUT");
    const headers = new Headers(put.init?.headers);
    expect(headers.get("content-type")).toBe("image/jpeg");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("apikey")).toBeNull();
  });

  it("the create call carries origin_not_distinguished and no other originMethod — on the ACTUAL request sent, not on buildCreateIntentBody called in isolation", async () => {
    // This is the source's regression fix round 1 finding 2: `uploadCapture`
    // could stop calling `buildCreateIntentBody` and inline its own body,
    // reintroducing a spread that carries a different `originMethod` through
    // — and a test that only called `buildCreateIntentBody` directly would
    // never notice. This inspects the actual body handed to the fake
    // `postImpl` for the create call.
    const { postCalls } = await run(
      [jsonResponse(201, CREATED), jsonResponse(200, AVAILABLE)],
      [new Response(null, { status: 200 })],
    );

    const sent = postCalls[0]!.body as Record<string, unknown>;
    expect(sent.originMethod).toBe("origin_not_distinguished");
    expect(sent.deviceCaptureId).toBe(PHOTO_ID);
    expect(sent.requirementOccurrenceId).toBe(OCCURRENCE_ID);
  });

  it("carries an Idempotency-Key on the create call and a different one on finalize", async () => {
    const { postCalls } = await run(
      [jsonResponse(201, CREATED), jsonResponse(200, AVAILABLE)],
      [new Response(null, { status: 200 })],
    );
    const createKey = postCalls[0]!.idempotencyKey;
    const finalizeKey = postCalls[1]!.idempotencyKey;
    expect(createKey).toBeTruthy();
    expect(finalizeKey).toBeTruthy();
    // A fresh key per ATTEMPT, not per photo — deviceCaptureId (PHOTO_ID,
    // asserted above) is what stays constant; this is the deliberate
    // contrast (context item 5).
    expect(finalizeKey).not.toBe(createKey);
  });
});

describe("uploadCapture — a finalize that never reaches available never becomes server_confirmed", () => {
  it("a 200 finalize response whose status is not \"available\" is reported as failed, not confirmed", async () => {
    // Defensive: even if something upstream ever returned 2xx with a
    // non-available status, the client-side check
    // (`finalized.status !== "available"`) is a second, independent gate —
    // not merely a reflection of `res.ok`.
    const { outcome, states } = await run(
      [jsonResponse(201, CREATED), jsonResponse(200, {
        uploadIntentId: "intent-1", status: "scan_blocked", evidenceObjectId: null,
        contentHash: null, serverReceivedAt: null, failureCode: "declared_type_mismatch",
      })],
      [new Response(null, { status: 200 })],
    );
    expect(outcome.state).not.toBe("server_confirmed");
    expect(outcome.state).toBe("failed");
    expect(states).not.toContain("server_confirmed");
    expect(states.at(-1)).toBe("failed");
  });

  it("a non-2xx finalize is reported as failed and never confirmed", async () => {
    const { outcome, states } = await run(
      [jsonResponse(201, CREATED), jsonResponse(410, problem("request_new_upload_grant", "Термін дії минув."))],
      [new Response(null, { status: 200 })],
    );
    expect(outcome.state).not.toBe("server_confirmed");
    expect(states).not.toContain("server_confirmed");
  });
});

describe("uploadCapture — a failing call maps through nextStateFor to the state userAction dictates", () => {
  it("a failing PUT carrying retry_part reports failed — nothing here retries the PUT", async () => {
    // Source's final review, Important 4: this used to assert "sending",
    // which claimed an in-flight upload while `uploadCapture` had already
    // returned.
    const { outcome, states } = await run(
      [jsonResponse(201, CREATED)],
      [jsonResponse(422, problem("retry_part", "Частину не отримано."))],
    );
    expect(outcome.state).toBe("failed");
    expect(states.at(-1)).toBe("failed");
    if (outcome.state !== "server_confirmed") {
      expect(outcome.message).toBe("Частину не отримано.");
    }
  });

  it("a failing create carrying request_new_upload_grant maps to not_sent", async () => {
    const { outcome } = await run(
      [jsonResponse(409, problem("request_new_upload_grant", "Потрібен новий намір."))],
      [],
    );
    expect(outcome.state).toBe("not_sent");
  });

  it("a failing finalize carrying refresh_upload_state_or_request_new_grant reports failed — nothing here re-GETs the intent", async () => {
    const { outcome, states } = await run(
      [jsonResponse(201, CREATED), jsonResponse(409, problem("refresh_upload_state_or_request_new_grant", "Стан змінився."))],
      [new Response(null, { status: 200 })],
    );
    expect(outcome.state).toBe("failed");
    // `awaiting_receipt` is emitted on the way IN to finalize, which is
    // correct — that request really was in flight. What must not survive is
    // it being the LAST thing the foreman is left looking at.
    expect(states).toEqual(["sending", "awaiting_receipt", "failed"]);
  });

  it("never leaves the screen on an in-progress label after it has stopped working", async () => {
    // The structural form of the two assertions above, across every failure
    // shape this module produces: whatever it narrates along the way, the
    // state it RESTS on can never be one that claims something is happening.
    const shapes: Array<{ post: Response[]; put: Response[] }> = [
      { post: [jsonResponse(422, problem("retry_part"))], put: [] },
      { post: [jsonResponse(201, CREATED)], put: [jsonResponse(422, problem("retry_part"))] },
      {
        post: [jsonResponse(201, CREATED), jsonResponse(409, problem("refresh_upload_state_or_request_new_grant"))],
        put: [new Response(null, { status: 200 })],
      },
      {
        post: [jsonResponse(201, CREATED), jsonResponse(500, problem("retry_part"))],
        put: [new Response(null, { status: 200 })],
      },
    ];
    for (const { post, put } of shapes) {
      const { outcome, states } = await run(post, put);
      expect(["sending", "awaiting_receipt"]).not.toContain(outcome.state);
      expect(["sending", "awaiting_receipt"]).not.toContain(states.at(-1));
    }
  });

  it("an unrecognised userAction defaults to failed, not a retry", async () => {
    const { outcome } = await run(
      [jsonResponse(422, problem("something_this_build_has_never_heard_of"))],
      [],
    );
    expect(outcome.state).toBe("failed");
  });

  it("a PUT failure with no parseable problem body still degrades to failed, honestly", async () => {
    // The real Supabase Storage error shape carries no `userAction` at all —
    // `readProblem` returns `{}` and `nextStateFor("")` falls to its
    // documented default.
    const { outcome, states } = await run(
      [jsonResponse(201, CREATED)],
      [new Response("not json at all", { status: 400 })],
    );
    expect(outcome.state).toBe("failed");
    expect(states).toEqual(["sending", "failed"]);
  });

  it("a thrown network error (the POST itself rejects) is reported as failed with the generic message", async () => {
    const throwingPost: PostLike = async () => { throw new Error("network down"); };
    const neverCalledFetch: FetchLike = async () => { throw new Error("PUT must not be called"); };
    const states: ClientState[] = [];
    const outcome = await uploadCapture(
      PHOTO, OCCURRENCE_ID, ASSIGNMENT_ID, PHOTO_ID, (s) => states.push(s),
      fakeHash, undefined, throwingPost, neverCalledFetch,
    );
    expect(outcome.state).toBe("failed");
    if (outcome.state !== "server_confirmed") {
      expect(outcome.message).toBe(GENERIC_FAILURE);
    }
    expect(states).toEqual(["sending", "failed"]);
  });
});

describe("uploadCapture — the discard confirmation's promise, enforced (source's final review, Important 3)", () => {
  it("hands the same AbortSignal to every request it makes", async () => {
    // Without this, aborting could stop one leg and let another run —
    // finalize being the one that actually creates the evidence record.
    const controller = new AbortController();
    const { postCalls, putCalls } = await run(
      [jsonResponse(201, CREATED), jsonResponse(200, AVAILABLE)],
      [new Response(null, { status: 200 })],
      controller.signal,
    );

    expect(postCalls).toHaveLength(2);
    expect(putCalls).toHaveLength(1);
    for (const call of postCalls) expect(call.signal).toBe(controller.signal);
    expect(putCalls[0]!.init?.signal).toBe(controller.signal);
  });

  it("aborting after the intent exists stops the pipeline before finalize is ever called", async () => {
    // THE DEFECT THIS CLOSES, as a test. «Скасувати це фото? Його не буде
    // збережено на сервері…» was a false statement in the source PWA before
    // its final review: `guard.supersede()` blocked UI writes and nothing
    // else, so the in-flight upload ran to completion, finalize succeeded,
    // and the server recorded an evidence object for the photo the foreman
    // had just been told would not be saved. Here the abort lands while the
    // PUT is in flight, exactly as a discard does, and the assertion is
    // about what the SERVER is asked to do — finalize (the second `postImpl`
    // call) must never happen.
    const controller = new AbortController();

    const postCalls: PostCall[] = [];
    const postImpl: PostLike = async (path, body, idempotencyKey, signal) => {
      postCalls.push({ path, body, idempotencyKey, signal });
      if (postCalls.length === 1) return jsonResponse(201, CREATED);
      // Answered (with the receipt it would really return) rather than left
      // hanging, so a regression fails on the length assertion below rather
      // than on a timeout, and the failure message is about evidence being
      // recorded.
      return jsonResponse(200, AVAILABLE);
    };

    const putCalls: FetchCall[] = [];
    let putStarted!: () => void;
    const putHasStarted = new Promise<void>((resolve) => { putStarted = resolve; });
    // A fake that behaves like the real `fetch` does under abort: the PUT's
    // promise rejects with an AbortError rather than resolving — but ONLY if
    // the signal actually reached it. The second listener, on the controller
    // directly, is what makes this test fail FAST and legibly if the signal
    // is ever dropped again: the PUT then simply succeeds and the
    // `toHaveLength(1)` assertion below names the defect, instead of the
    // whole test hanging to its timeout on a promise nobody can settle.
    const fetchImpl: FetchLike = async (url, init) => {
      putCalls.push({ url, init });
      putStarted();
      return await new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
        controller.signal.addEventListener("abort", () => {
          resolve(new Response(null, { status: 200 }));
        });
      });
    };

    const states: ClientState[] = [];
    const pending = uploadCapture(
      PHOTO, OCCURRENCE_ID, ASSIGNMENT_ID, PHOTO_ID, (s) => states.push(s),
      fakeHash, controller.signal, postImpl, fetchImpl,
    );
    await putHasStarted;
    controller.abort();
    const outcome = await pending;

    expect(postCalls).toHaveLength(1);
    expect(putCalls).toHaveLength(1);
    // An aborted attempt is never reported as saved. `capture.tsx` discards
    // this outcome entirely (the AttemptGuard has already superseded it), but
    // the honest value at this layer is `failed`, never `server_confirmed`.
    expect(outcome.state).toBe("failed");
    expect(states).not.toContain("server_confirmed");
  });
});
