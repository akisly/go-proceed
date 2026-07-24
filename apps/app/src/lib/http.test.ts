import { describe, it, expect } from "vitest";
import { HttpProblem, jsonProblem, ok, requestIdFrom } from "./http.js";
import { problem } from "@aktflow/contracts";

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
