import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, appClient, dropWorkspaces, serviceClient } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import { seedClosureWorld } from "./m3-closure-fixture";

/**
 * THE CROSS-WORKSPACE WRITE MINIMUM, MODULE evidence (DEV-084, BL-170).
 *
 * DEV-076 widened a `covered` row of technical/database/rls-coverage.csv: where
 * its principal can write, a test must show a principal of one workspace cannot
 * write into another. This module's rows are INSERT only: capture_events for
 * goproceed_app (the device event, ce_insert) and goproceed_service (the server
 * event, ce_insert_server), and upload_intents for goproceed_app (ui_insert).
 * One test per row of technical/database/rls-write-coverage.csv, each cited
 * there as its `negative_test`:
 *
 *   - INSERT carrying B's tenant key and parent ids: refused by the policy
 *     (42501), beside the same statement with A's ids succeeding (the control);
 *   - INSERT keeping A's tenant key with one of B's parent ids: refused by that
 *     parent's composite foreign key (23503, named), or by the policy (42501)
 *     where the policy reads the parent — the project a capability is asked
 *     on, and the upload intent both capture-event policies look up;
 *   - a column 0108 withdrew: refused by privilege.
 *
 * Neither table has an INSERT trigger (the only user trigger, capture_events'
 * immutability, is BEFORE UPDATE OR DELETE; asserted below), so nothing is
 * disabled. The probes therefore run on the real logins — goproceed_app_login
 * and goproceed_service_login under `SET LOCAL ROLE`, as packages/database's
 * transactions do — so app.upload_intent_scope_matches' `session_user` check is
 * the production one. Every probe's transaction is rolled back; no capture
 * event is ever committed (m5-external-rls.test.ts asserts the table empty).
 *
 * 0108 (owner, 2026-09-25) bound capture_events.work_assignment_id to its
 * workspace's assignment (BL-105) and narrowed both INSERT grants to the
 * columns the writers write. Out of scope, as named in rls-coverage.csv: the
 * service keeps its actor, so the inherited ce_insert admits a device event
 * in any workspace that actor is entitled to while another is declared (BL-101).
 *
 * The fixture is this file's own (ids `de084…`), dropped before and after. No
 * resetDb.
 */
const WS_A = "de084a00-0000-4000-8000-000000000001";
const WS_B = "de084b00-0000-4000-8000-000000000001";
const USER_A = "de084a00-0000-4000-8000-0000000000a1";
const USER_B = "de084b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];
const HEX64 = "c".repeat(64);

interface Side {
  ws: string; member: string; project: string; assignment: string; occurrence: string;
  /** An intent created by the owner, `intent_authorized`, committed. */
  intent: string;
}

/**
 * `reason` separates the two refusals SQLSTATE 42501 names: `policy` — a new
 * row's WITH CHECK; `privilege` — «permission denied for table». `constraint`
 * names the constraint a 23503 came from.
 */
interface Outcome {
  rowCount: number | null; code: string | null;
  reason: "policy" | "privilege" | "other" | null; constraint: string | null;
}

const refusedByPolicy: Outcome = { rowCount: null, code: "42501", reason: "policy", constraint: null };
const refusedByPrivilege: Outcome = { rowCount: null, code: "42501", reason: "privilege", constraint: null };
const inserted: Outcome = { rowCount: 1, code: null, reason: null, constraint: null };
const byForeignKey = (constraint: string): Outcome => ({ rowCount: null, code: "23503", reason: "other", constraint });

let admin: Client;
let A: Side;
let B: Side;

async function seedSide(ws: string, user: string, suffix: string): Promise<Side> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const w = await seedClosureWorld(admin, rules);
  await admin.query(
    `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
     values ($1, $2, $3, 'evidence.record', $4) on conflict do nothing`,
    [ws, rules.projectId, rules.memberId, user]);
  const intent = await admin.query<{ id: string }>(
    `insert into public.upload_intents
       (workspace_id, project_id, work_assignment_id, created_by_member_id, origin_method,
        idempotency_key, request_hash, expected_byte_size, expected_content_hash,
        allowed_content_family, claimed_media_type, staging_bucket, staging_storage_key, expires_at)
     values ($1, $2, $3, $4, 'native_camera', $5, '${HEX64}', 10, '${HEX64}', 'image', 'image/jpeg',
             'evidence', $6, now() + interval '1 day')
     returning id`,
    [ws, rules.projectId, w.assignmentId, rules.memberId, `dev084-${randomUUID()}`, `${randomUUID()}/dev084`]);
  return {
    ws, member: rules.memberId, project: rules.projectId, assignment: w.assignmentId,
    occurrence: w.blockingA, intent: intent.rows[0]!.id,
  };
}

