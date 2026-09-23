import type { Client } from "pg";
import { seedRuleVersion, type RulesFixture, type RuleVersionSeed } from "./m1-rules-fixture";

/**
 * NOTHING HERE HAS BEEN EXECUTED. No node_modules, no database, no docker: no
 * `pnpm`, `vitest`, `tsc`, `psql` or `supabase` was run against this file, and
 * no claim is made that it applies, compiles or passes. Static reading is the
 * only check that was available.
 *
 * ---------------------------------------------------------------------------
 * Direct-insert fixture for the two tables migration 0043 adds — `work_stages`
 * and `requirement_occurrences` — in the shape m1-rules-fixture.ts established
 * and for the same reason: these suites test foreign keys, CHECKs, triggers,
 * grants and RLS policies, so building the world through the routes would make
 * a policy regression look like a fixture failure.
 *
 * WHY IT PUBLISHES A BASELINE BY BINDING FIRST AND UPDATING SECOND. An
 * occurrence needs a baseline that is BOTH published (leg (a), through
 * `work_assignments_published_baseline_fkey`) AND carrying bindings (leg (b)).
 * Those two are not reachable in either order by a naive insert:
 * `app.guard_rule_binding_window()` (0042:435-466) refuses a binding on an
 * already-published version, and `work_assignments_published_baseline_fkey`
 * refuses an assignment on a draft. The product's two publication routes reach
 * it by binding while the version is a draft and then publishing, and this
 * fixture reproduces exactly that sequence rather than disabling a trigger to
 * shortcut it — a fixture that suppressed the guard would be building a state
 * the product cannot produce, and every refusal tested against it would be
 * tested against a fiction.
 *
 * The publishing UPDATE touches only `status`, `published_at`, `published_by`
 * and `source_manifest_hash`, which is the exact set `app.guard_contract_version()`
 * (0042:247-277) permits to change in the one transition it admits.
 */

const HEX64 = "a".repeat(64);

export interface OccurrenceWorld {
  /** The M1 world this one is built on. */
  rules: RulesFixture;
  /**
   * The version bound while a draft and then published — the shape both
   * publication routes leave behind, and the only shape an occurrence can hang
   * off.
   */
  baselineVersionId: string;
  /** A line of that baseline. */
  workItemId: string;
  /** An assignment on that line. */
  assignmentId: string;
  /** A second assignment on the same line, for the cross-assignment refusals. */
  otherAssignmentId: string;
  /** hold / blocks_stage_closure / before_concealment, stage `stageKey`. */
  holdRuleVersionId: string;
  stageKey: string;
  /** A CONCEALED stage of `assignmentId`, keyed `stageKey`. */
  stageId: string;
  /**
   * hold / blocks_both / after, stage `permissiveStageKey`. Bound to the same
   * baseline and storable — contradiction 6: the CHECK the target DDL declares
   * is deliberately not transcribed, so the v0.2 widening stays additive.
   */
  permissiveRuleVersionId: string;
  permissiveStageKey: string;
  /** An UNCONCEALED stage of `assignmentId`, keyed `permissiveStageKey`. */
  permissiveStageId: string;
  /** Published, in this workspace, and deliberately NOT bound to the baseline. */
  unboundRuleVersionId: string;
  /** status 'draft': reachable only from the admin connection (`rrv_insert`). */
  draftRuleVersionId: string;
}

/**
 * Binds one published rule version to a DRAFT contract version, the way
 * `contract_versions.bind_rules` does.
 */
export async function bindRuleVersion(
  c: Client, f: RulesFixture, contractVersionId: string,
  rv: { ruleVersionId: string; requirementRuleId: string; stageKey: string },
): Promise<string> {
  const r = await c.query<{ id: string }>(
    `insert into public.contract_version_rule_bindings
       (workspace_id, project_id, contract_id, contract_version_id,
        requirement_rule_id, requirement_rule_version_id, stage_key, bound_by_member_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [f.workspaceId, f.projectId, f.contractId, contractVersionId,
     rv.requirementRuleId, rv.ruleVersionId, rv.stageKey, f.memberId]);
  return r.rows[0]!.id;
}

/** The draft → published transition, in the only shape the guard admits. */
export async function publishBaseline(
  c: Client, f: RulesFixture, contractVersionId: string,
): Promise<void> {
  await c.query(
    `update public.contract_versions
        set status = 'published', published_at = now(), published_by = $3,
            source_manifest_hash = $4
      where workspace_id = $1 and id = $2`,
    [f.workspaceId, contractVersionId, f.userId, HEX64]);
}

export async function seedAssignment(
  c: Client, f: RulesFixture, contractVersionId: string, workItemId: string,
): Promise<string> {
  const r = await c.query<{ id: string }>(
    `insert into public.work_assignments
       (workspace_id, project_id, contract_id, contract_version_id, work_item_id,
        created_by_member_id)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [f.workspaceId, f.projectId, f.contractId, contractVersionId, workItemId, f.memberId]);
  return r.rows[0]!.id;
}

