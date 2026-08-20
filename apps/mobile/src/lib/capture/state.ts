// PORT of apps/app/src/lib/capture/state.ts — byte-identical logic and copy. Transitional duplication under ADR-009: the PWA original retires when the Expo client passes the parity gate; until then fix bugs in BOTH files.

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
 * ONE FACT ABOUT THE STATE ALONE: the server has not recorded this photo.
 *
 * True for `not_sent`, `sending` and `awaiting_receipt`; false for
 * `server_confirmed` (the receipt landed), `failed` and `discarded` (the user
 * has already been told). It says NOTHING about whether a photo exists — at
 * first paint, before any file has been picked, `not_sent` is the initial
 * state and this is already `true` about a photo that does not exist.
 *
 * THAT DISTINCTION IS THE WHOLE POINT OF SPLITTING THIS OUT, and it is a
 * correction. Until the final whole-branch review, `holdsUnsavedBytes` WAS
 * this function, and the banner, the discard control and the `beforeunload`
 * listener all keyed off it — so a foreman who merely opened an obligation
 * screen was shown «GoProceed не зберіг це фото…» about no photo, offered
 * «Скасувати фото» for no photo, and got the browser's "leave site?" dialog on
 * closing a tab he had done nothing in. That last one is the expensive
 * failure: `capture.tsx`'s own comment says a listener that stays registered
 * "would make every ordinary navigation show the same browser dialog, training
 * people to click through the one prompt that actually protects something",
 * and the code did exactly that on every visit. INV-081's second half rests on
 * that prompt still meaning something.
 *
 * Nothing user-visible may be gated on this function by itself. Use
 * `holdsUnsavedBytes` (below), which is this AND "a file has actually been
 * picked".
 */
export function serverHasNotRecordedIt(s: ClientState): boolean {
  return s === "not_sent" || s === "sending" || s === "awaiting_receipt";
}

/**
 * THE TWO FACTS THAT TOGETHER MEAN "leaving this page loses a photo", carried
 * as one value so no call site can key off half of them.
 *
 * `hasPickedFile` is the fact the client state cannot express. The browser
 * holds no `File` in React state at all — the bytes live only inside the
 * in-flight upload's closure — so "are there bytes" is not derivable from
 * `ClientState`, which is why it travels beside it rather than being inferred
 * from it. It becomes true when a file is handed to the capture island and
 * false again when the photo is discarded (there is nothing left to lose).
 * It deliberately stays true after a `failed` or `server_confirmed` outcome:
 * those states already answer the question through
 * `serverHasNotRecordedIt`, and clearing the flag there would make a retake
 * of the same obligation look, for one render, like a screen nobody had
 * touched.
 */
export type CaptureHold = {
  state: ClientState;
  hasPickedFile: boolean;
};

/**
 * INV-081's second half. True while the browser holds bytes the server does
 * not — which is exactly when leaving the page loses a photo, and is now
 * exactly what the name says, because it can no longer be true before a photo
 * exists. This is the ONE decision the banner, the discard control and the
 * `beforeunload` listener are all gated on, so those three can never disagree
 * about whether a photo is at risk.
 */
export function holdsUnsavedBytes(hold: CaptureHold): boolean {
  return hold.hasPickedFile && serverHasNotRecordedIt(hold.state);
}

