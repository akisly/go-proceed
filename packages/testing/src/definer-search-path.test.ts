import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { adminClient, appClient, serviceClient } from "./pg";

/**
 * DEV-059 / BL-152 / INV-115 (migration 0101): every SECURITY DEFINER function,
 * and every function that pins its own search_path, lists `pg_temp` last.
 *
 * Unless a path lists `pg_temp`, PostgreSQL searches the session's temporary
 * schema FIRST for relation and type names — an empty path included. A definer
 * that named a generic type unqualified in its own body (a plpgsql DECLARE, a
 * cast, a default) resolved it through the caller's temporary schema with its
 * owner's rights. Each probe case below creates, on the application or service
 * connection (PUBLIC holds TEMP), a function in `pg_temp` whose only effect is
 * to raise a marker naming `current_user`, and a domain in `pg_temp` shadowing a
 * built-in type whose CHECK calls it. Before 0101 the definer runs the marker as
 * `postgres`; after it, the definer's own outcome comes back.
 *
 * THIS FILE WRITES NOTHING: every case runs in a transaction it rolls back, on
 * a dedicated connection. The probe cases need PUBLIC's TEMP (BL-155).
 */

const NOBODY = "de560000-0000-4000-8000-0000000000c1";

type Plane = "app" | "service";

/** Runs `call` with `pg_temp.<type>` shadowed by a domain whose CHECK raises a marker. Returns the error message, or "" when none. */
async function probe(plane: Plane, type: "uuid" | "text", call: string, params: unknown[] = []): Promise<{ control: string; result: string }> {
  const c: Client = plane === "app" ? appClient() : serviceClient();
  await c.connect();
  try {
    await c.query("begin");
    await c.query(`create function pg_temp.bl152_probe(v pg_catalog.${type}) returns pg_catalog.bool language plpgsql as $$
      begin raise exception 'BL152-PROBE ran as %', current_user; end $$`);
    await c.query(`create domain pg_temp.${type} as pg_catalog.${type} check (pg_temp.bl152_probe(value))`);
    await c.query(`set local role ${plane === "app" ? "goproceed_app" : "goproceed_service"}`);
    await c.query("select pg_catalog.set_config('app.actor_user_id', $1::pg_catalog.text, true)", [NOBODY]);
    const run = async (sql: string, p: unknown[]): Promise<string> => {
      await c.query("savepoint s");
      try { await c.query(sql, p); await c.query("release savepoint s"); return ""; }
      catch (e) { await c.query("rollback to savepoint s"); return (e as Error).message; }
    };
    // Positive control: the shadow is live in this session.
    const control = await run(`select pg_catalog.gen_random_uuid()::pg_catalog.text::${type}`, []);
    const result = await run(call, params);
    return { control, result };
  } finally {
    await c.query("rollback").catch(() => undefined);
    await c.end().catch(() => undefined);
  }
}

describe("a definer never resolves a type through the caller's temporary schema (DEV-059, BL-152)", () => {
  it("A: app.accept_invitation (was search_path=public, declares uuid) answers its own refusal", async () => {
    const { control, result } = await probe("app", "uuid", "select app.accept_invitation($1::pg_catalog.text)", ["bl152-none"]);
    expect(control).toMatch(/BL152-PROBE ran as goproceed_app/);
    expect(result).not.toMatch(/BL152-PROBE/);
    expect(result).toMatch(/INVITATION/);
  });

  it("B: app.retire_requirement_rule_version (was search_path='', declares uuid) answers its own refusal", async () => {
    const { control, result } = await probe("app", "uuid",
      "select app.retire_requirement_rule_version(pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid())");
    expect(control).toMatch(/BL152-PROBE ran as goproceed_app/);
    expect(result).not.toMatch(/BL152-PROBE/);
    // Review R1-02: the function ran and refused on its own terms.
    expect(result).toMatch(/not authorized to retire/);
  });

  it("C: app.org_has_members (was search_path=public, casts to text) answers false", async () => {
    const { control, result } = await probe("app", "text", "select app.org_has_members(pg_catalog.gen_random_uuid())");
    expect(control).toMatch(/BL152-PROBE ran as goproceed_app/);
    expect(result).toBe("");
  });

  it("D: app.abandon_unauthorized_upload_intent on the service plane (was search_path='', declares uuid) answers without the probe", async () => {
    const { control, result } = await probe("service", "uuid",
      "select app.abandon_unauthorized_upload_intent(pg_catalog.gen_random_uuid())");
    expect(control).toMatch(/BL152-PROBE ran as goproceed_service/);
    // Review R1-02: the function ran and answered for an unknown intent.
    expect(result).toBe("");
  });
});

describe("every definer and every function that pins a path lists pg_temp last (DEV-059, INV-115)", () => {
  let admin: Client;
  beforeAll(async () => { admin = await adminClient(); });
  afterAll(async () => { await admin.end(); });

  const rows = async () => (await admin.query<{ fn: string; definer: boolean; config: string[] | null }>(
    `select p.oid::regprocedure::text as fn, p.prosecdef as definer, p.proconfig as config
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('app', 'public', 'api')
        and (p.prosecdef or exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
        and not exists (select 1 from pg_depend d
                         where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
      order by 1`)).rows;
  const pathOf = (config: string[] | null) => (config ?? []).find((c) => c.startsWith("search_path="))?.slice("search_path=".length) ?? null;

  it("no such function leaves pg_temp unlisted or anywhere but last", async () => {
    const all = await rows();
    expect(all.find((r) => r.fn === "app.accept_invitation(text)")).toMatchObject({ definer: true });
    // gp-security S1-03: pg_temp exactly once and last, and nothing before it but pg_catalog — or public for BL-146's eleven.
    const offenders = all.filter((r) => {
      const path = pathOf(r.config);
      return path !== "pg_catalog, pg_temp" && path !== "public, pg_temp";
    }).map((r) => `${r.fn} ${pathOf(r.config)}`);
    expect(offenders).toEqual([]);
  });

  it("the definers that still trust public are exactly BL-146's eleven", async () => {
    const trusting = (await rows()).filter((r) => (pathOf(r.config) ?? "").split(",").map((x) => x.trim()).includes("public"))
      .map((r) => r.fn);
    expect(trusting.sort()).toEqual([
      "app.assert_funded_within_lineage()", "app.assert_reservation_invariant(uuid,uuid)",
      "app.assert_stage_closure_set()", "app.assert_statutory_act_version_complete()",
      "app.block_upload_intent(uuid,uuid,text)", "app.evidence_bytes_in_use(uuid)",
      "app.fail_upload_intent(uuid,uuid,text)", "app.finalize_upload_intent(uuid,uuid,text,bigint,text,text,text)",
      "app.member_id_any_status(uuid)", "app.open_allocation_head(uuid,uuid)", "app.orphan_upload_intent(uuid,uuid)",
    ].sort());
  });

  // Review R1-09: the two worker/cron-only bodies that lost `public` from their path still run.
  it("public.drain_outbox and app.purge_expired_idempotency still run under pg_catalog, pg_temp", async () => {
    await admin.query("begin");
    try {
      await admin.query("select public.drain_outbox(0)");
      await admin.query("select app.purge_expired_idempotency(0)");
    } finally {
      await admin.query("rollback");
    }
  });
});
