import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, asService, dropWorkspaces } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import { seedAssignment } from "./m2-occurrences-fixture";

/**
 * THE SERVER'S CAPTURE EVENT AND THE WORKSPACE IT DECLARES (DEV-017, BL-102).
 *
 * 0035 wrote `ce_insert_server` as `event_source = 'server' and exists (select 1
 * from public.upload_intents u where …)`, with no `app.service_workspace()`
 * term. The EXISTS runs under row level security on `upload_intents`, whose
 * policies are actor- and session-bound, and `goproceed_service` inherits them.
 * So at 0086 an EMPTY-actor service transaction was refused whatever it
 * declared, and a transaction carrying an actor entitled to A was admitted
 * whatever it declared — including while declaring B. 0087 adds the workspace
 * term and answers the binding question through
 * `app.upload_intent_scope_matches`, a SECURITY DEFINER function only the
 * service role may execute, so the server's own fact no longer depends on the
 * member's live read capability.
 *
 * The service plane has no SELECT of its own on `capture_events` (`ce_select`
 * is actor-bound), so a read denial would prove nothing here: this row's
 * evidence is the INSERT, in the shape DEV-016 used for `audit_events`.
 *
 * Every write runs in a transaction that is always rolled back, so the fixture
 * is the same before and after 0087, and `m5-external-rls.test.ts` (which
 * expects no `capture_events` row at all, across every workspace) is unaffected.
 * No resetDb; the workspaces are dropped before and after.
 */
const WS_A = "de170a00-0000-4000-8000-000000000001";
const WS_B = "de170b00-0000-4000-8000-000000000001";
const USER_A = "de170a00-0000-4000-8000-0000000000a1";
const USER_B = "de170b00-0000-4000-8000-0000000000b1";

const SERVER_EVENT = `insert into public.capture_events
    (workspace_id, project_id, work_assignment_id, upload_intent_id,
     device_capture_id, client_state, event_source, failure_code)
  values ($1, $2, $3, $4, $5, 'failed', 'server', 'integrity_size_mismatch')`;

let admin: Client;
/** Workspace A's own intent, with everything the policy compares it against. */
let intentA: { workspaceId: string; projectId: string; assignmentId: string; intentId: string };
/** Workspace B's, for the project a row may name but its intent does not belong to. */
let intentB: { workspaceId: string; projectId: string; assignmentId: string; intentId: string };

const ROLL_BACK = new Error("evidence-service-rls: roll back");

async function seedSide(ws: string, user: string, suffix: string): Promise<typeof intentA> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const assignmentId = await seedAssignment(admin, rules, rules.publishedVersionId, rules.publishedWorkItemId);
  const intent = await admin.query<{ id: string }>(
    `insert into public.upload_intents
       (workspace_id, project_id, work_assignment_id, created_by_member_id, origin_method,
        idempotency_key, request_hash, expected_byte_size, expected_content_hash,
        allowed_content_family, claimed_media_type, status, staging_bucket, staging_storage_key, expires_at)
     values ($1, $2, $3, $4, 'native_camera', $5, repeat('a',64), 11, $6, 'image', 'image/jpeg',
             'staged', 'evidence', $7, now() + interval '1 day')
     returning id`,
    [ws, rules.projectId, assignmentId, rules.memberId, `dev017-${randomUUID()}`,
      createHash("sha256").update(`dev017:${ws}`).digest("hex"), `${randomUUID()}/dev017`]);
  return { workspaceId: ws, projectId: rules.projectId, assignmentId, intentId: intent.rows[0]!.id };
}

/**
 * Inserts the server capture event of workspace A as a service transaction that
 * carries `actor` and declares `declared`, and ALWAYS rolls back. Reports the
 * row count, or the SQLSTATE that stopped it.
 *
 * No RETURNING: on INSERT it would pull the SELECT policies in and make a
 * refusal ambiguous.
 */
async function serverEvent(
  actor: string, declared: string | null, projectId = intentA.projectId,
): Promise<number | string> {
  let outcome: number | string = "not attempted";
  try {
    await asService(actor, declared, async (c) => {
      try {
        outcome = (await c.query(SERVER_EVENT, [
          intentA.workspaceId, projectId, intentA.assignmentId, intentA.intentId, randomUUID(),
        ])).rowCount ?? 0;
      } catch (e) {
        outcome = (e as { code?: string }).code ?? "unknown";
      }
      throw ROLL_BACK;
    });
  } catch (e) {
    if (e !== ROLL_BACK) throw e;
  }
  return outcome;
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, [WS_A, WS_B]);
  intentA = await seedSide(WS_A, USER_A, "DEV017-A");
  intentB = await seedSide(WS_B, USER_B, "DEV017-B");
}, 180_000);

afterAll(async () => {
  await dropWorkspaces(admin, [WS_A, WS_B]);
  await admin.end();
});

describe("evidence service plane — a service transaction declaring A may write a server capture event of A and one declaring B or nothing may not", () => {
  it("capture_events: declaring A the service writes the server event of A and declaring B or nothing it is refused", async () => {
    // The positive: no actor at all, which is the service contract, and the
    // reason the binding check may not depend on a member's read capability.
    expect(await serverEvent("", WS_A)).toBe(1);
    expect(await serverEvent("", WS_B)).toBe("42501");
    expect(await serverEvent("", null)).toBe("42501");
    // The binding half, which the composite foreign key does not cover: the
    // intent must belong to the project the event names (0035 has no foreign
    // key on capture_events.project_id).
    expect(await serverEvent("", WS_A, intentB.projectId)).toBe("42501");
  });

  it("capture_events: an actor entitled to A does not let a service transaction declaring B write the event of A", async () => {
    // BL-102's own defect: before 0087 the policy asked only whether the actor
    // could see the intent, so this insert was admitted while declaring B.
    expect(await serverEvent(USER_A, WS_B)).toBe("42501");
    expect(await serverEvent(USER_A, null)).toBe("42501");
    // The control, so the refusals above are not a broken fixture.
    expect(await serverEvent(USER_A, WS_A)).toBe(1);
  });
});
