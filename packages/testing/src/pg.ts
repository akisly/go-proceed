import { Client, type QueryResult, type QueryResultRow } from "pg";
import { execSync } from "node:child_process";

// 'app_pw' is the local/CI-only password set by supabase/seed.sql (never a
// migration — supabase/migrations/0003_roles_and_grants.sql intentionally
// creates aktflow_app_login with no password, so `supabase db push` against
// staging/prod never sets a known credential). Override via APP_DB_URL for
// any other environment.
const APP_URL = process.env.APP_DB_URL
  ?? "postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres";

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

export async function resetDb(): Promise<void> {
  execSync("pnpm dlx supabase db reset --no-seed=false", { stdio: "ignore" });
  // seed.sql intentionally carries no credential; restore the dev-only
  // password the same way local/CI setup does (local-host-only script).
  execSync("pnpm -w db:local-credentials", { stdio: "ignore" });
}
