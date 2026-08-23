import { HttpProblem } from "./http";
import { problem } from "@goproceed/contracts";
import type { Tx } from "@goproceed/database";
import {
  workspaceCapabilities,
  type GovernanceRole, type WorkspaceCapability, type ProjectCapability,
} from "@goproceed/domain";

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

/**
 * WHAT `project.admin` IMPLIES, AND WHY THE LIST IS EXACTLY THESE TWO.
 *
 * Plan decision 6: `project.admin` implies the READS and never the actions.
 * `contracts.edit`, `imports.manage`, `imports.publish`, `assignments.manage`,
 * `progress.record`, `stage_closures.close` and the two decide capabilities stay
 * explicit — an admin who can hand out project access is not thereby the person
 * who closes a stage or accepts evidence.
 *
 * `readiness.view` ADDED 2026-08-08 (M3 pre-landing review finding 5, raised to
 * HIGH by the v0.1 final review). Until this date the map named `project.view`
 * alone, so `readiness.get`, `blocked_reasons.get` and `blocked_value.get`
 * demanded a LITERAL `readiness.view` grant while the two policies those routes
 * are written against — `rp_select` and `br_select`, migration
 * 0045:1640-1642 and :1652-1654 — both read
 * `array['readiness.view','project.admin']`, and 0045:1556-1560 states the
 * intention in terms: «project.admin is admitted alongside it so the pilot is
 * not locked out of its own money screen». The route was therefore STRICTER than
 * the database it claimed to match: a project admin holding no hand-issued
 * `readiness.view` was refused the two money reads by the command layer while
 * every policy behind them would have answered. A route laxer than a policy
 * turns a 403 into a 500; a route stricter than a policy denies a read the
 * database would have allowed, and this one denied it to the only persona
 * `responsibility-presets.csv` gives `project.admin` to (`project_manager`).
 *
 * THIS DID NOT CLOSE THE PRESET GAP ON 2026-08-08 AND MUST NOT HAVE BEEN READ
 * AS CLOSING IT THEN — true as written, on that date: `readiness.view` was in
 * no `maps_to_capabilities` column of `technical/permissions/
 * responsibility-presets.csv` (0045 §11 item 2) at all.
 *
 * STALE AS OF 2026-08-17, FLAGGED IN A LATER FIX ROUND rather than silently
 * left to mislead the next reader who trusts a comment over the CSV it
 * names: two presets now carry `readiness.view` — `pto_engineer` (line 13)
 * and `commercial_manager` (line 15) — both added that date, and line 15's
 * own text records that the capability was withheld while the preset's own
 * description already pointed the commercial lead at the money screen it
 * gates. `apps/app/src/services/blocked-value.service.ts`'s header copied
 * this paragraph's claim verbatim without re-checking the CSV and shipped it
 * wrong; that file's fix-round-1 correction carries the current, narrower
 * fact: FOUR OTHER presets — `requirement_owner`, `internal_verifier`,
 * `package_submitter`, `foreman` — grant `project.view` WITHOUT
 * `readiness.view`, and members holding one of those four are who this gap
 * still describes. A member who is not a project admin and not one of the
 * two presets above still needs a hand-issued grant to read the blocked
 * money.
 */
const IMPLIED_BY_PROJECT_ADMIN: readonly ProjectCapability[] = ["project.view", "readiness.view"];

export async function requireProjectCapability(
  tx: Tx, requestId: string,
  args: { workspaceId: string; projectId: string; memberId: string; capability: ProjectCapability },
): Promise<void> {
  const caps: ProjectCapability[] = IMPLIED_BY_PROJECT_ADMIN.includes(args.capability)
    ? [args.capability, "project.admin"] : [args.capability];
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
