"use client";

// Composition follows satnaing/shadcn-admin (MIT) —
// https://github.com/satnaing/shadcn-admin, `src/features/tasks/components/
// tasks-table.tsx` (the header/body/flexRender/meta-className loop) and
// `src/tanstack-table.d.ts` (the `ColumnMeta` augmentation), both read at
// `main` on 2026-08-23. Styling is this system's token roles.

import { useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { cx } from "./cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";

/**
 * ONE table behaviour, defined once.
 *
 * Before this file, every register in this product was hand-written `<table>`
 * markup: the assignments register and the unvalued register each repeated the
 * same `thead`/`tbody`/`map` shape, each carried its own column widths as
 * inline `className`s on `Th`, and neither had column definitions, sorting, or
 * anything else a second screen could reuse. The owner's instruction was
 * TanStack Table for tables; this is the composition the reference — the
 * `tasks-table.tsx` cited above — builds on it, reduced to the parts a screen
 * in this product actually has today.
 *
 * WHAT IS DELIBERATELY NOT HERE YET, so its absence is scheduling and not a
 * gap. The reference's table is wrapped by `DataTableToolbar` (search +
 * faceted filters), `DataTablePagination` and `DataTableBulkActions`, and its
 * state is synced to the URL by `useTableUrlState`. None of the three screens
 * in this product filters, paginates or selects rows: the assignments register
 * renders exactly what `GET /v1/projects/{id}/assignments` returned, in the
 * order that route already sorts it. Building the toolbar now would be four
 * components nobody can check against real content — the same argument
 * `index.ts` makes about the inventory being short on purpose.
 *
 * SORTING IS WIRED BUT OFF BY DEFAULT, and that is a decision rather than an
 * oversight. `getSortedRowModel` and the `sorting` state are here, so a column
 * that sets `enableSorting: true` and a header that calls
 * `column.toggleSorting()` work with no further plumbing. It is off by default
 * because the two registers this commit migrates document their order as
 * coming from the server — «no client-side sort or filter of its own» — and
 * because a sort control in a column header is a 44px touch target inside a
 * 128px cell at 390px wide, which is the exact geometry
 * `apps/app/qa/field.mjs`'s register audit measures. Turning it on is a screen
 * decision with a width measurement attached, not a default.
 *
 * `meta.numeric` IS THE BRIDGE between the reference's convention and this
 * system's second ruling. shadcn-admin's `ColumnMeta` carries `className`,
 * `thClassName` and `tdClassName`; `Table.tsx`'s ruling 2 says a numeric
 * column is right-aligned AND tabular and that the two cannot be applied
 * apart. Expressing that as a boolean on the column — rather than as a
 * `className` string a caller can half-write — keeps the ruling in one place
 * and still leaves the reference's three string slots available for
 * everything else, chiefly the `table-fixed` column widths.
 */
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Applied to both the `th` and the `td`. Column widths live here. */
    className?: string;
    /** `th` only. */
    thClassName?: string;
    /** `td` only. */
    tdClassName?: string;
    /** Right-aligned and tabular, together — `Table.tsx`'s ruling 2. */
    numeric?: boolean;
  }
}

/**
 * Re-exported so a consumer can describe its columns without declaring a
 * direct dependency on TanStack — `apps/landing`'s kitchen sink renders a
 * DataTable and has no business installing a table engine to name a type.
 * A package that owns the composition owns the type its callers write against.
 */
export type { ColumnDef, SortingState } from "@tanstack/react-table";

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Rendered in a single full-width cell when `data` is empty. */
  empty: ReactNode;
  /** On the `<table>` itself — this is where a `min-w-*` floor belongs. */
  className?: string | undefined;
  /** Off by default; see the header. */
  enableSorting?: boolean | undefined;
  initialSorting?: SortingState | undefined;
};

export function DataTable<TData, TValue>({
  columns, data, empty, className, enableSorting = false, initialSorting,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    enableSorting,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <Table className={className}>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const meta = header.column.columnDef.meta;
              return (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  numeric={meta?.numeric}
                  className={cx(meta?.className, meta?.thClassName)}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length > 0 ? (
          rows.map((row) => (
            <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta;
                return (
                  <TableCell
                    key={cell.id}
                    numeric={meta?.numeric}
                    className={cx(meta?.className, meta?.tdClassName)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center text-ink-muted">
              {empty}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
