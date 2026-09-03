import { describe, expect, it, vi } from "vitest";
import {
  TELEGRAM_DOWNLOAD_LIMIT_BYTES,
  formatTelegramEvidenceSummary,
  formatTelegramEvidenceSummaryChunks,
  telegramEvidenceReceiptKey,
  telegramEvidenceIdempotencyKey,
  isTelegramEvidenceCandidate,
  telegramSourceVersion,
} from "./evidence";

describe("Telegram evidence candidates", () => {
  it.each([
    [{ kind: "photo", mimeType: "image/jpeg", fileSize: 1_000 }, true],
    [{ kind: "document", mimeType: "image/png", fileSize: 1_000 }, true],
    [{ kind: "document", mimeType: "image/heic", fileSize: 1_000 }, true],
    [{ kind: "document", mimeType: "application/pdf", fileSize: 1_000 }, false],
    [{ kind: "video", mimeType: "video/mp4", fileSize: 1_000 }, false],
    [{ kind: "document", mimeType: "image/jpeg", fileSize: TELEGRAM_DOWNLOAD_LIMIT_BYTES + 1 }, false],
  ] as const)("classifies %j without downloading it", (file, accepted) => {
    // Break caught: accepting a non-image or oversized provider file would
    // permit the worker to download data that can never become evidence.
    expect(isTelegramEvidenceCandidate(file)).toBe(accepted);
  });

  it("identifies the configured deployment without exposing a secret", () => {
    // Break caught: a non-deterministic source version would make retries
    // materially different evidence captures for the same Telegram message.
    vi.stubEnv("APP_VERSION", " 2026.08.29 ");
    expect(telegramSourceVersion()).toBe("telegram-bot/2026.08.29");
    vi.unstubAllEnvs();
  });

  it("keeps distinct null-unique provider files from sharing an evidence intent", () => {
    const base = { botId: "1", chatId: "2", messageId: "3", fileUniqueId: null, occurrenceId: "occurrence" };
    expect(telegramEvidenceIdempotencyKey({ ...base, fileId: "file-a" }))
      .not.toBe(telegramEvidenceIdempotencyKey({ ...base, fileId: "file-b" }));
  });
});

describe("Telegram evidence receipts", () => {
  it("derives one stable chunk identity from the canonical copy and durable source", () => {
    // Break caught: a replay or cleanup pass could otherwise enqueue the same
    // terminal chunk under a fresh random communication-message identity.
    expect(telegramEvidenceReceiptKey({
      copyKey: "telegram.evidence.partial",
      sourceKind: "media_group",
      sourceId: "5fddccaa-17ea-43f3-9d13-bafc77676ccb",
      generation: 7,
      chunkIndex: 2,
    })).toBe("telegram.evidence.partial:media_group:5fddccaa-17ea-43f3-9d13-bafc77676ccb:7:2");
  });

  it("names only durable evidence ids and each safe failure", () => {
    // Break caught: a summary could otherwise claim a save before finalization
    // or relay an unsafe/provider-derived error into the project group.
    expect(formatTelegramEvidenceSummary([
      { kind: "available", evidenceObjectId: "evidence-1", uploadIntentId: "intent-1" },
      { kind: "failed", code: "provider_download_failed<script>" },
    ])).toEqual("Частину зображень збережено; для кожного збою вказано окрему причину.\nЗбережено: evidence-1.\nНе збережено: provider_download_failed.");
  });

  it("chunks a large partial receipt without dropping any exact safe failure", () => {
    const results = Array.from({ length: 300 }, (_, index) => (
      { kind: "failed" as const, code: `provider_failure_${index}`, imageReference: String(700 + index) }
    ));
    const chunks = formatTelegramEvidenceSummaryChunks(results);
    expect(chunks.every((chunk) => chunk.length <= 4096)).toBe(true);
    expect(chunks.join("\n")).toContain("Зображення 999: не збережено — provider_failure_299.");
    expect(chunks.join("\n").match(/не збережено —/g)).toHaveLength(300);
  });
});
