import { randomUUID } from "node:crypto";
import {
  type CreateUploadIntentRequest, type CreateUploadIntentResponse, type UploadIntentReceipt,
} from "@goproceed/contracts";
import { recordAudit, withIdempotency, withTenantTx } from "@goproceed/database";
import { requireActiveMembership, requireProjectCapability, type ActiveMembership } from "../authz";
import type { HandlerResult } from "../command";
import { EVIDENCE_BUCKET, createSignedUpload, newEvidenceKey } from "../evidence-storage";
import { HttpProblem, problem } from "../http";
import { allowedMediaOf } from "../requirement-content";

export interface AuthorizeUploadIntentInput {
  actorUserId: string;
  requestId: string;
  assignmentId: string;
  body: CreateUploadIntentRequest;
  idempotencyKey: string;
  requestHash: string;
}

/**
 * Telegram/provider preflight: the same authorization gates that protect an
 * intent, but deliberately no hash-bound row or signed grant.  A final normal
 * authorization after bytes are hashed remains authoritative.
 */
export async function preflightUploadAuthorization(input: Omit<AuthorizeUploadIntentInput, "idempotencyKey" | "requestHash">): Promise<void> {
  const { actorUserId, requestId, assignmentId, body } = input;
  await withTenantTx({ actorUserId, organizationId: null, requestId }, async (tx) => {
    const asg = await tx.query(`select workspace_id, project_id from public.work_assignments where id=$1`, [assignmentId]);
    if (asg.rows.length === 0) throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Завдання не знайдено.",
      { requestId, retryable: false, userAction: "return_to_list" }));
    const { workspace_id: workspaceId, project_id: projectId } = asg.rows[0];
    const member = await requireActiveMembership(tx, requestId, actorUserId, workspaceId);
    await requireProjectCapability(tx, requestId, { workspaceId, projectId, memberId: member.memberId, capability: "evidence.record" });
    if (!body.requirementOccurrenceId) throw new HttpProblem(422, problem("VALIDATION_FAILED", "Потрібна вимога для доказу.",
      { requestId, retryable: false, userAction: "correct_fields" }));
    const occurrence = await tx.query(`select rv.allowed_media from public.requirement_occurrences o
      join public.requirement_rule_versions rv on rv.workspace_id=o.workspace_id and rv.id=o.rule_version_id
      where o.workspace_id=$1 and o.project_id=$2 and o.work_assignment_id=$3 and o.id=$4`,
    [workspaceId, projectId, assignmentId, body.requirementOccurrenceId]);
    const media = occurrence.rows[0] && allowedMediaOf(occurrence.rows[0].allowed_media);
    if (!media || !media.mimeTypes.includes(body.claimedMediaType) || body.expectedByteSize > media.maxByteSize) {
      throw new HttpProblem(422, problem("UPLOAD_SIZE_LIMIT", "Файл не відповідає вимозі.",
        { requestId, retryable: false, userAction: "reduce_file_or_request_policy_change" }));
    }
    await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`evidence_quota|${workspaceId}`]);
    const quota = await tx.query(`select o.evidence_quota_bytes, app.evidence_bytes_in_use($1) as in_use
      from public.organizations o where o.id=$1`, [workspaceId]);
    if (quota.rows[0]?.evidence_quota_bytes !== null
      && BigInt(quota.rows[0].in_use) + BigInt(body.expectedByteSize) > BigInt(quota.rows[0].evidence_quota_bytes)) {
      throw new HttpProblem(422, problem("UPLOAD_SIZE_LIMIT", "Ліміт сховища вичерпано.",
        { requestId, retryable: false, userAction: "reduce_file_or_request_policy_change" }));
    }
  });
}

const FALLBACK_MEDIA = {
  mimeTypes: ["image/jpeg", "image/png", "image/heic", "application/pdf"],
  maxByteSize: 50 * 1024 * 1024,
};

const INTENT_TTL_HOURS = 24;

/**
 * Authorizes a durable upload intent for a previously verified actor. Browser
 * routes and provider adapters deliberately converge at this boundary.
 */
