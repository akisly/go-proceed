import Link from "next/link";
import type { AssignmentSummary } from "@goproceed/contracts";
import { Table, Th, Td, Tr } from "@goproceed/ui/components";
import { assignmentStatusLabel } from "../../lib/assignment-status-labels";

/**
 * `dash/projects/[projectId]/assignments/page.tsx`'s landing content once at
 * least one assignment exists — the office register `04-role-pain-map.md`
 * screen 3 names ("Assignments — list + create", ПТВ, "reconstruction after
 * the fact; today this is SQL"), read-only half. D3 adds creation on top of
 * this list; this component renders exactly what `GET /v1/projects/
 * {projectId}/assignments` returns, in the order the route already sorts it
 * (`created_at desc, id`) — no client-side sort or filter of its own.
 *
 * TABLE, NOT A CARD LIST, unlike D0's `ProjectsList` — the reference pattern
 * `04-role-pain-map.md` names for this screen is shadcn-admin's `tasks`
 * table, and `packages/ui/src/components/Table.tsx`'s own kitchen-sink
 * example (`apps/landing/app/kitchen-sink/components/page.tsx`'s Case 04) is
 * exactly this shape: a scope column plus right-aligned numeric columns.
 *
 * EACH ROW LINKS TO `/dash/assignments/{assignmentId}` — Task 6's evidence
 * screen (`docs/superpowers/plans/2026-08-22-plan-d-d1-evidence-read.md`'s
 * file-structure table names that exact route), not yet built as of this
 * commit. Unlike `ProjectsList`'s deliberate refusal to link anywhere (its
 * own header: the D-later detail route "does not exist yet"), this link is
 * intentional forward wiring within the SAME plan slice — Task 6 is the very
 * next task, not a later one, and the task brief that ordered this list
 * states outright that the point of building it now is "so a ПТВ can find a
 * photo by assignment instead of scrolling a chat".
 *
 * STATUS IS PLAIN UKRAINIAN TEXT, NOT A `Chip`. `Chip`'s five tones
 * (ready/attention/blocked/review/idle) are used elsewhere in this system for
 * readiness/review states and, in the landing kitchen-sink and mock blocks,
 * for a handful of illustrative entity states — but no design decision in
 * this slice's brief or spec assigns a tone to any of
 * `work_assignments.status`'s five values, and "blocked" specifically already
 * carries a distinct financial meaning elsewhere in this product (blocked
 * value / blocked reasons, `04-role-pain-map.md`'s commercial-director row).
 * Inventing a tone mapping here would be exactly the kind of unverified,
 * plausible-sounding design decision this branch's review rounds have
 * already spent time correcting — see the task prompt's own warning. Plain
 * text still satisfies §4.1's "a status shown only by colour → colour PLUS
 * its `ui_uk` label" rule, because there is no colour to begin with.
 *
 * THE TABLE HAS A MINIMUM WIDTH AND ITS WRAPPER SCROLLS — ADDED IN THE D1
 * FINAL FIX WAVE, FOR A DEFECT MEASURED AT 360 AND 390. `Table` is
 * `w-full table-fixed`, so the four `Th` widths below are percentages of
 * whatever the wrapper is. MEASURED with the min-width removed and the app
 * rebuilt, by the audit named below: each `w-1/5` cell is 68px at 390 and 62px
 * at 360, and «ЗАПЛАНОВАНО» needs 118px, «ВИКОНАНО» 89px and — at 360 —
 * «СТАТУС» 65px. Eleven uppercase characters at `text-meta` (12px) with
 * `tracking-wide` (+0.08em), and ONE WORD, so there is no break opportunity:
 * it did not wrap, it overflowed its cell by 50px and ran into its neighbour.
 * ПТВ opening the register on a phone saw the column headings collide — on the
 * middle screen of the project → assignments → evidence chain this whole slice
 * exists to build.
 *
 * `min-w-160` (160 × `--spacing` 0.25rem = 640px, and
 * `.min-w-160{min-width:calc(var(--spacing) * 160)}` was confirmed present in
 * this route's own dash chunk after a rebuild) puts each `w-1/5` cell at 128px,
 * clear of the 118px the widest heading needs. The wrapper below is already
 * `overflow-x-auto`, so below 640px the TABLE scrolls inside the panel and the
 * PAGE does not scroll sideways — the two are different failures and only the
 * second is a layout defect. Chosen over the alternative
 * `packages/ui/src/components/Table.tsx`'s own ruling 3 names («on a phone the
 * register renders as cards instead — a different hierarchy, not a reflow»)
 * because that is a redesign with a design decision behind it, and no brief or
 * spec in this slice makes one; inventing the phone hierarchy here would be the
 * same unbacked guess this file already refuses two paragraphs above for `Chip`
 * tones. Ruling 3 stays open and stays true; this is the floor that stops the
 * register being broken until someone takes it.
 *
 * MEASURED, NOT REASONED, and re-measurable: `apps/app/qa/field.mjs`'s seventh
 * audit now opens `/dash/projects/{projectId}/assignments` at 1280, 390 and 360
 * and asserts, per `th`, that `scrollWidth <= clientWidth` — an overflowing
 * single word is exactly the case where those two differ — plus the usual
 * page-level sideways-scroll and touch-target checks. Until that audit was
 * added, no harness opened this route at all, which is why the §6 visual gate
 * (run against the evidence screen) could not have caught it.
 *
 * THE LABELS THEMSELVES LIVE IN `../../lib/assignment-status-labels.ts`, NOT
 * HERE — fix round 1 on this task's own commit asked for a schema-derived
 * fidelity test matching `membership-labels.test.ts`'s shape, which needs an
 * importable module the way `membership-labels.ts` is one; that file's own
 * header carries the reasoning for why the five values are NOT
 * `status.work_assignment.*` from `technical/copy-catalog.csv`.
 */

