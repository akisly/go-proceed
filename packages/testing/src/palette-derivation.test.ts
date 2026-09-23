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

describe("the brand sheet survives the revision", () => {
  /**
   * The Autumn anchors are not copied into the source — they are what the
   * neutral/ember/pine ramps produce at their own steps. That is a much
   * stronger claim than "we kept them", and it is only true while the OKLCH
   * triples are what they are, so it is asserted rather than described.
   *
   * [2026-09-22, DEV-028] These rows were the Daylight anchors: cobalt-500
   * #2B4BFF, cobalt-400 #5568DE, green-500 #1E8F5A, amber-600 #C8641F,
   * danger-500 #E45C55, neutral-25 #F6F5F1, neutral-975 #15161A. The owner
   * replaced the palette with a brand sheet (black, #FF5B04, #395A4D and a
   * warm neutral ramp), so the row that says "reproduces the sheet" now names
   * the sheet's own values. The three status families moved as well and are
   * deliberately NOT anchored: their job is to stay far from the brand, and
   * pinning them to a value would be pinning the wrong property. What is
   * asserted about them instead is the distance (below).
   */
  const ANCHORS: Array<[token: string, declared: string, was: string]> = [
    ["ember-500", "#FF5B04", "the sheet's orange — the mark, the signal action, the accent ornament"],
    ["pine-700", "#395A4D", "the sheet's green — the brand as a word, and the one text-safe brand colour"],
    ["neutral-25", "#ECE9DF", "the sheet's paper — the canvas"],
    ["neutral-975", "#0C0C0A", "the sheet's black — text and the primary action"],
    ["neutral-950", "#1D1818", "the sheet's ramp, step 1"],
    ["neutral-900", "#2A2524", "the sheet's ramp, step 2"],
    ["neutral-500", "#7B736A", "the sheet's ramp, step 5"],
    ["neutral-400", "#A5A19E", "the sheet's ramp, step 6"],
  ];

  for (const [token, declared, was] of ANCHORS) {
    it(`${token} reproduces the sheet's ${declared} (${was})`, () => {
      expect(colors[token]!.hex).toBe(declared);
    });
  }

  /**
   * The owner's decision of 2026-09-22: a status must not be mistakable for a
   * brand colour. Ember sits at hue 40 and pine at 168, so every status family
   * is asserted to stand clear of both — in HUE, which is what a reader
   * actually sorts colours by, and for pine additionally in CHROMA, because a
   * deep desaturated green and a saturated mid green can share a hue and still
   * never be confused.
   */
  /** Hue distance on the circle, so a family that moves past 0/360 is still measured, not flattered. */
  const apart = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  // The minimum each family owes, chosen from what the distance has to SURVIVE,
  // not from what it happens to measure. `danger-500`'s own ruling condemns the
  // 14° the legacy red stood at, so 20 is the smallest number that still
  // condemns it; a threshold of 15 would have re-admitted a red at hue 25.
  const AWAY_FROM_EMBER: Array<[string, number]> = [["amber-600", 30], ["danger-500", 20], ["green-500", 60], ["cobalt-500", 60]];
  for (const [token, degrees] of AWAY_FROM_EMBER) {
    it(`${token} stands at least ${degrees}° from the mark's hue`, () => {
      const [, , h] = colors[token]!.oklch;
      const [, , mark] = colors["ember-500"]!.oklch;
      expect(apart(h, mark)).toBeGreaterThanOrEqual(degrees);
    });
  }

  it("keeps the ready green saturated where the brand's pine is not", () => {
    // Hue alone cannot separate these two: the ready green and the brand's pine
    // are 18° apart, which is nothing. What separates them is chroma — a
    // saturated mid green beside a desaturated deep one — so that is what is
    // asserted. Measured: 0.155 against 0.0444, a ratio of 0.29.
    const [, ready] = colors["green-500"]!.oklch;
    const [, brand] = colors["pine-700"]!.oklch;
    expect(brand / ready).toBeLessThan(0.4);
  });

  // [2026-09-22, DEV-029] The warm ground ramp. Clay sits 20 degrees from
  // ember, which is inside the distance every STATUS family owes the mark — and
  // deliberately so: it is the same autumn family, which is why the reference's
  // mocha and its orange belong on one screen. Hue therefore cannot be what
  // separates them, so chroma is, exactly as it is for pine against the ready
  // green: a desaturated brown beside a saturated orange. Measured 0.0677
  // against 0.2125, a ratio of 0.32. Without this guard the ramp could drift
  // saturated one step at a time until the page carried two sparks.
  it("keeps the warm ground desaturated where the mark is not", () => {
    const [, ground] = colors["clay-500"]!.oklch;
    const [, mark] = colors["ember-500"]!.oklch;
    expect(ground / mark).toBeLessThan(0.4);
  });
});

describe("paper and ink share one warm axis, and measurably so", () => {
  it("keeps the paper and the ink warm", () => {
    // [2026-09-22, DEV-028] This read «keeps the paper warm and the ink cool»,
    // and asserted the ink's hue in (240, 300): Daylight opposed a warm paper
    // to a cool ink, and that opposition was the identity. Autumn's ramp runs
    // from the sheet's warm black to white without a cool step — the
    // temperature is carried by ember and pine now, not by the distance
    // between ink and paper — so the assertion is that BOTH sit on the warm
    // axis. Both still carry a small chroma on purpose: neither is a hue-less
    // grey, and asserting that keeps a later tidy-up from flattening them.
    const paper = colors["neutral-25"]!.oklch;
    const ink = colors["neutral-975"]!.oklch;
    for (const t of [paper, ink]) {
      expect(t[2]).toBeGreaterThan(60);
      expect(t[2]).toBeLessThan(120);
      expect(t[1]).toBeGreaterThan(0);
      expect(t[1]).toBeLessThan(0.02);
    }
  });

  it("keeps ink and paper far enough apart to carry the whole scale", () => {
    expect(contrastRatio(colors["neutral-975"]!.hex, colors["neutral-25"]!.hex))
      .toBeGreaterThan(15);
  });
});
