import { createHash } from "node:crypto";
import type { Tx } from "@goproceed/database";
import {
  BLOCKED_REASON_CODE_VOCABULARY_VERSION,
  type BlockedReason, type BlockedReasonCodeValue, type BlockedValueAttributionValue,
  type MissingEvidenceItem, type OccurrenceSatisfactionView, type StageReadinessView,
  type VerificationTagValue,
} from "@goproceed/contracts";
import { unvaluedReason, type WorkItemValuation } from "@goproceed/domain";
import { toScaled6, fromScaled6 } from "./valuation-writer";

/**
 * `can_close_stage`, computed ONCE for the whole product.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS MODULE EXISTS AT ALL
 *
 * Three surfaces have to agree about whether a stage is closable: the closure
 * command, which REFUSES on it (INV-061); `readiness.get`, which reports it; and
 * `blocked_reasons.get`, which reports what is missing. Two implementations that
 * happen to match today are two implementations that will disagree the first time
 * one of them is edited, and the disagreement would be invisible — the read would
 * say «ready» and the command would refuse, or worse, the read would say
 * «blocked» and the command would close. ADR-005 decision 7 makes readiness a
 * PRECONDITION and not a report; a precondition that is computed twice is two
 * preconditions.
 *
 * So `evaluateStages` below is the only place the predicate is written. The
 * closure command calls it under the stage row lock and refuses on the result;
 * the two GETs call it and render the result. They cannot drift because there is
 * nothing to drift from.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PREDICATE, IN ITS v0.1 FORM, TRANSCRIBED RATHER THAN PARAPHRASED
 *
 * From execution-and-evidence.md §"Closure and eligibility" and §"Satisfaction":
 *
 *   STAGE_BLOCKING(s) = { o | o.work_stage_id = s.id
 *                             ∧ o.blocking_scope ∈ {blocks_stage_closure, blocks_both} }
 *
 *   can_close_stage(s) ⇔ ∀ o ∈ STAGE_BLOCKING(s) : satisfied(o)
 *
 *   satisfied(o) ⇔                                   -- v0.1
 *        o.intervention_type = 'hold'
 *          ∧ ∃ current accepting evidence decision on o by o.approver_role
 *          ∧ no current return on o
 *     ∨  ∃ current exception head on o with kind ∈ {waiver, accept_risk}
 *
 * «Current» always means the head selected by the serialized lineage, and a
 * superseded fact never satisfies anything — which is why every read below goes
 * through `requirement_evidence_decision_heads` and `requirement_exception_heads`
 * and never through the fact tables' own rows. There is exactly one decision head
 * per (occurrence, approver_role) and its `current_outcome` is `accepted` or
 * `returned`, so «a current accepting decision ∧ no current return» is the single
 * test `current_outcome = 'accepted'`. Migration 0045 §4 pins that outcome onto
 * the head by foreign key precisely so this question needs no join.
 *
 * `witness` and `review` have no v0.1 form (ADR-006 decision 4.3) and the
 * `not_applicable` disjunct is unreachable because it excludes `hold` and `hold`
 * is the only v0.1 intervention type. Neither is coded as a branch that can never
 * be taken: `satisfiedFor` implements the two disjuncts that exist and returns
 * `null` for everything else, so a `witness` occurrence that somehow reached a
 * v0.1 database BLOCKS rather than being silently treated as satisfied.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS DOES NOT READ, AND WHY THAT IS THE POINT
 *
 * `public.readiness_projection` and `public.blocked_reasons` are built by
 * migration 0045 §7 and WRITTEN BY NOTHING: there is no projection rebuilder in
 * this repository, `technical/events/event-catalog.csv:19,:22,:23` names
 * `projection_rebuilder` as the consumer of the three M3 events, and
 * `supabase/functions/outbox-drain/index.ts` records that drained rows have no
 * deployed consumer. A `readiness.get` that read those tables would answer
 * `{stages: []}` in every real workspace while passing every fixture that
 * inserted rows by hand — M1 review finding 2, one milestone later.
 *
 * Computing instead has two further consequences worth stating rather than
 * discovering:
 *
 *   * `schema-v0.1.sql:2492-2493` says stage closure READS the readiness
 *     projection. INV-061's enforcement column says the predicate is «evaluated
 *     inside the closure transaction under the stage row lock». They disagree,
 *     INV-061 wins, and migration 0045 §7 already recorded the target DDL comment
 *     as owed a correction. This module is the other half of that decision.
 *   * INV-051 — «older projection results cannot overwrite newer» — has nothing
 *     to bite on here, because nothing is stored. It stays owed by the slice that
 *     ships the rebuilder, together with the `source_watermark` format no
 *     document in this package gives.
 *
 * The cost is real and is not hidden: every read recomputes, so the two GETs are
 * O(stages × occurrences) per call. At pilot scale — one object, tens of lines —
 * that is a handful of rows behind three indexed queries. It is not the shape a
 * dashboard over a year of production data should keep, and the rebuilder is what
 * changes it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTHING HERE WAS EXECUTED. No test run, no route invoked, no query sent to a
 * database. Static reading of migrations 0012, 0015, 0043 and 0045 against the
 * column names used below is the only check performed.
 */

