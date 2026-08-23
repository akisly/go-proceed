import { z } from "zod";

export const createUploadIntentRequest = z.object({
  /**
   * The obligation this original is being captured against — and, from v0.1-M2,
   * the AUTHORITY on what may be uploaded.
   *
   * The media policy used to come from the template pinned to the assignment
   * (ADR-005 decision 2 retires that pin). It now comes from the occurrence's
   * pinned rule version, which is what makes the gate specific to the
   * requirement instead of specific to the assignment. `upload_intents_
   * occurrence_fkey` (migration 0043 §5) refuses an occurrence belonging to a
   * different assignment, so naming one here cannot borrow another assignment's
   * policy.
   *
   * OPTIONAL, AND THE OPTIONALITY IS THE FALLBACK'S ONLY REMAINING DOOR. An
   * intent with no occurrence is legal — the column is nullable and in v0.1 that
   * is every intent captured outside the requirement flow — and it gets
   * `FALLBACK_MEDIA`. Making it required would have been the stricter contract
   * and it would have broken every deployed caller on the day the occurrence set
   * is still empty; see the route for why that set is still empty.
   */
  requirementOccurrenceId: z.string().guid().optional(),
  expectedContentHash: z.string().regex(/^[0-9a-f]{64}$/),
  expectedByteSize: z.number().int().positive(),
  claimedMediaType: z.string().regex(/^[a-z]+\/[a-z0-9.+-]+$/),
  originalFilename: z.string().max(255).optional(),
  deviceCaptureId: z.string().trim().min(1).max(200),
  /**
   * ADDED 2026-08-10: `origin_not_distinguished`, the value ADR-007 decision 5
   * requires and INV-086 makes a P0.
   *
   * THE DATABASE HAS ADMITTED IT SINCE MIGRATION 0043 and this enum has not, so
   * until now no PWA capture was recordable at all — the browser page had no
   * value it was permitted to send. A browser has no camera-session identity and
   * may be handed transcoded bytes, so the origin cannot be established; the
   * vocabulary says that rather than asserting a camera.
   *
   * THE FOUR NATIVE VALUES ARE NOT REMOVED. They are the native client's, and
   * `apps/mobile` stays in the tree for v0.3 (ADR-007 decision 2). What is
   * forbidden is the PWA SENDING one, which is a test in
   * apps/app/tests/field-capture.int.test.ts and not a narrowing here.
   */
  originMethod: z.enum([
    "native_camera", "photo_picker", "file_picker", "form",
    "origin_not_distinguished",
  ]),
  claimedCaptureTime: z.string().datetime({ offset: true }).optional(),
  claimedTzOffset: z.string().regex(/^[+-]\d{2}:\d{2}$/).optional(),
  sourceAppVersion: z.string().max(50).optional(),
}).strict();
export type CreateUploadIntentRequest = z.infer<typeof createUploadIntentRequest>;

/**
 * What the idempotency record stores. Deliberately without the signed upload
 * URL: the record lives for 30 days and the grant for minutes, so persisting it
 * would guarantee a replay handed back a dead link.
 */
export interface UploadIntentReceipt {
  uploadIntentId: string;
  /** Carried so a replay can re-check state and authorization before granting. */
  workspaceId: string;
  status: string;
  expiresAt: string;
  storage: { bucket: string; key: string };
}

/** What the caller gets — the receipt plus a grant minted for this call. */
export interface CreateUploadIntentResponse extends UploadIntentReceipt {
  upload: { signedUrl: string; token: string };
}

export const finalizeUploadIntentRequest = z.object({}).strict();

export interface FinalizeUploadIntentResponse {
  uploadIntentId: string;
  status: string;
  evidenceObjectId: string | null;
  contentHash: string | null;
  serverReceivedAt: string | null;
  failureCode: string | null;
}

export interface GetUploadIntentResponse {
  uploadIntentId: string;
  status: string;
  evidenceObjectId: string | null;
  contentHash: string | null;
  byteSize: number | null;
  serverReceivedAt: string | null;
  failureCode: string | null;
  expiresAt: string;
}
