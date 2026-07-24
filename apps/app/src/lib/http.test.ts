import { describe, it, expect } from "vitest";
import { HttpProblem, jsonProblem, ok, requestIdFrom, toProblemResponse } from "./http";
import { problem } from "@aktflow/contracts";
import { IdempotencyConflictError } from "@aktflow/database";

describe("http helpers", () => {
  it("generates a request id when header is absent", () => {
    const id = requestIdFrom(new Request("http://x/"));
    expect(id).toMatch(/[0-9a-f-]{36}/);
  });

  it("echoes provided X-Request-Id", () => {
    const id = requestIdFrom(new Request("http://x/", { headers: { "x-request-id": "req-9" } }));
    expect(id).toBe("req-9");
  });

  it("jsonProblem sets status, content-type and X-Request-Id", async () => {
    const res = jsonProblem(409, problem("org.conflict", "d", { requestId: "req-9" }));
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

  it("maps IdempotencyConflictError to 409 IDEMPOTENCY_CONFLICT with problem+json content-type", async () => {
    const res = toProblemResponse(new IdempotencyConflictError(), "req-2");
    expect(res.status).toBe(409);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    const body = await res.json();
    expect(body.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(res.headers.get("x-request-id")).toBe("req-2");
  });

  it("maps an unknown Error to 500 with retryable true", async () => {
    const res = toProblemResponse(new Error("boom"), "req-3");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.retryable).toBe(true);
    expect(res.headers.get("x-request-id")).toBe("req-3");
  });
});
