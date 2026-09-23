import { describe, it, expect } from "vitest";
import { Client } from "pg";
import { q } from "./helpers/fixtures";

/**
 * The purge worker's own principal (DEV-036, BL-030; migration 0090).
 *
 * Deleting bytes crosses tenants, so the purge runs neither as the member-facing
 * role nor as the service principal (which inherits every tenant table grant
 * through goproceed_app), nor as goproceed_worker (which holds the outbox
 * functions and is the normative principal for other workers,
 * `tenancy-and-security.md` §Workers). It gets a role of its own that can do
 * exactly the purge, and a login that can become nothing else.
 */

const PURGE_URL = process.env.PURGE_DB_URL
  ?? "postgresql://goproceed_purge_worker_login:purge_pw@127.0.0.1:54322/postgres";
const APP_URL = process.env.APP_DB_URL
  ?? "postgresql://goproceed_app_login:app_pw@127.0.0.1:54322/postgres";

const PURGE_FUNCTIONS = [
  "app.expire_upload_intents()",
  "app.claim_upload_purge(integer)",
  "app.complete_upload_purge(uuid)",
  "app.fail_upload_purge(uuid, text)",
  "app.upload_purge_health()",
];

async function asLogin<T>(url: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: url });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

describe("the purge principal (BL-030)", () => {
  it("is a login that can become the purge role and nothing else", async () => {
    const roles = await q<{ rolname: string; rolcanlogin: boolean; rolinherit: boolean;
                            rolbypassrls: boolean; rolsuper: boolean }>(
      `select rolname, rolcanlogin, rolinherit, rolbypassrls, rolsuper from pg_roles
        where rolname in ('goproceed_purge_worker', 'goproceed_purge_worker_login')
        order by rolname`);
    expect(roles).toEqual([
      { rolname: "goproceed_purge_worker", rolcanlogin: false, rolinherit: true,
        rolbypassrls: false, rolsuper: false },
      { rolname: "goproceed_purge_worker_login", rolcanlogin: true, rolinherit: false,
        rolbypassrls: false, rolsuper: false },
    ]);
    const memberOf = await q<{ role: string }>(
      `select b.rolname as role from pg_auth_members m
         join pg_roles r on r.oid = m.member join pg_roles b on b.oid = m.roleid
        where r.rolname = $1 order by 1`, ["goproceed_purge_worker_login"]);
    expect(memberOf.map((r) => r.role)).toEqual(["goproceed_purge_worker"]);
    const purgeRoleMemberOf = await q<{ role: string }>(
      `select b.rolname as role from pg_auth_members m
         join pg_roles r on r.oid = m.member join pg_roles b on b.oid = m.roleid
        where r.rolname = $1`, ["goproceed_purge_worker"]);
    expect(purgeRoleMemberOf).toEqual([]);
  });

  it("holds EXECUTE on the five purge functions and no table privilege", async () => {
    for (const fn of PURGE_FUNCTIONS) {
      const r = await q<{ ok: boolean }>(
        "select has_function_privilege('goproceed_purge_worker', $1, 'execute') as ok", [fn]);
      expect(r[0]!.ok, fn).toBe(true);
    }
    const tables = await q<{ n: string }>(
      `select count(*) n from information_schema.role_table_grants
        where grantee = 'goproceed_purge_worker'`);
    expect(tables[0]!.n).toBe("0");
    // Every function it may execute, outside the extensions' own schemas: the five.
    const callable = await q<{ fn: string }>(
      `select p.oid::regprocedure::text as fn from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'app')
          and has_function_privilege('goproceed_purge_worker', p.oid, 'execute')
          and not has_function_privilege('public', p.oid, 'execute')
        order by 1`);
    expect(callable.map((r) => r.fn).sort()).toEqual(
      ["app.claim_upload_purge(integer)", "app.complete_upload_purge(uuid)",
        "app.expire_upload_intents()", "app.fail_upload_purge(uuid,text)",
        "app.upload_purge_health()"].sort());
  });

  it("is the only principal that may call them", async () => {
    for (const role of ["anon", "authenticated", "goproceed_app", "goproceed_service",
                        "service_role", "goproceed_worker"]) {
      for (const fn of PURGE_FUNCTIONS) {
        const r = await q<{ ok: boolean }>(
          "select has_function_privilege($1, $2, 'execute') as ok", [role, fn]);
        expect(r[0]!.ok, `${role} ${fn}`).toBe(false);
      }
    }
  });

  it("leaves no purge function in the exposed public schema", async () => {
    const r = await q<{ fn: string }>(
      `select p.oid::regprocedure::text as fn from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('expire_upload_intents', 'claim_upload_purge',
                            'complete_upload_purge', 'fail_upload_purge')`);
    expect(r).toEqual([]);
  });

  it("runs the functions it holds as the purge login, and nothing else", async () => {
    await asLogin(PURGE_URL, async (c) => {
      await c.query("begin");
      await c.query("set local role goproceed_purge_worker");
      const who = await c.query<{ u: string }>("select session_user::text as u");
      expect(who.rows[0]!.u).toBe("goproceed_purge_worker_login");
      await c.query("select app.expire_upload_intents()");
      await c.query("select * from app.upload_purge_health()");
      await c.query("rollback");
      for (const role of ["goproceed_service", "goproceed_app", "goproceed_worker", "postgres"]) {
        await c.query("begin");
        await expect(c.query(`set local role ${role}`), role).rejects.toThrow(/permission denied/);
        await c.query("rollback");
      }
      await c.query("begin");
      await c.query("set local role goproceed_purge_worker");
      await expect(c.query("select count(*) from public.upload_intents"))
        .rejects.toThrow(/permission denied/);
      await c.query("rollback");
    });
  });

  it("cannot be reached from the member-facing login", async () => {
    await asLogin(APP_URL, async (c) => {
      await c.query("begin");
      await expect(c.query("set local role goproceed_purge_worker")).rejects.toThrow(/permission denied/);
      await c.query("rollback");
    });
  });

  it("keeps the in-database expiry schedule pointed at the moved function", async (ctx) => {
    const ext = await q("select 1 from pg_extension where extname = 'pg_cron'");
    if (ext.length === 0) ctx.skip();
    const jobs = await q<{ command: string }>(
      "select command from cron.job where jobname = 'upload-intent-expiry'");
    expect(jobs.map((j) => j.command)).toEqual(["select app.expire_upload_intents()"]);
  });
});
