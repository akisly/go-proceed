import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "./tx.js";
import { withIdempotency, IdempotencyConflictError, IDEMPOTENCY_CLASS_TTL } from "./idempotency.js";
import { Client } from "pg";

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

async function count(sql: string, params: unknown[]): Promise<number> {
  const c = new Client({ connectionString: admin });
  await c.connect();
  const r = await c.query(sql, params);
  await c.end();
  return Number(r.rows[0].n);
}

describe("withIdempotency", () => {
  it("replays the original response and runs fn only once for a repeated key", async () => {
    const A = randomUUID();
    const key = randomUUID();
    let calls = 0;

    const first = await withTenantTx({ actorUserId: A, organizationId: null, requestId: "req-a" }, (tx) =>
      withIdempotency(
        tx,
        { organizationId: null, actorScope: `user:${A}`, operationId: "widgets.create", key, requestHash: HASH_A },
        async () => {
          calls += 1;
          return { status: 201, body: { widgetId: "w-1", calls } };
        },
      ),
    );
    expect(first.replayed).toBe(false);
    expect(first.status).toBe(201);
    expect(first.body).toEqual({ widgetId: "w-1", calls: 1 });
    expect(first.expiresAt).toBeInstanceOf(Date);
    const expectedExpiry = Date.now() + IDEMPOTENCY_CLASS_TTL.standard_30d * 1000;
    expect(Math.abs(first.expiresAt.getTime() - expectedExpiry)).toBeLessThan(60_000);

    const second = await withTenantTx({ actorUserId: A, organizationId: null, requestId: "req-b" }, (tx) =>
      withIdempotency(
        tx,
        { organizationId: null, actorScope: `user:${A}`, operationId: "widgets.create", key, requestHash: HASH_A },
        async () => {
          calls += 1;
          return { status: 201, body: { widgetId: "w-2", calls } };
        },
      ),
    );
    expect(second.replayed).toBe(true);
    expect(second.status).toBe(201);
    // Replay returns the ORIGINAL response, not a fresh one from fn - and fn must
    // not have run a second time.
    expect(second.body).toEqual({ widgetId: "w-1", calls: 1 });
    expect(second.expiresAt).toEqual(first.expiresAt);
    expect(calls).toBe(1);

    expect(
      await count(
        "select count(*) n from public.idempotency_records where actor_scope=$1 and operation_id=$2 and idempotency_key=$3",
        [`user:${A}`, "widgets.create", key],
      ),
    ).toBe(1);
  });

  it("throws IdempotencyConflictError when the same key is reused with a different request hash", async () => {
    const A = randomUUID();
    const key = randomUUID();
    let calls = 0;

    await withTenantTx({ actorUserId: A, organizationId: null, requestId: "req-c" }, (tx) =>
      withIdempotency(
        tx,
        { organizationId: null, actorScope: `user:${A}`, operationId: "widgets.create", key, requestHash: HASH_A },
        async () => {
          calls += 1;
          return { status: 201, body: { widgetId: "w-1", calls } };
        },
      ),
    );
    expect(calls).toBe(1);

    await expect(
      withTenantTx({ actorUserId: A, organizationId: null, requestId: "req-d" }, (tx) =>
        withIdempotency(
          tx,
          { organizationId: null, actorScope: `user:${A}`, operationId: "widgets.create", key, requestHash: HASH_B },
          async () => {
            calls += 1;
            return { status: 201, body: { widgetId: "w-2", calls } };
          },
        ),
      ),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);

    // fn must not run for the conflicting call, and no second row is stored.
    expect(calls).toBe(1);
    expect(
      await count(
        "select count(*) n from public.idempotency_records where actor_scope=$1 and operation_id=$2 and idempotency_key=$3",
        [`user:${A}`, "widgets.create", key],
      ),
    ).toBe(1);
  });
});
