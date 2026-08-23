"use client";

// Composition follows satnaing/shadcn-admin (MIT) —
// https://github.com/satnaing/shadcn-admin, `src/features/tasks/components/
// tasks-table.tsx` (the header/body/render/meta-className loop) and
// `src/tanstack-table.d.ts` (the `ColumnMeta` augmentation), both read at
// `main` on 2026-08-23. Styling is this system's token roles.
//
// THE REFERENCE IS ON TANSTACK TABLE v8 AND THIS FILE IS ON v9, so the
// composition is ADAPTED rather than copied. Every departure from
// shadcn-admin's shape below is a v9 requirement and says so at the line.
// The map used is the vendor's own, shipped inside the installed package:
// `node_modules/@tanstack/react-table/skills/migrate-v8-to-v9/SKILL.md`
// (`library_version: 9.1.2`), read on 2026-08-24 — not recalled.

import { useState, type ReactNode } from "react";
import {
  columnVisibilityFeature,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type CellData,
  type ColumnDef,
  type RowData,
  type SortingState,
  type TableFeatures,
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
 * TanStack Table for tables; this is the composition the reference builds on
 * it, reduced to the parts a screen in this product actually has today.
 *
 * WHAT IS DELIBERATELY NOT HERE YET, so its absence is scheduling and not a
 * gap. The reference's table is wrapped by `DataTableToolbar` (search +
 * faceted filters), `DataTablePagination` and `DataTableBulkActions`, and its
 * state is synced to the URL by `useTableUrlState`. None of the screens in
 * this product filters, paginates or selects rows: the assignments register
 * renders exactly what `GET /v1/projects/{id}/assignments` returned, in the
 * order that route already sorts it. Building the toolbar now would be four
 * components nobody can check against real content — the same argument
 * `index.ts` makes about the inventory being short on purpose.
 *
 * SORTING IS WIRED BUT OFF BY DEFAULT, and that is a decision rather than an
 * oversight. The `rowSortingFeature` and its row-model slot are registered, so
 * a column that sets `enableSorting: true` and a header that calls
 * `column.toggleSorting()` work with no further plumbing. It is off by default
 * because the two registers this file drives document their order as coming
 * from the server — «no client-side sort or filter of its own» — and because a
 * sort control in a column header is a 44px touch target inside a 128px cell
 * at 390px wide, which is the exact geometry `apps/app/qa/field.mjs`'s
 * register audit measures. Turning it on is a screen decision with a width
 * measurement attached, not a default.
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

/**
 * v9 REGISTERS FEATURES EXPLICITLY; v8 BUNDLED THEM ALL. The migration skill's
 * own first line of the breaking-change map: «`useReactTable(options)` →
 * `useTable({ ...options, features })`», and «`getCoreRowModel()` option →
 * Remove it; the core row model is automatic». Its named failure mode is worth
 * quoting because it is the one that wastes an afternoon: «An API is missing
 * because its feature was not registered, not because v9 removed it.»
 *
 * Two features, and each is here because a line below needs it:
 *
 * - `rowSortingFeature` + `sortedRowModel` — `state.sorting`,
 *   `onSortingChange` and `enableSorting` all live on this feature
 *   (`@tanstack/table-core/dist/features/row-sorting/rowSortingFeature.types.d.ts`,
 *   lines 175 and 199). Without it those options do not exist.
 * - `columnVisibilityFeature` — `row.getVisibleCells()` is declared on THIS
 *   feature, not on core
 *   (`.../features/column-visibility/columnVisibilityFeature.types.d.ts:70`).
 *   Nothing in this product toggles a column yet; `row.getAllCells()` would
 *   render identically today and would silently ignore a hidden column the
 *   day the reference's view-options menu arrives. Registering the feature
 *   costs one import and keeps the reference's own call.
 *
 * NOT registered, and each absence is load-bearing: `rowSelectionFeature`
 * (so `row.getIsSelected()` does not exist here — see the body), pagination,
 * filtering, faceting, grouping, pinning, sizing. `stockFeatures` would bundle
 * the lot; the skill's last checklist item is to audit it away, so it is never
 * introduced.
 */
export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

export type DataTableFeatures = typeof dataTableFeatures;

