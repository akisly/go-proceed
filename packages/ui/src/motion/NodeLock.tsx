"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { DURATION, EASE, STAGGER, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";

/**
 * A node on the evidence chain seating itself, and the verified stamp landing
 * on a receipt. `scale .96 -> 1` with opacity.
 *
 * From .96, never from 0. An element that grows from nothing was never there;
 * an element that arrives at .96 and settles was always going to be there and
 * has just become certain. For a product whose whole subject is a state
 * becoming durable, that difference is the point.
 *
 * `index` exists so a row of nodes locks in sequence behind the line that
 * drew them, at the standard 80ms step.
 *
 * The resting `animate` target mirrors the hidden state for the reason
 * `Reveal.tsx` gives: Motion reads `initial` once, so without it the element
 * mounted on the reduced snapshot `useReduced()` picks before hydration and
 * the .96 never applied. Instant, at opacity 0; a reduced reader's rest names
 * no transform.
 */
export function NodeLock({
  children, index = 0, className,
}: {
  children: ReactNode;
  index?: number | undefined;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 };
  return (
    <motion.div
      className={className}
      data-entrance=""
      initial={hidden}
      animate={{ ...hidden, transition: { duration: 0 } }}
      whileInView={
        reduced
          ? { opacity: 1, transition: { duration: REDUCED.duration, ease: REDUCED.ease } }
          : { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE.out, delay: index * STAGGER.default } }
      }
      viewport={{ once: true, amount: 0.6 }}
    >
      {children}
    </motion.div>
  );
}
