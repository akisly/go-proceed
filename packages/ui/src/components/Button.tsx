"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Slot } from "radix-ui";
import { Press } from "../motion/Press";
import { cx } from "./cn";

/**
 * Six variants, and the set is closed.
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
 * `destructive` — irreversible, and only irreversible. Outlined at rest,
 *   filled on hover: the border and the ink carry it, so beside a signal
 *   primary it does not out-shout the action the person is there to take.
 *   [Added 2026-09-05. This paragraph used to say there was NO destructive
 *   variant because nothing under /app/** deletes anything. The field
 *   client's «Скасувати фото» drops a photo the server never received, and
 *   it had kept a private Button for that one control. One Button now; the
 *   contract test counts the variant's call sites — one — so a second
 *   irreversible action is a deliberate edit to that number.]
 *
 * SIZES CARRY TWO NUMBERS AND THE SMALL ONE IS NEVER BELOW 44px ON TOUCH.
 * WCAG 2.5.5's 44px is a floor, not a preference, and this audience is gloved
 * and outdoors. The floor is expressed with the `touch` variant — a capability
 * query — rather than with a breakpoint, because it is a fact about the
 * pointing device and a touch laptop at 1440px needs it too. Both numbers come
 * from `component.control-height-*`; neither is typed here. `link` has no
 * height of its own but keeps the VERTICAL touch floor as a minimum; its
 * width is the sentence's, so a min-width would break inline links.
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
  destructive:
    "border border-status-blocked-line bg-surface text-status-blocked-fg " +
    "hover:bg-status-blocked-fg hover:text-action-fg",
} as const;

const SIZE = {
  default: "h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch) px-4 text-data",
  sm: "h-(--gp-control-height-desk-sm) touch:h-(--gp-control-height-touch) px-3 text-meta",
  /**
   * Marketing controls: the prototype's 42px. The touch floor still wins under
   * pointer:coarse. `rounded-panel` (10px) is the ONLY size that overrides
   * BASE's `rounded-control` (6px): spec §4 keeps `control` for the app and
   * gives the marketing button `panel`, because the prototype's `.btn` is 9px
   * and `panel` is the token nearest it. The override works because
   * `tw-merge.generated.ts` groups every `rounded-*` role in one class group,
   * so the later class wins instead of both surviving.
   */
  lg: "h-(--gp-control-height-marketing) touch:h-(--gp-control-height-touch) px-5 text-data rounded-panel",
  icon: "size-(--gp-control-height-desk) touch:size-(--gp-control-height-touch) p-0",
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

/**
 * [2026-09-06] Every sized button lifts one pixel on hover over `duration.base`
 * on the emphatic curve — the prototype's `.btn:hover{transform:translateY(-1px)}`
 * (index.html l.526–528). Colour transitions move from `fast` to `base` with
 * it: one transition list, one duration (spec 2026-09-06 §6).
 */
const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control " +
  "font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] duration-base ease-emphatic " +
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
  const classes = cx(
    BASE,
    VARIANT[variant],
    variant === "link" ? "h-auto px-0 touch:min-h-(--gp-control-height-touch)" : `${SIZE[size]} hover:-translate-y-px`,
    className,
  );

  if (asChild) {
    // NEVER pass a function-valued className or children through Slot. Radix
    // merges className by string concatenation, so a function is stringified
    // into the class attribute — React does not warn and TypeScript cannot see
    // it. v1 shipped exactly that with react-router's NavLink and lost both
    // branches of an active/inactive colour ternary while the layout still
    // looked right.
    return (
      <Slot.Root data-slot="button" className={classes}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <Press data-slot="button" className={classes} {...rest}>
      {children}
    </Press>
  );
}
