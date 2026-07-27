import { describe, expect, it } from 'vitest'
import { PROJECT } from '../src/data/project'
import { atRiskItems, atRiskTotalUah, isAtRisk } from '../src/domain/risk'

/**
 * Review 07 · B2. Three surfaces disagreed about what "at risk" meant:
 * /app and /app/evidence counted evidence_missing (612 300 ₴) while /demo
 * step 5 called the amber-tone bucket at risk (697 900 ₴). Both were
 * internally correct and neither was labelled.
 *
 * The confirmed definition: a work item is at risk when at least one required
 * evidence item is missing — which is exactly what the evidence_missing
 * readiness state models. Work is NOT at risk merely for being unstarted,
 * in progress, pending review, or scheduled for later.
 */
describe('isAtRisk — the single definition', () => {
  it('counts exactly the evidence_missing rows', () => {
    const rows = PROJECT.workItems.filter(isAtRisk)
    expect(rows).toHaveLength(4)
    expect(rows.every(item => item.readiness === 'evidence_missing')).toBe(true)
  })

  it('never counts work that has not started', () => {
    const notStarted = PROJECT.workItems.filter(item => item.readiness === 'not_started')
    expect(notStarted.length).toBeGreaterThan(0)
    expect(notStarted.some(isAtRisk)).toBe(false)
  })

  it('never counts work that is merely awaiting review', () => {
    const pending = PROJECT.workItems.filter(item => item.readiness === 'review_pending')
    expect(pending.length).toBeGreaterThan(0)
    expect(pending.some(isAtRisk)).toBe(false)
  })

  it('does not count a row twice when it has several missing requirements', () => {
    const multiGap = PROJECT.workItems.filter(
      item => isAtRisk(item) && item.requirements.filter(req => req.status === 'pending').length > 1,
    )
    expect(multiGap.length).toBeGreaterThan(0)
    for (const item of multiGap) {
      expect(atRiskItems(PROJECT.workItems).filter(row => row.id === item.id)).toHaveLength(1)
    }
  })
})

describe('atRiskTotalUah', () => {
  it('totals 612 300 UAH across the project', () => {
    expect(atRiskTotalUah(PROJECT.workItems)).toBe(612_300)
  })

  it('is the sum of the at-risk rows and nothing else', () => {
    const summed = atRiskItems(PROJECT.workItems).reduce((total, item) => total + item.valueUah, 0)
    expect(summed).toBe(atRiskTotalUah(PROJECT.workItems))
  })

  it('counts each work item once even with multiple missing requirements', () => {
    const items = atRiskItems(PROJECT.workItems)
    const uniqueIds = new Set(items.map(item => item.id))
    expect(uniqueIds.size).toBe(items.length)
  })

  it('returns zero for an empty set rather than throwing', () => {
    expect(atRiskTotalUah([])).toBe(0)
  })
})
