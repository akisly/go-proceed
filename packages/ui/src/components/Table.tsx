// Structure follows shadcn/ui's Table (MIT) —
// https://github.com/shadcn-ui/ui, `apps/v4/registry/new-york-v4/ui/table.tsx`,
// read through the shadcn MCP `get_component("table")` on 2026-08-23.
// Styling is this system's token roles.

import type { ComponentProps } from "react";
import { cx } from "./cn";

/**
 * THE ONE TABLE. Until this commit there were two shapes fighting: a
 * hand-rolled `Table/Th/Td/Tr` here, and shadcn's own primitive set that every
 * reference (`docs/design/03-ui-references.md`) and every TanStack example is
 * written against. The owner's instruction was «один в один из референсов, то
 * же самое shadcn», so the hand-rolled set is gone and this file is shadcn's —
 * same eight components, same `data-slot` attributes, same container div, same
 * child-selector idioms — with the classes rewritten as roles.
 *
 * THREE RULINGS SURVIVE THE SWAP, because they were paid for here and shadcn
 * has no opinion on any of them:
 *
 * 1. **`table-fixed`.** Column geometry is a property of the element instead
 *    of something maintained per row. v1 shipped a defect it called "fourteen
 *    grids" — a per-row grid definition that drifted — and this is the fix.
 *    Never reintroduce a per-row grid. shadcn ships `w-full` only; the
 *    `table-fixed` is ours and is asserted by `component-contract.test.ts`.
 *
 * 2. **Numeric columns are right-aligned and tabular.** That is what makes a
 *    shortfall scannable: 620/620 and 180/150 differ in SHAPE when their
 *    digits share a right edge. `numeric` sets both, so they cannot be applied
 *    apart. shadcn's equivalent is a per-column `meta.className` string, which
 *    a caller can half-apply; this prop cannot be half-applied, and
 *    `DataTable.tsx` reads shadcn's `meta` on top of it so both routes exist.
 *
 * 3. **This is a real `<table>`.** Changing `display` on table elements strips
 *    their implicit ARIA roles, which is why the "responsive table" trick
 *    forces you to hand `role="table"/"row"/"cell"` back and maintain an
 *    invisible second copy of the semantics. On a phone the register renders
 *    as cards instead — a different hierarchy, not a reflow — and that
 *    redesign is still unbuilt; until it is, callers set a min-width and the
 *    container below scrolls.
 *
 * TWO DELIBERATE DEPARTURES FROM THE REFERENCE SOURCE, both named so a reader
 * does not mistake them for sloppiness:
 *
 * **`whitespace-nowrap` is NOT carried over** from shadcn's `TableHead` and
 * `TableCell`. Under `table-fixed` a column does not widen to fit its content
 * — CSS sizes the columns from the table and the column elements, never from a
 * cell — so `nowrap` there does not make the table wider, it makes the CELL
 * overflow. That is precisely the defect `apps/app/qa/field.mjs`'s register
 * audit measures (`th.scrollWidth > th.clientWidth` at 390 and 360), and it
 * already shipped once: «ЗАПЛАНОВАНО» ran 50px into its neighbour. shadcn's
 * own table is `w-full` with auto layout, where `nowrap` is harmless.
 *
 * **No `"use client"`.** shadcn's file carries the directive; none of these
 * eight components uses a hook, state or an effect, and two landing blocks
 * (`comparison.tsx`, `mock-panels.tsx`) render tables from server components.
 * Adding the directive would move them, and every row they contain, into the
 * client bundle for nothing. `DataTable.tsx` — which does use hooks — carries
 * it instead.
 *
 * COLUMN HEADINGS KEEP THIS SYSTEM'S TREATMENT (`text-meta`, uppercase,
 * `tracking-wide`, `text-ink-muted`) rather than shadcn's `text-foreground` at
 * body size. That is not a structural difference, it is the §4.1 substitution
 * table doing its job — and the measured `min-w-160` floor in the register and
 * the unvalued register is a floor for THESE metrics. Changing them would
 * invalidate the measurement, not just the look.
 */
export function Table({ className, ...rest }: ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cx("w-full table-fixed caption-bottom border-collapse text-data", className)}
        {...rest}
      />
    </div>
  );
}

export function TableHeader({ className, ...rest }: ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cx("[&_tr]:border-b [&_tr]:border-line-strong", className)}
      {...rest}
    />
  );
}

export function TableBody({ className, ...rest }: ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cx("[&_tr:last-child]:border-0", className)}
      {...rest}
    />
  );
}

export function TableFooter({ className, ...rest }: ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cx(
        "border-t border-line-strong bg-subtle font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...rest}
    />
  );
}

export function TableRow({ className, ...rest }: ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cx(
        "border-b border-line-strong transition-colors duration-fast ease-out",
        "hover:bg-subtle has-aria-expanded:bg-subtle data-[state=selected]:bg-subtle",
        className,
      )}
      {...rest}
    />
  );
}

/**
 * `numeric` is the ruling, not a convenience: it sets `tabular` and
 * `text-right` together on a heading so the heading cannot drift away from the
 * column it labels.
 */
export function TableHead({
  numeric = false, className, ...rest
}: ComponentProps<"th"> & { numeric?: boolean | undefined }) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cx(
        "px-3 py-2 align-middle text-meta font-medium uppercase tracking-wide text-ink-muted",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        numeric ? "text-right" : "text-left",
        className,
      )}
      {...rest}
    />
  );
}

export function TableCell({
  numeric = false, className, ...rest
}: ComponentProps<"td"> & { numeric?: boolean | undefined }) {
  return (
    <td
      data-slot="table-cell"
      className={cx(
        "px-3 py-2.5 align-middle text-ink",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        numeric ? "tabular text-right" : "text-left",
        className,
      )}
      {...rest}
    />
  );
}

export function TableCaption({ className, ...rest }: ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cx("mt-4 text-data text-ink-muted", className)}
      {...rest}
    />
  );
}
