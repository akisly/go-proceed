import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Mail } from 'lucide-react'
import { clearDraft, draftAsPlainText, FIELD_LABEL, loadDraft, saveDraft, submitPilotDraft, type PilotDraft } from '../pilot/draft'
import InlineBanner from '../components/InlineBanner'

/**
 * Task 13 — /pilot, the only structured capture surface in this deployment
 * (spec A.4.10/A.4.11, decision D4). The three free-text answers below
 * (`capture`, `storage`, `returnReason`) are the single most valuable
 * output of the whole discovery effort, so this page is built around never
 * losing them — see src/pilot/draft.ts for the persistence and submission
 * logic this component only orchestrates.
 *
 * RULING 4 (task 13 controller ruling): this is asynchronous qualification
 * by design, not a sales page — no call booking, no calendar embed, no
 * scheduling link, no phone number, no pricing, no "book a demo". Nine
 * fields, only Компанія and Email required, real <label htmlFor> on every
 * one (placeholder-as-label is prohibited).
 */

/**
 * ============================================================================
 * LAUNCH BLOCKER — {{CONTACT_EMAIL}} IS A PLACEHOLDER, NOT A REAL ADDRESS.
 * ============================================================================
 * Same token, same rule as src/pages/Legal.tsx: no monitored mailbox has
 * been authorised for this deployment yet. Every occurrence below MUST be
 * replaced with a real, monitored address before this site is published —
 * this is where the mailto fallback (RULING 1) and the success receipt's
 * deletion-request instructions (RULING 4) both point.
 */
const CONTACT_EMAIL = '{{CONTACT_EMAIL}}'

/**
 * RULING 1 (task 13 controller ruling) — `VITE_PILOT_ENDPOINT` is not
 * provisioned for this deployment; no backend exists yet to receive a POST
 * (the approved spec lists it as a launch-blocking dependency). Read once
 * here, at module scope, so there is exactly one place a reader checks to
 * see which submission path is live: an empty string in .env.local (or the
 * variable absent entirely, Vite's normal default) means `PILOT_ENDPOINT`
 * is `undefined` below, `submitPilotDraft` (src/pilot/draft.ts) short-circuits
 * to the 'mailto' outcome without ever calling `fetch`, and the mailto path
 * is what actually ships today. Setting `VITE_PILOT_ENDPOINT` to a real URL
 * in the build environment is the ONLY change needed to switch this page
 * over to POSTing — nothing here needs to change.
 */
const PILOT_ENDPOINT: string | undefined = import.meta.env.VITE_PILOT_ENDPOINT

const EMPTY_DRAFT: PilotDraft = {
  company: '',
  email: '',
  specialisation: '',
  siteCount: '',
  capture: '',
  storage: '',
  returnReason: '',
  closingTime: '',
  willingToShare: '',
}

const SPECIALISATION_OPTIONS = [
  { value: '', label: 'Оберіть спеціалізацію' },
  { value: 'electrical', label: 'Електромонтажні роботи' },
  { value: 'hvac', label: 'ОВіК / HVAC' },
  { value: 'plumbing', label: 'Водопостачання' },
  { value: 'low_current', label: 'Слабкострумові системи' },
  { value: 'general', label: 'Генпідряд' },
  { value: 'other', label: 'Інше' },
] as const

const SITE_COUNT_OPTIONS = [
  { value: '', label: 'Оберіть кількість' },
  { value: '1', label: '1' },
  { value: '2-5', label: '2–5' },
  { value: '6-15', label: '6–15' },
  { value: '16+', label: '16+' },
] as const

const CLOSING_TIME_OPTIONS = [
  { value: '', label: 'Оберіть орієнтовний час' },
  { value: '1-2', label: '1–2 дні' },
  { value: '3-7', label: '3–7 днів' },
  { value: '8-14', label: '8–14 днів' },
  { value: '15+', label: '15+ днів' },
] as const

const WILLING_TO_SHARE_OPTIONS = [
  { value: '', label: 'Оберіть відповідь' },
  { value: 'yes', label: 'Так' },
  { value: 'no', label: 'Ні' },
] as const

