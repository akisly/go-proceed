import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { activateProjectRequest, projectFieldChannelResponse, type ProjectFieldChannelResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";

export const runtime = "nodejs";

const notFound = (requestId: string) => new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.", {
  requestId, retryable: false, userAction: "return_to_list",
}));
const conflict = (requestId: string, detail: string) => new HttpProblem(409, problem("VERSION_CONFLICT", detail, {
  requestId, retryable: true, userAction: "refresh_compare_retry",
}));

export const POST = commandRoute(activateProjectRequest, async (a) => {
  const projectId = a.params.projectId;
  if (!projectId) throw notFound(a.requestId);
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const found = await tx.query(`select workspace_id from public.projects where id=$1`, [projectId]);
    if (found.rows.length === 0) throw notFound(a.requestId);
    const workspaceId: string = found.rows[0].workspace_id;
    return withIdempotency<ProjectFieldChannelResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "projects.activate", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "project.admin" });
      const p = await tx.query(
        `select status, version from public.projects where workspace_id=$1 and id=$2 for update`, [workspaceId, projectId]);
      if (p.rows.length === 0) throw notFound(a.requestId);
      if (Number(p.rows[0].version) !== a.body.expectedVersion) {
        throw conflict(a.requestId, "Проєкт було змінено. Оновіть сторінку і повторіть.");
      }
      const c = await tx.query(
        `select channel, state, last_healthy_at
           from public.project_field_channels where workspace_id=$1 and project_id=$2 for update`,
        [workspaceId, projectId]);
      if (p.rows[0].status !== "draft" || c.rows.length === 0
        || c.rows[0].state !== "connected" || c.rows[0].last_healthy_at === null) {
        throw conflict(a.requestId, "Чернетку проєкту можна активувати лише з підключеним каналом Telegram.");
      }
      const updated = await tx.query(
        `update public.projects set status='active', version=version+1, updated_at=now()
          where workspace_id=$1 and id=$2 returning status, version`, [workspaceId, projectId]);
      const channel = await tx.query(
        `update public.project_field_channels
            set state='active', locked_at=now(), locked_by_member_id=$3, version=version+1, updated_at=now()
          where workspace_id=$1 and project_id=$2
          returning channel, state, locked_at`, [workspaceId, projectId, m.memberId]);
      await recordAudit(tx, ctx, {
        action: "project.activated", object_type: "project", object_id: projectId,
        details: { channel: channel.rows[0].channel },
      }, { organizationId: workspaceId });
      await enqueueOutbox(tx, ctx, {
        topic: "project.activated", aggregate_type: "project", aggregate_id: projectId,
        payload_version: 1, payload: { workspaceId, projectId, channel: channel.rows[0].channel },
      }, { organizationId: workspaceId });
      return {
        status: 200,
        body: projectFieldChannelResponse.parse({
          projectId, projectStatus: updated.rows[0].status, channel: channel.rows[0].channel,
          channelState: channel.rows[0].state, lockedAt: new Date(channel.rows[0].locked_at).toISOString(),
          version: Number(updated.rows[0].version),
        }),
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
