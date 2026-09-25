import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, dropWorkspaces, superuserClient } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import { attemptClosure, recordDecision, seedClosureWorld } from "./m3-closure-fixture";
import {
  ACT_INSERT, HEX64, QUANTITY_INSERT, SIGNATORY_INSERT, VERSION_INSERT, type ActWorld,
  attemptFreeze, insertVersion, quantityParams, seedActWorld, seedDraftAct, signatoryParams,
  versionParams,
} from "./m4-act-fixture";

/**
 * THE CROSS-WORKSPACE WRITE MINIMUM, MODULE statutory (DEV-083, BL-169).
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
 *     for the project the capability is asked on;
 *   - UPDATE reading no column (no WHERE, a constant SET, no RETURNING): exactly
 *     A's rows the policy admits change, named by id, and B's rows read back
 *     unchanged as admin in the same transaction;
 *   - moving A's rows into B, again reading no column: refused by the policy
 *     (42501; DEV-077 C1); one parent column alone, by its composite foreign key.
 *
 * The actor is the owner of A throughout, declaring A, holding the rules
 * world's six project capabilities, the closure world's four and the act
 * world's `statutory_acts.compose`, so every policy here admits A's own rows.
 *
 * Every probe runs on the local superuser connection in one transaction that
 * is always rolled back, each statement inside a savepoint under `SET LOCAL
 * ROLE goproceed_app` with the actor's GUCs. A trigger's refusal does not count
 * (owner, 2026-09-24): the version guard (BEFORE UPDATE) and the two content
 * guards (BEFORE INSERT, reading the version under the actor's RLS) are disabled
 * inside the probe's transaction and asserted enabled afterwards. The version's
 * DEFERRED completeness check fires only at COMMIT, which a probe never reaches;
 * it is not a tenancy defence (DEV-083 gp-architect §3), and this file's own
 * fixture commits a freeze through it.
 *
 * 0107 (owner, 2026-09-25) withdrew UPDATE and DELETE on the two content tables,
 * which no command used, and made sav_insert admit a draft only: their tests
 * assert the privilege refusals and the born-frozen refusal.
 *
 * The fixture is this file's own (ids `de083…`), dropped before and after. No
 * resetDb. m5-external-rls.test.ts asserts statutory_acts and its versions
 * globally empty, so a run killed before afterAll leaves that suite red until
 * this file runs again.
 */
const WS_A = "de083a00-0000-4000-8000-000000000001";
const WS_B = "de083b00-0000-4000-8000-000000000001";
const USER_A = "de083a00-0000-4000-8000-0000000000a1";
const USER_B = "de083b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];
const FROZEN_AT = "2026-09-25 00:00:00+00";

