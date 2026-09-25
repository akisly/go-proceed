import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, dropWorkspaces, superuserClient } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import { APPROVER_ROLE, insertDecision, recordDecision, seedClosureWorld } from "./m3-closure-fixture";

/**
 * THE CROSS-WORKSPACE WRITE MINIMUM, MODULE external_review, AND THE EXTERNAL
 * PLANE'S OTHER WRITES (DEV-085; BL-171, BL-182, two rows of BL-172).
 *
 * DEV-076 widened a `covered` row of technical/database/rls-coverage.csv: where
 * its principal can write, a test must show a principal of one workspace cannot
 * write into another. goproceed_app writes these tables on two planes:
 *
 *   - the member plane — an owner of A, actor set, declaring A: external access
 *     grants (issue, revoke-reissue), a session's revocation, and every
 *     member's audit and outbox rows;
 *   - the external plane — no actor, `app.external_session_id` set, as
 *     packages/database's withExternalTx does: the session's rotation, the
 *     decision batch, the decision and its head, and the external audit and
 *     outbox rows.
 *
 * Per privilege: INSERT carrying B's tenant key and parents refused by the
 * policy (42501) beside the same statement with A's ids succeeding; INSERT
 * keeping A's tenant key with one of B's parents refused by that parent's
 * composite foreign key (23503, named) or by the policy where it reads the
 * parent; UPDATE reading no column (no WHERE, a constant SET, no RETURNING)
 * changing exactly A's admitted rows, with B's read back unchanged; a move-out
 * refused by the policy, by a key, or — since 0109 narrowed the grant — by
 * privilege. A trigger's refusal does not count: the UPDATE guards are
 * disabled inside the rolled-back probe and asserted enabled afterwards.
 *
 * 0109 (owner, 2026-09-25) made the external plane's write policies read the
 * session's workspace (BL-182), and narrowed the grants and decision heads'
 * UPDATE and the three external tables' INSERT to the columns their writers
 * write. The requirement_evidence_decisions and _heads rows stay cited to
 * requirements-write-rls.test.ts (DEV-080, the member plane); their external
 * branches are asserted here.
 *
 * Every probe runs on the local superuser connection in one transaction that
 * is always rolled back, each statement in a savepoint under `SET LOCAL ROLE
 * goproceed_app` with its plane's GUCs. The fixture is this file's own (ids
 * `de085…`), dropped before and after. No resetDb.
 */
const WS_A = "de085a00-0000-4000-8000-000000000001";
const WS_B = "de085b00-0000-4000-8000-000000000001";
const USER_A = "de085a00-0000-4000-8000-0000000000a1";
const USER_B = "de085b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];
const HEX64 = "d".repeat(64);
const DECIDING = { "external.view_scope": true, "external.decide_evidence": true };
const OBSERVING = { "external.view_scope": true, "external.decide_evidence": false };

interface Side {
  ws: string; member: string; project: string; contract: string; contact: string;
  blockingA: string; blockingB: string; advisory: string; otherStage: string;
  /** Accepted decisions: DA1 on blockingA and DO1 on otherStage, each with a head; DB1 on blockingB, no head. */
  DA1: string; DB1: string;
  /** Deciding grants on blockingA and blockingB, an observer's on blockingA, a revoked one on blockingA. */
  gDec: string; gDec2: string; gObs: string; gRev: string;
  /** An active session under each live grant, and a revoked one under gRev. */
  sDec: string; sDec2: string; sObs: string; sOld: string;
  /** A decision batch of sDec. */
  batch: string;
}

interface Outcome {
  rowCount: number | null; code: string | null;
  reason: "policy" | "privilege" | "other" | null; constraint: string | null;
}

const refusedByPolicy: Outcome = { rowCount: null, code: "42501", reason: "policy", constraint: null };
const refusedByPrivilege: Outcome = { rowCount: null, code: "42501", reason: "privilege", constraint: null };
const inserted: Outcome = { rowCount: 1, code: null, reason: null, constraint: null };
const changed = (rowCount: number): Outcome => ({ rowCount, code: null, reason: null, constraint: null });
const byForeignKey = (constraint: string): Outcome => ({ rowCount: null, code: "23503", reason: "other", constraint });

