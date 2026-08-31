import { describe, expect, it, vi } from "vitest";
import { processTelegramUpdate, telegramEvidenceTerminalCopyKey } from "./processor";
import { runTelegramJobs } from "../../../app/internal/telegram/jobs/route";

describe("processTelegramUpdate", () => {
  it("uses unbound copy only for a false or missing card anchor", () => {
    expect(telegramEvidenceTerminalCopyKey([{ kind: "failed", code: "unbound_card_reply" }]))
      .toBe("telegram.evidence.unbound");
    for (const code of ["unsupported_media", "requirement_policy_mismatch", "upload_size_limit",
      "membership_inactive", "provider_download_failed", "provider_download_retryable"]) {
      expect(telegramEvidenceTerminalCopyKey([{ kind: "failed", code }])).toBe("telegram.evidence.failed");
    }
  });

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

  it("continues outbound work when the inbox batch fails", async () => {
    // Break caught: an inbox exception used to return before the leased
    // outbound queue was attempted, indefinitely delaying assignment cards.
    let outboxCalled = false;
    const result = await runTelegramJobs({
      processInbox: async () => { throw new Error("inbox unavailable"); },
      processOutbox: async () => {
        outboxCalled = true;
        return { accepted: 1, failed: 0, unknown: 0 };
      },
      processDecisionMaintenance: async () => ({
        controls: { scanned: 2, issued: 1, skipped: 0, failed: 1 },
        attempts: { claimed: 1, completed: 1, permanentFailed: 0, retried: 0, failed: 0 },
      }),
    });

    expect(outboxCalled).toBe(true);
    expect(result).toEqual({
      inbox: null, outbox: { accepted: 1, failed: 0, unknown: 0 }, inboxFailed: true, outboxFailed: false,
      decisionMaintenance: {
        controls: { scanned: 2, issued: 1, skipped: 0, failed: 1 },
        attempts: { claimed: 1, completed: 1, permanentFailed: 0, retried: 0, failed: 0 },
      }, decisionMaintenanceFailed: false,
    });
  });

  it("reports decision maintenance failure without hiding successful inbox and outbox work", async () => {
    const result = await runTelegramJobs({
      processInbox: async () => ({ claimed: 0, processed: 0, failed: 0 }),
      processOutbox: async () => ({ accepted: 0, failed: 0, unknown: 0 }),
      processDecisionMaintenance: async () => { throw new Error("decision maintenance unavailable"); },
    });
    expect(result.decisionMaintenance).toBeNull();
    expect(result.decisionMaintenanceFailed).toBe(true);
    expect(result.inboxFailed).toBe(false);
    expect(result.outboxFailed).toBe(false);
  });
});
