import { z } from "zod";
import { withTenantTx } from "@goproceed/database";
import { requireUser } from "../../../../../src/lib/auth";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem, requestIdFrom, toProblemResponse } from "../../../../../src/lib/http";
import { openObjectStream } from "../../../../../src/lib/evidence-storage";
import { readVerifiedReferenceImage } from "../../../../../src/lib/reference-images";

export const runtime = "nodejs";
const PRIVATE_HEADERS = { "cache-control": "private, no-store", vary: "Authorization, Cookie",
  "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox",
  "referrer-policy": "no-referrer", "x-frame-options": "DENY" };

export async function GET(req: Request, ctx: { params: Promise<{ occurrenceId: string }> }): Promise<Response> {
  let requestId = crypto.randomUUID();
  try {
    requestId = requestIdFrom(req);
    const { userId } = await requireUser(requestId, req);
    const { occurrenceId } = await ctx.params;
    const missing = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Приклад фотографії не знайдено.",
      { requestId, retryable: false, userAction: "return_to_list" }));
    if (!z.string().guid().safeParse(occurrenceId).success) throw missing;
    const row = await withTenantTx({ actorUserId: userId, organizationId: null, requestId }, async (tx) => {
      const found = await tx.query<{
        workspace_id: string; project_id: string; storage_bucket: string; storage_key: string;
        byte_size: number; sha256: string; mime_type: string;
      }>(`select o.workspace_id, o.project_id, ri.storage_bucket, ri.storage_key,
                 ri.byte_size, ri.sha256, ri.mime_type
            from public.requirement_occurrences o
            join public.requirement_rule_versions rv
              on rv.workspace_id = o.workspace_id and rv.id = o.rule_version_id
             and rv.reference_image_version_id = o.reference_image_version_id
            join public.requirement_reference_image_versions ri
              on ri.workspace_id = o.workspace_id and ri.id = o.reference_image_version_id
             and ri.requirement_library_item_id = rv.requirement_library_item_id
           where o.id = $1`, [occurrenceId]);
      const image = found.rows[0];
      if (!image) throw missing;
      const member = await requireActiveMembership(tx, requestId, userId, image.workspace_id);
      await requireProjectCapability(tx, requestId, { workspaceId: image.workspace_id,
        projectId: image.project_id, memberId: member.memberId, capability: "project.view" });
      return image;
    });
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = await readVerifiedReferenceImage(
        await openObjectStream(row.storage_key, row.storage_bucket), row.byte_size, row.sha256);
    } catch {
      // Storage diagnostics can contain raw keys. No provider errors escape.
      throw new HttpProblem(503, problem("REFERENCE_IMAGE_UNAVAILABLE", "Приклад фотографії тимчасово недоступний.",
        { requestId, retryable: true, userAction: "retry_later" }));
    }
    return new Response(bytes, { status: 200, headers: { ...PRIVATE_HEADERS,
      "x-request-id": requestId, "content-type": row.mime_type,
      "content-length": String(row.byte_size), "content-disposition": "inline" } });
  } catch (error) {
    const response = toProblemResponse(error, requestId);
    for (const [key, value] of Object.entries(PRIVATE_HEADERS)) response.headers.set(key, value);
    return response;
  }
}
