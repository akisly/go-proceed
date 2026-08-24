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
 * order that route already sorts it. Building the toolbar now would add
 * components nobody can check against real content — the same argument
 * `index.ts` makes about the inventory being short on purpose.
 *
 * SORTING IS WIRED BUT OFF, and turning it on takes more than setting
 * `enableSorting: true` on a column. `column_getCanSort` ANDs the column flag,
 * the TABLE flag — which this component defaults to `false` — and
 * `!!column.accessorFn`, so a display column with only an `id` and a `cell`
 * can never sort whatever either flag says. A caller enabling sorting has to
 * pass `enableSorting` here as well and give the column an accessor; for a
 * `numeric(20,6)` quantity that also means choosing text or numeric ordering.
 *
 * It is off by default because the registers this component drives take their
 * order from the server, and because a sort control in a column header is a
 * touch target inside a narrow cell on a phone — the geometry
 * `apps/app/qa/field.mjs`'s register audit measures.
 *
 * `meta.numeric` IS THE BRIDGE between the reference's convention and this
 * system's second ruling. shadcn-admin's `ColumnMeta` carries `className`,
 * `thClassName` and `tdClassName`; `Table.tsx`'s ruling 2 says a numeric
 * column is right-aligned AND tabular and that the two cannot be applied
 * apart. Expressing that as a boolean on the column — rather than as a
 * `className` string a caller can half-write — keeps the ruling in one place
 * and still leaves the reference's `className` slots available for
 * everything else, chiefly the `table-fixed` column widths.
 */

/**
 * v9 registers features explicitly where v8 bundled them; an API that looks
 * missing is usually a feature that was not registered. Two are registered
 * here because a line below needs each: `rowSortingFeature` (with its
 * row-model slot) owns `state.sorting`, `onSortingChange` and `enableSorting`,
 * and `columnVisibilityFeature` owns `row.getVisibleCells()`. Both ownerships
 * read off the feature's own `types.d.ts` under
 * `@tanstack/table-core/dist/features`.
 *
 * `rowSelectionFeature` is deliberately absent, so `row.getIsSelected()` does
 * not exist in the body below. So are pagination, filtering, faceting,
 * grouping, pinning and sizing. `stockFeatures` would bundle them all and the
 * vendor's migration skill ends by telling you to audit it away, so it is
 * never introduced.
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
 * ONE GENERIC, NOT TWO. `TableOptions` holds its columns at
 * `ColumnDef<TFeatures, TData, unknown>` because a real column array is
 * heterogeneous, and an unbound `TValue` on this component is unassignable to
 * that. The cost: a column declared at a narrowed `TValue` does not fit this
 * array (`error TS2375` under `exactOptionalPropertyTypes`). Columns here are
 * written at the default and read their data through `row.original`, which is
 * fully typed. Preserving a per-column `TValue` needs
 * `columnHelper.columns([...])`, which is a different composition.
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
                    * works and the migration skill says so outright; the
                    * component form is preferred because the vendor prefers
                    * it — «Prefer `<table.FlexRender cell={cell} />` …» in the
                    * skill's rendering section, and it is what the
                    * `getting-started` example writes. That is the whole
                    * reason. An earlier version of this comment invented a
                    * technical advantage about `getContext()` and prototypes;
                    * there is none — both forms call `header.getContext()`
                    * through the instance. */}
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
