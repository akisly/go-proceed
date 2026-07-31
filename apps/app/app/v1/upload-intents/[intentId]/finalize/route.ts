import { createHash, randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  finalizeUploadIntentRequest, type FinalizeUploadIntentResponse,
} from "@aktflow/contracts";
import { withTenantTx, recordAudit, enqueueOutbox } from "@aktflow/database";
import { STORAGE_PROVIDER, downloadObject } from "../../../../../src/lib/evidence-storage";
import { inspectContent } from "../../../../../src/lib/evidence-inspection";

export const runtime = "nodejs";

/**
 * Finalization is not wrapped in withIdempotency: the upload intent IS the
 * idempotency key of this protocol. A second call on an `available` intent
 * returns the stored receipt, which is also how a client that lost its local
 * write recovers (the last row of the failure table in
 * docs/domain/execution-and-evidence.md).
 *
 * Reachable states in M2-A are intent_authorized -> available | scan_blocked |
 * orphaned_for_purge, with failure_code recorded on an integrity failure. The
 * intermediate `staged`, `integrity_verified` and `scan_pending` values are NOT
 * written: the client uploads through a signed URL, so the server never
 * observes staging as a separate event, and writing transitions that commit in
 * the same transaction as the terminal state would be a record of nothing. They
 * stay in the enum for the resumable protocol in v0.3.
 *
 * INV-046 holds regardless: staged bytes are unreadable as evidence because no
 * evidence_objects row points at them, not because of where they sit.
 */
