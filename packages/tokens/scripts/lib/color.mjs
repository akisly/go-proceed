/**
 * Colour maths for the token source. Deliberately dependency-free: this file
 * is the reason the palette can be *regenerated* rather than hand-corrected,
 * and a ramp whose derivation depends on an npm package is a ramp nobody can
 * reproduce in three years.
 *
 * Three jobs:
 *   1. OKLCH -> sRGB, so a ramp can be specified as even lightness steps and
 *      the hex fall out of it. `packages/testing/src/palette-derivation.test.ts`
 *      re-runs this against every token's declared `oklch` and fails if the
 *      committed hex is not what the maths produces. That is what stops a hex
 *      being nudged by eye and the OKLCH triple being left to lie about it.
 *   2. Gamut clamping. Above roughly L 0.9 the sRGB gamut collapses fast at
 *      green-yellow hues, so a naive ramp emits two "different" steps that
 *      round to the same clipped colour. `maxChroma` binary-searches the
 *      largest in-gamut chroma for a given L/H, and `clampChroma` uses it, so
 *      a ramp step is never silently identical to its neighbour.
 *   3. WCAG 2.1 relative luminance and contrast, so every semantic pairing is
 *      asserted rather than assumed.
 */

const clamp01 = (n) => Math.max(0, Math.min(1, n));

export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
export function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** OKLCH -> linear-light sRGB. May return components outside [0,1]. */
export function oklchToLinearRgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** True when the OKLCH triple lands inside sRGB without clipping. */
export function inGamut(L, C, H, epsilon = 1e-4) {
  return oklchToLinearRgb(L, C, H).every((v) => v >= -epsilon && v <= 1 + epsilon);
}

/**
 * Largest chroma that stays inside sRGB at this lightness and hue, to 1e-4.
 * Binary search rather than a closed form: the gamut boundary in OKLab has no
 * cheap analytic inverse, and 24 iterations of a bisection is free at build
 * time.
 */
export function maxChroma(L, H) {
  let lo = 0, hi = 0.45;
  if (inGamut(L, hi, H)) return hi;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(L, mid, H)) lo = mid; else hi = mid;
  }
  return lo;
}

/** Requested chroma, reduced to the gamut boundary when it would clip. */
export function clampChroma(L, C, H) {
  return Math.min(C, maxChroma(L, H));
}

export function oklchToHex(L, C, H) {
  const rgb = oklchToLinearRgb(L, C, H).map((v) => Math.round(clamp01(linearToSrgb(clamp01(v))) * 255));
  return '#' + rgb.map((v) => v.toString(16).toUpperCase().padStart(2, '0')).join('');
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => srgbToLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, rounded to two decimals so assertions are stable. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** `{ hex: "#151719", alpha: 0.07 }` -> `rgba(21, 23, 25, 0.07)`. */
export function rgba({ hex, alpha }) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** sRGB hex -> OKLCH. Used by the derivation test and by tooling, not by the generators. */
export function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => srgbToLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}
