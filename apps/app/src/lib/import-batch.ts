import type { Tx } from "@aktflow/database";
import type { ImportBatchResponse } from "@aktflow/contracts";

/** Assemble the shared ImportBatchResponse (used by batch GET and validate). */
export async function loadImportBatchResponse(
  tx: Tx, workspaceId: string, batchId: string,
): Promise<ImportBatchResponse | null> {
  const b = await tx.query(
    `select * from public.import_batches where workspace_id = $1 and id = $2`,
    [workspaceId, batchId]);
  if (b.rows.length === 0) return null;
  const batch = b.rows[0];
  const files = await tx.query(
    `select id, filename, byte_size, content_hash, detected_format
       from public.import_files where workspace_id = $1 and import_batch_id = $2
      order by uploaded_at, id`,
    [workspaceId, batchId]);
  const rowResults = await tx.query(
    `select id, worksheet, source_row, severity, error_codes, mapped
       from public.import_row_results
      where workspace_id = $1 and import_batch_id = $2 and attempt = $3
      order by case severity when 'blocking' then 0 when 'warning' then 1 else 2 end, source_row
      limit 500`,
    [workspaceId, batchId, batch.current_attempt]);
  const resolutions = await tx.query(
    `select id, row_result_id, chosen_basis, reason
       from public.source_amount_resolutions
      where workspace_id = $1 and import_batch_id = $2
      order by created_at, id`,
    [workspaceId, batchId]);
  return {
    batchId: batch.id,
    workspaceId: batch.workspace_id,
    projectId: batch.project_id,
    contractId: batch.contract_id,
    status: batch.status,
    mappingVersion: batch.mapping_version,
    currentAttempt: batch.current_attempt,
    rowCount: batch.row_count,
    blockingCount: batch.blocking_count,
    warningCount: batch.warning_count,
    needsResolutionCount: batch.needs_resolution_count,
    totals: batch.totals,
    failureCodes: batch.failure_codes ?? [],
    sourceManifestHash: batch.source_manifest_hash,
    publishedVersionId: batch.published_version_id,
    version: Number(batch.version),
    files: files.rows.map((f) => ({
      fileId: f.id, filename: f.filename, byteSize: Number(f.byte_size),
      contentHash: f.content_hash, detectedFormat: f.detected_format,
    })),
    rowResults: rowResults.rows.map((r) => ({
      rowResultId: r.id, worksheet: r.worksheet, sourceRow: r.source_row,
      severity: r.severity, errorCodes: r.error_codes ?? [], mapped: r.mapped,
    })),
    resolutions: resolutions.rows.map((r) => ({
      resolutionId: r.id, rowResultId: r.row_result_id,
      chosenBasis: r.chosen_basis, reason: r.reason,
    })),
  };
}
