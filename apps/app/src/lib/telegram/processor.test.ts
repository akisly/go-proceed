import { describe, expect, it, vi } from "vitest";
import { processTelegramUpdate } from "./processor";

describe("processTelegramUpdate", () => {
  it("ignores unsupported updates without trying to resolve tenant scope", async () => {
    await expect(processTelegramUpdate({
      kind: "unsupported", updateId: "99", reason: "unsupported_update_type",
    })).resolves.toBe("ignored_unsupported_update");
  });

  it("rejects an invalid worker bearer before JSON parsing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t".repeat(32));
    vi.stubEnv("TELEGRAM_BOT_ID", "123456789");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "GoProceedTestBot");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "w".repeat(32));
    vi.stubEnv("TELEGRAM_WORKER_SECRET", "r".repeat(32));
    vi.stubEnv("TELEGRAM_LINK_PEPPER", "p".repeat(32));
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://app.goproceed.test");
    try {
      const { POST } = await import("../../../app/internal/telegram/jobs/route");
      const response = await POST(new Request("http://x/internal/telegram/jobs", {
        method: "POST", headers: { authorization: "Bearer wrong" }, body: "{",
      }));
      expect(response.status).toBe(401);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("returns a safe request code for malformed JSON after worker authentication", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t".repeat(32));
    vi.stubEnv("TELEGRAM_BOT_ID", "123456789");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "GoProceedTestBot");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "w".repeat(32));
    vi.stubEnv("TELEGRAM_WORKER_SECRET", "r".repeat(32));
    vi.stubEnv("TELEGRAM_LINK_PEPPER", "p".repeat(32));
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://app.goproceed.test");
    try {
      const { POST } = await import("../../../app/internal/telegram/jobs/route");
      const response = await POST(new Request("http://x/internal/telegram/jobs", {
        method: "POST", headers: { authorization: `Bearer ${"r".repeat(32)}` }, body: "{",
      }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: "invalid_worker_request" });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
