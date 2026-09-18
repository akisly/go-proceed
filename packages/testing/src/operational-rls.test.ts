import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, asActor, asService, dropWorkspaces } from "./pg";

/**
 * READINESS GATE 11, MODULE operational (DEV-016, BL-095).
 *
 * idempotency_records: the DEV-014 read shape. idem_select is keyed on
 * actor_scope, so the owner of A reads the record it wrote in A and the owner
 * of B, declaring A, reads only its own record of B. Since 0089 (DEV-020,
 * BL-103) a record carrying a workspace is read only by an active member of
 * it: a user whose membership of A ended reads none of its own records of A,
 * so a replay cannot return a stored response to someone who left.
 *
 * audit_events and transaction_outbox: goproceed_app holds INSERT and no
 * SELECT, so every member read fails at the grant and a read denial would prove
 * nothing about tenancy. The positive is a permitted insert into A by the owner
 * of A; the negative is the owner of B, declaring A, inserting its own row and
 * being refused one of A (42501) in the same transaction. Every write is rolled
 * back: the outbox worker claims unprocessed rows across all workspaces
 * (outbox.test.ts), and audit rows are append-only.
 *
 * The minimal world is the workspace-access one: user, workspace, owner. No
 * resetDb.
 */
const WS_A = "de165a00-0000-4000-8000-000000000001";
const WS_B = "de165b00-0000-4000-8000-000000000001";
const USER_A = "de165a00-0000-4000-8000-0000000000a1";
const USER_B = "de165b00-0000-4000-8000-0000000000b1";
// DEV-020: a user whose membership of A has ended, with its own record of A.
const USER_D = "de165a00-0000-4000-8000-0000000000d1";
const BOTH = [WS_A, WS_B];
const AUDIT_INSERT = `insert into public.audit_events (organization_id, actor_user_id, actor_type, action, object_type, object_id)
  values ($1, $2, 'user', 'dev016.rls-probe', 'probe', 'x')`;
const OUTBOX_INSERT = `insert into public.transaction_outbox (organization_id, topic, aggregate_type, aggregate_id, payload_version, payload)
  values ($1, 'dev016.rls-probe', 'probe', 'x', 1, '{}'::jsonb)`;

let admin: Client;

type Step = [sql: string, params: unknown[]];
const ROLL_BACK = new Error("operational-rls: roll back");

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
  await admin.query(
    `insert into public.idempotency_records
       (organization_id, actor_scope, operation_id, idempotency_key, request_hash, state,
        response_status, response_body, completed_at, expires_at)
     values ($1, $2, 'dev016.rls-probe', $3, repeat('a',64), 'completed', 200, '{}'::jsonb, now(), now() + interval '1 day')`,
    [ws, `user:${user}`, `dev016-${randomUUID()}`]);
}

/** The distinct workspaces of the rows `actor` can read, declaring workspace A. */
async function seen(actor: string, sql: string): Promise<string[]> {
  const r = await asActor<{ ws: string }>(actor, WS_A, (c) => c.query(sql, [BOTH]));
  return r.rows.map((row) => row.ws).sort();
}

/**
 * Runs `steps` as `actor`, declaring workspace A, in one transaction that is
 * ALWAYS rolled back. Each step reports its row count or the SQLSTATE that
 * stopped it; a refused step goes last, so no later step reports 25P02.
 */
async function wrote(actor: string, steps: Step[]): Promise<(number | string)[]> {
  const outcomes: (number | string)[] = [];
  try {
    await asActor(actor, WS_A, async (c) => {
      for (const [sql, params] of steps) {
        try {
          outcomes.push((await c.query(sql, params)).rowCount ?? 0);
        } catch (e) {
          outcomes.push((e as { code?: string }).code ?? "unknown");
        }
      }
      throw ROLL_BACK;
    });
  } catch (e) {
    if (e !== ROLL_BACK) throw e;
  }
  return outcomes;
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  await seedSide(WS_A, USER_A, "DEV016-OP-A");
  await seedSide(WS_B, USER_B, "DEV016-OP-B");
  await admin.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now())
     on conflict (id) do nothing`, [USER_D, `${USER_D}@fixture.test`]);
  await admin.query(
    "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'admin', 'ended')",
    [WS_A, USER_D]);
  await admin.query(
    `insert into public.idempotency_records
       (organization_id, actor_scope, operation_id, idempotency_key, request_hash, state,
        response_status, response_body, completed_at, expires_at)
     values ($1, $2, 'dev020.rls-probe', $3, repeat('a',64), 'completed', 201, '{}'::jsonb, now(), now() + interval '1 day')`,
    [WS_A, `user:${USER_D}`, `dev020-${randomUUID()}`]);
}, 60_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("operational isolation — the owner of A reaches rows of A and the owner of B declaring A reaches only rows of B", () => {
  it("idempotency_records: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct organization_id as ws from public.idempotency_records where organization_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  // DEV-020 / BL-103: withIdempotency replays whatever its lookup finds, so a
  // record the caller may no longer act on must not be found.
  it("idempotency_records: a user whose membership of A ended reads none of its own records of A", async () => {
    const own = await admin.query<{ n: string }>(
      "select count(*) n from public.idempotency_records where organization_id = $1 and actor_scope = $2",
      [WS_A, `user:${USER_D}`]);
    expect(Number(own.rows[0]?.n)).toBe(1); // the record exists, so the empty read below is not vacuous
    const sql = "select distinct organization_id as ws from public.idempotency_records where organization_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_D, sql)).toEqual([]);
  });

  it("idempotency_records: the same holds on the service plane, which carries the actor", async () => {
    const sql = "select distinct organization_id as ws from public.idempotency_records where organization_id = any($1::uuid[])";
    const on = async (actor: string) =>
      (await asService<{ ws: string }>(actor, WS_A, (c) => c.query(sql, [BOTH]))).rows.map((r) => r.ws);
    expect(await on(USER_A)).toEqual([WS_A]);
    expect(await on(USER_D)).toEqual([]);
  });

  it("audit_events: the owner of A writes a row of A and the owner of B writes its own but is refused one of A", async () => {
    expect(await wrote(USER_A, [[AUDIT_INSERT, [WS_A, USER_A]]])).toEqual([1]);
    expect(await wrote(USER_B, [[AUDIT_INSERT, [WS_B, USER_B]], [AUDIT_INSERT, [WS_A, USER_B]]])).toEqual([1, "42501"]);
    // The premise: no member reads audit at all, so a read denial proves nothing here.
    expect(await wrote(USER_A, [["select 1 from public.audit_events limit 1", []]])).toEqual(["42501"]);
  });

  it("transaction_outbox: the owner of A writes a row of A and the owner of B writes its own but is refused one of A", async () => {
    expect(await wrote(USER_A, [[OUTBOX_INSERT, [WS_A]]])).toEqual([1]);
    expect(await wrote(USER_B, [[OUTBOX_INSERT, [WS_B]], [OUTBOX_INSERT, [WS_A]]])).toEqual([1, "42501"]);
    expect(await wrote(USER_A, [["select 1 from public.transaction_outbox limit 1", []]])).toEqual(["42501"]);
  });
});
