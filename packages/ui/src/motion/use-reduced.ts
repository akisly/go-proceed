"use client";

import { useReducedMotion } from "motion/react";

/**
 * `useReducedMotion()` returns `null` until Motion has read the media query,
 * then `true` or `false`. Treating `null` as "no preference" means the first
 * frame after hydration animates for a user who asked for no animation — a
 * flash of exactly the motion they opted out of.
 *
 * So `null` reads as REDUCED here. The cost of being wrong in this direction
 * is one static frame before a reveal; the cost of being wrong in the other
 * direction is the thing the preference exists to prevent.
 */
export function useReduced(): boolean {
  return useReducedMotion() !== false;
}