/**
 * v9 put `TFeatures` first on every public type — the skill's TypeScript
 * table: «`ColumnDef<TData>` → `ColumnDef<TFeatures, TData, TValue>`». A
 * caller should not have to name this package's feature set to describe its
 * own columns, so the alias binds it and callers write
 * `DataTableColumnDef<AssignmentSummary>[]` exactly as they wrote
 * `ColumnDef<AssignmentSummary>[]` under v8.
 */
export type DataTableColumnDef<
  TData extends RowData,
  TValue extends CellData = CellData,
> = ColumnDef<DataTableFeatures, TData, TValue>;

export type { SortingState };

/**
 * The augmentation is shadcn-admin's `src/tanstack-table.d.ts`, with v9's
 * type parameters. TypeScript requires an interface augmentation to declare
 * IDENTICAL type parameters — variance annotations included — so this list is
 * copied character for character from the declaration site,
 * `@tanstack/table-core/dist/types/ColumnDef.d.ts:17`. Getting it wrong is
 * `error TS2428: All declarations of 'ColumnMeta' must have identical type
 * parameters`, which is how the v8 form announced itself here.
 *
 * It lives inside this module rather than in a `.d.ts` beside it because
 * `component-contract.test.ts` requires every file in this directory to be
 * exported from `index.ts`, and a declaration file has nothing to export.
 */
declare module "@tanstack/react-table" {
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
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
 * ONE GENERIC, NOT TWO — a v9 correction, and the compiler's, not a
 * preference. `TableOptions<TFeatures, TData>` holds its columns at
 * `ColumnDef<TFeatures, TData, unknown>`, because a real column array is
 * heterogeneous: a description column and a quantity column do not share a
 * `TValue`. Carrying an unbound `TValue` on this component (as the v8 shape
 * did, where it was harmless) makes `ColumnDef<F, TData, TValue>` unassignable
 * to what `useTable` wants — «'unknown' is assignable to the constraint of
 * type 'TValue', but 'TValue' could be instantiated with a different subtype».
 * `CellData` is literally `unknown`
 * (`@tanstack/table-core/dist/types/type-utils.d.ts:5`), so nothing is lost:
 * a column that wants a typed accessor names its own `TValue` through
 * `DataTableColumnDef<TData, TValue>` and still fits the array.
 */
export type DataTableProps<TData extends RowData> = {
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  /** Rendered in a single full-width cell when `data` is empty. */
  empty: ReactNode;
  /** On the `<table>` itself — this is where a `min-w-*` floor belongs. */
  className?: string | undefined;
  /** Off by default; see the header. */
  enableSorting?: boolean | undefined;
  initialSorting?: SortingState | undefined;
};

export function DataTable<TData extends RowData>({
  columns, data, empty, className, enableSorting = false, initialSorting,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);

  // `useTable`, not `useReactTable`; `features` in the options; no
  // `getCoreRowModel()` — all three are the v9 construction shape.
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    state: { sorting },
    enableSorting,
    onSortingChange: setSorting,
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
                  {/* `<table.FlexRender header={header} />` is v9's own form
                    * and replaces the reference's
                    * `flexRender(header.column.columnDef.header,
                    * header.getContext())`. The standalone `flexRender` still
                    * works — the skill says so — but the component form is
                    * what the vendor's `getting-started` example writes, and
                    * it does not require this file to hold a live reference
                    * to `header.getContext()`, whose methods now live on a
                    * prototype and are lost by destructuring. */}
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length > 0 ? (
          // NO `data-state={row.getIsSelected() && "selected"}`, unlike the
          // reference. `getIsSelected` is declared on `rowSelectionFeature`
          // (`.../features/row-selection/rowSelectionFeature.types.d.ts:92`),
          // which is deliberately not registered because nothing here selects
          // a row. `TableRow` keeps its `data-[state=selected]` style, so the
          // day selection arrives the styling is already correct and only the
          // feature and this attribute have to be added.
          rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta;
                return (
                  <TableCell
                    key={cell.id}
                    numeric={meta?.numeric}
                    className={cx(meta?.className, meta?.tdClassName)}
                  >
                    <table.FlexRender cell={cell} />
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
