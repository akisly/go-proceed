import type { CreateUploadIntentRequest } from "@goproceed/contracts";

/**
 * The upload-intent body the retired field PWA sent — kept as a TEST HELPER.
 *
 * [2026-09-23, DEV-035] Moved here verbatim from `src/lib/capture/upload.ts`
 * when the owner retired the field PWA («удали все что в (app)», «Всё
 * мёртвое»): nothing in the app sends this body any more, but three
 * integration suites (`field-capture`, `evidence-read`, `external-evidence`)
 * drive the real `/v1` upload routes with exactly this shape, and the field
 * client in `apps/mobile` sends the same one (`apps/mobile/src/lib/capture/
 * upload.ts`). The rest of `src/lib/capture` — the state machine, the
 * orchestrator, the hash and recovery helpers and their unit tests — was
 * deleted with the screen that used it; `apps/mobile` holds its own copy.
 * The notes below are the original module's, kept as written — the
 * `upload.test.ts` and `uploadCapture` they cite were deleted with it; the
 * live equivalents are `apps/mobile/src/lib/capture/upload{,.test}.ts`.
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
    // DEVICE-CLAIMED, AND LABELLED SO WHEREVER IT IS SHOWN (the retired PWA's
    // receipt rendering). `file.lastModified` is the file's own mtime, which
    // the device asserts and nobody has verified — it is never rendered
    // beside the server receipt time without saying so (ADR-007 decision 5).
    claimedCaptureTime: new Date(input.file.lastModified).toISOString(),
  };
}
