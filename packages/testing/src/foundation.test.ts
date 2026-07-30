import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, asActor } from "./pg";

// Seeded auth.users fixtures (supabase/seed.sql) — memberships.user_id has an
// FK to auth.users(id). Orgs are randomized so the suite is re-runnable
// without a db reset in between.
const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

async function bootstrap(actor: string, org: string) {
  await asActor(actor, org, async (c) => {
    await c.query(
      "insert into public.organizations (id, legal_name, display_name) values ($1,'L','D')", [org]);
    await c.query(
      "insert into public.memberships (organization_id, user_id, role, status, all_projects) values ($1,$2,'owner','active',true)",
      [org, actor]);
  });
}

describe("0006 foundation tenant isolation", () => {
  it("audit insert into a foreign org is denied; own org is allowed", async () => {
    const org = randomUUID();
    await bootstrap(A, org);
    await expect(asActor(B, org, (c) =>
      c.query(
        "insert into public.audit_events (organization_id, actor_user_id, actor_type, action, object_type, object_id) values ($1,$2,'user','x','y','z')",
        [org, B]),
    )).rejects.toThrow(/row-level security|violates|permission denied/i);
    // No RETURNING here: aktflow_app deliberately has no SELECT on audit
    // (insert-only accountability), and RETURNING requires SELECT privilege.
    const ok = await asActor(A, org, (c) =>
      c.query(
        "insert into public.audit_events (organization_id, actor_user_id, actor_type, action, object_type, object_id) values ($1,$2,'user','x','y','z')",
        [org, A]));
    expect(ok.rowCount).toBe(1);
  });

  it("audit rows cannot be updated or deleted even by the table owner", async () => {
    const org = randomUUID();
    const admin = await adminClient();
    try {
      // A concrete row must exist: a row-level BEFORE trigger never fires on
      // an UPDATE/DELETE that matches nothing, which would pass vacuously.
      await admin.query(
        "insert into public.organizations (id, legal_name, display_name) values ($1,'L','D')", [org]);
      await admin.query(
        "insert into public.audit_events (organization_id, actor_user_id, actor_type, action, object_type, object_id) values ($1,$2,'user','trigger-probe','y','z')",
        [org, A]);
      await expect(
        admin.query("update public.audit_events set action='forged' where organization_id=$1", [org]),
      ).rejects.toThrow(/append-only/i);
      await expect(
        admin.query("delete from public.audit_events where organization_id=$1", [org]),
      ).rejects.toThrow(/append-only/i);
    } finally { await admin.end(); }
  });

  it("outbox insert into a foreign org is denied", async () => {
    const org = randomUUID();
    await bootstrap(A, org);
    await expect(asActor(B, org, (c) =>
      c.query(
        "insert into public.transaction_outbox (organization_id, topic, aggregate_type, aggregate_id, payload_version, payload) values ($1,'t','a','1',1,'{}')",
        [org]),
    )).rejects.toThrow(/row-level security|violates|permission denied/i);
  });

  it("idempotency records are invisible across actors", async () => {
    const key = `k-${randomUUID()}`;
    await asActor(A, null, (c) =>
      c.query(
        `insert into public.idempotency_records (organization_id, actor_scope, operation_id, idempotency_key, request_hash, state, response_status, response_body, completed_at, expires_at)
         values (null, $1, 'op', $2, repeat('a',64), 'completed', 200, '{}', now(), now() + interval '1 day')`,
        [`user:${A}`, key]));
    const seenByB = await asActor(B, null, (c) =>
      c.query("select 1 from public.idempotency_records where idempotency_key=$1", [key]));
    expect(seenByB.rowCount).toBe(0);
    const seenByA = await asActor(A, null, (c) =>
      c.query("select 1 from public.idempotency_records where idempotency_key=$1", [key]));
    expect(seenByA.rowCount).toBe(1);
  });

  it("a viewer cannot insert a legal entity; the owner can", async () => {
    const org = randomUUID();
    await bootstrap(A, org);
    const admin = await adminClient();
    try {
      await admin.query(
        "insert into public.memberships (organization_id, user_id, role, status, all_projects) values ($1,$2,'viewer','active',false)",
        [org, B]);
    } finally { await admin.end(); }
    await expect(asActor(B, org, (c) =>
      c.query("insert into public.legal_entities (organization_id, legal_name) values ($1,'X')", [org]),
    )).rejects.toThrow(/row-level security|violates/i);
    const ok = await asActor(A, org, (c) =>
      c.query("insert into public.legal_entities (organization_id, legal_name) values ($1,'X') returning id", [org]));
    expect(ok.rowCount).toBe(1);
  });

  it("two concurrent first-owner claims on one org yield exactly one owner", async () => {
    const org = randomUUID();
    const admin = await adminClient();
    try {
      await admin.query(
        "insert into public.organizations (id, legal_name, display_name) values ($1,'L','D')", [org]);
      const claim = (u: string) => asActor(u, org, (c) =>
        c.query(
          "insert into public.memberships (organization_id, user_id, role, status, all_projects) values ($1,$2,'owner','active',true)",
          [org, u]));
      const results = await Promise.allSettled([claim(A), claim(B)]);
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      expect(fulfilled).toBe(1);
      const owners = await admin.query(
        "select count(*)::int as n from public.memberships where organization_id=$1", [org]);
      expect(owners.rows[0].n).toBe(1);
    } finally { await admin.end(); }
  });
});
