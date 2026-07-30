import { queryRoute } from "../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../src/lib/http";
import { loadImportBatchResponse } from "../../../../src/lib/import-batch";
import { withTenantTx } from "@aktflow/database";

export const runtime = "nodejs";

export const GET = queryRoute(async (a) => {
  const batchId = a.params.batchId;
  if (!batchId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx) => {
    const b = await tx.query(
      `select workspace_id, project_id from public.import_batches where id = $1`, [batchId]);
    if (b.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = b.rows[0].workspace_id;
    const projectId: string = b.rows[0].project_id;
    const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
    await requireProjectCapability(tx, a.requestId,
      { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });
    const resp = await loadImportBatchResponse(tx, workspaceId, batchId);
    if (!resp) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    return resp;
  });
  return { status: 200, body };
});