/** A plane: the member plane (the owner of A) or the external plane (session `session`). */
interface Plane { actor: string; session: string }
const member: Plane = { actor: USER_A, session: "" };
const external = (session: string): Plane => ({ actor: "", session });

let admin: Client;
let A: Side;
let B: Side;

async function one<T extends Record<string, unknown>>(sql: string, params: unknown[]): Promise<T> {
  const r = await admin.query<T>(sql, params);
  if (!r.rows[0]) throw new Error(`fixture: no row from ${sql}`);
  return r.rows[0];
}

async function seedGrant(
  ws: string, project: string, contract: string, member: string, occurrence: string,
  o: { deciding: boolean; status?: string; revocation?: number },
): Promise<string> {
  return (await one<{ id: string }>(
    `insert into public.external_access_grants
       (workspace_id, project_id, contract_id, scope_kind, requirement_occurrence_id,
        token_hmac, hmac_key_id, recipient_email, recipient_role, permissions,
        expires_at, issued_by_member_id, decide_role, decides_evidence, status, revocation_version,
        exchange_consumed_at)
     values ($1, $2, $3, 'requirement_occurrence', $4, $5, 'dev085', 'prykladtechnahliad@example.test',
             $6, $7::jsonb, now() + interval '7 days', $8, $9, $10, $11, $12, now())
     returning id`,
    [ws, project, contract, occurrence, randomBytes(32), o.deciding ? APPROVER_ROLE : "sposterihach",
     JSON.stringify(o.deciding ? DECIDING : OBSERVING), member, o.deciding ? APPROVER_ROLE : null,
     o.deciding, o.status ?? "active", o.revocation ?? 0])).id;
}

async function seedSession(ws: string, grant: string, occurrence: string, status = "active"): Promise<string> {
  return (await one<{ id: string }>(
    `insert into public.external_sessions
       (workspace_id, external_access_grant_id, requirement_occurrence_id, session_verifier,
        csrf_verifier, verifier_key_id, idle_expires_at, absolute_expires_at,
        grant_revocation_version, status)
     values ($1, $2, $3, $4, $5, 'dev085', now() + interval '30 minutes', now() + interval '12 hours', 0, $6)
     returning id`,
    [ws, grant, occurrence, randomBytes(32), randomBytes(32), status])).id;
}

async function seedSide(ws: string, user: string, suffix: string): Promise<Side> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const w = await seedClosureWorld(admin, rules);
  await admin.query(
    `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
     values ($1, $2, $3, 'packages.submit', $4)`, [ws, rules.projectId, rules.memberId, user]);
  const party = (await one<{ id: string }>(
    "select customer_party_id as id from public.contracts where id = $1", [rules.contractId])).id;
  const contact = (await one<{ id: string }>(
    `insert into public.party_contacts (workspace_id, party_id, full_name, created_by)
     values ($1, $2, 'Приклад-Контакт', $3) returning id`, [ws, party, user])).id;
  const DA1 = await recordDecision(admin, w, { occurrenceId: w.blockingA, outcome: "accepted" });
  const DB1 = await insertDecision(admin, w, { occurrenceId: w.blockingB, outcome: "accepted" });
  await recordDecision(admin, w, { occurrenceId: w.otherStageOccurrence, outcome: "accepted" });
  const g = (occ: string, o: Parameters<typeof seedGrant>[5]) =>
    seedGrant(ws, rules.projectId, rules.contractId, rules.memberId, occ, o);
  const gDec = await g(w.blockingA, { deciding: true });
  const gDec2 = await g(w.blockingB, { deciding: true });
  const gObs = await g(w.blockingA, { deciding: false });
  const gRev = await g(w.blockingA, { deciding: true, status: "revoked", revocation: 1 });
  const sDec = await seedSession(ws, gDec, w.blockingA);
  const sDec2 = await seedSession(ws, gDec2, w.blockingB);
  const sObs = await seedSession(ws, gObs, w.blockingA);
  const sOld = await seedSession(ws, gRev, w.blockingA, "revoked");
  const batch = (await one<{ id: string }>(
    `insert into public.external_decision_batches
       (workspace_id, project_id, requirement_occurrence_id, external_access_grant_id,
        external_session_id, confirmation_text_version, server_received_at,
        idempotency_key, request_hash, receipt_hash)
     values ($1, $2, $3, $4, $5, 'external-occurrence-decision/1+dev085', now(), $6, '${HEX64}', $7)
     returning id`,
    [ws, rules.projectId, w.blockingA, gDec, sDec, `dev085-${randomUUID()}`, randomBytes(32)])).id;
  return {
    ws, member: rules.memberId, project: rules.projectId, contract: rules.contractId, contact,
    blockingA: w.blockingA, blockingB: w.blockingB, advisory: w.advisoryOccurrence, otherStage: w.otherStageOccurrence,
    DA1, DB1, gDec, gDec2, gObs, gRev, sDec, sDec2, sObs, sOld, batch,
  };
}

