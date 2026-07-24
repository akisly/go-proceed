import { describe, it, expect } from "vitest";
import { HttpProblem, jsonProblem, ok, requestIdFrom, toProblemResponse } from "./http.js";
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
    const e = new HttpProblem(401, problem("auth.required", "d"));
    expect(e.status).toBe(401);
    expect(e.body.code).toBe("auth.required");
  });

  it("ok sets status, content-type and X-Request-Id", async () => {
    const res = ok(200, { hello: "world" }, "req-1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("x-request-id")).toBe("req-1");
    expect(await res.json()).toEqual({ hello: "world" });
  });
});

describe("toProblemResponse", () => {
  it("maps HttpProblem to its own status and keeps its body code", async () => {
    const err = new HttpProblem(401, problem("auth.required", "d"));
    const res = toProblemResponse(err, "req-1");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("auth.required");
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
    expect(body.code).toBe("internal.error");
    expect(body.retryable).toBe(true);
    expect(res.headers.get("x-request-id")).toBe("req-3");
  });
});
