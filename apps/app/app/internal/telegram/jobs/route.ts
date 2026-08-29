import { z } from "zod";
import { loadTelegramConfig } from "../../../../src/lib/telegram/config";
import { deliverTelegramOutboxBatch } from "../../../../src/lib/telegram/delivery";
import { sameSecret } from "../../../../src/lib/telegram/ingress";
import { processTelegramInboxBatch } from "../../../../src/lib/telegram/processor";

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

/** Run the two independent leased queues before deciding the worker response. */
export async function runTelegramJobs(input: {
  processInbox: () => Promise<InboxBatch>;
  processOutbox: () => Promise<OutboxBatch>;
}): Promise<{ inbox: InboxBatch | null; outbox: OutboxBatch | null; inboxFailed: boolean; outboxFailed: boolean }> {
  const [inbox, outbox] = await Promise.allSettled([input.processInbox(), input.processOutbox()]);
  return {
    inbox: inbox.status === "fulfilled" ? inbox.value : null,
    outbox: outbox.status === "fulfilled" ? outbox.value : null,
    inboxFailed: inbox.status === "rejected",
    outboxFailed: outbox.status === "rejected",
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
  });
  if (jobs.inboxFailed || jobs.outboxFailed || jobs.inbox === null || jobs.outbox === null) {
    return Response.json({ code: "worker_processing_failed" }, { status: 500 });
  }
  return Response.json({ inbox: jobs.inbox, outbox: jobs.outbox });
}
