"use client";

import type { ReactNode } from "react";
import { useReduced } from "./use-reduced";

/**
 * The proof ribbon. The ONLY perpetual animation in the system.
 *
 * CSS, not Motion: an infinite linear translate has no state, no gesture and
 * no scroll binding, so running it through a JS animation loop buys nothing
 * and costs a rAF callback for as long as the page is open. The keyframes and
 * the 35s duration live in `base.css` and the token source
 * (`duration.marquee`, measured on Folio).
 *
 * The track renders its children TWICE and translates exactly -50%, so the
 * seam lands where the copy begins and nothing has to be measured at runtime.
 * The duplicate is `aria-hidden`, so the list is announced once.
 *
 * Pauses on hover — a reader who stops it wants to read it — and freezes
 * outright under reduced motion, where the first copy simply sits still.
 */
export function Marquee({
  children, className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  return (
    // `marquee-mask` rather than an inline style: an inline style is the one
    // route into the DOM that neither the Tailwind namespace nor the colour
    // audit's arbitrary-value scan can see, and a rule that lives in CSS can
    // be read by both.
    <div className={className ? `marquee-mask ${className}` : "marquee-mask"}>
      <div className={reduced ? "flex w-max" : "marquee-track flex w-max"}>
        <div className="flex shrink-0">{children}</div>
        {!reduced && <div className="flex shrink-0" aria-hidden="true">{children}</div>}
      </div>
    </div>
  );
}
