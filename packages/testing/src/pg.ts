import { Client, type QueryResult, type QueryResultRow } from "pg";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// 'app_pw' is the local/CI-only password set by supabase/seed.sql (never a
// migration — supabase/migrations/0003_roles_and_grants.sql intentionally
// creates goproceed_app_login with no password, so `supabase db push` against
// staging/prod never sets a known credential). Override via APP_DB_URL for
// any other environment.
const APP_URL = process.env.APP_DB_URL
  ?? "postgresql://goproceed_app_login:app_pw@127.0.0.1:54322/postgres";

// The server's identity. 'service_pw' is the local/CI-only password set by
// scripts/set-local-app-password.mjs — never by a migration, never by seed.sql.
const SERVICE_URL = process.env.SERVICE_DB_URL
  ?? "postgresql://goproceed_service_login:service_pw@127.0.0.1:54322/postgres";

// The purge worker's login. 'purge_pw' is local/CI-only, set by
// scripts/set-local-app-password.mjs; CI sets PURGE_DB_URL to the same value.
const PURGE_URL = process.env.PURGE_DB_URL
  ?? "postgresql://goproceed_purge_worker_login:purge_pw@127.0.0.1:54322/postgres";

// The local stack's real superuser (postgres is not one here). Only for a
// harness that must hold TEMPORARY and then SET ROLE into a product role — the
// one path that still reaches a temporary schema since 0102 (DEV-060, INV-116).
// The same local literal as packages/database/src/tx.test.ts; never a hosted URL.
const SUPERUSER_URL = "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres";

export function appClient(): Client { return new Client({ connectionString: APP_URL }); }
export function serviceClient(): Client { return new Client({ connectionString: SERVICE_URL }); }
export function purgeClient(): Client { return new Client({ connectionString: PURGE_URL }); }
export function superuserClient(): Client {
  // gp-security DEV-060 S1-06, S2-01; review R2-03: never pair the local superuser
  // with product or admin connections pointed at another database — a split run
  // could pass against the wrong one. Host, port and database must all match.
  const local = new URL(SUPERUSER_URL);
  for (const url of [APP_URL, SERVICE_URL, PURGE_URL, process.env.SUPABASE_DB_URL]) {
    if (!url) continue;
    const u = new URL(url);
    const host = u.hostname === "localhost" ? "127.0.0.1" : u.hostname;
    if (host !== local.hostname || u.port !== local.port || u.pathname !== local.pathname
        || u.searchParams.has("host") || u.searchParams.has("port") || u.searchParams.has("dbname")) {
      throw new Error("superuserClient() is local-only, but a database URL points at another database");
    }
  }
  return new Client({ connectionString: SUPERUSER_URL });
}

// Superuser connection for fixtures/assertions that must bypass RLS.
export async function adminClient(): Promise<Client> {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL
    ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
  await c.connect();
  return c;
}

export async function asActor<T extends QueryResultRow = QueryResultRow>(
  actorUserId: string, organizationId: string | null,
  fn: (c: Client) => Promise<QueryResult<T>> | Promise<void>,
): Promise<QueryResult<T>> {
  const c = appClient();
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role goproceed_app");
    await c.query("select set_config('app.actor_user_id', $1, true)", [actorUserId]);
    await c.query("select set_config('app.organization_id', $1, true)", [organizationId ?? ""]);
    const res = await fn(c);
    await c.query("commit");
    return (res ?? { rows: [], rowCount: 0 }) as QueryResult<T>;
  } catch (e) { await c.query("rollback"); throw e; }
  finally { await c.end(); }
}

/**
 * Runs as an EXTERNAL SESSION rather than as a member (v0.1-M5).
 *
 * Same role and same pool as `asActor` — there is no third database role, by the
 * decision recorded on `withExternalTx` in `@goproceed/database` — and a
 * DIFFERENT subject: the actor GUC is "" so `app.current_actor()` is NULL and
 * every member policy in this database matches nothing, and
 * `app.external_session_id` carries the session so the nine external policies of
 * migration 0049 §10 resolve.
 *
 * `organizationId` is set for symmetry with `asActor` and is NOT what authorizes
 * anything: the external policies read `app.external_session_occurrence()`,
 * which resolves through the session's own grant.
 */
export async function asExternalSession<T extends QueryResultRow = QueryResultRow>(
  externalSessionId: string, organizationId: string | null,
  fn: (c: Client) => Promise<QueryResult<T>> | Promise<void>,
): Promise<QueryResult<T>> {
  const c = appClient();
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role goproceed_app");
    // EXPLICITLY EMPTY, not omitted. A session that inherited an actor would be
    // a member transaction wearing a session id, and
    // `app.current_external_session()` would return NULL for it — which is the
    // database's own collapse rule and is exactly what this line exercises.
    await c.query("select set_config('app.actor_user_id', '', true)");
    await c.query("select set_config('app.organization_id', $1, true)", [organizationId ?? ""]);
    await c.query("select set_config('app.external_session_id', $1, true)", [externalSessionId]);
    const res = await fn(c);
    await c.query("commit");
    return (res ?? { rows: [], rowCount: 0 }) as QueryResult<T>;
  } catch (e) { await c.query("rollback"); throw e; }
  finally { await c.end(); }
}

