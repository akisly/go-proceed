import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { PROJECT } from '../data/project'
import { formatUah } from '../components/MoneyCard'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import { Panel } from '../components/Panel'
import RequirementList from '../components/RequirementList'
import SegmentedFilter from '../components/SegmentedFilter'
import { Button } from '../components/ui/button'
import { rowsUk } from '../domain/format'
import { isAtRisk } from '../domain/risk'
import { READINESS_LABEL_UK } from '../domain/labels'
import type { Requirement, WorkItem } from '../domain/types'

/**
 * "Blocks submission" is a property of the individual requirement
 * (Requirement.blocksSubmission), not of the work item — an item can have
 * both a satisfied requirement and a still-open one that never blocked
 * anything (e.g. a supplier certificate someone is still waiting on). This
 * page keeps that distinction visible instead of flattening every pending
 * record into one undifferentiated "missing evidence" bucket, because
 * claiming a non-blocking gap blocks submission would itself be a false
 * consequence — the opposite of doc 05 §3's "missing requirements explain
 * why and financial impact".
 */
function hasBlockingGap(item: WorkItem): boolean {
  return item.requirements.some(req => req.status === 'pending' && req.blocksSubmission)
}
function hasOnlyNonBlockingGap(item: WorkItem): boolean {
  return !hasBlockingGap(item) && item.requirements.some(req => req.status === 'pending')
}

/**
 * Fix round (final review, finding C3) — /app (App.tsx's AT_RISK_ITEMS) and
 * this page previously disagreed on what "at risk" means: the dashboard
 * gates it on `readiness === 'evidence_missing'` (4 rows, 612 300 ₴), while
 * this page's "Під ризиком" sentence fired for every item with an open
 * *blocking* requirement regardless of readiness — which pulled in
 * `not_started` items (work that has not begun, so nothing has been earned
 * yet, so nothing is currently at risk) and produced a different set (5
 * rows, 748 900 ₴) two clicks away from the dashboard, for an audience whose
 * job is reconciling exactly these numbers.
 *
 * A `not_started` item with a blocking requirement is still worth listing
 * here — the open requirement is real and will need to be closed — so the
 * item stays in the blocking section; only the value claim is gated.
 * `readiness` (not just `hasBlockingGap`) is the single predicate both pages
 * now share for "is this row's value at risk today".
 */
function notAtRiskSentence(item: WorkItem): string {
  return (
    `Поточний статус рядка — «${READINESS_LABEL_UK[item.readiness]}»: сума за ним ще не входить у гроші під ` +
    'ризиком. Вимоги нижче потрібно буде закрити до подання пакета.'
  )
}

/**
 * Fix round (final review, finding C3, the wi-em-0802 case named in the
 * review) — a `readiness === 'evidence_missing'` item whose only open
 * requirement is non-blocking (so it lands in the non-blocking section,
 * never the blocking one) still counts toward /app's "Гроші під ризиком"
 * total, because that dashboard gates purely on readiness. Without this note
 * the item would appear here with no risk language at all while silently
 * being part of the dashboard's at-risk sum two clicks away — itself a
 * smaller version of the same disagreement this fix round exists to close.
 * Scoped to `evidence_missing` only, so it says nothing for a
 * `not_started`/`ready_internal`/etc. item with a stray non-blocking gap,
 * which genuinely is not part of that total.
 */
function nonBlockingRiskNote(item: WorkItem): string | null {
  if (!isAtRisk(item)) return null
  // Review 07 · B2 asks that the wording stay aligned across /app and
  // /app/evidence. Both risk lines on this page now open with the same
  // «Під ризиком {сума} за цим рядком» clause, so a reader can add the
  // figures down the page and land on the dashboard total without having to
  // notice that two different phrasings mean the same thing.
  return (
    `під ризиком за цим рядком: статус — «${READINESS_LABEL_UK.evidence_missing}». ` +
    'Ця конкретна вимога подання пакета не блокує.'
  )
}

