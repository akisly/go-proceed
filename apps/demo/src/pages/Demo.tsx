import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { AlertTriangle, Check } from 'lucide-react'
import { PROJECT, TODAY } from '../data/project'
import { isUnrecoverable, readinessTone } from '../domain/readiness'
import { formatDateUk } from '../domain/format'
import type { EvidenceKind, WorkItem } from '../domain/types'
import StatusChip from '../components/StatusChip'
import UnrecoverableNote from '../components/UnrecoverableNote'
import MoneyCard, { formatUah } from '../components/MoneyCard'

/**
 * Five steps, one at a time, no dead ends. Progress lives in component
 * state only — no router state, no persistence (spec A.4.4).
 */
// eslint-disable-next-line react-refresh/only-export-components -- tests/journey.test.ts imports this constant directly from the page component (see task interface contract).
export const DEMO_STEPS = [
  { id: 'work-item', title: 'Рядок робіт' },
  { id: 'requirements', title: 'Вимоги до доказів' },
  { id: 'capture', title: 'Фіксація на об’єкті' },
  { id: 'readiness', title: 'Готовність до подання' },
  { id: 'package', title: 'Пакет періоду' },
] as const

/**
 * Every step renders the same work item from a different angle, so the
 * journey needs exactly one focus item, and it must be the unrecoverable
 * case — the one argument the whole demo exists to make (spec A.3.3,
 * decision D3). A silent `undefined` here would render a broken main
 * surface with no clue why, so a missing focus item fails loudly at
 * import time instead of at render time.
 *
 * Written as a function (rather than a bare `find(...)` + top-level
 * `if (!x) throw`) because TypeScript's narrowing from that guard does not
 * survive into the `Demo` component's closure below — only the function's
 * declared `WorkItem` return type does, with no `!` anywhere.
 */
function findFocusItem(): WorkItem {
  const item = PROJECT.workItems.find(candidate => isUnrecoverable(candidate, TODAY))
  if (!item) {
    throw new Error(
      'Demo: PROJECT.workItems has no unrecoverable item for TODAY. The guided ' +
        'journey needs at least one (readiness=evidence_missing, a concealment ' +
        'hold point already passed) to make its argument — see src/data/project.ts.',
    )
  }
  return item
}

const FOCUS = findFocusItem()

/** Not governed by doc 05 §5 (that lock is on ReadinessState only) — a plain, local, honest translation of the evidence kind. */
const EVIDENCE_KIND_LABEL_UK: Record<EvidenceKind, string> = {
  photo: 'Фото',
  file: 'Файл',
  voice_note: 'Голосова нотатка',
  quantity: 'Обсяг',
  typed_form: 'Протокол',
}

type Tone = 'signal' | 'amber' | 'neutral'

/**
 * The period package view, bucketed the same way the chip is (readinessTone),
 * so "готово" here always agrees with what the chip says elsewhere. Sums and
 * counts are both derived from PROJECT.workItems — nothing here is invented.
 */
const PACKAGE_TOTALS = PROJECT.workItems.reduce<Record<Tone, { value: number; count: number }>>(
  (totals, item) => {
    const tone = readinessTone(item.readiness)
    const bucket = totals[tone]
    bucket.value += item.valueUah
    bucket.count += 1
    return totals
  },
  { signal: { value: 0, count: 0 }, amber: { value: 0, count: 0 }, neutral: { value: 0, count: 0 } },
)

/**
 * DEMO_STEPS is a fixed, non-empty readonly tuple, so any in-range index is
 * provably defined — but noUncheckedIndexedAccess still types the lookup as
 * possibly undefined. Rather than assert that away with `!`, fail loudly if
 * it's ever wrong instead of silently rendering `undefined`.
 */
function stepAt(index: number): (typeof DEMO_STEPS)[number] {
  const step = DEMO_STEPS[index]
  if (!step) {
    throw new Error(`Demo: no step at index ${index} (DEMO_STEPS has ${DEMO_STEPS.length}).`)
  }
  return step
}

