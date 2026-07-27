import { describe, expect, it } from 'vitest'
import { pluralUk, rowsUk } from '../src/domain/format'

/**
 * The dashboard rewrite put counts into running phrases («4 рядки»), which
 * needs real Ukrainian plural agreement rather than a bare `n + 's'`. These
 * cases are the ones that actually go wrong: the 11-14 teens, and the
 * 111-114 that repeat the trap two orders of magnitude up.
 */
describe('pluralUk', () => {
  const rows = (n: number) => pluralUk(n, 'рядок', 'рядки', 'рядків')

  it('uses the singular for 1 and for anything ending in 1', () => {
    expect(rows(1)).toBe('рядок')
    expect(rows(21)).toBe('рядок')
    expect(rows(101)).toBe('рядок')
  })

  it('uses the few form for 2-4 and anything ending in 2-4', () => {
    for (const n of [2, 3, 4, 22, 23, 24, 104]) {
      expect(rows(n)).toBe('рядки')
    }
  })

  it('uses the many form for 0 and 5-10', () => {
    for (const n of [0, 5, 6, 9, 10]) {
      expect(rows(n)).toBe('рядків')
    }
  })

  it('uses the many form across the whole 11-14 teen range, despite the last digit', () => {
    // The trap: 11/12/13/14 end in 1/2/3/4 but take the genitive plural.
    for (const n of [11, 12, 13, 14]) {
      expect(rows(n)).toBe('рядків')
    }
  })

  it('repeats the teen rule at 111-114, not just 11-14', () => {
    for (const n of [111, 112, 113, 114]) {
      expect(rows(n)).toBe('рядків')
    }
  })

  it('is unaffected by sign or fractional noise', () => {
    expect(rows(-1)).toBe('рядок')
    expect(rows(-14)).toBe('рядків')
  })
})

describe('rowsUk', () => {
  it('renders the count together with the agreeing noun', () => {
    expect(rowsUk(1)).toBe('1 рядок')
    expect(rowsUk(4)).toBe('4 рядки')
    expect(rowsUk(14)).toBe('14 рядків')
  })

  it('covers the dataset figures actually rendered today', () => {
    // /app: 4 at-risk rows, 3 unrecoverable rows, 14 in the register.
    expect(rowsUk(3)).toBe('3 рядки')
    expect(rowsUk(4)).toBe('4 рядки')
    expect(rowsUk(14)).toBe('14 рядків')
  })
})
