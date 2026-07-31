import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requirePartyEditCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { putLegalProfileRequest, type LegalProfileResponse } from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@aktflow/database";

export const runtime = "nodejs";

export const PUT = commandRoute(putLegalProfileRequest, async (a) => {
  const partyId = a.params.partyId;
  if (!partyId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Сторону не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const p = await tx.query(`select workspace_id from public.parties where id = $1`, [partyId]);
    if (p.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Сторону не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = p.rows[0].workspace_id;
    return withIdempotency<LegalProfileResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "parties.legal_profile.put", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      // INV-020: stricter permission when this party is an own legal entity.
      await requirePartyEditCapability(tx, a.requestId, m.role, workspaceId, partyId);
      const existing = await tx.query(
        `select id, version from public.party_legal_profiles where workspace_id = $1 and party_id = $2`,
        [workspaceId, partyId]);
      if (existing.rows.length === 0) {
        const profileId = randomUUID();
        await tx.query(
          `insert into public.party_legal_profiles
             (id, workspace_id, party_id, official_name, edrpou, vat_number, tax_status, legal_address, country_code, updated_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [profileId, workspaceId, partyId, a.body.officialName, a.body.edrpou ?? null,
           a.body.vatNumber ?? null, a.body.taxStatus ?? null, a.body.legalAddress ?? null,
           a.body.countryCode, a.userId]);
        await recordAudit(tx, ctx, {
          action: "party_legal_profile.updated", object_type: "party_legal_profile",
          object_id: profileId, details: {},
        }, { organizationId: workspaceId, objectVersion: 1 });
        return { status: 201, body: { profileId, version: 1 } };
      }
      const profileId: string = existing.rows[0].id;
      const upd = await tx.query(
        `update public.party_legal_profiles
            set official_name=$3, edrpou=$4, vat_number=$5, tax_status=$6,
                legal_address=$7, country_code=$8, updated_by=$9,
                version = version + 1, updated_at = now()
          where workspace_id = $1 and party_id = $2
            and ($10::bigint is null or version = $10::bigint)
          returning version`,
        [workspaceId, partyId, a.body.officialName, a.body.edrpou ?? null,
         a.body.vatNumber ?? null, a.body.taxStatus ?? null, a.body.legalAddress ?? null,
         a.body.countryCode, a.userId, a.body.expectedVersion ?? null]);
      if (upd.rows.length === 0) {
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          "Юридичний профіль було змінено. Оновіть сторінку і повторіть.",
          { requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry" }));
      }
      await recordAudit(tx, ctx, {
        action: "party_legal_profile.updated", object_type: "party_legal_profile",
        object_id: profileId, details: {},
      }, { organizationId: workspaceId, objectVersion: Number(upd.rows[0].version) });
      return { status: 200, body: { profileId, version: Number(upd.rows[0].version) } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
