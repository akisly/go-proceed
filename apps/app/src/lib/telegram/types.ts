/** Provider identifiers are kept as decimal strings at every application boundary. */
export type TelegramId = string;

export type TelegramChatType = "group" | "supergroup" | "private";

export type TelegramUser = { id: TelegramId; first_name?: string; last_name?: string; username?: string };
export type TelegramChat = { id: TelegramId; type: TelegramChatType; title?: string };
export type TelegramPhotoSize = {
  file_id: string;
  file_unique_id?: string;
  width: number;
  height: number;
  file_size?: number;
};
export type TelegramDocument = {
  file_id: string;
  file_unique_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};
export type TelegramMessage = {
  message_id: TelegramId;
  date: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  reply_to_message?: { message_id: TelegramId };
  media_group_id?: string;
};
export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: Pick<TelegramMessage, "message_id" | "chat">;
};
export type TelegramChatMemberUpdate = {
  chat: TelegramChat;
  new_chat_member: { status: string };
};
export type TelegramUpdate = {
  update_id: TelegramId;
  message?: TelegramMessage;
  edited_message?: TelegramMessage & { edit_date?: number };
  callback_query?: TelegramCallbackQuery;
  my_chat_member?: TelegramChatMemberUpdate;
};

export type TelegramFileCandidate = {
  kind: "photo" | "document";
  fileId: TelegramId;
  fileUniqueId: TelegramId | null;
  fileSize: number | null;
  fileName: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
};

/** A command is deliberately metadata-only: its one-time payload never enters normalized data. */
export type TelegramStartCommand = {
  kind: "start" | "startgroup";
  hasPayload: boolean;
};

export type NormalizedTelegramUpdate =
  | {
      kind: "message";
      updateId: TelegramId;
      chatId: TelegramId;
      chatType: TelegramChatType;
      messageId: TelegramId;
      senderId: TelegramId;
      sentAt: string;
      text: string | null;
      replyToMessageId: TelegramId | null;
      mediaGroupId: TelegramId | null;
      files: TelegramFileCandidate[];
      command: TelegramStartCommand | null;
    }
  | {
      kind: "edited_message";
      updateId: TelegramId;
      chatId: TelegramId;
      messageId: TelegramId;
      editedAt: string;
      text: string | null;
    }
  | {
      kind: "callback_query";
      updateId: TelegramId;
      callbackId: string;
      senderId: TelegramId;
      chatId: TelegramId | null;
      messageId: TelegramId | null;
      data: string | null;
    }
  | {
      kind: "my_chat_member";
      updateId: TelegramId;
      chatId: TelegramId;
      newStatus: string;
    }
  | {
      kind: "unsupported";
      updateId: TelegramId;
      reason: string;
    };

/** Narrow Bot API response types used by the client. */
export type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: unknown };
};

export type TelegramApiMessage = { message_id: string };

export type TelegramApiFile = {
  file_id: string;
  file_unique_id?: string;
  file_size?: number;
  file_path?: string;
};
