import { queryRoute } from "../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../src/lib/http";
import type { GetUploadIntentResponse } from "@goproceed/contracts";
import { withTenantTx } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * Re-fetches an upload receipt by intent identity.
 *
 * This is the recovery path for the last row of the failure table in
 * docs/domain/execution-and-evidence.md: the server persisted the receipt and
 * the client's local write failed. Without it the client would re-upload bytes
 * the server already holds.
 *
 * The response carries no storage key. A key in a response is a capability
 * leak, and files-and-storage.md forbids permanent download URLs outright.
 */
export const GET = queryRoute(async (a) => {
  const intentId = a.params.intentId;
  if (!intentId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Намір завантаження не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND",
    "Намір завантаження не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx) => {
    const r = await tx.query(
      `select i.id, i.workspace_id, i.project_id, i.status, i.failure_code, i.expires_at,
              i.created_by_member_id, i.finalized_evidence_object_id,
              e.content_hash, e.byte_size, e.server_received_at
         from public.upload_intents i
         left join public.evidence_objects e
           on e.workspace_id = i.workspace_id and e.id = i.finalized_evidence_object_id
        where i.id = $1`, [intentId]);
    if (r.rows.length === 0) throw notFound;
    const row = r.rows[0];

    const m = await requireActiveMembership(tx, a.requestId, a.userId, row.workspace_id);
    // The creator always sees their own receipt — that is the recovery path, and
    // it must survive the capability being revoked mid-upload. Anyone else needs
    // to be able to see the project at all.
    if (row.created_by_member_id !== m.memberId) {
      await requireProjectCapability(tx, a.requestId, {
        workspaceId: row.workspace_id, projectId: row.project_id,
        memberId: m.memberId, capability: "project.view",
      });
    }

    const out: GetUploadIntentResponse = {
      uploadIntentId: row.id,
      status: row.status,
      evidenceObjectId: row.finalized_evidence_object_id,
      contentHash: row.content_hash,
      byteSize: row.byte_size === null ? null : Number(row.byte_size),
      serverReceivedAt: row.server_received_at?.toISOString?.() ?? null,
      failureCode: row.failure_code,
      expiresAt: new Date(row.expires_at).toISOString(),
    };
    return out;
  });
  return { status: 200, body };
});
