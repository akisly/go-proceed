/**
 * Emits docs/design/01-tokens.md — the human-readable token reference.
 *
 * WHY THE REFERENCE IS GENERATED
 * ------------------------------
 * The failure this repository has already recorded is a document and an
 * implementation disagreeing while both look maintained: `muted` documented as
 * #686E6A, shipped as #666979, name identical, nothing failing. A hand-written
 * token table is that failure waiting to happen — it is a second place a value
 * can be typed, and the second place is always the one that goes stale.
 *
 * So the reference is output, not input. Every value, every ruling and every
 * measured contrast ratio in it comes from tokens.json at generation time. The
 * planning document (docs/design/2026-08-19-design-system-rewrite-plan.md)
 * links here rather than repeating the tables, for the same reason.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { readSource, repoRoot, shadowTokens, shadowValue, scale, SCALE_BLOCKS, semanticRef } from "./lib/source.mjs";
import { contrastRatio } from "./lib/color.mjs";

const src = readSource();
const outDir = process.env.TOKENS_OUT_DIR ?? join(repoRoot, "docs/design");

const hex = (name) => src.primitive.color[name].hex;
const CANVAS = { light: hex("neutral-25"), dark: hex("neutral-975") };
const INK = { light: hex("neutral-975"), dark: hex("neutral-25") };

const L = [];
const p = (...lines) => L.push(...lines);

p(
  "# GoProceed design tokens — reference",
  "",
  "**GENERATED — do not edit.** Source: `packages/tokens/src/tokens.json`.",
  "Regenerate: `node packages/tokens/scripts/generate-docs.mjs`.",
  "`packages/testing/src/token-fidelity.test.ts` fails if this file drifts.",
  "",
  "**Status:** Approved",
  "",
  "**Applies to:** all",
  "",
  // `Last reviewed` is the source's own review date, not the generation date.
  // Stamping today would make every regeneration look like a review, which is
  // exactly the signal this field exists to carry. It is read from the source
  // so the two cannot disagree.
  `**Last reviewed:** ${src.lastReviewed}`,
  "",
  "**Related decisions:** None yet. The rulings behind these values are D1–D7 in the [rewrite plan](./2026-08-19-design-system-rewrite-plan.md) §3, which need an ADR before Phase 3.",
  "",
  "**Surfaces:** `apps/landing`, `apps/app`, `apps/mobile`, `packages/ui`",
  "",
  "**Companion:** [design-system rewrite plan](./2026-08-19-design-system-rewrite-plan.md) — the reasoning; this file is the values.",
  "",
  "---",
  "",
  "## How to read this",
  "",
  "Three layers. **A component names a role, never a ramp step.** `bg-canvas`,",
  "`text-ink-muted`, `border-line` — not `neutral-25`. Tailwind enforces half of",
  "that (no ramp step is in the `--color-*` namespace, so `bg-neutral-200` does",
  "not compile) and `packages/testing/src/primitive-leak.test.ts` enforces the",
  "other half (a raw `var(--gp-neutral-200)` fails the build).",
  "",
  "Every colour is **derived, not picked**: each is the sRGB result of an OKLCH",
  "triple, with chroma clamped to the gamut boundary.",
  "`packages/testing/src/palette-derivation.test.ts` recomputes all of them.",
  "No hex below was typed by a human.",
  "",
  "Every contrast figure below is **measured at generation time**, not recorded",
  "by hand. `packages/testing/src/contrast.test.ts` asserts the pairings the",
  "product actually renders.",
  "",
  "---",
  "",
  "## 1. Primitive — colour ramps",
  "",
  "Not reachable from a component. Present so the semantic layer has something",
  "to point at, and so a chart or a generated asset can walk a scale.",
  "",
);

const ramps = new Map();
for (const name of Object.keys(src.primitive.color)) {
  const ramp = name.replace(/-\d+$/, "");
  if (!ramps.has(ramp)) ramps.set(ramp, []);
  ramps.get(ramp).push(name);
}

for (const [ramp, names] of ramps) {
  p(`### \`${ramp}\``, "");
  p("| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |");
  p("|---|---|---|---:|---:|---|");
  for (const name of names) {
    const t = src.primitive.color[name];
    p(`| \`${name}\` | \`${t.hex}\` | ${t.oklch[0]}, ${t.oklch[1]}, ${t.oklch[2]} | ${contrastRatio(t.hex, CANVAS.light).toFixed(2)} | ${contrastRatio(t.hex, INK.light).toFixed(2)} | ${t.ruling} |`);
  }
  p("");
}

p("---", "", "## 2. Semantic — roles", "",
  "This is the layer a component reads. `tw` is the name inside Tailwind's",
  "shared colour namespace, which `bg-`, `text-`, `border-` and `ring-` all",
  "draw from — so `bg-canvas`, `text-ink`, `border-line`.",
  "",
  "The dark column is **authored and not shipped** (D6). Nothing sets",
  "`data-theme` in v1; every dark pairing is nonetheless asserted today, so",
  "turning it on is a decision rather than a project.",
  "");

const groups = [
  ["Surfaces", (n) => n.startsWith("bg-")],
  ["Text", (n) => n.startsWith("text-")],
  ["Structure", (n) => n.startsWith("border-")],
  ["Action", (n) => n.startsWith("action-")],
  ["Status", (n) => n.startsWith("status-")],
  ["Evidence", (n) => n.startsWith("evidence-")],
  ["Data visualisation", (n) => n.startsWith("viz-")],
];

for (const [title, match] of groups) {
  const names = Object.keys(src.semantic.color).filter(match);
  if (!names.length) continue;
  p(`### ${title}`, "");
  p("| Role | Utility | Light | Dark | Ruling |");
  p("|---|---|---|---|---|");
  for (const name of names) {
    const t = src.semantic.color[name];
    const show = (theme) => {
      const { ref, alpha } = semanticRef(t[theme]);
      return alpha === 1
        ? `\`${ref}\` \`${hex(ref)}\``
        : `\`${ref}\` @ ${Math.round(alpha * 100)}%`;
    };
    p(`| \`${name}\` | \`${t.tw ?? "—"}\` | ${show("light")} | ${show("dark")} | ${t.ruling} |`);
  }
  p("");
}

p("---", "", "## 3. Elevation", "",
  "Four, and a panel gets none of them. Structure is a 1px border plus a",
  "lightness shift between the surface roles; there is no elevation ladder.",
  "");
p("| Token | Value | Ruling |");
p("|---|---|---|");
for (const [name, t] of shadowTokens(src.shadow)) {
  p(`| \`${name}\` | \`${shadowValue(t)}\` | ${t.ruling} |`);
}
p("");

p("---", "", "## 4. Scales", "");
for (const block of SCALE_BLOCKS) {
  const entries = scale(src.primitive[block]);
  if (!entries.length) continue;
  p(`### \`${block}\``, "");
  p("| Token | Value | Ruling |");
  p("|---|---|---|");
  for (const [name, value] of entries) {
    p(`| \`${name}\` | \`${value}\` | ${src.primitive[block][name].ruling} |`);
  }
  p("");
}

p("---", "", "## 5. Component values", "",
  "Only what is not derivable from a role.", "");
p("| Token | Value | Ruling |");
p("|---|---|---|");
for (const [name, t] of Object.entries(src.component)) {
  p(`| \`${name}\` | \`${t.value}\` | ${t.ruling} |`);
}
p("");

p("---", "", "## 6. Measured contrast", "",
  "Computed from the source at generation time by the same function",
  "`packages/testing/src/contrast.test.ts` asserts with. WCAG 2.1: 4.5:1 for",
  "body text, 3:1 for large text and non-text contrast.", "");

const PAIRS = [
  ["primary copy on the canvas", "text-primary", "bg-canvas"],
  ["secondary copy on the canvas", "text-secondary", "bg-canvas"],
  ["muted copy on the canvas", "text-muted", "bg-canvas"],
  ["muted copy on a subtle fill", "text-muted", "bg-subtle"],
  ["muted copy on a muted fill", "text-muted", "bg-muted"],
  ["metadata on the canvas", "text-subtle", "bg-canvas"],
  ["copy on the inverse surface", "text-on-inverse", "bg-inverse"],
  ["metadata on the inverse surface", "text-on-inverse-muted", "bg-inverse"],
  ["copy on the mark", "text-on-signal", "bg-signal"],
  ["a link on a surface", "text-link", "bg-surface"],
  ["'ready' as text on a surface", "text-brand", "bg-surface"],
  ["the primary action's label", "action-primary-fg", "action-primary-bg"],
  ["the signal action's label", "action-signal-fg", "action-signal-bg"],
  ["ready chip", "status-ready-fg", "status-ready-surface"],
  ["attention chip", "status-attention-fg", "status-attention-surface"],
  ["blocked chip", "status-blocked-fg", "status-blocked-surface"],
  ["review chip", "status-review-fg", "status-review-surface"],
  ["idle chip", "status-idle-fg", "status-idle-surface"],
  ["the focus ring against a surface", "border-focus", "bg-surface"],
];

const literal = (role, theme) => {
  const { ref } = semanticRef(src.semantic.color[role][theme]);
  return hex(ref);
};

p("| Pairing | Light | Dark |");
p("|---|---:|---:|");
for (const [label, fg, bg] of PAIRS) {
  p(`| ${label} | ${contrastRatio(literal(fg, "light"), literal(bg, "light")).toFixed(2)}:1 | ${contrastRatio(literal(fg, "dark"), literal(bg, "dark")).toFixed(2)}:1 |`);
}
p("");

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "01-tokens.md"), L.join("\n"));
console.log(`wrote ${join(outDir, "01-tokens.md")}`);
