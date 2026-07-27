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

/**
 * Ukrainian has three plural forms, and picking the wrong one is the kind of
 * error a non-native reviewer waves through and a native reader trips over
 * immediately. This project has had no native-speaker review yet, so the rule
 * is encoded rather than eyeballed per call site.
 *
 *   one   1, 21, 31 … but NOT 11        — «1 рядок»
 *   few   2-4, 22-24 … but NOT 12-14    — «4 рядки»
 *   many  0, 5-20, 25-30 …              — «14 рядків»
 *
 * The teens are the trap: 11-14 all take `many` despite ending in 1-4, which is
 * why the check is on the last TWO digits and not just the last one. The
 * existing «Неповоротних рядків: 3» construction elsewhere sidesteps this by
 * always using the genitive — correct, but it forces every label into a
 * "noun: number" shape. This lets a count read as a phrase.
 */
export function pluralUk(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(Math.trunc(count))
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 14) return many
  const last = n % 10
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

/** «4 рядки», «14 рядків», «1 рядок». */
export function rowsUk(count: number): string {
  return `${count} ${pluralUk(count, 'рядок', 'рядки', 'рядків')}`
}

/** «1 день», «2 дні», «11 днів». */
export function daysUk(count: number): string {
  return `${count} ${pluralUk(count, 'день', 'дні', 'днів')}`
}

/**
 * Whole days between two ISO `YYYY-MM-DD` dates.
 *
 * Both are parsed at midnight UTC, the same pin `formatDateUk` uses, so the
 * result never shifts by one because the viewer is west of UTC — which for a
 * figure like "the evidence window was one day wide" would be the difference
 * between the argument landing and reading as nonsense.
 */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`)
  const to = Date.parse(`${toIso}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}
