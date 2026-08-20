"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { DURATION, EASE } from "./tokens";
import { useReduced } from "./use-reduced";

/**
 * Hover lift for an interactive card: `y -3` plus the raised elevation, 160ms
 * on ease-out-quad.
 *
 * −3px, not −8. The folio metaphor is sheets on a desk, and a sheet that jumps
 * a centimetre when the pointer nears it is not a sheet. The existing motion
 * spec already fixed this range (`translateY(-3px)` over 160–220ms) and it
 * survives the rewrite unchanged.
 *
 * `whileHover` only — no `whileTap`. A card is not a button; if the whole card
 * is clickable it should contain a real control, and that control brings its
 * own press feedback.
 */
export function Lift({
  children, className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      whileHover={{ y: -3, boxShadow: "var(--gp-shadow-raised)" }}
      transition={{ duration: DURATION.fast, ease: EASE.out }}
    >
      {children}
    </motion.div>
  );
}
