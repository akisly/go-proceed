// PORT of apps/app/src/lib/capture/upload.ts, adapted for the platform
// deltas this task's brief names — everything else (state-transition order,
// request-body fields, the success gate, the error mapping) is
// byte-identical logic. Transitional duplication under ADR-009: the PWA
// original retires when the Expo client passes the parity gate; until then
// fix bugs in BOTH files.
//
// THREE DELTAS, ALL FORCED:
//
//   1. `PickedPhoto`, NOT A DOM `File`. Nothing on this platform hands
//      `uploadCapture` a `File` — see that type's own comment below and
//      `src/screens/capture.tsx`'s header for where each field comes from.
//
//   2. `hashImpl` IS A REQUIRED PARAMETER, NOT AN IMPORT OF `./hash`. The
//      source imports `sha256Hex` at module scope. This module does not,
//      because `./hash` imports `expo-crypto`, which imports
//      `expo-modules-core` → `react-native`, and `react-native`'s own entry
//      point fails to PARSE under this package's plain-Node
//      `vitest.config.ts` (Flow's `import typeof * as X from …` syntax,
//      verified directly — see `hash.ts`'s header and this task's report).
//      A static `import { sha256Hex } from "./hash"` at the top of this file
//      would make `upload.test.ts` fail before a single test runs, whether
//      or not any test path actually calls the real function. Requiring the
//      hasher as an argument — with NO default value referencing the real
//      one — keeps this module's own import graph clean of `expo-crypto`;
//      `src/screens/capture.tsx` (never reached by `vitest`) is where the
//      real `sha256Hex` and this function are wired together.
//
//   3. CREATE AND FINALIZE GO THROUGH `apiPost` (`../api.ts`), NOT A BARE
//      `fetchImpl`. The source's single `fetchImpl` works because
//      `apps/app` is a same-origin Next.js app authorised by a session
//      cookie; this client calls an external `/v1` origin
//      (`EXPO_PUBLIC_API_ORIGIN`) and must attach `Authorization: Bearer
//      <token>` itself, which is exactly what `apiPost` already does (and
//      is tested doing, in `../api.test.ts`) for every other mutating call
//      this app makes. The PUT to Supabase Storage's `signedUrl` is the ONE
//      exception, unchanged from source: a RAW `fetchImpl` call with ONLY a
//      `content-type` header — see that call site's own comment for why an
//      Authorization/apikey header there would be a second, unaudited path
//      into Supabase.

import { apiPost, readProblem } from "../api";
import type { ClientState } from "./state";
import { nextStateFor } from "./recover";

/**
 * Inlined from @goproceed/contracts (not a mobile app dependency) — same
 * shapes `apps/app/src/lib/capture/upload.ts` imports from
 * `packages/contracts/src/uploads.ts`, kept in sync with it by hand.
 */
export interface CreateUploadIntentRequest {
  requirementOccurrenceId?: string;
  expectedContentHash: string;
  expectedByteSize: number;
  claimedMediaType: string;
  originalFilename?: string;
  deviceCaptureId: string;
  originMethod:
    | "native_camera" | "photo_picker" | "file_picker" | "form"
    | "origin_not_distinguished";
  claimedCaptureTime?: string;
  claimedTzOffset?: string;
  sourceAppVersion?: string;
}

interface UploadIntentReceipt {
  uploadIntentId: string;
  workspaceId: string;
  status: string;
  expiresAt: string;
  storage: { bucket: string; key: string };
}

interface CreateUploadIntentResponse extends UploadIntentReceipt {
  upload: { signedUrl: string; token: string };
}

interface FinalizeUploadIntentResponse {
  uploadIntentId: string;
  status: string;
  evidenceObjectId: string | null;
  contentHash: string | null;
  serverReceivedAt: string | null;
  failureCode: string | null;
}

/**
 * The picker asset, reduced to exactly what this module needs — DELTA 1
 * (file header). Not a DOM `File`: nothing on this platform hands
 * `uploadCapture` one. `src/screens/capture.tsx` builds this from
 * `ImagePicker`'s result — on web, from the returned asset's own `file:
 * File` (`bytes` via `file.arrayBuffer()`, the rest via the `File`'s own
 * fields) — the same four facts `buildCreateIntentBody` (source) reads off
 * a `File` directly: byte length, declared media type, a filename, and a
 * device-claimed modification time.
 */
