/**
 * `blockedReason.awaitingApproverRole` → the Ukrainian label
 * `blocked-reasons-list.tsx` renders in its «Хто вирішує» cell — fix round
 * 1, IMPORTANT 3.
 *
 * WHY THIS IS A `(role: string): string` WITH A RAW FALLBACK, MATCHING
 * `membershipRoleLabel` (`membership-labels.ts`), AND NOT AN EXHAUSTIVE MAP
 * WITH A `pg_constraint` FIDELITY TEST — the distinction the previous round
 * missed. `approver_role` genuinely carries no closed vocabulary: every
 * table it lives on constrains it with only a non-blank CHECK
 * (`requirement_occurrences_approver_role_check`,
 * `supabase/migrations/0052_the_whitespace_that_counted_as_content.sql:
 * 144-145`), never an enumerated `in (...)` list, so there is no
 * `pg_constraint` a fidelity test could read — that absence is what the
 * previous round's comment argued, correctly. What it argued WRONG is the
 * conclusion drawn from it: "no closed vocabulary" rules out a
 * schema-derived fidelity test, not a label. `membershipRoleLabel` is the
 * exact precedent for a field this shape — `packages.memberships.role` is
 * `z.string()` on the wire too, its own map is a best-effort `Record<string,
 * string>`, and its fallback returns the raw value for anything unlearned,
 * "ugly and truthful," rather than leaving every value untranslated because
 * some of them cannot be enumerated in advance.
 *
 * ONE KNOWN VALUE TODAY: `technical_supervisor` — the only literal this
 * repository's own fixtures actually use
 * (`apps/app/tests/helpers/fixtures.ts:234`,
 * `apps/app/tests/helpers/manual-baseline.ts:180`), and the concept the
 * catalog already names: `dash.evidence.recipient_role_placeholder` ships
 * «технічний нагляд» for the identical real-world role (issue-review-
 * link.tsx's own placeholder). Reused rather than re-translated, matching
 * `assignment-status-labels.ts`'s own rule of reusing the catalog's existing
 * vocabulary for the same concept.
 *
 * NO OTHER VALUE IS SPECULATED. `approver_role` is free text a requirement-
 * template author types per requirement — there is no roster this map could
 * read to learn a second value honestly, and inventing plausible-sounding
 * Ukrainian job titles for slugs that appear nowhere in this codebase would
 * risk shipping a WRONG translation under an authoritative-looking label,
 * which is worse than the raw fallback it would replace. Add an entry here
 * the day a second real value is observed, the same way `ORIGIN_METHOD_
 * LABELS` grew its seventh entry.
 */
export const APPROVER_ROLE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  technical_supervisor: "технічний нагляд",
});

/**
 * `Object.hasOwn`, NOT `APPROVER_ROLE_LABELS[role] ?? role` — same
 * reachable-prototype-property hazard `membershipRoleLabel` is pinned
 * against (`APPROVER_ROLE_LABELS["toString"]` resolves up the prototype
 * chain to a function, which `??` would never treat as nullish).
 */
export function approverRoleLabel(role: string): string {
  return Object.hasOwn(APPROVER_ROLE_LABELS, role) ? APPROVER_ROLE_LABELS[role]! : role;
}