/** One probe: a transaction on the superuser connection, always rolled back. */
interface Probe {
  /** A statement under goproceed_app on `plane`, declaring A; its row count, or its refusal. */
  as(plane: Plane, sql: string, params?: unknown[]): Promise<Outcome>;
  /** A statement as the superuser, in the same transaction. */
  admin<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

async function probe(body: (p: Probe) => Promise<void>, disableTriggersOn: string[] = []): Promise<void> {
  const c = superuserClient();
  await c.connect();
  try {
    await c.query("begin");
    for (const table of disableTriggersOn) await c.query(`alter table public.${table} disable trigger user`);
    const p: Probe = {
      async as(plane, sql, params = []) {
        await c.query("savepoint probe");
        await c.query("set local role goproceed_app");
        await c.query(
          `select set_config('app.actor_user_id', $1, true), set_config('app.organization_id', $2, true),
                  set_config('app.external_session_id', $3, true)`, [plane.actor, WS_A, plane.session]);
        try {
          const r = await c.query(sql, params);
          await c.query("release savepoint probe");
          await c.query("reset role");
          return { rowCount: r.rowCount, code: null, reason: null, constraint: null };
        } catch (e) {
          await c.query("rollback to savepoint probe");
          await c.query("reset role");
          const { code, message, constraint } = e as { code?: string; message?: string; constraint?: string };
          // Only a new row's WITH CHECK refusal counts as `policy`, and only
          // «permission denied for table» as `privilege` (DEV-081 S2).
          const reason = /^new row violates row-level security policy for table "[^"]+"$/.test(message ?? "") ? "policy"
            : /^permission denied for table /.test(message ?? "") ? "privilege" : "other";
          return { rowCount: null, code: code ?? "unknown", reason, constraint: constraint ?? null };
        }
      },
      async admin(sql, params = []) {
        return (await c.query(sql, params)).rows;
      },
    };
    await body(p);
  } finally {
    await c.query("rollback").catch(() => undefined);
    await c.end().catch(() => undefined);
  }
}

/** Every row of `table` in workspace `ws` (its tenant column `col`) as JSON text, sorted. */
async function snapshot(p: Probe, table: string, ws: string, col = "workspace_id"): Promise<string[]> {
  const rows = await p.admin<{ j: string }>(
    `select to_jsonb(t)::text as j from public.${table} t where t.${col} = $1 order by 1`, [ws]);
  return rows.map((r) => r.j);
}

/** INSERT statements, each on its own plane, in one rolled-back transaction. */
async function outcomes(statements: [Plane, string, unknown[]][], disable: string[] = []): Promise<Outcome[]> {
  const out: Outcome[] = [];
  await probe(async (p) => {
    for (const [plane, sql, params] of statements) out.push(await p.as(plane, sql, params));
  }, disable);
  return out;
}

/**
 * A statement reading no column, on `plane`: its outcome, the `key` of A's rows
 * it changed, and whether B's rows read back unchanged.
 */
async function confined(plane: Plane, table: string, sql: string, disable: string[], key = "id"):
Promise<{ outcome: Outcome; aChanged: string[]; bUnchanged: boolean }> {
  let result = { outcome: changed(-1), aChanged: [] as string[], bUnchanged: false };
  await probe(async (p) => {
    const beforeA = await snapshot(p, table, WS_A);
    const beforeB = await snapshot(p, table, WS_B);
    const outcome = await p.as(plane, sql);
    const afterA = await snapshot(p, table, WS_A);
    const aChanged = beforeA.filter((row) => !afterA.includes(row))
      .map((row) => (JSON.parse(row) as Record<string, string>)[key]!).sort();
    result = {
      outcome, aChanged,
      bUnchanged: JSON.stringify(await snapshot(p, table, WS_B)) === JSON.stringify(beforeB),
    };
  }, disable);
  return result;
}

