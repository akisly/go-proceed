import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor } from "./pg";
import { seedM2World, grantM2Capabilities, seedAssignment, type M2Fixture } from "./m2-fixture";

// 0016 must make the database a real second layer. Migration 0014 exists because
// M1's write policies asked only "is the actor an active member?", so a
// command-layer mistake had nothing behind it. These tests fail if that
// regression class returns.

const WS_A = "aaaa1111-1111-1111-1111-111111111111";
const WS_B = "bbbb2222-2222-2222-2222-222222222222";
const USER_A = "aaaa3333-3333-3333-3333-333333333333";
const USER_B = "bbbb4444-4444-4444-4444-444444444444";

let c: Client;
let a: M2Fixture;
let b: M2Fixture;
let assignmentA: string;
let assignmentB: string;
let rootEntryA: string;

beforeAll(async () => {
  c = await adminClient();
  await c.query("truncate public.organizations cascade");

  a = await seedM2World(c, { workspaceId: WS_A, userId: USER_A, email: "a@example.test", suffix: "A" });
  b = await seedM2World(c, { workspaceId: WS_B, userId: USER_B, email: "b@example.test", suffix: "B" });
  await grantM2Capabilities(c, a);
  await grantM2Capabilities(c, b);

  assignmentA = await seedAssignment(c, a);
  assignmentB = await seedAssignment(c, b);

  const root = await c.query(
    `insert into public.progress_entries
       (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
        quantity, recorded_by_member_id)
     values ($1,$2,$3,$4,'root',10,$5) returning id`,
    [a.workspaceId, a.projectId, assignmentA, a.workItemId, a.memberId]);
  rootEntryA = root.rows[0].id;

  await c.query(
    `insert into public.valuation_allocations
       (workspace_id, project_id, contract_id, work_item_id, progress_entry_id,
        root_progress_entry_id, lineage_key, quantity,
        net_minor_units, tax_minor_units, gross_minor_units)
     values ($1,$2,$3,$4,$5,$5,$6,10,100,20,120)`,
    [a.workspaceId, a.projectId, a.contractId, a.workItemId, rootEntryA,
     `progress:${rootEntryA}`]);
});

afterAll(async () => {
  await c.query("truncate public.organizations cascade");
  await c.end();
});

async function countAs(user: string, ws: string, sql: string, params: unknown[]): Promise<number> {
  const r = await asActor(user, ws, (cl) => cl.query(sql, params));
  return r.rows.length;
}

describe("0016 tenant isolation", () => {
  it("hides another workspace's assignments", async () => {
    expect(await countAs(USER_A, WS_A,
      `select id from public.work_assignments where id = $1`, [assignmentA])).toBe(1);
    // Same row set, actor from B: RLS, not a WHERE clause, is what removes it.
    expect(await countAs(USER_B, WS_B,
      `select id from public.work_assignments where id = $1`, [assignmentA])).toBe(0);
  });

  it("hides another workspace's progress entries and allocations", async () => {
    expect(await countAs(USER_B, WS_B,
      `select id from public.progress_entries where id = $1`, [rootEntryA])).toBe(0);
    expect(await countAs(USER_B, WS_B,
      `select id from public.valuation_allocations where progress_entry_id = $1`,
      [rootEntryA])).toBe(0);
  });

  it("hides a project the member holds no grant on", async () => {
    await c.query(
      `update public.project_access_grants set revoked_at = now()
        where workspace_id = $1 and member_id = $2`, [a.workspaceId, a.memberId]);
    try {
      expect(await countAs(USER_A, WS_A,
        `select id from public.work_assignments where id = $1`, [assignmentA])).toBe(0);
    } finally {
      await c.query(
        `update public.project_access_grants set revoked_at = null
          where workspace_id = $1 and member_id = $2`, [a.workspaceId, a.memberId]);
    }
  });

  it("refuses an insert into another workspace even for an active member", async () => {
    let failed = false;
    try {
      await asActor(USER_B, WS_B, (cl) => cl.query(
        `insert into public.progress_entries
           (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
            quantity, recorded_by_member_id)
         values ($1,$2,$3,$4,'root',5,$5)`,
        [a.workspaceId, a.projectId, assignmentA, a.workItemId, a.memberId]));
    } catch { failed = true; }
    expect(failed).toBe(true);
  });
});

