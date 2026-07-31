import { z } from "zod";

export const createUploadIntentRequest = z.object({
  expectedContentHash: z.string().regex(/^[0-9a-f]{64}$/),
  expectedByteSize: z.number().int().positive(),
  claimedMediaType: z.string().regex(/^[a-z]+\/[a-z0-9.+-]+$/),
  originalFilename: z.string().max(255).optional(),
  deviceCaptureId: z.string().trim().min(1).max(200),
  originMethod: z.enum(["native_camera", "photo_picker", "file_picker", "form"]),
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
