import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { publishImportBatchRequest, type PublishImportBatchResponse } from "@aktflow/contracts";
import { matchLineage, decimalText, canonicalPriceBasis, type TaxMode } from "@aktflow/domain";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@aktflow/database";

export const runtime = "nodejs";

interface MappedJson {
  sourceKey: string | null; workCode: string | null; description: string;
  section: string | null; unitText: string; normalizedUnit: string;
  quantity: { scaled: string; scale: number } | null;
  unitPrice: { scaled: string; scale: number } | null;
  unitPriceState: "known" | "zero" | "missing";
  derivedMinor: string | null; sourceMinor: string | null;
  valuationBasis: "unit_price_derived" | "approved_source_amount";
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
      // Publishing a contract version is the ledger event of v0.1-M1: it fixes
      // the money pool every later exposure slice is carved from. It shipped on
      // the 30-day default, which TODOS.md carried as a deferred finding.
      idempotencyClass: "ledger_400d",
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

      // Publishable rows: latest attempt, non-blocking, in deterministic source
      // order. import_file_id leads the ordering because two CSVs in one batch
      // both carry worksheet null and share row numbers.
      const rows = await tx.query(
        `select r.id, r.import_file_id, r.worksheet, r.source_row, r.mapped, r.error_codes
           from public.import_row_results r
           join public.import_files f
             on f.workspace_id = r.workspace_id and f.id = r.import_file_id
          where r.workspace_id = $1 and r.import_batch_id = $2 and r.attempt = $3
            and r.severity <> 'blocking'
          order by f.uploaded_at, f.id, r.worksheet nulls first, r.source_row`,
        [workspaceId, batchId, batch.current_attempt]);

      // Units by normalized code.
      const unitRows = await tx.query(
        `select id, normalized_code, unit_precision, code from public.unit_definitions where workspace_id = $1`,
        [workspaceId]);
      const units = new Map(unitRows.rows.map(
        (u) => [u.normalized_code, { id: u.id as string, precision: u.unit_precision as number, code: u.code as string }]));

      // Locations named in the mapped column, resolved find-or-create per
      // project (same auto-registration pattern as unit_definitions).
      const locationIds = new Map<string, string>();
      const wantedLocations = [...new Set(rows.rows
        .map((r) => (r.mapped as MappedJson).locationName)
        .filter((n): n is string => typeof n === "string" && n.trim() !== "")
        .map((n) => n.trim()))];
      if (wantedLocations.length > 0) {
        const existing = await tx.query(
          `select id, name from public.locations
            where workspace_id = $1 and project_id = $2 and name = any($3::text[])`,
          [workspaceId, projectId, wantedLocations]);
        for (const l of existing.rows) locationIds.set(l.name, l.id);
        for (const name of wantedLocations) {
          if (locationIds.has(name)) continue;
          const created = await tx.query(
            `insert into public.locations (id, workspace_id, project_id, name, created_by)
             values ($1,$2,$3,$4,$5) returning id`,
            [randomUUID(), workspaceId, projectId, name, a.userId]);
          locationIds.set(name, created.rows[0].id);
        }
      }

      // Predecessor lineage against the superseded version. ORDER BY position
      // keeps matchLineage's "first match wins" rule deterministic when the
      // previous version holds duplicate source keys.
      let lineage = new Map<number, string>();
      if (supersedesVersionId) {
        const prevItems = await tx.query(
          `select id, source_key, work_code, description from public.work_items
            where workspace_id = $1 and contract_version_id = $2
            order by position`,
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

      // Money is NOT recomputed here. validate decided each row's canonical
      // value under one pin generation and stored it; publish writes exactly
      // that, so a pin edited between validate and publish cannot produce a
      // version whose amounts contradict its own recorded tax rate.
      const priceBasis = canonicalPriceBasis(contract.tax_mode as TaxMode);
      const COLS = 30;
      const rowValues: unknown[][] = rows.rows.map((r, i) => {
        const position = i + 1;
        const mp = r.mapped as MappedJson;
        const unit = units.get(mp.normalizedUnit);
        if (!unit || !mp.quantity) {
          // Defensive: a non-blocking row always carries a resolved unit + quantity.
          throw new Error(`publish invariant: row ${r.id} lacks unit or quantity`);
        }
        const approvedBasis = mp.valuationBasis === "approved_source_amount";
        return [randomUUID(), workspaceId, projectId, contractId, contractVersionId, position,
          mp.sourceKey, mp.workCode, mp.description, mp.section,
          unit.id, unit.code, unit.precision,
          decimalText(mp.quantity.scaled, mp.quantity.scale),
          mp.unitPriceState,
          // Tied to the STATE, not to the presence of a parsed value. A price of
          // 0,00 parses into a Decimal whose object is truthy, so the old
          // `mp.unitPrice ? …` wrote "0.00" alongside state 'zero' and violated
          // `(unit_price_state = 'known') = (unit_price_decimal is not null)` —
          // publishing any estimate containing a zero-priced row returned 500.
          // Zero-priced rows are ordinary (work bundled into another line).
          mp.unitPriceState === "known" && mp.unitPrice
            ? decimalText(mp.unitPrice.scaled, mp.unitPrice.scale) : null,
          mp.unitPrice ? priceBasis : null,
          approvedBasis ? "approved_source_amount" : "unit_price_derived",
          contract.currency, contract.tax_mode, contract.tax_rate_bps,
          mp.sourceMinor, approvedBasis ? mp.sourceMinor : null,
          mp.net ?? "0", mp.tax ?? "0", mp.gross ?? "0",
          mp.locationName ? locationIds.get(mp.locationName.trim()) ?? null : null,
          mp.externalRef, r.id, lineage.get(position) ?? null];
      });
      const CHUNK_ROWS = 500;
      for (let start = 0; start < rowValues.length; start += CHUNK_ROWS) {
        const chunk = rowValues.slice(start, start + CHUNK_ROWS);
        const values = chunk.flat();
        const tuples = chunk.map((_, i) => {
          const b = i * COLS;
          return `(${Array.from({ length: COLS }, (_, c) => `$${b + c + 1}`).join(",")})`;
        }).join(",");
        await tx.query(
          `insert into public.work_items
             (id, workspace_id, project_id, contract_id, contract_version_id, position,
              source_key, work_code, description, section,
              unit_definition_id, unit_code, unit_precision,
              contract_quantity, unit_price_state, unit_price_decimal, price_basis,
              valuation_basis, currency, tax_mode, tax_rate_bps,
              source_amount_minor_units, approved_amount_minor_units,
              net_amount_minor_units, tax_amount_minor_units, gross_amount_minor_units,
              location_id, external_ref, source_row_result_id, predecessor_work_item_id)
           values ${tuples}`, values);
      }
      const position = rowValues.length;

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
