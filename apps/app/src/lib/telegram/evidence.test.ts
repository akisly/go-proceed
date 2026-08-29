import { describe, expect, it, vi } from "vitest";
import {
  TELEGRAM_DOWNLOAD_LIMIT_BYTES,
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
