// GENERATED — do not edit. Source: packages/tokens/src/tokens.json
// Regenerate: node packages/tokens/scripts/generate-native.mjs
// packages/testing/src/token-fidelity.test.ts fails if this drifts.

export type ColorName = "ink-950" | "ink-800" | "paper" | "white" | "signal-500" | "slate-600" | "signal-700" | "amber-500" | "red-500" | "muted" | "line" | "blue-500";

export const colorRaw: Record<ColorName, { hex: string; alpha: number }> = {
  "ink-950": { hex: "#171717", alpha: 1 },
  "ink-800": { hex: "#242424", alpha: 1 },
  "paper": { hex: "#FBFBFB", alpha: 1 },
  "white": { hex: "#FFFFFF", alpha: 1 },
  "signal-500": { hex: "#C6FF34", alpha: 1 },
  "slate-600": { hex: "#484C5E", alpha: 1 },
  "signal-700": { hex: "#667F12", alpha: 1 },
  "amber-500": { hex: "#F2B84B", alpha: 1 },
  "red-500": { hex: "#E45C55", alpha: 1 },
  "muted": { hex: "#666979", alpha: 1 },
  "line": { hex: "#D9DBD5", alpha: 1 },
  "blue-500": { hex: "#3756a1", alpha: 1 },
};

export const color: Record<ColorName, string> = {
  "ink-950": "#171717",
  "ink-800": "#242424",
  "paper": "#FBFBFB",
  "white": "#FFFFFF",
  "signal-500": "#C6FF34",
  "slate-600": "#484C5E",
  "signal-700": "#667F12",
  "amber-500": "#F2B84B",
  "red-500": "#E45C55",
  "muted": "#666979",
  "line": "#D9DBD5",
  "blue-500": "#3756a1",
};

export type ShadowName = "shadow";

/**
 * Structurally React Native's own `BoxShadowValue`
 * (react-native@0.86.2, Libraries/StyleSheet/StyleSheetTypes.d.ts:343-350),
 * declared here rather than imported so @aktflow/tokens stays free of a
 * react-native dependency and keeps working in the web build. RN's version
 * makes `color`, `blurRadius` and `spreadDistance` optional and allows
 * strings for the numbers, so this narrower shape is assignable to it, and
 * `BoxShadowValue[]` is assignable to `ViewStyle["boxShadow"]`
 * (`ReadonlyArray<BoxShadowValue> | string`, same file at :516).
 */
export type BoxShadowValue = {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadDistance: number;
  color: string;
};

/** Pass straight to a View's `boxShadow` style prop — CSS box-shadow
  * semantics on both iOS and Android, so nothing here is approximated per
  * platform. */
export const shadow: Record<ShadowName, BoxShadowValue[]> = {
  "shadow": [{ offsetX: 0, offsetY: 8, blurRadius: 30, spreadDistance: 0, color: "rgba(21, 23, 25, 0.07)" }],
};
