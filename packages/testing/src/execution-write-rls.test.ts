import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, dropWorkspaces, superuserClient } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import {
  attemptClosure, frozenSetHash, recordDecision, recordException, seedClosureWorld,
} from "./m3-closure-fixture";

/**
 * THE CROSS-WORKSPACE WRITE MINIMUM, MODULE execution (DEV-081, BL-168).
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
 *     where the policy reads the parent — the project a capability is asked
 *     on, and the progress entry an allocation's policy looks up;
 *   - UPDATE reading no column (no WHERE, a constant SET, no RETURNING): exactly
 *     A's rows the policy admits change, named by id, and B's rows read back
 *     unchanged as admin in the same transaction;
 *   - moving A's rows into B, again reading no column: refused by the policy
 *     (42501; DEV-077 C1); one parent column alone, by its composite foreign key.
 *
 * The actor is the owner of A throughout, declaring A, holding the rules
 * world's six project capabilities, the closure world's four and this file's
 * three (`assignments.manage`, `progress.record`, `progress.adjust`), so every
 * policy here admits A's own rows.
 *
 * Every probe runs on the local superuser connection in one transaction that
 * is always rolled back, each statement inside a savepoint under `SET LOCAL
 * ROLE goproceed_app` with the actor's GUCs. A trigger's refusal does not count
 * (owner, 2026-09-24): the stage guards (BEFORE INSERT and BEFORE UPDATE) and
 * the closure-member window (BEFORE INSERT, reading under the actor's RLS) are
 * disabled inside the probe's transaction and asserted enabled afterwards.
 * Three DEFERRED constraint triggers (the closure's frozen set, the stage's
 * closure fact, an allocation's funded lineage) fire only at COMMIT, which a
 * probe never reaches: a control here proves the policy and the immediate
 * constraints admit A's row, not that A's transaction would commit. None of the
 * three is a tenancy defence; the m3 suites witness them through committing
 * closures.
 *
 * 0106 withdrew the UPDATE grant on work_assignments and dropped wa_update, which
 * no command used (owner, 2026-09-25); its test asserts the privilege refusal.
 *
 * The fixture is this file's own (ids `de081…`), dropped before and after. No
 * resetDb. m5-external-rls.test.ts asserts four of these tables globally empty,
 * so a run killed before afterAll leaves that suite red until this file runs
 * again.
 */
const WS_A = "de081a00-0000-4000-8000-000000000001";
const WS_B = "de081b00-0000-4000-8000-000000000001";
const USER_A = "de081a00-0000-4000-8000-0000000000a1";
const USER_B = "de081b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];
const HEX64 = "b".repeat(64);

