import { NextResponse, type NextRequest } from "next/server";

/**
 * CORS for /v1, and ONLY /v1 — the layer that lets the Expo-web field client
 * (ADR-009, Plan C) call this BFF from another origin with a Bearer token.
 *
 * Everything here is deliberately pure and proxy-agnostic so proxy.ts — the
 * auth gate, the most invariant-laden file in the app — gains only a guard
 * that delegates. Vendor pattern: Next 16.3.1 proxy#cors (read 2026-08-20).
 *
 * NO Access-Control-Allow-Credentials, ever: the cross-origin client
 * authenticates with `Authorization: Bearer` (auth.ts gives it priority over
 * the cookie session); cookies never cross origins here, so the header would
 * only widen CSRF surface for nothing.
 */

/** Segment-anchored, same rigor as proxy.ts's matcher: /v1 or /v1/…, never /v1beta. */
export const V1_PATH_RE = /^\/v1(?:\/|$)/;

export function parseAllowedOrigins(raw: string | undefined): ReadonlySet<string> {
  return new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
// Every header a /v1 caller legitimately sends: commandRoute demands
// Idempotency-Key, both wrappers accept X-Request-Id, auth is Bearer.
const ALLOW_HEADERS = "authorization, content-type, idempotency-key, x-request-id";
// Without expose-headers the cross-origin client can read NEITHER the request
// id it must quote in a bug report NOR commandRoute's replay window.
const EXPOSE_HEADERS = "x-request-id, idempotency-replay-until";

/**
 * The whole /v1 story in one place. Returns a response for EVERY /v1 request
 * the proxy sees: preflight answered directly, everything else passed through
 * (stamped only when the Origin is allowlisted). Never a redirect, never a
 * cookie, never an auth check — /v1's contract (401 problem+json from
 * requireUser) is produced downstream and merely gains headers here.
 *
 * `env` is injectable for tests; production passes nothing and reads
 * process.env at request time.
 */
// Narrow type so a mistyped property name fails tsc; the cast is safe — reads only.
export function v1CorsResponse(
  request: NextRequest,
  env: { FIELD_CLIENT_ORIGINS?: string } = process.env as { FIELD_CLIENT_ORIGINS?: string },
): NextResponse {
  const allowed = parseAllowedOrigins(env.FIELD_CLIENT_ORIGINS);
  if (allowed.size === 0) return NextResponse.next({ request });

  const origin = request.headers.get("origin") ?? "";
  const isAllowed = allowed.has(origin);

  if (request.method === "OPTIONS") {
    // Vendor-pattern preflight: answered at the boundary, 200 with no body.
    // allow-origin is echoed (never "*") and only for allowlisted origins.
    const headers = new Headers({ Vary: "Origin" });
    if (isAllowed) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", ALLOW_METHODS);
      headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
      headers.set("Access-Control-Max-Age", "86400");
    }
    return NextResponse.json({}, { headers });
  }

  const response = NextResponse.next({ request });
  response.headers.set("Vary", "Origin");
  if (isAllowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Expose-Headers", EXPOSE_HEADERS);
  }
  return response;
}
