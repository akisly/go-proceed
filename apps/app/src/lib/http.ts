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

// technical/openapi.yaml components.parameters.RequestId / docs/22-data-api-contract.md:170:
// X-Request-Id is optional, but when present must pass syntax/length
// validation; invalid values are REJECTED (never logged/echoed into the
// audit trail as-is).
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

export function requestIdFrom(req: Request): string {
  const raw = req.headers.get("x-request-id");
  if (raw === null) return crypto.randomUUID();
  if (!REQUEST_ID_PATTERN.test(raw)) {
    throw new HttpProblem(
      422,
      problem("VALIDATION_FAILED", "Заголовок X-Request-Id має неприпустимий формат або довжину.", {
        retryable: false,
        userAction: "correct_fields",
        fieldErrors: [{ path: "X-Request-Id", message: "invalid" }],
      }),
    );
  }
  return raw;
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

export function ok(
  status: number, body: unknown, requestId: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
      ...extraHeaders,
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
        userAction: "new_key_or_reuse_original",
      }),
    );
  }
  // CATALOG GAP: technical/error-catalog.csv has no generic/unclassified 5xx
  // row (every 500/503 row is domain-specific, e.g. PACKAGE_GENERATION_FAILED,
  // SCAN_FAILED, JOB_RETRY_EXHAUSTED). INTERNAL_ERROR is therefore a single,
  // clearly-commented fallback constant for truly-unmapped failures, not a
  // catalog code — do not invent additional off-catalog variants. userAction
  // uses the real catalog token "retry_later" (matches retryable: true) rather
  // than free-text prose.
  return jsonProblem(
    500,
    problem("INTERNAL_ERROR", "Внутрішня помилка.", { requestId, retryable: true, userAction: "retry_later" }),
  );
}

export { problem };