/**
 * Each statement in its own savepoint of one transaction on a real login, under
 * `SET LOCAL ROLE role` with the given actor and declared workspace; the
 * transaction is always rolled back.
 */
async function outcomes(
  login: "app" | "service", statements: { sql: string; params: unknown[]; actor: string; declared: string }[],
): Promise<Outcome[]> {
  const c = login === "app" ? appClient() : serviceClient();
  await c.connect();
  const out: Outcome[] = [];
  try {
    await c.query("begin");
    await c.query(`set local role ${login === "app" ? "goproceed_app" : "goproceed_service"}`);
    for (const s of statements) {
      await c.query("savepoint probe");
      await c.query(
        `select set_config('app.actor_user_id', $1, true), set_config('app.organization_id', $2, true),
                set_config('app.external_session_id', '', true)`, [s.actor, s.declared]);
      try {
        const r = await c.query(s.sql, s.params);
        await c.query("release savepoint probe");
        out.push({ rowCount: r.rowCount, code: null, reason: null, constraint: null });
      } catch (e) {
        await c.query("rollback to savepoint probe");
        const { code, message, constraint } = e as { code?: string; message?: string; constraint?: string };
        // Only a new row's WITH CHECK refusal counts as `policy`, and only
        // «permission denied for table» as `privilege` (DEV-081 S2).
        const reason = /^new row violates row-level security policy for table "[^"]+"$/.test(message ?? "") ? "policy"
          : /^permission denied for table /.test(message ?? "") ? "privilege" : "other";
        out.push({ rowCount: null, code: code ?? "unknown", reason, constraint: constraint ?? null });
      }
    }
  } finally {
    await c.query("rollback").catch(() => undefined);
    await c.end().catch(() => undefined);
  }
  return out;
}

/**
 * app.upload_intent_scope_matches called directly on a real login, declaring
 * `declared`: its answer, or the SQLSTATE that refused the call.
 */
