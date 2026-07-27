import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Mail } from 'lucide-react'
import {
  clearDraft,
  draftAsPlainText,
  FIELDS,
  FIELD_LABEL,
  loadDraft,
  REQUIRED_FIELDS,
  saveDraft,
  submitPilotDraft,
  type PilotDraft,
} from '../pilot/draft'
import { CONTACT_EMAIL } from '../data/contact'
import { pluralUk } from '../domain/format'
import InlineBanner from '../components/InlineBanner'
import PageHeader from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'

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
 *
 * ── THE REWRITE ──────────────────────────────────────────────────────────────
 *
 * This was the last public page still rendering the frozen sheet's
 * `.pilot-page` / `.pilot-form` markup, which meant the one surface asking a
 * stranger for ten minutes of their time looked like it belonged to a
 * different product than the landing that sent them here. It is on the design
 * system now, same as /, /demo and /roadmap.
 *
 * The nine fields are unchanged, in the unchanged order (draft.ts's `FIELDS`
 * is the source of truth for that order and A.3.2a fixes it), but they are no
 * longer one undifferentiated wall. They are four named groups, each with a
 * lead saying why it is being asked — the same move /demo's five steps got,
 * for the same reason: a reader who understands why a question is on the page
 * answers it, and a reader facing nine unexplained inputs closes the tab. The
 * leads describe THIS FORM, not the product; nothing here claims a capability.
 *
 * Every founder-confirmed sentence is carried across verbatim (the «Олександр»
 * signature, «протягом 2 робочих днів», «Дзвонити не буду»), as is every
 * behaviour below: RULING 1's mailto path, RULING 3's draft durability,
 * RULING 5's persistent banners, and Review 07's promise placement (I2) and
 * clipboard fallback (I3).
 */

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

/**
 * The header both states of this page share — the form and the success
 * receipt. Same shape as /demo's and /roadmap's (RULING 6's landmark
 * `<header>` with a way back to "/"), so all three read as one site.
 */
function PilotHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-[720px] items-center gap-4 px-5 py-3">
        <Link className="brand" to="/" aria-label="AktFlow — головна">
          <span className="brand__mark">
            <span />
          </span>
          <span>AktFlow</span>
        </Link>
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <Link to="/">
            <ArrowLeft /> На головну
          </Link>
        </Button>
      </div>
    </header>
  )
}

/**
 * One labelled field. The `<label htmlFor>` is the point (RULING 4 prohibits
 * placeholder-as-label), so this exists to make that pairing the only way to
 * add a field here rather than a convention someone has to remember — `id` is
 * required, and the label is always rendered as a real element above the
 * control, never collapsed into a placeholder.
 *
 * `required` drives BOTH the visible asterisk and the control's own attribute
 * at the call site, so the two cannot disagree about which fields are
 * mandatory.
 */
function Field({
  id,
  label,
  required = false,
  hint,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-semibold text-foreground-secondary">
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
      {/*
        `text-meta`, not a bare `<small>`. `<small>` on its own takes the user
        agent's 0.83em, which lands at 12.5px here — a size that exists nowhere
        in this product's scale (--text-micro is 11px, --text-meta is 12px) and
        is therefore the one piece of type on the page nobody chose. The
        element still carries the right semantics; only the size comes from the
        system instead of the browser.
      */}
      {hint ? <small className="text-meta text-foreground-muted">{hint}</small> : null}
    </div>
  )
}

/**
 * A named group of fields, with the reason it is being asked.
 *
 * Same editorial grammar as /demo: heading, then a lead in the reader's own
 * terms, then the artifact. The lead is what makes nine questions feel like
 * four short conversations instead of a wall of inputs.
 *
 * `<Panel as="div">`, not the default `<section>`: this component's own
 * `<section>` and `<h2>` already declare the region, so a sectioning element
 * around the inputs would add an untitled region to the document outline
 * inside every titled one. See Panel.tsx's note on `as`.
 */
