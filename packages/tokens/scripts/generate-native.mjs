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
];

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tokens.generated.ts"), out.join("\n"));
console.log(`wrote ${join(outDir, "tokens.generated.ts")}`);
