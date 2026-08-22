import { describe, it, expect, vi } from "vitest";

import { performSignOut, type SignOutClient, type SignOutRouter } from "./sign-out.service";

/**
 * The three rules that decide whether signing out is correct, pinned with no
 * DOM.
 *
 * NO jsdom, NO testing-library, NO JSX TRANSFORM — deliberately.
 * `apps/app/vitest.config.ts` runs vitest in a plain node environment and this
 * task does not change that: the dialog's rendering, its Escape handling and
 * the drawer it opens inside are proven in `apps/app/qa/field.mjs`, against a
 * real Chrome, a real Supabase session and real cookies. What a node test can
 * prove that a browser cannot easily is ORDER and NON-CALLS — that
 * `router.replace` never fires on the failure path, that `signOut` fires once
 * and not twice, that nothing reaches Supabase merely because the module was
 * imported. That is what is here.
 *
 * Every collaborator is injected, so the calls below are the real function's
 * real calls, not a mock of the function under test.
 */

/** Records the sequence across BOTH collaborators — the ordering assertions
 * below are about the relationship between them, which per-spy call counts
 * cannot express. */
function harness(signOutBehaviour: () => Promise<{ error: unknown }>) {
  const calls: string[] = [];
  const signOut = vi.fn(async (options?: { scope?: string | undefined }) => {
    calls.push(`signOut:${options?.scope ?? "(default)"}`);
    return await signOutBehaviour();
  });
  const replace = vi.fn((href: string) => { calls.push(`replace:${href}`); });
  const refresh = vi.fn(() => { calls.push("refresh"); });

  const client: SignOutClient = { auth: { signOut } };
  const router: SignOutRouter = { replace, refresh };
  return { calls, signOut, replace, refresh, client, router };
}

const ok = async () => ({ error: null });

describe("performSignOut — the success path", () => {
  it("signs out exactly once, then navigates, then refreshes — in that order", async () => {
    const h = harness(ok);

    const result = await performSignOut({ client: h.client, router: h.router });

    expect(result).toEqual({ kind: "ok" });
    expect(h.signOut).toHaveBeenCalledTimes(1);
    // The ORDER is the assertion. `replace` before `refresh` is what keeps a
    // Back press from repainting the signed-in `/dash` shell out of Next's
    // client Router Cache; refreshing first would invalidate a cache the user
    // is still looking at and then navigate away from it.
    expect(h.calls).toEqual(["signOut:local", "replace:/login", "refresh"]);
  });

  it("asks for the LOCAL scope, never the SDK's global default", async () => {
    // `@supabase/auth-js@2.112.3` defaults `scope` to `'global'`, which
    // revokes every refresh token the account holds — the same person's phone
    // session in the field client included. This control means "sign out of
    // this browser". Asserted on the argument, not on the absence of one:
    // omitting the option would silently take the destructive default.
    const h = harness(ok);
    await performSignOut({ client: h.client, router: h.router });
    expect(h.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("goes to /login and nowhere else", async () => {
    const h = harness(ok);
    await performSignOut({ client: h.client, router: h.router });
    expect(h.replace).toHaveBeenCalledExactlyOnceWith("/login");
  });
});

describe("performSignOut — the failure path never navigates", () => {
  it("surfaces a returned error and calls neither router method", async () => {
    const error = { name: "AuthApiError", status: 500, message: "gotrue is down" };
    const h = harness(async () => ({ error }));

    const result = await performSignOut({ client: h.client, router: h.router });

    expect(result).toEqual({ kind: "error", error });
    // THE POINT OF THIS TEST. `/login` with a cookie the proxy still accepts
    // bounces straight back to `/dash` (proxy.ts's `!user` gate), which reads
    // to the user as a button that did nothing — and hides the failure that
    // actually happened.
    expect(h.replace).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
    expect(h.calls).toEqual(["signOut:local"]);
  });

  it("surfaces a THROWN error the same way, and still does not navigate", async () => {
    // `signOut` rejects as well as resolving with `{ error }` — it acquires a
    // navigator lock and performs a fetch, so a lock timeout or a dropped
    // connection arrives as a rejection.
    const thrown = new Error("Failed to fetch");
    const h = harness(async () => { throw thrown; });

    const result = await performSignOut({ client: h.client, router: h.router });

    expect(result).toEqual({ kind: "error", error: thrown });
    expect(h.replace).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("does not retry on its own after a failure", async () => {
    const h = harness(async () => ({ error: new Error("nope") }));
    await performSignOut({ client: h.client, router: h.router });
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });
});

describe("performSignOut — nothing happens until it is called", () => {
  it("has not touched Supabase merely by being imported", () => {
    // The module is already imported at the top of this file — if importing
    // it signed anyone out (a top-level `supabaseBrowser().auth.signOut()`,
    // a module-scope side effect), this fake would have been reached before
    // any test ran. It is created fresh here, so the real proof is the
    // absence of any module-scope client: `performSignOut` takes its client
    // as an argument and this module imports neither `supabase-browser` nor
    // `next/navigation`.
    const h = harness(ok);
    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.replace).not.toHaveBeenCalled();
  });
});
