import { z } from "zod";
import { normativeCitation } from "./requirement-occurrences";
import { blockingScope, evidenceKind, interventionType } from "./requirement-rules";

/**
 * Readiness, and the object a refusal is made of (v0.1-M3).
 *
 * Two operations (technical/openapi/scope-v0.1.csv:47-48), both governed by
 * `readiness.view` (capabilities.csv:31):
 *
 *   `readiness.get`         GET /v1/projects/{projectId}/readiness
 *   `blocked_reasons.get`   GET /v1/projects/{projectId}/blocked-reasons
 *
 * THE THIRD CONSUMER OF THESE SHAPES IS A REFUSAL, NOT A READ. `stage_closures.create`
 * returns the same `blockedReason` objects in its problem body, and that is the
 * point of putting them here rather than beside the closure command: ADR-005
 * decision 6 says the block reason is an object and not a UI state, and an object
 * that had one shape when read and another when refused would be two objects.
 *
 * WHAT THESE ROUTES DO NOT READ. Migration 0045 §7 builds
 * `public.readiness_projection` and `public.blocked_reasons`, gives the write
 * grant to `goproceed_service` alone, and records in terms that NOTHING WRITES
 * EITHER: there is no projection rebuilder in this repository and
 * `supabase/functions/outbox-drain/index.ts` says drained rows have no deployed
 * consumer. Routes that read those tables would answer `{stages: []}` in every
 * real workspace — the exact shape of M1 review finding 2, where a table existed
 * and nothing in production put rows in it. So both routes COMPUTE, from the same
 * function the closure command evaluates its precondition with
 * (`apps/app/src/lib/readiness.ts`). The projections stay unread until a
 * rebuilder exists; see that module's header for what that costs and what it buys.
 */

/**
 * The closed, versioned code vocabulary of ADR-005 decision 6, transcribed as a
 * `blocked_reason.code` `stored_vocabulary` machine at
 * `technical/states/state-catalog.csv:112-118` and CHECK-enforced by migration
 * 0045 §7. All seven values are here because a closed vocabulary that changes
 * shape between versions is not closed (execution-and-evidence.md §"Blocked
 * reason"); two of them have no v0.1 producer and are named as such below.
 */
export const blockedReasonCode = z.enum([
  /** The act exists but carries no accepting decision. NO v0.1 PRODUCER IN M3: the act is M4. */
  "ACT_NOT_SIGNED",
  /** A required test report of the occurrence's evidence_kind has no available evidence object. */
  "TEST_REPORT_MISSING",
  /** A required material certificate of the occurrence's evidence_kind has no available object. */
  "MATERIAL_CERTIFICATE_MISSING",
  /** The occurrence awaits a decision from the approver_role that owes it. */
  "SUPERVISION_SIGNATURE_MISSING",
  /** A current return by the approver_role names a motivated refusal. */
  "CUSTOMER_MOTIVATED_REFUSAL",
  /** v0.2 — needs a witness occurrence and a notice event; neither exists in v0.1. */
  "NOTICE_PERIOD_NOT_ELAPSED",
  /** v0.2 — needs the closure-without-evidence bypass, which v0.1 does not have. */
  "CLOSED_WITHOUT_ACT",
]);
export type BlockedReasonCodeValue = z.infer<typeof blockedReasonCode>;

/**
 * WHICH CODE A v0.1 BLOCK ACTUALLY CARRIES, and why it is only ever two of the
 * seven. This is a judgement the package does not settle, so it is written down
 * rather than buried in a `switch`:
 *
 *  * `CUSTOMER_MOTIVATED_REFUSAL` — the current decision head on the occurrence
 *    is a RETURN. state-catalog.csv:116 defines the code as exactly that.
 *  * `SUPERVISION_SIGNATURE_MISSING` — everything else, because
 *    state-catalog.csv:115 defines it as «the occurrence awaits a decision from
 *    the approver_role that owes it» and that is true of every other unsatisfied
 *    v0.1 occurrence.
 *
 * `TEST_REPORT_MISSING` and `MATERIAL_CERTIFICATE_MISSING` are NOT produced, and
 * the reason is a missing column rather than a missing branch: both are defined
 * over «a required test report / material certificate OF THE OCCURRENCE'S
 * evidence_kind», and `evidence_kind` is `photo | measurement | document |
 * checkbox` (migration 0043). Nothing in the schema distinguishes a test report
 * from a material certificate, so any mapping from `document` to one of them
 * would be invented here. The missing originals are still reported — see
 * `missingEvidence` below, which carries the kind, the criterion and the counts —
 * they are simply not given a code the data cannot justify. `ACT_NOT_SIGNED`
 * needs the statutory act, which is v0.1-M4.
 */
