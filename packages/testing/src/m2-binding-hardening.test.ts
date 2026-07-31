import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor } from "./pg";
import {
  seedM2World, grantM2Capabilities, seedAssignment, dropM2Workspaces, type M2Fixture,
} from "./m2-fixture";

// Migrations 0023 and 0025. Each test attempts the exact write the hardening
// exists to stop; a green suite that never tries the attack proves nothing.

const WS_A = "eeee1111-1111-1111-1111-111111111111";
const WS_B = "eeee2222-2222-2222-2222-222222222222";
const USER_A = "eeee3333-3333-3333-3333-333333333333";
const USER_B = "eeee4444-4444-4444-4444-444444444444";

let c: Client;
let a: M2Fixture;
let b: M2Fixture;
let assignmentA: string;

/** Runs SQL and reports the SQLSTATE, or null when it succeeded. */
async function sqlstate(fn: () => Promise<unknown>): Promise<string | null> {
  try { await fn(); return null; } catch (e) { return (e as { code?: string }).code ?? "unknown"; }
}

beforeAll(async () => {
  c = await adminClient();
  await dropM2Workspaces(c, [WS_A, WS_B]);
  a = await seedM2World(c, { workspaceId: WS_A, userId: USER_A, email: "ea@example.test", suffix: "EA" });
  b = await seedM2World(c, { workspaceId: WS_B, userId: USER_B, email: "eb@example.test", suffix: "EB" });
  await grantM2Capabilities(c, a);
  await grantM2Capabilities(c, b);
  assignmentA = await seedAssignment(c, a);

  // A second member of workspace A, used by the ownership probes below. Created
  // here rather than inside one test, so deleting or reordering a test cannot
  // leave the others without it.
  await c.query(
    `insert into public.memberships (organization_id, user_id, role, status)
     values ($1,$2,'member','active')`, [a.workspaceId, USER_B]);
});

afterAll(async () => {
  await dropM2Workspaces(c, [WS_A, WS_B]);
  await c.end();
});

describe("a progress entry cannot pair one project's assignment with another's work item", () => {
  it("rejects a foreign work item on a local assignment", async () => {
    // The valuation writer sums by work_item_id, so this would silently move
    // another project's performed quantity.
    const code = await sqlstate(() => c.query(
      `insert into public.progress_entries
         (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
          quantity, recorded_by_member_id)
       values ($1,$2,$3,$4,'root',5,$5)`,
      [a.workspaceId, a.projectId, assignmentA, b.workItemId, a.memberId]));
    expect(code).toBe("23503");
  });

  it("still accepts the assignment's own work item", async () => {
    const code = await sqlstate(() => c.query(
      `insert into public.progress_entries
         (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
          quantity, recorded_by_member_id)
       values ($1,$2,$3,$4,'root',5,$5)`,
      [a.workspaceId, a.projectId, assignmentA, a.workItemId, a.memberId]));
    expect(code).toBeNull();
  });
});

