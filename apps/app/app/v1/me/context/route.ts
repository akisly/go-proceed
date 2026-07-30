import { requireUser } from "../../../../src/lib/auth";
import { requestIdFrom, toProblemResponse, ok } from "../../../../src/lib/http";
import { meContextResponse } from "@aktflow/contracts";
import { withTenantTx } from "@aktflow/database";

export const runtime = "nodejs"; // node-postgres requires the Node runtime

// Org-agnostic on purpose: this route intentionally never reads
// X-Organization-Id. api.me_context is filtered entirely by
// app.current_actor() (the app.actor_user_id GUC), which withTenantTx sets
// from the authenticated user — never from a client-supplied header — so a
// caller cannot widen or redirect their own result by supplying someone
// else's org id.
export async function GET(req: Request): Promise<Response> {
  // Fallback id in case X-Request-Id itself fails validation below (before a
  // "real" requestId exists to attach to that very problem+json response).
  let requestId = crypto.randomUUID();
  try {
    // requestIdFrom validates syntax/length per docs/22-data-api-contract.md:170
    // and throws HttpProblem 422 VALIDATION_FAILED for an invalid header
    // instead of ever echoing it back into audit_events.request_id.
    requestId = requestIdFrom(req);
    const { userId } = await requireUser(requestId, req);

    const rows = await withTenantTx(
      { actorUserId: userId, organizationId: null, requestId },
      async (tx) => {
        const r = await tx.query(
          `select organization_id, display_name, role, status, membership_version
           from api.me_context`,
        );
        return r.rows as Array<{
          organization_id: string;
          display_name: string;
          role: string;
          status: string;
          membership_version: string | number;
        }>;
      },
    );

    const body = meContextResponse.parse({
      userId,
      memberships: rows.map((m) => ({
        workspaceId: m.organization_id,
        organizationId: m.organization_id,
        displayName: m.display_name,
        role: m.role,
        status: m.status,
        // node-postgres returns int8 (bigint) columns as strings; the
        // contract requires a real number.
        membershipVersion: Number(m.membership_version),
      })),
    });

    return ok(200, body, requestId);
  } catch (err) {
    // Single mapping point: HttpProblem → its status, IdempotencyConflictError → 409, else 500.
    return toProblemResponse(err, requestId);
  }
}
