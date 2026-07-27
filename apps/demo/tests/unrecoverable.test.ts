import { describe, expect, it } from 'vitest'
import { formatUah } from '../src/components/MoneyCard'

// uk-UA ICU groups thousands with U+00A0 (non-breaking space), not a
// regular space. Built via String.fromCharCode rather than an embedded
// literal so the separator is unambiguous in any editor and survives
// copy/paste or re-encoding intact.
const NBSP = String.fromCharCode(0x00a0)

describe('formatUah', () => {
  it('groups thousands with a non-breaking space and appends the sign', () => {
    expect(formatUah(184_000)).toBe(`184${NBSP}000,00 ₴`)
  })
  it('renders zero explicitly rather than as an empty string', () => {
    expect(formatUah(0)).toBe('0,00 ₴')
  })
  it('keeps two decimal places', () => {
    expect(formatUah(46_500.5)).toBe(`46${NBSP}500,50 ₴`)
  })
})
