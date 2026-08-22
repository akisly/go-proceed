import { queryRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { assignmentEvidenceResponse, type EvidenceObjectView } from "@goproceed/contracts";
import { withTenantTx } from "@goproceed/database";
import { createSignedReadUrls } from "../../../../../src/lib/evidence-storage";

export const runtime = "nodejs";

/**
 * `evidence.list` — GET /v1/assignments/{assignmentId}/evidence
 * (technical/openapi/scope-v0.1.csv; query, idempotency natural, member
 * plane, governed by `project.view`).
 *
 * THE MEMBER-PLANE READ. This is the office's way to look at a photo: no
 * route in the product returned one before this. Authorize, query, sign
 * short-lived URLs, and refuse to be cached — a later slice builds the
 * screen and the no-account external stream.
 *
 * THE AUTHORIZATION SHAPE IS COPIED VERBATIM FROM
 * `requirement-occurrences/route.ts` — resolve the assignment first with no
 * workspace predicate (RLS policy `wa_select`, migration 0016, already
 * requires `project.view`/`project.admin` to see the row at all), read the
 * ids off it, then membership, then the capability.
 */
export const GET = queryRoute(async (a) => {
  const assignmentId = a.params.assignmentId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Завдання не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!assignmentId) throw notFound;

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx) => {
    const asg = await tx.query(
      `select workspace_id, project_id from public.work_assignments where id = $1`,
      [assignmentId]);
    if (asg.rows.length === 0) throw notFound;
    const workspaceId = asg.rows[0].workspace_id as string;
    const projectId = asg.rows[0].project_id as string;

    const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
    await requireProjectCapability(tx, a.requestId,
      { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });

    // `status = 'available'` is LOGICALLY REDUNDANT with the join — only
    // app.finalize_upload_intent writes finalized_evidence_object_id, and it
    // sets status in the same UPDATE. It is written anyway because NO CHECK
    // CONSTRAINT ties the two columns: the invariant is held by a revoked
    // UPDATE grant (migration 0031), and a future migration re-granting it
    // would break this with nothing red. The two defences fail differently.
    const rows = await tx.query(
      `select ui.requirement_occurrence_id,
              eo.id, eo.media_type, eo.byte_size::text as byte_size, eo.content_hash,
              eo.original_filename, eo.origin_method, eo.capture_time_trust,
              eo.claimed_capture_time, eo.server_received_at,
              eo.storage_bucket, eo.storage_key
         from public.upload_intents ui
         join public.evidence_objects eo
           on eo.workspace_id = ui.workspace_id
          and eo.id = ui.finalized_evidence_object_id
        where ui.workspace_id = $1
          and ui.work_assignment_id = $2
          and ui.status = 'available'
        order by ui.requirement_occurrence_id nulls last,
                 eo.server_received_at, eo.id`,
      [workspaceId, assignmentId]);

    // `storage_bucket` comes from the ROW, never from EVIDENCE_BUCKET: the
    // uniques are (storage_bucket, storage_key) and (workspace_id,
    // storage_key), so a second bucket is representable and the constant
    // would break. `createSignedReadUrls` takes (keys, bucket) in that
    // order and `bucket` is required — no default, so a caller cannot fall
    // back to the constant even by omission.
    const byBucket = new Map<string, string[]>();
    for (const r of rows.rows) {
      const bucket = r.storage_bucket as string;
      const list = byBucket.get(bucket) ?? [];
      list.push(r.storage_key as string);
      byBucket.set(bucket, list);
    }
    const signed = new Map<string, string>();
    for (const [bucket, keys] of byBucket) {
      // NOT CAUGHT HERE, DELIBERATELY. `createSignedReadUrls` throws
      // `EvidenceStorageError` only when EVERY key in a non-empty batch
      // failed to sign — a lost `select` grant on `storage.objects`, a
      // renamed bucket — and letting that become this route's 500 is the
      // correct failure: a screen rendering «немає фото» for an assignment
      // that has evidence is exactly what this slice exists to prevent.
      // A single key that fails to sign inside an otherwise-successful batch
      // does NOT throw; it is simply absent from `signed` below, and its
      // evidence entry omits `readUrl`.
      for (const [k, url] of await createSignedReadUrls(keys, bucket)) signed.set(k, url);
    }

    // Grouping preserves the null bucket and its position: the SQL already
    // ordered `nulls last`, so walking rows in order and starting a new
    // group whenever the occurrence id changes keeps it at the end.
    const groups: { occurrenceId: string | null; evidence: EvidenceObjectView[] }[] = [];
    for (const r of rows.rows) {
      const occ = (r.requirement_occurrence_id as string | null) ?? null;
      let g = groups.at(-1);
      if (!g || g.occurrenceId !== occ) { g = { occurrenceId: occ, evidence: [] }; groups.push(g); }
      g.evidence.push({
        evidenceObjectId: r.id as string,
        mediaType: r.media_type as string,
        byteSize: Number(r.byte_size),
        contentHash: r.content_hash as string,
        originalFilename: (r.original_filename as string | null) ?? null,
        originMethod: r.origin_method as string,
        captureTimeTrust: r.capture_time_trust as string,
        claimedCaptureTime: r.claimed_capture_time
          ? new Date(r.claimed_capture_time as string).toISOString() : null,
        serverReceivedAt: new Date(r.server_received_at as string).toISOString(),
        readUrl: signed.get(r.storage_key as string),
      });
    }

    return assignmentEvidenceResponse.parse({ groups });
  });

  return {
    status: 200,
    body,
    // The body carries bearer capabilities (a signed read URL, valid for
    // `EVIDENCE_URL_TTL_SECONDS`). A shared cache holding this response hands
    // them to whoever asks next.
    headers: { "cache-control": "no-store" },
  };
});
