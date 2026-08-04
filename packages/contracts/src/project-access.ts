import { z } from "zod";

// The project capability vocabulary lives in THREE places that must agree: this
// enum (what the grant API accepts), ProjectCapability in @goproceed/domain (what
// the routes check), and the check constraint on public.project_access_grants
// (what the database stores). @goproceed/contracts deliberately has no dependency
// beyond zod, so they cannot be derived from one another — instead
// packages/testing/src/capability-vocabulary.test.ts asserts all three match,
// and fails if a future slice extends one and forgets the others. v0.1-M2-A was
// caught by exactly that gap.
export const projectCapability = z.enum([
  "project.admin", "project.view", "contracts.edit", "imports.manage", "imports.publish",
  "assignments.manage", "progress.record", "progress.adjust", "evidence.record",
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
