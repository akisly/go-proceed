# /v1 Cross-Origin Access (CORS + Bearer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a browser client on ANOTHER origin (the Expo-web field client of ADR-009 / Plan C) call `apps/app`'s `/v1` API with `Authorization: Bearer`, by adding an allowlist-gated CORS layer — with zero behavior change while the allowlist env is unset, and zero new round trips for the PWA's same-origin path.

**Architecture:** CORS lives in `apps/app/proxy.ts`, per the vendor's own Next 16.3 pattern (docs/app/api-reference/file-conventions/proxy#cors, read 2026-08-20, version 16.3.1): a second matcher entry `{ source: "/v1/:path*", has: [{ type: "header", key: "origin" }] }` runs the proxy on `/v1` ONLY when the request carries an `Origin` header — the server-side self-fetch in `api.ts` sends none, so the PWA's hot path never enters the proxy. Inside, a path-guarded branch answers preflight `OPTIONS` directly and stamps CORS headers on pass-through responses, returning BEFORE any Supabase code — the documented 401-problem+json contract and the no-getUser-per-API-call property survive untouched. All header logic is a pure module (`src/lib/cors.ts`) so the dangerous file gains ~6 lines. Bearer auth needs no change: `auth.ts` already gives `Authorization: Bearer` priority over cookies.

**Tech Stack:** Next 16.3.1 (proxy convention + `next/experimental/testing/server` for matcher/behavior unit tests), vitest, Turborepo strict env.

**Spec:** ADR-009 (`docs/decisions/ADR-009-three-pilot-surfaces.md`) — this is the named follow-up «Plan B»; its anchors were recorded in `docs/superpowers/plans/2026-08-20-three-pilot-surfaces.md` §«Follow-up plans».

## Global Constraints

- `pnpm validate:canonical-docs` must pass after every docs edit.
- GitHub Actions is billing-paused until 2026-09-01: every task verifies LOCALLY in CI's shape (`turbo run typecheck`, `turbo run test --concurrency=1` with local Supabase up, `turbo run build`).
- Third-party behaviour comes from CURRENT docs, never memory. Already read for this plan (2026-08-20, Next 16.3.1): proxy#cors pattern, matcher `has` conditions, auto-`OPTIONS` on route handlers, `next/experimental/testing/server`. Cite in commits.
- The PWA is the working pilot client: NOTHING here may change same-origin behavior. The invariant test for that is byte-level: with `FIELD_CLIENT_ORIGINS` unset, every response is identical to today's.
- `proxy.ts`'s existing matcher entry and its comment block are load-bearing records — never edited, only added to.
- No `Access-Control-Allow-Credentials`: the cross-origin client authenticates with Bearer only, never cookies. This is a security decision, not an omission.

## Design decisions (recorded)

