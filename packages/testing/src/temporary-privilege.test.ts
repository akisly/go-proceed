import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
 * DEV-071 / BL-157: the catalog checks (T1, T2, T3, T6, T8) live in one file,
 * technical/database/checks/inv-116-temporary-privilege.sql, which this suite,
 * `pnpm db:catalog-snapshot` and the hosted comparison in infra/README-staging.md
 * §2.3 all run. Each row it returns is a violation; the negative controls below
 * show every check returns rows for its own violation.
 *
 * THIS FILE WRITES NOTHING: every case that creates anything runs in a
 * transaction it rolls back. Each refusal runs on a fresh connection, so the
 * backend has no temporary schema yet and the error is the database-level one.
 */

const NAMED = [
  "goproceed_app", "goproceed_app_login", "goproceed_service", "goproceed_service_login",
  "goproceed_worker", "goproceed_purge_worker", "goproceed_purge_worker_login",
];
const REFUSED = /permission denied to create temporary tables in database/;
const CHECKS_PATH = "technical/database/checks/inv-116-temporary-privilege.sql";

type Violation = { check_id: string; subject: string; detail: string };

let admin: Client;
let checksSql: string;
beforeAll(async () => {
  checksSql = readFileSync(join(import.meta.dirname, "..", "..", "..", CHECKS_PATH), "utf8");
  admin = await adminClient();
});
afterAll(async () => { await admin?.end(); });

const violations = async (c: Client, id: string): Promise<Violation[]> =>
  (await c.query<Violation>(checksSql)).rows.filter((r) => r.check_id === id);

describe("PUBLIC and the product roles hold no TEMPORARY on the database (DEV-060, INV-116)", () => {
  // Review DEV-071 R1-04: a check added to the file under a new id is still run here.
  it("the whole INV-116 check file returns no row", async () => {
    expect((await admin.query<Violation>(checksSql)).rows).toEqual([]);
  });

  it("T1: the database ACL is explicit and grants PUBLIC no TEMPORARY", async () => {
    expect(await violations(admin, "T1")).toEqual([]);
  });

  it("T2: the seven product roles exist, and nothing a goproceed_* role can become or inherit holds TEMPORARY or is a superuser", async () => {
    expect(await violations(admin, "T2")).toEqual([]);
  });

  it("T3: no role holding TEMPORARY, short of a superuser or the database owner's rights, can become or inherit a product role", async () => {
    expect(await violations(admin, "T3")).toEqual([]);
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
    expect(await violations(admin, "T6")).toEqual([]);
  });

  // gp-security S1-03 / review R1-07: CREATE TEMP, SELECT … INTO TEMP, and any object named into pg_temp.
  // A statement assembled at run time (format(), concatenation) is out of its reach.
  it("T8: no function body in app, public or api creates a temporary object", async () => {
    expect(await violations(admin, "T8")).toEqual([]);
  });
});

/**
 * DEV-071 / BL-157: each check in the shared file returns rows for the violation
 * it names. Every case plants the violation on the local superuser's connection
 * (superuserClient() refuses to run beside a URL for another database) and rolls
 * it back.
 */