export const V01_PRODUCIBLE_BLOCKED_REASON_CODES = [
  "SUPERVISION_SIGNATURE_MISSING", "CUSTOMER_MOTIVATED_REFUSAL",
] as const;

/**
 * `public.blocked_reasons.code_vocabulary_version` is `not null` with a non-blank
 * CHECK and NO document in this package gives the vocabulary a version
 * identifier. This constant is the date state-catalog.csv:112-118 records as the
 * day the seven rows were transcribed, which is the only fact available that
 * changes when the vocabulary changes. It is a stand-in and it is owed a real
 * answer by whoever versions the vocabulary; it is here, exported and commented,
 * rather than typed inline at a call site where nobody would find it.
 */
export const BLOCKED_REASON_CODE_VOCABULARY_VERSION = "2026-08-06";

/**
 * What is missing, by evidence kind and acceptance criterion (ADR-005 decision
 * 6). The counts travel with it: «a photo is missing» and «two of the three
 * required photos are missing» are different sentences to a foreman, and the
 * occurrence's `min_evidence_count` is what makes the second one available.
 */
export const missingEvidenceItem = z.object({
  evidenceKind,
  acceptanceCriterion: z.string().trim().min(1),
  requiredCount: z.number().int().min(1),
  availableCount: z.number().int().min(0),
}).strict();
export type MissingEvidenceItem = z.infer<typeof missingEvidenceItem>;

/**
 * Money on a block, per currency, coupled (INV-037). There is no cross-currency
 * total anywhere (INV-012), which is why this is one object per row and never a
 * sum across rows of different currencies.
 */
export const blockedValue = z.object({
  currency: z.string().length(3),
  netMinorUnits: z.string(),
  taxMinorUnits: z.string(),
  grossMinorUnits: z.string(),
}).strict();
export type BlockedValue = z.infer<typeof blockedValue>;

/**
 * HOW THE MONEY ON A BLOCK IS COMPUTED, and the fact that the package does not
 * settle it.
 *
 * ADR-006 step 6 says «the amount of the work lines under a blocked stage, at
 * the price on the published baseline, attributed once per assignment», and
 * migration 0045's header records why that sentence is not a rule: a
 * `work_assignment` is a SLICE of a work item (`planned_quantity`, nullable), so
 * two assignments on one line would each attribute the LINE's whole amount and
 * INV-070's per-assignment deduplication would not prevent it.
 *
 * The two answers this version can give are both reported, per row, so no number
 * is read without knowing which one produced it:
 *
 *  * `planned_share` — the assignment declares a `planned_quantity` and the work
 *    item a positive `contract_quantity`, so the line's pool is attributed in
 *    that proportion. Two assignments on one line then sum to at most the line.
 *  * `whole_line` — the assignment declares no planned quantity, so the only
 *    amount available is the line's own. THIS IS THE OVER-ATTRIBUTING CASE and it
 *    is labelled rather than hidden.
 *
 * A line with no price carries no money at all and reports `unvaluedQuantity`
 * instead: missing price is unvalued, never zero (INV-038).
 */
export const blockedValueAttribution = z.enum(["planned_share", "whole_line", "unvalued"]);
export type BlockedValueAttributionValue = z.infer<typeof blockedValueAttribution>;

