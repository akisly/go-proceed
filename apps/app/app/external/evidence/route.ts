import { withExternalTx } from "@goproceed/database";
import {
  EXTERNAL_RESPONSE_HEADERS, invalidLink, resolveExternalSession,
} from "../../../src/lib/external-session";
import { openObjectStream } from "../../../src/lib/evidence-storage";
import { requestIdFrom, toProblemResponse } from "../../../src/lib/http";

export const runtime = "nodejs";
// Bytes that belong to one session and one occurrence. A prerendered or cached
// response here would be somebody else's photo served from an edge.
export const dynamic = "force-dynamic";

/**
 * `external.evidence_bytes` — GET /external/evidence?evidenceObjectId=…
 * (technical/openapi/scope-v0.1.csv:61; query, natural idempotency, EXTERNAL
 * plane, governed by `external.view_scope` — capabilities.csv:37).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS IS THE GAP `external/occurrence/route.ts` NAMED IN ITS OWN HEADER.
 *
 * «The plan's M5 acceptance walk says the технагляд reads the requirement in the
 * standard's own wording WITH THE PHOTO. This returns the requirement in the
 * standard's own wording, and the photo's identity, size, media type, SHA-256
 * and provenance — not the photo. … A reviewer who cannot see the photo will not
 * accept, and that is the acceptance walk failing for a buildable reason.»
 *
 * This is the operation that closes it, and it is CATALOGUED rather than
 * invented: a row in `technical/openapi/scope-v0.1.csv`, governed by the same
 * `external.view_scope` capability that already governs the scope read, and
 * recorded in ADR-009's 2026-08-22 amendment together with the member plane's
 * `evidence.list`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS PLANE STREAMS WHILE THE MEMBER PLANE SIGNS, WHICH IS NOT A STYLE
 * CHOICE. `tenancy-and-security.md` §"Storage RLS" sanctions both: «Available-
 * object download uses a short-lived signed URL OR same-origin authorized
 * stream after current access revalidation.» The plane decides which, and for
 * THIS plane the decision is already made by a header this repository sends:
 * `external-link.ts`'s `externalSecurityHeaders` serves the review shell with
 * `default-src 'none'; … img-src 'self' data:`. A same-origin
 * `<img src="/external/evidence?…">` is admitted; a Supabase-hosted signed URL
 * is blocked by the page's own CSP before a single byte is requested. Signing
 * on this plane is not merely disfavoured — it does not work.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THE CALLER MAY NAME, AND WHAT IT MAY NOT.
 *
 * An evidence object ROW ID, never a storage key. A caller who can name a key
 * can name someone else's; the id, by contrast, was already handed to this
 * session by `GET /external/occurrence`, so this route discloses no new
 * identifier — only bytes for something the session was already told exists.
 * The key never leaves this handler: not in the response, not in a header, not
 * in an error (`EvidenceStorageError` carries a provider error CODE and a
 * status and nothing else, by construction), and not in a log line.
 *
 * NO NEW GRANT AND NO NEW POLICY WERE NEEDED, and that was established
 * positively rather than by reading the catalog. `eo_external_select`
 * (migration 0049 §10) already admits exactly «objects finalized from an
 * *available* intent on this session's one occurrence», and `storage_key` /
 * `storage_bucket` are already selectable by `goproceed_app` — the shipped
 * scope route simply never selected them. An external session selecting those
 * two columns returns ZERO ROWS AND NO PERMISSION ERROR, while the same session
 * touching `audit_events` gets `permission denied`: the row filter is what
 * denies evidence, the grant is what denies audit, and the two failure modes are
 * distinguishable. A migration here would have been a symptom of misreading
 * that.
 *
 * AND THE ROUTE STILL DOES NOT LEAVE THE SCOPING TO THAT POLICY ALONE. Its own
 * SQL joins the intent and requires `requirement_occurrence_id` to equal the
 * occurrence the SESSION resolved to, so «which obligation» is stated twice, by
 * two mechanisms, in two transactions. The query's own comment carries the
 * whole argument, including what the earlier version of this route claimed and
 * why that claim was false.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `externalQueryRoute` CANNOT SERVE THIS, so the `Response` is built by hand —
 * the same reason, and the same precedent, as `external/review/route.ts`. The
 * wrapper `JSON.stringify`s its handler's body and hard-codes
 * `content-type: application/json`; a `ReadableStream` through it becomes the
 * string `{}`.
 *
 * What that costs is `externalNoStore`, which is module-private to
 * `external-session.ts` and reachable only through the wrappers. ITS FOUR
 * HEADERS ARE RE-APPLIED BY HAND BELOW — `cache-control`, `referrer-policy`,
 * `x-content-type-options`, `x-frame-options` — and they are re-applied because
 * a response that omitted them would look completely normal: no error, no
 * warning, just an evidence photo an intermediary is allowed to keep.
 *
 * `nosniff` IS WHAT MAKES `Content-Type` LOAD-BEARING, and `media_type` is safe
 * to echo into it for one specific reason: it is SERVER-SNIFFED at finalize and
 * never client-declared. `evidence-inspection.ts` reads the magic bytes,
 * recognises `image/jpeg`, `image/png`, `application/pdf` and `image/heic`, and
 * `blocked` is the outcome for anything else — `finalize/route.ts` throws on a
 * blocked inspection before any `evidence_objects` row exists, and the column's
 * CHECK admits only `passed` and `not_required`. So an evidence row's
 * `media_type` is a fact the server measured, not a claim the client made, and
 * echoing it under `nosniff` narrows the browser to that type rather than
 * widening it to whatever the bytes might be taken for.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REVOCATION IS PER REQUEST, AND THAT IS THE WHOLE OF IT.
 *
 * `app.resolve_external_session` refuses a revoked, expired or superseded grant
 * before this handler's transaction is opened, and every external policy
 * re-resolves `app.external_session_scope()` — which repeats the same predicates
 * — at STATEMENT time inside it. Both are genuine and both are «before».
 *
 * WHAT IS NOT IMPLEMENTED, SAID PLAINLY SO NOBODY READS THE STREAM AS A
 * GUARANTEE IT DOES NOT MAKE: a revoke committed WHILE these bytes are moving
 * does not stop them. There is no chunked re-check, no abort path and no
 * cancellation token anywhere in this repository, and `openObjectStream` takes
 * no `AbortSignal` for exactly that reason. The installed SDK would accept one,
 * so building it later is mechanically possible — and it would be new mechanism,
 * not a consequence of having chosen to stream, and best-effort at any
 * granularity, because bytes already sent cannot be recalled.
 * `files-and-storage.md` §Downloads asks for «during»; what this route delivers
 * is «before», per request, twice. The test file asserts the next request is
 * refused and deliberately asserts nothing about a transfer in flight.
 *
 * NOTHING HERE WAS EXECUTED — corrected: this route and its suite were run
 * against the local stack on 2026-08-22.
 */

