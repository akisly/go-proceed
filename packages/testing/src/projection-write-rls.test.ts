import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { adminClient, dropWorkspaces, superuserClient } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import {
  BLOCKED_REASON_INSERT, READINESS_PROJECTION_INSERT, blockedReasonParams, readinessProjectionParams,
  ruleVersionOf, seedClosureWorld, type ClosureWorld,
} from "./m3-closure-fixture";

/**
 * THE CROSS-WORKSPACE WRITE MINIMUM, MODULE projection: readiness_projection
 * and blocked_reasons (DEV-086; BL-173).
 *
 * DEV-076 widened a `covered` row of technical/database/rls-coverage.csv: where
 * its principal can write, a test must show a principal of one workspace cannot
 * write into another. goproceed_service holds INSERT, UPDATE and DELETE on both
 * tables, for the readiness rebuilder that does not exist yet (0086; the owner
 * kept the grants on 2026-09-25, DEV-086). rp_write_server and br_write_server
 * are FOR ALL with USING = WITH CHECK = `workspace_id = app.service_workspace()`;
 * goproceed_app holds no write here.
 *
 * Per privilege, on the service plane declaring A: an INSERT carrying B's
 * tenant key refused by the policy, and A's own refused when no workspace is
 * declared, beside the same statement succeeding declaring A; an INSERT keeping
 * A's tenant key with one of B's parents refused by that parent's composite
 * foreign key (23503, named); an UPDATE and a DELETE reading no column changing
 * exactly A's two rows, with B's read back unchanged, and nothing when no
 * workspace is declared; a move-out of the tenant key refused by the policy,
 * and of a parent by its key. A service transaction carrying B's owner as its
 * actor is confined the same way: neither policy reads the actor.
 *
 * One reference has no key: readiness_projection.scope_ref (0045), whose
 * vocabulary is not decided. A's row naming B's stage is admitted; it is not
 * asserted here (BL-201). Where one of B's parents breaks two composite keys,
 * the one named is the one that answers first on a migrated database: the RI
 * triggers fire in the order of their names, which carry their OIDs, so the
 * key created first answers first (blocked_reasons_occurrence_fkey, 0045).
 *
 * Every probe runs on the local superuser connection in one transaction that
 * is always rolled back, each statement in a savepoint under `SET LOCAL ROLE
 * goproceed_service` with the plane's GUCs; app.service_workspace() reads the
 * GUC alone. The fixture is this file's own (ids `de086c…`, `de086d…`),
 * dropped before and after. No resetDb.
 */
const WS_A = "de086c00-0000-4000-8000-000000000001";
const WS_B = "de086d00-0000-4000-8000-000000000001";
const USER_A = "de086c00-0000-4000-8000-0000000000a1";
const USER_B = "de086d00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];

interface Side {
  w: ClosureWorld; ws: string; project: string; contract: string;
  /** The rule versions of blockingA and blockingB. */
  ruleA: string; ruleB: string;
}

interface Outcome {
  rowCount: number | null; code: string | null;
  reason: "policy" | "privilege" | "other" | null; constraint: string | null;
}

const refusedByPolicy: Outcome = { rowCount: null, code: "42501", reason: "policy", constraint: null };
const inserted: Outcome = { rowCount: 1, code: null, reason: null, constraint: null };
const changed = (rowCount: number): Outcome => ({ rowCount, code: null, reason: null, constraint: null });
const byForeignKey = (constraint: string): Outcome => ({ rowCount: null, code: "23503", reason: "other", constraint });

/** A service transaction: its actor ('' none) and its declared workspace ('' none). */
interface Plane { actor: string; declared: string }
const declaringA: Plane = { actor: "", declared: WS_A };
const declaringNone: Plane = { actor: "", declared: "" };
const withOwnerOfB: Plane = { actor: USER_B, declared: WS_A };

let admin: Client;
let A: Side;
let B: Side;

async function seedSide(ws: string, user: string, suffix: string): Promise<Side> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const w = await seedClosureWorld(admin, rules);
  const ruleA = await ruleVersionOf(admin, w.blockingA);
  const ruleB = await ruleVersionOf(admin, w.blockingB);
  await admin.query(READINESS_PROJECTION_INSERT, readinessProjectionParams(w));
  await admin.query(READINESS_PROJECTION_INSERT, readinessProjectionParams(w, { scopeRef: w.otherStageId }));
  // Two codes, so a move of the occurrence onto B's does not meet the primary key first.
  await admin.query(BLOCKED_REASON_INSERT, blockedReasonParams(w, ruleA));
  await admin.query(BLOCKED_REASON_INSERT,
    blockedReasonParams(w, ruleB, { occurrenceId: w.blockingB, code: "TEST_REPORT_MISSING" }));
  return { w, ws, project: rules.projectId, contract: rules.contractId, ruleA, ruleB };
}

