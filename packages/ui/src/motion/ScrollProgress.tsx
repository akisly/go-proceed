"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { useReduced } from "./use-reduced";

/** `useScroll`'s own `offset` option type — Motion accepts px in offsets, but the public type alias is not exported. `offset` is optional on the options object, so the plain indexed access is `... | undefined`; the outer `NonNullable` strips that back off. Same alias pattern as `ScrollStack.tsx`. */
type ScrollOffset = NonNullable<NonNullable<Parameters<typeof useScroll>[0]>["offset"]>;

/**
 * A progress number driven by the scroll — the sibling of `InViewProgress`,
 * which is driven by a timer once in view. Deliberately a separate word: one
 * word with two triggers would make every call site ambiguous about what
 * advances it (the 2026-08-30 ruling that split `TrackFill` from `LineDraw`).
 *
 * Same contract as its sibling: renders no visual, publishes `--gp-progress`
 * 0→1 (four decimals) on its own node, so the pilot stepper's line
 * (`scaleY(var(--gp-progress))`) and dot thresholds need no change. The
 * prototype scrubs the stepper from `top 70%` to `bottom 60%` (index.html
 * l.1171), which is the default offset.
 *
 * Reduced: `1` on mount, and the scroll is never read into the node.
 */
export function ScrollProgress({
  children, className, offset = ["start 0.7", "end 0.6"],
}: {
  children: ReactNode;
  className?: string | undefined;
  offset?: ScrollOffset | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReduced();
  const { scrollYProgress } = useScroll({ target: ref, offset });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (!reduced) ref.current?.style.setProperty("--gp-progress", v.toFixed(4));
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--gp-progress", reduced ? "1" : scrollYProgress.get().toFixed(4));
  }, [reduced, scrollYProgress]);

  return <div ref={ref} data-scroll-progress="" className={className}>{children}</div>;
}
