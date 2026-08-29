import { finalizeUploadIntentRequest } from "@goproceed/contracts";
import { commandRoute } from "../../../../../src/lib/command";
import { finalizeUploadIntent } from "../../../../../src/lib/evidence/finalize-upload-intent";

export const runtime = "nodejs";

export const POST = commandRoute(finalizeUploadIntentRequest, (a) =>
  finalizeUploadIntent({
    actorUserId: a.userId,
    requestId: a.requestId,
    intentId: a.params.intentId ?? "",
  }));
