import { createHash } from "node:crypto";
import { commandRoute } from "../../../../src/lib/command";
import { HttpProblem, problem } from "../../../../src/lib/http";
import { acceptInvitationRequest, type AcceptInvitationResponse } from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@aktflow/database";

export const runtime = "nodejs";

export const POST = commandRoute(acceptInvitationRequest, async (a) => {
  const tokenHash = createHash("sha256").update(a.body.token).digest("hex");
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, (tx) =>
    withIdempotency<AcceptInvitationResponse>(tx, {
      organizationId: null, actorScope: `user:${a.userId}`,
      operationId: "invitations.accept", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      let row: { workspace_id: string; membership_id: string; member_role: string };
      try {
        const r = await tx.query(`select * from app.accept_invitation($1)`, [tokenHash]);
        row = r.rows[0];
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("INVITATION_NOT_FOUND")) {
          // Existence-safe: unknown, revoked, expired, and consumed tokens are
          // indistinguishable to the caller.
          throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND",
            "Запрошення не знайдено або воно недійсне.",
            { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
        }
        if (msg.includes("ALREADY_MEMBER")) {
          throw new HttpProblem(409, problem("VERSION_CONFLICT",
            "Ви вже є учасником цього робочого простору.",
            { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
        }
        throw e;
      }
      await recordAudit(tx, ctx, {
        action: "invitation.accepted", object_type: "membership",
        object_id: row.membership_id, details: {},
      }, { organizationId: row.workspace_id });
      await enqueueOutbox(tx, ctx, {
        topic: "invitation.accepted", aggregate_type: "workspace",
        aggregate_id: row.workspace_id, payload_version: 1,
        payload: { workspaceId: row.workspace_id, membershipId: row.membership_id },
      }, { organizationId: row.workspace_id });
      return {
        status: 200,
        body: { workspaceId: row.workspace_id, membershipId: row.membership_id, role: row.member_role },
      };
    }));
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
