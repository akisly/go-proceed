import { Link, Navigate, useParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { formatDateUk } from '../domain/format'
import { TODAY } from '../data/project'
import { FIELD_LABEL, FIELDS, REQUIRED_FIELDS } from '../pilot/draft'

/**
 * ============================================================================
 * LAUNCH BLOCKER — TWO PLACEHOLDER TOKENS BELOW, NEITHER IS A REAL VALUE.
 * ============================================================================
 * Neither a monitored mailbox nor a form-processing service has been
 * authorised for this deployment yet. Every occurrence of BOTH tokens below
 * (rendered as visible text on /legal/privacy) MUST, before this site is
 * published, either be replaced with a real value or have the sentence
 * containing it removed:
 *
 * - {{CONTACT_EMAIL}} — do not invent a plausible-looking address and do
 *   not reuse a personal address as a stand-in. A deletion request sent to
 *   an unmonitored placeholder would simply go nowhere.
 * - {{FORM_PROCESSOR}} — the third-party form-handling service (see
 *   `PILOT_ENDPOINT` / `VITE_PILOT_ENDPOINT` in src/pages/Pilot.tsx) that
 *   receives submitted field values IF one is ever configured for this
 *   build. Naming the wrong service, or leaving this unreplaced while an
 *   endpoint is live, would misdescribe who actually receives the data —
 *   exactly the failure this disclosure exists to prevent.
 *
 * The site must not go live with either token unreplaced.
 */
const CONTACT_EMAIL = '{{CONTACT_EMAIL}}'
const FORM_PROCESSOR = '{{FORM_PROCESSOR}}'

/**
 * The exact localStorage key Task 13's `apps/demo/src/pilot/draft.ts` writes
 * to (`DRAFT_KEY = 'aktflow.pilot.draft'`). This page and that module must
 * never disagree on the literal string — this is the D4 disclosure the
 * task brief calls out by name, so it is spelled out once here rather than
 * paraphrased.
 */
const DRAFT_STORAGE_KEY = 'aktflow.pilot.draft'

function PrivacyDocument() {
  return (
    <main className="legal-doc">
      <h1>Конфіденційність</h1>
      <p className="legal-doc__updated">
        Востаннє оновлено: <time dateTime={TODAY}>{formatDateUk(TODAY)}</time>
      </p>

      <p>
        Це демонстраційний прототип, а не робочий продукт: без реєстрації, без бекенду, без бази даних. Цей текст
        описує, що саме відбувається з вашими даними в межах цієї конкретної демонстрації — і не більше. Він не є
        юридичною консультацією, не замінює договір, і його не перевіряв юрист. Ми не стверджуємо відповідність
        GDPR, Закону України «Про захист персональних даних» чи будь-якому іншому регламенту та не проходили
        жодного аудиту чи сертифікації.
      </p>

      <h2>Що збирає форма /pilot</h2>
      <p>
        Форма на сторінці /pilot має дев’ять полів. Обов’язкові лише перші два — «{FIELD_LABEL.company}» і
        «{FIELD_LABEL.email}»; решта необов’язкові.
      </p>
      <ul>
        {FIELDS.map(field => (
          <li key={field}>
            {FIELD_LABEL[field]}
            {REQUIRED_FIELDS.has(field) ? ' — обов’язково' : ''}
          </li>
        ))}
      </ul>
      <p>Це все, що форма запитує.</p>

      <h2>Чернетка у вашому браузері</h2>
      <p>
        Поки ви заповнюєте форму, введені відповіді автоматично зберігаються в локальному сховищі вашого браузера
        (localStorage) під ключем <code>{DRAFT_STORAGE_KEY}</code>. Це потрібно, щоб випадкове оновлення сторінки
        чи закриття вкладки не знищило вже написану відповідь. Ця чернетка лишається лише на вашому пристрої —
        сама по собі вона нікуди не надсилається.
      </p>
      <p>
        Сайт видаляє чернетку автоматично лише тоді, коли форму справді прийнято сервером (сервіс обробки форм
        налаштовано і надсилання пройшло успішно) — сьогодні для цього розгортання такого сервісу не налаштовано,
        тож цей випадок не діє. Сьогоднішній шлях надсилання — лист у вашій поштовій програмі — сторінка /pilot не
        може перевірити, чи ви справді натиснули «Надіслати» у своєму поштовому клієнті, тому вона не видаляє
        чернетку автоматично на цьому шляху. Чернетка лишається в цьому браузері, доки ви самі не натиснете
        «Видалити чернетку» на сторінці /pilot.
      </p>
      <p>
        Це звичайний localStorage браузера — без шифрування і без окремого захисту. Прочитати цю чернетку може
        будь-хто чи будь-яка програма з доступом до цього профілю браузера на цьому пристрої, зокрема на спільному
        або робочому комп’ютері.
      </p>

      <h2>Куди йде надіслана форма</h2>
      <p>
        У цієї демонстрації немає власного сервера чи бази даних — сама вона нічого не «зберігає». Що саме
        відбувається з вашими відповідями після натискання кнопки надсилання, залежить від того, чи для цього
        розгортання налаштовано сторонній сервіс обробки форм. Нижче — усі три можливі стани; лише один із них
        діє зараз.
      </p>
      <ul>
        <li>
          <strong>Сьогодні — сервіс обробки форм не налаштовано.</strong> Кнопка надсилання не звертається до
          жодного сервера. Вона готує лист, уже заповнений усіма дев’ятьма вашими відповідями, і показує посилання
          «Відкрити лист» — натиснувши його, ви відкриваєте цей лист у своїй власній поштовій програмі, адресований
          на <code>{CONTACT_EMAIL}</code>. Лист існує лише тоді, коли ви самі натиснете «Надіслати» у своєму
          поштовому клієнті: до цього моменту сам сайт нічого нікуди не передає. Чернетка при цьому не
          видаляється автоматично — щоб прибрати її з цього браузера, натисніть «Видалити чернетку» на сторінці
          /pilot.
        </li>
        <li>
          <strong>Якщо сервіс обробки форм налаштовано (<code>{FORM_PROCESSOR}</code>) і надсилання пройшло
          успішно.</strong> Усі дев’ять значень полів форми передаються цьому сторонньому сервісу — з цього
          моменту саме <code>{FORM_PROCESSOR}</code> отримує та обробляє ці дані від нашого імені (виступає
          обробником для цього надсилання), а не ми. Термін і умови зберігання визначає цей сторонній сервіс за
          власною політикою, а не цей сайт. Локальна чернетка одразу видаляється.
        </li>
        <li>
          <strong>Якщо сервіс обробки форм налаштовано, але надсилання не вдалося.</strong> Дані до стороннього
          сервісу не доходять. Форма пропонує той самий попередньо заповнений лист на{' '}
          <code>{CONTACT_EMAIL}</code>, а локальна чернетка не видаляється, доки надсилання не вдасться.
        </li>
      </ul>

      <h2>Як попросити видалення</h2>
      <p>
        Якщо форма пішла листом (це сьогоднішня поведінка) — прохання про видалення означає прохання видалити
        конкретний лист зі скриньки одержувача, а не запис у базі даних: такої бази тут немає. Напишіть на{' '}
        <code>{CONTACT_EMAIL}</code> з проханням видалити лист. Якщо ви отримали посилання на цю демонстрацію в
        листі від нас, найпростіше — відповісти просто на той самий лист.
      </p>
      <p>
        Якщо ж форма пройшла через сервіс обробки форм (<code>{FORM_PROCESSOR}</code>), запис про це надсилання
        існує в тому сторонньому сервісі, а не в нас: напишіть на <code>{CONTACT_EMAIL}</code>, і ми передамо
        ваше прохання про видалення до <code>{FORM_PROCESSOR}</code>.
      </p>

      <h2>Аналітика й стеження</h2>
      <div className="privacy-line">
        <ShieldCheck size={18} aria-hidden="true" />
        Ця сторінка нічого не відстежує.
      </div>
      <p>
        Немає аналітики, немає піксельних трекерів, немає запису сеансів, сайт не встановлює власних cookies і не
        завантажує жодних сторонніх скриптів.
      </p>

      <h2>Застосовне законодавство</h2>
      <p>
        Орієнтиром для обробки персональних даних в Україні є Закон України «Про захист персональних даних». Це
        посилання на застосовний закон, а не заява про відповідність йому.
      </p>

      <Link to="/" className="button button--outline">
        На головну
      </Link>
    </main>
  )
}

function TermsDocument() {
  return (
    <main className="legal-doc">
      <h1>Умови користування</h1>
      <p className="legal-doc__updated">
        Востаннє оновлено: <time dateTime={TODAY}>{formatDateUk(TODAY)}</time>
      </p>

      <p>
        Це демонстраційний прототип, а не чинний сервіс. Умови нижче навмисно короткі: очікувати від демонстрації
        розгорнутого договору саме по собі було б перебільшенням її статусу.
      </p>

      <ul>
        <li>Немає жодних зобов’язань щодо доступності чи безперебійної роботи — без SLA, без гарантій uptime.</li>
        <li>Немає обов’язку підтримки чи технічної допомоги.</li>
        <li>
          Це не договір і не оферта: перегляд сторінки чи заповнення форми не створює жодних договірних відносин.
        </li>
        <li>Сторінку можна змінити чи зняти в будь-який момент без попередження.</li>
        <li>Демонстрація надається «як є», без будь-яких гарантій придатності для певної мети.</li>
      </ul>

      <p>Цей текст не є юридичною консультацією і не перевірений юристом.</p>

      <Link to="/" className="button button--outline">
        На головну
      </Link>
    </main>
  )
}

/**
 * Two documents behind /legal/:document (spec A.3.5, decision D4's
 * disclosure). qa/routes.mjs's SHIPPED_ROUTES lists exactly two live paths
 * here — /legal/privacy and /legal/terms — so any other :document value
 * (a typo, a stale bookmark, a crawler probing /legal/cookie-policy) must
 * not render a blank page. Redirected to /legal/privacy rather than routed
 * through App.tsx's top-level catch-all: that catch-all only matches
 * unregistered top-level paths (`*`), and /legal/:document already matches
 * the route itself for any second segment, so App.tsx's `*` route would
 * never see an unknown /legal/* value — this component is the only place
 * that can catch it. Redirecting (not silently rendering privacy content
 * under the wrong URL) mirrors App.tsx's own pattern of sending unknown
 * paths somewhere real rather than leaving the address bar and the content
 * disagreeing with each other.
 */
export default function Legal() {
  // Destructured as `slug`, not `document` — the latter would shadow the
  // browser global of the same name for no benefit.
  const { document: slug } = useParams()

  if (slug === 'terms') return <TermsDocument />
  if (slug === 'privacy') return <PrivacyDocument />
  return <Navigate to="/legal/privacy" replace />
}
