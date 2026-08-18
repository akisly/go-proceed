import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient } from "./pg";

/**
 * TRUNCATE IS THE ONE WRITE NO APPEND-ONLY TRIGGER IN THIS SCHEMA CAN SEE, and
 * this file is the standing assertion that nobody but the owner can perform it.
 *
 * Nineteen tables in `public` carry an append-only or immutable guarantee, each
 * enforced by a `BEFORE UPDATE OR DELETE ... FOR EACH ROW` trigger. TRUNCATE
 * raises neither event — it has its own, `BEFORE TRUNCATE`, which must be
 * `FOR EACH STATEMENT` and which none of the nineteen declares. RLS has no say
 * over it either. So the guarantee on `audit_events`, `evidence_objects`,
 * `statutory_acts`, `stage_closures` and fifteen others held against every
 * UPDATE and DELETE and could be stepped around in a single statement.
 *
 * Migration 0058 closed it by revoking, not by adding a trigger: the only
 * non-owner holder was `service_role`, a refusing trigger cannot constrain the
 * owner anyway, and one would have broken `truncateAll` — which truncates
 * `public.audit_events ... cascade` between test files. That file's own header
 * carries the full argument.
 *
 * THE ASSERTIONS BELOW ARE WRITTEN OVER THE WHOLE SCHEMA, NEVER OVER A LIST.
 * A list is what let this happen: the privilege was never granted by any
 * migration — it arrived from a default ACL the Supabase image installs, so
 * every table ever created in `public` acquired it silently, and so would every
 * table created next. A test that enumerated the nineteen would pass forever
 * while the twentieth arrived holding the same hole.
 */

let admin: Client;

beforeAll(async () => { admin = await adminClient(); });
afterAll(async () => { await admin?.end().catch(() => undefined); });

describe("TRUNCATE in schema public belongs to the owner alone", () => {
  it("grants it to no role other than the table owner", async () => {
    const r = await admin.query<{ grantee: string; table_name: string }>(
      `select grantee, table_name from information_schema.role_table_grants
        where privilege_type = 'TRUNCATE' and table_schema = 'public' and grantee <> 'postgres'
        order by grantee, table_name`);
    // Named individually so a failure says WHICH table and WHICH role, rather
    // than only that a count moved.
    expect(r.rows.map((x) => `${x.grantee} -> ${x.table_name}`)).toEqual([]);
  });

  it("leaves the owner able to truncate, because the migration chain and the test harness depend on it", async () => {
    // The complement of the assertion above, and not a formality: a revoke
    // written `from public` or `from all` would satisfy the first test and
    // break `supabase db reset` and `truncateAll`, both of which run as the
    // owner. This is the one that would catch that.
    const r = await admin.query<{ n: string }>(
      `select count(*)::int as n from information_schema.role_table_grants
        where privilege_type = 'TRUNCATE' and table_schema = 'public' and grantee = 'postgres'`);
    expect(Number(r.rows[0]!.n)).toBeGreaterThan(0);
  });

  it("does not hand TRUNCATE to a table created after the migration ran", async () => {
    // THE HALF THAT PROTECTS TOMORROW'S TABLES. Revoking on today's 53 would
    // leave the default ACL intact, and the next `create table` in `public`
    // would silently acquire the privilege again — which is exactly how all 53
    // got it, since no migration ever contained a `grant truncate`.
    await admin.query("create table if not exists public.zz_truncate_privilege_probe (id int)");
    try {
      const r = await admin.query<{ grantee: string }>(
        `select grantee from information_schema.role_table_grants
          where privilege_type = 'TRUNCATE' and table_name = 'zz_truncate_privilege_probe'
            and grantee <> 'postgres'`);
      expect(r.rows.map((x) => x.grantee)).toEqual([]);
    } finally {
      await admin.query("drop table if exists public.zz_truncate_privilege_probe");
    }
  });

  it("still enforces append-only against UPDATE and DELETE, which is what the triggers do cover", async () => {
    // A guard on the guard: 0058 changes privileges and nothing else, so the
    // nineteen triggers must be exactly as they were. If a later change
    // "simplified" one away, the revoke alone would not carry the guarantee.
    const r = await admin.query<{ n: string }>(
      `select count(*)::int as n from pg_trigger t
         where not t.tgisinternal
           and (t.tgtype & 8) <> 0 and (t.tgtype & 16) <> 0
           and (t.tgname ~ 'append_only|immutable' or pg_get_triggerdef(t.oid) ~ 'append|immutable')`);
    expect(Number(r.rows[0]!.n)).toBeGreaterThanOrEqual(19);
  });
});
