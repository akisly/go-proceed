import { createHash } from "node:crypto";
import type { z } from "zod";
import { problem } from "@goproceed/contracts";
import { withAnonymousTx, type Tx } from "@goproceed/database";
import { HttpProblem, toProblemResponse, ok, requestIdFrom } from "./http";
import { idempotencyKeyFrom } from "./request-context";
import {
  EXTERNAL_CSRF_HEADER, EXTERNAL_SESSION_IDLE_SECONDS,
  allowedExternalOrigin, readExternalSessionCookie, sessionKeys, verifiersEqual, hmacOf,
} from "./external-link";

/**
 * The external plane's request wrappers (v0.1-M5).
 *
 * `commandRoute`/`queryRoute` in `command.ts` both begin with `requireUser`, and
 * the whole point of this milestone is a person with no user. These two are the
 * same discipline for the other subject: resolve the session from the cookie,
 * revalidate the grant behind it on EVERY request, check CSRF and origin on
 * every state-changing one, and hand the handler a transaction whose GUC is the
 * session rather than an actor.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVERY FAILURE IS THE SAME FAILURE.
 *
 * `EXTERNAL_SHARE_INVALID` (technical/error-catalog.csv:28) — 404,
 * `request_new_link`, log policy `no_existence_detail`, ui surface
 * `page_empty_state`. It is returned for: no cookie, a malformed cookie, a
 * cookie naming a session that never existed, an expired session, a revoked
 * session, a session whose grant was revoked, expired or replaced, and a session
 * for a workspace the caller invented. tenancy-and-security.md §"Fragment shell
 * and exchange": «never reveals whether a recipient, package, occurrence,
 * workspace, or grant exists».
 *
 * The ONE exception is CSRF/origin, which is a 422 `VALIDATION_FAILED` — because
 * it is a bug in the caller rather than a statement about a grant, and telling a
 * legitimate page that its synchronizer token is missing reveals nothing about
 * anything. `technical/error-catalog.csv` HAS NO CSRF ROW and one is not
 * invented; that is recorded in migration 0049 §11 item 5.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVERY EXTERNAL REQUEST OPENS TWO TRANSACTIONS, AND THE SECOND ONE IS WHAT
 * DECIDES.
 *
 * The first is `withAnonymousTx`, which resolves the cookie — it has to be its
 * own transaction because the row it is looking for is the row that would
 * authorize looking. The second is the handler's `withExternalTx`, which carries
 * the session GUC.
 *
 * A revoke that commits BETWEEN them is not a hole. Every external policy
 * resolves through `app.external_session_scope()`, which re-checks the grant's
 * status, both expiries and the revocation version at STATEMENT time inside the
 * second transaction — so a session that was live during resolution and dead by
 * the time the write ran reads and writes nothing. The resolution result is a
 * routing decision, never an authorization one.
 *
 * «NOTHING HERE WAS EXECUTED.» — RETRACTED 2026-08-22 (Plan D slice D1 final
 * fix wave). `resolveExternalSession`, `requireCsrfAndOrigin`,
 * `externalQueryRoute`, `externalCommandRoute`, `EXTERNAL_RESPONSE_HEADERS` and
 * `rotateExternalSession` are all executed by the suite:
 * `tests/m5-external.int.test.ts` drives `POST /external/exchange`,
 * `GET /external/occurrence` and `POST /external/occurrence-decisions` (the
 * CSRF-and-origin path) against a live database, and
 * `tests/external-evidence.int.test.ts` drives `GET /external/evidence` through
 * the same wrapper. `qa/field.mjs`'s seventh audit runs the cookie and the
 * two-transaction resolution above in a real browser holding no account.
 *
 * Retracted rather than deleted, and rather than quietly edited, because the
 * sentence was load-bearing: this file decides every external request, and a
 * reader told its logic had never run would reasonably treat the paragraphs
 * above as design intent instead of as described behaviour.
 */

