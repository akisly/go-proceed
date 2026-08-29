import { describe, expect, it, vi } from "vitest";
import {
  TELEGRAM_DOWNLOAD_LIMIT_BYTES,
  formatTelegramEvidenceSummary,
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
});

describe("Telegram evidence receipts", () => {
  it("names only durable evidence ids and each safe failure", () => {
    // Break caught: a summary could otherwise claim a save before finalization
    // or relay an unsafe/provider-derived error into the project group.
    expect(formatTelegramEvidenceSummary([
      { kind: "available", evidenceObjectId: "evidence-1", uploadIntentId: "intent-1" },
      { kind: "failed", code: "provider_download_failed<script>" },
    ])).toEqual("Збережено доказів: 1.\nЗбережено: evidence-1.\nНе збережено: provider_download_failed.");
  });

  it("keeps a large partial receipt within Telegram's text limit", () => {
    const summary = formatTelegramEvidenceSummary(Array.from({ length: 300 }, (_, index) => (
      { kind: "failed" as const, code: `provider_failure_${index}` }
    )));
    expect(summary.length).toBeLessThanOrEqual(4096);
    expect(summary).toContain("Не збережено");
  });
});
