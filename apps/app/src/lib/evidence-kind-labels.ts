import type { MissingEvidenceItem } from "@goproceed/contracts";

/**
 * `requirement_occurrences.evidence_kind` → the Ukrainian label the money
 * screen's `missingEvidence` rows render (D2 — `blockedReason.
 * missingEvidence[].evidenceKind`, `packages/contracts/src/readiness.ts`).
 *
 * A REAL FOUR-VALUE CHECK, NOT FREE TEXT — unlike `approver_role`
 * (`approver-role-labels.ts`'s own header: that field's CHECK is non-blank
 * only, never enumerated, so it gets a best-effort map with a raw fallback
 * and no `pg_constraint` fidelity test; CORRECTED IN FIX ROUND 1 — this
 * comment previously cited `blocked-value-panel.tsx`, a filename from an
 * earlier draft of this screen's file layout that was never actually
 * created; the real home is `../components/projects/blocked-reasons-list.
 * tsx`). `evidence_kind` is a genuine closed vocabulary both on the wire
 * (`evidenceKind = z.enum(["photo","measurement","document","checkbox"])`,
 * `packages/contracts/src/requirement-rules.ts:46`) and in the database —
 * `check (evidence_kind in ('photo','measurement','document','checkbox'))`
 * on `public.requirement_occurrences` (`supabase/migrations/
 * 0043_the_obligation_before_the_covering.sql`, its `create table
 * public.requirement_occurrences` block and the `evidence_kind` CHECK inside
 * it). `apps/app/src/lib/readiness.ts`'s `evaluateStages` reads this exact
 * column (`evidenceKind: r.evidence_kind as string`) into
 * `EvaluatedOccurrence`, and `missingEvidenceFor` carries it straight into
 * `MissingEvidenceItem.evidenceKind` unchanged — so the value this map
 * labels is the value the database actually stores, not a derived one. Named
 * by function, not by line: this module's own sibling `blocked-value.
 * service.ts` cited a line for a throw inside `requireProjectCapability` in
 * fix round 1 and that line moved within the SAME round's own edit.
 *
 * TYPED AS `Record<MissingEvidenceItem["evidenceKind"], string>`, matching
 * `evidence-labels.ts`'s `CAPTURE_TIME_TRUST_LABELS` shape: the wire type is
 * itself a closed `z.enum`, so a value this map has not learned is a
 * COMPILE error here, not a runtime fallback — TypeScript is the first
 * fidelity check. `apps/app/tests/evidence-kind-labels.int.test.ts` is the
 * second, independent one: it reads `pg_constraint` directly rather than
 * trusting that the zod enum and the live CHECK still agree, for the same
 * reason `assignment-status-labels.ts`'s own header gives — a migration-text
 * or hand-copied version of this question already shipped a raw identifier
 * to a Ukrainian-speaking reader once in this repository
 * (`origin_not_distinguished`, `evidence-labels.ts`'s own account of it).
 */
export const EVIDENCE_KIND_LABELS: Readonly<Record<MissingEvidenceItem["evidenceKind"], string>> =
  Object.freeze({
    photo: "Фото",
    measurement: "Замір",
    document: "Документ",
    checkbox: "Позначка",
  });

export function evidenceKindLabel(kind: MissingEvidenceItem["evidenceKind"]): string {
  return EVIDENCE_KIND_LABELS[kind];
}
