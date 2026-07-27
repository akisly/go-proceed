import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { READINESS_LABEL_UK } from '../src/domain/labels'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Minimal RFC 4180 row splitter — the catalog quotes fields containing commas. */
function splitCsvRow(row: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i]
    if (quoted && ch === '"' && row[i + 1] === '"') { cell += '"'; i += 1; continue }
    if (ch === '"') { quoted = !quoted; continue }
    if (ch === ',' && !quoted) { cells.push(cell); cell = ''; continue }
    cell += ch
  }
  cells.push(cell)
  return cells
}

const csv = readFileSync(resolve(__dirname, '../../../technical/state-catalog.csv'), 'utf8')
const rows = csv.split(/\r?\n/).filter(Boolean).map(splitCsvRow)
const header = rows[0]!
const idx = {
  domain: header.indexOf('domain'),
  state: header.indexOf('state'),
  release: header.indexOf('release'),
  uiUk: header.indexOf('ui_uk'),
}
const readiness = rows.slice(1).filter(r => r[idx.domain] === 'readiness')

describe('canonical readiness labels', () => {
  it('finds readiness rows in the catalog', () => {
    expect(readiness.length).toBeGreaterThan(0)
  })

  it('matches every label byte-for-byte with the catalog', () => {
    for (const [state, label] of Object.entries(READINESS_LABEL_UK)) {
      const row = readiness.find(r => r[idx.state] === state)
      expect(row, `catalog has no readiness row for "${state}"`).toBeDefined()
      expect(row![idx.uiUk]).toBe(label)
    }
  })

  it('omits every GA-gated readiness state', () => {
    const gaOnly = readiness.filter(r => r[idx.release] === 'GA').map(r => r[idx.state])
    expect(gaOnly.length).toBeGreaterThan(0)
    for (const state of gaOnly) {
      expect(Object.keys(READINESS_LABEL_UK)).not.toContain(state)
    }
  })

  it('covers every Pilot-release readiness state', () => {
    const pilot = readiness.filter(r => r[idx.release] === 'Pilot').map(r => r[idx.state]).sort()
    expect(Object.keys(READINESS_LABEL_UK).sort()).toEqual(pilot)
  })
})
