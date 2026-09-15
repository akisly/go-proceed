// apps/app/scripts/telegram-erase-identity.mjs
//
// The operator's entry to app.erase_telegram_identity — M0 gate 4's manual
// deletion procedure, scoped to one Telegram identity in one workspace.
//
//   pnpm --filter @goproceed/app exec node scripts/telegram-erase-identity.mjs \
//     --workspace <uuid> --telegram-user-id <id>
//
// Reads SERVICE_DB_URL, TELEGRAM_ERASURE_HMAC_KEYS and
// TELEGRAM_ERASURE_ACTIVE_KEY_ID from the environment (BL-085). The erasure
// keys live on the operator's machine only, never in a deployment. No key
// leaves this process: the database receives, per key id, an HMAC of the
// subject and a check value of the key, and after the transaction stores the
// active key's HMAC with its id. Every key id this workspace's registry already
// holds must be supplied, or the database refuses before any write.
//
// Prints one JSON line and exits 0; any error exits 1 with its message. A
// non-zero pending_updates_for_subject means the worker still holds updates
// from this person — run again once /internal/telegram/jobs has drained them;
// the erasure that ran is complete. That counter is per bot, not per workspace
// (telegram_inbox_updates carries no tenant column): a person active in
// another workspace on the same bot keeps it above zero, and that alone is
// not a reason to run this again.
import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { parseHmacKeys } from "./deploy-preflight-keys.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The label each key's check value is an HMAC of (migration 0085). */
export const KEY_CHECK_LABEL = "goproceed:telegram-erasure:key-check:v1";

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--workspace" || key === "--telegram-user-id") {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${key} needs a value`);
      out[key === "--workspace" ? "workspace" : "telegramUserId"] = value;
      i += 1;
    } else {
      throw new Error(`unknown argument: ${key}`);
    }
  }
  if (!out.workspace) throw new Error("--workspace is required");
  if (!out.telegramUserId) throw new Error("--telegram-user-id is required");
  if (!UUID.test(out.workspace)) throw new Error("--workspace must be a uuid");
  if (!/^[1-9][0-9]{0,18}$/.test(out.telegramUserId)) throw new Error("--telegram-user-id must be a positive integer");
  return out;
}

/**
 * The erasure key registry. Refusals name the variable and the entry's
 * position, never key material. A repeated key id is refused here, unlike the
 * link keys: an erasure key id must always mean the same secret.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{ activeKeyId: string, keys: Map<string, Buffer> }}
 */
export function erasureKeys(env) {
  const parsed = parseHmacKeys(env, "TELEGRAM_ERASURE_HMAC_KEYS", "TELEGRAM_ERASURE_ACTIVE_KEY_ID", { rejectDuplicateIds: true });
  if (parsed.problems.length > 0) throw new Error(parsed.problems.join("; "));
  if (parsed.keys.size > 8) throw new Error("TELEGRAM_ERASURE_HMAC_KEYS holds more than 8 keys");
  return { activeKeyId: /** @type {string} */ (parsed.activeKeyId), keys: parsed.keys };
}

/** One HMAC of the erasure-prefixed subject per key, in registry order. */
export function subjectHmacs(registry, workspace, telegramUserId) {
  const keyIds = [...registry.keys.keys()];
  const hmacs = keyIds.map((id) =>
    createHmac("sha256", registry.keys.get(id)).update(`erasure:${workspace}:${telegramUserId}`, "utf8").digest("hex"));
  return { keyIds, hmacs };
}

/** One check value per key, in registry order: an HMAC of a fixed label. */
export function keyCheckValues(registry) {
  return [...registry.keys.values()].map((key) => createHmac("sha256", key).update(KEY_CHECK_LABEL, "utf8").digest("hex"));
}

// `clientFactory` is an optional injection point for tests: when omitted,
// `erase` builds its own `pg.Client`.
/**
 * @param {{
 *   serviceDbUrl?: string,
 *   workspace: string,
 *   telegramUserId: string,
 *   activeKeyId: string,
 *   keyIds: string[],
 *   hmacs: string[],
 *   checkValues: string[],
 *   clientFactory?: () => { connect: () => Promise<void>, query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>, end: () => Promise<void> },
 * }} args
 */
export async function erase({ serviceDbUrl, workspace, telegramUserId, activeKeyId, keyIds, hmacs, checkValues, clientFactory }) {
  const client = clientFactory ? clientFactory() : new pg.Client({ connectionString: serviceDbUrl });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("set local role goproceed_service");
    await client.query("select set_config('app.organization_id', $1, true)", [workspace]);
    const r = await client.query(
      "select * from app.erase_telegram_identity($1::uuid, $2::bigint, $3::text, $4::text[], $5::text[], $6::text[])",
      [workspace, telegramUserId, activeKeyId, keyIds, hmacs, checkValues],
    );
    await client.query("commit");
    return r.rows[0];
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // The keys are checked before any connection is opened.
  const keys = erasureKeys(process.env);
  const serviceDbUrl = process.env.SERVICE_DB_URL;
  if (!serviceDbUrl) throw new Error("SERVICE_DB_URL is not set");
  const { keyIds, hmacs } = subjectHmacs(keys, args.workspace, args.telegramUserId);
  const row = await erase({
    serviceDbUrl, workspace: args.workspace, telegramUserId: args.telegramUserId,
    activeKeyId: keys.activeKeyId, keyIds, hmacs, checkValues: keyCheckValues(keys),
  });
  console.log(JSON.stringify(row));
  if (Number(row.pending_updates_for_subject) > 0) {
    console.error("pending inbox updates from this identity exist — run again after /internal/telegram/jobs has drained them");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
}
