import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, asActor, dropWorkspaces } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import { seedAssignment } from "./m2-occurrences-fixture";

/**
 * READINESS GATE 11, MODULE evidence, member plane (DEV-016, BL-092).
 *
 * The DEV-014 shape: the owner of A reads A's rows; the owner of B, with the
 * same grants on its own project and declaring workspace A, reads only B's.
 * Each workspace gets, from the admin client, an assignment on the published
 * baseline, one upload intent, the evidence finalised from it (the shape
 * m5-external-rls.test.ts seeds) and one device capture event. Storage keys are
 * random: both key columns are unique across every workspace. Nothing goes
 * through app.finalize_upload_intent, so nothing is written to storage.
 *
 * The goproceed_service row of capture_events is NOT covered here: its policy
 * does not look at the declared workspace (BL-102).
 *
 * m5-external-rls.test.ts counts capture_events across all workspaces and
 * expects zero, so a run killed before afterAll leaves m5 red until this file
 * runs again (its beforeAll drops the rows). No resetDb.
 */
const WS_A = "de162a00-0000-4000-8000-000000000001";
const WS_B = "de162b00-0000-4000-8000-000000000001";
const USER_A = "de162a00-0000-4000-8000-0000000000a1";
const USER_B = "de162b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];

let admin: Client;

async function seedSide(ws: string, user: string, suffix: string): Promise<void> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const assignmentId = await seedAssignment(admin, rules, rules.publishedVersionId, rules.publishedWorkItemId);
  const key = `${randomUUID()}/dev016`;
  const hash = createHash("sha256").update(`dev016:${ws}:evidence`).digest("hex");
  const intent = await admin.query<{ id: string }>(
    `insert into public.upload_intents
       (workspace_id, project_id, work_assignment_id, created_by_member_id, origin_method,
        idempotency_key, request_hash, expected_byte_size, expected_content_hash,
        allowed_content_family, claimed_media_type, status, staging_bucket, staging_storage_key, expires_at)
     values ($1, $2, $3, $4, 'native_camera', $5, repeat('a',64), 11, $6, 'image', 'image/jpeg',
             'available', 'evidence', $7, now() + interval '1 day')
     returning id`,
    [ws, rules.projectId, assignmentId, rules.memberId, `dev016-${randomUUID()}`, hash, key]);
  const intentId = intent.rows[0]!.id;
  await admin.query(
    `insert into public.evidence_objects
       (workspace_id, project_id, content_hash, byte_size, media_type, storage_bucket, storage_key,
        storage_provider, origin_method, recorder_member_id, upload_intent_id, inspection_status,
        inspection_policy_version, server_received_at)
     values ($1, $2, $3, 11, 'image/jpeg', 'evidence', $4, 'supabase', 'native_camera', $5, $6,
             'passed', 'test', now())`,
    [ws, rules.projectId, hash, key, rules.memberId, intentId]);
  await admin.query(
    `insert into public.capture_events
       (workspace_id, project_id, work_assignment_id, upload_intent_id, device_capture_id,
        client_state, event_source)
     values ($1, $2, $3, $4, $5, 'server_confirmed', 'device')`,
    [ws, rules.projectId, assignmentId, intentId, randomUUID()]);
}

/** The distinct workspaces of the rows `actor` can read, declaring workspace A. */
async function seen(actor: string, sql: string): Promise<string[]> {
  const r = await asActor<{ ws: string }>(actor, WS_A, (c) => c.query(sql, [BOTH]));
  return r.rows.map((row) => row.ws).sort();
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  await seedSide(WS_A, USER_A, "DEV016-EV-A");
  await seedSide(WS_B, USER_B, "DEV016-EV-B");
}, 180_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("evidence isolation — the owner of A reaches rows of A and the owner of B declaring A reaches only rows of B", () => {
  it("upload_intents: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    // ui_external_select needs an external session, which asActor never sets.
    const sql = "select distinct workspace_id as ws from public.upload_intents where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("evidence_objects: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.evidence_objects where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("capture_events: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.capture_events where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });
});
