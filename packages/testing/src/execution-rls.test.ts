import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor, dropWorkspaces } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import { seedAssignment } from "./m2-occurrences-fixture";

/**
 * READINESS GATE 11, MODULE execution (DEV-016, BL-093).
 *
 * The DEV-014 shape: the owner of A reads A's rows; the owner of B, with the
 * same grants on its own project and declaring workspace A, reads only B's.
 * Each workspace gets, from the admin client, an assignment on the published
 * baseline, one root progress entry, its valuation allocation (the shape
 * m2-rls.test.ts seeds) and its allocation head.
 *
 * m5-external-rls.test.ts counts these three tables across all workspaces and
 * expects zero, so a run killed before afterAll leaves m5 red until this file
 * runs again (its beforeAll drops the rows). No resetDb.
 */
const WS_A = "de163a00-0000-4000-8000-000000000001";
const WS_B = "de163b00-0000-4000-8000-000000000001";
const USER_A = "de163a00-0000-4000-8000-0000000000a1";
const USER_B = "de163b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];

let admin: Client;

async function seedSide(ws: string, user: string, suffix: string): Promise<void> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const assignmentId = await seedAssignment(admin, rules, rules.publishedVersionId, rules.publishedWorkItemId);
  const root = await admin.query<{ id: string }>(
    `insert into public.progress_entries
       (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind, quantity, recorded_by_member_id)
     values ($1, $2, $3, $4, 'root', 10, $5) returning id`,
    [ws, rules.projectId, assignmentId, rules.publishedWorkItemId, rules.memberId]);
  const rootId = root.rows[0]!.id;
  await admin.query(
    `insert into public.valuation_allocations
       (workspace_id, project_id, contract_id, work_item_id, progress_entry_id, root_progress_entry_id,
        lineage_key, quantity, net_minor_units, tax_minor_units, gross_minor_units)
     values ($1, $2, $3, $4, $5, $5, $6, 10, 100, 20, 120)`,
    [ws, rules.projectId, rules.contractId, rules.publishedWorkItemId, rootId, `progress:${rootId}`]);
  await admin.query(
    `insert into public.progress_allocation_heads (workspace_id, root_progress_entry_id, effective_quantity)
     values ($1, $2, 10)`, [ws, rootId]);
}

/** The distinct workspaces of the rows `actor` can read, declaring workspace A. */
async function seen(actor: string, sql: string): Promise<string[]> {
  const r = await asActor<{ ws: string }>(actor, WS_A, (c) => c.query(sql, [BOTH]));
  return r.rows.map((row) => row.ws).sort();
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  await seedSide(WS_A, USER_A, "DEV016-EX-A");
  await seedSide(WS_B, USER_B, "DEV016-EX-B");
}, 180_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("execution isolation — the owner of A reaches rows of A and the owner of B declaring A reaches only rows of B", () => {
  it("progress_entries: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.progress_entries where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("valuation_allocations: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.valuation_allocations where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("progress_allocation_heads: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    // pah_select reaches the head through its root progress entry's project capability.
    const sql = "select distinct workspace_id as ws from public.progress_allocation_heads where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });
});
