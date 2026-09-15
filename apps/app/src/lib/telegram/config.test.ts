import { describe, expect, it } from "vitest";
import { loadTelegramConfig, TelegramConfigError } from "./config";

const k32 = (n: number) => Buffer.alloc(32, n).toString("base64");
// Non-repeating bytes, so a message printing any part of a secret is caught.
const varied = (len: number, seed: number) =>
  Buffer.from(Array.from({ length: len }, (_, i) => (i * 37 + seed * 11 + 5) % 256)).toString("base64");

const base = {
  TELEGRAM_BOT_TOKEN: "t".repeat(32),
  TELEGRAM_BOT_ID: "123456789",
  TELEGRAM_BOT_USERNAME: "GoProceedTestBot",
  TELEGRAM_WEBHOOK_SECRET: "w".repeat(32),
  TELEGRAM_WORKER_SECRET: "r".repeat(32),
  TELEGRAM_LINK_HMAC_KEYS: `k1:${k32(1)},k2:${k32(2)}`,
  TELEGRAM_LINK_ACTIVE_KEY_ID: "k2",
  APP_PUBLIC_ORIGIN: "https://app.goproceed.test",
};

function thrown(env: Record<string, string | undefined>): unknown {
  try { loadTelegramConfig(env); return null; } catch (e) { return e; }
}

describe("Telegram configuration — link keys with key ids (BL-085)", () => {
  it("loads the link key registry with its active key", () => {
    const config = loadTelegramConfig(base);
    expect(config.linkKeys.activeKeyId).toBe("k2");
    expect([...config.linkKeys.keys.keys()]).toEqual(["k1", "k2"]);
  });

  it("refuses a missing key list or active id with the generic configuration error", () => {
    expect(thrown({ ...base, TELEGRAM_LINK_HMAC_KEYS: undefined })).toBeInstanceOf(TelegramConfigError);
    expect(thrown({ ...base, TELEGRAM_LINK_ACTIVE_KEY_ID: undefined })).toBeInstanceOf(TelegramConfigError);
    expect(thrown({ ...base, TELEGRAM_LINK_ACTIVE_KEY_ID: "k9" })).toBeInstanceOf(TelegramConfigError);
    expect(thrown({ ...base, TELEGRAM_LINK_HMAC_KEYS: `k1:${Buffer.alloc(16, 1).toString("base64")}`, TELEGRAM_LINK_ACTIVE_KEY_ID: "k1" }))
      .toBeInstanceOf(TelegramConfigError);
  });

  it("no longer accepts the pepper without key ids", () => {
    const { TELEGRAM_LINK_HMAC_KEYS: _k, TELEGRAM_LINK_ACTIVE_KEY_ID: _a, ...rest } = base;
    expect(thrown({ ...rest, TELEGRAM_LINK_PEPPER: "p".repeat(32) })).toBeInstanceOf(TelegramConfigError);
  });

  it("never carries key material in the error", () => {
    const secret = varied(32, 3);
    const e = thrown({ ...base, TELEGRAM_LINK_HMAC_KEYS: `${secret}:k1`, TELEGRAM_LINK_ACTIVE_KEY_ID: "k1" });
    expect(e).toBeInstanceOf(TelegramConfigError);
    const text = `${String(e)} ${JSON.stringify(e)} ${(e as Error).stack ?? ""}`;
    for (let i = 0; i + 8 <= secret.length; i += 1) expect(text).not.toContain(secret.slice(i, i + 8));
  });
});
