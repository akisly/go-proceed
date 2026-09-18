import { describe, it, expect } from "vitest";
import { HttpProblem, jsonProblem, ok, requestIdFrom, toProblemResponse } from "./http";
import { problem } from "@goproceed/contracts";
import { IdempotencyConflictError } from "@goproceed/database";

describe("http helpers", () => {
  it("generates a request id when header is absent", () => {
    const id = requestIdFrom(new Request("http://x/"));
    expect(id).toMatch(/[0-9a-f-]{36}/);
  });

  it("echoes a valid provided X-Request-Id", () => {
    const id = requestIdFrom(new Request("http://x/", { headers: { "x-request-id": "req-0123456789ab" } }));
    expect(id).toBe("req-0123456789ab");
  });

  // technical/openapi.yaml components.parameters.RequestId: minLength 16,
  // maxLength 128, ^[A-Za-z0-9._:-]+$ — docs/22-data-api-contract.md:170
  // requires invalid values REJECTED (never echoed into audit_events).
  it("rejects an oversized X-Request-Id (>128 chars) with 422 VALIDATION_FAILED", () => {
    const oversized = "a".repeat(129);
    try {
      requestIdFrom(new Request("http://x/", { headers: { "x-request-id": oversized } }));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(HttpProblem);
      const err = e as HttpProblem;
      expect(err.status).toBe(422);
      expect(err.body.code).toBe("VALIDATION_FAILED");
      expect(err.body.userAction).toBe("correct_fields");
      expect(err.body.fieldErrors).toEqual([{ path: "X-Request-Id", message: "invalid" }]);
    }
  });

  it("rejects an undersized X-Request-Id (<16 chars) with 422 VALIDATION_FAILED", () => {
    expect(() => requestIdFrom(new Request("http://x/", { headers: { "x-request-id": "short" } })))
      .toThrow(HttpProblem);
  });

  it("rejects an illegal-charset X-Request-Id with 422 VALIDATION_FAILED", () => {
    const illegal = "valid-length-but-has spaces!!";
    try {
      requestIdFrom(new Request("http://x/", { headers: { "x-request-id": illegal } }));
      expect.unreachable();
    } catch (e) {
      const err = e as HttpProblem;
      expect(err.status).toBe(422);
      expect(err.body.code).toBe("VALIDATION_FAILED");
    }
  });

  it("jsonProblem sets status, content-type and X-Request-Id", async () => {
    const res = jsonProblem(409, problem("VERSION_CONFLICT", "d", { requestId: "req-9" }));
    expect(res.status).toBe(409);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(res.headers.get("x-request-id")).toBe("req-9");
  });

  it("HttpProblem carries status and body", () => {
    const e = new HttpProblem(401, problem("AUTH_REQUIRED", "d"));
    expect(e.status).toBe(401);
    expect(e.body.code).toBe("AUTH_REQUIRED");
  });

  it("ok sets status, content-type and X-Request-Id", async () => {
    const res = ok(200, { hello: "world" }, "req-1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("x-request-id")).toBe("req-1");
    expect(await res.json()).toEqual({ hello: "world" });
  });

  it("ok merges extraHeaders (e.g. Idempotency-Replay-Until) without dropping the defaults", async () => {
    const res = ok(201, { ok: true }, "req-2", { "Idempotency-Replay-Until": "2026-08-24T00:00:00.000Z" });
    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("x-request-id")).toBe("req-2");
    expect(res.headers.get("Idempotency-Replay-Until")).toBe("2026-08-24T00:00:00.000Z");
  });
});

describe("toProblemResponse", () => {
  it("maps HttpProblem to its own status and keeps its body code", async () => {
    const err = new HttpProblem(401, problem("AUTH_REQUIRED", "d"));
    const res = toProblemResponse(err, "req-1");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("AUTH_REQUIRED");
    expect(res.headers.get("x-request-id")).toBe("req-1");
  });

  it("maps IdempotencyConflictError to 409 IDEMPOTENCY_CONFLICT with the catalog userAction token", async () => {
    const res = toProblemResponse(new IdempotencyConflictError(), "req-2");
    expect(res.status).toBe(409);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    const body = await res.json();
    expect(body.code).toBe("IDEMPOTENCY_CONFLICT");
    // technical/error-catalog.csv: IDEMPOTENCY_CONFLICT's user_action is the
    // catalog token, not free-text Ukrainian prose (human text stays in detail).
    expect(body.userAction).toBe("new_key_or_reuse_original");
    // DEV-022: the key may have been reused for another target, not only another body.
    expect(body.detail).toContain("інший обʼєкт");
    expect(res.headers.get("x-request-id")).toBe("req-2");
  });

  it("maps an unknown Error to the documented 500 fallback (catalog has no generic 5xx row)", async () => {
    const res = toProblemResponse(new Error("boom"), "req-3");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.retryable).toBe(true);
    // "retry_later" is a real technical/error-catalog.csv token (used by
    // RATE_LIMITED, UPLOAD_UNAVAILABLE, ...), reused here for consistency
    // since INTERNAL_ERROR itself has no catalog row of its own.
    expect(body.userAction).toBe("retry_later");
    expect(res.headers.get("x-request-id")).toBe("req-3");
  });
});
