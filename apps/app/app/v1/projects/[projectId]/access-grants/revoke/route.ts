import { commandRoute } from "../../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../../src/lib/http";
import {
  projectAccessNotHeldDetails, revokeProjectAccessRequest, revokeProjectAccessResponse,
  type RevokeProjectAccessResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";
import { projectAccessMemberLock } from "../../../../../../src/lib/project-access-lock";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LockedGrant = {
  id: string; member_id: string; capability: string; member_active: boolean; live: boolean; undated: boolean;
};

/**
 * `project_access.revoke` — POST /v1/projects/{projectId}/access-grants/revoke
 * (ADR-014 decision 1, DEV-043, BL-021).
 *
 * `revoked_at` was honoured by every capability check and written by nothing,
 * so a mis-scoped grant stood until a superuser UPDATE — and a grant that lapsed
 * through `valid_until` blocked its capability for good, because the grant
 * route and `project_access_active_unique` treat any unrevoked row as held. This
 * revokes the member's unrevoked grants of the named capabilities on the
 * project, live, lapsed or not yet valid.
 *
 * ADDRESSED BY MEMBER AND CAPABILITY, as the grant is: the grant returns ids
 * only for the rows it inserted and a project's creator receives none, and no
 * route lists grants (owner, 2026-09-23).
 *
 * ORDER (DEV-020, DEV-021): the project is resolved under RLS first —
 * `projects_select` shows it only to a member holding a live view or admin
 * grant on it, so an outsider, another workspace's owner, an ex-member and a
 * member without view get 404 before any authority check — then `authorize`
 * requires `project.admin` before any replay. The target member is part of the
 * body, and `commandRoute` hashes the path with it, so a key reused on another
 * project is 409 IDEMPOTENCY_CONFLICT (DEV-022).
 *
 * `project.view` REMOVES THE MEMBER FROM THE PROJECT. The grant adds
 * `project.view` to any action capability; revoking it revokes every grant the
 * member holds on the project, so no one keeps an action capability on a
 * project they cannot see (owner, 2026-09-23).
 *
 * THE LAST ADMINISTRATOR IS KEPT. A revoke that takes away a live
 * `project.admin` grant is refused with 409 PROJECT_FINAL_ADMIN, nothing
 * written, unless another active member keeps a live admin grant WITH NO END
 * DATE — the actor's own revoke included (owner, 2026-09-23). A dated survivor
 * does not count: granting someone admin for a minute and then revoking one's
 * own would otherwise orphan the project a minute later (gp-security S1-02).
 * The bootstrap arm of `pag_insert` counts revoked rows, and workspace roles
 * confer no project capability, so such a project could never be administered
 * again. The member's rows and every unrevoked admin row of the project are
 * locked in id order in one statement, so two administrators revoking each
 * other cannot both succeed, and a concurrent revoke re-reads `revoked_at`
 * after its wait.
 *
 * A GRANT AND A REVOKE OF ONE MEMBER ON ONE PROJECT ARE SERIALIZED by a
 * transaction advisory lock both routes take first (`projectAccessMemberLock`).
 * Without it a grant racing a `project.view` cascade saw `project.view` still
 * unrevoked, skipped it, and inserted an action capability the cascade's lock
 * set had never seen — a member with an action and no view (gp-security S1-01,
 * gp-reviewer R1-04; INV-111).
 *
 * AUTHORITY LOST MID-REQUEST is 403. The lock statement also applies
 * `pag_update`'s USING on its own snapshot; if another administrator revoked the
 * actor's admin grant after `authorize`, the actor's live admin row is missing
 * from the lock set and the answer is SCOPE_PROJECT_DENIED, not a false
 * `notHeld` (gp-reviewer R1-03).
 *
 * ONE UPDATE STATEMENT. `pag_update` asks `app.has_project_capability`, a STABLE
 * function that sees the snapshot of the statement that calls it, so a
 * self-revoke of `project.admin` passes the policy for every row of the one
 * statement. Split into several, the later ones would run after the actor's own
 * admin row was revoked and RLS would filter them silently; the row count is
 * compared for that reason too.
 */
export const POST = commandRoute(revokeProjectAccessRequest, async (a) => {
  const pathId = a.params.projectId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!pathId || !UUID.test(pathId)) throw notFound;
  const projectId = pathId.toLowerCase();

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const p = await tx.query<{ workspace_id: string }>(
      "select workspace_id from public.projects where id = $1", [projectId]);
    if (p.rows.length === 0) throw notFound;
    const workspaceId = p.rows[0]!.workspace_id;

    return withIdempotency<RevokeProjectAccessResponse, string>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "project_access.revoke", key: a.idempotencyKey, requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "project.admin" });
        return m.memberId;
      },
    }, async (actorMemberId) => {
      // Canonical from here on: SQL compares uuids whatever their case, the JS
      // filters below compare strings (gp-reviewer R1-01).
      const memberId = a.body.memberId.toLowerCase();
      // Any status: a suspended member's unrevoked grants come back to life on
      // reinstatement, so they must be revocable.
      const target = await tx.query(
        "select 1 from public.memberships where organization_id = $1 and id = $2", [workspaceId, memberId]);
      if (target.rows.length === 0) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Учасника не знайдено в цьому робочому просторі.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "memberId", message: "not a member of this workspace" }],
          }));
      }

      await projectAccessMemberLock(tx, projectId, memberId);
      const locked = await tx.query<LockedGrant>(
        `select g.id, g.member_id, g.capability,
                m.status = 'active' as member_active,
                g.valid_from <= now() and (g.valid_until is null or g.valid_until > now()) as live,
                g.valid_until is null as undated
           from public.project_access_grants g
           join public.memberships m on m.organization_id = g.workspace_id and m.id = g.member_id
          where g.workspace_id = $1 and g.project_id = $2 and g.revoked_at is null
            and (g.member_id = $3 or g.capability = 'project.admin')
          order by g.id
            for update of g`,
        [workspaceId, projectId, memberId]);

      const isLiveAdmin = (r: LockedGrant) => r.capability === "project.admin" && r.live && r.member_active;
      if (!locked.rows.some((r) => r.member_id === actorMemberId && isLiveAdmin(r))) {
        throw new HttpProblem(403, problem("SCOPE_PROJECT_DENIED", "Немає доступу до цього проєкту.",
          { requestId: a.requestId, retryable: false, userAction: "request_project_scope" }));
      }

      const requested = new Set<string>(a.body.capabilities);
      const held = locked.rows.filter((r) => r.member_id === memberId);
      const heldCaps = new Set(held.map((r) => r.capability));
      const notHeld = [...requested].filter((c) => !heldCaps.has(c)).sort();
      if (notHeld.length > 0) {
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          "Учасник не має цього доступу до проєкту, або його вже відкликано.", {
            requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry",
            details: projectAccessNotHeldDetails.parse({ notHeld }),
          }));
      }

      const targets = requested.has("project.view") ? held : held.filter((r) => requested.has(r.capability));
      const targetIds = new Set(targets.map((r) => r.id));
      if (targets.some(isLiveAdmin) && !locked.rows.some((r) => !targetIds.has(r.id) && isLiveAdmin(r) && r.undated)) {
        throw new HttpProblem(409, problem("PROJECT_FINAL_ADMIN",
          "Не можна відкликати доступ останнього адміністратора проєкту. Спершу надайте іншому учаснику безстрокові права адміністратора.", {
            requestId: a.requestId, retryable: false, userAction: "grant_project_admin_to_another_member_first",
          }));
      }

      const upd = await tx.query<{ id: string; capability: string }>(
        `update public.project_access_grants
            set revoked_at = now(), version = version + 1
          where workspace_id = $1 and project_id = $2 and id = any($3::uuid[]) and revoked_at is null
          returning id, capability`,
        [workspaceId, projectId, [...targetIds]]);
      if (upd.rows.length !== targetIds.size) {
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          "Доступ змінився під час відкликання. Оновіть дані та повторіть спробу.", {
            requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry",
          }));
      }

      const revoked = upd.rows
        .map((r) => ({ capability: r.capability, grantId: r.id }))
        .sort((x, y) => x.capability.localeCompare(y.capability));
      await recordAudit(tx, ctx, {
        action: "project_access.revoked", object_type: "project", object_id: projectId,
        details: {
          memberId,
          capabilities: revoked.map((r) => r.capability),
          grantIds: revoked.map((r) => r.grantId),
        },
      }, { organizationId: workspaceId });
      return { status: 200, body: revokeProjectAccessResponse.parse({ revoked }) };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
