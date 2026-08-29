import { withServiceTx } from "@goproceed/database";
import { consumeBindingCommand, consumeMemberLinkCommand } from "./linking";
import { createTelegramApiClient } from "./api";
import { loadTelegramConfig } from "./config";
import {
  prepareTelegramEvidenceCandidate, processTelegramEvidenceAttachment, selectTelegramOccurrence,
} from "./evidence";
import { putObject } from "../evidence-storage";
import { enqueueTelegramMessage } from "./delivery";
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

/**
 * A Telegram worker has a provider identity, never a member identity. This
 * narrow SECURITY DEFINER function is the only service-plane outbox path: it
 * derives the allowed aggregate and payload from an already-persisted source
 * fact, rather than weakening general outbox RLS or inventing an actor.
 */
async function enqueueTelegramProcessorOutbox(
  tx: { query: <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> },
  binding: ChatBinding,
  input: { topic: "telegram.message.normalized" | "telegram.channel.health_changed"; messageId: string; providerUpdateId: string; eventKind: "message" | "edited" | "bot_removed" | "bot_restored" },
): Promise<void> {
  await tx.query(`select app.enqueue_telegram_processor_outbox(
    $1::uuid, $2::uuid, $3::text, $4::uuid, $5::bigint, $6::text
  )`, [
    binding.workspace_id, binding.project_id, input.topic,
    input.messageId, input.providerUpdateId, input.eventKind,
  ]);
}

type StoredAttachment = { id: string; file: Extract<NormalizedTelegramUpdate, { kind: "message" }>["files"][number] };

