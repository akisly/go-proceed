import type { UnvaluedReason } from "@goproceed/domain";

/**
 * `unvaluedRegisterRow.reason` → the Ukrainian label the money screen's
 * unvalued register renders (INV-038: "missing price and zero price are
 * distinct; missing is unvalued and excluded from numeric VaR").
 *
 * NO SCHEMA-DERIVED FIDELITY TEST HERE, AND THAT IS A CHECKED DECISION, NOT
 * AN OMISSION — read before assuming this file is missing the pattern
 * `evidence-kind-labels.ts`/`norm-ref-labels.ts` both carry. `unvaluedReason`
 * (`packages/domain/src/valuation.ts:122-127`) is a PURE FUNCTION over
 * `WorkItemValuation.taxMode`/`valuationBasis`/`unitPriceState`, not a value
 * read off a stored column at the point this screen consumes it — unlike
 * `evidence_kind` or `norm_ref_verification`, which this route reads directly
 * off `requirement_occurrences`. `supabase/migrations/
 * 0015_execution_evidence_module.sql:209-211` does carry a CHECK naming the
 * identical two literals (`unvalued_reason in ('unknown_tax_basis',
 * 'missing_unit_price')`) — but that CHECK guards `public.
 * valuation_allocations.unvalued_reason`, a DIFFERENT column on a WRITE path
 * this screen never reads (`blocked-value.ts`'s own header: "COMPUTED, NOT
 * READ"). A `pg_constraint` test against that column would verify a
 * vocabulary this screen does not consume, while reading as though it
 * verified the one it does — the exact "a passing test can defend the
 * defect" shape this repository has already been burned by once. The real
 * guard here is TypeScript exhaustiveness: `UnvaluedReason` is a two-literal
 * union (`packages/domain/src/valuation.ts`) and `unvaluedRegisterRow.reason`
 * is the matching two-value `z.enum` (`packages/contracts/src/
 * blocked-value.ts`), so this `Record` typed against the union is a compile
 * error the day either side gains a third value — which is the same
 * protection a database CHECK gives a stored column, applied to the actual
 * source of this value.
 */
export const UNVALUED_REASON_LABELS: Readonly<Record<UnvaluedReason, string>> = Object.freeze({
  missing_unit_price: "немає ціни за одиницю",
  unknown_tax_basis: "невідома податкова база",
});

export function unvaluedReasonLabel(reason: UnvaluedReason): string {
  return UNVALUED_REASON_LABELS[reason];
}
