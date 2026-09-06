"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useSpring } from "motion/react";
import { SPRING } from "./tokens";
import { useReduced } from "./use-reduced";
import { useBelowBreakpoint, usePointerFine } from "./use-gates";

/**
 * A surface that leans toward the pointer — the prototype's board tilt
 * (`index.html` l.1139: rotateY ±2°, rotateX ±1.5°, read against the whole
 * hero) and the `[data-spot]` card tilt (l.1159: rotateX ±2.5°, rotateY ±3°,
 * read against the card). The degrees are props because the two surfaces
 * differ; the spring (`spring.tilt`) is the token, and it does not overshoot —
 * a surface that leans must not wobble.
 *
 * `area="self"` reads the pointer over the element; `area="section"` reads it
 * over the nearest `<section>` and normalises by the viewport, which is how
 * the prototype tilts the board while the pointer is anywhere in the hero.
 *
 * GATED THREE WAYS and with one DOM shape: `(pointer: fine)` only (a thumb has
 * nothing to follow), above `md`, and not under reduced motion. Off, the
 * springs sit at 0 and `data-tilt="off"` says so — the QA harness counts them.
 * The parent supplies `perspective` (the prototype's `.stage{perspective:1500px}`,
 * `.cards3{perspective:1600px}`); this only sets `transform-style`.
 */
export function Tilt({
  children, className, maxX, maxY, area = "self",
}: {
  children: ReactNode;
  className?: string | undefined;
  /** Degrees of rotateX at the pointer's extreme (top/bottom edge). */
  maxX: number;
  /** Degrees of rotateY at the pointer's extreme (left/right edge). */
  maxY: number;
  area?: "self" | "section" | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(0, SPRING.tilt);
  const rotateY = useSpring(0, SPRING.tilt);
  const reduced = useReduced();
  const narrow = useBelowBreakpoint("md");
  const fine = usePointerFine();
  const on = !reduced && !narrow && fine;

  useEffect(() => {
    const el = ref.current;
    if (!el || !on) { rotateX.set(0); rotateY.set(0); return; }
    const scope: HTMLElement = area === "section" ? (el.closest("section") ?? el) : el;
    const move = (e: PointerEvent) => {
      let px: number; let py: number;
      if (area === "section") {
        px = e.clientX / window.innerWidth;
        py = e.clientY / window.innerHeight;
      } else {
        const r = el.getBoundingClientRect();
        px = (e.clientX - r.left) / r.width;
        py = (e.clientY - r.top) / r.height;
      }
      rotateY.set((px - 0.5) * 2 * maxY);
      rotateX.set(-(py - 0.5) * 2 * maxX);
    };
    const leave = () => { rotateX.set(0); rotateY.set(0); };
    scope.addEventListener("pointermove", move);
    scope.addEventListener("pointerleave", leave);
    return () => {
      scope.removeEventListener("pointermove", move);
      scope.removeEventListener("pointerleave", leave);
      leave();
    };
  }, [on, area, maxX, maxY, rotateX, rotateY]);

  return (
    <motion.div
      ref={ref}
      data-tilt={on ? "on" : "off"}
      className={className}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
    >
      {children}
    </motion.div>
  );
}
