import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { createContractRequest, type CreateContractResponse } from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@aktflow/database";

export const runtime = "nodejs";

export const POST = commandRoute(createContractRequest, async (a) => {
  const projectId = a.params.projectId;
  if (!projectId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const p = await tx.query(`select workspace_id from public.projects where id = $1`, [projectId]);
    if (p.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = p.rows[0].workspace_id;
    return withIdempotency<CreateContractResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "contracts.create", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "contracts.edit" });
      // Both parties must be visible in THIS workspace (RLS makes foreign
      // parties indistinguishable from absent → 404-equivalent 422 here).
      const cust = await tx.query(
        `select 1 from public.parties where workspace_id = $1 and id = $2`,
        [workspaceId, a.body.customerPartyId]);
      if (cust.rows.length === 0) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Сторону-замовника не знайдено в цьому робочому просторі.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "customerPartyId", message: "unknown party" }],
          }));
      }
      // INV-002 pre-check (the composite FK is the hard guarantee; this gives
      // the clean catalog-coded 422 instead of a raw FK error).
      const own = await tx.query(
        `select 1 from public.own_legal_entity_profiles where workspace_id = $1 and party_id = $2`,
        [workspaceId, a.body.ownPartyId]);
      if (own.rows.length === 0) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Обрана сторона не позначена як власна юридична особа.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "ownPartyId", message: "must hold an own legal entity profile" }],
          }));
      }
      const contractId = randomUUID();
      try {
        await tx.query(
          `insert into public.contracts
             (id, workspace_id, project_id, own_party_id, customer_party_id, contract_no, title,
              currency, tax_mode, tax_rate_bps, terms, approval_policy, rounding_policy,
              source_tolerance_minor_units, source_tolerance_bps, created_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [contractId, workspaceId, projectId, a.body.ownPartyId, a.body.customerPartyId,
           a.body.contractNo, a.body.title ?? null, a.body.currency, a.body.taxMode,
           a.body.taxRateBps ?? null, JSON.stringify(a.body.terms),
           JSON.stringify(a.body.approvalPolicy),
           JSON.stringify({ midpoint: a.body.roundingPolicy.midpoint, scope: "work_item_version_pool" }),
           a.body.toleranceMinorUnits, a.body.toleranceBps, a.userId]);
      } catch (e) {
        // INV-022: normalized number unique within (workspace, own party).
        if (e instanceof Error && /contracts_number_unique/.test(e.message)) {
          throw new HttpProblem(409, problem("VERSION_CONFLICT",
            "Договір із таким номером уже існує для цієї власної юридичної особи.",
            { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
        }
        throw e;
      }
      await recordAudit(tx, ctx, {
        action: "contract.created", object_type: "contract", object_id: contractId, details: {},
      }, { organizationId: workspaceId });
      await enqueueOutbox(tx, ctx, {
        topic: "contract.created", aggregate_type: "contract",
        aggregate_id: contractId, payload_version: 1,
        payload: { workspaceId, projectId, contractId },
      }, { organizationId: workspaceId });
      return { status: 201, body: { contractId, version: 1 } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
