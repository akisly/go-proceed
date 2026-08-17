import { randomUUID } from "node:crypto";
import type { Tx } from "@goproceed/database";
import type { MaterialisationPlan } from "./requirement-materialisation";

/**
 * THE ONLY PLACE IN THE PRODUCT THAT INSERTS A REQUIREMENT OCCURRENCE.
 *
 * `requirement_occurrences.create` and `.bulk_instantiate` left v0.1
 * (version-0.1.md §v0.1-M2): the only way an obligation exists is
 * materialisation at assignment creation, because a hand-made obligation is
 * also a hand-removed one. This module is that single door, and
 * `requirement_occurrences.dry_run` does not import it — which is what makes
 * «the dry run writes nothing» checkable by reading the import graph rather
 * than by trusting a code path.
 *
 * Both tables are append-only: no UPDATE or DELETE grant to `goproceed_app` and
 * `app.reject_mutation()` on each (migration 0043 §7-8). There is no correction
 * path for an occurrence — the correction is a different assignment.
 */

export interface MaterialisationTarget {
  workspaceId: string;
  projectId: string;
  contractId: string;
  contractVersionId: string;
  assignmentId: string;
  memberId: string;
}

export interface MaterialisationResult {
  stageIds: string[];
  occurrenceIds: string[];
}

export async function materialiseOccurrences(
  tx: Tx, at: MaterialisationTarget, plan: MaterialisationPlan,
): Promise<MaterialisationResult> {
  const stageIdByKey = new Map<string, string>();
  const concealedByKey = new Map<string, boolean>();

  for (const stage of plan.stages) {
    const stageId = randomUUID();
    // status defaults to 'open' and is not written: the column moves only
    // through the M3 closure command, and writing its initial value here would
    // read as this command having an opinion about a lifecycle it cannot drive.
    await tx.query(
      `insert into public.work_stages
         (id, workspace_id, project_id, contract_id, contract_version_id,
          work_assignment_id, stage_key, is_concealed, created_by_member_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [stageId, at.workspaceId, at.projectId, at.contractId, at.contractVersionId,
       at.assignmentId, stage.stageKey, stage.isConcealed, at.memberId]);
    stageIdByKey.set(stage.stageKey, stageId);
    concealedByKey.set(stage.stageKey, stage.isConcealed);
  }

  const occurrenceIds: string[] = [];
  for (const planned of plan.occurrences) {
    const occurrenceId = randomUUID();
    const r = planned.rule;
    // EVERY PINNED FIELD IS COPIED HERE AND NOWHERE ELSE (INV-066). Four of them
    // — intervention_type, blocking_scope, timing and stage_key — are pinned to
    // the rule version by composite foreign key, so a wrong copy is unstorable.
    // The other nine (evidence_kind, acceptance_criterion, performer_role,
    // approver_role, approver_is_external, min/max_evidence_count and the three
    // norm_ref columns) are copies the schema CANNOT verify: a wrong one stores
    // a well-formed row. Migration 0043 §4 says so in terms and names the field-
    // by-field materialisation test as the only thing standing behind them.
    //
    // location_id and quantity_scope keep their defaults: both are v0.2 shape
    // (ADR-006 decision 4.2) and no v0.1 command writes either.
    await tx.query(
      `insert into public.requirement_occurrences
         (id, workspace_id, project_id, contract_id, contract_version_id,
          work_assignment_id, work_stage_id, stage_is_concealed, stage_key,
          rule_version_id, ordinal, intervention_type, blocking_scope, timing,
          evidence_kind, acceptance_criterion, performer_role, approver_role,
          approver_is_external, min_evidence_count, max_evidence_count,
          norm_ref, norm_ref_verification, norm_ref_source, created_by_member_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
               $19,$20,$21,$22,$23,$24,$25)`,
      [occurrenceId, at.workspaceId, at.projectId, at.contractId, at.contractVersionId,
       at.assignmentId, stageIdByKey.get(planned.stageKey) ?? null,
       concealedByKey.get(planned.stageKey) ?? null, planned.stageKey,
       r.ruleVersionId, r.ordinal, r.interventionType, r.blockingScope, r.timing,
       r.evidenceKind, r.acceptanceCriterion, r.performerRole, r.approverRole,
       r.approverIsExternal, r.minEvidenceCount, r.maxEvidenceCount,
       r.normRef, r.normRefVerification, r.normRefSource, at.memberId]);
    occurrenceIds.push(occurrenceId);
  }

  return { stageIds: [...stageIdByKey.values()], occurrenceIds };
}
