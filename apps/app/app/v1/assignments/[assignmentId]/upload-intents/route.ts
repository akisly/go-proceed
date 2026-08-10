import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  createUploadIntentRequest,
  type CreateUploadIntentResponse, type UploadIntentReceipt,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";
import {
  EVIDENCE_BUCKET, newEvidenceKey, createSignedUpload,
} from "../../../../../src/lib/evidence-storage";
import { allowedMediaOf } from "../../../../../src/lib/requirement-content";

export const runtime = "nodejs";

/**
 * THE MEDIA POLICY HAS THREE SOURCES AND THEIR ORDER IS THE WHOLE POINT.
 *
 *   1. the REQUIREMENT OCCURRENCE named in the request, through its pinned rule
 *      version — the authority from v0.1-M2 on (ADR-005 decision 2);
 *   2. the requirement template pinned to the assignment — RETIRED lineage, read
 *      only for assignments that already carry one;
 *   3. `FALLBACK_MEDIA`, for an intent that names neither.
 *
 * THE ORDER IS WHAT AVOIDS THE WINDOW THE PLAN WARNS ABOUT. Contradiction 3:
 * once nothing writes `requirement_template_version_id`, source 2 is never
 * entered and EVERY upload in the product silently falls back to 50 MB and four
 * MIME types — «nothing fails; the gate just gets wider, which is the failure
 * mode the whole ADR is written against». The prescribed sequence is «add the
 * occurrence source, then retire the pin, then remove the template read», and
 * this slice does the first only. Source 2 is still read, and
 * `assignments.create` still writes the pin, precisely so that no assignment
 * loses its gate on the day the occurrence set is still empty. Removing either
 * belongs to the slice that makes materialisation able to produce an occurrence
 * — see `workTypeKeyOf` in src/lib/requirement-materialisation.ts.
 *
 * THAT SLICE HAS NOW LANDED THE CARRIER AND NOT THE RETIREMENT. Migration 0050
 * makes materialisation able to produce an occurrence for a TYPED line, so
 * steps two and three of the prescribed sequence — retire the pin, remove the
 * template read — are now REACHABLE and are still OWED. They are deliberately
 * not taken here: an UNTYPED line still materialises nothing, so an assignment
 * on an imported baseline still has no occurrence to read a media policy from,
 * and retiring source 2 today would drop exactly those assignments to the
 * fallback — the widening this comment exists against. The condition for step
 * two is not «the carrier exists» but «every assignment that can reach this
 * route has an occurrence», and an imported baseline never will.
 *
 * WHAT THE FALLBACK IS NOT ALLOWED TO BE: the answer to a broken policy. An
 * occurrence whose rule version carries an unusable `allowed_media` REFUSES the
 * upload; it does not widen to the fallback. A gate that opens when its policy
 * cannot be read is not a gate.
 */
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

      let media = FALLBACK_MEDIA;
      if (a.body.requirementOccurrenceId) {
        // Scoped by (workspace, project, assignment, occurrence) — the same four
        // columns as `upload_intents_occurrence_fkey` (migration 0043 §5), so a
        // request naming another assignment's obligation is refused HERE with a
        // field error rather than at INSERT with a 23503 nobody can act on. The
        // FK is deliberately stricter than relationship-catalog.csv:46: a
        // captured original may only answer an obligation of the assignment it
        // was captured under.
        //   THE READ IS SUBJECT TO ro_select (0043 §9), WHICH ASKS FOR
        //   project.view/project.admin — and this route's own check is
        //   evidence.record. A holder of evidence.record alone sees no rows and
        //   is told the occurrence is unknown. That is not a bug in this query:
        //   capabilities.csv:14 makes project.view how the foreman reads the
        //   occurrence set at all, so a foreman who cannot see it here cannot
        //   see it on requirement_occurrences.list either.
        //   RECORDED: responsibility-presets.csv maps the `foreman` persona to
        //   `progress.record evidence.record` and NOT project.view. Either that
        //   preset owes project.view or the occurrence read owes a narrower
        //   capability; it is a catalog decision and it is not taken here.
        const o = await tx.query(
          `select o.evidence_kind, rv.allowed_media
             from public.requirement_occurrences o
             join public.requirement_rule_versions rv
               on rv.workspace_id = o.workspace_id and rv.id = o.rule_version_id
            where o.workspace_id = $1 and o.project_id = $2
              and o.work_assignment_id = $3 and o.id = $4`,
          [workspaceId, projectId, assignmentId, a.body.requirementOccurrenceId]);
        if (o.rows.length === 0) {
          throw new HttpProblem(422, problem("VALIDATION_FAILED",
            "Вимогу не знайдено серед обов'язків цього завдання.",
            { requestId: a.requestId, retryable: false, userAction: "correct_fields",
              fieldErrors: [{ path: "requirementOccurrenceId",
                              message: "unknown occurrence for this assignment" }] }));
        }
        const policy = allowedMediaOf(o.rows[0].allowed_media);
        if (policy === null) {
          // Two cases reach this, and neither may widen the gate:
          //   * `measurement` and `checkbox` produce no uploaded original, and
          //     `publishRequirementRuleVersionRequest` refuses `allowedMedia`
          //     for them — the column keeps its `'[]'::jsonb` default, which
          //     `allowedMediaOf` maps to null;
          //   * a `photo`/`document` version whose policy is not the object the
          //     gate reads. Migration 0044 makes that unstorable; until it is
          //     applied this is the only thing stopping it becoming a 50 MB
          //     fallback.
          throw new HttpProblem(422, problem("VALIDATION_FAILED",
            "Ця вимога не приймає завантажений файл.",
            { requestId: a.requestId, retryable: false, userAction: "correct_fields",
              fieldErrors: [{ path: "requirementOccurrenceId",
                              message: `evidence kind '${o.rows[0].evidence_kind}' `
                                + "takes no uploaded original" }] }));
        }
        media = policy;
      } else if (templateVersionId) {
        // RETIRED LINEAGE (ADR-005 decision 2), read and not yet removed. See the
        // note on FALLBACK_MEDIA above for why removing it now would widen the
        // gate for every assignment that already pins a template.
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
        throw new HttpProblem(422, problem("UPLOAD_SIZE_LIMIT",
          `Тип «${a.body.claimedMediaType}» не дозволений. Дозволені: ${media.mimeTypes.join(", ")}.`,
          { requestId: a.requestId, retryable: false, userAction: "reduce_file_or_request_policy_change",
            fieldErrors: [{ path: "claimedMediaType", message: "media type not allowed" }] }));
      }
      if (a.body.expectedByteSize > media.maxByteSize) {
        throw new HttpProblem(422, problem("UPLOAD_SIZE_LIMIT",
          `Розмір ${a.body.expectedByteSize} Б перевищує ліміт ${media.maxByteSize} Б.`,
          { requestId: a.requestId, retryable: false, userAction: "reduce_file_or_request_policy_change",
            fieldErrors: [{ path: "expectedByteSize", message: "exceeds the allowed size" }] }));
      }

      // Quota. The protocol says the server validates it before issuing the
      // destination; until 0026 nothing did, and quota_reserved_bytes was a
      // column nobody wrote. A workspace with no limit configured is unlimited,
      // which is the behaviour that shipped — the figure itself is an external
      // gate (see 0015 and 0026).
      // Serialized per workspace. Read-then-reserve is a classic
      // check-then-act: without the lock, concurrent creations all read the
      // same total, all find room, and all reserve — oversubscribing a limit
      // that exists precisely to be a limit.
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`evidence_quota|${workspaceId}`]);

      const quota = await tx.query(
        `select o.evidence_quota_bytes,
                app.evidence_bytes_in_use($1) as in_use
           from public.organizations o where o.id = $1`, [workspaceId]);
      const limit = quota.rows[0]?.evidence_quota_bytes;
      if (limit !== null && limit !== undefined) {
        const inUse = BigInt(quota.rows[0].in_use);
        if (inUse + BigInt(a.body.expectedByteSize) > BigInt(limit)) {
          // 422 per the catalog: the request is unacceptable as stated, and the
          // caller's move is to send less or ask for a policy change.
          throw new HttpProblem(422, problem("UPLOAD_SIZE_LIMIT",
            `Ліміт сховища вичерпано: зайнято ${inUse} Б із ${limit} Б.`,
            { requestId: a.requestId, retryable: false, userAction: "reduce_file_or_request_policy_change" }));
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
         a.body.deviceCaptureId, a.body.originMethod, a.body.originalFilename ?? null,
         a.body.claimedCaptureTime ?? null, a.body.claimedTzOffset ?? null,
         a.body.sourceAppVersion ?? null, a.idempotencyKey, a.requestHash,
         a.body.expectedByteSize, a.body.expectedContentHash,
         a.body.claimedMediaType.split("/")[0], a.body.claimedMediaType,
         EVIDENCE_BUCKET, storageKey, expiresAt,
         // The binding between a captured original and the obligation it was
         // captured against — the FK migration 0043 §5 activates, and the one
         // 0015:251 deferred to «v0.1-M3 with the table» when the table is M2.
         a.body.requirementOccurrenceId ?? null]);

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
        details: {
          assignmentId, expectedByteSize: a.body.expectedByteSize,
          requirementOccurrenceId: a.body.requirementOccurrenceId ?? null,
          // Which of the three sources decided what may be uploaded. Without it
          // «the gate was the fallback» is invisible after the fact, and that is
          // the one thing about this route worth being able to prove later.
          mediaPolicySource: a.body.requirementOccurrenceId ? "requirement_occurrence"
            : templateVersionId ? "retired_template_pin" : "fallback",
        },
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