type GapFilter = 'all' | 'blocking' | 'non-blocking'

const GAP_FILTER_OPTIONS: readonly GapFilter[] = ['all', 'blocking', 'non-blocking']

const GAP_FILTER_LABEL: Record<GapFilter, string> = {
  all: 'Усі',
  blocking: 'Блокує подання',
  'non-blocking': 'Не блокує подання',
}

/**
 * Task 14 controller RULING 2: a genuine, client-side filter over which gap
 * type to show. Pure and exported for the same reason as Work.tsx's
 * filterWorkItems — this workspace's tests run under Node with no DOM
 * (vitest.config.ts), so the logic has to be verifiable without rendering React.
 *
 * With the dataset shipped in src/data/project.ts (tasks 4/5 deliberately
 * covered every catalog state and both gap types) this returns 5 items for
 * 'blocking' and 2 for 'non-blocking' — never zero. The 'Усі вимоги закрито'
 * empty branch below is therefore correct, real filtering code (not
 * simulated) that is not click-reachable in the live demo today; it is
 * exercised directly in tests/filters.test.ts against a constructed item set
 * where both buckets are actually empty. See task-14-report.md for the full
 * accounting — this is the one row in RULING 2's pair that stayed partially
 * unreached, and it is flagged there rather than left silent.
 */
// eslint-disable-next-line react-refresh/only-export-components -- tests/filters.test.ts imports this function directly from the page component (same interface-contract pattern as DEMO_STEPS in Demo.tsx).
export function itemsForGapFilter(items: readonly WorkItem[], filter: GapFilter): WorkItem[] {
  switch (filter) {
    case 'blocking':
      return items.filter(hasBlockingGap)
    case 'non-blocking':
      return items.filter(hasOnlyNonBlockingGap)
    case 'all':
      return items.filter(item => hasBlockingGap(item) || hasOnlyNonBlockingGap(item))
  }
}

/**
 * `string | undefined` (not a bare optional) is the real call site for
 * RULING 4's `exactOptionalPropertyTypes` fix on EmptyState's `hint` prop —
 * the 'all' branch genuinely has nothing more specific to say than the title.
 */
function gapFilterHint(filter: GapFilter): string | undefined {
  switch (filter) {
    case 'blocking':
      return 'Серед вимог, що блокують подання, відкритих не залишилось.'
    case 'non-blocking':
      return 'Серед вимог без блокування відкритих не залишилось.'
    case 'all':
      return undefined
  }
}

/**
 * One work item's open requirements.
 *
 * The amount leads its own line rather than sitting mid-sentence (Review 07 ·
 * I4): triaging seven of these used to mean reading every one to find the
 * figure. It carries `[data-money]`, so it inherits the tabular treatment and
 * the amounts line up down the page — which is the whole point, since they are
 * meant to be added up to the dashboard's total.
 */
function EvidenceCard({
  item,
  requirements,
  gapKind,
}: {
  item: WorkItem
  requirements: readonly Requirement[]
  gapKind: Exclude<GapFilter, 'all'>
}) {
  /*
   * `gapKind` is not decoration — it decides which sentence is TRUE.
   *
   * `nonBlockingRiskNote` ends «Ця конкретна вимога подання пакета не блокує»,
   * and that clause is only true of the requirements listed in the
   * non-blocking section. Rendered from the card alone (which is what an
   * earlier draft of this rewrite did), every blocking requirement on the page
   * was captioned as not blocking submission — the exact class of false
   * consequence this page exists to avoid. The card cannot infer it: the same
   * work item can appear with either kind of gap, so which sentence applies is
   * a fact about the SECTION, and the section has to say so.
   */
  const qualifier =
    gapKind === 'non-blocking'
      ? nonBlockingRiskNote(item)
      : 'під ризиком за цим рядком, доки нижченаведені вимоги не закрито.'
  return (
    <Panel as="article" data-evidence-item className="p-4">
      <header className="mb-3">
        <span className="block text-meta text-foreground-muted">{item.code}</span>
        <h3 className="text-h3">{item.title}</h3>
      </header>

      {isAtRisk(item) && qualifier !== null ? (
        <p className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <b data-money className="text-h2 font-semibold text-foreground">
            {formatUah(item.valueUah)}
          </b>
          <span className="text-foreground-secondary">{qualifier}</span>
        </p>
      ) : (
        <p className="mb-4 text-foreground-secondary">{notAtRiskSentence(item)}</p>
      )}

      <RequirementList requirements={requirements} />
    </Panel>
  )
}

