import { z } from "zod";

/**
 * The two facts an occurrence's satisfaction is made of (v0.1-M3).
 *
 *   `evidence_decisions.create`
 *     POST /v1/occurrences/{occurrenceId}/evidence-decisions
 *     (scope-v0.1.csv:45; command, idempotency required, member plane,
 *     governed by `evidence_decisions.decide`)
 *
 *   `requirement_exceptions.create`
 *     POST /v1/occurrences/{occurrenceId}/exceptions
 *     (scope-v0.1.csv:44; command, idempotency required, member plane,
 *     governed by `requirement_exceptions.decide`)
 *
 * ONE MODULE, because they are one discipline. Both are append-only facts on one
 * requirement occurrence, both are serialized by a head that carries an expected
 * version, both correct by APPENDING a successor that names the exact prior fact
 * rather than by editing, and neither may fork or carry two independent roots
 * (INV-035). Splitting them into two files would put the same `expectedVersion`
 * contract in two places, and the M1 review already recorded what happens when
 * one vocabulary lives in several files that must agree.
 *
 * NEITHER MOVES MONEY (INV-075 first half, INV-032). An evidence decision governs
 * ADMISSION; the money moves at the stage closure and only there (ADR-008), and
 * migration 0046 reaches `public.valuation_allocations` through
 * `public.stage_closures` rather than through either of these tables.
 */

/**
 * The expected version of the lineage head, in the shape the head discipline
 * requires (execution-and-evidence.md §"Exceptions": «Appending an exception or
 * revocation locks the head and requires its expected version»).
 *
 * `null` means «I believe this lineage has no head yet» — the root case. That is
 * not the same as omitting the field: omitting it would let a caller append a
 * successor without having read anything, which is the concurrency hole the head
 * exists to close. A root that finds a head, or a successor that names the wrong
 * version, is a `VERSION_CONFLICT` and never a silent second root — migration
 * 0045's lineage keys make the second root a 23505 even if a command forgets, and
 * this field is what turns that into a refusal a caller can act on.
 */
const expectedHeadVersion = z.number().int().min(1).nullable();

/**
 * `accepted` releases a `hold`; `returned` blocks it and must say why.
 *
 * THE RETURN REASON IS FREE TEXT AND THAT IS A RECORDED GAP, NOT A SHORTCUT.
 * `technical/states/state-catalog.csv:120` files
 * `requirement_evidence_decision.return_reason` as `NOT_ENUMERATED` — «a recorded
 * gap that BLOCKS v0.1-M5» — and offers the v0.1-shaped alternative in terms:
 * «or the return to record free text plus the requirement occurrence it concerns
 * and say so». That is what this is, and there is deliberately NO reason-code
 * field: inventing one here is exactly what that row forbids. Migration 0045 §4
 * stores it the same way and for the same reason.
 */
export const evidenceDecisionOutcome = z.enum(["accepted", "returned"]);
export type EvidenceDecisionOutcomeValue = z.infer<typeof evidenceDecisionOutcome>;

export const recordEvidenceDecisionRequest = z.object({
  outcome: evidenceDecisionOutcome,
  /** Required on a return by `requirement_evidence_decisions_return_reason_check`. */
  reason: z.string().trim().min(1).max(4000).optional(),
  /**
   * Structured findings the crew can work through, beside the free text. jsonb
   * `[]` by default in the column; an array here or nothing.
   */
  issues: z.array(z.object({
    path: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(2000),
  }).strict()).max(50).default([]),
  expectedVersion: expectedHeadVersion,
}).strict().refine(
  (v) => v.outcome !== "returned" || (v.reason !== undefined && v.reason.length > 0),
  { path: ["reason"], message: "a return must say why" },
);
export type RecordEvidenceDecisionRequest = z.infer<typeof recordEvidenceDecisionRequest>;

export interface RecordEvidenceDecisionResponse {
  decisionId: string;
  requirementOccurrenceId: string;
  /** Pinned FROM the occurrence, never typed into the decision. */
  approverRole: string;
  outcome: EvidenceDecisionOutcomeValue;
  decisionNo: number;
  supersededDecisionId: string | null;
  headVersion: number;
  decidedAt: string;
  /**
   * Whether this decision made the occurrence satisfied, and whether the stage it
   * belongs to can now be closed. NOT a promise that the closure will succeed:
   * the closure re-evaluates the whole predicate under the stage lock (INV-061),
   * and another occurrence on the same stage may still be unmet. It is here
   * because the approver who has just accepted needs to know whether anything is
   * still owed, and `blockedReasons.get` is a second round trip to learn it.
   */
  occurrenceSatisfied: boolean;
  stageCanClose: boolean | null;
}

/**
 * `waiver`, `accept_risk`, `not_applicable` — the vocabulary of
 * state-catalog.csv:109-111, execution-and-evidence.md:506 and ADR-005
 * decision 3.
 *
 * `revoke` IS ABSENT FROM THIS REQUEST AND PRESENT IN THE COLUMN. Migration 0045
 * §3 keeps it in the CHECK so v0.2 is additive and no v0.1 record has to be
 * reinterpreted, and records that `scope-v0.1.csv` has no revoke operation. A
 * value a v0.1 route cannot write does not belong on a v0.1 request schema:
 * accepting it here would ship an operation the API surface does not have.
 *
 * `not_applicable` IS PRESENT AND IS REFUSED BY THE COMMAND for a `hold`
 * (INV-063). It is deliberately not removed from the enum, because
 * version-0.1.md §M3 makes «the exception command itself rejects `not_applicable`
 * on a `hold`» an exit gate AND a security test: a request shape that could not
 * express the refused case would make the test unwritable, and the refusal would
 * then be enforced by the absence of a field rather than by the command — which
 * is precisely what «not by convention, not by a UI affordance, and not by a role
 * that happens not to have the button» rules out.
 */
export const requirementExceptionAction = z.enum(["waiver", "accept_risk", "not_applicable"]);
export type RequirementExceptionActionValue = z.infer<typeof requirementExceptionAction>;

export const recordRequirementExceptionRequest = z.object({
  action: requirementExceptionAction,
  /**
   * Mandatory, always. An exception that hides who took it and why is the
   * exception ADR-005 decision 3 argues against, and this is the only escape v0.1
   * has (ADR-006 decision 4).
   */
  reason: z.string().trim().min(1).max(4000),
  expectedVersion: expectedHeadVersion,
}).strict();
export type RecordRequirementExceptionRequest =
  z.infer<typeof recordRequirementExceptionRequest>;

export interface RecordRequirementExceptionResponse {
  exceptionId: string;
  requirementOccurrenceId: string;
  action: RequirementExceptionActionValue;
  exceptionNo: number;
  predecessorExceptionId: string | null;
  headVersion: number;
  /** Who took it. An exception stays VISIBLE and ATTRIBUTED on the scope (INV-063). */
  authorityMemberId: string;
  reason: string;
  createdAt: string;
  occurrenceSatisfied: boolean;
  stageCanClose: boolean | null;
}
