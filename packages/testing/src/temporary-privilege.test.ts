import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { adminClient, appClient, purgeClient, serviceClient, superuserClient } from "./pg";

/**
 * DEV-060 / BL-155 / INV-116 (migration 0102): no product role can create a
 * temporary object.
 *
 * PUBLIC held TEMPORARY on the database, so every `goproceed_*` login could
 * create a temporary schema, and PostgreSQL searches that schema for relation
 * and type names — first when the path does not list it, last since 0101
 * (INV-115). 0101 stopped it shadowing a name pg_catalog defines; a name defined
 * nowhere earlier still fell through to it. A backend that can never create its
 * temporary schema has none to search: `pg_temp_nnn` «is always searched if it
 * exists» (PostgreSQL 17, «search_path»).
 *
 * THIS FILE WRITES NOTHING: every case that creates anything runs in a
 * transaction it rolls back. Each refusal runs on a fresh connection, so the
 * backend has no temporary schema yet and the error is the database-level one.
 */

const PRODUCT = "goproceed\\_%";
const NAMED = [
  "goproceed_app", "goproceed_app_login", "goproceed_service", "goproceed_service_login",
  "goproceed_worker", "goproceed_purge_worker", "goproceed_purge_worker_login",
];
const REFUSED = /permission denied to create temporary tables in database/;

let admin: Client;
beforeAll(async () => { admin = await adminClient(); });
afterAll(async () => { await admin.end(); });

describe("PUBLIC and the product roles hold no TEMPORARY on the database (DEV-060, INV-116)", () => {
  it("T1: the database ACL is explicit and grants PUBLIC no TEMPORARY", async () => {
    const r = await admin.query<{ explicit: boolean; public_temp: boolean }>(
      `select d.datacl is not null as explicit,
              exists (select 1 from pg_catalog.aclexplode(d.datacl) a
                       where a.grantee = 0 and a.privilege_type = 'TEMPORARY') as public_temp
         from pg_catalog.pg_database d where d.datname = pg_catalog.current_database()`);
    expect(r.rows).toEqual([{ explicit: true, public_temp: false }]);
  });

  it("T2: the seven product roles exist, and nothing a goproceed_* role can become or inherit holds TEMPORARY or is a superuser", async () => {
    const named = await admin.query<{ rolname: string }>(
      "select rolname from pg_catalog.pg_roles where rolname = any($1::text[]) order by 1", [NAMED]);
    expect(named.rows.map((r) => r.rolname)).toEqual([...NAMED].sort());
    const reach = await admin.query<{ product: string; via: string }>(
      `select p.rolname as product, x.rolname as via
         from pg_catalog.pg_roles p
         join pg_catalog.pg_roles x on pg_catalog.pg_has_role(p.oid, x.oid, 'MEMBER')
        where p.rolname like $1
          and (x.rolsuper or pg_catalog.has_database_privilege(x.oid, pg_catalog.current_database(), 'TEMPORARY'))
        order by 1, 2`, [PRODUCT]);
    expect(reach.rows).toEqual([]);
  });

  it("T3: no role holding TEMPORARY, short of a superuser or the database owner's rights, can become or inherit a product role", async () => {
    const r = await admin.query<{ member: string; product: string }>(
      `select m.rolname as member, p.rolname as product
         from pg_catalog.pg_roles p
         join pg_catalog.pg_roles m on m.oid <> p.oid and pg_catalog.pg_has_role(m.oid, p.oid, 'MEMBER')
         join pg_catalog.pg_database d on d.datname = pg_catalog.current_database()
        where p.rolname like $1 and m.rolname not like $1 and not m.rolsuper
          and pg_catalog.has_database_privilege(m.oid, d.oid, 'TEMPORARY')
          and not (pg_catalog.pg_has_role(m.oid, d.datdba, 'SET') or pg_catalog.pg_has_role(m.oid, d.datdba, 'USAGE'))
        order by 1, 2`, [PRODUCT]);
    expect(r.rows).toEqual([]);
  });
});

