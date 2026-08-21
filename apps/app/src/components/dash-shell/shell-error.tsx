/**
 * `dash/layout.tsx`'s fatal state: `getMeContext`/`listProjects` failed with
 * something other than an expired session, so there is no membership data to
 * build the shell chrome around at all. `dash.error.shell` in
 * `technical/copy-catalog.csv`.
 */
export function ShellFatalError() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <p className="max-w-sm text-center text-data text-ink-muted">
        Не вдалося завантажити робочий простір. Спробуйте ще раз.
      </p>
    </div>
  );
}