export interface ExternalSessionScope {
  sessionId: string;
  workspaceId: string;
  projectId: string;
  grantId: string;
  occurrenceId: string;
  mayDecide: boolean;
  csrfVerifier: Buffer;
  sessionVerifier: Buffer;
  verifierKeyId: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export function invalidLink(requestId: string): HttpProblem {
  return new HttpProblem(404, problem("EXTERNAL_SHARE_INVALID",
    "Це посилання більше не дійсне. Попросіть надіслати нове.",
    { requestId, retryable: false, userAction: "request_new_link" }));
}

/**
 * Resolve the cookie into a live session, sliding the idle window.
 *
 * IT RUNS ON A TRANSACTION WITH NEITHER SUBJECT, and it can reach exactly one
 * thing: `app.resolve_external_session`, a `SECURITY DEFINER` function bounded
 * to a single lookup by a 256-bit keyed verifier (migration 0049 §7). Every
 * table policy denies this transaction, which is why the lookup has to be a
 * function at all — the row we are looking for is the row that would authorize
 * looking.
 *
 * THE VERIFIER IS COMPARED TWICE. The index probe inside the function finds a
 * candidate; `verifiersEqual` below confirms it in constant time. The stored key
 * id is used for the recomputation, not the active one, so a session written
 * before a key rotation keeps working.
 */
export async function resolveExternalSession(
  req: Request, requestId: string,
): Promise<ExternalSessionScope> {
  const cookie = readExternalSessionCookie(req);
  if (cookie === null) throw invalidLink(requestId);

  const registry = sessionKeys();
  // Every key in the registry, because the row names the key it was written
  // with and we do not know it yet. One HMAC per key; the registry holds the
  // active key plus whatever is being rotated out.
  const candidates = [...registry.keys.keys()].map((keyId) => ({
    keyId, verifier: hmacOf(registry, keyId, cookie),
  }));

  const found = await withAnonymousTx({ requestId }, async (tx) => {
    for (const c of candidates) {
      const r = await tx.query(
        `select session_id, workspace_id, project_id, grant_id, occurrence_id,
                may_decide, csrf_verifier, session_verifier,
                absolute_expires_at, idle_expires_at
           from app.resolve_external_session($1, $2, $3)`,
        [c.keyId, c.verifier, EXTERNAL_SESSION_IDLE_SECONDS]);
      if (r.rows.length > 0) return { row: r.rows[0], keyId: c.keyId, verifier: c.verifier };
    }
    return null;
  });
  if (found === null) throw invalidLink(requestId);

  const stored = found.row.session_verifier as Buffer;
  if (!verifiersEqual(found.verifier, stored)) throw invalidLink(requestId);

  return {
    sessionId: found.row.session_id as string,
    workspaceId: found.row.workspace_id as string,
    projectId: found.row.project_id as string,
    grantId: found.row.grant_id as string,
    occurrenceId: found.row.occurrence_id as string,
    mayDecide: found.row.may_decide === true,
    csrfVerifier: found.row.csrf_verifier as Buffer,
    sessionVerifier: stored,
    verifierKeyId: found.keyId,
    idleExpiresAt: new Date(found.row.idle_expires_at as string),
    absoluteExpiresAt: new Date(found.row.absolute_expires_at as string),
  };
}

/**
 * INV-058, in the order the document gives it: «Cookie `SameSite` is not the
 * CSRF defense. Every state-changing endpoint ALSO requires a session-bound
 * synchronizer CSRF token, validates Origin/same-origin request context, and
 * rejects unsafe content types and missing CSRF state.»
 *
 * THE ORIGIN IS COMPARED AGAINST A CONFIGURED VALUE AND NEVER AGAINST THE `Host`
 * HEADER. A same-origin check that trusts `Host` is a check an attacker passes
 * by setting `Host`.
 *
 * A MISSING `Origin` IS A REFUSAL, not a pass. Browsers send it on every
 * cross-origin request and on every same-origin POST with a non-simple content
 * type; a request that omits it is either not a browser or is a browser being
 * driven by something that wants it omitted. `Referer` is deliberately not
 * consulted as a fallback: `Referrer-Policy: no-referrer` on this surface means
 * the product's own page does not send one, so a fallback would only ever be
 * satisfied by requests the product did not originate.
 */
export function requireCsrfAndOrigin(
  req: Request, requestId: string, scope: ExternalSessionScope,
): void {
  const fail = (message: string) => new HttpProblem(422, problem("VALIDATION_FAILED",
    "Запит відхилено з міркувань безпеки. Перезавантажте сторінку та спробуйте ще раз.",
    { requestId, retryable: false, userAction: "correct_fields",
      fieldErrors: [{ path: message, message: "required" }] }));

  const contentType = (req.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw fail("Content-Type");

  const origin = req.headers.get("origin");
  if (origin === null || origin !== allowedExternalOrigin()) throw fail("Origin");

  const presented = req.headers.get(EXTERNAL_CSRF_HEADER);
  if (presented === null || !/^[A-Za-z0-9_-]{43}$/.test(presented)) throw fail(EXTERNAL_CSRF_HEADER);

  // Recomputed under the session's OWN key id, and compared in constant time.
  if (!verifiersEqual(hmacOf(sessionKeys(), scope.verifierKeyId, presented), scope.csrfVerifier)) {
    throw fail(EXTERNAL_CSRF_HEADER);
  }
}

export interface ExternalQueryArgs {
  req: Request;
  requestId: string;
  scope: ExternalSessionScope;
}
export interface ExternalCommandArgs<T> extends ExternalQueryArgs {
  body: T;
  idempotencyKey: string;
  requestHash: string;
}
export interface ExternalResult {
  status: number;
  body: unknown;
  /** Set when the handler rotated the session (see the submit route). */
  setCookie?: string;
}

type RouteCtx = { params: Promise<Record<string, string>> };

/**
 * A GET on the external plane. It resolves and revalidates the session — which
 * slides the idle window and touches nothing else — and RUNS NO GRANT
 * MUTATION OF ANY KIND. INV-010 is about the grant, and no GET handler in this
 * product reaches `public.external_access_grants` for anything but a read
 * through `app.external_session_scope()`.
 */
export function externalQueryRoute(
  run: (a: ExternalQueryArgs) => Promise<ExternalResult>,
): (req: Request, ctx: RouteCtx) => Promise<Response> {
  return async (req) => {
    let requestId = crypto.randomUUID();
    try {
      requestId = requestIdFrom(req);
      const scope = await resolveExternalSession(req, requestId);
      const out = await run({ req, requestId, scope });
      return ok(out.status, out.body, requestId, externalNoStore(out));
    } catch (err) {
      return toProblemResponse(err, requestId);
    }
  };
}

/**
 * A state-changing POST on the external plane.
 *
 * ORDER MATTERS AND IS THE DOCUMENT'S: session first (so CSRF has something to
 * be bound TO), then content type, origin and synchronizer token, then the
 * Idempotency-Key, then the body. Checking CSRF before the session would compare
 * a presented token against nothing and would have to decide what «nothing»
 * means.
 */
export function externalCommandRoute<T>(
  // ZOD 4 REORDERED `ZodType`'S TYPE PARAMETERS AND DROPPED `ZodTypeDef`, and
  // tsc said so at the top of its voice. Verified at the declaration site and
  // by re-running the compiler against the old spelling, not recalled:
  //
  //   zod 3: `ZodType<Output = any, Def extends ZodTypeDef = ZodTypeDef, Input = Output>`
  //          (`zod/v3/types.d.ts:48`, still shipped under the v3 compat subpath)
  //   zod 4: `ZodType<out Output = unknown, out Input = unknown,
  //                   out Internals extends $ZodTypeInternals<Output, Input> = …>`
  //          (`zod/v4/classic/schemas.d.ts:6`)
  //
  // So `z.ZodType<T, z.ZodTypeDef, unknown>` fails twice over. `ZodTypeDef` is
  // not exported by zod 4 at all — only `$ZodTypeDef` exists, in `v4/core`, and
  // `v4/classic/compat.d.ts` re-exports `ZodTypeAny`/`ZodSchema`/`Schema`/
  // `ZodRawShape` for zod-3 compatibility but deliberately not this one. And
  // the THIRD slot is now `Internals`, which `unknown` does not satisfy.
  //
  // MEASURED, so the next migration does not inherit a false lesson: restoring
  // the old spelling and running `tsc --noEmit` in `apps/app` produces **336
  // errors** — 2 × TS2724 («has no exported member named 'ZodTypeDef'. Did you
  // mean 'ZodType'?», at the `z.ZodTypeDef` token itself), 2 × TS2344 («Type
  // 'unknown' does not satisfy the constraint '$ZodTypeInternals<T,
  // z.ZodTypeDef>'», at the third argument), and 307 × TS18046 downstream where
  // `a.body` had degraded to `unknown`. There was nothing silent about it; the
  // first error names the fix.
  //
  // The intent is unchanged and still worth stating: the INPUT is `unknown` so
  // `T` binds to the schema's OUTPUT — defaults applied — not to the pre-parse
  // input where a defaulted field is still optional. `out Input` is covariant
  // in zod 4, so any schema's own input type is assignable to `unknown` and
  // every existing call site keeps inferring exactly what it did before.
  schema: z.ZodType<T, unknown>,
  run: (a: ExternalCommandArgs<T>) => Promise<ExternalResult>,
): (req: Request, ctx: RouteCtx) => Promise<Response> {
  return async (req) => {
    let requestId = crypto.randomUUID();
    try {
      requestId = requestIdFrom(req);
      const scope = await resolveExternalSession(req, requestId);
      requireCsrfAndOrigin(req, requestId, scope);

      const idempotencyKey = idempotencyKeyFrom(req);
      if (!idempotencyKey) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Заголовок Idempotency-Key обовʼязковий.", {
            requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "Idempotency-Key", message: "required" }],
          }));
      }
      const raw = await req.text();
      const requestHash = createHash("sha256").update(raw).digest("hex");
      let json: unknown;
      try { json = raw === "" ? {} : JSON.parse(raw); }
      catch {
        throw new HttpProblem(422, problem("VALIDATION_FAILED", "Тіло запиту не є валідним JSON.",
          { requestId, retryable: false, userAction: "correct_fields" }));
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED", "Некоректні дані запиту.", {
          requestId, retryable: false, userAction: "correct_fields",
          fieldErrors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        }));
      }
      const out = await run({
        req, requestId, scope, body: parsed.data, idempotencyKey, requestHash,
      });
      return ok(out.status, out.body, requestId, externalNoStore(out));
    } catch (err) {
      return toProblemResponse(err, requestId);
    }
  };
}

