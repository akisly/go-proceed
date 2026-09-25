import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, dropWorkspaces, superuserClient } from "./pg";
import { seedRuleVersion, seedRulesWorld } from "./m1-rules-fixture";

/**
 * THE CROSS-WORKSPACE WRITE MINIMUM, MODULE contract_baseline (DEV-079, BL-166).
 *
 * DEV-076 widened a `covered` row of technical/database/rls-coverage.csv: where
 * its principal can write, a test must show a member of one workspace cannot
 * write into another. Every row of this module is goproceed_app on the member
 * plane. One test per row of technical/database/rls-write-coverage.csv, each
 * cited there as its `negative_test`. Per privilege the row holds:
 *
 *   - INSERT carrying B's tenant key and parent ids: refused by the policy
 *     (42501), beside the same statement with A's ids succeeding (the control);
 *   - INSERT keeping A's tenant key with one of B's parent ids: refused by that
 *     parent's composite foreign key (23503, named), or by the policy (42501)
 *     where the policy itself reads the parent (the import rows read their
 *     batch); for those, B's tenant key with A's batch is refused too;
 *   - UPDATE and DELETE reading no column (no WHERE, a constant SET, no
 *     RETURNING): the row count equals A's rows the policy admits (at least
 *     one; a version or a line only while its version is a draft), those rows
 *     change, and B's rows read back unchanged as admin in the same transaction;
 *   - moving A's rows into B (tenant key, project and parents), again reading no
 *     column: refused by the policy (42501). A move-out with a WHERE is refused
 *     by the SELECT policy applied to the new row even under `WITH CHECK
 *     (true)` (DEV-077 C1);
 *   - moving one parent column alone to B's, within A: refused by the composite
 *     foreign key (23503, named, INV-001).
 *
 * The actor is the owner of A throughout, declaring A, holding every project
 * capability these policies ask for (the rules world grants six); so a refusal
 * of B's ids cannot come from a missing grant, and the control, with A's ids,
 * succeeds.
 *
 * Every probe runs on the local superuser connection in one transaction that
 * is always rolled back: each statement runs inside a savepoint under `SET
 * LOCAL ROLE goproceed_app` with the actor's GUCs, and the admin read-back
 * runs after `RESET ROLE` in the same transaction. A trigger's refusal does not
 * count (owner, 2026-09-24): the binding guards (BEFORE INSERT, reading the
 * version and the rule version under the actor's RLS), the version guard and
 * the line guards (BEFORE UPDATE OR DELETE) have their user triggers disabled
 * inside the probe's transaction (`DISABLE TRIGGER USER`), and the rollback
 * re-enables them; the test then asserts they are enabled.
 *
 * 0105 withdrew the UPDATE grants on locations and unit_definitions and dropped
 * their policies, which no route used (owner, 2026-09-25); their tests assert
 * the privilege refusal, so a grant coming back fails here as well as in
 * rls-coverage.test.ts.
 *
 * The fixture is this file's own (ids `de079…`), dropped before and after. No
 * resetDb.
 */
const WS_A = "de079a00-0000-4000-8000-000000000001";
const WS_B = "de079b00-0000-4000-8000-000000000001";
const USER_A = "de079a00-0000-4000-8000-0000000000a1";
const USER_B = "de079b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];

interface Side {
  ws: string; user: string; member: string; project: string; contract: string;
  own: string; customer: string; published: string; draft: string; batch: string;
  draftLine: string; unit: string; file: string; row2: string; location: string;
  rule: string; ruleVersion: string; stageKey: string;
}

/**
 * `reason` separates the two refusals SQLSTATE 42501 names: `policy` — «violates
 * row-level security policy»; `privilege` — «permission denied». `constraint`
 * names the constraint a 23503 came from.
 */
interface Outcome {
  rowCount: number | null; code: string | null;
  reason: "policy" | "privilege" | "other" | null; constraint: string | null;
}

