import type {
  CreateUploadIntentRequest, CreateUploadIntentResponse, FinalizeUploadIntentResponse,
} from "@goproceed/contracts";

import { sha256Hex } from "./hash";
import type { ClientState } from "./state";
import { nextStateFor } from "./recover";

/**
 * THE ORCHESTRATOR, EXTRACTED FROM `capture.tsx` SO IT CAN BE RUN IN PLAIN
 * NODE, WITH NO DOM. Fix round 1 finding 2: the code that actually runs in
 * the browser — the fetch sequencing, the `onStateChange` calls at each
 * transition, the error mapping through `nextStateFor` — was previously
 * module-private inside a `"use client"` component and reachable only by
 * rendering it, which nothing did. `upload.test.ts` drives this module
 * directly with a fake `fetch`, so a regression here (a stray body field, a
 * dropped transition, a finalize response read as success when it is not)
 * fails a Node-only unit test instead of nothing at all.
 */

/** Everything `buildCreateIntentBody` needs about the file and the attempt. */
export type CaptureInput = {
  file: File;
  occurrenceId: string;
  expectedContentHash: string;
  deviceCaptureId: string;
};

/**
 * THE ONE PLACE THIS CLIENT'S REQUEST BODY IS ASSEMBLED, and the reason
 * INV-086 holds for a v0.1 PWA build: `originMethod` IS NOT A PARAMETER OF
 * THIS FUNCTION. `CaptureInput` carries no field a caller could route into
 * it, so there is no argument — not a typo, not a stray spread, not a future
 * caller reaching for "the same shape as the native client uses" — through
 * which `native_camera` could leave this module. The literal below is the
 * only value this build can ever send.
 *
 * `apps/app/tests/field-capture.int.test.ts` proves this two ways against
 * the real routes; `upload.test.ts` proves a THIRD way that the earlier two
 * could not: it asserts the value on the ACTUAL body `uploadCapture` sends
 * to `fetch`, not on this function called in isolation — closing exactly the
 * regression fix-round-1 finding 2 named (`uploadCapture` could stop calling
 * this function, inline its own body, and reintroduce a spread that carries
 * `originMethod` through, and neither of the other two tests would notice).
 *
 * A browser has no camera-session identity and may be handed bytes the
 * browser itself stripped or transcoded, so the origin cannot be
 * established. `origin_not_distinguished` is the honest claim this build is
 * permitted to make — not a weaker version of a camera claim (ADR-007
 * decision 5; INV-086).
 */
export function buildCreateIntentBody(input: CaptureInput): CreateUploadIntentRequest {
  return {
    requirementOccurrenceId: input.occurrenceId,
    expectedContentHash: input.expectedContentHash,
    expectedByteSize: input.file.size,
    claimedMediaType: input.file.type,
    originalFilename: input.file.name,
    deviceCaptureId: input.deviceCaptureId,
    originMethod: "origin_not_distinguished",
    // DEVICE-CLAIMED, AND LABELLED SO WHEREVER IT IS SHOWN (capture.tsx's
    // receipt rendering). `file.lastModified` is the file's own mtime, which
    // the device asserts and nobody has verified — it is never rendered
    // beside the server receipt time without saying so (ADR-007 decision 5).
    claimedCaptureTime: new Date(input.file.lastModified).toISOString(),
  };
}

/** A fresh key per call attempt — NOT per photo. `photoId` (capture.tsx) is the contrast. */
export function attemptKey(): string {
  return crypto.randomUUID();
}

type ProblemLike = { detail: string; userAction: string };

async function readProblem(res: Response): Promise<ProblemLike | null> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "userAction" in body
        && typeof (body as { userAction: unknown }).userAction === "string") {
      const detail = (body as { detail?: unknown }).detail;
      return { detail: typeof detail === "string" ? detail : "", userAction: (body as { userAction: string }).userAction };
    }
  } catch {
    // Not JSON — fall through to the generic message the caller supplies.
  }
  return null;
}

