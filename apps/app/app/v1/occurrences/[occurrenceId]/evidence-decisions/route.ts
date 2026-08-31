import { recordEvidenceDecisionRequest } from "@goproceed/contracts";
import { commandRoute } from "../../../../../src/lib/command";
import { recordEvidenceDecision } from "../../../../../src/lib/evidence/record-evidence-decision";

export const runtime = "nodejs";

/** The member route only authenticates/parses the HTTP command. */
export const POST = commandRoute(recordEvidenceDecisionRequest, async (args) =>
  recordEvidenceDecision({
    actorUserId: args.userId,
    requestId: args.requestId,
    occurrenceId: args.params.occurrenceId ?? "",
    body: args.body,
    idempotencyKey: args.idempotencyKey,
    requestHash: args.requestHash,
  }),
);
