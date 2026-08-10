import type { Client } from "pg";
import { createHash } from "node:crypto";
import { seedRuleVersion, type RulesFixture } from "./m1-rules-fixture";
import {
  OCCURRENCE_INSERT, bindRuleVersion, publishBaseline, seedAssignment, seedStage,
} from "./m2-occurrences-fixture";

/**
 * NOTHING HERE HAS BEEN EXECUTED. No node_modules, no database, no docker: no
 * `pnpm`, `vitest`, `tsc`, `psql` or `supabase` was run against this file, no
 * migration was applied, and no claim is made that it applies, compiles or
 * passes. Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * Direct-insert fixture for the six fact tables and two projections migration
 * 0045 adds, in the shape m1-rules-fixture.ts and m2-occurrences-fixture.ts
 * established and for the same reason: the M3 database suites test keys, CHECKs,
 * triggers, grants and RLS policies, so building the world through the routes
 * would make a policy regression look like a fixture failure.
 *
 * WHY IT DOES NOT REUSE `seedOccurrenceWorld`. That world binds two rule
 * versions on two DIFFERENT stage keys, so its stages carry one obligation each.
 * Everything M3 is about needs TWO blocking obligations on ONE stage: with a
 * single obligation, «a closure that leaves a blocking obligation out of its
 * frozen set is refused» and «a closure with an empty set is refused» are the
 * same sentence, and the completeness trigger would be satisfied by a command
 * that stopped at the first occurrence it found. `requirement_occurrences`
 * carries `unique (workspace_id, work_assignment_id, work_stage_id,
 * rule_version_id)` (0043:712-716), so two obligations on one stage means two
 * rule versions sharing a stage key — which has to be arranged at binding time,
 * before the baseline is published.
 *
 * THE THIRD OCCURRENCE IS THE ONE THAT MATTERS MOST. `advisoryOccurrenceId`
 * carries `blocking_scope = 'none'` on the SAME stage. It is what makes «the
 * expected set is the BLOCKING occurrences of the stage» a testable sentence
 * rather than «all of them», and it is the row a closure would reach for if it
 * wanted to pad its frozen set until the counts agreed.
 *
 * WHY THE BASELINE IS BOUND WHILE A DRAFT AND PUBLISHED SECOND: unchanged from
 * m2-occurrences-fixture.ts's header. `app.guard_rule_binding_window()` refuses
 * a binding on a published version and `work_assignments_published_baseline_fkey`
 * refuses an assignment on a draft, so this is the only order the product itself
 * can reach, and a fixture that suppressed either guard would build a state no
 * user can produce.
 */

/**
 * The four capabilities migration 0045 §1 adds, NONE of which appears in any row
 * of technical/permissions/responsibility-presets.csv.
 *
 * Granted by hand here and named rather than folded into a list, because a
 * fixture that quietly issues a capability no persona holds is exactly the shape
 * of gap the M1 review found on `rule_bindings.manage` (finding 8) — the suite
 * stays green while no real actor can perform the operation. On the day a preset
 * carries these, this constant becomes redundant and nothing else changes.
 */
export const M3_PRESET_GAP = [
  "stage_closures.close",
  "evidence_decisions.decide",
  "requirement_exceptions.decide",
  "readiness.view",
] as const;

export const STAGE_KEY = "prykhovani-roboty-m3";
export const OTHER_STAGE_KEY = "montazhni-roboty-m3";
/** Every rule version this fixture publishes names an internal supervisor. */
export const APPROVER_ROLE = "technical_supervisor";

/**
 * The digest migration 0045 §5's deferred trigger recomputes: sha256, lowercase
 * hex, over the member occurrence ids as canonical uuid text sorted ascending
 * and joined with a single ',', and the empty string for an empty set.
 *
 * WRITTEN OUT HERE RATHER THAN IMPORTED. `apps/app/src/lib/readiness.ts` has the
 * product's copy and this package cannot import from `apps/`. That is not a
 * weakness of this fixture: what the suites assert is that PostgreSQL refuses a
 * closure whose stored hash does not describe the set that was frozen, and a
 * second independent implementation agreeing with the first is a stronger check
 * than one implementation compared with itself. The empty-set constant is
 * asserted against the literal migration 0045 §0 probes, which ties the third
 * copy in.
 */
export function frozenSetHash(occurrenceIds: readonly string[]): string {
  return createHash("sha256")
    .update([...occurrenceIds].sort().join(","), "utf8")
    .digest("hex");
}

