/**
 * The HMAC key registry shared by the external-link keys (`external-link.ts`)
 * and the Telegram link keys (`telegram/config.ts`, BL-085):
 *
 *   `<KEYS_VAR>`:   `<keyId>:<base64 secret>[,<keyId>:<base64 secret>…]`
 *   `<ACTIVE_VAR>`: which of them signs new material.
 *
 * It throws rather than defaulting, refuses a secret under 32 bytes, and names
 * a bad entry by POSITION, never by key id (DEV-010). The deploy preflight
 * restates these rules (`scripts/deploy-preflight-keys.mjs`), and a test runs
 * one table of cases through both.
 */

export interface KeyRegistry {
  activeKeyId: string;
  keys: Map<string, Buffer>;
}

export function loadKeyRegistry(
  env: Record<string, string | undefined>, keysVar: string, activeVar: string,
): KeyRegistry {
  const raw = env[keysVar];
  const activeKeyId = env[activeVar];
  if (!raw) throw new Error(`${keysVar} is not set`);
  if (!activeKeyId) throw new Error(`${activeVar} is not set`);
  const keys = new Map<string, Buffer>();
  // Errors name the entry by POSITION, never by key id: a list pasted in the
  // wrong order (`<secret>:k1`) puts the secret where the id belongs, and this
  // message reaches the server log (DEV-010).
  for (const [index, entry] of raw.split(",").entries()) {
    const at = entry.indexOf(":");
    if (at <= 0) throw new Error(`${keysVar} entry ${index + 1} is not <keyId>:<base64>`);
    const id = entry.slice(0, at).trim();
    const secret = Buffer.from(entry.slice(at + 1).trim(), "base64");
    if (id.length === 0) throw new Error(`${keysVar} entry ${index + 1} has an empty key id`);
    if (secret.length < 32) throw new Error(`${keysVar} entry ${index + 1} is shorter than 32 bytes`);
    keys.set(id, secret);
  }
  if (!keys.has(activeKeyId)) {
    throw new Error(`${activeVar} names a key that is not in ${keysVar}`);
  }
  return { activeKeyId, keys };
}
