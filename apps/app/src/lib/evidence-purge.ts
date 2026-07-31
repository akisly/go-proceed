import { Client } from "pg";
import { removeObject } from "./evidence-storage";

/**
 * The purge worker for orphaned and expired upload bytes (INV-047).
 *
 * Runs with elevated credentials, not as `aktflow_app`: purging crosses tenants
 * by nature, and a member-facing role must not be able to trigger byte deletion
 * in another workspace. That mirrors how the outbox drain runs.
 *
 * Deliberately not built on the transaction outbox — `public.drain_outbox`
 * marks every claimed row processed with no dispatch, so a purge request routed
 * through it would be recorded as done while the bytes lived on (engineering
 * review, finding D4).
 */
const SYSTEM_DB_URL = process.env.SUPABASE_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export interface PurgeOutcome {
  claimed: number;
  purged: number;
  failed: number;
}

async function withSystemClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: SYSTEM_DB_URL });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

/** Marks intents whose authorization window closed without a finalize. */
export async function expireUploadIntents(): Promise<number> {
  return withSystemClient(async (c) => {
    const r = await c.query<{ expire_upload_intents: number }>(
      "select public.expire_upload_intents()");
    return Number(r.rows[0]?.expire_upload_intents ?? 0);
  });
}

/**
 * Deletes the bytes behind expired and orphaned intents.
 *
 * Idempotent in both directions: removing an absent object is not an error, and
 * an intent is only marked purged after the delete returns, so a crash in
 * between leaves the row claimable again rather than silently "done".
 */
export async function drainEvidencePurge(batch = 50): Promise<PurgeOutcome> {
  return withSystemClient(async (c) => {
    const claimed = await c.query<{
      upload_intent_id: string; workspace_id: string;
      storage_bucket: string | null; storage_key: string | null;
    }>("select * from public.claim_upload_purge($1)", [batch]);

    let purged = 0;
    let failed = 0;
    for (const row of claimed.rows) {
      try {
        if (row.storage_key) await removeObject(row.storage_key);
        await c.query("select public.complete_upload_purge($1)", [row.upload_intent_id]);
        purged += 1;
      } catch (e) {
        // The row stays unpurged and keeps its reason. After five attempts it
        // stops being claimed and stands as an operational alert: bytes that
        // should be gone and are not.
        await c.query("select public.fail_upload_purge($1,$2)",
          [row.upload_intent_id, (e as Error).message.slice(0, 500)]);
        failed += 1;
      }
    }
    return { claimed: claimed.rows.length, purged, failed };
  });
}
