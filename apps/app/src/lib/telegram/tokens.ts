import { createHmac, randomBytes } from "node:crypto";

/** A 256-bit opaque value used once in a Telegram deep link. */
export function issueTelegramToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * The database stores only this keyed verifier, never the raw deep-link value.
 * Its fixed-length HMAC is passed to the database's single-row consuming
 * function, which performs the expiry and one-use check atomically.
 */
export function telegramVerifier(raw: string, pepper: string): string {
  return createHmac("sha256", pepper).update(raw, "utf8").digest("hex");
}
