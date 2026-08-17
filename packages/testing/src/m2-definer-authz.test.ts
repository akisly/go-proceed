import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { adminClient } from "./pg";
import { seedM2World, grantM2Capabilities, seedAssignment, type M2Fixture , dropM2Workspaces } from "./m2-fixture";

// The SECURITY DEFINER functions added by 0016 bypass RLS by definition. M1's
// definers are safe because each one resolves the actor itself — 0011:11 says
// so explicitly ("app.current_actor() and validates the full tenant chain
// internally, so no ..."). These tests assert the M2 definers do the same.

const WS_A = "aaaa1111-1111-1111-1111-111111111111";
const WS_B = "bbbb2222-2222-2222-2222-222222222222";
const USER_A = "aaaa3333-3333-3333-3333-333333333333";
const USER_B = "bbbb4444-4444-4444-4444-444444444444";
const APP_URL = process.env.APP_DB_URL
  ?? "postgresql://goproceed_app_login:app_pw@127.0.0.1:54322/postgres";

let c: Client;
let a: M2Fixture;
let rootA: string;

/** Runs as the app role with B's actor GUCs — i.e. an ordinary authenticated member of B. */
async function asMemberB<T>(fn: (cl: Client) => Promise<T>): Promise<T> {
  const cl = new Client({ connectionString: APP_URL });
  await cl.connect();
  try {
    await cl.query("begin");
    await cl.query("set local role goproceed_app");
    await cl.query("select set_config('app.actor_user_id', $1, true)", [USER_B]);
    await cl.query("select set_config('app.organization_id', $1, true)", [WS_B]);
    const out = await fn(cl);
    await cl.query("commit");
    return out;
  } finally { await cl.end(); }
}

beforeAll(async () => {
  c = await adminClient();
  await dropM2Workspaces(c, [WS_A, WS_B]);
  a = await seedM2World(c, { workspaceId: WS_A, userId: USER_A, email: "a@example.test", suffix: "A" });
  await seedM2World(c, { workspaceId: WS_B, userId: USER_B, email: "b@example.test", suffix: "B" });
  await grantM2Capabilities(c, a);
  const assignmentA = await seedAssignment(c, a);
  const r = await c.query(
    `insert into public.progress_entries
       (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
        quantity, recorded_by_member_id)
     values ($1,$2,$3,$4,'root',10,$5) returning id`,
    [a.workspaceId, a.projectId, assignmentA, a.workItemId, a.memberId]);
  rootA = r.rows[0].id;
});

afterAll(async () => {
  await dropM2Workspaces(c, [WS_A, WS_B]);
  await c.end();
});

describe("0016 SECURITY DEFINER functions must self-authorize", () => {
  it("refuses open_allocation_head for another workspace's root", async () => {
    let failed = false;
    try {
      await asMemberB((cl) => cl.query(
        `select app.open_allocation_head($1,$2)`, [WS_A, rootA]));
    } catch { failed = true; }

    const head = await c.query(
      `select effective_quantity from public.progress_allocation_heads
        where workspace_id = $1 and root_progress_entry_id = $2`, [WS_A, rootA]);

    // Either the call is rejected, or it silently planted a head row in another
    // tenant with an attacker-chosen balance.
    expect({ failed, plantedRows: head.rows.length })
      .toEqual({ failed: true, plantedRows: 0 });
  });

  it("refuses assert_reservation_invariant for another workspace's root", async () => {
    // Give A a legitimate head first, so the only thing under test is the
    // cross-tenant call rather than a missing row. Inserted directly: the
    // definer now authorizes its caller, and the admin connection carries no
    // actor, so it can no longer stand in for a member.
    await c.query(
      `insert into public.progress_allocation_heads
         (workspace_id, root_progress_entry_id, effective_quantity)
       values ($1,$2,10) on conflict do nothing`, [WS_A, rootA]);
    await c.query(
      `update public.progress_allocation_heads
          set reserved_quantity = 7, current_unaccepted_reserved_quantity = 7
        where workspace_id = $1 and root_progress_entry_id = $2`, [WS_A, rootA]);

    let message = "";
    let failed = false;
    try {
      await asMemberB((cl) => cl.query(
        `select app.assert_reservation_invariant($1,$2)`, [WS_A, rootA]));
    } catch (e) { failed = true; message = (e as Error).message; }

    expect(failed).toBe(true);
    // A cross-tenant caller must not learn another workspace's balances from
    // the raise message.
    expect(message).not.toMatch(/\b7\b/);
  });
});