function FormSection({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-h3">{title}</h2>
      <p className="mt-1 max-w-[62ch] text-foreground-secondary">{lead}</p>
      <Panel as="div" className="mt-3 flex flex-col gap-5 p-4">
        {children}
      </Panel>
    </section>
  )
}

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
  function handleDeleteDraft() {
    clearDraft()
    setDraft(EMPTY_DRAFT)
    initialDraftRef.current = EMPTY_DRAFT
    setRestored(false)
    setSubmitState({ phase: 'idle' })
  }

  if (submitState.phase === 'sent') {
    return (
      <div className="aktflow-app flex min-h-screen flex-col">
        <PilotHeader />
        <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center px-5 py-16 text-center">
          <span
            aria-hidden="true"
            className="grid size-16 place-items-center rounded-pill bg-accent text-accent-foreground"
          >
            <Check size={32} />
          </span>
          <h1 className="mt-6 text-h1">Дякуємо. Відповіді отримано.</h1>
          <p className="mt-4 max-w-[58ch] text-foreground-secondary">
            Ми отримали назву компанії, контактний email і ваші відповіді про те, як зараз влаштовано фіксування
            фото й обсягів, зберігання файлів та підготовку закриття періоду.
          </p>
          <p className="mt-3 max-w-[58ch] text-foreground-secondary">
            Прочитаю це особисто і відповім протягом 2 робочих днів на вказаний email. — Олександр
          </p>
          <p className="mt-3 max-w-[58ch] text-foreground-secondary">
            Щоб попросити видалення надісланих відповідей, напишіть на <code>{CONTACT_EMAIL}</code>.
          </p>
          <Button asChild variant="outline" className="mt-8">
            <Link to="/">На головну</Link>
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="aktflow-app flex min-h-screen flex-col">
      <PilotHeader />

      {/*
       * 720px, not the 1240px the internal app uses. A nine-field form read
       * once, top to bottom, wants a reading measure — the same reasoning
       * /demo's 900px column is built on, one notch tighter because a column
       * of inputs is narrower than a column of panels.
       */}
      <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-8">
        <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
          <div>
            <PageHeader
              title="Розкажіть, як у вас влаштовано закриття періоду"
              stat={`${FIELDS.length} ${pluralUk(FIELDS.length, 'запитання', 'запитання', 'запитань')} · обов’язкові ${REQUIRED_FIELDS.size}`}
            />
            <p className="max-w-[62ch] text-foreground-secondary">
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

              Quiet by design: it is a promise, not a sales pitch — so a tonal
              shift and a single accent rule, not a coloured callout.
            */}
            <p className="mt-5 max-w-[62ch] rounded-panel border-l-[3px] border-accent bg-surface-muted px-4 py-3 text-foreground-secondary">
              Це займе близько 10 хвилин. Я прочитаю відповіді особисто — не бот і не відділ продажів — і відповім
              протягом 2 робочих днів на вказаний email. Дзвонити не буду.
              <br />
              <span className="text-foreground-muted">— Олександр, автор AktFlow</span>
            </p>
          </div>

          {restored && (
            // Fix round item 3: role="status" so a screen-reader user is
            // told the draft came back, consistent with the submit-outcome
            // banners below (role="alert"/role="status").
            <p
              role="status"
              className="flex items-center gap-2 rounded-panel bg-success-surface px-4 py-3 text-success-foreground"
            >
              <Check size={16} aria-hidden="true" className="shrink-0" />
              Чернетку відновлено з попереднього разу — можете продовжити зі свого місця.
            </p>
          )}

          {/* RULING 5: a persistent inline banner, never a toast — stays until
              resolved, never auto-dismisses, never clears the visitor's input.
              Task 14: refactored onto the shared InlineBanner component
              (src/components/InlineBanner.tsx), which forwards `ref` to the
              exact same `<div>` the focus effect above targets and keeps
              `tabIndex={-1}` plus `role="alert"`. The draft itself is untouched
              by that refactor — nothing here calls clearDraft/saveDraft, so
              preservation on the error path is unaffected. */}
          {submitState.phase === 'error' && (
            <InlineBanner ref={bannerRef} tone="warning" role="alert" icon={<AlertTriangle size={20} aria-hidden="true" className="mt-0.5 shrink-0" />}>
              <b>Не вдалося надіслати автоматично</b>
              <span>
                Ваші відповіді нікуди не зникли — вони й далі збережені у цьому браузері. Спробуйте ще раз або{' '}
                <a className="underline underline-offset-4" href={submitState.mailto}>
                  надішліть їх листом
                </a>
                .
              </span>
            </InlineBanner>
          )}

          {/* RULING 1: no endpoint is provisioned yet, so this is the normal,
              intended submission route today — not an error banner.
              Fix round (final review, finding C2): copy corrected — the page
              cannot detect whether the visitor actually pressed "Надіслати"
              in their own mail client, so it no longer claims the draft is
              kept only "until the letter is sent". It now says what is
              actually true (kept until the visitor removes it themselves)
              and gives them the means to do that right here, next to the
              link that opens their mail client — the exact place someone
              who has just done that will see it. */}
          {submitState.phase === 'mailto' && (
            <InlineBanner ref={bannerRef} tone="success" role="status" icon={<Mail size={20} aria-hidden="true" className="mt-0.5 shrink-0" />}>
              <b>Лист із вашими відповідями готовий</b>
              <span>
                Натисніть «Відкрити лист», перевірте текст і надішліть його зі своєї поштової програми — до цього
                моменту нічого не передається нікуди. Сайт не може перевірити, чи ви справді натиснули «Надіслати» у
                своєму поштовому клієнті, тож відповіді лишаються в цьому браузері, доки ви самі не видалите
                чернетку кнопкою нижче.
              </span>
              <span className="mt-1 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={submitState.mailto}>Відкрити лист</a>
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCopyAnswers}>
                  Скопіювати відповіді
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleDeleteDraft}>
                  Видалити чернетку
                </Button>
              </span>
              {copyState !== 'idle' && (
                <span role="status">
                  {copyState === 'copied'
                    ? 'Відповіді скопійовано — можна вставити їх у будь-який лист.'
                    : 'Не вдалося скопіювати автоматично. Виділіть текст листа вручну та скопіюйте його.'}
                </span>
              )}
            </InlineBanner>
          )}

          <FormSection
            title="Хто ви"
            lead="Єдині два обов’язкові поля на цій сторінці — щоб було кому і куди відповісти."
          >
            <Field id="pilot-company" label={FIELD_LABEL.company} required>
              <Input
                id="pilot-company"
                name="company"
                required
                maxLength={180}
                value={draft.company}
                onChange={updateField('company')}
              />
            </Field>

            <Field id="pilot-email" label={FIELD_LABEL.email} required>
              <Input
                id="pilot-email"
                name="email"
                type="email"
                required
                maxLength={254}
                value={draft.email}
                onChange={updateField('email')}
              />
            </Field>
          </FormSection>

          <FormSection
            title="Ваші об’єкти"
            lead="Два уточнення про масштаб: закриття одного об’єкта і закриття п’ятнадцяти — це різні задачі."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Field id="pilot-specialisation" label={FIELD_LABEL.specialisation}>
                <Select
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
                </Select>
              </Field>

              <Field id="pilot-site-count" label={FIELD_LABEL.siteCount}>
                <Select
                  id="pilot-site-count"
                  name="siteCount"
                  value={draft.siteCount}
                  onChange={updateField('siteCount')}
                >
                  {SITE_COUNT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </FormSection>

          {/* A.3.2a hierarchy (RULING 4): the core discovery question comes
              first among the three free-text answers — `capture`, then
              `storage`, then `returnReason`, matching draft.ts's `FIELDS`. */}
          <FormSection
            title="Як зараз влаштований процес"
            lead="Найважливіша частина, і єдина, де відповідь пишеться словами. Опишіть, як воно є насправді — навіть якщо це месенджер і папка на робочому столі. Саме такі відповіді тут корисні."
          >
            <Field
              id="pilot-capture"
              label={FIELD_LABEL.capture}
              hint="Хто знімає, куди складає, як ці дані потім потрапляють у акт."
            >
              <Textarea
                id="pilot-capture"
                name="capture"
                maxLength={2000}
                value={draft.capture}
                onChange={updateField('capture')}
              />
            </Field>

            <Field id="pilot-storage" label={FIELD_LABEL.storage}>
              <Textarea
                id="pilot-storage"
                name="storage"
                maxLength={2000}
                value={draft.storage}
                onChange={updateField('storage')}
              />
            </Field>

            <Field id="pilot-return-reason" label={FIELD_LABEL.returnReason}>
              <Textarea
                id="pilot-return-reason"
                name="returnReason"
                maxLength={2000}
                value={draft.returnReason}
                onChange={updateField('returnReason')}
              />
            </Field>
          </FormSection>

          <FormSection title="Закриття періоду" lead="Дві короткі відповіді наостанок.">
            <div className="grid gap-5 md:grid-cols-2">
              <Field id="pilot-closing-time" label={FIELD_LABEL.closingTime}>
                <Select
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
                </Select>
              </Field>

              <Field id="pilot-willing-to-share" label={FIELD_LABEL.willingToShare}>
                <Select
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
                </Select>
              </Field>
            </div>
          </FormSection>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-[46ch] text-foreground-secondary">
              Що станеться з цими відповідями, описано на сторінці{' '}
              {/*
                Review 07 · I5 carried across from the retired `.pilot-form p a`
                rule. This link sits inside a sentence, so it cannot become a
                block without breaking the line — `inline-flex` with a 44px
                min-height grows the hit area for a gloved hand at phone width
                while the text keeps its place in the running copy. `md:min-h-0`
                hands the line its normal leading back at the desk, exactly as
                the old max-width:767px media query did.
              */}
              <Link
                to="/legal/privacy"
                className="inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-4 md:min-h-0"
              >
                Конфіденційність
              </Link>
              .
            </p>

            {/*
              `min-w-[220px]` replaces the retired `.pilot-submit` rule, and for
              the same reason: the label swaps to «Надсилаю…» while a request is
              in flight, and a content-sized button visibly narrows every time
              it does. The floor fits the longer idle label.
            */}
            <Button
              type="submit"
              variant="signal"
              className="min-w-[220px]"
              disabled={submitState.phase === 'submitting'}
            >
              {submitState.phase === 'submitting' ? 'Надсилаю…' : 'Надіслати відповіді'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
