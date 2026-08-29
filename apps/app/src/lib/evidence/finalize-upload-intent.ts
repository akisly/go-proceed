import { createHash } from "node:crypto";
import { type FinalizeUploadIntentResponse } from "@goproceed/contracts";
import { enqueueOutbox, recordAudit, withServiceTx, withTenantTx } from "@goproceed/database";
import { requireActiveMembership } from "../authz";
import type { HandlerResult } from "../command";
import { downloadObject, objectSize } from "../evidence-storage";
import { inspectContent } from "../evidence-inspection";
import { HttpProblem, problem } from "../http";

export interface FinalizeUploadIntentInput {
  actorUserId: string;
  requestId: string;
  intentId: string;
}

type IntentRow = {
  workspace_id: string; project_id: string; work_assignment_id: string;
  device_capture_id: string | null;
};
type FinalizeResult =
  | { outcome: "unauthorized" }
  | { outcome: "no_content" }
  | { outcome: "ok"; evidenceObjectId: string; serverReceivedAt: Date };

async function recordFailure(
  ctx: { actorUserId: string; organizationId: string | null; requestId: string },
  intent: IntentRow, intentId: string, failureCode: string,
): Promise<void> {
  await withServiceTx(ctx, async (tx) => {
    const r = await tx.query<{ applied: boolean }>(
      "select app.fail_upload_intent($1,$2,$3) as applied",
      [intent.workspace_id, intentId, failureCode]);
    if (r.rows[0]?.applied !== true) return;
    await tx.query(
      `insert into public.capture_events
         (workspace_id, project_id, work_assignment_id, upload_intent_id,
          device_capture_id, client_state, event_source, failure_code)
       values ($1,$2,$3,$4,$5,'failed','server',$6)`,
      [intent.workspace_id, intent.project_id, intent.work_assignment_id, intentId,
        intent.device_capture_id, failureCode]);
  });
}

/**
 * Finalizes one authorized intent for a previously verified actor. Storage I/O
 * intentionally remains between the authorization read and service command.
 */
