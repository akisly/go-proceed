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
  // STORAGE IO HAPPENS OUTSIDE THIS TRANSACTION, and the transaction returns
  // rows rather than a response body for that one reason.
  //
  // `createSignedReadUrls` is an HTTP POST to the storage API with no timeout
  // this app sets. Awaited inside `withTenantTx` it held a pooled connection in
  // `begin` for the whole round trip, and nothing after it touched `tx`. The
  // pool is `max: 10` with no `connectionTimeoutMillis`
  // (`packages/database/src/pool.ts`), and the running database has
  // `statement_timeout`, `idle_in_transaction_session_timeout` and
  // `transaction_timeout` all `0` — so nothing on either side would have reaped
  // it, and a slow storage backend would have become a member-plane outage
  // rather than a slow screen.
  //
  // The rule is already stated in terms on this branch —
  // `app/v1/upload-intents/[intentId]/finalize/route.ts:169-170`: «Storage IO
  // happens outside the transaction: it is slow, and holding a database
  // connection across it buys nothing» — and this slice's other storage-reading
  // route already obeys it (`app/external/evidence/route.ts:261` closes its
  // transaction, `:275` opens the stream). The move is behaviour-preserving: the rows
  // are already fully materialised, the signing reads no `tx`, and the grouping
  // and `parse` below are pure.
  const rows = await withTenantTx(ctx, async (tx) => {
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
    const evidence = await tx.query(
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

    return evidence.rows;
  });

  // `storage_bucket` comes from the ROW, never from EVIDENCE_BUCKET: the
  // uniques are (storage_bucket, storage_key) and (workspace_id,
  // storage_key), so a second bucket is representable and the constant
  // would break. `createSignedReadUrls` takes (keys, bucket) in that
  // order and `bucket` is required — no default, so a caller cannot fall
  // back to the constant even by omission.
  const byBucket = new Map<string, string[]>();
  for (const r of rows) {
    const bucket = r.storage_bucket as string;
    const list = byBucket.get(bucket) ?? [];
    list.push(r.storage_key as string);
    byBucket.set(bucket, list);
  }
  // NO THROW ON A PER-OBJECT FAILURE, NOT EVEN A WHOLE BATCH OF THEM.
  // `createSignedReadUrls` (fixed round 2) reports failed keys instead of
  // throwing for anything short of a genuine wholesale SDK error (auth,
  // transport, an invalid bucket name) — the earlier fix-round-1 remedy
  // (throw when the whole batch failed) turned "1 of 1 failed", the modal
  // shape at pilot start, into a 500 for the WHOLE assignment's read, which
  // is worse than the failure it guarded against. `signed` below is built
  // from `.urls` only; a key absent from it — whether one key or the whole
  // batch failed — simply omits `readUrl` on its row, below.
  const signed = new Map<string, string>();
  for (const [bucket, keys] of byBucket) {
    const { urls } = await createSignedReadUrls(keys, bucket);
    for (const [k, url] of urls) signed.set(k, url);
  }

  // Grouped by a Map keyed on occurrence id, NOT by comparing against
  // `groups.at(-1)`: the earlier form depended entirely on the SQL's
  // `ORDER BY … nulls last` to keep one occurrence's rows contiguous — a
  // later re-sort (e.g. "newest first") would silently split one occurrence
  // into two groups sharing an id, or emit two null groups, and no type
  // system catches that. Keying on the occurrence id makes correctness a
  // property of the grouping code, not of a query it does not control. The
  // null group is still emitted LAST, but explicitly, by construction below
  // — not because rows happened to arrive in that order.
  const byOccurrence = new Map<string, EvidenceObjectView[]>();
  let nullGroup: EvidenceObjectView[] | null = null;
  for (const r of rows) {
    const occ = (r.requirement_occurrence_id as string | null) ?? null;
    const view: EvidenceObjectView = {
      evidenceObjectId: r.id as string,
      mediaType: r.media_type as string,
      byteSize: Number(r.byte_size),
      contentHash: r.content_hash as string,
      originalFilename: (r.original_filename as string | null) ?? null,
      originMethod: r.origin_method as string,
      captureTimeTrust: r.capture_time_trust as EvidenceObjectView["captureTimeTrust"],
      claimedCaptureTime: r.claimed_capture_time
        ? new Date(r.claimed_capture_time as string).toISOString() : null,
      serverReceivedAt: new Date(r.server_received_at as string).toISOString(),
      readUrl: signed.get(r.storage_key as string),
    };
    if (occ === null) {
      (nullGroup ??= []).push(view);
    } else {
      const list = byOccurrence.get(occ);
      if (list) list.push(view);
      else byOccurrence.set(occ, [view]);
    }
  }
  const groups: { occurrenceId: string | null; evidence: EvidenceObjectView[] }[] =
    [...byOccurrence].map(([occurrenceId, evidence]) => ({ occurrenceId, evidence }));
  if (nullGroup) groups.push({ occurrenceId: null, evidence: nullGroup });

  const body = assignmentEvidenceResponse.parse({ groups });

  return {
    status: 200,
    body,
    // The body carries bearer capabilities (a signed read URL, valid for
    // `EVIDENCE_URL_TTL_SECONDS`). A shared cache holding this response hands
    // them to whoever asks next.
    headers: { "cache-control": "no-store" },
  };
});
