import { withServiceTx } from "@goproceed/database";
import { consumeBindingCommand, consumeMemberLinkCommand } from "./linking";
import { loadTelegramConfig } from "./config";
import { normalizeTelegramUpdate, type NormalizedTelegramUpdate } from "./normalize";

const INBOX_LEASE_SECONDS = 60;

type ClaimedInboxUpdate = {
  bot_id: string;
  update_id: string;
  payload: unknown;
  lease_id: string;
};

type ChatBinding = {
  workspace_id: string;
  project_id: string;
  telegram_chat_binding_id: string;
  channel_state: string;
};

type RawCommandContext = {
  token: string | null;
  title: string | null;
  displayName: string | null;
  username: string | null;
};

class TelegramProcessingError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "TelegramProcessingError";
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedSnapshot(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 255) : null;
}

/**
 * Pull the one-time command payload from the raw inbox row only while it is
 * leased. The normalized union deliberately excludes this value, and callers
 * never return, log, audit, or persist it.
 */
function rawCommandContext(payload: unknown): RawCommandContext {
  const root = record(payload);
  const message = record(root?.message);
  const sender = record(message?.from);
  const chat = record(message?.chat);
  const text = typeof message?.text === "string" ? message.text : null;
  const match = text?.match(/^\/(?:startgroup|start)(?:@[A-Za-z0-9_]+)?(?:[ \t]+([^ \t\r\n]+))?/);
  return {
    token: match?.[1] ?? null,
    title: boundedSnapshot(chat?.title),
    displayName: [boundedSnapshot(sender?.first_name), boundedSnapshot(sender?.last_name)]
      .filter((part): part is string => part !== null).join(" ") || null,
    username: boundedSnapshot(sender?.username),
  };
}

function validBatch(input: { workerId: string; limit: number }): void {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new TelegramProcessingError("invalid_inbox_limit");
  }
  if (input.workerId.trim().length === 0 || input.workerId.length > 128) {
    throw new TelegramProcessingError("invalid_worker_id");
  }
}

function messageKind(update: Extract<NormalizedTelegramUpdate, { kind: "message" }>): "text" | "photo" | "document" | "unsupported" {
  if (update.files.some((file) => file.kind === "photo")) return "photo";
  if (update.files.some((file) => file.kind === "document")) return "document";
  return update.text === null ? "unsupported" : "text";
}

async function resolveBoundChat(botId: string, chatId: string): Promise<ChatBinding | null> {
  return withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) => {
    const result = await tx.query<ChatBinding>(
      "select * from app.resolve_telegram_chat($1::bigint, $2::bigint)", [botId, chatId],
    );
    return result.rows[0] ?? null;
  });
}

async function linkedMemberId(tx: { query: <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> }, workspaceId: string, senderId: string): Promise<string | null> {
  const result = await tx.query<{ member_id: string }>(`select l.member_id
    from public.telegram_member_links l
    join public.memberships m on m.organization_id=l.workspace_id and m.id=l.member_id
   where l.workspace_id=$1 and l.telegram_user_id=$2::bigint
     and l.revoked_at is null and m.status='active'
   limit 1`, [workspaceId, senderId]);
  return result.rows[0]?.member_id ?? null;
}

async function storeMessage(
  binding: ChatBinding,
  update: Extract<NormalizedTelegramUpdate, { kind: "message" }>,
  context: RawCommandContext,
): Promise<string> {
  return withServiceTx({ actorUserId: "", organizationId: binding.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
    const authorMemberId = await linkedMemberId(tx, binding.workspace_id, update.senderId);
    const reply = update.replyToMessageId === null ? null : await tx.query<{ id: string }>(`select id
      from public.communication_messages
     where telegram_chat_binding_id=$1 and provider_message_id=$2::bigint`,
    [binding.telegram_chat_binding_id, update.replyToMessageId]);
    await tx.query(`insert into public.communication_messages
      (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text,
       author_member_id, provider_user_id, provider_display_name_snapshot,
       provider_username_snapshot, provider_message_id, provider_sent_at,
       reply_to_message_id, provider_reply_to_message_id, delivery_state)
      values ($1, $2, $3, 'inbound', $4, $5, $6, $7::bigint, $8, $9,
              $10::bigint, $11::timestamptz, $12, $13::bigint, 'received')
      on conflict (telegram_chat_binding_id, provider_message_id) where provider_message_id is not null do nothing`, [
      binding.workspace_id, binding.project_id, binding.telegram_chat_binding_id,
      messageKind(update), update.text, authorMemberId, update.senderId,
      context.displayName, context.username, update.messageId, update.sentAt,
      reply?.rows[0]?.id ?? null, update.replyToMessageId,
    ]);
    return authorMemberId === null ? "stored_unverified_message" : "stored_chat_message";
  });
}

async function appendEdit(
  binding: ChatBinding,
  update: Extract<NormalizedTelegramUpdate, { kind: "edited_message" }>,
): Promise<string> {
  return withServiceTx({ actorUserId: "", organizationId: binding.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
    const message = await tx.query<{ id: string }>(`select id from public.communication_messages
      where telegram_chat_binding_id=$1 and provider_message_id=$2::bigint`,
    [binding.telegram_chat_binding_id, update.messageId]);
    const messageId = message.rows[0]?.id;
    if (!messageId) return "ignored_unknown_provider_message";
    await tx.query(`insert into public.communication_message_events
      (workspace_id, project_id, message_id, event_kind, text, provider_event_at)
      values ($1, $2, $3, 'edited', $4, $5::timestamptz)`, [
      // The append-only event schema requires a text value. An edited
      // media message can have no caption, so preserve that provider fact as
      // an empty normalized body rather than failing and losing the edit.
      binding.workspace_id, binding.project_id, messageId, update.text ?? "", update.editedAt,
    ]);
    return "appended_message_edit";
  });
}