async function triggersEnabled(table: string): Promise<string[]> {
  const r = await admin.query<{ s: string }>(
    `select tgenabled::text as s from pg_trigger where tgrelid = ('public.' || $1)::regclass and not tgisinternal`, [table]);
  return r.rows.map((row) => row.s);
}

// ── the statements, each the shape its writer writes, none with RETURNING ─────

/** occurrences/[occurrenceId]/grants and revoke-reissue's successor. */
const GRANT = `insert into public.external_access_grants
    (id, workspace_id, project_id, contract_id, scope_kind, requirement_occurrence_id,
     token_hmac, hmac_key_id, recipient_email, recipient_contact_id, recipient_role, permissions,
     expires_at, issued_by_member_id, replaced_grant_id, decide_role, decides_evidence)
  values ($1, $2, $3, $4, 'requirement_occurrence', $5, $6, 'dev085', 'prykladnovyi@example.test', $7,
          '${APPROVER_ROLE}', '${JSON.stringify(DECIDING)}'::jsonb, now() + interval '7 days', $8, $9,
          '${APPROVER_ROLE}', true)`;
/** A column 0109 withdrew: a grant born revoked. */
const GRANT_BORN_REVOKED = `insert into public.external_access_grants
    (id, workspace_id, project_id, contract_id, scope_kind, requirement_occurrence_id,
     token_hmac, hmac_key_id, recipient_email, recipient_contact_id, recipient_role, permissions,
     expires_at, issued_by_member_id, replaced_grant_id, decide_role, decides_evidence, status)
  values ($1, $2, $3, $4, 'requirement_occurrence', $5, $6, 'dev085', 'prykladnovyi@example.test', $7,
          '${APPROVER_ROLE}', '${JSON.stringify(DECIDING)}'::jsonb, now() + interval '7 days', $8, $9,
          '${APPROVER_ROLE}', true, 'revoked')`;
type GrantOverride = Partial<Record<"ws" | "project" | "contract" | "occurrence" | "contact" | "member" | "replaced", string | null>>;
function grantRow(s: Side, o: GrantOverride = {}): unknown[] {
  return [randomUUID(), o.ws ?? s.ws, o.project ?? s.project, o.contract ?? s.contract,
    o.occurrence ?? s.advisory, randomBytes(32), o.contact === undefined ? s.contact : o.contact,
    o.member ?? s.member, o.replaced ?? null];
}

/** The rotation's successor (external-session.ts). */
const SESSION = `insert into public.external_sessions
    (workspace_id, external_access_grant_id, requirement_occurrence_id, session_verifier,
     csrf_verifier, verifier_key_id, idle_expires_at, absolute_expires_at,
     rotated_from_session_id, grant_revocation_version)
  values ($1, $2, $3, $4, $5, 'dev085', now() + interval '30 minutes', now() + interval '12 hours', $6, 0)`;
/** A column 0109 withdrew: a session born revoked. */
const SESSION_BORN_REVOKED = `insert into public.external_sessions
    (workspace_id, external_access_grant_id, requirement_occurrence_id, session_verifier,
     csrf_verifier, verifier_key_id, idle_expires_at, absolute_expires_at,
     rotated_from_session_id, grant_revocation_version, status)
  values ($1, $2, $3, $4, $5, 'dev085', now() + interval '30 minutes', now() + interval '12 hours', $6, 0, 'revoked')`;
type SessionOverride = Partial<Record<"ws" | "grant" | "occurrence" | "from", string>>;
function sessionRow(s: Side, o: SessionOverride = {}): unknown[] {
  return [o.ws ?? s.ws, o.grant ?? s.gDec, o.occurrence ?? s.blockingA, randomBytes(32), randomBytes(32), o.from ?? s.sDec];
}

/** The external decision route's receipt. */
const BATCH = `insert into public.external_decision_batches
    (id, workspace_id, project_id, requirement_occurrence_id, external_access_grant_id,
     external_session_id, reviewer_claims, confirmation_text_version, submitted_at,
     server_received_at, idempotency_key, request_hash, receipt_id, receipt_hash)
  values ($1, $2, $3, $4, $5, $6, '{}'::jsonb, 'external-occurrence-decision/1+dev085', now(), now(),
          $7, '${HEX64}', $8, $9)`;
