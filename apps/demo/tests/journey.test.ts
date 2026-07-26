import { describe, expect, it } from 'vitest'
import { DEMO_STEPS } from '../src/pages/Demo'

describe('guided demo journey', () => {
  it('has exactly five steps in spec order', () => {
    expect(DEMO_STEPS.map(s => s.id)).toEqual([
      'work-item', 'requirements', 'capture', 'readiness', 'package',
    ])
  })

  it('names every step in Ukrainian', () => {
    for (const step of DEMO_STEPS) {
      expect(step.title.length).toBeGreaterThan(0)
      expect(/[а-яіїєґА-ЯІЇЄҐ]/.test(step.title)).toBe(true)
    }
  })
})
