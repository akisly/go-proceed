/**
 * Emits the raw custom-property layer: every primitive, every semantic role,
 * every component value, as plain CSS custom properties under a `--gp-` prefix.
 *
 * WHY A PREFIX, AND WHY THIS IS NOT THE @theme BLOCK
 * ---------------------------------------------------
 * Tailwind v4 owns the `--color-*`, `--text-*`, `--radius-*` … namespaces: any
 * variable declared there becomes a utility. That is the right home for the
 * ~60 names a component author should be able to type, and the wrong home for
 * 58 primitive ramp steps that no component may name (D1's whole point is that
 * a component names a role, not a value). So the two layers are separated:
 * this file declares `--gp-*`, and theme.generated.css maps a curated subset of
 * them into Tailwind's namespaces with `@theme inline`.
 *
 * WHY SEMANTIC ROLES ARE `var()` CHAINS RATHER THAN LITERALS
 * ----------------------------------------------------------
 * `--gp-bg-canvas: var(--gp-neutral-25)` costs one indirection and buys the
 * dark block below: overriding fifteen primitives would change every role at
 * once, which is not what a theme is. The dark block therefore re-points the
 * ROLES, not the ramp — the ramp is a fact about colour and does not have a
 * dark variant.
 *
 * The dark block is emitted behind `[data-theme='dark']` and behind no media
 * query at all. D6 ships light only in v1: the ramps are authored so dark is a
 * generator flag rather than a refactor, and the switch is held.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  readSource, repoRoot, shadowTokens, shadowValue, scale, SCALE_BLOCKS, BANNER,
} from "./lib/source.mjs";

const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Source block -> custom-property prefix. Only one entry is a rename and it is
 * load-bearing: the font-size block would otherwise emit `--gp-text-body`,
 * which collides head-on with the semantic role `--gp-text-primary`. Two
 * unrelated things sharing a prefix is how a token gets reached for by the
 * wrong name, so the size scale is `--gp-size-*` here and is mapped back onto
 * Tailwind's `--text-*` namespace by theme.generated.css.
 */
const PREFIX = { text: "size" };
const prefixOf = (block) => PREFIX[block] ?? kebab(block);

const src = readSource();
const outDir = process.env.TOKENS_OUT_DIR ?? join(repoRoot, "packages/ui/src");

const L = [...BANNER("generate-css.mjs", "this file"), ":root {"];

L.push("  /* primitive — colour ramps. No component may name one of these; the",
       "     primitive-leak test fails any `gp-<ramp>-<step>` reference under apps/**. */");
for (const [name, t] of Object.entries(src.primitive.color)) {
  L.push(`  --gp-${name}: ${t.hex};`);
}

for (const block of SCALE_BLOCKS) {
  const entries = scale(src.primitive[block]);
  if (!entries.length) continue;
  L.push(`  /* primitive — ${block} */`);
  for (const [name, value] of entries) L.push(`  --gp-${prefixOf(block)}-${name}: ${value};`);
}

L.push("  /* elevation. Four, and only four. A panel gets none of them. */");
for (const [name, t] of shadowTokens(src.shadow)) {
  L.push(`  --gp-shadow-${name}: ${shadowValue(t)};`);
}

L.push("  /* semantic roles — light */");
for (const [name, t] of Object.entries(src.semantic.color)) {
  L.push(`  --gp-${name}: ${ref(t.light)};`);
}

L.push("  /* component values that are not derivable from a role */");
for (const [name, t] of Object.entries(src.component)) {
  L.push(`  --gp-${name}: ${t.value};`);
}

L.push("}", "");
L.push("/* Authored, not shipped (D6). Nothing sets data-theme in v1, so this block",
       "   is inert until a switch exists — but every pairing in it is asserted by",
       "   packages/testing/src/contrast.test.ts today, so the switch is a decision",
       "   rather than a project. */");
L.push("[data-theme='dark'] {");
for (const [name, t] of Object.entries(src.semantic.color)) {
  L.push(`  --gp-${name}: ${ref(t.dark)};`);
}
L.push("}", "");

/** `"neutral-25"` -> `var(--gp-neutral-25)`; `{ref,alpha}` -> a color-mix. */
function ref(entry) {
  if (typeof entry === "string") return `var(--gp-${entry})`;
  const alpha = entry.alpha ?? 1;
  if (alpha === 1) return `var(--gp-${entry.ref})`;
  // color-mix rather than a pre-composed rgba(): the primitive stays a single
  // source of truth, and changing the ramp step changes the scrim with it.
  return `color-mix(in oklab, var(--gp-${entry.ref}) ${Math.round(alpha * 100)}%, transparent)`;
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tokens.generated.css"), L.join("\n"));
console.log(`wrote ${join(outDir, "tokens.generated.css")}`);
