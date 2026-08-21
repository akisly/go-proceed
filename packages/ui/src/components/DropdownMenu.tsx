"use client";

// Structure follows shadcn/ui's DropdownMenu (MIT); styling is this system's token roles.

import type { ComponentPropsWithoutRef } from "react";
import { DropdownMenu as RadixDropdownMenu } from "radix-ui";
import { cx } from "./cn";

/**
 * Popover-class chrome, not a modal: `shadow-overlay` is the ruling's own
 * example for this ("tooltip, dropdown, command palette"), the same shadow
 * Tooltip.tsx already wears, one step off its parent rather than covering the
 * page the way Dialog does.
 *
 * PORTALLED CONTENT ESCAPES THE SHELL — `font-sans` on the content for the
 * same reason Tooltip.tsx and Dialog.tsx carry it: a Radix portal inherits
 * none of `.goproceed-app`'s base layer.
 *
 * `animate-chip-in` for the same reason as Dialog: this is Radix's own
 * `data-state` open/close transition, not the JS-driven vocabulary
 * `@goproceed/ui/motion` exists for.
 *
 * `data-[highlighted]` carries both hover and keyboard navigation — Radix
 * moves real focus between items, so the shared `:focus-visible` ring in
 * `base.css` still applies; this only adds the fill, never a competing ring.
 */
export const DropdownMenu = RadixDropdownMenu.Root;
export const DropdownMenuTrigger = RadixDropdownMenu.Trigger;

export function DropdownMenuContent({
  className, sideOffset = 8, ...rest
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content>) {
  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.Content
        sideOffset={sideOffset}
        className={cx(
          "font-sans z-50 min-w-40 rounded-panel border border-line bg-surface p-1 shadow-overlay",
          "animate-chip-in motion-reduce:animate-none",
          className,
        )}
        {...rest}
      />
    </RadixDropdownMenu.Portal>
  );
}

export function DropdownMenuItem({
  className, ...rest
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item>) {
  return (
    <RadixDropdownMenu.Item
      className={cx(
        "flex cursor-default select-none items-center gap-2 rounded-control px-2 py-2 touch:py-2.5",
        "text-data text-ink transition-colors duration-fast ease-out",
        "data-[highlighted]:bg-action-ghost-hover",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...rest}
    />
  );
}

export function DropdownMenuLabel({
  className, ...rest
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Label>) {
  return (
    <RadixDropdownMenu.Label
      className={cx("px-2 py-1.5 text-meta font-medium text-ink-muted", className)}
      {...rest}
    />
  );
}

export function DropdownMenuSeparator({
  className, ...rest
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>) {
  return (
    <RadixDropdownMenu.Separator className={cx("-mx-1 my-1 h-px bg-line", className)} {...rest} />
  );
}