interface Side {
  ws: string; member: string; project: string; contract: string;
  assignment: string; workItem: string; world: ActWorld;
  /** The second closure, on the stage that carried one occurrence, with no act yet. */
  closure2: string; stage2: string;
  /** act1: v1 frozen (with content), v2 its draft correction (with content). */
  act1: string; v1: string; v2: string;
  root: string; unit: string;
  builderProjectParty: string; builderContact: string;
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
 * The act world (a satisfied closure C1 on the stage with three occurrences, a
 * root entry, the builder and technical-supervision participants), then: a
 * second committed closure C2 on the stage with one occurrence, with no act; act1
 * on C1 with v1 frozen through a committed freeze, and v2, its draft correction,
 * each with one quantity line and the two signatories the freeze requires.
 */
async function seedSide(ws: string, user: string, suffix: string): Promise<Side> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const w = await seedClosureWorld(admin, rules);
  const a = await seedActWorld(admin, w);
  const decision = await recordDecision(admin, w, { occurrenceId: w.otherStageOccurrence, outcome: "accepted" });
  const c2 = await attemptClosure(admin, w, {
    stageId: w.otherStageId,
    members: [{ occurrenceId: w.otherStageOccurrence, satisfiedBy: "evidence_decision", decisionId: decision }],
  });
  if (c2.error !== null) throw new Error(`fixture: the second closure did not commit: ${c2.error}`);
  const { actId, versionId: v1 } = await seedDraftAct(admin, a);
  const frozen = await attemptFreeze(admin, a, { versionId: v1 });
  if (frozen.error !== null || frozen.updated !== 1) throw new Error(`fixture: v1 did not freeze: ${frozen.error}`);
  const v2 = await insertVersion(admin, a, {
    statutoryActId: actId, versionNo: 2, predecessorVersionId: v1, predecessorVersionNo: 1,
    predecessorStatus: "frozen", correctionReason: "Приклад-виправлення.",
  });
  await admin.query(QUANTITY_INSERT, quantityParams(a, { versionId: v2 }));
  await admin.query(SIGNATORY_INSERT, signatoryParams(a, { versionId: v2, slot: "builder" }));
  await admin.query(SIGNATORY_INSERT, signatoryParams(a, { versionId: v2, slot: "technical_supervision" }));
  const status = await one<{ s: string }>(
    "select string_agg(status, ',' order by version_no) as s from public.statutory_act_versions where statutory_act_id = $1",
    [actId]);
  if (status.s !== "frozen,draft") throw new Error(`fixture: act1 is ${status.s}`);
  return {
    ws, member: rules.memberId, project: rules.projectId, contract: rules.contractId,
    assignment: w.assignmentId, workItem: w.workItemId, world: a,
    closure2: c2.closureId, stage2: w.otherStageId,
    act1: actId, v1, v2, root: a.rootProgressEntryId, unit: a.unitId,
    builderProjectParty: a.builderProjectPartyId, builderContact: a.builderContactId,
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
          // Only a new row's WITH CHECK refusal counts as `policy`, and only
          // «permission denied for table» as `privilege` (DEV-081 S2).
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
 * A statement reading no column, run as the owner of A with constant
 * parameters: its outcome, the ids of A's rows it changed, and whether B's rows
 * read back unchanged.
 */
async function confined(table: string, sql: string, params: unknown[], disable: string[] = []):
Promise<{ outcome: Outcome; aChanged: string[]; bUnchanged: boolean }> {
  let result = { outcome: changed(-1), aChanged: [] as string[], bUnchanged: false };
  await probe(async (p) => {
    const beforeA = await snapshot(p, table, WS_A);
    const beforeB = await snapshot(p, table, WS_B);
    const outcome = await p.as(sql, params);
    const afterA = await snapshot(p, table, WS_A);
    const aChanged = beforeA.filter((row) => !afterA.includes(row))
      .map((row) => (JSON.parse(row) as Record<string, string>).id!).sort();
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

/**
 * Inside a probe, as admin: act2 on each side's C2 and, with `version`, its v1
 * draft with no content — the empty parents the INSERT controls write into.
 */
function act2Prelude(ids: Map<string, { act: string; version: string }>, version: boolean) {
  return async (p: Probe) => {
    for (const s of [A, B]) {
      const id = ids.get(s.ws)!;
      await p.admin(ACT_INSERT, actRow(s, { id: id.act }));
      if (version) await p.admin(VERSION_INSERT, versionParams(s.world, { versionId: id.version, statutoryActId: id.act }));
    }
  };
}

function act2Ids(): Map<string, { act: string; version: string }> {
  return new Map([[WS_A, { act: randomUUID(), version: randomUUID() }], [WS_B, { act: randomUUID(), version: randomUUID() }]]);
}

/** ACT_INSERT's twelve parameters for an act on the side's C2. */
function actRow(s: Side, o: Partial<Record<"id" | "project" | "closure" | "item" | "member", string>> = {}): unknown[] {
  return [o.id ?? randomUUID(), s.ws, o.project ?? s.project, s.contract, s.assignment, o.item ?? s.workItem,
    s.stage2, o.closure ?? s.closure2, true, "dodatok_v", "product_assumption", o.member ?? s.member];
}

type VersionOverride = Partial<Record<"project" | "act" | "composer" | "predecessor", string>>;

/** VERSION_INSERT's parameters for a draft v1 on `act` (or a v2 after `predecessor`), with one of B's ids. */
function versionRow(s: Side, act: string, o: VersionOverride): unknown[] {
  const params = versionParams(s.world, {
    statutoryActId: o.act ?? act,
    ...(o.project ? { projectId: o.project } : {}),
    ...(o.predecessor
      ? { versionNo: 2, predecessorVersionId: o.predecessor, predecessorVersionNo: 1,
          predecessorStatus: "frozen", correctionReason: "Приклад-виправлення." }
      : {}),
  });
  // $28, composed_by_member_id: versionParams takes it from the world.
  if (o.composer) params[27] = o.composer;
  return params;
}

/**
 * The fixture's statements without their `RETURNING id`: a RETURNING applies the
 * SELECT policy to the new row, whose refusal reads exactly like the INSERT
 * policy's and would mask it (the DEV-083 sweep caught three mutants so masked).
 */
const ACT_WRITE = ACT_INSERT.replace(/\s+returning id\s*$/, "");
const VERSION_WRITE = VERSION_INSERT.replace(/\s+returning id\s*$/, "");

/** The freeze's SET, constant: nine of the route's ten columns (not `frozen_project_address`, which may be null). */
const FREEZE_SET = `status = 'frozen', frozen_at = timestamptz '${FROZEN_AT}', frozen_by_member_id = $1,
  content_hash = '${HEX64}', renderer_version = 'statutory-act-render/1', form_template_hash = '${HEX64}',
  frozen_project_name = 'Приклад-об''єкт', source_project_version = 1, draft_version = 2`;

beforeAll(async () => {
  // Every probed INSERT reads no column back (gp-security S3): a fixture change
  // that brought a RETURNING back would mask the policies again.
  for (const sql of [ACT_WRITE, VERSION_WRITE, QUANTITY_INSERT, SIGNATORY_INSERT]) expect(sql).not.toMatch(/returning/i);
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  A = await seedSide(WS_A, USER_A, "DEV083-A");
  B = await seedSide(WS_B, USER_B, "DEV083-B");
  // Premise: each owner holds the rules world's six, the closure world's four and compose.
  const held = await admin.query<{ n: string }>(
    "select count(*) as n from public.project_access_grants where workspace_id = any($1) and revoked_at is null", [BOTH]);
  expect(Number(held.rows[0]?.n)).toBe(22);
}, 240_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("statutory cross-workspace write denial", () => {
  it("statutory_acts: an owner of A cannot compose an act in B or onto B's closure, line or member", async () => {
    // The stage, contract and assignment each also break the closure's composite
    // key, which answers first: statutory_acts_stage_fkey cannot be isolated
    // across workspaces, and the closure key already pins the stage.
    expect(await insertOutcomes(ACT_WRITE, (s) => actRow(s), [
      actRow(A, { project: B.project }),
      actRow(A, { closure: B.closure2 }),
      actRow(A, { item: B.workItem }),
      actRow(A, { member: B.member }),
    ]))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("statutory_acts_closure_fkey"),
        byForeignKey("statutory_acts_line_fkey"),
        byForeignKey("statutory_acts_member_fkey"),
        inserted,
      ]);
  });

  it("statutory_act_versions: an owner of A cannot compose a version in B, onto B's act, member or predecessor, or born frozen, nor freeze or move one into B", async () => {
    const ids = act2Ids();
    const row = (s: Side, o: VersionOverride = {}) => versionRow(s, ids.get(s.ws)!.act, o);
    // A version born frozen, every freeze fact present and A's own: refused by
    // sav_insert's draft arm (0107), before any CHECK. `frozen_by_member_id` is
    // written only with `frozen`, so its foreign key cannot be reached by an
    // INSERT the policy admits.
    const bornFrozen = versionParams(A.world, {
      statutoryActId: ids.get(WS_A)!.act, status: "frozen", frozenAt: FROZEN_AT,
      frozenByMemberId: A.member, contentHash: HEX64, rendererVersion: "statutory-act-render/1",
      formTemplateHash: HEX64,
    });
    expect(await insertOutcomes(VERSION_WRITE, (s) => row(s), [
      row(A, { project: B.project }),
      row(A, { act: B.act1 }),
      row(A, { composer: B.member }),
      row(A, { predecessor: B.v1 }),
      bornFrozen,
    ], [], act2Prelude(ids, false)))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("statutory_act_versions_act_fkey"),
        byForeignKey("statutory_act_versions_composed_by_fkey"),
        byForeignKey("statutory_act_versions_chain_fkey"),
        refusedByPolicy,
        inserted,
      ]);

    // sav_update admits a draft only: A's v2 freezes, A's frozen v1 stays out.
    // The guard (a +1 draft_version step, the freeze's dates) is off.
    expect(await confined("statutory_act_versions",
      `update public.statutory_act_versions set ${FREEZE_SET}`, [A.member], ["statutory_act_versions"]))
      .toEqual({ outcome: changed(1), aChanged: [A.v2], bUnchanged: true });

    // Not work_assignment_id or work_item_id alone: v2's quantity line holds a
    // referenced-side NO ACTION check on them that answers first, for the wrong
    // reason. The contract move breaks the same composite act key.
    expect(await moveOutcomes("statutory_act_versions", [
      [`update public.statutory_act_versions set workspace_id = $1, project_id = $2, contract_id = $3,
         statutory_act_id = $4, work_assignment_id = $5, work_item_id = $6, composed_by_member_id = $7,
         predecessor_version_id = $8`,
        [WS_B, B.project, B.contract, B.act1, B.assignment, B.workItem, B.member, B.v1]],
      ["update public.statutory_act_versions set project_id = $1", [B.project]],
      ["update public.statutory_act_versions set contract_id = $1", [B.contract]],
      // Breaks act_fkey and, v2 having a predecessor, chain_fkey too: both are the
      // cross-workspace refusal; act_fkey answers as its RI triggers sort first.
      ["update public.statutory_act_versions set statutory_act_id = $1", [B.act1]],
      ["update public.statutory_act_versions set predecessor_version_id = $1", [B.v1]],
      ["update public.statutory_act_versions set composed_by_member_id = $1", [B.member]],
      [`update public.statutory_act_versions set ${FREEZE_SET}`, [B.member]],
      // WITH CHECK's status arm answers before statutory_act_versions_status_check.
      ["update public.statutory_act_versions set status = 'retracted'", []],
    ], ["statutory_act_versions"]))
      .toEqual({
        outcomes: [
          refusedByPolicy,
          refusedByPolicy,
          byForeignKey("statutory_act_versions_act_fkey"),
          byForeignKey("statutory_act_versions_act_fkey"),
          byForeignKey("statutory_act_versions_chain_fkey"),
          byForeignKey("statutory_act_versions_composed_by_fkey"),
          byForeignKey("statutory_act_versions_frozen_by_fkey"),
          refusedByPolicy,
        ],
        bUnchanged: true,
      });
    expect(await triggersEnabled("statutory_act_versions")).toEqual(["O", "O"]);
  });

  it("statutory_act_version_quantities: an owner of A cannot write a quantity line in B or onto B's version, entry or unit, and holds no UPDATE or DELETE", async () => {
    const ids = act2Ids();
    const row = (s: Side, o: Partial<Record<"project" | "version" | "root" | "unit", string>> = {}) =>
      quantityParams(s.world, {
        versionId: o.version ?? ids.get(s.ws)!.version,
        ...(o.project ? { projectId: o.project } : {}),
        ...(o.root ? { rootProgressEntryId: o.root } : {}),
        ...(o.unit ? { printedUnitId: o.unit } : {}),
      });
    // The content guard is BEFORE INSERT and reads the version under the actor's RLS.
    expect(await insertOutcomes(QUANTITY_INSERT, (s) => row(s), [
      row(A, { project: B.project }),
      row(A, { version: ids.get(WS_B)!.version }),
      row(A, { root: B.root }),
      row(A, { unit: B.unit }),
    ], ["statutory_act_version_quantities"], act2Prelude(ids, true)))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("statutory_act_version_quantities_version_fkey"),
        byForeignKey("statutory_act_version_quantities_entry_fkey"),
        byForeignKey("statutory_act_version_quantities_unit_fkey"),
        inserted,
      ]);
    expect(await triggersEnabled("statutory_act_version_quantities")).toEqual(["O"]);
    // 0107 withdrew both: no command edits a draft's content.
    expect(await moveOutcomes("statutory_act_version_quantities", [
      [`update public.statutory_act_version_quantities set created_at = timestamptz '${FROZEN_AT}'`, []],
      ["delete from public.statutory_act_version_quantities", []],
    ])).toEqual({ outcomes: [refusedByPrivilege, refusedByPrivilege], bUnchanged: true });
  });

  it("statutory_act_version_signatories: an owner of A cannot name a signatory in B or onto B's version, participant or contact, and holds no UPDATE or DELETE", async () => {
    const ids = act2Ids();
    const row = (s: Side, o: Partial<Record<"project" | "version" | "projectParty" | "contact", string>> = {}) =>
      signatoryParams(s.world, {
        versionId: o.version ?? ids.get(s.ws)!.version, slot: "builder",
        ...(o.project ? { projectId: o.project } : {}),
        ...(o.projectParty ? { projectPartyId: o.projectParty } : {}),
        ...(o.contact ? { partyContactId: o.contact } : {}),
      });
    expect(await insertOutcomes(SIGNATORY_INSERT, (s) => row(s), [
      row(A, { project: B.project }),
      row(A, { version: ids.get(WS_B)!.version }),
      row(A, { projectParty: B.builderProjectParty }),
      row(A, { contact: B.builderContact }),
    ], ["statutory_act_version_signatories"], act2Prelude(ids, true)))
      .toEqual([
        refusedByPolicy,
        refusedByPolicy,
        byForeignKey("statutory_act_version_signatories_version_fkey"),
        byForeignKey("statutory_act_version_signatories_party_fkey"),
        byForeignKey("statutory_act_version_signatories_contact_fkey"),
        inserted,
      ]);
    expect(await triggersEnabled("statutory_act_version_signatories")).toEqual(["O"]);
    expect(await moveOutcomes("statutory_act_version_signatories", [
      ["update public.statutory_act_version_signatories set frozen_person_role_title = 'Приклад-посада'", []],
      ["delete from public.statutory_act_version_signatories", []],
    ])).toEqual({ outcomes: [refusedByPrivilege, refusedByPrivilege], bUnchanged: true });
  });
});
