import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  revokeInvitationRequest, revokeInvitationResponse, type RevokeInvitationResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `invitations.revoke` — POST /v1/invitations/{invitationId}/revoke
 * (ADR-012, DEV-021, BL-107).
 *
 * Since DEV-019 the server keeps only an invitation token's hash, so a lost
 * create response cannot be recovered, and the pending-address index blocks
 * the address until the invitation expires; a leaked link admits whoever holds
 * it for as long (BL-013). This withdraws a pending invitation: its token then
 * admits no one, and the address is free for a new create.
 *
 * ORDER (DEV-020): the invitation is resolved under RLS first — `inv_select`
 * shows it only to an active member of its workspace, so an outsider, another
 * workspace's owner or an ex-member gets 404 before any authority check — then
 * `authorize` requires an owner or admin (the same check as the create) before
 * any replay.
 *
 * THE CHECK IS THE STATUS, NOT A VERSION. A pending invitation's version is
 * always 1 (nothing writes a pending row and leaves it pending), and no route
 * exposes it. Under the row lock, anything but a pending, unexpired invitation
 * is 409 with nothing written: an accepted or revoked one is final, and one
 * past its `expires_at` already admits no one and is retired by the next
 * create for its address (owner, 2026-09-18).
 *
 * TOKEN-FREE AND EMAIL-FREE: the response, the stored idempotency record, the
 * audit detail and the outbox payload carry the invitation id only.
 */
export const POST = commandRoute(revokeInvitationRequest, async (a) => {
  const invitationId = a.params.invitationId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Запрошення не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!invitationId || !UUID.test(invitationId)) throw notFound;

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const inv = await tx.query<{ workspace_id: string }>(
      "select workspace_id from public.invitations where id = $1", [invitationId]);
    if (inv.rows.length === 0) throw notFound;
    const workspaceId = inv.rows[0]!.workspace_id;

    return withIdempotency<RevokeInvitationResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "invitations.revoke", key: a.idempotencyKey, requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        // Governance action: only owner/admin withdraw invitations (members.manage).
        if (m.role !== "owner" && m.role !== "admin") {
          throw new HttpProblem(403, problem("SCOPE_DENIED",
            "Відкликати запрошення може лише власник або адміністратор.",
            { requestId: a.requestId, retryable: false, userAction: "request_scope" }));
        }
      },
    }, async () => {
      const conflict = () => new HttpProblem(409, problem("VERSION_CONFLICT",
        "Запрошення вже прийнято, відкликано або строк його дії минув.",
        { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
      const locked = await tx.query<{ status: string; live: boolean }>(
        `select status, expires_at > now() as live from public.invitations
          where workspace_id = $1 and id = $2 for update`,
        [workspaceId, invitationId]);
      if (locked.rows.length === 0) throw notFound;
      if (locked.rows[0]!.status !== "pending" || !locked.rows[0]!.live) throw conflict();

      // RLS filters an UPDATE silently, so a row the policy withholds would
      // look like success: count it.
      const upd = await tx.query(
        `update public.invitations
            set status = 'revoked', updated_at = now(), version = version + 1
          where workspace_id = $1 and id = $2 and status = 'pending'
          returning id`,
        [workspaceId, invitationId]);
      if (upd.rows.length !== 1) throw conflict();

      await recordAudit(tx, ctx, {
        action: "invitation.revoked", object_type: "invitation", object_id: invitationId, details: {},
      }, { organizationId: workspaceId });
      await enqueueOutbox(tx, ctx, {
        topic: "invitation.revoked", aggregate_type: "workspace",
        aggregate_id: workspaceId, payload_version: 1,
        payload: { invitationId, workspaceId },
      }, { organizationId: workspaceId });
      return { status: 200, body: revokeInvitationResponse.parse({ invitationId, status: "revoked" }) };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
