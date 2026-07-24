import { describe, it, expect } from "vitest";
import { withTenantTx } from "./tx.js";
import { withIdempotency } from "./idempotency.js";
import { Client } from "pg";

const A = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const HASH = "a".repeat(64);

async function count(sql: string, params: unknown[]): Promise<number> {
  const c = new Client({ connectionString: admin });
  await c.connect();
  const r = await c.query(sql, params);
  await c.end();
  return Number(r.rows[0].n);
}

describe("withIdempotency", () => {
  it("replays the original response and runs fn only once for a repeated key", async () => {
    const key = "idem-key-1";
    let calls = 0;

    const first = await withTenantTx({ actorUserId: A, organizationId: null, requestId: "req-a" }, (tx) =>
      withIdempotency(
        tx,
        { organizationId: null, actorScope: `user:${A}`, operationId: "widgets.create", key, requestHash: HASH },
        async () => {
          calls += 1;
          return { status: 201, body: { widgetId: "w-1", calls } };
        },
      ),
    );
    expect(first.replayed).toBe(false);
    expect(first.status).toBe(201);
    expect(first.body).toEqual({ widgetId: "w-1", calls: 1 });

    const second = await withTenantTx({ actorUserId: A, organizationId: null, requestId: "req-b" }, (tx) =>
      withIdempotency(
        tx,
        { organizationId: null, actorScope: `user:${A}`, operationId: "widgets.create", key, requestHash: HASH },
        async () => {
          calls += 1;
          return { status: 201, body: { widgetId: "w-2", calls } };
        },
      ),
    );
    expect(second.replayed).toBe(true);
    expect(second.status).toBe(201);
    // Replay returns the ORIGINAL response, not a fresh one from fn — and fn must
    // not have run a second time.
    expect(second.body).toEqual({ widgetId: "w-1", calls: 1 });
    expect(calls).toBe(1);

    expect(
      await count(
        "select count(*) n from public.idempotency_records where actor_scope=$1 and operation_id=$2 and idempotency_key=$3",
        [`user:${A}`, "widgets.create", key],
      ),
    ).toBe(1);
  });
});
