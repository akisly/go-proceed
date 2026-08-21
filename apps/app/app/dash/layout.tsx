import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import type { MeContextResponse, ProjectListRow, ProjectsListResponse } from "@goproceed/contracts";
import { EmptyState } from "@goproceed/ui/components";

import { apiGet, isSessionExpired } from "../../src/lib/api";
import { Sidebar } from "../../src/components/dash/Sidebar";
import { TopBar } from "../../src/components/dash/TopBar";
import "./dash-theme.css";

/**
 * The office dashboard's shell — Plan D slice D0, task 2.
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
 * WHY BOTH `apiGet` CALLS HAPPEN AGAIN IN `page.tsx`: Next's App Router has
 * no prop channel from a layout into `children` — `children` is an opaque,
 * already-resolved element, not something a layout can pass its own fetched
 * data into. The brief's "fetch ONCE… pass data down" is satisfied by Next's
 * own automatic fetch request memoization instead: `apiGet` calls the native
 * `fetch()`, and Next memoizes IDENTICAL `fetch(url, options)` calls for the
 * lifetime of a single render — including `cache: "no-store"` calls, which
 * opt out of the persistent Data Cache but not out of this per-request dedup
 * (Next's own docs are explicit that this applies regardless of the `cache`
 * option). So this file and `page.tsx` each call `apiGet("/v1/projects")`
 * independently, each does its OWN error handling for ITS OWN scope, and only
 * ONE network round trip happens either way.
 *
 * `/v1/me/context` is fetched here (not in `page.tsx`) because the shell
 * chrome — `WorkspaceSwitch`, and the "no workspace" empty state below —
 * needs it and `page.tsx` does not. `/v1/projects` is ALSO fetched here, even
 * though this file never renders the list itself, so that a failure on
 * either endpoint is caught at the one place that gates the whole `/dash/**`
 * tree — the same reasoning `app/(app)/page.tsx` documents for its own two
 * catches.
 */
export default async function DashLayout({ children }: { children: ReactNode }) {
  let meContext: MeContextResponse;
  try {
    meContext = await apiGet<MeContextResponse>("/v1/me/context");
  } catch (err) {
    if (isSessionExpired(err)) redirect(`/login?next=${encodeURIComponent("/dash")}`);
    return <ShellFatalError />;
  }

  let projects: ProjectListRow[];
  try {
    ({ projects } = await apiGet<ProjectsListResponse>("/v1/projects"));
  } catch (err) {
    if (isSessionExpired(err)) redirect(`/login?next=${encodeURIComponent("/dash")}`);
    return <ShellFatalError />;
  }
  // `projects` is fetched only to share the gate above with `page.tsx`'s
  // identical (memoized) call; this file has nothing further to do with it,
  // and the unused-variable lint that would otherwise flag that is exactly
  // why the destructure above names it at all rather than discarding it.
  void projects;

  const { memberships } = meContext;
  const hasWorkspace = memberships.length > 0;

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar memberships={memberships} className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar memberships={memberships} />
        <main className="min-w-0 flex-1">
          {hasWorkspace ? children : (
            <EmptyState
              className="mx-auto max-w-md py-16"
              title="Немає робочого простору"
              description="У вас ще немає робочого простору."
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ShellFatalError() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <p className="max-w-sm text-center text-data text-ink-muted">
        Не вдалося завантажити робочий простір. Спробуйте ще раз.
      </p>
    </div>
  );
}