export async function finalizeUploadIntent({
  actorUserId, requestId, intentId,
}: FinalizeUploadIntentInput): Promise<HandlerResult> {
  if (!intentId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Намір завантаження не знайдено.",
      { requestId, retryable: false, userAction: "return_to_list" }));
  }
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND",
    "Намір завантаження не знайдено.",
    { requestId, retryable: false, userAction: "return_to_list" }));
  const ctx = { actorUserId, organizationId: null, requestId };

  const intent = await withTenantTx(ctx, async (tx) => {
    const r = await tx.query(
      `select i.id, i.workspace_id, i.project_id, i.work_assignment_id, i.status,
              i.expected_byte_size, i.expected_content_hash, i.claimed_media_type,
              i.staging_bucket, i.staging_storage_key, i.device_capture_id,
              i.origin_method, i.original_filename, i.claimed_capture_time,
              i.claimed_tz_offset, i.source_app_version, i.expires_at,
              i.created_by_member_id, i.finalized_evidence_object_id, i.failure_code,
              i.purged_at, i.purge_claimed_at,
              e.content_hash, e.server_received_at
         from public.upload_intents i
         left join public.evidence_objects e
           on e.workspace_id = i.workspace_id and e.id = i.finalized_evidence_object_id
        where i.id = $1`, [intentId]);
    if (r.rows.length === 0) throw notFound;
    const row = r.rows[0];
    const m = await requireActiveMembership(tx, requestId, actorUserId, row.workspace_id);
    if (row.created_by_member_id !== m.memberId) throw notFound;
    return { ...row, memberId: m.memberId };
  });

  if (intent.status === "available") {
    const body: FinalizeUploadIntentResponse = {
      uploadIntentId: intentId, status: "available",
      evidenceObjectId: intent.finalized_evidence_object_id,
      contentHash: intent.content_hash,
      serverReceivedAt: intent.server_received_at?.toISOString?.() ?? null,
      failureCode: null,
    };
    return { status: 200, body };
  }
  if (intent.status === "scan_blocked" || intent.status === "orphaned_for_purge") {
    throw new HttpProblem(409, problem("VERSION_CONFLICT",
      "Це завантаження вже завершено з відмовою.",
      { requestId, retryable: false, userAction: "refresh_compare_retry" }));
  }
  if (intent.purged_at !== null || intent.purge_claimed_at !== null) {
    throw new HttpProblem(409, problem("VERSION_CONFLICT",
      "Байти цього наміру вже позначено на очищення. Потрібне нове завантаження.",
      { requestId, retryable: false, userAction: "refresh_compare_retry" }));
  }
  if (intent.status === "expired" || new Date(intent.expires_at).getTime() <= Date.now()) {
    throw new HttpProblem(410, problem("UPLOAD_GRANT_EXPIRED",
      "Термін дії наміру завантаження минув.",
      { requestId, retryable: false, userAction: "request_new_upload_grant" }));
  }

  // Storage I/O is deliberately outside both transactions.
  const storedSize = await objectSize(intent.staging_storage_key, intent.staging_bucket);
  if (storedSize === null) {
    throw new HttpProblem(409, problem("UPLOAD_INTENT_CONFLICT",
      "Байти ще не завантажено за цим наміром.",
      { requestId, retryable: true, userAction: "refresh_upload_state_or_request_new_grant" }));
  }
  if (storedSize !== Number(intent.expected_byte_size)) {
    await recordFailure(ctx, intent, intentId, "integrity_size_mismatch");
    throw new HttpProblem(422, problem("UPLOAD_CHECKSUM_MISMATCH",
      `Отримано ${storedSize} Б замість очікуваних ${intent.expected_byte_size} Б.`,
      { requestId, retryable: true, userAction: "retry_part" }));
  }
  let bytes: Uint8Array;
  try {
    bytes = await downloadObject(intent.staging_storage_key);
  } catch {
    throw new HttpProblem(409, problem("UPLOAD_INTENT_CONFLICT",
      "Байти ще не завантажено за цим наміром.",
      { requestId, retryable: true, userAction: "refresh_upload_state_or_request_new_grant" }));
  }
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  const sizeMatches = bytes.byteLength === Number(intent.expected_byte_size);
  const hashMatches = actualHash === intent.expected_content_hash;
  if (!sizeMatches || !hashMatches) {
    const failureCode = sizeMatches ? "integrity_hash_mismatch" : "integrity_size_mismatch";
    await recordFailure(ctx, intent, intentId, failureCode);
    throw new HttpProblem(422, problem("UPLOAD_CHECKSUM_MISMATCH",
      sizeMatches
        ? "Хеш отриманого вмісту не збігається з очікуваним. Оригінал збережено, спробуйте ще раз."
        : `Отримано ${bytes.byteLength} Б замість очікуваних ${intent.expected_byte_size} Б.`,
      { requestId, retryable: true, userAction: "retry_part" }));
  }
  const inspection = await inspectContent(bytes, intent.claimed_media_type);
  if (inspection.outcome === "blocked") {
    const blocked = await withServiceTx(ctx, async (tx) => {
      const r = await tx.query<{ applied: boolean }>(
        "select app.block_upload_intent($1,$2,$3) as applied",
        [intent.workspace_id, intentId, inspection.failureCode]);
      if (r.rows[0]?.applied !== true) return false;
      await tx.query(
        `insert into public.capture_events
           (workspace_id, project_id, work_assignment_id, upload_intent_id,
            device_capture_id, client_state, event_source, failure_code)
         values ($1,$2,$3,$4,$5,'failed','server',$6)`,
        [intent.workspace_id, intent.project_id, intent.work_assignment_id, intentId,
          intent.device_capture_id, inspection.failureCode]);
      return true;
    });
    if (!blocked) {
      throw new HttpProblem(409, problem("UPLOAD_INTENT_CONFLICT",
        "Стан наміру завантаження змінився під час перевірки вмісту.",
        { requestId, retryable: false, userAction: "refresh_upload_state_or_request_new_grant" }));
    }
    throw new HttpProblem(422, problem("SCAN_REJECTED",
      inspection.failureCode === "declared_type_mismatch"
        ? `Вміст не відповідає заявленому типу «${intent.claimed_media_type}».`
        : "Тип вмісту не розпізнано.",
      { requestId, retryable: false, userAction: "recapture_or_contact_support" }));
  }

  const result = await withServiceTx<FinalizeResult>(ctx, async (tx) => {
    const r = await tx.query<{ evidence_object_id: string | null; outcome: string }>(
      `select * from app.finalize_upload_intent($1,$2,$3,$4,$5,$6,$7)`,
      [intent.workspace_id, intentId, actualHash, bytes.byteLength,
        inspection.detectedMediaType ?? intent.claimed_media_type,
        inspection.outcome, inspection.policyVersion]);
    const row = r.rows[0];
    const conflict = () => new HttpProblem(409, problem("UPLOAD_INTENT_CONFLICT",
      "Стан наміру завантаження змінився під час обробки. Потрібне нове завантаження.",
      { requestId, retryable: false, userAction: "refresh_upload_state_or_request_new_grant" }));
    if (row === undefined) throw conflict();
    switch (row.outcome) {
      case "conflict": throw conflict();
      case "no_content":
      case "unauthorized": return { outcome: row.outcome as "no_content" | "unauthorized" };
      case "already":
      case "created": break;
      default: throw new Error(`unknown finalization outcome: ${row.outcome}`);
    }
    const evidenceObjectId = row.evidence_object_id!;
    if (row.outcome === "created") {
      await tx.query(
        `insert into public.capture_events
           (workspace_id, project_id, work_assignment_id, upload_intent_id,
            device_capture_id, client_state, event_source, capture_time_trust)
         values ($1,$2,$3,$4,$5,'server_confirmed','server','server_estimated')`,
        [intent.workspace_id, intent.project_id, intent.work_assignment_id, intentId,
          intent.device_capture_id]);
      await recordAudit(tx, ctx, {
        action: "evidence.available", object_type: "evidence_object", object_id: evidenceObjectId,
        details: { uploadIntentId: intentId, byteSize: bytes.byteLength },
      }, { organizationId: intent.workspace_id });
      await enqueueOutbox(tx, ctx, {
        topic: "evidence.available", aggregate_type: "evidence_object",
        aggregate_id: evidenceObjectId, payload_version: 1,
        payload: { workspaceId: intent.workspace_id, projectId: intent.project_id,
          uploadIntentId: intentId, evidenceObjectId },
      }, { organizationId: intent.workspace_id });
    }
    const received = await tx.query(
      `select server_received_at from public.evidence_objects
        where workspace_id = $1 and id = $2`, [intent.workspace_id, evidenceObjectId]);
    return {
      outcome: "ok" as const, evidenceObjectId,
      serverReceivedAt: received.rows[0].server_received_at as Date,
    };
  });
  if (result.outcome === "unauthorized") {
    throw new HttpProblem(403, problem("SCOPE_PROJECT_DENIED",
      "Доступ відкликано під час завантаження. Байти позначено на очищення.",
      { requestId, retryable: false, userAction: "request_project_scope" }));
  }
  if (result.outcome === "no_content") {
    throw new HttpProblem(409, problem("UPLOAD_INTENT_CONFLICT",
      "Байти цього завантаження більше не знайдено. Потрібне нове завантаження.",
      { requestId, retryable: false, userAction: "refresh_upload_state_or_request_new_grant" }));
  }
  const body: FinalizeUploadIntentResponse = {
    uploadIntentId: intentId, status: "available", evidenceObjectId: result.evidenceObjectId,
    contentHash: actualHash, serverReceivedAt: result.serverReceivedAt.toISOString(), failureCode: null,
  };
  return { status: 200, body };
}
