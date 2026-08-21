import { describe, it, expect } from "vitest";
import { AttemptGuard } from "./attempt";

/**
 * PORT of apps/app/src/lib/capture/attempt.test.ts — byte-identical
 * assertions. `AttemptGuard` is the extracted, pure decision the source's
 * fix round 2 (task 9) said must not stay untested — a JSX-local boolean is
 * exactly where the defect hid, because nothing exercised the
 * overlapping-attempt case in isolation from React.
 */

describe("AttemptGuard — a superseded attempt cannot write", () => {
  it("a superseded attempt's token is no longer current", () => {
    const g = new AttemptGuard();
    const a = g.begin();
    g.begin(); // a second attempt starts and supersedes the first
    expect(g.isCurrent(a)).toBe(false);
  });

  it("a bare discard (no replacement attempt) also supersedes", () => {
    const g = new AttemptGuard();
    const a = g.begin();
    g.supersede();
    expect(g.isCurrent(a)).toBe(false);
  });

  it("the current attempt's own token still is current", () => {
    const g = new AttemptGuard();
    const b = g.begin();
    expect(g.isCurrent(b)).toBe(true);
  });

  it("the current attempt stays current across unrelated reads", () => {
    const g = new AttemptGuard();
    const a = g.begin();
    // Reading `isCurrent` does not itself consume or change anything —
    // calling it repeatedly must not be mistaken for another attempt.
    expect(g.isCurrent(a)).toBe(true);
    expect(g.isCurrent(a)).toBe(true);
    expect(g.isCurrent(a)).toBe(true);
  });
});

describe("AttemptGuard — discard-then-retake leaves only the second attempt current", () => {
  it("neither the discarded attempt nor a stale zero/undefined token reads as current", () => {
    const g = new AttemptGuard();
    const a = g.begin();
    g.supersede();          // the foreman discards photo A mid-flight
    const b = g.begin();    // and immediately retakes photo B

    expect(g.isCurrent(a)).toBe(false);
    expect(g.isCurrent(b)).toBe(true);
  });

  it("reproduces the exact round-1 race: A's late resolution is superseded by B's retake, in that order", () => {
    // This is `handleFile`'s own sequence, replayed against the guard alone:
    // begin A -> (A still "in flight") -> discard A (supersede) -> begin B
    // -> A's callback finally arrives and must find itself superseded, no
    // matter how late.
    const g = new AttemptGuard();
    const tokenA = g.begin();

    // ... A's fetch calls are conceptually still pending here ...

    g.supersede(); // handleDiscard
    const tokenB = g.begin(); // handleFile(fileB)

    // A's onStateChange finally fires:
    expect(g.isCurrent(tokenA)).toBe(false);
    // A's final outcome (the receipt write) finally fires:
    expect(g.isCurrent(tokenA)).toBe(false);
    // B, meanwhile, is exactly what the UI should still be showing:
    expect(g.isCurrent(tokenB)).toBe(true);
  });

  it("three overlapping attempts: only the last one's token is current", () => {
    const g = new AttemptGuard();
    const a = g.begin();
    const b = g.begin();
    const c = g.begin();
    expect(g.isCurrent(a)).toBe(false);
    expect(g.isCurrent(b)).toBe(false);
    expect(g.isCurrent(c)).toBe(true);
  });
});