type SubmitState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'submitting' }
  | { readonly phase: 'sent' }
  | { readonly phase: 'mailto'; readonly mailto: string }
  | { readonly phase: 'error'; readonly mailto: string }

export default function Pilot() {
  // Restore-on-mount (brief step 5) as a lazy initializer rather than an
  // effect that calls setState: parseDraft never throws and loadDraft
  // (RULING 3) never throws either, so this is safe even if localStorage is
  // corrupt or the browser denies access outright — it can run directly
  // during the first render with nothing to guard.
  //
  // Fix round: reads storage exactly once. The previous version called
  // `loadDraft()` from two independent `useState` initialisers (one for
  // `draft`, one for `restored`) — harmless in practice since loadDraft is
  // idempotent, but two reads to derive two values from the same read is
  // needless duplication. `initial` is itself a stable `useState` value
  // (never updated via its own setter), so `initial.restored` stays correct
  // for the component's lifetime without needing a second state atom.
  const [initial] = useState<{ draft: PilotDraft; restored: boolean }>(() => {
    const existing = loadDraft()
    return { draft: existing ?? EMPTY_DRAFT, restored: existing !== null }
  })
  // Review 07 · I3: transient result of the copy-to-clipboard fallback.
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [draft, setDraft] = useState<PilotDraft>(initial.draft)
  // Fix round (final review, finding C2) — was `const restored = initial.restored`,
  // a value fixed for the component's whole lifetime. Now stateful so
  // `handleDeleteDraft` below can turn the "Чернетку відновлено" notice off
  // the moment the visitor actually deletes that restored draft — otherwise
  // the page would keep claiming a draft was restored after the visitor had
  // just removed it.
  const [restored, setRestored] = useState<boolean>(initial.restored)
  const [submitState, setSubmitState] = useState<SubmitState>({ phase: 'idle' })
  // Captured once, from the very first render's `draft` value (restored or
  // empty) — React ignores the argument on every render after the first, so
  // this reference never changes for the lifetime of the component.
  const initialDraftRef = useRef<PilotDraft>(draft)
  // Fix round: focus target for the error/mailto banners. Only one of the
  // two is ever mounted at a time (mutually exclusive phases), so one ref
  // shared across both JSX blocks is enough.
  const bannerRef = useRef<HTMLDivElement>(null)

  // Debounced autosave, 500ms after the last change. Compares by reference
  // rather than a "have we run once yet" flag: `setDraft` only ever
  // produces a new object from `updateField` (a real edit), so `draft`
  // stays referentially equal to `initialDraftRef.current` until the
  // visitor actually types something. A mutable "first run" flag looks
  // equivalent but is not — React StrictMode intentionally mounts, cleans
  // up, and re-runs every effect once in development specifically to catch
  // that kind of one-shot assumption, and it did here: an earlier version
  // of this guard let the second invocation fall through and write an
  // untouched empty draft to storage, which made the very next page load
  // falsely claim "чернетку відновлено" for a visitor who had typed
  // nothing. Reference equality gives the same one-time skip without
  // depending on effect invocation count at all.
  useEffect(() => {
    if (draft === initialDraftRef.current) return
    const timer = window.setTimeout(() => saveDraft(draft), 500)
    return () => window.clearTimeout(timer)
  }, [draft])

  /**
   * Fix round, item 3 — a nine-field form means the submit button sits far
   * below the fold; without this, clicking it produced no visible change
   * for a sighted keyboard user (the banner rendered off-screen, above the
   * scroll position) and no announcement at all for a screen-reader user
   * (focus stayed on the submit button). Chosen: move focus to the banner
   * (`tabIndex={-1}` + `.focus()`) rather than a bare `scrollIntoView`,
   * because focusing an off-screen element also scrolls it into view in
   * every evergreen browser — one mechanism covers both the sighted-user
   * and the screen-reader-announcement half of the problem, where
   * `scrollIntoView` alone would only fix the former.
   */
  useEffect(() => {
    if (submitState.phase === 'error' || submitState.phase === 'mailto') {
      bannerRef.current?.focus()
    }
  }, [submitState.phase])

  function updateField(field: keyof PilotDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { value } = event.target
      setDraft(current => ({ ...current, [field]: value }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Only show "Надсилаю…" while an actual network request is in flight —
    // the mailto path below is synchronous from the visitor's perspective,
    // so it does not need (and should not flash) a pending state.
    const hasEndpoint = typeof PILOT_ENDPOINT === 'string' && PILOT_ENDPOINT.trim().length > 0
    if (hasEndpoint) setSubmitState({ phase: 'submitting' })

    const result = await submitPilotDraft(draft, {
      endpoint: PILOT_ENDPOINT,
      contactEmail: CONTACT_EMAIL,
      fetchImpl: fetch,
    })

    if (result.kind === 'sent') {
      // Only a genuinely successful submission clears the draft (RULING 3).
      clearDraft()
      setSubmitState({ phase: 'sent' })
      return
    }
    if (result.kind === 'mailto') {
      // Deliberately NOT `window.location.href = result.mailto` here: a
      // programmatic redirect to a non-http(s) scheme is handled
      // inconsistently across browsers — confirmed live in this repo's own
      // preview during task 13 verification, where it triggered a full page
      // reload instead of just spawning the external mail client, wiping
      // in-memory state (though the draft itself survived, since it was
      // already durable in localStorage — see RULING 3). Rendering the
      // mailto link for the visitor to click themselves sidesteps that
      // entirely and needs no browser-specific handling.
      setSubmitState({ phase: 'mailto', mailto: result.mailto })
      return
    }
    setSubmitState({ phase: 'error', mailto: result.mailto })
  }

  /**
   * Fix round (final review, finding C2) — `clearDraft()` previously had
   * exactly one call site, inside `result.kind === 'sent'` above, which is
   * only reachable when `VITE_PILOT_ENDPOINT` is configured. With no
   * endpoint (today's deployment), the outcome is always 'mailto' and the
   * draft persisted indefinitely with no way for the visitor to remove it —
   * while both this page and /legal/privacy claimed it would be deleted.
   * This is the visitor's own real control over that: it clears storage,
   * resets the in-memory form back to empty, and turns off the "restored"
   * notice, so the page state matches what actually happened. `EMPTY_DRAFT`
   * is reused (not a fresh `{ ...EMPTY_DRAFT }`) so `initialDraftRef.current`
   * and the new `draft` are the same object reference — the debounced
   * autosave effect above compares by reference and skips saving when they
   * match, which is what stops it from silently writing an empty draft
   * straight back into storage a moment after this runs.
   */
  /*
   * Review 07 · I3. The mailto link stays the primary route; this is the escape
   * hatch for a machine where it silently does nothing — webmail-only corporate
   * desktops, where «Відкрити лист» produces no window and no error, and the
   * visitor's ten minutes of answers die on the device.
   *
   * navigator.clipboard rejects on insecure origins and on denied permission,
   * so failure is caught and reported in Ukrainian rather than thrown. The
   * mailto path is untouched on either branch.
   */
  async function handleCopyAnswers() {
    try {
      await navigator.clipboard.writeText(draftAsPlainText(draft))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  function handleDeleteDraft() {
    clearDraft()
    setDraft(EMPTY_DRAFT)
    initialDraftRef.current = EMPTY_DRAFT
    setRestored(false)
    setSubmitState({ phase: 'idle' })
  }

  if (submitState.phase === 'sent') {
    return (
      <div className="pilot-page pilot-page--success">
        <header>
          <Link className="brand" to="/" aria-label="AktFlow — головна">
            <span className="brand__mark">
              <span />
            </span>
            <span>AktFlow</span>
          </Link>
        </header>
        <main className="pilot-success">
          <span className="success-mark synced">
            <Check size={38} aria-hidden="true" />
          </span>
          <h1>Дякуємо. Відповіді отримано.</h1>
          <p>
            Ми отримали назву компанії, контактний email і ваші відповіді про те, як зараз влаштовано фіксування
            фото й обсягів, зберігання файлів та підготовку закриття періоду.
          </p>
          <p>Прочитаю це особисто і відповім протягом 2 робочих днів на вказаний email. — Олександр</p>
          <p>
            Щоб попросити видалення надісланих відповідей, напишіть на <code>{CONTACT_EMAIL}</code>.
          </p>
          <Link className="button button--outline" to="/">
            На головну
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="pilot-page">
      <header>
        <Link className="brand" to="/" aria-label="AktFlow — головна">
          <span className="brand__mark">
            <span />
          </span>
          <span>AktFlow</span>
        </Link>
        <Link to="/">
          <ArrowLeft size={16} aria-hidden="true" /> На головну
        </Link>
      </header>
      <main>
        <form className="pilot-form" onSubmit={handleSubmit}>
          <div>
            <h1>Розкажіть, як у вас влаштовано закриття періоду</h1>
            <p>
              Це не форма реєстрації в продукт — кілька запитань про ваш поточний процес, щоб зрозуміти, чи підійде
              AktFlow вашим об’єктам. Обов’язкові лише «Компанія» і «Email»; решта — за бажанням, і чим детальніше
              ви опишете свій процес, тим краще я його зрозумію.
            </p>
            {/*
              Review 07 · I2. The form asks for about ten minutes of detail about
              a company's internal process, and the only thing offered in return
              — «Прочитаю це особисто і напишу у відповідь» — sat on the SUCCESS
              screen, visible only after the work was already done. At the moment
              the visitor decides whether to start typing there was no time
              estimate, no name and no statement of what comes back.
              Founder-confirmed values: signature «Олександр», commitment
              «Відповім протягом 2 робочих днів.»
            */}
            <p className="pilot-page__promise">
              Це займе близько 10 хвилин. Я прочитаю відповіді особисто — не бот і не відділ продажів — і відповім
              протягом 2 робочих днів на вказаний email. Дзвонити не буду.
              <br />
              <span>— Олександр, автор AktFlow</span>
            </p>
          </div>

          {restored && (
            // Fix round item 3: role="status" so a screen-reader user is
            // told the draft came back, consistent with the submit-outcome
            // banners below (role="alert"/role="status").
            <p className="privacy-line" role="status">
              <Check size={16} aria-hidden="true" />
              Чернетку відновлено з попереднього разу — можете продовжити зі свого місця.
            </p>
          )}

          {/* RULING 5: a persistent inline banner, never a toast — stays until
              resolved, never auto-dismisses, never clears the visitor's input.
              Task 14: refactored onto the shared InlineBanner component
              (src/components/InlineBanner.tsx) — a clean drop-in here, since
              it forwards `ref` to the exact same `<div>` the focus effect
              above already targets, and reproduces `tabIndex={-1}` plus the
              `state-banner`/`state-banner--warning` classes and `role="alert"`
              byte-for-byte. The draft itself is untouched by this refactor —
              nothing here calls clearDraft/saveDraft, so preservation on the
              error path is unaffected. */}
          {submitState.phase === 'error' && (
            <InlineBanner ref={bannerRef} tone="warning" role="alert" icon={<AlertTriangle size={20} aria-hidden="true" />}>
              <b>Не вдалося надіслати автоматично</b>
              <span>
                Ваші відповіді нікуди не зникли — вони й далі збережені у цьому браузері. Спробуйте ще раз або{' '}
                <a href={submitState.mailto}>надішліть їх листом</a>.
              </span>
            </InlineBanner>
          )}

          {/* RULING 1: no endpoint is provisioned yet, so this is the normal,
              intended submission route today — not an error banner. Same
              InlineBanner drop-in as above, role="status" preserved.
              Fix round (final review, finding C2): copy corrected — the page
              cannot detect whether the visitor actually pressed "Надіслати"
              in their own mail client, so it no longer claims the draft is
              kept only "until the letter is sent". It now says what is
              actually true (kept until the visitor removes it themselves)
              and gives them the means to do that right here, next to the
              link that opens their mail client — the exact place someone
              who has just done that will see it. */}
          {submitState.phase === 'mailto' && (
            <InlineBanner ref={bannerRef} tone="success" role="status" icon={<Mail size={20} aria-hidden="true" />}>
              <b>Лист із вашими відповідями готовий</b>
              <span>
                Натисніть «Відкрити лист», перевірте текст і надішліть його зі своєї поштової програми — до цього
                моменту нічого не передається нікуди. Сайт не може перевірити, чи ви справді натиснули «Надіслати» у
                своєму поштовому клієнті, тож відповіді лишаються в цьому браузері, доки ви самі не видалите
                чернетку кнопкою нижче.
                <br />
                <a className="button button--outline button--small" href={submitState.mailto}>
                  Відкрити лист
                </a>{' '}
                <button type="button" className="button button--outline button--small" onClick={handleCopyAnswers}>
                  Скопіювати відповіді
                </button>{' '}
                <button type="button" className="button button--outline button--small" onClick={handleDeleteDraft}>
                  Видалити чернетку
                </button>
                {copyState !== 'idle' && (
                  <span role="status" className="privacy-line">
                    {copyState === 'copied'
                      ? 'Відповіді скопійовано — можна вставити їх у будь-який лист.'
                      : 'Не вдалося скопіювати автоматично. Виділіть текст листа вручну та скопіюйте його.'}
                  </span>
                )}
              </span>
            </InlineBanner>
          )}

          <label htmlFor="pilot-company">
            {FIELD_LABEL.company} *
            <input
              id="pilot-company"
              name="company"
              required
              maxLength={180}
              value={draft.company}
              onChange={updateField('company')}
            />
          </label>

          <label htmlFor="pilot-email">
            {FIELD_LABEL.email} *
            <input
              id="pilot-email"
              name="email"
              type="email"
              required
              maxLength={254}
              value={draft.email}
              onChange={updateField('email')}
            />
          </label>

          <div className="field-pair">
            <label htmlFor="pilot-specialisation">
              {FIELD_LABEL.specialisation}
              <select
                id="pilot-specialisation"
                name="specialisation"
                value={draft.specialisation}
                onChange={updateField('specialisation')}
              >
                {SPECIALISATION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="pilot-site-count">
              {FIELD_LABEL.siteCount}
              <select id="pilot-site-count" name="siteCount" value={draft.siteCount} onChange={updateField('siteCount')}>
                {SITE_COUNT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* A.3.2a hierarchy (RULING 4): the core discovery question comes
              first among the three free-text answers. */}
          <label htmlFor="pilot-capture">
            {FIELD_LABEL.capture}
            <textarea
              id="pilot-capture"
              name="capture"
              maxLength={2000}
              value={draft.capture}
              onChange={updateField('capture')}
            />
            <small>Хто знімає, куди складає, як ці дані потім потрапляють у акт.</small>
          </label>

          <label htmlFor="pilot-storage">
            {FIELD_LABEL.storage}
            <textarea
              id="pilot-storage"
              name="storage"
              maxLength={2000}
              value={draft.storage}
              onChange={updateField('storage')}
            />
          </label>

          <label htmlFor="pilot-return-reason">
            {FIELD_LABEL.returnReason}
            <textarea
              id="pilot-return-reason"
              name="returnReason"
              maxLength={2000}
              value={draft.returnReason}
              onChange={updateField('returnReason')}
            />
          </label>

          <div className="field-pair">
            <label htmlFor="pilot-closing-time">
              {FIELD_LABEL.closingTime}
              <select
                id="pilot-closing-time"
                name="closingTime"
                value={draft.closingTime}
                onChange={updateField('closingTime')}
              >
                {CLOSING_TIME_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="pilot-willing-to-share">
              {FIELD_LABEL.willingToShare}
              <select
                id="pilot-willing-to-share"
                name="willingToShare"
                value={draft.willingToShare}
                onChange={updateField('willingToShare')}
              >
                {WILLING_TO_SHARE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p>
            Що станеться з цими відповідями, описано на сторінці <Link to="/legal/privacy">Конфіденційність</Link>.
          </p>

          <div className="pilot-form__actions">
            <button
              type="submit"
              className="button button--dark pilot-submit"
              disabled={submitState.phase === 'submitting'}
            >
              {submitState.phase === 'submitting' ? 'Надсилаю…' : 'Надіслати відповіді'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
