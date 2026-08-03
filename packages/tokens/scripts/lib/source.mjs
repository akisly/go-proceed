// Shared by both generators. Not a convenience: since the shadow token became
// a `boxShadow` value, the CSS custom property and the React Native
// BoxShadowValue carry the *same* colour string, so a second copy of this
// arithmetic would be a place for the two outputs to disagree silently — the
// exact drift class packages/tokens exists to end.

/** `{ hex: "#151719", alpha: 0.07 }` -> `rgba(21, 23, 25, 0.07)`. */
export function rgba({ hex, alpha }) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Named shadow tokens in the `shadow` block. An entry counts as a token when
 * it is an object carrying a `layers` array; anything else is block-level
 * metadata and is skipped. The block carries no metadata today — the two
 * fields that used to sit there (`nativeBlurDivisor` and its note) were
 * removed with the move to `boxShadow` — but the block is a plain JSON object
 * that may carry some again, and this is the same test
 * packages/testing/src/token-fidelity.test.ts uses to decide what needs a
 * ruling, so all three places agree on what a token is.
 */
export function shadowTokens(block) {
  if (!block) return [];
  return Object.entries(block).filter(
    ([, v]) => v && typeof v === "object" && Array.isArray(v.layers));
}
