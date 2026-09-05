import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// Typed by scripts/lib/color.d.mts — the generators stay plain .mjs so they run
// from `node scripts/…` with no build step.
import { oklchToHex, maxChroma, contrastRatio } from "../../tokens/scripts/lib/color.mjs";

/**
 * The guard v1 did not have.
 *
 * v1's fidelity test proved the OUTPUT matched the SOURCE. It could not prove
 * the source was right, and it recorded exactly how that fails: `muted` was
 * documented as #686E6A and shipped as #666979 — same name, different value,
 * every generated artefact perfectly consistent with the wrong one.
 *
 * v2 removes the class of error rather than testing around it. No hex in the
 * source was typed by a human: each is the output of an OKLCH triple, and this
 * file recomputes all of them. A hex nudged by eye now fails here, naming the
 * token and both values.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");
const src = JSON.parse(
  readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));

type Primitive = { oklch: [number, number, number]; hex: string; alpha: number; ruling: string };
const colors = src.primitive.color as Record<string, Primitive>;

describe("every primitive colour is derived, not picked", () => {
  it("recomputes each hex from its own OKLCH triple", () => {
    const drift: string[] = [];
    for (const [name, t] of Object.entries(colors)) {
      const [L, C, H] = t.oklch;
      const computed = oklchToHex(L, C, H);
      if (computed !== t.hex) drift.push(`${name}: source ${t.hex}, OKLCH(${L}, ${C}, ${H}) gives ${computed}`);
    }
    expect(drift).toEqual([]);
  });

  it("keeps every chroma inside the sRGB gamut", () => {
    // A chroma past the boundary clips, and two clipped steps of a ramp round
    // to the same colour — which is how a lime ramp's light end silently
    // becomes four copies of one swatch. Tolerance is one ten-thousandth,
    // because signal-500 sits exactly ON the boundary by construction.
    const outside: string[] = [];
    for (const [name, t] of Object.entries(colors)) {
      const [L, C, H] = t.oklch;
      const max = maxChroma(L, H);
      if (C > max + 1e-4) outside.push(`${name}: C ${C} exceeds the gamut maximum ${max.toFixed(4)} at L ${L} H ${H}`);
    }
    expect(outside).toEqual([]);
  });

  it("gives every step of a ramp a distinct value", () => {
    const byRamp = new Map<string, Array<[string, string]>>();
    for (const [name, t] of Object.entries(colors)) {
      const ramp = name.replace(/-\d+$/, "");
      if (!byRamp.has(ramp)) byRamp.set(ramp, []);
      byRamp.get(ramp)!.push([name, t.hex]);
    }
    const collisions: string[] = [];
    for (const [ramp, steps] of byRamp) {
      const seen = new Map<string, string>();
      for (const [name, hex] of steps) {
        if (seen.has(hex)) collisions.push(`${ramp}: ${seen.get(hex)} and ${name} are both ${hex}`);
        seen.set(hex, name);
      }
    }
    expect(collisions).toEqual([]);
  });
});

describe("brand continuity survives the revision", () => {
  /**
   * The Daylight anchors are not copied into the source — they are what the
   * cobalt/green/amber/neutral ramps produce at their own steps. That is a
   * much stronger claim than "we kept them", and it is only true while the
   * OKLCH triples are what they are, so it is asserted rather than described.
   */
  const ANCHORS: Array<[token: string, legacy: string, was: string]> = [
    ["cobalt-500", "#2B4BFF", "Cobalt — the mark, the signal action, the review state (Daylight, 2026-09-05)"],
    ["cobalt-400", "#5568DE", "Accent — the highlighted phrase in a display heading"],
    ["green-500", "#1E8F5A", "Ok — icons and check marks"],
    ["amber-600", "#C8641F", "Warn — the draft stamp and the rule box"],
    ["danger-500", "#E45C55", "Red — blocked / destructive (unchanged from v1)"],
    ["neutral-25", "#F6F5F1", "Paper — the canvas"],
    ["neutral-975", "#15161A", "Ink — text and the primary action"],
  ];

  for (const [token, legacy, was] of ANCHORS) {
    it(`${token} reproduces v1's ${legacy} (${was})`, () => {
      expect(colors[token]!.hex).toBe(legacy);
    });
  }
});

describe("paper is warm and ink is cool, and measurably so", () => {
  it("keeps the paper warm and the ink cool", () => {
    // Daylight, 2026-09-05: the prototype pairs a warm paper (#F6F5F1, hue ≈ 95)
    // with a cool ink (#15161A, hue ≈ 274). Both carry a small chroma on
    // purpose — neither is a hue-less grey — and asserting the hues keeps a
    // later tidy-up from flattening either back to grey without saying so.
    const paper = colors["neutral-25"]!.oklch;
    const ink = colors["neutral-975"]!.oklch;
    expect(paper[2]).toBeGreaterThan(60);
    expect(paper[2]).toBeLessThan(120);
    expect(ink[2]).toBeGreaterThan(240);
    expect(ink[2]).toBeLessThan(300);
    for (const [, c] of [paper, ink].map((t) => [t[0], t[1]] as const)) {
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThan(0.02);
    }
  });

  it("keeps ink and paper far enough apart to carry the whole scale", () => {
    expect(contrastRatio(colors["neutral-975"]!.hex, colors["neutral-25"]!.hex))
      .toBeGreaterThan(15);
  });
});
