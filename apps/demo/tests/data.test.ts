import { describe, expect, it } from 'vitest'
import { PROJECT, TODAY } from '../src/data/project'
import { isUnrecoverable } from '../src/domain/readiness'
import { READINESS_LABEL_UK } from '../src/domain/labels'

describe('synthetic project', () => {
  it('has enough work items to populate a register', () => {
    expect(PROJECT.workItems.length).toBeGreaterThanOrEqual(12)
  })

  it('uses only canonical readiness states', () => {
    for (const item of PROJECT.workItems) {
      expect(Object.keys(READINESS_LABEL_UK)).toContain(item.readiness)
    }
  })

  it('keeps line values inside the plausible 20k–400k UAH band', () => {
    for (const item of PROJECT.workItems) {
      expect(item.valueUah).toBeGreaterThanOrEqual(20_000)
      expect(item.valueUah).toBeLessThanOrEqual(400_000)
    }
  })

  it('totals into the 1.5M–6M UAH subcontract band', () => {
    const total = PROJECT.workItems.reduce((sum, item) => sum + item.valueUah, 0)
    expect(total).toBeGreaterThanOrEqual(1_500_000)
    expect(total).toBeLessThanOrEqual(6_000_000)
  })

  it('exposes all three argument situations', () => {
    const ready = PROJECT.workItems.filter(i => i.readiness === 'ready_internal')
    const missing = PROJECT.workItems.filter(i => i.readiness === 'evidence_missing')
    const unrecoverable = PROJECT.workItems.filter(i => isUnrecoverable(i, TODAY))
    expect(ready.length).toBeGreaterThan(0)
    expect(missing.length).toBeGreaterThan(0)
    expect(unrecoverable.length).toBeGreaterThan(0)
  })

  it('gives every unrecoverable item a recovery cost to display', () => {
    for (const item of PROJECT.workItems.filter(i => isUnrecoverable(i, TODAY))) {
      expect(item.recoveryCostUah).not.toBeNull()
      expect(item.recoveryCostUah!).toBeGreaterThan(0)
    }
  })

  it('uses real electrical trade vocabulary', () => {
    const corpus = PROJECT.workItems.map(i => i.title).join(' ')
    for (const term of ['кабел', 'щит', 'ізоляц']) {
      expect(corpus.toLowerCase()).toContain(term)
    }
  })
})
