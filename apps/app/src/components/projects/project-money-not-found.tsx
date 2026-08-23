/**
 * `getBlockedValue`'s `not_found` branch — established, not assumed, by
 * reading `app/v1/projects/[projectId]/blocked-value/route.ts:68-70` beside
 * `supabase/migrations/0011_workspace_access_security.sql:121-122`: the
 * route's own `select workspace_id from public.projects where id = $1` runs
 * under RLS, `projects_select` admits only `array['project.view',
 * 'project.admin']`, and a caller holding neither gets zero rows back —
 * before any capability check runs. This is therefore the SAME refusal a
 * mistyped or foreign `projectId` gets, and the copy says so in the route's
 * own words (`route.ts:63`, "Проєкт не знайдено.") rather than inventing a
 * second translation of the identical 404.
 *
 * NO HEADER, NO «Доручення» LINK — unlike every other branch of this screen.
 * `ProjectOverviewHeader`'s own comment explains why: there is no project to
 * link from.
 */
export function ProjectMoneyNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <p className="max-w-112 text-center text-data text-ink-muted">Проєкт не знайдено.</p>
    </div>
  );
}
