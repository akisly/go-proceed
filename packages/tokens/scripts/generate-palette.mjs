/**
 * Emits the approved-colour allowlist that the dashboard's colour audit
 * (Plan D) will check every stylesheet and every Tailwind arbitrary value
 * against. apps/demo/qa/colour-audit.mjs used this until apps/demo retired
 * on 2026-08-20; packages/testing/src/token-fidelity.test.ts guards the
 * artifact until the dashboard consumer activates.
 *
 * WHY GENERATED
 * -------------
 * v1's guard built its allowlist by scanning the frozen stylesheet: the
 * palette was whatever the sheet happened to contain. That works exactly as
 * long as the sheet is frozen, and D5 retires it. More importantly it inverts
 * the relationship — the guard was reading the implementation to decide what
 * the specification was. Deriving the allowlist from the token source instead
 * means the source and the guard cannot disagree: adding a colour to the
 * product requires adding it to tokens.json, which is the review point.
 *
 * Approval is on the RGB TRIPLET, not the literal string, and alpha is free.
 * `#C6FF34`, `rgb(198 255 52)` and an `oklch()` that resolves to it are the
 * same approved colour; `rgba(17,16,15,.04)` and `rgba(17,16,15,.12)` are both
 * the approved ink at different opacities. Introducing a new hue fails;
 * varying the opacity of an approved one does not.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { readSource, repoRoot, shadowTokens } from "./lib/source.mjs";
import { hexToRgb } from "./lib/color.mjs";

const src = readSource();
const outDir = process.env.TOKENS_OUT_DIR ?? join(repoRoot, "packages/testing/qa");

const entries = new Map();
const add = (hex, name) => {
  const k = hexToRgb(hex).join(",");
  if (!entries.has(k)) entries.set(k, new Set());
  entries.get(k).add(name);
};

for (const [name, t] of Object.entries(src.primitive.color)) add(t.hex, name);
for (const [name, t] of shadowTokens(src.shadow)) {
  for (const l of t.layers) add(l.color.hex, `shadow.${name}`);
}
// Pure black and pure white are permitted regardless: they are what a
// `currentColor` fallback, an SVG default and a print stylesheet resolve to,
// and failing them produces noise rather than findings.
add("#FFFFFF", "keyword.white");
add("#000000", "keyword.black");

const rows = [...entries.entries()].sort();
const out = [
  "// GENERATED — do not edit. Source: packages/tokens/src/tokens.json",
  "// Regenerate: node packages/tokens/scripts/generate-palette.mjs",
  "// packages/testing/src/token-fidelity.test.ts fails if this drifts.",
  "//",
  "// Approval is on the RGB triplet; alpha is free. See generate-palette.mjs.",
  "",
  "/** rgb triplet -> the token name(s) that justify it. */",
  "export const APPROVED_PALETTE = new Map([",
  ...rows.map(([k, names]) => `  [${JSON.stringify(k)}, ${JSON.stringify([...names].sort())}],`),
  "])",
  "",
  "/** The set the dashboard's colour audit will compare against. */",
  "export const APPROVED_RGB = new Set(APPROVED_PALETTE.keys())",
  "",
];

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "palette.generated.mjs"), out.join("\n"));
console.log(`wrote ${join(outDir, "palette.generated.mjs")} — ${rows.length} approved triplets`);
