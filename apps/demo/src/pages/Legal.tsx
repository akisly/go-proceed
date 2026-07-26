import { Link, Navigate, useParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { formatDateUk } from '../domain/format'
import { TODAY } from '../data/project'

/**
 * ============================================================================
 * LAUNCH BLOCKER — {{CONTACT_EMAIL}} IS A PLACEHOLDER, NOT A REAL ADDRESS.
 * ============================================================================
 * No monitored mailbox has been authorised for this deployment yet. Every
 * occurrence of the token below (rendered as visible text on /legal/privacy)
 * MUST be replaced with a real, monitored address before this site is
 * published. Do not invent a plausible-looking one and do not reuse a
 * personal address as a stand-in — a deletion request sent to an
 * unmonitored placeholder would simply go nowhere. The site must not go
 * live with this token unreplaced.
 */
const CONTACT_EMAIL = '{{CONTACT_EMAIL}}'

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
        Форма на сторінці /pilot запитує назву компанії, контактну електронну пошту та кілька відповідей у вільній
        формі — про те, як зараз на об’єкті збирають фото й обсяги виконаних робіт і готують акти до закриття
        періоду. Це все, що форма запитує.
      </p>

      <h2>Чернетка у вашому браузері</h2>
      <p>
        Поки ви заповнюєте форму, введені відповіді автоматично зберігаються в локальному сховищі вашого браузера
        (localStorage) під ключем <code>{DRAFT_STORAGE_KEY}</code>. Це потрібно, щоб випадкове оновлення сторінки
        чи закриття вкладки не знищило вже написану відповідь. Ця чернетка лишається лише на вашому пристрої —
        сама по собі вона нікуди не надсилається — і видаляється автоматично одразу після успішного надсилання
        форми.
      </p>

      <h2>Куди йде надіслана форма і як довго вона зберігається</h2>
      <p>
        У цієї демонстрації немає власного сервера чи бази даних, тому надісланим даним нема де «зберігатися» на
        нашому боці. Кнопка надсилання формує лист, уже заповнений вашими відповідями, і відкриває його у вашій
        власній поштовій програмі — адресований на <code>{CONTACT_EMAIL}</code>. Лист існує лише тоді, коли ви
        самі натиснете «Надіслати» у своєму поштовому клієнті: до цього моменту нічого не передається жодному
        серверу цього проєкту. Тому термін зберігання визначаємо не ми: після відправлення лист живе так само, як
        і будь-який інший e-mail, — у вашій надісланій пошті та у скриньці <code>{CONTACT_EMAIL}</code>, за
        звичайними правилами вашого й нашого поштового сервісу, а не за окремою політикою цього сайту.
      </p>

      <h2>Як попросити видалення</h2>
      <p>
        Щоб попросити видалити надісланий лист, напишіть на <code>{CONTACT_EMAIL}</code>. Якщо ви отримали
        посилання на цю демонстрацію в листі від нас, найпростіше — відповісти просто на той самий лист.
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
