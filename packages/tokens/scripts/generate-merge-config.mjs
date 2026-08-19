/**
 * Emits the tailwind-merge class-group override, derived from the token source.
 *
 * WHY THIS IS A GENERATOR AND NOT A HAND-WRITTEN CONFIG
 * ----------------------------------------------------
 * tailwind-merge has to be TAUGHT this theme, and the failure when it is not
 * is silent and severe. Measured on tailwind-merge 3.6.0 against the real
 * class names:
 *
 *     twMerge("text-data text-ink")      ->  "text-ink"          <- the SIZE is gone
 *     twMerge("text-mkt-lead text-ink-muted") -> "text-ink-muted" <- same
 *     twMerge("rounded-panel rounded-pill")   -> both kept        <- should collapse
 *
 * `text-data` is not a t-shirt size, so stock tailwind-merge files it as a
 * COLOUR, decides it conflicts with `text-ink`, and drops one. Nothing warns.
 * The element renders at the inherited size and looks almost right.
 *
 * v1 recorded this trap and fixed it by hand-listing the namespaces in
 * `src/lib/utils.ts`, with a note to "extend it when the theme gains a
 * namespace". This generator is that note, executed: the lists come from
 * tokens.json, so a namespace cannot be gained without the merge config
 * gaining it too.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { readSource, repoRoot, shadowTokens, scale } from "./lib/source.mjs";

const src = readSource();
const outDir = process.env.TOKENS_OUT_DIR ?? join(repoRoot, "packages/ui/src");

const names = (block) => scale(src.primitive[block]).map(([n]) => n);
const list = (items, extra = []) =>
  [...items, ...extra].map((n) => JSON.stringify(n)).join(", ");

const colours = Object.values(src.semantic.color)
  .map((t) => t.tw).filter(Boolean).sort();

const out = [
  "// GENERATED — do not edit. Source: packages/tokens/src/tokens.json",
  "// Regenerate: node packages/tokens/scripts/generate-merge-config.mjs",
  "// packages/testing/src/token-fidelity.test.ts fails if this drifts.",
  "//",
  "// Teaches tailwind-merge this theme's namespaces. See the generator's header",
  "// for the measured failure this prevents.",
  "",
  'import { validators } from "tailwind-merge";',
  "",
  "const { isArbitraryValue, isArbitraryVariable } = validators;",
  "",
  "/** Every semantic colour name, so a colour utility is recognised as one. */",
  `export const COLOUR_NAMES = [${list(colours)}] as const;`,
  "",
  "export const TW_MERGE_OVERRIDE = {",
  "  classGroups: {",
  `    "font-size": [{ text: [${list(names("text"))}, isArbitraryValue, isArbitraryVariable] }],`,
  `    "font-family": [{ font: [${list(names("font").filter((n) => n !== "features"))}] }],`,
  `    "font-weight": [{ font: [${list(names("fontWeight"))}, isArbitraryValue, isArbitraryVariable] }],`,
  `    leading: [{ leading: [${list(names("leading"))}, isArbitraryValue, isArbitraryVariable] }],`,
  `    tracking: [{ tracking: [${list(names("tracking"))}, isArbitraryValue, isArbitraryVariable] }],`,
  `    rounded: [{ rounded: [${list(names("radius"), ["", "none"])}, isArbitraryValue, isArbitraryVariable] }],`,
  `    shadow: [{ shadow: [${list(shadowTokens(src.shadow).map(([n]) => n), ["", "none"])}, isArbitraryValue, isArbitraryVariable] }],`,
  `    ease: [{ ease: [${list(names("ease"), ["linear", "initial"])}, isArbitraryValue, isArbitraryVariable] }],`,
  "    // Durations are NAMED here, not numeric: `duration-fast` and",
  "    // `duration-base` are the same property and must collapse, and stock",
  "    // tailwind-merge only recognises `duration-<number>`.",
  `    duration: [{ duration: [${list(names("duration"))}, isArbitraryValue, isArbitraryVariable] }],`,
  `    blur: [{ blur: [${list(names("blur"), ["", "none"])}, isArbitraryValue, isArbitraryVariable] }],`,
  "  },",
  "} as const;",
  "",
];

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tw-merge.generated.ts"), out.join("\n"));
console.log(`wrote ${join(outDir, "tw-merge.generated.ts")}`);
