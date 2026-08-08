import { externalExchangeRequest, type ExternalExchangeResponse, problem } from "@goproceed/contracts";
import { withAnonymousTx, recordAudit } from "@goproceed/database";
import { HttpProblem, toProblemResponse, ok, requestIdFrom } from "../../../src/lib/http";
import {
  EXTERNAL_SESSION_ABSOLUTE_SECONDS, EXTERNAL_SESSION_IDLE_SECONDS,
  allowedExternalOrigin, externalSessionCookie, hmacOf, linkKeys, newSecret,
  sessionKeys, signWithActiveKey, verifiersEqual,
} from "../../../src/lib/external-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `external.exchange` — POST /external/exchange
 * (technical/openapi/scope-v0.1.csv:56; command, idempotency `single_use`,
 * PUBLIC plane, contracts owned by `@goproceed/contracts#external`).
 *
 * The deliberate POST. Everything the protocol calls single-use, atomic and
 * unrevealing happens inside `app.exchange_external_grant` (migration 0049 §7),
 * under one row lock, in one transaction: find the grant by its keyed verifier,
 * refuse unless it is live and unconsumed, mark it consumed, create exactly one
 * session. INV-057 in one place.
 *
 * «DELIBERATE» BECAME LITERAL ON 2026-08-08. Until that date the only thing
 * deliberate about this POST was that it was a POST: the shell fired it on load,
 * so a mail-security scanner that renders and EXECUTES — Safe Links, URL
 * Defense — consumed the grant before the технагляд opened the letter. The shell
 * now sends it from a click handler and from nowhere else
 * (`review/route.ts` §"What «deliberate POST» means"). Nothing in THIS file
 * changed and nothing in it needed to: a route that consumes on a POST is
 * correct, and the defect was in what sent the POST.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `single_use` IS NOT `Idempotency-Key`.
 *
 * This is the one command in the product with no `Idempotency-Key` header, and
 * `technical/openapi/scope-v0.1.csv:56` says so in its own column. The
 * idempotency of an exchange IS the consumed marker: a second POST with the same
 * token does not replay a stored response, it finds
 * `exchange_consumed_at is not null` and receives the same generic refusal as a
 * token that never existed. A stored replay would be worse than useless here —
 * it would hand the session cookie of a live session to whoever repeated the
 * request.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVERY FAILURE IS ONE FAILURE.
 *
 * 404 `EXTERNAL_SHARE_INVALID` for: a malformed token, a token that matches no
 * row under any key, a revoked grant, an expired grant, a grant already
 * exchanged, a grant of the v0.2 package arc, and a verifier that survived the
 * index probe and failed the constant-time comparison. tenancy-and-security.md
 * §"Fragment shell and exchange": «never reveals whether a recipient, package,
 * occurrence, workspace, or grant exists». There is no branch in this file that
 * produces a different code for a different reason.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BODY IS THE ONE BODY IN THIS PRODUCT THAT MUST NOT BE LOGGED.
 *
 * It is read once with `req.text()`, parsed, HMAC'd and dropped. It is not put
 * in a problem document — the 422 for a malformed token names the FIELD and
 * never echoes the value — not in an audit row, not in an outbox payload, and
 * not in any `console` call. `toProblemResponse` serializes only the problem
 * object it is given.
 *
 * WHAT IS NOT DONE HERE, AND IS OWED: throttling. tenancy-and-security.md
 * §"Throttling and privacy" requires burst and sustained limits by source
 * network and opaque grant prefix, bounded failure counters, and
 * distributed-abuse alerting on this exact endpoint. NONE OF IT EXISTS — this
 * product has no rate limiter for any surface, and a per-grant counter is
 * unimplementable here because a wrong token matches no grant to count against.
 * Migration 0049 §11 items 3 and 4 record it. What stands in its place is the
 * token's 256 bits and the single-use marker, which bound the value of a guess
 * and not the rate of guessing.
 *
 * NOTHING HERE WAS EXECUTED.
 */
