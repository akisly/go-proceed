import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check } from 'lucide-react'
import { PROJECT } from '../data/project'
import { formatUah } from '../components/MoneyCard'
import EmptyState from '../components/EmptyState'
import type { EvidenceKind, WorkItem } from '../domain/types'

/** Not governed by doc 05 §5 (that lock is on ReadinessState only) — a plain, local, honest translation of the evidence kind. */
const EVIDENCE_KIND_LABEL_UK: Record<EvidenceKind, string> = {
  photo: 'Фото',
  file: 'Файл',
  voice_note: 'Голосова нотатка',
  quantity: 'Обсяг',
  typed_form: 'Протокол',
}

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

type GapFilter = 'all' | 'blocking' | 'non-blocking'

const GAP_FILTER_OPTIONS: readonly GapFilter[] = ['all', 'blocking', 'non-blocking']

const GAP_FILTER_LABEL: Record<GapFilter, string> = {
  all: 'Усі',
  blocking: 'Блокує подання',
  'non-blocking': 'Не блокує подання',
}

/**
 * Task 14 controller RULING 2: a genuine, client-side filter over which gap
 * type to show. Pure and exported for the same reason as
 * Work.tsx's filterWorkItems — this workspace's tests run under Node with
 * no DOM (vitest.config.ts), so the logic has to be verifiable without
 * rendering React.
 *
 * With the dataset shipped in src/data/project.ts (tasks 4/5 deliberately
 * covered every catalog state and both gap types) this returns 5 items for
 * 'blocking' and 2 for 'non-blocking' — never zero. The 'Усі вимоги закрито'
 * empty branch below is therefore correct, real filtering code (not
 * simulated) that is not click-reachable in the live demo today; it is
 * exercised directly in tests/filters.test.ts against a constructed item
 * set where both buckets are actually empty. See task-14-report.md for the
 * full accounting — this is the one row in RULING 2's pair that stayed
 * partially unreached, and it is flagged there rather than left silent.
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
 * the 'all' branch genuinely has nothing more specific to say than the
 * title itself.
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
 * Task 14: adds the genuine blocking/non-blocking filter (RULING 2). Each
 * section only renders for the gap type currently in view — a section
 * hidden by the filter is not the same fact as a section with zero items,
 * so the two must never share one "empty" sentence (a filtered-away
 * section that still has real open items would make the bare "none exist"
 * text false).
 */
export default function Evidence() {
  const [filter, setFilter] = useState<GapFilter>('all')
  const visibleItems = itemsForGapFilter(PROJECT.workItems, filter)
  const blockingToShow = visibleItems.filter(hasBlockingGap)
  const nonBlockingToShow = visibleItems.filter(hasOnlyNonBlockingGap)

  return (
    <>
      <h1>Вимоги до доказів</h1>
      <p>
        Кожен рядок робіт має власний перелік вимог до доказів. Поки вимога, що блокує подання, залишається
        невиконаною, вся вартість рядка залишається під ризиком — саме це і показано нижче.
      </p>

      <div className="filter-bar">
        <div className="segmented" role="group" aria-label="Фільтр за типом вимоги">
          {GAP_FILTER_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              className={filter === option ? 'active' : ''}
              onClick={() => setFilter(option)}
            >
              {GAP_FILTER_LABEL[option]}
            </button>
          ))}
        </div>
      </div>

      {/* aria-live: announces the filtered count whenever the visitor
          changes the gap-type filter. */}
      <p aria-live="polite">
        Рядків із відкритими вимогами за фільтром «{GAP_FILTER_LABEL[filter]}»: {visibleItems.length}
      </p>

      {visibleItems.length === 0 && (
        <EmptyState
          title="Усі вимоги закрито"
          hint={gapFilterHint(filter)}
          action={
            <>
              <span className="success-mark synced">
                <Check size={28} aria-hidden="true" />
              </span>
              <Link className="button button--outline button--small" to="/demo">
                Переглянути пакет
              </Link>
            </>
          }
        />
      )}

      {filter !== 'non-blocking' && blockingToShow.length > 0 && (
        <section aria-label="Вимоги, що блокують подання">
          <h2>Вимоги, що блокують подання</h2>
          {blockingToShow.map(item => {
            const blockingRequirements = item.requirements.filter(req => req.status === 'pending' && req.blocksSubmission)
            return (
              <article key={item.id} className="panel blockers-panel">
                <header>
                  <div>
                    <span>{item.code}</span>
                    <b>{item.title}</b>
                  </div>
                  <b>{blockingRequirements.length}</b>
                </header>
                <p>
                  Під ризиком {formatUah(item.valueUah)} за цим рядком, доки нижченаведені вимоги не закрито.
                </p>
                <div className="blocker-list">
                  {blockingRequirements.map(req => (
                    <article key={req.id}>
                      <span className="attention-icon overdue">
                        <AlertTriangle size={14} aria-hidden="true" />
                      </span>
                      <div>
                        <b>{req.label}</b>
                        <small>{EVIDENCE_KIND_LABEL_UK[req.kind]} · Блокує подання пакета</small>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            )
          })}
        </section>
      )}

      {filter !== 'blocking' && nonBlockingToShow.length > 0 && (
        <section aria-label="Вимоги без блокування">
          <h2>Вимоги без блокування</h2>
          <p>Ці вимоги ще не закрито, але окремо вони подання пакета не зупиняють.</p>
          {nonBlockingToShow.map(item => {
            const openRequirements = item.requirements.filter(req => req.status === 'pending')
            return (
              <article key={item.id} className="panel blockers-panel">
                <header>
                  <div>
                    <span>{item.code}</span>
                    <b>{item.title}</b>
                  </div>
                </header>
                <div className="blocker-list">
                  {openRequirements.map(req => (
                    <article key={req.id}>
                      <span className="attention-icon">
                        <AlertTriangle size={14} aria-hidden="true" />
                      </span>
                      <div>
                        <b>{req.label}</b>
                        <small>{EVIDENCE_KIND_LABEL_UK[req.kind]} · Не блокує подання</small>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            )
          })}
        </section>
      )}
    </>
  )
}
