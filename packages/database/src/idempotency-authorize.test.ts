import { describe, expect, it } from "vitest";
import type { Tx } from "./tx";
import { actorScopedOnly, IdempotencyConflictError, withIdempotency } from "./idempotency";

/**
 * DEV-020 / BL-103: `authorize` runs before the lock and the lookup, on a
 * replay as on a fresh call. No database: a fake transaction answers the
 * helper's three statements (the advisory lock, the lookup, the insert) and
 * records the order they arrived in.
 */
function fakeTx(prior: { requestHash: string; body: unknown } | null, log: string[]): Tx {
  const query = async (sql: string) => {
    if (sql.includes("pg_advisory_xact_lock")) { log.push("lock"); return { rows: [], rowCount: 1 }; }
    if (sql.includes("from public.idempotency_records")) {
      log.push("lookup");
      return prior
        ? { rows: [{ state: "completed", response_status: 201, response_body: prior.body,
            request_hash: prior.requestHash, expires_at: new Date(Date.now() + 86_400_000) }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (sql.includes("insert into public.idempotency_records")) {
      log.push("insert");
      return { rows: [{ expires_at: new Date(Date.now() + 86_400_000) }], rowCount: 1 };
    }
    throw new Error(`unexpected statement: ${sql}`);
  };
  return { query } as unknown as Tx;
}

const ARGS = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  actorScope: "user:00000000-0000-4000-8000-0000000000a1",
  operationId: "widgets.create", key: "k-1", requestHash: "a".repeat(64),
};
const denied = new Error("403 from authorize");

describe("withIdempotency: authorize runs first (BL-103)", () => {
  it("a fresh call authorizes before the lock and hands the result to fn", async () => {
    const log: string[] = [];
    const out = await withIdempotency(fakeTx(null, log), {
      ...ARGS, authorize: async () => { log.push("authorize"); return { memberId: "m-1" }; },
    }, async (auth) => { log.push(`fn:${auth.memberId}`); return { status: 201, body: { ok: true } }; });
    expect(out.replayed).toBe(false);
    expect(log).toEqual(["authorize", "lock", "lookup", "fn:m-1", "insert"]);
  });

  it("a replay still authorizes, and a refusal returns nothing stored", async () => {
    const log: string[] = [];
    const tx = fakeTx({ requestHash: ARGS.requestHash, body: { widgetId: "w-1" } }, log);
    const allowed = await withIdempotency(tx, { ...ARGS, authorize: async () => { log.push("authorize"); } },
      async () => { throw new Error("fn must not run on a replay"); });
    expect(allowed).toMatchObject({ replayed: true, body: { widgetId: "w-1" } });
    expect(log).toEqual(["authorize", "lock", "lookup"]);

    log.length = 0;
    await expect(withIdempotency(tx, { ...ARGS, authorize: async () => { log.push("authorize"); throw denied; } },
      async () => ({ status: 201, body: {} }))).rejects.toBe(denied);
    expect(log).toEqual(["authorize"]);
  });

  it("a refused caller with a different body gets the refusal, not IdempotencyConflictError", async () => {
    const log: string[] = [];
    const tx = fakeTx({ requestHash: "b".repeat(64), body: {} }, log);
    const refused = withIdempotency(tx, { ...ARGS, authorize: async () => { throw denied; } },
      async () => ({ status: 201, body: {} }));
    await expect(refused).rejects.toBe(denied);
    await expect(withIdempotency(tx, { ...ARGS, authorize: async () => undefined },
      async () => ({ status: 201, body: {} }))).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it("a call that names a workspace cannot pass the no-workspace sentinel", async () => {
    const log: string[] = [];
    await expect(withIdempotency(fakeTx(null, log), { ...ARGS, authorize: actorScopedOnly },
      async () => ({ status: 201, body: {} }))).rejects.toThrow(/must authorize its caller/);
    expect(log).toEqual([]);
    await expect(withIdempotency(fakeTx(null, log), { ...ARGS, organizationId: null, authorize: actorScopedOnly },
      async () => ({ status: 201, body: {} }))).resolves.toMatchObject({ replayed: false });
  });
});
