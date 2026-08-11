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
 *   2. `Host` names loopback: `localhost`, `127.0.0.1`, `[::1]`/`::1`, or
 *      anything under `*.localhost` — with or without a port. This is the
 *      explicit allowlist for the unset case, and it is exactly the set of
 *      hostnames a developer's own machine answers to. `next dev` (port 3000)
 *      and `next start` (the browser pass's ephemeral port) both land here.
 *      Matched case-insensitively: `Host: LOCALHOST` is the same machine, and
 *      a case-sensitive compare merely sent it down the refusal path for no
 *      reason.
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
 * `appOrigin` is a parameter with a default rather than a bare
 * `process.env` read so `api.test.ts` can drive both branches without
 * mutating the environment.
 */
export function resolveBaseOrigin(
  h: Headers,
  appOrigin: string | undefined = process.env.NEXT_PUBLIC_APP_ORIGIN,
): string {
  if (appOrigin) return appOrigin;

  const host = h.get("host") ?? "";

  // `host` carries a port in dev (`localhost:3000`); strip it before
  // matching, or a bare hostname comparison would silently never match.
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  const isLoopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
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
