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
 * ONE DOM SHAPE, ALWAYS. Earlier this component returned a different element
 * tree for the reduced/narrow branch than for the animated one, which meant
 * the tree Motion's conservative pre-hydration `useReduced()` picked on the
 * server did not match the tree an ordinary full-motion visitor got on their
 * first client render — React remounted the subtree the instant hydration
 * settled, and `data-settled` visibly flipped `"true"` → `"false"` before
 * animating back to `"true"`. There is now exactly one returned shape —
 * `<div data-settled><motion.div>{children}</motion.div></div>` — and every
 * hook (`useScroll`, `useTransform`, `useMotionValueEvent`) runs
 * unconditionally on every render.
 *
 * `data-settled` CONTRACT:
 *   - `"false"` on the server render and on the very first client paint —
 *     always, regardless of the visitor's actual preference or viewport.
 *   - LATCHED true: the wrapper reads from one `useState(false)` that is only
 *     ever set to `true`, never back — a reader scrolling back up, a viewport
 *     that widens past `md`, or an OS `prefers-reduced-motion` toggle mid-
 *     session must not un-settle a frame that already settled. It becomes
 *     `true` on the first of:
 *       (a) the RESOLVED OS `prefers-reduced-motion: reduce` preference —
 *           read by this component's own `matchMedia` effect
 *           (`useResolvedReduce`), not through `useReduced()`'s conservative
 *           `!hydrated || preference !== false` default, which is `true`
 *           before hydration for every visitor and would make `data-settled`
 *           lie about visitors who did not ask for reduced motion;
 *       (b) the viewport is narrow (`useNarrow()` — a live media-query read
 *           below the `md` breakpoint);
 *       (c) scroll progress into the wrapper reached 1 (the existing
 *           `useMotionValueEvent` watch on `scrollYProgress`).
 *     (a) and (b) are still live, re-derived booleans in their own right (a
 *     later `matchMedia` "change" event can flip either back to `false`), but
 *     a dedicated effect latches them into the same one-way state as (c) the
 *     moment either turns `true`, so `data-settled` itself never un-derives.
 *
 * The TRANSFORM is a separate decision from `data-settled`, and deliberately
 * uses `useReduced()` (not the resolved-preference effect above) because
 * conservative-until-hydrated is the right call for what actually renders:
 * animating for a visitor who asked for no motion, even for one frame, is
 * the flash the preference exists to prevent. When `useReduced()` or
 * `useNarrow()` is true the `motion.div` gets the constant flat pose
 * (`rotateX: 0, scale: 1`); otherwise it gets the two `useTransform`
 * MotionValues driven by scroll. Motion v12 supports switching a style
 * value between a plain number and a MotionValue on the same element.
 */
export function ScrollSettle({
  children, className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReduced();
  const narrow = useNarrow();
  const resolvedReduce = useResolvedReduce();
  const [settled, setSettled] = useState(false);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.35"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (v >= 1) setSettled(true);
  });

  // Latch (a) and (b) into the same one-way state as (c). `narrow` and
  // `resolvedReduce` are themselves live — a viewport can widen back past
  // `md`, a reduced-motion toggle can flip off — but once either has been
  // true, the frame is settled for good.
  useEffect(() => {
    if (narrow || resolvedReduce === true) setSettled(true);
  }, [narrow, resolvedReduce]);

  const flat = reduced || narrow;

  return (
    <div
      ref={ref}
      className={className}
      data-settled={settled ? "true" : "false"}
      style={{ perspective: 1500 }}
    >
      <motion.div
        style={{
          rotateX: flat ? 0 : rotateX,
          scale: flat ? 1 : scale,
          transformOrigin: "50% 0%",
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * The RESOLVED `prefers-reduced-motion: reduce` preference, read directly —
 * not through `useReduced()`, whose pre-hydration default (`true`) exists to
 * pick the same branch the server picked, not to answer "does this visitor
 * actually prefer reduced motion". `null` until the effect runs (server and
 * first client paint), then the real answer, live-updated on `change`.
 */
function useResolvedReduce(): boolean | null {
  const [resolved, setResolved] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setResolved(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return resolved;
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
