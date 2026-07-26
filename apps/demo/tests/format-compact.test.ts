import { describe, expect, it } from 'vitest'
import { formatUah, formatUahCompact } from '../src/components/MoneyCard'
import { PROJECT } from '../src/data/project'

/**
 * Task 15 controller RULING 5: the <768px compact money form must be
 * derived from the real value, never a hard-coded figure — the brief's own
 * example («2,65 млн ₴») was a deleted fixture, not this dataset's total.
 * These tests cover the boundary where the formatter switches from the
 * full form to the millions form, and confirm the real dataset total
 * (₴1,732,300 — see src/data/project.ts) produces a value actually
 * computed from that total, not a re-typed constant.
 */
describe('formatUahCompact', () => {
  it('falls back to the full form just below the million threshold', () => {
    expect(formatUahCompact(999_999)).toBe(formatUah(999_999))
  })

  it('switches to the millions form at exactly one million', () => {
    expect(formatUahCompact(1_000_000)).toBe('1,00 млн ₴')
  })

  it('renders the real dataset total (RULING 5) as a computed millions figure', () => {
    const total = PROJECT.workItems.reduce((sum, item) => sum + item.valueUah, 0)
    expect(total).toBe(1_732_300)
    expect(formatUahCompact(total)).toBe('1,73 млн ₴')
  })

  it('renders a small value identically to the full form', () => {
    expect(formatUahCompact(184_000)).toBe(formatUah(184_000))
  })

  it('rounds to two decimal places in the millions form', () => {
    expect(formatUahCompact(2_650_000)).toBe('2,65 млн ₴')
  })

  it('handles zero via the full-form fallback', () => {
    expect(formatUahCompact(0)).toBe('0,00 ₴')
  })
})
