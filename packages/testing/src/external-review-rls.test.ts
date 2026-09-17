import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, asActor, dropWorkspaces } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import { APPROVER_ROLE, seedClosureWorld } from "./m3-closure-fixture";

/**
 * READINESS GATE 11, MODULE external_review, member plane (DEV-016, BL-094).
 *
 * The DEV-014 shape: the owner of A reads A's rows; the owner of B, with the
 * same grants on its own project and declaring workspace A, reads only B's.
 * Each workspace gets, from the admin client, one external access grant on a
 * blocking occurrence, one session on it and one decision batch (the shapes
 * m5-external-rls.test.ts seeds). The token, session and receipt bytes are
 * random: the verifier columns are unique across every workspace.
 *
 * The external-session policies on the same tables are the m5 suites' subject;
 * asActor sets an actor and no session, so they admit nothing here. No resetDb.
 */
const WS_A = "de164a00-0000-4000-8000-000000000001";
const WS_B = "de164b00-0000-4000-8000-000000000001";
const USER_A = "de164a00-0000-4000-8000-0000000000a1";
const USER_B = "de164b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];
const DECIDING = { "external.view_scope": true, "external.decide_evidence": true };

let admin: Client;

async function seedSide(ws: string, user: string, suffix: string): Promise<void> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const world = await seedClosureWorld(admin, rules);
  const grant = await admin.query<{ id: string }>(
    `insert into public.external_access_grants
       (workspace_id, project_id, contract_id, scope_kind, requirement_occurrence_id,
        token_hmac, hmac_key_id, recipient_email, recipient_role, permissions,
        expires_at, issued_by_member_id, decide_role, decides_evidence, status)
     values ($1, $2, $3, 'requirement_occurrence', $4, $5, 'dev016', 'prykladtechnahliad@example.test',
             $6, $7::jsonb, now() + interval '7 days', $8, $6, true, 'active')
     returning id`,
    [ws, rules.projectId, rules.contractId, world.blockingA, randomBytes(32), APPROVER_ROLE,
     JSON.stringify(DECIDING), rules.memberId]);
  const grantId = grant.rows[0]!.id;
  const session = await admin.query<{ id: string }>(
    `insert into public.external_sessions
       (workspace_id, external_access_grant_id, requirement_occurrence_id, session_verifier,
        csrf_verifier, verifier_key_id, idle_expires_at, absolute_expires_at,
        grant_revocation_version, status)
     values ($1, $2, $3, $4, $5, 'dev016', now() + interval '30 minutes', now() + interval '12 hours', 0, 'active')
     returning id`,
    [ws, grantId, world.blockingA, randomBytes(32), randomBytes(32)]);
  await admin.query(
    `insert into public.external_decision_batches
       (workspace_id, project_id, requirement_occurrence_id, external_access_grant_id,
        external_session_id, confirmation_text_version, server_received_at,
        idempotency_key, request_hash, receipt_hash, grant_decides_evidence)
     values ($1, $2, $3, $4, $5, 'external-occurrence-decision/1+dev016', now(), $6, repeat('a',64), $7, true)`,
    [ws, rules.projectId, world.blockingA, grantId, session.rows[0]!.id, `dev016-${randomUUID()}`, randomBytes(32)]);
}

/** The distinct workspaces of the rows `actor` can read, declaring workspace A. */
async function seen(actor: string, sql: string): Promise<string[]> {
  const r = await asActor<{ ws: string }>(actor, WS_A, (c) => c.query(sql, [BOTH]));
  return r.rows.map((row) => row.ws).sort();
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  await seedSide(WS_A, USER_A, "DEV016-XR-A");
  await seedSide(WS_B, USER_B, "DEV016-XR-B");
}, 180_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("external_review isolation — the owner of A reaches rows of A and the owner of B declaring A reaches only rows of B", () => {
  it("external_access_grants: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.external_access_grants where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("external_sessions: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    // es_select finds the project through the session's grant.
    const sql = "select distinct workspace_id as ws from public.external_sessions where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("external_decision_batches: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.external_decision_batches where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });
});
