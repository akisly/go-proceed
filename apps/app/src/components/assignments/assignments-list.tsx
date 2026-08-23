"use client";

import type { AssignmentSummary } from "@goproceed/contracts";
import { DataTable } from "@goproceed/ui/components";
import { assignmentColumns } from "./assignments-columns";

/**
 * `dash/projects/[projectId]/assignments/page.tsx`'s landing content once at
 * least one assignment exists — the office register `04-role-pain-map.md`
 * screen 3 names ("Assignments — list + create", ПТВ, "reconstruction after
 * the fact; today this is SQL"), read-only half. D3 adds creation on top of
 * this list; this component renders exactly what `GET /v1/projects/
 * {projectId}/assignments` returns, in the order the route already sorts it
 * (`created_at desc, id`) — no client-side sort or filter of its own.
 *
 * ON TANSTACK TABLE SINCE 2026-08-23, and the four columns now live in
 * `assignments-columns.tsx`. What used to be here — a hand-written
 * `thead`/`tbody`/`map` over `Table/Th/Td/Tr` — was one of three such copies
 * in this product, none of which shared a line of behaviour. The owner's
 * instruction was TanStack for tables and shadcn one-to-one for components;
 * `packages/ui/src/components/DataTable.tsx` is that composition, taken from
 * satnaing/shadcn-admin's own `tasks-table.tsx`, and this file is now the
 * screen-shaped part: a heading, a panel, and the data.
 *
 * IT IS A CLIENT COMPONENT NOW, and that is a real cost worth naming rather
 * than leaving to be discovered. `useReactTable` is a hook, so any TanStack
 * table renders on the client; `AssignmentSummary[]` is plain JSON and crosses
 * the boundary unchanged, and the column definitions — which contain
 * functions and therefore cannot cross it — are imported on the client side of
 * it. The markup is still server-rendered on first paint (Next renders client
 * components on the server too), which is why the QA harness still finds four
 * `th` elements in the initial HTML.
 *
 * EACH ROW LINKS TO `/dash/assignments/{assignmentId}` — the evidence screen.
 * The link, and its measured 44px touch floor, moved into the column
 * definition with the cell that renders it; that file carries the
 * measurement.
 *
 * THE TABLE HAS A MINIMUM WIDTH AND ITS CONTAINER SCROLLS — MEASURED AT 360
 * AND 390, AND THE MEASUREMENT SURVIVES THE MIGRATION UNCHANGED because
 * neither the four column widths nor the heading metrics changed. `Table` is
 * `w-full table-fixed`, so the four widths in `assignments-columns.tsx` are
 * percentages of whatever the container is. MEASURED with the min-width
 * removed and the app rebuilt: each `w-1/5` cell is 68px at 390 and 62px at
 * 360, and «ЗАПЛАНОВАНО» needs 118px, «ВИКОНАНО» 89px and — at 360 —
 * «СТАТУС» 65px. Eleven uppercase characters at `text-meta` (12px) with
 * `tracking-wide` (+0.08em), and ONE WORD, so there is no break opportunity:
 * it did not wrap, it overflowed its cell by 50px and ran into its neighbour.
 * ПТВ opening the register on a phone saw the column headings collide — on the
 * middle screen of the project → assignments → evidence chain.
 *
 * `min-w-160` (160 × `--spacing` 0.25rem = 640px) puts each `w-1/5` cell at
 * 128px, clear of the 118px the widest heading needs. THE `overflow-x-auto`
 * MOVED: it used to be on the wrapper below, and it is now `Table`'s own
 * container div — shadcn's table ships one (`data-slot="table-container"`),
 * and keeping a second on the wrapper would nest two scroll containers. The
 * wrapper keeps `overflow-hidden` so the table's edges stay inside the
 * rounded panel, which is exactly what the reference's own wrapper
 * (`overflow-hidden rounded-md border`) does. Below 640px the TABLE scrolls
 * inside the panel and the PAGE does not scroll sideways — the two are
 * different failures and only the second is a layout defect.
 *
 * MEASURED, NOT REASONED, and re-measurable: `apps/app/qa/field.mjs`'s
 * register audit opens `/dash/projects/{projectId}/assignments` at 1280, 390
 * and 360 and asserts, per `th`, that `scrollWidth <= clientWidth` — an
 * overflowing single word is exactly the case where those two differ — plus
 * the page-level sideways-scroll and touch-target checks. That audit is what
 * proves this migration did not move a pixel that mattered.
 *
 * `Table.tsx`'s ruling 3 («on a phone the register renders as cards instead —
 * a different hierarchy, not a reflow») stays open and stays true; the
 * min-width is the floor that stops the register being broken until someone
 * takes that decision.
 *
 * THE `empty` BRANCH IS UNREACHABLE FROM THIS ROUTE and is still required by
 * `DataTable`. `page.tsx` renders `NoAssignmentsEmptyState` when the list is
 * empty and only reaches this component with at least one row — the empty
 * register is a different screen with different copy, not a table with no
 * rows. The sentence below is what a caller that forgot that would see.
 */
export function AssignmentsList({ assignments }: { assignments: AssignmentSummary[] }) {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-6">
      <h1 className="text-h1 font-semibold text-ink">Доручення</h1>
      <div className="overflow-hidden rounded-panel border border-line bg-surface">
        <DataTable
          columns={assignmentColumns}
          data={assignments}
          className="min-w-160"
          empty="Немає доручень."
        />
      </div>
    </div>
  );
}
