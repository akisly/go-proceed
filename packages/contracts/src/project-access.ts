import { z } from "zod";

// The project capability vocabulary lives in THREE places that must agree: this
// enum (what the grant API accepts), ProjectCapability in @goproceed/domain (what
// the routes check), and the check constraint on public.project_access_grants
// (what the database stores). @goproceed/contracts deliberately has no dependency
// beyond zod, so they cannot be derived from one another — instead
// packages/testing/src/capability-vocabulary.test.ts asserts all three match,
// and fails if a future slice extends one and forgets the others. v0.1-M2-A was
// caught by exactly that gap.
// v0.1-M1 (ADR-006 decision 3) adds rule_bindings.manage. Migration 0041:539-546
// widened the database CHECK and 0041:526-537 says in terms that two of the three
// places must move IN THE SAME SLICE — this enum and ProjectCapability in
// @goproceed/domain. They did not, so capability-vocabulary.test.ts has been red
// on the merged tree since 0041 landed; this is the other half of that migration
// arriving late rather than a vocabulary being widened now.
// v0.1-M2 adds requirements.assign, and it is added HERE, in the slice that
// ships requirement_occurrences.dry_run, for the reason migration 0043:976-986
// gives: the capability is named by capabilities.csv:23 as the governor of that
// operation, it is in none of the three places today, and a route that checked
// it would have been unreachable because no grant row carrying it can be
// written. A capability with no route is dead surface; a route with no
// capability is an ungoverned command. They land together. The database CHECK —
// the third place — is widened by migration 0044.
// v0.1-M3 adds the four capabilities the refusal is governed by —
// requirement_exceptions.decide (capabilities.csv:24), evidence_decisions.decide
// (:26), stage_closures.close (:28) and readiness.view (:31). Migration 0045 §1
// widens the database CHECK by the same four and its owed item 1 requires all
// three places to move IN THIS COMMIT, or capability-vocabulary.test.ts goes red
// and no grant row carrying them can be written by a route — which would make
// every M3 command unreachable in the same way rule_bindings.manage was
// unreachable after 0041 landed alone. No value is invented: each is a
// capability_id already in capabilities.csv with milestone v0.1-M3.
export const projectCapability = z.enum([
  "project.admin", "project.view", "contracts.edit", "imports.manage", "imports.publish",
  "assignments.manage", "progress.record", "progress.adjust", "evidence.record",
  "rule_bindings.manage", "requirements.assign",
  "requirement_exceptions.decide", "evidence_decisions.decide", "stage_closures.close",
  "readiness.view",
  // v0.1-M4. capabilities.csv:32 puts ALL FOUR act operations behind this one id
  // — compose, freeze, get and render — so a member who may read an act may also
  // compose one. That is the catalog's shape, not this file's choice; it is
  // recorded as owed in migration 0047 §11 item 6 and is not widened here.
  "statutory_acts.compose",
  // v0.1-M5 adds ONE, and its name is package-shaped on purpose.
  // capabilities.csv:34 governs both member M5 operations —
  // occurrence_grants.issue and external_grants.revoke_reissue — with
  // `packages.submit`, and says in terms why it is not renamed: «the capability
  // name is package-shaped and is left unchanged here because renaming it is an
  // API change owned by technical/openapi/scope-v0.1.csv». Reading the name
  // rather than the row would have invented a capability id, which is the one
  // thing this vocabulary may never do. Migration 0049 §1 widens the database
  // CHECK by the same value in this same commit.
  "packages.submit",
  "communication.reply",
]);
export type ProjectCapabilityValue = z.infer<typeof projectCapability>;

export const grantProjectAccessRequest = z.object({
  memberId: z.string().guid(),
  capabilities: z.array(projectCapability).min(1),
  validUntil: z.string().datetime().optional(),
});
export type GrantProjectAccessRequest = z.infer<typeof grantProjectAccessRequest>;

export interface GrantProjectAccessResponse {
  granted: { capability: string; grantId: string }[];
}

// BL-021 / DEV-043 / ADR-014 decision 1: `project_access.revoke` is addressed
// the way the grant is — by member and capability — because the grant returns
// ids only for the rows it inserted and a project's creator receives none. No
// `validUntil`: a revoke takes effect when it commits, and a dated revoke is not
// part of ADR-014. Revoking `project.view` revokes every grant the member holds
// on the project (the route expands it); the response lists what was revoked.
export const revokeProjectAccessRequest = z.object({
  memberId: z.string().guid(),
  capabilities: z.array(projectCapability).min(1).max(projectCapability.options.length),
}).strict();
export type RevokeProjectAccessRequest = z.infer<typeof revokeProjectAccessRequest>;

export const revokeProjectAccessResponse = z.object({
  revoked: z.array(z.object({ capability: projectCapability, grantId: z.string().guid() }).strict()),
}).strict();
export type RevokeProjectAccessResponse = z.infer<typeof revokeProjectAccessResponse>;

/** 409 `VERSION_CONFLICT` `details`: the requested capabilities the member holds no unrevoked grant of. */
export const projectAccessNotHeldDetails = z.object({
  notHeld: z.array(projectCapability).min(1),
}).strict();

export const responsibilityKind = z.enum([
  "performer", "progress_recorder", "evidence_recorder", "evidence_custodian",
  "requirement_owner", "package_compiler", "internal_verifier", "package_submitter",
  "acceptance_liaison", "commercial_observer",
]);

export const assignResponsibilityRequest = z.object({
  memberId: z.string().guid(),
  responsibility: responsibilityKind,
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});
export type AssignResponsibilityRequest = z.infer<typeof assignResponsibilityRequest>;

export interface AssignResponsibilityResponse {
  assignmentId: string;
  warnings: string[];
}

// BL-015 / DEV-044 / ADR-014 decision 2: `project_responsibilities.end` ends
// every assignment of the (member, responsibility) pair that is live or has not
// started, at the moment of the command — no date is accepted (owner,
// 2026-09-23). Addressed by the pair, as a separation-of-duties warning names it.
export const endResponsibilityRequest = z.object({
  memberId: z.string().guid(),
  responsibility: responsibilityKind,
}).strict();
export type EndResponsibilityRequest = z.infer<typeof endResponsibilityRequest>;

export const endResponsibilityResponse = z.object({
  ended: z.array(z.object({ assignmentId: z.string().guid() }).strict()),
}).strict();
export type EndResponsibilityResponse = z.infer<typeof endResponsibilityResponse>;
