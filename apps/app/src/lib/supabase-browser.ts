"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * The ONLY browser-side Supabase client. It exists to run the OTP exchange
 * (`signInWithOtp` / `verifyOtp` in `app/(auth)/login/otp-form.tsx`) and
 * nothing else: every domain read and write goes through `/v1`, which
 * authenticates server-side via `requireUser` (src/lib/auth.ts) and
 * re-reads capability on every request. A second call site for this client
 * would be a second, unaudited path into Supabase from the browser.
 *
 * No `cookies` option is passed to `createBrowserClient`: in @supabase/ssr
 * 0.5.2, omitting it makes the client read/write the session through
 * `document.cookie` itself, using the same cookie names and chunking scheme
 * that `src/lib/supabase-server.ts` (`getAll`/`setAll` over `next/headers`
 * `cookies()`) and `middleware.ts` (`getAll`/`setAll` over the
 * request/response cookie jars) read on the server. All three only agree on
 * that wire format because they are the same library version — see
 * CLAUDE.md / the task brief on why `@supabase/ssr` is pinned rather than
 * upgraded independently per call site.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
