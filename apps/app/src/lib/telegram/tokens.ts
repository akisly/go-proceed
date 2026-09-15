import { createHmac, randomBytes } from "node:crypto";
import type { KeyRegistry } from "../hmac-key-registry";

/** A 256-bit opaque value used once in a Telegram deep link. */
export function issueTelegramToken(): string {
  return randomBytes(32).toString("base64url");
}

function verifierUnder(key: Buffer, raw: string): string {
  return createHmac("sha256", key).update(raw, "utf8").digest("hex");
}

/**
 * The database stores only this keyed verifier, never the raw deep-link value,
 * together with the id of the key that computed it (BL-085).
 */
export function telegramVerifier(raw: string, registry: KeyRegistry): { keyId: string; verifierHash: string } {
  const key = registry.keys.get(registry.activeKeyId);
  if (!key) throw new Error("the active Telegram link key is not in the registry");
  return { keyId: registry.activeKeyId, verifierHash: verifierUnder(key, raw) };
}

/**
 * One candidate verifier per configured key, in registry order. The consuming
 * definer matches a row only under the key id that computed it, so a token
 * issued before a rotation is still consumed while its key stays configured.
 */
export function telegramVerifierCandidates(
  raw: string, registry: KeyRegistry,
): { keyIds: string[]; verifierHashes: string[] } {
  const keyIds = [...registry.keys.keys()];
  return { keyIds, verifierHashes: keyIds.map((id) => verifierUnder(registry.keys.get(id)!, raw)) };
}
