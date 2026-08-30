import { enqueueOutbox, withServiceTx, type TenantContext, type Tx } from "@goproceed/database";
import { createTelegramApiClient, TelegramApiError, type SendTelegramMessageInput, type TelegramApiClient } from "./api";
import { loadTelegramConfig } from "./config";

export type DeliveryResult =
  | { kind: "provider_accepted"; providerMessageId: string }
  | { kind: "retryable_rejection"; retryAfterMs: number }
  | { kind: "definitive_failure"; code: string }
  | { kind: "delivery_unknown"; code: "network_outcome_unknown" };

/** Classify one send without converting an uncertain provider outcome into a retry. */
export async function classifyTelegramSend(
  api: TelegramApiClient,
  input: SendTelegramMessageInput,
): Promise<DeliveryResult> {
  try {
    const accepted = await api.sendMessage(input);
    return { kind: "provider_accepted", providerMessageId: accepted.messageId };
  } catch (error) {
    if (error instanceof TelegramApiError) {
      if (error.kind === "delivery_unknown") return { kind: "delivery_unknown", code: "network_outcome_unknown" };
      if (error.retryable) return { kind: "retryable_rejection", retryAfterMs: error.retryAfterMs ?? 0 };
      return { kind: "definitive_failure", code: error.code };
    }
    return { kind: "delivery_unknown", code: "network_outcome_unknown" };
  }
}

type ClaimedOutbox = {
  id: string;
  organization_id: string | null;
  lease_token: string;
};

type DeliveryTarget = {
  messageId: string;
  workspaceId: string;
  projectId: string;
  chatId: string;
  text: string;
  kind: string;
  replyToMessageId: string | null;
  inlineKeyboard: Array<Array<{ text: string; callbackData: string }>> | undefined;
  eligible: boolean;
};

const OUTBOX_TOPIC = "communication.telegram.send";
const OUTBOX_LEASE_SECONDS = 60;

function deliveryContext(workspaceId: string | null): TenantContext {
  return { actorUserId: "", organizationId: workspaceId, requestId: crypto.randomUUID() };
}

function validBatch(input: { workerId: string; limit: number }): void {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new Error("invalid_outbox_limit");
  }
  if (input.workerId.trim().length === 0 || input.workerId.length > 128) {
    throw new Error("invalid_worker_id");
  }
}

/**
 * Atomically create the durable, internal message before its transactional
 * outbox intent. Callers provide an already-authorized transaction.
 */
export async function enqueueTelegramMessage(
  tx: Tx,
  ctx: TenantContext,
  input: {
    workspaceId: string;
    projectId: string;
    telegramChatBindingId: string;
    workAssignmentId: string | null;
    text: string;
    kind: "assignment_card" | "text";
    replyToMessageId?: string | null;
    inlineKeyboard?: Array<Array<{ text: string; callbackData: string }>>;
    /** Ordered requirement ids actually rendered in an assignment card. */
    occurrenceSnapshot?: string[];
  },
): Promise<{ messageId: string; deliveryState: "queued" }> {
  const messageId = crypto.randomUUID();
  await tx.query(`insert into public.communication_messages
    (id, workspace_id, project_id, telegram_chat_binding_id, direction, kind,
     text, reply_to_message_id, work_assignment_id, telegram_reply_markup, telegram_occurrence_snapshot, delivery_state)
    values ($1, $2, $3, $4, 'outbound', $5, $6, $7, $8, $9::jsonb, $10::uuid[], 'queued')`, [
    messageId, input.workspaceId, input.projectId, input.telegramChatBindingId,
    input.kind, input.text, input.replyToMessageId ?? null, input.workAssignmentId,
    input.inlineKeyboard === undefined ? null : JSON.stringify(input.inlineKeyboard),
    input.occurrenceSnapshot ?? null,
  ]);
  await enqueueOutbox(tx, ctx, {
    topic: OUTBOX_TOPIC,
    aggregate_type: "communication_message",
    aggregate_id: messageId,
    payload_version: 1,
    payload: { messageId, projectId: input.projectId },
  }, { organizationId: input.workspaceId });
  return { messageId, deliveryState: "queued" };
}

async function claimTelegramOutbox(input: { workerId: string; limit: number }): Promise<ClaimedOutbox[]> {
  return withServiceTx(deliveryContext(null), async (tx) => {
    const result = await tx.query<ClaimedOutbox>(
      "select * from app.claim_outbox_topic($1::text, $2::integer, $3::text, $4::integer)",
      [OUTBOX_TOPIC, input.limit, input.workerId, OUTBOX_LEASE_SECONDS],
    );
    return result.rows;
  });
}

async function attemptNumber(tx: Tx, target: DeliveryTarget): Promise<number> {
  const result = await tx.query<{ attempt_no: number }>(`select coalesce(max(attempt_no), 0)::integer + 1 as attempt_no
    from public.communication_delivery_attempts where workspace_id=$1 and message_id=$2`,
  [target.workspaceId, target.messageId]);
  return result.rows[0]!.attempt_no;
}

