import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// Typed by scripts/lib/color.d.mts — see palette-derivation.test.ts.
import { contrastRatio, rgba } from "../../tokens/scripts/lib/color.mjs";

/**
 * Contrast is a CONTRACT, not a review note.
 *
 * v1 recorded its ratios in a comment beside each token — «8.50:1 — Slate»,
 * «5.86:1» — which is exactly as durable as the next person editing the value
 * and not the comment. This file asserts them instead, in both themes, and
 * names the failing pair and its measured ratio when it breaks.
 *
 * The thresholds are WCAG 2.1: 4.5:1 for body text, 3:1 for large text
 * (>=24px, or >=19px bold) and for non-text contrast — component boundaries,
 * focus indicators, meaningful graphics. A border between two surfaces is NOT
 * a non-text contrast case under 1.4.11 when nothing depends on seeing it, so
 * the structural lines are asserted only to be visible at all.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");
const src = JSON.parse(
  readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));

type Theme = "light" | "dark";

/** Resolve a semantic role to a literal for a theme, exactly as the native
 * generator does — including the alpha form, so a scrim is measured as it
 * renders rather than as its underlying ramp step. */
function role(name: string, theme: Theme): string {
  const t = src.semantic.color[name];
  if (!t) throw new Error(`unknown semantic role "${name}"`);
  const entry = t[theme];
  const ref = typeof entry === "string" ? entry : entry.ref;
  const alpha = typeof entry === "string" ? 1 : (entry.alpha ?? 1);
  const prim = src.primitive.color[ref];
  return alpha === 1 ? prim.hex : rgba({ hex: prim.hex, alpha });
}

/**
 * Every pairing the product actually renders. A role that appears in no row
 * here is a role nothing has proven readable — the last test in this file is
 * what stops one being added quietly.
 */
const PAIRS: Array<[label: string, fg: string, bg: string, min: number]> = [
  ["primary copy on the canvas", "text-primary", "bg-canvas", 4.5],
  ["primary copy on a surface", "text-primary", "bg-surface", 4.5],
  ["secondary copy on the canvas", "text-secondary", "bg-canvas", 4.5],
  ["muted copy on the canvas", "text-muted", "bg-canvas", 4.5],
  ["muted copy on a surface", "text-muted", "bg-surface", 4.5],
  ["muted copy on a subtle fill", "text-muted", "bg-subtle", 4.5],
  ["muted copy on a muted fill", "text-muted", "bg-muted", 4.5],
  ["secondary copy on a muted fill", "text-secondary", "bg-muted", 4.5],
  ["metadata on the canvas (large/non-body only)", "text-subtle", "bg-canvas", 3.0],
  ["copy on the inverse surface", "text-on-inverse", "bg-inverse", 4.5],
  ["metadata on the inverse surface", "text-on-inverse-muted", "bg-inverse", 4.5],
  ["copy on the mark", "text-on-signal", "bg-signal", 4.5],
  ["a link on a surface", "text-link", "bg-surface", 4.5],
  ["'ready' as text on a surface", "text-brand", "bg-surface", 4.5],
  ["the primary action's label", "action-primary-fg", "action-primary-bg", 4.5],
  ["the primary action's label on hover", "action-primary-fg", "action-primary-hover", 4.5],
  ["the signal action's label", "action-signal-fg", "action-signal-bg", 4.5],
  ["the signal action's label on hover", "action-signal-fg", "action-signal-hover", 4.5],
  ["ready chip", "status-ready-fg", "status-ready-surface", 4.5],
  ["attention chip", "status-attention-fg", "status-attention-surface", 4.5],
  ["blocked chip", "status-blocked-fg", "status-blocked-surface", 4.5],
  ["destructive action's label at rest", "status-blocked-fg", "bg-surface", 4.5],
  ["destructive action's label on hover", "action-primary-fg", "status-blocked-fg", 4.5],
  ["review chip", "status-review-fg", "status-review-surface", 4.5],
  ["idle chip", "status-idle-fg", "status-idle-surface", 4.5],
  ["evidence satisfied on the canvas", "evidence-satisfied", "bg-canvas", 4.5],
  ["evidence pending on the canvas", "evidence-pending", "bg-canvas", 4.5],
  ["evidence blocking on the canvas", "evidence-blocking", "bg-canvas", 4.5],
  ["the focus ring against a surface", "border-focus", "bg-surface", 3.0],
  ["the focus ring against the canvas", "border-focus", "bg-canvas", 3.0],
  // [2026-09-22, DEV-025] The ordinary ring measures 2.56:1 against the inverse
  // surface — the brand's primary is a deep green and that ground is the ink.
  // `base.css` switches the ring to `border-focus-inverse` inside `bg-inverse`,
  // and this row is what keeps that switch honest; without it the table would
  // have passed a ring nobody can see, which is how the gap was found.
  ["the focus ring inside an inverse surface", "border-focus-inverse", "bg-inverse", 3.0],
  ["the accent phrase in a display heading, on the canvas (large text)", "text-accent", "bg-canvas", 3.0],
  ["the accent phrase in a display heading, on a surface (large text)", "text-accent", "bg-surface", 3.0],
];