const refusedByPolicy: Outcome = { rowCount: null, code: "42501", reason: "policy", constraint: null };
const refusedByPrivilege: Outcome = { rowCount: null, code: "42501", reason: "privilege", constraint: null };
const inserted: Outcome = { rowCount: 1, code: null, reason: null, constraint: null };
const changed = (rowCount: number): Outcome => ({ rowCount, code: null, reason: null, constraint: null });
const byForeignKey = (constraint: string): Outcome => ({ rowCount: null, code: "23503", reason: "other", constraint });

let admin: Client;
let A: Side;
let B: Side;

const hashOf = (label: string): string => createHash("sha256").update(`dev079:${label}`).digest("hex");

async function one<T extends Record<string, unknown>>(sql: string, params: unknown[]): Promise<T> {
  const r = await admin.query<T>(sql, params);
  if (!r.rows[0]) throw new Error(`fixture: no row from ${sql}`);
  return r.rows[0];
}

/** The rules world (contract, both versions and their lines, batch, unit), plus one row of each import relation and a location. */
async function seedSide(ws: string, user: string, suffix: string): Promise<Side> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const parties = await one<{ own: string; customer: string }>(
    "select own_party_id as own, customer_party_id as customer from public.contracts where id = $1", [rules.contractId]);
  const batch = (await one<{ id: string }>(
    "select id from public.import_batches where workspace_id = $1", [ws])).id;
  const file = (await one<{ id: string }>(
    `insert into public.import_files
       (workspace_id, import_batch_id, filename, byte_size, content_hash, detected_format,
        storage_key, source_bytes, uploaded_by)
     values ($1, $2, 'приклад.csv', 3, $3, 'csv', $4, '\\x616263', $5) returning id`,
    [ws, batch, hashOf(`${ws}:file`), `dev079://${randomUUID()}`, user])).id;
  const row = async (sourceRow: number) => (await one<{ id: string }>(
    `insert into public.import_row_results
       (workspace_id, import_batch_id, import_file_id, attempt, source_row, source_cells,
        severity, parser_version, mapping_version)
     values ($1, $2, $3, 1, $4, '{}'::jsonb, 'ok', 'dev079', 1) returning id`,
    [ws, batch, file, sourceRow])).id;
  const row1 = await row(1);
  // Row 2 stays unresolved: the target of the resolution control.
  const row2 = await row(2);
  await admin.query(
    `insert into public.source_amount_resolutions
       (workspace_id, import_batch_id, row_result_id, chosen_basis, reason, source_amount_minor_units, resolved_by)
     values ($1, $2, $3, 'approved_source_amount', 'Приклад-підстава', 100, $4)`, [ws, batch, row1, user]);
  const location = (await one<{ id: string }>(
    "insert into public.locations (workspace_id, project_id, name, created_by) values ($1, $2, 'Приклад-ділянка', $3) returning id",
    [ws, rules.projectId, user])).id;
  const rv = await seedRuleVersion(admin, rules);
  return {
    ws, user, member: rules.memberId, project: rules.projectId, contract: rules.contractId,
    own: parties.own, customer: parties.customer, published: rules.publishedVersionId,
    draft: rules.draftVersionId, batch, draftLine: rules.draftWorkItemId, unit: rules.unitId,
    file, row2, location, rule: rv.requirementRuleId, ruleVersion: rv.ruleVersionId, stageKey: rv.stageKey,
  };
}