describe("an assignment cannot pin a draft template", () => {
  it("rejects a draft version", async () => {
    const draft = await c.query(
      `insert into public.requirement_template_versions
         (workspace_id, template_key, version_no, evidence_type, created_by_member_id)
       values ($1,'draft-pin',1,'photo',$2) returning id`, [a.workspaceId, a.memberId]);

    const code = await sqlstate(() => c.query(
      `insert into public.work_assignments
         (workspace_id, project_id, contract_id, contract_version_id, work_item_id,
          requirement_template_version_id, created_by_member_id)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [a.workspaceId, a.projectId, a.contractId, a.contractVersionId, a.workItemId,
       draft.rows[0].id, a.memberId]));
    expect(code).toBe("23503");
  });

  it("accepts a published version", async () => {
    const published = await c.query(
      `insert into public.requirement_template_versions
         (workspace_id, template_key, version_no, status, evidence_type, allowed_media,
          template_hash, published_at, published_by_member_id, created_by_member_id)
       values ($1,'pub-pin',1,'published','photo',
               '{"mimeTypes":["image/jpeg"],"maxByteSize":1024}'::jsonb,
               repeat('a',64), now(), $2, $2) returning id`,
      [a.workspaceId, a.memberId]);

    const code = await sqlstate(() => c.query(
      `insert into public.work_assignments
         (workspace_id, project_id, contract_id, contract_version_id, work_item_id,
          requirement_template_version_id, created_by_member_id)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [a.workspaceId, a.projectId, a.contractId, a.contractVersionId, a.workItemId,
       published.rows[0].id, a.memberId]));
    expect(code).toBeNull();
  });

  it("rejects publishing a template whose media rules are malformed", async () => {
    // The upload gate calls allowed_media.mimeTypes.includes, which throws on a
    // bad shape and widens to the fallback when the lookup finds nothing.
    for (const media of ['{}', '{"mimeTypes":[]}', '{"mimeTypes":["image/jpeg"]}',
                         '{"mimeTypes":"image/jpeg","maxByteSize":1}']) {
      const code = await sqlstate(() => c.query(
        `insert into public.requirement_template_versions
           (workspace_id, template_key, version_no, status, evidence_type, allowed_media,
            template_hash, published_at, published_by_member_id, created_by_member_id)
         values ($1,$2,1,'published','photo',$3::jsonb,repeat('a',64),now(),$4,$4)`,
        [a.workspaceId, `bad-${Math.random().toString(36).slice(2, 8)}`, media, a.memberId]));
      expect(code, media).toBe("23514");
    }
  });
});

describe("evidence rows must agree with the intent they claim", () => {
  let intentId: string;
  let key: string;

  beforeAll(async () => {
    key = `${crypto.randomUUID()}/${crypto.randomUUID()}`;
    const r = await c.query(
      `insert into public.upload_intents
         (workspace_id, project_id, work_assignment_id, created_by_member_id,
          origin_method, idempotency_key, request_hash, expected_byte_size,
          expected_content_hash, allowed_content_family, claimed_media_type,
          staging_bucket, staging_storage_key, expires_at)
       values ($1,$2,$3,$4,'native_camera',$5,repeat('a',64),11,repeat('b',64),
               'image','image/jpeg','evidence',$6, now() + interval '1 day')
       returning id`,
      [a.workspaceId, a.projectId, assignmentA, a.memberId, crypto.randomUUID(), key]);
    intentId = r.rows[0].id;
  });

  const insertEvidence = (over: Record<string, unknown>) => {
    const v = {
      workspace_id: a.workspaceId, project_id: a.projectId,
      content_hash: "b".repeat(64), byte_size: 11, media_type: "image/jpeg",
      storage_bucket: "evidence", storage_key: key, storage_provider: "supabase",
      origin_method: "native_camera", recorder_member_id: a.memberId,
      upload_intent_id: intentId, inspection_status: "passed",
      inspection_policy_version: "test", ...over,
    };
    const cols = Object.keys(v);
    return asActor(USER_A, WS_A, (cl) => cl.query(
      `insert into public.evidence_objects (${cols.join(",")}, server_received_at)
       values (${cols.map((_, i) => `$${i + 1}`).join(",")}, now())`,
      cols.map((k) => (v as Record<string, unknown>)[k])));
  };

  it("cannot be written directly at all", async () => {
    // 0029 removed the insert grant. Constraining more columns from a policy
    // would not have fixed the shape: evidence is the product of one server
    // transition, not an INSERT the caller assembles.
    expect(await sqlstate(() => insertEvidence({}))).toBe("42501");
  });

  it("rejects evidence with no upload intent at all", async () => {
    expect(await sqlstate(() => insertEvidence({ upload_intent_id: null }))).toBeTruthy();
  });





});

