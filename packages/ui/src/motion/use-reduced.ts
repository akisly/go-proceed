"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

type ReducedMotionState = {
  hydrated: boolean;
  preference: boolean | null;
};

/**
 * The server cannot read a media query. Keep the server and the first client
 * render on the same conservative branch, then honour the real preference
 * after hydration. Without this gate Motion can return `null` on the server
 * and `false` on the first client render, which swaps entire element trees and
 * causes a hydration mismatch.
 */
export function shouldReduce({ hydrated, preference }: ReducedMotionState): boolean {
  return !hydrated || preference !== false;
}

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
  const preference = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return shouldReduce({ hydrated, preference });
}