/**
 * Bumped whenever the predicate's MEANING changes — a new disjunct in
 * `satisfied(o)`, a change to which occurrences are applicable, a change to the
 * blocked-code mapping. Reported on both GETs so a stored answer can always be
 * told from a differently-computed one, and so the rebuilder that eventually
 * writes `readiness_projection.algorithm_version` has a value to write.
 *
 * 2026-08-08 — `satisfied(o)` is UNCHANGED and so is the ∀ over it. What changed
 * is what the two GETs REPORT: `stageReadinessViewOf` now gates `canCloseStage`
 * and `blockedReasons` on the stage still being open, so a closed stage reports
 * `false` and `[]` where it used to report the predicate over a set nobody can
 * act on any more. That is a change in the meaning of an answer a consumer may
 * have stored, which is precisely what this constant exists to make legible —
 * the closure command's own precondition, `EvaluatedStage.canCloseStage`, is
 * untouched by it.
 */
export const READINESS_ALGORITHM_VERSION = "can_close_stage.v0.1/2026-08-08";

export interface EvaluatedOccurrence {
  occurrenceId: string;
  workStageId: string;
  workAssignmentId: string;
  workItemId: string;
  ruleVersionId: string;
  ordinal: number;
  interventionType: string;
  blockingScope: string;
  approverRole: string;
  evidenceKind: string;
  acceptanceCriterion: string;
  minEvidenceCount: number;
  availableEvidenceCount: number;
  normRef: string | null;
  normRefVerification: string | null;
  normRefSource: string | null;
  materialisedAt: string;

  /** o ∈ STAGE_BLOCKING(s). */
  blocksStageClosure: boolean;
  satisfied: boolean;
  /** The fact a closure would freeze against this occurrence, or null. */
  satisfiedBy: "evidence_decision" | "exception" | null;

  currentDecisionId: string | null;
  currentDecisionOutcome: "accepted" | "returned" | null;
  currentDecisionAt: string | null;
  decisionHeadVersion: number | null;
  currentExceptionId: string | null;
  currentExceptionAction: "waiver" | "accept_risk" | "not_applicable" | "revoke" | null;
  exceptionHeadVersion: number | null;
}

export interface EvaluatedStage {
  workStageId: string;
  workspaceId: string;
  projectId: string;
  contractId: string;
  workAssignmentId: string;
  workItemId: string;
  stageKey: string;
  isConcealed: boolean;
  status: "open" | "closed" | "closed_without_evidence";
  version: number;
  occurrences: EvaluatedOccurrence[];
  /** STAGE_BLOCKING(s), in the order the frozen set is written. */
  blocking: EvaluatedOccurrence[];
  unsatisfied: EvaluatedOccurrence[];
  canCloseStage: boolean;
  /** True when the stage closes because it carries no obligation (INV-072). */
  vacuous: boolean;
}

/**
 * Money facts of one assignment's work line, read once per assignment.
 *
 * EXPORTED, and four fields wider than M3 left it, because `blocked_value.get`
 * (M6) reports dimensions M3's two reads did not: the BASELINE a figure came
 * from (version-0.1.md §v0.1-M6 sums «within one baseline»), the UNIT an
 * unvalued quantity is measured in (INV-038's register is a quantity and a unit,
 * never a zero), and `unitPriceState`, which is the only thing that tells a
 * contractually zero-priced line from an unpriced one after `unvaluedReason` has
 * returned `null` for the first and a reason for the second.
 */
export interface AssignmentValuation {
  workAssignmentId: string;
  workItemId: string;
  contractId: string;
  contractVersionId: string;
  contractVersionNo: number;
  unitCode: string;
  currency: string;
  plannedQuantity: bigint | null;
  contractQuantity: bigint;
  net: bigint;
  tax: bigint;
  gross: bigint;
  unitPriceState: "known" | "zero" | "missing";
  unvalued: "unknown_tax_basis" | "missing_unit_price" | null;
}

const STAGES_SQL = `
  select s.id, s.workspace_id, s.project_id, s.contract_id, s.work_assignment_id,
         s.stage_key, s.is_concealed, s.status, s.version,
         a.work_item_id
    from public.work_stages s
    join public.work_assignments a
      on a.workspace_id = s.workspace_id and a.id = s.work_assignment_id
   where s.workspace_id = $1
     and s.project_id = $2
     and ($3::uuid[] is null or s.id = any($3::uuid[]))
   order by s.created_at, s.id`;