async function appendDeliveryState(
  tx: Tx, target: DeliveryTarget, state: "provider_accepted" | "failed" | "delivery_unknown", providerMessageId: string | null,
): Promise<void> {
  await tx.query(`update public.communication_messages
    set provider_message_id = coalesce($3::bigint, provider_message_id), delivery_state=$4
    where workspace_id=$1 and id=$2 and delivery_state='queued'`,
  [target.workspaceId, target.messageId, providerMessageId, state]);
  await tx.query(`insert into public.communication_message_events
    (workspace_id, project_id, message_id, event_kind, delivery_state)
    values ($1, $2, $3, 'delivery_state_changed', $4)`,
  [target.workspaceId, target.projectId, target.messageId, state]);
}

async function deliverClaimedTelegramOutbox(
  item: ClaimedOutbox, botId: string, api: TelegramApiClient,
): Promise<DeliveryResult> {
  return withServiceTx(deliveryContext(item.organization_id), async (tx) => {
    // This command locks the exact outbox lease and the same channel row that
    // membership processing updates. The lease is renewed immediately before
    // the bounded Bot API request, and the lock remains held through settlement.
    const prepared = await tx.query<{
      message_id: string; workspace_id: string; project_id: string; chat_id: string;
      text: string; kind: string; reply_provider_message_id: string | null; eligible: boolean;
      telegram_reply_markup: Array<Array<{ text: string; callbackData: string }>> | null;
    }>("select * from app.prepare_telegram_delivery_with_markup($1::uuid, $2::uuid, $3::bigint, $4::integer)",
      [item.id, item.lease_token, botId, OUTBOX_LEASE_SECONDS]);
    const row = prepared.rows[0];
    if (!row) throw new Error("telegram_delivery_target_missing");
    const target: DeliveryTarget = {
      messageId: row.message_id, workspaceId: row.workspace_id, projectId: row.project_id,
      chatId: row.chat_id, text: row.text, kind: row.kind,
      replyToMessageId: row.reply_provider_message_id, inlineKeyboard: row.telegram_reply_markup ?? undefined, eligible: row.eligible,
    };
    const result = !target.eligible
      ? { kind: "definitive_failure", code: "delivery_target_unavailable" } as const
      : await classifyTelegramSend(api, {
        chatId: target.chatId, text: target.text, replyToMessageId: target.replyToMessageId,
        ...(target.inlineKeyboard === undefined ? {} : { inlineKeyboard: target.inlineKeyboard }),
        ...(target.kind === "assignment_card" ? { parseMode: "HTML" as const } : {}),
      });
    const number = await attemptNumber(tx, target);
    if (result.kind === "provider_accepted") {
      await tx.query(`insert into public.communication_delivery_attempts
        (workspace_id, project_id, message_id, attempt_no, state, provider_message_id, completed_at)
        values ($1,$2,$3,$4,'provider_accepted',$5::bigint,now())`,
      [target.workspaceId, target.projectId, target.messageId, number, result.providerMessageId]);
      await appendDeliveryState(tx, target, "provider_accepted", result.providerMessageId);
    } else if (result.kind === "retryable_rejection") {
      await tx.query(`insert into public.communication_delivery_attempts
        (workspace_id, project_id, message_id, attempt_no, state, error_code, completed_at)
        values ($1,$2,$3,$4,'retryable_rejection','provider_rejected',now())`,
      [target.workspaceId, target.projectId, target.messageId, number]);
      const failed = await tx.query<{ terminal: boolean }>(
        "select app.fail_telegram_delivery_outbox($1::uuid, $2::uuid, $3::uuid, $4::integer) as terminal",
        [item.id, item.lease_token, target.messageId, result.retryAfterMs],
      );
      if (failed.rows[0]?.terminal) await appendDeliveryState(tx, target, "failed", null);
      return result;
    } else if (result.kind === "definitive_failure") {
      await tx.query(`insert into public.communication_delivery_attempts
        (workspace_id, project_id, message_id, attempt_no, state, error_code, completed_at)
        values ($1,$2,$3,$4,'definitive_failure',$5,now())`,
      [target.workspaceId, target.projectId, target.messageId, number, result.code]);
      await appendDeliveryState(tx, target, "failed", null);
    } else {
      await tx.query(`insert into public.communication_delivery_attempts
        (workspace_id, project_id, message_id, attempt_no, state, error_code, completed_at)
        values ($1,$2,$3,$4,'delivery_unknown',$5,now())`,
      [target.workspaceId, target.projectId, target.messageId, number, result.code]);
      await appendDeliveryState(tx, target, "delivery_unknown", null);
    }
    await tx.query("select app.complete_telegram_delivery_outbox($1::uuid, $2::uuid, $3::uuid)",
      [item.id, item.lease_token, target.messageId]);
    return result;
  });
}

/** Deliver only the Telegram topic through the leased transactional outbox. */
export async function deliverTelegramOutboxBatch(input: {
  workerId: string;
  limit: number;
  apiClient?: TelegramApiClient;
}): Promise<{ accepted: number; failed: number; unknown: number }> {
  validBatch(input);
  const config = loadTelegramConfig();
  const api = input.apiClient ?? createTelegramApiClient(config);
  const items = await claimTelegramOutbox(input);
  const counts = { accepted: 0, failed: 0, unknown: 0 };
  for (const item of items) {
    const result = await deliverClaimedTelegramOutbox(item, config.botId, api);
    if (result.kind === "provider_accepted") counts.accepted += 1;
    else if (result.kind === "delivery_unknown") counts.unknown += 1;
    else counts.failed += 1;
  }
  return counts;
}
