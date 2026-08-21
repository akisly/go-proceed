/**
 * `dash/page.tsx`'s error state: the shell chrome around it already
 * rendered (this is inside `<main>`, not a full-page replacement) — only the
 * project list failed to load. `dash.error.projects` in
 * `technical/copy-catalog.csv`.
 */
export function ProjectsLoadError() {
  return (
    <div className="flex items-center justify-center p-16">
      <p className="max-w-sm text-center text-data text-ink-muted">
        Не вдалося завантажити проєкти. Спробуйте ще раз.
      </p>
    </div>
  );
}
