import { createHash } from "node:crypto";
import type { z } from "zod";
import { requireUser } from "./auth";
import { idempotencyKeyFrom } from "./request-context";
import { HttpProblem, toProblemResponse, ok, requestIdFrom } from "./http";
import { problem } from "@aktflow/contracts";

export interface CommandArgs<T> {
  req: Request;
  requestId: string;
  userId: string;
  body: T;
  params: Record<string, string>;
  idempotencyKey: string;
  requestHash: string;
}
export interface HandlerResult { status: number; body: unknown; expiresAt?: Date }
type RouteCtx = { params: Promise<Record<string, string>> };

/**
 * Shared command-route wrapper: requestId validation, auth, Idempotency-Key
 * requirement, raw-body sha256 (the idempotency request hash), JSON + zod
 * parsing, and the single problem+json error mapping. The handler receives
 * the validated body and returns { status, body, expiresAt? }; expiresAt
 * becomes the Idempotency-Replay-Until header.
 */
export function commandRoute<T>(
  schema: z.ZodType<T>,
  run: (a: CommandArgs<T>) => Promise<HandlerResult>,
): (req: Request, ctx: RouteCtx) => Promise<Response> {
  return async (req, ctx) => {
    let requestId = crypto.randomUUID();
    try {
      requestId = requestIdFrom(req);
      const { userId } = await requireUser(requestId, req);
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
      const params = ctx?.params ? await ctx.params : {};
      const out = await run({ req, requestId, userId, body: parsed.data, params, idempotencyKey, requestHash });
      const headers: Record<string, string> = {};
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
): (req: Request, ctx: RouteCtx) => Promise<Response> {
  return async (req, ctx) => {
    let requestId = crypto.randomUUID();
    try {
      requestId = requestIdFrom(req);
      const { userId } = await requireUser(requestId, req);
      const params = ctx?.params ? await ctx.params : {};
      const out = await run({ req, requestId, userId, params });
      return ok(out.status, out.body, requestId, {});
    } catch (err) {
      return toProblemResponse(err, requestId);
    }
  };
}
