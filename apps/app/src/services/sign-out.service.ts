"use client";

/**
 * Signing out — the first way this product has ever had, and the whole of
 * the decision lives here rather than in the dialog that renders it.
 *
 * WHY A SERVICE AND NOT FOUR LINES IN THE COMPONENT. `apps/app` runs vitest
 * in a NODE environment with no jsdom, no testing-library and no JSX
 * transform (`apps/app/vitest.config.ts`), and this task deliberately does
 * not add any of them — the interaction proof belongs in `qa/field.mjs`,
 * which drives a real browser against a real session. That leaves exactly one
 * way to unit-test the ordering rules below: put them in a plain function
 * with both of its collaborators injected. `sign-out.service.test.ts` passes a
 * fake client and a fake router and pins the order of the calls; the dialog
 * passes `supabaseBrowser()` and `useRouter()`.
 *
 * ─── `scope: "local"`, and why it is not the default ───────────────────────
 *
 * CHECKED AGAINST THE INSTALLED SDK, NOT RECALLED (CLAUDE.md's rule).
 * `apps/app/package.json` pins `@supabase/supabase-js@2.112.3`, which resolves
 * `@supabase/auth-js@2.112.3`. Its `GoTrueClient.d.ts` declares
 * `signOut(options?: SignOut)` and `lib/types.d.ts` declares
 * `SignOut = { scope?: 'global' | 'local' | 'others' }`, with the doc comment:
 * «**Warning:** the default `scope` is `'global'`. This signs the user out of
 * **every device they are currently signed in on** … pass `{ scope: 'local' }`
 * explicitly.»
 *
 * That default is wrong for this control. The menu item it sits behind says
 * «Вийти» on a shared office machine; `global` revokes every refresh token
 * the account holds — including the SAME PERSON'S PHONE, signed into the
 * field client, mid-shift, with an unsent photo. `local` revokes this
 * browser's refresh token and nothing else.
 *
 * ─── What the SDK actually does on failure, read from the installed source ─
 *
 * `GoTrueClient.js`'s `_signOut` calls `admin.signOut(accessToken, scope)`,
 * and on an error that is NOT 401/403/404/session-missing it still runs
 * `_removeSession()` before returning `{ error }`. So a failed sign-out has
 * usually already cleared the local cookies even though it reports failure —
 * which is precisely why this function does not navigate on that path. It
 * cannot tell the caller whether the cookie survived, so it keeps the user on
 * a page that says what happened, and a retry then succeeds (with no session
 * left, `_signOut` short-circuits through the session-missing branch and
 * returns `{ error: null }`).
 *
 * ─── Why navigation lives here, and why it is BOTH calls ──────────────────
 *
 * `router.replace("/login")`, not `push`: the shell just signed out of must
 * not sit one Back press away.
 *
 * `router.refresh()` after it is not decoration. Next's client-side Router
 * Cache holds the rendered RSC payload for `/`; the cookies are gone but
 * that payload is not, so a Back navigation can repaint the signed-in shell —
 * chrome, workspace name, the user's own address — from cache, with no server
 * round trip to notice the session died. `refresh()` invalidates it. The
 * browser pass asserts the Back navigation, not the call.
 *
 * ON FAILURE, NEITHER — AND THE REASON IS NOT THE ONE THIS COMMENT USED TO
 * GIVE. It claimed `/login` with a live session bounces back to `/dash` via
 * `proxy.ts`. It does not: `proxy.ts:94` holds that file's only redirect and
 * it is guarded `if (!user && pathname !== "/login")`, so a signed-in user
 * who lands on `/login` is served the OTP form like anyone else. Nothing
 * anywhere in this app redirects to `/dash`: every `redirect()` call in
 * `apps/app/app` and `apps/app/src` targets `/login?next=…`. [2026-09-23,
 * DEV-035: `/dash` is now itself a redirect to `/` (`next.config.ts`), and
 * `safeNext` falls back to `/`; neither reaches the sign-out path.] (Corrected
 * 2026-08-22, fix round 1. The count that stood here — "all nine" — was
 * already stale by one when it was written, which is why this says what is
 * true of all of them instead of how many there are.)
 *
 * The real reason is worse than the invented one. A failed sign-out may well
 * have left the session alive — see the `_removeSession` note above, which is
 * exactly why this function cannot tell. Navigating to `/login` anyway shows
 * that user a login form while they are still signed in, on a machine they
 * are trying to walk away from, and destroys the only message saying the
 * sign-out did not happen. They leave believing it did. Staying put, with the
 * failure on screen and the button ready to press again, is the only outcome
 * that cannot be mistaken for success.
 */

