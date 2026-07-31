export type GovernanceRole = "owner" | "admin" | "member" | "auditor";
export type WorkspaceCapability =
  | "parties.manage" | "own_legal_profiles.manage" | "projects.create" | "units.manage"
  | "requirement_templates.manage";
// v0.1-M2-A adds the execution/evidence action capabilities. evidence.custody is
// in technical/permissions/capabilities.csv but its only operation
// (evidence_links.create) is M3, so it is deliberately absent here: an unused
// capability string is the dead surface the M1 review flagged.
export type ProjectCapability =
  | "project.admin" | "project.view" | "contracts.edit" | "imports.manage" | "imports.publish"
  | "assignments.manage" | "progress.record" | "progress.adjust" | "evidence.record";

const MAP: Record<GovernanceRole, readonly WorkspaceCapability[]> = {
  // INV-020: own_legal_profiles.manage is strictly narrower than parties.manage.
  owner: ["parties.manage", "own_legal_profiles.manage", "projects.create", "units.manage",
          "requirement_templates.manage"],
  admin: ["parties.manage", "projects.create", "units.manage", "requirement_templates.manage"],
  member: [],
  auditor: [],
};

export function workspaceCapabilities(role: GovernanceRole): readonly WorkspaceCapability[] {
  return MAP[role] ?? [];
}
