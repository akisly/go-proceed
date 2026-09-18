import { commandRoute, queryRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  configureProjectFieldChannelRequest, projectFieldChannelResponse,
  type ProjectFieldChannelResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

const notFound = (requestId: string) => new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.", {
  requestId, retryable: false, userAction: "return_to_list",
}));
const conflict = (requestId: string, detail: string) => new HttpProblem(409, problem("VERSION_CONFLICT", detail, {
  requestId, retryable: true, userAction: "refresh_compare_retry",
}));

function responseOf(projectId: string, row: Record<string, unknown>): ProjectFieldChannelResponse {
  return projectFieldChannelResponse.parse({
    projectId,
    projectStatus: row.status,
    channel: row.channel ?? null,
    channelState: row.state ?? null,
    lockedAt: row.locked_at ? new Date(String(row.locked_at)).toISOString() : null,
    version: Number(row.version),
  });
}

export const GET = queryRoute(async (a) => {
  const projectId = a.params.projectId;
  if (!projectId) throw notFound(a.requestId);
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx) => {
    const p = await tx.query(`select workspace_id from public.projects where id=$1`, [projectId]);
    if (p.rows.length === 0) throw notFound(a.requestId);
    const workspaceId: string = p.rows[0].workspace_id;
    const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
    await requireProjectCapability(tx, a.requestId,
      { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });
    const r = await tx.query(
      `select p.status, p.version, c.channel, c.state, c.locked_at
         from public.projects p
         left join public.project_field_channels c on c.workspace_id=p.workspace_id and c.project_id=p.id
        where p.workspace_id=$1 and p.id=$2`, [workspaceId, projectId]);
    return responseOf(projectId, r.rows[0]);
  });
  return { status: 200, body };
});

export const POST = commandRoute(configureProjectFieldChannelRequest, async (a) => {
  const projectId = a.params.projectId;
  if (!projectId) throw notFound(a.requestId);
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const found = await tx.query(`select workspace_id from public.projects where id=$1`, [projectId]);
    if (found.rows.length === 0) throw notFound(a.requestId);
    const workspaceId: string = found.rows[0].workspace_id;
    return withIdempotency<ProjectFieldChannelResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "project_field_channel.configure", key: a.idempotencyKey, requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "project.admin" });
      },
    }, async () => {
      const p = await tx.query(
        `select status, version from public.projects where workspace_id=$1 and id=$2 for update`, [workspaceId, projectId]);
      if (p.rows.length === 0) throw notFound(a.requestId);
      if (Number(p.rows[0].version) !== a.body.expectedVersion) {
        throw conflict(a.requestId, "Проєкт було змінено. Оновіть сторінку і повторіть.");
      }
      if (p.rows[0].status !== "draft") {
        throw conflict(a.requestId, "Канал польової комунікації можна налаштувати лише для чернетки проєкту.");
      }
      const current = await tx.query(
        `select state from public.project_field_channels where workspace_id=$1 and project_id=$2 for update`,
        [workspaceId, projectId]);
      if (current.rows.length === 0) {
        await tx.query(
          `insert into public.project_field_channels (workspace_id, project_id, channel, state)
           values ($1,$2,$3,'unbound')`, [workspaceId, projectId, a.body.channel]);
      } else if (current.rows[0].state === "unbound") {
        await tx.query(
          `update public.project_field_channels set channel=$3, version=version+1, updated_at=now()
            where workspace_id=$1 and project_id=$2`, [workspaceId, projectId, a.body.channel]);
      } else {
        throw conflict(a.requestId, "Канал польової комунікації вже налаштовано.");
      }
      const updated = await tx.query(
        `update public.projects set version=version+1, updated_at=now()
          where workspace_id=$1 and id=$2 returning status, version`, [workspaceId, projectId]);
      await recordAudit(tx, ctx, {
        action: "project_field_channel.configured", object_type: "project", object_id: projectId,
        details: { channel: a.body.channel },
      }, { organizationId: workspaceId });
      return { status: 200, body: responseOf(projectId, { ...updated.rows[0], channel: a.body.channel, state: "unbound", locked_at: null }) };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
