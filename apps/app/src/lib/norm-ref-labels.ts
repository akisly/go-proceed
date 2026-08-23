import type { VerificationTagValue } from "@goproceed/contracts";

/**
 * `requirement_occurrences.norm_ref_verification` → the Ukrainian tag a
 * `normRef` citation carries beside its text (D2's money screen, INV-073:
 * "`normRef` travels with its verification tag and its source or not at all
 * — never render the text without both").
 *
 * A REAL TWO-VALUE CHECK — `check (norm_ref_verification in
 * ('VERIFIED_PRIMARY','VERIFIED_SECONDARY'))`
 * (`supabase/migrations/0043_the_obligation_before_the_covering.sql:588-589`,
 * on `public.requirement_occurrences`, the exact table/column
 * `apps/app/src/lib/readiness.ts:337-339` reads into `EvaluatedOccurrence.
 * normRefVerification`, which `blockedReasonFor` (`readiness.ts:647-650`)
 * carries into `blockedReason.normRef.verification` unchanged). `UNVERIFIED`
 * is deliberately absent from the vocabulary
 * (`packages/contracts/src/requirement-library.ts`'s own header: "An
 * unverified string must never be shown as normative, and the cheapest
 * guarantee is that it cannot be stored").
 *
 * WHAT THE TWO VALUES MEAN, so the label is not a guess:
 * `VERIFIED_PRIMARY` rests on a direct read of the official standard text;
 * `VERIFIED_SECONDARY` is the DOWNGRADE state — "a re-fetch that does not
 * reproduce the same bytes must downgrade every row it touches to
 * `VERIFIED_SECONDARY`" (same header). Both are still shown as normative —
 * the vocabulary's whole point is that only these two ever reach a screen —
 * so the label distinguishes source strength, not trustworthiness.
 *
 * TYPED EXHAUSTIVE, matching `evidence-kind-labels.ts`'s own shape, and
 * checked against the running database the same way
 * (`apps/app/tests/norm-ref-labels.int.test.ts`), for the reason that
 * file's own header gives.
 */
export const NORM_REF_VERIFICATION_LABELS: Readonly<Record<VerificationTagValue, string>> =
  Object.freeze({
    VERIFIED_PRIMARY: "перевірено за першоджерелом",
    VERIFIED_SECONDARY: "перевірено за вторинним джерелом",
  });

export function normRefVerificationLabel(tag: VerificationTagValue): string {
  return NORM_REF_VERIFICATION_LABELS[tag];
}
