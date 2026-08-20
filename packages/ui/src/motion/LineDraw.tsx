"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { useReduced } from "./use-reduced";

/**
 * An SVG path that draws itself as the section scrolls. The evidence chain
 * (`Робота → Докази → Закриття → Акт → Оплата`) is the reason this exists: the
 * product's claim is that a payable amount is CONNECTED to the work that
 * earned it, and a line that draws that connection while you read is the claim
 * rendered rather than asserted.
 *
 * Scroll-linked and therefore rationed: `<ScrollTint>` and this are the only
 * two, and a page may not put them in the same fold.
 *
 * `pathLength` rather than `stroke-dashoffset` arithmetic — Motion normalises
 * it to 0..1 regardless of the path's real length, so the same component works
 * for a 200px connector and a 1200px one with no measurement.
 *
 * The spring is on the scroll progress, not on the path: it smooths the input
 * so a trackpad flick does not snap the line to its end, while the line itself
 * stays exactly as far along as the reader is.
 *
 * Reduced motion renders the path complete. A connector that is not drawn is
 * not decoration — it is the diagram.
 */
export function LineDraw({
  d, className, strokeWidth = 1.5, viewBox = "0 0 1200 2",
}: {
  d: string;
  className?: string | undefined;
  strokeWidth?: number | undefined;
  viewBox?: string | undefined;
}) {
  const reduced = useReduced();

  if (reduced) {
    return (
      <LineFrame d={d} className={className} strokeWidth={strokeWidth} viewBox={viewBox} />
    );
  }

  return (
    <AnimatedLine d={d} className={className} strokeWidth={strokeWidth} viewBox={viewBox} />
  );
}

type LineProps = {
  d: string;
  className?: string | undefined;
  strokeWidth: number;
  viewBox: string;
};

function LineFrame({ d, className, strokeWidth, viewBox }: LineProps) {
  return (
    <div className={className} aria-hidden="true">
      <svg viewBox={viewBox} fill="none" preserveAspectRatio="none" className="h-full w-full">
        <path
          d={d}
          stroke="var(--gp-border-strong)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={1}
        />
      </svg>
    </div>
  );
}

function AnimatedLine({ d, className, strokeWidth, viewBox }: LineProps) {
  // The scroll target is the wrapping div, not the <svg>. `useScroll` measures
  // an HTMLElement; an SVGSVGElement is not one, and casting it would compile
  // while handing Motion an element whose layout box it reads differently.
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.6"] });
  const drawn = useSpring(scrollYProgress, { stiffness: 90, damping: 24, restDelta: 0.001 });

  return (
    <div ref={ref} className={className} aria-hidden="true">
      <svg viewBox={viewBox} fill="none" preserveAspectRatio="none" className="h-full w-full">
        <motion.path
          d={d}
          stroke="var(--gp-border-strong)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ pathLength: drawn }}
        />
      </svg>
    </div>
  );
}