/**
 * The id is validated as a uuid BEFORE it reaches SQL, and the refusal is the
 * plane's own 404.
 *
 * Without this, `where id = $1` with a non-uuid raises SQLSTATE 22P02 and
 * `toProblemResponse` answers 500 `INTERNAL_ERROR` — a second, distinguishable
 * failure shape on a plane whose whole discipline is that «every failure is the
 * same failure» (`external-session.ts`). It is not an existence oracle (a
 * malformed id is malformed whatever exists), but it is a shape difference a
 * caller can measure, and a 500 for a caller-shaped input is wrong on its own
 * terms. The house defect this deliberately does NOT reproduce is the
 * malformed-uuid 500 in the member plane's path segments, recorded in the Task 3
 * ledger as house-wide and not that task's to fix; a route being written from
 * scratch has no such excuse.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A `type` and not an `interface`, deliberately: `pg`'s `query<R>` constrains R
 * to `QueryResultRow` (`{ [column: string]: any }`), and a type alias for an
 * object literal gets an implicit index signature while an interface does not.
 * The same shape declared as an interface does not compile here.
 */
type EvidenceRow = {
  storage_bucket: string;
  storage_key: string;
  media_type: string;
  byte_size: string;
};

export async function GET(req: Request): Promise<Response> {
  // Minted first and replaced by the header's value only if that value is
  // valid: `requestIdFrom` THROWS on a malformed `X-Request-Id`, so it has to
  // run inside the try, exactly as both external wrappers run it.
  let requestId = crypto.randomUUID();
  try {
    requestId = requestIdFrom(req);
    // Refuses a revoked grant here, before any statement below runs.
    const scope = await resolveExternalSession(req, requestId);

    const id = new URL(req.url).searchParams.get("evidenceObjectId") ?? "";
    if (!UUID.test(id)) throw invalidLink(requestId);

    // Read out of the scope HERE, on its own line, so that the one value the
    // query below uses to bound itself is visibly the session's and never the
    // caller's. Nothing between this line and the query can substitute it.
    const occurrenceId = scope.occurrenceId;

    const row = await withExternalTx(
      { organizationId: scope.workspaceId, requestId, externalSessionId: scope.sessionId },
      async (tx) => {
        // ── THE ROUTE PINS THE OCCURRENCE ITSELF — CORRECTED 2026-08-22 ────
        //
        // WHAT STOOD HERE AND WHY IT WAS WRONG. This query was
        // `select … from public.evidence_objects where id = $1` followed by
        // `if (r.rows.length !== 1) return null`, under a comment claiming
        // that «asserting the count means a policy that ever widened fails
        // loudly here instead of quietly serving a sibling». THE ASSERTION
        // DETECTED NOTHING. `evidence_objects.id` is the table's PRIMARY KEY
        // (migration 0015:300), so `where id = $1` returns zero or one row
        // under any policy whatsoever: `length !== 1` was exactly `=== 0`. A
        // widened `eo_external_select` would have returned its one row, the
        // count check would have passed, and the sibling would have been
        // streamed with a 200.
        //
        // The precedent that comment cited does the opposite thing.
        // `external/occurrence/route.ts` selects with NO `where` at all, lets
        // the policy pick the row, and then compares `rows[0].id` against
        // `a.scope.occurrenceId` — a cross-check against a value resolved by a
        // DIFFERENT mechanism in a DIFFERENT transaction. That is what fails
        // loudly. Filtering on caller input and cross-checking nothing is not
        // the same discipline; it is the absence of one.
        //
        // WHAT THIS DOES INSTEAD, AND WHAT IT IS AND IS NOT. The route now
        // states the scope in its own SQL: it joins the `upload_intents` row
        // the policy joins, and requires `ui.requirement_occurrence_id = $2`
        // where `$2` is `scope.occurrenceId` — the one field of the resolved
        // session this handler otherwise never touches, produced by
        // `app.resolve_external_session` in the earlier anonymous transaction,
        // NOT by the `app.external_session_occurrence()` the policy calls. So
        // the occurrence is asserted twice by two paths, and a policy that
        // widened — to the assignment, to a second status, to the workspace —
        // still cannot make this route serve a row outside the grant.
        //
        // THIS IS PREVENTION AND NOT DETECTION, said plainly because the
        // sentence it replaces claimed detection it did not have: nothing here
        // notices that a policy widened. It only refuses to benefit from it. A
        // widened policy would show up as `tests/external-evidence.int.test.ts`
        // going red against the sibling and fallback cases, and nowhere else.
        //
        // `ui.status = 'available'` is restated even though `ui_external_select`
        // already requires it and `eo_external_select` requires it again: the
        // design's own rule for this join is to keep both directions of defence
        // rather than let one policy carry them all. Both join directions are
        // FK-backed — `evidence_objects(workspace_id, upload_intent_id)` →
        // `upload_intents(workspace_id, id)` and
        // `upload_intents(workspace_id, finalized_evidence_object_id)` →
        // `evidence_objects(workspace_id, id)` (0015:332-355) — so requiring
        // both is a pair of index lookups, not a scan.
        const r = await tx.query<EvidenceRow>(
          `select eo.storage_bucket, eo.storage_key, eo.media_type,
                  eo.byte_size::text as byte_size
             from public.evidence_objects eo
             join public.upload_intents ui
               on ui.workspace_id = eo.workspace_id
              and ui.id = eo.upload_intent_id
              and ui.finalized_evidence_object_id = eo.id
            where eo.id = $1
              and ui.requirement_occurrence_id = $2
              and ui.status = 'available'`, [id, occurrenceId]);
        // Zero or one, by the primary key. Stated as the null check it is.
        return r.rows[0] ?? null;
      });

    // ZERO ROWS IS THE PLANE'S ONE REFUSAL, and it covers every reason at once:
    // an id on a sibling occurrence, an id belonging to another workspace, an id
    // that never existed, an object whose intent is not `available`, and a grant
    // revoked between the resolution transaction and this statement. INV-001 /
    // INV-002: «never reveals whether a recipient, package, occurrence,
    // workspace, or grant exists».
    if (row === null) throw invalidLink(requestId);

    // ARGUMENT ORDER: (key, bucket). `bucket` is required and never defaulted —
    // `storage_bucket` is a per-row column, and a caller that silently fell back
    // to the constant would make «not in the bucket I looked in» and «gone» the
    // same observation.
    const stream = await openObjectStream(row.storage_key, row.storage_bucket);

    return new Response(stream, {
      status: 200,
      headers: {
        // SPREAD, NOT RE-TYPED — corrected 2026-08-22. These four used to be
        // four literals copied out of `externalNoStore`, with nothing tying the
        // copies together: a fifth header added there would have extended every
        // wrapper-served response and silently skipped this one, and this
        // route's test — which pinned the four literals it knew about — would
        // have stayed green. `EXTERNAL_RESPONSE_HEADERS` is now the single
        // source both spread, and the test iterates it rather than a list of
        // its own.
        ...EXTERNAL_RESPONSE_HEADERS,
        // Server-sniffed at finalize, never client-declared — see the file
        // header for why that is what makes `nosniff` usable here.
        "content-type": row.media_type,
        "content-length": row.byte_size,
        // ── THIS RESPONSE CARRIES ITS OWN CSP — added 2026-08-22 ───────────
        //
        // `x-frame-options` stops this URL being FRAMED. It does not stop it
        // being NAVIGATED to, and a top-level navigation to a byte response is
        // a document of its own on the external origin, which the review
        // shell's `externalSecurityHeaders` CSP does not reach — a CSP binds
        // the response it is served on, never a sibling document. Most of the
        // allowed media types are inert images; `application/pdf` is not — it
        // is in `evidence-inspection.ts`'s recognised set, and browsers render
        // it inline in a viewer that historically has had script surface.
        //
        // `default-src 'none'; sandbox` costs one header. `sandbox` with no
        // allow-tokens is the most restrictive form: opaque origin, no scripts,
        // no forms, no top-level navigation out.
        //
        // WHAT IS ESTABLISHED AND WHAT IS NOT, per this branch's rule against
        // claiming unmeasured mechanism: what is established is that the header
        // is sent (asserted by the suite). That CSP's `sandbox` directive
        // applies only when the response is loaded AS A DOCUMENT — which is
        // what leaves `<img>` unaffected — is the specification's rule, not
        // something measured in a browser here. Nothing in this repository
        // renders a PDF, and no browser audit exercises this path today; Task
        // 7's audit is where such a measurement would belong.
        "content-security-policy": "default-src 'none'; sandbox",
        "x-request-id": requestId,
      },
    });
  } catch (err) {
    // `EvidenceStorageError` reaches here when the row says there is an object
    // and storage disagrees — a purged key, a bucket renamed out of band. It
    // becomes a 500 rather than the 404 above, and that is deliberate: «you may
    // not see this» and «this system is inconsistent with itself» are different
    // facts and the reviewer's page should not report the second as the first.
    // It is not an oracle either — only a session already holding this
    // occurrence's own evidence id can reach it. What it carries into the log is
    // the provider's error CODE and status; the key and the provider's message
    // are unreachable from it by construction.
    return toProblemResponse(err, requestId);
  }
}
