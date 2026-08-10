import { z } from "zod";
import { blockedReason } from "./readiness";

/**
 * `stage_closures.create` — POST /v1/stages/{stageId}/closures
 * (technical/openapi/scope-v0.1.csv:46; command, idempotency required, member
 * plane, governed by `stage_closures.close`).
 *
 * THE REFUSAL IS THE PRODUCT. This command is the only half of the ADR-005 gate
 * that ships in v0.1 (ADR-006 step 3, capabilities.csv:28). When any occurrence
 * on the stage whose `blocking_scope` blocks closure lacks an accepting evidence
 * decision or a current waiver/accept_risk exception, it REFUSES with
 * `HOLD_POINT_BLOCKED` (technical/error-catalog.csv:95 — 409,
 * `complete_or_authorize_occurrence`, `inline_conflict_notice`) and the problem
 * body carries one `blockedReason` object per unmet requirement. A refusal writes
 * nothing: no stage row moves, no closure exists, and — from ADR-008 — no money
 * is carved, because a refused closure writes nothing at all.
 *
 * IT IS ALSO THE ADMISSION EVENT. ADR-008 (Approved 2026-08-07) moves the
 * valuation carve out of `progress.record` and into this command: performed
 * quantity is recorded and UNVALUED until a closure admits it. That is why the
 * response carries an `admission` block that `progress.record`'s 201 no longer
 * carries.
 *
 * THERE IS NO REOPEN AND NO SECOND CLOSURE. Migration 0045 §6 makes `closed`
 * terminal on `public.work_stages`, and INV-076 makes double-covering one stage
 * unrepresentable: one root closure per stage, no two successors from one
 * predecessor, and a contiguous chain. A closure recorded in error is corrected
 * by APPENDING a superseding closure that states a reason — the `correction`
 * field below — and never by editing or reopening.
 */
export const createStageClosureRequest = z.object({
  /**
   * The stage's expected version, taken under the row lock. A stage somebody else
   * closed between the readiness read and this call is a `VERSION_CONFLICT` and
   * never a second closure.
   */
  expectedVersion: z.number().int().min(1),

  /**
   * Untrusted, exactly like a claimed capture time (execution-and-evidence.md
   * §"Stages and stage closure"). The server's own `closed_at` is the trusted
   * one and is not on this wire at all.
   */
  claimedCoveredAt: z.string().datetime({ offset: true }).optional(),
  claimedCoveredTzOffset: z.string().max(16).optional(),

  /**
   * A correction supersedes an exact prior closure and says why.
   * `stage_closures_correction_reason_check` refuses a successor with no reason,
   * and `stage_closures_chain_check` refuses one that does not name its
   * predecessor.
   *
   * UNREACHABLE IN v0.1 THROUGH THIS ROUTE AND KEPT ON THE WIRE. Correcting a
   * closure requires the stage to move again, and migration 0045 §6 makes
   * `closed` terminal: `app.guard_work_stage()` rejects every update whose old
   * status is not `open`. So a correction can be REQUESTED and the command
   * refuses it, naming the reason, rather than the field silently not existing.
   * ADR-008 §"What this ADR does not decide" is the other half of the same gap —
   * «v0.1 needs its own answer for a closure that is later found wrong, and this
   * ADR does not give one» — and a field that vanished would hide the question.
   */
  correction: z.object({
    predecessorClosureId: z.string().uuid(),
    reason: z.string().trim().min(1).max(4000),
  }).strict().optional(),
}).strict();
export type CreateStageClosureRequest = z.infer<typeof createStageClosureRequest>;

/**
 * One row of the frozen occurrence set (`public.stage_closure_occurrences`),
 * echoed so the closure receipt names what it froze rather than only how many.
 */
export const frozenOccurrenceView = z.object({
  requirementOccurrenceId: z.string().uuid(),
  blockingScope: z.enum(["blocks_stage_closure", "blocks_both"]),
  satisfiedBy: z.enum(["evidence_decision", "exception"]),
  reliedOnDecisionId: z.string().uuid().nullable(),
  reliedOnExceptionId: z.string().uuid().nullable(),
  reliedOnExceptionAction: z.enum(["waiver", "accept_risk"]).nullable(),
}).strict();
export type FrozenOccurrenceView = z.infer<typeof frozenOccurrenceView>;

/**
 * What the closure admitted, in money. `admittedProgressEntryIds` is the list the
 * command chose to admit — see `apps/app/src/lib/admission.ts` for the rule and
 * for the three answers ADR-008 leaves open about it.
 */
export const admissionView = z.object({
  admittedProgressEntryCount: z.number().int().min(0),
  admittedProgressEntryIds: z.array(z.string().uuid()),
  valued: z.boolean(),
  netMinorUnits: z.string().nullable(),
  taxMinorUnits: z.string().nullable(),
  grossMinorUnits: z.string().nullable(),
  /**
   * Why nothing was valued, when nothing was: `unknown_tax_basis` or
   * `missing_unit_price` from the domain's own vocabulary. Missing price is
   * unvalued, never zero (INV-038).
   */
  unvaluedReason: z.string().nullable(),
}).strict();
export type AdmissionView = z.infer<typeof admissionView>;

export interface CreateStageClosureResponse {
  stageClosureId: string;
  workStageId: string;
  workAssignmentId: string;
  closureNo: number;
  predecessorClosureId: string | null;
  stageVersion: number;
  closedAt: string;
  closedByMemberId: string;
  /**
   * The claim the closure makes about the set it froze, and the set itself.
   * `evaluatedOccurrenceSetHash` is the sha256 migration 0045 §5's deferred
   * constraint trigger recomputes over the member ids at commit; it is on the
   * wire so a caller can re-derive it from `frozenOccurrences` without trusting
   * either the count or the server.
   *
   * MAY BE ZERO AND AN EMPTY SET. A stage with no applicable blocking occurrence
   * closes vacuously — correct behaviour, and exactly why the dry run must print
   * uncovered lines (INV-072). `vacuous` is the flag that stops «closed» being
   * read as «proved».
   */
  evaluatedOccurrenceCount: number;
  evaluatedOccurrenceSetHash: string;
  frozenOccurrences: FrozenOccurrenceView[];
  vacuous: boolean;
  admission: AdmissionView;
}

/**
 * The refusal body's `details`, as a shape.
 *
 * `docs/22-data-api-contract.md:194` permits a code-specific, allow-listed
 * `details` object on the problem, and this is `HOLD_POINT_BLOCKED`'s. It carries
 * exactly what version-0.1.md §M3 demands of a refusal — «every refusal names the
 * requirement, the missing evidence, the role that owes the decision, and the
 * money that waits» — and nothing else: no tokens, no filenames, no storage keys,
 * no raw provider text.
 */
export const holdPointBlockedDetails = z.object({
  workStageId: z.string().uuid(),
  workAssignmentId: z.string().uuid(),
  stageKey: z.string().min(1),
  blockingOccurrenceCount: z.number().int().min(0),
  unsatisfiedOccurrenceCount: z.number().int().min(1),
  blockedReasons: z.array(blockedReason).min(1),
}).strict();
export type HoldPointBlockedDetails = z.infer<typeof holdPointBlockedDetails>;
