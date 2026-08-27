export type GovernanceRole = "owner" | "admin" | "member" | "auditor";
// requirement_rules.manage is v0.1-M1 in technical/permissions/capabilities.csv:9
// and governs requirement_rule_versions.publish, .retire and
// requirement_library.list. requirement_templates.manage stays beside it and is
// NOT removed here: it authors the model ADR-005 decision 2 retires, its two
// routes are live, and the removal is scheduled into v0.1-M2 because those routes
// are still the media-policy source the upload gate reads (plan contradiction 3).
export type WorkspaceCapability =
  | "parties.manage" | "own_legal_profiles.manage" | "projects.create" | "units.manage"
  | "requirement_templates.manage" | "requirement_rules.manage" | "project_requirements.manage";
// v0.1-M2-A adds the execution/evidence action capabilities. evidence.custody is
// in technical/permissions/capabilities.csv but its only operation
// (evidence_links.create) is M3, so it is deliberately absent here: an unused
// capability string is the dead surface the M1 review flagged.
// rule_bindings.manage is the third of the three places migration 0041:526-537
// requires to move together; see packages/contracts/src/project-access.ts.
// requirements.assign arrives with requirement_occurrences.dry_run — the one
// operation capabilities.csv:23 names — and with migration 0044, which widens
// the database CHECK. MATERIALISATION IS NOT GOVERNED BY IT and the difference
// is deliberate: capabilities.csv:18 and :23 both claim materialisation, only
// :18 names the command that inserts (assignments.create), and
// responsibility-presets.csv gives project_manager assignments.manage without
// requirements.assign. Following the prose rather than the operation would have
// deadlocked the persona that creates assignments. The RLS policies of 0043
// make the same choice for the same reason.
// v0.1-M3 adds the four the refusal is governed by. They arrive with their six
// routes and with migration 0045 §1, which widens the database CHECK — the third
// of the three places. capabilities.csv:24, :26, :28 and :31 already name each
// one's operations and milestone; nothing here is invented.
//
// stage_closures.bypass and unevidenced_closures.clear are DELIBERATELY ABSENT:
// both are v0.2 in capabilities.csv (ADR-006 decision 4 keeps the bypass out
// because its whole price is package ineligibility and v0.1 has no packages to
// make ineligible), and an unused capability string is the dead surface the M1
// review flagged.
export type ProjectCapability =
  | "project.admin" | "project.view" | "contracts.edit" | "imports.manage" | "imports.publish"
  | "assignments.manage" | "progress.record" | "progress.adjust" | "evidence.record"
  | "rule_bindings.manage" | "requirements.assign"
  | "requirement_exceptions.decide" | "evidence_decisions.decide" | "stage_closures.close"
  | "readiness.view"
  // v0.1-M4 — the third half of the vocabulary migration 0047 §1 widens. The
  // other two are `projectCapability` in @goproceed/contracts and the CHECK on
  // public.project_access_grants; packages/testing/src/capability-vocabulary.test.ts
  // asserts the enum and the constraint enumerate the same set.
  | "statutory_acts.compose"
  // v0.1-M5. capabilities.csv:34 puts occurrence_grants.issue AND
  // external_grants.revoke_reissue behind `packages.submit`; the name is
  // package-shaped and the catalog row states that renaming it is an API change
  // this slice does not own. Migration 0049 §1 is the third place.
  //
  // `external.view_scope` and `external.decide_evidence` (capabilities.csv:37,
  // :39) are DELIBERATELY ABSENT from this union: their plane is `external`,
  // not `project`, and they are carried by the grant's own permission object
  // (`externalGrantPermissions` in @goproceed/contracts), never by a
  // public.project_access_grants row. Putting them here would make an external
  // capability grantable to a member.
  | "packages.submit";

// owner/admin for requirement_rules.manage, matching the RLS policies migration
// 0041:774-776 writes on public.requirement_rule_versions
// (app.member_role(workspace_id) in ('owner','admin')). A route check that was
// laxer than the policy would produce a 500 where a 403 belongs, and one that
// was stricter would deny a write the database would have allowed.
const MAP: Record<GovernanceRole, readonly WorkspaceCapability[]> = {
  // INV-020: own_legal_profiles.manage is strictly narrower than parties.manage.
  owner: ["parties.manage", "own_legal_profiles.manage", "projects.create", "units.manage",
          "requirement_templates.manage", "requirement_rules.manage", "project_requirements.manage"],
  admin: ["parties.manage", "projects.create", "units.manage", "requirement_templates.manage",
          "requirement_rules.manage", "project_requirements.manage"],
  member: [],
  auditor: [],
};

export function workspaceCapabilities(role: GovernanceRole): readonly WorkspaceCapability[] {
  return MAP[role] ?? [];
}