/** The digest of the empty string — migration 0045 §0 asserts this exact value. */
export const EMPTY_SET_HASH =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const HEX64 = "a".repeat(64);

export interface ClosureWorld {
  rules: RulesFixture;
  /** Bound while a draft, then published — the only shape an occurrence hangs off. */
  baselineVersionId: string;
  workItemId: string;
  assignmentId: string;
  /** A second assignment on the same line, for the cross-assignment refusals. */
  otherAssignmentId: string;

  /** CONCEALED, keyed STAGE_KEY, on `assignmentId`. Carries three occurrences. */
  stageId: string;
  /** CONCEALED, keyed OTHER_STAGE_KEY, on `assignmentId`. Carries one. */
  otherStageId: string;
  /** CONCEALED, keyed STAGE_KEY, on `otherAssignmentId`. Carries none. */
  foreignAssignmentStageId: string;

  /** hold / blocks_stage_closure, on `stageId`. */
  blockingA: string;
  /** hold / blocks_stage_closure, on `stageId`. */
  blockingB: string;
  /** hold / **none**, on `stageId` — applicable, and it does not block closure. */
  advisoryOccurrence: string;
  /** hold / blocks_stage_closure, on `otherStageId`. */
  otherStageOccurrence: string;
}

/** The 24 parameters of OCCURRENCE_INSERT, in its own order. */
function occurrenceParams(w: {
  rules: RulesFixture; baselineVersionId: string;
}, o: {
  assignmentId: string; workStageId: string; stageKey: string;
  ruleVersionId: string; blockingScope: string; timing?: string; ordinal?: number;
  interventionType?: string; approverRole?: string;
}): unknown[] {
  const f = w.rules;
  return [
    f.workspaceId, f.projectId, f.contractId, w.baselineVersionId,
    o.assignmentId, o.workStageId, true, o.stageKey,
    o.ruleVersionId, o.ordinal ?? 1, o.interventionType ?? "hold", o.blockingScope,
    o.timing ?? "before_concealment", "photo", "Приклад-критерій приймання.",
    "foreman", o.approverRole ?? APPROVER_ROLE, false, 1, null,
    null, null, null, f.memberId,
  ];
}

/**
 * A published, bound baseline; one assignment; two concealed stages; four
 * obligations arranged so every M3 refusal has a positive control beside it.
 *
 * The M3 capabilities are granted here because `seedRulesWorld` predates them.
 */