/** One probe: a transaction on the superuser connection, always rolled back. */
interface Probe {
  /** A statement as the owner of A under goproceed_app, declaring A; its row count, or its refusal. */
  as(sql: string, params?: unknown[]): Promise<Outcome>;
  /** A statement as the superuser, in the same transaction. */
  admin<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

async function probe(body: (p: Probe) => Promise<void>, disableTriggersOn: string[] = []): Promise<void> {
  const c = superuserClient();
  await c.connect();
  try {
    await c.query("begin");
    for (const table of disableTriggersOn) await c.query(`alter table public.${table} disable trigger user`);
    const p: Probe = {
      async as(sql, params = []) {
        await c.query("savepoint probe");
        await c.query("set local role goproceed_app");
        await c.query("select set_config('app.actor_user_id', $1, true), set_config('app.organization_id', $2, true)", [USER_A, WS_A]);
        try {
          const r = await c.query(sql, params);
          await c.query("release savepoint probe");
          await c.query("reset role");
          return { rowCount: r.rowCount, code: null, reason: null, constraint: null };
        } catch (e) {
          await c.query("rollback to savepoint probe");
          await c.query("reset role");
          const { code, message, constraint } = e as { code?: string; message?: string; constraint?: string };
          const reason = /row-level security policy/.test(message ?? "") ? "policy"
            : /permission denied/.test(message ?? "") ? "privilege" : "other";
          return { rowCount: null, code: code ?? "unknown", reason, constraint: constraint ?? null };
        }
      },
      async admin(sql, params = []) {
        return (await c.query(sql, params)).rows;
      },
    };
    await body(p);
  } finally {
    await c.query("rollback").catch(() => undefined);
    await c.end().catch(() => undefined);
  }
}

/** Every row of `table` in workspace `ws` as JSON text, sorted: the read-back that must not change. */
async function snapshot(p: Probe, table: string, ws: string): Promise<string[]> {
  const rows = await p.admin<{ j: string }>(
    `select to_jsonb(t)::text as j from public.${table} t where t.workspace_id = $1 order by 1`, [ws]);
  return rows.map((r) => r.j);
}

/**
 * One INSERT statement taking a side's ids, run as the owner of A: with B's
 * ids, with each `mixed` parameter list, and with A's ids (the control).
 */
async function insertOutcomes(
  sql: string, params: (s: Side) => unknown[], mixed: unknown[][], disable: string[] = [],
): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  await probe(async (p) => {
    outcomes.push(await p.as(sql, params(B)));
    for (const m of mixed) outcomes.push(await p.as(sql, m));
    outcomes.push(await p.as(sql, params(A)));
  }, disable);
  return outcomes;
}

/**
 * A statement reading no column (an UPDATE or a DELETE), run as the owner of A:
 * its outcome, how many of A's rows changed (by content or by count), and
 * whether B's rows read back unchanged.
 */
async function confined(table: string, sql: string, disable: string[] = []):
Promise<{ outcome: Outcome; aChanged: number; bUnchanged: boolean }> {
  let result = { outcome: changed(-1), aChanged: -1, bUnchanged: false };
  await probe(async (p) => {
    const beforeA = await snapshot(p, table, WS_A);
    const beforeB = await snapshot(p, table, WS_B);
    const outcome = await p.as(sql);
    const afterA = await snapshot(p, table, WS_A);
    const kept = afterA.filter((row) => beforeA.includes(row)).length;
    result = {
      outcome, aChanged: beforeA.length - kept,
      bUnchanged: JSON.stringify(await snapshot(p, table, WS_B)) === JSON.stringify(beforeB),
    };
  }, disable);
  return result;
}

/** The move-outs: each statement's outcome, and whether B's rows read back unchanged afterwards. */
async function moveOutcomes(table: string, statements: [string, unknown[]][], disable: string[] = []):
Promise<{ outcomes: Outcome[]; bUnchanged: boolean }> {
  let result = { outcomes: [] as Outcome[], bUnchanged: false };
  await probe(async (p) => {
    const before = await snapshot(p, table, WS_B);
    const outcomes: Outcome[] = [];
    for (const [sql, params] of statements) outcomes.push(await p.as(sql, params));
    result = { outcomes, bUnchanged: JSON.stringify(await snapshot(p, table, WS_B)) === JSON.stringify(before) };
  }, disable);
  return result;
}

