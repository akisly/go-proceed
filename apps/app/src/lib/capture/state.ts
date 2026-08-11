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

/**
 * copy-catalog.csv:281, `warning.capture.not_saved`, verbatim. NOT
 * retranslated, NOT reworded to fit a shorter banner — task 3 already did the
 * wording work and warned specifically against this photo's outcome: retake
 * it, or keep it yourself, because GoProceed has not. Every screen that warns
 * about an at-risk photo (the in-page banner in capture.tsx, and nothing
 * else — there is exactly one such screen in v0.1) imports this constant
 * rather than writing its own sentence, so there is only ever one copy of it
 * to get wrong.
 */
export const UNSAVED_PHOTO_WARNING =
  "GoProceed не зберіг це фото. Зробіть його ще раз або збережіть у себе.";

/**
 * THE MINIMAL SHAPE `beforeunload` NEEDS, NOT THE REAL `BeforeUnloadEvent`.
 * A real `BeforeUnloadEvent` only exists inside a browser (no `window` in
 * this package's Node-based `vitest` run — see the header comment on
 * `vitest.config.ts` and the absence of any jsdom dependency in
 * `package.json`), and pulling in a DOM test environment just to construct
 * one would be exactly the kind of "logic only exercised inside a browser"
 * that hid the `AttemptGuard` defect in task 9. A plain object literal
 * implementing this interface is enough to drive every branch below from
 * plain Node.
 */
export type UnloadEventLike = {
  preventDefault(): void;
  returnValue: string;
};

/**
 * INV-081's second half, made real for `beforeunload` specifically —
 * task 10's whole job, and per context item 5 the one piece of it that must
 * not be JSX-local. `holdsUnsavedBytes` is not reimplemented here (a second,
 * hand-copied condition is exactly how the banner and this guard could one
 * day disagree about whether bytes are at risk); it is called, so the two
 * are structurally the same decision rather than two decisions that happen,
 * for now, to agree.
 *
 * The two real constraints of the `beforeunload` contract (context item 4)
 * both live here, together, so nothing that calls this can get one right and
 * the other wrong: `preventDefault()` is what every modern engine acts on,
 * and `returnValue` is what the handful of older engines that ignore
 * `preventDefault()` on this particular event still read instead. Neither
 * browser shows the string assigned to `returnValue` — that decision is the
 * browser's own fixed dialog, not this app's — so its exact value carries no
 * meaning beyond "not empty".
 *
 * Deliberately does nothing (leaves the event untouched) when
 * `holdsUnsavedBytes` is false, rather than assuming the caller only invokes
 * this while it is true. The component (`capture.tsx`) also uses
 * `holdsUnsavedBytes` to decide whether to register the listener at all —
 * this repeats the check anyway, so a caller that got the registration gate
 * wrong still cannot make an already-safe unload block.
 */
export function guardBeforeUnload(s: ClientState, event: UnloadEventLike): void {
  if (!holdsUnsavedBytes(s)) return;
  event.preventDefault();
  event.returnValue = "true";
}
