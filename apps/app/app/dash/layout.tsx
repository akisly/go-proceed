import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getMeContext } from "../../src/services/workspaces.service";
import { listProjects } from "../../src/services/projects.service";
import { accountInitial, accountLabel, getSessionIdentity } from "../../src/services/session.service";
import { DashLayout } from "../../src/layouts/dash-layout";
import { ShellFatalError } from "../../src/components/dash-shell/shell-error";
// The dashboard runs on @goproceed/ui/base.css, whose --gp-font-sans is Onest
// since the Daylight tokens (2026-09-05); the face is loaded here, at the
// dashboard's own layout, so the field-client pages — still on the legacy
// stylesheet and Inter — do not pay for a second family.
import "@fontsource-variable/onest";
import "./dash-theme.css";

/**
 * The office dashboard's route entry — Plan D slice D0, task 2.
 *
 * ROUTE IS `app/dash/**`, NOT `app/(dash)/**` AS THE BRIEF LITERALLY NAMED IT.
 * `(dash)` is a Next.js ROUTE GROUP — parentheses mean "organise these files,
 * add no URL segment" — and `app/(app)/page.tsx` already owns the resulting
 * path ("/"): `apps/app/qa/field.mjs` navigates to `/` and asserts on «Мої
 * доручення» there. A sibling `app/(dash)/page.tsx` resolves to the exact
 * same "/" and Next's build refuses it outright:
 *
 *     Error: You cannot have two parallel pages that resolve to the same
 *     path. Please check /(app) and /(dash).
 *
 * (reproduced locally before writing this file — not a hypothetical). The
 * field client's root route is out of this task's scope and out of Plan D's
 * scope entirely (`docs/design/03-ui-references.md` and
 * `04-role-pain-map.md` both treat it as a separate, already-shipped
 * surface), so it stays exactly where it is. `dash` — a REAL segment, no
 * parentheses — is the smallest change that resolves the collision: every
 * dashboard route now lives under `/dash/**`, and Task 3's brief should read
 * `app/dash/settings/profile/page.tsx`, not `app/(dash)/settings/profile/…`.
 *
 * `apps/app/proxy.ts` NEEDS NO EDIT for this. Its matcher is an EXCLUDE list
 * (`v1`, `external`, `_next`, a handful of static files) — `/dash` was never
 * named in it, so the general matcher already gates it behind the same
 * signed-in-session redirect every other page gets. Confirmed by reading the
 * matcher, not assumed.
 *
 * THIN ON PURPOSE, per `docs/design/03-ui-references.md` §"The hierarchy"
 * (plane's shape, mapped onto this tree): a route file wires params, calls a
 * service, and renders a component — nothing else. This one takes no route
 * params, calls `getMeContext`/`listProjects` (both in `src/services/`),
 * decides redirect-vs-fatal-error-vs-render, and hands the actual shell
 * composition to `src/layouts/dash-layout.tsx`. The services themselves own
 * the `apiGet` calls and the `ApiError`/401 handling — see
 * `workspaces.service.ts`'s header for why they return a discriminated
 * result rather than throwing, and for why `/v1/projects` is fetched again,
 * independently, in `app/dash/page.tsx` (Next's own automatic per-request
 * fetch memoization, not a second network round trip).
 *
 * THE IDENTITY IS FETCHED ONCE, HERE, AND THREADED DOWN. `/v1/me/context`
 * carries no email and no name — `requireUser` resolves only `{ userId }` —
 * so the address the profile menu shows comes from the Supabase session
 * instead, via `session.service.ts`. Called at the top of the tree rather
 * than by each component that wants it: a shell whose chrome fetches its own
 * identity fetches it again for every screen nested inside that chrome.
 * `app/dash/settings/profile/page.tsx` does call it a second time, because
 * the App Router gives a layout no way to hand a value to its page — that
 * call is deduplicated inside the service by React's `cache()`, not by
 * repeating the round trip.
 */
export default async function DashRouteLayout({ children }: { children: ReactNode }) {
  const meResult = await getMeContext();
  if (meResult.kind === "session_expired") redirect(`/login?next=${encodeURIComponent("/dash")}`);
  if (meResult.kind === "error") return <ShellFatalError />;

  // Fetched here too (not only in `page.tsx`) so a failure on EITHER
  // endpoint is caught at the one place that gates the whole `/dash/**`
  // tree — the same reasoning `app/(app)/page.tsx` documents for its own two
  // catches.
  const projectsResult = await listProjects();
  if (projectsResult.kind === "session_expired") redirect(`/login?next=${encodeURIComponent("/dash")}`);
  if (projectsResult.kind === "error") return <ShellFatalError />;

  // A session that died between `proxy.ts`'s own `getUser()` and this render
  // takes the same redirect every other 401 here takes. A genuine failure
  // (Auth unreachable, a 500) must NOT redirect — not because it would loop
  // (this comment said so until 2026-08-22 and it was wrong: `proxy.ts:94`'s
  // only redirect is guarded `!user`, so a valid session is never bounced
  // anywhere), but because it would make a user whose session is fine sign in
  // again for a fault that is not theirs, and hide the outage behind a login
  // form. `session.service.ts` separates those two outcomes; this file only
  // reads the `.kind`.
  //
  // `next=/dash` IS COARSER THAN THE PAGE-LEVEL REDIRECTS BELOW IT, and that
  // is a real limitation rather than an oversight — see the report's fix-round
  // note on finding L. A layout is rendered before its page and has no
  // supported way to read the child pathname in a server component, so a
  // deep link to `/dash/settings/profile` that expires between the proxy and
  // this render comes back to `/dash`. Every COLD open of that URL is still
  // preserved exactly, because `proxy.ts` redirects with the full
  // `pathname + search` before this file ever runs.
  const identityResult = await getSessionIdentity();
  if (identityResult.kind === "session_expired") redirect(`/login?next=${encodeURIComponent("/dash")}`);
  if (identityResult.kind === "error") return <ShellFatalError />;

  return (
    <DashLayout
      memberships={meResult.meContext.memberships}
      accountLabel={accountLabel(identityResult.email)}
      accountInitial={accountInitial(identityResult.email)}
    >
      {children}
    </DashLayout>
  );
}
