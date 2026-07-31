export type GovernanceRole = "owner" | "admin" | "member" | "auditor";
export type WorkspaceCapability =
  | "parties.manage" | "own_legal_profiles.manage" | "projects.create" | "units.manage";
export type ProjectCapability =
  | "project.admin" | "project.view" | "contracts.edit" | "imports.manage" | "imports.publish";

const MAP: Record<GovernanceRole, readonly WorkspaceCapability[]> = {
  // INV-020: own_legal_profiles.manage is strictly narrower than parties.manage.
  owner: ["parties.manage", "own_legal_profiles.manage", "projects.create", "units.manage"],
  admin: ["parties.manage", "projects.create", "units.manage"],
  member: [],
  auditor: [],
};

export function workspaceCapabilities(role: GovernanceRole): readonly WorkspaceCapability[] {
  return MAP[role] ?? [];
}
