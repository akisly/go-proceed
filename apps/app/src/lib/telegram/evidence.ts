import { createHash, randomBytes } from "node:crypto";
import type { CreateUploadIntentRequest } from "@goproceed/contracts";
import { withServiceTx } from "@goproceed/database";
import { authorizeUploadIntent } from "../evidence/authorize-upload-intent";
import { finalizeUploadIntent } from "../evidence/finalize-upload-intent";
import { HttpProblem } from "../http";
import { allowedMediaOf } from "../requirement-content";
import { MAX_TELEGRAM_FILE_BYTES, TelegramApiError, type TelegramApiClient } from "./api";
import type { TelegramFileCandidate } from "./types";

/** Telegram's provider and evidence-worker ceiling; never fetch above it. */
export const TELEGRAM_DOWNLOAD_LIMIT_BYTES = 20 * 1024 * 1024;
export const TELEGRAM_REQUIREMENT_CHOICE_TTL_MS = 24 * 60 * 60 * 1_000;

const SUPPORTED_DOCUMENT_MEDIA = new Set(["image/jpeg", "image/png", "image/heic"]);

export type TelegramEvidenceCandidate = Pick<TelegramFileCandidate, "kind" | "mimeType" | "fileSize"> | {
  kind: string;
  mimeType: string | null;
  fileSize: number | null;
};

/**
 * A provider message is not a download authorization. This inexpensive guard
 * is intentionally usable before any provider file request is made.
 */
export function isTelegramEvidenceCandidate(file: TelegramEvidenceCandidate): boolean {
  if (file.fileSize !== null && (!Number.isSafeInteger(file.fileSize) || file.fileSize < 0
    || file.fileSize > TELEGRAM_DOWNLOAD_LIMIT_BYTES)) return false;
  return file.kind === "photo" || (file.kind === "document" && file.mimeType !== null
    && SUPPORTED_DOCUMENT_MEDIA.has(file.mimeType.toLowerCase()));
}

/** A stable, non-secret deployment label retained with the upload intent. */
export function telegramSourceVersion(): string {
  return `telegram-bot/${process.env.APP_VERSION?.trim() || "dev"}`;
}

export function telegramEvidenceIdempotencyKey(input: {
  botId: string;
  chatId: string;
  messageId: string;
  fileUniqueId: string | null;
  occurrenceId: string;
}): string {
  return createHash("sha256").update([
    "telegram", input.botId, input.chatId, input.messageId,
    input.fileUniqueId ?? "", input.occurrenceId,
  ].join(":"), "utf8").digest("hex");
}

function providerDeviceCaptureId(input: { botId: string; chatId: string; messageId: string; fileUniqueId: string | null }): string {
  return createHash("sha256").update([
    "telegram-device", input.botId, input.chatId, input.messageId, input.fileUniqueId ?? "",
  ].join(":"), "utf8").digest("hex");
}

export type TelegramEvidenceProcessInput = {
  actorUserId: string;
  requestId: string;
  assignmentId: string;
  occurrenceId: string;
  botId: string;
  chatId: string;
  messageId: string;
  file: TelegramFileCandidate;
  api: TelegramApiClient;
  putObject: (key: string, bytes: Uint8Array, mediaType: string) => Promise<void>;
};

export type TelegramEvidenceProcessResult =
  | { kind: "available"; evidenceObjectId: string; uploadIntentId: string }
  | { kind: "failed"; code: string };

/**
 * Consume one already-authorized attachment. Callers must have resolved the
 * exact live card and chosen occurrence before this method: unbound media
 * never reaches the provider download call.
 */
