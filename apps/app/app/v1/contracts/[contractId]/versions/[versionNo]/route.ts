import { queryRoute } from "../../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../../src/lib/http";
import type { ContractVersionResponse, WorkItemView } from "@goproceed/contracts";
import { computeDiff, type DiffComparable } from "@goproceed/domain";
import { withTenantTx } from "@goproceed/database";

export const runtime = "nodejs";

export const GET = queryRoute(async (a) => {
  const contractId = a.params.contractId;
  const versionNo = Number(a.params.versionNo);
  if (!contractId || !Number.isInteger(versionNo) || versionNo < 1) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Версію договору не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx): Promise<ContractVersionResponse> => {
    const c = await tx.query(
      `select workspace_id, project_id from public.contracts where id = $1`, [contractId]);
    if (c.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Договір не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = c.rows[0].workspace_id;
    const projectId: string = c.rows[0].project_id;
    const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
    await requireProjectCapability(tx, a.requestId,
      { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });
    const v = await tx.query(
      `select * from public.contract_versions
        where workspace_id = $1 and contract_id = $2 and version_no = $3`,
      [workspaceId, contractId, versionNo]);
    if (v.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Версію договору не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const version = v.rows[0];
    const items = await tx.query(
      `select * from public.work_items
        where workspace_id = $1 and contract_version_id = $2 order by position`,
      [workspaceId, version.id]);
    const workItems: WorkItemView[] = items.rows.map((w) => ({
      workItemId: w.id,
      position: w.position,
      sourceKey: w.source_key,
      workCode: w.work_code,
      description: w.description,
      section: w.section,
      unitCode: w.unit_code,
      unitPrecision: w.unit_precision,
      contractQuantity: String(w.contract_quantity),
      unitPriceState: w.unit_price_state,
      unitPriceDecimal: w.unit_price_decimal === null ? null : String(w.unit_price_decimal),
      valuationBasis: w.valuation_basis,
      netMinor: String(w.net_amount_minor_units),
      taxMinor: String(w.tax_amount_minor_units),
      grossMinor: String(w.gross_amount_minor_units),
      sourceAmountMinor: w.source_amount_minor_units === null ? null : String(w.source_amount_minor_units),
      predecessorWorkItemId: w.predecessor_work_item_id,
    }));

    let diff: ContractVersionResponse["diff"] = null;
    if (version.supersedes_version_id) {
      const prevItems = await tx.query(
        `select id, contract_quantity, unit_code, unit_price_decimal, net_amount_minor_units
           from public.work_items where workspace_id = $1 and contract_version_id = $2`,
        [workspaceId, version.supersedes_version_id]);
      const prevById = new Map<string, DiffComparable>(prevItems.rows.map((p) => [p.id, {
        contractQuantity: String(p.contract_quantity),
        unitCode: p.unit_code,
        unitPriceDecimal: p.unit_price_decimal === null ? null : String(p.unit_price_decimal),
        netMinor: String(p.net_amount_minor_units),
      }]));
      diff = computeDiff(prevById, workItems.map((w) => ({
        predecessorId: w.predecessorWorkItemId,
        fields: {
          contractQuantity: w.contractQuantity,
          unitCode: w.unitCode,
          unitPriceDecimal: w.unitPriceDecimal,
          netMinor: w.netMinor,
        },
      })));
    }

    return {
      contractVersionId: version.id,
      contractId,
      versionNo,
      status: "published",
      publishedAt: new Date(version.published_at).toISOString(),
      sourceManifestHash: version.source_manifest_hash,
      supersedesVersionId: version.supersedes_version_id,
      pins: {
        currency: version.currency,
        taxMode: version.tax_mode,
        taxRateBps: version.tax_rate_bps,
        roundingPolicy: version.rounding_policy,
        toleranceMinorUnits: String(version.source_tolerance_minor_units),
        toleranceBps: Number(version.source_tolerance_bps),
      },
      partySnapshots: { own: version.own_party_snapshot, customer: version.customer_party_snapshot },
      workItems,
      diff,
    };
  });
  return { status: 200, body };
});
