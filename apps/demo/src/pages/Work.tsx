import { useState, type ChangeEvent, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { PROJECT } from '../data/project'
import { formatUah } from '../components/MoneyCard'
import EmptyState from '../components/EmptyState'
import WorkTable from '../components/WorkTable'
import { READINESS_LABEL_UK } from '../domain/labels'
import type { ReadinessState, WorkItem } from '../domain/types'

/**
 * A register reads in code order, not insertion order — the dataset in
 * src/data/project.ts is authored by discovery date, not by code, so it
 * sorts here rather than being pre-sorted at the source.
 */
const SORTED_ITEMS = [...PROJECT.workItems].sort((a, b) => a.code.localeCompare(b.code, 'uk'))

const TOTAL_VALUE = PROJECT.workItems.reduce((sum, item) => sum + item.valueUah, 0)

type ReadinessFilter = ReadinessState | 'all'

/**
 * Task 14 controller RULING 2: a genuine, client-side readiness filter, so
 * `/app/work`'s empty row is actually reachable rather than asserted. Every
 * canonical catalog state is offered, in catalog order, plus the "Усі"
 * default — no bucket is invented; every label below comes verbatim from
 * READINESS_LABEL_UK (doc 05 §5 forbids rewording it per page).
 *
 * With the shipped dataset every one of these seven states already has at
 * least one row (task 4/5 built it that way, to demonstrate full catalog
 * coverage), so the readiness filter alone can never return zero rows — see
 * task-14-report.md. The search box below is the second, real filter
 * dimension that makes an empty result genuinely reachable (e.g. pick any
 * state and type a query that matches nothing, or leave the state on "Усі"
 * and search for a code that doesn't exist): the empty message
 * («Немає робіт за цим фільтром») never asserts more than that — no state
 * naming is claimed to be exhaustive/false, so combining it with search
 * carries no honesty risk.
 */
const READINESS_FILTER_OPTIONS: readonly ReadinessFilter[] = [
  'all',
  'not_started',
  'evidence_missing',
  'review_pending',
  'ready_internal',
  'overridden_ready',
  'packaged',
  'submitted',
]

function filterLabel(filter: ReadinessFilter): string {
  return filter === 'all' ? 'Усі' : READINESS_LABEL_UK[filter]
}

/**
 * Pure and exported so it is directly testable — this workspace's vitest
 * config runs under Node with no DOM (see vitest.config.ts; component
 * behaviour is the puppeteer QA harness's job), so the filtering logic has
 * to be verifiable without rendering React. Plain client-side filtering of
 * the bundled array, no server-query pretence (RULING 2's closing note).
 */
// eslint-disable-next-line react-refresh/only-export-components -- tests/filters.test.ts imports this function directly from the page component (same interface-contract pattern as DEMO_STEPS in Demo.tsx).
export function filterWorkItems(items: readonly WorkItem[], filter: ReadinessFilter, query: string): WorkItem[] {
  const q = query.trim().toLowerCase()
  return items.filter(item => {
    const matchesFilter = filter === 'all' || item.readiness === filter
    const matchesQuery = q === '' || `${item.code} ${item.title} ${item.locationId}`.toLowerCase().includes(q)
    return matchesFilter && matchesQuery
  })
}

/** Names whichever real filter(s) are active, so the empty state never just says "нічого не знайдено" (RULING 5). */
function describeActiveFilter(filter: ReadinessFilter, query: string): string {
  const parts: string[] = []
  if (filter !== 'all') parts.push(`статус «${filterLabel(filter)}»`)
  const trimmedQuery = query.trim()
  if (trimmedQuery !== '') parts.push(`пошук «${trimmedQuery}»`)
  return parts.length > 0
    ? `Активний фільтр: ${parts.join(' і ')}. Спробуйте інше значення або скиньте фільтр.`
    : 'Спробуйте інше значення фільтра.'
}

/**
 * `ReactNode | undefined` (not a bare optional) demonstrates RULING 4's
 * `exactOptionalPropertyTypes` fix at a real call site: EmptyState's `action`
 * prop only compiles against a value genuinely typed to include `undefined`.
 * The `hasActiveFilter` guard exists because the caller only ever renders
 * EmptyState once at least one filter is active (with 14 rows and "Усі" +
 * no query, the result set is never empty) — so this function's `undefined`
 * branch is not reached in practice today, but the static type is real.
 */
function clearAction(hasActiveFilter: boolean, onClear: () => void): ReactNode | undefined {
  if (!hasActiveFilter) return undefined
  return (
    <button type="button" className="button button--outline button--small" onClick={onClear}>
      Скинути фільтр
    </button>
  )
}

/**
 * Ruling 2 (Task 10): the full register, one row per PROJECT.workItems
 * entry, using the existing `.work-table` design-system class rather than
 * inventing a new table style. Quantity "against plan" is rendered as two
 * columns — planned and captured, both unit-suffixed — since that is the
 * only lossless way to show a shortfall (a single "12/18 шт" string would
 * still need two numbers; two columns keep both scannable at table width).
 *
 * Task 14: adds a real readiness-state filter (`.segmented`, reused from
 * the approved prototype's Packages/Dashboard pages — grepped first,
 * `.segmented`/`.filter-bar`/`.search-box` already exist in styles.css, no
 * new CSS needed for the controls themselves) plus a code/title/location
 * search box, so the filtered-to-zero row (A.3.7a) is a real interaction
 * rather than a state that can never occur.
 */
export default function Work() {
  const [filter, setFilter] = useState<ReadinessFilter>('all')
  const [query, setQuery] = useState('')
  const visibleItems = filterWorkItems(SORTED_ITEMS, filter, query)
  const isFiltered = filter !== 'all' || query.trim() !== ''

  function clearFilter() {
    setFilter('all')
    setQuery('')
  }

  return (
    <>
      <h1>Реєстр робіт</h1>
      <div className="page-intro">
        <div>
          {/* aria-live: announces the filtered count whenever the visitor
              changes the readiness filter or the search text. */}
          <h2 aria-live="polite">
            {visibleItems.length} з {PROJECT.workItems.length} позицій · {formatUah(TOTAL_VALUE)}
          </h2>
          <p>{PROJECT.name}</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="segmented" role="group" aria-label="Фільтр за готовністю">
          {READINESS_FILTER_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              className={filter === option ? 'active' : ''}
              onClick={() => setFilter(option)}
            >
              {filterLabel(option)}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            placeholder="Код, назва або локація"
            aria-label="Пошук роботи за кодом, назвою або локацією"
          />
        </label>
      </div>

      <section className="panel full-work-table" aria-label="Реєстр робіт">
        {visibleItems.length > 0 ? (
          <WorkTable items={visibleItems} />
        ) : (
          <EmptyState
            title="Немає робіт за цим фільтром"
            hint={describeActiveFilter(filter, query)}
            action={clearAction(isFiltered, clearFilter)}
          />
        )}
      </section>
    </>
  )
}
