// THE EXTERNAL-LINK KEY RULES, AT BUILD TIME (DEV-010, readiness gate 14).
//
// `src/lib/external-link.ts` `loadRegistry` refuses a key list it cannot use:
// an entry with no `<keyId>:` prefix, a key id that trims to nothing, a secret
// that decodes to fewer than 32 bytes (the HMAC tag is 32 bytes), and an active
// key id the list does not hold. It refuses at the FIRST EXTERNAL REQUEST,
// because the registry is loaded lazily. Until 2026-09-15 the deploy preflight
// only checked that the names were present, so a build with an unusable key
// list passed and shipped.
//
// These are the registry's rules, restated for a script that runs before the
// TypeScript build exists. `deploy-preflight-keys.test.mjs` runs one table of
// cases through this function AND through `linkKeys()` / `sessionKeys()`, and
// fails if the two ever disagree — change one, and that test says so.
//
// A problem names the variable and the entry's POSITION — never the key id,
// because a list entered in the wrong order (`<secret>:k1`) puts the secret where
// the id belongs, and a build log is readable by every project member.

/**
 * The registry's rules, returning the parsed keys too, for a plain-node script
 * that must compute HMACs under them (`telegram-erase-identity.mjs`, BL-085).
 *
 * @param {Record<string, string | undefined>} env
 * @param {string} keysVar    e.g. "EXTERNAL_LINK_HMAC_KEYS"
 * @param {string} activeVar  e.g. "EXTERNAL_LINK_ACTIVE_KEY_ID"
 * @param {{ rejectDuplicateIds?: boolean }} [options] the erasure keys refuse a
 *   repeated id: there the later secret would silently change what the id means
 * @returns {{ problems: string[], activeKeyId: string | null, keys: Map<string, Buffer> }}
 */
export function parseHmacKeys(env, keysVar, activeVar, { rejectDuplicateIds = false } = {}) {
  const fail = (problem) => ({ problems: [problem], activeKeyId: null, keys: new Map() });
  const raw = env[keysVar];
  const activeKeyId = env[activeVar];
  if (!raw) return fail(`${keysVar} is not set`);
  if (!activeKeyId) return fail(`${activeVar} is not set`);
  const keys = new Map();
  for (const [index, entry] of raw.split(",").entries()) {
    const at = entry.indexOf(":");
    if (at <= 0) {
      return fail(`${keysVar} entry ${index + 1} is not <keyId>:<base64 of 32+ bytes>`);
    }
    const id = entry.slice(0, at).trim();
    const secret = Buffer.from(entry.slice(at + 1).trim(), "base64");
    if (id.length === 0) return fail(`${keysVar} entry ${index + 1} has an empty key id`);
    if (secret.length < 32) {
      return fail(`${keysVar} entry ${index + 1} is shorter than 32 bytes (the tag it signs is 32 bytes)`);
    }
    if (rejectDuplicateIds && keys.has(id)) return fail(`${keysVar} entry ${index + 1} repeats a key id`);
    keys.set(id, secret);
  }
  if (!keys.has(activeKeyId)) {
    return fail(`${activeVar} names a key id that is not in ${keysVar} (the runtime refuses the first external request)`);
  }
  return { problems: [], activeKeyId, keys };
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} keysVar    e.g. "EXTERNAL_LINK_HMAC_KEYS"
 * @param {string} activeVar  e.g. "EXTERNAL_LINK_ACTIVE_KEY_ID"
 * @returns {string[]} problems; empty when the runtime registry would load
 */
export function hmacKeyProblems(env, keysVar, activeVar) {
  return parseHmacKeys(env, keysVar, activeVar).problems;
}
