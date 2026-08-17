import { describe, it, expect } from "vitest";
import { createUploadIntentRequest } from "./uploads";

const base = {
  expectedContentHash: "a".repeat(64),
  expectedByteSize: 1024,
  claimedMediaType: "image/jpeg",
  deviceCaptureId: "11111111-1111-4111-8111-111111111111",
};

describe("origin method — ADR-007 decision 5 and INV-086", () => {
  it("admits origin_not_distinguished, which is the only value the PWA may send", () => {
    const r = createUploadIntentRequest.safeParse({
      ...base, originMethod: "origin_not_distinguished",
    });
    expect(r.success).toBe(true);
  });

  it("still admits the four native values, so no existing caller breaks", () => {
    for (const v of ["native_camera", "photo_picker", "file_picker", "form"]) {
      expect(createUploadIntentRequest.safeParse({ ...base, originMethod: v }).success,
        v).toBe(true);
    }
  });

  it("refuses a value the database CHECK would refuse", () => {
    expect(createUploadIntentRequest.safeParse({
      ...base, originMethod: "camera",
    }).success).toBe(false);
  });
});
