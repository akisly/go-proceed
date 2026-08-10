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
 * WHAT REPLACED THE FORM_PROCESSOR TOKEN, AND WHY IT NEEDED REPLACING WITH
 * SOMETHING RATHER THAN WITH NOTHING.
 *
 * On 2026-08-10 the owner resolved the launch blocker the way its own text
 * offered: /legal/privacy no longer NAMES a form-handling service, because
 * there is none to name — `VITE_PILOT_ENDPOINT` is unset and submissions go by
 * `mailto`. The three submission states are still disclosed; the third-party
 * one is described by its ROLE («цей сторонній сервіс»), which is true.
 *
 * That is correct exactly while no endpoint is configured. Set
 * `VITE_PILOT_ENDPOINT` and the page starts sending nine field values to a
 * processor it declines to name — the same misdescription the token was
 * blocking, in different clothes, and one nobody would notice because removing
 * the token also removed the thing preflight was watching.
 *
 * So the rule is an IMPLICATION and it is asserted as one: an endpoint implies a
 * named processor. The predicate is exercised against both sides below, the way
 * the forbidden-claim patterns are, so it cannot decay into a check that passes
 * because it matches nothing.
 */
const LEGAL_TSX = resolve(srcDir, 'pages/Legal.tsx')

/**
 * Does this source NAME a processor? A `FORM_PROCESSOR` binding whose value is
 * not itself a `{{TOKEN}}` placeholder. Deliberately the same identifier the
 * removed constant used: restoring the disclosure means restoring that name,
 * and a contributor who configures an endpoint will be led straight back to it
 * by this test's failure message.
 */
function namesProcessor(source: string): boolean {
  return /const\s+FORM_PROCESSOR\s*(?::[^=]+)?=\s*['"`](?!\{\{)[^'"`]+['"`]/.test(source)
}

/**
 * IS AN ENDPOINT CONFIGURED FOR THIS BUILD?
 *
 * `process.env` ALONE IS NOT THE ANSWER, and getting that wrong would have made
 * this whole guard decorative. Vite reads `VITE_*` out of `.env` files itself
 * (`loadEnv`), and those never reach `process.env` in a vitest run — so a
 * contributor who configures the endpoint the ordinary way, by writing
 * `apps/demo/.env`, would set it in exactly the manner this check could not see.
 * Both sources are read. `.env` and `.env.local` are gitignored, so the file is
 * looked for rather than assumed absent.
 */
function pilotEndpointConfigured(): boolean {
  if ((process.env.VITE_PILOT_ENDPOINT ?? '').trim().length > 0) return true
  const demoDir = resolve(__dirname, '..')
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    let text: string
    try {
      text = readFileSync(resolve(demoDir, name), 'utf8')
    } catch {
      continue
    }
    for (const line of text.split('\n')) {
      const m = /^\s*(?:export\s+)?VITE_PILOT_ENDPOINT\s*=\s*(.*)$/.exec(line)
      if (m && m[1]!.trim().replace(/^['"]|['"]$/g, '').length > 0) return true
    }
  }
  return false
}

describe('a configured form processor must be named on /legal/privacy', () => {
  const legal = readFileSync(LEGAL_TSX, 'utf8')
  const endpointConfigured = pilotEndpointConfigured()

  it('holds for the build actually being tested', () => {
    if (endpointConfigured) {
      expect(namesProcessor(legal),
        'VITE_PILOT_ENDPOINT is set, so /legal/privacy must name the processor that '
        + 'receives the nine field values — restore a FORM_PROCESSOR const with the real '
        + 'service name and render it in the two third-party paragraphs').toBe(true)
    } else {
      // Today's state, asserted rather than assumed: no endpoint, and the page
      // names no processor. Both halves, so a silent change to either shows up.
      expect(namesProcessor(legal)).toBe(false)
    }
  })

  it('would REFUSE today\'s page the moment an endpoint were configured', () => {
    // Stated as a fact about the CURRENT page rather than as a branch, because
    // the branch above has taken the same arm on every run this project has
    // ever had: the endpoint has never been set. This is what makes the rule
    // above a live rule rather than a dormant one — today's page names no
    // processor, so configuring an endpoint without editing it goes red.
    expect(namesProcessor(legal)).toBe(false)
  })

  it('is satisfied by a page that does name one, so it is not a no-op', () => {
    expect(namesProcessor("const FORM_PROCESSOR = 'Приклад-Сервіс Форм'")).toBe(true)
    // …and is NOT satisfied by the placeholder it replaced, which is the whole
    // failure mode: a literal token rendered inside <code> as if it were a name.
    expect(namesProcessor("const FORM_PROCESSOR = '{{FORM_PROCESSOR}}'")).toBe(false)
  })
})

/**
 * Fix round (final review, finding I1) — an earlier version of this file
 * asserted no unreplaced `{{TOKEN}}` placeholder (e.g. `{{CONTACT_EMAIL}}`,
 * `{{FORM_PROCESSOR}}`) appears in src/, as a test in the DEFAULT suite. A
 * subsequent review round correctly identified that as its own defect: both
 * tokens were genuinely unresolved at the time, so that test failed on every
 * run, meaning `pnpm test` could never be green — which trains everyone to
 * ignore red, and hides the other ~88 genuine tests behind a known,
 * deliberate failure. (`{{CONTACT_EMAIL}}` has since been resolved — see
 * `src/data/contact.ts` — but `{{FORM_PROCESSOR}}` has not, so the reasoning
 * still holds and the check stays out of this suite.) It now lives in
 * `qa/preflight.mjs`
 * (`pnpm --filter @goproceed/demo preflight`), a separate, explicit,
 * deploy-time gate documented as a hard prerequisite in README.md §3 — not
 * part of the default test/CI suite. `qa/verify.mjs`'s bundle scan still
 * *reports* any surviving tokens (non-failing, alongside `missingAssets`) so
 * a routine QA run keeps them visible without going red over them. See
 * `../qa/placeholder-tokens.mjs` for the still-shared pattern.
 */

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
