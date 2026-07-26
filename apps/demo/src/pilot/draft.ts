/**
 * Task 13: /pilot's draft persistence and mailto fallback. The three
 * free-text answers this module round-trips (`capture`, `storage`,
 * `returnReason`) are the single most valuable output of the whole
 * discovery effort — losing one to a page refresh, a third-party endpoint
 * failure, or a browser that denies localStorage is unrecoverable for the
 * contractor who typed it. Everything below is written to that standard.
 */

export const DRAFT_KEY = 'aktflow.pilot.draft'

export interface PilotDraft {
  company: string
  email: string
  specialisation: string
  siteCount: string
  capture: string
  storage: string
  returnReason: string
  closingTime: string
  willingToShare: string
}

const FIELDS: readonly (keyof PilotDraft)[] = [
  'company', 'email', 'specialisation', 'siteCount',
  'capture', 'storage', 'returnReason', 'closingTime', 'willingToShare',
]

export function serialiseDraft(draft: PilotDraft): string {
  return JSON.stringify(draft)
}

/** Never throws. A corrupt draft must not break the form. */
export function parseDraft(raw: string | null): PilotDraft | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Record<string, unknown>
  for (const field of FIELDS) {
    if (typeof record[field] !== 'string') return null
  }
  return Object.fromEntries(FIELDS.map(f => [f, record[f]])) as unknown as PilotDraft
}

const LABEL: Record<keyof PilotDraft, string> = {
  company: 'Компанія',
  email: 'Email',
  specialisation: 'Спеціалізація',
  siteCount: 'Активних об’єктів',
  capture: 'Як збираються фото і обсяги',
  storage: 'Де зберігається',
  returnReason: 'Причина повернення акта',
  closingTime: 'Час на підготовку закриття',
  willingToShare: 'Готові показати знеособлений приклад',
}

export function buildMailto(to: string, draft: PilotDraft): string {
  const body = FIELDS.map(field => `${LABEL[field]}:\n${draft[field]}`).join('\n\n')
  const params = new URLSearchParams({ subject: `AktFlow · ${draft.company}`, body })
  return `mailto:${to}?${params.toString()}`
}

/**
 * RULING 3 (task 13 controller ruling) — the draft must survive everything,
 * including a browser that denies localStorage entirely. Safari private
 * mode and some corporate device policies throw synchronously on ANY access
 * to `localStorage` (`getItem`/`setItem`/`removeItem`, not only writes past
 * a quota), so every access below is wrapped in try/catch. On failure these
 * degrade to "no persistence available this session" rather than throwing —
 * the visitor's in-memory form state in React is untouched either way, so a
 * storage failure must never be allowed to break the form itself.
 */

export function loadDraft(): PilotDraft | null {
  try {
    return parseDraft(localStorage.getItem(DRAFT_KEY))
  } catch {
    return null
  }
}

export function saveDraft(draft: PilotDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, serialiseDraft(draft))
  } catch {
    // Storage denied, disabled, or full. The visitor's answers are still
    // intact in the form's own React state; only the cross-refresh safety
    // net is unavailable for this session.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Nothing to reconcile — if removal fails, storage was already
    // unusable, so nothing was durably persisted for the next visit either.
  }
}

export type PilotSubmitOutcome =
  | { readonly kind: 'sent' }
  | { readonly kind: 'mailto'; readonly mailto: string }
  | { readonly kind: 'error'; readonly mailto: string }

export interface PilotSubmitDeps {
  readonly endpoint: string | undefined
  readonly contactEmail: string
  readonly fetchImpl: typeof fetch
}

/**
 * RULING 1 (task 13 controller ruling) — `VITE_PILOT_ENDPOINT` is not
 * provisioned for this deployment; no backend exists to receive a POST yet.
 * An unset or empty endpoint is therefore a first-class path, not an error:
 * it returns 'mailto' directly, with no attempt to POST to `undefined` and
 * no failure reported. `Pilot.tsx` is the only caller and is the sole place
 * that decides what to do with each outcome (open the mail client, clear
 * the draft, render a banner); this function only classifies what happened.
 */
export async function submitPilotDraft(draft: PilotDraft, deps: PilotSubmitDeps): Promise<PilotSubmitOutcome> {
  const endpoint = deps.endpoint?.trim()
  if (!endpoint) {
    return { kind: 'mailto', mailto: buildMailto(deps.contactEmail, draft) }
  }
  try {
    const response = await deps.fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: serialiseDraft(draft),
    })
    if (!response.ok) {
      return { kind: 'error', mailto: buildMailto(deps.contactEmail, draft) }
    }
    return { kind: 'sent' }
  } catch {
    // Network drop, DNS failure, CORS rejection, timeout — all collapse to
    // the same outcome as a non-2xx response: keep the draft, offer mailto.
    return { kind: 'error', mailto: buildMailto(deps.contactEmail, draft) }
  }
}
