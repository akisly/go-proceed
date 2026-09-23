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
  /**
   * Rows another worker took over while this one held them (its claim aged
   * past the hour and was reclaimed with a new token, DEV-037). Neither purged
   * nor failed by this worker: the new holder finishes them.
   */
  superseded: number;
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

/** Each transaction carries the run's request id, so app.request_id matches the route's log line (R1-08). */
type RunContext = { requestId: string };
const fresh = (): RunContext => ({ requestId: randomUUID() });

/** Marks intents whose authorization window closed without a finalize. */
export async function expireUploadIntents(run: RunContext = fresh()): Promise<number> {
  return withPurgeWorkerTx(run, async (tx) => {
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
 *
 * `deadline` is checked before every row, not only between batches (R1-02): a
 * row not started keeps its claim untouched — no attempt spent — and the
 * one-hour window hands it to a later run, so a slow Storage cannot push the
 * run past the platform's limit mid-batch and lose its counts.
 */
export async function drainEvidencePurge(batch = 50, opts: {
  deadline?: number; now?: () => number; run?: RunContext;
} = {}): Promise<PurgeOutcome> {
  const now = opts.now ?? Date.now;
  const run = opts.run ?? fresh();
  const claimed = await withPurgeWorkerTx(run, async (tx) => (await tx.query<{
    upload_intent_id: string; workspace_id: string;
    storage_bucket: string | null; storage_key: string | null; claim_token: string;
  }>("select * from app.claim_upload_purge($1)", [batch])).rows);

  let purged = 0;
  let failed = 0;
  let superseded = 0;
  // Every outcome is fenced by the claim's token (0091): a worker whose claim
  // was reclaimed while it stalled can neither mark the row purged nor spend
  // the new holder's retry budget.
  for (const row of claimed) {
    if (opts.deadline !== undefined && now() >= opts.deadline) break;
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
      const outcome = await finish(run, "select app.fail_upload_purge($1,$2,$3) as ok",
        [row.upload_intent_id, row.claim_token, (e as Error).message.slice(0, 500)]);
      if (outcome === "applied") failed += 1;
      else if (outcome === "superseded") superseded += 1;
      else failed += 1;
      continue;
    }
    const outcome = await finish(run, "select app.complete_upload_purge($1,$2) as ok",
      [row.upload_intent_id, row.claim_token]);
    if (outcome === "applied") purged += 1;
    else if (outcome === "superseded") superseded += 1;
    else failed += 1;
  }
  return { claimed: claimed.length, purged, failed, superseded };
}

/**
 * Records one row's outcome. A finish that throws (the database refused, or
 * went away) is logged and reported as "error" instead of aborting the run
 * (R1-02): the row keeps its claim for the one-hour window, and the rows after
 * it are still processed. The log line names the intent id only — no key.
 */
async function finish(run: RunContext, sql: string, params: unknown[]):
    Promise<"applied" | "superseded" | "error"> {
  try {
    const ok = await withPurgeWorkerTx(run, async (tx) =>
      (await tx.query<{ ok: boolean }>(sql, params)).rows[0]?.ok === true);
    return ok ? "applied" : "superseded";
  } catch (err) {
    console.error("[EVIDENCE_PURGE]", run.requestId, "could not record a row's outcome",
      { uploadIntentId: params[0], error: (err as Error).name });
    return "error";
  }
}

/** Counts only; what the runner alerts on (INV-047 «repeated failure alerts»). */
export async function purgeHealth(run: RunContext = fresh()): Promise<PurgeHealth> {
  return withPurgeWorkerTx(run, async (tx) => {
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
  batch?: number; maxBatches?: number; budgetMs?: number; now?: () => number; requestId?: string;
} = {}): Promise<PurgeRun> {
  const run: RunContext = { requestId: opts.requestId ?? randomUUID() };
  const batch = opts.batch ?? 50;
  const maxBatches = opts.maxBatches ?? 20;
  const now = opts.now ?? Date.now;
  const deadline = now() + (opts.budgetMs ?? 40_000);

  const expired = await expireUploadIntents(run);
  const total: PurgeOutcome = { claimed: 0, purged: 0, failed: 0, superseded: 0 };
  for (let i = 0; i < maxBatches && now() < deadline; i++) {
    const outcome = await drainEvidencePurge(batch, { deadline, now, run });
    total.claimed += outcome.claimed;
    total.purged += outcome.purged;
    total.failed += outcome.failed;
    total.superseded += outcome.superseded;
    if (outcome.claimed < batch || now() >= deadline) break;
  }
  return { expired, ...total, ...(await purgeHealth(run)) };
}
