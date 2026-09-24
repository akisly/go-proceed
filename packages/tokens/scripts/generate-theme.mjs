/**
 * Emits the Tailwind v4 theme layer. This file is the ONLY place Tailwind's
 * namespaces are populated, and it is generated, so `bg-canvas` and
 * `--gp-bg-canvas` cannot come to mean different things.
 *
 * THREE BLOCKS, AND WHY EACH IS THE SHAPE IT IS
 * ---------------------------------------------
 * 1. Stock Tailwind stays whole (owner, 2026-09-24, DEV-073): nothing it
 *    ships is cleared, and the roles below ride on top of it — a role with a
 *    stock name (`md` breakpoint, `font-medium`, `leading-tight`, `ease-out`)
 *    overrides the stock value, and every other role is added beside the
 *    stock scale. Until that day this block cleared eighteen namespaces with
 *    `--ns-*: initial`, so `max-w-md` compiled to nothing and every `Dialog`
 *    ran full width (BL-047). Roles are still what components name; stock
 *    utilities are available, not preferred.
 *
 * 2. `@theme static { … literals }` for the three namespaces that cannot take a
 *    `var()`: breakpoints and container sizes end up inside media and container
 *    queries, which are resolved at build time and cannot read a custom
 *    property. `static` also forces every variable in the block into the output
 *    whether or not a utility used it, which is what a design system package
 *    needs — a component reading `var(--breakpoint-wide)` in a media query must
 *    not depend on some other file having happened to use `wide:`.
 *
 * 3. `@theme inline { … var() refs }` for everything else. `inline` is
 *    load-bearing and not a style preference: without it the utility is
 *    compiled as `var(--color-canvas)`, whose own value `var(--gp-bg-canvas)`
 *    resolves in the scope where `--color-canvas` was DECLARED — `:root` —
 *    rather than where the utility is USED. Put `[data-theme='dark']` on a
 *    subtree instead of on `<html>` and the subtree keeps the light value.
 *    With `inline` the utility compiles to `var(--gp-bg-canvas)` directly and
 *    resolves at the element, which is the behaviour a scoped theme needs.
 *    D6 holds the switch; this makes flipping it a decision rather than a
 *    refactor.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  readSource, repoRoot, shadowTokens, scale, BANNER,
} from "./lib/source.mjs";

const src = readSource();
const outDir = process.env.TOKENS_OUT_DIR ?? join(repoRoot, "packages/ui/src");


const L = [
  ...BANNER("generate-theme.mjs", "this file"),
  "",
  '@import "./tokens.generated.css";',
  "",
  "/* 1 — stock Tailwind stays whole; the roles below add to it or override",
  "   a stock name they share (owner, 2026-09-24). */",
  "",
  "/* 2 — literals. Breakpoints and container sizes land inside media and",
  "   container queries, which cannot read a custom property. */",
  "@theme static {",
  `  --spacing: ${src.primitive.space.base.value};`,
  ...scale(src.primitive.breakpoint).map(([n, v]) => `  --breakpoint-${n}: ${v};`),
  ...scale(src.primitive.container).map(([n, v]) => `  --container-${n}: ${v};`),
  "}",
  "",
  "/* 3 — roles. `inline` so the utility carries the role variable itself and",
  "   resolves at the element, not at :root. */",
  "@theme inline {",
];

L.push("  /* families */");
for (const n of ["display", "sans", "mono"]) L.push(`  --font-${n}: var(--gp-font-${n});`);

L.push("  /* type scale — product first, marketing second */");
for (const [n] of scale(src.primitive.text)) L.push(`  --text-${n}: var(--gp-size-${n});`);

L.push("  /* weight, leading, tracking */");
for (const [n] of scale(src.primitive.fontWeight)) L.push(`  --font-weight-${n}: var(--gp-font-weight-${n});`);
for (const [n] of scale(src.primitive.leading)) L.push(`  --leading-${n}: var(--gp-leading-${n});`);
for (const [n] of scale(src.primitive.tracking)) L.push(`  --tracking-${n}: var(--gp-tracking-${n});`);

L.push("  /* radius and blur */");
for (const [n] of scale(src.primitive.radius)) L.push(`  --radius-${n}: var(--gp-radius-${n});`);
for (const [n] of scale(src.primitive.blur)) L.push(`  --blur-${n}: var(--gp-blur-${n});`);

L.push("  /* elevation — four, and a panel gets none of them */");
for (const [n] of shadowTokens(src.shadow)) L.push(`  --shadow-${n}: var(--gp-shadow-${n});`);

L.push("  /* motion */");
for (const [n] of scale(src.primitive.ease)) L.push(`  --ease-${n}: var(--gp-ease-${n});`);

L.push("  /* colour — SEMANTIC ROLES ONLY. No ramp step is reachable as a utility:",
       "     `bg-neutral-200` does not exist and must not. */");
for (const [, t] of Object.entries(src.semantic.color)) {
  if (!t.tw) continue;
  L.push(`  --color-${t.tw}: var(--gp-${roleOf(src, t)});`);
}
L.push("}", "");

// The 768..1240 band is a documented state of the shell, so it gets a named
// variant rather than being retyped as a media query wherever it is needed.
// Generated here so neither number appears twice in the repository.
L.push(
  "",
  "/* The icon-rail band: the one shell state a min-width variant cannot express.",
  "   Both numbers come from --breakpoint-*; neither is typed anywhere else. */",
  `@custom-variant rail-icons (@media (width >= ${src.primitive.breakpoint.md.value}) and (width < ${src.primitive.breakpoint.wide.value}));`,
  "",
);

function roleOf(source, token) {
  const entry = Object.entries(source.semantic.color).find(([, v]) => v === token);
  return entry[0];
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "theme.generated.css"), L.join("\n"));
console.log(`wrote ${join(outDir, "theme.generated.css")}`);