// The heads are LEFT JOINed, not required: an occurrence nobody has decided on
// and nobody has excepted has no head row at all, and that is the ordinary
// blocked case rather than a missing row. `d.decided_at` comes along so `since`
// on a returned occurrence is the moment the return was taken and not the moment
// somebody asked.
//
// `available_evidence_count` is a correlated subquery over upload intents in
// state `available` — the terminal state of the M2 evidence path (0015:266-268).
// It informs `missingEvidence`; it is NOT a conjunct of `satisfied(o)`. The v0.1
// predicate releases a hold on the DECISION, and «linked evidence is available
// and meets multiplicity» belongs to the `review` disjunct, which is v0.2. An
// approver who accepts with no photo has accepted with no photo, and that is a
// recorded, attributed fact rather than something this module second-guesses.
const OCCURRENCES_SQL = `
  select o.id, o.work_stage_id, o.work_assignment_id, o.rule_version_id, o.ordinal,
         o.intervention_type, o.blocking_scope, o.approver_role, o.evidence_kind,
         o.acceptance_criterion, o.min_evidence_count,
         o.norm_ref, o.norm_ref_verification, o.norm_ref_source, o.created_at,
         dh.current_decision_id, dh.current_outcome, dh.version as decision_head_version,
         d.decided_at as current_decision_at,
         eh.current_exception_id, eh.current_action, eh.version as exception_head_version,
         (select count(*)::int from public.upload_intents ui
           where ui.workspace_id = o.workspace_id
             and ui.requirement_occurrence_id = o.id
             and ui.status = 'available') as available_evidence_count
    from public.requirement_occurrences o
    left join public.requirement_evidence_decision_heads dh
      on dh.workspace_id = o.workspace_id
     and dh.requirement_occurrence_id = o.id
     and dh.approver_role = o.approver_role
    left join public.requirement_evidence_decisions d
      on d.workspace_id = dh.workspace_id and d.id = dh.current_decision_id
    left join public.requirement_exception_heads eh
      on eh.workspace_id = o.workspace_id
     and eh.requirement_occurrence_id = o.id
     and eh.exception_scope = 'occurrence'
   where o.workspace_id = $1 and o.work_stage_id = any($2::uuid[])
   order by o.ordinal, o.id`;

// The baseline is read off the WORK ITEM and not off the assignment: the line is
// the thing that carries an agreed price, `work_items.contract_version_id` is
// NOT NULL and foreign-keyed into `contract_versions` (0012:224,258-259), and
// «the price on the published baseline» is a statement about the line. Joining
// `contract_versions` for `version_no` costs one more join and turns the
// baseline dimension from an id a reader cannot place into a version number
// somebody can name in a meeting.
const ASSIGNMENT_VALUATION_SQL = `
  select a.id as work_assignment_id, a.planned_quantity::text as planned_quantity,
         w.id as work_item_id, w.contract_quantity::text as contract_quantity,
         w.contract_id, w.contract_version_id, w.unit_code,
         cv.version_no as contract_version_no,
         w.currency, w.tax_mode, w.unit_price_state, w.valuation_basis,
         w.net_amount_minor_units::text as net, w.tax_amount_minor_units::text as tax,
         w.gross_amount_minor_units::text as gross
    from public.work_assignments a
    join public.work_items w on w.workspace_id = a.workspace_id and w.id = a.work_item_id
    join public.contract_versions cv
      on cv.workspace_id = w.workspace_id and cv.id = w.contract_version_id
   where a.workspace_id = $1 and a.id = any($2::uuid[])`;

/**
 * The two v0.1 disjuncts, in order.
 *
 * THE ORDER IS A DECISION AND NOT AN ACCIDENT. Both facts can exist on one
 * occurrence — an approver accepts a requirement that already carries a waiver —
 * and `stage_closure_occurrences_satisfaction_check` admits exactly one satisfying
 * fact per member row, so the command must pick. It picks the DECISION, because
 * the decision is the obligation being met and the exception is the escape from
 * meeting it; freezing the escape when the obligation was actually met would
 * record the weaker of two true statements into a fact that has to be defensible
 * years later.
 */
function satisfiedFor(o: EvaluatedOccurrence): "evidence_decision" | "exception" | null {
  if (o.interventionType === "hold" && o.currentDecisionOutcome === "accepted") {
    return "evidence_decision";
  }
  if (o.currentExceptionAction === "waiver" || o.currentExceptionAction === "accept_risk") {
    return "exception";
  }
  return null;
}

function blocksClosure(scope: string): boolean {
  return scope === "blocks_stage_closure" || scope === "blocks_both";
}

/**
 * THE ONE EVALUATION. Three queries regardless of how many stages are asked for,
 * so `readiness.get` over a project does not become N+1 as the pilot grows.
 *
 * `stageIds` narrows to a single stage for the closure command and is `null` for
 * the project-wide reads. Both paths run the same SQL and the same TypeScript;
 * the only difference is the parameter.
 */