async function processMembershipChange(
  binding: ChatBinding,
  update: Extract<NormalizedTelegramUpdate, { kind: "my_chat_member" }>,
): Promise<string> {
  const removed = update.newStatus === "left" || update.newStatus === "kicked";
  return withServiceTx({ actorUserId: "", organizationId: binding.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
    const channel = await tx.query<{ state: string }>(`update public.project_field_channels
       set state = case when $3 then 'unhealthy'::public.project_field_channel_state
                        when locked_at is null then 'connected'::public.project_field_channel_state
                        else 'active'::public.project_field_channel_state end,
           last_healthy_at = case when $3 then last_healthy_at else now() end,
           updated_at = now()
     where workspace_id=$1 and project_id=$2 and state <> 'archived'
     returning state::text`, [binding.workspace_id, binding.project_id, removed]);
    if (!channel.rows[0]) return "ignored_archived_channel";
    const message = await tx.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id, project_id, telegram_chat_binding_id, direction, kind, provider_message_id, delivery_state)
      values ($1, $2, $3, 'system', 'system', $4::bigint, 'received')
      on conflict (telegram_chat_binding_id, provider_message_id) where provider_message_id is not null do nothing
      returning id`, [binding.workspace_id, binding.project_id, binding.telegram_chat_binding_id, update.updateId]);
    const systemMessageId = message.rows[0]?.id;
    if (systemMessageId) {
      await tx.query(`insert into public.communication_message_events
        (workspace_id, project_id, message_id, event_kind)
        values ($1, $2, $3, $4)`, [
        binding.workspace_id, binding.project_id, systemMessageId, removed ? "bot_removed" : "bot_restored",
      ]);
    }
    return removed ? "channel_marked_unhealthy" : "channel_restored";
  });
}

async function processStartCommand(
  update: Extract<NormalizedTelegramUpdate, { kind: "message" }>,
  context: RawCommandContext,
): Promise<string> {
  if (context.token === null) return "ignored_start_command";
  if (update.command?.kind === "startgroup" && (update.chatType === "group" || update.chatType === "supergroup")) {
    const outcome = await consumeBindingCommand({
      rawToken: context.token, chatId: update.chatId, chatType: update.chatType,
      title: context.title, telegramUserId: update.senderId,
    });
    return `binding_${outcome.kind}`;
  }
  if (update.command?.kind === "start" && update.chatType === "private") {
    const outcome = await consumeMemberLinkCommand({
      rawToken: context.token, telegramUserId: update.senderId,
      displayName: context.displayName, username: context.username,
    });
    return `member_link_${outcome.kind}`;
  }
  return "ignored_start_command";
}

/** Normalize one leased provider update into append-only project communication. */
export async function processTelegramUpdate(
  update: NormalizedTelegramUpdate,
  context: RawCommandContext = { token: null, title: null, displayName: null, username: null },
): Promise<string> {
  if (update.kind === "unsupported") return "ignored_unsupported_update";
  if (update.kind === "callback_query") return "ignored_callback_query";
  if (update.kind === "message" && update.command !== null) return processStartCommand(update, context);

  const chatId = update.chatId;
  const binding = await resolveBoundChat(loadTelegramConfig().botId, chatId);
  if (binding === null) return "ignored_unknown_chat";
  if (update.kind === "message") return storeMessage(binding, update, context);
  if (update.kind === "edited_message") return appendEdit(binding, update);
  return processMembershipChange(binding, update);
}

function safeTelegramProcessingCode(error: unknown): string {
  return error instanceof TelegramProcessingError ? error.code : "processing_failed";
}

async function claimTelegramInbox(input: { workerId: string; limit: number }): Promise<ClaimedInboxUpdate[]> {
  return withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) => {
    const result = await tx.query<ClaimedInboxUpdate>(
      "select * from app.claim_telegram_inbox($1::integer, $2::text, $3::integer)",
      [input.limit, input.workerId, INBOX_LEASE_SECONDS],
    );
    return result.rows;
  });
}

async function completeTelegramInbox(item: ClaimedInboxUpdate, disposition: string): Promise<void> {
  await withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) => {
    await tx.query("select app.complete_telegram_inbox($1::bigint, $2::bigint, $3::uuid, $4::text)",
      [item.bot_id, item.update_id, item.lease_id, disposition]);
  });
}

async function failTelegramInbox(item: ClaimedInboxUpdate, code: string): Promise<void> {
  await withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) => {
    await tx.query("select app.fail_telegram_inbox($1::bigint, $2::bigint, $3::uuid, $4::text)",
      [item.bot_id, item.update_id, item.lease_id, code]);
  });
}

export async function processTelegramInboxBatch(input: {
  workerId: string;
  limit: number;
}): Promise<{ claimed: number; processed: number; failed: number }> {
  validBatch(input);
  const claimed = await claimTelegramInbox(input);
  const result = { claimed: claimed.length, processed: 0, failed: 0 };
  for (const item of claimed) {
    try {
      const disposition = await processTelegramUpdate(normalizeTelegramUpdate(item.payload), rawCommandContext(item.payload));
      await completeTelegramInbox(item, disposition);
      result.processed += 1;
    } catch (error) {
      result.failed += 1;
      try {
        await failTelegramInbox(item, safeTelegramProcessingCode(error));
      } catch {
        // A lost/expired lease is already safe: its terminal receipt cannot be
        // changed by this worker, and no error details are exposed.
      }
    }
  }
  return result;
}
