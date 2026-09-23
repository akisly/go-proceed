import { describe, expect, it } from "vitest";
import { storageIdentity, validateManifest } from "../../../scripts/reference-image-manifest.mjs";
const entry = { sourceStandard: "test-standard", positionCode: "test-position", itemNo: 1, versionNo: 1,
  file: "licensed-example.jpg", sha256: "a".repeat(64), byteSize: 100,
  mimeType: "image/jpeg", width: 100, height: 100, altTextUk: "Приклад ракурсу",
  rightsHolder: "test only", license: "test only", sourceUri: "https://example.com/test-only" };
describe("reference manifest", () => {
  it("requires explicit provenance and refuses active or oversized content", () => {
    expect(validateManifest({ schemaVersion: 1, images: [entry] }).images).toHaveLength(1);
    for (const changed of [{ license: "" }, { rightsHolder: "" }, { sourceUri: "javascript:alert(1)" },
      { mimeType: "image/svg+xml" }, { width: 8192, height: 8192 }, { storageKey: "chosen/key" }]) {
      expect(() => validateManifest({ schemaVersion: 1, images: [{ ...entry, ...changed }] })).toThrow();
    }
    expect(() => validateManifest({ schemaVersion: 1, images: [entry, entry] })).toThrow("Duplicate");
  });
  it("creates stable opaque keys separated by workspace and version", () => {
    const first = storageIdentity("workspace-a", "item", 1);
    expect(storageIdentity("workspace-a", "item", 1)).toEqual(first);
    expect(storageIdentity("workspace-b", "item", 1)).not.toEqual(first);
    expect(storageIdentity("workspace-a", "item", 2)).not.toEqual(first);
    expect(first.key).not.toContain("workspace");
  });
});
