"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { DURATION, EASE, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";

/**
 * The default section reveal: opacity 0->1 with a 16px rise.
 *
 * 400ms on ease-out-quart. Both numbers are measured, not chosen — Grovia
 * reveals at 400ms and Linear's `staggerIn` runs 400ms on
 * cubic-bezier(.165,.84,.44,1). Two independent sites converging on the same
 * duration is the strongest evidence a motion value can have.
 *
 * `once` is not optional. A section that re-animates on the way back up is a
 * defect: the reader has already seen it, and re-playing it says the page does
 * not know that.
 *
 * `amount: 0.35` fires when about a third of the element is in view, which
 * keeps a tall block from waiting until its bottom edge arrives.
 */
export function Reveal({
  children, delay = 0, y = 16, className,
}: {
  children: ReactNode;
  /** Seconds. Prefer <Stagger> over hand-delaying siblings. */
  delay?: number | undefined;
  /** Rise distance. 0 for an element that must not move (a figure, a table row). */
  y?: number | undefined;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={
        reduced
          ? { duration: REDUCED.duration, ease: REDUCED.ease, delay: 0 }
          : { duration: DURATION.slow, ease: EASE.enter, delay }
      }
    >
      {children}
    </motion.div>
  );
}
