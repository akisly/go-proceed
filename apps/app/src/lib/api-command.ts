/**
 * A SEPARATE MODULE FROM `lib/api.ts` BECAUSE THEY HAVE CONFLICTING DEPENDENCIES.
 *
 * `lib/api.ts` imports `next/headers`, which is server-only at module scope. The
 * browser cannot import anything from that module, even one function, without
 * breaking the build at the import site.
 *
 * `apiPost` is a browser command — the caller is a `"use client"` form, not a
 * Server Component — and it cannot live in `api.ts`. It lives here instead,
 * with `FetchLike`, and imports nothing server-only.
 *
 * This module is the home of every command the browser sends: POST, PATCH,
 * DELETE, whatever the future holds. Each is shaped the same way: returns the
 * raw response rather than throwing on a non-2xx, and takes an injectable
 * `fetchImpl` so tests can drive it without a real network.
 */

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
