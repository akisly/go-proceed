import { z } from "zod";

export const evidenceObjectView = z.object({
  evidenceObjectId: z.string().uuid(),
  mediaType: z.string(),
  byteSize: z.number().int(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  originalFilename: z.string().nullable(),
  originMethod: z.string(),
  captureTimeTrust: z.string(),
  claimedCaptureTime: z.string().nullable(),
  serverReceivedAt: z.string(),
  /**
   * A SHORT-LIVED BEARER CAPABILITY, NOT AN IDENTIFIER.
   * TTL is 60 seconds (`EVIDENCE_URL_TTL_SECONDS`). It is never persisted
   * anywhere by anyone: not in audit, not in the outbox, not in an idempotency
   * body, not in a log. Absent when the object could not be signed, so a
   * client renders «недоступне» rather than a broken image.
   */
  readUrl: z.string().url().optional(),
});

export const assignmentEvidenceResponse = z.object({
  groups: z.array(z.object({
    /**
     * NULL IS A REAL GROUP, NOT A DEFECT. `upload_intents.requirement_occurrence_id`
     * is nullable by design — `uploads.ts` calls the optionality «the fallback's
     * only remaining door», and every capture outside the requirement flow has
     * none. A consumer that drops this group shows an assignment as having no
     * evidence when it has evidence.
     */
    occurrenceId: z.string().uuid().nullable(),
    evidence: z.array(evidenceObjectView),
  })),
});

export type EvidenceObjectView = z.infer<typeof evidenceObjectView>;
export type AssignmentEvidenceResponse = z.infer<typeof assignmentEvidenceResponse>;
