import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireWorkspaceCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  archiveProjectRequirementRequest, type ArchiveProjectRequirementResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `project_requirements.archive` — POST /v1/project-requirements/{itemId}/archive
 * (technical/openapi/scope-v0.1.csv:33; command, idempotency required, member
 * plane, governed by the WORKSPACE capability project_requirements.manage —
 * technical/permissions/capabilities.csv:10, owner/admin).
 *
 * ARCHIVING FREEZES THE ROW, IT DOES NOT ERASE IT (ADR-010 decision 5). Text
 * and citation are immutable once written; a correction is a new item plus an
 * archive of the old one. `app.guard_project_sourced_requirement_item()`
 * (migration 0059 §2) is a BEFORE UPDATE/DELETE trigger admitting exactly one
 * transition, active -> archived, setting only `archived_at` and
 * `archived_by_member_id` — DELETE is refused outright and any other column
 * change raises. That is what makes the promise structural rather than a
 * convention this route could violate by writing one more column.
 *
 * IT IS NOT A ROUTE UPDATE. goproceed_app holds no UPDATE grant on
 * public.project_sourced_requirement_items — only SELECT and INSERT (migration
 * 0059 §2) — so the one write path is the SECURITY DEFINER command
 * app.archive_project_sourced_requirement_item(workspace, item). It resolves
 * its own actor from app.active_member_id() and does its own owner/admin
 * check; the membership and capability checks below are not redundant with
 * it, they are what turns a plpgsql raise into a problem+json the caller can
 * act on, and they run BEFORE the DEFINER function reads anything, so no
 * refusal this route emits can become a cross-tenant oracle. The route's OWN
 * workspace resolution does precede them, and the paragraph below is why that
 * is safe: it is an ordinary RLS-scoped read that discloses nothing.
 *
 * THE WORKSPACE IS RESOLVED BEFORE THE IDEMPOTENCY SCOPE OPENS, because that
 * scope is keyed on the workspace and the path carries only the item id. The
 * read is RLS-scoped by `psri_select` (any active member), so an item in a
 * workspace the caller does not belong to is indistinguishable from an absent
 * one — the same shape requirement_rule_versions.retire's route uses.
 *
 * IDEMPOTENT BY STATE, NOT ONLY BY KEY. `app.archive_project_sourced_requirement_item`
 * returns without raising when the item is already archived (0059 §2, «a
 * replay must not raise»), and its UPDATE is a compare-and-swap on
 * `status = 'active'` — so a second call, even under a fresh Idempotency-Key,
 * matches zero rows instead of re-stamping `archived_at` and the archiving
 * member with its own. The re-read below then reports the ORIGINAL archival's
 * timestamp, never a fresh one.
 */
export const POST = commandRoute(archiveProjectRequirementRequest, async (a) => {
  const itemId = a.params.itemId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND",
    "Пункт вимоги не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!itemId) throw notFound;

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    // Resolve the workspace before opening the idempotency scope, which is
    // keyed on it. RLS-scoped: an item in another tenant is indistinguishable
    // from an absent one.
    const found = await tx.query(
      `select workspace_id from public.project_sourced_requirement_items where id = $1`,
      [itemId]);
    if (found.rows.length === 0) throw notFound;
    const workspaceId: string = found.rows[0].workspace_id;

    return withIdempotency<ArchiveProjectRequirementResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "project_requirements.archive", key: a.idempotencyKey,
      requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      requireWorkspaceCapability(a.requestId, m.role, "project_requirements.manage");

      const before = await tx.query(
        `select project_id, status from public.project_sourced_requirement_items
          where workspace_id = $1 and id = $2`,
        [workspaceId, itemId]);
      if (before.rows.length === 0) throw notFound;
      const prior = before.rows[0];

      await tx.query(
        `select app.archive_project_sourced_requirement_item($1, $2)`,
        [workspaceId, itemId]);

      const after = await tx.query(
        `select status, archived_at from public.project_sourced_requirement_items
          where workspace_id = $1 and id = $2`,
        [workspaceId, itemId]);
      const row = after.rows[0];
      if (!row || row.status !== "archived" || row.archived_at === null) {
        // The function is the only write path and it either archives the row
        // or raises. Never report an archival that did not happen.
        throw new Error(
          `project-sourced requirement item ${itemId} was not archived by `
          + `app.archive_project_sourced_requirement_item`);
      }
      const archivedAt = new Date(row.archived_at).toISOString();

      await recordAudit(tx, ctx, {
        action: "project_sourced_requirement_item.archived",
        object_type: "project_sourced_requirement_item", object_id: itemId,
        details: {
          projectId: prior.project_id,
          // What the caller found, so the trail distinguishes an archival
          // from a later replay that changed nothing.
          priorStatus: prior.status,
        },
      }, { organizationId: workspaceId });

      return { status: 200, body: { itemId, status: "archived" as const, archivedAt } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