export type PickedPhoto = {
  bytes: ArrayBuffer;
  mediaType: string;
  fileName: string;
  lastModifiedMs: number;
  byteSize: number;
};

/** Everything `buildCreateIntentBody` needs about the photo and the attempt. */
export type CaptureInput = {
  photo: PickedPhoto;
  occurrenceId: string;
  expectedContentHash: string;
  deviceCaptureId: string;
};

/**
 * THE ONE PLACE THIS CLIENT'S REQUEST BODY IS ASSEMBLED, and the reason
 * INV-086 holds for this build exactly as it does for the PWA:
 * `originMethod` IS NOT A PARAMETER OF THIS FUNCTION. `CaptureInput` carries
 * no field a caller could route into it, so there is no argument — not a
 * typo, not a stray spread — through which anything but
 * `origin_not_distinguished` could leave this module. A mobile build has no
 * more claim to `native_camera` than the PWA does today: the web
 * `ImagePicker` path this client actually ships on (see capture.tsx) is a
 * browser file input under the hood, and the native path is an unimplemented
 * TODO — neither establishes a camera-session identity this build could
 * honestly assert.
 */
export function buildCreateIntentBody(input: CaptureInput): CreateUploadIntentRequest {
  return {
    requirementOccurrenceId: input.occurrenceId,
    expectedContentHash: input.expectedContentHash,
    expectedByteSize: input.photo.byteSize,
    claimedMediaType: input.photo.mediaType,
    originalFilename: input.photo.fileName,
    deviceCaptureId: input.deviceCaptureId,
    originMethod: "origin_not_distinguished",
    // DEVICE-CLAIMED, AND LABELLED SO WHEREVER IT IS SHOWN
    // (`src/screens/capture.tsx`'s receipt rendering). `lastModifiedMs` is
    // the picked file's own mtime, which the device asserts and nobody has
    // verified — it is never rendered beside the server receipt time
    // without saying so (ADR-007 decision 5).
    claimedCaptureTime: new Date(input.photo.lastModifiedMs).toISOString(),
  };
}

/** A fresh key per call attempt — NOT per photo. `photoId` (capture.tsx) is the contrast. */
export function attemptKey(): string {
  return crypto.randomUUID();
}

export type UploadOutcome =
  | { state: "server_confirmed"; evidenceObjectId: string; contentHash: string; serverReceivedAt: string }
  | { state: Exclude<ClientState, "server_confirmed">; message: string };

/**
 * `nextStateFor` is typed to return the full `ClientState` union, though its
 * own switch has no case that produces "server_confirmed" — only
 * `finalized.status === "available"` may. This turns that fact into an
 * actual type guard instead of an unsafe cast, and turns "it happened
 * anyway" into an honest `failed` rather than a silent, unearned claim that
 * the photo is saved.
 */
function nonConfirmed(s: ClientState): Exclude<ClientState, "server_confirmed"> {
  return s === "server_confirmed" ? "failed" : s;
}

export const GENERIC_FAILURE = "Не вдалося зберегти фото. Перевірте з'єднання та спробуйте ще раз.";

/** The shape `uploadCapture` needs for the raw PUT — real global `fetch` satisfies it, so does a fake. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * The shape `uploadCapture` needs for an authenticated `/v1` POST — real
 * `apiPost` (`../api.ts`) satisfies it, so does a fake. See DELTA 3 (file
 * header) for why this replaces the source's uniform `fetchImpl` for the
 * create and finalize calls.
 */
export type PostLike = (
  path: string, body: unknown, idempotencyKey: string, signal?: AbortSignal,
) => Promise<Response>;

/** The shape `uploadCapture` needs for the hasher — see DELTA 2 (file header) for why there is no default. */
export type HashLike = (bytes: ArrayBuffer) => Promise<string>;