export async function processTelegramEvidenceAttachment(input: TelegramEvidenceProcessInput): Promise<TelegramEvidenceProcessResult> {
  if (!isTelegramEvidenceCandidate(input.file)) return { kind: "failed", code: "unsupported_media" };
  if (input.file.fileId.length === 0) return { kind: "failed", code: "provider_file_unavailable" };

  let bytes: Uint8Array;
  try {
    bytes = await input.api.downloadFile(input.file.fileId);
  } catch (error) {
    if (error instanceof TelegramApiError && error.kind === "provider_limit") {
      return { kind: "failed", code: "provider_file_too_large" };
    }
    return { kind: "failed", code: "provider_download_failed" };
  }
  if (bytes.byteLength > TELEGRAM_DOWNLOAD_LIMIT_BYTES) return { kind: "failed", code: "provider_file_too_large" };

  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const mimeType = input.file.kind === "photo" ? "image/jpeg" : input.file.mimeType!;
  const idempotencyKey = telegramEvidenceIdempotencyKey({
    botId: input.botId, chatId: input.chatId, messageId: input.messageId,
    fileUniqueId: input.file.fileUniqueId, occurrenceId: input.occurrenceId,
  });
  const body: CreateUploadIntentRequest = {
    deviceCaptureId: providerDeviceCaptureId({
      botId: input.botId, chatId: input.chatId, messageId: input.messageId,
      fileUniqueId: input.file.fileUniqueId,
    }),
    originMethod: "origin_not_distinguished",
    ...(input.file.fileName === null ? {} : { originalFilename: input.file.fileName }),
    sourceAppVersion: telegramSourceVersion(),
    expectedByteSize: bytes.byteLength,
    expectedContentHash: contentHash,
    claimedMediaType: mimeType,
    requirementOccurrenceId: input.occurrenceId,
  };
  try {
    const authorized = await authorizeUploadIntent({
      actorUserId: input.actorUserId,
      requestId: input.requestId,
      assignmentId: input.assignmentId,
      body,
      idempotencyKey,
      requestHash: createHash("sha256").update(JSON.stringify(body)).digest("hex"),
    });
    const receipt = authorized.body as { uploadIntentId: string; storage: { key: string } };
    await input.putObject(receipt.storage.key, bytes, mimeType);
    const finalized = await finalizeUploadIntent({
      actorUserId: input.actorUserId, requestId: input.requestId, intentId: receipt.uploadIntentId,
    });
    const finalBody = finalized.body as { status: string; evidenceObjectId: string | null };
    if (finalBody.status !== "available" || finalBody.evidenceObjectId === null) return { kind: "failed", code: "finalization_incomplete" };
    return { kind: "available", evidenceObjectId: finalBody.evidenceObjectId, uploadIntentId: receipt.uploadIntentId };
  } catch (error) {
    if (error instanceof HttpProblem) return { kind: "failed", code: error.body.code.toLowerCase() };
    return { kind: "failed", code: "evidence_processing_failed" };
  }
}

/** Opaque callback values are server-generated; provider data never carries ids. */
export function issueTelegramRequirementChoiceToken(): string {
  return randomBytes(32).toString("base64url");
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

type TelegramTx = { query: <T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string, params?: unknown[],
) => Promise<{ rows: T[] }> };

type PreparedOccurrence = { occurrenceId: string; allowedMedia: unknown; label: string };
type CandidatePreparation =
  | { kind: "not_evidence"; code: string }
  | { kind: "ready"; assignmentId: string; occurrenceId: string; actorUserId: string }
  | { kind: "awaiting_requirement_choice"; assignmentId: string; tokens: Array<{ occurrenceId: string; label: string; token: string }> };

async function terminalAttachment(tx: TelegramTx, input: {
  attachmentId: string; state: "unbound" | "not_evidence" | "failed"; code: string;
}): Promise<void> {
  await tx.query(`update public.communication_attachments
    set state=$2, failure_code=case when $2='failed' then $3 else null end,
        terminal_at=now(), provider_file_id=null, provider_file_unique_id=null
    where id=$1 and state in ('staged','awaiting_requirement_choice','processing')`,
  [input.attachmentId, input.state, input.code]);
}

function supportsOccurrence(occurrence: PreparedOccurrence, file: TelegramFileCandidate): boolean {
  const policy = allowedMediaOf(occurrence.allowedMedia);
  const mediaType = file.kind === "photo" ? "image/jpeg" : file.mimeType;
  return policy !== null && mediaType !== null && policy.mimeTypes.includes(mediaType)
    && (file.fileSize === null || file.fileSize <= policy.maxByteSize);
}

/**
 * Resolves the evidence context before a provider download. The sole reply
 * anchor is the exact provider id of an accepted assignment-card message in
 * the same locked binding; all other media is terminal communication only.
 */
