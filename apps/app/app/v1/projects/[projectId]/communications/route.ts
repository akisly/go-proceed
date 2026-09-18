import { Buffer } from "node:buffer";
import {
  postProjectCommunicationRequest, projectCommunicationCommandResponse,
  projectCommunicationPage, type ProjectCommunicationPage,
} from "@goproceed/contracts";
import {
  recordAudit, withIdempotency, withServiceTx, withTenantTx, type Tx,
} from "@goproceed/database";
import { z } from "zod";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { commandRoute, queryRoute } from "../../../../../src/lib/command";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { loadTelegramConfig } from "../../../../../src/lib/telegram/config";
import { enqueueTelegramMessage } from "../../../../../src/lib/telegram/delivery";

export const runtime = "nodejs";

const cursorPayload = z.object({
  serverReceivedAt: z.string().datetime(),
  messageId: z.string().guid(),
}).strict();

type Cursor = z.infer<typeof cursorPayload>;
type AuthorizedProject = { workspaceId: string; projectId: string; memberId: string };

function notFound(requestId: string): HttpProblem {
  return new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.", {
    requestId, retryable: false, userAction: "return_to_list",
  }));
}

function invalid(requestId: string, path: string, message: string): HttpProblem {
  return new HttpProblem(422, problem("VALIDATION_FAILED", "Параметри запиту мають неприпустимий формат.", {
    requestId, retryable: false, userAction: "correct_fields",
    fieldErrors: [{ path, message }],
  }));
}

function unavailable(requestId: string): HttpProblem {
  return new HttpProblem(409, problem("VERSION_CONFLICT", "Активний канал Telegram для проєкту недоступний.", {
    requestId, retryable: true, userAction: "refresh_compare_retry",
  }));
}

function parseLimit(url: URL, requestId: string): number {
  const raw = url.searchParams.get("limit");
  if (raw === null) return 50;
  if (!/^[1-9][0-9]{0,2}$/.test(raw)) throw invalid(requestId, "limit", "must be an integer from 1 to 100");
  const limit = Number(raw);
  if (limit > 100) throw invalid(requestId, "limit", "must be an integer from 1 to 100");
  return limit;
}

