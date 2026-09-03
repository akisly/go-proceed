import { createUploadIntentRequest } from "@goproceed/contracts";
import { commandRoute } from "../../../../../src/lib/command";
import { authorizeUploadIntent } from "../../../../../src/lib/evidence/authorize-upload-intent";

export const runtime = "nodejs";

export const POST = commandRoute(createUploadIntentRequest, (a) =>
  authorizeUploadIntent({
    actorUserId: a.userId,
    requestId: a.requestId,
    assignmentId: a.params.assignmentId ?? "",
    body: a.body,
    idempotencyKey: a.idempotencyKey,
    requestHash: a.requestHash,
  }));
