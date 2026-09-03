import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireWorkspaceCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { createProjectRequest, type CreateProjectResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";

export const runtime = "nodejs";

export const POST = commandRoute(createProjectRequest, async (a) => {
  const workspaceId = a.params.workspaceId;
  if (!workspaceId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Робочий простір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const projectId = randomUUID();
  const ctx = { actorUserId: a.userId, organizationId: workspaceId, requestId: a.requestId };
  const out = await withTenantTx(ctx, (tx) =>
    withIdempotency<CreateProjectResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "projects.create", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      requireWorkspaceCapability(a.requestId, m.role, "projects.create");
      await tx.query(
        `insert into public.projects (id, workspace_id, name, code, address, description, status, created_by)
         values ($1,$2,$3,$4,$5,$6,'draft',$7)`,
        [projectId, workspaceId, a.body.name, a.body.code ?? null, a.body.address ?? null,
         a.body.description ?? null, a.userId]);
      // INV-019: project creation atomically grants the creator explicit
      // project administration + visibility; access is never inferred later.
      for (const cap of ["project.admin", "project.view"] as const) {
        await tx.query(
          `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
           values ($1,$2,$3,$4,$5)`,
          [workspaceId, projectId, m.memberId, cap, a.userId]);
      }
      await recordAudit(tx, ctx, {
        action: "project.created", object_type: "project", object_id: projectId, details: {},
      });
      await enqueueOutbox(tx, ctx, {
        topic: "project.created", aggregate_type: "project",
        aggregate_id: projectId, payload_version: 1,
        payload: { workspaceId, projectId },
      });
      return { status: 201, body: { projectId, version: 1 } };
    }));
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