function decodeCursor(raw: string | null, requestId: string): Cursor | null {
  if (raw === null) return null;
  if (raw.length < 1 || raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) {
    throw invalid(requestId, "cursor", "invalid cursor");
  }
  try {
    const decoded = Buffer.from(raw, "base64url");
    if (decoded.toString("base64url") !== raw) throw new Error("non-canonical cursor");
    return cursorPayload.parse(JSON.parse(decoded.toString("utf8")));
  } catch {
    throw invalid(requestId, "cursor", "invalid cursor");
  }
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

async function authorizeProject(
  tx: Tx, requestId: string, userId: string, projectId: string,
  capabilities: readonly ("project.view" | "communication.reply")[],
): Promise<AuthorizedProject> {
  const project = await tx.query<{ workspace_id: string }>(
    "select workspace_id from public.projects where id=$1", [projectId]);
  const row = project.rows[0];
  if (!row) throw notFound(requestId);
  const membership = await requireActiveMembership(tx, requestId, userId, row.workspace_id);
  for (const capability of capabilities) {
    await requireProjectCapability(tx, requestId, {
      workspaceId: row.workspace_id, projectId, memberId: membership.memberId, capability,
    });
  }
  return { workspaceId: row.workspace_id, projectId, memberId: membership.memberId };
}

async function activeTelegramBinding(
  tx: Tx, requestId: string, authorized: AuthorizedProject, botId: string,
): Promise<string> {
  const binding = await tx.query<{ id: string }>(`select b.id
      from public.projects p
      join public.project_field_channels c
        on c.workspace_id=p.workspace_id and c.project_id=p.id
      join public.telegram_chat_bindings b
        on b.workspace_id=p.workspace_id and b.project_id=p.id
     where p.workspace_id=$1 and p.id=$2 and p.status='active'
       and c.channel='telegram' and c.state='active' and c.locked_at is not null
       and b.disconnected_at is null and b.bot_id=$3::bigint
     -- Locks b only. Naming c here made PostgreSQL apply
     -- pfc_update's USING to the scan, and pfc_update demands project.admin —
     -- so a member holding communication.reply matched zero rows and every
     -- call 409'd before reaching the behaviour it was asked for. The channel
     -- predicates stay as read-only preconditions under pfc_select, and the
     -- channel row is re-locked and re-evaluated at send time inside
     -- app.prepare_telegram_delivery, which is where eligibility belongs.
     for update of b`, [authorized.workspaceId, authorized.projectId, botId]);
  const bindingId = binding.rows[0]?.id;
  if (!bindingId) throw unavailable(requestId);
  return bindingId;
}

async function listProjectCommunication(
  tx: Tx, authorized: AuthorizedProject, limit: number, cursor: Cursor | null,
): Promise<ProjectCommunicationPage> {
  const page = await tx.query<{
    id: string; direction: "inbound" | "outbound" | "system";
    kind: "text" | "photo" | "document" | "assignment_card" | "system" | "unsupported";
    text: string | null; author_member_id: string | null; provider_display_name_snapshot: string | null;
    role: "owner" | "admin" | "member" | "auditor" | null; reply_to_message_id: string | null;
    retry_of_message_id: string | null; work_assignment_id: string | null;
    provider_sent_at: Date | string | null; server_received_at: Date | string; delivery_state: string;
  }>(`select m.id,m.direction,m.kind,m.text,m.author_member_id,m.provider_display_name_snapshot,
             mem.role,m.reply_to_message_id,m.retry_of_message_id,m.work_assignment_id,
             m.provider_sent_at,m.server_received_at,m.delivery_state
        from public.communication_messages m
        left join public.memberships mem
          on mem.organization_id=m.workspace_id and mem.id=m.author_member_id
       where m.workspace_id=$1 and m.project_id=$2
         and ($3::timestamptz is null
           or (m.server_received_at,m.id) < ($3::timestamptz,$4::uuid))
       order by m.server_received_at desc,m.id desc
       limit $5`, [
    authorized.workspaceId, authorized.projectId,
    cursor?.serverReceivedAt ?? null, cursor?.messageId ?? null, limit + 1,
  ]);
  const hasMore = page.rows.length > limit;
  const rows = page.rows.slice(0, limit);
  const messageIds = rows.map((row) => row.id);

  const events = messageIds.length === 0 ? { rows: [] } : await tx.query<{
    id: string; message_id: string; event_kind: "edited" | "delivery_state_changed" | "bot_removed" | "bot_restored";
    text: string | null; delivery_state: string | null; server_received_at: Date | string;
  }>(`select id,message_id,event_kind,text,delivery_state,server_received_at
        from public.communication_message_events
       where workspace_id=$1 and project_id=$2 and message_id=any($3::uuid[])
       order by server_received_at,id`, [authorized.workspaceId, authorized.projectId, messageIds]);
  const attachments = messageIds.length === 0 ? { rows: [] } : await tx.query<{
    id: string; message_id: string; filename_snapshot: string | null; media_type_snapshot: string | null;
    byte_size: string | null; state: string; requirement_occurrence_id: string | null;
    evidence_object_id: string | null; evidence_decision_id: string | null; failure_code: string | null;
  }>(`select a.id,a.message_id,a.filename_snapshot,a.media_type_snapshot,a.byte_size::text,
             a.state,a.requirement_occurrence_id,a.evidence_object_id,h.current_decision_id as evidence_decision_id,
             a.failure_code
        from public.communication_attachments a
        left join public.requirement_evidence_decision_heads h
          on h.workspace_id=a.workspace_id and h.project_id=a.project_id
         and h.requirement_occurrence_id=a.requirement_occurrence_id
       where a.workspace_id=$1 and a.project_id=$2 and a.message_id=any($3::uuid[])
       order by a.created_at,a.id`, [authorized.workspaceId, authorized.projectId, messageIds]);

  const eventsByMessage = new Map<string, typeof events.rows>();
  for (const event of events.rows) {
    const current = eventsByMessage.get(event.message_id) ?? [];
    current.push(event);
    eventsByMessage.set(event.message_id, current);
  }
  const attachmentsByMessage = new Map<string, typeof attachments.rows>();
  for (const attachment of attachments.rows) {
    const current = attachmentsByMessage.get(attachment.message_id) ?? [];
    current.push(attachment);
    attachmentsByMessage.set(attachment.message_id, current);
  }

  const messages = rows.map((row) => ({
    messageId: row.id,
    source: "telegram" as const,
    direction: row.direction,
    kind: row.kind,
    author: {
      memberId: row.author_member_id,
      displayName: row.provider_display_name_snapshot,
      role: row.role,
      verified: row.author_member_id !== null,
    },
    text: row.text,
    replyToMessageId: row.reply_to_message_id,
    retryOfMessageId: row.retry_of_message_id,
    workAssignmentId: row.work_assignment_id,
    providerSentAt: row.provider_sent_at ? new Date(row.provider_sent_at).toISOString() : null,
    serverReceivedAt: new Date(row.server_received_at).toISOString(),
    deliveryState: row.delivery_state,
    events: (eventsByMessage.get(row.id) ?? []).map((event) => ({
      eventId: event.id, kind: event.event_kind, text: event.text,
      deliveryState: event.delivery_state,
      serverReceivedAt: new Date(event.server_received_at).toISOString(),
    })),
    attachments: (attachmentsByMessage.get(row.id) ?? []).map((attachment) => ({
      attachmentId: attachment.id,
      filename: attachment.filename_snapshot,
      mediaType: attachment.media_type_snapshot,
      byteSize: attachment.byte_size,
      state: attachment.state,
      requirementOccurrenceId: attachment.requirement_occurrence_id,
      evidenceObjectId: attachment.evidence_object_id,
      evidenceDecisionId: attachment.evidence_decision_id,
      failureCode: attachment.failure_code,
    })),
  }));
  const last = messages.at(-1);
  return projectCommunicationPage.parse({
    messages,
    nextCursor: hasMore && last
      ? encodeCursor({ serverReceivedAt: last.serverReceivedAt, messageId: last.messageId })
      : null,
  });
}

export const GET = queryRoute(async (a) => {
  const projectId = a.params.projectId;
  if (!projectId) throw notFound(a.requestId);
  const url = new URL(a.req.url);
  const limit = parseLimit(url, a.requestId);
  const cursor = decodeCursor(url.searchParams.get("cursor"), a.requestId);
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx) => {
    const authorized = await authorizeProject(tx, a.requestId, a.userId, projectId, ["project.view"]);
    return listProjectCommunication(tx, authorized, limit, cursor);
  });
  return { status: 200, body };
});

