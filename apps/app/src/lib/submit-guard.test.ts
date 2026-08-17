import { describe, it, expect } from "vitest";
import { SubmitGuard } from "./submit-guard";

/**
 * `SubmitGuard` is the extracted, pure decision `submit-guard.ts`'s own
 * header says must not stay untested — the exact same rationale as
 * `capture/attempt.test.ts` for `AttemptGuard`: the defect this closes
 * (two near-simultaneous invocations both reading a stale "not busy") only
 * shows up when something exercises the overlapping-call case directly,
 * in isolation from React, a browser, and a real network. This suite
 * proves the one thing the header claims and nothing more:
 * a second `start()` while the first is still open performs no work
 * (returns `false`, changes nothing), and the guard reliably re-arms after
 * `finish()` so a genuinely NEW submission is never mistaken for a
 * leftover one.
 */

describe("SubmitGuard — a second concurrent start is refused", () => {
  it("the first start succeeds", () => {
    const g = new SubmitGuard();
    expect(g.start()).toBe(true);
  });

  it("a second start while the first is still in flight is refused — the exact race otp-form.tsx hit", () => {
    const g = new SubmitGuard();
    expect(g.start()).toBe(true);
    // This is `requestCode`/`verifyCode` dispatched twice before either's
    // `await` has resolved: the second call must see it is not the one
    // allowed to proceed.
    expect(g.start()).toBe(false);
  });

  it("three rapid starts before any finish: only the first succeeds", () => {
    const g = new SubmitGuard();
    expect(g.start()).toBe(true);
    expect(g.start()).toBe(false);
    expect(g.start()).toBe(false);
  });
});

describe("SubmitGuard — finish() re-arms the guard for the NEXT submission", () => {
  it("after finish(), a new start is allowed again — the form is not wedged permanently", () => {
    const g = new SubmitGuard();
    g.start();
    g.finish();
    expect(g.start()).toBe(true);
  });

  it("finish() without a prior start does not throw, and does not wedge the next start", () => {
    const g = new SubmitGuard();
    expect(() => g.finish()).not.toThrow();
    expect(g.start()).toBe(true);
  });

  it("start -> finish -> start -> (second start refused): the guard re-arms per attempt, not permanently open", () => {
    const g = new SubmitGuard();
    g.start();
    g.finish();
    expect(g.start()).toBe(true);
    expect(g.start()).toBe(false);
  });

  it("calling finish() twice in a row is harmless — a THIRD start still only opens one slot", () => {
    const g = new SubmitGuard();
    g.start();
    g.finish();
    g.finish(); // e.g. both a `finally` and a defensive call elsewhere
    expect(g.start()).toBe(true);
    expect(g.start()).toBe(false);
  });
});