describe("a product session cannot create a temporary object (DEV-060, INV-116)", () => {
  type Login = "app" | "service" | "purge";
  const connect = (login: Login): Client =>
    login === "app" ? appClient() : login === "service" ? serviceClient() : purgeClient();

  /** On a fresh connection, optionally after SET ROLE, tries `sql`; returns the error and the session's temporary-schema state. */
  async function attempt(login: Login, role: string | null, sql: string): Promise<{ code: string; message: string; tempSchema: number; pathHasTemp: boolean }> {
    const c = connect(login);
    await c.connect();
    try {
      await c.query("begin");
      if (role) await c.query(`set local role ${role}`);
      await c.query("savepoint s");
      let code = "";
      let message = "";
      try { await c.query(sql); } catch (e) {
        code = (e as { code?: string }).code ?? "";
        message = (e as Error).message;
      }
      await c.query("rollback to savepoint s");
      const s = await c.query<{ temp_schema: number; path_has_temp: boolean }>(
        `select pg_catalog.pg_my_temp_schema()::pg_catalog.int4 as temp_schema,
                exists (select 1 from pg_catalog.unnest(pg_catalog.current_schemas(true)) n
                         where n::pg_catalog.text like 'pg\\_temp%') as path_has_temp`);
      const row = s.rows[0];
      if (!row) throw new Error("no row from the temporary-schema probe");
      return { code, message, tempSchema: row.temp_schema, pathHasTemp: row.path_has_temp };
    } finally {
      await c.query("rollback").catch(() => undefined);
      await c.end().catch(() => undefined);
    }
  }

  const cases: ReadonlyArray<readonly [Login, string | null]> = [
    ["app", null], ["service", null], ["purge", null],
    ["app", "goproceed_app"], ["service", "goproceed_service"], ["purge", "goproceed_purge_worker"],
  ];
  const statements = [
    "create temp table dev060_t (x pg_catalog.int4)",
    "create domain pg_temp.uuid as pg_catalog.uuid",
  ];

  for (const [login, role] of cases) {
    for (const sql of statements) {
      it(`T4: the ${login} login${role ? ` as ${role}` : ""} is refused «${sql.split(" (")[0]}»`, async () => {
        const r = await attempt(login, role, sql);
        expect(r.message).toMatch(REFUSED);
        expect(r.code).toBe("42501");
        expect(r.tempSchema).toBe(0);
        expect(r.pathHasTemp).toBe(false);
      });
    }
  }

  it("T5: positive control — the same statements succeed for the database owner", async () => {
    await admin.query("begin");
    try {
      await admin.query("create temp table dev060_t (x pg_catalog.int4)");
      await admin.query("create domain pg_temp.dev060_d as pg_catalog.uuid");
      const r = await admin.query<{ n: number }>("select count(*)::pg_catalog.int4 as n from pg_temp.dev060_t");
      expect(r.rows).toEqual([{ n: 0 }]);
    } finally {
      await admin.query("rollback");
    }
  });

  it("T7: a product role cannot add to a temporary schema another role created in the same backend", async () => {
    const c = superuserClient();
    await c.connect();
    try {
      await c.query("begin");
      await c.query("create temp table dev060_seed (x pg_catalog.int4)");
      await c.query("set local role goproceed_app");
      await c.query("savepoint s");
      let message = "";
      try { await c.query("create temp table dev060_t (x pg_catalog.int4)"); } catch (e) { message = (e as Error).message; }
      await c.query("rollback to savepoint s");
      expect(message).toMatch(/permission denied for schema pg_temp_/);
    } finally {
      await c.query("rollback").catch(() => undefined);
      await c.end().catch(() => undefined);
    }
  });
});

describe("the class stays closed (DEV-060, INV-116)", () => {
  it("T6: no role holding TEMPORARY, short of a superuser or the owner's rights, can reach a SECURITY DEFINER function in app, public or api", async () => {
    const r = await admin.query<{ holder: string; fn: string }>(
      `select distinct h.rolname as holder, p.oid::pg_catalog.regprocedure::pg_catalog.text as fn
         from pg_catalog.pg_database d
         join pg_catalog.pg_roles h on pg_catalog.has_database_privilege(h.oid, d.oid, 'TEMPORARY')
         join pg_catalog.pg_roles x on pg_catalog.pg_has_role(h.oid, x.oid, 'MEMBER')
         join pg_catalog.pg_proc p on p.prosecdef
         join pg_catalog.pg_namespace n on n.oid = p.pronamespace and n.nspname in ('app', 'public', 'api')
        where d.datname = pg_catalog.current_database()
          and not h.rolsuper and h.rolname !~ '^pg_'
          and not (pg_catalog.pg_has_role(h.oid, d.datdba, 'SET') or pg_catalog.pg_has_role(h.oid, d.datdba, 'USAGE'))
          and pg_catalog.has_schema_privilege(x.oid, n.oid, 'USAGE')
          and pg_catalog.has_function_privilege(x.oid, p.oid, 'EXECUTE')
          and not exists (select 1 from pg_catalog.pg_depend dep
                           where dep.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
                             and dep.objid = p.oid and dep.deptype = 'e')
        order by 1, 2`);
    expect(r.rows).toEqual([]);
  });

  // gp-security S1-03 / review R1-07: CREATE TEMP, SELECT … INTO TEMP, and any object named into pg_temp.
  // A statement assembled at run time (format(), concatenation) is out of its reach.
  it("T8: no function body in app, public or api creates a temporary object", async () => {
    const r = await admin.query<{ fn: string }>(
      `select p.oid::pg_catalog.regprocedure::pg_catalog.text as fn
         from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('app', 'public', 'api')
          and p.prosrc ~* '(create\\s+(local\\s+|global\\s+)?temp(orary)?\\M|\\minto\\s+temp(orary)?\\M|\\mpg_temp\\.)'
          and not exists (select 1 from pg_catalog.pg_depend dep
                           where dep.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
                             and dep.objid = p.oid and dep.deptype = 'e')
        order by 1`);
    expect(r.rows).toEqual([]);
  });
});
