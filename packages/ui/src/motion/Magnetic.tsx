"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useSpring } from "motion/react";
import { SPRING } from "./tokens";
import { useReduced } from "./use-reduced";
import { useBelowBreakpoint, usePointerFine } from "./use-gates";

/**
 * A control that follows the pointer — the prototype's magnetic `.btn`
 * (`index.html` l.1172): the offset from the control's centre × (.18, .25),
 * back to 0 on leave. The spring is `spring.magnetic`, which catches up in
 * about half a second and does not overshoot; motion-primitives' Magnetic is
 * the structural reference and its default spring is not used (it wobbles).
 *
 * Same gates and the same one-shape rule as `Tilt`. Wraps a `Button` or a
 * `Pill` link from the outside — the app's controls never receive it. Not
 * applied to the header button (spec 2026-09-06 §10.5).
 */
export function Magnetic({
  children, className, strengthX = 0.18, strengthY = 0.25,
}: {
  children: ReactNode;
  className?: string | undefined;
  strengthX?: number | undefined;
  strengthY?: number | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, SPRING.magnetic);
  const y = useSpring(0, SPRING.magnetic);
  const reduced = useReduced();
  const narrow = useBelowBreakpoint("md");
  const fine = usePointerFine();
  const on = !reduced && !narrow && fine;

  useEffect(() => {
    const el = ref.current;
    if (!el || !on) { x.set(0); y.set(0); return; }
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x.set((e.clientX - r.left - r.width / 2) * strengthX);
      y.set((e.clientY - r.top - r.height / 2) * strengthY);
    };
    const leave = () => { x.set(0); y.set(0); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      leave();
    };
  }, [on, strengthX, strengthY, x, y]);

  return (
    <motion.div
      ref={ref}
      data-magnetic={on ? "on" : "off"}
      className={["inline-flex", className].filter(Boolean).join(" ")}
      style={{ x, y }}
    >
      {children}
    </motion.div>
  );
}
