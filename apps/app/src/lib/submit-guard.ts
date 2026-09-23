/**
 * A SYNCHRONOUS re-entrancy guard for an async submit handler that must
 * never run twice concurrently — e.g. `app/(auth)/login/otp-form.tsx`'s
 * `requestCode`/`verifyCode`.
 *
 * THE DEFECT THIS CLOSES, THE SAME SHAPE `capture/attempt.ts`'s [deleted 2026-09-23, DEV-035]
 * `AttemptGuard` already closed for the capture island: `otp-form.tsx`
 * used to guard re-entry with `pending`, a `useState` boolean. React state
 * does not apply synchronously — `setPending(true)` schedules a re-render;
 * it does not exist, as a value a SECOND, immediately-following invocation
 * of the same handler can read, until that re-render commits. Two
 * dispatches close enough together both read the same stale
 * `pending === false` and both proceed.
 *
 * This was not a theoretical race. `apps/app/qa/field.mjs`'s sign-in audit
 * (which drives this exact form through a real browser) reproduced it
 * directly: instrumenting the page showed two browser-trusted click/submit
 * cycles landing on the OTP-code submit button roughly 140ms apart — close
 * enough that the FIRST `verifyOtp` call had not returned, and therefore
 * `pending` had not yet re-rendered to `true`, before the SECOND one
 * fired. For `verifyCode` specifically this is not merely wasted work: a
 * one-time code is single-use, so the SECOND call consumes/invalidates
 * what the FIRST had already spent, GoTrue answers the second with an
 * error, and the form takes its error branch — `router.replace` never
 * runs. A foreman who typed a correct code would see "Невірний або
 * прострочений код. Спробуйте ще раз." — sign-in is the front door; this
 * is not a cosmetic bug.
 *
 * WHAT ACTUALLY TRIGGERS THE SECOND SUBMIT IS NOT FULLY ESTABLISHED, AND
 * THIS COMMENT SAYS SO RATHER THAN GUESS. What was ruled out, with
 * evidence: not a JS/React-synthesized duplicate dispatch (both observed
 * click events carried `isTrusted: true`; a script-dispatched event reads
 * `isTrusted: false`); not the harness issuing `page.click()` twice (its
 * source has exactly one call per submit, confirmed by reading it); not
 * Puppeteer's own `Mouse.click()` dispatching more than one down/up pair
 * (confirmed by reading puppeteer-core's `Input.js` — a single call
 * produces exactly one `mousePressed`/`mouseReleased` pair). What was NOT
 * ruled out and remains the best-supported open hypothesis: a Chrome
 * touch-emulation compatibility click — the harness drives this screen at
 * `{ isMobile: true, hasTouch: true }` (`field.mjs`'s sign-in audit), and
 * the ~140ms gap is in the range browsers historically use for a
 * touch-to-mouse compatibility click. This was not confirmed against
 * Chrome's own source, so it is named as the leading candidate, not as an
 * established cause.
 *
 * `SubmitGuard` fixes the SYMPTOM regardless of which of those (or some
 * other) input pathway is the actual trigger, which is the point: a guard
 * that makes the second invocation a no-op closes the window no matter
 * what produces the second dispatch, rather than chasing one hypothesised
 * cause that might not be the only one. `pending` stays exactly where it
 * was — it is still the correct mechanism for the VISIBLE disabled
 * affordance, which needs a re-render to grey out the button — it is
 * simply no longer the mechanism a second invocation is trusted to check
 * for CORRECTNESS.
 */
export class SubmitGuard {
  #inFlight = false;

  /**
   * Attempts to begin a new submission. Returns `true` and marks the guard
   * in-flight if none is already running. Returns `false` — and changes
   * nothing — if one already is; the caller's job on `false` is to return
   * immediately, before touching network or component state.
   */
  start(): boolean {
    if (this.#inFlight) return false;
    this.#inFlight = true;
    return true;
  }

  /**
   * Ends the current submission, allowing the next `start()` to succeed.
   * Callers MUST invoke this from a `finally` block wrapping the entire
   * submission, not just after the success/handled-error branches — an
   * uncaught throw that skipped `finish()` would wedge the form
   * permanently, silently refusing every future submit for the rest of
   * the component's lifetime, for a reason invisible anywhere in the UI.
   */
  finish(): void {
    this.#inFlight = false;
  }
}
