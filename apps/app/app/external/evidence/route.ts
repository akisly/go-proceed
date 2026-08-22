import { withExternalTx } from "@goproceed/database";
import { invalidLink, resolveExternalSession } from "../../../src/lib/external-session";
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

    const row = await withExternalTx(
      { organizationId: scope.workspaceId, requestId, externalSessionId: scope.sessionId },
      async (tx) => {
        // Selected by id AND asserted to be one row. `eo_external_select` is
        // what actually scopes this to the session's occurrence — the `where`
        // clause only picks WHICH of the rows the policy already admits — and
        // asserting the count means a policy that ever widened fails loudly
        // here instead of quietly serving a sibling. The same discipline
        // `external/occurrence/route.ts` applies to its own single row.
        const r = await tx.query<EvidenceRow>(
          `select storage_bucket, storage_key, media_type, byte_size::text as byte_size
             from public.evidence_objects where id = $1`, [id]);
        if (r.rows.length !== 1) return null;
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
        // Server-sniffed at finalize, never client-declared — see the header.
        "content-type": row.media_type,
        "content-length": row.byte_size,
        // Re-applied by hand: `externalNoStore` is module-private to the
        // wrappers, and no wrapper can emit bytes.
        "cache-control": "no-store, no-cache, must-revalidate, private",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
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