export interface StageSeed {
  assignmentId: string;
  contractVersionId: string;
  stageKey: string;
  isConcealed?: boolean;
}

export async function seedStage(
  c: Client, f: RulesFixture, o: StageSeed,
): Promise<string> {
  const r = await c.query<{ id: string }>(
    `insert into public.work_stages
       (workspace_id, project_id, contract_id, contract_version_id,
        work_assignment_id, stage_key, is_concealed, created_by_member_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [f.workspaceId, f.projectId, f.contractId, o.contractVersionId,
     o.assignmentId, o.stageKey, o.isConcealed ?? false, f.memberId]);
  return r.rows[0]!.id;
}

/**
 * Every column `src/lib/occurrence-writer.ts` writes, and no other — so a test
 * that varies one field is varying it against the same INSERT the product
 * performs. Anything the caller does not override takes the value a correct
 * materialisation of `holdRuleVersionId` onto `stageId` would have written.
 */
export interface OccurrenceSeed {
  workspaceId?: string;
  projectId?: string;
  contractId?: string;
  contractVersionId?: string;
  assignmentId?: string;
  workStageId?: string | null;
  stageIsConcealed?: boolean | null;
  stageKey?: string;
  ruleVersionId?: string;
  ordinal?: number;
  interventionType?: string;
  blockingScope?: string;
  timing?: string;
  evidenceKind?: string;
  acceptanceCriterion?: string;
  performerRole?: string;
  approverRole?: string;
  approverIsExternal?: boolean;
  minEvidenceCount?: number;
  maxEvidenceCount?: number | null;
  normRef?: string | null;
  normRefVerification?: string | null;
  normRefSource?: string | null;
  memberId?: string;
}

export const OCCURRENCE_INSERT = `
  insert into public.requirement_occurrences
    (workspace_id, project_id, contract_id, contract_version_id,
     work_assignment_id, work_stage_id, stage_is_concealed, stage_key,
     rule_version_id, ordinal, intervention_type, blocking_scope, timing,
     evidence_kind, acceptance_criterion, performer_role, approver_role,
     approver_is_external, min_evidence_count, max_evidence_count,
     norm_ref, norm_ref_verification, norm_ref_source, created_by_member_id,
     reference_image_version_id)
  values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::boolean,$8::text,
          $9::uuid,$10::integer,$11::text,$12::text,$13::text,$14::text,$15::text,
          $16::text,$17::text,$18::boolean,$19::integer,$20::integer,
          $21::text,$22::text,$23::text,$24::uuid,
          (select reference_image_version_id from public.requirement_rule_versions
            where workspace_id=$1::uuid and id=$9::uuid))
  returning id`;

/**
 * The parameter list for `OCCURRENCE_INSERT`, defaulted to a CORRECT
 * materialisation of the world's hold rule version onto its concealed stage.
 *
 * Separate from the insert itself so the RLS suite can run the same row through
 * `asActor` (which owns its own client) while the schema suite runs it through
 * the admin connection.
 */
export function occurrenceParams(w: OccurrenceWorld, o: OccurrenceSeed = {}): unknown[] {
  const f = w.rules;
  return [
    o.workspaceId ?? f.workspaceId,
    o.projectId ?? f.projectId,
    o.contractId ?? f.contractId,
    o.contractVersionId ?? w.baselineVersionId,
    o.assignmentId ?? w.assignmentId,
    o.workStageId === undefined ? w.stageId : o.workStageId,
    o.stageIsConcealed === undefined ? true : o.stageIsConcealed,
    o.stageKey ?? w.stageKey,
    o.ruleVersionId ?? w.holdRuleVersionId,
    o.ordinal ?? 1,
    o.interventionType ?? "hold",
    o.blockingScope ?? "blocks_stage_closure",
    o.timing ?? "before_concealment",
    o.evidenceKind ?? "photo",
    o.acceptanceCriterion ?? "Приклад-критерій приймання.",
    o.performerRole ?? "foreman",
    o.approverRole ?? "technical_supervisor",
    o.approverIsExternal ?? false,
    o.minEvidenceCount ?? 1,
    o.maxEvidenceCount === undefined ? null : o.maxEvidenceCount,
    o.normRef === undefined ? null : o.normRef,
    o.normRefVerification === undefined ? null : o.normRefVerification,
    o.normRefSource === undefined ? null : o.normRefSource,
    o.memberId ?? f.memberId,
  ];
}

export async function insertOccurrence(
  c: Client, w: OccurrenceWorld, o: OccurrenceSeed = {},
): Promise<string> {
  const r = await c.query<{ id: string }>(OCCURRENCE_INSERT, occurrenceParams(w, o));
  return r.rows[0]!.id;
}

/**
 * `requirement_occurrences` is append-only: `requirement_occurrences_immutable`
 * is a BEFORE DELETE OR UPDATE trigger whose function raises unconditionally,
 * with no role or GUC escape. A suite that needs an occurrence GONE — rather
 * than superseded — must lift the trigger around the delete, which is what the
 * M2 suites already do privately. Exported here so a caller cannot express the
 * delete without the lift, and so the lift is always restored on failure.
 */
export async function deleteOccurrence(c: Client, id: string): Promise<void> {
  await c.query("alter table public.requirement_occurrences disable trigger user");
  try {
    await c.query("delete from public.requirement_occurrences where id=$1", [id]);
  } finally {
    await c.query("alter table public.requirement_occurrences enable trigger user");
  }
}

/**
 * A published baseline with two bound rule versions, one assignment on it and
 * one stage of each concealment — enough for every refusal in the M2 suites to
 * have a positive control beside it.
 *
 * NOTHING IS MATERIALISED HERE. The occurrence rows are the SUBJECT of these
 * suites, so seeding one would make the first assertion a tautology.
 */
export async function seedOccurrenceWorld(
  c: Client, f: RulesFixture, over: { holdRule?: RuleVersionSeed } = {},
): Promise<OccurrenceWorld> {
  const stageKey = "prykhovani-roboty-m2";
  const permissiveStageKey = "zemliani-roboty-m2";

  const hold = await seedRuleVersion(c, f, {
    stageKey, libraryKey: "Н.15/1",
    interventionType: "hold", blockingScope: "blocks_stage_closure",
    timing: "before_concealment", evidenceKind: "photo", ...over.holdRule,
  });
  // CONTRADICTION 6, as a seeded row rather than as a sentence. `hold` +
  // `blocks_both` is what ADR-005 required and what the v0.2 widening migration
  // owes; `publishRequirementRuleVersionRequest` refuses it and the CHECK does
  // not, so the row exists here and cannot exist through the route.
  const permissive = await seedRuleVersion(c, f, {
    stageKey: permissiveStageKey, libraryKey: "Н.15/2",
    interventionType: "hold", blockingScope: "blocks_both",
    timing: "after", evidenceKind: "photo",
  });
  const unbound = await seedRuleVersion(c, f, {
    stageKey, libraryKey: "Н.15/3", timing: "before_concealment",
  });
  const draft = await seedRuleVersion(c, f, {
    stageKey, libraryKey: "Н.15/4", status: "draft", timing: "before_concealment",
  });

  // Bound while the version is still a draft, then published — see the header.
  await bindRuleVersion(c, f, f.draftVersionId, hold);
  await bindRuleVersion(c, f, f.draftVersionId, permissive);
  await publishBaseline(c, f, f.draftVersionId);

  const assignmentId = await seedAssignment(c, f, f.draftVersionId, f.draftWorkItemId);
  const otherAssignmentId = await seedAssignment(c, f, f.draftVersionId, f.draftWorkItemId);

  const stageId = await seedStage(c, f, {
    assignmentId, contractVersionId: f.draftVersionId, stageKey, isConcealed: true });
  const permissiveStageId = await seedStage(c, f, {
    assignmentId, contractVersionId: f.draftVersionId,
    stageKey: permissiveStageKey, isConcealed: false });

  return {
    rules: f,
    baselineVersionId: f.draftVersionId,
    workItemId: f.draftWorkItemId,
    assignmentId, otherAssignmentId,
    holdRuleVersionId: hold.ruleVersionId,
    stageKey, stageId,
    permissiveRuleVersionId: permissive.ruleVersionId,
    permissiveStageKey, permissiveStageId,
    unboundRuleVersionId: unbound.ruleVersionId,
    draftRuleVersionId: draft.ruleVersionId,
  };
}
