/**
 * `getBlockedValue`'s `not_found` branch — established, not assumed, by
 * reading `app/v1/projects/[projectId]/blocked-value/route.ts`'s own local
 * `notFound` const beside `supabase/migrations/
 * 0011_workspace_access_security.sql`'s `create policy projects_select`
 * block: the route's own `select workspace_id from public.projects where
 * id = $1` runs under RLS, `projects_select` admits only
 * `array['project.view','project.admin']`, and a caller holding neither
 * gets zero rows back — before any capability check runs. This is therefore
 * the SAME refusal a mistyped or foreign `projectId` gets, and the copy
 * says so in `notFound`'s own words ("Проєкт не знайдено.") rather than
 * inventing a second translation of the identical 404.
 *
 * NO HEADER, NO «Доручення» LINK — unlike every other branch of this screen.
 * `ProjectPage` [`ProjectOverviewHeader` until DEV-035]'s own comment explains why: there is no project to
 * link from.
 *
 * STILL AN `<h1>`, THOUGH — FIX ROUND 1, FINDING E. This was the only branch
 * of the screen with no heading element at all: a page whose entire content
 * is one `<p>` has no document outline, which is a real accessibility gap
 * independent of the (correct) reasoning above for why there is no header
 * CHROME here. Fixed by promoting the existing text to an `<h1>` rather than
 * adding a second, invented sentence beside it — the paragraph above
 * already explains why this renders the route's own words verbatim and
 * nothing more; a heading-plus-body split would have reintroduced exactly
 * the "second translation" that paragraph argues against.
 */
export function ProjectMoneyNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <h1 className="max-w-112 text-center text-data font-medium text-ink-muted">
        Проєкт не знайдено.
      </h1>
    </div>
  );
}
