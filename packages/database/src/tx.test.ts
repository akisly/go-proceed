import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx, withServiceTx } from "./tx";
import { recordAudit } from "./audit";
import { enqueueOutbox } from "./outbox";
import { Client } from "pg";

// Fixed seeded auth.users row (see supabase/seed.sql) - memberships.user_id
// has an FK to auth.users(id), so this must stay a real seeded user, not a
// fresh randomUUID() per run. Only the org/entity ids below are randomized
// so the suite is re-runnable without a db reset in between.
const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function count(sql: string, params: unknown[]): Promise<number> {
  const c = new Client({ connectionString: admin });
  await c.connect();
  const r = await c.query(sql, params);
  await c.end();
  return Number(r.rows[0].n);
}

describe("withTenantTx", () => {
  it("commits domain row + audit + outbox atomically", async () => {
    const orgId = randomUUID();
    await withTenantTx({ actorUserId: A, organizationId: null, requestId: "req-1" }, async (tx) => {
      await tx.query("insert into public.organizations (id, legal_name, display_name) values ($1,'L','D')", [orgId]);
      await tx.query("insert into public.memberships (organization_id,user_id,role,status,all_projects) values ($1,$2,'owner','active',true)", [orgId, A]);
      await recordAudit(tx, { actorUserId: A, organizationId: null, requestId: "req-1" },
        { action: "organization.created", object_type: "organization", object_id: orgId, details: {} },
        { organizationId: orgId });
      await enqueueOutbox(tx, { actorUserId: A, organizationId: null, requestId: "req-1" },
        { topic: "organization.created", aggregate_type: "organization", aggregate_id: orgId, payload_version: 1, payload: {} },
        { organizationId: orgId });
    });
    expect(await count("select count(*) n from public.audit_events where object_id=$1", [orgId])).toBe(1);
    expect(await count("select count(*) n from public.transaction_outbox where aggregate_id=$1", [orgId])).toBe(1);
  });

  it("rolls back everything when fn throws", async () => {
    const orgId = randomUUID();
    await expect(withTenantTx({ actorUserId: A, organizationId: null, requestId: "req-2" }, async (tx) => {
      await tx.query("insert into public.organizations (id, legal_name, display_name) values ($1,'L','D')", [orgId]);
      throw new Error("boom");
    })).rejects.toThrow("boom");
    expect(await count("select count(*) n from public.organizations where id=$1", [orgId])).toBe(0);
  });
});

describe("withServiceTx", () => {
  it("runs as the service role while keeping the login as session_user", async () => {
    // session_user staying the login is not incidental: it is the only reason
    // a SECURITY DEFINER function can ask who connected, which is what
    // migration 0035 depends on.
    const seen = await withServiceTx(
      { actorUserId: A, organizationId: null, requestId: "req-service" },
      async (tx) => {
        const r = await tx.query<{ cu: string; su: string }>(
          "select current_user as cu, session_user as su");
        return r.rows[0]!;
      });
    expect(seen.cu).toBe("aktflow_service");
    expect(seen.su).toBe("aktflow_service_login");
  });

  it("still carries the actor, because the server acts on a member's behalf", async () => {
    const seen = await withServiceTx(
      { actorUserId: A, organizationId: null, requestId: "req-service" },
      async (tx) => {
        const r = await tx.query<{ actor: string }>(
          "select current_setting('app.actor_user_id', true) as actor");
        return r.rows[0]!;
      });
    expect(seen.actor).toBe(A);
  });
});
