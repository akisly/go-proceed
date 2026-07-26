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
    <>
      <h1>Як версіонуються вимоги до доказів</h1>
      <p>
        Кожна вимога до доказів, яку ви бачите на сторінках «Роботи» та «Докази», не з’явилася сама собою — вона
        згенерована з чинної версії правил для відповідного виду робіт. Ця сторінка пояснює, як це влаштовано.
        Редактор правил не є частиною цієї демонстрації: нижче — лише пояснення механізму та приклад із реєстру.
      </p>

      <h2>Навіщо потрібні версії</h2>
      <p>
        Вимоги до доказів змінюються: зʼявляється новий норматив, підрядник домовляється про додатковий протокол,
        виявляється прогалина за наслідками інциденту. Якщо просто редагувати правила «на місці», вже подані пакети
        задним числом опиняться під іншими вимогами, ніж ті, за якими їх фактично приймали. Версії існують, щоб цього
        не відбувалося.
      </p>

      <h2>Як зʼявляється нова версія</h2>
      <p>
        Зміни до правил спершу існують як чернетка і не впливають на жоден рядок робіт. Публікація чернетки створює
        нову, незмінну версію: із моменту публікації вона стає чинною для нових вимог, а сама чернетка, з якої вона
        виникла, більше не редагується. Попередня версія нікуди не зникає — вона залишається тим, проти чого вже
        оцінені рядки були прийняті.
      </p>

      <h2>Чому подані пакети не перераховуються</h2>
      <p>
        Кожна вимога до доказів, яку фіксує майстер на обʼєкті, зберігає версію правил, з якої вона виникла. Коли
        зʼявляється нова версія, вона діє для нових вимог — і не переписує заднім числом вимоги, що вже прикріплені до
        рядків робіт чи поданих пакетів. Це і є історична ізоляція: пакет, який пройшов подання за старою версією,
        залишається читабельним і стабільним, навіть коли правила згодом зміняться.
      </p>

      <h2>Приклад із реєстру</h2>
      <p>
        Рядок <b>{EXAMPLE.code}</b> · {EXAMPLE.title} має такі вимоги, згенеровані з чинної на момент фіксації версії
        правил для цього виду робіт:
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
      <p>Якщо згодом з’явиться нова версія правил для цього виду робіт, ці вимоги для {EXAMPLE.code} не зміняться.</p>
    </>
  )
}