/** Runs as the server rather than as a member. Same shape as asActor. */
export async function asService<T extends QueryResultRow = QueryResultRow>(
  actorUserId: string, organizationId: string | null,
  fn: (c: Client) => Promise<QueryResult<T>> | Promise<void>,
): Promise<QueryResult<T>> {
  const c = new Client({ connectionString: SERVICE_URL });
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role goproceed_service");
    await c.query("select set_config('app.actor_user_id', $1, true)", [actorUserId]);
    await c.query("select set_config('app.organization_id', $1, true)", [organizationId ?? ""]);
    const res = await fn(c);
    await c.query("commit");
    return (res ?? { rows: [], rowCount: 0 }) as QueryResult<T>;
  } catch (e) { await c.query("rollback"); throw e; }
  finally { await c.end(); }
}

/**
 * Deletes every row belonging to the named workspaces, across every
 * tenant-scoped table there is, and then the workspaces themselves.
 *
 * WHY THERE IS NO TABLE LIST HERE. The two fixtures that used to do this each
 * carried a hand-written dependency order, one of them warning in a comment
 * that "a table absent from this list is a 23503 on the day a suite first
 * writes it, three suites downstream from the one that caused it". That day
 * arrived four times, and on 2026-08-08 the list was still seven tables short
 * — capture_events, evidence_objects, idempotency_records, legal_entities,
 * outbox_dead_letters, requirement_template_versions, upload_intents — and
 * carried four order violations that no suite had reached yet. The missing
 * upload_intents took m5-external-rls's teardown down with a 23503 on
 * requirement_occurrences and left its rows behind, which is what turned two
 * real failures in m5-external-schema into forty.
 *
 * A correct order could not have been written by hand anyway:
 * contract_versions <-> import_batches and evidence_objects <-> upload_intents
 * are FK cycles, so no topological sort of these tables exists.
 *
 * `session_replication_role = 'replica'` removes the question. It suppresses
 * user triggers — app.reject_mutation() and the append-only guards, which is
 * what the old `disable trigger user` dance was for — AND referential-integrity
 * triggers, which is what the ordering was for. The tables are then read from
 * the catalog, so a table a future migration adds is covered the day it exists
 * rather than the day a suite first writes to it.
 *
 * Requires a superuser connection (`adminClient()`). The GUC is restored in a
 * finally, so a shared client is never left in replica mode.
 */
export async function dropWorkspaces(
  c: Client, workspaceIds: readonly string[],
): Promise<void> {
  const ids = [...workspaceIds];
  // Some tables name the tenant column organization_id rather than workspace_id;
  // reading both from the catalog is what makes a guess-then-catch loop
  // unnecessary. `organizations` is excluded here and deleted last, by its own
  // primary key.
  const scoped = await c.query<{ table_name: string; column_name: string }>(
    `select c.table_name, c.column_name
       from information_schema.columns c
       join information_schema.tables t
         on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public'
        and t.table_type = 'BASE TABLE'
        and c.column_name in ('workspace_id', 'organization_id')
        and c.table_name <> 'organizations'
      order by c.table_name, c.column_name`);
  await c.query("set session_replication_role = replica");
  try {
    for (const { table_name, column_name } of scoped.rows) {
      await c.query(
        `delete from public.${table_name} where ${column_name} = any($1::uuid[])`, [ids]);
    }
    await c.query("delete from public.organizations where id = any($1::uuid[])", [ids]);
  } finally {
    await c.query("set session_replication_role = origin");
  }
}

/**
 * Runs one fixture statement with user triggers suppressed, in a transaction of
 * its own on a fresh superuser connection.
 *
 * DEV-052 / BL-138 (migration 0099): `project_access_grants` refuses every
 * change but the revoke — no DELETE, no un-revoke, no re-dated window — and the
 * guard fires for superusers too. Fixtures that stage a lapsed, re-granted or
 * removed grant go through here; `session_replication_role = replica` is the
 * documented bypass, as in dropWorkspaces. It also skips referential-integrity
 * triggers, so it is for rewriting or removing existing rows, not for inserts.
 */
export async function bypassingGuards<T extends QueryResultRow = QueryResultRow>(
  sql: string, params: unknown[] = [],
): Promise<QueryResult<T>> {
  const c = await adminClient();
  try {
    await c.query("begin");
    await c.query("set local session_replication_role = replica");
    const r = await c.query<T>(sql, params);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    await c.end().catch(() => undefined);
  }
}

export async function resetDb(): Promise<void> {
  // Use the installed supabase CLI directly: `pnpm dlx supabase` re-downloads
  // the CLI on every reset (CI runners tripped the 120s test timeout on that
  // alone), and a SYNC exec blocks the vitest worker's event loop long enough
  // to kill its RPC ("Timeout calling onTaskUpdate"). Async exec + the
  // setup-cli/homebrew binary fixes both.
  await execAsync("supabase db reset --no-seed=false", { maxBuffer: 16 * 1024 * 1024 });
  // seed.sql intentionally carries no credential; restore the dev-only
  // password the same way local/CI setup does (local-host-only script).
  await execAsync("pnpm -w db:local-credentials", { maxBuffer: 16 * 1024 * 1024 });
}
