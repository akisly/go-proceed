import type { ClientState } from "./state";

/**
 * The route's own `userAction` taxonomy decides recovery, so the screen does not
 * carry a second opinion about what a failure means.
 *
 * THE DEFAULT IS `failed`, NOT A RETRY. An action this build does not recognise
 * is one the server learned after this client shipped; retrying blindly against
 * an unknown condition is how a client hammers a server that just told it to
 * stop. `failed` is honest and the user is told the photo is not saved.
 */
export function nextStateFor(userAction: string): ClientState {
  switch (userAction) {
    case "retry_part": return "sending";
    case "request_new_upload_grant": return "not_sent";
    case "refresh_upload_state_or_request_new_grant": return "awaiting_receipt";
    case "sign_in": return "not_sent";
    default: return "failed";
  }
}