export async function prepareTelegramEvidenceCandidate(input: {
  workspaceId: string;
  projectId: string;
  telegramChatBindingId: string;
  messageId: string;
  attachmentId: string;
  senderId: string;
  replyToProviderMessageId: string | null;
  mediaGroupId: string | null;
  telegramMediaGroupId?: string | null;
  allowMediaGroup?: boolean;
  file: TelegramFileCandidate;
}): Promise<CandidatePreparation> {
  return withServiceTx({ actorUserId: "", organizationId: input.workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
    if (!isTelegramEvidenceCandidate(input.file)) {
      await terminalAttachment(tx, { attachmentId: input.attachmentId, state: "not_evidence", code: "unsupported_media" });
      return { kind: "not_evidence", code: "unsupported_media" };
    }
    const member = await tx.query<{ member_id: string; user_id: string }>(`select l.member_id, m.user_id
      from public.telegram_member_links l
      join public.memberships m on m.organization_id=l.workspace_id and m.id=l.member_id
      where l.workspace_id=$1 and l.telegram_user_id=$2::bigint
        and l.revoked_at is null and m.status='active'`, [input.workspaceId, input.senderId]);
    const actor = member.rows[0];
    if (!actor || input.replyToProviderMessageId === null) {
      await terminalAttachment(tx, { attachmentId: input.attachmentId, state: "unbound", code: "unbound_card_reply" });
      return { kind: "not_evidence", code: "unbound_card_reply" };
    }
    const card = await tx.query<{ assignment_id: string }>(`select work_assignment_id as assignment_id
      from public.communication_messages
      where workspace_id=$1 and project_id=$2 and telegram_chat_binding_id=$3
        and provider_message_id=$4::bigint and kind='assignment_card'
        and delivery_state='provider_accepted' and work_assignment_id is not null`, [
      input.workspaceId, input.projectId, input.telegramChatBindingId, input.replyToProviderMessageId,
    ]);
    const assignmentId = card.rows[0]?.assignment_id;
    if (!assignmentId) {
      await terminalAttachment(tx, { attachmentId: input.attachmentId, state: "unbound", code: "unbound_card_reply" });
      return { kind: "not_evidence", code: "unbound_card_reply" };
    }
    const occurrences = await tx.query<PreparedOccurrence>(`select o.id as "occurrenceId", rv.allowed_media as "allowedMedia",
        left(o.acceptance_criterion, 120) as label
      from public.requirement_occurrences o
      join public.requirement_rule_versions rv on rv.workspace_id=o.workspace_id and rv.id=o.rule_version_id
      where o.workspace_id=$1 and o.project_id=$2 and o.work_assignment_id=$3
        and o.evidence_kind in ('photo','document')
      order by o.ordinal, o.id`, [input.workspaceId, input.projectId, assignmentId]);
    const supported = occurrences.rows.filter((occurrence) => supportsOccurrence(occurrence, input.file));
    if (supported.length === 0) {
      await terminalAttachment(tx, { attachmentId: input.attachmentId, state: "not_evidence", code: "requirement_policy_mismatch" });
      return { kind: "not_evidence", code: "requirement_policy_mismatch" };
    }
    if (input.mediaGroupId !== null && input.allowMediaGroup !== true) return { kind: "not_evidence", code: "album_pending" };
    if (supported.length === 1) {
      await tx.query(`update public.communication_attachments set state='processing', requirement_occurrence_id=$2
        where ${input.telegramMediaGroupId === null || input.telegramMediaGroupId === undefined
          ? "id=$1" : "telegram_media_group_id=$1 and media_type_snapshot in ('image/jpeg','image/png','image/heic')"} and state='staged'`, [
        input.telegramMediaGroupId ?? input.attachmentId, supported[0]!.occurrenceId,
      ]);
      return { kind: "ready", assignmentId, occurrenceId: supported[0]!.occurrenceId, actorUserId: actor.user_id };
    }
    const tokens: Array<{ occurrenceId: string; label: string; token: string }> = [];
    const allowedOccurrenceIds = supported.map(({ occurrenceId }) => occurrenceId);
    for (const occurrence of supported) {
      const token = issueTelegramRequirementChoiceToken();
      await tx.query(`insert into public.telegram_requirement_choice_sessions
        (workspace_id, project_id, telegram_chat_binding_id, uploader_member_id, work_assignment_id,
         communication_attachment_id, telegram_media_group_id, token_hash, candidate_occurrence_id, allowed_occurrence_ids, expires_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now() + interval '24 hours')`, [
        input.workspaceId, input.projectId, input.telegramChatBindingId, actor.member_id, assignmentId,
        input.telegramMediaGroupId === null || input.telegramMediaGroupId === undefined ? input.attachmentId : null,
        input.telegramMediaGroupId ?? null, tokenHash(token), occurrence.occurrenceId, allowedOccurrenceIds,
      ]);
      tokens.push({ occurrenceId: occurrence.occurrenceId, label: occurrence.label, token });
    }
    await tx.query(`update public.communication_attachments set state='awaiting_requirement_choice'
      where ${input.telegramMediaGroupId === null || input.telegramMediaGroupId === undefined
        ? "id=$1" : "telegram_media_group_id=$1 and media_type_snapshot in ('image/jpeg','image/png','image/heic')"} and state='staged'`, [input.telegramMediaGroupId ?? input.attachmentId]);
    if (input.telegramMediaGroupId !== null && input.telegramMediaGroupId !== undefined) {
      await tx.query(`update public.telegram_media_groups
        set state='awaiting_requirement_choice', choice_expires_at=now() + interval '24 hours'
        where id=$1 and state='processing'`, [input.telegramMediaGroupId]);
    }
    return { kind: "awaiting_requirement_choice", assignmentId, tokens };
  });
}