export async function seedClosureWorld(c: Client, f: RulesFixture): Promise<ClosureWorld> {
  for (const capability of M3_PRESET_GAP) {
    await c.query(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,$4,$5)
       on conflict do nothing`,
      [f.workspaceId, f.projectId, f.memberId, capability, f.userId]);
  }

  const holdA = await seedRuleVersion(c, f, {
    stageKey: STAGE_KEY, libraryKey: "Н.15/1",
    interventionType: "hold", blockingScope: "blocks_stage_closure",
    timing: "before_concealment", evidenceKind: "photo",
  });
  const holdB = await seedRuleVersion(c, f, {
    stageKey: STAGE_KEY, libraryKey: "Н.15/2",
    interventionType: "hold", blockingScope: "blocks_stage_closure",
    timing: "before_concealment", evidenceKind: "photo",
  });
  // blocking_scope 'none' on a HOLD. 0041:409 admits it — «a hold's scope is
  // none, blocks_stage_closure or blocks_both» — and the v0.1 publish command
  // refuses it (INV-066's v0.1 form), which is why it is seeded rather than
  // routed. It is the padding row every completeness assertion needs.
  const advisory = await seedRuleVersion(c, f, {
    stageKey: STAGE_KEY, libraryKey: "Н.15/3",
    interventionType: "hold", blockingScope: "none",
    timing: "before_concealment", evidenceKind: "photo",
  });
  const other = await seedRuleVersion(c, f, {
    stageKey: OTHER_STAGE_KEY, libraryKey: "Н.15/4",
    interventionType: "hold", blockingScope: "blocks_stage_closure",
    timing: "before_concealment", evidenceKind: "photo",
  });

  for (const rv of [holdA, holdB, advisory, other]) {
    await bindRuleVersion(c, f, f.draftVersionId, rv);
  }
  await publishBaseline(c, f, f.draftVersionId);

  const assignmentId = await seedAssignment(c, f, f.draftVersionId, f.draftWorkItemId);
  const otherAssignmentId = await seedAssignment(c, f, f.draftVersionId, f.draftWorkItemId);

  const stageId = await seedStage(c, f, {
    assignmentId, contractVersionId: f.draftVersionId,
    stageKey: STAGE_KEY, isConcealed: true });
  const otherStageId = await seedStage(c, f, {
    assignmentId, contractVersionId: f.draftVersionId,
    stageKey: OTHER_STAGE_KEY, isConcealed: true });
  const foreignAssignmentStageId = await seedStage(c, f, {
    assignmentId: otherAssignmentId, contractVersionId: f.draftVersionId,
    stageKey: STAGE_KEY, isConcealed: true });

  const w = { rules: f, baselineVersionId: f.draftVersionId };
  const insert = async (o: Parameters<typeof occurrenceParams>[1]): Promise<string> => {
    const r = await c.query<{ id: string }>(OCCURRENCE_INSERT, occurrenceParams(w, o));
    return r.rows[0]!.id;
  };

  const blockingA = await insert({
    assignmentId, workStageId: stageId, stageKey: STAGE_KEY,
    ruleVersionId: holdA.ruleVersionId, blockingScope: "blocks_stage_closure" });
  const blockingB = await insert({
    assignmentId, workStageId: stageId, stageKey: STAGE_KEY,
    ruleVersionId: holdB.ruleVersionId, blockingScope: "blocks_stage_closure", ordinal: 2 });
  const advisoryOccurrence = await insert({
    assignmentId, workStageId: stageId, stageKey: STAGE_KEY,
    ruleVersionId: advisory.ruleVersionId, blockingScope: "none", ordinal: 3 });
  const otherStageOccurrence = await insert({
    assignmentId, workStageId: otherStageId, stageKey: OTHER_STAGE_KEY,
    ruleVersionId: other.ruleVersionId, blockingScope: "blocks_stage_closure" });

  return {
    rules: f, baselineVersionId: f.draftVersionId, workItemId: f.draftWorkItemId,
    assignmentId, otherAssignmentId,
    stageId, otherStageId, foreignAssignmentStageId,
    blockingA, blockingB, advisoryOccurrence, otherStageOccurrence,
  };
}

// ── the two lineages, and their heads ───────────────────────────────────────

export interface ExceptionSeed {
  occurrenceId: string;
  action: "waiver" | "accept_risk" | "not_applicable" | "revoke";
  /** Pinned FROM the occurrence by foreign key; overridable to attack the pin. */
  interventionType?: string;
  exceptionNo?: number;
  predecessorExceptionId?: string | null;
  predecessorExceptionNo?: number | null;
  exceptionScope?: string;
  reason?: string;
  idempotencyKey?: string;
  workspaceId?: string;
  projectId?: string;
  authorityMemberId?: string;
}

export const EXCEPTION_INSERT = `
  insert into public.requirement_exceptions
    (workspace_id, project_id, requirement_occurrence_id, occurrence_intervention_type,
     exception_scope, action, exception_no, predecessor_exception_id,
     predecessor_exception_no, authority_member_id, reason, idempotency_key, request_hash)
  values ($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text,$7::integer,$8::uuid,
          $9::integer,$10::uuid,$11::text,$12::text,$13::text)
  returning id`;

export function exceptionParams(w: ClosureWorld, o: ExceptionSeed): unknown[] {
  const f = w.rules;
  return [
    o.workspaceId ?? f.workspaceId,
    o.projectId ?? f.projectId,
    o.occurrenceId,
    o.interventionType ?? "hold",
    o.exceptionScope ?? "occurrence",
    o.action,
    o.exceptionNo ?? 1,
    o.predecessorExceptionId === undefined ? null : o.predecessorExceptionId,
    o.predecessorExceptionNo === undefined ? null : o.predecessorExceptionNo,
    o.authorityMemberId ?? f.memberId,
    o.reason ?? "Приклад-обґрунтування винятку.",
    o.idempotencyKey ?? crypto.randomUUID(),
    HEX64,
  ];
}

export async function insertException(
  c: Client, w: ClosureWorld, o: ExceptionSeed,
): Promise<string> {
  const r = await c.query<{ id: string }>(EXCEPTION_INSERT, exceptionParams(w, o));
  return r.rows[0]!.id;
}

/** Opens the exception head, exactly as `requirement_exceptions.create` does. */
export async function openExceptionHead(
  c: Client, w: ClosureWorld, occurrenceId: string, exceptionId: string, action: string,
): Promise<void> {
  await c.query(
    `insert into public.requirement_exception_heads
       (workspace_id, project_id, requirement_occurrence_id, exception_scope,
        current_exception_id, current_action)
     values ($1,$2,$3,'occurrence',$4,$5)`,
    [w.rules.workspaceId, w.rules.projectId, occurrenceId, exceptionId, action]);
}

export async function advanceExceptionHead(
  c: Client, w: ClosureWorld, occurrenceId: string, exceptionId: string, action: string,
  o: { version?: number } = {},
): Promise<void> {
  await c.query(
    `update public.requirement_exception_heads
        set current_exception_id = $4, current_action = $5,
            version = ${o.version === undefined ? "version + 1" : "$6"}, updated_at = now()
      where workspace_id = $1 and requirement_occurrence_id = $2 and exception_scope = $3`,
    o.version === undefined
      ? [w.rules.workspaceId, occurrenceId, "occurrence", exceptionId, action]
      : [w.rules.workspaceId, occurrenceId, "occurrence", exceptionId, action, o.version]);
}

/** An exception plus its head, in the order the command writes them. */
export async function recordException(
  c: Client, w: ClosureWorld, o: ExceptionSeed,
): Promise<string> {
  const id = await insertException(c, w, o);
  if ((o.exceptionNo ?? 1) === 1) await openExceptionHead(c, w, o.occurrenceId, id, o.action);
  else await advanceExceptionHead(c, w, o.occurrenceId, id, o.action);
  return id;
}

export interface DecisionSeed {
  occurrenceId: string;
  outcome: "accepted" | "returned";
  approverRole?: string;
  decisionNo?: number;
  supersededDecisionId?: string | null;
  supersededDecisionNo?: number | null;
  reason?: string | null;
  decidedByMemberId?: string | null;
  externalSessionId?: string | null;
  externalAccessGrantId?: string | null;
  decisionBatchId?: string | null;
  assuranceLabel?: string | null;
  idempotencyKey?: string;
  workspaceId?: string;
  projectId?: string;
}

export const DECISION_INSERT = `
  insert into public.requirement_evidence_decisions
    (workspace_id, project_id, requirement_occurrence_id, approver_role, outcome,
     decision_no, superseded_decision_id, superseded_decision_no,
     decided_by_member_id, external_session_id, external_access_grant_id,
     decision_batch_id, assurance_label, reason, idempotency_key, request_hash)
  values ($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::integer,$7::uuid,$8::integer,
          $9::uuid,$10::uuid,$11::uuid,$12::uuid,$13::text,$14::text,$15::text,$16::text)
  returning id`;

export function decisionParams(w: ClosureWorld, o: DecisionSeed): unknown[] {
  const f = w.rules;
  return [
    o.workspaceId ?? f.workspaceId,
    o.projectId ?? f.projectId,
    o.occurrenceId,
    o.approverRole ?? APPROVER_ROLE,
    o.outcome,
    o.decisionNo ?? 1,
    o.supersededDecisionId === undefined ? null : o.supersededDecisionId,
    o.supersededDecisionNo === undefined ? null : o.supersededDecisionNo,
    o.decidedByMemberId === undefined ? f.memberId : o.decidedByMemberId,
    o.externalSessionId ?? null,
    o.externalAccessGrantId ?? null,
    o.decisionBatchId ?? null,
    o.assuranceLabel ?? null,
    o.reason === undefined
      ? (o.outcome === "returned" ? "Приклад-мотивована відмова." : null)
      : o.reason,
    o.idempotencyKey ?? crypto.randomUUID(),
    HEX64,
  ];
}

export async function insertDecision(
  c: Client, w: ClosureWorld, o: DecisionSeed,
): Promise<string> {
  const r = await c.query<{ id: string }>(DECISION_INSERT, decisionParams(w, o));
  return r.rows[0]!.id;
}

export async function openDecisionHead(
  c: Client, w: ClosureWorld, occurrenceId: string, decisionId: string, outcome: string,
  approverRole = APPROVER_ROLE,
): Promise<void> {
  await c.query(
    `insert into public.requirement_evidence_decision_heads
       (workspace_id, project_id, requirement_occurrence_id, approver_role,
        current_decision_id, current_outcome)
     values ($1,$2,$3,$4,$5,$6)`,
    [w.rules.workspaceId, w.rules.projectId, occurrenceId, approverRole, decisionId, outcome]);
}

export async function advanceDecisionHead(
  c: Client, w: ClosureWorld, occurrenceId: string, decisionId: string, outcome: string,
  o: { version?: number; approverRole?: string } = {},
): Promise<void> {
  const role = o.approverRole ?? APPROVER_ROLE;
  await c.query(
    `update public.requirement_evidence_decision_heads
        set current_decision_id = $4, current_outcome = $5,
            version = ${o.version === undefined ? "version + 1" : "$6"}, updated_at = now()
      where workspace_id = $1 and requirement_occurrence_id = $2 and approver_role = $3`,
    o.version === undefined
      ? [w.rules.workspaceId, occurrenceId, role, decisionId, outcome]
      : [w.rules.workspaceId, occurrenceId, role, decisionId, outcome, o.version]);
}

/** A decision plus its head, in the order the command writes them. */
export async function recordDecision(
  c: Client, w: ClosureWorld, o: DecisionSeed,
): Promise<string> {
  const id = await insertDecision(c, w, o);
  if ((o.decisionNo ?? 1) === 1) {
    await openDecisionHead(c, w, o.occurrenceId, id, o.outcome, o.approverRole);
  } else {
    // `exactOptionalPropertyTypes` distinguishes "absent" from "present and
    // undefined", and the callee's `approverRole?: string` means absent. Spread
    // the key in only when there is one rather than widening the callee to
    // accept undefined — the callee's signature is right, this call was lazy.
    await advanceDecisionHead(c, w, o.occurrenceId, id, o.outcome,
      o.approverRole === undefined ? {} : { approverRole: o.approverRole });
  }
  return id;
}

// ── the closure itself ──────────────────────────────────────────────────────

export interface FrozenMember {
  occurrenceId: string;
  blockingScope?: string;
  satisfiedBy: "evidence_decision" | "exception";
  decisionId?: string | null;
  decisionOutcome?: string | null;
  exceptionId?: string | null;
  exceptionAction?: string | null;
  /** Overridable so a member row can be made to name another closure's stage. */
  workStageId?: string;
  projectId?: string;
}

export interface ClosureAttempt {
  stageId?: string;
  assignmentId?: string;
  members?: FrozenMember[];
  /** Defaults to `members.length`; overridable to attack the claim. */
  claimedCount?: number;
  /** Defaults to the digest of the member ids; overridable to attack the claim. */
  claimedHash?: string;
  closureId?: string;
  closureNo?: number;
  predecessorClosureId?: string | null;
  predecessorClosureNo?: number | null;
  correctionReason?: string | null;
  /** Whose capability the deferred definer trigger resolves at COMMIT. */
  actorUserId?: string;
  /** Set false to insert a closure against a stage still recorded open. */
  moveStage?: boolean;
  /** Set false to move the stage and insert NO closure fact behind it. */
  writeClosure?: boolean;
  contractId?: string;
  workspaceId?: string;
  projectId?: string;
}

export interface ClosureOutcome {
  /** The raised message, or null when the whole transaction committed. */
  error: string | null;
  /** The SQLSTATE of whatever failed, or null. */
  sqlstate: string | null;
  closureId: string;
}

/**
 * One closure attempt, as ONE TRANSACTION on the admin connection.
 *
 * IT IS A TRANSACTION AND NOT THREE STATEMENTS, and that is not convenience.
 * Both of migration 0045's constraint triggers are DEFERRABLE INITIALLY DEFERRED
 * and fire at COMMIT, so a statement-at-a-time fixture would never reach them
 * and every completeness assertion in the schema suite would be asserting
 * nothing. `app.guard_closure_member_window()` compares the closure's xmin
 * against the current transaction id for the same reason: outside a transaction
 * it cannot answer.
 *
 * THE ACTOR GUC IS SET INSIDE IT, and it has to be. `app.assert_stage_closure_set()`
 * is SECURITY DEFINER and asks `app.has_project_capability(...,
 * array['stage_closures.close'])` BEFORE it counts anything, and
 * `app.current_actor()` reads `app.actor_user_id` (0003:68-71). A constraint
 * trigger fires for the table OWNER too — it is not RLS — so the admin
 * connection is authorized here exactly as an application connection would be,
 * which is what makes the unauthorized case testable at all.
 *
 * THE STATEMENT ORDER IS THE PRODUCT'S. The stage moves first, because
 * `stage_closures_stage_fkey` names `status = 'closed'` and cannot resolve
 * against an open stage; the members come last, because they name the closure.
 */
export async function attemptClosure(
  c: Client, w: ClosureWorld, o: ClosureAttempt = {},
): Promise<ClosureOutcome> {
  const f = w.rules;
  const workspaceId = o.workspaceId ?? f.workspaceId;
  const projectId = o.projectId ?? f.projectId;
  const contractId = o.contractId ?? f.contractId;
  const stageId = o.stageId ?? w.stageId;
  const assignmentId = o.assignmentId ?? w.assignmentId;
  const members = o.members ?? [];
  const closureId = o.closureId
    ?? (await c.query<{ id: string }>("select gen_random_uuid() as id")).rows[0]!.id;
  const memberIds = members.map((m) => m.occurrenceId);

  try {
    await c.query("begin");
    await c.query("select set_config('app.actor_user_id', $1, true)",
      [o.actorUserId ?? f.userId]);

    if (o.moveStage !== false) {
      await c.query(
        `update public.work_stages
            set status = 'closed', version = version + 1, updated_at = now()
          where workspace_id = $1 and id = $2 and status = 'open'`,
        [workspaceId, stageId]);
    }

    if (o.writeClosure !== false) {
      await c.query(
        `insert into public.stage_closures
           (id, workspace_id, project_id, contract_id, work_assignment_id, work_stage_id,
            closure_no, predecessor_closure_id, predecessor_closure_no, correction_reason,
            closed_by_member_id, can_close_stage_result,
            evaluated_occurrence_count, evaluated_occurrence_set_hash,
            idempotency_key, request_hash)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14,$15)`,
        [closureId, workspaceId, projectId, contractId, assignmentId, stageId,
         o.closureNo ?? 1,
         o.predecessorClosureId ?? null,
         o.predecessorClosureNo ?? null,
         o.correctionReason ?? null,
         f.memberId,
         o.claimedCount ?? memberIds.length,
         o.claimedHash ?? frozenSetHash(memberIds),
         crypto.randomUUID(), HEX64]);

      for (const m of members) {
        await c.query(
          `insert into public.stage_closure_occurrences
             (workspace_id, project_id, stage_closure_id, work_stage_id,
              requirement_occurrence_id, occurrence_blocking_scope, satisfied_by,
              relied_on_decision_id, relied_on_decision_outcome,
              relied_on_exception_id, relied_on_exception_action)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [workspaceId, m.projectId ?? projectId, closureId, m.workStageId ?? stageId,
           m.occurrenceId, m.blockingScope ?? "blocks_stage_closure", m.satisfiedBy,
           m.decisionId ?? null,
           m.decisionOutcome === undefined
             ? (m.satisfiedBy === "evidence_decision" ? "accepted" : null)
             : m.decisionOutcome,
           m.exceptionId ?? null,
           m.exceptionAction ?? null]);
      }
    }

    await c.query("commit");
    return { error: null, sqlstate: null, closureId };
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    return {
      error: (e as Error).message,
      sqlstate: (e as { code?: string }).code ?? "unknown",
      closureId,
    };
  }
}

