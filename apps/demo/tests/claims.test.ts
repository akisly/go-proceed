import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FORBIDDEN_CLAIM_PATTERNS } from '../qa/forbidden-claims.mjs'
import { PLACEHOLDER_TOKEN_PATTERN_GLOBAL } from '../qa/placeholder-tokens.mjs'

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
 * Fix round (final review, finding I1) — nothing previously guarded against
 * an unreplaced `{{TOKEN}}` placeholder (e.g. `{{CONTACT_EMAIL}}`,
 * `{{FORM_PROCESSOR}}` — see the LAUNCH BLOCKER comments in
 * src/pages/Pilot.tsx and src/pages/Legal.tsx) reaching a real deploy. A
 * build today would produce a live `mailto:{{CONTACT_EMAIL}}` link. This is
 * the last mechanical check standing between that and a shipped page, so it
 * is written to FAIL LOUDLY, not warn — see ../qa/placeholder-tokens.mjs for
 * the shared pattern and the reasoning for why this must stay a hard gate.
 *
 * Both tokens are genuinely unresolved in this codebase as of this writing,
 * so this test currently, correctly, FAILS — confirmed by running it. That
 * is not a bug to quietly fix by loosening the pattern or excluding a file;
 * it is the guard doing exactly its job ahead of an actual deploy. Whether
 * to replace the tokens with real values now, or leave this red until a
 * monitored contact address and (if ever used) a form processor are
 * available, is a product decision for a human, not something this fix
 * round invents a plausible-looking placeholder to paper over.
 */
describe('deploy-blocking placeholder tokens', () => {
  it('contains no unreplaced {{TOKEN}} placeholder in src/ before deploy', () => {
    const corpus = allSource(srcDir)
    const matches = corpus.match(PLACEHOLDER_TOKEN_PATTERN_GLOBAL)
    if (matches !== null) {
      const unique = [...new Set(matches)].sort()
      throw new Error(
        `LAUNCH BLOCKER: found unreplaced placeholder token(s) in src/: ${unique.join(', ')}. ` +
          'Each one must be replaced with a real, deployment-ready value before this site is deployed ' +
          '(see the LAUNCH BLOCKER comments in src/pages/Pilot.tsx and src/pages/Legal.tsx).',
      )
    }
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
