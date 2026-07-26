import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FORBIDDEN_CLAIM_PATTERNS } from '../qa/forbidden-claims.mjs'

// RULING 1 (task 11): bare __dirname does not exist in this ESM package —
// derived the same way tests/styles.test.ts already does.
const __dirname = dirname(fileURLToPath(import.meta.url))

const srcDir = resolve(__dirname, '../src')

function allSource(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .map(entry => {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) return allSource(full)
      return /\.tsx?$/.test(entry.name) ? readFileSync(full, 'utf8') : ''
    })
    .join('\n')
}

describe('absent-capability claims', () => {
  const corpus = allSource(srcDir)
  for (const { id, pattern } of FORBIDDEN_CLAIM_PATTERNS) {
    it(`never claims ${id}`, () => {
      expect(corpus).not.toMatch(pattern)
    })
  }
})

describe('GA-gated states', () => {
  it('never mentions accepted_external or returned_external', () => {
    const corpus = allSource(srcDir)
    expect(corpus).not.toContain('accepted_external')
    expect(corpus).not.toContain('returned_external')
  })
})

/**
 * Fix round 1: the "absent-capability claims" block above only proves each
 * pattern is silent on THIS codebase's real content — it says nothing about
 * whether the pattern would actually catch the claim class it was written
 * for. These tests are the other half: each new proximity pattern is
 * asserted against the exact wording from the fix-round-1 review that the
 * original four narrow patterns let through untouched, so a future edit
 * that accidentally narrows a pattern into a no-op fails loudly here
 * instead of silently.
 */
describe('regression guard actually catches its documented example claims', () => {
  const EXAMPLE_CLAIMS: Readonly<Record<string, string>> = {
    'pricing-recurring': 'План Контроль коштує 10 900 гривень щомісяця',
    'mobile-field-device': 'Працює на телефоні майстра в полі',
  }

  for (const [id, example] of Object.entries(EXAMPLE_CLAIMS)) {
    it(`${id} matches its documented example claim`, () => {
      const entry = FORBIDDEN_CLAIM_PATTERNS.find(p => p.id === id)
      if (!entry) {
        throw new Error(`claims.test.ts: expected a FORBIDDEN_CLAIM_PATTERNS entry with id "${id}".`)
      }
      expect(example).toMatch(entry.pattern)
    })
  }
})
