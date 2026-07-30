import { describe, it, expect } from "vitest";
import { adminClient } from "./pg";

describe("0009 deny-by-default privileges", () => {
  it("a table created after 0009 grants nothing to anon/authenticated", async () => {
    const c = await adminClient();
    try {
      await c.query("drop table if exists public._priv_probe");
      await c.query("create table public._priv_probe (id int)");
      const r = await c.query(`
        select
          has_table_privilege('anon', 'public._priv_probe', 'select') as anon_select,
          has_table_privilege('authenticated', 'public._priv_probe', 'select') as auth_select,
          has_table_privilege('authenticated', 'public._priv_probe', 'insert') as auth_insert`);
      expect(r.rows[0]).toEqual({ anon_select: false, auth_select: false, auth_insert: false });
      // The real invariant: no ALTERABLE creator role's default ACL in schema
      // public may grant anon/authenticated anything on future objects.
      // supabase_admin's platform entry is excluded: the migration runner
      // (postgres, not superuser) cannot alter another role's defaults, user
      // migrations never run as supabase_admin, and the catalog-snapshot
      // procedure watches that residual per environment (migration 0009
      // header documents both gotchas).
      const acl = await c.query(`
        select pg_get_userbyid(defaclrole) as owner, defaclobjtype, defaclacl::text as acl
        from pg_default_acl
        where defaclnamespace = 'public'::regnamespace
          and pg_get_userbyid(defaclrole) <> 'supabase_admin'
          and (defaclacl::text like '%anon=%' or defaclacl::text like '%authenticated=%')`);
      expect(acl.rows).toEqual([]);
    } finally {
      await adminCleanup(c);
    }
  });

  it("a function created after 0009 is not executable by anon/authenticated", async () => {
    const c = await adminClient();
    try {
      await c.query("create or replace function public._priv_probe_fn() returns int language sql as 'select 1'");
      const r = await c.query(`
        select
          has_function_privilege('anon', 'public._priv_probe_fn()', 'execute') as anon_exec,
          has_function_privilege('authenticated', 'public._priv_probe_fn()', 'execute') as auth_exec`);
      expect(r.rows[0]).toEqual({ anon_exec: false, auth_exec: false });
      await c.query("drop function public._priv_probe_fn()");
    } finally { await c.end(); }
  });

  it("PUBLIC cannot create in schema public", async () => {
    const c = await adminClient();
    try {
      const r = await c.query(
        "select has_schema_privilege('anon', 'public', 'create') as can_create");
      expect(r.rows[0].can_create).toBe(false);
    } finally { await c.end(); }
  });
});

async function adminCleanup(c: { query: (q: string) => Promise<unknown>; end: () => Promise<void> }) {
  try { await c.query("drop table if exists public._priv_probe"); } finally { await c.end(); }
}
