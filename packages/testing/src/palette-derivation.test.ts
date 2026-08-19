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
   * v1's four brand colours are not copied into v2 — they are what the new
   * ramps produce at their own steps. That is a much stronger claim than
   * "we kept them", and it is only true while the OKLCH triples are what they
   * are, so it is asserted rather than described.
   *
   * signal-500 is the interesting one: #C6FF34 sits precisely on the sRGB
   * gamut boundary at OKLCH L 0.9281 H 125, so the maximum-chroma step of a
   * lime ramp at that lightness IS the brand colour.
   */
  const ANCHORS: Array<[token: string, legacy: string, was: string]> = [
    ["signal-500", "#C6FF34", "Lime — brand, action, readiness"],
    ["amber-500", "#F2B84B", "Amber — warning / at risk"],
    ["danger-500", "#E45C55", "Red — blocked / destructive"],
    ["blue-700", "#3756A1", "Blue — informational / submitted"],
  ];

  for (const [token, legacy, was] of ANCHORS) {
    it(`${token} reproduces v1's ${legacy} (${was})`, () => {
      expect(colors[token]!.hex).toBe(legacy);
    });
  }

  it("signal-500 is the gamut maximum at its lightness and hue", () => {
    const [L, C, H] = colors["signal-500"]!.oklch;
    expect(C).toBeCloseTo(maxChroma(L, H), 3);
  });
});

describe("the ink is warm, and measurably so", () => {
  it("carries the same hue as the paper it sits on", () => {
    // v1's #171717 was a hue-less grey on a hue-less paper. The warmth here is
    // deliberate and small — it reads as paper, not as beige — and asserting
    // the hue keeps a later "tidy-up" from flattening it back to grey without
    // saying so.
    expect(colors["neutral-975"]!.oklch[2]).toBe(colors["neutral-25"]!.oklch[2]);
    expect(colors["neutral-975"]!.oklch[1]).toBeGreaterThan(0);
    expect(colors["neutral-975"]!.oklch[1]).toBeLessThan(0.01);
  });

  it("keeps ink and paper far enough apart to carry the whole scale", () => {
    expect(contrastRatio(colors["neutral-975"]!.hex, colors["neutral-25"]!.hex))
      .toBeGreaterThan(15);
  });
});
