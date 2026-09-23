import { randomUUID } from "node:crypto";
import { withPurgeWorkerTx } from "@goproceed/database";
import { removeObject } from "./evidence-storage";

/**
 * The purge worker for orphaned and expired upload bytes (INV-047).
 *
 * Runs as its own principal, goproceed_purge_worker (migration 0090, DEV-036),
 * through PURGE_DB_URL: purging crosses tenants by nature, so neither the
 * member-facing role nor the service principal (which inherits every tenant
 * table grant) may do it, and the purge role may do nothing else. There is no
 * fallback URL; `withPurgeWorkerTx` refuses a connection that is not the purge
 * login, a superuser's included.
 *
 * Its runner is `app/internal/evidence/purge/route.ts`, which Vercel Cron calls
 * (`apps/app/vercel.json`, the owner's decision on Q-12, 2026-09-23).
 *
 * Deliberately not built on the transaction outbox — `public.drain_outbox`
 * marks every claimed row processed with no dispatch, so a purge request routed
 * through it would be recorded as done while the bytes lived on (engineering
 * review, finding D4).
 */

export interface PurgeOutcome {
  claimed: number;
  purged: number;
  failed: number;
}

export interface PurgeHealth {
  /** Unpurged rows whose five attempts are spent; never claimed again. */
  exhausted: number;
  /** Unpurged rows due for more than 24 hours (INV-047's bound). */
  overdue: number;
}

export interface PurgeRun extends PurgeOutcome, PurgeHealth {
  expired: number;
}

const ctx = () => ({ requestId: randomUUID() });

/** Marks intents whose authorization window closed without a finalize. */
export async function expireUploadIntents(): Promise<number> {
  return withPurgeWorkerTx(ctx(), async (tx) => {
    const r = await tx.query<{ expire_upload_intents: number }>(
      "select app.expire_upload_intents()");
    return Number(r.rows[0]?.expire_upload_intents ?? 0);
  });
}

/**
 * Deletes the bytes behind expired and orphaned intents.
 *
 * Idempotent in both directions: removing an absent object is not an error, and
 * an intent is only marked purged after the delete returns, so a crash in
 * between leaves the row claimable again rather than silently "done".
 *
 * The claim, and each row's outcome, are separate short transactions: the
 * delete between them is an HTTP call to Storage and must not hold a database
 * connection open in `begin`.
 */
export async function drainEvidencePurge(batch = 50): Promise<PurgeOutcome> {
  const claimed = await withPurgeWorkerTx(ctx(), async (tx) => (await tx.query<{
    upload_intent_id: string; workspace_id: string;
    storage_bucket: string | null; storage_key: string | null;
  }>("select * from app.claim_upload_purge($1)", [batch])).rows);

  let purged = 0;
  let failed = 0;
  for (const row of claimed) {
    try {
      if (row.storage_key) {
        if (!row.storage_bucket) {
          // The database said which bucket to clear and did not know. Deleting
          // from a guessed bucket would report success while the bytes lived
          // on somewhere else.
          throw new Error("purge: intent has a storage key but no bucket");
        }
        await removeObject(row.storage_key, row.storage_bucket);
      }
    } catch (e) {
      // The row stays unpurged and keeps its reason, and THIS is where the
      // retry budget is spent (migration 0024): a deletion was attempted and
      // failed. A worker that dies before getting here leaves only its claim,
      // which the one-hour window reclaims. The message names no key
      // (`EvidenceStorageError`, DEV-034).
      await withPurgeWorkerTx(ctx(), (tx) => tx.query("select app.fail_upload_purge($1,$2)",
        [row.upload_intent_id, (e as Error).message.slice(0, 500)]));
      failed += 1;
      continue;
    }
    await withPurgeWorkerTx(ctx(), (tx) =>
      tx.query("select app.complete_upload_purge($1)", [row.upload_intent_id]));
    purged += 1;
  }
  return { claimed: claimed.length, purged, failed };
}

/** Counts only; what the runner alerts on (INV-047 «repeated failure alerts»). */
export async function purgeHealth(): Promise<PurgeHealth> {
  return withPurgeWorkerTx(ctx(), async (tx) => {
    const r = await tx.query<{ exhausted: number; overdue: number }>(
      "select exhausted, overdue from app.upload_purge_health()");
    return { exhausted: Number(r.rows[0]?.exhausted ?? 0), overdue: Number(r.rows[0]?.overdue ?? 0) };
  });
}

/**
 * One scheduled run: expire, then drain batch after batch until the queue is
 * empty, the batch cap is reached or the time budget is spent, then read the
 * health counts. A run cut off by the platform mid-row is safe: the row keeps
 * its claim and the one-hour window hands it to a later run.
 */
export async function runEvidencePurge(opts: {
  batch?: number; maxBatches?: number; budgetMs?: number; now?: () => number;
} = {}): Promise<PurgeRun> {
  const batch = opts.batch ?? 50;
  const maxBatches = opts.maxBatches ?? 20;
  const now = opts.now ?? Date.now;
  const deadline = now() + (opts.budgetMs ?? 40_000);

  const expired = await expireUploadIntents();
  const total: PurgeOutcome = { claimed: 0, purged: 0, failed: 0 };
  for (let i = 0; i < maxBatches && now() < deadline; i++) {
    const outcome = await drainEvidencePurge(batch);
    total.claimed += outcome.claimed;
    total.purged += outcome.purged;
    total.failed += outcome.failed;
    if (outcome.claimed < batch) break;
  }
  return { expired, ...total, ...(await purgeHealth()) };
}
