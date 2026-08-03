import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { createAssignmentRequest, type CreateAssignmentResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";

export const runtime = "nodejs";

export const POST = commandRoute(createAssignmentRequest, async (a) => {
  const contractId = a.params.contractId;
  if (!contractId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Договір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const invalid = (path: string, message: string, detail: string) =>
    new HttpProblem(422, problem("VALIDATION_FAILED", message, {
      requestId: a.requestId, retryable: false, userAction: "correct_fields",
      fieldErrors: [{ path, message: detail }],
    }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const c = await tx.query(
      `select workspace_id, project_id from public.contracts where id = $1`, [contractId]);
    if (c.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Договір не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = c.rows[0].workspace_id;
    const projectId: string = c.rows[0].project_id;

    return withIdempotency<CreateAssignmentResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "assignments.create", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "assignments.manage" });

      // The work item must belong to the contract's CURRENT published version.
      // Matching on contract alone would silently attach operational scope to a
      // superseded version, and the assignment would then measure work against
      // quantities and prices nobody is contractually on the hook for.
      const wi = await tx.query(
        `select w.id, w.contract_version_id, w.unit_code
           from public.work_items w
          where w.workspace_id = $1 and w.contract_id = $2 and w.id = $3
            and w.contract_version_id = (
              select v.id from public.contract_versions v
               where v.workspace_id = w.workspace_id and v.contract_id = w.contract_id
               order by v.version_no desc limit 1)`,
        [workspaceId, contractId, a.body.workItemId]);
      if (wi.rows.length === 0) {
        throw invalid("workItemId",
          "Позицію робіт не знайдено в поточній опублікованій версії договору.",
          "unknown work item in the current published version");
      }
      const contractVersionId: string = wi.rows[0].contract_version_id;

      // A draft template can still change, so pinning one would make the pin a
      // promise the system cannot keep.
      if (a.body.requirementTemplateVersionId) {
        const t = await tx.query(
          `select 1 from public.requirement_template_versions
            where workspace_id = $1 and id = $2 and status = 'published'`,
          [workspaceId, a.body.requirementTemplateVersionId]);
        if (t.rows.length === 0) {
          throw invalid("requirementTemplateVersionId",
            "Версію шаблону вимог не знайдено або вона ще не опублікована.",
            "must reference a published template version");
        }
      }

      const assignmentId = randomUUID();
      try {
        await tx.query(
          `insert into public.work_assignments
             (id, workspace_id, project_id, contract_id, contract_version_id, work_item_id,
              location_id, performer_party_id, assignee_member_id, planned_quantity,
              due_date, requirement_template_version_id, created_by_member_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [assignmentId, workspaceId, projectId, contractId, contractVersionId,
           a.body.workItemId, a.body.locationId ?? null, a.body.performerPartyId ?? null,
           a.body.assigneeMemberId ?? null, a.body.plannedQuantity ?? null,
           a.body.dueDate ?? null, a.body.requirementTemplateVersionId ?? null, m.memberId]);
      } catch (e) {
        // The composite foreign keys are the hard guarantee; this turns a raw
        // 23503 into the catalog-coded problem the client can act on.
        if (e instanceof Error && /work_assignments_workspace_id_project_id_location/.test(e.message)) {
          throw invalid("locationId", "Локацію не знайдено в цьому проєкті.",
            "unknown location in this project");
        }
        if (e instanceof Error && /work_assignments_workspace_id_performer/.test(e.message)) {
          throw invalid("performerPartyId", "Сторону-виконавця не знайдено.",
            "unknown party in this workspace");
        }
        if (e instanceof Error && /work_assignments_workspace_id_assignee/.test(e.message)) {
          throw invalid("assigneeMemberId", "Учасника не знайдено в цьому просторі.",
            "unknown membership in this workspace");
        }
        throw e;
      }

      await recordAudit(tx, ctx, {
        action: "assignment.created", object_type: "work_assignment",
        object_id: assignmentId,
        details: { workItemId: a.body.workItemId, contractVersionId },
      }, { organizationId: workspaceId });
      await enqueueOutbox(tx, ctx, {
        topic: "assignment.created", aggregate_type: "work_assignment",
        aggregate_id: assignmentId, payload_version: 1,
        payload: { workspaceId, projectId, contractId, contractVersionId, assignmentId },
      }, { organizationId: workspaceId });

      return { status: 201, body: { assignmentId, version: 1 } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
