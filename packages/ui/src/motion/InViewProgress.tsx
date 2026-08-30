"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, useInView, useMotionValue } from "motion/react";
import { DURATION, EASE } from "./tokens";
import { useReduced } from "./use-reduced";

/**
 * A progress number, and nothing else. The only word in this vocabulary that
 * renders no visual of its own.
 *
 * WHY IT EXISTS. `readiness-workflow` is a diagram of one product concept —
 * trunk, branch, travelers, pulses — derived from a single 0→1 progress. Moving
 * that drawing into this package would put a domain picture into a shared
 * vocabulary; leaving it as it was kept `motion/react` in `apps/landing`, which
 * rule 5 forbids. So the vocabulary supplies the number and the landing keeps
 * the picture.
 *
 * IT WRITES A CSS VARIABLE RATHER THAN RETURNING A VALUE. A render prop would
 * read better and re-render a 340-line SVG sixty times a second. The variable
 * is set straight on the node, so the subtree restyles without React knowing.
 *
 * REDUCED: publishes 1 immediately and never animates — the diagram renders in
 * its settled state, which is a different outcome, not a fast one.
 */
export function InViewProgress({
  children, amount, className,
}: {
  children: ReactNode;
  /** How much of the wrapper must be visible before it starts. Default 0.4. */
  amount?: number | undefined;
  className?: string | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: amount ?? 0.4, once: true });
  const reduced = useReduced();
  const progress = useMotionValue(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduced) {
      node.style.setProperty("--gp-progress", "1");
      return;
    }
    if (!inView) {
      node.style.setProperty("--gp-progress", "0");
      return;
    }
    // Same shape as CountUp.tsx, which is the precedent for an in-view
    // `animate` in this package — a MotionValue driven by `animate`, the
    // controls stopped on cleanup, and no explicit return-type annotation
    // because inference already has it.
    const controls = animate(progress, 1, {
      duration: DURATION.deliberate,
      ease: EASE.out,
      onUpdate: (v) => node.style.setProperty("--gp-progress", v.toFixed(4)),
    });
    return () => controls.stop();
  }, [inView, reduced, progress]);

  return <div ref={ref} className={className}>{children}</div>;
}
