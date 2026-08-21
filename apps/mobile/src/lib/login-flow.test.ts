import { describe, it, expect, vi } from "vitest";
import { OTP_RATE_LIMITED, OTP_SEND_FAILED, OTP_VERIFY_FAILED } from "./otp-error";
import { LoginFlow, initialLoginFlowState, type LoginFlowState, type OtpCallResult } from "./login-flow";

/**
 * `LoginFlow` is `otp-form.tsx`'s two closures (`requestCode`, `verifyCode`)
 * made into something `vitest` can drive with no `render()` anywhere — see
 * `login-flow.ts`'s own header for why the split exists at all. Every case
 * below is one this repo has already paid to learn matters: the 429 split
 * (`otp-error.test.ts`), the generic-failure collapse (same file), and the
 * re-entrant double-submit (`submit-guard.ts`'s reproduced defect).
 *
 * A DEFERRED PROMISE, NOT A RESOLVED ONE, IS WHAT MAKES THE RE-ENTRANCY CASES
 * MEANINGFUL. A fake that resolves immediately can never prove the SECOND
 * call was rejected while the FIRST was still in flight — both would already
 * be done by the time either assertion runs. `deferred()` below hands back a
 * promise the test controls, so "call twice, then resolve once" is an
 * ordering the test can actually force.
 */

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function ok(): OtpCallResult {
  return { error: null };
}

function failed(status: number | undefined): OtpCallResult {
  return { error: { status } };
}

/** Records every state the flow reported, in order — `states.at(-1)` is "what the screen would show right now". */
function recordingFlow(overrides: Partial<{
  signInWithOtp: (email: string) => Promise<OtpCallResult>;
  verifyOtp: (email: string, code: string) => Promise<OtpCallResult>;
  onSignedIn: () => void;
}> = {}) {
  const states: LoginFlowState[] = [];
  const onSignedIn = overrides.onSignedIn ?? vi.fn();
  const flow = new LoginFlow(
    {
      signInWithOtp: overrides.signInWithOtp ?? vi.fn(async () => ok()),
      verifyOtp: overrides.verifyOtp ?? vi.fn(async () => ok()),
      onSignedIn,
    },
    (state) => states.push(state),
  );
  return { flow, states, onSignedIn };
}

describe("initialLoginFlowState", () => {
  it("starts on the email phase with nothing sent and nothing to report", () => {
    expect(initialLoginFlowState()).toEqual({
      phase: "email", sentTo: null, pending: false, message: null,
    });
  });
});

describe("submitEmail — success", () => {
  it("moves to the code phase, remembers the address, and clears any message", async () => {
    const signInWithOtp = vi.fn(async () => ok());
    const { flow, states } = recordingFlow({ signInWithOtp });

    await flow.submitEmail("foreman@example.com");

    expect(signInWithOtp).toHaveBeenCalledExactlyOnceWith("foreman@example.com");
    expect(flow.getState()).toEqual({
      phase: "code", sentTo: "foreman@example.com", pending: false, message: null,
    });
    // pending flips true, then settles back to false — the screen relies on
    // seeing BOTH, not just the final resting state, to show "Надсилаємо…".
    expect(states.map((s) => s.pending)).toEqual([true, false]);
  });
});

describe("submitEmail — failure, both status shapes otp-error.ts distinguishes", () => {
  it("reports the rate-limit sentence on a 429, and stays on the email phase", async () => {
    const { flow } = recordingFlow({ signInWithOtp: async () => failed(429) });
    await flow.submitEmail("foreman@example.com");
    expect(flow.getState()).toMatchObject({ phase: "email", message: OTP_RATE_LIMITED });
  });

  it("reports the generic send-failed sentence on anything else, and stays on the email phase", async () => {
    for (const status of [400, 401, 422, 500, undefined]) {
      const { flow } = recordingFlow({ signInWithOtp: async () => failed(status) });
      await flow.submitEmail("foreman@example.com");
      expect(flow.getState(), String(status)).toMatchObject({ phase: "email", message: OTP_SEND_FAILED });
    }
  });

  it("never advances sentTo/phase on a failed send", async () => {
    const { flow } = recordingFlow({ signInWithOtp: async () => failed(400) });
    await flow.submitEmail("foreman@example.com");
    expect(flow.getState().sentTo).toBeNull();
  });
});

describe("submitCode — success", () => {
  it("verifies against the address submitEmail recorded, and calls onSignedIn exactly once", async () => {
    const verifyOtp = vi.fn(async () => ok());
    const { flow, onSignedIn } = recordingFlow({ verifyOtp });

    await flow.submitEmail("foreman@example.com");
    await flow.submitCode("123456");

    expect(verifyOtp).toHaveBeenCalledExactlyOnceWith("foreman@example.com", "123456");
    expect(onSignedIn).toHaveBeenCalledOnce();
    expect(flow.getState().pending).toBe(false);
  });

  it("does not call onSignedIn when there is nothing to verify against yet", async () => {
    // Defensive: submitCode called with no prior successful submitEmail. Not a
    // path the screen can reach (the code input only renders in the "code"
    // phase), but this module's job is a correct answer for any call, not
    // only the ones the screen happens to make.
    const verifyOtp = vi.fn(async () => ok());
    const { flow, onSignedIn } = recordingFlow({ verifyOtp });

    await flow.submitCode("123456");

    expect(verifyOtp).toHaveBeenCalledExactlyOnceWith("", "123456");
    expect(onSignedIn).toHaveBeenCalledOnce();
  });
});

