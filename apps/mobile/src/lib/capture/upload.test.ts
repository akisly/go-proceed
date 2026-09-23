import { describe, expect, it } from "vitest";
import { buildCreateIntentBody, type CaptureInput } from "./upload";

const input: CaptureInput = {
  id: "capture-1", occurrenceId: "occurrence-1", sha256: "b".repeat(64),
  byteSize: 123, mimeType: "image/jpeg", originMethod: "native_camera",
  claimedCaptureTime: "2026-09-22T12:00:00.000Z", sourceAppVersion: "1.0.0",
};

describe("native upload request", () => {
  it("replays the same immutable body without grants or local file paths", () => {
    const body = buildCreateIntentBody(input);
    expect(body).toEqual({
      requirementOccurrenceId: "occurrence-1", expectedContentHash: "b".repeat(64),
      expectedByteSize: 123, claimedMediaType: "image/jpeg", deviceCaptureId: "capture-1",
      originMethod: "native_camera", claimedCaptureTime: input.claimedCaptureTime,
      sourceAppVersion: "1.0.0",
    });
    expect(JSON.stringify(buildCreateIntentBody({ ...input }))).toBe(JSON.stringify(body));
  });

  it("keeps gallery provenance distinct from a camera capture", () => {
    expect(buildCreateIntentBody({ ...input, originMethod: "photo_picker" }).originMethod)
      .toBe("photo_picker");
  });
});
