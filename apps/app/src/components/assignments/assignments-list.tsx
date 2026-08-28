"use client";

import Link from "next/link";
import type { AssignmentSummary } from "@goproceed/contracts";
import { Button, DataTable } from "@goproceed/ui/components";
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
 * On TanStack Table since 2026-08-23; the columns live in
 * `assignments-columns.tsx`, and the row link and its touch floor moved into
 * the cell that renders them.
 *
 * IT IS A CLIENT COMPONENT. `useTable` is a hook, so a TanStack table renders
 * on the client; the column definitions hold functions, so they are imported
 * from a `"use client"` module. Next still server-renders the markup on first
 * paint. `unvalued-register.tsx` is on this side of the boundary too — the
 * alternative left an RSC serialization boundary that no browser in this
 * repository exercises.
 *
 * `min-w-160` IS A MEASURED FLOOR, NOT A ROUND NUMBER. `Table` is
 * `w-full table-fixed`, so the column widths are percentages of the container
 * and a narrow container makes an unbreakable uppercase Ukrainian heading
 * overflow its own cell rather than wrap. That defect shipped once here; the
 * measurement behind the floor is in `TODOS.md`, and
 * `apps/app/qa/field.mjs`'s register audit re-checks it per `th` at 1280, 390
 * and 360 on every run.
 *
 * The scroll container is `Table`'s own (`data-slot="table-container"`); the
 * wrapper below keeps `overflow-hidden` so the table's edges stay inside the
 * rounded panel. Below the floor the TABLE scrolls and the PAGE does not,
 * which is the intended behaviour and not the defect.
 *
 * `Table.tsx`'s ruling 3 — on a phone the register should render as cards, a
 * different hierarchy rather than a reflow — stays open; the min-width is what
 * holds until someone takes that decision.
 *
 * `page.tsx` renders `NoAssignmentsEmptyState` for an empty list, so
 * `DataTable`'s `empty` is not what a reader of this route sees.
 *
 * `projectId` IS NEW, FOR THE CREATE LINK ABOVE THE TABLE — Plan D slice A.
 * `Button asChild` wraps a `Link`, not an `onClick` navigation, so the
 * control is a real anchor (right-click "open in new tab", crawlable, no JS
 * required to follow it) that merely looks like a button — `ProjectOverviewHeader`'s
 * own `Button asChild`+`Link` pair is the precedent. The height comes from
 * `Button`'s own `SIZE` table, which ties every size to
 * `--gp-control-height-touch` (44px) under the `touch` variant regardless of
 * which size is chosen — so the 44px floor `qa/field.mjs`'s register audit
 * checks holds without a size prop of its own.
 */
export function AssignmentsList(
  { assignments, projectId }: { assignments: AssignmentSummary[]; projectId: string },
) {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-h1 font-semibold text-ink">Доручення</h1>
        <Button asChild>
          <Link href={`/dash/projects/${projectId}/assignments/new`}>Нове доручення</Link>
        </Button>
      </div>
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
