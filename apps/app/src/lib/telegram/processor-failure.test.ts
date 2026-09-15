import { describe, expect, it, vi } from "vitest";
import type { NormalizedTelegramUpdate } from "./types";

/**
 * The failure path of prepareStoredEvidence: storeMessage has committed the
 * attachments as `staged` with their provider handles, then preparation
 * throws. Before this test the handles stayed in the row forever (INV-094).
 * Everything below the processor is faked; the real SQL of
 * terminalizeStagedNonAlbumAttachments is what reaches the fake transaction.
 */
const fake = vi.hoisted(() => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  let failNext = false;
  const query = async (sql: string, params: unknown[] = []) => {
    if (failNext) { failNext = false; throw new Error("clearing failed"); }
    queries.push({ sql, params });
    return { rows: [{ id: "a-1" }] };
  };
  return { queries, query, setFailNext: (v: boolean) => { failNext = v; } };
});

vi.mock("@goproceed/database", () => ({
  withServiceTx: async (_ctx: unknown, fn: (tx: { query: typeof fake.query }) => Promise<unknown>) => fn({ query: fake.query }),
}));

vi.mock("./evidence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./evidence")>()),
  prepareTelegramEvidenceCandidate: vi.fn(async () => { throw new Error("boom"); }),
}));

import { prepareStoredEvidence } from "./processor";
import { TelegramDecisionTransientError } from "./decisions";
import { prepareTelegramEvidenceCandidate } from "./evidence";

function env(): void {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "t".repeat(32));
  vi.stubEnv("TELEGRAM_BOT_ID", "123456789");
  vi.stubEnv("TELEGRAM_BOT_USERNAME", "GoProceedTestBot");
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "w".repeat(32));
  vi.stubEnv("TELEGRAM_WORKER_SECRET", "r".repeat(32));
  vi.stubEnv("TELEGRAM_LINK_HMAC_KEYS", `k1:${Buffer.alloc(32, 1).toString("base64")}`);
  vi.stubEnv("TELEGRAM_LINK_ACTIVE_KEY_ID", "k1");
  vi.stubEnv("APP_PUBLIC_ORIGIN", "https://app.goproceed.test");
}

const binding = { workspace_id: "ws-a", project_id: "p-1", telegram_chat_binding_id: "b-1", channel_state: "active" };
const update = {
  kind: "message", updateId: "1", chatId: "-100998", messageId: "5", senderId: "7",
  replyToMessageId: null, mediaGroupId: null, text: null, files: [],
} as unknown as Extract<NormalizedTelegramUpdate, { kind: "message" }>;
const file = { kind: "photo", fileId: "f", fileUniqueId: "u", fileSize: 10, mimeType: "image/jpeg" } as unknown as
  Extract<NormalizedTelegramUpdate, { kind: "message" }>["files"][number];

describe("prepareStoredEvidence — the handles a failed message must not keep", () => {
  it("terminalizes the message's staged non-album attachments and rethrows the cause", async () => {
    env(); fake.queries.length = 0;
    await expect(prepareStoredEvidence(binding, update, { messageId: "m-1", attachments: [{ id: "a-1", file }] }))
      .rejects.toThrow("boom");
    const terminal = fake.queries.find((q) => q.sql.includes("update public.communication_attachments"));
    expect(terminal).toBeDefined();
    expect(terminal!.sql).toMatch(/set state='failed', failure_code=\$3/);
    expect(terminal!.sql).toMatch(/provider_file_id=null, provider_file_unique_id=null/);
    expect(terminal!.sql).toMatch(/where workspace_id=\$1 and message_id=\$2 and state='staged' and telegram_media_group_id is null/);
    expect(terminal!.params).toEqual(["ws-a", "m-1", "processing_aborted"]);
  });

  it("lets the original error win when the clearing itself fails", async () => {
    env(); fake.queries.length = 0; fake.setFailNext(true);
    await expect(prepareStoredEvidence(binding, update, { messageId: "m-1", attachments: [{ id: "a-1", file }] }))
      .rejects.toThrow("boom");
    expect(fake.queries).toEqual([]);
  });

  it("leaves staged attachments alone when the error is the transient kind the batch loop retries", async () => {
    env(); fake.queries.length = 0;
    vi.mocked(prepareTelegramEvidenceCandidate).mockRejectedValueOnce(new TelegramDecisionTransientError(new Error("provider busy")));
    await expect(prepareStoredEvidence(binding, update, { messageId: "m-1", attachments: [{ id: "a-1", file }] }))
      .rejects.toBeInstanceOf(TelegramDecisionTransientError);
    expect(fake.queries).toEqual([]);
  });

  it("touches nothing when the update stored no message", async () => {
    env(); fake.queries.length = 0;
    await expect(prepareStoredEvidence(binding, update, { messageId: null, attachments: [] })).resolves.toBeUndefined();
    expect(fake.queries).toEqual([]);
  });
});
