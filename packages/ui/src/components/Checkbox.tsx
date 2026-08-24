"use client";

// Structure follows shadcn/ui's Checkbox (MIT) —
// https://github.com/shadcn-ui/ui, `apps/v4/registry/new-york-v4/ui/checkbox.tsx`,
// read through the shadcn MCP `get_component("checkbox")` on 2026-08-23.
// Styling is this system's token roles; the Radix import is the unified
// `radix-ui` package this repository already depends on.

import type { ComponentProps } from "react";
import { Check } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { cx } from "./cn";

/**
 * Four of shadcn's classes are deliberately absent, each for a rule this
 * system enforces: `shadow-xs` (structure here is border-led), the
 * `focus-visible` ring set (`base.css` gives the product one `:focus-visible`
 * treatment and §4.3 makes a second a build failure), the `dark:` pair (the
 * roles below already carry the theme), and `transition-shadow` (there is no
 * shadow; the colour change on check is what moves).
 *
 * ⚠️ THIS CONTROL DOES NOT MEET THE 44px TOUCH FLOOR. `size-4` is shadcn's
 * metric. Enlarging the box is the wrong fix at desk density; the fix is a hit
 * area larger than the paint, and its shape is a design decision no brief in
 * this slice makes. `TODOS.md` carries it, and `qa/field.mjs`'s touch-target
 * pass will refuse the first dash screen that uses this component.
 */
export function Checkbox({ className, ...rest }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cx(
        "peer size-4 shrink-0 rounded-control border border-line-strong",
        "transition-colors duration-fast ease-out",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-status-blocked-fg",
        "data-[state=checked]:border-action data-[state=checked]:bg-action",
        "data-[state=checked]:text-action-fg",
        className,
      )}
      {...rest}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <Check aria-hidden="true" strokeWidth={2} className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
