import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor } from "./pg";
import { seedM2World, grantM2Capabilities, seedAssignment, type M2Fixture } from "./m2-fixture";

// Coverage gaps the engineering review found in 0016's policies. Both are about
// write paths that the first RLS suite never exercised.

const WS = "cccc1111-1111-1111-1111-111111111111";
const USER = "cccc3333-3333-3333-3333-333333333333";

let c: Client;
let f: M2Fixture;
let assignmentId: string;
let rootId: string;

beforeAll(async () => {
  c = await adminClient();
  await c.query("truncate public.organizations cascade");
  f = await seedM2World(c, { workspaceId: WS, userId: USER, email: "c@example.test", suffix: "C" });
  await grantM2Capabilities(c, f);
  assignmentId = await seedAssignment(c, f);
  const r = await c.query(
    `insert into public.progress_entries
       (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
        quantity, recorded_by_member_id)
     values ($1,$2,$3,$4,'root',10,$5) returning id`,
    [WS, f.projectId, assignmentId, f.workItemId, f.memberId]);
  rootId = r.rows[0].id;
});

afterAll(async () => {
  await c.query("truncate public.organizations cascade");
  await c.end();
});

/** Revokes every capability except the ones named, runs fn, then restores. */
async function withOnly<T>(keep: readonly string[], fn: () => Promise<T>): Promise<T> {
  await c.query(
    `update public.project_access_grants set revoked_at = now()
      where workspace_id = $1 and member_id = $2 and capability <> all($3::text[])`,
    [WS, f.memberId, keep]);
  try { return await fn(); } finally {
    await c.query(
      `update public.project_access_grants set revoked_at = null
        where workspace_id = $1 and member_id = $2`, [WS, f.memberId]);
  }
}

describe("progress capability split is enforced per entry kind", () => {
  it("denies an adjustment to a member holding only progress.record", async () => {
    const failed = await withOnly(["project.view", "progress.record"], async () => {
      try {
        await asActor(USER, WS, (cl) => cl.query(
          `insert into public.progress_entries
             (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
              quantity, root_progress_entry_id, root_is_root, reason_code,
              recorded_by_member_id)
           values ($1,$2,$3,$4,'adjustment',-1,$5,true,'measurement_error',$6)`,
          [WS, f.projectId, assignmentId, f.workItemId, rootId, f.memberId]));
        return false;
      } catch { return true; }
    });
    expect(failed).toBe(true);
  });

  it("denies a root to a member holding only progress.adjust", async () => {
    const failed = await withOnly(["project.view", "progress.adjust"], async () => {
      try {
        await asActor(USER, WS, (cl) => cl.query(
          `insert into public.progress_entries
             (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
              quantity, recorded_by_member_id)
           values ($1,$2,$3,$4,'root',3,$5)`,
          [WS, f.projectId, assignmentId, f.workItemId, f.memberId]));
        return false;
      } catch { return true; }
    });
    expect(failed).toBe(true);
  });
});

describe("capture events are provenance, not a free-write surface", () => {
  it("denies a capture event to a member without evidence.record", async () => {
    // 0016's insert policy only required the evidence capability when
    // project_id was present, and the column was nullable. These rows are
    // append-only provenance facts, so a forged one is permanent. 0018 makes
    // project_id NOT NULL and demands evidence.record unconditionally.
    const failed = await withOnly(["project.view"], async () => {
      try {
        await asActor(USER, WS, (cl) => cl.query(
          `insert into public.capture_events
             (workspace_id, project_id, device_capture_id, client_state, event_source)
           values ($1,$2,'forged-device','server_confirmed','server')`, [WS, f.projectId]));
        return false;
      } catch { return true; }
    });
    expect(failed).toBe(true);
  });

  it("denies a capture event whose project disagrees with its intent", async () => {
    // The member DOES hold evidence.record — on a second project. Without the
    // intent-agreement clause, that capability would let them attach forged
    // provenance to an intent belonging to a project they cannot see. The row
    // supplies a valid project_id, so this exercises the policy rather than the
    // NOT NULL constraint.
    const intent = await c.query(
      `insert into public.upload_intents
         (workspace_id, project_id, work_assignment_id, created_by_member_id,
          origin_method, idempotency_key, request_hash, expected_byte_size,
          expected_content_hash, allowed_content_family, claimed_media_type, expires_at)
       values ($1,$2,$3,$4,'native_camera','k1',repeat('a',64),10,repeat('b',64),
               'image','image/jpeg', now() + interval '1 day')
       returning id`, [WS, f.projectId, assignmentId, f.memberId]);

    const other = await c.query(
      `insert into public.projects (workspace_id, name, created_by)
       values ($1,'Приклад-Інший-Проєкт',$2) returning id`, [WS, USER]);
    const otherProjectId: string = other.rows[0].id;
    await c.query(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,'evidence.record',$4), ($1,$2,$3,'project.view',$4)`,
      [WS, otherProjectId, f.memberId, USER]);

    let failed = false;
    try {
      await asActor(USER, WS, (cl) => cl.query(
        `insert into public.capture_events
           (workspace_id, project_id, upload_intent_id, device_capture_id,
            client_state, event_source)
         values ($1,$2,$3,'forged-device','server_confirmed','server')`,
        [WS, otherProjectId, intent.rows[0].id]));
    } catch { failed = true; }
    expect(failed).toBe(true);
  });
});