/**
 * INV-081's ENFORCEMENT COLUMN, WHICH `holdsUnsavedBytes` DOES NOT SATISFY —
 * the banner's own gate, and the one place these two questions are allowed to
 * differ.
 *
 * `invariant-catalog.csv:82` requires that «every failed or abandoned in-flight
 * upload raises an explicit unsaved-photo warning». `holdsUnsavedBytes`
 * excludes `failed`, so for as long as the banner was gated on it, the row
 * claimed more than the code did on the very outcome it names first: a failed
 * upload took the banner DOWN and left `uploadCapture`'s
 * `problem?.detail || GENERIC_FAILURE` in its place. `GENERIC_FAILURE` says the
 * photo was not saved — which is why nobody noticed — but a server-supplied
 * `detail` (a storage quota, a media-policy refusal) says only why the request
 * was rejected, and on that path the screen stated nowhere that the photo was
 * lost. The foreman read a technical reason and walked away from a photo
 * GoProceed does not have.
 *
 * THE FIX IS A SECOND PREDICATE, NOT A WIDER FIRST ONE, and the distinction is
 * the whole reason this function exists:
 *
 *   - `holdsUnsavedBytes` — the BROWSER still holds bytes the server does not.
 *     True through `not_sent`/`sending`/`awaiting_receipt`, false at `failed`,
 *     because by then `uploadCapture` has returned and the bytes have left its
 *     closure. It gates the `beforeunload` dialog and the discard control,
 *     both of which are about bytes this tab can still act on. Widening it to
 *     cover `failed` would put the browser's "leave site?" prompt on a photo
 *     the tab can no longer save — the exact "training people to click through
 *     the one prompt that actually protects something" `capture.tsx` warns
 *     against, and the defect the `hasPickedFile` term was added to end.
 *
 *   - this — GOPROCEED does not have the photo, and the foreman did not choose
 *     that. True for the same three states AND for `failed`. It gates the
 *     banner, whose sentence is about the server's records, not about this
 *     tab's memory: «GoProceed не зберіг це фото. Зробіть його ще раз або
 *     збережіть у себе» is exactly as true after a failure as during one, and
 *     more urgent.
 *
 * `discarded` is excluded deliberately: the user was already told, in the
 * confirmation dialog he had to accept, that the photo would not be saved.
 * Warning him again would be the app arguing with a choice it just made him
 * make. `server_confirmed` is excluded because the receipt landed.
 *
 * `state.test.ts` pins that these two functions disagree on `failed` and on
 * nothing else, so the split cannot quietly grow into a second, divergent
 * opinion about when a photo is at risk.
 */
export function serverDoesNotHaveThePhoto(hold: CaptureHold): boolean {
  return hold.hasPickedFile && !isSaved(hold.state) && hold.state !== "discarded";
}

/**
 * The only client-initiated transition to `discarded` — "Explicit warned user
 * deletion" (state-catalog.csv:44). Guarded by `serverHasNotRecordedIt` on
 * both sides of the call, not just at the UI layer: a photo can only be
 * dropped from the client's hands while the client is still the only one
 * holding it. Once that is false — the server already confirmed it, the upload
 * already failed, or it was already discarded — `state` is returned unchanged,
 * so a stale click (or a race with an in-flight upload's own final callback)
 * can never overwrite a `server_confirmed` receipt or a `failed` notice with
 * `discarded`.
 *
 * STATE-LEVEL, NOT HOLD-LEVEL, ON PURPOSE. This is the rule about which states
 * may be overwritten, and it must stay independent of `hasPickedFile`: whether
 * the UI OFFERS the control is `holdsUnsavedBytes`'s job (`capture.tsx`), and
 * making this function also consult the flag would mean a single missed
 * assignment could both hide the control and quietly disarm the guard that
 * protects a receipt.
 *
 * "Warned" is the caller's job (a confirmation before this is invoked, not
 * inside it) — this function only performs the transition once the caller
 * has already obtained that confirmation.
 */
export function discard(s: ClientState): ClientState {
  return serverHasNotRecordedIt(s) ? "discarded" : s;
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
 *
 * TAKES THE WHOLE `CaptureHold`, NOT A BARE `ClientState`. That is the fix for
 * the defect described on `serverHasNotRecordedIt`: with a bare state, this
 * guard blocked unload on the initial `not_sent` — every foreman who opened an
 * obligation screen and closed the tab got the browser's dialog about a photo
 * that never existed. The signature is what makes that unrepresentable now; a
 * caller cannot arm this guard without also stating that a file was picked.
 */
export function guardBeforeUnload(hold: CaptureHold, event: UnloadEventLike): void {
  if (!holdsUnsavedBytes(hold)) return;
  event.preventDefault();
  event.returnValue = "true";
}
