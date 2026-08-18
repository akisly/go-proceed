import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requirePartyEditCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { createPartyContactRequest, type PartyContactResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `party_contacts.create` — a named person at a party. THE OTHER ROW THE ACT'S
 * SIGNATORY SLOTS COULD NOT GET: `composeSignatorySlot` requires a
 * `partyContactId` beside its `projectPartyId`, and the compose route 422s if
 * the contact is not one of that party's. See `projects/[projectId]/parties/
 * route.ts` for the whole account of why both rows were unreachable until
 * 2026-08-18 and what that did to `statutory_acts.compose`.
 *
 * AUTHORIZATION FOLLOWS THE PARTY, EXACTLY AS THE LEGAL PROFILE DOES. A contact
 * is part of a party's record — the person who signs for it — so who may add
 * one is who may edit the party: `parties.manage` ordinarily, and the stricter
 * `own_legal_profiles.manage` when the party is one of the workspace's OWN
 * legal entities (INV-020: an own party's identity is frozen into every
 * published contract version, and the people who sign for it are part of that
 * identity). `requirePartyEditCapability` is the one function that already
 * encodes that branch, and this route calls it rather than re-deriving it —
 * two copies of the INV-020 rule is how they come to disagree.
 *
 * That also matches the database: `pc_insert` (0010) requires the workspace
 * `owner`/`admin` role, which is precisely the set `parties.manage` maps to.
 * The own-party tightening is the route being STRICTER than the policy in one
 * direction only, for a stated invariant, the same way the legal-profile route
 * already is — not a divergence, a deliberate one, and documented on
 * `requirePartyEditCapability` itself.
 *
 * WORKSPACE FROM THE PARTY ROW, NEVER FROM THE CALLER — party ids are global
 * and `parties_select` hides other tenants' rows, so a foreign id reads as
 * absent and the 404 is existence-safe by construction.
 *
 * No `qualification_certificate_*` here, and no `expectedVersion` — creating a
 * contact does not move the party's version, and the runtime table has no
 * certificate columns (TODOS.md records that divergence from schema-v0.1.sql;
 * it is a schema decision, not this route's).
 */
export const POST = commandRoute(createPartyContactRequest, async (a) => {
  const partyId = a.params.partyId;
  const notFound = () => new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Сторону не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!partyId) throw notFound();

  const partyContactId = randomUUID();
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const p = await tx.query(`select workspace_id from public.parties where id = $1`, [partyId]);
    if (p.rows.length === 0) throw notFound();
    const workspaceId: string = p.rows[0].workspace_id;

    return withIdempotency<PartyContactResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "party_contacts.create", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requirePartyEditCapability(tx, a.requestId, m.role, workspaceId, partyId);

      await tx.query(
        `insert into public.party_contacts
           (id, workspace_id, party_id, full_name, role_title, email, phone, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [partyContactId, workspaceId, partyId, a.body.fullName,
         a.body.roleTitle ?? null, a.body.email ?? null, a.body.phone ?? null, a.userId]);

      await recordAudit(tx, ctx, {
        action: "party_contact.created", object_type: "party_contact", object_id: partyContactId,
        // The name is the record; it is not repeated into the audit row.
        details: { partyId },
      }, { organizationId: workspaceId });
      return { status: 201, body: { partyContactId, version: 1 } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