async function scopeAnswer(login: "app" | "service", declared: string, s: Side): Promise<boolean | string> {
  const c = login === "app" ? appClient() : serviceClient();
  await c.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${login === "app" ? "goproceed_app" : "goproceed_service"}`);
    await c.query("select set_config('app.organization_id', $1, true)", [declared]);
    const r = await c.query<{ ok: boolean }>(
      "select app.upload_intent_scope_matches($1, $2, $3) as ok", [s.ws, s.intent, s.project]);
    return r.rows[0]!.ok;
  } catch (e) {
    return (e as { code?: string }).code ?? "unknown";
  } finally {
    await c.query("rollback").catch(() => undefined);
    await c.end().catch(() => undefined);
  }
}

/** The authorize route's device event (authorize-upload-intent.ts), no RETURNING. */
const DEVICE_EVENT = `insert into public.capture_events
    (workspace_id, project_id, work_assignment_id, upload_intent_id,
     device_capture_id, client_state, event_source, claimed_capture_time,
     claimed_tz_offset, capture_time_trust)
  values ($1, $2, $3, $4, $5, 'not_sent', $6, null, null, 'unknown')`;
/** The finalize path's server event (finalize-upload-intent.ts), no RETURNING. */
const SERVER_EVENT = `insert into public.capture_events
    (workspace_id, project_id, work_assignment_id, upload_intent_id,
     device_capture_id, client_state, event_source, failure_code)
  values ($1, $2, $3, $4, $5, 'failed', $6, 'integrity_size_mismatch')`;
/** A column 0108 withdrew: the server's receipt time. */
const BACKDATED_EVENT = `insert into public.capture_events
    (workspace_id, project_id, work_assignment_id, upload_intent_id,
     device_capture_id, client_state, event_source, reported_at)
  values ($1, $2, $3, $4, $5, 'not_sent', $6, timestamptz '2020-01-01 00:00:00+00')`;

type EventOverride = Partial<Record<"ws" | "project" | "assignment" | "intent", string | null>>;

function event(s: Side, source: "device" | "server", o: EventOverride = {}): unknown[] {
  return [o.ws ?? s.ws, o.project ?? s.project,
    o.assignment === undefined ? s.assignment : o.assignment,
    o.intent === undefined ? s.intent : o.intent,
    `dev084-${randomUUID()}`, source];
}

/** The authorize route's twenty-two columns (authorize-upload-intent.ts), no RETURNING. */
const INTENT = `insert into public.upload_intents
    (id, workspace_id, project_id, work_assignment_id, created_by_member_id,
     device_capture_id, origin_method, original_filename, claimed_capture_time,
     claimed_tz_offset, source_app_version, idempotency_key, request_hash,
     expected_byte_size, expected_content_hash, allowed_content_family,
     claimed_media_type, staging_bucket, staging_storage_key, expires_at,
     quota_reserved_bytes, requirement_occurrence_id)
  values ($1, $2, $3, $4, $5, $6, 'native_camera', null, null, null, null, $7, '${HEX64}',
          10, '${HEX64}', 'image', 'image/jpeg', 'evidence', $8, now() + interval '1 day', 10, $9)`;
/** One column 0108 withdrew: an intent born past the state machine. */
const INTENT_BORN_AVAILABLE = `insert into public.upload_intents
    (id, workspace_id, project_id, work_assignment_id, created_by_member_id,
     device_capture_id, origin_method, idempotency_key, request_hash, expected_byte_size,
     expected_content_hash, allowed_content_family, claimed_media_type, staging_bucket,
     staging_storage_key, expires_at, quota_reserved_bytes, requirement_occurrence_id, status)
  values ($1, $2, $3, $4, $5, $6, 'native_camera', $7, '${HEX64}', 10, '${HEX64}', 'image', 'image/jpeg',
          'evidence', $8, now() + interval '1 day', 10, $9, 'available')`;

type IntentOverride = Partial<Record<"ws" | "project" | "assignment" | "creator" | "occurrence", string | null>>;

function intent(s: Side, o: IntentOverride = {}): unknown[] {
  return [randomUUID(), o.ws ?? s.ws, o.project ?? s.project, o.assignment ?? s.assignment,
    o.creator ?? s.member, `dev084-${randomUUID()}`, `dev084-${randomUUID()}`, `${randomUUID()}/dev084`,
    o.occurrence === undefined ? s.occurrence : o.occurrence];
}

const asOwner = (sql: string, params: unknown[]) => ({ sql, params, actor: USER_A, declared: "" });
const asService = (sql: string, params: unknown[], declared = WS_A, actor = "") => ({ sql, params, actor, declared });

beforeAll(async () => {
  // Every probed INSERT reads no column back: a RETURNING would apply the SELECT
  // policy to the new row and mask the INSERT policy (DEV-083).
  for (const sql of [DEVICE_EVENT, SERVER_EVENT, BACKDATED_EVENT, INTENT, INTENT_BORN_AVAILABLE]) {
    expect(sql).not.toMatch(/returning/i);
  }
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  A = await seedSide(WS_A, USER_A, "DEV084-A");
  B = await seedSide(WS_B, USER_B, "DEV084-B");
  // Premise: no INSERT trigger could answer before a policy here.
  const triggers = await admin.query<{ t: string }>(
    `select tgrelid::regclass::text || ':' || tgname as t from pg_trigger
      where tgrelid in ('public.capture_events'::regclass, 'public.upload_intents'::regclass)
        and not tgisinternal and (tgtype & 4) <> 0`);
  expect(triggers.rows.map((r) => r.t)).toEqual([]);
}, 240_000);

afterAll(async () => {
  // Counted before the drop, which would delete them (gp-security S2).
  const left = await admin.query<{ n: string }>(
    "select count(*) as n from public.capture_events where workspace_id = any($1)", [BOTH]);
  await dropWorkspaces(admin, BOTH);
  await admin.end();
  expect(Number(left.rows[0]?.n)).toBe(0);
});

describe("evidence cross-workspace write denial", () => {
  it("capture_events (member): an owner of A cannot record a device event in B or onto B's project, intent or assignment", async () => {
    expect(await outcomes("app", [
      asOwner(DEVICE_EVENT, event(B, "device")),
      asOwner(DEVICE_EVENT, event(B, "device", { intent: null, assignment: null })),
      asOwner(DEVICE_EVENT, event(A, "device", { project: B.project })),
      // With no intent, nothing but the capability binds the project (no foreign key on it).
      asOwner(DEVICE_EVENT, event(A, "device", { project: B.project, intent: null, assignment: null })),
      // ce_insert reads the intent under the owner's own RLS: B's is not there.
      asOwner(DEVICE_EVENT, event(A, "device", { intent: B.intent })),
      asOwner(DEVICE_EVENT, event(A, "device", { assignment: B.assignment })),
      asOwner(DEVICE_EVENT, event(A, "server")),
      asOwner(BACKDATED_EVENT, event(A, "device")),
      // ce_insert admits a device event with no intent; no writer makes one (owner, 2026-09-25).
      asOwner(DEVICE_EVENT, event(A, "device", { intent: null })),
      asOwner(DEVICE_EVENT, event(A, "device")),
    ])).toEqual([
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      byForeignKey("capture_events_assignment_fkey"),
      refusedByPolicy,
      refusedByPrivilege,
      inserted,
      inserted,
    ]);
  });

  it("capture_events (service): the service declaring A cannot record a server event in B or onto B's project, intent or assignment", async () => {
    expect(await outcomes("service", [
      asService(SERVER_EVENT, event(B, "server")),
      asService(SERVER_EVENT, event(A, "server"), ""),
      asService(SERVER_EVENT, event(A, "server"), WS_B),
      // app.upload_intent_scope_matches reads the intent as its owner, for the declared workspace.
      asService(SERVER_EVENT, event(A, "server", { project: B.project })),
      asService(SERVER_EVENT, event(A, "server", { intent: B.intent })),
      asService(SERVER_EVENT, event(A, "server", { project: B.project, intent: B.intent })),
      asService(SERVER_EVENT, event(A, "server", { assignment: B.assignment })),
      asService(SERVER_EVENT, event(A, "device")),
      asService(BACKDATED_EVENT, event(A, "server")),
      // The production shape keeps the actor (finalize-upload-intent.ts).
      asService(SERVER_EVENT, event(B, "server"), WS_A, USER_A),
      asService(DEVICE_EVENT, event(B, "device"), WS_A, USER_A),
      asService(SERVER_EVENT, event(A, "server"), WS_A, USER_A),
      asService(SERVER_EVENT, event(A, "server")),
    ])).toEqual([
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      byForeignKey("capture_events_assignment_fkey"),
      refusedByPolicy,
      refusedByPrivilege,
      refusedByPolicy,
      refusedByPolicy,
      inserted,
      inserted,
    ]);
    // The definer answers only for the workspace the service declares (a bounded
    // existence check, not an oracle for another), and only to the service.
    expect([
      await scopeAnswer("service", WS_A, A),
      await scopeAnswer("service", WS_A, B),
      await scopeAnswer("app", WS_A, A),
    ]).toEqual([true, false, "42501"]);
  });

  it("upload_intents: an owner of A cannot authorize an upload in B or onto B's project, assignment, member or occurrence, nor one born past the state machine", async () => {
    expect(await outcomes("app", [
      asOwner(INTENT, intent(B)),
      asOwner(INTENT, intent(A, { project: B.project, occurrence: null })),
      // The occurrence is left out so only the assignment's key breaks.
      asOwner(INTENT, intent(A, { assignment: B.assignment, occurrence: null })),
      asOwner(INTENT, intent(A, { creator: B.member })),
      asOwner(INTENT, intent(A, { occurrence: B.occurrence })),
      asOwner(INTENT_BORN_AVAILABLE, intent(A)),
      asOwner(INTENT, intent(A)),
    ])).toEqual([
      refusedByPolicy,
      refusedByPolicy,
      byForeignKey("upload_intents_workspace_id_project_id_work_assignment_id_fkey"),
      byForeignKey("upload_intents_workspace_id_created_by_member_id_fkey"),
      byForeignKey("upload_intents_occurrence_fkey"),
      refusedByPrivilege,
      inserted,
    ]);
  });
});
