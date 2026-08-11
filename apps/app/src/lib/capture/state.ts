/**
 * THE SIX STATES THE PWA PATH ACTUALLY REACHES, as a closed union.
 *
 * `state-catalog.csv:38-45` carries EIGHT rows for `mobile_pending_original`.
 * Two of them — `quarantined` and `expired_purged` — are NATIVE CLIENT ONLY
 * (ADR-007 decision 6): both rest on a Keychain/Keystore-bound wrapping key and
 * on storage the OS does not reclaim, and a browser gives neither. They are
 * absent from this type rather than merely unused, so a screen cannot render a
 * label for a state it can never be in — `copy-catalog.csv:92` says exactly that
 * about `quarantined`, and a comment would not have enforced it.
 */
export type ClientState =
  | "not_sent" | "sending" | "awaiting_receipt"
  | "server_confirmed" | "failed" | "discarded";

/** copy-catalog.csv:87-93, verbatim. Not translated here, ever. */
export const CLIENT_STATE_LABEL: Record<ClientState, string> = {
  not_sent: "Не надіслано",
  sending: "Надсилання",
  awaiting_receipt: "Очікування підтвердження",
  server_confirmed: "Підтверджено сервером",
  failed: "Потрібна дія",
  discarded: "Видалено користувачем",
};

/**
 * INV-081's first half, as a function. `upload_received` is not
 * `evidence_available`: only the persisted `available` receipt makes a photo
 * recorded, and this is the ONLY place that judgement is made.
 */
export function isSaved(s: ClientState): boolean {
  return s === "server_confirmed";
}

/**
 * INV-081's second half. True while the browser holds bytes the server does not,
 * which is exactly when leaving the page loses a photo. `failed` and `discarded`
 * are false because the user has already been told.
 */
export function holdsUnsavedBytes(s: ClientState): boolean {
  return s === "not_sent" || s === "sending" || s === "awaiting_receipt";
}

/**
 * The only client-initiated transition to `discarded` — "Explicit warned user
 * deletion" (state-catalog.csv:44). Guarded by `holdsUnsavedBytes` on both
 * sides of the call, not just at the UI layer: a photo can only be dropped
 * from the client's hands while the client is still the only one holding it.
 * Once `holdsUnsavedBytes` is false — the server already confirmed it, the
 * upload already failed, or it was already discarded — `state` is returned
 * unchanged, so a stale click (or a race with an in-flight upload's own
 * final callback) can never overwrite a `server_confirmed` receipt or a
 * `failed` notice with `discarded`.
 *
 * "Warned" is the caller's job (a confirmation before this is invoked, not
 * inside it) — this function only performs the transition once the caller
 * has already obtained that confirmation.
 */
export function discard(s: ClientState): ClientState {
  return holdsUnsavedBytes(s) ? "discarded" : s;
}
