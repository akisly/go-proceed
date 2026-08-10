import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Gate every field-client PAGE navigation behind a signed-in session, and
 * refresh that session's cookie on the way through.
 *
 * WHY THIS EXISTS AT ALL: `requireUser` (src/lib/auth.ts) already refuses an
 * unauthenticated `/v1`/`/external` request with a 401. That is correct and
 * sufficient for the API — but it is enforcement at the very last moment,
 * after a whole page has rendered around a fetch that was always going to
 * fail. A foreman who cold-opens `/assignments/…` from a bookmark with no
 * session should never see that shell at all; middleware is what turns "the
 * API will 401" into "you never got here", by running before any route in
 * `app/(app)` renders.
 *
 * WHY `getUser()` AND NOT `getSession()`: `getSession()` decodes the local
 * JWT's claims without checking they are still valid against the Auth
 * server — a revoked or expired session would still read as signed-in.
 * `getUser()` re-validates on every call, same as `requireUser` does for the
 * API (see the comment on `bearerTokenFrom`/`requireUser` in auth.ts). Never
 * trust a client-supplied session as proof of identity, only a server round
 * trip.
 */
export async function middleware(request: NextRequest) {
  // Reassigned inside `setAll` below: refreshing the session issues a new
  // response so the Set-Cookie headers actually attach to what gets sent
  // back, rather than to a response object created before the refresh ran.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Both writes matter, not just one. `request.cookies` so that,
          // within this same middleware invocation, anything that re-reads
          // the request (including `supabase.auth.getUser()` itself, if it
          // needs to re-check after a refresh) sees the new value rather
          // than the stale cookie the request arrived with. `response`
          // (rebuilt from the now-updated `request`) so the *browser*
          // actually receives the Set-Cookie and stays signed in past this
          // one request — @supabase/ssr 0.5.2's `CookieMethodsServer.setAll`
          // is exactly this two-sided contract, and doing only the response
          // half is the documented way this silently regresses to "random
          // logouts" once anything downstream in the same request depends on
          // the refreshed cookie being visible immediately.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // `/login` must stay reachable while signed out. Without this carve-out,
  // an unauthenticated visit to `/login` would itself fail the check below
  // and redirect to `/login?next=%2Flogin`, which fails the check again —
  // a redirect loop, not a login page.
  if (!user && pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Carry the full path + query, not just the pathname, so a cold-opened
    // deep link (e.g. `/assignments?assignee=me`) lands back on that exact
    // filtered view after sign-in rather than on a bare default list.
    //
    // This value is safe to place in `next` unvalidated here: it is read
    // straight off `request.nextUrl`, i.e. it IS the path this server just
    // routed, never attacker-supplied text. The open-redirect risk is on
    // the OTHER end of this query param — a `next` value typed into a
    // crafted link and never actually navigated to by this middleware — and
    // `otp-form.tsx`'s `sanitizeNext` is what guards that end, at the one
    // point (`router.replace`) where an unvalidated value would actually
    // send someone off this origin.
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  /*
   * The matcher is an EXCLUDE list (`(?!...)` negative lookahead), and this
   * is the single most likely thing in this file to be wrong in a way that
   * fails silently — a bad matcher does not throw, it just quietly starts
   * (or stops) intercepting paths it shouldn't.
   *
   *  - `v1`, `external`: MUST NOT be matched. Both answer an unauthenticated
   *    request with a 401 `application/problem+json` body carrying
   *    `userAction: "sign_in"` (`requireUser` in src/lib/auth.ts) — a
   *    machine-readable contract that curl, the mobile client, and the
   *    external review shell (which deliberately has no account of its own —
   *    see src/lib/external-session.ts) all depend on. If middleware ever
   *    matched these, an unauthenticated API call would come back as a 302
   *    to an HTML login page instead of that JSON document: no type error,
   *    no lint failure, just every API client's error handling receiving
   *    HTML where it parsed JSON a moment ago.
   *  - `_next`: Next's own build assets and internal RSC/prefetch traffic.
   *    Running an Auth `getUser()` network round trip for every script chunk
   *    is pure latency with no security benefit — none of it is session-
   *    gated data.
   *  - `favicon.ico`, `manifest.webmanifest`, and common static-asset
   *    extensions: public, unauthenticated files (the manifest is named
   *    explicitly per the task brief). The manifest in particular is fetched
   *    by the browser's install-prompt machinery, which does not forward
   *    cookies the way a normal navigation does — redirecting it to `/login`
   *    would break "Add to Home Screen" without protecting anything.
   */
  matcher: [
    "/((?!v1|external|_next|favicon\\.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|json)$).*)",
  ],
};