/**
 * Task 14: a genuine blocking/non-blocking filter (RULING 2). Each section only
 * renders for the gap type currently in view — a section hidden by the filter is
 * not the same fact as a section with zero items, so the two must never share
 * one "empty" sentence (a filtered-away section that still has real open items
 * would make the bare "none exist" text false).
 */
export default function Evidence() {
  const [filter, setFilter] = useState<GapFilter>('all')
  const visibleItems = itemsForGapFilter(PROJECT.workItems, filter)
  const blockingToShow = visibleItems.filter(hasBlockingGap)
  const nonBlockingToShow = visibleItems.filter(hasOnlyNonBlockingGap)

  return (
    <>
      {/* `stat` names the active filter as well as the count: it is this page's
          aria-live region, and «7 рядків» announced on its own does not say
          seven of what, under which filter. */}
      <PageHeader
        title="Вимоги до доказів"
        meta={PROJECT.name}
        stat={`Фільтр «${GAP_FILTER_LABEL[filter]}» · ${rowsUk(visibleItems.length)} з відкритими вимогами`}
      />

      <p className="mb-5 max-w-[68ch] text-foreground-secondary">
        Кожен рядок робіт має власний перелік вимог до доказів. Поки вимога, що блокує подання, залишається
        невиконаною, вся вартість рядка залишається під ризиком — саме це і показано нижче.
      </p>

      <div className="mb-5">
        <SegmentedFilter
          label="Фільтр за типом вимоги"
          options={GAP_FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
          renderLabel={option => GAP_FILTER_LABEL[option]}
        />
      </div>

      {visibleItems.length === 0 && (
        <Panel>
          <EmptyState
            title="Усі вимоги закрито"
            hint={gapFilterHint(filter)}
            icon={<CheckCircle2 size={24} className="text-readiness-ready-foreground" />}
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/demo">Переглянути пакет</Link>
              </Button>
            }
          />
        </Panel>
      )}

      {filter !== 'non-blocking' && blockingToShow.length > 0 && (
        <section aria-label="Вимоги, що блокують подання" data-evidence-group="blocking" className="mb-8">
          <h2 className="mb-3 text-h2">Вимоги, що блокують подання</h2>
          <div className="flex flex-col gap-3">
            {blockingToShow.map(item => (
              <EvidenceCard
                key={item.id}
                item={item}
                gapKind="blocking"
                requirements={item.requirements.filter(req => req.status === 'pending' && req.blocksSubmission)}
              />
            ))}
          </div>
        </section>
      )}

      {filter !== 'blocking' && nonBlockingToShow.length > 0 && (
        <section aria-label="Вимоги без блокування" data-evidence-group="non-blocking">
          <h2 className="mb-1 text-h2">Вимоги без блокування</h2>
          <p className="mb-3 max-w-[68ch] text-foreground-secondary">
            Ці вимоги ще не закрито, але окремо вони подання пакета не зупиняють.
          </p>
          <div className="flex flex-col gap-3">
            {nonBlockingToShow.map(item => (
              <EvidenceCard
                key={item.id}
                item={item}
                gapKind="non-blocking"
                requirements={item.requirements.filter(req => req.status === 'pending')}
              />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
