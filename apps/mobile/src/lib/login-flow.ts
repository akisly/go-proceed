/**
 * THE SIGN-IN FLOW FROM `apps/app/app/(auth)/login/otp-form.tsx`, PULLED OUT
 * OF JSX SO IT CAN BE PROVEN WITHOUT A RENDERER.
 *
 * `otp-form.tsx` is a `"use client"` React component: `requestCode` and
 * `verifyCode` are closures over `useState` calls, so on the web side the
 * only way to exercise the 429 split, the generic-failure collapse, or the
 * re-entrancy guard is to actually render the component (which `apps/app`'s
 * Node-only `vitest` run cannot do — see `otp-error.ts`'s own header for the
 * same constraint). This module is
 * that same decision, made into a plain class with no React and no DOM in
 * its module graph, so `login-flow.test.ts` can drive every branch — success,
 * a 429 on either phase, a generic failure on either phase, a re-entrant
 * double-submit, and the "change address" reset — directly, the same way
 * `field/assignments.ts` pulled `buildMyAssignmentsScreen` out of `page.tsx`.
 *
 * `src/screens/login.tsx` is the "dumb" half: it owns the two `TextInput`
 * values (`email`, `code` — CONTROLLED INPUTS, not tracked here, because a
 * keystroke is not a state TRANSITION) and renders whatever `LoginFlow`
 * reports back through its `onChange` callback.
 *
 * WHAT IS "PORTED" HERE AND WHAT IS NEW. `otpErrorMessage` (imported, not
 * reimplemented — see `otp-error.ts`'s own PORT header) and the shape of the
 * re-entrancy guard (`submit-guard.ts`'s `SubmitGuard`, inlined below as a
 * single private field rather than a separate class, since there is no
 * `useRef` identity problem to solve outside a component) are carried over
 * unchanged. The phase/state shape itself is new: `otp-form.tsx` has no
 * single state object to port, only four independent `useState` calls.
 */

import { otpErrorMessage } from "./otp-error";

/** Mirrors `otp-form.tsx`'s two-phase `Phase` type. */
export type LoginPhase = "email" | "code";

/**
 * The minimal shape a caller's `signInWithOtp`/`verifyOtp` result must have —
 * just enough for `otpErrorMessage` to read `.status`, and no more. Supabase's
 * real `AuthOtpResponse`/`AuthTokenResponse` carry a `data` field too; a
 * caller passing the real SDK methods through a thin wrapper satisfies this
 * structurally without this module importing `@supabase/supabase-js` at all.
 */
export type OtpCallResult = { error: { status?: number } | null };

/**
 * Takes the bare email address. The Supabase-specific call shape —
 * `{ email, options: { shouldCreateUser: false } }` — is assembled at the one
 * real call site, `src/screens/login.tsx`, not here: this module knows
 * nothing about Supabase, only about "send a code to this address, and tell
 * me whether it worked."
 */
export type SignInWithOtpFn = (email: string) => Promise<OtpCallResult>;

/**
 * Takes the address a code was actually sent to (this module's own `sentTo`,
 * not a value the caller has to remember) plus the code the user typed. The
 * `{ email, token, type: "email" }` shape lives at the call site, same
 * reasoning as `SignInWithOtpFn`.
 */
export type VerifyOtpFn = (email: string, code: string) => Promise<OtpCallResult>;

export type LoginFlowDeps = {
  signInWithOtp: SignInWithOtpFn;
  verifyOtp: VerifyOtpFn;
  /**
   * Called once, after `verifyOtp` resolves with no error — never called on
   * a failure, and never called more than once per successful verify. Owns
   * the `router.replace(nativeNext(...))` navigation (`src/screens/login.tsx`); this module has no
   * `router` and no `window`, on purpose, for the same Node-testability
   * reason as everything else in this file.
   */
  onSignedIn: () => void;
};

export type LoginFlowState = {
  phase: LoginPhase;
  /**
   * The address a code was actually sent to — set on a successful
   * `submitEmail`, read back for the "Код надіслано на …" line AND handed to
   * `verifyOtp` as its `email` (the screen's live `email` input is not
   * consulted for that call: by the time `submitCode` runs, the user may
   * have already started editing a NEW address for next time, and the
   * code they are verifying belongs to `sentTo`, not to whatever the input
   * currently shows). `null` before any send has ever succeeded, and reset
   * to `null` by `changeEmail`.
   */
  sentTo: string | null;
  /** True for the duration of exactly one in-flight `signInWithOtp`/`verifyOtp` call. */
  pending: boolean;
  /**
   * The one Ukrainian sentence `otpErrorMessage` returned for the last
   * failure, or `null` when there is nothing to show. Cleared at the START
   * of every new submit (mirrors `otp-form.tsx`'s `setError(null)` ahead of
   * each request) and by `changeEmail`.
   */
  message: string | null;
};

