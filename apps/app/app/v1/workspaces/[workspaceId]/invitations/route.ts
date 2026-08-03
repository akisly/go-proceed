import { randomBytes, randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { createInvitationRequest, type CreateInvitationResponse } from "@goproceed/contracts";
import { generateInvitationToken } from "@goproceed/domain";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";

export const runtime = "nodejs";

export const POST = commandRoute(createInvitationRequest, async (a) => {
  const workspaceId = a.params.workspaceId;
  if (!workspaceId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Робочий простір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const { token, tokenHash } = generateInvitationToken(randomBytes(32));
  const invitationId = randomUUID();
  const expiresAt = new Date(Date.now() + a.body.expiresInHours * 3600_000);
  const ctx = { actorUserId: a.userId, organizationId: workspaceId, requestId: a.requestId };
  const out = await withTenantTx(ctx, (tx) =>
    withIdempotency<CreateInvitationResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "invitations.create", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      // Governance action: only owner/admin issue invitations.
      if (m.role !== "owner" && m.role !== "admin") {
        throw new HttpProblem(403, problem("SCOPE_DENIED",
          "Запрошення може створити лише власник або адміністратор.",
          { requestId: a.requestId, retryable: false, userAction: "request_scope" }));
      }
      // A pending-but-expired invitation still occupies
      // invitations_pending_email_unique, so retire it before re-inviting.
      // (app.accept_invitation cannot do this itself: it raises, which would
      // roll its own UPDATE back.)
      await tx.query(
        `update public.invitations
            set status = 'expired', updated_at = now(), version = version + 1
          where workspace_id = $1 and lower(email) = lower($2)
            and status = 'pending' and expires_at <= now()`,
        [workspaceId, a.body.email]);
      try {
        await tx.query(
          `insert into public.invitations (id, workspace_id, email, role, token_hash, expires_at, invited_by)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [invitationId, workspaceId, a.body.email.toLowerCase(), a.body.role, tokenHash, expiresAt, a.userId]);
      } catch (e) {
        if (e instanceof Error && /invitations_pending_email_unique/.test(e.message)) {
          throw new HttpProblem(409, problem("VERSION_CONFLICT",
            "Активне запрошення для цієї адреси вже існує.",
            { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
        }
        throw e;
      }
      await recordAudit(tx, ctx, {
        action: "invitation.issued", object_type: "invitation",
        object_id: invitationId, details: { role: a.body.role },
      });
      // Token is response-only (plan decision 7): never audited, never enqueued.
      await enqueueOutbox(tx, ctx, {
        topic: "invitation.issued", aggregate_type: "workspace",
        aggregate_id: workspaceId, payload_version: 1,
        payload: { invitationId, workspaceId },
      });
      return { status: 201, body: { invitationId, token, expiresAt: expiresAt.toISOString() } };
    }));
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