export const POST = commandRoute(postProjectCommunicationRequest, async (a) => {
  const projectId = a.params.projectId;
  if (!projectId) throw notFound(a.requestId);
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const initiallyAuthorized = await withTenantTx(ctx, (tx) => authorizeProject(
    tx, a.requestId, a.userId, projectId, ["project.view", "communication.reply"],
  ));
  const result = await withServiceTx({ ...ctx, organizationId: initiallyAuthorized.workspaceId }, async (tx) => withIdempotency(tx, {
    organizationId: initiallyAuthorized.workspaceId,
    actorScope: `user:${a.userId}`,
    operationId: "project_communications.reply",
    key: a.idempotencyKey,
    requestHash: a.requestHash,
    authorize: () => authorizeProject(
      tx, a.requestId, a.userId, projectId, ["project.view", "communication.reply"],
    ),
  }, async (authorized) => {
    const bindingId = await activeTelegramBinding(tx, a.requestId, authorized, loadTelegramConfig().botId);
    if (a.body.replyToMessageId) {
      const target = await tx.query(`select 1 from public.communication_messages
        where workspace_id=$1 and project_id=$2 and id=$3 and telegram_chat_binding_id=$4`, [
        authorized.workspaceId, projectId, a.body.replyToMessageId, bindingId,
      ]);
      if (target.rows.length === 0) {
        throw invalid(a.requestId, "replyToMessageId", "not a message of this project");
      }
    }
    const queued = await enqueueTelegramMessage(tx, ctx, {
      workspaceId: authorized.workspaceId,
      projectId,
      telegramChatBindingId: bindingId,
      workAssignmentId: null,
      kind: "text",
      text: a.body.text,
      authorMemberId: authorized.memberId,
      replyToMessageId: a.body.replyToMessageId ?? null,
    });
    await recordAudit(tx, ctx, {
      action: "project_communication.replied",
      object_type: "communication_message",
      object_id: queued.messageId,
      details: { projectId, replyToMessageId: a.body.replyToMessageId ?? null, channel: "telegram" },
    }, { organizationId: authorized.workspaceId });
    return {
      status: 201,
      body: projectCommunicationCommandResponse.parse({
        ...queued, channel: "telegram", replyToMessageId: a.body.replyToMessageId ?? null,
        retryOfMessageId: null,
      }),
    };
  }));
  return { status: result.status, body: result.body, expiresAt: result.expiresAt };
});
