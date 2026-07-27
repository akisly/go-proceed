import type { WorkItem } from './types'

/**
 * THE single definition of "money at risk" (review 07 · B2).
 *
 * Three surfaces previously disagreed. /app and /app/evidence counted
 * evidence_missing and reported 612 300 ₴; /demo step 5 called the amber-tone
 * bucket at risk and reported 697 900 ₴. Both were internally correct, neither
 * was labelled, and an estimator reconciling the two got no explanation. On a
 * product whose only asset is honesty about numbers, that is the worst class of
 * defect available.
 *
 * The confirmed definition: **a work item is at risk when at least one required
 * evidence item is missing.** That is precisely what the `evidence_missing`
 * readiness state models — work that has been done but cannot currently be
 * evidenced.
 *
 * Explicitly NOT at risk, however incomplete they look:
 *   - `not_started`      — nothing has been built, so nothing can be unevidenced
 *   - `review_pending`   — the evidence exists and is awaiting internal review
 *   - work scheduled for a later period
 *
 * Counting rule: **each affected work item counts exactly once**, regardless of
 * how many of its requirements are outstanding. `/app/evidence` renders one
 * block per requirement, so summing there without this rule double-counts any
 * row carrying more than one gap.
 *
 * Wording rule for every surface that consumes this: the figure is money whose
 * evidence is currently missing, not money that will certainly go unpaid. Keep
 * the phrasing conditional («…доки вимоги не закрито»). Never state or imply
 * that payment will be withheld.
 *
 * Every surface that says «під ризиком» must call this. Do not re-derive it.
 */
export function isAtRisk(item: WorkItem): boolean {
  return item.readiness === 'evidence_missing'
}

/** The at-risk rows, each appearing exactly once. */
export function atRiskItems(items: readonly WorkItem[]): readonly WorkItem[] {
  return items.filter(isAtRisk)
}

/** Total value of the at-risk rows. Returns 0 for an empty set. */
export function atRiskTotalUah(items: readonly WorkItem[]): number {
  return atRiskItems(items).reduce((total, item) => total + item.valueUah, 0)
}
