import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { parseAllowedOrigins, v1CorsResponse, V1_PATH_RE } from "./cors";

const FIELD = "https://goproceed-field.vercel.app";
const req = (path: string, opts: { method?: string; origin?: string } = {}) =>
  new NextRequest(`https://app.example${path}`, {
    method: opts.method ?? "GET",
    headers: opts.origin ? { origin: opts.origin } : {},
  });

describe("parseAllowedOrigins", () => {
  it("splits on commas, trims, drops empties", () => {
    expect([...parseAllowedOrigins(` ${FIELD} , https://b.example ,, `)])
      .toEqual([FIELD, "https://b.example"]);
  });
  it("unset and empty mean an empty set", () => {
    expect(parseAllowedOrigins(undefined).size).toBe(0);
    expect(parseAllowedOrigins("").size).toBe(0);
  });
});

describe("V1_PATH_RE", () => {
  it("matches /v1 and /v1/… as a segment, not as a prefix", () => {
    expect(V1_PATH_RE.test("/v1")).toBe(true);
    expect(V1_PATH_RE.test("/v1/projects")).toBe(true);
    expect(V1_PATH_RE.test("/v1beta-pilot")).toBe(false);
    expect(V1_PATH_RE.test("/login")).toBe(false);
  });
});

describe("v1CorsResponse with the allowlist SET", () => {
  const env = { FIELD_CLIENT_ORIGINS: FIELD };
  it("answers preflight for an allowed origin with the full header set", () => {
    const res = v1CorsResponse(req("/v1/projects", { method: "OPTIONS", origin: FIELD }), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(FIELD);
    expect(res.headers.get("access-control-allow-methods")).toBe("GET, POST, PUT, PATCH, DELETE, OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe("authorization, content-type, idempotency-key, x-request-id");
    expect(res.headers.get("access-control-max-age")).toBe("86400");
    expect(res.headers.get("vary")).toContain("Origin");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });
  it("answers preflight for a DISALLOWED origin without allow-origin", () => {
    const res = v1CorsResponse(req("/v1/projects", { method: "OPTIONS", origin: "https://evil.example" }), env);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
  it("stamps pass-through responses for an allowed origin, incl. expose-headers", () => {
    const res = v1CorsResponse(req("/v1/projects", { origin: FIELD }), env);
    expect(res.headers.get("access-control-allow-origin")).toBe(FIELD);
    expect(res.headers.get("access-control-expose-headers")).toBe("x-request-id, idempotency-replay-until");
    expect(res.headers.get("vary")).toContain("Origin");
    expect(res.headers.get("location")).toBeNull(); // never a redirect
  });
  it("passes a disallowed origin through with NO cors headers", () => {
    const res = v1CorsResponse(req("/v1/projects", { origin: "https://evil.example" }), env);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("access-control-expose-headers")).toBeNull();
  });
});

describe("v1CorsResponse with the allowlist UNSET (today's behavior)", () => {
  it("adds nothing — pure pass-through, even on preflight", () => {
    for (const method of ["GET", "OPTIONS"]) {
      const res = v1CorsResponse(req("/v1/projects", { method, origin: FIELD }), {});
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("access-control-allow-methods")).toBeNull();
    }
  });
});
