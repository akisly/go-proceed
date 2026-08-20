"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, animate } from "motion/react";
import { DURATION, EASE } from "./tokens";
import { useReduced } from "./use-reduced";

/**
 * A figure that counts up when it enters view.
 *
 * The one place this product is allowed to be theatrical, and only because the
 * figure IS the argument: «скільки грошей стоїть без доказів» is the sentence
 * the whole landing exists to say, and a number that arrives is read, where a
 * number that was always there is skimmed.
 *
 * Three rules that keep it from becoming a gimmick:
 *
 * 1. **The formatter is passed in, not guessed.** Money has a currency, a
 *    thousands separator and a locale, and a component that formats it itself
 *    would be a second place those decisions live. `src/domain/format.ts`
 *    already owns them.
 * 2. **Tabular figures, always.** Proportional digits change the element's
 *    width on every frame, which drags every neighbour along with it — the
 *    animation becomes a layout animation and janks. The caller must apply the
 *    `tabular` utility; this component does not silently style itself.
 * 3. **Reduced motion snaps to the final value**, and so does a screen reader:
 *    the accessible name is the final number from first paint, so the value is
 *    never announced mid-count.
 */
export function CountUp({
  value, format, className,
}: {
  value: number;
  /** e.g. `(n) => new Intl.NumberFormat("uk-UA").format(Math.round(n))` */
  format: (n: number) => string;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const motionValue = useMotionValue(0);
  const [shown, setShown] = useState(() => format(reduced ? value : 0));

  useEffect(() => {
    if (reduced) { setShown(format(value)); return; }
    if (!inView) return;
    const controls = animate(motionValue, value, {
      duration: DURATION.deliberate,
      ease: EASE.emphatic,
      onUpdate: (n) => setShown(format(n)),
    });
    return () => controls.stop();
  }, [inView, reduced, value, format, motionValue]);

  return (
    <span ref={ref} className={className}>
      {/* The real value, announced once and never mid-count. */}
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
