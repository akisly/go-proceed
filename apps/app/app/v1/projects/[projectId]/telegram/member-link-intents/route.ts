import { randomUUID } from "node:crypto";
import { z } from "zod";
import { commandRoute } from "../../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../../src/lib/http";
import { loadTelegramConfig } from "../../../../../../src/lib/telegram/config";
import { issueTelegramToken, telegramVerifier } from "../../../../../../src/lib/telegram/tokens";
import {
  telegramMemberLinkIntentReceipt, telegramMemberLinkIntentResponse,
  type TelegramMemberLinkIntentReceipt, type TelegramMemberLinkIntentResponse,
} from "@goproceed/contracts";
import { withIdempotency, withServiceTx, withTenantTx, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

const createMemberLinkIntentRequest = z.object({}).strict();
const INTENT_LIFETIME_MS = 15 * 60 * 1000;

const notFound = (requestId: string) => new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.", {
  requestId, retryable: false, userAction: "return_to_list",
}));

async function authorizeCurrentProjectMember(
  tx: Parameters<typeof requireActiveMembership>[0], requestId: string, userId: string, projectId: string,
): Promise<{ workspaceId: string; memberId: string }> {
  const p = await tx.query<{ workspace_id: string }>("select workspace_id from public.projects where id=$1", [projectId]);
  if (p.rows.length === 0) throw notFound(requestId);
  const workspaceId = p.rows[0]!.workspace_id;
  const member = await requireActiveMembership(tx, requestId, userId, workspaceId);
  // The link belongs to this member in this project context. `project.view`
  // proves that context without granting the administrator-only group bind.
  await requireProjectCapability(tx, requestId, {
    workspaceId, projectId, memberId: member.memberId, capability: "project.view",
  });
  return { workspaceId, memberId: member.memberId };
}

export const POST = commandRoute(createMemberLinkIntentRequest, async (a) => {
  const projectId = a.params.projectId;
  if (!projectId) throw notFound(a.requestId);
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };

  const authorized = await withTenantTx(ctx,
    (tx) => authorizeCurrentProjectMember(tx, a.requestId, a.userId, projectId));
  const captured: { telegramUrl: string | null } = { telegramUrl: null };

  const out = await withServiceTx(ctx, async (tx) => withIdempotency<TelegramMemberLinkIntentReceipt>(tx, {
    organizationId: authorized.workspaceId, actorScope: `user:${a.userId}`,
    operationId: "telegram_member_link_intents.create", key: a.idempotencyKey, requestHash: a.requestHash,
  }, async () => {
    const { workspaceId, memberId } = await authorizeCurrentProjectMember(tx, a.requestId, a.userId, projectId);
    const config = loadTelegramConfig();
    const rawToken = issueTelegramToken();
    const verifierHash = telegramVerifier(rawToken, config.linkPepper);
    const expiresAt = new Date(Date.now() + INTENT_LIFETIME_MS);
    const intentId = randomUUID();
    await tx.query(`insert into public.telegram_member_link_intents
      (id, workspace_id, project_id, member_id, issued_by_member_id, verifier_hash, expires_at)
      values ($1,$2,$3,$4,$4,$5,$6)`, [intentId, workspaceId, projectId, memberId, verifierHash, expiresAt]);
    await recordAudit(tx, ctx, {
      action: "telegram_member_link_intent.created", object_type: "telegram_member_link_intent", object_id: intentId,
      details: { projectId, memberId, expiresAt: expiresAt.toISOString() },
    }, { organizationId: workspaceId });

    captured.telegramUrl = `https://t.me/${config.botUsername}?start=${rawToken}`;
    return { status: 201, body: telegramMemberLinkIntentReceipt.parse({
      intentId, projectId, memberId, expiresAt: expiresAt.toISOString(),
    }) };
  }));

  if (!out.replayed && captured.telegramUrl === null) {
    throw new Error("fresh Telegram member-link intent did not capture its one-time URL");
  }
  const body: TelegramMemberLinkIntentResponse = out.replayed
    ? telegramMemberLinkIntentResponse.parse({ ...out.body, kind: "replayed" })
    : telegramMemberLinkIntentResponse.parse({ ...out.body, kind: "issued", telegramUrl: captured.telegramUrl });
  return { status: out.status, body, expiresAt: out.expiresAt };
});
