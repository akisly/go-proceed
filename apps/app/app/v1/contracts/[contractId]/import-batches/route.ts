import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { createImportBatchRequest, type CreateImportBatchResponse } from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@aktflow/database";

export const runtime = "nodejs";

export const POST = commandRoute(createImportBatchRequest, async (a) => {
  const contractId = a.params.contractId;
  if (!contractId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Договір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const c = await tx.query(
      `select workspace_id, project_id from public.contracts where id = $1`, [contractId]);
    if (c.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Договір не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = c.rows[0].workspace_id;
    const projectId: string = c.rows[0].project_id;
    return withIdempotency<CreateImportBatchResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "import_batches.create", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "imports.manage" });
      const batchId = randomUUID();
      await tx.query(
        `insert into public.import_batches (id, workspace_id, project_id, contract_id, created_by)
         values ($1,$2,$3,$4,$5)`,
        [batchId, workspaceId, projectId, contractId, a.userId]);
      await recordAudit(tx, ctx, {
        action: "import_batch.created", object_type: "import_batch", object_id: batchId, details: {},
      }, { organizationId: workspaceId });
      return { status: 201, body: { batchId, status: "created" as const, version: 1 } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
