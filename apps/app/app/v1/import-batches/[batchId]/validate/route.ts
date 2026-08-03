import { createHash, randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { loadImportBatchResponse } from "../../../../../src/lib/import-batch";
import { validateImportBatchRequest } from "@goproceed/contracts";
import {
  parseCsv, parseXlsx, applyMapping, validateRow, buildPreview, normalizeUnitCode,
  workspaceCapabilities, canonicalPriceBasis, PARSER_VERSION,
  type SourceRow, type RowValidation, type ContractPins, type GovernanceRole,
  type RowResolution,
} from "@goproceed/domain";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

interface FileParse {
  fileId: string;
  format: "xlsx" | "csv";
  rows: SourceRow[];
  errors: string[];
}

/** JSON-safe mapped payload stored per row result (publish consumes it). */
function mappedPayload(v: RowValidation): Record<string, unknown> {
  return {
    sourceKey: v.row.sourceKey, workCode: v.row.workCode, description: v.row.description,
    section: v.row.section, unitText: v.row.unitText,
    normalizedUnit: normalizeUnitCode(v.row.unitText),
    quantity: v.quantity ? { scaled: v.quantity.scaled.toString(), scale: v.quantity.scale } : null,
    unitPrice: v.unitPrice ? { scaled: v.unitPrice.scaled.toString(), scale: v.unitPrice.scale } : null,
    unitPriceState: v.unitPriceState,
    derivedMinor: v.derivedMinor?.toString() ?? null,
    sourceMinor: v.sourceMinor?.toString() ?? null,
    // The canonical valuation decided HERE, under one pin generation, is what
    // publish writes verbatim — publish never re-derives money.
    valuationBasis: v.valuationBasis,
    net: v.net?.toString() ?? null,
    tax: v.tax?.toString() ?? null,
    gross: v.gross?.toString() ?? null,
    needsResolution: v.needsResolution,
    locationName: v.row.locationName,
    externalRef: v.row.externalRef,
  };
}

export const POST = commandRoute(validateImportBatchRequest, async (a) => {
  const batchId = a.params.batchId;
  if (!batchId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };

  // ── Phase 1 (read tx): resolve, authorize, load bytes + contract pins ──────
  const loaded = await withTenantTx(ctx, async (tx) => {
    const b = await tx.query(
      `select b.*, c.currency, c.tax_mode, c.tax_rate_bps, c.rounding_policy,
              c.source_tolerance_minor_units, c.source_tolerance_bps
         from public.import_batches b
         join public.contracts c on c.workspace_id = b.workspace_id and c.id = b.contract_id
        where b.id = $1`, [batchId]);
    if (b.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const row = b.rows[0];
    const workspaceId: string = row.workspace_id;
    const projectId: string = row.project_id;
    const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
    await requireProjectCapability(tx, a.requestId,
      { workspaceId, projectId, memberId: m.memberId, capability: "imports.manage" });
    if (!["created", "validated", "preview_ready", "failed"].includes(row.status)) {
      throw new HttpProblem(409, problem("IMPORT_JOB_CONFLICT",
        "Пакет імпорту в цьому стані не можна перевіряти.",
        { requestId: a.requestId, retryable: true, userAction: "refresh_import_job" }));
    }
    const files = await tx.query(
      `select id, detected_format, content_hash, source_bytes from public.import_files
        where workspace_id = $1 and import_batch_id = $2 order by uploaded_at, id`,
      [workspaceId, batchId]);
    if (files.rows.length === 0) {
      throw new HttpProblem(422, problem("VALIDATION_FAILED",
        "Додайте принаймні один файл перед перевіркою.", {
          requestId: a.requestId, retryable: false, userAction: "correct_fields",
          fieldErrors: [{ path: "files", message: "at least one file required" }],
        }));
    }
    return { row, workspaceId, projectId, role: m.role as GovernanceRole, files: files.rows };
  });

  // ── Phase 2 (no tx): safe parse — heavy work outside any transaction ───────
  const parses: FileParse[] = [];
  for (const f of loaded.files) {
    const bytes = new Uint8Array(f.source_bytes);
    if (f.detected_format === "csv") {
      const r = parseCsv(bytes);
      parses.push({ fileId: f.id, format: "csv", rows: r.ok ? r.rows : [], errors: r.ok ? [] : r.errors.map((e) => e.code) });
    } else {
      const r = await parseXlsx(bytes);
      parses.push({ fileId: f.id, format: "xlsx", rows: r.ok ? r.rows : [], errors: r.ok ? [] : r.errors });
    }
  }
  const failureCodes = [...new Set(parses.flatMap((p) => p.errors))];

  const mappingVersion: number = Number(loaded.row.mapping_version) + 1;
  const canonicalConfig = JSON.stringify({ mapping: a.body.mapping, config: a.body.config });
  const manifest = createHash("sha256")
    .update(loaded.files.map((f: { content_hash: string }) => f.content_hash).join("")
      + "|" + PARSER_VERSION + "|" + mappingVersion + "|" + canonicalConfig)
    .digest("hex");

  // ── Phase 3 (write tx): serialize on the batch row, record everything ──────
  const out = await withTenantTx(ctx, (tx) =>
    withIdempotency(tx, {
      organizationId: loaded.workspaceId, actorScope: `user:${a.userId}`,
      operationId: "import_batches.validate", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const locked = await tx.query(
        `select status, version, current_attempt from public.import_batches
          where workspace_id = $1 and id = $2 for update`,
        [loaded.workspaceId, batchId]);
      if (Number(locked.rows[0].version) !== a.body.expectedVersion) {
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          "Пакет імпорту було змінено. Оновіть сторінку і повторіть.",
          { requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry" }));
      }
      const attempt = Number(locked.rows[0].current_attempt) + 1;
      const statusWalk: string[] = ["parsing"];
      const setStatus = async (s: string) => {
        statusWalk.push(s);
        await tx.query(
          `update public.import_batches set status = $3, updated_at = now()
            where workspace_id = $1 and id = $2`, [loaded.workspaceId, batchId, s]);
      };
      await setStatus("parsing");

      if (failureCodes.length > 0) {
        // Fail closed: named codes, no publishable rows.
        await tx.query(
          `update public.import_batches
              set status = 'failed', failure_codes = $3, parser_version = $4,
                  mapping = $5, mapping_version = $6, parser_config = $7,
                  source_manifest_hash = $8, current_attempt = $9,
                  row_count = 0, blocking_count = 0, warning_count = 0,
                  needs_resolution_count = 0, totals = null,
                  version = version + 1, updated_at = now()
            where workspace_id = $1 and id = $2`,
          [loaded.workspaceId, batchId, failureCodes, PARSER_VERSION,
           JSON.stringify(a.body.mapping), mappingVersion, JSON.stringify(a.body.config),
           manifest, attempt]);
        await recordAudit(tx, ctx, {
          action: "import_batch.validated", object_type: "import_batch", object_id: batchId,
          details: { finalStatus: "failed", failureCodes, attempt },
        }, { organizationId: loaded.workspaceId });
        const resp = await loadImportBatchResponse(tx, loaded.workspaceId, batchId);
        return { status: 200, body: resp };
      }
      await setStatus("parsed");
      await setStatus("mapping");

      // Units known to the workspace.
      const unitRows = await tx.query(
        `select id, normalized_code, unit_precision from public.unit_definitions where workspace_id = $1`,
        [loaded.workspaceId]);
      const units = new Map<string, { id: string; precision: number }>(
        unitRows.rows.map((u) => [u.normalized_code, { id: u.id, precision: u.unit_precision }]));

      // Resolutions carry forward by (file, worksheet, source_row) identity —
      // the file id is part of the key because two CSVs in one batch both have
      // worksheet null and legitimately share row numbers. The approved
      // amounts travel with it so validateRow can reject a stale approval.
      const resolved = await tx.query(
        `select r.import_file_id, r.worksheet, r.source_row, s.chosen_basis,
                s.source_amount_minor_units, s.derived_amount_minor_units
           from public.source_amount_resolutions s
           join public.import_row_results r
             on r.workspace_id = s.workspace_id and r.import_batch_id = s.import_batch_id
            and r.id = s.row_result_id
          where s.workspace_id = $1 and s.import_batch_id = $2
          order by s.created_at, s.id`,
        [loaded.workspaceId, batchId]);
      const resolutionsByRow = new Map<string, RowResolution>();
      for (const r of resolved.rows) {
        // Later resolutions supersede earlier ones for the same physical row.
        resolutionsByRow.set(`${r.import_file_id}|${r.worksheet ?? ""}|${r.source_row}`, {
          chosenBasis: r.chosen_basis,
          approvedSourceMinor: r.source_amount_minor_units === null ? null : BigInt(r.source_amount_minor_units),
          approvedDerivedMinor: r.derived_amount_minor_units === null ? null : BigInt(r.derived_amount_minor_units),
        });
      }

      const pins: ContractPins = {
        currency: loaded.row.currency,
        taxMode: loaded.row.tax_mode,
        taxRateBps: loaded.row.tax_rate_bps,
        midpoint: (loaded.row.rounding_policy?.midpoint === "half_even" ? "half_even" : "half_up"),
        minorScale: 2,
        tolAbsMinor: BigInt(loaded.row.source_tolerance_minor_units),
        tolBps: Number(loaded.row.source_tolerance_bps),
        // Derived from the contract's tax mode, never assumed: an inclusive
        // contract carries gross prices and its tax is extracted, not added.
        priceBasis: canonicalPriceBasis(loaded.row.tax_mode),
        locale: a.body.config.locale,
      };

      // Map + validate per file; auto-register unseen units when permitted.
      const canManageUnits = workspaceCapabilities(loaded.role).includes("units.manage");
      interface RowRecord { fileId: string; v: RowValidation; sourceCells: Record<string, unknown> }
      const records: RowRecord[] = [];
      for (const p of parses) {
        const { mapped } = applyMapping(p.rows, a.body.mapping, a.body.config);
        const cellsByRow = new Map(p.rows.map((r) => [`${r.worksheet ?? ""}|${r.rowNo}`, r.cells]));
        for (const mr of mapped) {
          const code = normalizeUnitCode(mr.unitText);
          let unit = units.get(code) ?? null;
          if (!unit && code !== "" && canManageUnits) {
            const created = await tx.query(
              `insert into public.unit_definitions (id, workspace_id, code, created_by)
               values ($1,$2,$3,$4)
               on conflict (workspace_id, normalized_code) do nothing
               returning id, unit_precision`,
              [randomUUID(), loaded.workspaceId, mr.unitText, a.userId]);
            // DO NOTHING returns no row when a concurrent import registered the
            // same code first; re-read it instead of failing the whole batch
            // with UNIT_UNKNOWN.
            const resolvedUnit = created.rows[0] ?? (await tx.query(
              `select id, unit_precision from public.unit_definitions
                where workspace_id = $1 and normalized_code = $2`,
              [loaded.workspaceId, code])).rows[0];
            if (resolvedUnit) {
              unit = { id: resolvedUnit.id, precision: resolvedUnit.unit_precision };
              units.set(code, unit);
            }
          }
          const v = validateRow(mr, unit ? { normalizedCode: code, precision: unit.precision } : null,
            pins, resolutionsByRow.get(`${p.fileId}|${mr.worksheet ?? ""}|${mr.sourceRowNo}`) ?? null);
          records.push({
            fileId: p.fileId, v,
            sourceCells: cellsByRow.get(`${mr.worksheet ?? ""}|${mr.sourceRowNo}`) ?? {},
          });
        }
      }
      await setStatus("validated");

      const preview = buildPreview(records.map((r) => r.v));
      // Chunked multi-row INSERT: one round trip per CHUNK_ROWS rows instead of
      // one per row, so a real estimate does not hold the transaction open (and
      // the batch row locked) for minutes.
      const CHUNK_ROWS = 500;
      for (let start = 0; start < records.length; start += CHUNK_ROWS) {
        const chunk = records.slice(start, start + CHUNK_ROWS);
        const values: unknown[] = [];
        const tuples = chunk.map((r, i) => {
          const b = i * 13;
          values.push(randomUUID(), loaded.workspaceId, batchId, r.fileId, attempt,
            r.v.row.worksheet, r.v.row.sourceRowNo,
            JSON.stringify(r.sourceCells), JSON.stringify(mappedPayload(r.v)),
            r.v.severity, r.v.codes, PARSER_VERSION, mappingVersion);
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},`
            + `$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13})`;
        }).join(",");
        await tx.query(
          `insert into public.import_row_results
             (id, workspace_id, import_batch_id, import_file_id, attempt, worksheet, source_row,
              source_cells, mapped, severity, error_codes, parser_version, mapping_version)
           values ${tuples}`, values);
      }

      const finalStatus = preview.rowCount === 0
        ? "failed"
        : preview.blockingCount === 0 ? "preview_ready" : "validated";
      await tx.query(
        `update public.import_batches
            set status = $3, failure_codes = $4, parser_version = $5,
                mapping = $6, mapping_version = $7, parser_config = $8,
                source_manifest_hash = $9, current_attempt = $10,
                row_count = $11, blocking_count = $12, warning_count = $13,
                needs_resolution_count = $14, totals = $15,
                version = version + 1, updated_at = now()
          where workspace_id = $1 and id = $2`,
        [loaded.workspaceId, batchId, finalStatus,
         preview.rowCount === 0 ? ["IMPORT_EMPTY"] : [],
         PARSER_VERSION, JSON.stringify(a.body.mapping), mappingVersion,
         JSON.stringify(a.body.config), manifest, attempt,
         preview.rowCount, preview.blockingCount, preview.warningCount,
         preview.needsResolutionCount, JSON.stringify(preview.totals)]);
      await recordAudit(tx, ctx, {
        action: "import_batch.validated", object_type: "import_batch", object_id: batchId,
        details: { finalStatus, statusWalk, attempt, ...preview, totals: undefined },
      }, { organizationId: loaded.workspaceId });
      const resp = await loadImportBatchResponse(tx, loaded.workspaceId, batchId);
      return { status: 200, body: resp };
    }));
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