export async function evaluateStages(
  tx: Tx,
  args: { workspaceId: string; projectId: string; stageIds: string[] | null },
): Promise<EvaluatedStage[]> {
  const stageRows = await tx.query(STAGES_SQL,
    [args.workspaceId, args.projectId, args.stageIds]);
  if (stageRows.rows.length === 0) return [];

  const ids = stageRows.rows.map((r: Record<string, unknown>) => r.id as string);
  const occRows = await tx.query(OCCURRENCES_SQL, [args.workspaceId, ids]);

  const byStage = new Map<string, EvaluatedOccurrence[]>();
  for (const r of occRows.rows as Record<string, unknown>[]) {
    const stageId = r.work_stage_id as string;
    const o: EvaluatedOccurrence = {
      occurrenceId: r.id as string,
      workStageId: stageId,
      workAssignmentId: r.work_assignment_id as string,
      // filled from the stage below: the occurrence table carries no work_item_id
      workItemId: "",
      ruleVersionId: r.rule_version_id as string,
      ordinal: Number(r.ordinal),
      interventionType: r.intervention_type as string,
      blockingScope: r.blocking_scope as string,
      approverRole: r.approver_role as string,
      evidenceKind: r.evidence_kind as string,
      acceptanceCriterion: r.acceptance_criterion as string,
      minEvidenceCount: Number(r.min_evidence_count),
      availableEvidenceCount: Number(r.available_evidence_count),
      normRef: (r.norm_ref as string | null) ?? null,
      normRefVerification: (r.norm_ref_verification as string | null) ?? null,
      normRefSource: (r.norm_ref_source as string | null) ?? null,
      materialisedAt: new Date(r.created_at as string).toISOString(),
      blocksStageClosure: blocksClosure(r.blocking_scope as string),
      satisfied: false,
      satisfiedBy: null,
      currentDecisionId: (r.current_decision_id as string | null) ?? null,
      currentDecisionOutcome: (r.current_outcome as EvaluatedOccurrence["currentDecisionOutcome"]) ?? null,
      currentDecisionAt: r.current_decision_at
        ? new Date(r.current_decision_at as string).toISOString() : null,
      decisionHeadVersion: r.decision_head_version === null || r.decision_head_version === undefined
        ? null : Number(r.decision_head_version),
      currentExceptionId: (r.current_exception_id as string | null) ?? null,
      currentExceptionAction:
        (r.current_action as EvaluatedOccurrence["currentExceptionAction"]) ?? null,
      exceptionHeadVersion: r.exception_head_version === null || r.exception_head_version === undefined
        ? null : Number(r.exception_head_version),
    };
    o.satisfiedBy = satisfiedFor(o);
    o.satisfied = o.satisfiedBy !== null;
    const list = byStage.get(stageId);
    if (list) list.push(o); else byStage.set(stageId, [o]);
  }

  return (stageRows.rows as Record<string, unknown>[]).map((s) => {
    const occurrences = byStage.get(s.id as string) ?? [];
    for (const o of occurrences) o.workItemId = s.work_item_id as string;
    const blocking = occurrences.filter((o) => o.blocksStageClosure);
    const unsatisfied = blocking.filter((o) => !o.satisfied);
    return {
      workStageId: s.id as string,
      workspaceId: s.workspace_id as string,
      projectId: s.project_id as string,
      contractId: s.contract_id as string,
      workAssignmentId: s.work_assignment_id as string,
      workItemId: s.work_item_id as string,
      stageKey: s.stage_key as string,
      isConcealed: Boolean(s.is_concealed),
      status: s.status as EvaluatedStage["status"],
      version: Number(s.version),
      occurrences,
      blocking,
      unsatisfied,
      // ∀ over the empty set is TRUE and that is deliberate, not a guard nobody
      // wrote: a stage with no applicable blocking occurrence closes
      // (execution-and-evidence.md §"Closure and eligibility"). `vacuous` is what
      // stops the caller reading that as proof of anything.
      canCloseStage: unsatisfied.length === 0,
      vacuous: blocking.length === 0,
    };
  });
}

export async function evaluateStage(
  tx: Tx, args: { workspaceId: string; projectId: string; workStageId: string },
): Promise<EvaluatedStage | null> {
  const [stage] = await evaluateStages(tx, {
    workspaceId: args.workspaceId, projectId: args.projectId, stageIds: [args.workStageId],
  });
  return stage ?? null;
}

