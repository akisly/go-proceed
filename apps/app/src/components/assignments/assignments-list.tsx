import Link from "next/link";
import type { AssignmentSummary } from "@goproceed/contracts";
import { Table, Th, Td, Tr } from "@goproceed/ui/components";

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
 * THE FIVE STATUS LABELS ARE NOT `status.work_assignment.*` FROM
 * `technical/copy-catalog.csv`. Those eight existing rows (`planned`,
 * `assigned`, `accepted`, `in_progress`, `submitted`, `returned`, `completed`,
 * `cancelled`) are "canonical, derived from state-catalog" — but
 * `technical/state-catalog.csv` and `technical/schema.sql` are explicitly
 * non-normative (`docs/README.md`: "the flat CSV catalogs are not v0.1
 * implementation authority"), and `technical/schema.sql:419`'s own
 * `work_assignments` table has a DIFFERENT shape entirely (an eight-value
 * `state` column, `organization_id`/`client_operation_id`/`assigned_user_id`)
 * from the APPLIED migration this route actually queries
 * (`supabase/migrations/0015_execution_evidence_module.sql:87-88`: a
 * five-value `status` column — `draft`/`active`/`paused`/`completed`/
 * `cancelled` — confirmed by reading the CHECK constraint directly, not
 * assumed from either catalog). `technical/states/state-catalog.csv:25-29`'s
 * `assignment.status` rows match the applied five exactly but carry no
 * `ui_uk` column. New rows below (`dash.assignment_status.*`) label the real,
 * applied five; the stale eight-value set is left untouched — reconciling it
 * with the applied schema is a documentation task well outside this slice.
 */
const STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze({
  draft: "Чернетка",
  active: "Активний",
  paused: "На паузі",
  completed: "Завершено",
  cancelled: "Скасовано",
});

/**
 * `Object.hasOwn`, not `STATUS_LABELS[status] ?? status` — same reachable-
 * prototype-property hazard `membershipStatusLabel` in
 * `apps/app/src/lib/membership-labels.ts` is pinned against, and the fallback
 * for the same reason: `status` is `z.string()`-wide server text, not this
 * five-value enum enforced client-side, so an unrecognised value renders
 * untranslated rather than blank or thrown.
 */
function statusLabel(status: string): string {
  return Object.hasOwn(STATUS_LABELS, status) ? STATUS_LABELS[status]! : status;
}

/** `null` only for `plannedQuantity` — an assignment need not carry a plan. */
function quantityCell(value: string | null, unitCode: string): string {
  return value === null ? "—" : `${value} ${unitCode}`;
}

export function AssignmentsList({ assignments }: { assignments: AssignmentSummary[] }) {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-6">
      <h1 className="text-h1 font-semibold text-ink">Доручення</h1>
      <div className="overflow-x-auto rounded-panel border border-line bg-surface">
        <Table>
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
                  <Link
                    href={`/dash/assignments/${assignment.assignmentId}`}
                    className="font-medium text-ink hover:underline"
                  >
                    {assignment.description}
                  </Link>
                  {assignment.workCode && (
                    <span className="block text-meta text-ink-muted">{assignment.workCode}</span>
                  )}
                </Td>
                <Td numeric>{quantityCell(assignment.plannedQuantity, assignment.unitCode)}</Td>
                <Td numeric>{quantityCell(assignment.effectiveQuantity, assignment.unitCode)}</Td>
                <Td>{statusLabel(assignment.status)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
