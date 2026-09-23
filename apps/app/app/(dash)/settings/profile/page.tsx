import { redirect } from "next/navigation";

import { getMeContext } from "../../../../src/services/workspaces.service";
import { accountLabel, getSessionIdentity } from "../../../../src/services/session.service";
import { ProfileView } from "../../../../src/components/profile/profile-view";
import { ShellFatalError } from "../../../../src/components/dash-shell/shell-error";

const HERE = "/settings/profile";

/**
 * `04-role-pain-map.md` screen 6.
 *
 * THE PATH IS `app/dash/settings/profile`, NOT `app/(dash)/settings/profile`
 * as Plan D's own text still says. `(dash)` is a Next.js ROUTE GROUP — the
 * parentheses add no URL segment — and it collides with the field client's
 * `app/(app)/page.tsx` at `/`; Task 2 reproduced the build failure and moved
 * the whole tree to a real `dash` segment. See `app/dash/layout.tsx`'s header
 * for the full account.
 * [2026-09-23, DEV-035: history. The tree is `app/(dash)/**` now and this
 * page is `/settings/profile`; the collision went with the field PWA.]
 *
 * THIN, per `docs/design/03-ui-references.md` §"The hierarchy": two services,
 * one `.kind` switch each, one component. The two questions it asks are
 * genuinely different sources and neither can answer the other's — the address
 * is in the Supabase session and nowhere in `/v1`; the memberships are in
 * `/v1/me/context` and nowhere in the session.
 *
 * NEITHER CALL IS A SECOND ROUND TRIP, and both are deduplicated by a
 * different mechanism, which is why this file says so rather than leaving the
 * next reader to assume one covers both:
 *
 *  - `getMeContext` goes through `apiGet`, i.e. `fetch`, which Next memoizes
 *    per render pass for an identical GET regardless of `cache: "no-store"`
 *    (`app/(dash)/page.tsx` documents this against installed `next@16.3.1`), so
 *    the layout's call and this one are one request.
 *  - `getSessionIdentity` is NOT a `fetch` — it is an SDK call — so Next
 *    memoizes nothing. It is wrapped in React's `cache()` in the service
 *    itself, which is what makes the layout's call and this one one round trip
 *    to the Auth server. That was the brief's open question ("prefer passing
 *    it if the tree makes that natural"): the App Router gives a layout no way
 *    to pass a value to its page, so the dedup has to live in the service, not
 *    in the call sites.
 */
export default async function ProfilePage() {
  const identityResult = await getSessionIdentity();
  if (identityResult.kind === "session_expired") redirect(`/login?next=${encodeURIComponent(HERE)}`);
  if (identityResult.kind === "error") return <ShellFatalError />;

  const meResult = await getMeContext();
  if (meResult.kind === "session_expired") redirect(`/login?next=${encodeURIComponent(HERE)}`);
  if (meResult.kind === "error") return <ShellFatalError />;

  return (
    <ProfileView
      accountLabel={accountLabel(identityResult.email)}
      memberships={meResult.meContext.memberships}
    />
  );
}