describe("the INV-116 checks catch their own violations (DEV-071, BL-157)", () => {
  async function planted(setup: string[]): Promise<Violation[]> {
    const c = superuserClient();
    await c.connect();
    try {
      await c.query("begin");
      for (const sql of setup) await c.query(sql);
      return (await c.query<Violation>(checksSql)).rows;
    } finally {
      await c.query("rollback").catch(() => undefined);
      await c.end().catch(() => undefined);
    }
  }
  const subjects = (rows: Violation[], id: string) => rows.filter((r) => r.check_id === id).map((r) => r.subject);
  const grantOnDatabase = (grantee: string) =>
    `do $$ begin execute pg_catalog.format('grant temporary on database %I to ${grantee}', pg_catalog.current_database()); end $$`;

  it("N-T1: TEMPORARY granted back to PUBLIC raises T1, and T2 for every product role", async () => {
    const rows = await planted([grantOnDatabase("public")]);
    expect(subjects(rows, "T1")).toEqual(["PUBLIC"]);
    expect(new Set(subjects(rows, "T2"))).toEqual(new Set(NAMED));
  });

  // Review DEV-071 R1-02: the default-ACL arm of T1, which a logical restore produces.
  it("N-T1b: a default (NULL) database ACL raises T1 as the default", async () => {
    const rows = await planted([
      "update pg_catalog.pg_database set datacl = null where datname = pg_catalog.current_database()"]);
    expect(rows.filter((r) => r.check_id === "T1").map((r) => r.detail))
      .toEqual(["the database ACL is the default, which grants PUBLIC TEMPORARY"]);
  });

  // gp-security DEV-071 S1-05 / review R1-02: the arm that makes a run against the wrong project return rows.
  it("N-T2b: a missing product role raises T2 «product role missing»", async () => {
    const rows = await planted(["alter role goproceed_worker rename to dev071_gone"]);
    expect(rows.filter((r) => r.check_id === "T2"))
      .toEqual([{ check_id: "T2", subject: "goproceed_worker", detail: "product role missing" }]);
  });

  it("N-T2: TEMPORARY granted to goproceed_worker raises T2 for it", async () => {
    const rows = await planted([grantOnDatabase("goproceed_worker")]);
    expect(subjects(rows, "T1")).toEqual([]);
    expect(subjects(rows, "T2")).toEqual(["goproceed_worker"]);
  });

  // gp-security DEV-071 S1-04: operators planted in public for the catalog types cannot empty a check.
  it("N-shadow: operators planted in public do not hide T1 and T2", async () => {
    const rows = await planted([
      `create function public.dev071_never(pg_catalog.name, pg_catalog.text) returns pg_catalog.bool
         language sql immutable as $f$ select false $f$`,
      `create function public.dev071_never(pg_catalog.name, pg_catalog.name) returns pg_catalog.bool
         language sql immutable as $f$ select false $f$`,
      `create function public.dev071_never(pg_catalog.oid, pg_catalog.int4) returns pg_catalog.bool
         language sql immutable as $f$ select false $f$`,
      "create operator public.~~ (leftarg = pg_catalog.name, rightarg = pg_catalog.text, function = public.dev071_never)",
      "create operator public.~~ (leftarg = pg_catalog.name, rightarg = pg_catalog.name, function = public.dev071_never)",
      "create operator public.= (leftarg = pg_catalog.oid, rightarg = pg_catalog.int4, function = public.dev071_never)",
      grantOnDatabase("public")]);
    expect(subjects(rows, "T1")).toEqual(["PUBLIC"]);
    expect(new Set(subjects(rows, "T2"))).toEqual(new Set(NAMED));
  });

  it("N-T3: a role holding TEMPORARY that can become goproceed_worker raises T3", async () => {
    const rows = await planted([
      "create role dev071_m nologin", grantOnDatabase("dev071_m"), "grant goproceed_worker to dev071_m"]);
    expect(subjects(rows, "T3")).toEqual(["dev071_m"]);
    expect(subjects(rows, "T2")).toEqual([]);
  });

  it("N-T6: a definer in public that a TEMP holder can execute raises T6", async () => {
    const rows = await planted([
      `create function public.dev071_definer() returns pg_catalog.int4 language sql security definer
         set search_path = pg_catalog, pg_temp as $f$ select 1 $f$`,
      "revoke execute on function public.dev071_definer() from public, anon, service_role",
      "grant execute on function public.dev071_definer() to authenticated"]);
    // authenticated, and every TEMP holder that can become it (authenticator and two platform roles locally).
    expect(subjects(rows, "T6")).toContain("authenticated");
    expect(rows.filter((r) => r.check_id === "T6").every((r) => r.detail.endsWith("public.dev071_definer()"))).toBe(true);
  });

  it("N-T8: a function body that creates a temporary table raises T8", async () => {
    const rows = await planted([
      `create function public.dev071_temp() returns void language plpgsql
         set search_path = pg_catalog, pg_temp as $f$ begin create temp table x (a pg_catalog.int4); end $f$`]);
    expect(subjects(rows, "T8")).toEqual(["public.dev071_temp()"]);
  });
});
