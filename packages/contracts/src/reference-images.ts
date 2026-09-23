import { z } from "zod";
import { listRequirementOccurrencesResponse, requirementOccurrenceView } from "./requirement-occurrences";

/** Immutable product illustration, not evidence or a normative citation. */
export const requirementReferenceImage = z.object({
  imageVersionId: z.string().guid(),
  versionNo: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteSize: z.number().int().positive().max(5 * 1024 * 1024),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  width: z.number().int().positive().max(8192),
  height: z.number().int().positive().max(8192),
  altTextUk: z.string().trim().min(1).max(500),
  /** Authenticated BFF path; never a provider URL or storage key. */
  contentPath: z.string().regex(/^\/v1\/occurrences\/[a-f0-9-]{36}\/reference-image$/),
}).strict();
export type RequirementReferenceImage = z.infer<typeof requirementReferenceImage>;

export const requirementOccurrenceWithReferenceImageView = requirementOccurrenceView.extend({
  referenceImage: requirementReferenceImage.nullable(),
}).strict();
export type RequirementOccurrenceWithReferenceImageView =
  z.infer<typeof requirementOccurrenceWithReferenceImageView>;

/** Only selected by ?referenceImages=v1. The default strict schema stays unchanged. */
export const listRequirementOccurrencesWithReferenceImagesResponse =
  listRequirementOccurrencesResponse.extend({
    workspaceId: z.string().guid(),
    /** Current member's evidence.record authorization; not an offline grant. */
    captureAllowed: z.boolean(),
    occurrences: z.array(requirementOccurrenceWithReferenceImageView),
  }).strict();
export type ListRequirementOccurrencesWithReferenceImagesResponse =
  z.infer<typeof listRequirementOccurrencesWithReferenceImagesResponse>;
