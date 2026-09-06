"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { DURATION, EASE, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";
import { useResolvedReduce } from "./use-gates";

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
 *
 * THE RESTING `animate` TARGET. `useReduced()` is true on the server and on
 * the first client render, then flips to the real preference after hydration
 * (use-reduced.ts). Motion reads `initial` once, at mount, so a primitive that
 * keeps one element across that flip and only swaps its `initial` object
 * stays on the reduced snapshot for ever: `whileInView` then animates `x`
 * and `y` from an unset 0 to 0, and the slide this file documents never
 * happens — measured on the built landing on 2026-09-06, every card at
 * `transform: none` through its whole entrance. `animate` is the target an
 * element rests at beneath `whileInView` (Motion 12.43, `variantPriorityOrder`;
 * a key that newly appears in it is animated), so mirroring the hidden state
 * there re-applies the offset the instant the gate opens — instantly and
 * invisibly, at opacity 0. A reduced reader's `animate` never names a
 * transform, so the contract in `tokens.ts` (`REDUCED`) holds to the letter.
 * The transitions live inside the targets because the resting one must be
 * instant and the entrance must not.
 *
 * `on="load"` is the prototype's hero timeline (index.html l.1109–1113: the
 * frame at .35 s, the receipt at .7 s): an entrance that runs from the
 * moment the page is ready, not from the moment a third of it is in view —
 * the product frame sits below the fold at 1440×900 and under `on="view"`
 * it never showed until the reader scrolled, and then rose while
 * `ScrollSettle` was already flattening it. It rests hidden until the
 * reduced-motion preference has RESOLVED (`useResolvedReduce`, never the
 * conservative `useReduced()`), then enters as explicit keyframes
 * (`opacity: [0, 1]`, `y: [y, 0]`) so the start is stated, not read off the
 * snapshot Motion took at mount. A reduced reader gets the 120 ms fade.
 */
export function Reveal({
  children, delay = 0, y = 16, x = 0, size = "slow", on = "view", className,
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
  /** `view` (default): when a third of it is in view. `load`: on a timer from the moment the page is ready — the hero's frame and receipt. */
  on?: "view" | "load" | undefined;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  const resolved = useResolvedReduce();
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, x, y };
  if (on === "load") {
    const enter =
      resolved === null
        ? { ...hidden, transition: { duration: 0 } }
        : resolved
          ? { opacity: 1, transition: { duration: REDUCED.duration, ease: REDUCED.ease } }
          : { opacity: [0, 1], ...(x ? { x: [x, 0] } : {}), ...(y ? { y: [y, 0] } : {}), transition: { duration: DURATION[size], ease: EASE.enter, delay } };
    return (
      <motion.div className={className} initial={hidden} animate={enter}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      className={className}
      initial={hidden}
      animate={{ ...hidden, transition: { duration: 0 } }}
      whileInView={
        reduced
          ? { opacity: 1, transition: { duration: REDUCED.duration, ease: REDUCED.ease, delay: 0 } }
          : { opacity: 1, x: 0, y: 0, transition: { duration: DURATION[size], ease: EASE.enter, delay } }
      }
      viewport={{ once: true, amount: 0.35 }}
    >
      {children}
    </motion.div>
  );
}
