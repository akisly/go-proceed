import { commandRoute } from "../../../../src/lib/command";
import { requireActiveMembership, requireWorkspaceCapability } from "../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../src/lib/http";
import { updatePartyRequest, type PartyResponse } from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@aktflow/database";

export const runtime = "nodejs";

export const PATCH = commandRoute(updatePartyRequest, async (a) => {
  const partyId = a.params.partyId;
  if (!partyId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Сторону не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    // RLS-scoped resolution: the row is visible only to an active member of
    // its workspace, so a foreign party id is indistinguishable from absent.
    const p = await tx.query(`select workspace_id from public.parties where id = $1`, [partyId]);
    if (p.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Сторону не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = p.rows[0].workspace_id;
    return withIdempotency<PartyResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "parties.update", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      requireWorkspaceCapability(a.requestId, m.role, "parties.manage");
      const upd = await tx.query(
        `update public.parties set display_name = coalesce($3, display_name),
                version = version + 1, updated_at = now()
          where workspace_id = $1 and id = $2 and version = $4
          returning version`,
        [workspaceId, partyId, a.body.displayName ?? null, a.body.expectedVersion]);
      if (upd.rows.length === 0) {
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          "Запис було змінено. Оновіть сторінку і повторіть.",
          { requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry" }));
      }
      await recordAudit(tx, ctx, {
        action: "party.updated", object_type: "party", object_id: partyId, details: {},
      }, { organizationId: workspaceId, objectVersion: Number(upd.rows[0].version) });
      return { status: 200, body: { partyId, version: Number(upd.rows[0].version) } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
