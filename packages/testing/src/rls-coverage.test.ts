import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { adminClient } from "./pg";
import {
  BYPASS_ROLES, EXPOSED_RELATIONS_SQL, FOREIGN_GRANTEES_SQL, IN_SCOPE_RELATIONS_SQL, OWNER_WITHOUT_FORCED_RLS_SQL, PRINCIPALS,
  RLS_OFF_SQL, TRUNCATE_OR_TRIGGER_SQL, UNSAFE_VIEWS_SQL, WRITE_PRIVILEGES_SQL,
  compareCoverage, compareWriteCoverage, exemptionPrivilegeSql, parseCoverageCsv, parseWriteCoverageCsv, readCoverageRegistry,
  readWriteCoverageRegistry, type CoverageRow, type ExposedPair, type WriteCoverageRow, type WritePrivilege,
} from "./rls-coverage";

/**
 * READINESS GATE 11 — THE COVERAGE REGISTRY AGAINST THE RUNNING DATABASE (DEV-013, INV-060).
 *
 * `technical/database/rls-coverage.csv` names every relation this database
 * exposes to a tenant-facing principal, with the positive and negative policy
 * tests that cover it, or an explicit gap. The validator checks the registry
 * against the migrations and the test sources without a database; this file
 * checks it against what the database actually grants.
 *
 * It reads catalogs only. Its probes run inside one transaction that is rolled
 * back, and it never calls resetDb(), so it can run alone against a local stack.
 */

const row = (over: Partial<CoverageRow>): CoverageRow => ({
  schema: "public", relation: "t", principal: "goproceed_app", module: "execution",
  classification: "covered", positive_test: "p", negative_test: "n", backlog_id: "", reason: "", ...over,
});
const pair = (relation: string, principal = "goproceed_app", schema = "public"): ExposedPair => ({ schema, relation, principal });

describe("the coverage comparison, on fixtures", () => {
  it("reports an exposed relation the registry does not name", () => {
    const out = compareCoverage([row({ relation: "a" })], [pair("a"), pair("b")], ["public.a", "public.b"]);
    expect(out.unclassified).toEqual(["public.b goproceed_app"]);
  });

  it("reports a registry row the database does not expose", () => {
    const out = compareCoverage([row({ relation: "a" }), row({ relation: "gone" })], [pair("a")], ["public.a"]);
    expect(out.stale).toEqual(["public.gone goproceed_app"]);
  });

  it("reports an exempt relation that the database exposes", () => {
    const out = compareCoverage(
      [row({ relation: "x", principal: "none", classification: "exempt_no_grant", positive_test: "", negative_test: "", reason: "r" })],
      [pair("x")], ["public.x"]);
    expect(out.brokenExemptions).toEqual(["public.x"]);
    expect(out.unclassified).toEqual(["public.x goproceed_app"]);
  });

  it("reports an in-scope relation with no row at all, exposed or not", () => {
    const out = compareCoverage([row({ relation: "a" })], [pair("a")], ["public.a", "app.hidden"]);
    expect(out.unlisted).toEqual(["app.hidden"]);
  });

  it("reports an exemption for a relation the database does not have", () => {
    const out = compareCoverage(
      [row({ relation: "a" }), row({ relation: "gone", principal: "none", classification: "exempt_no_grant", positive_test: "", negative_test: "", reason: "r" })],
      [pair("a")], ["public.a"]);
    expect(out.stale).toEqual(["public.gone none"]);
  });

  it("parses quoted CSV fields with commas and doubled quotes", () => {
    const rows = parseCoverageCsv(
      'schema,relation,principal,module,classification,positive_test,negative_test,backlog_id,reason\n'
      + 'public,a,goproceed_app,execution,gap,,,BL-001,"no read, no ""negative"""\n');
    expect(rows).toEqual([row({ relation: "a", classification: "gap", positive_test: "", negative_test: "", backlog_id: "BL-001", reason: 'no read, no "negative"' })]);
  });
});

const wrow = (over: Partial<WriteCoverageRow>): WriteCoverageRow => ({
  schema: "public", relation: "t", principal: "goproceed_app", module: "execution", privileges: "INSERT",
  classification: "gap", negative_test: "", backlog_id: "BL-001", reason: "r", ...over,
});
const grant = (relation: string, privileges: string, principal = "goproceed_app"): WritePrivilege =>
  ({ schema: "public", relation, principal, privileges });

