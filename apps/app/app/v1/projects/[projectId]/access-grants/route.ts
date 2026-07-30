import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { grantProjectAccessRequest, type GrantProjectAccessResponse } from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@aktflow/database";

export const runtime = "nodejs";

export const POST = commandRoute(grantProjectAccessRequest, async (a) => {
  const projectId = a.params.projectId;
  if (!projectId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const p = await tx.query(`select workspace_id from public.projects where id = $1`, [projectId]);
    if (p.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = p.rows[0].workspace_id;
    return withIdempotency<GrantProjectAccessResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "project_access.grant", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "project.admin" });
      // Target must be an ACTIVE membership of the same workspace.
      const target = await tx.query(
        `select 1 from public.memberships where organization_id = $1 and id = $2 and status = 'active'`,
        [workspaceId, a.body.memberId]);
      if (target.rows.length === 0) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Отримувач має бути активним учасником цього робочого простору.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "memberId", message: "not an active member" }],
          }));
      }
      // Plan decision 6: any action capability implies adding project.view.
      const caps = new Set(a.body.capabilities);
      if ([...caps].some((c) => c !== "project.view")) caps.add("project.view");
      const granted: { capability: string; grantId: string }[] = [];
      for (const cap of caps) {
        const dup = await tx.query(
          `select 1 from public.project_access_grants
            where workspace_id=$1 and project_id=$2 and member_id=$3 and capability=$4
              and revoked_at is null`,
          [workspaceId, projectId, a.body.memberId, cap]);
        if (dup.rows.length > 0) continue; // idempotent per-capability (unique index guards races)
        const r = await tx.query(
          `insert into public.project_access_grants
             (workspace_id, project_id, member_id, capability, granted_by, valid_until)
           values ($1,$2,$3,$4,$5,$6) returning id`,
          [workspaceId, projectId, a.body.memberId, cap, a.userId, a.body.validUntil ?? null]);
        granted.push({ capability: cap, grantId: r.rows[0].id });
      }
      await recordAudit(tx, ctx, {
        action: "project_access.granted", object_type: "project",
        object_id: projectId, details: { memberId: a.body.memberId, capabilities: [...caps] },
      }, { organizationId: workspaceId });
      return { status: 201, body: { granted } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
