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
 *
 * `area` mirrors `Tilt`'s, and for the same reason. `self` is the control
 * case: the offset is measured from the element's own centre, so it only
 * answers a pointer that is on it. `section` measures from the VIEWPORT's
 * centre instead, so the element keeps travelling while the pointer moves
 * anywhere in its section — the behaviour the hero's board has always had.
 * The formula and the unit are the same either way (an offset in pixels times
 * `strength`); only the origin moves.
 *
 * [2026-09-07] `section` exists because rotation cannot carry small objects.
 * `Tilt` displaces a corner in proportion to the element's size: measured on
 * the built page, 1.72° moved the 1054px board's edge 15.8px and 2.58° moved
 * the 251px receipt's edge 0.6px. The receipt, the two status pills and
 * anything else small has to TRANSLATE to read as following the pointer at
 * all. Translation also needs no 3D context, so unlike `Tilt` it does not
 * force `transform-style: preserve-3d` onto its ancestors — which is what had
 * been re-sorting the hero's layers and letting the board paint over the pills.
 */
export function Magnetic({
  children, className, strengthX = 0.18, strengthY = 0.25, area = "self",
}: {
  children: ReactNode;
  className?: string | undefined;
  strengthX?: number | undefined;
  strengthY?: number | undefined;
  /** `self` (default): the pointer must be on the element. `section`: the pointer anywhere in the nearest `<section>`, measured from the viewport centre. */
  area?: "self" | "section" | undefined;
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
    const scope: HTMLElement = area === "section" ? (el.closest("section") ?? el) : el;
    const move = (e: PointerEvent) => {
      if (area === "section") {
        x.set((e.clientX - window.innerWidth / 2) * strengthX);
        y.set((e.clientY - window.innerHeight / 2) * strengthY);
        return;
      }
      const r = el.getBoundingClientRect();
      x.set((e.clientX - r.left - r.width / 2) * strengthX);
      y.set((e.clientY - r.top - r.height / 2) * strengthY);
    };
    const leave = () => { x.set(0); y.set(0); };
    scope.addEventListener("pointermove", move);
    scope.addEventListener("pointerleave", leave);
    return () => {
      scope.removeEventListener("pointermove", move);
      scope.removeEventListener("pointerleave", leave);
      leave();
    };
  }, [on, area, strengthX, strengthY, x, y]);

  return (
    <motion.div
      ref={ref}
      data-magnetic={on ? "on" : "off"}
      data-magnetic-area={area}
      className={["inline-flex", className].filter(Boolean).join(" ")}
      style={{ x, y }}
    >
      {children}
    </motion.div>
  );
}
