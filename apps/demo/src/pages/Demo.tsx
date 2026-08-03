import { useEffect, useState } from 'react'
import { Check, Download } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { PROJECT, TODAY } from '../data/project'
import { isUnrecoverable, readinessTone } from '../domain/readiness'
import { atRiskTotalUah } from '../domain/risk'
import { formatDateUk, rowsUk } from '../domain/format'
import type { WorkItem } from '../domain/types'
import EvidenceWindow from '../components/EvidenceWindow'
import ReadinessBadge from '../components/ReadinessBadge'
import RequirementList from '../components/RequirementList'
import { Panel, PanelHeader } from '../components/Panel'
import { Button } from '../components/ui/button'
import { formatUah } from '../components/MoneyCard'

/**
 * Five steps, one at a time, no dead ends. Progress lives in component state
 * only — no router state, no persistence (spec A.4.4).
 *
 * `lead` is new. Each step used to drop its artifact on the page with nothing
 * saying what the reader was looking at or why it followed from the last step,
 * which made a guided journey read as five disconnected panels. The leads are
 * descriptions of the demo's own content, not capability claims.
 */
// eslint-disable-next-line react-refresh/only-export-components -- tests/journey.test.ts imports this constant directly from the page component (see task interface contract).
export const DEMO_STEPS = [
  {
    id: 'work-item',
    title: 'Рядок робіт',
    lead: 'Один рядок реєстру: що саме зроблено, де і на яку суму.',
  },
  {
    id: 'requirements',
    title: 'Вимоги до доказів',
    lead: 'Для цього рядка потрібні конкретні докази. Один із них уже є, іншого — ще немає.',
  },
  {
    id: 'capture',
    title: 'Фіксація на об’єкті',
    lead: 'Обсяг фіксують там, де виконують роботу. Ось що за цим рядком уже прийнято.',
  },
  {
    id: 'readiness',
    title: 'Готовність до подання',
    lead: 'Стан рядка — і те, чому саме тут він зупинився.',
  },
  {
    id: 'package',
    title: 'Пакет періоду',
    lead: 'Як цей один рядок виглядає в межах усього періоду.',
  },
] as const

/**
 * Every step renders the same work item from a different angle, so the journey
 * needs exactly one focus item, and it must be the unrecoverable case — the one
 * argument the whole demo exists to make (spec A.3.3, decision D3). A silent
 * `undefined` here would render a broken main surface with no clue why, so a
 * missing focus item fails loudly at import time instead of at render time.
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

const PACKAGE_BUCKETS = [
  { label: 'Готово до пакета', tone: 'signal' as const },
  { label: 'Потребує дій', tone: 'amber' as const },
  { label: 'Ще не розпочато', tone: 'neutral' as const },
]

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

/**
 * The stepper. Numbered, because these ARE a sequence and the order is the
 * content — step 3 only makes sense after step 2. The connecting rule is drawn
 * per item so it always spans exactly the gap between two real steps.
 */
