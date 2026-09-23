import type { CreateUploadIntentRequest } from "@goproceed/contracts";
import type { VaultItem } from "../vault";

export type CaptureInput = Pick<VaultItem,
  "id" | "occurrenceId" | "sha256" | "byteSize" | "mimeType" | "originMethod"
  | "claimedCaptureTime" | "sourceAppVersion"
>;

/** Only committed, immutable vault metadata enters an idempotent request. */
export function buildCreateIntentBody(input: CaptureInput): CreateUploadIntentRequest {
  return {
    requirementOccurrenceId: input.occurrenceId,
    expectedContentHash: input.sha256,
    expectedByteSize: input.byteSize,
    claimedMediaType: input.mimeType,
    deviceCaptureId: input.id,
    originMethod: input.originMethod,
    claimedCaptureTime: input.claimedCaptureTime,
    sourceAppVersion: input.sourceAppVersion,
  };
}
