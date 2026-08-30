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
 * `scaleX` from `origin-left`, so the line grows the way the reader reads.
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
      className={className}
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
