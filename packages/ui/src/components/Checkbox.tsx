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
 * `index.ts` used to say a checkbox arrives «with the first real form». Plan D
 * is that form, and the row-selection column every TanStack register grows
 * needs one too.
 *
 * FOUR OF SHADCN'S CLASSES ARE DELIBERATELY ABSENT, each for a rule this
 * system enforces with a test:
 *
 * - `shadow-xs` — structure here is border-led. §4.1: «`shadow-md`, a shadow
 *   on a panel → nothing — use `border border-line`». The 1px line does the
 *   work; a 16px control does not need elevation to be found.
 * - `outline-none focus-visible:border-ring focus-visible:ring-[3px]
 *   focus-visible:ring-ring/50` — `base.css` gives every focusable element in
 *   the product ONE `:focus-visible` treatment, so two of them cannot
 *   disagree. `02-building-ui.md` §4.3 rule 6 makes a per-component focus ring
 *   a build failure, and it is the reason `Button.tsx` has none either.
 * - the `dark:` pair — nothing sets `data-theme` in v1 (rewrite-plan D6), and
 *   the roles below already carry the theme.
 * - `transition-shadow` — there is no shadow to transition. The colour change
 *   on check is what moves, so it is `transition-colors` with a named
 *   duration and easing, which is what the motion audit's rules 1–3 require.
 *
 * ⚠️ THIS CONTROL DOES NOT YET MEET THE 44px TOUCH FLOOR, AND NOTHING ON A
 * DASH ROUTE USES IT AS OF THIS COMMIT. `size-4` is shadcn's own metric and it
 * is 16px. `apps/app/qa/field.mjs`'s `measureSmallTargets` collects every
 * `a, button, input, select, textarea` at 390 and 360 and reports anything
 * under 44 in either dimension — and Radix renders BOTH a `button
 * role="checkbox"` and a hidden bubble `input`, so a checkbox on a dash route
 * would produce two findings, not one. Enlarging the box is not the fix
 * (a 44px checkbox is wrong at desk density); the fix is a hit area larger
 * than the paint, and choosing its shape is a design decision no brief in this
 * slice makes. Recorded in `TODOS.md` rather than guessed at here, and the
 * first screen that reaches for this component owes that decision.
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
