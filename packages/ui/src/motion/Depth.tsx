"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useReduced } from "./use-reduced";
import { useBelowBreakpoint } from "./use-gates";

/** Pixels of travel at depth ±1 — the prototype's `d*80` (index.html l.1116). */
const RANGE = 80;

/**
 * A layer that moves against the scroll — the prototype's `data-depth`: over
 * the traverse of the nearest `<section>` the layer goes from `depth·80px` to
 * `depth·−80px`, so a negative depth (the receipt, −0.3) drifts up as the
 * reader scrolls down and a positive one (the pills, .35/.25) lags behind.
 *
 * Scroll-linked, so gated: below `md`, under reduced motion, and until the
 * gates have resolved after hydration the MotionValue is replaced by `0`. The
 * tree never changes — one `motion.div` in every state — so hydration cannot
 * mismatch and the layer cannot jump between two DOM shapes.
 *
 * The section is found through a callback ref so `sectionRef.current` is set
 * during commit, before Motion's own effect reads it.
 */
export function Depth({
  depth, children, className,
}: {
  /** −1 … 1. Negative rises with the scroll, positive lags. */
  depth: number;
  children: ReactNode;
  className?: string | undefined;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const setRefs = (el: HTMLDivElement | null) => { sectionRef.current = el?.closest("section") ?? null; };
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [depth * RANGE, -depth * RANGE]);
  const reduced = useReduced();
  const narrow = useBelowBreakpoint("md");
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const flat = reduced || narrow || !ready;
  return (
    <motion.div
      ref={setRefs}
      data-depth={depth}
      className={flat ? className : [className, "will-change-transform"].filter(Boolean).join(" ")}
      style={{ y: flat ? 0 : y }}
    >
      {children}
    </motion.div>
  );
}
