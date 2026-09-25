import { z } from "zod";

/**
 * FIX ROUND 1: matched to `externalEvidenceItem`'s strictness
 * (`packages/contracts/src/external.ts:313-323` — the schema itself; the
 * previously cited `:299-308` lands on the prose above it, so the one
 * comparison this comment asks the reader to make could not be made there),
 * the same object field-for-
 * field minus `readUrl` — this route's screen must render a trust badge from
 * `captureTimeTrust`, and as a bare `string` an exhaustive switch over it is
 * impossible; `byteSize` as a bare `.int()` admitted 0 and negatives, which
 * `evidence_objects`' own `CHECK (byte_size > 0)` (migration 0015) forbids.
 * This was the brief's own defect (its Step 1 code showed the loose form) and
 * is fixed here rather than deferred, the same instruction the brief was
 * itself corrected under.
 */
export const evidenceObjectView = z.object({
  evidenceObjectId: z.string().guid(),
  mediaType: z.string().min(1),
  byteSize: z.number().int().positive(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  originalFilename: z.string().nullable(),
  originMethod: z.string().min(1),
  captureTimeTrust: z.enum(["device_claimed", "server_estimated", "unknown"]),
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
}).strict();

export const assignmentEvidenceResponse = z.object({
  /**
   * The assignment's workspace's stored presentation zone
   * (`organizations.timezone`), verbatim and NOT validated (DEV-089, BL-034):
   * creation accepts any string (BL-206), and a refine here would turn one bad
   * stored value into a failed read of every photo and signed URL. The screen
   * formats `serverReceivedAt` and a link's expiry in it, falling back when
   * the runtime does not recognise it (`apps/app/src/lib/workspace-time.ts`).
   * Named for the workspace, not `timezone`: `technical/openapi.yaml` already
   * describes a project `timezone` the schema does not have.
   */
  workspaceTimezone: z.string().min(1),
  groups: z.array(z.object({
    /**
     * NULL IS A REAL GROUP, NOT A DEFECT. `upload_intents.requirement_occurrence_id`
     * is nullable by design — `uploads.ts` calls the optionality «the fallback's
     * only remaining door», and every capture outside the requirement flow has
     * none. A consumer that drops this group shows an assignment as having no
     * evidence when it has evidence.
     */
    occurrenceId: z.string().guid().nullable(),
    evidence: z.array(evidenceObjectView),
  }).strict()),
}).strict();

export type EvidenceObjectView = z.infer<typeof evidenceObjectView>;
export type AssignmentEvidenceResponse = z.infer<typeof assignmentEvidenceResponse>;