/**
 * `pg_advisory_xact_lock` on one occurrence's lineage, taken by every command
 * that appends to either of its two heads AND by the closure that reads them.
 *
 * WHY AN ADVISORY LOCK AND NOT `select ... for update` ON THE HEAD. PostgreSQL
 * applies a table's UPDATE policies to `SELECT ... FOR UPDATE` and `FOR SHARE`,
 * and migration 0045 §10 puts the two head UPDATE policies behind
 * `evidence_decisions.decide` and `requirement_exceptions.decide`. The CLOSER
 * holds `stage_closures.close` and need not hold either, so a row lock taken by
 * the closure command would silently return NO ROWS — the head would look absent,
 * the occurrence would look undecided, and the refusal would be right for the
 * wrong reason while a concurrent return slipped in behind it. An advisory lock
 * needs no table privilege at all, which is the same argument `lockWorkItem`
 * (src/lib/valuation-writer.ts) makes about `public.work_items`.
 *
 * ONE KEY PER OCCURRENCE, COVERING BOTH LINEAGES. Strictly coarser than
 * necessary — a decision and an exception on one occurrence now serialize against
 * each other — and deliberately so: `satisfied(o)` is a disjunction over both
 * heads, so a lock that covered only one would let the other move underneath the
 * predicate. Two commands reaching for different advisory keys is how a
 * serialization guarantee quietly stops holding.
 *
 * CALLERS TAKE THESE IN SORTED ORDER, ALWAYS. The closure locks every occurrence
 * of its stage; the decision and exception commands lock one. Sorting by
 * occurrence id gives every transaction the same acquisition order, which is what
 * keeps two closures on overlapping sets from deadlocking.
 */
export async function lockOccurrenceLineage(
  tx: Tx, workspaceId: string, occurrenceIds: string[],
): Promise<void> {
  for (const id of [...occurrenceIds].sort()) {
    await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`occurrence_head|${workspaceId}|${id}`]);
  }
}

/**
 * The frozen-set hash, in the exact definition migration 0045 §5 recomputes and
 * §0 probes at migration time.
 *
 * «sha256, lowercase hex, over the member occurrence ids as canonical uuid text
 * sorted ascending and joined with a single ',' — and the empty string for an
 * empty set.» The database side sorts by the `uuid` TYPE (memcmp over sixteen
 * bytes); this side sorts the canonical lowercase text lexicographically. The two
 * agree because the canonical form places its dashes at fixed positions in every
 * uuid, so no comparison ever reaches a dash against a hex digit, and lowercase
 * hex sorts in the same order as the bytes it encodes.
 *
 * THE EMPTY SET IS THE INTERESTING CASE and it is why §0 asserts the constant
 * rather than merely computing it: a vacuous closure carries
 * e3b0c442…7852b855, the digest of the empty string, and a TypeScript caller that
 * produced a digest of "[]" or of "" with a trailing separator would fail the
 * deferred constraint trigger at COMMIT with a message about a hash rather than
 * about a bug.
 */
export function frozenOccurrenceSetHash(occurrenceIds: string[]): string {
  return createHash("sha256")
    .update([...occurrenceIds].sort().join(","), "utf8")
    .digest("hex");
}

/**
 * WHICH CODE. Two of the seven, and the reasoning is in
 * `packages/contracts/src/readiness.ts` beside the vocabulary itself: a current
 * RETURN is `CUSTOMER_MOTIVATED_REFUSAL` by state-catalog.csv:116's own
 * definition, and everything else is `SUPERVISION_SIGNATURE_MISSING` by :115's.
 * The two evidence codes are not produced because `evidence_kind` cannot tell a
 * test report from a material certificate, and `ACT_NOT_SIGNED` needs the act,
 * which is M4.
 */
function codeFor(o: EvaluatedOccurrence): BlockedReasonCodeValue {
  return o.currentDecisionOutcome === "returned"
    ? "CUSTOMER_MOTIVATED_REFUSAL"
    : "SUPERVISION_SIGNATURE_MISSING";
}

function missingEvidenceFor(o: EvaluatedOccurrence): MissingEvidenceItem[] {
  if (o.availableEvidenceCount >= o.minEvidenceCount) return [];
  return [{
    evidenceKind: o.evidenceKind as MissingEvidenceItem["evidenceKind"],
    acceptanceCriterion: o.acceptanceCriterion,
    requiredCount: o.minEvidenceCount,
    availableCount: o.availableEvidenceCount,
  }];
}

