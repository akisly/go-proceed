import { describe, expect, it } from "vitest";
import { createTelegramApiClient, MAX_TELEGRAM_FILE_BYTES } from "./api";
import { fakeTelegramFetch, timeoutAfterAcceptingFetch } from "../../../tests/helpers/fake-telegram";
import type { TelegramConfig } from "./config";

const config: TelegramConfig = {
  botToken: "12345678901234567890-safe-test-token",
  botId: "123456789",
  botUsername: "goproceed_bot",
  webhookSecret: "w".repeat(32),
  workerSecret: "r".repeat(32),
  linkPepper: "p".repeat(32),
  appPublicOrigin: "https://app.example.test",
};

describe("TelegramApiClient", () => {
  it("returns provider message ids as decimal strings", async () => {
    const client = createTelegramApiClient(config, fakeTelegramFetch({ messageId: 81 }));
    await expect(client.sendMessage({ chatId: "-1001", text: "Тест" })).resolves.toEqual({ messageId: "81" });
  });

  it("classifies a timeout after dispatch as delivery_unknown", async () => {
    const client = createTelegramApiClient(config, timeoutAfterAcceptingFetch());
    await expect(client.sendMessage({ chatId: "-1001", text: "Тест" }))
      .rejects.toMatchObject({ kind: "delivery_unknown" });
  });

  it("classifies an unreadable 2xx send response as delivery_unknown", async () => {
    const malformedResponseFetch = (async () => new Response("not-json", { status: 200 })) as typeof fetch;
    const client = createTelegramApiClient(config, malformedResponseFetch);
    await expect(client.sendMessage({ chatId: "-1001", text: "Тест" }))
      .rejects.toMatchObject({ kind: "delivery_unknown", code: "network_outcome_unknown" });
  });

  it("refuses a getFile result above 20 MiB before downloading bytes", async () => {
    const fetcher = fakeTelegramFetch({ fileSize: MAX_TELEGRAM_FILE_BYTES + 1 });
    const client = createTelegramApiClient(config, fetcher);
    await expect(client.downloadFile("file-id"))
      .rejects.toMatchObject({ kind: "provider_limit" });
    expect(fetcher.calls.some((call) => call.url.includes("/file/bot"))).toBe(false);
  });

  it("refuses an unsafe finite oversized file declaration before downloading bytes", async () => {
    const fetcher = fakeTelegramFetch({ fileSize: Number.MAX_SAFE_INTEGER + 1 });
    const client = createTelegramApiClient(config, fetcher);
    await expect(client.downloadFile("file-id")).rejects.toMatchObject({ kind: "provider_limit" });
    expect(fetcher.calls.some((call) => call.url.includes("/file/bot"))).toBe(false);
  });

  it("rejects an unsafe numeric provider message id instead of rewriting it", async () => {
    const client = createTelegramApiClient(config, fakeTelegramFetch({ messageId: Number.MAX_SAFE_INTEGER + 1 }));
    await expect(client.sendMessage({ chatId: "-1001", text: "Тест" }))
      .rejects.toMatchObject({ kind: "provider_error" });
  });

  it("keeps definite provider failures distinct from delivery_unknown and safe", async () => {
    const fetcher = fakeTelegramFetch({ status: 429, description: "token=secret-token https://api.telegram.org" });
    const client = createTelegramApiClient(config, fetcher);
    const error = await client.sendMessage({ chatId: "-1001", text: "Тест" }).catch((value: unknown) => value);
    expect(error).toMatchObject({ kind: "provider_error", status: 429, retryable: true });
    expect(JSON.stringify(error)).not.toContain(config.botToken);
    expect(JSON.stringify(error)).not.toContain("api.telegram.org");
    expect(JSON.stringify(error)).not.toContain("secret-token");
  });
});