/** Validate and consume one opaque `req:<token>` callback without trusting ids in Telegram data. */
export async function selectTelegramOccurrence(input: {
  botId: string;
  chatId: string;
  uploaderTelegramUserId: string;
  token: string;
}): Promise<{ kind: "selected"; assignmentId: string; occurrenceId: string; actorUserId: string; attachmentIds: string[] } | { kind: "rejected" }> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.token)) return { kind: "rejected" };
  return withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) => {
    const selected = await tx.query<{
      id: string; workspace_id: string; project_id: string; telegram_chat_binding_id: string; uploader_member_id: string;
      work_assignment_id: string; candidate_occurrence_id: string; allowed_occurrence_ids: string[];
      communication_attachment_id: string | null; telegram_media_group_id: string | null; user_id: string;
    }>(`select s.*, m.user_id
      from public.telegram_requirement_choice_sessions s
      join public.telegram_chat_bindings b on b.workspace_id=s.workspace_id and b.project_id=s.project_id and b.id=s.telegram_chat_binding_id
      join public.memberships m on m.organization_id=s.workspace_id and m.id=s.uploader_member_id
      join public.telegram_member_links l on l.workspace_id=s.workspace_id and l.member_id=s.uploader_member_id
      where s.token_hash=$1 and s.consumed_at is null and s.expires_at > now()
        and b.bot_id=$2::bigint and b.chat_id=$3::bigint and l.telegram_user_id=$4::bigint
        and l.revoked_at is null and m.status='active'
      for update`, [tokenHash(input.token), input.botId, input.chatId, input.uploaderTelegramUserId]);
    const row = selected.rows[0];
    if (!row || !row.allowed_occurrence_ids.includes(row.candidate_occurrence_id)) return { kind: "rejected" };
    const siblings = await tx.query<{ id: string }>(`select id from public.telegram_requirement_choice_sessions
      where workspace_id=$1 and project_id=$2 and consumed_at is null
        and ((communication_attachment_id is not null and communication_attachment_id=$3)
          or (telegram_media_group_id is not null and telegram_media_group_id=$4)) for update`, [
      row.workspace_id, row.project_id, row.communication_attachment_id, row.telegram_media_group_id,
    ]);
    if (siblings.rows.length === 0) return { kind: "rejected" };
    const attachments = row.telegram_media_group_id === null
      ? row.communication_attachment_id === null ? [] : [row.communication_attachment_id]
      : (await tx.query<{ id: string }>(`select id from public.communication_attachments
          where workspace_id=$1 and project_id=$2 and telegram_media_group_id=$3
            and state='awaiting_requirement_choice'`, [row.workspace_id, row.project_id, row.telegram_media_group_id])).rows.map(({ id }) => id);
    if (attachments.length === 0) return { kind: "rejected" };
    await tx.query(`update public.telegram_requirement_choice_sessions
      set consumed_at=now(), chosen_occurrence_id=$2 where id = any($1::uuid[])`, [
      siblings.rows.map(({ id }) => id), row.candidate_occurrence_id,
    ]);
    for (const attachmentId of attachments) {
      await tx.query(`insert into public.telegram_requirement_choices
        (workspace_id, project_id, communication_attachment_id, telegram_media_group_id,
         chooser_member_id, requirement_occurrence_id)
        values ($1,$2,$3,$4,$5,$6)
        on conflict (workspace_id, communication_attachment_id) do nothing`, [
        row.workspace_id, row.project_id, attachmentId, row.telegram_media_group_id,
        row.uploader_member_id, row.candidate_occurrence_id,
      ]);
    }
    await tx.query(`update public.communication_attachments set state='processing', requirement_occurrence_id=$2
      where id = any($1::uuid[]) and state='awaiting_requirement_choice'`, [attachments, row.candidate_occurrence_id]);
    if (row.telegram_media_group_id !== null) {
      await tx.query("update public.telegram_media_groups set state='processing' where id=$1 and state='awaiting_requirement_choice'", [row.telegram_media_group_id]);
    }
    return { kind: "selected", assignmentId: row.work_assignment_id, occurrenceId: row.candidate_occurrence_id,
      actorUserId: row.user_id, attachmentIds: attachments };
  });
}

export { MAX_TELEGRAM_FILE_BYTES };
