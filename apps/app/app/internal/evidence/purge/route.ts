import { runEvidencePurge } from "../../../../src/lib/evidence-purge";
import { bearerToken, sameSecret } from "../../../../src/lib/worker-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel ends the function at maxDuration. Sixty seconds is within every plan's
// ceiling with or without Fluid compute (Hobby: 300 s with it, 60 s without;
// https://vercel.com/docs/functions/configuring-functions/duration, 2026-08-24).
// The run's own budget stops claiming well before it.
export const maxDuration = 60;
const RUN_BUDGET_MS = 40_000;

/** Vercel recommends at least 16 characters; the worker secrets here take 32. */
const MIN_SECRET_LENGTH = 32;

const unauthorized = () => Response.json({ code: "worker_unauthorized" }, { status: 401 });

/**
 * The evidence purge's runner (INV-047; DEV-036, BL-030).
 *
 * Vercel Cron calls this four times a day (`apps/app/vercel.json`): the
 * owner's decision on Q-12 for the purge, 2026-09-23, on the Hobby plan, where
 * each expression may run once a day and lands anywhere in its hour. Vercel
 * sends `Authorization: Bearer $CRON_SECRET` when that variable is set, never
 * retries a failed run, and may deliver a run twice or not at all
 * (https://vercel.com/docs/cron-jobs/manage-cron-jobs, 2026-08-11) — the purge
 * is idempotent and a missed run is caught by the next.
 *
 * Authentication comes first, and a missing or short CRON_SECRET refuses
 * everyone rather than comparing against it: an unset secret must never mean
 * an open door.
 *
 * The status is the alert. 500 `purge_attention_required` when a row failed
 * this run, a row's retry budget is spent, or a row has waited past INV-047's
 * 24 hours — and it stays 500 until someone acts, because an exhausted row is
 * never claimed again. The log line and the body carry counts and a request id,
 * never a key (`files-and-storage.md` §Downloads).
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH) {
    console.error("[EVIDENCE_PURGE] CRON_SECRET is not configured (32+ characters); refusing");
    return unauthorized();
  }
  if (!sameSecret(bearerToken(request), secret)) return unauthorized();

  const requestId = crypto.randomUUID();
  let run;
  try {
    run = await runEvidencePurge({ budgetMs: RUN_BUDGET_MS });
  } catch (err) {
    // A database or Storage outage, or a misconfigured PURGE_DB_URL. The purge
    // worker's own errors name no key (EvidenceStorageError, DEV-034).
    console.error("[EVIDENCE_PURGE]", requestId, "run failed", err);
    return Response.json({ code: "purge_failed", requestId },
      { status: 500, headers: { "cache-control": "no-store" } });
  }
  const counts = {
    expired: run.expired, claimed: run.claimed, purged: run.purged, failed: run.failed,
    superseded: run.superseded, exhausted: run.exhausted, overdue: run.overdue,
  };
  if (run.failed + run.exhausted + run.overdue > 0) {
    console.error("[EVIDENCE_PURGE]", requestId, "attention required", counts);
    return Response.json({ code: "purge_attention_required", requestId, ...counts },
      { status: 500, headers: { "cache-control": "no-store" } });
  }
  return Response.json({ requestId, ...counts }, { headers: { "cache-control": "no-store" } });
}