export type UploadOutcome =
  | { state: "server_confirmed"; evidenceObjectId: string; contentHash: string; serverReceivedAt: string }
  | { state: Exclude<ClientState, "server_confirmed">; message: string };

/**
 * `nextStateFor` (task 6) is typed to return the full `ClientState` union,
 * though its own switch has no case that produces "server_confirmed" — only
 * `finalized.status === "available"` may. This turns that fact into an actual
 * type guard instead of an unsafe cast, and turns "it happened anyway" into
 * an honest `failed` rather than a silent, unearned claim that the photo is
 * saved.
 */
function nonConfirmed(s: ClientState): Exclude<ClientState, "server_confirmed"> {
  return s === "server_confirmed" ? "failed" : s;
}

export const GENERIC_FAILURE = "Не вдалося зберегти фото. Перевірте з'єднання та спробуйте ще раз.";

/** The shape `uploadCapture` needs from `fetch` — real global `fetch` satisfies it, so does a fake. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * The body of the upload. Every state transition below is CLIENT-LOCAL and
 * never sent to the server — there is no server write path for `sending` or
 * `awaiting_receipt`, and INV-081 is decided entirely by `finalized.status
 * === "available"`, read through `isSaved` (task 6), not by anything this
 * function narrates along the way.
 *
 * `fetchImpl` defaults to the real global `fetch` so `capture.tsx` does not
 * have to pass one; `upload.test.ts` passes a fake to run this in Node with
 * no network and no DOM.
 *
 * `signal` IS WHAT MAKES THE DISCARD CONFIRMATION TRUE (final review,
 * Important 3). It is attached to all three requests, so aborting it after the
 * create has returned but before finalize has run means no evidence object is
 * ever recorded — which is what «Його не буде збережено на сервері» says. It
 * was previously absent and the deferral called that "harmless now that
 * nothing it returns can be written": true of the SCREEN, false of the
 * server's records, which is the half that matters in a product about
 * evidence. Optional, because nothing forces a caller to offer a cancel
 * control; when it is omitted the requests simply run to completion as before.
 */
