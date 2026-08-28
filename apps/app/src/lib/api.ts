import { cookies, headers } from "next/headers";

/**
 * A SERVER COMPONENT'S READ GOES THROUGH THE ROUTE, NOT AROUND IT.
 *
 * Calling `src/lib` directly would be one fewer hop and is the obvious
 * optimisation. It is refused because it would create a second authorization
 * path that has to be kept in step with the first by discipline: the route
 * checks membership, then project capability, then reads under RLS, and a page
 * that assembled its own query would be one edit away from checking less. Going
 * through `/v1` means this page and a future native client are authorised by the
 * same code, which is what ADR-007 decision 3's replaceability rests on.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const h = await headers();
  const c = await cookies();
  const base = resolveBaseOrigin(h);
  const res = await fetch(new URL(path, base), {
    headers: { cookie: c.toString() },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return await res.json() as T;
}

/**
 * Thrown when the inbound `Host` header names a host this process is not
 * willing to send a session cookie to. Deliberately NOT an `ApiError`: no
 * status came back from anywhere, because no request was made. Callers that
 * special-case 401 (see `app/(app)/page.tsx`) therefore fall through to their
 * generic error screen, which is right — this is a deployment fault, not
 * something the foreman can fix by signing in again.
 */
export class UntrustedHostError extends Error {
  constructor(readonly host: string) {
    super(
      `Refusing to self-fetch against untrusted Host "${host}". `
      + "Set NEXT_PUBLIC_APP_ORIGIN to this deployment's own origin.",
    );
  }
}

/**
 * THE ORIGIN THIS PROCESS WILL ATTACH THE SESSION COOKIE TO — and the reason
 * it is validated rather than merely assembled.
 *
 * `apiGet` sends the ENTIRE Supabase auth cookie jar (`cookie: c.toString()`)
 * to whatever this returns. Until the final whole-branch review, this function
 * built its target out of the inbound `Host` header, which is attacker-
 * supplied on every request that reaches an origin server directly:
 * `Host: attacker.example` made a server component fetch
 * `https://attacker.example/v1/projects` with a real foreman's session
 * attached. Nothing in this repository guaranteed a proxy that normalises
 * `Host` — there is no `vercel.json` for `apps/app`, no deploy step in
 * `ci.yml`, and staging has never been provisioned — and `.env.example`
 * documented `NEXT_PUBLIC_APP_ORIGIN` as "Leave unset in every ordinary case",
 * so the header-derived path WAS the ordinary path. This branch already
 * treated a lesser open redirect (task 5) as Critical; a credential handed to
 * a host named by the request is strictly worse.
 *
 * TWO WAYS TO BE TRUSTED, BOTH EXPLICIT, NOTHING ELSE:
 *
 *   1. `NEXT_PUBLIC_APP_ORIGIN` is set. It is returned as-is and the `Host`
 *      header is not consulted at all — not compared against, not appended
 *      to. Setting it is a deliberate operator act, and every deployment that
 *      is not a developer's own machine must set it. This is the mechanism
 *      that makes a real origin safe.
 *
 *   2. `Host` names loopback: `localhost`, `127.0.0.1`, `[::1]`, or anything
 *      under `*.localhost` — with or without a port — AND this is not a
 *      production build. This is the explicit allowlist for the unset case,
 *      and it is exactly the set of hostnames a developer's own machine
 *      answers to. `next dev` (port 3000) lands here. Matched
 *      case-insensitively: `Host: LOCALHOST` is the same machine, and a
 *      case-sensitive compare merely sent it down the refusal path for no
 *      reason.
 *
 *      THE BRACKETED IPv6 FORM IS THE ONLY ONE, and this comment used to claim
 *      otherwise: it advertised `[::1]`/`::1`, and the allowlist carried a
 *      matching `hostname === "::1"` arm that could never fire. The port-strip
 *      below matches the trailing `:1` of a bare `::1` and normalises it to
 *      `":"`, so that arm was unreachable from the day it was written — while
 *      the comment went on promising the spelling worked. Brackets are what
 *      RFC 7230 requires in a Host header and what `new URL` can parse; a bare
 *      `::1` is refused, which is correct, and is now what the comment says.
 *
 *      THE PRODUCTION CLAUSE IS THE PORT'S OTHER HALF. The allowlist settles
 *      WHICH MACHINE, and the port was still whatever the request named:
 *      `Host: 127.0.0.1:9200` resolved to `http://127.0.0.1:9200` and sent the
 *      foreman's whole cookie jar to an attacker-chosen port on the app's own
 *      loopback interface. It needs a deployment that forgot to set
 *      `NEXT_PUBLIC_APP_ORIGIN` — but "already misconfigured" is not a security
 *      boundary, and the fallback has no legitimate user in a production build:
 *      every deployment that is not a developer's own machine must name its
 *      origin regardless. So in production there is no header-derived path at
 *      all, and the error's own message is the remedy.
 *
 *      `next start` is a production build, so it needs the variable too — that
 *      includes `qa/field.mjs`, which now sets it to its own ephemeral origin
 *      and thereby exercises branch 1, the path a real deployment takes, rather
 *      than a developer fallback no deployment may use.
 *
 * Anything else throws. Refusing is the only safe answer: the alternative is
 * to guess an origin for a request that has already told us it is not the one
 * we are, while holding a credential.
 *
 * THE SCHEME IS NO LONGER READ OFF `x-forwarded-proto`, and that is the same
 * hole's smaller half. That header is as forgeable as `Host`, and because the
 * derived default for a non-loopback host is already `https`, trusting it
 * could only ever DOWNGRADE — `x-forwarded-proto: http` on a public host sent
 * the session cookie over cleartext, and nothing failed while it happened. It
 * bought nothing in exchange: an operator whose scheme genuinely differs from
 * this derivation sets `NEXT_PUBLIC_APP_ORIGIN`, which is branch 1, which is
 * also how they get a trusted host in the first place. So the scheme is now a
 * function of the host class alone — `http` for loopback, `https` otherwise —
 * and no header can move it.
 *
 * (Kept from the earlier fix, because the reason still holds: the scheme is
 * DERIVED, not a constant. A constant `https` breaks `next dev`/`next start`,
 * both plain HTTP, at the TLS handshake on every render — the failure task 7's
 * fix round closed. A constant `http` would ship an insecure fallback.)
 *
 * `appOrigin` and `nodeEnv` are parameters with defaults rather than bare
 * `process.env` reads so `api.test.ts` can drive every branch without mutating
 * the environment.
 *
 * `nodeEnv`'s default is not really a runtime read: Next inlines
 * `process.env.NODE_ENV` at compile time, so `next build` bakes `"production"`
 * into the shipped bundle and no runtime environment can talk it back into the
 * developer fallback. Measured against `.next/server` output, not assumed.
 */