interface Side {
  ws: string; user: string; member: string; project: string; contract: string; baseline: string;
  workItem: string; assignment: string; otherAssignment: string; stage: string; otherStage: string;
  fStage: string; vClosure: string; blockingA: string; blockingB: string; DA1: string; EB1: string;
  root: string; party: string; tPub: string; location: string;
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

async function one<T extends Record<string, unknown>>(sql: string, params: unknown[]): Promise<T> {
  const r = await admin.query<T>(sql, params);
  if (!r.rows[0]) throw new Error(`fixture: no row from ${sql}`);
  return r.rows[0];
}

/**
 * The closure world (a published, bound baseline; two assignments; three
 * concealed stages; four occurrences), then: three more capabilities; an
 * accepted decision on blockingA and a waiver on blockingB (the closure
 * members' reliance); a committed closure with no members on the stage that
 * carries no occurrence; a committed root progress entry with no allocation;
 * and a published template and a location for the assignment probe.
 */
async function seedSide(ws: string, user: string, suffix: string): Promise<Side> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const w = await seedClosureWorld(admin, rules);
  for (const capability of ["assignments.manage", "progress.record", "progress.adjust"]) {
    await admin.query(
      `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
       values ($1, $2, $3, $4, $5)`, [ws, rules.projectId, rules.memberId, capability, user]);
  }
  const DA1 = await recordDecision(admin, w, { occurrenceId: w.blockingA, outcome: "accepted" });
  const EB1 = await recordException(admin, w, { occurrenceId: w.blockingB, action: "waiver" });
  const closure = await attemptClosure(admin, w, {
    stageId: w.foreignAssignmentStageId, assignmentId: w.otherAssignmentId, members: [] });
  if (closure.error !== null) throw new Error(`fixture: the empty closure did not commit: ${closure.error}`);
  const root = (await one<{ id: string }>(
    `insert into public.progress_entries
       (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind, quantity, recorded_by_member_id)
     values ($1, $2, $3, $4, 'root', 10, $5) returning id`,
    [ws, rules.projectId, w.otherAssignmentId, w.workItemId, rules.memberId])).id;
  const party = (await one<{ id: string }>(
    "select customer_party_id as id from public.contracts where id = $1", [rules.contractId])).id;
  const tPub = (await one<{ id: string }>(
    `insert into public.requirement_template_versions
       (workspace_id, template_key, version_no, status, evidence_type, allowed_media,
        template_hash, published_at, published_by_member_id, created_by_member_id)
     values ($1, 'dev081-set', 1, 'published', 'photo', '{"mimeTypes":["image/jpeg"],"maxByteSize":1024}'::jsonb,
             $2, now(), $3, $3) returning id`, [ws, HEX64, rules.memberId])).id;
  const location = (await one<{ id: string }>(
    `insert into public.locations (workspace_id, project_id, name, created_by)
     values ($1, $2, 'Секція 1', $3) returning id`, [ws, rules.projectId, user])).id;
  return {
    ws, user, member: rules.memberId, project: rules.projectId, contract: rules.contractId,
    baseline: w.baselineVersionId, workItem: w.workItemId, assignment: w.assignmentId,
    otherAssignment: w.otherAssignmentId, stage: w.stageId, otherStage: w.otherStageId,
    fStage: w.foreignAssignmentStageId, vClosure: closure.closureId,
    blockingA: w.blockingA, blockingB: w.blockingB, DA1, EB1, root, party, tPub, location,
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
          // Only a new row's WITH CHECK refusal counts as `policy`: a SELECT
          // policy's «(USING expression)» refusal of a moved row is the DEV-077
          // C1 masking, and counts as `other` (gp-security DEV-081 S2).
          const reason = /^new row violates row-level security policy for table "[^"]+"$/.test(message ?? "") ? "policy"
            : /^permission denied for table /.test(message ?? "") ? "privilege" : "other";
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
 * ids, with each `mixed` parameter list, and with A's ids (the control), after
 * an optional admin `prelude` in the same transaction.
 */
async function insertOutcomes(
  sql: string, params: (s: Side) => unknown[], mixed: unknown[][], disable: string[] = [],
  prelude?: (p: Probe) => Promise<void>,
): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  await probe(async (p) => {
    if (prelude) await prelude(p);
    outcomes.push(await p.as(sql, params(B)));
    for (const m of mixed) outcomes.push(await p.as(sql, m));
    outcomes.push(await p.as(sql, params(A)));
  }, disable);
  return outcomes;
}

/**
 * A statement reading no column (an UPDATE or a DELETE), run as the owner of A:
 * its outcome, the `key` of A's rows it changed or removed (a head has no id and
 * is keyed by its occurrence), so a policy admitting the wrong row of A fails
 * too, and whether B's rows read back unchanged.
 */
