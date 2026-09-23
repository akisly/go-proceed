import { describe, expect, it } from "vitest";
import { requirementReferenceImage, listRequirementOccurrencesWithReferenceImagesResponse } from "./reference-images";
import { listRequirementOccurrencesResponse } from "./requirement-occurrences";

const image = {
  imageVersionId: "11111111-1111-4111-8111-111111111111", versionNo: 1,
  sha256: "a".repeat(64), byteSize: 1234, mimeType: "image/jpeg",
  width: 640, height: 480, altTextUk: "Приклад ракурсу фотографії",
  contentPath: "/v1/occurrences/22222222-2222-4222-8222-222222222222/reference-image",
};
const occurrence = {
  occurrenceId: "22222222-2222-4222-8222-222222222222",
  workAssignmentId: "33333333-3333-4333-8333-333333333333",
  ruleVersionId: "44444444-4444-4444-8444-444444444444", ordinal: 1,
  stage: { stageId: null, stageKey: "finish", isConcealed: null },
  interventionType: "hold", blockingScope: "blocks_stage_closure", timing: "after",
  evidenceKind: "photo", acceptanceCriterion: "Сфотографуйте роботу",
  performerRole: "foreman", approverRole: "supervisor", approverIsExternal: false,
  minEvidenceCount: 1, maxEvidenceCount: null, allowedMedia: null, normRef: null,
  materialisedAt: "2026-09-22T00:00:00.000Z",
};
const response = { workAssignmentId: occurrence.workAssignmentId,
  contractVersionId: "55555555-5555-4555-8555-555555555555", coverage: "covered",
  occurrences: [occurrence] };

describe("DEV-041 reference image opt-in", () => {
  it("keeps the strict legacy shape unchanged", () => {
    expect(listRequirementOccurrencesResponse.safeParse(response).success).toBe(true);
    expect(listRequirementOccurrencesResponse.safeParse({ ...response,
      occurrences: [{ ...occurrence, referenceImage: image }] }).success).toBe(false);
  });
  it("requires an explicit nullable pin only on the opted-in shape", () => {
    expect(listRequirementOccurrencesWithReferenceImagesResponse.safeParse(response).success).toBe(false);
    for (const referenceImage of [null, image]) {
      expect(listRequirementOccurrencesWithReferenceImagesResponse.safeParse({ ...response,
        workspaceId: "66666666-6666-4666-8666-666666666666", captureAllowed: true,
        occurrences: [{ ...occurrence, referenceImage }] }).success).toBe(true);
    }
  });
  it("never accepts a storage URL, raw key, active content or blank description", () => {
    for (const changed of [
      { contentPath: "https://storage.example/private.jpg" }, { storageKey: "secret/key" },
      { mimeType: "image/svg+xml" }, { altTextUk: " " }, { sha256: "wrong" },
      { byteSize: 5 * 1024 * 1024 + 1 },
    ]) expect(requirementReferenceImage.safeParse({ ...image, ...changed }).success).toBe(false);
  });
});