/** Adds one member row to an ALREADY COMMITTED closure, in its own transaction. */
export async function appendMemberLater(
  c: Client, w: ClosureWorld, closureId: string, m: FrozenMember,
): Promise<{ error: string | null }> {
  try {
    await c.query(
      `insert into public.stage_closure_occurrences
         (workspace_id, project_id, stage_closure_id, work_stage_id,
          requirement_occurrence_id, occurrence_blocking_scope, satisfied_by,
          relied_on_decision_id, relied_on_decision_outcome,
          relied_on_exception_id, relied_on_exception_action)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [w.rules.workspaceId, w.rules.projectId, closureId, m.workStageId ?? w.stageId,
       m.occurrenceId, m.blockingScope ?? "blocks_stage_closure", m.satisfiedBy,
       m.decisionId ?? null,
       m.satisfiedBy === "evidence_decision" ? "accepted" : null,
       m.exceptionId ?? null, m.exceptionAction ?? null]);
    return { error: null };
  } catch (e) { return { error: (e as Error).message }; }
}

/**
 * Returns the world to the state `seedClosureWorld` left it in: no closures, no
 * decisions, no exceptions, both stages open at version 1.
 *
 * `disable trigger user` suppresses `app.reject_mutation()`, the two head guards
 * and `app.guard_work_stage()` — and nothing else. In particular it does not
 * suppress referential integrity, which is why the ORDER below still matters and
 * is why this can only remove rows that are genuinely unreferenced.
 */
export async function resetClosureFacts(c: Client, workspaceId: string): Promise<void> {
  const tables = [
    "blocked_reasons", "readiness_projection",
    "stage_closure_occurrences", "stage_closures",
    "requirement_evidence_decision_heads", "requirement_evidence_decisions",
    "requirement_exception_heads", "requirement_exceptions",
  ];
  for (const t of tables) {
    await c.query(`alter table public.${t} disable trigger user`);
    try {
      await c.query(`delete from public.${t} where workspace_id = $1`, [workspaceId]);
    } finally {
      await c.query(`alter table public.${t} enable trigger user`);
    }
  }
  await c.query(`alter table public.work_stages disable trigger user`);
  try {
    await c.query(
      `update public.work_stages set status = 'open', version = 1, updated_at = now()
        where workspace_id = $1`, [workspaceId]);
  } finally {
    await c.query(`alter table public.work_stages enable trigger user`);
  }
}

/** One readiness projection row, as the rebuilder that does not exist would write it. */
export function readinessProjectionParams(
  w: ClosureWorld, over: { workspaceId?: string; projectId?: string; contractId?: string;
                           scopeKind?: string; scopeRef?: string; ready?: boolean } = {},
): unknown[] {
  const f = w.rules;
  return [
    over.workspaceId ?? f.workspaceId,
    over.projectId ?? f.projectId,
    over.contractId ?? f.contractId,
    over.scopeKind ?? "work_stage",
    over.scopeRef ?? w.stageId,
    over.ready ?? false,
    "wm-0001", "m3-readiness-1",
  ];
}

export const READINESS_PROJECTION_INSERT = `
  insert into public.readiness_projection
    (workspace_id, project_id, contract_id, scope_kind, scope_ref, ready,
     source_watermark, algorithm_version)
  values ($1::uuid,$2::uuid,$3::uuid,$4::text,$5::uuid,$6::boolean,$7::text,$8::text)`;

/**
 * One blocked_reason row, coupled money and all.
 *
 * `rule_version_id` is NOT NULL here and must be the occurrence's own
 * (blocked_reasons_occurrence_fkey), so the caller passes a value READ BACK by
 * the admin connection rather than letting the INSERT look it up. An
 * `insert … select` would return zero rows — not an error — when RLS hides the
 * occurrence, and every cross-tenant assertion in the RLS suite would then pass
 * for the wrong reason.
 */
export function blockedReasonParams(
  w: ClosureWorld,
  ruleVersionId: string,
  over: { workspaceId?: string; projectId?: string; contractId?: string;
          occurrenceId?: string; assignmentId?: string; code?: string } = {},
): unknown[] {
  const f = w.rules;
  return [
    over.workspaceId ?? f.workspaceId,
    over.projectId ?? f.projectId,
    over.contractId ?? f.contractId,
    over.assignmentId ?? w.assignmentId,
    over.occurrenceId ?? w.blockingA,
    ruleVersionId,
    over.code ?? "SUPERVISION_SIGNATURE_MISSING",
    "2026-08-06", APPROVER_ROLE,
    "UAH", "100000", "20000", "120000",
    "wm-0001", "m3-blocked-1",
  ];
}

export const BLOCKED_REASON_INSERT = `
  insert into public.blocked_reasons
    (workspace_id, project_id, contract_id, work_assignment_id,
     requirement_occurrence_id, rule_version_id, code, code_vocabulary_version,
     awaiting_approver_role, since, currency,
     net_minor_units, tax_minor_units, gross_minor_units,
     source_watermark, algorithm_version)
  values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,
          $7::text,$8::text,$9::text, now(), $10::char(3),
          $11::bigint,$12::bigint,$13::bigint,$14::text,$15::text)`;

/** The occurrence's own pinned rule version — what a blocked_reason must carry. */
export async function ruleVersionOf(c: Client, occurrenceId: string): Promise<string> {
  const r = await c.query<{ rule_version_id: string }>(
    `select rule_version_id from public.requirement_occurrences where id = $1`, [occurrenceId]);
  if (r.rows.length !== 1) throw new Error(`m3-closure-fixture: no occurrence ${occurrenceId}`);
  return r.rows[0]!.rule_version_id;
}
