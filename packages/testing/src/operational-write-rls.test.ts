import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, dropWorkspaces, superuserClient } from "./pg";

/**
 * THE CROSS-WORKSPACE WRITE MINIMUM, MODULE operational: idempotency_records
 * (DEV-086; BL-172's last row).
 *
 * DEV-076 widened a `covered` row of technical/database/rls-coverage.csv: where
 * its principal can write, a test must show a principal of one workspace cannot
 * write into another. goproceed_app holds INSERT here (SELECT is the read row's,
 * operational-rls.test.ts) and no UPDATE or DELETE; goproceed_service inherits
 * both (0034, 0087). idem_insert (0006, 0089) admits a record whose
 * actor_scope is the actor's own and whose workspace, if it names one, the
 * actor is an active member of. Its only reference is organization_id, a
 * single-column key to organizations; actor_scope is text. There is no parent
 * to mix.
 *
 * Per privilege: an active owner of B — also holding a suspended membership of
 * A, so `m.status = 'active'` is what refuses it — cannot insert a record into
 * A, nor under A's owner in any workspace or none, beside its own records of B
 * and of no workspace succeeding; the writer's ON CONFLICT on A's own key is
 * refused by the policy, not silently skipped; a workspace that does not exist
 * is refused by the policy before its key. UPDATE and DELETE are refused by
 * privilege, and since 0110 so is an INSERT naming `id` or `created_at`.
 *
 * On the service plane the declared workspace plays no part: a service
 * transaction carrying an actor writes wherever that actor is active (BL-101),
 * and one carrying none writes nothing. Both are asserted as the policy's.
 *
 * Every probe runs on the local superuser connection in one transaction that
 * is always rolled back, each statement in a savepoint under `SET LOCAL ROLE`
 * with the plane's GUCs; idem_insert reads app.current_actor() alone, a GUC.
 * The fixture is this file's own (ids `de086a…`, `de086b…`), dropped before
 * and after. No resetDb.
 */
const WS_A = "de086a00-0000-4000-8000-000000000001";
const WS_B = "de086b00-0000-4000-8000-000000000001";
const USER_A = "de086a00-0000-4000-8000-0000000000a1";
const USER_B = "de086b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];
const KEY_A = "dev086-key-a";

interface Outcome {
  rowCount: number | null; code: string | null;
  reason: "policy" | "privilege" | "other" | null; constraint: string | null;
}

const refusedByPolicy: Outcome = { rowCount: null, code: "42501", reason: "policy", constraint: null };
const refusedByPrivilege: Outcome = { rowCount: null, code: "42501", reason: "privilege", constraint: null };
const inserted: Outcome = { rowCount: 1, code: null, reason: null, constraint: null };

/** A principal: its role, its actor ('' none) and its declared workspace ('' none). */
interface Plane { role: "goproceed_app" | "goproceed_service"; actor: string; declared: string }
const ownerOfB: Plane = { role: "goproceed_app", actor: USER_B, declared: WS_A };
const serviceWithB = (declared: string): Plane => ({ role: "goproceed_service", actor: USER_B, declared });
const serviceWithNone = (declared: string): Plane => ({ role: "goproceed_service", actor: "", declared });

// ── the statements, each the shape withIdempotency writes, none with RETURNING ─

const RECORD = `insert into public.idempotency_records
    (organization_id, actor_scope, operation_id, idempotency_key, request_hash,
     state, response_status, response_body, response_headers, expires_at, completed_at)
  values ($1, $2, 'dev086.probe', $3, repeat('a', 64), 'completed', 200, '{}'::jsonb, '{}'::jsonb,
          now() + interval '1 day', now())`;
const RECORD_ON_CONFLICT = `${RECORD}
  on conflict (organization_id, actor_scope, operation_id, idempotency_key) do nothing`;
/** Two columns withIdempotency leaves to their defaults: 0110 withdrew them. */
const RECORD_BACKDATED = `insert into public.idempotency_records
    (organization_id, actor_scope, operation_id, idempotency_key, request_hash,
     state, response_status, response_body, completed_at, created_at, expires_at)
  values ($1, $2, 'dev086.probe', $3, repeat('a', 64), 'completed', 200, '{}'::jsonb,
          now(), now() - interval '1 year', now() + interval '1 day')`;
const RECORD_WITH_ID = `insert into public.idempotency_records
    (id, organization_id, actor_scope, operation_id, idempotency_key, request_hash,
     state, response_status, response_body, completed_at, expires_at)
  values (gen_random_uuid(), $1, $2, 'dev086.probe', $3, repeat('a', 64), 'completed', 200, '{}'::jsonb,
          now(), now() + interval '1 day')`;

let admin: Client;

