import { describe, expect, it } from 'vitest'
import { isUnrecoverable, readinessTone, type WorkItem } from '../src/domain/readiness'
import { READINESS_LABEL_UK } from '../src/domain/labels'

const base: WorkItem = {
  id: 'wi-1',
  code: 'ЕМ-04.02',
  title: 'Прокладання кабелю ВВГнг-LS 3х2,5 у гофрі',
  locationId: 'loc-1',
  plannedQuantity: 420,
  capturedQuantity: 420,
  unit: 'м',
  valueUah: 184_000,
  readiness: 'evidence_missing',
  concealmentHoldPoint: true,
  concealedAt: '2026-07-10',
  recoveryCostUah: 46_000,
  requirements: [],
}

describe('isUnrecoverable', () => {
  it('is true when evidence is missing, a hold point exists and the date has passed', () => {
    expect(isUnrecoverable(base, '2026-07-26')).toBe(true)
  })

  it('is false when the work is already internally ready', () => {
    expect(isUnrecoverable({ ...base, readiness: 'ready_internal' }, '2026-07-26')).toBe(false)
  })

  it('is false when there is no concealment hold point', () => {
    expect(isUnrecoverable({ ...base, concealmentHoldPoint: false }, '2026-07-26')).toBe(false)
  })

  it('is false when nothing has been concealed yet', () => {
    expect(isUnrecoverable({ ...base, concealedAt: null }, '2026-07-26')).toBe(false)
  })

  it('is false when concealment is still in the future', () => {
    expect(isUnrecoverable({ ...base, concealedAt: '2026-08-01' }, '2026-07-26')).toBe(false)
  })

  it('is true on the exact concealment date (boundary)', () => {
    expect(isUnrecoverable({ ...base, concealedAt: '2026-07-26' }, '2026-07-26')).toBe(true)
  })
})

describe('READINESS_LABEL_UK', () => {
  it('covers every readiness state exactly once', () => {
    expect(Object.keys(READINESS_LABEL_UK).sort()).toEqual([
      'evidence_missing', 'not_started', 'overridden_ready',
      'packaged', 'ready_internal', 'review_pending', 'submitted',
    ])
  })

  it('has no GA-gated external states', () => {
    const keys = Object.keys(READINESS_LABEL_UK)
    expect(keys).not.toContain('accepted_external')
    expect(keys).not.toContain('returned_external')
  })
})

describe('readinessTone', () => {
  it('maps ready_internal to the signal tone', () => {
    expect(readinessTone('ready_internal')).toBe('signal')
  })
  it('maps evidence_missing to the amber tone', () => {
    expect(readinessTone('evidence_missing')).toBe('amber')
  })
  it('maps not_started to the neutral tone', () => {
    expect(readinessTone('not_started')).toBe('neutral')
  })
})
