import { queryRoute } from "../../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../../src/lib/http";
import type { ContractVersionResponse, WorkItemView } from "@goproceed/contracts";
import { workItemView } from "../../../../../../src/lib/manual-baseline";
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
    // THE SHARED MAPPER, and this call is a correction. `workItemView`'s own
    // comment says it is «Shared by contract_versions.get and the three
    // work_items commands so that a line reads identically however it is
    // fetched — the M1 exit gate is that a hand-typed line is
    // indistinguishable from an imported one, and two mappers are two chances
    // for it not to be». This route nonetheless carried a hand-written second
    // copy of it, field for field. The copy is what made the drift possible,
    // and the drift is not hypothetical: adding `workTypeKey` to the view
    // (migration 0050) would have left THIS read — the read a caller recomputes
    // `confirmedManifestHash` from — silently missing the field, and every
    // publish would have failed with VERSION_CONFLICT against a digest the
    // caller could not reproduce.
    const workItems: WorkItemView[] = items.rows.map(workItemView);

    // The predecessor's lines are only comparable if the predecessor is a real
    // agreement. `contract_versions.create` already refuses to supersede
    // anything but a published version, and this guard is the reader's half of
    // the same rule.
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

    // READ OFF THE ROW, NEVER ASSUMED. Before migration 0042 a contract version
    // could only be published, and this returned the literal "published" with
    // `new Date(version.published_at)`. A draft carries NULL in both columns
    // (contract_versions_draft_check), and `new Date(null)` is the epoch — so
    // the unchanged code would have announced every hand-typed draft as
    // published and dated it 1970-01-01. This read is also what
    // contract_versions.publish's manifest confirmation is computed from, which
    // is precisely why a draft must be readable and must say that it is one.
    const status: ContractVersionResponse["status"] =
      version.status === "draft" ? "draft" : "published";
    return {
      contractVersionId: version.id,
      contractId,
      versionNo,
      status,
      publishedAt: version.published_at === null
        ? null : new Date(version.published_at).toISOString(),
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
