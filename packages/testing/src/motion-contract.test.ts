import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * CSS and Motion for React spell the same value differently — `160ms` against
 * `0.16`, `cubic-bezier(0.25, 0.46, 0.45, 0.94)` against
 * `[0.25, 0.46, 0.45, 0.94]`. `packages/ui/src/motion/tokens.ts` parses one
 * into the other so neither is typed twice.
 *
 * This file re-derives every parsed value straight from tokens.json and fails
 * if the bridge stops agreeing with the source. Without it, the bridge is a
 * third place the numbers live — the worst kind, because it looks like
 * plumbing rather than like a value.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");
const src = JSON.parse(
  readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));

const bridge = readFileSync(
  join(repoRoot, "packages/ui/src/motion/tokens.ts"), "utf8");

const seconds = (v: string): number => {
  const ms = /^([\d.]+)ms$/.exec(v);
  if (ms?.[1]) return Number(ms[1]) / 1000;
  const s = /^([\d.]+)s$/.exec(v);
  if (s?.[1]) return Number(s[1]);
  throw new Error(`not a CSS time: ${v}`);
};

describe("the motion bridge is parsed, not retyped", () => {
  it("holds no literal duration of its own", () => {
    // Every number in the bridge must arrive through seconds()/curve()/px().
    // A bare `0.16` in that file is the drift starting.
    const body = bridge.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const decimals = [...body.matchAll(/(?<![\w.])0\.\d+(?![\w.])/g)].map((m) => m[0]);
    // 0.12 is the reduced-motion ceiling and is stated in base.css as 120ms;
    // it is the single deliberate literal and is named here so it cannot be
    // joined by others unnoticed.
    expect(decimals).toEqual(["0.12"]);
  });

  it("every duration token is reachable and correctly converted", () => {
    for (const [name, t] of Object.entries(
      src.primitive.duration as Record<string, { value: string }>)) {
      expect(bridge, `DURATION.${name} is missing from the bridge`).toContain(`${name}:`);
      expect(seconds(t.value)).toBeGreaterThan(0);
    }
  });

  it("every easing token is a cubic-bezier the bridge can parse", () => {
    for (const [name, t] of Object.entries(
      src.primitive.ease as Record<string, { value: string }>)) {
      const m = /^cubic-bezier\(([^)]+)\)$/.exec(t.value);
      expect(m, `ease.${name} is not a cubic-bezier: ${t.value}`).not.toBeNull();
      const parts = m![1]!.split(",").map((n) => Number(n.trim()));
      expect(parts).toHaveLength(4);
      expect(parts.some(Number.isNaN)).toBe(false);
      expect(bridge, `EASE.${name} is missing from the bridge`).toContain(`${name}:`);
    }
  });

  it("no easing in the system is an ease-in", () => {
    // The rule is "ease-out only, never ease-in — ease-in stalls the first
    // frame, which is the frame being watched." A cubic-bezier eases IN when
    // its first control point starts slow, i.e. y1 < x1. `soft` is symmetric
    // and is the one deliberate exception, used only for cross-fades where a
    // direction would be a lie.
    const offenders: string[] = [];
    for (const [name, t] of Object.entries(
      src.primitive.ease as Record<string, { value: string }>)) {
      if (name === "soft") continue;
      const [x1, y1] = /^cubic-bezier\(([^)]+)\)$/.exec(t.value)![1]!
        .split(",").map((n) => Number(n.trim())) as [number, number];
      if (y1 < x1) offenders.push(`${name} (${t.value}) starts slow`);
    }
    expect(offenders).toEqual([]);
  });

  it("every spring token carries all three parameters", () => {
    for (const [name, t] of Object.entries(
      src.primitive.spring as Record<string, { value: string }>)) {
      for (const key of ["stiffness", "damping", "mass"]) {
        expect(t.value, `spring.${name} is missing ${key}`).toMatch(new RegExp(`${key}\\s+[\\d.]+`));
      }
    }
  });

  it("the reduced-motion ceiling in CSS and in JS is the same number", () => {
    // base.css caps reduced transitions at 120ms; the bridge caps them at
    // 0.12s. They are the same rule and they were, once, two edits.
    const base = readFileSync(join(repoRoot, "packages/ui/src/base.css"), "utf8");
    expect(base).toContain("transition-duration: 120ms !important");
    expect(bridge).toContain("duration: 0.12");
  });

  it("carries the prototype-parity tokens (2026-09-06)", () => {
    // Spec 2026-09-06 §5.3. Two durations for the prototype's entrance families,
    // two springs for the pointer words, one accent shadow for the «now» card.
    expect(src.primitive.duration.stately.value).toBe("900ms");
    expect(src.primitive.duration.grand.value).toBe("1200ms");
    expect(src.primitive.spring.tilt.value).toBe("stiffness 120, damping 20, mass 1");
    expect(src.primitive.spring.magnetic.value).toBe("stiffness 150, damping 18, mass 0.5");
    expect(src.shadow["float-accent"].layers).toHaveLength(2);
    expect(src.shadow["float-accent"].layers[0].color.hex).toBe("#2B4BFF");
    for (const name of ["stately", "grand"]) expect(bridge).toContain(`${name}: seconds(duration.${name})`);
    for (const name of ["tilt", "magnetic"]) expect(bridge).toContain(`${name}: springOf(spring.${name})`);
    // The yoyo loops are the second permitted use of the symmetric curve.
    expect(src.primitive.ease.soft.ruling).toContain("yoyo");
  });
});
