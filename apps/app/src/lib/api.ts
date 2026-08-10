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
 * WHY THE SCHEME IS DERIVED, NOT A CONSTANT.
 *
 * Fix-round-1, task 7: the original body hardcoded `https://${host}` for the
 * no-override case. `NEXT_PUBLIC_APP_ORIGIN` is set nowhere in this repo,
 * `.claude/launch.json` runs `next dev` on plain HTTP port 3000, and task
 * 11's browser pass runs `next start`, also plain HTTP — so that fallback
 * built `https://localhost:3000` and this self-fetch tried to speak TLS to a
 * server that only speaks HTTP. The request failed at the TLS handshake
 * before `!res.ok` ever ran, this function's caller saw a generic
 * (non-`ApiError`, or an `ApiError` that was never really about the route)
 * failure, and the page's catch-all rendered the error screen on every
 * single render, in every local and CI environment — silently, because
 * `pnpm build`/`tsc --noEmit` succeed either way; a wrong runtime scheme is
 * not a type error.
 *
 * Precedence, in order:
 *   1. `NEXT_PUBLIC_APP_ORIGIN`, when set — an explicit operator override.
 *      Trusted outright: setting it is a deliberate act, not a guess.
 *   2. `x-forwarded-proto`, when present — the one signal a real reverse
 *      proxy in front of a real deployment sets, and the only one that
 *      actually describes what scheme the ORIGINAL client used. This
 *      server's own socket is irrelevant here: this `fetch` call always
 *      talks to Next over plain loopback regardless of what the outside
 *      world sees, so asking the connection "am I on https" is never the
 *      right question in the first place.
 *   3. Otherwise, infer from the host: `http` only for `localhost`,
 *      `127.0.0.1`, `[::1]`/`::1`, or anything under `*.localhost` — the
 *      hostnames a developer's own machine actually answers to over plain
 *      HTTP. Everything else defaults to `https`.
 *
 * That default is `https`, not `http`, ON PURPOSE. The two ways this last
 * branch can be wrong are not symmetric: guessing `https` when the real
 * answer was `http` breaks every fetch loudly (the exact, easy-to-spot
 * symptom this fix exists to close); guessing `http` when the real answer
 * was `https` sends the session cookie across the network in the clear —
 * nothing fails, a credential just leaks, silently. A fallback has to fail
 * loud, not quiet, so the insecure choice is the one that requires positive
 * evidence (a recognized loopback host), never the one left standing by
 * default.
 *
 * DO NOT collapse this back to a single constant scheme. That is the exact
 * simplification this comment exists to stop: a constant `https` reproduces
 * this bug against `next dev`/`next start` (both plain HTTP); a constant
 * `http` would silently ship an insecure fallback to production the day
 * someone's proxy stops sending `x-forwarded-proto`.
 */
function resolveBaseOrigin(h: Headers): string {
  if (process.env.NEXT_PUBLIC_APP_ORIGIN) return process.env.NEXT_PUBLIC_APP_ORIGIN;

  const host = h.get("host") ?? "";

  const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedProto) return `${forwardedProto}://${host}`;

  // `host` carries a port in dev (`localhost:3000`); strip it before
  // matching, or a bare hostname comparison would silently never match.
  const hostname = host.replace(/:\d+$/, "");
  const isLoopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost");

  return `${isLoopback ? "http" : "https"}://${host}`;
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly problem: unknown) { super("api"); }
}
