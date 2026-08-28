import type {
  NormalizedTelegramUpdate,
  TelegramChatType,
  TelegramFileCandidate,
  TelegramStartCommand,
} from "./types";

export type { NormalizedTelegramUpdate, TelegramFileCandidate, TelegramStartCommand } from "./types";

type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord | null {
  return value !== null && typeof value === "object" ? value as AnyRecord : null;
}

function decimalId(value: unknown): string | null {
  if (typeof value === "string" && /^-?\d+$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  return null;
}

function opaqueFileId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function updateId(input: AnyRecord): string {
  const id = decimalId(input.update_id);
  return id !== null && /^\d+$/.test(id) ? id : "0";
}

function isoFromUnix(value: unknown): string {
  const seconds = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Date(seconds * 1000).toISOString();
}

function chatType(value: unknown): TelegramChatType | null {
  return value === "group" || value === "supergroup" || value === "private" ? value : null;
}

function textAndCommand(value: unknown): { text: string | null; command: TelegramStartCommand | null } {
  if (typeof value !== "string" || value.length === 0) return { text: null, command: null };
  // The first argument after /start is a one-time token. Remove it and the
  // command itself; only non-sensitive trailing prose is retained.
  const match = value.match(/^\/(startgroup|start)(?:@[A-Za-z0-9_]+)?(?:[ \t]+([^ \t\r\n]+))?(?:[ \t\r\n]+([\s\S]*))?$/);
  if (!match) return { text: value, command: null };
  const command: TelegramStartCommand = { kind: match[1] as "start" | "startgroup", hasPayload: Boolean(match[2]) };
  const remainder = match[3]?.trim() ?? "";
  return { text: remainder.length > 0 ? remainder : null, command };
}

function candidateFromPhoto(photo: AnyRecord): TelegramFileCandidate | null {
  const fileId = opaqueFileId(photo.file_id);
  if (fileId === null) return null;
  return {
    kind: "photo",
    fileId,
    fileUniqueId: opaqueFileId(photo.file_unique_id),
    fileSize: typeof photo.file_size === "number" && Number.isSafeInteger(photo.file_size) ? photo.file_size : null,
    fileName: null,
    mimeType: "image/jpeg",
    width: typeof photo.width === "number" ? photo.width : null,
    height: typeof photo.height === "number" ? photo.height : null,
  };
}

function filesFromMessage(message: AnyRecord): TelegramFileCandidate[] {
  const photos = Array.isArray(message.photo)
    ? message.photo.map(record).filter((item): item is AnyRecord => item !== null)
      .map(candidateFromPhoto).filter((item): item is TelegramFileCandidate => item !== null)
    : [];
  const largestPhoto = photos.sort((a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0) || (b.width ?? 0) - (a.width ?? 0))[0];
  const candidates: TelegramFileCandidate[] = largestPhoto ? [largestPhoto] : [];

  const document = record(message.document);
  if (document) {
    const fileId = opaqueFileId(document.file_id);
    if (fileId !== null) candidates.push({
      kind: "document",
      fileId,
      fileUniqueId: opaqueFileId(document.file_unique_id),
      fileSize: typeof document.file_size === "number" && Number.isSafeInteger(document.file_size) ? document.file_size : null,
      fileName: typeof document.file_name === "string" ? document.file_name : null,
      mimeType: typeof document.mime_type === "string" ? document.mime_type : null,
      width: null,
      height: null,
    });
  }
  return candidates;
}

function unsupported(id: string, reason: string): NormalizedTelegramUpdate {
  return { kind: "unsupported", updateId: id, reason };
}

export function normalizeTelegramUpdate(input: unknown): NormalizedTelegramUpdate {
  const root = record(input);
  if (!root) return unsupported("0", "invalid_update");
  const id = updateId(root);

  const message = record(root.message);
  if (message) {
    const chat = record(message.chat);
    const sender = record(message.from);
    const type = chatType(chat?.type);
    const chatId = decimalId(chat?.id);
    const messageId = decimalId(message.message_id);
    const senderId = decimalId(sender?.id);
    if (!chat || type === null || chatId === null || messageId === null || senderId === null) {
      return unsupported(id, "invalid_message");
    }
    const body = textAndCommand(typeof message.text === "string" ? message.text : message.caption);
    return {
      kind: "message",
      updateId: id,
      chatId,
      chatType: type,
      messageId,
      senderId,
      sentAt: isoFromUnix(message.date),
      text: body.text,
      replyToMessageId: decimalId(record(message.reply_to_message)?.message_id),
      // media_group_id is an opaque Telegram string, unlike chat/message/user
      // identifiers which are decimal integers.
      mediaGroupId: opaqueFileId(message.media_group_id),
      files: filesFromMessage(message),
      command: body.command,
    };
  }

  const edited = record(root.edited_message);
  if (edited) {
    const chat = record(edited.chat);
    const type = chatType(chat?.type);
    const chatId = decimalId(chat?.id);
    const messageId = decimalId(edited.message_id);
    if (!chat || type === null || chatId === null || messageId === null) return unsupported(id, "invalid_edited_message");
    return {
      kind: "edited_message",
      updateId: id,
      chatId,
      messageId,
      editedAt: isoFromUnix(edited.edit_date ?? edited.date),
      text: textAndCommand(typeof edited.text === "string" ? edited.text : edited.caption).text,
    };
  }

  const callback = record(root.callback_query);
  if (callback) {
    const senderId = decimalId(record(callback.from)?.id);
    const callbackId = typeof callback.id === "string" ? callback.id : null;
    if (senderId === null || callbackId === null) return unsupported(id, "invalid_callback_query");
    const messageInCallback = record(callback.message);
    const chat = record(messageInCallback?.chat);
    return {
      kind: "callback_query",
      updateId: id,
      callbackId,
      senderId,
      chatId: decimalId(chat?.id),
      messageId: decimalId(messageInCallback?.message_id),
      data: typeof callback.data === "string" ? callback.data : null,
    };
  }

  const membership = record(root.my_chat_member);
  if (membership) {
    const chat = record(membership.chat);
    const chatId = decimalId(chat?.id);
    const type = chatType(chat?.type);
    const status = record(membership.new_chat_member)?.status;
    if (chatId === null || type === null || typeof status !== "string") return unsupported(id, "invalid_chat_membership");
    return { kind: "my_chat_member", updateId: id, chatId, newStatus: status };
  }

  return unsupported(id, "unsupported_update_type");
}
