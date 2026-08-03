// Emits the web half of the token source. Output directory is overridable so
// the fidelity test can regenerate into a temp dir and compare.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { rgba, shadowTokens } from "./lib/source.mjs";

const root = join(import.meta.dirname, "..", "..", "..");
const src = JSON.parse(readFileSync(join(root, "packages/tokens/src/tokens.json"), "utf8"));
const outDir = process.env.TOKENS_OUT_DIR ?? join(root, "packages/ui/src");

const lines = [
  "/* GENERATED — do not edit. Source: packages/tokens/src/tokens.json",
  "   Regenerate: node packages/tokens/scripts/generate-css.mjs",
  "   packages/testing/src/token-fidelity.test.ts fails if this drifts. */",
  ":root {",
];
for (const [name, t] of Object.entries(src.color)) {
  lines.push(`  --${name}: ${t.alpha === 1 ? t.hex : rgba(t)};`);
}
for (const [name, t] of shadowTokens(src.shadow)) {
  lines.push(`  --${name}: ${shadowValue(t)};`);
}
lines.push("}", "");

// One CSS box-shadow layer per source layer, comma-joined for a multi-layer
// token. The layer fields carry React Native's names (`spreadDistance`, not
// `spreadRadius`) because the native half emits them verbatim as a
// BoxShadowValue; CSS box-shadow and RN's boxShadow are the same four numbers
// in the same order, so nothing is converted here either. Each layer's colour
// goes through the same rgba() helper as every other colour with alpha < 1 —
// and, now, as the native generator.
function shadowValue(token) {
  return token.layers
    .map((l) => `${l.offsetX}px ${l.offsetY}px ${l.blurRadius}px ${l.spreadDistance}px ${rgba(l.color)}`)
    .join(", ");
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tokens.generated.css"), lines.join("\n"));
console.log(`wrote ${join(outDir, "tokens.generated.css")}`);
