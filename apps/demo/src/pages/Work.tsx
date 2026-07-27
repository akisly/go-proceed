import { useState, type ChangeEvent, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { PROJECT } from '../data/project'
import { formatUah } from '../components/MoneyCard'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import { Panel } from '../components/Panel'
import SegmentedFilter from '../components/SegmentedFilter'
import WorkRegister from '../components/WorkRegister'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
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
    <Button type="button" variant="outline" size="sm" onClick={onClear}>
      Скинути фільтр
    </Button>
  )
}

/**
 * The full register, one row per PROJECT.workItems entry.
 *
 * LAYOUT INTENT. This is a triage surface: someone opens it to find what is
 * blocking the close. So the page spends as little as possible before the first
 * row — a one-line header, a one-line filter bar, then the register. Everything
 * above the table was measured and cut where it could be: the total moved into
 * the header's stat slot instead of occupying its own band, and the desktop top
 * bar is gone entirely (see AppShell).
 *
 * The filter row keeps the segmented control and the search on ONE line from md
 * up, with the search fixed at the end. They are two dimensions of the same
 * question, and splitting them onto two rows made the register start 40px lower
 * for no gain.
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
      <PageHeader
        title="Реєстр робіт"
        meta={PROJECT.name}
        stat={`${visibleItems.length} з ${PROJECT.workItems.length} позицій · ${formatUah(TOTAL_VALUE)}`}
      />

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <SegmentedFilter
            label="Фільтр за готовністю"
            options={READINESS_FILTER_OPTIONS}
            value={filter}
            onChange={setFilter}
            renderLabel={filterLabel}
          />
        </div>
        {/* 224px, not 256: the eight readiness chips beside it need 867px at
            1440, and the wider field pushed «Подано» into a half-cut chip on
            first paint. The field still comfortably fits «Код, назва або
            локація». */}
        <div className="relative shrink-0 md:w-56">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
          />
          <Input
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            placeholder="Код, назва або локація"
            aria-label="Пошук роботи за кодом, назвою або локацією"
            className="pl-9"
          />
        </div>
      </div>

      <Panel aria-label="Реєстр робіт">
        {visibleItems.length > 0 ? (
          <WorkRegister items={visibleItems} />
        ) : (
          <EmptyState
            title="Немає робіт за цим фільтром"
            hint={describeActiveFilter(filter, query)}
            action={clearAction(isFiltered, clearFilter)}
          />
        )}
      </Panel>
    </>
  )
}