/**
 * THE MONEY RULE, WRITTEN OUT BECAUSE THE PACKAGE DOES NOT SETTLE IT.
 *
 * ADR-006 step 6: «the amount of the work lines under a blocked stage, at the
 * price on the published baseline, attributed once per assignment». Migration
 * 0045's header records why that is not yet a rule: `work_assignments` is a SLICE
 * of a work item (`planned_quantity`, nullable), so two assignments on one line
 * would each attribute the LINE's whole amount and INV-070's per-assignment
 * deduplication would not prevent it.
 *
 * What this does, and it is a judgement rather than a transcription:
 *
 *   * `planned_share` — `planned_quantity` is present and `contract_quantity` is
 *     positive, so the pool is attributed in that proportion, capped at the whole
 *     line. Two assignments on one line then sum to at most the line.
 *   * `whole_line` — no planned quantity, so the only figure available is the
 *     line's own. THE OVER-ATTRIBUTING CASE. It is labelled on every row and
 *     counted in the totals, so a number can never be read without knowing how
 *     many of the assignments behind it were attributed whole.
 *   * `unvalued` — `unvaluedReason` (the domain's own function, the same one the
 *     carve uses) says the money is not knowable. Then there is NO money on the
 *     row and the size of what waits is a QUANTITY: missing price is unvalued,
 *     never zero (INV-038).
 *
 * Rounding: integer division truncates toward zero, so a share never rounds UP
 * into money the line does not have. `gross = net + tax` is preserved by deriving
 * gross from the two components rather than by scaling it separately, which is
 * what keeps `blocked_reasons_money_check` satisfiable (INV-037).
 */
function attributeValue(v: AssignmentValuation): {
  attribution: BlockedValueAttributionValue;
  net: bigint | null; tax: bigint | null; gross: bigint | null;
  unvaluedQuantity: string | null;
} {
  if (v.unvalued !== null) {
    const qty = v.plannedQuantity ?? v.contractQuantity;
    return {
      attribution: "unvalued", net: null, tax: null, gross: null,
      unvaluedQuantity: fromScaled6(qty),
    };
  }
  if (v.plannedQuantity !== null && v.contractQuantity > 0n) {
    const share = v.plannedQuantity > v.contractQuantity ? v.contractQuantity : v.plannedQuantity;
    const net = (v.net * share) / v.contractQuantity;
    const tax = (v.tax * share) / v.contractQuantity;
    return {
      attribution: "planned_share", net, tax, gross: net + tax, unvaluedQuantity: null,
    };
  }
  return {
    attribution: "whole_line", net: v.net, tax: v.tax, gross: v.net + v.tax,
    unvaluedQuantity: null,
  };
}

export async function assignmentValuations(
  tx: Tx, workspaceId: string, assignmentIds: string[],
): Promise<Map<string, AssignmentValuation>> {
  const out = new Map<string, AssignmentValuation>();
  if (assignmentIds.length === 0) return out;
  const rows = await tx.query(ASSIGNMENT_VALUATION_SQL, [workspaceId, [...new Set(assignmentIds)]]);
  for (const r of rows.rows as Record<string, unknown>[]) {
    const item: WorkItemValuation = {
      pool: {
        net: BigInt(r.net as string), tax: BigInt(r.tax as string),
        gross: BigInt(r.gross as string),
      },
      contractQuantity: toScaled6(r.contract_quantity as string),
      taxMode: r.tax_mode as WorkItemValuation["taxMode"],
      unitPriceState: r.unit_price_state as WorkItemValuation["unitPriceState"],
      valuationBasis: r.valuation_basis as WorkItemValuation["valuationBasis"],
    };
    out.set(r.work_assignment_id as string, {
      workAssignmentId: r.work_assignment_id as string,
      workItemId: r.work_item_id as string,
      contractId: r.contract_id as string,
      contractVersionId: r.contract_version_id as string,
      contractVersionNo: Number(r.contract_version_no),
      unitCode: r.unit_code as string,
      currency: r.currency as string,
      plannedQuantity: r.planned_quantity === null
        ? null : toScaled6(r.planned_quantity as string),
      contractQuantity: item.contractQuantity,
      net: item.pool.net, tax: item.pool.tax, gross: item.pool.gross,
      unitPriceState: item.unitPriceState,
      unvalued: unvaluedReason(item),
    });
  }
  return out;
}

/**
 * One unsatisfied occurrence → one `blocked_reason` object, the shape ADR-005
 * decision 6 defines and `public.blocked_reasons` stores.
 *
 * `since` is the SERVER time the block began: the moment of the return that
 * blocked it, or — when nothing has been decided — the moment the obligation was
 * materialised. Never «now», which would make every refusal look fresh.
 *
 * The normative citation travels as one object or not at all (INV-073). A row
 * whose `norm_ref` reached here without its verification tag or its source is a
 * defect upstream, and the response schema re-parses this at the route boundary
 * so it fails loudly instead of rendering as normative.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A MISSING VALUATION IS A DEFECT AND IS RAISED AS ONE (M3 review finding 6).
 *
 * Until 2026-08-08 an absent `v` produced `blockedValue: null`,
 * `unvaluedQuantity: null` and `valueAttribution: "unvalued"` — an object that
 * `blocked_reasons_names_money_check` (0045:1396-1397) refuses to store and that
 * version-0.1.md §M3 does not admit as a refusal, because it names no money at
 * all. It reached a foreman as a block with a blank amount, which reads as «this
 * is worth nothing» rather than as «this figure is broken».
 *
 * `ASSIGNMENT_VALUATION_SQL` joins `work_items` and `contract_versions` on the
 * assignment's own foreign keys, both NOT NULL, so a row is missing for exactly
 * two reasons and neither is a state a response may describe: the actor cannot
 * SEE the work item (`wi_select` asks `project.view`, which is why both money
 * reads require it beside `readiness.view` — an RLS-invisible row reads as no
 * row, never as an error), or referential integrity is broken. `unvalued` stays
 * what `unvaluedReason` says it is: a line whose PRICE is not knowable, which
 * still names its size as a quantity (INV-038).
 */
