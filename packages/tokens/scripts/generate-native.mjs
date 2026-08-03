// Emits the React Native half. RN has no cascade, no var() and no CSS custom
// properties — tokens must arrive as a plain object. Alpha is kept separately
// in colorRaw so a consumer that needs the two apart (compositing a translucent
// fill, say) has them; the shadow no longer needs that, because its colour is
// composed here into the rgba() string BoxShadowValue.color takes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { rgba, shadowTokens } from "./lib/source.mjs";

const root = join(import.meta.dirname, "..", "..", "..");
const src = JSON.parse(readFileSync(join(root, "packages/tokens/src/tokens.json"), "utf8"));
const outDir = process.env.TOKENS_OUT_DIR ?? join(root, "packages/tokens/src");

const names = Object.keys(src.color);
const shadows = shadowTokens(src.shadow);

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
  `export type ShadowName = ${shadows.length ? shadows.map(([n]) => JSON.stringify(n)).join(" | ") : "never"};`,
  "",
  "/**",
  " * Structurally React Native's own `BoxShadowValue`",
  " * (react-native@0.86.2, Libraries/StyleSheet/StyleSheetTypes.d.ts:343-350),",
  " * declared here rather than imported so @aktflow/tokens stays free of a",
  " * react-native dependency and keeps working in the web build. RN's version",
  " * makes `color`, `blurRadius` and `spreadDistance` optional and allows",
  " * strings for the numbers, so this narrower shape is assignable to it, and",
  " * `BoxShadowValue[]` is assignable to `ViewStyle[\"boxShadow\"]`",
  " * (`ReadonlyArray<BoxShadowValue> | string`, same file at :516).",
  " */",
  "export type BoxShadowValue = {",
  "  offsetX: number;",
  "  offsetY: number;",
  "  blurRadius: number;",
  "  spreadDistance: number;",
  "  color: string;",
  "};",
  "",
  "/** Pass straight to a View's `boxShadow` style prop — CSS box-shadow",
  "  * semantics on both iOS and Android, so nothing here is approximated per",
  "  * platform. */",
  "export const shadow: Record<ShadowName, BoxShadowValue[]> = {",
  ...shadows.map(([n, t]) => {
    const layers = t.layers.map((l) =>
      `{ offsetX: ${l.offsetX}, offsetY: ${l.offsetY}, blurRadius: ${l.blurRadius}, ` +
      `spreadDistance: ${l.spreadDistance}, color: ${JSON.stringify(rgba(l.color))} }`
    ).join(", ");
    return `  ${JSON.stringify(n)}: [${layers}],`;
  }),
  "};",
  "",
];

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tokens.generated.ts"), out.join("\n"));
console.log(`wrote ${join(outDir, "tokens.generated.ts")}`);
