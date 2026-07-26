import { PROJECT } from '../data/project'
import { formatDateUk } from '../domain/format'
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
 * Fix round 1: the first version of this page asserted, in present tense,
 * that the requirements shown on /app/work and /app/evidence "were
 * generated from" and "store" a rule version. `Requirement`
 * (src/domain/types.ts) has no version field, and nothing under
 * src/domain or src/data models one — that was a false capability claim
 * about this codebase, not a simplification. The intro, the "why packages
 * aren't recalculated" section, and the worked example now describe the
 * mechanism in explanatory/conditional register ("у системі з рушієм
 * правил... зберігала б") instead of asserting it happened to this
 * demo's data, and a direct no-rule-engine disclaimer sits next to the
 * existing editor disclaimer.
 */

/**
 * A single worked example keeps the explanation tied to real data instead
 * of staying abstract. Written as a function (see Demo.tsx's
 * findFocusItem) so a missing id fails loudly at import time rather than
 * silently rendering an empty page — no non-null assertion needed.
 */
function findExampleItem(id: string): WorkItem {
  const item = PROJECT.workItems.find(candidate => candidate.id === id)
  if (!item) {
    throw new Error(`Rules: expected example work item ${id} in PROJECT.workItems — see src/data/project.ts.`)
  }
  return item
}

const EXAMPLE = findExampleItem('wi-em-0711')

export default function Rules() {
  return (
    <div className="rules-page">
      <h1>Як версіонуються вимоги до доказів</h1>
      <p>
        Ця сторінка пояснює задум версіонування вимог до доказів — навіщо воно потрібне і як має працювати, — а не
        показує живий інструмент.
      </p>
      <p>
        Редактор правил не є частиною цієї демонстрації. Ця демонстрація також не має рушія правил: показані нижче
        вимоги — статичні дані без версійної прив’язки.
      </p>

      <h2>Навіщо потрібні версії</h2>
      <p>
        Вимоги до доказів змінюються: з’являється новий норматив, підрядник домовляється про додатковий протокол,
        виявляється прогалина за наслідками інциденту. Якщо просто редагувати правила «на місці», вже подані пакети
        заднім числом опиняться під іншими вимогами, ніж ті, за якими їх фактично приймали. Версії існують, щоб цього
        не відбувалося.
      </p>

      <h2>Як з’являється нова версія</h2>
      <p>
        Зміни до правил спершу існують як чернетка і не впливають на жоден рядок робіт. Публікація чернетки створює
        нову, незмінну версію: із моменту публікації вона стає чинною для нових вимог, а сама чернетка, з якої вона
        виникла, більше не редагується. Попередня версія нікуди не зникає — вона залишається тим, проти чого вже
        оцінені рядки були прийняті.
      </p>

      <h2>Чому подані пакети не перераховуються</h2>
      <p>
        У системі з рушієм правил кожна вимога до доказів, яку фіксує майстер на об’єкті, зберігала б версію правил,
        з якої вона виникла. Нова версія діяла б лише для нових вимог — і не переписувала б заднім числом ті, що вже
        прикріплені до рядків робіт чи поданих пакетів. Це і є задум історичної ізоляції: пакет, поданий за старою
        версією, мав би залишатися читабельним і стабільним, навіть коли правила згодом зміняться.
      </p>

      <h2>Приклад із реєстру</h2>
      <p>
        Рядок <b>{EXAMPLE.code}</b> · {EXAMPLE.title} має нижченаведений перелік вимог до доказів. У системі з
        версіями кожна вимога в такому переліку додатково мала б посилання на версію правил, з якої вона виникла:
      </p>
      <ul>
        {EXAMPLE.requirements.map(req => (
          <li key={req.id}>
            {req.label}
            {req.capturedAt !== null && (
              <>
                {' — зафіксовано '}
                <time dateTime={req.capturedAt}>{formatDateUk(req.capturedAt)}</time>
              </>
            )}
          </li>
        ))}
      </ul>
      <p>У цій демонстрації ці записи не мають версії правил — лише мітку часу фіксації.</p>
    </div>
  )
}