describe("the write coverage comparison, on fixtures (DEV-076)", () => {
  it("reports a covered pair holding a write that the write registry does not name", () => {
    const out = compareWriteCoverage([wrow({ relation: "a" })], [row({ relation: "a" }), row({ relation: "b" })],
      [grant("a", "INSERT"), grant("b", "UPDATE")]);
    expect(out.unclassified).toEqual(["public.b goproceed_app"]);
  });

  it("reports a write-registry row whose pair holds no write", () => {
    const out = compareWriteCoverage([wrow({ relation: "a" }), wrow({ relation: "gone" })],
      [row({ relation: "a" }), row({ relation: "gone" })], [grant("a", "INSERT")]);
    expect(out.stale).toEqual(["public.gone goproceed_app"]);
  });

  it("reports privileges that differ from the grant, a column-only grant included", () => {
    const out = compareWriteCoverage([wrow({ relation: "a", privileges: "INSERT|UPDATE" })], [row({ relation: "a" })],
      [grant("a", "INSERT|UPDATE(revoked_at version)")]);
    expect(out.mismatched).toEqual(["public.a goproceed_app: INSERT|UPDATE → INSERT|UPDATE(revoked_at version)"]);
  });

  it("reports a write row whose key is not covered, or is covered in another module", () => {
    const out = compareWriteCoverage(
      [wrow({ relation: "a" }), wrow({ relation: "b", module: "evidence" }), wrow({ relation: "c" })],
      [row({ relation: "a" }), row({ relation: "b" }), row({ relation: "c", classification: "gap" })],
      [grant("a", "INSERT"), grant("b", "INSERT"), grant("c", "INSERT")]);
    expect(out.notCovered).toEqual(["public.b goproceed_app", "public.c goproceed_app"]);
  });

  it("parses the write registry's header and quoted fields", () => {
    const rows = parseWriteCoverageCsv(
      "schema,relation,principal,module,privileges,classification,negative_test,backlog_id,reason\n"
      + 'public,a,goproceed_app,execution,INSERT|UPDATE(b c),gap,,BL-001,"no write, yet"\n');
    expect(rows).toEqual([wrow({ relation: "a", privileges: "INSERT|UPDATE(b c)", reason: "no write, yet" })]);
    expect(() => parseWriteCoverageCsv("schema,relation\n")).toThrow("header must be");
  });
});

