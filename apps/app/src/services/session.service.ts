import { cache } from "react";
import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";

import { supabaseServer } from "../lib/supabase-server";

/**
 * The signed-in identity — the one fact about the current user that `/v1`
 * cannot answer.
 *
 * WHY THIS IS NOT A CALL TO `/v1/me/context`. That route returns `userId` and
 * one entry per membership (`workspaceId`, `displayName`, `role`, `status`,
 * `membershipVersion`) and NOTHING ELSE — no email, no name; `requireUser`
 * (src/lib/auth.ts) likewise resolves only `{ userId }` out of the bearer
 * token. Nothing in the product's own API knows the address a user typed into
 * the OTP form. The Supabase session does, so this is the one service that
 * reads Supabase directly rather than going over `apiGet`, and it reads
 * exactly one field.
 *
 * `getUser()`, NEVER `getSession()`, for the reason `proxy.ts` already states
 * at length: `getSession()` decodes the local JWT's claims without asking the
 * Auth server whether they are still valid, so a revoked session still reads
 * as signed in. This runs on the server, and a server component must not
 * present a client-held token as proof of identity.
 *
 * A DISCRIMINATED RESULT, matching `workspaces.service.ts` — see that file's
 * header for why a thin route file reads a `.kind` switch instead of catching
 * somebody else's exception type, and why `session_expired` gets its own arm
 * rather than being folded into `error`.
 */
export type SessionIdentityResult =
  | { kind: "ok"; email: string | null }
  | { kind: "session_expired" }
  | { kind: "error"; error: unknown };

/**
 * `cache()` FROM REACT, AND IT IS LOAD-BEARING, NOT AN OPTIMISATION.
 *
 * `app/dash/layout.tsx` needs the email for the profile menu and
 * `app/dash/settings/profile/page.tsx` needs it for the profile itself, and
 * the App Router gives a layout no way to hand a value to its page. Unlike
 * the two `apiGet` services either side of this one, there is no `fetch` here
 * for Next to memoize — `auth.getUser()` is an SDK call — so without this
 * wrapper that one page would make TWO round trips to the Auth server per
 * render, serially, for the same answer.
 *
 * `cache` is React's own per-request memo for exactly this case ("data
 * fetching that is not `fetch`"): the cache lives for one server render pass
 * and is not shared between requests or between users. Checked against the
 * installed `react@19.2.8` / `@types/react@19.2.18` — `export function
 * cache<CachedFunction extends Function>(fn: CachedFunction): CachedFunction`
 * — and against Next 16's own guidance for deduplicating a `getUser()` call
 * across a layout and its page, not recalled from memory (CLAUDE.md).
 */
export const getSessionIdentity = cache(async function getSessionIdentity(): Promise<SessionIdentityResult> {
  try {
    const { data, error } = await (await supabaseServer()).auth.getUser();

    // THREE OUTCOMES, AND THE MIDDLE ONE IS NOT AN ERROR. A missing session
    // (`AuthSessionMissingError`) and a rejected one (401/403 from GoTrue —
    // expired, revoked, signed out in another tab) both mean the same thing
    // to every caller: send this request to `/login`. Anything else — the
    // Auth server unreachable, a 500, a malformed response — is a genuine
    // failure, and answering THAT with a redirect to `/login` would take a
    // user whose session is perfectly valid and make them sign in again for
    // a fault that has nothing to do with their session. It is not a loop —
    // `proxy.ts:94`'s only redirect is guarded `!user`, so it would not send
    // them back — it is a dead end that is indistinguishable, from the
    // outside, from having been logged out. (This comment claimed the loop
    // until 2026-08-22; corrected in fix round 1.) `ShellFatalError` says
    // what actually happened instead.
    if (error) {
      if (isAuthSessionMissingError(error)) return { kind: "session_expired" };
      if (isAuthApiError(error) && (error.status === 401 || error.status === 403)) {
        return { kind: "session_expired" };
      }
      return { kind: "error", error };
    }
    if (!data.user) return { kind: "session_expired" };

    // `User.email` IS `string | undefined` IN THE SDK'S OWN TYPE, and that is
    // not defensive typing: GoTrue supports phone-only and anonymous users,
    // for whom there is genuinely no address. This product mints users only
    // through email OTP (`otp-form.tsx`, `shouldCreateUser: false`), so the
    // undefined branch should be unreachable here — which is exactly why it
    // is normalised to `null` and handed on rather than asserted away with
    // `!`. A `!` here turns "we do not know this person's address" into a
    // runtime `undefined` rendered as an empty label with nothing to explain
    // it; `null` forces every caller to name the case. `accountLabel` below
    // is where it gets named, once.
    return { kind: "ok", email: data.user.email ?? null };
  } catch (error) {
    // `getUser()` rejects rather than resolving on a transport failure (and
    // `supabaseServer()` itself awaits `cookies()`), so the try/catch is not
    // redundant with the `error` field above.
    return { kind: "error", error };
  }
});

/**
 * The email as a screen may show it, with the one fallback the type above
 * forces.
 *
 * Kept here, beside the only thing that can produce a `null`, so the sidebar
 * menu and the profile page cannot drift into two different sentences for the
 * same state. Both callers are server components (`app/dash/layout.tsx` and
 * `app/dash/settings/profile/page.tsx`) and resolve this before the string
 * reaches a `"use client"` component, which is why this can live in a module
 * that imports `next/headers` transitively.
 *
 * `dash.profile.email_unknown` in `technical/copy-catalog.csv`.
 */
export function accountLabel(email: string | null): string {
  return email ?? "Адреса пошти невідома";
}

/**
 * The avatar's initial. `Avatar` renders initials and has no image source in
 * this product (`packages/ui/src/components/Avatar.tsx`), so this is the whole
 * of it: one uppercase letter, or an em dash when there is no address to take
 * one from — the same «—» the placeholder this task deletes used to show.
 *
 * `[...email][0]`, not `email[0]`: `charAt`/`[0]` cut a UTF-16 code unit, and
 * an address starting outside the BMP would yield half a surrogate pair.
 */
export function accountInitial(email: string | null): string {
  const first = email ? [...email.trim()][0] : undefined;
  return first ? first.toLocaleUpperCase("uk-UA") : "—";
}