/**
 * The body of the upload. Every state transition below is CLIENT-LOCAL and
 * never sent to the server — there is no server write path for `sending` or
 * `awaiting_receipt`, and INV-081 is decided entirely by `finalized.status
 * === "available"`, read through `isSaved` (`./state.ts`), not by anything
 * this function narrates along the way.
 *
 * `postImpl`/`fetchImpl` default to the real `apiPost`/global `fetch` so
 * `src/screens/capture.tsx` does not have to pass either;
 * `upload.test.ts` passes fakes to run this in Node with no network.
 * `hashImpl` has NO default — see DELTA 2 (file header).
 *
 * `signal` IS WHAT MAKES THE DISCARD CONFIRMATION TRUE (source's final
 * review, Important 3). It is attached to all three requests (the PUT
 * directly; the two `apiPost` calls via the `signal` parameter added to that
 * function for this module — see `../api.ts`'s own comment), so aborting it
 * after the create has returned but before finalize has run means no
 * evidence object is ever recorded — which is what «Його не буде збережено
 * на сервері» says. Optional, because nothing forces a caller to offer a
 * cancel control; when it is omitted the requests simply run to completion
 * as before.
 */
export async function uploadCapture(
  photo: PickedPhoto,
  occurrenceId: string,
  assignmentId: string,
  photoId: string,
  onStateChange: (s: ClientState) => void,
  hashImpl: HashLike,
  signal?: AbortSignal,
  postImpl: PostLike = apiPost,
  fetchImpl: FetchLike = fetch,
): Promise<UploadOutcome> {
  onStateChange("sending");
  try {
    // THE FILE IS NEVER DRAWN TO A CANVAS. ADR-007 Cost 1 makes "do not
    // recompress the original" binding, and a canvas round-trip is the
    // anti-pattern it names. We read the bytes once (in the screen, before
    // this function ever sees them) and send exactly those bytes, to
    // storage and to the hash, with nothing in between.
    const expectedContentHash = await hashImpl(photo.bytes);

    const body = buildCreateIntentBody({
      photo, occurrenceId, expectedContentHash, deviceCaptureId: photoId,
    });

    const createRes = await postImpl(
      `/v1/assignments/${assignmentId}/upload-intents`, body, attemptKey(), signal,
    );
    if (!createRes.ok) {
      const problem = await readProblem(createRes);
      const state = nonConfirmed(nextStateFor(problem.userAction ?? ""));
      onStateChange(state);
      return { state, message: problem.detail || GENERIC_FAILURE };
    }
    const created = await createRes.json() as CreateUploadIntentResponse;

    // …PUT the bytes to created.upload.signedUrl → "sending" (already set,
    // above — the whole staging phase, hash through PUT, is one client state).
    //
    // STRAIGHT TO SUPABASE STORAGE, NOT THROUGH /v1. No Authorization or
    // apikey header: the signed token in `signedUrl` IS the authorization a
    // signed upload URL is for, and attaching this session's bearer token
    // (or any other header Storage does not ask for) here would be a
    // second, unaudited path into Supabase from this client — exactly what
    // the source's identical comment on this call site warns against.
    // Verified against the source's own hand-verification note: a signed
    // upload URL needs no apikey/Authorization header at all, only the
    // token already in it.
    const putRes = await fetchImpl(created.upload.signedUrl, {
      method: "PUT",
      headers: { "content-type": photo.mediaType },
      body: photo.bytes,
      signal,
    });
    if (!putRes.ok) {
      // Routed through the same readProblem/nextStateFor pipeline as the
      // other two calls, for one pipeline rather than three near-identical
      // ones — not because Supabase Storage's own error body is expected to
      // carry a `userAction` (it never will; `readProblem` returns `{}` and
      // `nextStateFor("")` falls to its own documented default, `failed`).
      // The original is still in hand (it never left this call's memory)
      // and the intent is still authorized, so `failed` — not `not_sent` —
      // is the honest report: this build has no offline queue to actually
      // resume from (ADR-007 decision 6).
      const problem = await readProblem(putRes);
      const state = nonConfirmed(nextStateFor(problem.userAction ?? ""));
      onStateChange(state);
      return { state, message: problem.detail || GENERIC_FAILURE };
    }

    // …POST /v1/upload-intents/{id}/finalize → "awaiting_receipt"
    onStateChange("awaiting_receipt");
    const finalizeRes = await postImpl(
      `/v1/upload-intents/${created.uploadIntentId}/finalize`, {}, attemptKey(), signal,
    );
    if (!finalizeRes.ok) {
      const problem = await readProblem(finalizeRes);
      const state = nonConfirmed(nextStateFor(problem.userAction ?? ""));
      onStateChange(state);
      return { state, message: problem.detail || GENERIC_FAILURE };
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
