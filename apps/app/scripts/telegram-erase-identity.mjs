// apps/app/scripts/telegram-erase-identity.mjs
//
// The operator's entry to app.erase_telegram_identity — M0 gate 4's manual
// deletion procedure, scoped to one Telegram identity in one workspace.
//
//   pnpm --filter @goproceed/app exec node scripts/telegram-erase-identity.mjs \
//     --workspace <uuid> --telegram-user-id <id>
//
// Reads SERVICE_DB_URL and TELEGRAM_LINK_PEPPER from the environment. The
// pepper never leaves this process: the database receives an HMAC and the
// identifier, and after the transaction stores only the HMAC. Prints one JSON
// line and exits 0; any error exits 1 with its message. A non-zero
// pending_updates_for_subject means the worker still holds updates from this
// person — run again once /internal/telegram/jobs has drained them; the
// erasure that ran is complete.
import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export function subjectHmac(pepper, workspace, telegramUserId) {
  if (typeof pepper !== "string" || pepper.length === 0) throw new Error("TELEGRAM_LINK_PEPPER is not set");
  if (pepper.length < 32) throw new Error("TELEGRAM_LINK_PEPPER must be at least 32 characters");
  return createHmac("sha256", pepper).update(`erasure:${workspace}:${telegramUserId}`, "utf8").digest("hex");
}

// `clientFactory` is an optional injection point for tests: when omitted,
// `erase` builds its own `pg.Client` exactly as before (the default is
// preserved — nothing about the real call path changes).
/**
 * @param {{
 *   serviceDbUrl?: string,
 *   workspace: string,
 *   telegramUserId: string,
 *   hmac: string,
 *   clientFactory?: () => { connect: () => Promise<void>, query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>, end: () => Promise<void> },
 * }} args
 */
export async function erase({ serviceDbUrl, workspace, telegramUserId, hmac, clientFactory }) {
  const client = clientFactory ? clientFactory() : new pg.Client({ connectionString: serviceDbUrl });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("set local role goproceed_service");
    await client.query("select set_config('app.organization_id', $1, true)", [workspace]);
    const r = await client.query(
      "select * from app.erase_telegram_identity($1::uuid, $2::bigint, $3::text)",
      [workspace, telegramUserId, hmac],
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
  const serviceDbUrl = process.env.SERVICE_DB_URL;
  if (!serviceDbUrl) throw new Error("SERVICE_DB_URL is not set");
  const hmac = subjectHmac(process.env.TELEGRAM_LINK_PEPPER, args.workspace, args.telegramUserId);
  const row = await erase({ serviceDbUrl, workspace: args.workspace, telegramUserId: args.telegramUserId, hmac });
  console.log(JSON.stringify(row));
  if (Number(row.pending_updates_for_subject) > 0) {
    console.error("pending inbox updates from this identity exist — run again after /internal/telegram/jobs has drained them");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
}
