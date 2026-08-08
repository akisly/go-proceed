import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  revokeReissueGrantRequest,
  type RevokeReissueGrantResponse, type ExternalLinkDelivery,
  type ExternalGrantPermissions,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";
import {
  buildReviewLink, linkKeys, newSecret, signWithActiveKey,
} from "../../../../../src/lib/external-link";

export const runtime = "nodejs";

/**
 * `external_grants.revoke_reissue` — POST /v1/grants/{grantId}/revoke-reissue
 * (technical/openapi/scope-v0.1.csv:54; command, idempotency required, member
 * plane, governed by `packages.submit`).
 *
 * tenancy-and-security.md §"Grant creation": «Reissue atomically revokes the old
 * grant and all sessions issued from it.» ATOMICALLY is the word that matters —
 * this is one transaction, and a reissue whose revoke committed separately would
 * leave a window in which two live links decide the same obligation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT KILLS A SESSION, AND WHY THE UPDATE IS NOT THE THING THAT KILLS IT
 *
 * Two independent mechanisms, and the first is the load-bearing one:
 *
 *  1. `app.external_session_scope()` (migration 0049 §7) requires
 *     `g.status = 'active'` AND `g.revocation_version = s.grant_revocation_version`.
 *     Bumping the version on the grant invalidates every session of that grant
 *     in the same statement, for every future request, WITHOUT touching a single
 *     session row. That is why there is no foreign key from the session onto the
 *     grant's revocation version: an FK would make this UPDATE fail while a live
 *     session named the old value, and revocation is the one operation that must
 *     never fail.
 *
 *  2. The session rows are marked `revoked` anyway, in the loop below, so a
 *     human reading `public.external_sessions` sees the state rather than having
 *     to derive it from a version comparison. If that UPDATE were removed the
 *     sessions would still be dead by (1); if (1) were removed the sessions
 *     would still be dead by (2). Neither is the other's belt.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A REVOKED GRANT'S DECISIONS SURVIVE, AND MUST.
 *
 * `public.requirement_evidence_decisions` rows naming this grant are untouched:
 * they are append-only (`requirement_evidence_decisions_immutable`) and they are
 * what the closure was proved against and what the act prints. Revoking the link
 * withdraws the CAPABILITY; it does not unsay what the технагляд said. That is
 * also why `app.guard_external_grant()` refuses a DELETE outright.
 */
