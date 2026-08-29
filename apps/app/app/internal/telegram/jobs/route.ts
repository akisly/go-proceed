import { z } from "zod";
import { loadTelegramConfig } from "../../../../src/lib/telegram/config";
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

  let inbox: { claimed: number; processed: number; failed: number };
  try {
    inbox = await processTelegramInboxBatch({ workerId: "telegram-jobs", limit: parsed.data.inboxLimit });
  } catch {
    return Response.json({ code: "worker_processing_failed" }, { status: 500 });
  }
  // Outbox delivery enters in Task 7. Keep the bounded input and safe count
  // contract now so scheduler wiring does not need a shape change later.
  return Response.json({ inbox, outbox: { claimed: 0, processed: 0, failed: 0 } });
}