1. **Proxy, not `next.config` headers:** the vendor names both; proxy is chosen because the allowlist must ECHO one origin of several (static headers cannot), preflight is answered at the edge without invoking the Node function, and one place covers success AND `problem+json` error responses uniformly — the 401 a token-expired Expo client receives MUST carry CORS headers or the browser hides the body and the client cannot read `userAction: "sign_in"`.
2. **`has: origin` matcher condition:** proxy cost lands only on requests that carry `Origin` (cross-origin, plus browsers' same-origin POSTs); the BFF self-fetch (no `Origin`) stays proxy-free. Same-origin requests that do enter find their origin absent from the allowlist and pass through headerless — correct, same-origin needs no CORS.
3. **`FIELD_CLIENT_ORIGINS` (comma-separated exact origins, e.g. `https://goproceed-field.vercel.app`):** unset or empty ⇒ the branch passes everything through untouched — deploying this code changes nothing until the owner sets the variable. Origins compare EXACTLY (scheme + host + optional port, no trailing slash, no wildcards).
4. **`Access-Control-Expose-Headers: x-request-id, idempotency-replay-until`** — without it the cross-origin client can never read the request id it must quote in bug reports, nor the idempotency replay window `commandRoute` returns.
5. **`/external` is NOT included** — the external review shell is a same-origin browser surface with its own session model; widening its exposure is not Plan C's need (YAGNI).

## File structure

- Create: `apps/app/src/lib/cors.ts` — pure origin-allowlist + header logic and the `/v1` response builder.
- Create: `apps/app/src/lib/cors.test.ts` — unit tests for the pure logic.
- Create: `apps/app/tests/proxy-cors.test.ts` — matcher + proxy-behavior tests via `next/experimental/testing/server`.
- Modify: `apps/app/proxy.ts` — top-of-function guard (~4 lines) + one matcher entry + dated comment.
- Modify: `turbo.json` — `build.env` gains `FIELD_CLIENT_ORIGINS`.
- Modify: `apps/app/.env.example`, `infra/README-staging.md` §4.3 (optional-var row), `TODOS.md` (Plan B section → done, filename resolved), `docs/decisions/ADR-009-three-pilot-surfaces.md` (resolve `2026-08-XX-v1-cors-bearer.md` → this file's name).

---

### Task 1: `cors.ts` + unit tests

**Files:**
- Create: `apps/app/src/lib/cors.ts`
- Test: `apps/app/src/lib/cors.test.ts`

**Interfaces:**
- Produces: `parseAllowedOrigins(raw: string | undefined): ReadonlySet<string>`; `V1_PATH_RE: RegExp`; `v1CorsResponse(request: NextRequest): NextResponse` (Task 2 consumes all three).

- [ ] **Step 1: Write the failing tests** — `apps/app/src/lib/cors.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter @goproceed/app exec vitest run src/lib/cors.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement `apps/app/src/lib/cors.ts`:**

```ts
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
export function v1CorsResponse(
  request: NextRequest,
  env: { FIELD_CLIENT_ORIGINS?: string } = process.env,
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
```

- [ ] **Step 4: Run to verify pass** — same command → all tests PASS. (Adjust nothing in the tests to make them pass; if reality disagrees with a test, the discrepancy goes in the report.)
- [ ] **Step 5: Commit** — `git add apps/app/src/lib/cors.ts apps/app/src/lib/cors.test.ts && git commit` message: `feat(cors): the /v1 allowlist layer as a pure module — headers, preflight, and the unset-means-unchanged guarantee (Next 16.3.1 proxy#cors pattern, read 2026-08-20)`.

### Task 2: the proxy guard + matcher entry + behavior tests

**Files:**
- Modify: `apps/app/proxy.ts`
- Test: `apps/app/tests/proxy-cors.test.ts`

**Interfaces:**
- Consumes: `V1_PATH_RE`, `v1CorsResponse` from `src/lib/cors` (Task 1).

- [ ] **Step 1: Write the failing tests** — `apps/app/tests/proxy-cors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesProxyMatch } from "next/experimental/testing/server";
import { proxy, config } from "../proxy";

const FIELD = "https://goproceed-field.vercel.app";
const nextConfig = {};

describe("matcher", () => {
  it("runs on /v1 ONLY when the request carries an Origin header", () => {
    expect(unstable_doesProxyMatch({ config, nextConfig, url: "/v1/projects" })).toBe(false);
    expect(unstable_doesProxyMatch({
      config, nextConfig, url: "/v1/projects", headers: { origin: FIELD },
    })).toBe(true);
  });
  it("still matches pages and still skips _next — the existing entry is intact", () => {
    expect(unstable_doesProxyMatch({ config, nextConfig, url: "/login" })).toBe(true);
    expect(unstable_doesProxyMatch({ config, nextConfig, url: "/_next/static/x.js" })).toBe(false);
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
    const res = await v1("OPTIONS", FIELD);
    expect(res.headers.get("access-control-allow-origin")).toBe(FIELD);
    expect(res.headers.get("location")).toBeNull();
    delete process.env.FIELD_CLIENT_ORIGINS;
  });
  it("stamps pass-through GETs, never redirects, never sets cookies", async () => {
    process.env.FIELD_CLIENT_ORIGINS = FIELD;
    const res = await v1("GET", FIELD);
    expect(res.headers.get("access-control-allow-origin")).toBe(FIELD);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
    delete process.env.FIELD_CLIENT_ORIGINS;
  });
  it("with the allowlist unset, /v1 passes through with no CORS headers at all", async () => {
    const res = await v1("GET", FIELD);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter @goproceed/app exec vitest run tests/proxy-cors.test.ts` → FAIL (`/v1` never matches; guard absent). If `next/experimental/testing/server` does not resolve in the installed Next 16.3.1, STOP and report NEEDS_CONTEXT with the actual error — do not improvise a different harness.
- [ ] **Step 3: Edit `proxy.ts` — two additions, nothing else:**

(a) Import + guard at the very top of the function body (before `let response`):

```ts
import { V1_PATH_RE, v1CorsResponse } from "./src/lib/cors";
```

```ts
  // /v1 CROSS-ORIGIN BRANCH, 2026-08-20 (ADR-009 Plan B). The second matcher
  // entry below routes /v1 requests here ONLY when they carry an Origin
  // header. This guard MUST stay first: /v1's contract is 401 problem+json
  // from requireUser downstream — never a redirect, never a getUser round
  // trip here. All logic lives in src/lib/cors.ts; with FIELD_CLIENT_ORIGINS
  // unset this is a pure pass-through.
  if (V1_PATH_RE.test(request.nextUrl.pathname)) {
    return v1CorsResponse(request);
  }
```

(b) In `config.matcher`, ABOVE the existing string entry (which is not touched), add the object entry with its own comment:

```ts
    /*
     * /v1 WITH an Origin header only, 2026-08-20 (ADR-009 Plan B): the
     * cross-origin field client needs CORS answers, and `has` keeps the
     * proxy OFF the BFF self-fetch path (api.ts sends no Origin). The
     * function-body guard above returns before any Supabase code, so the
     * exclusion rationale in the comment below still holds for everything
     * this entry lets in. Vendor pattern: Next 16.3.1 proxy#cors.
     */
    { source: "/v1/:path*", has: [{ type: "header", key: "origin" }] },
```

- [ ] **Step 4: Run to verify pass** — `pnpm --filter @goproceed/app exec vitest run tests/proxy-cors.test.ts src/lib/cors.test.ts` → PASS.
- [ ] **Step 5: The no-regression gates** — `pnpm --filter @goproceed/app typecheck` clean, then the full app suite `pnpm --filter @goproceed/app test` (local Supabase must be up) → 58+2 files pass.
- [ ] **Step 6: Commit** — message: `feat(cors): proxy answers /v1 cross-origin requests — has:origin matcher, guard before any Supabase code`.

### Task 3: env plumbing + docs

**Files:**
- Modify: `turbo.json` (`tasks.build.env` array: add `"FIELD_CLIENT_ORIGINS"`)
- Modify: `apps/app/.env.example` (new entry with a comment: optional; comma-separated exact origins; unset = CORS off)
- Modify: `infra/README-staging.md` §4.3 (one row: OPTIONAL variable, what it does, that the deploy preflight deliberately does NOT require it)
- Modify: `TODOS.md` (the three-pilot-surfaces P1's Plan B paragraph → done 2026-08-20 with one-line evidence; resolve the `2026-08-XX-v1-cors-bearer.md` filename)
- Modify: `docs/decisions/ADR-009-three-pilot-surfaces.md` (same filename resolution, dated)

**Interfaces:** consumes the env-var NAME `FIELD_CLIENT_ORIGINS` exactly as Task 1 defined it.

- [ ] **Step 1:** Apply the five edits. In §4.3 keep the table's existing column shape; state explicitly: «optional — unset means the CORS layer is off and `/v1` behaves exactly as before; set it only when Plan C's field origin exists». In TODOS, note bearer needed no work: `auth.ts` already prioritizes `Authorization: Bearer` (its comment names mobile), so this plan's API surface is CORS only.
- [ ] **Step 2:** `pnpm validate:canonical-docs` → OK.
- [ ] **Step 3:** Commit — `chore(cors): FIELD_CLIENT_ORIGINS declared in turbo env, documented optional in §4.3, Plan B recorded done`.

### Task 4: runtime wire proof + PR

- [ ] **Step 1: Build and start locally with the allowlist set** (local Supabase up; from `apps/app`): `FIELD_CLIENT_ORIGINS=https://field.example pnpm build && FIELD_CLIENT_ORIGINS=https://field.example pnpm exec next start -p 3100 &`.
- [ ] **Step 2: Measure the three wire facts** (paste actual output into the PR body):
  - Preflight: `curl -si -X OPTIONS http://localhost:3100/v1/projects -H "Origin: https://field.example" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization"` → `access-control-allow-origin: https://field.example`, methods/headers/max-age present.
  - **The layering fact this plan exists for:** `curl -si http://localhost:3100/v1/projects -H "Origin: https://field.example"` → **401** `application/problem+json` AND `access-control-allow-origin` on the SAME response — the cross-origin client can read the error body.
  - Disallowed origin: same GET with `Origin: https://evil.example` → 401 but NO `access-control-allow-origin`.
- [ ] **Step 3: PWA no-regression on the real engine path:** stop the server; run `pnpm --filter @goproceed/app build && pnpm --filter @goproceed/app qa` (qa/field.mjs full pass, local stack) → PASS.
- [ ] **Step 4:** `pnpm turbo run typecheck` and `pnpm turbo run build` all green; kill the test server; commit anything outstanding; push branch `claude/v1-cors`; open the PR (base: `claude/three-pilot-surfaces` — stacked; note in the body it auto-retargets to `main` when PR #34 merges) with the measured curls, the docs citation (Next 16.3.1 proxy#cors + route#cors, nextjs.org, read 2026-08-20), and what is deliberately absent (credentials header, /external).

---

## Self-review

- Spec coverage: ADR-009 Plan B anchors — bearer priority (recorded as already-done, cited), proxy matcher exclusion respected (guard + has-condition), `FIELD_CLIENT_ORIGINS` named exactly as the parent plan proposed. Covered by Tasks 1–3; wire proof Task 4.
- Placeholder scan: none — full code in Tasks 1–2, exact commands in Task 4; Task 3's prose edits carry their required content inline.
- Type consistency: `parseAllowedOrigins` / `V1_PATH_RE` / `v1CorsResponse` names and signatures match between Task 1 (produces) and Task 2 (consumes); env name consistent across Tasks 1/3/4.
