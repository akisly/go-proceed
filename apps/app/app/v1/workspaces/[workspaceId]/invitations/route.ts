import { randomBytes, randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  createInvitationRequest, createInvitationReceipt, createInvitationResponse,
  type CreateInvitationReceipt, type CreateInvitationResponse,
} from "@goproceed/contracts";
import { generateInvitationToken } from "@goproceed/domain";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `invitations.create` — POST /v1/workspaces/{workspaceId}/invitations.
 *
 * THE RAW TOKEN AND THE IDEMPOTENCY RECORD (BL-104, DEV-019, INV-102).
 * `withIdempotency` stores what its callback returns in
 * `public.idempotency_records.response_body` for the retention window. Until
 * DEV-019 that body carried the raw token, so a bearer credential that
 * `public.invitations` deliberately keeps only as `token_hash` sat beside it
 * in plain text for thirty days.
 *
 * So the callback returns the strict token-free receipt, the token is held in
 * `captured` OUTSIDE the block, and the response carries it only when the
 * block actually ran. A replay returns `kind: "replayed"` without it — the
 * Telegram intent routes' shape; the occurrence-grants route omits its link the
 * same way — because the server no longer holds the token and cannot hand it
 * out again. The replay body is
 * built from named fields, never by spreading the stored body, because a
 * record written before `0088` cleaned it may still hold one.
 */
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
  // A holder object, not a `let`: see the occurrence-grants route for why.
  const captured: { token: string | null } = { token: null };
  const result = await withTenantTx(ctx, async (tx) => {
    const out = await withIdempotency<CreateInvitationReceipt>(tx, {
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
      captured.token = token;
      return { status: 201, body: createInvitationReceipt.parse({ invitationId, expiresAt: expiresAt.toISOString() }) };
    });
    // Inside the transaction on purpose: if a fresh execution cannot hand its
    // token back, the invitation must not commit, or its address stays blocked
    // until expiry with a token nobody received (BL-107).
    if (!out.replayed && captured.token === null) {
      throw new Error("a fresh invitations.create did not capture its token");
    }
    const receipt = { invitationId: out.body.invitationId, expiresAt: out.body.expiresAt };
    const body: CreateInvitationResponse = out.replayed
      ? createInvitationResponse.parse({ ...receipt, kind: "replayed" })
      : createInvitationResponse.parse({ ...receipt, kind: "issued", token: captured.token });
    return { status: out.status, body, expiresAt: out.expiresAt };
  });
  return result;
});
