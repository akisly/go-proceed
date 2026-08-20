"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { DURATION, EASE, STAGGER, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";

const container = (step: number) => ({
  hidden: {},
  shown: { transition: { staggerChildren: step, delayChildren: 0.04 } },
});

const child = (reduced: boolean, y: number) => ({
  hidden: reduced ? { opacity: 0 } : { opacity: 0, y },
  shown: reduced
    ? { opacity: 1, transition: { duration: REDUCED.duration, ease: REDUCED.ease } }
    : { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE.enter } },
});

/**
 * A list or grid that arrives in sequence rather than as a block.
 *
 * The step is a token, not a prop-with-a-default-number: `default` (80ms) for
 * siblings in a list, `loose` (120ms) where each child is itself a composition,
 * `tight` (40ms) only for per-word text — and that last case has its own
 * primitive, because it also carries a blur.
 *
 * Under reduced motion the stagger survives and the transform does not. A
 * sequence is information — it says these things are ordered — and removing it
 * would remove meaning, not decoration. Removing the 16px rise removes
 * decoration.
 */
export function Stagger({
  children, step = "default", className,
}: {
  children: ReactNode;
  step?: keyof typeof STAGGER | undefined;
  className?: string | undefined;
}) {
  return (
    <motion.div
      className={className}
      variants={container(STAGGER[step])}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.25 }}
    >
      {children}
    </motion.div>
  );
}

/** One child of a <Stagger>. Wrap each sibling; it takes its timing from the parent. */
export function StaggerItem({
  children, y = 16, className,
}: {
  children: ReactNode;
  y?: number | undefined;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  return (
    <motion.div className={className} variants={child(reduced, y)}>
      {children}
    </motion.div>
  );
}
