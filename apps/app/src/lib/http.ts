import { problem, type ProblemJson } from "@aktflow/contracts";
import { IdempotencyConflictError } from "@aktflow/database";

export class HttpProblem extends Error {
  status: number;
  body: ProblemJson;

  constructor(status: number, body: ProblemJson) {
    super(body.detail);
    this.status = status;
    this.body = body;
  }
}

export function requestIdFrom(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function jsonProblem(status: number, body: ProblemJson): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/problem+json",
      "x-request-id": body.requestId,
    },
  });
}

export function ok(status: number, body: unknown, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
  });
}

/**
 * Single error→Response mapping every route handler must use.
 */
export function toProblemResponse(err: unknown, requestId: string): Response {
  if (err instanceof HttpProblem) {
    return jsonProblem(err.status, { ...err.body, requestId: err.body.requestId || requestId });
  }
  if (err instanceof IdempotencyConflictError) {
    return jsonProblem(
      409,
      problem("IDEMPOTENCY_CONFLICT", "Той самий Idempotency-Key використано з іншим тілом запиту.", {
        requestId,
        retryable: false,
        userAction: "Використайте новий ключ або повторіть початковий запит без змін.",
      }),
    );
  }
  return jsonProblem(500, problem("internal.error", "Внутрішня помилка.", { requestId, retryable: true }));
}

export { problem };