/**
 * The narrowest shape of `supabaseBrowser()` this function actually uses.
 *
 * Structural, not `SupabaseClient`, so the test can pass a two-line fake
 * without stubbing a hundred unrelated members — and so that a change to the
 * SDK's `signOut` signature surfaces here, at the one call site, as a type
 * error rather than as a silently-ignored option object.
 */
export type SignOutClient = {
  auth: {
    signOut(options?: { scope?: "global" | "local" | "others" | undefined }): Promise<{
      error: unknown;
    }>;
  };
};

/** The two `AppRouterInstance` methods this uses, for the same reason. */
export type SignOutRouter = {
  replace(href: string): void;
  refresh(): void;
};

export type SignOutResult = { kind: "ok" } | { kind: "error"; error: unknown };

export async function performSignOut({
  client, router,
}: {
  client: SignOutClient;
  router: SignOutRouter;
}): Promise<SignOutResult> {
  let error: unknown;
  try {
    ({ error } = await client.auth.signOut({ scope: "local" }));
  } catch (thrown) {
    // THIS CATCH IS DEFENSIVE AND I HAVE NOT ESTABLISHED A PATH THAT REACHES
    // IT. Two previous versions of this comment named a cause; both were
    // wrong, so this one names only what was read.
    //
    // What IS verified in `@supabase/auth-js@2.112.3`:
    //   - a dropped connection does not reject. `lib/fetch.js:28` throws
    //     `AuthRetryableFetchError`, and `GoTrueAdminApi.js:77-81` catches it,
    //     sees `isAuthError`, and RETURNS `{ error }` — the path below.
    //   - `_useSession` acquires no lock. `GoTrueClient.js:2477-2490` awaits
    //     `__loadSession()` and calls `fn` inside a try/finally that only
    //     emits debug lines; its own comment reads «No serialization is needed
    //     at this layer.»
    //   - the lock that does exist is in `signOut` itself
    //     (`GoTrueClient.js:3395-3403`), gated `if (this.lock != null)` — and
    //     `this.lock` is `null` (`:151`), assigned only `if (settings.lock !=
    //     null)` (`:199`), above a source comment stating there is «no
    //     `navigator.locks` by default, no implicit `processLock`».
    //     `@supabase/ssr@0.12.4`'s `createBrowserClient` never sets it and
    //     `supabase-browser.ts` passes no options, so on this app's client the
    //     lock branch is unreachable and `navigatorLock` is never called by
    //     the library at all — it is only re-exported from `index.js:8`.
    //
    // So: I could not find a rejecting path, and I am not claiming there is
    // none. The catch stays for two reasons that do not depend on knowing:
    // `client` is INJECTED and typed structurally (`SignOutClient`), so any
    // implementation — a fake, a future SDK — may reject; and if one ever did,
    // `sign-out-dialog.tsx` never reaches its `setPending(false)`, leaving the
    // button stuck on «Виходимо…» with nothing on screen to explain it. Two
    // lines against that is the right trade even for a path that may not
    // exist.
    return { kind: "error", error: thrown };
  }
  if (error) return { kind: "error", error };

  router.replace("/login");
  router.refresh();
  return { kind: "ok" };
}
