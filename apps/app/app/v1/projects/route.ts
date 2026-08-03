import { queryRoute } from "../../../src/lib/command";
import { withTenantTx } from "@goproceed/database";
import type { ProjectsListResponse } from "@goproceed/contracts";

export const runtime = "nodejs";

// Cross-workspace listing: RLS (projects_select requires an active
// project.view/project.admin grant) IS the filter — no client-supplied
// workspace id is trusted, and the visible set is exactly the granted set.
export const GET = queryRoute(async (a) => {
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx): Promise<ProjectsListResponse> => {
    const r = await tx.query(
      `select id, workspace_id, name, code from public.projects order by created_at, id`);
    return {
      projects: r.rows.map((p: { id: string; workspace_id: string; name: string; code: string | null }) => ({
        projectId: p.id, workspaceId: p.workspace_id, name: p.name, code: p.code,
      })),
    };
  });
  return { status: 200, body };
});