export const blockedReason = z.object({
  requirementOccurrenceId: z.string().uuid(),
  /** What was agreed, and in which version (INV-067). */
  ruleVersionId: z.string().uuid(),
  workAssignmentId: z.string().uuid(),
  workStageId: z.string().uuid(),
  stageKey: z.string().min(1),
  workItemId: z.string().uuid(),

  code: blockedReasonCode,
  codeVocabularyVersion: z.string().min(1),
  missingEvidence: z.array(missingEvidenceItem),
  /** Who owes the decision. Never null in v0.1: every occurrence names an approver_role. */
  awaitingApproverRole: z.string().min(1).nullable(),
  /** Server time the block began — the return that blocked it, or materialisation. */
  since: z.string().datetime({ offset: true }),

  blockedValue: blockedValue.nullable(),
  /** Set when the line has no usable price: the scope waits, and its size is a quantity. */
  unvaluedQuantity: z.string().nullable(),
  valueAttribution: blockedValueAttribution,

  /**
   * The obligation in the standard's own wording, carried with its verification
   * tag and its source or not at all (INV-073). A refusal a foreman cannot read
   * is a status word, and version-0.1.md §M3 says a screen that displays «не
   * готово» closes nothing.
   */
  acceptanceCriterion: z.string().trim().min(1),
  normRef: normativeCitation.nullable(),
}).strict()
  /**
   * EVERY REFUSAL NAMES THE MONEY — the wire says it because the table already
   * did. `blocked_reasons_names_money_check` (migration 0045:1396-1397) is
   * `net_minor_units is not null or unvalued_quantity is not null`, and
   * version-0.1.md §M3 requires the refusal to name the requirement, the missing
   * evidence, the owed role AND the money.
   *
   * ADDED 2026-08-08 (M3 pre-landing review finding 6). Until this date the two
   * fields were independently nullable here while the table refused exactly the
   * row where both are absent, so a `blocked_reason` that named neither passed
   * the wire schema and could not have been stored: an assignment whose
   * valuation did not resolve degraded a refusal into a money-less one SILENTLY,
   * on the screen and in the 409 body, instead of failing where it could be
   * seen. The producer now refuses to build that object at all
   * (`blockedReasonFor`, apps/app/src/lib/readiness.ts) and this is the boundary
   * that proves it, on `blocked_reasons.get`, on `blocked_value.get` and inside
   * the `HOLD_POINT_BLOCKED` body — the three places the object reaches a human.
   *
   * Missing price is unvalued, never zero (INV-038). Both fields NON-null is
   * left representable on purpose: it is not what this rule is about, and the
   * table admits it too.
   */
  .refine((r) => r.blockedValue !== null || r.unvaluedQuantity !== null, {
    message: "a blocked reason names the money or the unvalued quantity (INV-038)",
    path: ["blockedValue"],
  });
export type BlockedReason = z.infer<typeof blockedReason>;

/**
 * One occurrence, as the predicate saw it. `satisfiedBy` is the fact the closure
 * would freeze against this occurrence, and it is the same field
 * `public.stage_closure_occurrences.satisfied_by` stores — the read and the fact
 * report the same thing because they are computed by the same function.
 */
export const occurrenceSatisfactionView = z.object({
  occurrenceId: z.string().uuid(),
  ruleVersionId: z.string().uuid(),
  ordinal: z.number().int().min(1),
  interventionType,
  blockingScope,
  approverRole: z.string().min(1),
  blocksStageClosure: z.boolean(),
  satisfied: z.boolean(),
  satisfiedBy: z.enum(["evidence_decision", "exception"]).nullable(),
  currentDecisionId: z.string().uuid().nullable(),
  currentDecisionOutcome: z.enum(["accepted", "returned"]).nullable(),
  currentExceptionId: z.string().uuid().nullable(),
  currentExceptionAction: z.enum(["waiver", "accept_risk", "not_applicable", "revoke"]).nullable(),
}).strict();
export type OccurrenceSatisfactionView = z.infer<typeof occurrenceSatisfactionView>;

/**
 * `scopeKind` is `work_stage` and nothing else in v0.1, because the v0.1 closable
 * unit is the work stage. `public.readiness_projection.scope_kind` ships with NO
 * vocabulary CHECK (migration 0045 §7 and its owed item 4): state-catalog.csv has
 * no machine for it, `schema-v0.1.sql:2480` gives «e.g. work_assignment |
 * occurrence_scope» which is an example rather than an enumeration, and inventing
 * one is what the `NOT_ENUMERATED` rows forbid. This enum is the WIRE shape of
 * the one value v0.1 can produce and is deliberately not proposed as that
 * column's vocabulary.
 */
