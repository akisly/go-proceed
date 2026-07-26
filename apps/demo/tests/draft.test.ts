import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildMailto,
  clearDraft,
  loadDraft,
  parseDraft,
  saveDraft,
  serialiseDraft,
  submitPilotDraft,
  type PilotDraft,
} from '../src/pilot/draft'

const draft: PilotDraft = {
  company: 'ТОВ «Приклад»',
  email: 'pto@example.com.ua',
  specialisation: 'electrical',
  siteCount: '2-5',
  capture: 'Прораб надсилає фото у Viber, потім ПТО збирає вручну.',
  storage: 'Google Drive і локальні папки',
  returnReason: 'Немає фото прихованих робіт',
  closingTime: '3-7',
  willingToShare: 'yes',
}

describe('draft round-trip', () => {
  it('survives serialise -> parse unchanged', () => {
    expect(parseDraft(serialiseDraft(draft))).toEqual(draft)
  })
  it('returns null for absent storage', () => {
    expect(parseDraft(null)).toBeNull()
  })
  it('returns null for corrupt JSON rather than throwing', () => {
    expect(parseDraft('{not json')).toBeNull()
  })
  it('returns null when the shape is wrong', () => {
    expect(parseDraft('{"company":123}')).toBeNull()
  })
})

describe('buildMailto', () => {
  const url = buildMailto('founder@example.com', draft)
  it('targets the given recipient', () => {
    expect(url.startsWith('mailto:founder@example.com?')).toBe(true)
  })
  it('carries every free-text answer in the body', () => {
    const body = decodeURIComponent(new URL(url).searchParams.get('body') ?? '')
    expect(body).toContain(draft.capture)
    expect(body).toContain(draft.storage)
    expect(body).toContain(draft.returnReason)
  })
  it('percent-encodes Cyrillic safely', () => {
    expect(url).not.toContain(' ')
    expect(() => new URL(url)).not.toThrow()
  })
})

/**
 * RULING 3 (task 13 controller ruling) — a minimal in-memory `Storage`
 * implementation used to exercise `loadDraft`/`saveDraft`/`clearDraft`
 * without depending on a real browser. Vitest runs this suite under Node
 * (see vitest.config.ts), which has no global `localStorage`, so every test
 * below stubs it explicitly rather than relying on its accidental absence.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    const value = this.store.get(key)
    return value === undefined ? null : value
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

/** Every method throws synchronously — the Safari-private-mode / locked-down-device case. */
const DENIED_STORAGE: Storage = {
  get length(): number {
    throw new Error('SecurityError: localStorage is not available')
  },
  clear(): void {
    throw new Error('SecurityError: localStorage is not available')
  },
  getItem(): string | null {
    throw new Error('SecurityError: localStorage is not available')
  },
  key(): string | null {
    throw new Error('SecurityError: localStorage is not available')
  },
  removeItem(): void {
    throw new Error('SecurityError: localStorage is not available')
  },
  setItem(): void {
    throw new Error('SecurityError: localStorage is not available')
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadDraft / saveDraft / clearDraft against a working store', () => {
  it('round-trips a draft through save and load', () => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    saveDraft(draft)
    expect(loadDraft()).toEqual(draft)
  })

  it('returns null before anything has been saved', () => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    expect(loadDraft()).toBeNull()
  })

  it('clearDraft removes a saved draft', () => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    saveDraft(draft)
    clearDraft()
    expect(loadDraft()).toBeNull()
  })
})

/**
 * RULING 3: "Add a test proving the draft survives ... a browser that
 * denies localStorage entirely." None of the three functions may throw —
 * a thrown exception here would break the whole form for exactly the
 * cautious visitor most likely to be evaluating this, not just silently
 * lose the draft.
 */
describe('storage functions never throw when localStorage denies access', () => {
  it('loadDraft returns null instead of throwing', () => {
    vi.stubGlobal('localStorage', DENIED_STORAGE)
    expect(() => loadDraft()).not.toThrow()
    expect(loadDraft()).toBeNull()
  })

  it('saveDraft is a silent no-op instead of throwing', () => {
    vi.stubGlobal('localStorage', DENIED_STORAGE)
    expect(() => saveDraft(draft)).not.toThrow()
  })

  it('clearDraft is a silent no-op instead of throwing', () => {
    vi.stubGlobal('localStorage', DENIED_STORAGE)
    expect(() => clearDraft()).not.toThrow()
  })

  it('the form still works end-to-end: save, then load, on a denied store never throws and degrades to no persistence', () => {
    vi.stubGlobal('localStorage', DENIED_STORAGE)
    expect(() => {
      saveDraft(draft)
      const restored = loadDraft()
      expect(restored).toBeNull()
    }).not.toThrow()
  })
})

describe('submitPilotDraft', () => {
  const contactEmail = 'founder@example.com'

  /**
   * RULING 1: an unset/empty endpoint is the normal path today (no backend
   * is provisioned), not a failure — it must resolve to 'mailto' without
   * ever calling fetch.
   */
  it('goes straight to mailto when the endpoint is unset, without calling fetch', async () => {
    const fetchImpl = vi.fn()
    const outcome = await submitPilotDraft(draft, { endpoint: undefined, contactEmail, fetchImpl })
    expect(outcome.kind).toBe('mailto')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('goes straight to mailto when the endpoint is an empty/whitespace string', async () => {
    const fetchImpl = vi.fn()
    const outcome = await submitPilotDraft(draft, { endpoint: '   ', contactEmail, fetchImpl })
    expect(outcome.kind).toBe('mailto')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('resolves to sent on a 2xx response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    const outcome = await submitPilotDraft(draft, { endpoint: 'https://example.com/pilot', contactEmail, fetchImpl })
    expect(outcome.kind).toBe('sent')
  })

  it('resolves to error with a mailto fallback on a non-2xx response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
    const outcome = await submitPilotDraft(draft, { endpoint: 'https://example.com/pilot', contactEmail, fetchImpl })
    expect(outcome.kind).toBe('error')
    if (outcome.kind === 'error') {
      expect(outcome.mailto.startsWith('mailto:founder@example.com?')).toBe(true)
    }
  })

  it('resolves to error with a mailto fallback on a network drop', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const outcome = await submitPilotDraft(draft, { endpoint: 'https://example.com/pilot', contactEmail, fetchImpl })
    expect(outcome.kind).toBe('error')
  })

  /**
   * RULING 3: "Add a test proving the draft survives a simulated endpoint
   * failure." The whole point of keeping the draft on a failure path is
   * that a contractor's ten minutes of typed detail is never silently
   * discarded just because a third-party endpoint is down — this exercises
   * that guarantee end-to-end through the real storage functions: a draft
   * saved before submission is still readable back after the endpoint call
   * fails, because nothing on the error path ever calls clearDraft.
   */
  it('the saved draft survives a simulated endpoint failure', async () => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    saveDraft(draft)

    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const outcome = await submitPilotDraft(draft, { endpoint: 'https://example.com/pilot', contactEmail, fetchImpl })

    expect(outcome.kind).toBe('error')
    // The failure path never clears storage — only a genuinely successful
    // ('sent') outcome does, and that decision belongs to the caller
    // (Pilot.tsx), which only ever calls clearDraft() on 'sent'.
    expect(loadDraft()).toEqual(draft)
  })
})
