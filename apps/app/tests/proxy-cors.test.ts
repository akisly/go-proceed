import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
// next@16.3.1 ships `unstable_doesMiddlewareMatch`; nextjs.org and even the
// package's own bundled proxy.md describe `unstable_doesProxyMatch`, which
// this patch does not export — the middleware→proxy rename reached the docs
// before the testing utils. Swap the name when Next ships the renamed export.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { proxy, config } from "../proxy";

const FIELD = "https://goproceed-field.vercel.app";
const nextConfig = {};

describe("matcher", () => {
  it("runs on /v1 ONLY when the request carries an Origin header", () => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig, url: "/v1/projects" })).toBe(false);
    expect(unstable_doesMiddlewareMatch({
      config, nextConfig, url: "/v1/projects", headers: { origin: FIELD },
    })).toBe(true);
  });
  it("still matches pages and still skips _next — the existing entry is intact", () => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig, url: "/login" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, nextConfig, url: "/_next/static/x.js" })).toBe(false);
  });
  it("leaves provider integrations outside the member-session proxy while retaining /dash", () => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig, url: "/integrations/telegram/webhook" })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, nextConfig, url: "/dash" })).toBe(true);
  });
});

describe("proxy on /v1 (the guard must answer BEFORE any Supabase code)", () => {
  // No Supabase env is stubbed here ON PURPOSE: if the /v1 branch ever falls
  // through into createServerClient, these tests crash on missing env —
  // a structural proof the guard runs first, not a mock's opinion.
  const v1 = (method: string, origin?: string) =>
    proxy(new NextRequest("https://app.example/v1/projects", {
      method, headers: origin ? { origin } : {},
    }));

  it("answers preflight for an allowlisted origin", async () => {
    process.env.FIELD_CLIENT_ORIGINS = FIELD;
    try {
      const res = await v1("OPTIONS", FIELD);
      expect(res.headers.get("access-control-allow-origin")).toBe(FIELD);
      expect(res.headers.get("location")).toBeNull();
    } finally {
      delete process.env.FIELD_CLIENT_ORIGINS;
    }
  });
  it("stamps pass-through GETs, never redirects, never sets cookies", async () => {
    process.env.FIELD_CLIENT_ORIGINS = FIELD;
    try {
      const res = await v1("GET", FIELD);
      expect(res.headers.get("access-control-allow-origin")).toBe(FIELD);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("set-cookie")).toBeNull();
    } finally {
      delete process.env.FIELD_CLIENT_ORIGINS;
    }
  });
  it("with the allowlist unset, /v1 passes through with no CORS headers at all", async () => {
    const res = await v1("GET", FIELD);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });
});
