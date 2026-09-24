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
 * THE HIT AREA IS LARGER THAN THE PAINT (owner, 2026-09-24, BL-048). The
 * Radix root — the `<button>` a pointer hits and the harness measures — is
 * 24px at the desk (`--gp-control-target-desk`, WCAG 2.2 2.5.8) and the 44px
 * floor under `touch:`; the 16px box is an inner span, so desk density does
 * not change. The root is transparent; state reaches the box through
 * `group-data-[state=…]`, and `peer` stays on the root for a sibling label.
 */
export function Checkbox({ className, ...rest }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cx(
        "group peer inline-grid shrink-0 place-items-center rounded-control",
        "size-(--gp-control-target-desk) touch:size-(--gp-control-height-touch)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cx(
          "grid size-4 place-content-center rounded-control border border-line-strong",
          "transition-colors duration-fast ease-out",
          "group-aria-invalid:border-status-blocked-fg",
          "group-data-[state=checked]:border-action group-data-[state=checked]:bg-action",
          "group-data-[state=checked]:text-action-fg",
        )}
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="grid place-content-center text-current transition-none"
        >
          <Check aria-hidden="true" strokeWidth={2} className="size-3.5" />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  );
}
