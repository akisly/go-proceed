"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DURATION, EASE, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";

/**
 * Switching one panel for another: the role dossier, the product-tour
 * screenshot, a tab body.
 *
 * `ease.soft` — the symmetric curve — and it is the only place it is used. A
 * cross-fade has no direction: nothing is entering from anywhere and nothing
 * is leaving towards anywhere, so an ease-out (which says "arriving") would be
 * telling the reader something untrue about the change.
 *
 * `mode="wait"` so the outgoing panel finishes before the incoming one starts.
 * Two panels of different heights overlapping mid-swap makes the page jump,
 * and a jumping page during a deliberate tab click is worse than 240ms of
 * waiting.
 *
 * The 12px slide is small on purpose: it says "this replaced that" without
 * implying a carousel the reader could swipe.
 */
export function CrossFade({
  activeKey, children, className,
}: {
  /** Changing this swaps the panel. Use the tab id, not an index. */
  activeKey: string;
  children: ReactNode;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={activeKey}
        className={className}
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: 12 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, x: -12 }}
        transition={
          reduced
            ? { duration: REDUCED.duration, ease: REDUCED.ease }
            : { duration: DURATION.base, ease: EASE.soft }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
