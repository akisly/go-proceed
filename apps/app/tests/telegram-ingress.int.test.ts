import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";

const databaseDescribe = process.env.APP_DB_URL && process.env.SERVICE_DB_URL ? describe : describe.skip;
const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const updateId = "987654321";
const botId = "123456789";

async function countInbox(): Promise<number> {
  const client = new Client({ connectionString: admin });
  await client.connect();
  try {
    const result = await client.query<{ count: string }>(
      "select count(*)::text as count from public.telegram_inbox_updates where bot_id=$1 and update_id=$2",
      [botId, updateId],
    );
    return Number(result.rows[0]!.count);
  } finally {
    await client.end();
  }
}

async function deleteInbox(): Promise<void> {
  const client = new Client({ connectionString: admin });
  await client.connect();
  try {
    await client.query("delete from public.telegram_inbox_updates where bot_id=$1 and update_id=$2", [botId, updateId]);
  } finally {
    await client.end();
  }
}

function request(): Request {
  return new Request("http://x/integrations/telegram/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "w".repeat(32) },
    body: JSON.stringify({ update_id: Number(updateId), message: { text: "webhook test" } }),
  });
}

databaseDescribe("Telegram webhook durable ingress", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t".repeat(32));
    vi.stubEnv("TELEGRAM_BOT_ID", botId);
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "GoProceedTestBot");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "w".repeat(32));
    vi.stubEnv("TELEGRAM_WORKER_SECRET", "r".repeat(32));
    vi.stubEnv("TELEGRAM_LINK_HMAC_KEYS", `k1:${Buffer.alloc(32, 1).toString("base64")}`);
    vi.stubEnv("TELEGRAM_LINK_ACTIVE_KEY_ID", "k1");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://app.goproceed.test");
  });

  afterEach(deleteInbox);

  it("accepts a duplicate update without a second inbox row", async () => {
    const { POST: webhook } = await import("../app/integrations/telegram/webhook/route");

    expect((await webhook(request())).status).toBe(200);
    expect((await webhook(request())).status).toBe(200);
    expect(await countInbox()).toBe(1);
  });
});