describe("evidence is created only by the finalization command", () => {
  let intentId: string;
  let key: string;

  beforeAll(async () => {
    key = `${crypto.randomUUID()}/${crypto.randomUUID()}`;
    const r = await c.query(
      `insert into public.upload_intents
         (workspace_id, project_id, work_assignment_id, created_by_member_id,
          origin_method, idempotency_key, request_hash, expected_byte_size,
          expected_content_hash, allowed_content_family, claimed_media_type,
          staging_bucket, staging_storage_key, expires_at)
       values ($1,$2,$3,$4,'native_camera',$5,repeat('a',64),11,repeat('d',64),
               'image','image/jpeg','evidence',$6, now() + interval '1 day')
       returning id`,
      [a.workspaceId, a.projectId, assignmentA, a.memberId, crypto.randomUUID(), key]);
    intentId = r.rows[0].id;
  });

  const finalize = (over: Partial<{
    hash: string; size: number; media: string; status: string; policy: string;
  }> = {}) => asActor(USER_A, WS_A, (cl) => cl.query<{ evidence: string | null }>(
    `select app.finalize_upload_intent($1,$2,$3,$4,$5,$6,$7) as evidence`,
    [a.workspaceId, intentId, over.hash ?? "d".repeat(64), over.size ?? 11,
     over.media ?? "image/jpeg", over.status ?? "passed", over.policy ?? "probe-1"]));

  it("refuses content that is not what authorization fixed", async () => {
    // The hash and size were declared when the upload was authorized, so a
    // caller cannot present different bytes as this intent's evidence.
    expect(await sqlstate(() => finalize({ hash: "e".repeat(64) }))).toBeTruthy();
    expect(await sqlstate(() => finalize({ size: 12 }))).toBeTruthy();
  });

  it("copies provenance from the intent rather than taking it from the caller", async () => {
    const r = await finalize();
    const id = r.rows[0]!.evidence;
    expect(id).toBeTruthy();

    const row = await c.query(
      `select storage_key, storage_bucket, storage_provider, recorder_member_id,
              origin_method, relation_kind
         from public.evidence_objects where id = $1`, [id]);
    expect(row.rows[0].storage_key).toBe(key);
    expect(row.rows[0].storage_bucket).toBe("evidence");
    expect(row.rows[0].storage_provider).toBe("supabase");
    expect(row.rows[0].recorder_member_id).toBe(a.memberId);
    expect(row.rows[0].relation_kind).toBe("original");

    // And the intent moved with it, in the same statement.
    const intent = await c.query(
      `select status, finalized_evidence_object_id from public.upload_intents
        where id = $1`, [intentId]);
    expect(intent.rows[0].status).toBe("available");
    expect(intent.rows[0].finalized_evidence_object_id).toBe(id);
  });

  it("returns the same receipt when called again", async () => {
    const again = await finalize();
    const row = await c.query(
      `select finalized_evidence_object_id from public.upload_intents where id = $1`,
      [intentId]);
    expect(again.rows[0]!.evidence).toBe(row.rows[0].finalized_evidence_object_id);

    const count = await c.query(
      `select count(*) n from public.evidence_objects where upload_intent_id = $1`,
      [intentId]);
    expect(count.rows[0].n).toBe("1");
  });

  it("refuses a caller who did not create the intent", async () => {
    expect(await sqlstate(() => asActor(USER_B, WS_A, (cl) => cl.query(
      `select app.finalize_upload_intent($1,$2,$3,$4,$5,$6,$7)`,
      [a.workspaceId, intentId, "d".repeat(64), 11, "image/jpeg", "passed", "probe"]))))
      .toBeTruthy();
  });
});

