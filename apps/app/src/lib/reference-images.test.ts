import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Tx } from "@goproceed/database";
import { latestReferenceImagePin, readVerifiedReferenceImage, referenceImageView } from "./reference-images";

function bytesStream(chunks: number[][]) {
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (const part of chunks) controller.enqueue(new Uint8Array(part));
    controller.close();
  } });
}
describe("reference images: immutable content and publication", () => {
  it("buffers only the declared bounded size and verifies the pinned digest", async () => {
    const hash = createHash("sha256").update(new Uint8Array([1, 2, 3])).digest("hex");
    expect(await readVerifiedReferenceImage(bytesStream([[1], [2, 3]]), 3, hash)).toEqual(new Uint8Array([1, 2, 3]));
    await expect(readVerifiedReferenceImage(bytesStream([[1, 2]]), 3, hash)).rejects.toThrow("integrity");
    await expect(readVerifiedReferenceImage(bytesStream([[1, 2, 3, 4]]), 3, hash)).rejects.toThrow("size");
    await expect(readVerifiedReferenceImage(bytesStream([[1, 2, 4]]), 3, hash)).rejects.toThrow("integrity");
    await expect(readVerifiedReferenceImage(bytesStream([]), 6 * 1024 * 1024, hash)).rejects.toThrow("invalid size");
  });
  it("preserves legacy null and refuses incomplete non-null descriptors", () => {
    const row = { reference_image_version_id: null, reference_image_version_no: null,
      reference_image_sha256: null, reference_image_byte_size: null, reference_image_mime_type: null,
      reference_image_width: null, reference_image_height: null, reference_image_alt_text_uk: null };
    expect(referenceImageView(row, "11111111-1111-4111-8111-111111111111")).toBeNull();
    expect(() => referenceImageView({ ...row, reference_image_version_id: "11111111-1111-4111-8111-111111111111" },
      "22222222-2222-4222-8222-222222222222")).toThrow();
  });
  it("locks the library item before selecting its latest published version", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: "pinned" }] });
    expect(await latestReferenceImagePin({ query } as unknown as Tx, "workspace", "item")).toBe("pinned");
    expect(query.mock.calls[0]![1]).toEqual(["reference-image|workspace|item"]);
    expect(query.mock.calls[1]![0]).toContain("order by version_no desc");
  });
  it("publishes unpinned while the library item has no published image", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    expect(await latestReferenceImagePin({ query } as unknown as Tx, "workspace", "item")).toBeNull();
    expect(query).toHaveBeenCalledTimes(2); // still takes the lock the provisioner takes
  });
});
