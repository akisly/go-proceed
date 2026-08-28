import { randomUUID } from "node:crypto";
import { z } from "zod";
import { commandRoute } from "../../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../../src/lib/http";
import { loadTelegramConfig } from "../../../../../../src/lib/telegram/config";
import { issueTelegramToken, telegramVerifier } from "../../../../../../src/lib/telegram/tokens";
import { telegramBindingIntentResponse, type TelegramBindingIntentResponse } from "@goproceed/contracts";
import { withServiceTx, withTenantTx, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

const createBindingIntentRequest = z.object({}).strict();
const INTENT_LIFETIME_MS = 15 * 60 * 1000;

const notFound = (requestId: string) => new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.", {
  requestId, retryable: false, userAction: "return_to_list",
}));
const conflict = (requestId: string, detail: string) => new HttpProblem(409, problem("VERSION_CONFLICT", detail, {
  requestId, retryable: true, userAction: "refresh_compare_retry",
}));

async function authorizeProjectAdmin(
  tx: Parameters<typeof requireActiveMembership>[0], requestId: string, userId: string, projectId: string,
): Promise<{ workspaceId: string; memberId: string }> {
  const p = await tx.query<{ workspace_id: string }>("select workspace_id from public.projects where id=$1", [projectId]);
  if (p.rows.length === 0) throw notFound(requestId);
  const workspaceId = p.rows[0]!.workspace_id;
  const member = await requireActiveMembership(tx, requestId, userId, workspaceId);
  await requireProjectCapability(tx, requestId, {
    workspaceId, projectId, memberId: member.memberId, capability: "project.admin",
  });
  return { workspaceId, memberId: member.memberId };
}

export const POST = commandRoute(createBindingIntentRequest, async (a) => {
  const projectId = a.params.projectId;
  if (!projectId) throw notFound(a.requestId);
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };

  // Authorization happens in the member plane. The service transaction below
  // repeats it while locking the current project/channel state before writing.
  await withTenantTx(ctx, (tx) => authorizeProjectAdmin(tx, a.requestId, a.userId, projectId));

  const config = loadTelegramConfig();
  const rawToken = issueTelegramToken();
  const verifierHash = telegramVerifier(rawToken, config.linkPepper);
  const expiresAt = new Date(Date.now() + INTENT_LIFETIME_MS);
  const intentId = randomUUID();

  const body = await withServiceTx(ctx, async (tx): Promise<TelegramBindingIntentResponse> => {
    const { workspaceId, memberId } = await authorizeProjectAdmin(tx, a.requestId, a.userId, projectId);
    const project = await tx.query<{ status: string }>(
      "select status from public.projects where workspace_id=$1 and id=$2 for update", [workspaceId, projectId]);
    if (!project.rows[0]) throw notFound(a.requestId);
    const channel = await tx.query<{ channel: string; state: string; locked_at: string | null }>(
      `select channel, state, locked_at from public.project_field_channels
        where workspace_id=$1 and project_id=$2 for update`, [workspaceId, projectId]);
    const live = await tx.query(`select 1 from public.telegram_chat_bindings
      where workspace_id=$1 and project_id=$2 and disconnected_at is null limit 1`, [workspaceId, projectId]);
    const c = channel.rows[0];
    if (project.rows[0].status !== "draft" || !c || c.channel !== "telegram" || c.state !== "unbound"
      || c.locked_at !== null || live.rows.length > 0) {
      throw conflict(a.requestId, "Групу Telegram можна підключити лише до чернетки з неналаштованим каналом.");
    }

    await tx.query(`insert into public.telegram_binding_intents
      (id, workspace_id, project_id, requested_by_member_id, verifier_hash, expires_at)
      values ($1,$2,$3,$4,$5,$6)`, [intentId, workspaceId, projectId, memberId, verifierHash, expiresAt]);
    await recordAudit(tx, ctx, {
      action: "telegram_binding_intent.created", object_type: "telegram_binding_intent", object_id: intentId,
      details: { projectId, memberId, expiresAt: expiresAt.toISOString() },
    }, { organizationId: workspaceId });

    return telegramBindingIntentResponse.parse({
      intentId, expiresAt: expiresAt.toISOString(),
      telegramUrl: `https://t.me/${config.botUsername}?startgroup=${rawToken}`,
    });
  });

  // Do not wrap this response in `withIdempotency`: that table persists the
  // serialized response, while this URL intentionally contains the raw token.
  // `commandRoute` still requires an Idempotency-Key as the command contract.
  return { status: 201, body, expiresAt };
});
