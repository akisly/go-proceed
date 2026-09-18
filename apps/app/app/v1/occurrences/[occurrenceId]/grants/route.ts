import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability, type ActiveMembership } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  issueOccurrenceGrantRequest,
  type IssueOccurrenceGrantResponse, type ExternalLinkDelivery,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";
import {
  buildReviewLink, linkKeys, newSecret, signWithActiveKey,
} from "../../../../../src/lib/external-link";

export const runtime = "nodejs";

/**
 * `occurrence_grants.issue` — POST /v1/occurrences/{occurrenceId}/grants
 * (technical/openapi/scope-v0.1.csv:53; command, idempotency required, member
 * plane, governed by `packages.submit` — capabilities.csv:34).
 *
 * ADR-006 step 5, and the step ADR-005 decision 9 exists to make possible: an
 * external hold approver decides BEFORE any package version exists. Without the
 * occurrence scope the model is circular — package eligibility would wait for a
 * decision only reachable after freeze.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RAW TOKEN AND THE IDEMPOTENCY RECORD
 *
 * `withIdempotency` STORES the response body in
 * `public.idempotency_records.response_body`. Putting the link inside that body
 * would persist the raw bearer token in a table, which is INV-044 broken by the
 * most ordinary-looking line in the file — a `return { status: 201, body }`.
 *
 * So the idempotent block returns a TOKEN-FREE body, the link is captured in a
 * variable OUTSIDE it, and the route attaches it only when the block actually
 * ran. A replay therefore returns the same 201 WITHOUT a link, which is not a
 * degradation: tenancy-and-security.md §"Grant creation" says in terms that if
 * the send is ambiguous «GoProceed cannot reconstruct or retry that token; an
 * authorized revoke-and-reissue command creates a new grant/token». The replay
 * behaves exactly as a crash does, because it is the same situation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREE REFUSALS THIS ROUTE OWNS
 *
 *  1. A DECIDING GRANT MUST NAME THE OCCURRENCE'S OWN APPROVER ROLE. The
 *     decision is pinned into that role by
 *     `requirement_evidence_decisions_occurrence_fkey`, so a grant issued in
 *     another role would produce a decision in a role nobody was granted. The
 *     database carries it too — `external_access_grants_decide_role_fkey` — and
 *     this refusal exists so the caller gets a legible 422 rather than a 23503.
 *
 *  2. A DECIDING GRANT MUST NAME AN OCCURRENCE WHOSE APPROVER IS EXTERNAL.
 *     THIS IS A JUDGEMENT THE PACKAGE DOES NOT SETTLE. `approver_is_external` is
 *     the rule version's own pinned claim about who owes the decision; when it
 *     is false the obligation is an INTERNAL one, and handing it to a link would
 *     let an outsider discharge a duty the baseline assigned inside. Observing
 *     grants are unaffected — showing an outsider what is owed is not deciding
 *     it. If a pilot needs the other behaviour, this is the refusal to argue
 *     with, and it is one condition in one place.
 *
 *  3. A SECOND ACTIVE DECIDING GRANT TO THE SAME ADDRESS ON THE SAME OCCURRENCE
 *     is a 409. Two live links in one inbox are two links the recipient cannot
 *     tell apart, and the operation for «send it again» is
 *     `external_grants.revoke_reissue`, which kills the first one. Two DIFFERENT
 *     recipients are allowed: a firm may send two people, the lineage head
 *     serialises them, and the second decision supersedes the first as an
 *     ordinary successor.
 *
 * INV-085 IS LIFTED BY THIS FILE EXISTING. `requirement_rule_versions.publish`
 * refused a `hold` with an external approver «while v0.1-M5 is unshipped»; the
 * constant that carried that refusal is flipped in the same commit, which is
 * what the invariant's own row and the plan (line 326) require: «M5 lifts that
 * restriction BY THE SAME CHANGE that ships the occurrence grant».
 */