/**
 * `Cache-Control: no-store` on every external response, and `no-referrer` with
 * it. A review page cached by an intermediary is a review page somebody else can
 * read; `Vary: Cookie` is not enough, because the thing that must not be stored
 * is the content and not the negotiation.
 *
 * EXPORTED SINCE 2026-08-22, AND THE REASON IS A DUPLICATE THAT ALREADY
 * EXISTED. `apps/app/app/external/evidence/route.ts` cannot go through either
 * wrapper — a `ReadableStream` through `externalQueryRoute` becomes the string
 * `{}` — so it built its own `Response` and re-typed these four literals. Two
 * copies with nothing tying them together is a silent divergence waiting for
 * its first edit: adding `pragma: no-cache` here (which
 * `externalSecurityHeaders` in `external-link.ts` already sends, so the two
 * external surfaces are not even consistent today) would extend every
 * wrapper-served response and quietly leave the byte route behind, with that
 * route's own test still green because it pinned the four literals it knew
 * about.
 *
 * So the record is the single source and BOTH consumers spread it: this
 * function, and that route. A header added here reaches the byte response
 * without anyone remembering to, and that route's test iterates this object
 * rather than a hard-coded list, so the assertion grows with it.
 *
 * `set-cookie` is deliberately NOT in here: it is per-response, not a policy.
 */
