import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, asService, dropWorkspaces } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import {
  BLOCKED_REASON_INSERT, READINESS_PROJECTION_INSERT, blockedReasonParams,
  readinessProjectionParams, ruleVersionOf, seedClosureWorld, type ClosureWorld,
} from "./m3-closure-fixture";

/**
 * THE SERVICE PLANE ON THE TWO READINESS PROJECTIONS (DEV-015, BL-100).
 *
 * 0045 wrote `rp_write_server` and `br_write_server` as `for all … using (true)
 * with check (true)`, saying they added only the write side. An ALL policy also
 * governs the read side, and permissive policies OR, so a service transaction
 * declaring any workspace, or none, read and rewrote every tenant's
 * projections. 0086 confines both to `workspace_id = app.service_workspace()`,
 * like the Telegram service policies.
 *
 * The shape is DEV-014's (communication-rls.test.ts): an EMPTY actor, so the
 * inherited member policies (`rp_select`, `br_select`, capability-bound) admit
 * nothing and the service policy is the only branch under test. An
 * actor-bearing service transaction is BL-101 and is not asserted here.
 *
 * Both workspaces hold one row of each table, seeded by the admin client so the
 * seed does not depend on the policy under test. Every write case runs inside a
 * transaction that is always rolled back, so the rows are the same for every
 * test, before 0086 (where the writes succeed) and after. No resetDb; the
 * workspaces are dropped before and after.
 */
const WS_A = "de150a00-0000-4000-8000-000000000001";
const WS_B = "de150b00-0000-4000-8000-000000000001";
const USER_A = "de150a00-0000-4000-8000-0000000000a1";
const USER_B = "de150b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];

let admin: Client;
let worldA: ClosureWorld;
let ruleVersionA: string;

type Step = [sql: string, params: unknown[]];
const ROLL_BACK = new Error("projection-rls: roll back");

async function seedSide(ws: string, user: string, suffix: string): Promise<[ClosureWorld, string]> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const world = await seedClosureWorld(admin, rules);
  const ruleVersion = await ruleVersionOf(admin, world.blockingA);
  await admin.query(READINESS_PROJECTION_INSERT, readinessProjectionParams(world));
  await admin.query(BLOCKED_REASON_INSERT, blockedReasonParams(world, ruleVersion));
  return [world, ruleVersion];
}

/** The workspace of every row a service transaction with no actor reaches, declaring `declared`, sorted. */
async function serviceSeen(declared: string | null, sql: string): Promise<string[]> {
  const r = await asService<{ ws: string }>("", declared, (c) => c.query(sql, [BOTH]));
  return r.rows.map((row) => row.ws).sort();
}

/**
 * Runs `steps` in one empty-actor service transaction declaring `declared`, and
 * ALWAYS rolls it back. Each step reports its row count, or the SQLSTATE that
 * stopped it (the steps after a failure report 25P02).
 */
async function serviceWrites(declared: string | null, steps: Step[]): Promise<(number | string)[]> {
  const outcomes: (number | string)[] = [];
  try {
    await asService("", declared, async (c) => {
      for (const [sql, params] of steps) {
        try {
          outcomes.push((await c.query(sql, params)).rowCount ?? 0);
        } catch (e) {
          outcomes.push((e as { code?: string }).code ?? "unknown");
        }
      }
      throw ROLL_BACK;
    });
  } catch (e) {
    if (e !== ROLL_BACK) throw e;
  }
  return outcomes;
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  [worldA, ruleVersionA] = await seedSide(WS_A, USER_A, "DEV015-A");
  await seedSide(WS_B, USER_B, "DEV015-B");
}, 180_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("projection service plane — a service transaction declaring A reaches rows of A and one declaring B or no workspace reaches none of them", () => {
  it("readiness_projection: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.readiness_projection where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });

  it("blocked_reasons: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.blocked_reasons where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });

  it("readiness_projection: declaring B or nothing updates, deletes and inserts no row of A, while declaring A rebuilds it", async () => {
    // A fresh scope, so the insert can only be stopped by the policy (WITH CHECK
    // runs before the unique and foreign-key checks).
    const foreign: Step[] = [
      ["update public.readiness_projection set ready = ready where workspace_id = $1", [WS_A]],
      ["delete from public.readiness_projection where workspace_id = $1", [WS_A]],
      [READINESS_PROJECTION_INSERT, readinessProjectionParams(worldA, { scopeRef: randomUUID() })],
    ];
    expect(await serviceWrites(WS_B, foreign)).toEqual([0, 0, "42501"]);
    expect(await serviceWrites(null, foreign)).toEqual([0, 0, "42501"]);
    // The control: a rebuild of A's scope, declaring A, replaces the row.
    expect(await serviceWrites(WS_A, [
      ["delete from public.readiness_projection where workspace_id = $1 and scope_ref = $2", [WS_A, worldA.stageId]],
      [READINESS_PROJECTION_INSERT, readinessProjectionParams(worldA)],
    ])).toEqual([1, 1]);
  });

  it("blocked_reasons: declaring B or nothing updates, deletes and inserts no row of A, while declaring A rebuilds it", async () => {
    const foreign: Step[] = [
      ["update public.blocked_reasons set since = since where workspace_id = $1", [WS_A]],
      ["delete from public.blocked_reasons where workspace_id = $1", [WS_A]],
      [BLOCKED_REASON_INSERT, blockedReasonParams(worldA, ruleVersionA, { code: "ACT_NOT_SIGNED" })],
    ];
    expect(await serviceWrites(WS_B, foreign)).toEqual([0, 0, "42501"]);
    expect(await serviceWrites(null, foreign)).toEqual([0, 0, "42501"]);
    expect(await serviceWrites(WS_A, [
      ["delete from public.blocked_reasons where workspace_id = $1 and requirement_occurrence_id = $2", [WS_A, worldA.blockingA]],
      [BLOCKED_REASON_INSERT, blockedReasonParams(worldA, ruleVersionA)],
    ])).toEqual([1, 1]);
  });
});