function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Кроки демонстрації">
      {DEMO_STEPS.map((step, index) => {
        const isCurrent = index === current
        const isDone = index < current
        return (
          <li
            key={step.id}
            data-demo-step
            aria-current={isCurrent ? 'step' : undefined}
            className="flex items-center gap-2"
          >
            <span
              aria-hidden="true"
              className={[
                'grid size-6 shrink-0 place-items-center rounded-pill text-micro font-bold tabular-nums',
                isCurrent
                  ? 'bg-carbon text-surface'
                  : isDone
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-surface-sunken text-foreground-muted',
              ].join(' ')}
            >
              {isDone ? <Check size={13} /> : index + 1}
            </span>
            {/* No connecting rules between items. They were decorative, they
                cost 160px across five steps, and they pushed the fifth step
                onto its own line inside the 900px reading measure — a stepper
                that wraps stops reading as a sequence. */}
            <span className={`text-meta ${isCurrent ? 'font-semibold text-foreground' : 'text-foreground-muted'}`}>
              {step.title}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function Demo() {
  const [step, setStep] = useState(0)
  const current = stepAt(step)
  const isLast = step === DEMO_STEPS.length - 1

  const satisfiedRequirements = FOCUS.requirements.filter(r => r.status === 'satisfied')
  const shortfall = FOCUS.plannedQuantity - FOCUS.capturedQuantity

  /*
   * Task 15 accessibility contract: "/demo steps advance with Enter/Space and
   * arrow keys." Enter/Space already work for free — "Назад"/"Далі" below are
   * real <button> elements, and browsers activate buttons on both keys
   * natively. Arrow-key stepping does not exist natively for a <button>, so it
   * needs an explicit handler. Scoped to ArrowRight/ArrowLeft (not Up/Down,
   * which stay free for normal page scrolling) and skipped whenever focus is on
   * a text-editable control, so a future field that accepts typed input on this
   * page would not have its own arrow-key behaviour hijacked.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return
      }
      if (event.key === 'ArrowRight') {
        setStep(previousStep => Math.min(DEMO_STEPS.length - 1, previousStep + 1))
      } else if (event.key === 'ArrowLeft') {
        setStep(previousStep => Math.max(0, previousStep - 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="goproceed-app flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[900px] items-center gap-4 px-5 py-3">
          <Link className="brand" to="/" aria-label="AktFlow — головна">
            <span className="brand__mark">
              <span />
            </span>
            <span>AktFlow</span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link to="/app">Подивитись усе</Link>
          </Button>
        </div>
      </header>

      {/*
       * 900px, not the 1240px the rest of the product uses. This is a guided
       * narrative read once, straight through — a reading measure, not a
       * workspace. The register at /app/work wants every pixel; this wants a
       * column you can follow without losing your place.
       */}
      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 py-8">
        <Stepper current={step} />

        <section data-step={current.id}>
          {/*
           * NOT `uppercase`, unlike every other eyebrow in this product.
           * «Крок 1 з 5» uppercased renders «КРОК 1 З 5», and a capital
           * Ukrainian З between two digits is visually indistinguishable from
           * a 3 in both Manrope and Inter — it read as "КРОК 1 3 5". Any
           * eyebrow whose text sets a Cyrillic З, О or І next to a numeral has
           * this problem; the fix is to not uppercase that string, not to
           * change the word.
           */}
          <span className="text-meta font-medium tracking-[0.04em] text-foreground-muted">
            Крок {step + 1} з {DEMO_STEPS.length}
          </span>
          <h1 className="mt-1 text-h1">{current.title}</h1>
          <p className="mt-2 max-w-[62ch] text-body text-foreground-secondary">{current.lead}</p>

          <div className="mt-6">
            {current.id === 'work-item' && (
              <Panel className="p-5">
                <span className="block text-meta text-foreground-muted">{FOCUS.code}</span>
                <h2 className="mt-0.5 text-h2">{FOCUS.title}</h2>
                <p className="mt-1 text-foreground-secondary">{FOCUS.locationId}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-4">
                  <span className="flex flex-col">
                    <span className="text-meta text-foreground-muted">Вартість рядка</span>
                    <b data-money className="text-h2 font-semibold">
                      {formatUah(FOCUS.valueUah)}
                    </b>
                  </span>
                  <ReadinessBadge state={FOCUS.readiness} />
                </div>
              </Panel>
            )}

            {current.id === 'requirements' && (
              <Panel>
                <PanelHeader
                  title="Перелік вимог"
                  meta={`${FOCUS.code} · ${satisfiedRequirements.length} з ${FOCUS.requirements.length} закрито`}
                />
                <div className="p-4">
                  {/* The same component /app/evidence and /app/rules render, so
                      the three requirement states cannot drift between the demo
                      and the product it demonstrates. */}
                  <RequirementList requirements={FOCUS.requirements} />
                </div>
              </Panel>
            )}

            {current.id === 'capture' && (
              <div className="flex flex-col gap-4">
                <Panel className="p-5">
                  <span className="block text-meta font-medium uppercase tracking-[0.06em] text-foreground-muted">
                    Зафіксований обсяг
                  </span>
                  <p className="mt-1 text-h1 font-semibold tabular-nums">
                    {FOCUS.capturedQuantity} <span className="text-foreground-muted">з</span> {FOCUS.plannedQuantity}{' '}
                    <span className="text-h2 text-foreground-muted">{FOCUS.unit}</span>
                  </p>
                  <p className="mt-2 max-w-[62ch] text-foreground-secondary">
                    {shortfall > 0
                      ? `За рядком ${FOCUS.code} залишилось зафіксувати ${shortfall} ${FOCUS.unit}.`
                      : `За рядком ${FOCUS.code} обсяг зафіксовано повністю.`}
                  </p>
                </Panel>

                {satisfiedRequirements.length > 0 ? (
                  <Panel>
                    <PanelHeader title="Що вже прийнято" meta="Зафіксовано на об’єкті" />
                    <ul className="flex flex-col divide-y divide-border">
                      {satisfiedRequirements.map(req => (
                        <li key={req.id} className="flex items-start gap-3 p-4">
                          <Check
                            size={16}
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-readiness-ready-foreground"
                          />
                          <span>
                            {req.label}
                            {req.capturedAt !== null && (
                              <>
                                {' — '}
                                <time dateTime={req.capturedAt} className="font-semibold">
                                  {formatDateUk(req.capturedAt)}
                                </time>
                              </>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                ) : (
                  <p className="text-foreground-secondary">Жодного доказу ще не зафіксовано для цього рядка.</p>
                )}
              </div>
            )}

            {current.id === 'readiness' && (
              <div className="flex flex-col gap-4">
                <Panel className="flex flex-wrap items-center gap-x-4 gap-y-2 p-5">
                  <span className="text-meta text-foreground-muted">Стан рядка</span>
                  <ReadinessBadge state={FOCUS.readiness} />
                </Panel>
                {/* The same timeline the landing opens with — this is the step
                    that argument belongs to. Header suppressed: four steps in,
                    the reader knows which row this is. */}
                <EvidenceWindow showHeader={false} />
              </div>
            )}

            {current.id === 'package' && (
              <div className="flex flex-col gap-4">
                <Panel>
                  <PanelHeader title={PROJECT.name} meta={PROJECT.customer} />
                  <ul className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
                    {PACKAGE_BUCKETS.map(bucket => (
                      <li key={bucket.tone} className="flex flex-col gap-1 p-4">
                        <span className="text-meta font-medium uppercase tracking-[0.06em] text-foreground-muted">
                          {bucket.label}
                        </span>
                        <b data-money className="text-h2 font-semibold">
                          {formatUah(PACKAGE_TOTALS[bucket.tone].value)}
                        </b>
                        <span className="text-foreground-muted">{rowsUk(PACKAGE_TOTALS[bucket.tone].count)}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>

                <p className="max-w-[68ch] text-foreground-secondary">
                  У розділ «Потребує дій» входить {formatUah(FOCUS.valueUah)} за рядком {FOCUS.code} — саме той, що ви
                  щойно бачили: обсяг закладено, фото до закриття ще немає.
                </p>

                {/*
                 * Review 07 · B2. This breakdown groups by state of readiness, so
                 * its amber bucket is wider than the «Під ризиком» figure on
                 * «Огляд». Both numbers are correct; previously nothing on screen
                 * said why they differ. Scope them explicitly rather than quietly
                 * showing two totals.
                 */}
                <p className="max-w-[68ch] rounded-panel border border-border bg-info-surface px-4 py-3 text-info-foreground">
                  Це розподіл за станом готовності. «Під ризиком» в «Огляді» — вужча величина: лише рядки, яким бракує
                  доказів, {formatUah(atRiskTotalUah(PROJECT.workItems))}.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <nav
        aria-label="Керування кроками демонстрації"
        className="sticky bottom-0 border-t border-border bg-surface/95 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-[900px] flex-wrap items-center gap-3 px-5 py-3">
          <Button
            type="button"
            data-demo-back
            variant="outline"
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Назад
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {!isLast && (
              <Button type="button" data-demo-next variant="primary" onClick={() => setStep(s => s + 1)}>
                Далі
              </Button>
            )}
            {isLast && (
              <>
                {/* Task 17 generates this file; until then the link 404s by design. */}
                <Button asChild variant="outline">
                  <a href="/package-demo.pdf" download>
                    <Download /> Завантажити пакет (PDF)
                  </a>
                </Button>
                {/* PRIMARY action at the moment of maximum willingness (ER-7c). */}
                <Button asChild variant="signal">
                  <NavLink to="/pilot" data-testid="demo-to-pilot">
                    Розкажіть, як у вас
                  </NavLink>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>
    </div>
  )
}
