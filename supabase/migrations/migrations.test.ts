import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "pg";

const url = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function tableExists(name: string): Promise<boolean> {
  const c = new Client({ connectionString: url });
  await c.connect();
  const r = await c.query("select to_regclass($1) as reg", [`public.${name}`]);
  await c.end();
  return r.rows[0].reg !== null;
}

describe("core migrations", () => {
  beforeAll(() => {}, 60_000);
  it("creates tenancy + audit/outbox/idempotency tables", async () => {
    for (const t of ["organizations","legal_entities","memberships","audit_events","transaction_outbox","idempotency_records"]) {
      expect(await tableExists(t)).toBe(true);
    }
  });
});
