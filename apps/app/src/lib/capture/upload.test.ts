import { describe, it, expect } from "vitest";
import { uploadCapture, GENERIC_FAILURE, type FetchLike } from "./upload";
import type { ClientState } from "./state";

/**
 * `uploadCapture` run in plain Node, no DOM, no network — fix round 1
 * finding 2. `field-capture.int.test.ts` proves the real routes agree with
 * what this file assumes; this file proves `uploadCapture` itself: the fetch
 * sequencing, the `onStateChange` calls at each transition, and the mapping
 * of a failure through `nextStateFor`. Neither suite alone covered this
 * before — the integration test drove the routes directly and
 * `buildCreateIntentBody` in isolation, never `uploadCapture`.
 */

const FILE = new File(
  [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "фото.jpg",
  { type: "image/jpeg", lastModified: new Date("2026-08-10T09:00:00Z").getTime() },
);

const OCCURRENCE_ID = "11111111-1111-4111-8111-111111111111";
const ASSIGNMENT_ID = "22222222-2222-4222-8222-222222222222";
const PHOTO_ID = "33333333-3333-4333-8333-333333333333";

type Call = { url: string; init: RequestInit | undefined };

/**
 * A sequential fake: the Nth call to `fetchImpl` gets the Nth queued
 * `Response`, and every call (url + init) is recorded for the request-shape
 * assertions below. `Response` is Node's real global class — the same class
 * `fetch` itself would hand back — so `.ok`/`.json()` behave identically to
 * the real thing.
 */
function fakeFetch(responses: Response[]): { fetchImpl: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
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

async function run(responses: Response[]) {
  const { fetchImpl, calls } = fakeFetch(responses);
  const states: ClientState[] = [];
  const outcome = await uploadCapture(
    FILE, OCCURRENCE_ID, ASSIGNMENT_ID, PHOTO_ID, (s) => states.push(s), fetchImpl,
  );
  return { outcome, states, calls };
}

describe("uploadCapture — the happy path", () => {
  it("emits exactly sending → awaiting_receipt → server_confirmed, in that order", async () => {
    const { outcome, states } = await run([
      jsonResponse(201, CREATED),
      new Response(null, { status: 200 }),
      jsonResponse(200, AVAILABLE),
    ]);

    expect(states).toEqual(["sending", "awaiting_receipt", "server_confirmed"]);
    expect(outcome.state).toBe("server_confirmed");
    if (outcome.state === "server_confirmed") {
      expect(outcome.evidenceObjectId).toBe("evidence-1");
      expect(outcome.contentHash).toBe(AVAILABLE.contentHash);
      expect(outcome.serverReceivedAt).toBe(AVAILABLE.serverReceivedAt);
    }
  });

  it("PUTs to the create response's signedUrl, unmodified, and with no extra auth header", async () => {
    const { calls } = await run([
      jsonResponse(201, CREATED),
      new Response(null, { status: 200 }),
      jsonResponse(200, AVAILABLE),
    ]);

    const put = calls[1]!;
    expect(put.url).toBe(CREATED.upload.signedUrl);
    expect(put.init?.method).toBe("PUT");
    const headers = new Headers(put.init?.headers);
    expect(headers.get("content-type")).toBe("image/jpeg");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("apikey")).toBeNull();
  });

  it("the create call carries origin_not_distinguished and no other originMethod — on the ACTUAL request sent, not on buildCreateIntentBody called in isolation", async () => {
    // This is the regression fix round 1 finding 2 named: `uploadCapture`
    // could stop calling `buildCreateIntentBody` and inline its own body,
    // reintroducing a spread that carries a different `originMethod` through
    // — and a test that only called `buildCreateIntentBody` directly would
    // never notice, because it would not be exercising `uploadCapture` at
    // all. This inspects the literal JSON string `uploadCapture` handed to
    // `fetch` for the create call.
    const { calls } = await run([
      jsonResponse(201, CREATED),
      new Response(null, { status: 200 }),
      jsonResponse(200, AVAILABLE),
    ]);

    const sent = JSON.parse(calls[0]!.init?.body as string) as Record<string, unknown>;
    expect(sent.originMethod).toBe("origin_not_distinguished");
    expect(sent.deviceCaptureId).toBe(PHOTO_ID);
    expect(sent.requirementOccurrenceId).toBe(OCCURRENCE_ID);
  });

  it("carries an Idempotency-Key on the create call and a different one on finalize", async () => {
    const { calls } = await run([
      jsonResponse(201, CREATED),
      new Response(null, { status: 200 }),
      jsonResponse(200, AVAILABLE),
    ]);
    const createKey = new Headers(calls[0]!.init?.headers).get("idempotency-key");
    const finalizeKey = new Headers(calls[2]!.init?.headers).get("idempotency-key");
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
    const { outcome, states } = await run([
      jsonResponse(201, CREATED),
      new Response(null, { status: 200 }),
      jsonResponse(200, {
        uploadIntentId: "intent-1", status: "scan_blocked", evidenceObjectId: null,
        contentHash: null, serverReceivedAt: null, failureCode: "declared_type_mismatch",
      }),
    ]);
    expect(outcome.state).not.toBe("server_confirmed");
    expect(outcome.state).toBe("failed");
    expect(states).not.toContain("server_confirmed");
    expect(states.at(-1)).toBe("failed");
  });

  it("a non-2xx finalize is reported as failed and never confirmed", async () => {
    const { outcome, states } = await run([
      jsonResponse(201, CREATED),
      new Response(null, { status: 200 }),
      jsonResponse(410, problem("request_new_upload_grant", "Термін дії минув.")),
    ]);
    expect(outcome.state).not.toBe("server_confirmed");
    expect(states).not.toContain("server_confirmed");
  });
});

describe("uploadCapture — a failing call maps through nextStateFor to the state userAction dictates", () => {
  it("a failing PUT carrying retry_part maps to sending", async () => {
    const { outcome } = await run([
      jsonResponse(201, CREATED),
      jsonResponse(422, problem("retry_part", "Частину не отримано.")),
      jsonResponse(200, AVAILABLE), // unreached
    ]);
    expect(outcome.state).toBe("sending");
    if (outcome.state !== "server_confirmed") {
      expect(outcome.message).toBe("Частину не отримано.");
    }
  });

  it("a failing create carrying request_new_upload_grant maps to not_sent", async () => {
    const { outcome } = await run([
      jsonResponse(409, problem("request_new_upload_grant", "Потрібен новий намір.")),
    ]);
    expect(outcome.state).toBe("not_sent");
  });

  it("a failing finalize carrying refresh_upload_state_or_request_new_grant maps to awaiting_receipt", async () => {
    const { outcome } = await run([
      jsonResponse(201, CREATED),
      new Response(null, { status: 200 }),
      jsonResponse(409, problem("refresh_upload_state_or_request_new_grant", "Стан змінився.")),
    ]);
    expect(outcome.state).toBe("awaiting_receipt");
  });

  it("an unrecognised userAction defaults to failed, not a retry", async () => {
    const { outcome } = await run([
      jsonResponse(422, problem("something_this_build_has_never_heard_of")),
    ]);
    expect(outcome.state).toBe("failed");
  });

  it("a PUT failure with no parseable problem body still degrades to failed, honestly", async () => {
    // The real Supabase Storage error shape carries no `userAction` at all —
    // `readProblem` returns null and `nextStateFor("")` falls to its
    // documented default.
    const { outcome, states } = await run([
      jsonResponse(201, CREATED),
      new Response("not json at all", { status: 400 }),
      jsonResponse(200, AVAILABLE), // unreached
    ]);
    expect(outcome.state).toBe("failed");
    expect(states).toEqual(["sending", "failed"]);
  });

  it("a thrown network error (fetch itself rejects) is reported as failed with the generic message", async () => {
    const throwing: FetchLike = async () => { throw new Error("network down"); };
    const states: ClientState[] = [];
    const outcome = await uploadCapture(
      FILE, OCCURRENCE_ID, ASSIGNMENT_ID, PHOTO_ID, (s) => states.push(s), throwing,
    );
    expect(outcome.state).toBe("failed");
    if (outcome.state !== "server_confirmed") {
      expect(outcome.message).toBe(GENERIC_FAILURE);
    }
    expect(states).toEqual(["sending", "failed"]);
  });
});
