/**
 * DD.MM.YYYY is the product's established user-facing date convention
 * (prototype/src uses it in 13+ places — e.g. Payments.jsx, ExternalReview.jsx,
 * Rules.jsx — ISO YYYY-MM-DD only ever appears inside data, never rendered).
 * Every later task must render dates through this helper rather than
 * printing an ISO string directly.
 *
 * Converts an ISO `YYYY-MM-DD` date to `DD.MM.YYYY`.
 *
 * `timeZone: 'UTC'` is pinned explicitly, on both the parse (`T00:00:00Z`)
 * and the format side, so the result never depends on the viewer's local
 * timezone. Without it, a viewer west of UTC would see the previous day —
 * midnight UTC is still "yesterday evening" anywhere behind UTC. The
 * formatter is constructed fresh per call (not cached at module scope) so
 * this guarantee holds regardless of when the host timezone changes
 * relative to module import — see tests/format.test.ts's timezone suite.
 */
export function formatDateUk(iso: string): string {
  const formatter = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  return formatter.format(new Date(`${iso}T00:00:00Z`))
}
