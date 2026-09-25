import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, dropWorkspaces, superuserClient } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import {
  APPROVER_ROLE, STAGE_KEY, insertDecision, insertException, recordDecision, recordException,
  ruleVersionOf, seedClosureWorld,
} from "./m3-closure-fixture";

/**
 * THE CROSS-WORKSPACE WRITE MINIMUM, MODULE requirements (DEV-080, BL-167).
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
 *     where the policy itself reads the parent — here, the project a capability
 *     is asked on;
 *   - UPDATE reading no column (no WHERE, a constant SET, no RETURNING): exactly
 *     A's rows the policy admits change, named by key, and B's rows read back
 *     unchanged as admin in the same transaction;
 *   - moving A's rows into B (tenant key, project and parents), again reading no
 *     column: refused by the policy (42501; DEV-077 C1);
 *   - moving one parent column alone to B's, within A: refused by the composite
 *     foreign key (23503, named, INV-001), or by the policy for the project.
 *
 * The actor is the owner of A throughout, declaring A. The rules world grants six
 * project capabilities, the closure world its four (the two decide capabilities
 * among them), and this file `assignments.manage`, so every policy here admits A's own rows and a
 * refusal of B's ids cannot come from a missing grant. The external-session
 * policies on decisions and their heads are false on the member plane (no
 * session is resolved while an actor is set) and are outside this minimum.
 *
 * Every probe runs on the local superuser connection in one transaction that
 * is always rolled back, each statement inside a savepoint under `SET LOCAL
 * ROLE goproceed_app` with the actor's GUCs. A trigger's refusal does not count
 * (owner, 2026-09-24): the reference-image guards (BEFORE INSERT, reading under
 * the actor's RLS) and the template and head guards (BEFORE UPDATE) have their
 * user triggers disabled inside the probe's transaction, and the rollback
 * re-enables them; the test then asserts they are enabled.
 *
 * The fixture is this file's own (ids `de080…`), dropped before and after. No
 * resetDb.
 */
const WS_A = "de080a00-0000-4000-8000-000000000001";
const WS_B = "de080b00-0000-4000-8000-000000000001";
const USER_A = "de080a00-0000-4000-8000-0000000000a1";
const USER_B = "de080b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];
const HEX64 = "b".repeat(64);
const MEDIA = JSON.stringify({ mimeTypes: ["image/jpeg"], maxByteSize: 1024 });

