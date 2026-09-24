import { describe, it, expect } from "vitest";
import {
  OTP_RATE_LIMITED, OTP_SEND_FAILED, OTP_VERIFY_FAILED, otpErrorMessage,
} from "./otp-error";

/**
 * THE DEFECT THIS FILE EXISTS FOR: the rate-limit split shipped on ONE of the
 * two phases.
 *
 * `requestCode` learned to tell a 429 apart — «Забагато спроб. Зачекайте
 * близько хвилини…» — because the generic sentence was actively harmful there:
 * it told a rate-limited foreman to check an address that was correct, so he
 * re-entered it, which requested another code, which extended the limit.
 * `verifyCode`, one function below it, kept collapsing every failure into
 * «Невірний або прострочений код», so a foreman rate-limited at the VERIFY step
 * is told the correct code he just read out of his email is wrong. Same
 * misdirection, same dead end, on the phase where he is holding the right
 * answer.
 *
 * The decision lives in this module rather than inline in `otp-form.tsx` for
 * the reason `apps/app`'s `safe-next.ts` and `submit-guard.ts` do: `apps/app`'s vitest run
 * is plain Node with no jsdom, so logic left inside a `"use client"` component
 * is reachable only by rendering it, which nothing here does. One module means
 * one 429 rule that both phases are forced through, instead of two lookalike
 * ternaries that agreed once.
 */

describe("a 429 is never dressed up as the caller's fault", () => {
  it("names the rate limit on BOTH phases, with the same sentence", () => {
    expect(otpErrorMessage("send", 429)).toBe(OTP_RATE_LIMITED);
    expect(otpErrorMessage("verify", 429)).toBe(OTP_RATE_LIMITED);
  });

  it("tells a rate-limited foreman to wait, not that his input was wrong", () => {
    // The whole point, stated as an assertion rather than left to the reader
    // of the two constants: on a 429 neither phase may return the sentence
    // that sends him back to re-enter something that was already correct.
    expect(otpErrorMessage("send", 429)).not.toBe(OTP_SEND_FAILED);
    expect(otpErrorMessage("verify", 429)).not.toBe(OTP_VERIFY_FAILED);
  });
});

describe("every other failure stays collapsed, and that is deliberate", () => {
  it("gives the send phase its own generic sentence", () => {
    for (const status of [400, 401, 403, 404, 422, 500, 503, undefined]) {
      expect(otpErrorMessage("send", status), String(status)).toBe(OTP_SEND_FAILED);
    }
  });

  it("gives the verify phase its own generic sentence", () => {
    for (const status of [400, 401, 403, 404, 422, 500, 503, undefined]) {
      expect(otpErrorMessage("verify", status), String(status)).toBe(OTP_VERIFY_FAILED);
    }
  });

  it("does not distinguish an unprovisioned address from a wrong code", () => {
    // `shouldCreateUser: false` is what makes an unprovisioned address fail at
    // all, and the price of that refusal being safe is that it must look like
    // every other failure — otherwise this public form becomes an
    // account-enumeration oracle. A 400 and a 422 must be indistinguishable.
    expect(otpErrorMessage("send", 400)).toBe(otpErrorMessage("send", 422));
    expect(otpErrorMessage("verify", 400)).toBe(otpErrorMessage("verify", 422));
  });
});

describe("the copy is Ukrainian and is never Supabase's own English", () => {
  it("returns only the three approved sentences, for any status at all", () => {
    // GoTrue's `signInError.message` is an English string ("Signups not allowed
    // for otp", "Token has expired or is invalid"). Rendering it verbatim would
    // ship English on a failure path exactly when a pilot member is already
    // stuck signing in. This module takes a STATUS, not a message, so there is
    // no parameter through which that string could reach a screen.
    const approved = new Set([OTP_RATE_LIMITED, OTP_SEND_FAILED, OTP_VERIFY_FAILED]);
    for (const status of [undefined, 0, 200, 302, 400, 418, 429, 500, 999]) {
      expect(approved.has(otpErrorMessage("send", status)), `send ${status}`).toBe(true);
      expect(approved.has(otpErrorMessage("verify", status)), `verify ${status}`).toBe(true);
    }
  });

  it("carries no Latin-alphabet words in any of the three", () => {
    // A cheap structural proof that no English leaked in with a later edit —
    // "GoProceed" would be the one legitimate exception and none of these three
    // sentences names the product.
    for (const sentence of [OTP_RATE_LIMITED, OTP_SEND_FAILED, OTP_VERIFY_FAILED]) {
      expect(sentence, sentence).not.toMatch(/[A-Za-z]/);
    }
  });
});
