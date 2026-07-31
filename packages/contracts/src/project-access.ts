import { z } from "zod";

export const projectCapability = z.enum([
  "project.admin", "project.view", "contracts.edit", "imports.manage", "imports.publish",
]);
export type ProjectCapabilityValue = z.infer<typeof projectCapability>;

export const grantProjectAccessRequest = z.object({
  memberId: z.string().uuid(),
  capabilities: z.array(projectCapability).min(1),
  validUntil: z.string().datetime().optional(),
});
export type GrantProjectAccessRequest = z.infer<typeof grantProjectAccessRequest>;

export interface GrantProjectAccessResponse {
  granted: { capability: string; grantId: string }[];
}

export const responsibilityKind = z.enum([
  "performer", "progress_recorder", "evidence_recorder", "evidence_custodian",
  "requirement_owner", "package_compiler", "internal_verifier", "package_submitter",
  "acceptance_liaison", "commercial_observer",
]);

export const assignResponsibilityRequest = z.object({
  memberId: z.string().uuid(),
  responsibility: responsibilityKind,
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});
export type AssignResponsibilityRequest = z.infer<typeof assignResponsibilityRequest>;

export interface AssignResponsibilityResponse {
  assignmentId: string;
  warnings: string[];
}
