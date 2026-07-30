import { HttpProblem } from "./http";
import { problem } from "@aktflow/contracts";
import type { Tx } from "@aktflow/database";
import {
  workspaceCapabilities,
  type GovernanceRole, type WorkspaceCapability, type ProjectCapability,
} from "@aktflow/domain";

export interface ActiveMembership { memberId: string; role: GovernanceRole }

export async function requireActiveMembership(
  tx: Tx, requestId: string, userId: string, workspaceId: string,
): Promise<ActiveMembership> {
  const r = await tx.query(
    `select id, role from public.memberships
      where organization_id = $1 and user_id = $2 and status = 'active'`,
    [workspaceId, userId]);
  if (r.rows.length === 0) {
    throw new HttpProblem(403, problem("MEMBERSHIP_INACTIVE",
      "Немає активного членства в цьому робочому просторі.",
      { requestId, retryable: false, userAction: "contact_org_admin" }));
  }
  return { memberId: r.rows[0].id, role: r.rows[0].role };
}

export function requireWorkspaceCapability(
  requestId: string, role: GovernanceRole, capability: WorkspaceCapability,
): void {
  if (!workspaceCapabilities(role).includes(capability)) {
    throw new HttpProblem(403, problem("SCOPE_DENIED",
      "Недостатньо прав для цієї дії.",
      { requestId, retryable: false, userAction: "request_scope" }));
  }
}

/**
 * INV-020: editing a party that is one of the workspace's OWN legal entities
 * needs the stricter own_legal_profiles.manage, not ordinary parties.manage.
 * The own party's official name and ЄДРПОУ are frozen into every published
 * contract version, so an admin must not be able to rewrite that identity.
 */
export async function requirePartyEditCapability(
  tx: Tx, requestId: string, role: GovernanceRole, workspaceId: string, partyId: string,
): Promise<void> {
  const own = await tx.query(
    `select 1 from public.own_legal_entity_profiles where workspace_id = $1 and party_id = $2`,
    [workspaceId, partyId]);
  requireWorkspaceCapability(requestId, role,
    own.rows.length > 0 ? "own_legal_profiles.manage" : "parties.manage");
}

export async function requireProjectCapability(
  tx: Tx, requestId: string,
  args: { workspaceId: string; projectId: string; memberId: string; capability: ProjectCapability },
): Promise<void> {
  // Plan decision 6: project.admin implies ONLY project.view; action
  // capabilities (contracts.edit, imports.manage, imports.publish) stay explicit.
  const caps = args.capability === "project.view"
    ? ["project.view", "project.admin"] : [args.capability];
  const r = await tx.query(
    `select 1 from public.project_access_grants
      where workspace_id = $1 and project_id = $2 and member_id = $3
        and capability = any($4::text[])
        and revoked_at is null and valid_from <= now()
        and (valid_until is null or valid_until > now())
      limit 1`,
    [args.workspaceId, args.projectId, args.memberId, caps]);
  if (r.rows.length === 0) {
    throw new HttpProblem(403, problem("SCOPE_PROJECT_DENIED",
      "Немає доступу до цього проєкту.",
      { requestId, retryable: false, userAction: "request_project_scope" }));
  }
}
