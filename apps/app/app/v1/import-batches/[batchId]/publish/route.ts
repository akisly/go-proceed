import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { publishImportBatchRequest, type PublishImportBatchResponse } from "@aktflow/contracts";
import { matchLineage, decimalText, taxSplit, type Midpoint, type TaxMode } from "@aktflow/domain";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@aktflow/database";

export const runtime = "nodejs";

interface MappedJson {
  sourceKey: string | null; workCode: string | null; description: string;
  section: string | null; unitText: string; normalizedUnit: string;
  quantity: { scaled: string; scale: number } | null;
  unitPrice: { scaled: string; scale: number } | null;
  unitPriceState: "known" | "zero" | "missing";
  derivedMinor: string | null; sourceMinor: string | null;
  net: string | null; tax: string | null; gross: string | null;
  locationName: string | null; externalRef: string | null;
}

export const POST = commandRoute(publishImportBatchRequest, async (a) => {
  const batchId = a.params.batchId;
  if (!batchId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const pre = await tx.query(
      `select workspace_id, project_id, contract_id from public.import_batches where id = $1`, [batchId]);
    if (pre.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = pre.rows[0].workspace_id;
    const projectId: string = pre.rows[0].project_id;
    const contractId: string = pre.rows[0].contract_id;
    return withIdempotency<PublishImportBatchResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "import_batches.publish", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "imports.publish" });

      // Lock ORDER: contract first (serializes version_no per contract), then batch.
      const c = await tx.query(
        `select * from public.contracts where workspace_id = $1 and id = $2 for update`,
        [workspaceId, contractId]);
      const b = await tx.query(
        `select * from public.import_batches where workspace_id = $1 and id = $2 for update`,
        [workspaceId, batchId]);
      const batch = b.rows[0];
      const contract = c.rows[0];
      if (batch.status !== "preview_ready") {
        throw new HttpProblem(409, problem("IMPORT_JOB_CONFLICT",
          "Пакет імпорту не готовий до публікації.",
          { requestId: a.requestId, retryable: true, userAction: "refresh_import_job" }));
      }
      if (Number(batch.version) !== a.body.expectedVersion) {
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          "Пакет імпорту було змінено. Оновіть сторінку і повторіть.",
          { requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry" }));
      }
      if (batch.source_manifest_hash !== a.body.confirmedManifestHash) {
        throw new HttpProblem(409, problem("IMPORT_REVIEW_STALE",
          "Джерело або мапінг змінилися після перегляду. Запустіть перевірку знову.",
          { requestId: a.requestId, retryable: false, userAction: "run_new_dry_run" }));
      }

      // Immutable party snapshots from CURRENT profiles.
      const snap = async (partyId: string): Promise<Record<string, unknown>> => {
        const r = await tx.query(
          `select p.display_name, lp.official_name, lp.edrpou, lp.vat_number,
                  lp.tax_status, lp.legal_address, lp.country_code
             from public.parties p
             left join public.party_legal_profiles lp
               on lp.workspace_id = p.workspace_id and lp.party_id = p.id
            where p.workspace_id = $1 and p.id = $2`, [workspaceId, partyId]);
        return r.rows[0] ?? {};
      };
      const ownSnapshot = await snap(contract.own_party_id);
      const customerSnapshot = await snap(contract.customer_party_id);

      const prev = await tx.query(
        `select id, version_no from public.contract_versions
          where workspace_id = $1 and contract_id = $2 order by version_no desc limit 1`,
        [workspaceId, contractId]);
      const versionNo = (prev.rows[0]?.version_no ?? 0) + 1;
      const supersedesVersionId: string | null = prev.rows[0]?.id ?? null;

      // Publishable rows: latest attempt, non-blocking, in source order.
      const rows = await tx.query(
        `select id, worksheet, source_row, mapped, error_codes from public.import_row_results
          where workspace_id = $1 and import_batch_id = $2 and attempt = $3
            and severity <> 'blocking'
          order by worksheet nulls first, source_row`,
        [workspaceId, batchId, batch.current_attempt]);

      // Resolutions keyed by (worksheet, source_row) across attempts.
      const resolutions = await tx.query(
        `select r.worksheet, r.source_row, s.chosen_basis
           from public.source_amount_resolutions s
           join public.import_row_results r
             on r.workspace_id = s.workspace_id and r.import_batch_id = s.import_batch_id
            and r.id = s.row_result_id
          where s.workspace_id = $1 and s.import_batch_id = $2`,
        [workspaceId, batchId]);
      const basisByRow = new Map(resolutions.rows.map(
        (r) => [`${r.worksheet ?? ""}|${r.source_row}`, r.chosen_basis as string]));

      // Units by normalized code.
      const unitRows = await tx.query(
        `select id, normalized_code, unit_precision, code from public.unit_definitions where workspace_id = $1`,
        [workspaceId]);
      const units = new Map(unitRows.rows.map(
        (u) => [u.normalized_code, { id: u.id as string, precision: u.unit_precision as number, code: u.code as string }]));

      // Predecessor lineage against the superseded version.
      let lineage = new Map<number, string>();
      if (supersedesVersionId) {
        const prevItems = await tx.query(
          `select id, source_key, work_code, description from public.work_items
            where workspace_id = $1 and contract_version_id = $2`,
          [workspaceId, supersedesVersionId]);
        lineage = matchLineage(
          prevItems.rows.map((p) => ({
            id: p.id, sourceKey: p.source_key, workCode: p.work_code, description: p.description,
          })),
          rows.rows.map((r, i) => {
            const mp = r.mapped as MappedJson;
            return { position: i + 1, sourceKey: mp.sourceKey, workCode: mp.workCode, description: mp.description };
          }));
      }

      const contractVersionId = randomUUID();
      await tx.query(
        `insert into public.contract_versions
           (id, workspace_id, project_id, contract_id, version_no, status,
            own_party_snapshot, customer_party_snapshot, currency, tax_mode, tax_rate_bps,
            terms, approval_policy, rounding_policy,
            source_tolerance_minor_units, source_tolerance_bps,
            import_batch_id, source_manifest_hash, supersedes_version_id, published_by)
         values ($1,$2,$3,$4,$5,'published',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [contractVersionId, workspaceId, projectId, contractId, versionNo,
         JSON.stringify(ownSnapshot), JSON.stringify(customerSnapshot),
         contract.currency, contract.tax_mode, contract.tax_rate_bps,
         JSON.stringify(contract.terms), JSON.stringify(contract.approval_policy),
         JSON.stringify(contract.rounding_policy),
         contract.source_tolerance_minor_units, contract.source_tolerance_bps,
         batchId, batch.source_manifest_hash, supersedesVersionId, a.userId]);

      const midpoint: Midpoint = contract.rounding_policy?.midpoint === "half_even" ? "half_even" : "half_up";
      let position = 0;
      for (const r of rows.rows) {
        position++;
        const mp = r.mapped as MappedJson;
        const unit = units.get(mp.normalizedUnit);
        if (!unit || !mp.quantity) {
          // Defensive: a non-blocking row always carries a resolved unit + quantity.
          throw new Error(`publish invariant: row ${r.id} lacks unit or quantity`);
        }
        const key = `${r.worksheet ?? ""}|${r.source_row}`;
        const approvedBasis = basisByRow.get(key) === "approved_source_amount" && mp.sourceMinor !== null;
        let net: bigint, tax: bigint, gross: bigint;
        if (approvedBasis) {
          const split = taxSplit(BigInt(mp.sourceMinor!), contract.tax_rate_bps,
            contract.tax_mode as TaxMode, midpoint);
          net = split.net; tax = split.tax; gross = split.gross;
        } else {
          net = BigInt(mp.net ?? "0"); tax = BigInt(mp.tax ?? "0"); gross = BigInt(mp.gross ?? "0");
        }
        await tx.query(
          `insert into public.work_items
             (id, workspace_id, project_id, contract_id, contract_version_id, position,
              source_key, work_code, description, section,
              unit_definition_id, unit_code, unit_precision,
              contract_quantity, unit_price_state, unit_price_decimal, price_basis,
              valuation_basis, currency, tax_mode, tax_rate_bps,
              source_amount_minor_units, approved_amount_minor_units,
              net_amount_minor_units, tax_amount_minor_units, gross_amount_minor_units,
              external_ref, source_row_result_id, predecessor_work_item_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
          [randomUUID(), workspaceId, projectId, contractId, contractVersionId, position,
           mp.sourceKey, mp.workCode, mp.description, mp.section,
           unit.id, unit.code, unit.precision,
           decimalText(mp.quantity.scaled, mp.quantity.scale),
           mp.unitPriceState,
           mp.unitPrice ? decimalText(mp.unitPrice.scaled, mp.unitPrice.scale) : null,
           mp.unitPrice ? "net" : null,
           approvedBasis ? "approved_source_amount" : "unit_price_derived",
           contract.currency, contract.tax_mode, contract.tax_rate_bps,
           mp.sourceMinor, approvedBasis ? mp.sourceMinor : null,
           net.toString(), tax.toString(), gross.toString(),
           mp.externalRef, r.id, lineage.get(position) ?? null]);
      }

      await tx.query(
        `update public.import_batches
            set status = 'published', published_version_id = $3, version = version + 1, updated_at = now()
          where workspace_id = $1 and id = $2`,
        [workspaceId, batchId, contractVersionId]);
      await recordAudit(tx, ctx, {
        action: "contract_version.published", object_type: "contract_version",
        object_id: contractVersionId, details: { versionNo, workItemCount: position },
      }, { organizationId: workspaceId, objectVersion: versionNo });
      await enqueueOutbox(tx, ctx, {
        topic: "contract_version.published", aggregate_type: "contract_version",
        aggregate_id: contractVersionId, payload_version: 1,
        payload: { workspaceId, projectId, contractId, contractVersionId, versionNo },
      }, { organizationId: workspaceId });
      return {
        status: 201,
        body: { contractVersionId, versionNo, workItemCount: position, supersedesVersionId },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