describe("upload intent identity is not writable", () => {
  it("gives the app role no update on the storage key or bucket", async () => {
    const r = await c.query(
      `select column_name from information_schema.column_privileges
        where grantee = 'aktflow_app' and table_name = 'upload_intents'
          and privilege_type = 'UPDATE'
        order by column_name`);
    const cols = r.rows.map((x) => x.column_name).sort();
    expect(cols).toEqual(["failure_code", "finalized_evidence_object_id", "status", "version"]);
  });

  it("denies a member updating an intent they did not create", async () => {
    const mine = await c.query(
      `insert into public.upload_intents
         (workspace_id, project_id, work_assignment_id, created_by_member_id,
          origin_method, idempotency_key, request_hash, expected_byte_size,
          expected_content_hash, allowed_content_family, claimed_media_type,
          staging_bucket, staging_storage_key, expires_at)
       values ($1,$2,$3,$4,'native_camera',$5,repeat('a',64),10,repeat('b',64),
               'image','image/jpeg','evidence',$6, now() + interval '1 day')
       returning id`,
      [a.workspaceId, a.projectId, assignmentA, a.memberId, crypto.randomUUID(),
       `${crypto.randomUUID()}/${crypto.randomUUID()}`]);

    // A second member of the same workspace, granted evidence.record on the
    // same project — previously enough to retarget somebody else's intent.
    const other = await c.query(
      `select id from public.memberships where organization_id = $1 and user_id = $2`,
      [a.workspaceId, USER_B]);
    await c.query(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,'evidence.record',$4), ($1,$2,$3,'project.view',$4)
       on conflict do nothing`,
      [a.workspaceId, a.projectId, other.rows[0].id, USER_A]);

    const r = await asActor(USER_B, WS_A, (cl) => cl.query(
      `update public.upload_intents set status = 'available'
        where workspace_id = $1 and id = $2`, [a.workspaceId, mine.rows[0].id]));
    // RLS filters the row out rather than raising: zero rows updated.
    expect(r.rowCount ?? 0).toBe(0);

    const after = await c.query(
      `select status from public.upload_intents where id = $1`, [mine.rows[0].id]);
    expect(after.rows[0].status).toBe("intent_authorized");
  });
});

describe("a valuation allocation is bound to the fact it values", () => {
  let rootA: string;
  let adjustmentA: string;

  beforeAll(async () => {
    const r = await c.query(
      `insert into public.progress_entries
         (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
          quantity, recorded_by_member_id)
       values ($1,$2,$3,$4,'root',7,$5) returning id`,
      [a.workspaceId, a.projectId, assignmentA, a.workItemId, a.memberId]);
    rootA = r.rows[0].id;

    const adj = await c.query(
      `insert into public.progress_entries
         (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
          quantity, root_progress_entry_id, root_is_root, reason_code,
          recorded_by_member_id)
       values ($1,$2,$3,$4,'adjustment',-2,$5,true,'measurement_error',$6)
       returning id`,
      [a.workspaceId, a.projectId, assignmentA, a.workItemId, rootA, a.memberId]);
    adjustmentA = adj.rows[0].id;
  });

  const insertAllocation = (over: Record<string, unknown>) => {
    const v: Record<string, unknown> = {
      workspace_id: a.workspaceId, project_id: a.projectId, contract_id: a.contractId,
      work_item_id: a.workItemId, progress_entry_id: rootA, root_progress_entry_id: rootA,
      lineage_key: `probe:${crypto.randomUUID()}`, quantity: 7, funded_quantity: 7,
      net_minor_units: 100, tax_minor_units: 20, gross_minor_units: 120, ...over,
    };
    const cols = Object.keys(v);
    return c.query(
      `insert into public.valuation_allocations (${cols.join(",")})
       values (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
      cols.map((k) => v[k]));
  };

  it("rejects a quantity that disagrees with the progress fact", async () => {
    // The whole point: an allocation that valued a different amount of work
    // than the fact records used to be writable, and the append-only trigger
    // then made it permanent.
    expect(await sqlstate(() => insertAllocation({ quantity: 99 }))).toBe("23503");
  });

  it("rejects a work item the progress entry does not belong to", async () => {
    expect(await sqlstate(() => insertAllocation({ work_item_id: b.workItemId })))
      .toBeTruthy();
  });

  it("rejects a root reference that points at an adjustment", async () => {
    expect(await sqlstate(() => insertAllocation({ root_progress_entry_id: adjustmentA })))
      .toBe("23503");
  });

  it("rejects funded quantity larger than the slice", async () => {
    expect(await sqlstate(() => insertAllocation({
      progress_entry_id: adjustmentA, root_progress_entry_id: rootA,
      quantity: -2, funded_quantity: -5,
    }))).toBe("23514");
  });

  it("rejects funded quantity with the wrong sign", async () => {
    expect(await sqlstate(() => insertAllocation({
      progress_entry_id: adjustmentA, root_progress_entry_id: rootA,
      quantity: -2, funded_quantity: 2,
    }))).toBe("23514");
  });

  it("accepts an allocation that matches its fact exactly", async () => {
    expect(await sqlstate(() => insertAllocation({}))).toBeNull();
  });

  it("requires progress.adjust to value an adjustment, not progress.record", async () => {
    await c.query(
      `update public.project_access_grants set revoked_at = now()
        where workspace_id = $1 and member_id = $2 and capability = 'progress.adjust'`,
      [a.workspaceId, a.memberId]);
    try {
      const code = await sqlstate(() => asActor(USER_A, WS_A, (cl) => cl.query(
        `insert into public.valuation_allocations
           (workspace_id, project_id, contract_id, work_item_id, progress_entry_id,
            root_progress_entry_id, lineage_key, quantity, funded_quantity,
            net_minor_units, tax_minor_units, gross_minor_units)
         values ($1,$2,$3,$4,$5,$6,$7,-2,-2,-10,-2,-12)`,
        [a.workspaceId, a.projectId, a.contractId, a.workItemId, adjustmentA, rootA,
         `probe:${crypto.randomUUID()}`])));
      // 42501: the policy refused, because progress.record does not authorize
      // valuing an adjustment.
      expect(code).toBe("42501");
    } finally {
      await c.query(
        `update public.project_access_grants set revoked_at = null
          where workspace_id = $1 and member_id = $2`, [a.workspaceId, a.memberId]);
    }
  });
});

describe("server-only transitions and the quota oracle", () => {
  it("does not let a member write blocked_at", async () => {
    // 0027 granted the column so finalize could record it; the intent's own
    // creator could then null it and keep the content out of the purge queue
    // for good, defeating the retention window that grant existed to serve.
    const r = await c.query(
      `select column_name from information_schema.column_privileges
        where grantee = 'aktflow_app' and table_name = 'upload_intents'
          and privilege_type = 'UPDATE'`);
    expect(r.rows.map((x) => x.column_name)).not.toContain("blocked_at");
  });

  it("blocks only from a state that can still be blocked", async () => {
    const key = `${crypto.randomUUID()}/${crypto.randomUUID()}`;
    const intent = await c.query(
      `insert into public.upload_intents
         (workspace_id, project_id, work_assignment_id, created_by_member_id,
          origin_method, idempotency_key, request_hash, expected_byte_size,
          expected_content_hash, allowed_content_family, claimed_media_type,
          staging_bucket, staging_storage_key, expires_at, status)
       values ($1,$2,$3,$4,'native_camera',$5,repeat('a',64),10,repeat('b',64),
               'image','image/jpeg','evidence',$6, now() + interval '1 day','expired')
       returning id`,
      [a.workspaceId, a.projectId, assignmentA, a.memberId, crypto.randomUUID(), key]);

    // Already expired: blocking must not overwrite that and restart the
    // retention clock from scratch.
    const applied = await asActor(USER_A, WS_A, (cl) => cl.query<{ b: boolean }>(
      `select app.block_upload_intent($1,$2,$3) as b`,
      [a.workspaceId, intent.rows[0].id, "declared_type_mismatch"]));
    expect(applied.rows[0]!.b).toBe(false);

    const after = await c.query(
      `select status, blocked_at from public.upload_intents where id = $1`,
      [intent.rows[0].id]);
    expect(after.rows[0].status).toBe("expired");
    expect(after.rows[0].blocked_at).toBeNull();
  });

  it("refuses to report another workspace's storage usage", async () => {
    // SECURITY DEFINER with an arbitrary workspace argument and no actor check
    // made this readable by any authenticated session.
    let message = "";
    try {
      await asActor(USER_A, WS_A, (cl) =>
        cl.query(`select app.evidence_bytes_in_use($1)`, [b.workspaceId]));
    } catch (e) { message = (e as Error).message; }
    expect(message).toMatch(/not a member/);
  });

  it("still answers for the caller's own workspace", async () => {
    const r = await asActor(USER_A, WS_A, (cl) =>
      cl.query<{ n: string }>(`select app.evidence_bytes_in_use($1) as n`, [a.workspaceId]));
    expect(Number(r.rows[0]!.n)).toBeGreaterThanOrEqual(0);
  });
});