async function seedSide(ws: string, user: string, name: string): Promise<void> {
  await admin.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now())
     on conflict (id) do nothing`, [user, `${user}@fixture.test`]);
  await admin.query(
    "insert into public.organizations (id, legal_name, display_name) values ($1, $2, $2)",
    [ws, `Приклад-Простір-${name}`]);
  await admin.query(
    "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'owner', 'active')",
    [ws, user]);
}

/** Statements, each on its own plane, in one transaction that is always rolled back. */
async function outcomes(statements: [Plane, string, unknown[]][]): Promise<Outcome[]> {
  const out: Outcome[] = [];
  const c = superuserClient();
  await c.connect();
  try {
    await c.query("begin");
    for (const [plane, sql, params] of statements) {
      await c.query("savepoint probe");
      await c.query(`set local role ${plane.role}`);
      await c.query(
        `select set_config('app.actor_user_id', $1, true), set_config('app.organization_id', $2, true),
                set_config('app.external_session_id', '', true)`, [plane.actor, plane.declared]);
      try {
        const r = await c.query(sql, params);
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
      await c.query("reset role");
    }
  } finally {
    await c.query("rollback").catch(() => undefined);
    await c.end().catch(() => undefined);
  }
  return out;
}

beforeAll(async () => {
  // A RETURNING would apply the SELECT policy to the new row and mask the INSERT policy (DEV-083).
  for (const sql of [RECORD, RECORD_ON_CONFLICT, RECORD_BACKDATED, RECORD_WITH_ID]) {
    expect(sql).not.toMatch(/returning/i);
  }
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  await seedSide(WS_A, USER_A, "DEV086-A");
  await seedSide(WS_B, USER_B, "DEV086-B");
  // The owner of B once belonged to A: suspended, and visible to that actor under m_select.
  await admin.query(
    "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'owner', 'suspended')",
    [WS_A, USER_B]);
  // A's owner's own record of A, the target of the ON CONFLICT probe.
  await admin.query(RECORD, [WS_A, `user:${USER_A}`, KEY_A]);
  // Premises: no trigger answers before the policy; the service plane inherits the app's grant.
  const triggers = await admin.query(
    "select 1 from pg_trigger where tgrelid = 'public.idempotency_records'::regclass and not tgisinternal");
  expect(triggers.rowCount).toBe(0);
  const inherits = await admin.query<{ ok: boolean }>(
    "select pg_has_role('goproceed_service', 'goproceed_app', 'USAGE') as ok");
  expect(inherits.rows[0]!.ok).toBe(true);
}, 60_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("operational cross-workspace write denial", () => {
  it("idempotency_records: an active member of B cannot record a reply in A or under another actor, and holds no UPDATE or DELETE", async () => {
    const k = () => `dev086-${randomUUID()}`;
    expect(await outcomes([
      // Its own actor in A, where its membership is suspended.
      [ownerOfB, RECORD, [WS_A, `user:${USER_B}`, k()]],
      // Everything A's.
      [ownerOfB, RECORD, [WS_A, `user:${USER_A}`, k()]],
      // Its own workspace under A's owner, and no workspace under A's owner.
      [ownerOfB, RECORD, [WS_B, `user:${USER_A}`, k()]],
      [ownerOfB, RECORD, [null, `user:${USER_A}`, k()]],
      // A workspace that does not exist: the policy, not the key, answers.
      [ownerOfB, RECORD, [randomUUID(), `user:${USER_B}`, k()]],
      // The writer's ON CONFLICT on A's own key: refused, not skipped.
      [ownerOfB, RECORD_ON_CONFLICT, [WS_A, `user:${USER_A}`, KEY_A]],
      // 0110: the columns the writer leaves to their defaults.
      [ownerOfB, RECORD_BACKDATED, [WS_B, `user:${USER_B}`, k()]],
      [ownerOfB, RECORD_WITH_ID, [WS_B, `user:${USER_B}`, k()]],
      // No UPDATE or DELETE grant.
      [ownerOfB, "update public.idempotency_records set response_headers = '{}'::jsonb", []],
      [ownerOfB, "delete from public.idempotency_records", []],
      // The controls: its own record of B, and of no workspace.
      [ownerOfB, RECORD, [WS_B, `user:${USER_B}`, k()]],
      [ownerOfB, RECORD, [null, `user:${USER_B}`, k()]],
    ])).toEqual([
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      refusedByPolicy,
      refusedByPrivilege,
      refusedByPrivilege,
      refusedByPrivilege,
      refusedByPrivilege,
      inserted,
      inserted,
    ]);
  });

  it("idempotency_records (service): a service transaction writes only under its actor, and only where that actor is active", async () => {
    const k = () => `dev086-${randomUUID()}`;
    expect(await outcomes([
      [serviceWithB(WS_B), RECORD, [WS_A, `user:${USER_B}`, k()]],
      [serviceWithB(WS_B), RECORD, [WS_A, `user:${USER_A}`, k()]],
      [serviceWithNone(WS_A), RECORD, [WS_A, `user:${USER_A}`, k()]],
      [serviceWithNone(WS_A), RECORD, [null, "user:", k()]],
      [serviceWithB(WS_B), RECORD, [WS_B, `user:${USER_B}`, k()]],
    ])).toEqual([refusedByPolicy, refusedByPolicy, refusedByPolicy, refusedByPolicy, inserted]);
  });
});
