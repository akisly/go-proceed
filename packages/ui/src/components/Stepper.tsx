"use client";

import type { CSSProperties, ReactNode } from "react";
import { ScrollProgress } from "../motion/ScrollProgress";
import { cx } from "./cn";

/**
 * The pilot plan as a vertical stepper — 21st.dev's «Steppers», scrubbed by
 * the scroll as the prototype does (index.html l.1171): `ScrollProgress`
 * publishes the section's progress into `--gp-progress`; the line's fill is a
 * `scaleY` of that number and each dot lights as the number passes its
 * threshold. [2026-09-06: was `InViewProgress`, timed; spec 2026-09-06 §3 row
 * 10.]
 */
export function Stepper({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return (
    <ScrollProgress className={cx("relative grid pl-9", className)}>
      <span aria-hidden="true" className="absolute bottom-3 left-2.5 top-3 w-0.5 bg-line" />
      <span
        aria-hidden="true"
        data-stepper-line="true"
        className="absolute bottom-3 left-2.5 top-3 w-0.5 origin-top bg-ink"
        style={{ transform: "scaleY(var(--gp-progress, 0))" }}
      />
      {children}
    </ScrollProgress>
  );
}

export function Step({
  index, count, when, title, children, className,
}: {
  index: number;
  count: number;
  when: string;
  title: string;
  children: ReactNode;
  className?: string | undefined;
}) {
  // The dot lights when progress passes index/count + 0.02 — the prototype's
  // threshold. clamp() turns the difference into 0 or 1 without a state flip.
  const threshold = index / count + 0.02;
  const lit = { opacity: `clamp(0, calc((var(--gp-progress, 0) - ${threshold}) * 100), 1)` } as CSSProperties;
  return (
    <article data-slot="step" className={cx("relative pb-7 last:pb-0", className)}>
      <span aria-hidden="true" className="absolute -left-8 top-1.5 size-3 rounded-pill border-2 border-line-strong bg-canvas" />
      <span aria-hidden="true" className="absolute -left-8 top-1.5 size-3 rounded-pill bg-ink" style={lit} />
      <p className="index-label mb-1.5">{when}</p>
      <h3 className="text-h3 font-semibold text-ink">{title}</h3>
      <div className="mt-1.5 max-w-[44ch] text-data leading-relaxed text-ink-secondary">{children}</div>
    </article>
  );
}
