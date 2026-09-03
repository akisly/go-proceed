import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn(async () => ({ rowCount: 1, rows: [] }));

vi.mock("@goproceed/database", () => ({
  withServiceTx: async (_ctx: unknown, fn: (tx: { query: typeof query }) => Promise<unknown>) => fn({ query }),
}));

import {
  MAX_TELEGRAM_UPDATE_BYTES,
  acceptTelegramUpdate,
  sameSecret,
  verifyTelegramWebhookSecret,
} from "./ingress";

const secret = "w".repeat(32);

function request(body: BodyInit | null, options: { secret?: string; contentLength?: string } = {}): Request {
  const headers = new Headers();
  if (options.secret !== undefined) headers.set("x-telegram-bot-api-secret-token", options.secret);
  if (options.contentLength !== undefined) headers.set("content-length", options.contentLength);
  return new Request("https://app.goproceed.test/integrations/telegram/webhook", { method: "POST", headers, body });
}

describe("Telegram webhook ingress", () => {
  beforeEach(() => {
    query.mockClear();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t".repeat(32));
    vi.stubEnv("TELEGRAM_BOT_ID", "123456789");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "GoProceedTestBot");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", secret);
    vi.stubEnv("TELEGRAM_WORKER_SECRET", "r".repeat(32));
    vi.stubEnv("TELEGRAM_LINK_PEPPER", "p".repeat(32));
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://app.goproceed.test");
  });

  it("compares the provider secret without accepting a prefix or length mismatch", () => {
    expect(sameSecret(secret, secret)).toBe(true);
    expect(sameSecret(`${secret}x`, secret)).toBe(false);
    expect(sameSecret(null, secret)).toBe(false);
    expect(verifyTelegramWebhookSecret(request(null, { secret }), secret)).toBe(true);
  });

  it("rejects before JSON parsing when the Telegram secret is wrong", async () => {
    const response = await acceptTelegramUpdate(request("{", { secret: "wrong" }));

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects a declared body exceeding one MiB before reading it", async () => {
    const response = await acceptTelegramUpdate(request("{}", {
      secret, contentLength: String(MAX_TELEGRAM_UPDATE_BYTES + 1),
    }));

    expect(response.status).toBe(413);
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects a streamed body exceeding one MiB", async () => {
    const response = await acceptTelegramUpdate(request("x".repeat(MAX_TELEGRAM_UPDATE_BYTES + 1), { secret }));

    expect(response.status).toBe(413);
    expect(query).not.toHaveBeenCalled();
  });

  it("persists the parsed update with a hash of its exact raw bytes", async () => {
    const raw = '{ "update_id": 42, "message": { "text": "hello" } }';
    const response = await acceptTelegramUpdate(request(raw, { secret }));

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, values] = (query.mock.calls as unknown as Array<[string, unknown[]]>)[0]!;
    expect(sql).toContain("app.enqueue_telegram_inbox_update");
    expect(values).toEqual([
      "123456789", "42", JSON.parse(raw), createHash("sha256").update(raw).digest("hex"),
    ]);
  });

  it("returns the same empty success response for a duplicate update", async () => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [] }).mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const first = await acceptTelegramUpdate(request('{"update_id":42}', { secret }));
    const duplicate = await acceptTelegramUpdate(request('{"update_id":42}', { secret }));

    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(200);
    expect(await duplicate.text()).toBe("");
  });

  it("canonicalizes decimal-string update IDs before using the inbox identity", async () => {
    const padded = await acceptTelegramUpdate(request('{"update_id":"001"}', { secret }));
    const canonical = await acceptTelegramUpdate(request('{"update_id":"1"}', { secret }));

    expect(padded.status).toBe(200);
    expect(canonical.status).toBe(200);
    const calls = query.mock.calls as unknown as Array<[string, unknown[]]>;
    expect(calls.map(([, values]) => values[1])).toEqual(["1", "1"]);
  });

  it("rejects malformed JSON and unsafe provider update identities", async () => {
    expect((await acceptTelegramUpdate(request("{", { secret }))).status).toBe(422);
    expect((await acceptTelegramUpdate(request('{"update_id":9007199254740992}', { secret }))).status).toBe(422);
    expect(query).not.toHaveBeenCalled();
  });
});