export const EXTERNAL_RESPONSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "cache-control": "no-store, no-cache, must-revalidate, private",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
});

function externalNoStore(out: ExternalResult): Record<string, string> {
  const headers: Record<string, string> = { ...EXTERNAL_RESPONSE_HEADERS };
  if (out.setCookie) headers["set-cookie"] = out.setCookie;
  return headers;
}

/**
 * Rotate the session — new cookie value, new CSRF token, the old row revoked and
 * the new one naming it as its predecessor.
 *
 * tenancy-and-security.md §"External session cookie": «Rotate its identifier
 * after privilege/scope revalidation.» The submit is the one place in this
 * milestone where a privilege is revalidated and then USED, so it is the place
 * that rotates. `external_sessions_rotation_key` makes a second successor of the
 * same predecessor unstorable, so two concurrent submits cannot both rotate.
 *
 * The new row inherits the absolute ceiling rather than restarting it: a
 * rotation that reset the twelve hours would make a reviewer who submits every
 * eleven hours immortal, which is not a ceiling.
 */
export async function rotateExternalSession(
  tx: Tx, scope: ExternalSessionScope,
  newSessionValue: string, newCsrfValue: string,
): Promise<string> {
  const registry = sessionKeys();
  const keyId = registry.activeKeyId;
  const inserted = await tx.query(
    `insert into public.external_sessions
       (workspace_id, external_access_grant_id, requirement_occurrence_id,
        session_verifier, csrf_verifier, verifier_key_id,
        idle_expires_at, absolute_expires_at, rotated_from_session_id,
        grant_revocation_version)
     select s.workspace_id, s.external_access_grant_id, s.requirement_occurrence_id,
            $2, $3, $4,
            least(now() + make_interval(secs => $5::int), s.absolute_expires_at),
            s.absolute_expires_at, s.id, s.grant_revocation_version
       from public.external_sessions s
      where s.id = $1
     returning id`,
    [scope.sessionId, hmacOf(registry, keyId, newSessionValue),
     hmacOf(registry, keyId, newCsrfValue), keyId, EXTERNAL_SESSION_IDLE_SECONDS]);
  if (inserted.rows.length === 0) {
    throw new Error("session rotation produced no successor");
  }
  await tx.query(
    `update public.external_sessions set status = 'revoked' where id = $1 and status = 'active'`,
    [scope.sessionId]);
  return inserted.rows[0].id as string;
}