interface Probe {
  as(plane: Plane, sql: string, params?: unknown[]): Promise<Outcome>;
  admin<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

async function probe(body: (p: Probe) => Promise<void>): Promise<void> {
  const c = superuserClient();
  await c.connect();
  try {
    await c.query("begin");
    const p: Probe = {
      async as(plane, sql, params = []) {
        await c.query("savepoint probe");
        await c.query("set local role goproceed_service");
        await c.query(
          `select set_config('app.actor_user_id', $1, true), set_config('app.organization_id', $2, true),
                  set_config('app.external_session_id', '', true)`, [plane.actor, plane.declared]);
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

async function snapshot(p: Probe, table: string, ws: string): Promise<string[]> {
  const rows = await p.admin<{ j: string }>(
    `select to_jsonb(t)::text as j from public.${table} t where t.workspace_id = $1 order by 1`, [ws]);
  return rows.map((r) => r.j);
}

async function outcomes(statements: [Plane, string, unknown[]][]): Promise<Outcome[]> {
  const out: Outcome[] = [];
  await probe(async (p) => {
    for (const [plane, sql, params] of statements) out.push(await p.as(plane, sql, params));
  });
  return out;
}

/** A statement reading no column: its outcome, the `key` of A's rows it changed, and whether B's read back unchanged. */
async function confined(plane: Plane, table: string, sql: string, key: string):
Promise<{ outcome: Outcome; aChanged: string[]; bUnchanged: boolean }> {
  let result = { outcome: changed(-1), aChanged: [] as string[], bUnchanged: false };
  await probe(async (p) => {
    const beforeA = await snapshot(p, table, WS_A);
    const beforeB = await snapshot(p, table, WS_B);
    const outcome = await p.as(plane, sql);
    const afterA = await snapshot(p, table, WS_A);
    const aChanged = beforeA.filter((row) => !afterA.includes(row))
      .map((row) => (JSON.parse(row) as Record<string, string>)[key]!).sort();
    result = {
      outcome, aChanged,
      bUnchanged: JSON.stringify(await snapshot(p, table, WS_B)) === JSON.stringify(beforeB),
    };
  });
  return result;
}

beforeAll(async () => {
  // A RETURNING would apply the SELECT policy to the new row and mask the INSERT policy (DEV-083).
  for (const sql of [READINESS_PROJECTION_INSERT, BLOCKED_REASON_INSERT]) expect(sql).not.toMatch(/returning/i);
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  A = await seedSide(WS_A, USER_A, "DEV086-A");
  B = await seedSide(WS_B, USER_B, "DEV086-B");
  // Premises: no trigger on either table answers before the policy, and the
  // service's workspace is its GUC alone.
  const triggers = await admin.query(
    `select 1 from pg_trigger
      where tgrelid = any(array['public.readiness_projection', 'public.blocked_reasons']::regclass[])
        and not tgisinternal`);
  expect(triggers.rowCount).toBe(0);
  const fn = await admin.query<{ src: string }>(
    "select prosrc as src from pg_proc where proname = 'service_workspace' and pronamespace = 'app'::regnamespace");
  expect(fn.rows[0]!.src).not.toMatch(/session_user/);
}, 240_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("projection cross-workspace write denial", () => {
  it("readiness_projection: the service plane declaring A cannot insert, update or delete a projection of B or move one there", async () => {
    const fresh = (s: Side, over: Parameters<typeof readinessProjectionParams>[1] = {}) =>
      readinessProjectionParams(s.w, { scopeRef: s.w.foreignAssignmentStageId, ...over });
    expect(await outcomes([
      [declaringA, READINESS_PROJECTION_INSERT, fresh(B)],
      [declaringNone, READINESS_PROJECTION_INSERT, fresh(A)],
      [withOwnerOfB, READINESS_PROJECTION_INSERT, fresh(B)],
      [declaringA, READINESS_PROJECTION_INSERT, fresh(A, { projectId: B.project, contractId: B.contract })],
      [declaringA, READINESS_PROJECTION_INSERT, fresh(A, { contractId: B.contract })],
      [declaringA, READINESS_PROJECTION_INSERT, fresh(A)],
    ])).toEqual([
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      byForeignKey("readiness_projection_contract_fkey"),
      byForeignKey("readiness_projection_contract_fkey"),
      inserted,
    ]);
    const bothOfA = [A.w.stageId, A.w.otherStageId].sort();
    for (const plane of [declaringA, withOwnerOfB]) {
      expect(await confined(plane, "readiness_projection", "update public.readiness_projection set stale = true", "scope_ref"))
        .toEqual({ outcome: changed(2), aChanged: bothOfA, bUnchanged: true });
      expect(await confined(plane, "readiness_projection", "delete from public.readiness_projection", "scope_ref"))
        .toEqual({ outcome: changed(2), aChanged: bothOfA, bUnchanged: true });
    }
    expect(await confined(declaringNone, "readiness_projection", "update public.readiness_projection set stale = true", "scope_ref"))
      .toEqual({ outcome: changed(0), aChanged: [], bUnchanged: true });
    expect(await confined(declaringNone, "readiness_projection", "delete from public.readiness_projection", "scope_ref"))
      .toEqual({ outcome: changed(0), aChanged: [], bUnchanged: true });
    expect(await outcomes([
      [declaringA, "update public.readiness_projection set workspace_id = $1, project_id = $2, contract_id = $3",
        [WS_B, B.project, B.contract]],
      [declaringA, "update public.readiness_projection set workspace_id = $1", [WS_B]],
      [declaringA, "update public.readiness_projection set contract_id = $1", [B.contract]],
      [declaringA, "update public.readiness_projection set project_id = $1, contract_id = $2", [B.project, B.contract]],
      [declaringNone, "update public.readiness_projection set workspace_id = $1", [WS_B]],
    ])).toEqual([
      refusedByPolicy,
      refusedByPolicy,
      byForeignKey("readiness_projection_contract_fkey"),
      byForeignKey("readiness_projection_contract_fkey"),
      changed(0),
    ]);
  });

  it("blocked_reasons: the service plane declaring A cannot insert, update or delete a blocked reason of B or move one there", async () => {
    const fresh = (s: Side, over: Parameters<typeof blockedReasonParams>[2] = {}) =>
      blockedReasonParams(s.w, s.ruleA, { code: "ACT_NOT_SIGNED", ...over });
    const bParents = { occurrenceId: B.w.blockingA, assignmentId: B.w.assignmentId };
    expect(await outcomes([
      [declaringA, BLOCKED_REASON_INSERT, fresh(B)],
      [declaringNone, BLOCKED_REASON_INSERT, fresh(A)],
      [withOwnerOfB, BLOCKED_REASON_INSERT, fresh(B)],
      [declaringA, BLOCKED_REASON_INSERT, fresh(A, { contractId: B.contract })],
      [declaringA, BLOCKED_REASON_INSERT, blockedReasonParams(A.w, B.ruleA, { code: "ACT_NOT_SIGNED", ...bParents })],
      [declaringA, BLOCKED_REASON_INSERT, fresh(A, { projectId: B.project })],
      [declaringA, BLOCKED_REASON_INSERT, fresh(A)],
    ])).toEqual([
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      byForeignKey("blocked_reasons_contract_fkey"),
      byForeignKey("blocked_reasons_occurrence_fkey"),
      // B's project breaks both keys; the occurrence's, created first, answers first.
      byForeignKey("blocked_reasons_occurrence_fkey"),
      inserted,
    ]);
    const bothOfA = [A.w.blockingA, A.w.blockingB].sort();
    for (const plane of [declaringA, withOwnerOfB]) {
      expect(await confined(plane, "blocked_reasons", "update public.blocked_reasons set stale = true", "requirement_occurrence_id"))
        .toEqual({ outcome: changed(2), aChanged: bothOfA, bUnchanged: true });
      expect(await confined(plane, "blocked_reasons", "delete from public.blocked_reasons", "requirement_occurrence_id"))
        .toEqual({ outcome: changed(2), aChanged: bothOfA, bUnchanged: true });
    }
    expect(await confined(declaringNone, "blocked_reasons", "update public.blocked_reasons set stale = true", "requirement_occurrence_id"))
      .toEqual({ outcome: changed(0), aChanged: [], bUnchanged: true });
    expect(await confined(declaringNone, "blocked_reasons", "delete from public.blocked_reasons", "requirement_occurrence_id"))
      .toEqual({ outcome: changed(0), aChanged: [], bUnchanged: true });
    expect(await outcomes([
      [declaringA, `update public.blocked_reasons
          set workspace_id = $1, project_id = $2, contract_id = $3, work_assignment_id = $4,
              requirement_occurrence_id = $5, rule_version_id = $6`,
        [WS_B, B.project, B.contract, B.w.assignmentId, B.w.blockingA, B.ruleA]],
      [declaringA, "update public.blocked_reasons set workspace_id = $1", [WS_B]],
      [declaringA, "update public.blocked_reasons set contract_id = $1", [B.contract]],
      [declaringA, `update public.blocked_reasons
          set requirement_occurrence_id = $1, work_assignment_id = $2, rule_version_id = $3`,
        [B.w.blockingA, B.w.assignmentId, B.ruleA]],
      [declaringA, "update public.blocked_reasons set project_id = $1", [B.project]],
      [declaringNone, "update public.blocked_reasons set workspace_id = $1", [WS_B]],
    ])).toEqual([
      refusedByPolicy,
      refusedByPolicy,
      byForeignKey("blocked_reasons_contract_fkey"),
      byForeignKey("blocked_reasons_occurrence_fkey"),
      byForeignKey("blocked_reasons_occurrence_fkey"),
      changed(0),
    ]);
  });
});
