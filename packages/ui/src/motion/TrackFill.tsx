"use client";

import { motion } from "motion/react";
import { DURATION, EASE, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";

/**
 * A segment of a progress rail filling in because the READER moved, not because
 * the page scrolled.
 *
 * The sibling of `LineDraw` and deliberately not a variant of it. `LineDraw`
 * answers to scroll position; this answers to application state. One word with
 * two triggers would make every call site ambiguous about what advances it.
 *
 * `scaleX` from `origin-left`, so the line grows the way the reader reads. THE
 * ORIGIN IS SET HERE, not asked of the caller. It was documented here and set
 * at both call sites, which is a sentence written for code that does not exist
 * yet: the two existing callers happened to pass `origin-left` in `className`,
 * so it looked correct, and the next caller would have got a line filling
 * centre-out with nothing to say so. `origin-left` leads the class string, so a
 * caller that genuinely needs another origin still wins by writing one.
 *
 * REDUCED: the final state, applied with no transition. Not a faster fill — a
 * line that whips across in 120ms is still a moving line.
 */
export function TrackFill({
  filled, className,
}: {
  /** True when this segment sits behind the active step. */
  filled: boolean;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  return (
    <motion.span
      aria-hidden="true"
      className={className ? `origin-left ${className}` : "origin-left"}
      initial={false}
      animate={{ scaleX: filled ? 1 : 0 }}
      transition={
        reduced
          ? { duration: 0, ease: REDUCED.ease }
          : { duration: DURATION.base, ease: EASE.enter }
      }
    />
  );
}
