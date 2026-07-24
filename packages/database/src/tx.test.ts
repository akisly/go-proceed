import { describe, it, expect } from "vitest";
import { withTenantTx } from "./tx.js";
import { recordAudit } from "./audit.js";
import { enqueueOutbox } from "./outbox.js";
import { Client } from "pg";

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
    const orgId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    await withTenantTx({ actorUserId: A, organizationId: null, requestId: "req-1" }, async (tx) => {
      await tx.query("insert into public.organizations (id, legal_name, display_name) values ($1,'L','D')", [orgId]);
      await tx.query("insert into public.memberships (organization_id,user_id,role,status,all_projects) values ($1,$2,'owner','active',true)", [orgId, A]);
      await recordAudit(tx, { actorUserId: A, organizationId: orgId, requestId: "req-1" },
        { action: "organization.created", object_type: "organization", object_id: orgId, details: {} });
      await enqueueOutbox(tx, { actorUserId: A, organizationId: orgId, requestId: "req-1" },
        { topic: "organization.created", aggregate_type: "organization", aggregate_id: orgId, payload_version: 1, payload: {} });
    });
    expect(await count("select count(*) n from public.audit_events where object_id=$1", [orgId])).toBe(1);
    expect(await count("select count(*) n from public.transaction_outbox where aggregate_id=$1", [orgId])).toBe(1);
  });

  it("rolls back everything when fn throws", async () => {
    const orgId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    await expect(withTenantTx({ actorUserId: A, organizationId: null, requestId: "req-2" }, async (tx) => {
      await tx.query("insert into public.organizations (id, legal_name, display_name) values ($1,'L','D')", [orgId]);
      throw new Error("boom");
    })).rejects.toThrow("boom");
    expect(await count("select count(*) n from public.organizations where id=$1", [orgId])).toBe(0);
  });
});