export function blockedReasonFor(
  o: EvaluatedOccurrence, stage: EvaluatedStage, v: AssignmentValuation | undefined,
): BlockedReason {
  if (v === undefined) {
    throw new Error(
      `no valuation resolved for work assignment ${o.workAssignmentId} on stage ` +
      `${stage.workStageId}; a blocked reason must name the money or the unvalued ` +
      "quantity (INV-038, blocked_reasons_names_money_check)");
  }
  const value = attributeValue(v);
  return {
    requirementOccurrenceId: o.occurrenceId,
    ruleVersionId: o.ruleVersionId,
    workAssignmentId: o.workAssignmentId,
    workStageId: stage.workStageId,
    stageKey: stage.stageKey,
    workItemId: stage.workItemId,
    code: codeFor(o),
    codeVocabularyVersion: BLOCKED_REASON_CODE_VOCABULARY_VERSION,
    missingEvidence: missingEvidenceFor(o),
    awaitingApproverRole: o.approverRole,
    since: o.currentDecisionOutcome === "returned" && o.currentDecisionAt
      ? o.currentDecisionAt : o.materialisedAt,
    // Exactly one of the two is set, by construction: `attributeValue` returns
    // either a money triple with no quantity, or a quantity with no money. That
    // is the producer's half of `blocked_reasons_names_money_check`; the schema
    // `.refine` on `blockedReason` is the half that runs on the wire.
    blockedValue: value.net !== null
      ? {
          currency: v.currency,
          netMinorUnits: value.net.toString(),
          taxMinorUnits: (value.tax ?? 0n).toString(),
          grossMinorUnits: (value.gross ?? 0n).toString(),
        }
      : null,
    unvaluedQuantity: value.unvaluedQuantity,
    valueAttribution: value.attribution,
    acceptanceCriterion: o.acceptanceCriterion,
    normRef: o.normRef === null ? null : {
      text: o.normRef,
      verification: o.normRefVerification as VerificationTagValue,
      source: o.normRefSource ?? "",
    },
  };
}

/**
 * EVERY LIVE BLOCK IN A PROJECT, in one place, for the two operations that
 * report money against it.
 *
 * `blocked_reasons.get` (M3) and `blocked_value.get` (M6) are the same list
 * counted two ways — one renders the objects, the other sums them — and the one
 * way they could fail is by disagreeing about WHICH blocks are live. So the
 * filter lives here and both call it. Extracted rather than copied for the
 * reason this module's header gives about the predicate itself: two
 * implementations that happen to match today are two implementations that will
 * disagree the first time one of them is edited, and here the disagreement would
 * show up as a total that does not equal the list beneath it.
 *
 * A CLOSED STAGE HAS NO LIVE BLOCK. Its obligations were satisfied at closure —
 * `app.assert_stage_closure_set()` refuses the commit otherwise — and a reason
 * left on the list after the gate opened is an exposure figure nobody can act
 * on. `closed_without_evidence` is unreachable in v0.1 (ADR-006 decision 4) and
 * is filtered out with `closed`, deliberately: on the day the bypass ships, a
 * bypassed stage's money is `CLOSED_WITHOUT_ACT` in the additive partition and
 * NOT a `SUPERVISION_SIGNATURE_MISSING` row inherited from this line.
 *
 * THE DIVERGENCE THIS PARAGRAPH USED TO RECORD IS CLOSED, AND WHAT IT SAID IS
 * KEPT because the shape of the mistake is worth more than the correction.
 * Until 2026-08-08 it read: «`stageReadinessViewOf` below fills `blockedReasons`
 * for a stage of ANY status, so `readiness.get` still describes a closed stage as
 * carrying blocked reasons while both money reads say it carries none… the fix is
 * one rule in `stageReadinessViewOf` and it changes an M3 response shape, which
 * is not this slice's to change.» It was the M3 pre-landing review's finding 8,
 * deferred twice, and by the time the whole build was read it had grown a second
 * head: `canCloseStage` for a CLOSED stage read `true`. Three reads, two opinions
 * about one row — and the filter having been extracted here to stop exactly that
 * is what made the remaining copy look harmless. `stageReadinessViewOf` now
 * applies the same `status === "open"` test this function applies, so there is
 * one opinion; the response-shape change is argued at that function.
 */
