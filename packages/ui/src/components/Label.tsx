"use client";

// Structure follows shadcn/ui's Label (MIT) —
// https://github.com/shadcn-ui/ui, `apps/v4/registry/new-york-v4/ui/label.tsx`,
// read through the shadcn MCP `get_component("label")` on 2026-08-23.
// Styling is this system's token roles; the Radix import is the unified
// `radix-ui` package this repository already depends on.

import type { ComponentProps } from "react";
import { Label as LabelPrimitive } from "radix-ui";
import { cx } from "./cn";

/**
 * A standalone label, which this package did not have.
 *
 * `Field.tsx` renders a plain `<label htmlFor>` inside its own render-prop
 * plumbing, which is the right shape for a control that is not driven by a
 * form library. `Form.tsx`'s `FormLabel` is the shape for one that is, and it
 * needs a label component it can hand `htmlFor` and a `data-error` attribute
 * to. That is this file. The overlap between the two is real and is named in
 * `index.ts`: it is a decision the first real form has to make, not one this
 * commit makes for it.
 *
 * WHY RADIX AND NOT A BARE `<label>`: Radix's Label suppresses the
 * double-click text selection a native label triggers on its own text, and it
 * forwards clicks to the associated control even when that control is a
 * composite (a Radix Select trigger is a `<button>`, and a native `<label
 * for>` does not always reach it). Both are behaviours we would otherwise
 * write by hand and get wrong once.
 *
 * `text-meta`, not `text-sm` — the stock size namespace is cleared
 * (`theme.generated.css` §1), so `text-sm` compiles to nothing at all. This is
 * the same metric `Field.tsx`'s own label uses, so a form built either way
 * reads identically.
 */
export function Label({ className, ...rest }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cx(
        "flex items-center gap-2 text-meta font-medium leading-none text-ink select-none",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
}
