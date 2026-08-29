import { describe, expect, it } from "vitest";
import { TelegramApiError, type TelegramApiClient } from "./api";
import { classifyTelegramSend } from "./delivery";

const sendInput = { chatId: "-10042", text: "Тест" };

describe("Telegram delivery classification", () => {
  it("uses the accepted provider message id as the delivery anchor", async () => {
    // Break caught: treating a successful HTTP request without its message id
    // as an accepted card would leave replies without a trustworthy anchor.
    const api: TelegramApiClient = {
      sendMessage: async () => ({ messageId: "81" }),
      answerCallbackQuery: async () => undefined,
      setWebhook: async () => undefined,
      getFile: async () => ({ fileId: "file", fileUniqueId: null, fileSize: null }),
      downloadFile: async () => new Uint8Array(),
    };

    await expect(classifyTelegramSend(api, sendInput))
      .resolves.toEqual({ kind: "provider_accepted", providerMessageId: "81" });
  });

  it("records an uncertain send without selecting an automatic retry", async () => {
    // Break caught: retrying after a timed-out request can duplicate a card
    // that Telegram already accepted.
    const api: TelegramApiClient = {
      sendMessage: async () => {
        throw new TelegramApiError("delivery_unknown", "network_outcome_unknown", null, false, "unknown");
      },
      answerCallbackQuery: async () => undefined,
      setWebhook: async () => undefined,
      getFile: async () => ({ fileId: "file", fileUniqueId: null, fileSize: null }),
      downloadFile: async () => new Uint8Array(),
    };

    await expect(classifyTelegramSend(api, sendInput))
      .resolves.toEqual({ kind: "delivery_unknown", code: "network_outcome_unknown" });
  });

  it("keeps a definite retryable rejection on the bounded fail path", async () => {
    // Break caught: treating a 429/5xx rejection as unknown would stop the
    // established bounded backoff even though Telegram definitely refused it.
    const api: TelegramApiClient = {
      sendMessage: async () => {
        throw new TelegramApiError("provider_error", "provider_rejected", 429, true, "retry");
      },
      answerCallbackQuery: async () => undefined,
      setWebhook: async () => undefined,
      getFile: async () => ({ fileId: "file", fileUniqueId: null, fileSize: null }),
      downloadFile: async () => new Uint8Array(),
    };

    await expect(classifyTelegramSend(api, sendInput))
      .resolves.toEqual({ kind: "retryable_rejection", retryAfterMs: 0 });
  });
});
