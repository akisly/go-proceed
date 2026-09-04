import { withServiceTx } from "@goproceed/database";
import { consumeBindingCommand, consumeMemberLinkCommand } from "./linking";
import { createTelegramApiClient } from "./api";
import { loadTelegramConfig } from "./config";
import {
  prepareTelegramEvidenceCandidate, processTelegramEvidenceAttachment, selectTelegramOccurrence,
  terminalizeStagedNonAlbumAttachments,
  formatTelegramEvidenceSummaryChunks, type TelegramEvidenceCopyKey,
} from "./evidence";
import { putObject } from "../evidence-storage";
import { enqueueTelegramMessage } from "./delivery";
import { normalizeTelegramUpdate, type NormalizedTelegramUpdate } from "./normalize";
import {
  isTelegramDecisionCallback, processTelegramDecisionCallback, processTelegramDecisionReturnReply,
  TelegramDecisionTransientError,
} from "./decisions";
import { issueTelegramEvidenceDecisionCallbacks } from "./decisions";

const INBOX_LEASE_SECONDS = 60;
const MEDIA_GROUP_LEASE_SECONDS = 60;

type AttachmentClaim = { token: string; expiresAt: string };
type AlbumClaim = { leaseToken: string; leaseExpiresAt: string; generation: number; claimedLastPartAt: string };
type DueEvidenceRetryRow = {
  id: string; workspace_id: string; project_id: string; provider_file_id: string; provider_file_unique_id: string | null;
  filename_snapshot: string | null; media_type_snapshot: string | null; byte_size: number | null; requirement_occurrence_id: string;
  provider_message_id: string; chat_id: string; bot_id: string; actor_user_id: string | null; work_assignment_id: string;
  telegram_chat_binding_id: string; telegram_media_group_id: string | null;
  group_lease_token: string | null; group_lease_expires_at: string | null;
  group_generation: string | null; group_claimed_last_part_at: string | null; context_valid: boolean;
  retry_lease_token?: string; retry_lease_expires_at?: string;
};
type ReceiptSource =
  | { kind: "attachment"; id: string; generation: 0 }
  | { kind: "media_group"; id: string; generation: number };

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

/**
 * Through the definer, not an inline join. public.memberships carries
 * member-plane policies only (m_select, m_select_workspace — both keyed on
 * app.current_actor(), which a service transaction leaves empty), and
 * goproceed_service inherits goproceed_app, so the join this used to make
 * found no membership for anyone: every author_member_id and every album's
 * uploader_member_id was NULL, a linked member's message was filed as
 * unverified, and a second member's album part passed the uploader check
 * (0071) as NULL = NULL. app.resolve_telegram_linked_member (0082) is bounded
 * to the workspace this transaction declared.
 */
async function linkedMemberId(tx: { query: <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> }, workspaceId: string, senderId: string): Promise<string | null> {
  const result = await tx.query<{ member_id: string }>(
    "select member_id from app.resolve_telegram_linked_member($1::uuid, $2::bigint)", [workspaceId, senderId]);
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
    // A worker can crash after staging rows but before eligibility.  The
    // provider update is idempotent, not a permission to abandon those staged
    // handles: recover the exact persisted message and continue from it.
    const existing = message.rows[0] ? null : await tx.query<{ id: string }>(`select id
      from public.communication_messages where telegram_chat_binding_id=$1 and provider_message_id=$2::bigint`,
    [binding.telegram_chat_binding_id, update.messageId]);
    const messageId = message.rows[0]?.id ?? existing?.rows[0]?.id;
    const attachments: StoredAttachment[] = [];
    if (messageId && message.rows[0]) {
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
    } else if (messageId) {
      const persisted = await tx.query<{ id: string; provider_file_id: string | null }>(`select id, provider_file_id
        from public.communication_attachments where workspace_id=$1 and message_id=$2
          and state in ('staged','awaiting_requirement_choice','processing')`, [binding.workspace_id, messageId]);
      for (const row of persisted.rows) {
        const file = update.files.find((candidate) => candidate.fileId === row.provider_file_id);
        if (file) attachments.push({ id: row.id, file });
      }
    }
    return { disposition: authorMemberId === null ? "stored_unverified_message" : "stored_chat_message", messageId: messageId ?? null, attachments };
  });
}

