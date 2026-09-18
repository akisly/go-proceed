import { randomUUID } from "node:crypto";
import type { RecordEvidenceDecisionRequest, RecordEvidenceDecisionResponse } from "@goproceed/contracts";
import { enqueueOutbox, recordAudit, withIdempotency, withTenantTx } from "@goproceed/database";
import { requireActiveMembership, requireProjectCapability, type ActiveMembership } from "../authz";
import type { HandlerResult } from "../command";
import { HttpProblem, problem } from "../http";
import { evaluateStage, lockOccurrenceLineage } from "../readiness";

export interface RecordEvidenceDecisionInput {
  actorUserId: string; requestId: string; occurrenceId: string;
  body: RecordEvidenceDecisionRequest; idempotencyKey: string; requestHash: string;
}

/** Authoritative decision command shared by the member route and provider adapters. */
export async function recordEvidenceDecision(input: RecordEvidenceDecisionInput): Promise<HandlerResult> {
  const { actorUserId, requestId, occurrenceId, body, idempotencyKey, requestHash } = input;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Вимогу не знайдено.",
    { requestId, retryable: false, userAction: "return_to_list" }));
  if (!occurrenceId) throw notFound;
  const conflict = (detail: string) => new HttpProblem(409, problem("OCCURRENCE_CONFLICT", detail,
    { requestId, retryable: false, userAction: "refresh_exact_occurrence" }));
  const ctx = { actorUserId, organizationId: null, requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const occurrences = await tx.query<{ workspace_id: string; project_id: string; work_assignment_id: string; work_stage_id: string | null; approver_role: string }>(
      "select workspace_id,project_id,work_assignment_id,work_stage_id,approver_role from public.requirement_occurrences where id=$1", [occurrenceId]);
    const occ = occurrences.rows[0];
    if (!occ) throw notFound;
    return withIdempotency<RecordEvidenceDecisionResponse, ActiveMembership>(tx, {
      organizationId: occ.workspace_id, actorScope: `user:${actorUserId}`, operationId: "evidence_decisions.create", key: idempotencyKey, requestHash,
      authorize: async () => {
        const membership = await requireActiveMembership(tx, requestId, actorUserId, occ.workspace_id);
        // project.view is required before the RLS-protected head read; otherwise a
        // valid head can look like a root to a decider who lacks view.
        await requireProjectCapability(tx, requestId, { workspaceId: occ.workspace_id, projectId: occ.project_id, memberId: membership.memberId, capability: "project.view" });
        await requireProjectCapability(tx, requestId, { workspaceId: occ.workspace_id, projectId: occ.project_id, memberId: membership.memberId, capability: "evidence_decisions.decide" });
        return membership;
      },
    }, async (membership) => {
      // The self-decision refusal below stays here: it reads rows the caller writes later too.
      await lockOccurrenceLineage(tx, occ.workspace_id, [occurrenceId]);
      const selfRows = await tx.query<{ captured: boolean; recorded_evidence: boolean; recorded_progress: boolean }>(`select
        exists (select 1 from public.upload_intents ui where ui.workspace_id=$1 and ui.requirement_occurrence_id=$2 and ui.created_by_member_id=$3) captured,
        exists (select 1 from public.evidence_objects eo join public.upload_intents ui on ui.workspace_id=eo.workspace_id and ui.id=eo.upload_intent_id where eo.workspace_id=$1 and ui.requirement_occurrence_id=$2 and eo.recorder_member_id=$3) recorded_evidence,
        exists (select 1 from public.progress_entries p where p.workspace_id=$1 and p.work_assignment_id=$4 and p.recorded_by_member_id=$3) recorded_progress`,
      [occ.workspace_id, occurrenceId, membership.memberId, occ.work_assignment_id]);
      const self = selfRows.rows[0]!;
      if (self.captured || self.recorded_evidence || self.recorded_progress) throw new HttpProblem(403, problem("READINESS_OVERRIDE_DENIED",
        "Рішення щодо цієї вимоги має ухвалити інший учасник: ви фіксували докази або обсяг за цим завданням.",
        { requestId, retryable: false, userAction: "resolve_blocker_or_request_manager" }));
      const heads = await tx.query<{ version: string | number; current_decision_id: string | null; decision_no: string | number | null }>(`select h.version,h.current_decision_id,d.decision_no
        from public.requirement_evidence_decision_heads h left join public.requirement_evidence_decisions d on d.workspace_id=h.workspace_id and d.id=h.current_decision_id
        where h.workspace_id=$1 and h.requirement_occurrence_id=$2 and h.approver_role=$3`, [occ.workspace_id, occurrenceId, occ.approver_role]);
      const head = heads.rows[0]; const headVersion = head ? Number(head.version) : null;
      if (body.expectedVersion !== headVersion) throw conflict(headVersion === null
        ? "Щодо цієї вимоги ще немає рішень; надішліть expectedVersion: null."
        : `Рішення щодо цієї вимоги змінилися (поточна версія ${headVersion}).`);
      const decisionNo = head ? Number(head.decision_no) + 1 : 1; const decisionId = randomUUID();
      const inserted = await tx.query<{ decided_at: string }>(`insert into public.requirement_evidence_decisions
        (id,workspace_id,project_id,requirement_occurrence_id,approver_role,outcome,decision_no,superseded_decision_id,superseded_decision_no,decided_by_member_id,reason,issues,idempotency_key,request_hash)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14) returning decided_at`,
      [decisionId,occ.workspace_id,occ.project_id,occurrenceId,occ.approver_role,body.outcome,decisionNo,head?.current_decision_id ?? null,head ? Number(head.decision_no) : null,membership.memberId,body.reason ?? null,JSON.stringify(body.issues),idempotencyKey,requestHash]);
      if (head) {
        const advanced = await tx.query(`update public.requirement_evidence_decision_heads set current_decision_id=$4,current_outcome=$5,version=version+1,updated_at=now()
          where workspace_id=$1 and requirement_occurrence_id=$2 and approver_role=$3 and version=$6 returning version`,
        [occ.workspace_id,occurrenceId,occ.approver_role,decisionId,body.outcome,headVersion]);
        if (!advanced.rows[0]) throw conflict("Рішення щодо цієї вимоги щойно змінилися.");
      } else await tx.query(`insert into public.requirement_evidence_decision_heads
        (workspace_id,project_id,requirement_occurrence_id,approver_role,current_decision_id,current_outcome) values ($1,$2,$3,$4,$5,$6)`,
      [occ.workspace_id,occ.project_id,occurrenceId,occ.approver_role,decisionId,body.outcome]);
      const stage = occ.work_stage_id ? await evaluateStage(tx, { workspaceId: occ.workspace_id, projectId: occ.project_id, workStageId: occ.work_stage_id }) : null;
      const evaluated = stage?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
      await recordAudit(tx, ctx, { action: "requirement_evidence_decision.recorded", object_type: "requirement_occurrence", object_id: occurrenceId,
        details: { decisionId,approverRole: occ.approver_role,outcome: body.outcome,decisionNo,supersededDecisionId: head?.current_decision_id ?? null,workStageId: occ.work_stage_id,stageCanClose: stage?.canCloseStage ?? null } }, { organizationId: occ.workspace_id });
      await enqueueOutbox(tx, ctx, { topic: "requirement_evidence_decision.recorded", aggregate_type: "requirement_occurrence", aggregate_id: occurrenceId, payload_version: 1,
        payload: { workspaceId: occ.workspace_id,projectId: occ.project_id,workAssignmentId: occ.work_assignment_id,workStageId: occ.work_stage_id,requirementOccurrenceId: occurrenceId,decisionId,approverRole: occ.approver_role,outcome: body.outcome,decisionNo } }, { organizationId: occ.workspace_id });
      return { status: 201, body: { decisionId,requirementOccurrenceId: occurrenceId,approverRole: occ.approver_role,outcome: body.outcome,decisionNo,
        supersededDecisionId: head?.current_decision_id ?? null,headVersion: (headVersion ?? 0)+1,decidedAt: new Date(inserted.rows[0]!.decided_at).toISOString(),occurrenceSatisfied: evaluated?.satisfied ?? false,stageCanClose: stage?.canCloseStage ?? null } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
}