export async function uploadCapture(
  file: File, occurrenceId: string, assignmentId: string, photoId: string,
  onStateChange: (s: ClientState) => void,
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch,
): Promise<UploadOutcome> {
  onStateChange("sending");
  try {
    // THE FILE IS NEVER DRAWN TO A CANVAS. ADR-007 Cost 1 makes "do not
    // recompress the original" binding, and a canvas round-trip is the
    // ScaneReport anti-pattern it names. We read the bytes and send exactly
    // those bytes, to storage and to the hash, with nothing in between.
    const bytes = await file.arrayBuffer();
    const expectedContentHash = await sha256Hex(bytes);

    const body = buildCreateIntentBody({
      file, occurrenceId, expectedContentHash, deviceCaptureId: photoId,
    });

    const createRes = await fetchImpl(`/v1/assignments/${assignmentId}/upload-intents`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": attemptKey() },
      body: JSON.stringify(body),
      // `?? null`, not a bare `signal`: `tsconfig.json` sets
      // `exactOptionalPropertyTypes`, and `RequestInit.signal` is
      // `AbortSignal | null` — an explicit `undefined` is a type error rather
      // than an omission. `null` is what "no signal" means to `fetch`.
      signal: signal ?? null,
    });
    if (!createRes.ok) {
      const problem = await readProblem(createRes);
      const state = nonConfirmed(nextStateFor(problem?.userAction ?? ""));
      onStateChange(state);
      return { state, message: problem?.detail || GENERIC_FAILURE };
    }
    const created = await createRes.json() as CreateUploadIntentResponse;

    // …PUT the bytes to created.upload.signedUrl → "sending" (already set,
    // above — the whole staging phase, hash through PUT, is one client state).
    //
    // STRAIGHT TO SUPABASE STORAGE, NOT THROUGH /v1. No Authorization or
    // apikey header: the signed token in `signedUrl` IS the authorization a
    // signed upload URL is for, and adding a second, session-scoped Supabase
    // client here just to attach headers Storage does not ask for would be a
    // second, unaudited path into Supabase from the browser — exactly what
    // `src/lib/supabase-browser.ts`'s own comment says this client keeps to
    // one call site of (the OTP exchange, which this is not). Verified by
    // hand against the running local stack: a signed upload URL needs no
    // apikey/Authorization header at all, only the token already in it.
    const putRes = await fetchImpl(created.upload.signedUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: bytes,
      // `?? null`, not a bare `signal`: `tsconfig.json` sets
      // `exactOptionalPropertyTypes`, and `RequestInit.signal` is
      // `AbortSignal | null` — an explicit `undefined` is a type error rather
      // than an omission. `null` is what "no signal" means to `fetch`.
      signal: signal ?? null,
    });
    if (!putRes.ok) {
      // Routed through the same readProblem/nextStateFor pipeline as the
      // other two calls, for one pipeline rather than three near-identical
      // ones — not because Supabase Storage's own error body is expected to
      // carry a `userAction` (it never will; `readProblem` returns null and
      // `nextStateFor("")` falls to its own documented default, `failed`).
      // The original is still in hand (it never left this component's
      // memory) and the intent is still authorized, so `failed` — not
      // `not_sent` — is the honest report: this build has no offline queue
      // to actually resume from (ADR-007 decision 6).
      const problem = await readProblem(putRes);
      const state = nonConfirmed(nextStateFor(problem?.userAction ?? ""));
      onStateChange(state);
      return { state, message: problem?.detail || GENERIC_FAILURE };
    }

    // …POST /v1/upload-intents/{id}/finalize → "awaiting_receipt"
    onStateChange("awaiting_receipt");
    const finalizeRes = await fetchImpl(`/v1/upload-intents/${created.uploadIntentId}/finalize`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": attemptKey() },
      body: JSON.stringify({}),
      // `?? null`, not a bare `signal`: `tsconfig.json` sets
      // `exactOptionalPropertyTypes`, and `RequestInit.signal` is
      // `AbortSignal | null` — an explicit `undefined` is a type error rather
      // than an omission. `null` is what "no signal" means to `fetch`.
      signal: signal ?? null,
    });
    if (!finalizeRes.ok) {
      const problem = await readProblem(finalizeRes);
      const state = nonConfirmed(nextStateFor(problem?.userAction ?? ""));
      onStateChange(state);
      return { state, message: problem?.detail || GENERIC_FAILURE };
    }
    const finalized = await finalizeRes.json() as FinalizeUploadIntentResponse;

    // …only status === "available" → "server_confirmed". `upload_received`
    // is not `evidence_available` (INV-081); nothing above this line may
    // claim the photo is saved, and this is the one branch that may.
    if (finalized.status !== "available" || finalized.contentHash === null
        || finalized.evidenceObjectId === null || finalized.serverReceivedAt === null) {
      onStateChange("failed");
      return { state: "failed", message: GENERIC_FAILURE };
    }
    onStateChange("server_confirmed");
    return {
      state: "server_confirmed",
      evidenceObjectId: finalized.evidenceObjectId,
      contentHash: finalized.contentHash,
      serverReceivedAt: finalized.serverReceivedAt,
    };
  } catch {
    // Network failure, a body that was not JSON, anything unanticipated.
    // THE DEFAULT IS `failed`, NOT A RETRY (recover.ts's own rule, restated
    // here for the case that never reaches `nextStateFor` at all): retrying
    // blindly against an unknown condition is how a client hammers a server
    // that just dropped the connection.
    onStateChange("failed");
    return { state: "failed", message: GENERIC_FAILURE };
  }
}
