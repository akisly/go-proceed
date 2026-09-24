// Deliberate duplicate of apps/app/src/lib/norm-ref-labels.ts, which the
// office's act and the Telegram cards use: the labels stay byte-identical, and
// norm-ref-labels.test.ts compares them with the app's file.

/**
 * `normRef.verification` → the Ukrainian tag a citation carries beside its
 * text (INV-073: "`normRef` travels with its verification tag and its source
 * or not at all — never render the text without both").
 *
 * Kept in sync BY HAND with `packages/contracts/src/requirement-library.ts`'s
 * `verificationTag` — inlined here rather than imported from
 * `@goproceed/contracts` (a backlog entry), so the union is restated
 * here the way `NormativeCitation.verification` restates it in
 * `assignment.tsx` and `obligations.ts`.
 *
 * `VERIFIED_PRIMARY` rests on a direct read of the official standard text;
 * `VERIFIED_SECONDARY` is the downgrade state. Both are source-strength
 * statements and say «перевірено». `PROJECT_DOCUMENTATION` (ADR-010,
 * migration 0059) does not fit on that scale: it states an ORIGIN — a
 * workspace's own робоча документація at a named sheet and drawing — and
 * hidden-works-content-rules.md §"Project-sourced strings" gives its label in
 * terms: «за робочою документацією об'єкта» — "an origin, not a verification
 * strength", and it "must not be labelled «перевірено» in any form."
 *
 * TODOS 2026-08-27 residual 7 is why this file exists: before it,
 * `assignment.tsx` printed the raw `PROJECT_DOCUMENTATION` token to a
 * foreman's phone where the Approved document mandates the Ukrainian label.
 */
export type NormRefVerificationTag =
  "VERIFIED_PRIMARY" | "VERIFIED_SECONDARY" | "PROJECT_DOCUMENTATION";

export const NORM_REF_VERIFICATION_LABELS: Readonly<Record<NormRefVerificationTag, string>> =
  Object.freeze({
    VERIFIED_PRIMARY: "перевірено за першоджерелом",
    VERIFIED_SECONDARY: "перевірено за вторинним джерелом",
    PROJECT_DOCUMENTATION: "за робочою документацією об'єкта",
  });

export function normRefVerificationLabel(tag: NormRefVerificationTag): string {
  return NORM_REF_VERIFICATION_LABELS[tag];
}
