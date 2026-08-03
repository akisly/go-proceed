// Emits the web half of the token source. Output directory is overridable so
// the fidelity test can regenerate into a temp dir and compare.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

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

function rgba({ hex, alpha }) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// The `shadow` block carries block-level metadata (nativeBlurDivisor and its
// note) alongside named shadow tokens — filter those out rather than assume
// the block holds nothing but tokens.
function shadowTokens(block) {
  if (!block) return [];
  return Object.entries(block).filter(([, v]) => v && typeof v === "object" && Array.isArray(v.layers));
}

// One CSS box-shadow layer per source layer, comma-joined for a multi-layer
// token. Each layer's colour goes through the same rgba() helper as every
// other colour with alpha < 1.
function shadowValue(token) {
  return token.layers
    .map((l) => `${l.offsetX}px ${l.offsetY}px ${l.blurRadius}px ${l.spreadRadius}px ${rgba(l.color)}`)
    .join(", ");
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tokens.generated.css"), lines.join("\n"));
console.log(`wrote ${join(outDir, "tokens.generated.css")}`);