export const POST = commandRoute(issueOccurrenceGrantRequest, async (a) => {
  const occurrenceId = a.params.occurrenceId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Вимогу не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!occurrenceId) throw notFound;

  const validationFailed = (detail: string, path: string, message: string) =>
    new HttpProblem(422, problem("VALIDATION_FAILED", detail, {
      requestId: a.requestId, retryable: false, userAction: "correct_fields",
      fieldErrors: [{ path, message }],
    }));

  // Captured OUTSIDE the idempotent block. See the header.
  //
  // A HOLDER OBJECT AND NOT A `let`, for a TypeScript reason worth stating: a
  // `let` assigned only inside a callback is narrowed to `null` by control-flow
  // analysis at every later use in this scope, so the ternary below would not
  // typecheck. A property read is re-widened after any call.
  const captured: { link: ExternalLinkDelivery | null } = { link: null };

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const occ = await tx.query(
      `select workspace_id, project_id, contract_id, approver_role,
              approver_is_external, intervention_type, blocking_scope
         from public.requirement_occurrences where id = $1`, [occurrenceId]);
    if (occ.rows.length === 0) throw notFound;
    const workspaceId: string = occ.rows[0].workspace_id;
    const projectId: string = occ.rows[0].project_id;
    const contractId: string = occ.rows[0].contract_id;
    const approverRole: string = occ.rows[0].approver_role;
    const approverIsExternal: boolean = occ.rows[0].approver_is_external === true;

    return withIdempotency<IssueOccurrenceGrantResponse, ActiveMembership>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "occurrence_grants.issue", key: a.idempotencyKey,
      requestHash: a.requestHash,
      // NOT ledger_400d. A grant carves no money and admits none; ADR-005
      // decision 9 and INV-075 both say the decision it enables governs
      // eligibility rather than value.
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        // `project.view` beside the issuing capability, for the reason
        // `evidence_decisions.create` gives at its own line 69: `ro_select` on the
        // occurrence is a `project.view` policy, so an issuer without it already
        // got a 404 from the lookup above rather than reaching this line. Naming
        // it keeps the requirement legible in the file that needs it.
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "packages.submit" });
        return m;
      },
    }, async (m) => {
      const mayDecide = a.body.permissions["external.decide_evidence"];

      // ── refusal 1 ──────────────────────────────────────────────────────────
      if (mayDecide && a.body.recipientRole !== approverRole) {
        throw validationFailed(
          `Рішення щодо цієї вимоги ухвалює «${approverRole}». Вкажіть саме цю роль або надішліть посилання лише для перегляду.`,
          "recipientRole", "a deciding grant must name the occurrence's approver_role");
      }
      // ── refusal 2 ──────────────────────────────────────────────────────────
      if (mayDecide && !approverIsExternal) {
        throw validationFailed(
          "Цю вимогу за базовою редакцією знімає внутрішня роль. Зовнішнє посилання може бути лише для перегляду.",
          "permissions.external.decide_evidence",
          "the occurrence's pinned rule version names an internal approver");
      }
      // ── refusal 3 ──────────────────────────────────────────────────────────
      if (mayDecide) {
        const dup = await tx.query(
          `select 1 from public.external_access_grants
            where workspace_id = $1 and requirement_occurrence_id = $2
              and recipient_email = $3 and decides_evidence
              and status = 'active' and expires_at > now()
            limit 1`,
          [workspaceId, occurrenceId, a.body.recipientEmail]);
        if (dup.rows.length > 0) {
          throw new HttpProblem(409, problem("OCCURRENCE_CONFLICT",
            "Цій особі вже надіслано чинне посилання на цю вимогу. Відкличте його, щоб надіслати нове.",
            { requestId: a.requestId, retryable: false,
              userAction: "refresh_exact_occurrence" }));
        }
      }

      // A contact id, when one is sent, must belong to this workspace. Sending
      // one is a 404 today in every real workspace, because no v0.1 operation
      // writes public.party_contacts (migration 0049 §3 D1).
      if (a.body.recipientContactId) {
        const c = await tx.query(
          `select 1 from public.party_contacts where workspace_id = $1 and id = $2`,
          [workspaceId, a.body.recipientContactId]);
        if (c.rows.length === 0) throw notFound;
      }

      // ── the token ──────────────────────────────────────────────────────────
      // Generated here, HMAC'd here, and out of scope the moment this function
      // returns. It is not passed to recordAudit, not put in the outbox payload,
      // and not returned from this block.
      const token = newSecret();
      const { keyId, verifier } = signWithActiveKey(linkKeys(), token);
      const grantId = randomUUID();
      const decideRole = mayDecide ? a.body.recipientRole : null;

      const inserted = await tx.query(
        `insert into public.external_access_grants
           (id, workspace_id, project_id, contract_id, scope_kind,
            requirement_occurrence_id, token_hmac, hmac_key_id,
            recipient_email, recipient_contact_id, recipient_role, permissions,
            expires_at, issued_by_member_id, decide_role, decides_evidence)
         values ($1,$2,$3,$4,'requirement_occurrence',$5,$6,$7,$8,$9,$10,$11::jsonb,
                 now() + make_interval(days => $12::int),$13,$14,$15)
         returning expires_at, issued_at, status, revocation_version`,
        [grantId, workspaceId, projectId, contractId, occurrenceId, verifier, keyId,
         a.body.recipientEmail, a.body.recipientContactId ?? null, a.body.recipientRole,
         JSON.stringify(a.body.permissions), a.body.expiresInDays, m.memberId,
         decideRole, mayDecide]);

      const expiresAt = new Date(inserted.rows[0].expires_at).toISOString();
      const issuedAt = new Date(inserted.rows[0].issued_at).toISOString();

      // The link is built AFTER the row exists and is stashed outside the
      // idempotent block. If this transaction rolls back, `link` is discarded
      // with everything else, because nothing has been sent yet.
      captured.link = { url: buildReviewLink(token), expiresAt, deliveredBy: "caller" };

      // TOKEN-FREE, and deliberately so: `details` here is what an auditor reads
      // years later, and «who was sent a link to what, by whom, when» is the
      // whole of it. The recipient's address is in the row and in this audit
      // detail because the accountability question is «to whom»; the token is in
      // neither (INV-044).
      await recordAudit(tx, ctx, {
        action: "external_grant.issued", object_type: "external_access_grant",
        object_id: grantId,
        details: {
          requirementOccurrenceId: occurrenceId, projectId, contractId,
          recipientEmail: a.body.recipientEmail, recipientRole: a.body.recipientRole,
          approverRole, mayDecide, hmacKeyId: keyId, expiresAt,
          scopeKind: "requirement_occurrence",
        },
      }, { organizationId: workspaceId });

      // technical/events/event-catalog.csv:32 — `external_grant.issued`, v0.1-M5,
      // aggregate `external_access_grant`, idempotency effect key «TOKEN-FREE;
      // delivery is the one-time post-commit protocol (INV-044)», producer
      // `bff.occurrence_grants.issue` in v0.1. Consumer `notification_creator` —
      // NOT DEPLOYED, like every other consumer in this product
      // (supabase/functions/outbox-drain/index.ts). It is emitted anyway: the
      // row is what a future notifier replays from, and INV-044 is satisfied
      // because the payload has no token to leak.
      await enqueueOutbox(tx, ctx, {
        topic: "external_grant.issued",
        aggregate_type: "external_access_grant", aggregate_id: grantId,
        payload_version: 1,
        payload: {
          workspaceId, projectId, contractId, requirementOccurrenceId: occurrenceId,
          grantId, scopeKind: "requirement_occurrence",
          recipientRole: a.body.recipientRole, mayDecide, expiresAt,
          // The address is NOT in the payload. The outbox is drained by a
          // consumer that does not exist yet, into a delivery system that does
          // not exist yet; putting a personal address into a durable queue whose
          // consumer nobody has reviewed is a data-minimisation decision taken
          // by omission. A notifier that needs it reads the row.
        },
      }, { organizationId: workspaceId });

      const body: IssueOccurrenceGrantResponse = {
        grantId,
        requirementOccurrenceId: occurrenceId,
        approverRole,
        recipientEmail: a.body.recipientEmail,
        recipientRole: a.body.recipientRole,
        permissions: a.body.permissions,
        status: inserted.rows[0].status,
        expiresAt,
        revocationVersion: Number(inserted.rows[0].revocation_version),
        issuedAt,
      };
      return { status: 201, body };
    });
  });

  // `out.replayed` is true when the block above never ran, so `captured.link` is
  // null and the response carries none. Both conditions are read, and the `&&`
  // is not belt and braces: a future edit that moved the link build out of the
  // block would be caught by `replayed`, and one that stopped setting it would
  // be caught by the null. That is the INV-044 branch, not an error branch.
  const body: IssueOccurrenceGrantResponse =
    out.replayed || captured.link === null ? out.body : { ...out.body, link: captured.link };
  return { status: out.status, body, expiresAt: out.expiresAt };
});