export async function authorizeUploadIntent({
  actorUserId, requestId, assignmentId, body: requestBody, idempotencyKey, requestHash,
}: AuthorizeUploadIntentInput): Promise<HandlerResult> {
  if (!assignmentId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Завдання не знайдено.",
      { requestId, retryable: false, userAction: "return_to_list" }));
  }
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Завдання не знайдено.",
    { requestId, retryable: false, userAction: "return_to_list" }));
  const ctx = { actorUserId, organizationId: null, requestId };

  const out = await withTenantTx(ctx, async (tx) => {
    const asg = await tx.query(
      `select workspace_id, project_id, requirement_template_version_id
         from public.work_assignments where id = $1`, [assignmentId]);
    if (asg.rows.length === 0) throw notFound;
    const { workspace_id: workspaceId, project_id: projectId,
      requirement_template_version_id: templateVersionId } = asg.rows[0];

    return withIdempotency<UploadIntentReceipt, ActiveMembership>(tx, {
      organizationId: workspaceId, actorScope: `user:${actorUserId}`,
      operationId: "upload_intents.create", key: idempotencyKey, requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, requestId, actorUserId, workspaceId);
        await requireProjectCapability(tx, requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "evidence.record" });
        return m;
      },
    }, async (m) => {
      let media = FALLBACK_MEDIA;
      if (requestBody.requirementOccurrenceId) {
        const o = await tx.query(
          `select o.evidence_kind, rv.allowed_media
             from public.requirement_occurrences o
             join public.requirement_rule_versions rv
               on rv.workspace_id = o.workspace_id and rv.id = o.rule_version_id
            where o.workspace_id = $1 and o.project_id = $2
              and o.work_assignment_id = $3 and o.id = $4`,
          [workspaceId, projectId, assignmentId, requestBody.requirementOccurrenceId]);
        if (o.rows.length === 0) {
          throw new HttpProblem(422, problem("VALIDATION_FAILED",
            "Вимогу не знайдено серед обов'язків цього завдання.",
            { requestId, retryable: false, userAction: "correct_fields",
              fieldErrors: [{ path: "requirementOccurrenceId",
                message: "unknown occurrence for this assignment" }] }));
        }
        const policy = allowedMediaOf(o.rows[0].allowed_media);
        if (policy === null) {
          throw new HttpProblem(422, problem("VALIDATION_FAILED",
            "Ця вимога не приймає завантажений файл.",
            { requestId, retryable: false, userAction: "correct_fields",
              fieldErrors: [{ path: "requirementOccurrenceId",
                message: `evidence kind '${o.rows[0].evidence_kind}' takes no uploaded original` }] }));
        }
        media = policy;
      } else if (templateVersionId) {
        const t = await tx.query(
          `select allowed_media from public.requirement_template_versions
            where workspace_id = $1 and id = $2 and status = 'published'`,
          [workspaceId, templateVersionId]);
        if (t.rows.length > 0 && t.rows[0].allowed_media) {
          media = t.rows[0].allowed_media as typeof FALLBACK_MEDIA;
        }
      }

      if (!media.mimeTypes.includes(requestBody.claimedMediaType)) {
        throw new HttpProblem(422, problem("UPLOAD_SIZE_LIMIT",
          `Тип «${requestBody.claimedMediaType}» не дозволений. Дозволені: ${media.mimeTypes.join(", ")}.`,
          { requestId, retryable: false, userAction: "reduce_file_or_request_policy_change",
            fieldErrors: [{ path: "claimedMediaType", message: "media type not allowed" }] }));
      }
      if (requestBody.expectedByteSize > media.maxByteSize) {
        throw new HttpProblem(422, problem("UPLOAD_SIZE_LIMIT",
          `Розмір ${requestBody.expectedByteSize} Б перевищує ліміт ${media.maxByteSize} Б.`,
          { requestId, retryable: false, userAction: "reduce_file_or_request_policy_change",
            fieldErrors: [{ path: "expectedByteSize", message: "exceeds the allowed size" }] }));
      }

      await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`evidence_quota|${workspaceId}`]);
      const quota = await tx.query(
        `select o.evidence_quota_bytes,
                app.evidence_bytes_in_use($1) as in_use
           from public.organizations o where o.id = $1`, [workspaceId]);
      const limit = quota.rows[0]?.evidence_quota_bytes;
      if (limit !== null && limit !== undefined) {
        const inUse = BigInt(quota.rows[0].in_use);
        if (inUse + BigInt(requestBody.expectedByteSize) > BigInt(limit)) {
          throw new HttpProblem(422, problem("UPLOAD_SIZE_LIMIT",
            `Ліміт сховища вичерпано: зайнято ${inUse} Б із ${limit} Б.`,
            { requestId, retryable: false, userAction: "reduce_file_or_request_policy_change" }));
        }
      }

      const uploadIntentId = randomUUID();
      const storageKey = newEvidenceKey();
      const expiresAt = new Date(Date.now() + INTENT_TTL_HOURS * 3600_000);
      await tx.query(
        `insert into public.upload_intents
           (id, workspace_id, project_id, work_assignment_id, created_by_member_id,
            device_capture_id, origin_method, original_filename, claimed_capture_time,
            claimed_tz_offset, source_app_version, idempotency_key, request_hash,
            expected_byte_size, expected_content_hash, allowed_content_family,
            claimed_media_type, staging_bucket, staging_storage_key, expires_at,
            quota_reserved_bytes, requirement_occurrence_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$14,$21)`,
        [uploadIntentId, workspaceId, projectId, assignmentId, m.memberId,
          requestBody.deviceCaptureId, requestBody.originMethod, requestBody.originalFilename ?? null,
          requestBody.claimedCaptureTime ?? null, requestBody.claimedTzOffset ?? null,
          requestBody.sourceAppVersion ?? null, idempotencyKey, requestHash,
          requestBody.expectedByteSize, requestBody.expectedContentHash,
          requestBody.claimedMediaType.split("/")[0], requestBody.claimedMediaType,
          EVIDENCE_BUCKET, storageKey, expiresAt, requestBody.requirementOccurrenceId ?? null]);
      await tx.query(
        `insert into public.capture_events
           (workspace_id, project_id, work_assignment_id, upload_intent_id,
            device_capture_id, client_state, event_source, claimed_capture_time,
            claimed_tz_offset, capture_time_trust)
         values ($1,$2,$3,$4,$5,'not_sent','device',$6,$7,$8)`,
        [workspaceId, projectId, assignmentId, uploadIntentId, requestBody.deviceCaptureId,
          requestBody.claimedCaptureTime ?? null, requestBody.claimedTzOffset ?? null,
          requestBody.claimedCaptureTime ? "device_claimed" : "unknown"]);
      await recordAudit(tx, ctx, {
        action: "upload_intent.authorized", object_type: "upload_intent", object_id: uploadIntentId,
        details: {
          assignmentId, expectedByteSize: requestBody.expectedByteSize,
          requirementOccurrenceId: requestBody.requirementOccurrenceId ?? null,
          mediaPolicySource: requestBody.requirementOccurrenceId ? "requirement_occurrence"
            : templateVersionId ? "retired_template_pin" : "fallback",
        },
      }, { organizationId: workspaceId });
      return {
        status: 201,
        body: {
          uploadIntentId, workspaceId, status: "intent_authorized" as const,
          expiresAt: expiresAt.toISOString(), storage: { bucket: EVIDENCE_BUCKET, key: storageKey },
        },
      };
    });
  });

  const grantable = await withTenantTx(ctx, async (tx) => {
    const r = await tx.query(
      `select status, expires_at, purged_at, purge_claimed_at, project_id
         from public.upload_intents where workspace_id = $1 and id = $2`,
      [out.body.workspaceId, out.body.uploadIntentId]);
    const row = r.rows[0];
    if (!row) return { ok: false as const, reason: "gone" as const };
    const m = await requireActiveMembership(tx, requestId, actorUserId, out.body.workspaceId);
    await requireProjectCapability(tx, requestId, {
      workspaceId: out.body.workspaceId, projectId: row.project_id,
      memberId: m.memberId, capability: "evidence.record",
    });
    const usable = row.status === "intent_authorized"
      && row.purged_at === null && row.purge_claimed_at === null
      && new Date(row.expires_at).getTime() > Date.now();
    return usable ? { ok: true as const } : { ok: false as const, reason: "stale" as const };
  });
  if (!grantable.ok) {
    throw new HttpProblem(409, problem("VERSION_CONFLICT",
      "Цей намір завантаження більше не приймає байти. Створіть новий.",
      { requestId, retryable: false, userAction: "refresh_compare_retry" }));
  }
  const grant = await createSignedUpload(out.body.storage.key);
  const body: CreateUploadIntentResponse = {
    ...out.body, upload: { signedUrl: grant.signedUrl, token: grant.token },
  };
  return { status: out.status, body, expiresAt: out.expiresAt };
}
