"use client";

import Link from "next/link";
import type { DataTableColumnDef } from "@goproceed/ui/components";
import type { AssignmentSummary } from "@goproceed/contracts";
import { assignmentStatusLabel } from "../../lib/assignment-status-labels";

/**
 * The register's columns, defined once.
 *
 * SPLIT OUT OF `assignments-list.tsx` FOLLOWING THE REFERENCE'S OWN SHAPE —
 * satnaing/shadcn-admin (MIT) keeps a `*-columns.tsx` beside its table, and
 * `docs/design/04-role-pain-map.md` names that pattern for this screen. The
 * file placement is plane's, per `03-ui-references.md`'s hierarchy table:
 * kebab-case, under `src/components/<domain>/`, not a `features/` tree.
 *
 * WIDTHS TRAVEL WITH THE COLUMN, NOT WITH THE MARKUP. `Table` is
 * `w-full table-fixed`, so these percentages are the whole column geometry;
 * they used to be `className`s hand-typed onto the `th` elements in the JSX,
 * where a new column could be added without anybody noticing the percentages
 * no longer sum. `meta.className` is shadcn-admin's own slot for this and
 * `DataTable` applies it to both the `th` and the `td`.
 *
 * `meta.numeric` IS THE RULING, NOT AN ALIGNMENT PREFERENCE —
 * `packages/ui/src/components/Table.tsx`'s ruling 2: a numeric column is
 * right-aligned AND tabular, because 620/620 and 180/150 differ in SHAPE only
 * when their digits share a right edge, and that is what makes a shortfall
 * scannable to someone reconciling a period.
 *
 * SORTING IS NOT ENABLED. The route already sorts (`created_at desc, id`) and
 * this list renders exactly what it returned; that was true before the
 * TanStack migration and is unchanged by it. `DataTable`'s header records what
 * turning it on would take.
 *
 * STATUS IS PLAIN UKRAINIAN TEXT, NOT A `Chip`, and that ruling is unchanged
 * by this migration — `Chip`'s tones are assigned to readiness/review states,
 * no design decision in any brief assigns one to `work_assignments.status`,
 * and "blocked" already carries a distinct financial meaning in this product
 * (blocked value / blocked reasons). Plain text still satisfies
 * `02-building-ui.md` §4.1's «a status shown only by colour → colour PLUS its
 * `ui_uk` label», because there is no colour to begin with.
 */

/** `null` only for `plannedQuantity` — an assignment need not carry a plan. */
function quantityCell(value: string | null, unitCode: string): string {
  return value === null ? "—" : `${value} ${unitCode}`;
}

export const assignmentColumns: DataTableColumnDef<AssignmentSummary>[] = [
  {
    id: "description",
    accessorKey: "description",
    header: "Роботи",
    enableSorting: false,
    meta: { className: "w-2/5" },
    cell: ({ row }) => (
      <>
        {/* THE ROW LINK IS A 44px TARGET ON A TOUCH DEVICE — MEASURED, not
          * assumed. `qa/field.mjs`'s register audit reported «"Приклад-
          * улаштування прокладки ка" 217x36» at both 390 and 360 on its first
          * run: an inline `<a>` is only as tall as its line boxes, so a
          * two-line description came to 36px, under WCAG 2.5.5's floor, on the
          * one control this screen has per row.
          *
          * `flex items-center` makes the anchor the cell's full width (which
          * is also what someone aiming at a register row expects to be able to
          * tap), and the height floor is applied under `touch:` ONLY, which is
          * `@media (pointer: coarse)` (`packages/ui/src/base.css`). That is
          * the same idiom every control in `packages/ui` uses, and the exact
          * condition the harness itself checks under (`if (touch)`, widths
          * below 768). Applying 44px unconditionally would add 26px to every
          * row of a dense desk table for a constraint the desk does not have;
          * §3.3 question 1 says this surface is dense. The token, not the
          * number: 44px is `--gp-control-height-touch` and a literal stops
          * tracking it. */}
        <Link
          href={`/dash/assignments/${row.original.assignmentId}`}
          className="flex items-center font-medium text-ink hover:underline touch:min-h-(--gp-control-height-touch)"
        >
          {row.original.description}
        </Link>
        {row.original.workCode && (
          <span className="block text-meta text-ink-muted">{row.original.workCode}</span>
        )}
      </>
    ),
  },
  {
    id: "plannedQuantity",
    header: "Заплановано",
    enableSorting: false,
    meta: { className: "w-1/5", numeric: true },
    cell: ({ row }) => quantityCell(row.original.plannedQuantity, row.original.unitCode),
  },
  {
    id: "effectiveQuantity",
    header: "Виконано",
    enableSorting: false,
    meta: { className: "w-1/5", numeric: true },
    cell: ({ row }) => quantityCell(row.original.effectiveQuantity, row.original.unitCode),
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Статус",
    enableSorting: false,
    meta: { className: "w-1/5" },
    cell: ({ row }) => assignmentStatusLabel(row.original.status),
  },
];
