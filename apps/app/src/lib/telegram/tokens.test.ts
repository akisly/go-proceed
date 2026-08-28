import { describe, expect, it } from "vitest";
import { issueTelegramToken, telegramVerifier } from "./tokens";

describe("Telegram link tokens", () => {
  it("issues URL-safe 256-bit tokens and stable keyed verifiers", () => {
    const raw = issueTelegramToken();
    const verifier = telegramVerifier(raw, "p".repeat(32));

    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifier).toMatch(/^[0-9a-f]{64}$/);
    expect(verifier).not.toContain(raw);
    expect(telegramVerifier(raw, "p".repeat(32))).toBe(verifier);
  });
});
