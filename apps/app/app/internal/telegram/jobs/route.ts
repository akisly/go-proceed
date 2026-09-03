import { z } from "zod";
import { loadTelegramConfig } from "../../../../src/lib/telegram/config";
import { deliverTelegramOutboxBatch } from "../../../../src/lib/telegram/delivery";
import { sameSecret } from "../../../../src/lib/telegram/ingress";
import { processTelegramInboxBatch } from "../../../../src/lib/telegram/processor";
import {
  reconcileTelegramEvidenceDecisionControls,
  recoverTelegramEvidenceDecisionAttempts,
} from "../../../../src/lib/telegram/decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jobRequest = z.object({
  inboxLimit: z.number().int().min(1).max(100).default(10),
  outboxLimit: z.number().int().min(1).max(100).default(10),
}).strict();

function workerBearer(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}

type InboxBatch = { claimed: number; processed: number; failed: number };
type OutboxBatch = { accepted: number; failed: number; unknown: number };
type DecisionMaintenance = {
  controls: { scanned: number; issued: number; skipped: number; failed: number };
  attempts: { claimed: number; completed: number; permanentFailed: number; retried: number; failed: number };
};

/** Run the two independent leased queues before deciding the worker response. */
export async function runTelegramJobs(input: {
  processInbox: () => Promise<InboxBatch>;
  processOutbox: () => Promise<OutboxBatch>;
  processDecisionMaintenance: () => Promise<DecisionMaintenance>;
}): Promise<{ inbox: InboxBatch | null; outbox: OutboxBatch | null; decisionMaintenance: DecisionMaintenance | null;
  inboxFailed: boolean; outboxFailed: boolean; decisionMaintenanceFailed: boolean }> {
  const [inbox, outbox, maintenance] = await Promise.allSettled([
    input.processInbox(), input.processOutbox(), input.processDecisionMaintenance(),
  ]);
  return {
    inbox: inbox.status === "fulfilled" ? inbox.value : null,
    outbox: outbox.status === "fulfilled" ? outbox.value : null,
    decisionMaintenance: maintenance.status === "fulfilled" ? maintenance.value : null,
    inboxFailed: inbox.status === "rejected",
    outboxFailed: outbox.status === "rejected",
    decisionMaintenanceFailed: maintenance.status === "rejected",
  };
}

/** Secret-authenticated worker entry point; it has no member-session surface. */
export async function POST(request: Request): Promise<Response> {
  const config = loadTelegramConfig();
  // Authentication deliberately precedes request-body reads: malformed bodies
  // with a bad secret cannot reveal parser behavior.
  if (!sameSecret(workerBearer(request), config.workerSecret)) {
    return Response.json({ code: "worker_unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "invalid_worker_request" }, { status: 400 });
  }
  const parsed = jobRequest.safeParse(body);
  if (!parsed.success) return Response.json({ code: "invalid_worker_request" }, { status: 400 });

  const jobs = await runTelegramJobs({
    processInbox: () => processTelegramInboxBatch({ workerId: "telegram-jobs", limit: parsed.data.inboxLimit }),
    processOutbox: () => deliverTelegramOutboxBatch({ workerId: "telegram-jobs", limit: parsed.data.outboxLimit }),
    processDecisionMaintenance: async () => ({
      controls: await reconcileTelegramEvidenceDecisionControls(parsed.data.inboxLimit),
      attempts: await recoverTelegramEvidenceDecisionAttempts({
        workerId: "telegram-decision-jobs", limit: parsed.data.inboxLimit,
      }),
    }),
  });
  if (jobs.inboxFailed || jobs.outboxFailed || jobs.decisionMaintenanceFailed
      || jobs.inbox === null || jobs.outbox === null || jobs.decisionMaintenance === null) {
    return Response.json({ code: "worker_processing_failed" }, { status: 500 });
  }
  return Response.json({ inbox: jobs.inbox, outbox: jobs.outbox, decisionMaintenance: jobs.decisionMaintenance });
}