/** `null` only for `plannedQuantity` — an assignment need not carry a plan. */
function quantityCell(value: string | null, unitCode: string): string {
  return value === null ? "—" : `${value} ${unitCode}`;
}

export function AssignmentsList({ assignments }: { assignments: AssignmentSummary[] }) {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-6">
      <h1 className="text-h1 font-semibold text-ink">Доручення</h1>
      <div className="overflow-x-auto rounded-panel border border-line bg-surface">
        <Table className="min-w-160">
          <thead>
            <Tr>
              <Th className="w-2/5">Роботи</Th>
              <Th numeric className="w-1/5">Заплановано</Th>
              <Th numeric className="w-1/5">Виконано</Th>
              <Th className="w-1/5">Статус</Th>
            </Tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <Tr key={assignment.assignmentId}>
                <Td>
                  {/* THE ROW LINK IS A 44px TARGET ON A TOUCH DEVICE — added
                    * in the D1 final fix wave, and MEASURED rather than
                    * assumed: the register audit this wave added to
                    * `qa/field.mjs` reported «"Приклад-улаштування прокладки
                    * ка" 217x36» at both 390 and 360 on its very first run.
                    * An inline `<a>` is only as tall as its line boxes, so a
                    * two-line description came to 36px — under WCAG 2.5.5's
                    * floor, on the one control this screen has per row.
                    *
                    * `flex items-center` makes the anchor the cell's full
                    * width (which is also what someone aiming at a register
                    * row expects to be able to tap), and the height floor is
                    * applied under `touch:` ONLY, which is
                    * `@media (pointer: coarse)`
                    * (`packages/ui/src/base.css:49`). That is the same idiom
                    * every control in `packages/ui` uses — `Button`,
                    * `Input`, `Avatar`, `Chip` all read
                    * `h-(--gp-control-height-desk)
                    * touch:h-(--gp-control-height-touch)` — and it is the
                    * exact condition the harness itself checks under
                    * (`if (touch)`, widths below 768). Applying the 44px
                    * unconditionally, as `dash-shell/projects-list.tsx` does
                    * for its own row link, would add 26px to every row of a
                    * dense desk table for a constraint the desk does not
                    * have; §3.3 question 1 says this surface is dense.
                    * The token, not the number: 44px is
                    * `--gp-control-height-touch` and a literal stops tracking
                    * it. */}
                  <Link
                    href={`/dash/assignments/${assignment.assignmentId}`}
                    className="flex items-center font-medium text-ink hover:underline touch:min-h-(--gp-control-height-touch)"
                  >
                    {assignment.description}
                  </Link>
                  {assignment.workCode && (
                    <span className="block text-meta text-ink-muted">{assignment.workCode}</span>
                  )}
                </Td>
                <Td numeric>{quantityCell(assignment.plannedQuantity, assignment.unitCode)}</Td>
                <Td numeric>{quantityCell(assignment.effectiveQuantity, assignment.unitCode)}</Td>
                <Td>{assignmentStatusLabel(assignment.status)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