export const POST = commandRoute(finalizeUploadIntentRequest, async (a) => {
  const intentId = a.params.intentId;
  if (!intentId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Намір завантаження не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND",
    "Намір завантаження не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };

  // Read the intent and authorize the caller before touching storage.
  const intent = await withTenantTx(ctx, async (tx) => {
    const r = await tx.query(
      `select i.id, i.workspace_id, i.project_id, i.work_assignment_id, i.status,
              i.expected_byte_size, i.expected_content_hash, i.claimed_media_type,
              i.staging_bucket, i.staging_storage_key, i.device_capture_id,
              i.origin_method, i.original_filename, i.claimed_capture_time,
              i.claimed_tz_offset, i.source_app_version, i.expires_at,
              i.created_by_member_id, i.finalized_evidence_object_id, i.failure_code,
              e.content_hash, e.server_received_at
         from public.upload_intents i
         left join public.evidence_objects e
           on e.workspace_id = i.workspace_id and e.id = i.finalized_evidence_object_id
        where i.id = $1`, [intentId]);
    if (r.rows.length === 0) throw notFound;
    const row = r.rows[0];

    // The front door checks membership and ownership, NOT the evidence
    // capability. Losing that capability between authorizing the upload and
    // finalizing it is precisely the INV-047 scenario, so it has to be caught by
    // the recheck below — which orphans the bytes — rather than turned away here,
    // where the staged object would be left with nothing marking it for purge.
    const m = await requireActiveMembership(tx, a.requestId, a.userId, row.workspace_id);
    if (row.created_by_member_id !== m.memberId) {
      throw notFound;
    }
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
      { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
  }
  if (new Date(intent.expires_at).getTime() <= Date.now()) {
    throw new HttpProblem(409, problem("VERSION_CONFLICT",
      "Термін дії наміру завантаження минув.",
      { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
  }

  // Storage IO happens outside the transaction: it is slow, and holding a
  // database connection across it buys nothing.
  let bytes: Uint8Array;
  try {
    bytes = await downloadObject(intent.staging_storage_key);
  } catch {
    throw new HttpProblem(409, problem("UPLOAD_NOT_STAGED",
      "Байти ще не завантажено за цим наміром.",
      { requestId: a.requestId, retryable: true, userAction: "retry_later" }));
  }

  const actualHash = createHash("sha256").update(bytes).digest("hex");
  const sizeMatches = bytes.byteLength === Number(intent.expected_byte_size);
  const hashMatches = actualHash === intent.expected_content_hash;

  if (!sizeMatches || !hashMatches) {
    // The original is NOT deleted and the intent stays retryable: the failure
    // table requires the local original be kept and the failure named.
    const failureCode = sizeMatches ? "integrity_hash_mismatch" : "integrity_size_mismatch";
    await withTenantTx(ctx, async (tx) => {
      await tx.query(
        `update public.upload_intents set failure_code = $3, version = version + 1
          where workspace_id = $1 and id = $2`,
        [intent.workspace_id, intentId, failureCode]);
      await tx.query(
        `insert into public.capture_events
           (workspace_id, project_id, work_assignment_id, upload_intent_id,
            device_capture_id, client_state, event_source, failure_code)
         values ($1,$2,$3,$4,$5,'failed','server',$6)`,
        [intent.workspace_id, intent.project_id, intent.work_assignment_id, intentId,
         intent.device_capture_id, failureCode]);
    });
    throw new HttpProblem(422, problem("EVIDENCE_INTEGRITY_FAILED",
      sizeMatches
        ? "Хеш отриманого вмісту не збігається з очікуваним. Оригінал збережено, спробуйте ще раз."
        : `Отримано ${bytes.byteLength} Б замість очікуваних ${intent.expected_byte_size} Б.`,
      { requestId: a.requestId, retryable: true, userAction: "retry_later" }));
  }

  const inspection = await inspectContent(bytes, intent.claimed_media_type);

  if (inspection.outcome === "blocked") {
    await withTenantTx(ctx, async (tx) => {
      await tx.query(
        `update public.upload_intents
            set status = 'scan_blocked', failure_code = $3, version = version + 1
          where workspace_id = $1 and id = $2`,
        [intent.workspace_id, intentId, inspection.failureCode]);
      await tx.query(
        `insert into public.capture_events
           (workspace_id, project_id, work_assignment_id, upload_intent_id,
            device_capture_id, client_state, event_source, failure_code)
         values ($1,$2,$3,$4,$5,'failed','server',$6)`,
        [intent.workspace_id, intent.project_id, intent.work_assignment_id, intentId,
         intent.device_capture_id, inspection.failureCode]);
    });
    // No evidence_objects row is created, which is why inspection_status has no
    // 'blocked' value: blocked content never becomes evidence at all (INV-046).
    throw new HttpProblem(422, problem("EVIDENCE_SCAN_BLOCKED",
      inspection.failureCode === "declared_type_mismatch"
        ? `Вміст не відповідає заявленому типу «${intent.claimed_media_type}».`
        : "Тип вмісту не розпізнано.",
      { requestId: a.requestId, retryable: false, userAction: "correct_fields" }));
  }

  // INV-047: authorization is rechecked at the moment evidence is created, not
  // only when the upload was authorized. Bytes may have been in flight for
  // hours.
  const result = await withTenantTx(ctx, async (tx) => {
    let stillAuthorized = true;
    try {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, intent.workspace_id);
      await requireProjectCapability(tx, a.requestId, {
        workspaceId: intent.workspace_id, projectId: intent.project_id,
        memberId: m.memberId, capability: "evidence.record",
      });
    } catch { stillAuthorized = false; }

    if (!stillAuthorized) {
      // Through the definer, because the ordinary update policy demands the very
      // capability that was just revoked (migration 0019).
      await tx.query("select app.orphan_upload_intent($1,$2)", [intent.workspace_id, intentId]);
      return { orphaned: true as const };
    }

    // Serialize finalization of this intent. Without it, two callers both see
    // no evidence row, both insert, and the unique constraint on
    // (workspace_id, upload_intent_id) hands one of them a 23505 that surfaces
    // as a 500 — to the caller most likely to be here, namely the client
    // retrying because it is unsure the first call landed. The lock releases
    // with the transaction.
    await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`upload_intent|${intent.workspace_id}|${intentId}`]);

    // Under that lock, an existing row means a concurrent call already
    // finished. Returning its receipt is the correct answer to "did this
    // work?", not an error.
    const existing = await tx.query(
      `select id from public.evidence_objects
        where workspace_id = $1 and upload_intent_id = $2`,
      [intent.workspace_id, intentId]);
    if (existing.rows.length > 0) {
      return { orphaned: false as const, alreadyFinalized: true as const,
               evidenceObjectId: existing.rows[0].id as string };
    }

    const evidenceObjectId = randomUUID();
    await tx.query(
      `insert into public.evidence_objects
         (id, workspace_id, project_id, content_hash, byte_size, media_type,
          original_filename, storage_bucket, storage_key, storage_provider,
          origin_method, relation_kind, recorder_member_id, device_capture_id,
          claimed_capture_time, claimed_tz_offset, capture_time_trust,
          server_received_at, upload_intent_id, source_app_version,
          inspection_status, inspection_policy_version)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'original',$12,$13,$14,$15,$16,
               now(),$17,$18,$19,$20)`,
      [evidenceObjectId, intent.workspace_id, intent.project_id, actualHash,
       bytes.byteLength, inspection.detectedMediaType ?? intent.claimed_media_type,
       intent.original_filename, intent.staging_bucket, intent.staging_storage_key,
       STORAGE_PROVIDER, intent.origin_method, intent.created_by_member_id,
       intent.device_capture_id, intent.claimed_capture_time, intent.claimed_tz_offset,
       intent.claimed_capture_time ? "device_claimed" : "unknown",
       intentId, intent.source_app_version,
       inspection.outcome, inspection.policyVersion]);

    await tx.query(
      `update public.upload_intents
          set status = 'available', finalized_evidence_object_id = $3,
              failure_code = null, version = version + 1
        where workspace_id = $1 and id = $2`,
      [intent.workspace_id, intentId, evidenceObjectId]);

    await tx.query(
      `insert into public.capture_events
         (workspace_id, project_id, work_assignment_id, upload_intent_id,
          device_capture_id, client_state, event_source, capture_time_trust)
       values ($1,$2,$3,$4,$5,'server_confirmed','server','server_estimated')`,
      [intent.workspace_id, intent.project_id, intent.work_assignment_id, intentId,
       intent.device_capture_id]);

    await recordAudit(tx, ctx, {
      action: "evidence.available", object_type: "evidence_object",
      object_id: evidenceObjectId,
      details: { uploadIntentId: intentId, byteSize: bytes.byteLength },
    }, { organizationId: intent.workspace_id });
    await enqueueOutbox(tx, ctx, {
      topic: "evidence.available", aggregate_type: "evidence_object",
      aggregate_id: evidenceObjectId, payload_version: 1,
      payload: { workspaceId: intent.workspace_id, projectId: intent.project_id,
                 uploadIntentId: intentId, evidenceObjectId },
    }, { organizationId: intent.workspace_id });

    const received = await tx.query(
      `select server_received_at from public.evidence_objects
        where workspace_id = $1 and id = $2`, [intent.workspace_id, evidenceObjectId]);
    return {
      orphaned: false as const, evidenceObjectId,
      serverReceivedAt: received.rows[0].server_received_at as Date,
    };
  });

  if (result.orphaned) {
    throw new HttpProblem(403, problem("SCOPE_PROJECT_DENIED",
      "Доступ відкликано під час завантаження. Байти позначено на очищення.",
      { requestId: a.requestId, retryable: false, userAction: "request_project_scope" }));
  }

  if ("alreadyFinalized" in result) {
    const receipt = await withTenantTx(ctx, (tx) => tx.query(
      `select server_received_at from public.evidence_objects
        where workspace_id = $1 and id = $2`,
      [intent.workspace_id, result.evidenceObjectId]));
    const body: FinalizeUploadIntentResponse = {
      uploadIntentId: intentId, status: "available",
      evidenceObjectId: result.evidenceObjectId,
      contentHash: actualHash,
      serverReceivedAt: receipt.rows[0]?.server_received_at?.toISOString?.() ?? null,
      failureCode: null,
    };
    return { status: 200, body };
  }

  const body: FinalizeUploadIntentResponse = {
    uploadIntentId: intentId, status: "available",
    evidenceObjectId: result.evidenceObjectId,
    contentHash: actualHash,
    serverReceivedAt: result.serverReceivedAt.toISOString(),
    failureCode: null,
  };
  return { status: 200, body };
});
