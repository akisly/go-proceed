import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, asActor } from "./pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("0007 idempotency expiry", () => {
  it("an expired completed record does not block a fresh execution with the same key", async () => {
    const key = `k-exp-${randomUUID()}`;
    const admin = await adminClient();
    try {
      await admin.query(
        `insert into public.idempotency_records (organization_id, actor_scope, operation_id, idempotency_key, request_hash, state, response_status, response_body, completed_at, created_at, expires_at)
         values (null, $1, 'op', $2, repeat('a',64), 'completed', 201, '{}', now() - interval '31 days', now() - interval '31 days', now() - interval '1 day')`,
        [`user:${A}`, key]);
    } finally { await admin.end(); }
    await asActor(A, null, async (c) => {
      const del = await c.query(
        "select app.delete_expired_idempotency(null, $1, 'op', $2) as d", [`user:${A}`, key]);
      expect(del.rows[0].d).toBe(true);
      const ins = await c.query(
        `insert into public.idempotency_records (organization_id, actor_scope, operation_id, idempotency_key, request_hash, state, response_status, response_body, completed_at, expires_at)
         values (null, $1, 'op', $2, repeat('b',64), 'completed', 201, '{}', now(), now() + interval '30 days')`,
        [`user:${A}`, key]);
      expect(ins.rowCount).toBe(1);
    });
  });

  it("delete_expired refuses unexpired rows and foreign scopes", async () => {
    const key = `k-fresh-${randomUUID()}`;
    await asActor(A, null, async (c) => {
      await c.query(
        `insert into public.idempotency_records (organization_id, actor_scope, operation_id, idempotency_key, request_hash, state, response_status, response_body, completed_at, expires_at)
         values (null, $1, 'op', $2, repeat('a',64), 'completed', 200, '{}', now(), now() + interval '30 days')`,
        [`user:${A}`, key]);
      const fresh = await c.query(
        "select app.delete_expired_idempotency(null, $1, 'op', $2) as d", [`user:${A}`, key]);
      expect(fresh.rows[0].d).toBe(false);
      const foreign = await c.query(
        "select app.delete_expired_idempotency(null, 'user:00000000-0000-0000-0000-000000000000', 'op', $1) as d", [key]);
      expect(foreign.rows[0].d).toBe(false);
    });
  });
});