export function liveBlockedReasons(
  stages: EvaluatedStage[], valuations: Map<string, AssignmentValuation>,
): BlockedReason[] {
  const out: BlockedReason[] = [];
  for (const s of stages) {
    if (s.status !== "open") continue;
    for (const o of s.unsatisfied) out.push(blockedReasonFor(o, s, valuations.get(o.workAssignmentId)));
  }
  return out;
}

export function occurrenceSatisfactionViewOf(o: EvaluatedOccurrence): OccurrenceSatisfactionView {
  return {
    occurrenceId: o.occurrenceId,
    ruleVersionId: o.ruleVersionId,
    ordinal: o.ordinal,
    interventionType: o.interventionType as OccurrenceSatisfactionView["interventionType"],
    blockingScope: o.blockingScope as OccurrenceSatisfactionView["blockingScope"],
    approverRole: o.approverRole,
    blocksStageClosure: o.blocksStageClosure,
    satisfied: o.satisfied,
    satisfiedBy: o.satisfiedBy,
    currentDecisionId: o.currentDecisionId,
    currentDecisionOutcome: o.currentDecisionOutcome,
    currentExceptionId: o.currentExceptionId,
    currentExceptionAction: o.currentExceptionAction,
  };
}

/**
 * THE VIEW, AND THE ONE PLACE WHERE IT IS NOT THE PREDICATE.
 *
 * `EvaluatedStage.canCloseStage` is `can_close_stage(s)` — the ∀, and nothing
 * else. The closure command needs it in that raw form: it checks the stage is
 * `open` itself (closures/route.ts) and then refuses on the predicate, and a
 * predicate that folded the status in would be answering two questions where
 * ADR-005 decision 7 asks one. So the status rule lives HERE, in the view, and
 * `evaluateStages` is untouched by it.
 *
 * A CLOSED STAGE IS NOT «CLOSABLE», AND UNTIL 2026-08-08 THIS SAID IT WAS.
 * `canCloseStage` was reported for a stage of any status, so a closed stage — the
 * ordinary end state of every satisfied stage in the product — read
 * `canCloseStage: true`, and `blockedReasons` was filled for it while
 * `liveBlockedReasons` dropped it and both money reads inherited that. THREE
 * READS, TWO OPINIONS about the same row: `readiness.get` said a closed stage
 * could be closed and carried blocks, `blocked_reasons.get` and
 * `blocked_value.get` said it carried none. The divergence was recorded at
 * `liveBlockedReasons` and deferred as «not this slice's to change»; it is
 * changed here.
 *
 * IT CHANGES AN M3 RESPONSE SHAPE, stated plainly rather than slipped in. Two
 * fields of `stageReadinessView` change VALUE (never type) for a stage whose
 * status is not `open`: `canCloseStage` becomes false and `blockedReasons`
 * becomes empty. `status` was always on the object beside them, so a client that
 * read the two fields together already had the right answer and a client that
 * read `canCloseStage` alone was being told a closed stage could be closed. No
 * correct client can be relying on the old values. `blockingOccurrenceCount`,
 * `satisfiedOccurrenceCount` and `occurrences` are NOT gated: they are facts
 * about what the stage carried, they are what an act and an audit are read
 * against afterwards, and they are true of a closed stage exactly as they were of
 * the open one.
 *
 * `READINESS_ALGORITHM_VERSION` is bumped with this, which is what it is for.
 */
export function stageReadinessViewOf(
  stage: EvaluatedStage, valuations: Map<string, AssignmentValuation>,
): StageReadinessView {
  // `closed_without_evidence` is unreachable in v0.1 (ADR-006 decision 4) and is
  // deliberately NOT «live», for the reason `liveBlockedReasons` gives about the
  // same test: on the day the bypass ships, a bypassed stage's money is
  // `CLOSED_WITHOUT_ACT` in the additive partition and not a reason inherited
  // from this line.
  const live = stage.status === "open";
  return {
    scopeKind: "work_stage",
    workStageId: stage.workStageId,
    workAssignmentId: stage.workAssignmentId,
    contractId: stage.contractId,
    workItemId: stage.workItemId,
    stageKey: stage.stageKey,
    isConcealed: stage.isConcealed,
    status: stage.status,
    canCloseStage: live && stage.canCloseStage,
    blockingOccurrenceCount: stage.blocking.length,
    satisfiedOccurrenceCount: stage.blocking.filter((o) => o.satisfied).length,
    occurrences: stage.occurrences.map(occurrenceSatisfactionViewOf),
    blockedReasons: live
      ? stage.unsatisfied.map(
        (o) => blockedReasonFor(o, stage, valuations.get(o.workAssignmentId)))
      : [],
  };
}
