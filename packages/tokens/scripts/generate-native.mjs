/**
 * Emits the React Native half. RN has no cascade, no var() and no CSS custom
 * properties — tokens must arrive as a plain object, which means the semantic
 * layer has to be RESOLVED here rather than referenced. That is the whole
 * reason this generator exists next to the CSS one instead of being a build
 * step over it: on the web a role is an indirection, on native it is a value,
 * and both have to come out of the same source or the platforms drift.
 *
 * Both themes are emitted. D6 ships light only, but a native app that has to
 * ship dark later should not need a token release to do it.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  readSource, repoRoot, shadowTokens, resolveLiteral, scale, rgba, SCALE_BLOCKS,
} from "./lib/source.mjs";

const src = readSource();
const outDir = process.env.TOKENS_OUT_DIR ?? join(repoRoot, "packages/tokens/src");

const primitives = Object.keys(src.primitive.color);
const roles = Object.keys(src.semantic.color);
const shadows = shadowTokens(src.shadow);
const q = (s) => JSON.stringify(s);

const out = [
  "// GENERATED — do not edit. Source: packages/tokens/src/tokens.json",
  "// Regenerate: node packages/tokens/scripts/generate-native.mjs",
  "// packages/testing/src/token-fidelity.test.ts fails if this drifts.",
  "",
  `export type PrimitiveName = ${primitives.map(q).join(" | ")};`,
  `export type RoleName = ${roles.map(q).join(" | ")};`,
  `export type ThemeName = "light" | "dark";`,
  "",
  "/** The ramps. Present so a chart or a generated asset can walk a scale;",
  "  * NOT for component styling — a component names a role. */",
  "export const primitive: Record<PrimitiveName, string> = {",
  ...primitives.map((n) => `  ${q(n)}: ${q(src.primitive.color[n].hex)},`),
  "};",
  "",
  "/** The OKLCH triple each primitive was derived from, kept beside the hex so",
  "  * the derivation is auditable on native too, and so a tool that needs to",
  "  * interpolate a ramp does it in the space the ramp was built in. */",
  "export const primitiveOklch: Record<PrimitiveName, [number, number, number]> = {",
  ...primitives.map((n) => `  ${q(n)}: [${src.primitive.color[n].oklch.join(", ")}],`),
  "};",
  "",
  "/** Semantic roles, resolved. This is what a native component reads. */",
  "export const color: Record<ThemeName, Record<RoleName, string>> = {",
  ...["light", "dark"].flatMap((theme) => [
    `  ${theme}: {`,
    ...roles.map((n) => `    ${q(n)}: ${q(resolveLiteral(src, src.semantic.color[n][theme]))},`),
    "  },",
  ]),
  "};",
  "",
  `export type ShadowName = ${shadows.length ? shadows.map(([n]) => q(n)).join(" | ") : "never"};`,
  "",
  "/**",
  " * Structurally React Native's own `BoxShadowValue`",
  " * (react-native@0.86.2, Libraries/StyleSheet/StyleSheetTypes.d.ts:343-350),",
  " * declared here rather than imported so @goproceed/tokens stays free of a",
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
      `spreadDistance: ${l.spreadDistance}, color: ${q(rgba(l.color))} }`
    ).join(", ");
    return `  ${q(n)}: [${layers}],`;
  }),
  "};",
  "",
];

// Numeric-ish scales that a native StyleSheet can consume directly. Strings are
// emitted verbatim: `clamp()` has no native equivalent, so a marketing size is
// present and typed but a native screen has no business reading one.
for (const block of SCALE_BLOCKS) {
  const entries = scale(src.primitive[block]);
  if (!entries.length) continue;
  out.push(`export const ${block} = {`);
  for (const [n, v] of entries) out.push(`  ${q(n)}: ${q(String(v))},`);
  out.push("} as const;", "");
}
out.push("export const component = {");
for (const [n, t] of Object.entries(src.component)) out.push(`  ${q(n)}: ${q(String(t.value))},`);
out.push("} as const;", "");

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tokens.generated.ts"), out.join("\n"));
console.log(`wrote ${join(outDir, "tokens.generated.ts")}`);
