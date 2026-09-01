import {
  projectCommunicationCommandResponse, retryProjectCommunicationRequest,
} from "@goproceed/contracts";
import {
  recordAudit, withIdempotency, withServiceTx, withTenantTx, type Tx,
} from "@goproceed/database";
import { requireActiveMembership, requireProjectCapability } from "../../../../../../../src/lib/authz";
import { commandRoute } from "../../../../../../../src/lib/command";
import { HttpProblem, problem } from "../../../../../../../src/lib/http";
import { loadTelegramConfig } from "../../../../../../../src/lib/telegram/config";
import { enqueueTelegramMessage } from "../../../../../../../src/lib/telegram/delivery";

export const runtime = "nodejs";

type AuthorizedProject = { workspaceId: string; projectId: string; memberId: string };

function notFound(requestId: string, detail = "Повідомлення не знайдено."): HttpProblem {
  return new HttpProblem(404, problem("RESOURCE_NOT_FOUND", detail, {
    requestId, retryable: false, userAction: "return_to_list",
  }));
}

function conflict(requestId: string, detail: string): HttpProblem {
  return new HttpProblem(409, problem("VERSION_CONFLICT", detail, {
    requestId, retryable: false, userAction: "refresh_compare_retry",
  }));
}

function acknowledgementRequired(requestId: string): HttpProblem {
  return new HttpProblem(422, problem("VALIDATION_FAILED",
    "Підтвердьте можливий дублікат перед повторним надсиланням.", {
      requestId, retryable: false, userAction: "correct_fields",
      fieldErrors: [{ path: "acknowledgePossibleDuplicate", message: "must be true for delivery_unknown" }],
    }));
}

async function authorizeProject(
  tx: Tx, requestId: string, userId: string, projectId: string,
): Promise<AuthorizedProject> {
  const project = await tx.query<{ workspace_id: string }>(
    "select workspace_id from public.projects where id=$1", [projectId]);
  const row = project.rows[0];
  if (!row) throw notFound(requestId, "Проєкт не знайдено.");
  const membership = await requireActiveMembership(tx, requestId, userId, row.workspace_id);
  await requireProjectCapability(tx, requestId, {
    workspaceId: row.workspace_id, projectId, memberId: membership.memberId, capability: "project.view",
  });
  await requireProjectCapability(tx, requestId, {
    workspaceId: row.workspace_id, projectId, memberId: membership.memberId, capability: "communication.reply",
  });
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
     for update of c,b`, [authorized.workspaceId, authorized.projectId, botId]);
  const bindingId = binding.rows[0]?.id;
  if (!bindingId) {
    throw conflict(requestId, "Активний канал Telegram для проєкту недоступний.");
  }
  return bindingId;
}

export const POST = commandRoute(retryProjectCommunicationRequest, async (a) => {
  const projectId = a.params.projectId;
  const messageId = a.params.messageId;
  if (!projectId) throw notFound(a.requestId, "Проєкт не знайдено.");
  if (!messageId) throw notFound(a.requestId);
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const initiallyAuthorized = await withTenantTx(ctx, (tx) => authorizeProject(
    tx, a.requestId, a.userId, projectId,
  ));
  const result = await withServiceTx(ctx, async (tx) => withIdempotency(tx, {
    organizationId: initiallyAuthorized.workspaceId,
    actorScope: `user:${a.userId}`,
    operationId: "project_communications.retry",
    key: a.idempotencyKey,
    requestHash: a.requestHash,
  }, async () => {
    const authorized = await authorizeProject(tx, a.requestId, a.userId, projectId);
    const bindingId = await activeTelegramBinding(tx, a.requestId, authorized, loadTelegramConfig().botId);
    const source = await tx.query<{
      direction: string; kind: "text" | "assignment_card"; text: string | null;
      delivery_state: string; reply_to_message_id: string | null; work_assignment_id: string | null;
      telegram_reply_markup: Array<Array<{ text: string; callbackData: string }>> | null;
      telegram_occurrence_snapshot: string[] | null;
    }>(`select direction,kind,text,delivery_state,reply_to_message_id,work_assignment_id,
               telegram_reply_markup,telegram_occurrence_snapshot
          from public.communication_messages
         where workspace_id=$1 and project_id=$2 and id=$3 and telegram_chat_binding_id=$4
         for update`, [authorized.workspaceId, projectId, messageId, bindingId]);
    const original = source.rows[0];
    if (!original) throw notFound(a.requestId);
    if (original.direction !== "outbound" || !["failed", "delivery_unknown"].includes(original.delivery_state)) {
      throw conflict(a.requestId, "Повторне надсилання доступне лише після помилки або невідомого результату доставки.");
    }
    if (original.delivery_state === "delivery_unknown" && a.body.acknowledgePossibleDuplicate !== true) {
      throw acknowledgementRequired(a.requestId);
    }
    if (original.text === null || !["text", "assignment_card"].includes(original.kind)) {
      throw conflict(a.requestId, "Цей тип повідомлення не можна надіслати повторно.");
    }
    const queued = await enqueueTelegramMessage(tx, ctx, {
      workspaceId: authorized.workspaceId,
      projectId,
      telegramChatBindingId: bindingId,
      workAssignmentId: original.work_assignment_id,
      kind: original.kind,
      text: original.text,
      authorMemberId: authorized.memberId,
      replyToMessageId: original.reply_to_message_id,
      retryOfMessageId: messageId,
      ...(original.telegram_reply_markup === null ? {} : { inlineKeyboard: original.telegram_reply_markup }),
      ...(original.telegram_occurrence_snapshot === null ? {} : { occurrenceSnapshot: original.telegram_occurrence_snapshot }),
    });
    await recordAudit(tx, ctx, {
      action: "project_communication.retried",
      object_type: "communication_message",
      object_id: queued.messageId,
      details: {
        projectId, retryOfMessageId: messageId, priorState: original.delivery_state,
        acknowledgePossibleDuplicate: original.delivery_state === "delivery_unknown",
      },
    }, { organizationId: authorized.workspaceId });
    return {
      status: 201,
      body: projectCommunicationCommandResponse.parse({
        ...queued, channel: "telegram", replyToMessageId: original.reply_to_message_id,
        retryOfMessageId: messageId,
      }),
    };
  }));
  return { status: result.status, body: result.body, expiresAt: result.expiresAt };
});