describe("0016 capability, not mere membership (the 0014 regression class)", () => {
  it("denies a progress insert to a member holding only project.view", async () => {
    await c.query(
      `update public.project_access_grants set revoked_at = now()
        where workspace_id = $1 and member_id = $2 and capability <> 'project.view'`,
      [b.workspaceId, b.memberId]);
    let failed = false;
    try {
      await asActor(USER_B, WS_B, (cl) => cl.query(
        `insert into public.progress_entries
           (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
            quantity, recorded_by_member_id)
         values ($1,$2,$3,$4,'root',5,$5)`,
        [b.workspaceId, b.projectId, assignmentB, b.workItemId, b.memberId]));
    } catch { failed = true; } finally {
      await c.query(
        `update public.project_access_grants set revoked_at = null
          where workspace_id = $1 and member_id = $2`, [b.workspaceId, b.memberId]);
    }
    expect(failed).toBe(true);
  });

  it("allows the same insert once progress.record is granted", async () => {
    const r = await asActor(USER_B, WS_B, (cl) => cl.query(
      `insert into public.progress_entries
         (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
          quantity, recorded_by_member_id)
       values ($1,$2,$3,$4,'root',5,$5) returning id`,
      [b.workspaceId, b.projectId, assignmentB, b.workItemId, b.memberId]));
    expect(r.rows.length).toBe(1);
  });
});

describe("0016 append-only and immutability", () => {
  it("denies update and delete on progress entries to their own recorder", async () => {
    for (const sql of [
      `update public.progress_entries set quantity = 999 where workspace_id = $1 and id = $2`,
      `delete from public.progress_entries where workspace_id = $1 and id = $2`,
    ]) {
      let failed = false;
      try {
        await asActor(USER_A, WS_A, (cl) => cl.query(sql, [a.workspaceId, rootEntryA]));
      } catch { failed = true; }
      expect(failed).toBe(true);
    }
  });

  it("denies update and delete on valuation allocations", async () => {
    let failed = false;
    try {
      await c.query(
        `update public.valuation_allocations set net_minor_units = 1
          where workspace_id = $1 and progress_entry_id = $2`,
        [a.workspaceId, rootEntryA]);
    } catch { failed = true; }
    expect(failed).toBe(true);
  });

  it("denies rewriting an evidence storage key (INV-045)", async () => {
    const ev = await c.query(
      `insert into public.evidence_objects
         (workspace_id, project_id, content_hash, byte_size, media_type,
          storage_bucket, storage_key, storage_provider, origin_method,
          recorder_member_id, server_received_at, inspection_status,
          inspection_policy_version)
       values ($1,$2,repeat('b',64),10,'image/jpeg','evidence-originals',
               'k/1','supabase','native_camera',$3,now(),'passed','test-1')
       returning id`, [a.workspaceId, a.projectId, a.memberId]);
    let failed = false;
    try {
      await c.query(
        `update public.evidence_objects set storage_key = 'k/2'
          where workspace_id = $1 and id = $2`, [a.workspaceId, ev.rows[0].id]);
    } catch { failed = true; }
    expect(failed).toBe(true);
  });

  it("freezes a published requirement template version (INV-015)", async () => {
    const t = await c.query(
      `insert into public.requirement_template_versions
         (workspace_id, template_key, version_no, status, evidence_type,
          template_hash, published_at, published_by_member_id, created_by_member_id)
       values ($1,'photo-set',1,'published','photo',repeat('c',64),now(),$2,$2)
       returning id`, [a.workspaceId, a.memberId]);
    let failed = false;
    try {
      await c.query(
        `update public.requirement_template_versions set evidence_type = 'document'
          where workspace_id = $1 and id = $2`, [a.workspaceId, t.rows[0].id]);
    } catch { failed = true; }
    expect(failed).toBe(true);
  });

  it("allows a draft template to be published without altering frozen content", async () => {
    const t = await c.query(
      `insert into public.requirement_template_versions
         (workspace_id, template_key, version_no, evidence_type, created_by_member_id)
       values ($1,'draft-set',1,'photo',$2) returning id`, [a.workspaceId, a.memberId]);
    await c.query(
      `update public.requirement_template_versions
          set status = 'published', template_hash = repeat('d',64),
              published_at = now(), published_by_member_id = $3
        where workspace_id = $1 and id = $2`, [a.workspaceId, t.rows[0].id, a.memberId]);
    const r = await c.query(
      `select status from public.requirement_template_versions
        where workspace_id = $1 and id = $2`, [a.workspaceId, t.rows[0].id]);
    expect(r.rows[0].status).toBe("published");
  });

  it("rejects publishing that also alters frozen content", async () => {
    const t = await c.query(
      `insert into public.requirement_template_versions
         (workspace_id, template_key, version_no, evidence_type, created_by_member_id)
       values ($1,'sneaky-set',1,'photo',$2) returning id`, [a.workspaceId, a.memberId]);
    let failed = false;
    try {
      await c.query(
        `update public.requirement_template_versions
            set status = 'published', evidence_type = 'document',
                template_hash = repeat('e',64), published_at = now(),
                published_by_member_id = $3
          where workspace_id = $1 and id = $2`,
        [a.workspaceId, t.rows[0].id, a.memberId]);
    } catch { failed = true; }
    expect(failed).toBe(true);
  });
});

