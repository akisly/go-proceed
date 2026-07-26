import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

const demoCss = readFileSync(resolve(__dirname, '../src/styles.css'), 'utf8')
const prototypeCss = readFileSync(resolve(__dirname, '../../../prototype/src/styles.css'), 'utf8')
const demoOnlyCss = readFileSync(resolve(__dirname, '../src/styles/demo.css'), 'utf8')

const hexes = (css: string) => new Set((css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map(h => h.toLowerCase()))

describe('styles.css is a deletion-only copy', () => {
  it('introduces zero new literal hex values', () => {
    const introduced = [...hexes(demoCss)].filter(hex => !hexes(prototypeCss).has(hex))
    expect(introduced).toEqual([])
  })

  it('preserves the Evidence Atlas custom properties', () => {
    for (const token of ['--ink', '--paper', '--signal', '--line', '--muted', '--amber']) {
      expect(demoCss).toContain(token)
    }
  })

  it('is not larger than the source (deletions only)', () => {
    expect(demoCss.length).toBeLessThanOrEqual(prototypeCss.length)
  })
})

describe('styles/demo.css introduces no new literal hex values', () => {
  it('every hex in demo.css already exists in the approved design system', () => {
    const introduced = [...hexes(demoOnlyCss)].filter(hex => !hexes(prototypeCss).has(hex))
    expect(introduced).toEqual([])
  })
})