/** `otp-form.tsx` mounts with an empty email form and no message — the same starting point here. */
export function initialLoginFlowState(): LoginFlowState {
  return { phase: "email", sentTo: null, pending: false, message: null };
}

/**
 * One instance per screen mount (`src/screens/login.tsx` creates it lazily
 * via a `useRef`, the same `guardRef.current ??= new …` pattern
 * `otp-form.tsx` uses for its `SubmitGuard` — see that file's comment for why
 * `??=` and not `useRef(new LoginFlow(...))`, which would construct and
 * immediately discard a fresh instance on every render).
 */
export class LoginFlow {
  #deps: LoginFlowDeps;
  #state: LoginFlowState = initialLoginFlowState();
  #onChange: (state: LoginFlowState) => void;

  /**
   * THE SUBMIT-GUARD IDEA FROM `submit-guard.ts`, INLINED. One boolean,
   * mutated SYNCHRONOUSLY before either `submitEmail` or `submitCode` ever
   * reaches an `await`, shared across both — exactly `submit-guard.ts`'s
   * reasoning for why `otp-form.tsx` shares one `SubmitGuard` between
   * `requestCode` and `verifyCode`: only one phase's form is ever mounted at
   * a time, so only one of these two methods can ever legitimately be
   * in-flight. A separate class was not worth it here: there is no `useRef`
   * identity to preserve outside a component, so a private field on the one
   * `LoginFlow` instance already IS the guard's whole lifetime.
   */
  #inFlight = false;

  constructor(deps: LoginFlowDeps, onChange: (state: LoginFlowState) => void = () => {}) {
    this.#deps = deps;
    this.#onChange = onChange;
  }

  getState(): LoginFlowState {
    return this.#state;
  }

  #set(patch: Partial<LoginFlowState>): void {
    this.#state = { ...this.#state, ...patch };
    this.#onChange(this.#state);
  }

  /**
   * `otp-form.tsx`'s `requestCode`. The guard check is the FIRST line, ahead
   * of any state change: a second synchronous call before the first has
   * reached its `await` sees `#inFlight === true` and returns without
   * touching `signInWithOtp`, `pending`, or `message` — see
   * `submit-guard.ts`'s header for the reproduced defect this closes.
   */
  async submitEmail(email: string): Promise<void> {
    if (this.#inFlight) return;
    this.#inFlight = true;
    try {
      this.#set({ pending: true, message: null });
      const { error } = await this.#deps.signInWithOtp(email);
      if (error) {
        this.#set({ pending: false, message: otpErrorMessage("send", error.status) });
        return;
      }
      this.#set({ pending: false, phase: "code", sentTo: email, message: null });
    } finally {
      // Runs on the handled-error `return`, the success fallthrough, AND an
      // unexpected throw neither branch catches — see `submit-guard.ts`'s
      // `finish()` comment for why anything short of `finally` risks wedging
      // this flow permanently unable to submit again.
      this.#inFlight = false;
    }
  }

  /**
   * `otp-form.tsx`'s `verifyCode`. Verifies against `sentTo`, not against
   * whatever the screen's email input currently holds — see `sentTo`'s own
   * comment on `LoginFlowState`.
   */
  async submitCode(code: string): Promise<void> {
    if (this.#inFlight) return;
    this.#inFlight = true;
    try {
      this.#set({ pending: true, message: null });
      const { error } = await this.#deps.verifyOtp(this.#state.sentTo ?? "", code);
      if (error) {
        this.#set({ pending: false, message: otpErrorMessage("verify", error.status) });
        return;
      }
      this.#set({ pending: false });
      this.#deps.onSignedIn();
    } finally {
      this.#inFlight = false;
    }
  }

  /**
   * "Змінити адресу пошти". `otp-form.tsx`'s ghost-button handler resets
   * `phase`, `code` and `error` but leaves `email` untouched, so the address
   * just typed is still there to edit rather than retype — this module owns
   * `phase` and `message`; the screen owns `code` (clearing it is the
   * screen's job, alongside calling this) and `email` was never this
   * module's to begin with (see `SignInWithOtpFn`'s comment). `sentTo` is
   * cleared too: once back on the email phase there is no code in flight for
   * it to belong to, and a fresh `submitEmail` sets it again on success.
   */
  changeEmail(): void {
    this.#set({ phase: "email", sentTo: null, message: null });
  }
}
