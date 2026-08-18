import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

// FROZEN HISTORY. public.drain_outbox was RETIRED by migration 0036: it marks
// outbox rows processed without dispatching them and without honoring the 0008
// lease, so it could settle a row another worker held. No cron schedule and no
// non-superuser grant remain.
//
// These cases still pass because they connect as `postgres`, the owner, which
// no revoke gates — so read them as a description of what the retired function
// does, NOT as evidence that draining is a supported path. Do not extend this
// file, and do not "fix" it to stay green if the function is ever dropped:
// delete the suite deliberately instead. The live delivery path is
// app.claim_outbox / app.complete_outbox / app.fail_outbox (0008), which still
// has no deployed consumer.

// Admin connection: goproceed_app has INSERT-ONLY on transaction_outbox per
// data-access-surface.csv DA-099 (SELECT/UPDATE belong to goproceed_worker,
// DA-058). Reading the drain's effect requires the admin role.
const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Unique per test run. This file is executed standalone (`pnpm vitest run
// supabase/functions/outbox-drain/drain.test.ts`), not as part of
// apps/app's suite, but transaction_outbox is shared with other
// integration tests against the same local Postgres instance (see
// apps/app/vitest.config.ts). A blanket `truncate` here could race another
// suite's fixtures, so this test only ever touches rows scoped to its own
// unique topic, and cleans those up explicitly rather than truncating.
function uniqueTopic(): string {
  return `outbox-drain-test-${randomUUID()}`;
}

async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: admin });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

describe("drain_outbox", () => {
  it("marks unprocessed rows processed and leaves nothing unprocessed for them", async () => {
    const topic = uniqueTopic();
    try {
      await withClient(async (c) => {
        await c.query(
          `insert into public.transaction_outbox
             (topic, aggregate_type, aggregate_id, payload_version, payload)
           values ($1, 'test-aggregate', '1', 1, '{}'::jsonb)`,
          [topic],
        );

        // Exercises the actual deployed SECURITY DEFINER function (not a
        // hand-copied SQL string) so this test validates the real object
        // the migration creates.
        const r = await c.query("select public.drain_outbox(1000) as drained");
        expect(Number(r.rows[0].drained)).toBeGreaterThanOrEqual(1);

        const mine = await c.query(
          "select processed_at from public.transaction_outbox where topic = $1",
          [topic],
        );
        expect(mine.rowCount).toBe(1);
        expect(mine.rows[0].processed_at).not.toBeNull();

        const unprocessed = await c.query(
          "select count(*) n from public.transaction_outbox where topic = $1 and processed_at is null",
          [topic],
        );
        expect(Number(unprocessed.rows[0].n)).toBe(0);
      });
    } finally {
      // Scoped cleanup only - never a global truncate (see comment above).
      await withClient((c) => c.query("delete from public.transaction_outbox where topic = $1", [topic]));
    }
  });

  it("does not double-process rows already marked processed (re-runnable, no unique-id workaround needed)", async () => {
    const topic = uniqueTopic();
    try {
      await withClient(async (c) => {
        await c.query(
          `insert into public.transaction_outbox
             (topic, aggregate_type, aggregate_id, payload_version, payload)
           values ($1, 'test-aggregate', '1', 1, '{}'::jsonb)`,
          [topic],
        );
        await c.query("select public.drain_outbox(1000)");

        // A second drain must not re-touch the already-processed row: the
        // outbox is at-least-once delivery, but a single drain call must be
        // idempotent about what it marks.
        const before = await c.query(
          "select processed_at from public.transaction_outbox where topic = $1",
          [topic],
        );
        const secondRun = await c.query("select public.drain_outbox(1000) as drained");
        const after = await c.query(
          "select processed_at from public.transaction_outbox where topic = $1",
          [topic],
        );
        expect(after.rows[0].processed_at).toEqual(before.rows[0].processed_at);
        void secondRun;
      });
    } finally {
      await withClient((c) => c.query("delete from public.transaction_outbox where topic = $1", [topic]));
    }
  });
});
