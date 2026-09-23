import { q } from "./fixtures";
import { EVIDENCE_BUCKET } from "../../src/lib/evidence-storage";

/**
 * Runs `fn` with the evidence bucket's type allow-list (0093, BL-126) lifted,
 * then restores it.
 *
 * The allow-list is the first defence: it refuses a hostile stored type at the
 * PUT. The checks after it — finalization's stored-type match (DEV-032), the
 * signed read's `download=` — are the second, and they still matter for objects
 * stored before 0093 and for any environment where the bucket row lacks it. A
 * test of the second defence has to stage such an object, which the first now
 * refuses; this is how it does, without weakening the bucket for any other test
 * (test files run one at a time, `vitest.config.ts`).
 */
export async function withBucketAcceptingAnyType<T>(fn: () => Promise<T>): Promise<T> {
  const before = await q<{ allowed_mime_types: string[] | null }>(
    "select allowed_mime_types from storage.buckets where id = $1", [EVIDENCE_BUCKET]);
  if (before.length !== 1) throw new Error("the evidence bucket does not exist");
  await q("update storage.buckets set allowed_mime_types = null where id = $1", [EVIDENCE_BUCKET]);
  try {
    return await fn();
  } finally {
    await q("update storage.buckets set allowed_mime_types = $2 where id = $1",
      [EVIDENCE_BUCKET, before[0]!.allowed_mime_types]);
  }
}
