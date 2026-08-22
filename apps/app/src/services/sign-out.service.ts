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
 * Cache holds the rendered RSC payload for `/dash`; the cookies are gone but
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
 * anywhere in this app redirects to `/dash` — all nine `redirect()` calls go
 * to `/login?next=…`. (Corrected 2026-08-22, fix round 1.)
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
    // `signOut` CAN REJECT as well as resolve with `{ error }`, but NOT for
    // the reason this comment first gave. A dropped connection does NOT
    // reject: `auth-js`'s `lib/fetch.js` wraps it in `AuthRetryableFetchError`
    // and `GoTrueAdminApi.signOut` returns it through `isAuthError`, so a
    // transport failure arrives on the `{ error }` path handled below.
    // (Corrected 2026-08-22, fix round 1.) What genuinely rejects is the
    // lock: `_useSession` acquires one, and `navigatorLock` throws
    // `NavigatorLockAcquireTimeoutError` rather than resolving. The catch
    // stays because that path is real and because an unhandled rejection here
    // would leave the dialog spinning with no message at all.
    return { kind: "error", error: thrown };
  }
  if (error) return { kind: "error", error };

  router.replace("/login");
  router.refresh();
  return { kind: "ok" };
}
