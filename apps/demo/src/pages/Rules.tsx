import type { ReactNode } from 'react'
import { PROJECT } from '../data/project'
import PageHeader from '../components/PageHeader'
import { Panel } from '../components/Panel'
import RequirementList from '../components/RequirementList'
import type { WorkItem } from '../domain/types'

/**
 * Ruling 2 (Task 10): this page explains the concept in prose. It is
 * deliberately NOT a port of prototype/src/pages/Rules.jsx — that file is a
 * 194-line rule editor (toggle switches, impact preview, publish dialog).
 * Building any of that here would misrepresent what this static demo can
 * do: there is no rule engine behind it, only a frozen dataset. This page
 * instead tells the reader what the mechanism is and, honestly, why the
 * interactive editor is not part of this walkthrough.
 *
 * Fix round 1: the first version asserted, in present tense, that the
 * requirements shown on /app/work and /app/evidence "were generated from" and
 * "store" a rule version. `Requirement` (src/domain/types.ts) has no version
 * field, and nothing under src/domain or src/data models one — that was a false
 * capability claim about this codebase, not a simplification. The intro, the
 * "why packages aren't recalculated" section and the worked example now describe
 * the mechanism in explanatory/conditional register ("у системі з рушієм
 * правил... зберігала б") instead of asserting it happened to this demo's data,
 * and a direct no-rule-engine disclaimer sits next to the editor disclaimer.
 *
 * LAYOUT. The only route in the internal app that is pure reading, so it is the
 * only one with a measure cap: 68ch, the same measure /legal already uses. The
 * frozen sheet let this run 148 characters per line at 1440px (Review 07 · I7),
 * which is roughly twice the width at which a reader reliably finds the start of
 * the next line.
 */

/**
 * A single worked example keeps the explanation tied to real data instead
 * of staying abstract. Written as a function (see Demo.tsx's findFocusItem) so
 * a missing id fails loudly at import time rather than silently rendering an
 * empty page — no non-null assertion needed.
 */
function findExampleItem(id: string): WorkItem {
  const item = PROJECT.workItems.find(candidate => candidate.id === id)
  if (!item) {
    throw new Error(`Rules: expected example work item ${id} in PROJECT.workItems — see src/data/project.ts.`)
  }
  return item
}

const EXAMPLE = findExampleItem('wi-em-0711')

/** A prose section. `max-w-[68ch]` on the paragraphs, not the container, so a
 *  heading and a full-width panel can still break out of the measure. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 text-h2">{title}</h2>
      <div className="flex max-w-[68ch] flex-col gap-3 text-foreground-secondary">{children}</div>
    </section>
  )
}

export default function Rules() {
  return (
    <>
      <PageHeader title="Як версіонуються вимоги до доказів" meta={PROJECT.name} />

      <div className="mb-6 flex max-w-[68ch] flex-col gap-3 text-foreground-secondary">
        <p>
          Ця сторінка пояснює задум версіонування вимог до доказів — навіщо воно потрібне і як має працювати, — а не
          показує живий інструмент.
        </p>
        <p>
          Редактор правил не є частиною цієї демонстрації. Ця демонстрація також не має рушія правил: показані нижче
          вимоги — статичні дані без версійної прив’язки.
        </p>
      </div>

      <Section title="Навіщо потрібні версії">
        <p>
          Вимоги до доказів змінюються: з’являється новий норматив, підрядник домовляється про додатковий протокол,
          виявляється прогалина за наслідками інциденту. Якщо просто редагувати правила «на місці», вже подані пакети
          заднім числом опиняться під іншими вимогами, ніж ті, за якими їх фактично приймали. Версії існують, щоб цього
          не відбувалося.
        </p>
      </Section>

      <Section title="Як з’являється нова версія">
        <p>
          Зміни до правил спершу існують як чернетка і не впливають на жоден рядок робіт. Публікація чернетки створює
          нову, незмінну версію: із моменту публікації вона стає чинною для нових вимог, а сама чернетка, з якої вона
          виникла, більше не редагується. Попередня версія нікуди не зникає — вона залишається тим, проти чого вже
          оцінені рядки були прийняті.
        </p>
      </Section>

      <Section title="Чому подані пакети не перераховуються">
        <p>
          У системі з рушієм правил кожна вимога до доказів, яку фіксує майстер на об’єкті, зберігала б версію правил, з
          якої вона виникла. Нова версія діяла б лише для нових вимог — і не переписувала б заднім числом ті, що вже
          прикріплені до рядків робіт чи поданих пакетів. Це і є задум історичної ізоляції: пакет, поданий за старою
          версією, мав би залишатися читабельним і стабільним, навіть коли правила згодом зміняться.
        </p>
      </Section>

      <section aria-label="Приклад із реєстру">
        <h2 className="mb-2 text-h2">Приклад із реєстру</h2>
        <p className="mb-4 max-w-[68ch] text-foreground-secondary">
          Рядок <b className="font-semibold text-foreground">{EXAMPLE.code}</b> · {EXAMPLE.title} має нижченаведений
          перелік вимог до доказів. У системі з версіями кожна вимога в такому переліку додатково мала б посилання на
          версію правил, з якої вона виникла:
        </p>

        {/*
         * The same RequirementList the evidence route renders. It is the point
         * of the example that this is the real shipped component over the real
         * shipped data — a bespoke bullet list here would let the page drift
         * away from what /app/evidence actually shows. It carries each record's
         * capture date itself, so the separate «— зафіксовано …» list that used
         * to sit under this panel is gone rather than restating it.
         *
         * Capped to the same 68ch as the prose: a full-width panel under a
         * 640px column of text reads as a different page breaking in.
         */}
        <Panel className="mb-4 max-w-[68ch] p-4">
          <RequirementList requirements={EXAMPLE.requirements} />
        </Panel>

        <p className="max-w-[68ch] text-foreground-secondary">
          У цій демонстрації ці записи не мають версії правил — лише мітку часу фіксації.
        </p>
      </section>
    </>
  )
}
