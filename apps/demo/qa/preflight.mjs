import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { PLACEHOLDER_TOKEN_PATTERN_GLOBAL } from './placeholder-tokens.mjs'

/**
 * The hard, explicit, deploy-time gate for unreplaced `{{TOKEN}}`
 * placeholders (finding I1; re-scoped out of the default test/QA suites by
 * a follow-up review round). This is NOT part of `pnpm test` or `pnpm qa` —
 * both of those must stay green on ordinary development and CI, because a
 * suite that is red by design trains everyone to ignore red and buries
 * genuine regressions behind a known, deliberate failure.
 *
 * Instead, `pnpm --filter @goproceed/demo preflight` is a separate, explicit
 * command that MUST be run — and MUST exit 0 — before `apps/demo` is
 * published. The one currently-unresolved token ({{FORM_PROCESSOR}}; its
 * former companion {{CONTACT_EMAIL}} is resolved, see src/data/contact.ts) is
 * documented as a hard prerequisite in README.md §3; this script is the
 * mechanical enforcement of that same list, sharing the one pattern
 * (./placeholder-tokens.mjs) with `qa/verify.mjs`'s report-only (non-failing)
 * scan of the built bundle, so the two can never drift apart.
 *
 * Scans `src/` (source, not `dist/`) because this is meant to run before a
 * build even exists — a fast, no-build-required check a developer or CI can
 * run on every commit without it ever affecting `pnpm test`/`pnpm qa`.
 */
const SRC_DIR = path.resolve('src')

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(full)))
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

async function main() {
  const files = await walk(SRC_DIR)
  /** @type {Map<string, Set<string>>} token -> set of relative file paths it appears in */
  const occurrences = new Map()

  for (const file of files) {
    const content = await readFile(file, 'utf8')
    const matches = content.match(PLACEHOLDER_TOKEN_PATTERN_GLOBAL)
    if (!matches) continue
    const relPath = path.relative(process.cwd(), file)
    for (const token of new Set(matches)) {
      if (!occurrences.has(token)) occurrences.set(token, new Set())
      occurrences.get(token).add(relPath)
    }
  }

  if (occurrences.size === 0) {
    console.log('preflight: OK — no unreplaced {{TOKEN}} placeholder in src/.')
    return
  }

  const lines = [...occurrences.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([token, tokenFiles]) => `  - ${token} — found in: ${[...tokenFiles].sort().join(', ')}`)

  console.error(
    [
      'PREFLIGHT FAILED: unreplaced deploy-blocking placeholder token(s) in src/.',
      ...lines,
      '',
      'Each token above must be replaced with a real, deployment-ready value before apps/demo is',
      'published — see the LAUNCH BLOCKER comment in src/pages/Legal.tsx and the full',
      'launch-blocker list in apps/demo/README.md §3. Do not invent a plausible-looking value to',
      'make this pass.',
      '',
      'If a file is listed here that defines no placeholder, check its COMMENTS: this scan matches',
      'the token syntax anywhere in the file. Prose about a token should name it without braces —',
      'src/data/contact.ts is the worked example.',
    ].join('\n'),
  )
  process.exitCode = 1
}

await main()
