import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { loadKeyRegistry } from "../hmac-key-registry";
import { issueTelegramToken, telegramVerifier, telegramVerifierCandidates } from "./tokens";

const k32 = (n: number) => Buffer.alloc(32, n).toString("base64");
const registry = (keys: string, active: string) =>
  loadKeyRegistry({ TELEGRAM_LINK_HMAC_KEYS: keys, TELEGRAM_LINK_ACTIVE_KEY_ID: active },
    "TELEGRAM_LINK_HMAC_KEYS", "TELEGRAM_LINK_ACTIVE_KEY_ID");

describe("Telegram link tokens", () => {
  it("issues URL-safe 256-bit tokens", () => {
    expect(issueTelegramToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("signs a verifier with the active key and names that key (BL-085)", () => {
    const raw = issueTelegramToken();
    const keys = registry(`k1:${k32(1)},k2:${k32(2)}`, "k2");
    const signed = telegramVerifier(raw, keys);

    expect(signed.keyId).toBe("k2");
    expect(signed.verifierHash).toMatch(/^[0-9a-f]{64}$/);
    expect(signed.verifierHash).toBe(createHmac("sha256", Buffer.alloc(32, 2)).update(raw, "utf8").digest("hex"));
    expect(signed.verifierHash).not.toContain(raw);
    expect(telegramVerifier(raw, keys)).toEqual(signed);
  });

  it("offers one candidate per configured key, so a token signed before a rotation still matches", () => {
    const raw = issueTelegramToken();
    const before = telegramVerifier(raw, registry(`k1:${k32(1)}`, "k1"));
    const candidates = telegramVerifierCandidates(raw, registry(`k1:${k32(1)},k2:${k32(2)}`, "k2"));

    expect(candidates.keyIds).toEqual(["k1", "k2"]);
    expect(candidates.verifierHashes).toHaveLength(2);
    expect(candidates.verifierHashes[0]).toBe(before.verifierHash);
    expect(candidates.verifierHashes[1]).not.toBe(before.verifierHash);
  });

  it("a key entry holding the old pepper's UTF-8 bytes reproduces the old peppered verifier", () => {
    const pepper = "p".repeat(32);
    const raw = issueTelegramToken();
    const legacy = registry(`legacy:${Buffer.from(pepper, "utf8").toString("base64")}`, "legacy");
    expect(telegramVerifier(raw, legacy).verifierHash)
      .toBe(createHmac("sha256", pepper).update(raw, "utf8").digest("hex"));
  });
});
