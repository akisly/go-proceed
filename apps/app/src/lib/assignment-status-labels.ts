/**
 * `work_assignments.status` → the Ukrainian label `assignments-list.tsx` may
 * render. Extracted out of that file (fix round 1 on Task 5) so this map has
 * the same shape `membership-labels.ts` does: a standalone module a
 * schema-derived test can import, rather than a `const` a component file
 * would otherwise keep private.
 *
 * WHY A MAP AND NOT A `ui_uk` COLUMN ON THE WIRE — same reasoning
 * `membership-labels.ts`'s own header gives: `packages/contracts/src/
 * assignments.ts` types `AssignmentSummary.status` as a bare `string`, not an
 * enum, so the Ukrainian word has to live somewhere the server does not send
 * it from.
 *
 * THE FIVE VALUES ARE NOT `status.work_assignment.*` FROM `technical/
 * copy-catalog.csv`. Those eight existing rows (`planned`, `assigned`,
 * `accepted`, `in_progress`, `submitted`, `returned`, `completed`,
 * `cancelled`) are labelled "canonical, derived from state-catalog" — but
 * `technical/state-catalog.csv` and `technical/schema.sql` are explicitly
 * non-normative (`docs/README.md`: "the flat CSV catalogs are not v0.1
 * implementation authority"), and `technical/schema.sql:419`'s own
 * `work_assignments` table has a DIFFERENT shape entirely (an eight-value
 * `state` column, `organization_id`/`client_operation_id`/`assigned_user_id`)
 * from the APPLIED migration this screen's route actually queries. The real,
 * live CHECK constraint is `supabase/migrations/
 * 0015_execution_evidence_module.sql:86-87`:
 *
 *   status text not null default 'active'
 *     check (status in ('draft','active','paused','completed','cancelled'))
 *
 * — five values, read directly, not assumed from either catalog — and no
 * later migration alters it (checked: no `alter table … work_assignments …
 * status` anywhere under `supabase/migrations/`, and migration 0043's
 * `work_assignments.baseline_status` is a DIFFERENT column). `technical/
 * states/state-catalog.csv:25-29`'s `assignment.status` rows match these five
 * exactly but carry no `ui_uk` column to translate from.
 *
 * `technical/copy-catalog.csv`'s `dash.assignment_status.*` rows are the new,
 * separately-named keys this map's fidelity test checks against — the stale
 * `status.work_assignment.*` set is deliberately left alone; overwriting it
 * would corrupt a record of the OTHER (unapplied) design that someone may yet
 * reconcile with this one.
 *
 * THE FIDELITY TEST READS `pg_constraint`, NOT THIS COMMENT AND NOT MIGRATION
 * TEXT — fix round 2 on Task 5. The migration excerpt above is provenance
 * (where the constraint was FIRST written), not the check's live source of
 * truth: `apps/app/tests/assignment-status-labels.int.test.ts` queries the
 * running database directly, the same move `evidence-labels.int.test.ts`
 * made one task earlier for `ORIGIN_METHOD_LABELS` after a migration-text
 * version of this exact test shape stayed green while that sibling map
 * shipped a raw identifier to a real user. A future migration that widens
 * this CHECK — in any spelling, including the `= ANY (ARRAY[…])` form
 * Postgres itself normalises every CHECK to — is caught there, not by
 * re-reading this docblock.
 *
 * TRANSLATIONS REUSE THIS CATALOG'S OWN EXISTING VOCABULARY FOR THE SAME
 * ENGLISH CONCEPT, rather than being invented fresh: `Чернетка` (draft) and
 * `На паузі` (paused) already label `project`/`contract`/`integration`
 * domains identically; `Активний` matches `status.project.active` /
 * `status.contract.active`; `Завершено` / `Скасовано` reuse the existing
 * (stale-enum) `work_assignment` domain's own words for those two concepts,
 * which happen to be spelled identically regardless of which state machine
 * is meant.
 */
export const ASSIGNMENT_STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze({
  draft: "Чернетка",
  active: "Активний",
  paused: "На паузі",
  completed: "Завершено",
  cancelled: "Скасовано",
});

/**
 * `Object.hasOwn`, not `ASSIGNMENT_STATUS_LABELS[status] ?? status` — same
 * reachable-prototype-property hazard `membershipStatusLabel` in this same
 * directory is pinned against (`ASSIGNMENT_STATUS_LABELS["toString"]`
 * resolves up the prototype chain to a function, which is not nullish, so
 * `??` would never fire). The fallback returns the raw value rather than
 * blank or thrown: `status` is `z.string()`-wide server text, not this
 * five-value enum enforced client-side, so a server one deploy ahead can
 * legitimately send a value this map has not learned yet.
 */
export function assignmentStatusLabel(status: string): string {
  return Object.hasOwn(ASSIGNMENT_STATUS_LABELS, status)
    ? ASSIGNMENT_STATUS_LABELS[status]!
    : status;
}
