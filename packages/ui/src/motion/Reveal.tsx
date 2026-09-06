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
 *
 * `size` exists because the prototype enters copy at 900ms and the hero at
 * 1200ms; the default stays 400ms so every caller outside the landing is
 * unchanged.
 */
export function Reveal({
  children, delay = 0, y = 16, x = 0, size = "slow", className,
}: {
  children: ReactNode;
  /** Seconds. Prefer <Stagger> over hand-delaying siblings. */
  delay?: number | undefined;
  /** Rise distance. 0 for an element that must not move (a figure, a table row). */
  y?: number | undefined;
  /** Horizontal entry: −20 slides in from the left, 20 from the right (the compare cards, prototype l.1166). */
  x?: number | undefined;
  /** `slow` 400ms (the system's reveal); `stately` 900ms and `grand` 1200ms are the prototype's two entrance families (spec 2026-09-06 §6). */
  size?: "slow" | "stately" | "grand" | undefined;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, x, y }}
      whileInView={reduced ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={
        reduced
          ? { duration: REDUCED.duration, ease: REDUCED.ease, delay: 0 }
          : { duration: DURATION[size], ease: EASE.enter, delay }
      }
    >
      {children}
    </motion.div>
  );
}