async function triggersEnabled(table: string): Promise<string[]> {
  const r = await admin.query<{ s: string }>(
    `select tgenabled::text as s from pg_trigger where tgrelid = ('public.' || $1)::regclass and not tgisinternal`, [table]);
  return r.rows.map((row) => row.s);
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  A = await seedSide(WS_A, USER_A, "DEV079-A");
  B = await seedSide(WS_B, USER_B, "DEV079-B");
  // Premise: each owner holds the rules world's six capabilities on its project.
  const held = await admin.query<{ n: string }>(
    "select count(*) as n from public.project_access_grants where workspace_id = any($1) and revoked_at is null", [BOTH]);
  expect(Number(held.rows[0]?.n)).toBe(12);
}, 180_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("contract_baseline cross-workspace write denial", () => {
  it("contract_version_rule_bindings: an owner of A cannot bind a rule version into B", async () => {
    // The binding guards read the version and the rule version under the
    // actor's RLS and would refuse B's ids before the policy is asked.
    const insert = `insert into public.contract_version_rule_bindings
        (workspace_id, project_id, contract_id, contract_version_id, requirement_rule_id,
         requirement_rule_version_id, stage_key, bound_by_member_id)
      values ($1, $2, $3, $4, $5, $6, $7, $8)`;
    expect(await insertOutcomes(insert,
      (s) => [s.ws, s.project, s.contract, s.draft, s.rule, s.ruleVersion, s.stageKey, s.member],
      [[WS_A, A.project, A.contract, B.draft, A.rule, A.ruleVersion, A.stageKey, A.member],
       [WS_A, A.project, A.contract, A.draft, A.rule, A.ruleVersion, A.stageKey, B.member]],
      ["contract_version_rule_bindings"]))
      .toEqual([
        refusedByPolicy,
        byForeignKey("contract_version_rule_binding_workspace_id_project_id_cont_fkey"),
        byForeignKey("contract_version_rule_binding_workspace_id_bound_by_member_fkey"),
        inserted,
      ]);
    expect(await triggersEnabled("contract_version_rule_bindings")).toEqual(["O", "O", "O"]);
  });

  it("contract_versions: an owner of A cannot insert or update a version of B or move one there", async () => {
    const draft = `insert into public.contract_versions
        (workspace_id, project_id, contract_id, version_no, status, origin,
         own_party_snapshot, customer_party_snapshot, currency, tax_mode, tax_rate_bps,
         terms, approval_policy, rounding_policy, source_tolerance_minor_units, source_tolerance_bps,
         import_batch_id, source_manifest_hash, supersedes_version_id, created_by, published_by, published_at)
      values ($1, $2, $3, 3, 'draft', 'manual', '{}'::jsonb, '{}'::jsonb, 'UAH', 'exclusive', 2000,
              '{}'::jsonb, '{}'::jsonb, '{"midpoint":"half_up"}'::jsonb, 100, 10,
              null, null, $4, $5, null, null)`;
    expect(await insertOutcomes(draft,
      (s) => [s.ws, s.project, s.contract, s.published, USER_A],
      [[WS_A, A.project, A.contract, B.published, USER_A]]))
      .toEqual([refusedByPolicy, byForeignKey("contract_versions_workspace_id_contract_id_supersedes_vers_fkey"), inserted]);
    // The published arm of cv_insert asks for another capability, so it gets its own probe.
    const published = `insert into public.contract_versions
        (workspace_id, project_id, contract_id, version_no, status, origin,
         own_party_snapshot, customer_party_snapshot, currency, tax_mode, tax_rate_bps,
         terms, approval_policy, rounding_policy, source_tolerance_minor_units, source_tolerance_bps,
         import_batch_id, source_manifest_hash, published_by)
      values ($1, $2, $3, 4, 'published', 'import', '{}'::jsonb, '{}'::jsonb, 'UAH', 'exclusive', 2000,
              '{}'::jsonb, '{}'::jsonb, '{"midpoint":"half_up"}'::jsonb, 100, 10,
              $4, repeat('c', 64), $5)`;
    expect(await insertOutcomes(published,
      (s) => [s.ws, s.project, s.contract, s.batch, USER_A],
      [[WS_A, A.project, A.contract, B.batch, USER_A]]))
      .toEqual([refusedByPolicy, byForeignKey("contract_versions_workspace_id_import_batch_id_fkey"), inserted]);
    // The version guard admits only draft → published; with it off, the policy
    // alone must confine. cv_update admits a draft only: one row of A.
    expect(await confined("contract_versions",
      "update public.contract_versions set terms = '{\"dev079\":\"probe\"}'::jsonb", ["contract_versions"]))
      .toEqual({ outcome: changed(1), aChanged: 1, bUnchanged: true });
    expect(await moveOutcomes("contract_versions", [
      ["update public.contract_versions set workspace_id = $1, project_id = $2, contract_id = $3, supersedes_version_id = $4, version_no = 424242",
        [WS_B, B.project, B.contract, B.published]],
      ["update public.contract_versions set supersedes_version_id = $1", [B.published]],
    ], ["contract_versions"]))
      .toEqual({
        outcomes: [refusedByPolicy, byForeignKey("contract_versions_workspace_id_contract_id_supersedes_vers_fkey")],
        bUnchanged: true,
      });
    expect(await triggersEnabled("contract_versions")).toEqual(["O"]);
  });

  it("contracts: an owner of A cannot insert or update a contract of B or move one there", async () => {
    let n = 0;
    const insert = `insert into public.contracts
        (workspace_id, project_id, own_party_id, customer_party_id, contract_no,
         currency, tax_mode, tax_rate_bps, rounding_policy, created_by)
      values ($1, $2, $3, $4, $5, 'UAH', 'exclusive', 2000,
              '{"midpoint":"half_up","scope":"work_item_version_pool"}'::jsonb, $6)`;
    expect(await insertOutcomes(insert,
      (s) => [s.ws, s.project, s.own, s.customer, `ПР-DEV079-проба-${n++}`, USER_A],
      [[WS_A, A.project, A.own, B.customer, "ПР-DEV079-проба-змішаний", USER_A]]))
      .toEqual([refusedByPolicy, byForeignKey("contracts_workspace_id_customer_party_id_fkey"), inserted]);
    expect(await confined("contracts", "update public.contracts set version = 424242"))
      .toEqual({ outcome: changed(1), aChanged: 1, bUnchanged: true });
    expect(await moveOutcomes("contracts", [
      ["update public.contracts set workspace_id = $1, project_id = $2, own_party_id = $3, customer_party_id = $4",
        [WS_B, B.project, B.own, B.customer]],
      ["update public.contracts set customer_party_id = $1", [B.customer]],
    ]))
      .toEqual({ outcomes: [refusedByPolicy, byForeignKey("contracts_workspace_id_customer_party_id_fkey")], bUnchanged: true });
  });

  it("import_batches: an owner of A cannot insert or update an import batch of B or move one there", async () => {
    expect(await insertOutcomes(
      "insert into public.import_batches (workspace_id, project_id, contract_id, created_by) values ($1, $2, $3, $4)",
      (s) => [s.ws, s.project, s.contract, USER_A],
      [[WS_A, A.project, B.contract, USER_A]]))
      .toEqual([refusedByPolicy, byForeignKey("import_batches_workspace_id_project_id_contract_id_fkey"), inserted]);
    expect(await confined("import_batches", "update public.import_batches set version = 424242"))
      .toEqual({ outcome: changed(1), aChanged: 1, bUnchanged: true });
    expect(await moveOutcomes("import_batches", [
      ["update public.import_batches set workspace_id = $1, project_id = $2, contract_id = $3", [WS_B, B.project, B.contract]],
      ["update public.import_batches set contract_id = $1", [B.contract]],
      ["update public.import_batches set published_version_id = $1", [B.published]],
    ]))
      .toEqual({
        outcomes: [
          refusedByPolicy,
          byForeignKey("import_batches_workspace_id_project_id_contract_id_fkey"),
          byForeignKey("import_batches_published_version_fk"),
        ],
        bUnchanged: true,
      });
  });

  it("import_files: an owner of A cannot insert an import file into B or onto B's batch", async () => {
    let n = 0;
    const insert = `insert into public.import_files
        (workspace_id, import_batch_id, filename, byte_size, content_hash, detected_format,
         storage_key, source_bytes, uploaded_by)
      values ($1, $2, 'приклад-проба.csv', 3, $3, 'csv', $4, '\\x616263', $5)`;
    // The policy reads the batch, so a foreign batch under A's key is its refusal
    // too; B's key over A's batch is the probe for its tenant comparison.
    expect(await insertOutcomes(insert,
      (s) => [s.ws, s.batch, hashOf(`probe:file:${n++}`), `dev079://${randomUUID()}`, USER_A],
      [[WS_A, B.batch, hashOf("probe:file:mixed"), `dev079://${randomUUID()}`, USER_A],
       [WS_B, A.batch, hashOf("probe:file:cross"), `dev079://${randomUUID()}`, USER_A]]))
      .toEqual([refusedByPolicy, refusedByPolicy, refusedByPolicy, inserted]);
  });

  it("import_row_results: an owner of A cannot insert a row result into B or onto B's batch or file", async () => {
    const insert = `insert into public.import_row_results
        (workspace_id, import_batch_id, import_file_id, attempt, source_row, source_cells,
         severity, parser_version, mapping_version)
      values ($1, $2, $3, 1, 3, '{}'::jsonb, 'ok', 'dev079', 1)`;
    expect(await insertOutcomes(insert,
      (s) => [s.ws, s.batch, s.file],
      [[WS_A, B.batch, B.file], [WS_A, A.batch, B.file], [WS_B, A.batch, A.file]]))
      .toEqual([
        refusedByPolicy, refusedByPolicy,
        byForeignKey("import_row_results_workspace_id_import_batch_id_import_fil_fkey"),
        refusedByPolicy, inserted,
      ]);
  });

  it("source_amount_resolutions: an owner of A cannot insert a resolution into B or onto B's batch or row", async () => {
    const insert = `insert into public.source_amount_resolutions
        (workspace_id, import_batch_id, row_result_id, chosen_basis, reason, source_amount_minor_units, resolved_by)
      values ($1, $2, $3, 'approved_source_amount', 'Приклад-підстава-проба', 100, $4)`;
    expect(await insertOutcomes(insert,
      (s) => [s.ws, s.batch, s.row2, USER_A],
      [[WS_A, B.batch, B.row2, USER_A], [WS_A, A.batch, B.row2, USER_A], [WS_B, A.batch, A.row2, USER_A]]))
      .toEqual([
        refusedByPolicy, refusedByPolicy,
        byForeignKey("source_amount_resolutions_workspace_id_import_batch_id_row_fkey"),
        refusedByPolicy, inserted,
      ]);
  });

  it("locations: an owner of A cannot insert a location into B and holds no UPDATE", async () => {
    let n = 0;
    expect(await insertOutcomes(
      "insert into public.locations (workspace_id, project_id, name, parent_location_id, created_by) values ($1, $2, $3, $4, $5)",
      (s) => [s.ws, s.project, `Приклад-ділянка-проба-${n++}`, s.location, USER_A],
      [[WS_A, A.project, "Приклад-ділянка-змішана", B.location, USER_A]]))
      .toEqual([refusedByPolicy, byForeignKey("locations_workspace_id_project_id_parent_location_id_fkey"), inserted]);
    expect(await confined("locations", "update public.locations set name = 'Приклад-ділянка-змінена'"))
      .toEqual({ outcome: refusedByPrivilege, aChanged: 0, bUnchanged: true });
  });

  it("unit_definitions: an owner of A cannot insert a unit into B and holds no UPDATE", async () => {
    // A unit's only tenant column is its workspace (created_by names a global
    // auth user), so there is no mixed row to try.
    const insert = "insert into public.unit_definitions (workspace_id, code, created_by) values ($1, $2, $3)";
    expect(await insertOutcomes(insert, (s) => [s.ws, "проба-DEV079", USER_A], []))
      .toEqual([refusedByPolicy, inserted]);
    // The product's statement (the validate route and the manual baseline):
    // its arbiter carries the workspace, and the policy refuses B's row before
    // arbitration, not a silent zero rows; on A's own code it does nothing.
    const upsert = `${insert} on conflict (workspace_id, normalized_code) do nothing`;
    const outcomes: Outcome[] = [];
    await probe(async (p) => {
      outcomes.push(await p.as(upsert, [WS_B, "м2", USER_A]));
      outcomes.push(await p.as(upsert, [WS_A, "м2", USER_A]));
    });
    expect(outcomes).toEqual([refusedByPolicy, changed(0)]);
    expect(await confined("unit_definitions", "update public.unit_definitions set code = 'проба-змінена'"))
      .toEqual({ outcome: refusedByPrivilege, aChanged: 0, bUnchanged: true });
  });

  it("work_items: an owner of A cannot insert, update or delete a line of B or move one there", async () => {
    const insert = `insert into public.work_items
        (workspace_id, project_id, contract_id, contract_version_id, position,
         description, unit_definition_id, unit_code, unit_precision,
         contract_quantity, unit_price_state, unit_price_decimal, price_basis,
         valuation_basis, currency, tax_mode, tax_rate_bps,
         net_amount_minor_units, tax_amount_minor_units, gross_amount_minor_units)
      values ($1, $2, $3, $4, 99, 'Приклад-позиція-проба', $5, 'м2', 3, '10.000', 'known', '100.00', 'net',
              'unit_price_derived', 'UAH', 'exclusive', 2000, 100000, 20000, 120000)`;
    // B's DRAFT: wi_insert's second arm admits a draft line, so only a draft
    // target shows that arm refusing B.
    expect(await insertOutcomes(insert,
      (s) => [s.ws, s.project, s.contract, s.draft, s.unit],
      [[WS_A, A.project, A.contract, A.draft, B.unit]]))
      .toEqual([refusedByPolicy, byForeignKey("work_items_workspace_id_unit_definition_id_fkey"), inserted]);
    // The line guards refuse a published line and any tenant change before the
    // policy is asked. wi_update and wi_delete admit a draft line only: one row of A.
    expect(await confined("work_items", "update public.work_items set description = 'Приклад-позиція-змінена'", ["work_items"]))
      .toEqual({ outcome: changed(1), aChanged: 1, bUnchanged: true });
    expect(await confined("work_items", "delete from public.work_items", ["work_items"]))
      .toEqual({ outcome: changed(1), aChanged: 1, bUnchanged: true });
    expect(await moveOutcomes("work_items", [
      [`update public.work_items set workspace_id = $1, project_id = $2, contract_id = $3, contract_version_id = $4,
          unit_definition_id = $5, position = 424242`, [WS_B, B.project, B.contract, B.draft, B.unit]],
      ["update public.work_items set unit_definition_id = $1", [B.unit]],
    ], ["work_items"]))
      .toEqual({ outcomes: [refusedByPolicy, byForeignKey("work_items_workspace_id_unit_definition_id_fkey")], bUnchanged: true });
    expect(await triggersEnabled("work_items")).toEqual(["O", "O"]);
  });
});