/** A column 0109 withdrew: the receipt's assurance label. */
const BATCH_LABELLED = `insert into public.external_decision_batches
    (id, workspace_id, project_id, requirement_occurrence_id, external_access_grant_id,
     external_session_id, reviewer_claims, confirmation_text_version, submitted_at,
     server_received_at, idempotency_key, request_hash, receipt_id, receipt_hash, assurance_label)
  values ($1, $2, $3, $4, $5, $6, '{}'::jsonb, 'external-occurrence-decision/1+dev085', now(), now(),
          $7, '${HEX64}', $8, $9, 'LINK_CONFIRMATION')`;
type BatchOverride = Partial<Record<"ws" | "project" | "occurrence" | "grant" | "session", string>>;
function batchRow(s: Side, o: BatchOverride = {}): unknown[] {
  return [randomUUID(), o.ws ?? s.ws, o.project ?? s.project, o.occurrence ?? s.blockingA,
    o.grant ?? s.gDec, o.session ?? s.sDec, `dev085-${randomUUID()}`, randomUUID(), randomBytes(32)];
}

/** The external decision route's fact: decision 2, superseding DA1. */
const DECISION = `insert into public.requirement_evidence_decisions
    (id, workspace_id, project_id, requirement_occurrence_id, approver_role, outcome, decision_no,
     superseded_decision_id, superseded_decision_no, decided_by_member_id, external_session_id,
     external_access_grant_id, decision_batch_id, assurance_label, reason, issues,
     idempotency_key, request_hash)
  values ($1, $2, $3, $4, '${APPROVER_ROLE}', 'accepted', 2, $5, 1, $6, $7, $8, $9, 'LINK_CONFIRMATION',
          null, '[]'::jsonb, $10, '${HEX64}')`;
type DecisionOverride = Partial<Record<"ws" | "project" | "occurrence" | "superseded" | "member" | "session" | "grant" | "batch", string | null>>;
function decisionRow(s: Side, o: DecisionOverride = {}): unknown[] {
  return [randomUUID(), o.ws ?? s.ws, o.project ?? s.project, o.occurrence ?? s.blockingA,
    o.superseded ?? s.DA1, o.member ?? null, o.session ?? s.sDec, o.grant ?? s.gDec,
    o.batch ?? s.batch, `dev085-${randomUUID()}`];
}

/** The external decision route's first head. */
const HEAD = `insert into public.requirement_evidence_decision_heads
    (workspace_id, project_id, requirement_occurrence_id, approver_role, current_decision_id, current_outcome)
  values ($1, $2, $3, '${APPROVER_ROLE}', $4, $5)`;

/** packages/database's recordAudit, with the project the member routes may name. */
const AUDIT = `insert into public.audit_events
    (organization_id, project_id, actor_user_id, actor_type, action, object_type, object_id,
     request_id, details, object_version, reason_code)
  values ($1, $2, $3, $4, 'dev085.probe', 'probe', 'dev085', 'dev085', '{}'::jsonb, null, null)`;

/** packages/database's enqueueOutbox, on a topic outside the partial unique index. */
const OUTBOX = `insert into public.transaction_outbox
    (organization_id, topic, aggregate_type, aggregate_id, payload_version, payload)
  values ($1, 'dev085.probe', 'probe', 'dev085', 1, '{}'::jsonb)`;

