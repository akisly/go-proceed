import type { z } from "zod";
import { requireUser } from "./auth";
import { idempotencyKeyFrom } from "./request-context";
import { HttpProblem, toProblemResponse, ok, requestIdFrom } from "./http";
import { commandRequestHash, UUID } from "./request-hash";
import { problem } from "@goproceed/contracts";

export interface CommandArgs<T> {
  req: Request;
  requestId: string;
  userId: string;
  body: T;
  params: Record<string, string>;
  idempotencyKey: string;
  requestHash: string;
}
export interface HandlerResult {
  status: number;
  body: unknown;
  expiresAt?: Date;
  /**
   * Response headers the handler needs and the wrapper cannot know about.
   * Added 2026-08-22 for `GET /v1/assignments/{id}/evidence`, which returns
   * short-lived signed storage URLs: a bearer capability in a shared cache is
   * a capability handed to whoever asks next, and until this existed NO
   * member-plane GET in this app sent any cache directive at all.
   * `ok()` spreads these last, so a handler may also override `content-type`.
   *
   * BOUND BY BOTH WRAPPERS, WHICH IT WAS NOT WHEN IT WAS ADDED. `commandRoute`
   * built its own header record for `Idempotency-Replay-Until` and never
   * spread `out.headers`, so a command route that set this field served
   * nothing — no error, no warning, a response that simply looks fine, which
   * is the failure shape this slice's own design names. This doc comment sat
   * on the shared interface and read as though it governed both, so the type
   * promised a channel one wrapper did not carry.
   *
   * `Idempotency-Replay-Until` IS APPLIED AFTER THE SPREAD, ON PURPOSE: it is
   * the wrapper's own statement about the wrapper's own idempotency contract,
   * and a handler must not be able to overwrite it by name.
   */
  headers?: Record<string, string>;
}
type RouteCtx = { params: Promise<Record<string, string>> };

/**
 * Path parameters that must be UUIDs, each with the 404 detail it answers when
 * it is not one. `projectId` is always among them; a route adds its own nested
 * ids (`{ versionId: "Версію договору не знайдено." }`).
 */
export interface RouteOptions { pathIds?: Readonly<Record<string, string>> }
const PROJECT_PATH_ID = { projectId: "Проєкт не знайдено." } as const;

/**
 * DEV-048 / BL-141: a malformed path id is 404 RESOURCE_NOT_FOUND, answered
 * before the Idempotency-Key, the body and any database call. Unchecked, the id
 * reached a `uuid` comparison and PostgreSQL's cast error (22P02) became 500
 * INTERNAL_ERROR; checked after the body, a malformed id with a bad body was 422.
 * A malformed id names no resource the caller could see, so it answers exactly as
 * an unknown one does.
 */
function refuseMalformedPathIds(params: Record<string, string>, opts: RouteOptions | undefined, requestId: string): void {
  for (const [name, detail] of Object.entries({ ...PROJECT_PATH_ID, ...opts?.pathIds })) {
    const value = params[name];
    if (value !== undefined && !UUID.test(value)) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", detail,
        { requestId, retryable: false, userAction: "return_to_list" }));
    }
  }
}

/**
 * Shared command-route wrapper: requestId validation, auth, Idempotency-Key
 * requirement, the idempotency request hash — the path parameters and the raw
 * body together (./request-hash.ts, DEV-022) — JSON + zod
 * parsing, and the single problem+json error mapping. The handler receives
 * the validated body and returns { status, body, expiresAt?, headers? };
 * expiresAt becomes the Idempotency-Replay-Until header, and `headers` is
 * spread onto the response the same way `queryRoute` spreads it.
 */
export function commandRoute<T>(
  // Zod 4 reordered `ZodType`'s parameters and does not export `ZodTypeDef`;
  // the zod-3 spelling `<T, z.ZodTypeDef, unknown>` is a compile error here,
  // not a silent degradation. `TODOS.md`'s migration entry records what tsc
  // reported. The INPUT is `unknown` so `T` binds to the schema's OUTPUT —
  // defaults applied — not to the pre-parse input where a defaulted field is
  // still optional.
  schema: z.ZodType<T, unknown>,
  run: (a: CommandArgs<T>) => Promise<HandlerResult>,
  opts?: RouteOptions,
): (req: Request, ctx: RouteCtx) => Promise<Response> {
  return async (req, ctx) => {
    let requestId = crypto.randomUUID();
    try {
      requestId = requestIdFrom(req);
      const { userId } = await requireUser(requestId, req);
      const params = ctx?.params ? await ctx.params : {};
      refuseMalformedPathIds(params, opts, requestId);
      const idempotencyKey = idempotencyKeyFrom(req);
      if (!idempotencyKey) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Заголовок Idempotency-Key обовʼязковий.", {
            requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "Idempotency-Key", message: "required" }],
          }));
      }
      const raw = await req.text();
      const requestHash = commandRequestHash(params, raw);
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
      const out = await run({ req, requestId, userId, body: parsed.data, params, idempotencyKey, requestHash });
      const headers: Record<string, string> = { ...out.headers };
      if (out.expiresAt) headers["Idempotency-Replay-Until"] = out.expiresAt.toISOString();
      return ok(out.status, out.body, requestId, headers);
    } catch (err) {
      return toProblemResponse(err, requestId);
    }
  };
}

export interface QueryArgs {
  req: Request; requestId: string; userId: string; params: Record<string, string>;
}
export function queryRoute(
  run: (a: QueryArgs) => Promise<HandlerResult>,
  opts?: RouteOptions,
): (req: Request, ctx: RouteCtx) => Promise<Response> {
  return async (req, ctx) => {
    let requestId = crypto.randomUUID();
    try {
      requestId = requestIdFrom(req);
      const { userId } = await requireUser(requestId, req);
      const params = ctx?.params ? await ctx.params : {};
      refuseMalformedPathIds(params, opts, requestId);
      const out = await run({ req, requestId, userId, params });
      return ok(out.status, out.body, requestId, out.headers ?? {});
    } catch (err) {
      return toProblemResponse(err, requestId);
    }
  };
}
