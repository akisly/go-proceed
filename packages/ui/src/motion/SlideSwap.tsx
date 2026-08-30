"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DURATION, EASE, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";

/** How far a panel travels. Small on purpose — see the header. */
const TRAVEL = 24;

/**
 * Swapping one panel for the next in a sequence the reader is walking through.
 *
 * NOT A VARIANT OF `CrossFade`. That one is symmetric on purpose — its header
 * says a cross-fade has no direction, so an ease-out would tell the reader
 * something untrue. Here the opposite is true: the reader pressed «next», the
 * story HAS a direction, and an arrival curve is the honest one. Two words,
 * because two different things are being said.
 *
 * 24px, not 200: enough that the eye reads «the next one», not so much that it
 * implies a carousel the reader could swipe.
 *
 * `mode="wait"` for the same reason CrossFade uses it — two panels of different
 * heights overlapping makes the page jump under a deliberate press.
 *
 * REDUCED: a cross-fade. The direction is DROPPED, not shortened; a 24px slide
 * finished in 120ms is still a slide, and the vestibular system does not care
 * how quickly the thing moved.
 */
export function SlideSwap({
  activeKey, direction, children, className,
}: {
  /** Changing this swaps the panel. Use the chapter id, never an index. */
  activeKey: string;
  /** 1 when the story moves forward, -1 when it moves back. */
  direction: 1 | -1;
  children: ReactNode;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={activeKey}
        custom={direction}
        className={className}
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: direction * TRAVEL }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, x: direction * -TRAVEL }}
        transition={
          reduced
            ? { duration: REDUCED.duration, ease: REDUCED.ease }
            : { duration: DURATION.base, ease: EASE.enter }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
