import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireWorkspaceCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { createOwnProfileRequest, type OwnProfileResponse } from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@aktflow/database";

export const runtime = "nodejs";

export const POST = commandRoute(createOwnProfileRequest, async (a) => {
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
    return withIdempotency<OwnProfileResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "parties.own_profile.create", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      // INV-020: strictly narrower than parties.manage (owner-only in v0.1-M1).
      requireWorkspaceCapability(a.requestId, m.role, "own_legal_profiles.manage");
      // Own-entity completeness: official name AND ЄДРПОУ must already exist.
      const lp = await tx.query(
        `select official_name, edrpou from public.party_legal_profiles
          where workspace_id = $1 and party_id = $2`, [workspaceId, partyId]);
      if (lp.rows.length === 0 || !lp.rows[0].edrpou || !String(lp.rows[0].official_name ?? "").trim()) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Власна юридична особа потребує повного юридичного профілю (назва та ЄДРПОУ).", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "legalProfile", message: "official_name and edrpou required" }],
          }));
      }
      try {
        await tx.query(
          `insert into public.own_legal_entity_profiles (workspace_id, party_id, created_by)
           values ($1,$2,$3)`,
          [workspaceId, partyId, a.userId]);
      } catch (e) {
        if (e instanceof Error && /own_legal_entity_profiles_pkey/.test(e.message)) {
          throw new HttpProblem(409, problem("VERSION_CONFLICT",
            "Власний профіль уже існує.",
            { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
        }
        throw e;
      }
      await recordAudit(tx, ctx, {
        action: "own_legal_entity_profile.created", object_type: "own_legal_entity_profile",
        object_id: partyId, details: {},
      }, { organizationId: workspaceId });
      return { status: 201, body: { partyId } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
