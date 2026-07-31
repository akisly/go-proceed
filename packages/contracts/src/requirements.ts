import { z } from "zod";

/**
 * v0.1-M2-A freezes only what assignment pinning and the upload media gate
 * read. The M3 fields exist as columns but accept nothing here: rejecting them
 * loudly beats accepting and ignoring them, which would make a frozen template
 * hash a lie about what was actually agreed.
 */
export const createRequirementTemplateRequest = z.object({
  templateKey: z.string().trim().min(1).max(200),
  evidenceType: z.enum(["photo", "document", "form"]),
  allowedMedia: z.object({
    mimeTypes: z.array(z.string().regex(/^[a-z]+\/[a-z0-9.+-]+$/)).min(1).max(20),
    maxByteSize: z.number().int().positive().max(50 * 1024 * 1024),
  }).strict(),
  multiplicity: z.object({
    min: z.number().int().min(0).default(1),
    max: z.number().int().positive().nullable().default(null),
  }).strict().default({}),
  severity: z.enum(["blocking", "advisory"]).default("blocking"),
}).strict();
export type CreateRequirementTemplateRequest = z.infer<typeof createRequirementTemplateRequest>;

export interface CreateRequirementTemplateResponse {
  templateVersionId: string;
  versionNo: number;
  version: number;
}

export const publishRequirementTemplateRequest = z.object({}).strict();

export interface PublishRequirementTemplateResponse {
  templateVersionId: string;
  templateHash: string;
  versionNo: number;
}
