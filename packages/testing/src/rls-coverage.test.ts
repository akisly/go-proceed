import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { adminClient } from "./pg";
import {
  EXPOSED_RELATIONS_SQL, IN_SCOPE_RELATIONS_SQL, PRINCIPALS, compareCoverage, exemptionPrivilegeSql,
  parseCoverageCsv, readCoverageRegistry, type CoverageRow, type ExposedPair,
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

  it("parses quoted CSV fields with commas and doubled quotes", () => {
    const rows = parseCoverageCsv(
      'schema,relation,principal,module,classification,positive_test,negative_test,backlog_id,reason\n'
      + 'public,a,goproceed_app,execution,gap,,,BL-001,"no read, no ""negative"""\n');
    expect(rows).toEqual([row({ relation: "a", classification: "gap", positive_test: "", negative_test: "", backlog_id: "BL-001", reason: 'no read, no "negative"' })]);
  });
});

describe("the coverage registry against this database", () => {
  let c: Client;
  beforeAll(async () => { c = await adminClient(); });
  afterAll(async () => { await c.end(); });

  const exposed = async (): Promise<ExposedPair[]> => (await c.query<ExposedPair>(EXPOSED_RELATIONS_SQL, [PRINCIPALS])).rows;
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

  it("among the five principals, only goproceed_service is a member of another (goproceed_app)", async () => {
    // Coverage is counted on DIRECT grants; inheritance would let a principal
    // reach a relation without a row. Pinning the graph keeps that honest.
    const r = await c.query<{ role: string; member: string }>(
      `select r.rolname as role, m.rolname as member
         from pg_auth_members a join pg_roles r on r.oid = a.roleid join pg_roles m on m.oid = a.member
        where r.rolname = any($1) and m.rolname = any($1) order by 1, 2`, [PRINCIPALS]);
    expect(r.rows).toEqual([{ role: "goproceed_app", member: "goproceed_service" }]);
  });
});
