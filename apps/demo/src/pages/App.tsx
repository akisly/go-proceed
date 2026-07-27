import { PROJECT, TODAY } from '../data/project'
import { rowsUk } from '../domain/format'
import { isUnrecoverable, type ReadinessState } from '../domain/readiness'
import { atRiskItems, atRiskTotalUah } from '../domain/risk'
import MoneySummary from '../components/MoneySummary'
import PageHeader from '../components/PageHeader'
import { Panel, PanelHeader } from '../components/Panel'
import ReadinessSplit from '../components/ReadinessSplit'
import UnrecoverableCallout from '../components/UnrecoverableCallout'
import WorkRegister from '../components/WorkRegister'
import EmptyState from '../components/EmptyState'

/**
 * Hierarchy (doc 05 / A.3.2a): money at risk first, readiness split second,
 * the rows behind that money third, the unrecoverable subset last.
 *
 * The "at risk" set below is the same `evidence_missing` filter that produces
 * the MoneySummary total, so the register under it is a literal accounting of
 * that number rather than a decorative list — every row shown sums to exactly
 * what the summary claims. Sorted by value descending: if you are going to
 * close one gap today, it should be the expensive one.
 */
const AT_RISK_ITEMS = [...atRiskItems(PROJECT.workItems)].sort((a, b) => b.valueUah - a.valueUah)

const UNRECOVERABLE_ITEMS = PROJECT.workItems.filter(item => isUnrecoverable(item, TODAY))

/**
 * Review 07 · B3. This previously rendered three hard-coded states whose counts
 * summed to 9, directly beside a denominator reading «з 14 рядків» — five rows
 * unaccounted for, on a page read by people who reconcile columns for a living.
 *
 * Derived from the data instead, in a fixed pipeline order, so the parts always
 * equal the whole. States absent from the dataset are dropped rather than shown
 * as a row of zeroes.
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
  // Review 07 · B2: one definition, imported — never re-derived per surface.
  const atRisk = atRiskTotalUah(PROJECT.workItems)

  return (
    <>
      <PageHeader title="Готовність до закриття періоду" meta={`${PROJECT.name} · ${PROJECT.customer}`} />

      {/*
       * The focal row. Money leads at `wide`, taking the wider of the two
       * tracks, with the distribution beside rather than beneath it — they
       * answer the same question ("can this period close?") from two
       * directions, and stacking them made the second one look like an
       * afterthought 600px down the page.
       */}
      <div className="mb-6 grid gap-4 wide:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] wide:items-start">
        <Panel className="p-5">
          <MoneySummary
            heading="Гроші під ризиком"
            value={atRisk}
            denominator={`з ${PROJECT.workItems.length} рядків`}
            qualifier="Це вартість рядків, за якими зараз бракує доказів, — доки вимоги не закрито. Це не твердження, що ці гроші не буде сплачено."
          />
        </Panel>

        <Panel>
          <PanelHeader title="Розподіл готовності" />
          <ReadinessSplit distribution={READINESS_DISTRIBUTION} total={PROJECT.workItems.length} />
        </Panel>
      </div>

      <Panel aria-label="Роботи під ризиком" className="mb-6">
        <PanelHeader title="Роботи під ризиком" meta={rowsUk(AT_RISK_ITEMS.length)} />
        {AT_RISK_ITEMS.length > 0 ? (
          <WorkRegister items={AT_RISK_ITEMS} />
        ) : (
          <EmptyState
            title="Наразі немає рядків зі статусом «Бракує доказів»"
            hint="Щойно за якимось рядком забракне доказу, він з’явиться тут разом зі своєю вартістю."
          />
        )}
      </Panel>

      {UNRECOVERABLE_ITEMS.length > 0 ? (
        <Panel aria-label="Неповоротні рядки">
          {/*
           * Deliberately last, and deliberately not merged into the table
           * above. Concealment is not a catalog state (technical/state-catalog
           * .csv has no such value) — it is a derived view fact about time and
           * a hold point, and these rows still carry «Бракує доказів» in the
           * register. Giving it its own section keeps that distinction visible
           * instead of inventing an eighth status.
           */}
          <PanelHeader title="Неповоротні рядки" meta={rowsUk(UNRECOVERABLE_ITEMS.length)} />
          <ul className="flex flex-col divide-y divide-border">
            {UNRECOVERABLE_ITEMS.map(item => (
              <li key={item.id} className="flex flex-col gap-2 p-4">
                <div>
                  <span className="block text-meta text-foreground-muted">{item.code}</span>
                  <span className="block font-semibold text-foreground">{item.title}</span>
                </div>
                <UnrecoverableCallout item={item} today={TODAY} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  )
}
