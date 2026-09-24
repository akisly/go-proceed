// Ported from apps/app/src/lib/capture/recover.ts, which DEV-035 deleted with the field PWA
// (2026-09-23): this copy is the only one now, so fix bugs here.

import type { ClientState } from "./state";

/**
 * The route's own `userAction` taxonomy decides recovery, so the screen does not
 * carry a second opinion about what a failure means.
 *
 * THE DEFAULT IS `failed`, NOT A RETRY. An action this build does not recognise
 * is one the server learned after this client shipped; retrying blindly against
 * an unknown condition is how a client hammers a server that just told it to
 * stop. `failed` is honest and the user is told the photo is not saved.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS MAPS TO WHAT THE CLIENT ACTUALLY DOES, NOT TO WHAT THE TAXONOMY NAMES —
 * a correction from the source's final whole-branch review (Important 4).
 *
 * `retry_part` used to return `sending` and
 * `refresh_upload_state_or_request_new_grant` used to return
 * `awaiting_receipt`, on the strength of the design document's §6, which
 * describes those actions in the present tense: «`retry_part` retries the PUT;
 * `refresh_upload_state_or_request_new_grant` re-GETs the intent». No code ever
 * did either. `uploadCapture` sets the state and returns; nothing retries the
 * PUT, nothing creates a second intent, and `GET /v1/upload-intents/{intentId}`
 * is not called from this client at all. So the foreman was shown «Надсилання»
 * or «Очікування підтвердження» — both of which say an operation is under way —
 * while nothing whatsoever was in flight, with the unsaved-photo banner
 * contradicting the label right beneath it.
 *
 * Both now return `failed`, whose approved label is «Потрібна дія» — action
 * needed — which is exactly the truth: the client has stopped, the photo is not
 * saved, and the next move is the foreman's (picking the file again re-runs the
 * whole pipeline, since the file input doubles as the retry control). The
 * design document was corrected in the same change to describe this, rather
 * than being left asserting a recovery loop that does not exist. Implementing
 * the intent re-GET properly is a real and worthwhile future slice; half-doing
 * it, or continuing to narrate it, is not.
 *
 * `request_new_upload_grant` and `sign_in` keep `not_sent` because that label —
 * «Не надіслано» — makes no claim about an operation in progress. It states the
 * one thing that is true in both cases: this photo has not been sent. The
 * problem detail rendered beside it carries the specific remedy.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function nextStateFor(userAction: string): ClientState {
  switch (userAction) {
    case "retry_part": return "failed";
    case "refresh_upload_state_or_request_new_grant": return "failed";
    case "request_new_upload_grant": return "not_sent";
    case "sign_in": return "not_sent";
    default: return "failed";
  }
}
