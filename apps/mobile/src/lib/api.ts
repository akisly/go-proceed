import type { Session } from "@supabase/supabase-js";

import { API_ORIGIN } from "./env";
import { supabase } from "./supabase";

/**
 * NO REACT-NATIVE IMPORT IN THIS FILE, DIRECT OR TRANSITIVE, ON PURPOSE.
 * `./env` is a pure `process.env` reader and `./supabase` only reaches
 * `@supabase/supabase-js` (no `storage` adapter — see its own comment) — both
 * run under plain Node, which is what lets `api.test.ts` run under
 * `vitest.config.ts`'s `environment: "node"` with a fake `fetch` and a fake
 * `supabase.auth.getSession`, instead of needing RN/jsdom globals just to
 * import this module.
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
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function authHeader(): Promise<Record<string, string>> {
  const session = await requireSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/** GETs `${EXPO_PUBLIC_API_ORIGIN}${path}`, with a bearer token attached when signed in. */
export async function apiGet(path: string): Promise<Response> {
  return fetch(`${API_ORIGIN}${path}`, {
    method: "GET",
    headers: await authHeader(),
  });
}

/**
 * POSTs a JSON body to `${EXPO_PUBLIC_API_ORIGIN}${path}`, with a bearer
 * token attached when signed in, plus the `Idempotency-Key` every `/v1`
 * mutation requires — a fresh key per call ATTEMPT, not per logical resource
 * (see `attemptKey()` in `apps/app/src/lib/capture/upload.ts`); the caller
 * owns generating it.
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
  return fetch(`${API_ORIGIN}${path}`, {
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