export default function Demo() {
  const [step, setStep] = useState(0)
  const current = stepAt(step)
  const isLast = step === DEMO_STEPS.length - 1

  const pendingCount = FOCUS.requirements.filter(r => r.status === 'pending').length
  const satisfiedRequirements = FOCUS.requirements.filter(r => r.status === 'satisfied')

  return (
    <main className="onboarding-content">
      <ol className="demo-progress" aria-label="Кроки демонстрації">
        {DEMO_STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === step ? 'step' : undefined}>
            <span aria-hidden="true">{i + 1}</span>
            {s.title}
          </li>
        ))}
      </ol>

      <section data-step={current.id}>
        <h1>{current.title}</h1>

        {/* Each step renders FOCUS — the one unrecoverable work item — from a
            different angle, so no step ever repeats another's content and no
            step ever renders an empty panel. */}

        {current.id === 'work-item' && (
          <>
            <span className="eyebrow-chip">{FOCUS.code}</span>
            <h2>{FOCUS.title}</h2>
            <p>{FOCUS.locationId}</p>
            <StatusChip state={FOCUS.readiness} />
          </>
        )}

        {current.id === 'requirements' && (
          <article className="panel blockers-panel">
            <header>
              <div>
                <span>{FOCUS.code}</span>
                <h2>{FOCUS.title}</h2>
              </div>
              <b>{pendingCount}</b>
            </header>
            <div className="blocker-list">
              {FOCUS.requirements.map(req => {
                const satisfied = req.status === 'satisfied'
                return (
                  <article key={req.id}>
                    <span className={`attention-icon ${satisfied ? 'review' : req.blocksSubmission ? 'overdue' : ''}`}>
                      {satisfied ? <Check size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
                    </span>
                    <div>
                      <b>{req.label}</b>
                      <small>
                        {EVIDENCE_KIND_LABEL_UK[req.kind]}
                        {' · '}
                        {req.blocksSubmission ? 'Блокує подання' : 'Не блокує подання'}
                      </small>
                    </div>
                    <span className={`status ${satisfied ? 'status--ready' : 'status--risk'}`} data-state={req.status}>
                      {satisfied ? <Check size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
                      <span>{satisfied ? 'Надано' : 'Очікує'}</span>
                    </span>
                  </article>
                )
              })}
              {FOCUS.requirements.length === 0 && <p>Для цього рядка ще не задано вимог до доказів.</p>}
            </div>
          </article>
        )}

        {current.id === 'capture' && (
          <>
            <div className="page-intro">
              <div>
                <h2>
                  {FOCUS.capturedQuantity} з {FOCUS.plannedQuantity} {FOCUS.unit}
                </h2>
                <p>
                  Зафіксовано {FOCUS.capturedQuantity} {FOCUS.unit} із запланованих {FOCUS.plannedQuantity} {FOCUS.unit} за
                  рядком {FOCUS.code}
                  {FOCUS.capturedQuantity < FOCUS.plannedQuantity
                    ? ` — залишилось ${FOCUS.plannedQuantity - FOCUS.capturedQuantity} ${FOCUS.unit}.`
                    : ' — обсяг зафіксовано повністю.'}
                </p>
              </div>
            </div>
            {satisfiedRequirements.length > 0 ? (
              <aside className="panel close-checklist">
                <span>ЗАФІКСОВАНО НА ОБ’ЄКТІ</span>
                <h2>Що вже прийнято</h2>
                {satisfiedRequirements.map(req => (
                  <p key={req.id}>
                    <Check size={16} aria-hidden="true" />
                    <span>
                      {req.label}
                      {req.capturedAt !== null && (
                        <>
                          {' — '}
                          <time dateTime={req.capturedAt}>{formatDateUk(req.capturedAt)}</time>
                        </>
                      )}
                    </span>
                  </p>
                ))}
              </aside>
            ) : (
              <p>Жодного доказу ще не зафіксовано для цього рядка.</p>
            )}
          </>
        )}

        {current.id === 'readiness' && (
          <>
            <StatusChip state={FOCUS.readiness} />
            <UnrecoverableNote item={FOCUS} today={TODAY} />
          </>
        )}

        {current.id === 'package' && (
          <>
            <div className="page-intro">
              <div>
                <h2>{PROJECT.name}</h2>
                <p>{PROJECT.customer}</p>
              </div>
            </div>
            <div className="package-summary">
              <MoneyCard
                label="Готово до пакета"
                value={PACKAGE_TOTALS.signal.value}
                denominator={`Рядків: ${PACKAGE_TOTALS.signal.count}`}
              />
              <MoneyCard
                label="Потребує дій"
                value={PACKAGE_TOTALS.amber.value}
                denominator={`Рядків: ${PACKAGE_TOTALS.amber.count}`}
              />
              <MoneyCard
                label="Ще не розпочато"
                value={PACKAGE_TOTALS.neutral.value}
                denominator={`Рядків: ${PACKAGE_TOTALS.neutral.count}`}
              />
            </div>
            <p>
              У розділ «Потребує дій» входить {formatUah(FOCUS.valueUah)} за рядком {FOCUS.code} — саме той, що ви щойно
              бачили: обсяг закладено, фото до закриття ще немає.
            </p>
          </>
        )}
      </section>

      <nav className="onboarding-footer" aria-label="Керування кроками демонстрації">
        <button
          type="button"
          className="button button--outline"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Назад
        </button>
        <div className="demo-nav__actions">
          {!isLast && (
            <button type="button" className="button button--dark" onClick={() => setStep(s => s + 1)}>
              Далі
            </button>
          )}
          {isLast && (
            <>
              {/* PRIMARY action at the moment of maximum willingness (ER-7c). */}
              <NavLink to="/pilot" className="button button--signal" data-testid="demo-to-pilot">
                Розкажіть, як у вас
              </NavLink>
              {/* Task 17 generates this file; until then the link 404s by design (task 8 report). */}
              <a className="button button--outline" href="/package-demo.pdf" download>
                Завантажити пакет (PDF)
              </a>
              <NavLink to="/app" className="button button--outline">
                Подивитись усе
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </main>
  )
}
