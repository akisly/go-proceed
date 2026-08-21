import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getMeContext } from "../../src/services/workspaces.service";
import { listProjects } from "../../src/services/projects.service";
import { DashLayout } from "../../src/layouts/dash-layout";
import { ShellFatalError } from "../../src/components/dash-shell/shell-error";
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
 * composition to `src/layouts/dash-layout.tsx`. The two services themselves
 * own the `apiGet` calls and the `ApiError`/401 handling — see
 * `workspaces.service.ts`'s header for why they return a discriminated
 * result rather than throwing, and for why `/v1/projects` is fetched again,
 * independently, in `app/dash/page.tsx` (Next's own automatic per-request
 * fetch memoization, not a second network round trip).
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

  return <DashLayout memberships={meResult.meContext.memberships}>{children}</DashLayout>;
}
