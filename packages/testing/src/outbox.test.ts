import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient } from "./pg";

async function seedOrg(c: Client): Promise<string> {
  const r = await c.query(
    "insert into public.organizations (legal_name, display_name) values ('L','D') returning id");
  return r.rows[0].id as string;
}

async function seedRow(c: Client, org: string): Promise<string> {
  const r = await c.query(
    `insert into public.transaction_outbox (organization_id, topic, aggregate_type, aggregate_id, payload_version, payload)
     values ($1,'t','a',$2,1,'{}') returning id`, [org, randomUUID()]);
  return r.rows[0].id as string;
}

describe("0008 outbox claim/retry/dead-letter", () => {
  it("claim leases a row; a second claimer skips it; complete finishes it", async () => {
    const c = await adminClient();
    try {
      const org = await seedOrg(c);
      const id = await seedRow(c, org);
      const claim1 = await c.query("select * from app.claim_outbox(50, 'w1', 60)");
      const mine = claim1.rows.find((r: any) => r.id === id);
      expect(mine).toBeTruthy();
      const claim2 = await c.query("select * from app.claim_outbox(50, 'w2', 60)");
      expect(claim2.rows.map((r: any) => r.id)).not.toContain(id);
      await c.query("select app.complete_outbox($1,$2)", [id, mine.lease_token]);
      const done = await c.query(
        "select processed_at from public.transaction_outbox where id=$1", [id]);
      expect(done.rows[0].processed_at).not.toBeNull();
    } finally { await c.end(); }
  });

  it("complete with a wrong lease token is rejected", async () => {
    const c = await adminClient();
    try {
      const org = await seedOrg(c);
      const id = await seedRow(c, org);
      const claim = await c.query("select * from app.claim_outbox(50, 'w1', 60)");
      expect(claim.rows.map((r: any) => r.id)).toContain(id);
      await expect(
        c.query("select app.complete_outbox($1, gen_random_uuid())", [id]),
      ).rejects.toThrow(/lease/i);
    } finally { await c.end(); }
  });

  it("an expired lease is reclaimable by another worker", async () => {
    const c = await adminClient();
    try {
      const org = await seedOrg(c);
      const id = await seedRow(c, org);
      const claim1 = await c.query("select * from app.claim_outbox(50, 'w1', 60)");
      expect(claim1.rows.map((r: any) => r.id)).toContain(id);
      await c.query(
        "update public.transaction_outbox set lease_expires_at = now() - interval '1 second' where id=$1", [id]);
      const claim2 = await c.query("select * from app.claim_outbox(50, 'w2', 60)");
      expect(claim2.rows.map((r: any) => r.id)).toContain(id);
    } finally { await c.end(); }
  });

  it("fail applies exponential backoff and dead-letters after max attempts", async () => {
    const c = await adminClient();
    try {
      const org = await seedOrg(c);
      const id = await seedRow(c, org);
      for (let attempt = 1; attempt <= 5; attempt++) {
        const claim = await c.query("select * from app.claim_outbox(100, 'w1', 60)");
        const row = claim.rows.find((r: any) => r.id === id);
        expect(row, `attempt ${attempt} should be claimable`).toBeTruthy();
        await c.query("select app.fail_outbox($1,$2,'boom')", [id, row.lease_token]);
        if (attempt < 5) {
          const st = await c.query(
            "select attempt_count, available_at > now() as backed_off, last_error from public.transaction_outbox where id=$1", [id]);
          expect(st.rows[0].attempt_count).toBe(attempt);
          expect(st.rows[0].backed_off).toBe(true);
          expect(st.rows[0].last_error).toBe("boom");
          await c.query("update public.transaction_outbox set available_at = now() where id=$1", [id]);
        }
      }
      const dead = await c.query(
        "select attempts from public.outbox_dead_letters where outbox_id=$1", [id]);
      expect(dead.rowCount).toBe(1);
      expect(dead.rows[0].attempts).toBe(5);
      const closed = await c.query(
        "select processed_at from public.transaction_outbox where id=$1", [id]);
      expect(closed.rows[0].processed_at).not.toBeNull();
    } finally { await c.end(); }
  });
});
