"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Slot } from "radix-ui";
import { Press } from "../motion/Press";
import { cx } from "./cn";

/**
 * Five variants, and the set is closed.
 *
 * `primary` — Ink. Under D1 the action colour is near-black, not the brand
 *   lime. That is what removes the readable-accent problem from the system
 *   instead of working around it, and it is what Folio and Linear both do.
 * `signal` — the mark. EXACTLY ONE per screen. v1 allowed a single Lime fill
 *   in the entire product and that discipline is why the colour still means
 *   "next action" rather than "button".
 * `outline` — the workhorse.
 * `ghost` — chrome.
 * `link` — inline, inside a sentence.
 *
 * There is NO `destructive` variant. Nothing under `/app/**` deletes anything,
 * so a destructive variant could only ever be used by being reached for
 * wrongly — and a variant that exists is a variant that will be used.
 *
 * SIZES CARRY TWO NUMBERS AND THE SMALL ONE IS NEVER BELOW 44px ON TOUCH.
 * WCAG 2.5.5's 44px is a floor, not a preference, and this audience is gloved
 * and outdoors. The floor is expressed with the `touch` variant — a capability
 * query — rather than with a breakpoint, because it is a fact about the
 * pointing device and a touch laptop at 1440px needs it too. Both numbers come
 * from `component.control-height-*`; neither is typed here.
 *
 * No focus ring in the variants. `base.css` gives every focusable element in
 * the product one treatment, so two of them cannot disagree.
 */
const VARIANT = {
  primary: "bg-action text-action-fg hover:bg-action-hover",
  signal: "bg-action-signal text-action-signal-fg hover:bg-action-signal-hover font-semibold",
  outline: "border border-line-strong bg-surface text-ink hover:bg-action-ghost-hover",
  ghost: "text-ink-secondary hover:bg-action-ghost-hover",
  link: "text-link underline underline-offset-4 hover:text-ink",
} as const;

const SIZE = {
  default: "h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch) px-4 text-data",
  sm: "h-(--gp-control-height-desk-sm) touch:h-(--gp-control-height-touch) px-3 text-meta",
  /** Marketing controls: the prototype's 42px. The touch floor still wins under pointer:coarse. */
  lg: "h-(--gp-control-height-marketing) touch:h-(--gp-control-height-touch) px-5 text-data",
  icon: "size-(--gp-control-height-desk) touch:size-(--gp-control-height-touch) p-0",
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control " +
  "font-medium whitespace-nowrap transition-colors duration-fast ease-out " +
  "disabled:pointer-events-none disabled:opacity-50";

export type ButtonProps = {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  /** Render as the single child element instead of a <button>. For a link
   * that must look like a button — never to make a <div> clickable. */
  asChild?: boolean | undefined;
  children: ReactNode;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onDragEnter" | "onDragExit"
  | "onDragLeave" | "onDragOver" | "onDrop"
  | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration" | "style"
>;

export function Button({
  variant = "primary", size = "default", asChild = false, className, children, ...rest
}: ButtonProps) {
  const classes = cx(BASE, VARIANT[variant], variant === "link" ? "h-auto px-0" : SIZE[size], className);

  if (asChild) {
    // NEVER pass a function-valued className or children through Slot. Radix
    // merges className by string concatenation, so a function is stringified
    // into the class attribute — React does not warn and TypeScript cannot see
    // it. v1 shipped exactly that with react-router's NavLink and lost both
    // branches of an active/inactive colour ternary while the layout still
    // looked right.
    return <Slot.Root className={classes}>{children}</Slot.Root>;
  }

  return <Press className={classes} {...rest}>{children}</Press>;
}