export async function POST(req: Request): Promise<Response> {
  let requestId = crypto.randomUUID();
  try {
    requestId = requestIdFrom(req);

    const invalid = new HttpProblem(404, problem("EXTERNAL_SHARE_INVALID",
      "Це посилання більше не дійсне. Попросіть надіслати нове.",
      { requestId, retryable: false, userAction: "request_new_link" }));

    // «accepts HTTPS POST only with strict content type and same-origin checks».
    // The origin is compared against the CONFIGURED value, never against the
    // request's own `Host` header: a same-origin check that trusts `Host` is a
    // check an attacker passes by setting `Host`.
    const contentType = (req.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
    const origin = req.headers.get("origin");
    const badRequest = (path: string) => new HttpProblem(422,
      problem("VALIDATION_FAILED",
        "Запит відхилено з міркувань безпеки. Відкрийте посилання з листа ще раз.",
        { requestId, retryable: false, userAction: "correct_fields",
          fieldErrors: [{ path, message: "required" }] }));
    if (contentType !== "application/json") throw badRequest("Content-Type");
    if (origin === null || origin !== allowedExternalOrigin()) throw badRequest("Origin");

    const raw = await req.text();
    let json: unknown;
    try { json = raw === "" ? {} : JSON.parse(raw); }
    catch { throw badRequest("token"); }
    const parsed = externalExchangeRequest.safeParse(json);
    // The field path and nothing else. `parsed.error` would carry the received
    // value in some zod issue shapes, so it is not spread into the response.
    if (!parsed.success) throw badRequest("token");
    const token = parsed.data.token;

    // New session and CSRF secrets, generated BEFORE the call so the definer
    // function receives verifiers and never a secret it could store by mistake.
    const sessionValue = newSecret();
    const csrfValue = newSecret();
    const sessions = sessionKeys();
    const signedSession = signWithActiveKey(sessions, sessionValue);
    const signedCsrf = { keyId: signedSession.keyId, verifier: hmacOf(sessions, signedSession.keyId, csrfValue) };

    const links = linkKeys();

    const result = await withAnonymousTx({ requestId }, async (tx) => {
      // EVERY link key, not just the active one. A grant issued under `k1` must
      // keep working while `k2` is active, which is the whole reason
      // `hmac_key_id` is stored beside the verifier. The loop is over the
      // registry and not over the database: the row is found BY the verifier, so
      // there is nothing to read first.
      for (const keyId of links.keys.keys()) {
        const candidate = hmacOf(links, keyId, token);
        const r = await tx.query(
          `select session_id, workspace_id, project_id, grant_id, occurrence_id,
                  may_decide, token_hmac, absolute_expires_at, idle_expires_at
             from app.exchange_external_grant($1,$2,$3,$4,$5,$6,$7)`,
          [keyId, candidate, signedSession.keyId, signedSession.verifier,
           signedCsrf.verifier, EXTERNAL_SESSION_IDLE_SECONDS,
           EXTERNAL_SESSION_ABSOLUTE_SECONDS]);
        if (r.rows.length === 0) continue;

        const row = r.rows[0];
        // The second comparison, and the constant-time one. The index probe
        // above found the row; this confirms it the way
        // tenancy-and-security.md §"Grant creation" item 4 asks. If it ever
        // disagreed, the transaction rolls back and the grant is NOT consumed —
        // which is the correct outcome for a row that should not have matched.
        if (!verifiersEqual(candidate, row.token_hmac as Buffer)) {
          throw invalid;
        }

        // THE ONE PLACE THE SESSION GUC IS SET OUTSIDE `withExternalTx`, and it
        // is set here because the session did not exist when this transaction
        // began. Without it the audit row below is refused by
        // `audit_insert_external`, whose whole purpose is that an external write
        // can only audit into its own session's workspace. It is
        // transaction-local (`is_local = true`), so it dies with this
        // transaction like every other GUC in this product.
        await tx.query("select set_config('app.external_session_id', $1, true)",
          [row.session_id]);

        // `audit.external_command` (technical/events/event-catalog.csv:38):
        // «append-only audit row with grant/session identity», actor kind
        // `external`, v0.1-M5. NO TOKEN, and no recipient address either — the
        // grant row carries the address and this row carries the event.
        await recordAudit(tx,
          { actorUserId: "", organizationId: row.workspace_id as string, requestId },
          {
            action: "external_grant.exchanged", object_type: "external_access_grant",
            object_id: row.grant_id as string,
            details: {
              externalSessionId: row.session_id,
              requirementOccurrenceId: row.occurrence_id,
              projectId: row.project_id,
              hmacKeyId: keyId,
              mayDecide: row.may_decide === true,
            },
          },
          { organizationId: row.workspace_id as string, actorType: "external" });

        return row;
      }
      return null;
    });

    if (result === null) throw invalid;

    // NO OUTBOX EVENT. `technical/events/event-catalog.csv` carries no
    // `external_grant.exchanged` topic, and a topic invented here would be an
    // event no catalog governs and no consumer expects. The exchange is in the
    // audit trail only — the same call M4 made for `statutory_acts.compose`
    // (progress §4.8 item 19).

    const body: ExternalExchangeResponse = {
      csrfToken: csrfValue,
      idleExpiresAt: new Date(result.idle_expires_at as string).toISOString(),
      absoluteExpiresAt: new Date(result.absolute_expires_at as string).toISOString(),
      mayDecide: result.may_decide === true,
    };
    return ok(200, body, requestId, {
      "set-cookie": externalSessionCookie(sessionValue),
      "cache-control": "no-store, no-cache, must-revalidate, private",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    });
  } catch (err) {
    return toProblemResponse(err, requestId);
  }
}

/**
 * There is no GET here on purpose, and the absence is load-bearing rather than
 * incidental: Next.js answers an unexported method with 405, so a prefetcher
 * that follows `/external/exchange` gets a refusal from the framework before any
 * code in this file runs. INV-010 does not depend on it — the token is in a
 * fragment and was never sent — but a route that consumed on GET would be the
 * defect this milestone is most likely to ship, and the way to not ship it is to
 * have nowhere for it to live.
 */
