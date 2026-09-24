// Deliberate duplicate of apps/app/src/lib/otp-error.ts, the office dashboard's
// login: one person signs in to both clients, so the three messages stay
// byte-identical (otp-error-twin.test.ts reads the app's file) and a logic fix
// lands in both (each side's otp-error.test.ts carries the same cases).

/**
 * THE ONE PLACE A SUPABASE AUTH FAILURE BECOMES A SENTENCE A FOREMAN READS —
 * and the reason it is a module rather than two ternaries inside `otp-form.tsx`.
 *
 * The rate-limit split shipped on ONE of the two phases. `requestCode` learned
 * to tell a 429 apart, for a stated and correct reason: GoTrue returns 429 when
 * codes are requested faster than its own window allows, and telling a
 * rate-limited foreman to «Перевірте адресу електронної пошти» makes him
 * re-enter an address that was right the first time, which requests another
 * code, which extends the limit — a loop he has no in-product support path out
 * of. `verifyCode`, the very next function in the same file, went on collapsing
 * every failure into «Невірний або прострочений код», so a foreman rate-limited
 * at the VERIFY step is told the correct code he is reading off his phone is
 * wrong. Same misdirection, same dead end, on the phase where he is holding the
 * right answer and has every reason to believe the app over himself.
 *
 * A fix applied one function above the identical defect is how that happens.
 * The rule lives here now and both phases are forced through it, so the next
 * status worth splitting out is split for both by construction.
 *
 * IT TAKES A STATUS, NEVER A MESSAGE. `signInError.message` /
 * `verifyError.message` are GoTrue's own English strings ("Signups not allowed
 * for otp", "Token has expired or is invalid"), and every piece of UI copy in
 * this product is Ukrainian. There is deliberately no parameter through which
 * one could reach a screen — the type makes rendering it a change to this
 * file's signature rather than a one-character slip at a call site.
 *
 * Node-testable with no DOM, like `apps/app`'s `safe-next.ts` and `submit-guard.ts`:
 * `apps/app`'s vitest run has no jsdom, so logic left inside a `"use client"`
 * component is reachable only by rendering it, which nothing in this package
 * does.
 */

/** The phase of the sign-in the failure came back from. */
export type OtpPhase = "send" | "verify";

/**
 * Split out because the generic sentence is actively harmful on a 429 — see
 * this file's header. Identical on both phases on purpose: the remedy is the
 * same one either way (wait), and a foreman who hits the limit twice in a row
 * should not be given two different accounts of the same condition.
 */
export const OTP_RATE_LIMITED =
  "Забагато спроб. Зачекайте близько хвилини й спробуйте ще раз.";

/**
 * COLLAPSED ON PURPOSE, and this is the half that must never be "improved".
 * Distinguishing «this address is not provisioned» from anything else would
 * turn a public form into an account-enumeration oracle: anyone could type
 * addresses and read back which ones exist on the pilot.
 * `shouldCreateUser: false` is what makes an unprovisioned address fail at all,
 * and the price of that refusal being safe is that it looks like every other
 * failure.
 */
export const OTP_SEND_FAILED =
  "Не вдалося надіслати код. Перевірте адресу електронної пошти або зверніться до адміністратора.";

/** The verify phase's own generic, collapsed for the same reason as the send phase's. */
export const OTP_VERIFY_FAILED =
  "Невірний або прострочений код. Спробуйте ще раз.";

/**
 * `status` is `number | undefined` because `AuthError.status` is optional —
 * a transport-level failure carries none, and an absent status must fall to the
 * phase's generic rather than being read as "not 429, therefore fine".
 */
export function otpErrorMessage(phase: OtpPhase, status: number | undefined): string {
  if (status === 429) return OTP_RATE_LIMITED;
  return phase === "send" ? OTP_SEND_FAILED : OTP_VERIFY_FAILED;
}