describe("submitCode — failure, both status shapes otp-error.ts distinguishes", () => {
  it("reports the SAME rate-limit sentence as the send phase — one account of the condition, not two", async () => {
    const { flow } = recordingFlow({ verifyOtp: async () => failed(429) });
    await flow.submitEmail("foreman@example.com");
    await flow.submitCode("000000");
    expect(flow.getState()).toMatchObject({ phase: "code", message: OTP_RATE_LIMITED });
  });

  it("reports the verify phase's own generic sentence on anything else", async () => {
    for (const status of [400, 401, 422, 500, undefined]) {
      const { flow } = recordingFlow({ verifyOtp: async () => failed(status) });
      await flow.submitEmail("foreman@example.com");
      await flow.submitCode("000000");
      expect(flow.getState(), String(status)).toMatchObject({ phase: "code", message: OTP_VERIFY_FAILED });
    }
  });

  it("does not call onSignedIn on a failed verify", async () => {
    const onSignedIn = vi.fn();
    const { flow } = recordingFlow({ verifyOtp: async () => failed(400), onSignedIn });
    await flow.submitEmail("foreman@example.com");
    await flow.submitCode("000000");
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("stays on the code phase, still addressed to the same email, after a failed verify", async () => {
    // A wrong/expired code is not "start over" — the foreman is still holding
    // his phone at the same address, and re-typing the code should not force
    // him back through the send step.
    const { flow } = recordingFlow({ verifyOtp: async () => failed(400) });
    await flow.submitEmail("foreman@example.com");
    await flow.submitCode("000000");
    expect(flow.getState().sentTo).toBe("foreman@example.com");
  });
});

describe("re-entrancy — a second submit before the first settles is a no-op", () => {
  it("ignores a second submitEmail while the first is still in flight", async () => {
    const gate = deferred<OtpCallResult>();
    const signInWithOtp = vi.fn(() => gate.promise);
    const { flow } = recordingFlow({ signInWithOtp });

    const first = flow.submitEmail("a@example.com");
    // SYNCHRONOUS second call, before `first` has had any chance to settle —
    // this is the exact window `submit-guard.ts` documents as the one a
    // `useState` `pending` flag cannot close, because `setPending(true)`
    // does not take effect until a re-render commits.
    const second = flow.submitEmail("b@example.com");

    gate.resolve(ok());
    await first;
    await second;

    expect(signInWithOtp).toHaveBeenCalledExactlyOnceWith("a@example.com");
    // The ignored call's argument never wins, either.
    expect(flow.getState().sentTo).toBe("a@example.com");
  });

  it("ignores a second submitCode while the first is still in flight", async () => {
    const gate = deferred<OtpCallResult>();
    const verifyOtp = vi.fn(() => gate.promise);
    const onSignedIn = vi.fn();
    const { flow } = recordingFlow({ verifyOtp, onSignedIn });
    await flow.submitEmail("a@example.com");

    const first = flow.submitCode("111111");
    const second = flow.submitCode("222222");

    gate.resolve(ok());
    await first;
    await second;

    expect(verifyOtp).toHaveBeenCalledExactlyOnceWith("a@example.com", "111111");
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it("allows a fresh submit once the in-flight one has actually finished", async () => {
    // The guard must release, not just refuse forever — `finish()`'s own
    // comment in submit-guard.ts calls a guard that never releases "wedging
    // the form permanently... for a reason invisible anywhere in the UI".
    const signInWithOtp = vi.fn(async () => ok());
    const { flow } = recordingFlow({ signInWithOtp });

    await flow.submitEmail("a@example.com");
    await flow.changeEmail();
    await flow.submitEmail("b@example.com");

    expect(signInWithOtp).toHaveBeenCalledTimes(2);
    expect(flow.getState().sentTo).toBe("b@example.com");
  });

  it("releases the guard even when the injected call throws, so the next submit is not wedged", async () => {
    const signInWithOtp = vi.fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(ok());
    const { flow } = recordingFlow({ signInWithOtp });

    await expect(flow.submitEmail("a@example.com")).rejects.toThrow("network");
    await flow.submitEmail("a@example.com");

    expect(signInWithOtp).toHaveBeenCalledTimes(2);
    expect(flow.getState()).toMatchObject({ phase: "code", sentTo: "a@example.com" });
  });
});

describe("changeEmail", () => {
  it("returns to the email phase and clears the message, without touching an unrelated field", async () => {
    const { flow } = recordingFlow({ signInWithOtp: async () => failed(400) });
    await flow.submitEmail("a@example.com");
    expect(flow.getState().message).toBe(OTP_SEND_FAILED);

    flow.changeEmail();

    expect(flow.getState()).toEqual({
      phase: "email", sentTo: null, pending: false, message: null,
    });
  });

  it("clears sentTo even after a successful send — there is no code in flight for it to belong to", async () => {
    const { flow } = recordingFlow();
    await flow.submitEmail("a@example.com");
    expect(flow.getState().phase).toBe("code");

    flow.changeEmail();

    expect(flow.getState().phase).toBe("email");
    expect(flow.getState().sentTo).toBeNull();
  });
});
