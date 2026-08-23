"use client";

// Structure follows shadcn/ui's Select (MIT) —
// https://github.com/shadcn-ui/ui, `apps/v4/registry/new-york-v4/ui/select.tsx`,
// read through the shadcn MCP `get_component("select")` on 2026-08-23.
// Styling is this system's token roles; the Radix import is the unified
// `radix-ui` package this repository already depends on.

import type { ComponentProps } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { cx } from "./cn";

/**
 * `index.ts` scheduled Select for «the first real form», and Plan D is it.
 *
 * THE OLD RULING THAT DOES **NOT** RETURN WITH IT. v1 refused a Radix Select
 * for the register's eight filter options, and that refusal stands where it
 * was made: on a demo whose visible option set WAS the claim being made, a
 * control that hides seven of eight options defeats the screen's purpose. That
 * is an argument about one screen's filter, not about the primitive. A form
 * that asks for a unit of measure, an approver role or a status has a closed
 * vocabulary the user is choosing FROM, not reading, and a native-feeling
 * listbox with typeahead and roving focus is the right control there.
 *
 * PORTALLED CONTENT ESCAPES THE SHELL — `font-sans` and `motion-reduce:` on
 * the content, the same as `Tooltip.tsx`, `Dialog.tsx` and
 * `DropdownMenu.tsx`: a Radix portal renders at the document root and inherits
 * none of `.goproceed-app`'s base layer.
 *
 * `animate-chip-in`, not shadcn's `data-[state=open]:animate-in fade-in-0
 * zoom-in-95` stack. Those utilities come from `tw-animate-css`, which this
 * repository does not install — they would compile to NOTHING and the menu
 * would simply appear, with nothing warning. `animate-chip-in` is the CSS
 * keyframe `base.css` already defines for exactly this case (a Radix
 * primitive's own open/close `data-state`), and it is what Dialog and
 * DropdownMenu already use.
 *
 * THE `data-[side=…]:slide-in-from-*` CLASSES ARE GONE FOR THE SAME REASON,
 * and their absence is not a downgrade: they belong to the same missing
 * package. What IS kept is shadcn's popper-mode `translate` pair, which is
 * plain Tailwind and is what puts a gap between trigger and menu.
 *
 * CONTROL HEIGHT IS A TOKEN, AND IT IS SET THE WAY `Button` SETS IT — a map
 * keyed by the `size` prop, not shadcn's `data-[size=default]:h-9
 * data-[size=sm]:h-8` pair. Two reasons, and the second was MEASURED after the
 * first draft shipped the data-attribute form:
 *
 * 1. `component-contract.test.ts` fails on `h-9` and `h-8` outright: a literal
 *    stops tracking the token the moment the token moves.
 * 2. **A `data-[…]` variant BEATS a `touch:` variant on specificity, so the
 *    44px floor silently lost.** `.data-\[size\=default\]\:h-…[data-size=default]`
 *    is a class plus an attribute selector (0,2,0); `.touch\:h-…` inside
 *    `@media (pointer: coarse)` is a class (0,1,0), and a media query adds
 *    nothing to specificity. Measured in a real browser at 390px with
 *    `(pointer: coarse)` emulated: the trigger stayed **36px**, not 44 — the
 *    exact floor WCAG 2.5.5 sets and this audience (gloved, outdoors) needs.
 *    Nothing warned; both classes were in the stylesheet and both applied.
 *    Composing the height into ONE class per size removes the conflict
 *    instead of trying to win it.
 *
 * `data-size` stays on the element because it is shadcn's own structural hook
 * and costs nothing; it simply no longer carries the height.
 */
const TRIGGER_SIZE = {
  default: "h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch)",
  sm: "h-(--gp-control-height-desk-sm) touch:h-(--gp-control-height-touch)",
} as const;

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className, size = "default", children, ...rest
}: ComponentProps<typeof SelectPrimitive.Trigger> & { size?: "sm" | "default" | undefined }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cx(
        "flex w-fit items-center justify-between gap-2 rounded-field border border-line-strong",
        "bg-surface px-3 py-2 text-data text-ink transition-colors duration-fast ease-out",
        TRIGGER_SIZE[size],
        "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted",
        "aria-invalid:border-status-blocked-fg",
        "data-[placeholder]:text-ink-muted",
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex",
        "*:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-ink-muted",
        className,
      )}
      {...rest}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden="true" strokeWidth={1.75} className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className, children, position = "item-aligned", align = "center", ...rest
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cx(
          "font-sans relative z-50 min-w-32 overflow-x-hidden overflow-y-auto",
          "max-h-(--radix-select-content-available-height)",
          "origin-(--radix-select-content-transform-origin)",
          "rounded-panel border border-line bg-surface text-ink shadow-overlay",
          "animate-chip-in motion-reduce:animate-none",
          position === "popper"
            && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        align={align}
        {...rest}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cx(
            "p-1",
            position === "popper"
              && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({ className, ...rest }: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cx("px-2 py-1.5 text-meta font-medium text-ink-muted", className)}
      {...rest}
    />
  );
}

export function SelectItem({
  className, children, ...rest
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cx(
        "relative flex w-full cursor-default select-none items-center gap-2",
        "rounded-control py-1.5 touch:py-2.5 pr-8 pl-2 text-data text-ink",
        "transition-colors duration-fast ease-out",
        "data-[highlighted]:bg-action-ghost-hover",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-ink-muted",
        "*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...rest}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <Check aria-hidden="true" strokeWidth={2} className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({
  className, ...rest
}: ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cx("pointer-events-none -mx-1 my-1 h-px bg-line", className)}
      {...rest}
    />
  );
}

export function SelectScrollUpButton({
  className, ...rest
}: ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cx("flex cursor-default items-center justify-center py-1", className)}
      {...rest}
    >
      <ChevronUp aria-hidden="true" strokeWidth={1.75} className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

export function SelectScrollDownButton({
  className, ...rest
}: ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cx("flex cursor-default items-center justify-center py-1", className)}
      {...rest}
    >
      <ChevronDown aria-hidden="true" strokeWidth={1.75} className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}