interface Side {
  ws: string; user: string; member: string; project: string; contract: string; baseline: string;
  otherAssignment: string; foreignStage: string; holdA: string; imgHoldA: string;
  blockingA: string; blockingB: string; advisory: string;
  DA1: string; DB1: string; EA1: string; EB1: string;
  psri: string; libItem: string; libImage: string; tDraft: string; tPub: string;
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
 * The closure world (a published, bound baseline; four rule versions; two
 * assignments; three concealed stages; four occurrences), then: a decision and
 * an exception with their heads on blockingA, a decision and an exception
 * WITHOUT heads on blockingB (the head controls' targets), a project-sourced
 * item, and a draft and a published template version.
 */
async function seedSide(ws: string, user: string, suffix: string): Promise<Side> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const w = await seedClosureWorld(admin, rules);
  await admin.query(
    `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
     values ($1, $2, $3, 'assignments.manage', $4)`, [ws, rules.projectId, rules.memberId, user]);
  const holdA = await ruleVersionOf(admin, w.blockingA);
  const imgHoldA = (await one<{ id: string }>(
    "select reference_image_version_id as id from public.requirement_rule_versions where id = $1", [holdA])).id;
  const libItem = rules.libraryItemIds.get("Н.14/1")!;
  const libImage = (await one<{ id: string }>(
    `select id from public.requirement_reference_image_versions
      where workspace_id = $1 and requirement_library_item_id = $2 order by version_no desc limit 1`, [ws, libItem])).id;
  const DA1 = await recordDecision(admin, w, { occurrenceId: w.blockingA, outcome: "accepted" });
  const DB1 = await insertDecision(admin, w, { occurrenceId: w.blockingB, outcome: "accepted" });
  const EA1 = await recordException(admin, w, { occurrenceId: w.blockingA, action: "waiver" });
  const EB1 = await insertException(admin, w, { occurrenceId: w.blockingB, action: "waiver" });
  const psri = (await one<{ id: string }>(
    `insert into public.project_sourced_requirement_items
       (workspace_id, project_id, item_text_uk, source_document, source_sheet, source_drawing_no,
        verification, created_by_member_id)
     values ($1, $2, 'Приклад-вимога з проєкту.', 'Приклад-проєкт', 'Аркуш 1', 'КР-1',
             'PROJECT_DOCUMENTATION', $3) returning id`, [ws, rules.projectId, rules.memberId])).id;
  const template = async (versionNo: number, published: boolean) => (await one<{ id: string }>(
    `insert into public.requirement_template_versions
       (workspace_id, template_key, version_no, status, evidence_type, allowed_media,
        template_hash, published_at, published_by_member_id, created_by_member_id)
     values ($1, 'dev080-set', $2, $3, 'photo', $4::jsonb, $5, $6, $7, $8) returning id`,
    [ws, versionNo, published ? "published" : "draft", MEDIA, published ? HEX64 : null,
     published ? new Date().toISOString() : null, published ? rules.memberId : null, rules.memberId])).id;
  const tDraft = await template(1, false);
  const tPub = await template(2, true);
  return {
    ws, user, member: rules.memberId, project: rules.projectId, contract: rules.contractId,
    baseline: w.baselineVersionId, otherAssignment: w.otherAssignmentId, foreignStage: w.foreignAssignmentStageId,
    holdA, imgHoldA, blockingA: w.blockingA, blockingB: w.blockingB, advisory: w.advisoryOccurrence,
    DA1, DB1, EA1, EB1, psri, libItem, libImage, tDraft, tPub,
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
  A = await seedSide(WS_A, USER_A, "DEV080-A");
  B = await seedSide(WS_B, USER_B, "DEV080-B");
  // Premise: each owner holds the rules world's six, the closure world's four and assignments.manage.
  const held = await admin.query<{ n: string }>(
    "select count(*) as n from public.project_access_grants where workspace_id = any($1) and revoked_at is null", [BOTH]);
  expect(Number(held.rows[0]?.n)).toBe(22);
}, 240_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("requirements cross-workspace write denial", () => {
  it("project_sourced_requirement_items: an owner of A cannot insert a project-sourced item into B", async () => {
    const insert = `insert into public.project_sourced_requirement_items
        (workspace_id, project_id, item_text_uk, source_document, source_sheet, source_drawing_no,
         verification, created_by_member_id)
      values ($1, $2, 'Приклад-вимога-проба.', 'Приклад-проєкт', 'Аркуш 2', 'КР-2', 'PROJECT_DOCUMENTATION', $3)`;
    // The policy reads the actor's role in the row's workspace, not the project:
    // B's project under A's key is the foreign key's refusal.
    expect(await insertOutcomes(insert, (s) => [s.ws, s.project, s.member],
      [[WS_A, B.project, A.member], [WS_A, A.project, B.member]]))
      .toEqual([
        refusedByPolicy,
        byForeignKey("project_sourced_requirement_items_workspace_id_project_id_fkey"),
        byForeignKey("project_sourced_requirement_i_workspace_id_created_by_memb_fkey"),
        inserted,
      ]);
  });

  it("requirement_library_items: an owner of A cannot insert a library item into B", async () => {
    // A library item's only tenant column is its workspace, so there is no mixed
    // row. The fixture holds every Додаток Н slot, so the probe names another
    // source; it is rolled back and never rendered.
    const insert = `insert into public.requirement_library_items
        (workspace_id, source_standard, position_code, position_title_uk, item_no, item_text_uk,
         verification, source_citation)
      values ($1, 'Приклад-джерело-DEV080', 'Н.14', 'Приклад-позиція', 1, 'Приклад-вимога.', 'VERIFIED_PRIMARY', 'Приклад-посилання')`;
    expect(await insertOutcomes(insert, (s) => [s.ws], [])).toEqual([refusedByPolicy, inserted]);
  });

  it("requirement_template_versions: an owner of A cannot insert or update a template version of B or move one there", async () => {
    const insert = `insert into public.requirement_template_versions
        (workspace_id, template_key, version_no, evidence_type, allowed_media, created_by_member_id, published_by_member_id)
      values ($1, 'dev080-set', 3, 'photo', $2::jsonb, $3, $4)`;
    expect(await insertOutcomes(insert, (s) => [s.ws, MEDIA, s.member, null],
      [[WS_A, MEDIA, B.member, null], [WS_A, MEDIA, A.member, B.member]]))
      .toEqual([
        refusedByPolicy,
        byForeignKey("requirement_template_versions_workspace_id_created_by_memb_fkey"),
        byForeignKey("requirement_template_versions_workspace_id_published_by_me_fkey"),
        inserted,
      ]);
    // rtv_update has no draft condition: with the guard off both of A's
    // versions change (the published one is frozen by the guard alone, INV-015).
    expect(await confined("requirement_template_versions",
      "update public.requirement_template_versions set created_at = timestamptz '2026-09-25 00:00:00+00'",
      ["requirement_template_versions"]))
      .toEqual({ outcome: changed(2), aChanged: [A.tDraft, A.tPub].sort(), bUnchanged: true });
    expect(await moveOutcomes("requirement_template_versions", [
      ["update public.requirement_template_versions set workspace_id = $1, created_by_member_id = $2, published_by_member_id = $3, template_key = 'dev080-moved'",
        [WS_B, B.member, B.member]],
      ["update public.requirement_template_versions set created_by_member_id = $1", [B.member]],
      ["update public.requirement_template_versions set published_by_member_id = $1", [B.member]],
    ], ["requirement_template_versions"]))
      .toEqual({
        outcomes: [
          refusedByPolicy,
          byForeignKey("requirement_template_versions_workspace_id_created_by_memb_fkey"),
          byForeignKey("requirement_template_versions_workspace_id_published_by_me_fkey"),
        ],
        bUnchanged: true,
      });
    expect(await triggersEnabled("requirement_template_versions")).toEqual(["O"]);
  });

  it("requirement_rule_versions: an owner of A cannot publish a rule version into B or onto B's sources", async () => {
    const insert = `insert into public.requirement_rule_versions
        (workspace_id, requirement_rule_id, version_no, ordinal, status, work_type_key, stage_key,
         intervention_type, blocking_scope, timing, evidence_kind, acceptance_criterion,
         performer_role, approver_role, allowed_media, requirement_library_item_id,
         project_sourced_requirement_item_id, reference_image_version_id,
         rule_version_hash, published_at, published_by_member_id, retired_by_member_id, created_by_member_id)
      values ($1, gen_random_uuid(), 1, 1, $2, 'montazh-elektrotekhnichnykh-ustanovok', 'dev080-stage',
              'hold', 'blocks_stage_closure', 'before_concealment', 'photo', 'Приклад-критерій.',
              'foreman', 'technical_supervisor', '${MEDIA}'::jsonb, $3, $4, $5,
              $6, $7, $8, $9, $10)`;
    const now = new Date().toISOString();
    const published = (s: Side, o: Partial<Record<"lib" | "psri" | "img" | "pub" | "retired" | "created", string | null>> = {}) =>
      [s.ws, "published", o.lib === undefined ? s.libItem : o.lib, o.psri ?? null, o.img === undefined ? s.libImage : o.img,
       HEX64, now, o.pub ?? s.member, o.retired ?? null, o.created ?? s.member];
    expect(await insertOutcomes(insert, (s) => published(s), [
      published(A, { lib: B.libItem, img: null }),
      published(A, { img: B.libImage }),
      published(A, { lib: null, img: null, psri: B.psri }),
      published(A, { pub: B.member }),
      published(A, { retired: B.member }),
      published(A, { created: B.member }),
      // rrv_insert admits a published version only: a draft of A's own is the
      // status arm's refusal.
      [WS_A, "draft", A.libItem, null, A.libImage, null, null, null, null, A.member],
    ], ["requirement_rule_versions"]))
      .toEqual([
        refusedByPolicy,
        byForeignKey("requirement_rule_versions_workspace_id_requirement_library_fkey"),
        byForeignKey("rrv_reference_image_fkey"),
        byForeignKey("requirement_rule_versions_project_sourced_fkey"),
        byForeignKey("requirement_rule_versions_workspace_id_published_by_member_fkey"),
        byForeignKey("requirement_rule_versions_workspace_id_retired_by_member_i_fkey"),
        byForeignKey("requirement_rule_versions_workspace_id_created_by_member_i_fkey"),
        refusedByPolicy,
        inserted,
      ]);
    expect(await triggersEnabled("requirement_rule_versions")).toEqual(["O", "O"]);
  });

  it("requirement_occurrences: an owner of A cannot materialise an occurrence into B or onto B's baseline, stage or rule", async () => {
    const insert = `insert into public.requirement_occurrences
        (workspace_id, project_id, contract_id, contract_version_id, work_assignment_id, work_stage_id,
         stage_is_concealed, stage_key, rule_version_id, ordinal, intervention_type, blocking_scope, timing,
         evidence_kind, acceptance_criterion, performer_role, approver_role, approver_is_external,
         min_evidence_count, created_by_member_id, reference_image_version_id)
      values ($1, $2, $3, $4, $5, $6, true, '${STAGE_KEY}', $7, 1, 'hold', 'blocks_stage_closure', 'before_concealment',
              'photo', 'Приклад-критерій приймання.', 'foreman', '${APPROVER_ROLE}', false, 1, $8, $9)`;
    // The empty stage on the second assignment: its (assignment, stage, rule)
    // triple is not yet materialised.
    const row = (s: Side, o: Partial<Record<"project" | "contract" | "stage" | "rule" | "member" | "img", string>> = {}) =>
      [s.ws, o.project ?? s.project, o.contract ?? s.contract, s.baseline, s.otherAssignment,
       o.stage ?? s.foreignStage, o.rule ?? s.holdA, o.member ?? s.member, o.img ?? s.imgHoldA];
    expect(await insertOutcomes(insert, (s) => row(s), [
      row(A, { project: B.project }),
      row(A, { contract: B.contract }),
      row(A, { stage: B.foreignStage }),
      row(A, { member: B.member }),
      row(A, { rule: B.holdA }),
      row(A, { img: B.imgHoldA }),
    ], ["requirement_occurrences"]))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("requirement_occurrences_assignment_baseline_fkey"),
        byForeignKey("requirement_occurrences_stage_fkey"),
        byForeignKey("requirement_occurrences_author_fkey"),
        byForeignKey("requirement_occurrences_from_binding_fkey"),
        byForeignKey("ro_reference_image_fkey"),
        inserted,
      ]);
    expect(await triggersEnabled("requirement_occurrences")).toEqual(["O", "O"]);
  });

  it("requirement_evidence_decisions: an owner of A cannot record a decision in B or onto B's occurrence or lineage", async () => {
    const insert = `insert into public.requirement_evidence_decisions
        (workspace_id, project_id, requirement_occurrence_id, approver_role, outcome, decision_no,
         superseded_decision_id, superseded_decision_no, decided_by_member_id, idempotency_key, request_hash)
      values ($1, $2, $3, '${APPROVER_ROLE}', 'accepted', $4, $5, $6, $7, $8, '${HEX64}')`;
    const row = (s: Side, o: Partial<Record<"project" | "occurrence" | "member", string>> = {}) =>
      [s.ws, o.project ?? s.project, o.occurrence ?? s.advisory, 1, null, null, o.member ?? s.member, randomUUID()];
    expect(await insertOutcomes(insert, (s) => row(s), [
      row(A, { project: B.project }),
      row(A, { occurrence: B.advisory }),
      row(A, { member: B.member }),
      // A successor of B's decision on A's own occurrence.
      [WS_A, A.project, A.blockingA, 2, B.DA1, 1, A.member, randomUUID()],
    ]))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("requirement_evidence_decisions_occurrence_fkey"),
        byForeignKey("requirement_evidence_decisions_member_fkey"),
        byForeignKey("requirement_evidence_decisions_chain_fkey"),
        inserted,
      ]);
  });

  it("requirement_evidence_decision_heads: an owner of A cannot open or advance a decision head of B or move one there", async () => {
    const insert = `insert into public.requirement_evidence_decision_heads
        (workspace_id, project_id, requirement_occurrence_id, approver_role, current_decision_id, current_outcome)
      values ($1, $2, $3, '${APPROVER_ROLE}', $4, $5)`;
    expect(await insertOutcomes(insert, (s) => [s.ws, s.project, s.blockingB, s.DB1, "accepted"], [
      [WS_A, B.project, A.blockingB, A.DB1, "accepted"],
      [WS_A, A.project, B.blockingB, null, null],
      [WS_A, A.project, A.blockingB, B.DB1, "accepted"],
    ]))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("requirement_evidence_decision_heads_occurrence_fkey"),
        byForeignKey("requirement_evidence_decision_heads_outcome_fkey"),
        inserted,
      ]);
    // The head guard admits only a +1 version step on its own lineage.
    expect(await confined("requirement_evidence_decision_heads",
      "update public.requirement_evidence_decision_heads set version = 424242",
      ["requirement_evidence_decision_heads"], "requirement_occurrence_id"))
      .toEqual({ outcome: changed(1), aChanged: [A.blockingA], bUnchanged: true });
    // 0109 (DEV-085) narrowed the UPDATE to the four columns the routes set: the
    // tenant key and the occurrence are refused by privilege; the pointer, which
    // stays writable, by its composite foreign key.
    expect(await moveOutcomes("requirement_evidence_decision_heads", [
      ["update public.requirement_evidence_decision_heads set workspace_id = $1, project_id = $2, requirement_occurrence_id = $3, current_decision_id = $4",
        [WS_B, B.project, B.blockingB, B.DB1]],
      ["update public.requirement_evidence_decision_heads set current_decision_id = $1", [B.DB1]],
      ["update public.requirement_evidence_decision_heads set requirement_occurrence_id = $1", [B.blockingB]],
      ["update public.requirement_evidence_decision_heads set project_id = $1", [B.project]],
    ], ["requirement_evidence_decision_heads"]))
      .toEqual({
        outcomes: [
          refusedByPrivilege,
          byForeignKey("requirement_evidence_decision_heads_outcome_fkey"),
          refusedByPrivilege,
          refusedByPrivilege,
        ],
        bUnchanged: true,
      });
    expect(await triggersEnabled("requirement_evidence_decision_heads")).toEqual(["O"]);
  });

  it("requirement_exceptions: an owner of A cannot record an exception in B or onto B's occurrence or lineage", async () => {
    const insert = `insert into public.requirement_exceptions
        (workspace_id, project_id, requirement_occurrence_id, occurrence_intervention_type, exception_scope, action,
         exception_no, predecessor_exception_id, predecessor_exception_no, authority_member_id, reason,
         idempotency_key, request_hash)
      values ($1, $2, $3, 'hold', 'occurrence', 'waiver', $4, $5, $6, $7, 'Приклад-обґрунтування.', $8, '${HEX64}')`;
    const row = (s: Side, o: Partial<Record<"project" | "occurrence" | "member", string>> = {}) =>
      [s.ws, o.project ?? s.project, o.occurrence ?? s.advisory, 1, null, null, o.member ?? s.member, randomUUID()];
    expect(await insertOutcomes(insert, (s) => row(s), [
      row(A, { project: B.project }),
      row(A, { occurrence: B.advisory }),
      row(A, { member: B.member }),
      [WS_A, A.project, A.blockingA, 2, B.EA1, 1, A.member, randomUUID()],
    ]))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("requirement_exceptions_occurrence_fkey"),
        byForeignKey("requirement_exceptions_authority_fkey"),
        byForeignKey("requirement_exceptions_chain_fkey"),
        inserted,
      ]);
  });

  it("requirement_exception_heads: an owner of A cannot open or advance an exception head of B or move one there", async () => {
    const insert = `insert into public.requirement_exception_heads
        (workspace_id, project_id, requirement_occurrence_id, exception_scope, current_exception_id, current_action)
      values ($1, $2, $3, 'occurrence', $4, $5)`;
    expect(await insertOutcomes(insert, (s) => [s.ws, s.project, s.blockingB, s.EB1, "waiver"], [
      [WS_A, B.project, A.blockingB, A.EB1, "waiver"],
      [WS_A, A.project, B.blockingB, null, null],
      [WS_A, A.project, A.blockingB, B.EB1, "waiver"],
    ]))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("requirement_exception_heads_occurrence_fkey"),
        byForeignKey("requirement_exception_heads_current_fkey"),
        inserted,
      ]);
    expect(await confined("requirement_exception_heads",
      "update public.requirement_exception_heads set version = 424242",
      ["requirement_exception_heads"], "requirement_occurrence_id"))
      .toEqual({ outcome: changed(1), aChanged: [A.blockingA], bUnchanged: true });
    expect(await moveOutcomes("requirement_exception_heads", [
      ["update public.requirement_exception_heads set workspace_id = $1, project_id = $2, requirement_occurrence_id = $3, current_exception_id = $4",
        [WS_B, B.project, B.blockingB, B.EB1]],
      ["update public.requirement_exception_heads set current_exception_id = $1", [B.EB1]],
      ["update public.requirement_exception_heads set requirement_occurrence_id = $1", [B.blockingB]],
      ["update public.requirement_exception_heads set project_id = $1", [B.project]],
    ], ["requirement_exception_heads"]))
      .toEqual({
        outcomes: [
          refusedByPolicy,
          byForeignKey("requirement_exception_heads_current_fkey"),
          byForeignKey("requirement_exception_heads_occurrence_fkey"),
          refusedByPolicy,
        ],
        bUnchanged: true,
      });
    expect(await triggersEnabled("requirement_exception_heads")).toEqual(["O"]);
  });
});