describe("the coverage registry against this database", () => {
  let c: Client;
  beforeAll(async () => { c = await adminClient(); });
  afterAll(async () => { await c.end(); });

  const exposed = async (): Promise<ExposedPair[]> => (await c.query<ExposedPair>(EXPOSED_RELATIONS_SQL, [PRINCIPALS])).rows;
  const covered = () => readCoverageRegistry().find((r) => r.classification === "covered" && r.schema === "public")!;
  const inTransaction = async (fn: () => Promise<void>) => {
    await c.query("begin");
    try { await fn(); } finally { await c.query("rollback"); }
  };
  const inScope = async (): Promise<string[]> => (await c.query<{ name: string }>(IN_SCOPE_RELATIONS_SQL)).rows.map((r) => r.name);

  it("an exposed table the registry does not name is reported, inside a rolled-back transaction", async () => {
    await c.query("begin");
    try {
      await c.query("create table public._rls_coverage_probe (workspace_id uuid)");
      await c.query("alter table public._rls_coverage_probe enable row level security");
      await c.query("grant select on public._rls_coverage_probe to goproceed_app");
      const out = compareCoverage(readCoverageRegistry(), await exposed(), await inScope());
      expect(out.unclassified).toContain("public._rls_coverage_probe goproceed_app");
      expect(out.unlisted).toContain("public._rls_coverage_probe");
    } finally {
      await c.query("rollback");
    }
  });

  it("a grant on an exempt table breaks its exemption, inside a rolled-back transaction", async () => {
    const exempt = readCoverageRegistry().find((r) => r.classification === "exempt_no_grant");
    expect(exempt, "the registry holds at least one exemption").toBeDefined();
    await c.query("begin");
    try {
      await c.query(`grant select on ${exempt!.schema}.${exempt!.relation} to goproceed_app`);
      const priv = await c.query<{ principal: string }>(exemptionPrivilegeSql(), [`${exempt!.schema}.${exempt!.relation}`, PRINCIPALS]);
      expect(priv.rows.map((r) => r.principal)).toContain("goproceed_app");
      const out = compareCoverage(readCoverageRegistry(), await exposed(), await inScope());
      expect(out.brokenExemptions).toContain(`${exempt!.schema}.${exempt!.relation}`);
    } finally {
      await c.query("rollback");
    }
  });

  it("a policy naming goproceed_service on a table granted only to goproceed_app exposes it to the service, inside a rolled-back transaction", async () => {
    await inTransaction(async () => {
      await c.query("create table public._rls_coverage_probe (workspace_id uuid)");
      await c.query("alter table public._rls_coverage_probe enable row level security");
      await c.query("grant select on public._rls_coverage_probe to goproceed_app");
      await c.query("create policy probe_service on public._rls_coverage_probe for select to goproceed_service using (true)");
      expect((await exposed()).map((x) => `${x.schema}.${x.relation} ${x.principal}`))
        .toEqual(expect.arrayContaining(["public._rls_coverage_probe goproceed_app", "public._rls_coverage_probe goproceed_service"]));
    });
  });

  it("a grant to PUBLIC exposes a covered table to every principal, inside a rolled-back transaction", async () => {
    const t = covered();
    await inTransaction(async () => {
      await c.query(`grant select on ${t.schema}.${t.relation} to public`);
      const out = compareCoverage(readCoverageRegistry(), await exposed(), await inScope());
      expect(out.unclassified).toEqual(expect.arrayContaining([`${t.schema}.${t.relation} anon`, `${t.schema}.${t.relation} authenticated`]));
    });
  });

  it("owning a table exposes it to its owner, inside a rolled-back transaction", async () => {
    await inTransaction(async () => {
      await c.query("create table public._rls_coverage_probe (workspace_id uuid)");
      await c.query("alter table public._rls_coverage_probe enable row level security");
      // postgres may SET ROLE only to anon and authenticated among the five (pg_auth_members.set_option).
      // A new owner needs CREATE on the schema; the grant is rolled back with the probe.
      await c.query("grant create on schema public to authenticated");
      await c.query("alter table public._rls_coverage_probe owner to authenticated");
      expect((await exposed()).map((x) => `${x.schema}.${x.relation} ${x.principal}`)).toContain("public._rls_coverage_probe authenticated");
    });
  });

  it("a direct grant to a role outside the five and the bypass roles is reported, inside a rolled-back transaction", async () => {
    const t = covered();
    await inTransaction(async () => {
      await c.query(`grant select on ${t.schema}.${t.relation} to authenticator`);
      const r = await c.query<{ name: string; grantee: string }>(FOREIGN_GRANTEES_SQL, [[...PRINCIPALS, ...BYPASS_ROLES]]);
      expect(r.rows).toContainEqual({ name: `${t.schema}.${t.relation}`, grantee: "authenticator" });
    });
  });

  it("row level security switched off on a listed relation is reported, inside a rolled-back transaction", async () => {
    const t = covered();
    await inTransaction(async () => {
      await c.query(`alter table ${t.schema}.${t.relation} disable row level security`);
      const r = await c.query<{ name: string }>(RLS_OFF_SQL, [[`${t.schema}.${t.relation}`]]);
      expect(r.rows.map((x) => x.name)).toEqual([`${t.schema}.${t.relation}`]);
    });
  });

  it("a table owned outside the bypass roles without forced RLS is reported, inside a rolled-back transaction", async () => {
    await inTransaction(async () => {
      await c.query("create table public._rls_coverage_probe (workspace_id uuid)");
      await c.query("alter table public._rls_coverage_probe enable row level security");
      await c.query("grant create on schema public to authenticated");
      await c.query("alter table public._rls_coverage_probe owner to authenticated");
      const r = await c.query<{ name: string }>(OWNER_WITHOUT_FORCED_RLS_SQL, [BYPASS_ROLES]);
      expect(r.rows.map((x) => x.name)).toContain("public._rls_coverage_probe");
    });
  });

  it("a view in public without security_invoker is reported, inside a rolled-back transaction", async () => {
    await inTransaction(async () => {
      await c.query("create view public._rls_coverage_probe_view as select 1 as one");
      const r = await c.query<{ name: string }>(UNSAFE_VIEWS_SQL);
      expect(r.rows.map((x) => x.name)).toContain("public._rls_coverage_probe_view");
    });
  });

  const writes = async (): Promise<WritePrivilege[]> => {
    const covered = readCoverageRegistry().filter((r) => r.classification === "covered");
    return (await c.query<WritePrivilege>(WRITE_PRIVILEGES_SQL, [
      covered.map((r) => r.schema), covered.map((r) => r.relation), covered.map((r) => r.principal),
    ])).rows;
  };

  it("a column UPDATE granted on a covered table without writes is reported, inside a rolled-back transaction", async () => {
    // DEV-076: a column-level grant is a write the table-level privilege does
    // not show, which is how `project_access_grants`' UPDATE(revoked_at version) looks.
    await inTransaction(async () => {
      await c.query("grant update (original_filename) on public.evidence_objects to goproceed_app");
      const out = compareWriteCoverage(readWriteCoverageRegistry(), readCoverageRegistry(), await writes());
      expect(out.unclassified).toContain("public.evidence_objects goproceed_app");
      expect((await writes()).find((w) => w.relation === "evidence_objects" && w.principal === "goproceed_app")?.privileges)
        .toBe("UPDATE(original_filename)");
    });
  });

  it("a TRUNCATE granted on a covered table is reported, inside a rolled-back transaction", async () => {
    const t = covered();
    await inTransaction(async () => {
      await c.query(`grant truncate on ${t.schema}.${t.relation} to goproceed_app`);
      const r = await c.query<{ name: string; principal: string }>(TRUNCATE_OR_TRIGGER_SQL, [PRINCIPALS]);
      expect(r.rows).toContainEqual({ name: `${t.schema}.${t.relation}`, principal: "goproceed_app" });
    });
  });

  it("the write-holding covered pairs equal the write registry, both ways", async () => {
    // DEV-076 (BL-099): every covered pair holding INSERT, UPDATE or DELETE has
    // a row stating that write, and every row still holds exactly that write.
    const out = compareWriteCoverage(readWriteCoverageRegistry(), readCoverageRegistry(), await writes());
    expect(out).toEqual({ unclassified: [], stale: [], mismatched: [], notCovered: [] });
  });

  it("no principal holds TRUNCATE or TRIGGER on an in-scope relation", async () => {
    // Row level security does not apply to TRUNCATE, so a policy test proves
    // nothing about it; the minimum is that no principal holds it (DEV-076).
    const r = await c.query<{ name: string; principal: string }>(TRUNCATE_OR_TRIGGER_SQL, [PRINCIPALS]);
    expect(r.rows).toEqual([]);
  });

  it("the exposed set equals the registry, both ways", async () => {
    const out = compareCoverage(readCoverageRegistry(), await exposed(), await inScope());
    expect({ unclassified: out.unclassified, stale: out.stale, unlisted: out.unlisted, brokenExemptions: out.brokenExemptions })
      .toEqual({ unclassified: [], stale: [], unlisted: [], brokenExemptions: [] });
  });

  it("no principal holds any privilege, direct or inherited, on an exempt relation", async () => {
    const exemptions = readCoverageRegistry().filter((r) => r.classification === "exempt_no_grant");
    const holders: string[] = [];
    for (const e of exemptions) {
      const r = await c.query<{ principal: string }>(exemptionPrivilegeSql(), [`${e.schema}.${e.relation}`, PRINCIPALS]);
      for (const x of r.rows) holders.push(`${e.schema}.${e.relation} ${x.principal}`);
    }
    expect(holders).toEqual([]);
  });

  it("no role outside the five principals and the bypass roles holds a direct grant on an in-scope relation", async () => {
    const r = await c.query<{ name: string; grantee: string }>(FOREIGN_GRANTEES_SQL, [[...PRINCIPALS, ...BYPASS_ROLES]]);
    expect(r.rows).toEqual([]);
  });

  it("every in-scope relation is owned by a bypass role, or forces row level security on its owner", async () => {
    // An owner bypasses its own table's policies unless FORCE ROW LEVEL SECURITY
    // is set, so a policy test would prove nothing for an owning principal.
    const r = await c.query<{ name: string }>(OWNER_WITHOUT_FORCED_RLS_SQL, [BYPASS_ROLES]);
    expect(r.rows).toEqual([]);
  });

  it("no view or materialized view in public or app runs without security_invoker", async () => {
    // A view runs as its owner unless it is security_invoker, and a
    // materialized view has no row level security at all.
    const r = await c.query<{ name: string }>(UNSAFE_VIEWS_SQL);
    expect(r.rows).toEqual([]);
  });

  it("row level security is on for every relation the registry lists", async () => {
    const tables = readCoverageRegistry().filter((x) => x.schema !== "api").map((x) => `${x.schema}.${x.relation}`);
    const r = await c.query<{ name: string }>(RLS_OFF_SQL, [[...new Set(tables)]]);
    expect(r.rows).toEqual([]);
  });

  it("the five principals' role memberships are exactly one — goproceed_service in goproceed_app — and none bypasses RLS", async () => {
    // Exposure counts direct grants, grants to PUBLIC, ownership, and policies
    // naming a principal it can reach; any other inheritance would let a
    // principal reach a relation without a row, so every membership is pinned.
    const r = await c.query<{ role: string; member: string }>(
      `select r.rolname as role, m.rolname as member
         from pg_auth_members a join pg_roles r on r.oid = a.roleid join pg_roles m on m.oid = a.member
        where m.rolname = any($1) order by 1, 2`, [PRINCIPALS]);
    expect(r.rows).toEqual([{ role: "goproceed_app", member: "goproceed_service" }]);
    const attrs = await c.query<{ rolname: string }>(
      "select rolname from pg_roles where rolname = any($1) and (rolsuper or rolbypassrls) order by 1", [PRINCIPALS]);
    expect(attrs.rows).toEqual([]);
  });
});
