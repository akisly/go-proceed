/**
 * The bridge between the token source and Motion for React.
 *
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------
 * CSS and Motion disagree about how to spell the same value. CSS says
 * `160ms` and `cubic-bezier(0.25, 0.46, 0.45, 0.94)`; Motion wants `0.16` and
 * `[0.25, 0.46, 0.45, 0.94]`. Left to itself, that difference becomes a second
 * place the numbers live — someone types `0.2` into a component because it is
 * close enough, and the hover on a button in JSX no longer matches the hover
 * on a button in CSS.
 *
 * So nothing here is a literal. Every value is PARSED from
 * `packages/tokens/src/tokens.json` at module load, and
 * `packages/testing/src/motion-contract.test.ts` re-parses the source and
 * fails if a parsed value stops matching. Changing a duration is one edit in
 * one file and both spellings follow.
 */
import { duration, ease, stagger, spring, blur } from "@goproceed/tokens";

/** `"160ms"` -> `0.16`; `"35s"` -> `35`. Motion counts in seconds. */
export function seconds(value: string): number {
  const ms = /^([\d.]+)ms$/.exec(value);
  if (ms?.[1]) return Number(ms[1]) / 1000;
  const s = /^([\d.]+)s$/.exec(value);
  if (s?.[1]) return Number(s[1]);
  throw new Error(`not a CSS time: ${value}`);
}

/** `"cubic-bezier(a, b, c, d)"` -> `[a, b, c, d]`, which is what Motion takes. */
export function curve(value: string): [number, number, number, number] {
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(value);
  const parts = m?.[1]?.split(",").map((n) => Number(n.trim()));
  if (!parts || parts.length !== 4 || parts.some(Number.isNaN)) {
    throw new Error(`not a cubic-bezier: ${value}`);
  }
  return [parts[0] as number, parts[1] as number, parts[2] as number, parts[3] as number];
}

/** `"stiffness 100, damping 20, mass 1"` -> a Motion spring transition. */
export function springOf(value: string): {
  type: "spring"; stiffness: number; damping: number; mass: number;
} {
  const read = (key: string): number => {
    const m = new RegExp(`${key}\\s+([\\d.]+)`).exec(value);
    if (!m?.[1]) throw new Error(`spring token is missing ${key}: ${value}`);
    return Number(m[1]);
  };
  return { type: "spring", stiffness: read("stiffness"), damping: read("damping"), mass: read("mass") };
}

/** `"6px"` -> `6`. */
export function px(value: string): number {
  const m = /^([\d.]+)px$/.exec(value);
  if (!m?.[1]) throw new Error(`not a px length: ${value}`);
  return Number(m[1]);
}

export const DURATION = {
  instant: seconds(duration.instant),
  fast: seconds(duration.fast),
  base: seconds(duration.base),
  slow: seconds(duration.slow),
  deliberate: seconds(duration.deliberate),
  marquee: seconds(duration.marquee),
} as const;

export const EASE = {
  out: curve(ease.out),
  enter: curve(ease.enter),
  emphatic: curve(ease.emphatic),
  soft: curve(ease.soft),
  overshoot: curve(ease.overshoot),
} as const;

export const STAGGER = {
  tight: seconds(stagger.tight),
  default: seconds(stagger.default),
  loose: seconds(stagger.loose),
} as const;

export const SPRING = {
  reveal: springOf(spring.reveal),
  press: springOf(spring.press),
} as const;

export const BLUR = {
  chrome: px(blur.chrome),
  reveal: px(blur.reveal),
} as const;

/**
 * The reduced-motion contract, in one place.
 *
 * `packages/ui/src/base.css` states it for CSS: opacity only, at or under
 * 120ms, no transform, no blur, no scroll-linking, marquee frozen, counters at
 * their final value. The rule is NOT "run the same animation faster" — a
 * transform that completes in 10ms is still a transform, and vestibular
 * triggers do not care how quickly the thing moved.
 *
 * Every primitive in this package branches on `useReduced()` and returns a
 * different animation, not a shorter one.
 */
export const REDUCED = {
  duration: 0.12,
  ease: "linear",
} as const;