async function confined(table: string, sql: string, disable: string[] = [], key = "id"):
Promise<{ outcome: Outcome; aChanged: string[]; bUnchanged: boolean }> {
  let result = { outcome: changed(-1), aChanged: [] as string[], bUnchanged: false };
  await probe(async (p) => {
    const beforeA = await snapshot(p, table, WS_A);
    const beforeB = await snapshot(p, table, WS_B);
    const outcome = await p.as(sql);
    const afterA = await snapshot(p, table, WS_A);
    const aChanged = beforeA.filter((row) => !afterA.includes(row))
      .map((row) => (JSON.parse(row) as Record<string, string>)[key]!).sort();
    result = {
      outcome, aChanged,
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
  A = await seedSide(WS_A, USER_A, "DEV081-A");
  B = await seedSide(WS_B, USER_B, "DEV081-B");
  // Premise: each owner holds the rules world's six, the closure world's four and this file's three.
  const held = await admin.query<{ n: string }>(
    "select count(*) as n from public.project_access_grants where workspace_id = any($1) and revoked_at is null", [BOTH]);
  expect(Number(held.rows[0]?.n)).toBe(26);
}, 240_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("execution cross-workspace write denial", () => {
  it("work_assignments: an owner of A cannot assign work in B or onto B's baseline, party, member, template or location, and holds no UPDATE", async () => {
    const insert = `insert into public.work_assignments
        (workspace_id, project_id, contract_id, contract_version_id, work_item_id, performer_party_id,
         assignee_member_id, requirement_template_version_id, created_by_member_id, location_id)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
    // The route writes a client-supplied location (DEV-081 R3), and only the
    // composite FK confines it.
    const row = (s: Side, o: Partial<Record<"project" | "item" | "party" | "assignee" | "template" | "creator" | "location", string>> = {}) =>
      [s.ws, o.project ?? s.project, s.contract, s.baseline, o.item ?? s.workItem, o.party ?? s.party,
       o.assignee ?? s.member, o.template ?? s.tPub, o.creator ?? s.member, o.location ?? s.location];
    expect(await insertOutcomes(insert, (s) => row(s), [
      row(A, { project: B.project }),
      row(A, { item: B.workItem }),
      row(A, { party: B.party }),
      row(A, { assignee: B.member }),
      row(A, { template: B.tPub }),
      row(A, { creator: B.member }),
      row(A, { location: B.location }),
    ]))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("work_assignments_workspace_id_project_id_contract_id_contr_fkey"),
        byForeignKey("work_assignments_workspace_id_performer_party_id_fkey"),
        byForeignKey("work_assignments_workspace_id_assignee_member_id_fkey"),
        byForeignKey("work_assignments_workspace_id_requirement_template_version_fkey"),
        byForeignKey("work_assignments_workspace_id_created_by_member_id_fkey"),
        byForeignKey("work_assignments_workspace_id_project_id_location_id_fkey"),
        inserted,
      ]);
    expect(await confined("work_assignments", "update public.work_assignments set due_date = date '2026-10-01'"))
      .toEqual({ outcome: refusedByPrivilege, aChanged: [], bUnchanged: true });
  });

  it("work_stages: an owner of A cannot open or close a stage of B or move one there", async () => {
    const insert = `insert into public.work_stages
        (workspace_id, project_id, contract_id, contract_version_id, work_assignment_id, stage_key,
         is_concealed, created_by_member_id, status)
      values ($1, $2, $3, $4, $5, 'dev081-stage', true, $6, $7)`;
    const row = (s: Side, o: Partial<Record<"project" | "assignment" | "creator" | "status", string>> = {}) =>
      [s.ws, o.project ?? s.project, s.contract, s.baseline, o.assignment ?? s.assignment,
       o.creator ?? s.member, o.status ?? "open"];
    // The stage-key guard is BEFORE INSERT; off, the policy alone must refuse.
    expect(await insertOutcomes(insert, (s) => row(s), [
      row(A, { project: B.project }),
      row(A, { assignment: B.assignment }),
      row(A, { creator: B.member }),
      // ws_insert admits an open stage only.
      row(A, { status: "closed" }),
    ], ["work_stages"]))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("work_stages_workspace_id_project_id_work_assignment_id_con_fkey"),
        byForeignKey("work_stages_workspace_id_created_by_member_id_fkey"),
        refusedByPolicy,
        inserted,
      ]);
    // ws_update closes an open stage only: A's two open stages; its closed one stays out.
    // The guard (a +1 version step) is off.
    expect(await confined("work_stages",
      "update public.work_stages set status = 'closed', updated_at = timestamptz '2026-09-25 00:00:00+00'", ["work_stages"]))
      .toEqual({ outcome: changed(2), aChanged: [A.stage, A.otherStage].sort(), bUnchanged: true });
    expect(await moveOutcomes("work_stages", [
      // WITH CHECK asks for a closed row: an open stage that stays open is refused.
      ["update public.work_stages set updated_at = timestamptz '2026-09-25 00:00:00+00'", []],
      ["update public.work_stages set workspace_id = $1, project_id = $2, contract_id = $3, contract_version_id = $4, work_assignment_id = $5, created_by_member_id = $6, status = 'closed'",
        [WS_B, B.project, B.contract, B.baseline, B.assignment, B.member]],
      ["update public.work_stages set project_id = $1, status = 'closed'", [B.project]],
      // Not work_assignment_id alone: the occurrences scoped to A's open stages
      // hold a referenced-side NO ACTION check that answers first, for the wrong
      // reason. The contract move breaks the same composite FK (DEV-081 R4).
      ["update public.work_stages set contract_id = $1, status = 'closed'", [B.contract]],
      ["update public.work_stages set created_by_member_id = $1, status = 'closed'", [B.member]],
    ], ["work_stages"]))
      .toEqual({
        outcomes: [
          refusedByPolicy,
          refusedByPolicy,
          refusedByPolicy,
          byForeignKey("work_stages_workspace_id_project_id_work_assignment_id_con_fkey"),
          byForeignKey("work_stages_workspace_id_created_by_member_id_fkey"),
        ],
        bUnchanged: true,
      });
    expect(await triggersEnabled("work_stages")).toEqual(["O", "O", "O"]);
  });

  it("progress_entries: an owner of A cannot record or adjust progress in B or onto B's assignment, item or root", async () => {
    const root = `insert into public.progress_entries
        (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind, quantity, recorded_by_member_id)
      values ($1, $2, $3, $4, 'root', 1, $5)`;
    const r = (s: Side, o: Partial<Record<"project" | "assignment" | "item" | "member", string>> = {}) =>
      [s.ws, o.project ?? s.project, o.assignment ?? s.otherAssignment, o.item ?? s.workItem, o.member ?? s.member];
    expect(await insertOutcomes(root, (s) => r(s), [
      r(A, { project: B.project }),
      r(A, { assignment: B.otherAssignment }),
      r(A, { item: B.workItem }),
      r(A, { member: B.member }),
    ]))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("progress_entries_workspace_id_project_id_work_assignment_i_fkey"),
        byForeignKey("progress_entries_workspace_id_work_item_id_fkey"),
        byForeignKey("progress_entries_workspace_id_recorded_by_member_id_fkey"),
        inserted,
      ]);
    const adjustment = `insert into public.progress_entries
        (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind, quantity,
         root_progress_entry_id, root_is_root, reason_code, recorded_by_member_id)
      values ($1, $2, $3, $4, 'adjustment', 1, $5, true, 'Приклад-коригування', $6)`;
    const a = (s: Side, o: Partial<Record<"project" | "root", string>> = {}) =>
      [s.ws, o.project ?? s.project, s.otherAssignment, s.workItem, o.root ?? s.root, s.member];
    expect(await insertOutcomes(adjustment, (s) => a(s), [
      a(A, { project: B.project }),
      a(A, { root: B.root }),
    ]))
      .toEqual([refusedByPolicy, refusedByPolicy, byForeignKey("progress_entries_root_is_root_fkey"), inserted]);
  });

  it("valuation_allocations: an owner of A cannot value progress in B or onto B's entry, contract or closure", async () => {
    const insert = `insert into public.valuation_allocations
        (workspace_id, project_id, contract_id, work_item_id, progress_entry_id, root_progress_entry_id,
         lineage_key, quantity, funded_quantity, net_minor_units, tax_minor_units, gross_minor_units,
         admitted_by_closure_id, admitted_work_assignment_id)
      values ($1, $2, $3, $4, $5, $6, $7, 10, 10, 100, 20, 120, $8, $9)`;
    const v = (s: Side, o: Partial<Record<"project" | "contract" | "entry" | "closure" | "assignment", string | null>> = {}) =>
      [s.ws, o.project ?? s.project, o.contract ?? s.contract, s.workItem, o.entry ?? s.root, o.entry ?? s.root,
       `progress:${o.entry ?? s.root}`, o.closure === undefined ? null : o.closure,
       o.assignment === undefined ? null : o.assignment];
    // The unadmitted arm: the policy looks the entry up in the row's workspace.
    expect(await insertOutcomes(insert, (s) => v(s), [
      v(A, { project: B.project }),
      v(A, { entry: B.root }),
      v(A, { contract: B.contract }),
    ]))
      .toEqual([refusedByPolicy, refusedByPolicy, refusedByPolicy, byForeignKey("valuation_allocations_workspace_id_project_id_contract_id__fkey"), inserted]);
    // The admitted arm: a closure admits the entry.
    const admitted = (s: Side, o: Partial<Record<"project" | "closure", string>> = {}) =>
      v(s, { project: o.project ?? s.project, closure: o.closure ?? s.vClosure, assignment: s.otherAssignment });
    expect(await insertOutcomes(insert, (s) => admitted(s), [
      admitted(A, { project: B.project }),
      admitted(A, { closure: B.vClosure }),
    ]))
      .toEqual([refusedByPolicy, refusedByPolicy, byForeignKey("valuation_allocations_admitting_closure_fkey"), inserted]);
  });

  it("stage_closures: an owner of A cannot close a stage of B or onto B's stage, member or lineage", async () => {
    const insert = `insert into public.stage_closures
        (id, workspace_id, project_id, contract_id, work_assignment_id, work_stage_id, closure_no,
         predecessor_closure_id, predecessor_closure_no, correction_reason, closed_by_member_id,
         can_close_stage_result, evaluated_occurrence_count, evaluated_occurrence_set_hash,
         idempotency_key, request_hash)
      values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, 2, $11, $12, '${HEX64}')`;
    const c = (s: Side, o: Partial<Record<"project" | "stage" | "member", string>> = {}) =>
      [s.ws, o.project ?? s.project, s.contract, s.assignment, o.stage ?? s.stage, 1, null, null, null,
       o.member ?? s.member, frozenSetHash([s.blockingA, s.blockingB]), randomUUID()];
    // The route closes the stage before it records the closure (the stage FK
    // names status = 'closed'); the stage guard stays on and admits it. The
    // control has no members, so its frozen set would fail at COMMIT, which a
    // probe never reaches.
    const closeStages = async (p: Probe) => {
      await p.admin(
        "update public.work_stages set status = 'closed', version = version + 1, updated_at = now() where id = any($1)",
        [[A.stage, B.stage]]);
    };
    expect(await insertOutcomes(insert, (s) => c(s), [
      c(A, { project: B.project }),
      c(A, { stage: B.stage }),
      c(A, { member: B.member }),
      // A correction of B's closure, on A's own closed stage.
      [WS_A, A.project, A.contract, A.otherAssignment, A.fStage, 2, B.vClosure, 1, "Приклад-виправлення.", A.member,
       frozenSetHash([]), randomUUID()],
    ], [], closeStages))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("stage_closures_stage_fkey"),
        byForeignKey("stage_closures_member_fkey"),
        byForeignKey("stage_closures_chain_fkey"),
        inserted,
      ]);
  });

  it("stage_closure_occurrences: an owner of A cannot freeze a member into B's closure or onto B's facts", async () => {
    const insert = `insert into public.stage_closure_occurrences
        (workspace_id, project_id, stage_closure_id, work_stage_id, requirement_occurrence_id,
         occurrence_blocking_scope, satisfied_by, relied_on_decision_id, relied_on_decision_outcome,
         relied_on_exception_id, relied_on_exception_action)
      values ($1, $2, $3, $4, $5, 'blocks_stage_closure', $6, $7, $8, $9, $10)`;
    // Each side's closure over its own stage, written as admin in the probe
    // (the route's order: stage, then closure, then members).
    const closures = new Map<string, string>([[WS_A, randomUUID()], [WS_B, randomUUID()]]);
    const prelude = async (p: Probe) => {
      for (const s of [A, B]) {
        await p.admin(
          "update public.work_stages set status = 'closed', version = version + 1, updated_at = now() where id = $1", [s.stage]);
        await p.admin(
          `insert into public.stage_closures
             (id, workspace_id, project_id, contract_id, work_assignment_id, work_stage_id, closure_no,
              closed_by_member_id, can_close_stage_result, evaluated_occurrence_count,
              evaluated_occurrence_set_hash, idempotency_key, request_hash)
           values ($1, $2, $3, $4, $5, $6, 1, $7, true, 2, $8, $9, '${HEX64}')`,
          [closures.get(s.ws), s.ws, s.project, s.contract, s.assignment, s.stage, s.member,
           frozenSetHash([s.blockingA, s.blockingB]), randomUUID()]);
      }
    };
    const decided = (s: Side, o: Partial<Record<"project" | "closure" | "occurrence" | "decision", string>> = {}) =>
      [s.ws, o.project ?? s.project, o.closure ?? closures.get(s.ws), s.stage, o.occurrence ?? s.blockingA,
       "evidence_decision", o.decision ?? s.DA1, "accepted", null, null];
    const waived = (s: Side, exception: string) =>
      [s.ws, s.project, closures.get(s.ws), s.stage, s.blockingB, "exception", null, null, exception, "waiver"];
    // The member window is BEFORE INSERT and reads the closure under the actor's RLS.
    expect(await insertOutcomes(insert, (s) => decided(s), [
      decided(A, { project: B.project }),
      decided(A, { closure: closures.get(WS_B)! }),
      decided(A, { decision: B.DA1 }),
      decided(A, { occurrence: B.blockingA, decision: A.DA1 }),
      waived(A, B.EB1),
    ], ["stage_closure_occurrences"], prelude))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("stage_closure_occurrences_closure_fkey"),
        byForeignKey("stage_closure_occurrences_decision_fkey"),
        byForeignKey("stage_closure_occurrences_occurrence_fkey"),
        byForeignKey("stage_closure_occurrences_exception_fkey"),
        inserted,
      ]);
    expect(await triggersEnabled("stage_closure_occurrences")).toEqual(["O", "O"]);
  });
});
