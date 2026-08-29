import type { TelegramConfig } from "./config";
import type { TelegramApiFile, TelegramApiResponse } from "./types";

export const MAX_TELEGRAM_FILE_BYTES = 20 * 1024 * 1024;

export type TelegramApiErrorKind = "provider_error" | "provider_limit" | "delivery_unknown" | "network_error";

export class TelegramApiError extends Error {
  readonly kind: TelegramApiErrorKind;
  readonly code: string;
  readonly status: number | null;
  readonly retryable: boolean;
  readonly retryAfterMs: number | null;

  constructor(
    kind: TelegramApiErrorKind, code: string, status: number | null, retryable: boolean,
    message: string, retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "TelegramApiError";
    this.kind = kind;
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

export type SendTelegramMessageInput = {
  chatId: string;
  text: string;
  parseMode?: "HTML";
  replyToMessageId?: string | null;
  messageThreadId?: string | null;
};

export type TelegramFileInfo = {
  fileId: string;
  fileUniqueId: string | null;
  fileSize: number | null;
};

export type TelegramApiClient = {
  sendMessage(input: SendTelegramMessageInput): Promise<{ messageId: string }>;
  answerCallbackQuery(input: { callbackId: string; text?: string; showAlert?: boolean }): Promise<void>;
  setWebhook(input?: { url?: string; allowedUpdates?: string[] }): Promise<void>;
  getFile(fileId: string): Promise<TelegramFileInfo>;
  downloadFile(fileId: string): Promise<Uint8Array>;
};

type InternalFile = TelegramFileInfo & { filePath: string };
type TelegramFetcher = typeof fetch;

function providerRetryAfterMs(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 3_600
    ? value * 1_000
    : null;
}

function providerError(status: number | null, retryable: boolean, retryAfterMs: number | null = null): TelegramApiError {
  return new TelegramApiError("provider_error", "provider_rejected", status, retryable,
    "Telegram provider rejected the request.", retryAfterMs);
}

function networkError(forSend: boolean): TelegramApiError {
  return forSend
    ? new TelegramApiError("delivery_unknown", "network_outcome_unknown", null, false, "Telegram delivery outcome is unknown.")
    : new TelegramApiError("network_error", "network_error", null, true, "Telegram provider could not be reached.");
}

function validateDecimalId(value: unknown): string | null {
  return typeof value === "string" && /^-?\d+$/.test(value) ? value : null;
}

export function createTelegramApiClient(config: TelegramConfig, fetcher: TelegramFetcher = globalThis.fetch): TelegramApiClient {
  const apiUrl = (method: string) => `https://api.telegram.org/bot${config.botToken}/${method}`;

  async function post<T>(method: string, body: Record<string, unknown>, forSend = false): Promise<T> {
    let response: Response;
    try {
      response = await fetcher(apiUrl(method), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        // Delivery runs while its exact channel and outbox lease are fenced in
        // one transaction. Time out well before that renewed lease expires;
        // an abort remains delivery_unknown because Telegram may have accepted.
        signal: forSend ? AbortSignal.timeout(20_000) : null,
      });
    } catch {
      throw networkError(forSend);
    }
    let payload: TelegramApiResponse<T> | null = null;
    try { payload = await response.json() as TelegramApiResponse<T>; } catch {
      // A successful HTTP response whose body cannot be read or decoded may
      // still represent an accepted send. Never turn that outcome into a
      // retryable provider rejection that could duplicate the message.
      if (forSend && response.ok) throw networkError(true);
    }
    const providerStatus = typeof payload?.error_code === "number" ? payload.error_code : response.status;
    if (!response.ok || payload?.ok === false) {
      throw providerError(providerStatus, providerStatus === 429 || providerStatus >= 500,
        providerRetryAfterMs(payload?.parameters?.retry_after));
    }
    if (payload?.ok !== true || payload.result === undefined || payload.result === null) {
      if (forSend && response.ok) throw networkError(true);
      throw providerError(providerStatus, false);
    }
    return payload.result;
  }

  async function fetchFileMetadata(fileId: string): Promise<InternalFile> {
    const result = await post<TelegramApiFile>("getFile", { file_id: fileId });
    const path = typeof result.file_path === "string" ? result.file_path : null;
    if (path === null || typeof result.file_id !== "string") throw providerError(200, false);
    if (typeof result.file_size === "number" && Number.isFinite(result.file_size) && result.file_size > MAX_TELEGRAM_FILE_BYTES) {
      throw new TelegramApiError("provider_limit", "provider_file_too_large", null, false, "Telegram file exceeds the evidence size limit.");
    }
    const fileSize = typeof result.file_size === "number" && Number.isSafeInteger(result.file_size) ? result.file_size : null;
    return { fileId: result.file_id, fileUniqueId: typeof result.file_unique_id === "string" ? result.file_unique_id : null, fileSize, filePath: path };
  }

  return {
    async sendMessage(input) {
      const body: Record<string, unknown> = { chat_id: input.chatId, text: input.text };
      if (input.parseMode !== undefined) body.parse_mode = input.parseMode;
      if (input.replyToMessageId !== undefined && input.replyToMessageId !== null) body.reply_parameters = { message_id: input.replyToMessageId };
      if (input.messageThreadId !== undefined && input.messageThreadId !== null) body.message_thread_id = input.messageThreadId;
      const result = await post<{ message_id: string | number }>("sendMessage", body, true);
      if (typeof result !== "object" || result === null) throw networkError(true);
      const messageId = typeof result.message_id === "number"
        ? (Number.isSafeInteger(result.message_id) ? String(result.message_id) : null)
        : validateDecimalId(result.message_id);
      if (messageId === null) throw providerError(200, false);
      return { messageId };
    },
    async answerCallbackQuery(input) {
      const body: Record<string, unknown> = { callback_query_id: input.callbackId };
      if (input.text !== undefined) body.text = input.text;
      if (input.showAlert !== undefined) body.show_alert = input.showAlert;
      await post<true>("answerCallbackQuery", body);
    },
    async setWebhook(input = {}) {
      await post<true>("setWebhook", {
        url: input.url ?? `${config.appPublicOrigin}/integrations/telegram/webhook`,
        secret_token: config.webhookSecret,
        allowed_updates: input.allowedUpdates ?? ["message", "edited_message", "callback_query", "my_chat_member"],
      });
    },
    async getFile(fileId) {
      const result = await fetchFileMetadata(fileId);
      return { fileId: result.fileId, fileUniqueId: result.fileUniqueId, fileSize: result.fileSize };
    },
    async downloadFile(fileId) {
      const metadata = await fetchFileMetadata(fileId);
      let response: Response;
      try {
        response = await fetcher(`https://api.telegram.org/file/bot${config.botToken}/${metadata.filePath}`);
      } catch {
        throw networkError(false);
      }
      if (!response.ok) throw providerError(response.status, response.status === 429 || response.status >= 500);
      let bytes: Uint8Array;
      try { bytes = new Uint8Array(await response.arrayBuffer()); } catch { throw networkError(false); }
      if (bytes.byteLength > MAX_TELEGRAM_FILE_BYTES) {
        throw new TelegramApiError("provider_limit", "provider_file_too_large", null, false, "Telegram file exceeds the evidence size limit.");
      }
      return bytes;
    },
  };
}
