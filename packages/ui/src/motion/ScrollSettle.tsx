"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useReduced } from "./use-reduced";

/**
 * The product frame settling into the page — 21st.dev's «Container Scroll».
 *
 * The frame enters tilted back (`rotateX 18deg`, `scale .94`) and flattens as
 * the reader scrolls it into the fold. It is scroll-LINKED — it answers the
 * scroll position, not a timer — which makes it one of the page's two
 * permitted scroll-linked elements (`02-building-ui.md` §4.3 rule 9; the
 * other is `ScrollTint`). A page may not use both in one fold.
 *
 * Three states the caller can rely on:
 *   - full motion: perspective, tilt, flattens over `["start end", "start 35%"]`
 *     of the wrapper's entry — the prototype's measured range;
 *   - below the `md` breakpoint (a media query, read once): flat, no
 *     perspective — a tilted frame on a phone shows a sliver of product;
 *   - reduced motion: flat from the first paint, and `data-settled="true"` at
 *     once, so anything keyed to the settle (the beam) knows not to wait.
 *
 * `data-settled` flips to "true" the first time progress reaches 1 and never
 * flips back: the beam utility (`base.css`) keys its two passes off it, and a
 * reader scrolling up should not restart an entrance.
 */
export function ScrollSettle({
  children, className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  const narrow = useNarrow();
  if (reduced || narrow) {
    return (
      <div className={className} data-settled="true">
        {children}
      </div>
    );
  }
  return <AnimatedSettle className={className}>{children}</AnimatedSettle>;
}

function AnimatedSettle({ children, className }: { children: ReactNode; className?: string | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.35"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  useMotionValueEvent(scrollYProgress, "change", (v) => { if (v >= 1) setSettled(true); });

  return (
    <div ref={ref} className={className} data-settled={settled ? "true" : "false"} style={{ perspective: 1500 }}>
      <motion.div style={{ rotateX, scale, transformOrigin: "50% 0%", transformStyle: "preserve-3d" }}>
        {children}
      </motion.div>
    </div>
  );
}

/** True below the `md` breakpoint. Read from the token so the number is typed nowhere here. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const md = getComputedStyle(document.documentElement).getPropertyValue("--breakpoint-md").trim() || "768px";
    const query = window.matchMedia(`(max-width: calc(${md} - 1px))`);
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}