beforeAll(async () => {
  // Every probed statement reads no column back: a RETURNING would apply the
  // SELECT policy to the new row and mask the INSERT policy (DEV-083).
  for (const sql of [GRANT, GRANT_BORN_REVOKED, SESSION, SESSION_BORN_REVOKED, BATCH, BATCH_LABELLED,
    DECISION, HEAD, AUDIT, OUTBOX]) {
    expect(sql).not.toMatch(/returning/i);
  }
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  A = await seedSide(WS_A, USER_A, "DEV085-A");
  B = await seedSide(WS_B, USER_B, "DEV085-B");
  // Premise: no INSERT trigger could answer before a policy on these tables.
  const triggers = await admin.query<{ t: string }>(
    `select tgrelid::regclass::text || ':' || tgname as t from pg_trigger
      where tgrelid = any(array['public.external_access_grants', 'public.external_sessions',
                                'public.external_decision_batches', 'public.requirement_evidence_decisions',
                                'public.requirement_evidence_decision_heads', 'public.audit_events',
                                'public.transaction_outbox']::regclass[])
        and not tgisinternal and (tgtype & 4) <> 0`);
  expect(triggers.rows.map((r) => r.t)).toEqual([]);
  // Premise: each of A's sessions resolves as seeded, and the revoked one does not.
  const scope: [string, string | null, boolean | null][] = [];
  await probe(async (p) => {
    for (const s of [A.sDec, A.sDec2, A.sObs, A.sOld]) {
      await p.admin("select set_config('app.actor_user_id', '', true), set_config('app.external_session_id', $1, true)", [s]);
      const r = await p.admin<{ o: string | null; d: boolean | null }>(
        "select app.external_session_occurrence() as o, app.external_session_may_decide() as d");
      scope.push([s, r[0]!.o, r[0]!.d]);
    }
  });
  expect(scope).toEqual([
    [A.sDec, A.blockingA, true], [A.sDec2, A.blockingB, true], [A.sObs, A.blockingA, false], [A.sOld, null, false],
  ]);
}, 240_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("external_review cross-workspace write denial", () => {
  it("external_access_grants: an owner of A cannot issue a link into B or onto B's parents, nor change or move one of B's", async () => {
    expect(await outcomes([
      [member, GRANT, grantRow(B)],
      [member, GRANT, grantRow(A, { project: B.project })],
      [member, GRANT, grantRow(A, { contract: B.contract })],
      [member, GRANT, grantRow(A, { occurrence: B.advisory })],
      [member, GRANT, grantRow(A, { contact: B.contact })],
      [member, GRANT, grantRow(A, { replaced: B.gDec })],
      [member, GRANT, grantRow(A, { member: B.member })],
      [member, GRANT_BORN_REVOKED, grantRow(A)],
      [member, GRANT, grantRow(A)],
    ])).toEqual([
      refusedByPolicy,
      refusedByPolicy,
      byForeignKey("external_access_grants_occurrence_fkey"),
      byForeignKey("external_access_grants_occurrence_fkey"),
      byForeignKey("external_access_grants_contact_fkey"),
      byForeignKey("external_access_grants_replaced_fkey"),
      byForeignKey("external_access_grants_member_fkey"),
      refusedByPrivilege,
      inserted,
    ]);
    // eag_update admits an active grant only: A's three live grants, not the
    // revoked one. The guard (a +1 version step) is off.
    expect(await confined(member, "external_access_grants",
      "update public.external_access_grants set version = 424242", ["external_access_grants"]))
      .toEqual({ outcome: changed(3), aChanged: [A.gDec, A.gDec2, A.gObs].sort(), bUnchanged: true });
    // 0109 narrowed UPDATE to the three columns revoke-reissue sets.
    expect(await outcomes([
      [member, "update public.external_access_grants set workspace_id = $1", [WS_B]],
      [member, "update public.external_access_grants set project_id = $1", [B.project]],
    ])).toEqual([refusedByPrivilege, refusedByPrivilege]);
    expect(await triggersEnabled("external_access_grants")).toEqual(["O"]);
  });

  it("external_sessions: neither an external session nor an owner of A can open, revoke or move a session of B", async () => {
    expect(await outcomes([
      [external(A.sDec), SESSION, sessionRow(B, { from: B.sDec })],
      [external(A.sDec), SESSION, sessionRow(A, { grant: B.gDec })],
      [external(A.sDec), SESSION, sessionRow(A, { occurrence: B.blockingA })],
      [external(A.sDec), SESSION, sessionRow(A, { from: B.sDec })],
      // B's tenant key on the session's own grant, occurrence and predecessor: 0109's workspace term.
      [external(A.sDec), SESSION, sessionRow(A, { ws: WS_B })],
      [external(A.sDec), SESSION_BORN_REVOKED, sessionRow(A)],
      // The member plane has no INSERT policy on sessions.
      [member, SESSION, sessionRow(A)],
      [external(A.sDec), SESSION, sessionRow(A)],
    ])).toEqual([
      refusedByPolicy,
      byForeignKey("external_sessions_grant_fkey"),
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      refusedByPrivilege,
      refusedByPolicy,
      inserted,
    ]);
    // es_member_revoke admits A's active sessions; the revoked one stays out.
    expect(await confined(member, "external_sessions",
      "update public.external_sessions set status = 'revoked'", []))
      .toEqual({ outcome: changed(3), aChanged: [A.sDec, A.sDec2, A.sObs].sort(), bUnchanged: true });
    // es_external_rotate_update admits the session's own active row only.
    expect(await confined(external(A.sDec), "external_sessions",
      "update public.external_sessions set status = 'revoked'", []))
      .toEqual({ outcome: changed(1), aChanged: [A.sDec], bUnchanged: true });
    expect(await outcomes([
      // es_member_revoke's WITH CHECK admits only a revocation.
      [member, "update public.external_sessions set status = 'expired'", []],
      [external(A.sOld), "update public.external_sessions set status = 'revoked'", []],
      // 0109 narrowed UPDATE to status: a session cannot be moved on either plane.
      [member, "update public.external_sessions set workspace_id = $1", [WS_B]],
      [external(A.sDec), "update public.external_sessions set workspace_id = $1", [WS_B]],
    ])).toEqual([refusedByPolicy, changed(0), refusedByPrivilege, refusedByPrivilege]);
  });

  it("external_decision_batches: an external session of A cannot write a receipt into B or onto B's session, grant or occurrence", async () => {
    expect(await outcomes([
      [external(A.sDec), BATCH, batchRow(B)],
      [external(A.sDec), BATCH, batchRow(A, { project: B.project })],
      [external(A.sDec), BATCH, batchRow(A, { occurrence: B.blockingA })],
      [external(A.sDec), BATCH, batchRow(A, { grant: B.gDec })],
      [external(A.sDec), BATCH, batchRow(A, { session: B.sDec })],
      [external(A.sDec), BATCH, batchRow(A, { ws: WS_B })],
      // An observer's session may not decide (INV-031).
      [external(A.sObs), BATCH, batchRow(A, { grant: A.gObs, session: A.sObs })],
      [external(A.sDec), BATCH_LABELLED, batchRow(A)],
      [external(A.sDec), BATCH, batchRow(A)],
    ])).toEqual([
      refusedByPolicy,
      byForeignKey("external_decision_batches_occurrence_fkey"),
      refusedByPolicy,
      byForeignKey("external_decision_batches_grant_fkey"),
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      refusedByPrivilege,
      inserted,
    ]);
  });

  it("requirement_evidence_decisions (external): an external session of A cannot record a decision in B or onto B's occurrence, lineage, session, grant or batch", async () => {
    expect(await outcomes([
      [external(A.sDec), DECISION, decisionRow(B, { session: B.sDec })],
      [external(A.sDec), DECISION, decisionRow(A, { project: B.project })],
      [external(A.sDec), DECISION, decisionRow(A, { occurrence: B.blockingA })],
      [external(A.sDec), DECISION, decisionRow(A, { session: B.sDec })],
      [external(A.sDec), DECISION, decisionRow(A, { grant: B.gDec })],
      [external(A.sDec), DECISION, decisionRow(A, { batch: B.batch })],
      [external(A.sDec), DECISION, decisionRow(A, { superseded: B.DA1 })],
      [external(A.sDec), DECISION, decisionRow(A, { ws: WS_B })],
      [external(A.sDec), DECISION, decisionRow(A, { member: A.member })],
      [external(A.sObs), DECISION, decisionRow(A, { session: A.sObs, grant: A.gObs })],
      [external(A.sDec), DECISION, decisionRow(A)],
    ])).toEqual([
      refusedByPolicy,
      byForeignKey("requirement_evidence_decisions_occurrence_fkey"),
      refusedByPolicy,
      refusedByPolicy,
      byForeignKey("requirement_evidence_decisions_grant_fkey"),
      byForeignKey("requirement_evidence_decisions_batch_fkey"),
      byForeignKey("requirement_evidence_decisions_chain_fkey"),
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      inserted,
    ]);
  });

  it("requirement_evidence_decision_heads (external): an external session of A cannot open or advance a head of B, or of another occurrence of A", async () => {
    expect(await outcomes([
      [external(A.sDec2), HEAD, [WS_B, B.project, B.blockingB, B.DB1, "accepted"]],
      [external(A.sDec2), HEAD, [WS_A, B.project, A.blockingB, A.DB1, "accepted"]],
      [external(A.sDec2), HEAD, [WS_A, A.project, B.blockingB, null, null]],
      // Only the policy refuses a null-pointer head on another occurrence of A (BL-182 S3).
      [external(A.sDec2), HEAD, [WS_A, A.project, A.advisory, null, null]],
      [external(A.sDec2), HEAD, [WS_A, A.project, A.blockingB, B.DB1, "accepted"]],
      [external(A.sDec2), HEAD, [WS_B, A.project, A.blockingB, null, null]],
      [external(A.sObs), HEAD, [WS_A, A.project, A.blockingA, null, null]],
      [external(A.sDec2), HEAD, [WS_A, A.project, A.blockingB, A.DB1, "accepted"]],
    ])).toEqual([
      refusedByPolicy,
      byForeignKey("requirement_evidence_decision_heads_occurrence_fkey"),
      refusedByPolicy,
      refusedByPolicy,
      byForeignKey("requirement_evidence_decision_heads_outcome_fkey"),
      refusedByPolicy,
      refusedByPolicy,
      inserted,
    ]);
    // redh_external_update admits the session's own occurrence only: A's head on
    // blockingA, not the one on otherStage. The guard (a +1 step) is off.
    expect(await confined(external(A.sDec), "requirement_evidence_decision_heads",
      "update public.requirement_evidence_decision_heads set version = 424242",
      ["requirement_evidence_decision_heads"], "requirement_occurrence_id"))
      .toEqual({ outcome: changed(1), aChanged: [A.blockingA], bUnchanged: true });
    expect(await outcomes([
      [external(A.sObs), "update public.requirement_evidence_decision_heads set version = 424242", []],
      [external(A.sDec), "update public.requirement_evidence_decision_heads set current_decision_id = $1", [B.DA1]],
      // 0109 narrowed UPDATE to the four columns the routes set.
      [external(A.sDec), "update public.requirement_evidence_decision_heads set workspace_id = $1", [WS_B]],
    ], ["requirement_evidence_decision_heads"]))
      .toEqual([changed(0), byForeignKey("requirement_evidence_decision_heads_outcome_fkey"), refusedByPrivilege]);
    expect(await triggersEnabled("requirement_evidence_decision_heads")).toEqual(["O"]);
  });

  it("audit_events: neither an owner of A nor an external session of A can audit into B or onto B's project", async () => {
    expect(await outcomes([
      [member, AUDIT, [WS_B, null, USER_A, "user"]],
      [member, AUDIT, [WS_A, B.project, USER_A, "user"]],
      [member, AUDIT, [WS_A, A.project, USER_A, "user"]],
      [external(A.sDec), AUDIT, [WS_B, null, null, "external"]],
      [external(A.sDec), AUDIT, [WS_A, B.project, null, "external"]],
      [external(A.sDec), AUDIT, [WS_A, null, null, "user"]],
      [external(A.sDec), AUDIT, [WS_A, null, USER_A, "external"]],
      [external(A.sDec), AUDIT, [WS_A, null, null, "external"]],
    ])).toEqual([
      refusedByPolicy,
      byForeignKey("audit_project_tenant_fk"),
      inserted,
      refusedByPolicy,
      byForeignKey("audit_project_tenant_fk"),
      refusedByPolicy,
      refusedByPolicy,
      inserted,
    ]);
  });

  it("transaction_outbox: neither an owner of A nor an external session of A can enqueue into B", async () => {
    // No column names a parent: aggregate_id is text and payload is jsonb, so a
    // consumer must take its tenant from organization_id.
    expect(await outcomes([
      [member, OUTBOX, [WS_B]],
      [member, OUTBOX, [null]],
      [member, OUTBOX, [WS_A]],
      [external(A.sDec), OUTBOX, [WS_B]],
      [external(A.sDec), OUTBOX, [null]],
      [external(A.sDec), OUTBOX, [WS_A]],
    ])).toEqual([refusedByPolicy, refusedByPolicy, inserted, refusedByPolicy, refusedByPolicy, inserted]);
  });
});