export const readinessScopeKind = z.enum(["work_stage"]);

export const stageReadinessView = z.object({
  scopeKind: readinessScopeKind,
  workStageId: z.string().uuid(),
  workAssignmentId: z.string().uuid(),
  contractId: z.string().uuid(),
  workItemId: z.string().uuid(),
  stageKey: z.string().min(1),
  isConcealed: z.boolean(),
  status: z.enum(["open", "closed", "closed_without_evidence"]),
  /** `can_close_stage(s)` exactly as ADR-005 decision 7 writes it, in its v0.1 form. */
  canCloseStage: z.boolean(),
  /**
   * VACUOUS TRUTH IS REPORTED, NOT HIDDEN. `∀` over an empty set is true, so a
   * stage with no applicable blocking occurrence closes — correct behaviour, and
   * exactly why the dry run must print uncovered lines (INV-072). A caller that
   * saw only `canCloseStage: true` could not tell «every obligation is satisfied»
   * from «this stage carries no obligation», so the count travels with the verdict.
   */
  blockingOccurrenceCount: z.number().int().min(0),
  satisfiedOccurrenceCount: z.number().int().min(0),
  occurrences: z.array(occurrenceSatisfactionView),
  blockedReasons: z.array(blockedReason),
}).strict();
export type StageReadinessView = z.infer<typeof stageReadinessView>;

export const readinessResponse = z.object({
  projectId: z.string().uuid(),
  /**
   * COMPUTED, NEVER READ FROM public.readiness_projection — see this module's
   * header. `computed` says so on the wire, so a client cannot mistake a live
   * evaluation for a projection row and go looking for a watermark that does not
   * exist. The field is a discriminator, not a boolean flag, so the projection
   * value can be added beside it in the version that ships a rebuilder.
   */
  source: z.literal("computed"),
  algorithmVersion: z.string().min(1),
  calculatedAt: z.string().datetime({ offset: true }),
  stages: z.array(stageReadinessView),
  summary: z.object({
    stageCount: z.number().int().min(0),
    closableCount: z.number().int().min(0),
    blockedCount: z.number().int().min(0),
    closedCount: z.number().int().min(0),
    /**
     * Stages that close because they carry no obligation at all. Reported as its
     * own number for the reason INV-072 exists: silent non-coverage means there
     * is no gate, and a dashboard reading «12 of 12 ready» over twelve empty
     * stages is the failure this version is most likely to ship.
     */
    vacuouslyClosableCount: z.number().int().min(0),
  }).strict(),
}).strict();
export type ReadinessResponse = z.infer<typeof readinessResponse>;

/**
 * The per-currency sum, deduplicated by assignment (INV-070). Several unmet
 * occurrences on one work reference the same assignment-scoped value, so the sum
 * takes DISTINCT assignments per currency and never adds across currencies
 * (INV-012).
 */
export const blockedValueTotal = z.object({
  currency: z.string().length(3),
  netMinorUnits: z.string(),
  taxMinorUnits: z.string(),
  grossMinorUnits: z.string(),
  assignmentCount: z.number().int().min(0),
  /** How many of the summed assignments were attributed the WHOLE line — see `blockedValueAttribution`. */
  wholeLineAttributionCount: z.number().int().min(0),
}).strict();

export const blockedReasonsResponse = z.object({
  projectId: z.string().uuid(),
  source: z.literal("computed"),
  algorithmVersion: z.string().min(1),
  calculatedAt: z.string().datetime({ offset: true }),
  blockedReasons: z.array(blockedReason),
  byCode: z.array(z.object({
    code: blockedReasonCode,
    occurrenceCount: z.number().int().min(0),
  }).strict()),
  totalsByCurrency: z.array(blockedValueTotal),
  /** Assignments whose blocked scope has no price at all (INV-038): a quantity, never a zero. */
  unvaluedAssignmentCount: z.number().int().min(0),
}).strict();
export type BlockedReasonsResponse = z.infer<typeof blockedReasonsResponse>;