async function storeMessage(
  binding: ChatBinding,
  update: Extract<NormalizedTelegramUpdate, { kind: "message" }>,
  context: RawCommandContext,
): Promise<{ disposition: string; messageId: string | null; attachments: StoredAttachment[] }> {
  return withServiceTx({ actorUserId: "", organizationId: binding.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
    const authorMemberId = await linkedMemberId(tx, binding.workspace_id, update.senderId);
    const reply = update.replyToMessageId === null ? null : await tx.query<{ id: string }>(`select id
      from public.communication_messages
     where telegram_chat_binding_id=$1 and provider_message_id=$2::bigint`,
    [binding.telegram_chat_binding_id, update.replyToMessageId]);
    const message = await tx.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text,
       author_member_id, provider_user_id, provider_display_name_snapshot,
       provider_username_snapshot, provider_message_id, provider_sent_at,
       reply_to_message_id, provider_reply_to_message_id, delivery_state)
      values ($1, $2, $3, 'inbound', $4, $5, $6, $7::bigint, $8, $9,
              $10::bigint, $11::timestamptz, $12, $13::bigint, 'received')
      on conflict (telegram_chat_binding_id, provider_message_id) where provider_message_id is not null do nothing
      returning id`, [
      binding.workspace_id, binding.project_id, binding.telegram_chat_binding_id,
      messageKind(update), update.text, authorMemberId, update.senderId,
      context.displayName, context.username, update.messageId, update.sentAt,
      reply?.rows[0]?.id ?? null, update.replyToMessageId,
    ]);
    const messageId = message.rows[0]?.id;
    const attachments: StoredAttachment[] = [];
    if (messageId) {
      const mediaGroup = update.mediaGroupId === null ? null : await tx.query<{ id: string }>(`insert into public.telegram_media_groups
        (workspace_id, project_id, telegram_chat_binding_id, provider_media_group_id, uploader_member_id,
         reply_provider_message_id, last_part_at)
        values ($1,$2,$3,$4,$5,$6::bigint,now())
        on conflict (telegram_chat_binding_id, provider_media_group_id)
        do update set last_part_at=excluded.last_part_at
        returning id`, [
        binding.workspace_id, binding.project_id, binding.telegram_chat_binding_id, update.mediaGroupId,
        authorMemberId, update.replyToMessageId,
      ]);
      const telegramMediaGroupId = mediaGroup?.rows[0]?.id ?? null;
      for (const file of update.files) {
        // This is provider metadata only, not evidence work. Task 9 consumes
        // these service-plane handles when it adds assignment-card eligibility.
        const attachment = await tx.query<{ id: string }>(`insert into public.communication_attachments
          (workspace_id, project_id, message_id, provider_file_id, provider_file_unique_id,
           filename_snapshot, media_type_snapshot, byte_size, telegram_media_group_id, state)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'staged') returning id`, [
          binding.workspace_id, binding.project_id, messageId, file.fileId, file.fileUniqueId,
          file.fileName, file.mimeType, file.fileSize, telegramMediaGroupId,
        ]);
        const attachmentId = attachment.rows[0]?.id;
        if (attachmentId) attachments.push({ id: attachmentId, file });
      }
      await enqueueTelegramProcessorOutbox(tx, binding, {
        topic: "telegram.message.normalized", messageId, providerUpdateId: update.updateId, eventKind: "message",
      });
    }
    return { disposition: authorMemberId === null ? "stored_unverified_message" : "stored_chat_message", messageId: messageId ?? null, attachments };
  });
}

async function settleTelegramEvidenceAttachment(input: {
  workspaceId: string; attachmentId: string; result: Awaited<ReturnType<typeof processTelegramEvidenceAttachment>>;
}): Promise<void> {
  await withServiceTx({ actorUserId: "", organizationId: input.workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
    if (input.result.kind === "available") {
      await tx.query(`update public.communication_attachments
        set state='available', evidence_object_id=$2, terminal_at=now(),
            provider_file_id=null, provider_file_unique_id=null
        where id=$1 and state='processing'`, [input.attachmentId, input.result.evidenceObjectId]);
      return;
    }
    await tx.query(`update public.communication_attachments
      set state='failed', failure_code=$2, terminal_at=now(),
          provider_file_id=null, provider_file_unique_id=null
      where id=$1 and state='processing'`, [input.attachmentId, input.result.code]);
  });
}

async function enqueueRequirementChoicePrompt(input: {
  binding: ChatBinding; assignmentId: string; replyToMessageId: string;
  tokens: Array<{ label: string; token: string }>;
}): Promise<void> {
  await withServiceTx({ actorUserId: "", organizationId: input.binding.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
    await enqueueTelegramMessage(tx, { actorUserId: "", organizationId: input.binding.workspace_id, requestId: crypto.randomUUID() }, {
      workspaceId: input.binding.workspace_id, projectId: input.binding.project_id,
      telegramChatBindingId: input.binding.telegram_chat_binding_id, workAssignmentId: input.assignmentId,
      kind: "text", text: "Виберіть вимогу для цих зображень.", replyToMessageId: input.replyToMessageId,
      inlineKeyboard: input.tokens.map(({ label, token }) => [{ text: label, callbackData: `req:${token}` }]),
    });
  });
}

async function prepareStoredEvidence(
  binding: ChatBinding,
  update: Extract<NormalizedTelegramUpdate, { kind: "message" }>,
  stored: { messageId: string | null; attachments: StoredAttachment[] },
): Promise<void> {
  if (stored.messageId === null) return;
  const config = loadTelegramConfig();
  const api = createTelegramApiClient(config);
  for (const attachment of stored.attachments) {
    const prepared = await prepareTelegramEvidenceCandidate({
      workspaceId: binding.workspace_id, projectId: binding.project_id,
      telegramChatBindingId: binding.telegram_chat_binding_id, messageId: stored.messageId,
      attachmentId: attachment.id, senderId: update.senderId,
      replyToProviderMessageId: update.replyToMessageId, mediaGroupId: update.mediaGroupId,
      file: attachment.file,
    });
    if (prepared.kind === "awaiting_requirement_choice") {
      await enqueueRequirementChoicePrompt({ binding, assignmentId: prepared.assignmentId,
        replyToMessageId: stored.messageId, tokens: prepared.tokens });
      continue;
    }
    if (prepared.kind !== "ready") continue;
    const result = await processTelegramEvidenceAttachment({
      actorUserId: prepared.actorUserId, requestId: crypto.randomUUID(), assignmentId: prepared.assignmentId,
      occurrenceId: prepared.occurrenceId, botId: config.botId, chatId: update.chatId,
      messageId: update.messageId, file: attachment.file, api, putObject,
    });
    await settleTelegramEvidenceAttachment({ workspaceId: binding.workspace_id, attachmentId: attachment.id, result });
  }
}

async function processSelectedEvidence(input: {
  workspaceId: string; assignmentId: string; occurrenceId: string; actorUserId: string;
  attachmentIds: string[]; botId: string; chatId: string;
}): Promise<void> {
  const attachments = await withServiceTx({ actorUserId: "", organizationId: input.workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
    const result = await tx.query<{
      id: string; provider_file_id: string | null; provider_file_unique_id: string | null;
      filename_snapshot: string | null; media_type_snapshot: string | null; byte_size: number | null;
      provider_message_id: string;
    }>(`select a.id, a.provider_file_id, a.provider_file_unique_id, a.filename_snapshot,
                 a.media_type_snapshot, a.byte_size, m.provider_message_id::text
          from public.communication_attachments a
          join public.communication_messages m on m.workspace_id=a.workspace_id and m.id=a.message_id
          where a.workspace_id=$1 and a.id=any($2::uuid[]) and a.state='processing'`,
    [input.workspaceId, input.attachmentIds]);
    return result.rows;
  });
  const api = createTelegramApiClient(loadTelegramConfig());
  for (const attachment of attachments) {
    const file = {
      kind: attachment.media_type_snapshot === "image/jpeg" && attachment.filename_snapshot === null ? "photo" as const : "document" as const,
      fileId: attachment.provider_file_id ?? "",
      fileUniqueId: attachment.provider_file_unique_id,
      fileName: attachment.filename_snapshot,
      mimeType: attachment.media_type_snapshot,
      fileSize: attachment.byte_size,
      width: null,
      height: null,
    };
    const result = await processTelegramEvidenceAttachment({
      actorUserId: input.actorUserId, requestId: crypto.randomUUID(), assignmentId: input.assignmentId,
      occurrenceId: input.occurrenceId, botId: input.botId, chatId: input.chatId,
      messageId: attachment.provider_message_id, file, api, putObject,
    });
    await settleTelegramEvidenceAttachment({ workspaceId: input.workspaceId, attachmentId: attachment.id, result });
  }
}

async function processRequirementCallback(update: Extract<NormalizedTelegramUpdate, { kind: "callback_query" }>): Promise<string> {
  if (update.chatId === null || update.data === null || !update.data.startsWith("req:")) return "ignored_callback_query";
  const config = loadTelegramConfig();
  const binding = await resolveBoundChat(config.botId, update.chatId);
  if (binding === null || binding.channel_state === "archived") return "rejected_requirement_choice";
  const selection = await selectTelegramOccurrence({
    botId: config.botId, chatId: update.chatId, uploaderTelegramUserId: update.senderId, token: update.data.slice(4),
  });
  const api = createTelegramApiClient(config);
  if (selection.kind === "rejected") {
    await api.answerCallbackQuery({ callbackId: update.callbackId, text: "Вибір недійсний або вже використаний." }).catch(() => undefined);
    return "rejected_requirement_choice";
  }
  await api.answerCallbackQuery({ callbackId: update.callbackId, text: "Обробляємо зображення." }).catch(() => undefined);
  await processSelectedEvidence({ workspaceId: binding.workspace_id, assignmentId: selection.assignmentId,
    occurrenceId: selection.occurrenceId, actorUserId: selection.actorUserId, attachmentIds: selection.attachmentIds,
    botId: config.botId, chatId: update.chatId });
  return "selected_requirement_occurrence";
}

/** Claim albums only after two seconds without another normalized part. */
export async function processDueTelegramMediaGroups(limit = 20): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TelegramProcessingError("invalid_media_group_limit");
  await withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) => {
    await tx.query(`update public.communication_attachments a set state='not_evidence', terminal_at=now(),
        provider_file_id=null, provider_file_unique_id=null
      where a.state='awaiting_requirement_choice' and exists (
        select 1 from public.telegram_requirement_choice_sessions s
        where s.workspace_id=a.workspace_id and s.consumed_at is null and s.expires_at <= now()
          and (s.communication_attachment_id=a.id or s.telegram_media_group_id=a.telegram_media_group_id)
      )`);
    await tx.query(`update public.telegram_media_groups g set state='not_evidence', completed_at=now()
      where g.state='awaiting_requirement_choice' and g.choice_expires_at <= now()`);
  });
  const groups = await withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) => {
    const claimed = await tx.query<{ id: string; workspace_id: string; project_id: string; telegram_chat_binding_id: string; chat_id: string }>(`
      select g.id, g.workspace_id, g.project_id, g.telegram_chat_binding_id, b.chat_id::text
      from public.telegram_media_groups g
      join public.telegram_chat_bindings b on b.workspace_id=g.workspace_id and b.project_id=g.project_id and b.id=g.telegram_chat_binding_id
      where g.state='open' and g.last_part_at <= now() - interval '2 seconds'
      order by g.last_part_at, g.id for update of g skip locked limit $1`, [limit]);
    for (const group of claimed.rows) {
      await tx.query("update public.telegram_media_groups set state='processing' where id=$1 and state='open'", [group.id]);
    }
    return claimed.rows;
  });
  for (const group of groups) {
    const first = await withServiceTx({ actorUserId: "", organizationId: group.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
      const row = await tx.query<{
        attachment_id: string; message_id: string; provider_user_id: string; provider_message_id: string;
        provider_reply_to_message_id: string | null; provider_file_id: string; provider_file_unique_id: string | null;
        filename_snapshot: string | null; media_type_snapshot: string | null; byte_size: number | null;
      }>(`select a.id as attachment_id, m.id as message_id, m.provider_user_id::text, m.provider_message_id::text,
                  m.provider_reply_to_message_id::text, a.provider_file_id, a.provider_file_unique_id,
                  a.filename_snapshot, a.media_type_snapshot, a.byte_size
           from public.communication_attachments a join public.communication_messages m
             on m.workspace_id=a.workspace_id and m.id=a.message_id
           where a.workspace_id=$1 and a.telegram_media_group_id=$2 and a.state='staged'
             and a.media_type_snapshot in ('image/jpeg','image/png','image/heic')
           order by m.provider_message_id, a.id limit 1`, [group.workspace_id, group.id]);
      return row.rows[0] ?? null;
    });
    if (!first) continue;
    const binding: ChatBinding = {
      workspace_id: group.workspace_id, project_id: group.project_id,
      telegram_chat_binding_id: group.telegram_chat_binding_id, channel_state: "active",
    };
    const file = {
      kind: first.filename_snapshot === null && first.media_type_snapshot === "image/jpeg" ? "photo" as const : "document" as const,
      fileId: first.provider_file_id, fileUniqueId: first.provider_file_unique_id,
      fileName: first.filename_snapshot, mimeType: first.media_type_snapshot, fileSize: first.byte_size,
      width: null, height: null,
    };
    const prepared = await prepareTelegramEvidenceCandidate({
      workspaceId: group.workspace_id, projectId: group.project_id,
      telegramChatBindingId: group.telegram_chat_binding_id, messageId: first.message_id,
      attachmentId: first.attachment_id, senderId: first.provider_user_id,
      replyToProviderMessageId: first.provider_reply_to_message_id, mediaGroupId: group.id,
      telegramMediaGroupId: group.id, allowMediaGroup: true, file,
    });
    if (prepared.kind === "awaiting_requirement_choice") {
      await enqueueRequirementChoicePrompt({ binding, assignmentId: prepared.assignmentId,
        replyToMessageId: first.message_id, tokens: prepared.tokens });
      continue;
    }
    if (prepared.kind !== "ready") continue;
    const attachmentIds = await withServiceTx({ actorUserId: "", organizationId: group.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
      const rows = await tx.query<{ id: string }>(`select id from public.communication_attachments
        where workspace_id=$1 and telegram_media_group_id=$2 and state='processing'`, [group.workspace_id, group.id]);
      return rows.rows.map(({ id }) => id);
    });
    await processSelectedEvidence({ workspaceId: group.workspace_id, assignmentId: prepared.assignmentId,
      occurrenceId: prepared.occurrenceId, actorUserId: prepared.actorUserId, attachmentIds,
      botId: loadTelegramConfig().botId, chatId: group.chat_id });
    await withServiceTx({ actorUserId: "", organizationId: group.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
      await tx.query(`update public.telegram_media_groups set state='completed', completed_at=now()
        where id=$1 and state='processing'`, [group.id]);
    });
  }
  return groups.length;
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
    const event = await tx.query<{ id: string }>(`insert into public.communication_message_events
      (workspace_id, project_id, message_id, event_kind, text, provider_event_at, provider_update_id)
      values ($1, $2, $3, 'edited', $4, $5::timestamptz, $6::bigint)
      on conflict (workspace_id, project_id, message_id, provider_update_id)
        where event_kind = 'edited' and provider_update_id is not null do nothing
      returning id`, [
      // The append-only event schema requires a text value. An edited
      // media message can have no caption, so preserve that provider fact as
      // an empty normalized body rather than failing and losing the edit.
      binding.workspace_id, binding.project_id, messageId, update.text ?? "", update.editedAt, update.updateId,
    ]);
    const eventId = event.rows[0]?.id;
    if (eventId) {
      await enqueueTelegramProcessorOutbox(tx, binding, {
        topic: "telegram.message.normalized", messageId, providerUpdateId: update.updateId, eventKind: "edited",
      });
    }
    return "appended_message_edit";
  });
}

async function processMembershipChange(
  binding: ChatBinding,
  update: Extract<NormalizedTelegramUpdate, { kind: "my_chat_member" }>,
): Promise<string> {
  const removed = update.newStatus === "left" || update.newStatus === "kicked";
  const restored = update.newStatus === "member" || update.newStatus === "administrator";
  if (!removed && !restored) return "ignored_membership_status";
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
      const event = await tx.query<{ id: string }>(`insert into public.communication_message_events
        (workspace_id, project_id, message_id, event_kind)
        values ($1, $2, $3, $4)
        returning id`, [
        binding.workspace_id, binding.project_id, systemMessageId, removed ? "bot_removed" : "bot_restored",
      ]);
      const eventId = event.rows[0]?.id;
      if (eventId) {
        await enqueueTelegramProcessorOutbox(tx, binding, {
          topic: "telegram.channel.health_changed", messageId: systemMessageId, providerUpdateId: update.updateId,
          eventKind: removed ? "bot_removed" : "bot_restored",
        });
      }
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
  if (update.kind === "callback_query") return processRequirementCallback(update);
  if (update.kind === "message" && update.command !== null) return processStartCommand(update, context);

  const chatId = update.chatId;
  const binding = await resolveBoundChat(loadTelegramConfig().botId, chatId);
  if (binding === null) return "ignored_unknown_chat";
  if (binding.channel_state === "archived") return "ignored_archived_channel";
  if (update.kind === "message") {
    const stored = await storeMessage(binding, update, context);
    await prepareStoredEvidence(binding, update, stored);
    return stored.disposition;
  }
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
  // A subsequent scheduled worker invocation is what supplies the quiet period;
  // processing a just-arrived part here cannot claim an incomplete album.
  await processDueTelegramMediaGroups().catch(() => undefined);
  return result;
}
