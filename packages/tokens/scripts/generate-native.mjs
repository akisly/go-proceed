// Emits the React Native half. RN has no cascade, no var(), and no CSS custom
// properties — tokens must arrive as a plain object of strings. Alpha is kept
// separately in colorRaw because RN's shadowOpacity multiplies with a colour's
// alpha, so a shadow consumer needs the two apart.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..");
const src = JSON.parse(readFileSync(join(root, "packages/tokens/src/tokens.json"), "utf8"));
const outDir = process.env.TOKENS_OUT_DIR ?? join(root, "packages/tokens/src");

const names = Object.keys(src.color);

// The `shadow` block carries block-level metadata (nativeBlurDivisor and its
// note) alongside named shadow tokens — filter those out rather than assume
// the block holds nothing but tokens.
const shadowBlock = src.shadow ?? {};
const shadowNames = Object.entries(shadowBlock)
  .filter(([, v]) => v && typeof v === "object" && Array.isArray(v.layers))
  .map(([n]) => n);

const out = [
  "// GENERATED — do not edit. Source: packages/tokens/src/tokens.json",
  "// Regenerate: node packages/tokens/scripts/generate-native.mjs",
  "// packages/testing/src/token-fidelity.test.ts fails if this drifts.",
  "",
  `export type ColorName = ${names.map((n) => JSON.stringify(n)).join(" | ")};`,
  "",
  "export const colorRaw: Record<ColorName, { hex: string; alpha: number }> = {",
  ...names.map((n) =>
    `  ${JSON.stringify(n)}: { hex: ${JSON.stringify(src.color[n].hex)}, alpha: ${src.color[n].alpha} },`),
  "};",
  "",
  "export const color: Record<ColorName, string> = {",
  ...names.map((n) => `  ${JSON.stringify(n)}: ${JSON.stringify(src.color[n].hex)},`),
  "};",
  "",
  // No CSS strings: elevation encodes offset, blur and opacity in one scalar
  // and cannot be derived from them, so androidElevation is hand-authored in
  // the source, not computed here. shadowRadius for RN's shadow* props is
  // left to the consumer: blurRadius / nativeBlurDivisor.
  `export type ShadowName = ${shadowNames.length ? shadowNames.map((n) => JSON.stringify(n)).join(" | ") : "never"};`,
  "",
  "export type ShadowLayer = {",
  "  offsetX: number; offsetY: number; blurRadius: number; spreadRadius: number;",
  "  color: { hex: string; alpha: number };",
  "};",
  "",
  `export const nativeBlurDivisor = ${JSON.stringify(shadowBlock.nativeBlurDivisor ?? null)};`,
  "",
  "export const shadow: Record<ShadowName, { layers: ShadowLayer[]; androidElevation: number }> = {",
  ...shadowNames.map((n) => {
    const t = shadowBlock[n];
    const layers = t.layers.map((l) =>
      `{ offsetX: ${l.offsetX}, offsetY: ${l.offsetY}, blurRadius: ${l.blurRadius}, spreadRadius: ${l.spreadRadius}, color: { hex: ${JSON.stringify(l.color.hex)}, alpha: ${l.color.alpha} } }`
    ).join(", ");
    return `  ${JSON.stringify(n)}: { layers: [${layers}], androidElevation: ${t.androidElevation} },`;
  }),
  "};",
  "",
];

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tokens.generated.ts"), out.join("\n"));
console.log(`wrote ${join(outDir, "tokens.generated.ts")}`);
