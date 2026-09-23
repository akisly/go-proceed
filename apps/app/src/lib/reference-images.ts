import { createHash } from "node:crypto";
import { requirementReferenceImage, type RequirementReferenceImage } from "@goproceed/contracts";
import type { Tx } from "@goproceed/database";

export interface ReferenceImageRow {
  reference_image_version_id: string | null;
  reference_image_version_no: number | null;
  reference_image_sha256: string | null;
  reference_image_byte_size: number | null;
  reference_image_mime_type: string | null;
  reference_image_width: number | null;
  reference_image_height: number | null;
  reference_image_alt_text_uk: string | null;
}

export function referenceImageView(row: ReferenceImageRow, occurrenceId: string): RequirementReferenceImage | null {
  if (row.reference_image_version_id === null) return null;
  return requirementReferenceImage.parse({
    imageVersionId: row.reference_image_version_id, versionNo: row.reference_image_version_no,
    sha256: row.reference_image_sha256, byteSize: row.reference_image_byte_size,
    mimeType: row.reference_image_mime_type, width: row.reference_image_width,
    height: row.reference_image_height, altTextUk: row.reference_image_alt_text_uk,
    contentPath: `/v1/occurrences/${occurrenceId}/reference-image`,
  });
}

/**
 * Provisioner and publisher use this same lock before selecting/inserting a version.
 * The latest published illustration is pinned when one exists; before licensed
 * content is provisioned the rule publishes unpinned (owner, 2026-09-23), and the
 * 0095 guard accepts exactly that — null only while the library item has none.
 */
export async function latestReferenceImagePin(tx: Tx, workspaceId: string, libraryItemId: string): Promise<string | null> {
  await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`reference-image|${workspaceId}|${libraryItemId}`]);
  const result = await tx.query<{ id: string }>(
    `select id from public.requirement_reference_image_versions
      where workspace_id = $1 and requirement_library_item_id = $2
      order by version_no desc limit 1`, [workspaceId, libraryItemId]);
  return result.rows[0]?.id ?? null;
}

/** Bound the download before allocation, then verify immutable content before serving it. */
export async function readVerifiedReferenceImage(stream: ReadableStream<Uint8Array>,
  expectedSize: number, expectedHash: string): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isInteger(expectedSize) || expectedSize < 1 || expectedSize > 5 * 1024 * 1024) {
    await stream.cancel();
    throw new Error("reference image has invalid size");
  }
  const bytes = new Uint8Array(expectedSize);
  const reader = stream.getReader();
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > expectedSize) throw new Error("reference image size mismatch");
      bytes.set(value, offset);
      offset += value.byteLength;
    }
    if (offset !== expectedSize || createHash("sha256").update(bytes).digest("hex") !== expectedHash) {
      throw new Error("reference image integrity mismatch");
    }
    return bytes;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
