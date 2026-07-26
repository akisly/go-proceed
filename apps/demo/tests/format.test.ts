import { afterEach, describe, expect, it } from 'vitest'
import { formatDateUk } from '../src/domain/format'

describe('formatDateUk', () => {
  it('converts ISO YYYY-MM-DD to DD.MM.YYYY', () => {
    expect(formatDateUk('2026-07-10')).toBe('10.07.2026')
  })

  it('zero-pads a single-digit day and month', () => {
    expect(formatDateUk('2026-01-05')).toBe('05.01.2026')
  })

  describe('timezone independence', () => {
    const originalTz = process.env.TZ

    afterEach(() => {
      process.env.TZ = originalTz
    })

    // formatDateUk parses the ISO date as UTC midnight. A host timezone
    // WEST of UTC (negative offset) subtracts hours from that instant and
    // lands on the previous local calendar day; a host EAST of UTC only
    // ever adds hours to the same UTC day and can't roll forward from
    // midnight, so west-of-UTC is the only offset direction that can
    // actually break this. Verified without the `timeZone: 'UTC'` pin,
    // formatting '2026-07-10' under America/Los_Angeles produces
    // '09.07.2026' — these tests fail exactly if that pin is ever dropped.

    it('does not roll back a day under America/Los_Angeles (UTC-7/-8)', () => {
      process.env.TZ = 'America/Los_Angeles'
      expect(formatDateUk('2026-07-10')).toBe('10.07.2026')
    })

    it('does not roll back a day under Pacific/Midway (UTC-11)', () => {
      process.env.TZ = 'Pacific/Midway'
      expect(formatDateUk('2026-01-05')).toBe('05.01.2026')
    })
  })
})
