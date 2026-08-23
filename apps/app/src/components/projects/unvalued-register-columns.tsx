"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { BlockedValueResponse } from "@goproceed/contracts";
import { unvaluedReasonLabel } from "../../lib/unvalued-reason-labels";
import { formatQuantity } from "../../lib/quantity";

export type UnvaluedRegisterRow = BlockedValueResponse["unvaluedRegister"][number];

/**
 * The unvalued register's three columns, split out of `unvalued-register.tsx`
 * for the same reason `assignments-columns.tsx` was split out of its list —
 * satnaing/shadcn-admin (MIT) keeps a `*-columns.tsx` beside every table it
 * ships, and it is what makes the geometry reviewable in one place instead of
 * spread across four `Th` elements in JSX.
 *
 * QUANTITY, NEVER MONEY — the row schema itself has no money field
 * (`packages/contracts/src/blocked-value.ts`'s `unvaluedRegisterRow`), and
 * these columns render exactly what they are given: `quantity` + `unitCode`,
 * never a computed price. INV-038's whole point is that a line here
 * contributes NOTHING to any total on this screen: «There is deliberately NO
 * money field on this row. A `netMinorUnits: "0"` here is how "we do not know"
 * becomes "it is free".»
 *
 * `quantity` GOES THROUGH `formatQuantity` — it is `fromScaled6` output, built
 * at the `unvaluedRegister` map's own row in `summariseBlockedValue`
 * (`apps/app/src/lib/blocked-value.ts`): a fixed six-fraction-digit,
 * dot-separated string built to round-trip `numeric(20,6)` exactly, not to be
 * read. This row shipped `"10.000000"` once, beside `formatMoney`'s
 * Ukrainian-comma figures elsewhere on the same screen. `unitCode` is carried
 * on the row (unlike `blockedReason.unvaluedQuantity`, which has none).
 *
 * `meta.numeric` on the two figure columns is `Table.tsx`'s ruling 2 —
 * right-aligned and tabular, together, so a shortfall differs in shape.
 */
export const unvaluedRegisterColumns: ColumnDef<UnvaluedRegisterRow>[] = [
  {
    id: "reason",
    accessorKey: "reason",
    header: "Причина",
    enableSorting: false,
    meta: { className: "w-2/5" },
    cell: ({ row }) => unvaluedReasonLabel(row.original.reason),
  },
  {
    id: "assignmentCount",
    accessorKey: "assignmentCount",
    header: "Доручень",
    enableSorting: false,
    meta: { className: "w-1/5", numeric: true },
    cell: ({ row }) => row.original.assignmentCount,
  },
  {
    id: "quantity",
    header: "Кількість",
    enableSorting: false,
    meta: { className: "w-2/5", numeric: true },
    cell: ({ row }) => `${formatQuantity(row.original.quantity)} ${row.original.unitCode}`,
  },
];
