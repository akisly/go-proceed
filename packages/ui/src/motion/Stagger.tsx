"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { DURATION, EASE, STAGGER, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";
import { useResolvedReduce } from "./use-gates";

const container = (step: number, delay: number) => ({
  still: {},
  hidden: {},
  shown: { transition: { staggerChildren: step, delayChildren: 0.04 + delay } },
  enter: { transition: { staggerChildren: step, delayChildren: 0.04 + delay } },
});

const child = (reduced: boolean, y: number, from: "rise" | "scale", size: "slow" | "stately" | "grand") => ({
  still: { opacity: 0 },
  hidden: { ...(from === "scale" ? { opacity: 0, scale: 0 } : { opacity: 0, y }), transition: { duration: 0 } },
  shown: reduced
    ? { opacity: 1, transition: { duration: REDUCED.duration, ease: REDUCED.ease } }
    : from === "scale"
      ? { opacity: 1, scale: 1, transition: { duration: DURATION.deliberate, ease: EASE.emphatic } }
      : { opacity: 1, y: 0, transition: { duration: DURATION[size], ease: EASE.enter } },
  // `on="load"`: the same arrival as explicit keyframes, so the start is
  // stated rather than read off the reduced snapshot Motion took at mount.
  enter: reduced
    ? { opacity: [0, 1], transition: { duration: REDUCED.duration, ease: REDUCED.ease } }
    : from === "scale"
      ? { opacity: [0, 1], scale: [0, 1], transition: { duration: DURATION.deliberate, ease: EASE.emphatic } }
      : { opacity: [0, 1], y: [y, 0], transition: { duration: DURATION[size], ease: EASE.enter } },
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
 *
 * THREE LABELS, NOT TWO. `useReduced()` is true on the server and on the
 * first client render, then flips after hydration (use-reduced.ts). Motion
 * reads `initial` once, at mount, so with a single `hidden` label whose
 * values depended on the flag every item mounted on the reduced snapshot
 * (`opacity: 0`, no transform) and stayed there: `shown` then animated
 * `scale` from an unset 1 to 1 and the pop this file promises never happened
 * — measured on the built landing on 2026-09-06, every compare check at
 * `transform: none` through its whole entrance. So the reduced hidden state is
 * its own label, `still`, and the parent RESTS on `still` or `hidden` through
 * `animate`, the target beneath `whileInView` (Motion 12.43,
 * `variantPriorityOrder`). When the gate opens the parent's resting label
 * changes and Motion re-applies `hidden` to every child — instantly, at
 * opacity 0, so nothing is seen — and `shown` has a real transform to leave
 * from. A reduced reader rests on `still`, which never names a transform.
 *
 * `on="load"` — the prototype's timeline (the hero's pills at .9 s, the
 * board's cards at .7 s): the parent rests until the reduced-motion
 * preference has RESOLVED (`useResolvedReduce`), then animates to `enter`
 * instead of waiting for a quarter of itself to be in view. See `Reveal`.
 */
export function Stagger({
  children, step = "default", delay = 0, on = "view", className,
}: {
  children: ReactNode;
  step?: keyof typeof STAGGER | undefined;
  /** Seconds before the first child — the compare checks wait .35s after the card lands (prototype l.1168). */
  delay?: number | undefined;
  /** `view` (default): when a quarter of it is in view. `load`: on a timer from the moment the page is ready. */
  on?: "view" | "load" | undefined;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  const resolved = useResolvedReduce();
  const rest = reduced ? "still" : "hidden";
  if (on === "load") {
    return (
      <motion.div className={className} variants={container(STAGGER[step], delay)} initial={rest} animate={resolved === null ? rest : "enter"}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      className={className}
      variants={container(STAGGER[step], delay)}
      initial={rest}
      animate={rest}
      whileInView="shown"
      viewport={{ once: true, amount: 0.25 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * One child of a <Stagger>. Wrap each sibling; it takes its timing from the parent.
 *
 * `size` mirrors `Reveal`'s — the prototype enters its lists at .9–1.2 s (spec §6).
 */
export function StaggerItem({
  children, y = 16, from = "rise", size = "slow", className,
}: {
  children: ReactNode;
  y?: number | undefined;
  /** `scale` — the check mark that pops from nothing (prototype `.cmp-card.now li i`, l.617), `ease.emphatic` over `duration.deliberate`. */
  from?: "rise" | "scale" | undefined;
  size?: "slow" | "stately" | "grand" | undefined;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  return (
    <motion.div className={className} data-entrance="" variants={child(reduced, y, from, size)}>
      {children}
    </motion.div>
  );
}