/** Structural lines: not a 1.4.11 case, but a border nobody can see is a
 * border that is not doing its job — the whole system is border-led. */
const LINES: Array<[label: string, fg: string, bg: string, min: number]> = [
  ["the subtle hairline on a surface", "border-subtle", "bg-surface", 1.1],
  ["the default border on the canvas", "border-default", "bg-canvas", 1.2],
  ["the default border on a surface", "border-default", "bg-surface", 1.2],
  ["the strong border on a surface", "border-strong", "bg-surface", 1.5],
  ["the inverse hairline on the inverse surface", "border-inverse", "bg-inverse", 1.5],
  ["the accent edge of a selected card on a surface", "border-accent", "bg-surface", 3.0],
  // [Corrected 2026-09-06: the fix-wave brief asked for a 3.0 minimum here,
  // matching the Important-review's assumption that a control's border is a
  // meaningful (1.4.11) boundary. Measured, it is not: status-blocked-border
  // on bg-surface is 1.35:1 in light and 1.66:1 in dark — a hairline, not an
  // accent edge (compare border-accent's actual ~3:1+, which is why that row
  // alone in this table carries 3.0). 1.3 is the same margin-below-measured
  // convention as border-subtle/border-default/border-strong above.]
  ["the destructive border on a surface", "status-blocked-border", "bg-surface", 1.3],
];

for (const theme of ["light", "dark"] as Theme[]) {
  describe(`contrast — ${theme}`, () => {
    for (const [label, fg, bg, min] of PAIRS) {
      it(`${label} clears ${min}:1`, () => {
        const ratio = contrastRatio(role(fg, theme), role(bg, theme));
        expect(
          ratio,
          `${fg} (${role(fg, theme)}) on ${bg} (${role(bg, theme)}) measures ${ratio}:1, needs ${min}:1`,
        ).toBeGreaterThanOrEqual(min);
      });
    }
    for (const [label, fg, bg, min] of LINES) {
      it(`${label} is visible`, () => {
        const ratio = contrastRatio(role(fg, theme), role(bg, theme));
        expect(ratio, `${fg} on ${bg} measures ${ratio}:1`).toBeGreaterThanOrEqual(min);
      });
    }
  });
}

describe("the pairing table covers the system", () => {
  it("asserts every foreground role against at least one ground", () => {
    // A role that appears in no row above is a role whose readability nothing
    // has established. Adding one without a pairing should fail here rather
    // than ship.
    const asserted = new Set([...PAIRS, ...LINES].flatMap(([, fg]) => fg));
    const foregrounds = Object.keys(src.semantic.color).filter((n) =>
      n.startsWith("text-") || n.endsWith("-fg") || n.startsWith("evidence-") ||
      n.startsWith("border-"));
    expect(foregrounds.filter((n) => !asserted.has(n))).toEqual([]);
  });

  it("names only roles that exist", () => {
    const known = new Set(Object.keys(src.semantic.color));
    const unknown = [...PAIRS, ...LINES]
      .flatMap(([, fg, bg]) => [fg, bg]).filter((n) => !known.has(n));
    expect([...new Set(unknown)]).toEqual([]);
  });
});
