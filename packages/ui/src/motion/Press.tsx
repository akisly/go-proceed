"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "motion/react";
import { SPRING } from "./tokens";
import { useReduced } from "./use-reduced";

/**
 * Press feedback: `scale .98` while held, on a stiff spring.
 *
 * Instant by design. Every other transition in the system is eased over time
 * because it describes a change the system is making; a press describes
 * something the USER is doing, and any delay between the finger and the
 * feedback reads as the product being slow rather than as the animation being
 * smooth.
 *
 * .98 and not less: the audience is gloved and outdoors, and a control that
 * shrinks visibly under a thumb looks like it moved out from under it.
 *
 * This wraps a real `<button>`, so type, disabled state, focus ring and the
 * accessible name all come from the platform. Under reduced motion the button
 * is returned unwrapped — there is no opacity-only version of a scale, and
 * inventing one would be motion the user declined.
 */
/**
 * React's drag and animation handlers and Motion's props of the same names are
 * different function types — React's take a SyntheticEvent, Motion's take a
 * PanInfo. Spreading raw button props onto a motion.button is therefore a type
 * error, and the honest fix is to say which handlers this component does not
 * forward rather than to cast the conflict away. None of them belongs on a
 * button in this product: nothing here is draggable, and CSS animation
 * callbacks are not how this system observes motion.
 *
 * `style` is dropped for a different and better reason. An inline style is the
 * one route a colour has into the DOM that neither the Tailwind namespace nor
 * `colour-audit.mjs`'s arbitrary-value scan can see. A control styles itself
 * with utilities or it does not style itself.
 */
type PressProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onDragEnter" | "onDragExit"
  | "onDragLeave" | "onDragOver" | "onDrop"
  | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
  | "style"
> & { children: ReactNode };

export function Press({ children, className, ...rest }: PressProps) {
  const reduced = useReduced();
  if (reduced) {
    return <button className={className} {...rest}>{children}</button>;
  }
  return (
    <motion.button
      className={className}
      whileTap={{ scale: 0.98 }}
      transition={SPRING.press}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
