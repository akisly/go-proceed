import { describe, expect, it } from 'vitest'
import { REDIRECTED_ROUTES, SHIPPED_ROUTES } from '../qa/routes.mjs'

describe('route contract', () => {
  it('ships the curated surface set', () => {
    expect(SHIPPED_ROUTES).toContain('/demo')
    expect(SHIPPED_ROUTES).toContain('/pilot')
    expect(SHIPPED_ROUTES).toContain('/roadmap')
  })

  it('never ships an auth or commercial surface', () => {
    for (const forbidden of ['/login', '/reset-password', '/app/billing', '/app/payments']) {
      expect(SHIPPED_ROUTES).not.toContain(forbidden)
      expect(REDIRECTED_ROUTES).toContain(forbidden)
    }
  })

  it('keeps the two lists disjoint', () => {
    const overlap = SHIPPED_ROUTES.filter(route => REDIRECTED_ROUTES.includes(route))
    expect(overlap).toEqual([])
  })
})