async function settleTelegramEvidenceAttachment(input: {
  workspaceId: string; attachmentId: string; result: Awaited<ReturnType<typeof processTelegramEvidenceAttachment>>;
  attachmentClaim: AttachmentClaim; mediaGroupId?: string | null; albumClaim?: AlbumClaim | null;
}): Promise<boolean> {
  return withServiceTx({ actorUserId: "", organizationId: input.workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
    const settled = await tx.query<{ settled: boolean }>(`select app.settle_telegram_evidence_attachment(
      $1::uuid,$2::uuid,$3::text,$4::uuid,$5::text,
      $6::uuid,$7::uuid,$8::timestamptz,$9::bigint,$10::timestamptz
    ) as settled`, [
      input.attachmentId, input.attachmentClaim.token, input.result.kind,
      input.result.kind === "available" ? input.result.evidenceObjectId : null,
      input.result.kind === "available" ? null : input.result.code,
      input.mediaGroupId ?? null, input.albumClaim?.leaseToken ?? null,
      input.albumClaim?.leaseExpiresAt ?? null, input.albumClaim?.generation ?? null,
      input.albumClaim?.claimedLastPartAt ?? null,
    ]);
    return settled.rows[0]?.settled === true;
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

async function enqueueEvidenceSummary(input: {
  binding: ChatBinding; assignmentId: string | null; source: ReceiptSource;
  copyKey: TelegramEvidenceCopyKey;
  results: Array<Exclude<Awaited<ReturnType<typeof processTelegramEvidenceAttachment>>, { kind: "retry" }>>;
  recipientMemberId?: string | null;
  albumClaim?: AlbumClaim;
}): Promise<boolean> {
  return withServiceTx({ actorUserId: "", organizationId: input.binding.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
    const chunks = input.copyKey === "telegram.evidence.unbound"
      ? ["Фото не прив’язано до чинної картки завдання та залишено лише в історії чату."]
      : formatTelegramEvidenceSummaryChunks(input.results);
    for (const [chunkIndex, text] of chunks.entries()) {
      const enqueued = await tx.query<{ id: string | null }>(`select app.enqueue_telegram_evidence_receipt(
        $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,
        $7::text,$8::bigint,$9::integer,$10::text,$11::uuid,$12::uuid,$13::timestamptz
      ) as id`, [
        input.binding.workspace_id, input.binding.project_id, input.binding.telegram_chat_binding_id,
        input.assignmentId, input.source.kind === "attachment" ? input.source.id : null,
        input.source.kind === "media_group" ? input.source.id : null,
        input.copyKey, input.source.generation, chunkIndex, text, input.recipientMemberId ?? null,
        input.albumClaim?.leaseToken ?? null, input.albumClaim?.claimedLastPartAt ?? null,
      ]);
      if (enqueued.rows[0]?.id === null) return false;
    }
    return true;
  });
}

export function telegramEvidenceTerminalCopyKey(results: Array<Exclude<Awaited<ReturnType<typeof processTelegramEvidenceAttachment>>, { kind: "retry" }>>): TelegramEvidenceCopyKey {
  const available = results.filter(({ kind }) => kind === "available").length;
  if (available === results.length) return "telegram.evidence.complete";
  if (available > 0) return "telegram.evidence.partial";
  const unboundCodes = new Set(["unbound_card_reply", "album_anchor_mismatch"]);
  return results.every((result) => result.kind === "failed" && unboundCodes.has(result.code))
    ? "telegram.evidence.unbound"
    : "telegram.evidence.failed";
}

async function reconcileTelegramEvidenceReceipt(input: {
  binding: ChatBinding; source: ReceiptSource; albumClaim?: AlbumClaim;
}): Promise<"terminal" | "pending" | "stale"> {
  const snapshot = await withServiceTx({ actorUserId: "", organizationId: input.binding.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
    const rows = await tx.query<{
      state: string; evidence_object_id: string | null; failure_code: string | null;
      provider_message_id: string; work_assignment_id: string | null; requirement_occurrence_id: string | null;
    }>(input.source.kind === "attachment"
          ? `select a.state, a.evidence_object_id, a.failure_code, a.requirement_occurrence_id::text, m.provider_message_id::text,
            coalesce(o.work_assignment_id, card.work_assignment_id)::text as work_assignment_id
          from public.communication_attachments a
          join public.communication_messages m on m.workspace_id=a.workspace_id and m.id=a.message_id
          left join public.requirement_occurrences o on o.workspace_id=a.workspace_id and o.id=a.requirement_occurrence_id
          left join public.communication_messages card on card.workspace_id=m.workspace_id
            and card.telegram_chat_binding_id=m.telegram_chat_binding_id
            and card.provider_message_id=m.provider_reply_to_message_id and card.kind='assignment_card'
         where a.workspace_id=$1 and a.id=$2`
          : `select a.state, a.evidence_object_id, a.failure_code, a.requirement_occurrence_id::text, m.provider_message_id::text,
            coalesce(o.work_assignment_id, card.work_assignment_id)::text as work_assignment_id
          from public.communication_attachments a
          join public.communication_messages m on m.workspace_id=a.workspace_id and m.id=a.message_id
          join public.telegram_media_groups g on g.workspace_id=a.workspace_id and g.id=a.telegram_media_group_id
          left join public.requirement_occurrences o on o.workspace_id=a.workspace_id and o.id=a.requirement_occurrence_id
          left join public.communication_messages card on card.workspace_id=m.workspace_id
            and card.telegram_chat_binding_id=m.telegram_chat_binding_id
            and card.provider_message_id=g.reply_provider_message_id and card.kind='assignment_card'
         where a.workspace_id=$1 and a.telegram_media_group_id=$2
           and ($3::timestamptz is null or a.created_at <= $3::timestamptz)
         order by m.provider_message_id, a.id`, input.source.kind === "attachment"
      ? [input.binding.workspace_id, input.source.id]
      : [input.binding.workspace_id, input.source.id, input.albumClaim?.claimedLastPartAt ?? null]);
    return rows.rows;
  });
  if (snapshot.length === 0) return "stale";
  if (snapshot.some(({ state }) => !["unbound", "available", "not_evidence", "failed"].includes(state))) return "pending";
  const results = snapshot.map((row) => row.state === "available"
    ? { kind: "available" as const, evidenceObjectId: row.evidence_object_id!, uploadIntentId: "durable", imageReference: row.provider_message_id }
    : { kind: "failed" as const, code: row.failure_code ?? "evidence_processing_failed", imageReference: row.provider_message_id });
  const enqueued = await enqueueEvidenceSummary({
    binding: input.binding, assignmentId: snapshot.find(({ work_assignment_id }) => work_assignment_id !== null)?.work_assignment_id ?? null,
    source: input.source, copyKey: telegramEvidenceTerminalCopyKey(results), results,
    ...(input.albumClaim === undefined ? {} : { albumClaim: input.albumClaim }),
  });
  if (!enqueued) return "stale";
  // Decision controls are published only after an exact occurrence has a
  // durable available evidence object. Receipt replay for the same source and
  // generation sees its lifetime context key and never emits another keyboard;
  // a later attachment or album generation is a new review cycle.
  for (const row of snapshot) if (row.state === "available" && row.requirement_occurrence_id !== null) {
    await issueTelegramEvidenceDecisionCallbacks({ workspaceId: input.binding.workspace_id, projectId: input.binding.project_id,
      telegramChatBindingId: input.binding.telegram_chat_binding_id, occurrenceId: row.requirement_occurrence_id,
      reviewSource: input.source });
  }
  if (input.source.kind === "media_group" && input.albumClaim) {
    const completion = await withServiceTx({ actorUserId: "", organizationId: input.binding.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
      const result = await tx.query<{ outcome: string }>(`select app.complete_telegram_media_group_claim(
        $1::uuid,$2::uuid,$3::bigint,$4::timestamptz
      ) as outcome`, [input.source.id, input.albumClaim!.leaseToken, input.albumClaim!.generation, input.albumClaim!.claimedLastPartAt]);
      return result.rows[0]?.outcome ?? "stale";
    });
    return completion === "completed" ? "terminal" : completion as "pending" | "stale";
  }
  return "terminal";
}

async function enqueueEvidenceProcessing(input: {
  binding: ChatBinding; assignmentId: string; replyToMessageId: string | null;
}): Promise<void> {
  await withServiceTx({ actorUserId: "", organizationId: input.binding.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
    await enqueueTelegramMessage(tx, { actorUserId: "", organizationId: input.binding.workspace_id, requestId: crypto.randomUUID() }, {
      workspaceId: input.binding.workspace_id, projectId: input.binding.project_id,
      telegramChatBindingId: input.binding.telegram_chat_binding_id, workAssignmentId: input.assignmentId,
      kind: "text", text: "Зображення обробляється. Підтвердження буде надіслано після збереження доказу.",
      replyToMessageId: input.replyToMessageId,
    });
  });
}

async function terminalizeClaimedAlbumStaged(input: {
  workspaceId: string; groupId: string; claim: AlbumClaim; code: string;
}): Promise<boolean> {
  return withServiceTx({ actorUserId: "", organizationId: input.workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
    const result = await tx.query<{ terminalized: boolean }>(`select app.terminalize_telegram_media_group_staged(
      $1::uuid,$2::uuid,$3::uuid,$4::timestamptz,$5::bigint,$6::timestamptz,$7::text
    ) as terminalized`, [input.workspaceId, input.groupId, input.claim.leaseToken,
      input.claim.leaseExpiresAt, input.claim.generation, input.claim.claimedLastPartAt, input.code]);
    return result.rows[0]?.terminalized === true;
  });
}

/** Recheck immutable source identity and the live authorization boundary immediately before download. */
async function revalidateTelegramEvidenceRetryContext(row: DueEvidenceRetryRow): Promise<boolean> {
  return withServiceTx({ actorUserId: "", organizationId: row.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
    const result = await tx.query<{ context_valid: boolean }>(`select exists (
        select 1
          from public.communication_attachments a
          join public.communication_messages m on m.workspace_id=a.workspace_id and m.project_id=a.project_id and m.id=a.message_id
          join public.telegram_chat_bindings b on b.workspace_id=a.workspace_id and b.project_id=a.project_id
            and b.id=m.telegram_chat_binding_id
          join public.project_field_channels c on c.workspace_id=b.workspace_id and c.project_id=b.project_id
            and c.channel='telegram' and c.state='active'
          join public.telegram_member_links l on l.workspace_id=a.workspace_id
            and l.telegram_user_id=m.provider_user_id and l.member_id=m.author_member_id and l.revoked_at is null
          join public.memberships u on u.organization_id=a.workspace_id and u.id=m.author_member_id and u.status='active'
          join public.requirement_occurrences o on o.workspace_id=a.workspace_id and o.project_id=a.project_id
            and o.id=a.requirement_occurrence_id and o.work_assignment_id=$3::uuid
          join public.communication_messages card on card.workspace_id=m.workspace_id and card.project_id=m.project_id
            and card.telegram_chat_binding_id=m.telegram_chat_binding_id
            and card.provider_message_id=m.provider_reply_to_message_id
            and card.kind='assignment_card' and card.delivery_state='provider_accepted'
            and card.work_assignment_id=o.work_assignment_id
            and card.telegram_occurrence_snapshot @> array[o.id]
          left join public.telegram_media_groups g on g.workspace_id=a.workspace_id and g.project_id=a.project_id
            and g.id=a.telegram_media_group_id
         where a.id=$1::uuid and a.state='processing'
           and a.provider_retry_lease_token=$2::uuid and a.provider_retry_lease_expires_at>now()
           and u.user_id=$12::uuid
           and m.telegram_chat_binding_id=$4::uuid and m.provider_message_id=$5::bigint
           and b.chat_id=$6::bigint and b.bot_id=$7::bigint and b.disconnected_at is null
           and (a.telegram_media_group_id is null or (
             g.telegram_chat_binding_id=b.id and g.uploader_member_id=m.author_member_id
             and g.reply_provider_message_id=m.provider_reply_to_message_id
             and g.state='processing' and g.processing_lease_token=$8::uuid
             and g.processing_lease_expires_at=$9::timestamptz and g.processing_lease_expires_at>now()
             and g.processing_generation=$10::bigint and g.claimed_generation=$10::bigint
             and g.last_part_at=$11::timestamptz and g.claimed_last_part_at=$11::timestamptz
           ))
      ) as context_valid`, [
      row.id, row.retry_lease_token, row.work_assignment_id, row.telegram_chat_binding_id,
      row.provider_message_id, row.chat_id, row.bot_id, row.group_lease_token,
      row.group_lease_expires_at, row.group_generation, row.group_claimed_last_part_at, row.actor_user_id,
    ]);
    return result.rows[0]?.context_valid === true;
  });
}

/**
 * Exported for the unit test of its failure path only; not part of the
 * module's surface.
 * @internal
 */
export async function prepareStoredEvidence(
  binding: ChatBinding,
  update: Extract<NormalizedTelegramUpdate, { kind: "message" }>,
  stored: { messageId: string | null; attachments: StoredAttachment[] },
): Promise<void> {
  if (stored.messageId === null) return;
  const messageId = stored.messageId;
  try {
    await prepareEachAttachment(binding, update, { messageId, attachments: stored.attachments });
  } catch (error) {
    // A transient decision error is what the batch loop retries
    // (processTelegramInboxBatch): the inbox row goes back to `pending` and
    // this message is prepared again, so its staged attachments must stay
    // exactly as they are. Nothing on this path throws that class today; the
    // check is here so that the day something does, the retry finds its rows.
    if (error instanceof TelegramDecisionTransientError) throw error;
    // storeMessage has already committed the attachments as `staged` with
    // their provider handles. Whatever else threw, the inbox row is about to
    // go `failed` and never be re-leased, so this is the last transaction
    // that will ever see these rows: clear the handles now (INV-094), then let
    // the error reach the batch loop unchanged. If this clearing itself fails
    // the original error still wins — it names the cause, this does not.
    try {
      await withServiceTx({ actorUserId: "", organizationId: binding.workspace_id, requestId: crypto.randomUUID() },
        (tx) => terminalizeStagedNonAlbumAttachments(tx, {
          workspaceId: binding.workspace_id, messageId, code: "processing_aborted",
        }));
    } catch { /* the original error is the one to surface */ }
    throw error;
  }
}

async function prepareEachAttachment(
  binding: ChatBinding,
  update: Extract<NormalizedTelegramUpdate, { kind: "message" }>,
  stored: { messageId: string; attachments: StoredAttachment[] },
): Promise<void> {
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
    if (prepared.kind !== "ready") {
      if (update.mediaGroupId === null && prepared.code !== "album_pending") {
        await reconcileTelegramEvidenceReceipt({
          binding, source: { kind: "attachment", id: attachment.id, generation: 0 },
        });
      }
      continue;
    }
    await enqueueEvidenceProcessing({ binding, assignmentId: prepared.assignmentId, replyToMessageId: stored.messageId });
    const result = await processTelegramEvidenceAttachment({
      actorUserId: prepared.actorUserId, requestId: crypto.randomUUID(), assignmentId: prepared.assignmentId,
      occurrenceId: prepared.occurrenceId, botId: config.botId, chatId: update.chatId,
      messageId: update.messageId, file: attachment.file, api, putObject,
    });
    const settled = await settleTelegramEvidenceAttachment({
      workspaceId: binding.workspace_id, attachmentId: attachment.id, result,
      attachmentClaim: prepared.processingLease,
    });
    if (settled) await reconcileTelegramEvidenceReceipt({
      binding, source: { kind: "attachment", id: attachment.id, generation: 0 },
    });
  }
  if (update.mediaGroupId === null) {
    const terminalIds = await withServiceTx({ actorUserId: "", organizationId: binding.workspace_id, requestId: crypto.randomUUID() }, async (tx) => (
      await tx.query<{ id: string }>(`select id from public.communication_attachments
        where workspace_id=$1 and project_id=$2 and message_id=$3
          and state in ('unbound','available','not_evidence','failed')`,
      [binding.workspace_id, binding.project_id, stored.messageId])
    ).rows.map(({ id }) => id));
    for (const attachmentId of terminalIds) await reconcileTelegramEvidenceReceipt({
      binding, source: { kind: "attachment", id: attachmentId, generation: 0 },
    });
  }
}

async function processSelectedEvidence(input: {
  workspaceId: string; assignmentId: string; occurrenceId: string; actorUserId: string;
  attachmentIds: string[]; botId: string; chatId: string;
  attachmentClaim: AttachmentClaim; mediaGroupId?: string | null; albumClaim?: AlbumClaim | null;
}): Promise<Array<Awaited<ReturnType<typeof processTelegramEvidenceAttachment>>>> {
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
  const results: Array<Awaited<ReturnType<typeof processTelegramEvidenceAttachment>>> = [];
  for (const attachment of attachments) {
    const file = {
      kind: attachment.media_type_snapshot === "image/jpeg" && attachment.filename_snapshot === null ? "photo" as const : "document" as const,
      fileId: attachment.provider_file_id ?? "",
      fileUniqueId: attachment.provider_file_unique_id,
      fileName: attachment.filename_snapshot,
      mimeType: attachment.media_type_snapshot,
      fileSize: attachment.byte_size === null ? null : Number(attachment.byte_size), // bigint arrives as a string
      width: null,
      height: null,
    };
    const processed = await processTelegramEvidenceAttachment({
      actorUserId: input.actorUserId, requestId: crypto.randomUUID(), assignmentId: input.assignmentId,
      occurrenceId: input.occurrenceId, botId: input.botId, chatId: input.chatId,
      messageId: attachment.provider_message_id, file, api, putObject,
    });
    const result = { ...processed, imageReference: attachment.provider_message_id };
    await settleTelegramEvidenceAttachment({
      workspaceId: input.workspaceId, attachmentId: attachment.id, result,
      attachmentClaim: input.attachmentClaim,
      ...(input.mediaGroupId === undefined ? {} : { mediaGroupId: input.mediaGroupId }),
      ...(input.albumClaim === undefined ? {} : { albumClaim: input.albumClaim }),
    });
    results.push(result);
  }
  return results;
}

async function processRequirementCallback(update: Extract<NormalizedTelegramUpdate, { kind: "callback_query" }>): Promise<string> {
  let answered = false;
  let api: ReturnType<typeof createTelegramApiClient> | null = null;
  const answerOnce = async (text: string): Promise<void> => {
    if (answered) return;
    answered = true;
    if (api) await api.answerCallbackQuery({ callbackId: update.callbackId, text }).catch(() => undefined);
  };
  try {
    const config = loadTelegramConfig();
    api = createTelegramApiClient(config);
    if (update.chatId === null || update.data === null || !update.data.startsWith("req:")) {
      await answerOnce("Вибір недійсний або вже використаний.");
      return "ignored_callback_query";
    }
    const binding = await resolveBoundChat(config.botId, update.chatId);
    if (binding === null || binding.channel_state === "archived") {
      await answerOnce("Вибір недійсний або вже використаний.");
      return "rejected_requirement_choice";
    }
    const selection = await selectTelegramOccurrence({
      botId: config.botId, chatId: update.chatId, uploaderTelegramUserId: update.senderId, token: update.data.slice(4),
    });
    if (selection.kind === "rejected") {
      await answerOnce("Вибір недійсний або вже використаний.");
      return "rejected_requirement_choice";
    }
    await answerOnce("Обробляємо зображення.");
    await enqueueEvidenceProcessing({ binding, assignmentId: selection.assignmentId, replyToMessageId: null });
    await processSelectedEvidence({ workspaceId: binding.workspace_id, assignmentId: selection.assignmentId,
      occurrenceId: selection.occurrenceId, actorUserId: selection.actorUserId, attachmentIds: selection.attachmentIds,
      botId: config.botId, chatId: update.chatId,
      attachmentClaim: selection.processingLease,
      mediaGroupId: selection.mediaGroupId, albumClaim: selection.albumClaim });
    await reconcileTelegramEvidenceReceipt({
      binding,
      source: selection.mediaGroupId === null
        ? { kind: "attachment", id: selection.attachmentIds[0]!, generation: 0 }
        : { kind: "media_group", id: selection.mediaGroupId, generation: selection.albumClaim!.generation },
      ...(selection.albumClaim === null ? {} : { albumClaim: selection.albumClaim }),
    });
    return "selected_requirement_occurrence";
  } catch {
    await answerOnce("Не вдалося обробити вибір. Спробуйте ще раз.");
    return "failed_requirement_choice";
  }
}

/** Claim albums only after two seconds without another normalized part. */
export async function processDueTelegramMediaGroups(limit = 20): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TelegramProcessingError("invalid_media_group_limit");
  await withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) => {
    await tx.query("select app.expire_telegram_evidence_choices($1::integer)", [limit]);
  });
  const groups = await withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) => {
    const claimed = await tx.query<{
      id: string; workspace_id: string; project_id: string; telegram_chat_binding_id: string;
      chat_id: string; lease_token: string; lease_expires_at: string;
      processing_generation: string; claimed_last_part_at: string;
    }>(`select id, workspace_id, project_id, telegram_chat_binding_id, chat_id::text, lease_token::text,
                  lease_expires_at::text, processing_generation::text, claimed_last_part_at::text
             from app.claim_telegram_media_groups($1::integer,$2::integer)`, [limit, MEDIA_GROUP_LEASE_SECONDS]);
    // The two timestamps travel back into equality predicates (`g.last_part_at=$3`,
    // `g.processing_lease_expires_at=$5`). Read as timestamptz, node-pg hands
    // them over as Dates with millisecond precision and the round trip loses
    // the microseconds Postgres stored, so the fences never match. Text keeps
    // every digit — the same reason evidence.ts reads its claim columns as text.
    return claimed.rows.map((group) => ({
      ...group,
      albumClaim: {
        leaseToken: group.lease_token,
        leaseExpiresAt: group.lease_expires_at,
        generation: Number(group.processing_generation),
        claimedLastPartAt: group.claimed_last_part_at,
      } satisfies AlbumClaim,
    }));
  });
  for (const group of groups) {
    const binding: ChatBinding = {
      workspace_id: group.workspace_id, project_id: group.project_id,
      telegram_chat_binding_id: group.telegram_chat_binding_id, channel_state: "active",
    };
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
             and a.created_at <= $3::timestamptz
             and exists (select 1 from public.telegram_media_groups g where g.id=$2
               and g.state='processing' and g.processing_lease_token=$4::uuid
               and g.processing_lease_expires_at=$5::timestamptz and g.processing_lease_expires_at>now()
               and g.processing_generation=$6::bigint and g.claimed_generation=$6::bigint
               and g.last_part_at=$3::timestamptz and g.claimed_last_part_at=$3::timestamptz)
           order by m.provider_message_id, a.id limit 1`, [group.workspace_id, group.id,
        group.albumClaim.claimedLastPartAt, group.albumClaim.leaseToken,
        group.albumClaim.leaseExpiresAt, group.albumClaim.generation]);
      return row.rows[0] ?? null;
    });
    if (!first) {
      await reconcileTelegramEvidenceReceipt({
        binding, source: { kind: "media_group", id: group.id, generation: group.albumClaim.generation },
        albumClaim: group.albumClaim,
      });
      continue;
    }
    // byte_size is a bigint, and node-pg hands bigints over as strings;
    // isTelegramEvidenceCandidate checks Number.isSafeInteger, which is false
    // for every string, so an album part read back from the table was refused
    // as unsupported_media while the same file arriving as an update passed.
    const file = {
      kind: first.filename_snapshot === null && first.media_type_snapshot === "image/jpeg" ? "photo" as const : "document" as const,
      fileId: first.provider_file_id, fileUniqueId: first.provider_file_unique_id,
      fileName: first.filename_snapshot, mimeType: first.media_type_snapshot, fileSize: first.byte_size === null ? null : Number(first.byte_size),
      width: null, height: null,
    };
    const prepared = await prepareTelegramEvidenceCandidate({
      workspaceId: group.workspace_id, projectId: group.project_id,
      telegramChatBindingId: group.telegram_chat_binding_id, messageId: first.message_id,
      attachmentId: first.attachment_id, senderId: first.provider_user_id,
      replyToProviderMessageId: first.provider_reply_to_message_id, mediaGroupId: group.id,
      telegramMediaGroupId: group.id, allowMediaGroup: true, file, albumClaim: group.albumClaim,
    });
    if (prepared.kind === "awaiting_requirement_choice") {
      await enqueueRequirementChoicePrompt({ binding, assignmentId: prepared.assignmentId,
        replyToMessageId: first.message_id, tokens: prepared.tokens });
      continue;
    }
    if (prepared.kind !== "ready") {
      await terminalizeClaimedAlbumStaged({ workspaceId: group.workspace_id, groupId: group.id,
        claim: group.albumClaim, code: prepared.code });
      await reconcileTelegramEvidenceReceipt({
        binding, source: { kind: "media_group", id: group.id, generation: group.albumClaim.generation },
        albumClaim: group.albumClaim,
      });
      continue;
    }
    const attachmentIds = await withServiceTx({ actorUserId: "", organizationId: group.workspace_id, requestId: crypto.randomUUID() }, async (tx) => {
      const rows = await tx.query<{ id: string }>(`select id from public.communication_attachments
        where workspace_id=$1 and telegram_media_group_id=$2 and state='processing'
          and created_at <= $3::timestamptz and provider_retry_lease_token=$4::uuid
          and provider_retry_lease_expires_at=$5::timestamptz and provider_retry_lease_expires_at>now()
          and exists (select 1 from public.telegram_media_groups g where g.id=$2
            and g.state='processing' and g.processing_lease_token=$4::uuid
            and g.processing_lease_expires_at=$5::timestamptz and g.processing_lease_expires_at>now()
            and g.processing_generation=$6::bigint and g.claimed_generation=$6::bigint
            and g.last_part_at=$3::timestamptz and g.claimed_last_part_at=$3::timestamptz)`,
      [group.workspace_id, group.id, group.albumClaim.claimedLastPartAt,
        group.albumClaim.leaseToken, group.albumClaim.leaseExpiresAt, group.albumClaim.generation]);
      return rows.rows.map(({ id }) => id);
    });
    await enqueueEvidenceProcessing({ binding, assignmentId: prepared.assignmentId, replyToMessageId: first.message_id });
    await processSelectedEvidence({ workspaceId: group.workspace_id, assignmentId: prepared.assignmentId,
      occurrenceId: prepared.occurrenceId, actorUserId: prepared.actorUserId, attachmentIds,
      botId: loadTelegramConfig().botId, chatId: group.chat_id,
      attachmentClaim: { token: group.albumClaim.leaseToken, expiresAt: group.albumClaim.leaseExpiresAt },
      mediaGroupId: group.id, albumClaim: group.albumClaim });
    await reconcileTelegramEvidenceReceipt({
      binding, source: { kind: "media_group", id: group.id, generation: group.albumClaim.generation },
      albumClaim: group.albumClaim,
    });
  }
  return groups.length;
}

/** Reclaim bounded provider-download retries without rediscovering arbitrary media. */
export async function processDueTelegramEvidenceRetries(limit = 20): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TelegramProcessingError("invalid_retry_limit");
  const claimed = await withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) => {
    const rows = await tx.query<DueEvidenceRetryRow>(`select a.id, a.workspace_id, a.project_id, a.provider_file_id, a.provider_file_unique_id,
          a.filename_snapshot, a.media_type_snapshot, a.byte_size, a.requirement_occurrence_id,
          m.provider_message_id::text, b.chat_id::text, b.bot_id::text, u.user_id::text as actor_user_id,
          o.work_assignment_id::text as work_assignment_id, m.telegram_chat_binding_id,
          a.telegram_media_group_id, g.processing_lease_token::text as group_lease_token,
          g.processing_lease_expires_at::text as group_lease_expires_at,
          g.claimed_generation::text as group_generation,
          g.claimed_last_part_at::text as group_claimed_last_part_at,
          (m.author_member_id is not null and l.member_id is not null and u.user_id is not null
            and b.disconnected_at is null and c.state='active'
            and (g.id is null or g.uploader_member_id=m.author_member_id)
            and exists (select 1 from public.project_access_grants pg
              where pg.workspace_id=a.workspace_id and pg.project_id=a.project_id
                and pg.member_id=m.author_member_id and pg.capability='evidence.record'
                and pg.revoked_at is null and pg.valid_from<=now()
                and (pg.valid_until is null or pg.valid_until>now()))
            and exists (select 1 from public.communication_messages card
              where card.workspace_id=a.workspace_id and card.project_id=a.project_id
                and card.telegram_chat_binding_id=m.telegram_chat_binding_id
                and card.provider_message_id=m.provider_reply_to_message_id
                and card.kind='assignment_card' and card.delivery_state='provider_accepted'
                and card.work_assignment_id=o.work_assignment_id
                and card.telegram_occurrence_snapshot @> array[o.id]
                and (g.id is null or card.provider_message_id=g.reply_provider_message_id))) as context_valid
        from public.communication_attachments a
        join public.communication_messages m on m.workspace_id=a.workspace_id and m.id=a.message_id
        join public.telegram_chat_bindings b on b.workspace_id=a.workspace_id and b.project_id=a.project_id and b.id=m.telegram_chat_binding_id
        join public.project_field_channels c on c.workspace_id=b.workspace_id and c.project_id=b.project_id and c.channel='telegram'
        join public.requirement_occurrences o on o.workspace_id=a.workspace_id and o.id=a.requirement_occurrence_id
        left join public.telegram_media_groups g on g.workspace_id=a.workspace_id and g.id=a.telegram_media_group_id
        left join public.telegram_member_links l on l.workspace_id=a.workspace_id
          and l.telegram_user_id=m.provider_user_id and l.member_id=m.author_member_id and l.revoked_at is null
        left join public.memberships u on u.organization_id=a.workspace_id and u.id=m.author_member_id and u.status='active'
       where a.state='processing'
         and ((a.provider_next_retry_at <= now()
             and (a.provider_retry_lease_expires_at is null or a.provider_retry_lease_expires_at <= now()))
           or (a.provider_next_retry_at is null
             and (a.provider_retry_lease_expires_at is null or a.provider_retry_lease_expires_at <= now())))
         and a.requirement_occurrence_id is not null and a.provider_file_id is not null
           and (a.telegram_media_group_id is null or (
             g.state='processing' and g.processing_lease_token is not null
           and g.processing_lease_expires_at > now()
           and g.claimed_generation=g.processing_generation
           and g.claimed_last_part_at=g.last_part_at))
       order by a.provider_next_retry_at, a.id limit $1`, [limit]);
    const claimedRows = [];
    for (const row of rows.rows) {
      // Album claims are always acquired before attachment retry leases. This
      // is the same order used by settlement and prevents a retry claimant
      // from inverting the group/attachment lock graph.
      if (row.telegram_media_group_id !== null) {
        const group = await tx.query<{ id: string }>(`select g.id from public.telegram_media_groups g
          where g.workspace_id=$1 and g.project_id=$2 and g.id=$3
            and g.state='processing' and g.processing_lease_token=$4::uuid
            and g.processing_lease_expires_at=$5::timestamptz and g.processing_lease_expires_at>now()
            and g.processing_generation=$6::bigint and g.claimed_generation=$6::bigint
            and g.last_part_at=$7::timestamptz and g.claimed_last_part_at=$7::timestamptz
          for update`, [row.workspace_id, row.project_id, row.telegram_media_group_id,
          row.group_lease_token, row.group_lease_expires_at, row.group_generation, row.group_claimed_last_part_at]);
        if (!group.rows[0]) continue;
      }
      const attachment = await tx.query<{ id: string }>(`select id from public.communication_attachments
        where id=$1 and state='processing' and provider_file_id is not null
          and requirement_occurrence_id is not null
          and ((provider_next_retry_at is not null and provider_next_retry_at<=now())
            or (provider_next_retry_at is null and (provider_retry_lease_expires_at is null or provider_retry_lease_expires_at<=now())))
        for update`, [row.id]);
      if (!attachment.rows[0]) continue;
      const lease = await tx.query<{ retry_lease_token: string; retry_lease_expires_at: string }>(`update public.communication_attachments
        set provider_retry_lease_token=gen_random_uuid(), provider_retry_lease_expires_at=now()+interval '60 seconds', provider_next_retry_at=null
        where id=$1 and state='processing' and provider_file_id is not null
          and ((provider_next_retry_at is not null and provider_next_retry_at<=now())
            or (provider_next_retry_at is null and (provider_retry_lease_expires_at is null or provider_retry_lease_expires_at<=now())))
        returning provider_retry_lease_token::text as retry_lease_token,
          provider_retry_lease_expires_at::text as retry_lease_expires_at`, [row.id]);
      if (lease.rows[0]) claimedRows.push({ ...row, ...lease.rows[0] });
    }
    return claimedRows;
  });
  const api = createTelegramApiClient(loadTelegramConfig());
  for (const row of claimed) {
    const contextStillValid = await revalidateTelegramEvidenceRetryContext(row);
    const result = contextStillValid && row.context_valid && row.actor_user_id !== null
      ? await processTelegramEvidenceAttachment({
          actorUserId: row.actor_user_id, requestId: crypto.randomUUID(), assignmentId: row.work_assignment_id,
          occurrenceId: row.requirement_occurrence_id, botId: row.bot_id, chatId: row.chat_id, messageId: row.provider_message_id,
          file: { kind: row.filename_snapshot === null && row.media_type_snapshot === "image/jpeg" ? "photo" : "document",
            fileId: row.provider_file_id, fileUniqueId: row.provider_file_unique_id, fileName: row.filename_snapshot,
            mimeType: row.media_type_snapshot, fileSize: row.byte_size === null ? null : Number(row.byte_size), width: null, height: null }, api, putObject,
        })
      : { kind: "failed" as const, code: "evidence_authorization_failed" };
    const albumClaim = row.telegram_media_group_id !== null
      && row.group_lease_token !== null && row.group_generation !== null && row.group_claimed_last_part_at !== null
      && row.group_lease_expires_at !== null
      ? {
          leaseToken: row.group_lease_token,
          leaseExpiresAt: row.group_lease_expires_at,
          generation: Number(row.group_generation),
          claimedLastPartAt: row.group_claimed_last_part_at,
        } satisfies AlbumClaim
      : null;
    const settled = await settleTelegramEvidenceAttachment({
      workspaceId: row.workspace_id, attachmentId: row.id, result,
      attachmentClaim: { token: row.retry_lease_token!, expiresAt: row.retry_lease_expires_at! },
      mediaGroupId: row.telegram_media_group_id, albumClaim,
    });
    if (!settled) continue;
    const binding: ChatBinding = {
      workspace_id: row.workspace_id, project_id: row.project_id,
      telegram_chat_binding_id: row.telegram_chat_binding_id, channel_state: "active",
    };
    if (row.telegram_media_group_id === null) {
      await reconcileTelegramEvidenceReceipt({
        binding, source: { kind: "attachment", id: row.id, generation: 0 },
      });
    } else if (albumClaim !== null) {
      await reconcileTelegramEvidenceReceipt({
        binding, source: { kind: "media_group", id: row.telegram_media_group_id, generation: albumClaim.generation },
        albumClaim,
      });
    }
  }
  return claimed.length;
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
    // Through the definer, not inline. project_field_channels carries only
    // member policies and pfc_update demands project.admin, so this UPDATE
    // resolved app.current_actor() to NULL, matched nothing, and returned the
    // disposition below — a channel that lost its bot was never marked
    // unhealthy, and the miss was indistinguishable from an archived channel.
    const channel = await tx.query<{ state: string | null }>(
      "select app.set_project_field_channel_health($1::uuid, $2::uuid, $3::boolean) as state",
      [binding.workspace_id, binding.project_id, removed]);
    // `select f()` always returns a row, so the absence is in the column.
    if (!channel.rows[0]?.state) return "ignored_archived_channel";
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
  if (update.kind === "callback_query") {
    return isTelegramDecisionCallback(update.data)
      ? processTelegramDecisionCallback(update)
      : processRequirementCallback(update);
  }
  if (update.kind === "message" && update.command !== null) return processStartCommand(update, context);

  const chatId = update.chatId;
  const binding = await resolveBoundChat(loadTelegramConfig().botId, chatId);
  if (binding === null) return "ignored_unknown_chat";
  if (binding.channel_state === "archived") return "ignored_archived_channel";
  if (update.kind === "message") {
    const stored = await storeMessage(binding, update, context);
    await prepareStoredEvidence(binding, update, stored);
    // Free text remains communication.  The only text that can decide is a
    // nonblank reply from the same linked actor to the exact delivered prompt.
    if (stored.messageId !== null) await processTelegramDecisionReturnReply({
      workspaceId: binding.workspace_id, telegramChatBindingId: binding.telegram_chat_binding_id,
      senderId: update.senderId, messageId: stored.messageId,
      replyToMessageId: update.replyToMessageId, text: update.text,
    });
    return stored.disposition;
  }
  if (update.kind === "edited_message") return appendEdit(binding, update);
  return processMembershipChange(binding, update);
}

function safeTelegramProcessingCode(error: unknown): string {
  if (error instanceof TelegramDecisionTransientError) return error.code;
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

async function retryTelegramDecisionInbox(item: ClaimedInboxUpdate, code: string): Promise<"retry_scheduled" | "failed"> {
  return withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) => {
    const result = await tx.query<{ outcome: "retry_scheduled" | "failed" }>(
      "select app.retry_telegram_decision_inbox($1::bigint,$2::bigint,$3::uuid,$4::text) as outcome",
      [item.bot_id, item.update_id, item.lease_id, code],
    );
    const outcome = result.rows[0]?.outcome;
    if (outcome !== "retry_scheduled" && outcome !== "failed") throw new Error("telegram_decision_retry_rejected");
    return outcome;
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
        if (error instanceof TelegramDecisionTransientError) {
          await retryTelegramDecisionInbox(item, safeTelegramProcessingCode(error));
        } else {
          await failTelegramInbox(item, safeTelegramProcessingCode(error));
        }
      } catch {
        // A lost/expired lease is already safe: its terminal receipt cannot be
        // changed by this worker, and no error details are exposed.
      }
    }
  }
  // A subsequent scheduled worker invocation is what supplies the quiet period;
  // processing a just-arrived part here cannot claim an incomplete album.
  await processDueTelegramMediaGroups().catch(() => undefined);
  await processDueTelegramEvidenceRetries().catch(() => undefined);
  return result;
}
