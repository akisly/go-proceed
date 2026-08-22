"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * The ONLY browser-side Supabase client. It exists to run the AUTH exchange
 * from the browser, and nothing else.
 *
 * TWO SANCTIONED CALL SITES SINCE PLAN D TASK 3, BOTH ON THE SAME SURFACE:
 *
 *   1. `app/(auth)/login/otp-form.tsx` — `signInWithOtp` / `verifyOtp`.
 *   2. `src/components/dash-shell/sign-out-dialog.tsx` — `signOut`, via
 *      `src/services/sign-out.service.ts`.
 *
 * THIS FILE USED TO SAY «the OTP exchange … and nothing else», WHICH BECAME
 * FALSE the day sign-out landed, and a comment naming a rule it no longer
 * describes is worse than no comment. The rule it was really protecting is
 * unchanged and still holds: EVERY DOMAIN READ AND WRITE GOES THROUGH `/v1`,
 * which authenticates server-side via `requireUser` (src/lib/auth.ts) and
 * re-reads capability on every request. Sign-out is not a domain read or
 * write — it ends a session, the same auth surface the sign-in above begins,
 * and it is the only operation of the two that has no `/v1` equivalent at
 * all: the session cookie is written by `@supabase/ssr` in this browser, and
 * only this client knows how to remove it and revoke its refresh token.
 *
 * So the count went from one to two and the boundary did not move. A third
 * call site that touches DATA — a `.from("…")`, a storage upload — is still
 * a second, unaudited path into Supabase from the browser, and is still the
 * thing this comment exists to refuse.
 *
 * No `cookies` option is passed to `createBrowserClient`: in the INSTALLED
 * `@supabase/ssr@0.12.4` (`apps/app/package.json`, re-read on 2026-08-22 —
 * this comment said `0.5.2` until then, a version this workspace has not
 * carried since the supabase-js bump to 2.112.3), omitting it makes the
 * client read/write the session through `document.cookie` itself, using the
 * same cookie names and chunking scheme that `src/lib/supabase-server.ts`
 * (`getAll`/`setAll` over `next/headers` `cookies()`) and `proxy.ts`
 * (`getAll`/`setAll` over the request/response cookie jars) read on the
 * server. All three only agree on that wire format because they are the same
 * library version — see CLAUDE.md on why `@supabase/ssr` is pinned rather
 * than upgraded independently per call site.
 *
 * THAT IS ALSO WHAT MAKES SIGN-OUT WORK AT ALL. `ssr`'s own default cookie
 * options set `httpOnly: false` (`dist/main/utils/constants.js`, read rather
 * than assumed), so the cookies the server writes are visible to
 * `document.cookie` and this client can actually delete them. Were they
 * HttpOnly, `signOut()` here would revoke the refresh token and leave the
 * browser holding a cookie the proxy still accepts.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
