import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  createUploadIntentRequest,
  type CreateUploadIntentResponse, type UploadIntentReceipt,
} from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@aktflow/database";
import {
  EVIDENCE_BUCKET, newEvidenceKey, createSignedUpload,
} from "../../../../../src/lib/evidence-storage";

export const runtime = "nodejs";

/** Applies when the assignment pins no requirement template. */
const FALLBACK_MEDIA = {
  mimeTypes: ["image/jpeg", "image/png", "image/heic", "application/pdf"],
  maxByteSize: 50 * 1024 * 1024,
};

const INTENT_TTL_HOURS = 24;

export const POST = commandRoute(createUploadIntentRequest, async (a) => {
  const assignmentId = a.params.assignmentId;
  if (!assignmentId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Завдання не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Завдання не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    // Assignment status is deliberately NOT read or gated on. Progress recording
    // requires an active assignment, but evidence must stay attachable after one
    // completes — a correction to an already-finished assignment still needs its
    // photo. Selecting the column and ignoring it would read as an oversight.
    const asg = await tx.query(
      `select workspace_id, project_id, requirement_template_version_id
         from public.work_assignments where id = $1`, [assignmentId]);
    if (asg.rows.length === 0) throw notFound;
    const { workspace_id: workspaceId, project_id: projectId,
            requirement_template_version_id: templateVersionId } = asg.rows[0];

    return withIdempotency<UploadIntentReceipt>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "upload_intents.create", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "evidence.record" });

      // The pinned template is the authority on what may be uploaded; the
      // fallback exists only for assignments that pin nothing.
      let media = FALLBACK_MEDIA;
      if (templateVersionId) {
        const t = await tx.query(
          `select allowed_media from public.requirement_template_versions
            where workspace_id = $1 and id = $2 and status = 'published'`,
          [workspaceId, templateVersionId]);
        if (t.rows.length > 0 && t.rows[0].allowed_media) {
          media = t.rows[0].allowed_media as typeof FALLBACK_MEDIA;
        }
      }

      // The failure table in docs/domain/execution-and-evidence.md requires the
      // user see the exact limit, not a generic rejection.
      if (!media.mimeTypes.includes(a.body.claimedMediaType)) {
        throw new HttpProblem(422, problem("EVIDENCE_MEDIA_REJECTED",
          `Тип «${a.body.claimedMediaType}» не дозволений. Дозволені: ${media.mimeTypes.join(", ")}.`,
          { requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "claimedMediaType", message: "media type not allowed" }] }));
      }
      if (a.body.expectedByteSize > media.maxByteSize) {
        throw new HttpProblem(422, problem("EVIDENCE_MEDIA_REJECTED",
          `Розмір ${a.body.expectedByteSize} Б перевищує ліміт ${media.maxByteSize} Б.`,
          { requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "expectedByteSize", message: "exceeds the allowed size" }] }));
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
            claimed_media_type, staging_bucket, staging_storage_key, expires_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [uploadIntentId, workspaceId, projectId, assignmentId, m.memberId,
         a.body.deviceCaptureId, a.body.originMethod, a.body.originalFilename ?? null,
         a.body.claimedCaptureTime ?? null, a.body.claimedTzOffset ?? null,
         a.body.sourceAppVersion ?? null, a.idempotencyKey, a.requestHash,
         a.body.expectedByteSize, a.body.expectedContentHash,
         a.body.claimedMediaType.split("/")[0], a.body.claimedMediaType,
         EVIDENCE_BUCKET, storageKey, expiresAt]);

      // The device's own account of the capture, kept separate from the
      // server's later assertions about the same upload.
      await tx.query(
        `insert into public.capture_events
           (workspace_id, project_id, work_assignment_id, upload_intent_id,
            device_capture_id, client_state, event_source, claimed_capture_time,
            claimed_tz_offset, capture_time_trust)
         values ($1,$2,$3,$4,$5,'not_sent','device',$6,$7,$8)`,
        [workspaceId, projectId, assignmentId, uploadIntentId, a.body.deviceCaptureId,
         a.body.claimedCaptureTime ?? null, a.body.claimedTzOffset ?? null,
         a.body.claimedCaptureTime ? "device_claimed" : "unknown"]);

      await recordAudit(tx, ctx, {
        action: "upload_intent.authorized", object_type: "upload_intent",
        object_id: uploadIntentId,
        details: { assignmentId, expectedByteSize: a.body.expectedByteSize },
      }, { organizationId: workspaceId });

      // No outbox event: an authorized intent is not yet a domain fact, and the
      // staged bytes it anticipates are not evidence.
      return {
        status: 201,
        body: {
          uploadIntentId, workspaceId, status: "intent_authorized",
          expiresAt: expiresAt.toISOString(),
          storage: { bucket: EVIDENCE_BUCKET, key: storageKey },
        },
      };
    });
  });

  // Minting per call is what keeps a replay's grant alive (D8), but it also means
  // the grant is issued OUTSIDE the idempotency callback — which does not re-run
  // on a replay. Without the check below, a caller who has since lost
  // evidence.record, or whose intent has expired or already been purged, would
  // replay the original request and receive a working token for the old key:
  // bytes uploaded against a row that will never be claimed again, because
  // purged_at is already set.
  const grantable = await withTenantTx(ctx, async (tx) => {
    const r = await tx.query(
      `select status, expires_at, purged_at, purge_claimed_at, project_id
         from public.upload_intents where workspace_id = $1 and id = $2`,
      [out.body.workspaceId, out.body.uploadIntentId]);
    const row = r.rows[0];
    if (!row) return { ok: false as const, reason: "gone" as const };

    const m = await requireActiveMembership(tx, a.requestId, a.userId, out.body.workspaceId);
    await requireProjectCapability(tx, a.requestId, {
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
      { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
  }

  const grant = await createSignedUpload(out.body.storage.key);
  const body: CreateUploadIntentResponse = {
    ...out.body,
    upload: { signedUrl: grant.signedUrl, token: grant.token },
  };
  return { status: out.status, body, expiresAt: out.expiresAt };
});