export const POST = commandRoute(revokeReissueGrantRequest, async (a) => {
  const grantId = a.params.grantId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Посилання не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!grantId) throw notFound;

  const conflict = (detail: string) => new HttpProblem(409, problem("VERSION_CONFLICT", detail,
    { requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry" }));

  const captured: { link: ExternalLinkDelivery | null } = { link: null };

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const g0 = await tx.query(
      `select workspace_id, project_id from public.external_access_grants where id = $1`,
      [grantId]);
    if (g0.rows.length === 0) throw notFound;
    const workspaceId: string = g0.rows[0].workspace_id;
    const projectId: string = g0.rows[0].project_id;

    return withIdempotency<RevokeReissueGrantResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "external_grants.revoke_reissue", key: a.idempotencyKey,
      requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "packages.submit" });

      // Serialize this grant against a concurrent revoke, a concurrent reissue
      // and — importantly — a concurrent EXCHANGE, which takes the same row lock
      // inside `app.exchange_external_grant`. Whichever arrives second sees the
      // first's committed state: an exchange that lost the race finds
      // `status <> 'active'` and returns zero rows, and a revoke that lost finds
      // the version moved and raises VERSION_CONFLICT here.
      const g = await tx.query(
        `select workspace_id, project_id, contract_id, scope_kind,
                requirement_occurrence_id, recipient_email, recipient_contact_id,
                recipient_role, permissions, status, version, revocation_version,
                decides_evidence
           from public.external_access_grants
          where workspace_id = $1 and id = $2
          for update`,
        [workspaceId, grantId]);
      if (g.rows.length === 0) throw notFound;
      const row = g.rows[0];

      if (Number(row.version) !== a.body.expectedVersion) {
        throw conflict(`Посилання змінилося (поточна версія ${Number(row.version)}).`);
      }
      if (row.status !== "active") {
        throw conflict("Це посилання вже відкликано або замінено.");
      }
      if (row.scope_kind !== "requirement_occurrence") {
        // Unreachable in a v0.1 database — no package_versions table exists for
        // a package-scoped grant to reference — and refused rather than
        // half-handled, because a v0.2 grant reaching a v0.1 command is exactly
        // the reinterpretation INV-074's exclusivity exists to prevent.
        throw conflict("Це посилання належить до іншого виду доступу.");
      }

      const occurrenceId: string = row.requirement_occurrence_id;
      const revokedStatus = a.body.reissue ? "superseded" : "revoked";
      const nextRevocationVersion = Number(row.revocation_version) + 1;

      const revoked = await tx.query(
        `update public.external_access_grants
            set status = $3, revocation_version = $4, version = version + 1
          where workspace_id = $1 and id = $2 and version = $5
          returning revocation_version`,
        [workspaceId, grantId, revokedStatus, nextRevocationVersion, a.body.expectedVersion]);
      if (revoked.rows.length === 0) throw conflict("Посилання щойно змінилося.");

      const sessions = await tx.query(
        `update public.external_sessions
            set status = 'revoked'
          where workspace_id = $1 and external_access_grant_id = $2 and status = 'active'
          returning id`,
        [workspaceId, grantId]);

      // ── the successor, when one was asked for ──────────────────────────────
      let reissuedGrantId: string | null = null;
      if (a.body.reissue) {
        const permissions = (a.body.permissions ?? row.permissions) as ExternalGrantPermissions;
        const recipientEmail = a.body.recipientEmail ?? (row.recipient_email as string);
        const recipientRole = a.body.recipientRole ?? (row.recipient_role as string);
        const mayDecide = permissions["external.decide_evidence"] === true;

        // The same two refusals `occurrence_grants.issue` owns, because a
        // reissue may RE-TARGET and re-targeting is issuing. Duplicated here on
        // purpose rather than extracted: the occurrence read differs (this one
        // has the grant's own row already) and a shared helper that took eight
        // parameters would hide which of the two commands each refusal belongs
        // to. If a third issuer ever appears, extract then.
        const occ = await tx.query(
          `select approver_role, approver_is_external
             from public.requirement_occurrences where workspace_id = $1 and id = $2`,
          [workspaceId, occurrenceId]);
        if (occ.rows.length === 0) throw notFound;
        const approverRole: string = occ.rows[0].approver_role;
        const approverIsExternal: boolean = occ.rows[0].approver_is_external === true;

        if (mayDecide && (recipientRole !== approverRole || !approverIsExternal)) {
          throw new HttpProblem(422, problem("VALIDATION_FAILED",
            `Рішення щодо цієї вимоги ухвалює «${approverRole}» і лише якщо базова редакція визначає її зовнішньою.`,
            { requestId: a.requestId, retryable: false, userAction: "correct_fields",
              fieldErrors: [{ path: "permissions.external.decide_evidence",
                              message: "a deciding grant must name an external approver_role of the occurrence" }] }));
        }

        const token = newSecret();
        const { keyId, verifier } = signWithActiveKey(linkKeys(), token);
        reissuedGrantId = randomUUID();

        const created = await tx.query(
          `insert into public.external_access_grants
             (id, workspace_id, project_id, contract_id, scope_kind,
              requirement_occurrence_id, token_hmac, hmac_key_id,
              recipient_email, recipient_contact_id, recipient_role, permissions,
              expires_at, issued_by_member_id, replaced_grant_id,
              decide_role, decides_evidence)
           values ($1,$2,$3,$4,'requirement_occurrence',$5,$6,$7,$8,$9,$10,$11::jsonb,
                   now() + make_interval(days => $12::int),$13,$14,$15,$16)
           returning expires_at`,
          [reissuedGrantId, workspaceId, projectId, row.contract_id, occurrenceId,
           verifier, keyId, recipientEmail,
           a.body.recipientEmail ? null : row.recipient_contact_id,
           recipientRole, JSON.stringify(permissions), a.body.expiresInDays,
           m.memberId, grantId, mayDecide ? recipientRole : null, mayDecide]);

        captured.link = {
          url: buildReviewLink(token),
          expiresAt: new Date(created.rows[0].expires_at).toISOString(),
          deliveredBy: "caller",
        };
      }

      // technical/events/event-catalog.csv:33 — `external_grant.revoked`,
      // v0.1-M5, producer `bff.external_grants.revoke_reissue`.
      await recordAudit(tx, ctx, {
        action: "external_grant.revoked", object_type: "external_access_grant",
        object_id: grantId,
        details: {
          requirementOccurrenceId: occurrenceId, projectId,
          revokedStatus, revocationVersion: nextRevocationVersion,
          sessionsRevoked: sessions.rows.length,
          reissuedGrantId, reason: a.body.reason,
        },
      }, { organizationId: workspaceId });

      await enqueueOutbox(tx, ctx, {
        topic: "external_grant.revoked",
        aggregate_type: "external_access_grant", aggregate_id: grantId,
        payload_version: 1,
        payload: {
          workspaceId, projectId, requirementOccurrenceId: occurrenceId,
          grantId, revokedStatus, revocationVersion: nextRevocationVersion,
          sessionsRevoked: sessions.rows.length, reissuedGrantId,
        },
      }, { organizationId: workspaceId });

      if (reissuedGrantId) {
        await recordAudit(tx, ctx, {
          action: "external_grant.issued", object_type: "external_access_grant",
          object_id: reissuedGrantId,
          details: {
            requirementOccurrenceId: occurrenceId, projectId,
            replacedGrantId: grantId,
            recipientEmail: a.body.recipientEmail ?? row.recipient_email,
            recipientRole: a.body.recipientRole ?? row.recipient_role,
          },
        }, { organizationId: workspaceId });
        await enqueueOutbox(tx, ctx, {
          topic: "external_grant.issued",
          aggregate_type: "external_access_grant", aggregate_id: reissuedGrantId,
          payload_version: 1,
          payload: {
            workspaceId, projectId, requirementOccurrenceId: occurrenceId,
            grantId: reissuedGrantId, replacedGrantId: grantId,
            scopeKind: "requirement_occurrence",
          },
        }, { organizationId: workspaceId });
      }

      const body: RevokeReissueGrantResponse = {
        revokedGrantId: grantId,
        revokedStatus,
        revocationVersion: nextRevocationVersion,
        sessionsRevoked: sessions.rows.length,
        reissuedGrantId,
      };
      return { status: 200, body };
    });
  });

  const body: RevokeReissueGrantResponse =
    out.replayed || captured.link === null ? out.body : { ...out.body, link: captured.link };
  return { status: out.status, body, expiresAt: out.expiresAt };
});
