/**
 * Shared by every generator. Not a convenience: the same arithmetic showing up
 * twice is the exact drift class packages/tokens exists to end — the CSS custom
 * property and the React Native BoxShadowValue carry the *same* composed colour
 * string, and a semantic role resolves to the same primitive on both platforms
 * or the platforms disagree silently.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rgba } from "./color.mjs";

export { rgba };

export const repoRoot = join(import.meta.dirname, "..", "..", "..", "..");

export function readSource() {
  return JSON.parse(readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));
}

/**
 * Named shadow tokens. An entry counts as a token when it is an object
 * carrying a `layers` array; anything else is block-level metadata and is
 * skipped. Every place that has to decide "is this a token?" uses this one
 * function, so the generators, the ruling guard and the fidelity test cannot
 * disagree about what needs a ruling.
 */
export function shadowTokens(block) {
  if (!block) return [];
  return Object.entries(block).filter(
    ([, v]) => v && typeof v === "object" && Array.isArray(v.layers));
}

/** One CSS box-shadow layer per source layer, comma-joined. CSS box-shadow and
 * React Native's boxShadow are the same four numbers in the same order, so
 * nothing is converted — only composed. */
export function shadowValue(token) {
  return token.layers
    .map((l) => `${l.offsetX}px ${l.offsetY}px ${l.blurRadius}px ${l.spreadDistance}px ${rgba(l.color)}`)
    .join(", ");
}

/**
 * A semantic entry names a primitive, either as a bare string (`"neutral-25"`)
 * or as `{ ref, alpha }` when the role needs the primitive at partial opacity.
 * Returns `{ ref, alpha }` in both cases so callers have one shape.
 */
export function semanticRef(entry) {
  if (typeof entry === "string") return { ref: entry, alpha: 1 };
  return { ref: entry.ref, alpha: entry.alpha ?? 1 };
}

/** Resolve a semantic entry to a literal colour string for a platform with no
 * cascade (React Native), or to a `var()` reference for one that has (CSS). */
export function resolveLiteral(src, entry) {
  const { ref, alpha } = semanticRef(entry);
  const prim = src.primitive.color[ref];
  if (!prim) throw new Error(`semantic token references unknown primitive "${ref}"`);
  return alpha === 1 ? prim.hex : rgba({ hex: prim.hex, alpha });
}

/** Scale blocks are `{ name: { value, ruling } }`. Returns [name, value] pairs. */
export function scale(block) {
  return Object.entries(block ?? {}).map(([name, t]) => [name, t.value]);
}

/** Every scale block in `primitive` except `color`, which has its own shape. */
export const SCALE_BLOCKS = [
  "font", "text", "fontWeight", "leading", "tracking", "radius", "space",
  "breakpoint", "container", "duration", "ease", "stagger", "spring", "blur",
];

export const BANNER = (script, target) => [
  `/* GENERATED — do not edit. Source: packages/tokens/src/tokens.json`,
  `   Regenerate: node packages/tokens/scripts/${script}`,
  `   packages/testing/src/token-fidelity.test.ts fails if ${target} drifts. */`,
];
