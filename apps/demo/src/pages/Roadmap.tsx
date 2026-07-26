import { Link, NavLink } from 'react-router-dom'

/**
 * Conceptual capabilities, Slate-annotated. NOT a feature grid: no icon-in-circle
 * cards, no 3-column symmetry (AI-slop blacklist #2 and #3). A single annotated
 * list, one job for the section (Ruling 5).
 *
 * The three entries mirror qa/routes.mjs's REDIRECTED_ROUTES: variations,
 * external-review, and receivables+payments — every non-shipped surface this
 * demo redirects away from is named exactly once, here, rather than left
 * unexplained.
 */
const CONCEPTUAL = [
  { title: 'Зміни та додаткові роботи', note: 'Концептуально · не реалізовано' },
  { title: 'Зовнішній перегляд пакета', note: 'Концептуально · не реалізовано' },
  { title: 'Дебіторська заборгованість і платежі', note: 'Концептуально · не реалізовано' },
] as const

/**
 * A top-level route (see src/App.tsx), not nested under AppShell — unlike
 * the four /app/* pages there is no sidebar here, so this page renders its
 * own <main> rather than relying on AppShell's (Ruling 6).
 *
 * Task 15: adds the same landmark <header>/brand-link pattern as Demo.tsx —
 * this route previously had no way back to "/" other than the browser's
 * own back button.
 */
export default function Roadmap() {
  return (
    <>
      <header className="app-brand-header">
        <Link className="brand" to="/" aria-label="AktFlow — головна">
          <span className="brand__mark">
            <span />
          </span>
          <span>AktFlow</span>
        </Link>
      </header>
      <main className="roadmap-page">
        <h1>Що далі</h1>
        <p>Нижче — напрям, а не наявні функції. Нічого з цього зараз не працює.</p>
        <dl className="roadmap-list">
          {CONCEPTUAL.map(entry => (
            <div key={entry.title}>
              <dt>{entry.title}</dt>
              <dd>{entry.note}</dd>
            </div>
          ))}
        </dl>
        <NavLink to="/app" className="button button--outline">
          До робочої області
        </NavLink>
      </main>
    </>
  )
}