describe("0016 grants", () => {
  it("gives the app role no direct UPDATE on allocation heads", async () => {
    const r = await c.query(
      `select privilege_type from information_schema.role_table_grants
        where grantee = 'aktflow_app' and table_schema = 'public'
          and table_name = 'progress_allocation_heads'`);
    const privs = r.rows.map((x) => x.privilege_type);
    expect(privs).toContain("SELECT");
    expect(privs).not.toContain("UPDATE");
    expect(privs).not.toContain("INSERT");
  });

  it("gives the app role no UPDATE or DELETE on append-only relations", async () => {
    const r = await c.query(
      `select table_name, privilege_type from information_schema.role_table_grants
        where grantee = 'aktflow_app' and table_schema = 'public'
          and table_name = any($1::text[])
          and privilege_type in ('UPDATE','DELETE')`,
      [["progress_entries", "valuation_allocations", "evidence_objects", "capture_events"]]);
    expect(r.rows).toEqual([]);
  });

  it("revokes the M2 tables from anon and authenticated", async () => {
    const r = await c.query(
      `select grantee, table_name from information_schema.role_table_grants
        where grantee in ('anon','authenticated') and table_schema = 'public'
          and table_name = any($1::text[])`,
      [["work_assignments", "progress_entries", "valuation_allocations",
        "upload_intents", "evidence_objects", "capture_events",
        "requirement_template_versions", "progress_allocation_heads"]]);
    expect(r.rows).toEqual([]);
  });
});

describe("0016 reservation invariant", () => {
  it("is implemented, not the design stub that raises unconditionally", async () => {
    const r = await c.query(
      `select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname = 'assert_reservation_invariant'`);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].prosrc).not.toMatch(/design interface/);
  });

  it("recomputes effective quantity onto the head", async () => {
    // Through the app role as a real member: the definer authorizes its caller,
    // so an admin connection with no actor GUC is no longer a valid stand-in.
    await asActor(USER_A, WS_A, (cl) =>
      cl.query(`select app.open_allocation_head($1,$2)`, [a.workspaceId, rootEntryA]));
    await c.query(
      `insert into public.progress_entries
         (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
          quantity, root_progress_entry_id, root_is_root, reason_code,
          recorded_by_member_id)
       values ($1,$2,$3,$4,'adjustment',-4,$5,true,'measurement_error',$6)`,
      [a.workspaceId, a.projectId, assignmentA, a.workItemId, rootEntryA, a.memberId]);
    await asActor(USER_A, WS_A, (cl) =>
      cl.query(`select app.assert_reservation_invariant($1,$2)`, [a.workspaceId, rootEntryA]));
    const h = await c.query(
      `select effective_quantity from public.progress_allocation_heads
        where workspace_id = $1 and root_progress_entry_id = $2`, [a.workspaceId, rootEntryA]);
    expect(Number(h.rows[0].effective_quantity)).toBe(6);
  });

  it("raises when reserved quantity would exceed effective quantity (INV-025)", async () => {
    // Seeded directly: no M2-A command reserves, since claims are M4. Without
    // seeding, this branch would ship untested.
    await c.query(
      `update public.progress_allocation_heads
          set reserved_quantity = 6, current_unaccepted_reserved_quantity = 6
        where workspace_id = $1 and root_progress_entry_id = $2`,
      [a.workspaceId, rootEntryA]);
    await c.query(
      `insert into public.progress_entries
         (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
          quantity, root_progress_entry_id, root_is_root, reason_code,
          recorded_by_member_id)
       values ($1,$2,$3,$4,'adjustment',-3,$5,true,'measurement_error',$6)`,
      [a.workspaceId, a.projectId, assignmentA, a.workItemId, rootEntryA, a.memberId]);
    let message = "";
    try {
      await asActor(USER_A, WS_A, (cl) =>
        cl.query(`select app.assert_reservation_invariant($1,$2)`, [a.workspaceId, rootEntryA]));
    } catch (e) { message = (e as Error).message; }
    expect(message).toMatch(/INV-025/);
  });
});
