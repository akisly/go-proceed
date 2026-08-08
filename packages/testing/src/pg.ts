import { Client, type QueryResult, type QueryResultRow } from "pg";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// 'app_pw' is the local/CI-only password set by supabase/seed.sql (never a
// migration — supabase/migrations/0003_roles_and_grants.sql intentionally
// creates aktflow_app_login with no password, so `supabase db push` against
// staging/prod never sets a known credential). Override via APP_DB_URL for
// any other environment.
const APP_URL = process.env.APP_DB_URL
  ?? "postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres";

// The server's identity. 'service_pw' is the local/CI-only password set by
// scripts/set-local-app-password.mjs — never by a migration, never by seed.sql.
const SERVICE_URL = process.env.SERVICE_DB_URL
  ?? "postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres";

export function appClient(): Client { return new Client({ connectionString: APP_URL }); }

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
    await c.query("set local role aktflow_app");
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
    await c.query("set local role aktflow_app");
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
    await c.query("set local role aktflow_service");
    await c.query("select set_config('app.actor_user_id', $1, true)", [actorUserId]);
    await c.query("select set_config('app.organization_id', $1, true)", [organizationId ?? ""]);
    const res = await fn(c);
    await c.query("commit");
    return (res ?? { rows: [], rowCount: 0 }) as QueryResult<T>;
  } catch (e) { await c.query("rollback"); throw e; }
  finally { await c.end(); }
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
