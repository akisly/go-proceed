import { createHash, randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  finalizeUploadIntentRequest, type FinalizeUploadIntentResponse,
} from "@aktflow/contracts";
import { withTenantTx, recordAudit, enqueueOutbox } from "@aktflow/database";
import {
  STORAGE_PROVIDER, downloadObject, objectSize,
} from "../../../../../src/lib/evidence-storage";
import { inspectContent } from "../../../../../src/lib/evidence-inspection";

export const runtime = "nodejs";

type IntentRow = {
  workspace_id: string; project_id: string; work_assignment_id: string;
  device_capture_id: string | null;
};

/**
 * Records an integrity failure against an intent, through the command that owns
 * the transition (migration 0031).
 *
 * The capture event is appended only when the transition applied. The route
 * used to write both unconditionally, so an intent that expired or was claimed
 * for purge during the storage read ended up carrying failure provenance from a
 * request that arrived after it was already over.
 *
 * `observedBytes` is what the server actually found in the bucket. It corrects
 * the quota reservation, which was made from the size the client declared.
 */
async function recordFailure(
  ctx: { actorUserId: string; organizationId: string | null; requestId: string },
  intent: IntentRow, intentId: string, failureCode: string, observedBytes: number,
): Promise<void> {
  await withTenantTx(ctx, async (tx) => {
    const r = await tx.query<{ applied: boolean }>(
      "select app.fail_upload_intent($1,$2,$3,$4) as applied",
      [intent.workspace_id, intentId, failureCode, observedBytes]);
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
              i.purged_at, i.purge_claimed_at,
              e.content_hash, e.server_received_at
         from public.upload_intents i
         left join public.evidence_objects e
           on e.workspace_id = i.workspace_id and e.id = i.finalized_evidence_object_id
        where i.id = $1`, [intentId]);
    if (r.rows.length === 0) throw notFound;
    const row = r.rows[0];

    // The front door checks membership and ownership, NOT the evidence
    // capability. Losing that capability between authorizing the upload and
    // finalizing it is precisely the INV-047 scenario, so it has to reach the
    // finalization command — which orphans the bytes under the row lock and
    // says so — rather than be turned away here, where the staged object would
    // be left with nothing marking it for purge.
    //
    // Membership is different: without it there is no read privilege on the
    // intent at all, so a deactivated member gets 404 above and their bytes wait
    // for the intent TTL. That gap is recorded in TODOS.md; the commands
    // themselves accept them (0031), only this route cannot reach the commands.
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
  // Once the purge worker has claimed an intent, it is on its way to having its
  // bytes deleted. Letting finalization proceed would either create evidence
  // pointing at bytes about to vanish, or race the delete. Claimed is terminal
  // for finalization.
  if (intent.purged_at !== null || intent.purge_claimed_at !== null) {
    throw new HttpProblem(409, problem("VERSION_CONFLICT",
      "Байти цього наміру вже позначено на очищення. Потрібне нове завантаження.",
      { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
  }
  // 410 with the catalogued code, not a generic conflict: an expired grant is
  // gone rather than contended, and the client's action is to ask for a new one.
  if (intent.status === "expired"
      || new Date(intent.expires_at).getTime() <= Date.now()) {
    throw new HttpProblem(410, problem("UPLOAD_GRANT_EXPIRED",
      "Термін дії наміру завантаження минув.",
      { requestId: a.requestId, retryable: false,
        userAction: "request_new_upload_grant" }));
  }

  // Storage IO happens outside the transaction: it is slow, and holding a
  // database connection across it buys nothing.
  //
  // Size is checked from metadata FIRST. Downloading before comparing let a
  // caller declare ten bytes, upload the bucket's fifty-megabyte maximum, and
  // make the server buffer all of it purely to reject it.
  const storedSize = await objectSize(intent.staging_storage_key, intent.staging_bucket);
  if (storedSize === null) {
    throw new HttpProblem(409, problem("UPLOAD_INTENT_CONFLICT",
      "Байти ще не завантажено за цим наміром.",
      { requestId: a.requestId, retryable: true, userAction: "refresh_upload_state_or_request_new_grant" }));
  }
  if (storedSize !== Number(intent.expected_byte_size)) {
    // The observed size goes in with the failure: the reservation was made from
    // the size the client declared, and this is where the server finds out what
    // was actually stored (migration 0031). A caller who declares one byte and
    // uploads the bucket maximum has that maximum counted against them until
    // the bytes are purged.
    await recordFailure(ctx, intent, intentId, "integrity_size_mismatch", storedSize);
    throw new HttpProblem(422, problem("UPLOAD_CHECKSUM_MISMATCH",
      `Отримано ${storedSize} Б замість очікуваних ${intent.expected_byte_size} Б.`,
      { requestId: a.requestId, retryable: true, userAction: "retry_part" }));
  }

  let bytes: Uint8Array;
  try {
    bytes = await downloadObject(intent.staging_storage_key);
  } catch {
    throw new HttpProblem(409, problem("UPLOAD_INTENT_CONFLICT",
      "Байти ще не завантажено за цим наміром.",
      { requestId: a.requestId, retryable: true, userAction: "refresh_upload_state_or_request_new_grant" }));
  }

  const actualHash = createHash("sha256").update(bytes).digest("hex");
  const sizeMatches = bytes.byteLength === Number(intent.expected_byte_size);
  const hashMatches = actualHash === intent.expected_content_hash;

  if (!sizeMatches || !hashMatches) {
    // The original is NOT deleted and the intent stays retryable: the failure
    // table requires the local original be kept and the failure named.
    const failureCode = sizeMatches ? "integrity_hash_mismatch" : "integrity_size_mismatch";
    await recordFailure(ctx, intent, intentId, failureCode, bytes.byteLength);
    throw new HttpProblem(422, problem("UPLOAD_CHECKSUM_MISMATCH",
      sizeMatches
        ? "Хеш отриманого вмісту не збігається з очікуваним. Оригінал збережено, спробуйте ще раз."
        : `Отримано ${bytes.byteLength} Б замість очікуваних ${intent.expected_byte_size} Б.`,
      { requestId: a.requestId, retryable: true, userAction: "retry_part" }));
  }

  const inspection = await inspectContent(bytes, intent.claimed_media_type);

  if (inspection.outcome === "blocked") {
    const blocked = await withTenantTx(ctx, async (tx) => {
      // Through the definer (0028): blocked_at is not the member's to write,
      // and the transition is conditional so a concurrent expiry or purge claim
      // is not overwritten with a fresh retention clock.
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
    // Losing the transition means the intent expired or was claimed for purge
    // while inspection ran. Reporting SCAN_REJECTED there would tell the client
    // its content was refused when what actually happened is that its grant ran
    // out, and the two call for different actions.
    if (!blocked) {
      throw new HttpProblem(409, problem("UPLOAD_INTENT_CONFLICT",
        "Стан наміру завантаження змінився під час перевірки вмісту.",
        { requestId: a.requestId, retryable: false,
          userAction: "refresh_upload_state_or_request_new_grant" }));
    }
    // No evidence_objects row is created, which is why inspection_status has no
    // 'blocked' value: blocked content never becomes evidence at all (INV-046).
    throw new HttpProblem(422, problem("SCAN_REJECTED",
      inspection.failureCode === "declared_type_mismatch"
        ? `Вміст не відповідає заявленому типу «${intent.claimed_media_type}».`
        : "Тип вмісту не розпізнано.",
      { requestId: a.requestId, retryable: false, userAction: "recapture_or_contact_support" }));
  }

  // INV-047: authorization is rechecked at the moment evidence is created, not
  // only when the upload was authorized. Bytes may have been in flight for
  // hours.
  const result = await withTenantTx(ctx, async (tx) => {
    // One command (migrations 0029, 0031). Evidence cannot be assembled by the
    // caller: the app role holds no insert on evidence_objects and no update on
    // upload_intents at all. Provenance comes from the intent, the content
    // identity must equal what authorization fixed, INV-047 is rechecked inside
    // the row lock, and the promotion to available happens in the same
    // statement.
    const r = await tx.query<{ evidence_object_id: string | null; outcome: string }>(
      `select * from app.finalize_upload_intent($1,$2,$3,$4,$5,$6,$7)`,
      [intent.workspace_id, intentId, actualHash, bytes.byteLength,
       inspection.detectedMediaType ?? intent.claimed_media_type,
       inspection.outcome, inspection.policyVersion]);
    const row = r.rows[0];

    if (row === undefined || row.outcome === "conflict") {
      throw new HttpProblem(409, problem("UPLOAD_INTENT_CONFLICT",
        "Стан наміру завантаження змінився під час обробки. Потрібне нове завантаження.",
        { requestId: a.requestId, retryable: false,
          userAction: "refresh_upload_state_or_request_new_grant" }));
    }
    // The command orphaned the bytes itself, under the same row lock. It does
    // that rather than leaving it to a second call because the caller who has
    // just lost their grant is precisely the one whose second call would be
    // refused.
    if (row.outcome === "unauthorized") return { orphaned: true as const };

    const evidenceObjectId = row.evidence_object_id!;

    // Only the call that created the evidence publishes what happened. A losing
    // parallel call, or a client retrying because it never saw the first
    // response, gets 'already' and emits nothing: the outbox has no uniqueness
    // constraint, so an evidence.available published once per retry would be
    // delivered once per retry.
    if (row.outcome === "created") {
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
    }

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

  const body: FinalizeUploadIntentResponse = {
    uploadIntentId: intentId, status: "available",
    evidenceObjectId: result.evidenceObjectId,
    contentHash: actualHash,
    serverReceivedAt: result.serverReceivedAt.toISOString(),
    failureCode: null,
  };
  return { status: 200, body };
});
