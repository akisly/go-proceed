import { describe, it, expect } from "vitest";
import { appClient } from "./pg";

// Moved here from supabase/migrations/migrations.test.ts (Task 12): that
// location was outside every workspace package's `src`, so `turbo run
// test` never picked it up — it was a dead test giving false confidence.
// packages/testing already owns the other Postgres-integration suites
// (rls.test.ts) and this package's `test` script (`vitest run`) is wired
// into `turbo run test`, so this is where migration-shape assertions
// belong. DB-URL access now goes through this package's shared `pg.ts`
// helper (APP_DB_URL, same goproceed_app_login default as rls.test.ts)
// instead of a bespoke SUPABASE_DB_URL default — `to_regclass` only needs
// the role to be able to see the catalog, which goproceed_app_login can.
async function tableExists(name: string): Promise<boolean> {
  const c = appClient();
  await c.connect();
  try {
    const r = await c.query("select to_regclass($1) as reg", [`public.${name}`]);
    return r.rows[0].reg !== null;
  } finally {
    await c.end();
  }
}

describe("core migrations", () => {
  it("creates tenancy + audit/outbox/idempotency tables", async () => {
    for (const t of [
      "organizations",
      "legal_entities",
      "memberships",
      "audit_events",
      "transaction_outbox",
      "idempotency_records",
    ]) {
      expect(await tableExists(t)).toBe(true);
    }
  }, 60_000);
});
