import type { Session } from "@supabase/supabase-js";

import { API_ORIGIN } from "./env";

/**
 * NO REACT-NATIVE IMPORT IN THIS FILE, DIRECT OR TRANSITIVE, ON PURPOSE.
 * Native auth storage is imported only when a real request needs a token.
 * Pure queue and request tests inject their dependencies under plain Node.
 */

/**
 * The `/v1` problem envelope (`packages/contracts/src/problem.ts`), read the
 * same "parse, don't throw" way `apps/app/src/lib/capture/upload.ts`'s own
 * `readProblem` does: unlike that version's all-or-nothing `ProblemLike |
 * null`, every field here is independently optional, so a caller can
 * destructure `{ detail, userAction, code }` without a null-check first, and
 * a body that has some but not all of the fields still returns what it has.
 */
export type Problem = { detail?: string; userAction?: string; code?: string };

/**
 * Reads the problem envelope off a non-OK `/v1` response. A body that isn't
 * JSON — a proxy's HTML error page, a truncated response — falls through to
 * the generic `{}` rather than rejecting.
 */
export async function readProblem(res: Response): Promise<Problem> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      return {
        detail: typeof b.detail === "string" ? b.detail : undefined,
        userAction: typeof b.userAction === "string" ? b.userAction : undefined,
        code: typeof b.code === "string" ? b.code : undefined,
      };
    }
  } catch {
    // Not JSON — the caller gets the generic {} shape below.
  }
  return {};
}

/**
 * The session this client currently holds, or `null` when signed out.
 * `supabase.auth.getSession()` reads the LOCALLY PERSISTED session — it does
 * not round-trip to the Supabase Auth server (see `apps/app/proxy.ts` for why
 * a server-side gate uses `getUser()` instead, for the same reason that does
 * not apply here). That's the right tradeoff for `apiGet`/`apiPost`: `/v1` is
 * what actually verifies the bearer token on every request, so this is only
 * ever used to decide whether to attach one, never to authorize anything on
 * its own.
 */
export async function requireSession(): Promise<Session | null> {
  const { supabase } = await import("./supabase");
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function authHeader(): Promise<Record<string, string>> {
  const session = await requireSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function apiUrl(path: string): string {
  // `%2e` is normalised to `.` by the URL parser, so it counts as a dot segment.
  if (!/^\/v1(?:\/|$)/.test(path) || /[\\#\r\n]/.test(path) || path.includes("..") || /%2e/i.test(path)) {
    throw new Error("INVALID_API_PATH");
  }
  // A bearer never travels over plain HTTP, except to this machine during development.
  const origin = new URL(API_ORIGIN);
  if (origin.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) {
    throw new Error("INSECURE_API_ORIGIN");
  }
  return `${API_ORIGIN.replace(/\/$/, "")}${path}`;
}

/** GETs only the configured BFF; an external destination never receives a bearer. */
export async function apiGet(path: string, signal?: AbortSignal): Promise<Response> {
  const url = apiUrl(path);
  return fetch(url, {
    method: "GET",
    headers: await authHeader(),
    signal,
    cache: "no-store",
  });
}

/**
 * POSTs a JSON body to `${EXPO_PUBLIC_API_ORIGIN}${path}`, with a bearer
 * token attached when signed in, plus the `Idempotency-Key` every `/v1`
 * mutation requires. The durable queue supplies the SAME key on a replay of
 * the same immutable logical command; it never generates keys per retry.
 *
 * `signal`, ADDED FOR `src/lib/capture/upload.ts`: optional, and threaded
 * straight through to `fetch` with no other change to this function's
 * behaviour — every existing call site (that passes none) is unaffected.
 * The source PWA's `uploadCapture` (`apps/app/src/lib/capture/upload.ts`)
 * attaches one `AbortSignal` to all three of its requests, because that
 * abort is what makes the discard confirmation's «Його не буде збережено на
 * сервері» true rather than aspirational (see that file's own comment,
 * "final review, Important 3"). Without this parameter, this module's two
 * authenticated calls (create-intent, finalize) would be the one place on
 * this platform where a discard could not stop a request already in flight.
 */
export async function apiPost(
  path: string,
  body: unknown,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<Response> {
  const url = apiUrl(path);
  return fetch(url, {
    method: "POST",
    headers: {
      ...(await authHeader()),
      "content-type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
    signal,
  });
}
