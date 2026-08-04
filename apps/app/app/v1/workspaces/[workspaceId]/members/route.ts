import { queryRoute } from "../../../../../src/lib/command";
import { requireActiveMembership } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { withTenantTx } from "@goproceed/database";
import type { MembersListResponse } from "@goproceed/contracts";

export const runtime = "nodejs";

export const GET = queryRoute(async (a) => {
  const workspaceId = a.params.workspaceId;
  if (!workspaceId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Робочий простір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: workspaceId, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx): Promise<MembersListResponse> => {
    await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
    const r = await tx.query(
      `select id, user_id, role, status from public.memberships
        where organization_id = $1 order by created_at, id`, [workspaceId]);
    return {
      members: r.rows.map((m: { id: string; user_id: string; role: string; status: string }) => ({
        memberId: m.id, userId: m.user_id, role: m.role, status: m.status,
      })),
    };
  });
  return { status: 200, body };
});