export function resolveBaseOrigin(
  h: Headers,
  appOrigin: string | undefined = process.env.NEXT_PUBLIC_APP_ORIGIN,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  if (appOrigin) return appOrigin;

  const host = h.get("host") ?? "";

  // NO HEADER-DERIVED ORIGIN IN A PRODUCTION BUILD, for any host — see branch 2
  // above. Checked before the allowlist rather than after it so there is only
  // one refusal to reason about, and so a future edit to the allowlist cannot
  // widen what production accepts.
  if (nodeEnv === "production") throw new UntrustedHostError(host);

  // `host` carries a port in dev (`localhost:3000`); strip it before
  // matching, or a bare hostname comparison would silently never match.
  // NOTE this is also what makes a bare `::1` unmatchable — it normalises to
  // `":"` — which is why no `"::1"` arm appears below.
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  const isLoopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost");

  if (!isLoopback) throw new UntrustedHostError(host);

  return `http://${host}`;
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly problem: unknown) { super("api"); }
}

/**
 * "The session is gone" as one predicate, rather than the same
 * `err instanceof ApiError && err.status === 401` written at each of the three
 * places that must agree about it (`app/(app)/page.tsx`'s two catches and
 * `loadAssignmentsByProject`'s per-project catch). A 401 is never a
 * per-project failure to absorb: every other in-flight request would fail the
 * identical way a moment later.
 */
export function isSessionExpired(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/** The shape this module needs from `fetch`. Real global `fetch` satisfies it, so does a fake. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * A command against `/v1` from the browser.
 *
 * PORTED from `apps/mobile/src/lib/api.ts:94`, which carries the same header
 * set and is covered by four tests there. Two deliberate differences: the
 * office session is a cookie, so there is no bearer header; and `fetchImpl` is
 * injectable, the way `grants.service.ts` injects it, because that is how a
 * write is tested here without a browser.
 *
 * It RETURNS the response rather than throwing on a non-2xx: the caller
 * distinguishes 401 from 422 from 409, and each has different copy.
 */
export async function apiPost(
  path: string,
  body: unknown,
  idempotencyKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  return fetchImpl(path, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
}
