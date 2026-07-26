import { PROJECT, TODAY } from '../data/project'
import { isUnrecoverable, type ReadinessState } from '../domain/readiness'
import MoneyCard from '../components/MoneyCard'
import StatusChip from '../components/StatusChip'
import UnrecoverableNote from '../components/UnrecoverableNote'
import WorkTable from '../components/WorkTable'

/**
 * Task 10 / A.3.2a hierarchy: money at risk first, readiness split second,
 * work table third. The "at risk" set below is the same evidence_missing
 * filter that produces the MoneyCard total, so the table under it is a
 * literal accounting of that number rather than a decorative list — every
 * row shown sums to exactly what the card claims.
 */
const AT_RISK_ITEMS = [...PROJECT.workItems]
  .filter(item => item.readiness === 'evidence_missing')
  .sort((a, b) => b.valueUah - a.valueUah)

const UNRECOVERABLE_ITEMS = PROJECT.workItems.filter(item => isUnrecoverable(item, TODAY))

/**
 * Review 07 · B3. This previously rendered three hard-coded states whose counts
 * summed to 9, directly beside a denominator reading «з 14 рядків» — five rows
 * unaccounted for, on a page read by people who reconcile columns for a living.
 *
 * Derived from the data instead, in a fixed pipeline order, so the parts always
 * equal the whole. States absent from the dataset are dropped rather than shown
 * as a row of zeroes. Labels come from StatusChip, which renders
 * READINESS_LABEL_UK byte-for-byte from technical/state-catalog.csv.
 */
const READINESS_PIPELINE_ORDER = [
  'not_started',
  'evidence_missing',
  'review_pending',
  'ready_internal',
  'overridden_ready',
  'packaged',
  'submitted',
] as const satisfies readonly ReadinessState[]

const READINESS_DISTRIBUTION = READINESS_PIPELINE_ORDER
  .map(state => ({
    state,
    count: PROJECT.workItems.filter(item => item.readiness === state).length,
  }))
  .filter(entry => entry.count > 0)

export default function Dashboard() {
  const atRisk = PROJECT.workItems
    .filter(item => item.readiness === 'evidence_missing')
    .reduce((sum, item) => sum + item.valueUah, 0)

  return (
    <>
      <h1>Готовність до закриття періоду</h1>
      <p>
        {PROJECT.name} · {PROJECT.customer}
      </p>

      <section aria-label="Гроші під ризиком">
        <h2>Гроші під ризиком</h2>
        <MoneyCard label="Під ризиком" value={atRisk} denominator={`з ${PROJECT.workItems.length} рядків`} />
      </section>

      <section aria-label="Розподіл готовності">
        <h2>Розподіл готовності</h2>
        {READINESS_DISTRIBUTION.map(({ state, count }) => (
          <p key={state}>
            <StatusChip state={state} />
            <span data-readiness-count>{count}</span>
          </p>
        ))}
      </section>

      <section aria-label="Роботи під ризиком">
        <h2>Роботи під ризиком</h2>
        <article className="panel risk-table-panel">
          <WorkTable items={AT_RISK_ITEMS} emptyMessage="Наразі немає рядків зі статусом «Бракує доказів»." />
        </article>
      </section>

      <section aria-label="Неповоротні рядки">
        <h2>Неповоротні рядки</h2>
        <p>Неповоротних рядків: {UNRECOVERABLE_ITEMS.length}</p>
        {UNRECOVERABLE_ITEMS.map(item => (
          <article key={item.id}>
            <span className="eyebrow-chip">{item.code}</span>
            <p>
              <b>{item.title}</b>
            </p>
            <UnrecoverableNote item={item} today={TODAY} />
          </article>
        ))}
      </section>
    </>
  )
}
