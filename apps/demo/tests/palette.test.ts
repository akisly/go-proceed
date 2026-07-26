import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  auditColours,
  auditTailwindArbitrary,
  buildApprovedPalette,
  extractColourBearingCustomProperties,
  extractColourLiterals,
  extractTailwindArbitraryColours,
  parseColour,
} from '../qa/colour-audit.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const approvedCss = readFileSync(resolve(__dirname, '../../../prototype/src/styles.css'), 'utf8')
const APPROVED = buildApprovedPalette(approvedCss)

/**
 * Step zero of the dashboard rewrite. The previous palette guard compared hex
 * literals only, so a Tailwind/shadcn theme written in HSL or oklch() would
 * have entered the codebase completely unseen by the one check that enforces
 * "no colour outside doc 05". These tests prove the replacement understands
 * every colour form the rewrite can introduce.
 */
describe('parseColour — format coverage', () => {
  it('parses hex in 3, 4, 6 and 8 digit forms', () => {
    expect(parseColour('#fff')?.rgb).toEqual([255, 255, 255])
    expect(parseColour('#c6ff34')?.rgb).toEqual([198, 255, 52])
    expect(parseColour('#c6ff34ff')?.rgb).toEqual([198, 255, 52])
  })

  it('parses legacy and modern rgb()/rgba()', () => {
    expect(parseColour('rgb(198, 255, 52)')?.rgb).toEqual([198, 255, 52])
    expect(parseColour('rgba(72,76,94,.17)')?.rgb).toEqual([72, 76, 94])
    expect(parseColour('rgb(198 255 52 / 0.5)')?.rgb).toEqual([198, 255, 52])
  })

  it('parses hsl()/hsla()', () => {
    expect(parseColour('hsl(0, 0%, 100%)')?.rgb).toEqual([255, 255, 255])
    expect(parseColour('hsl(0 0% 0%)')?.rgb).toEqual([0, 0, 0])
  })

  it('parses oklch() — the form current shadcn themes ship', () => {
    const white = parseColour('oklch(1 0 0)')?.rgb
    expect(white?.every((c: number) => c >= 253)).toBe(true)
    const black = parseColour('oklch(0 0 0)')?.rgb
    expect(black).toEqual([0, 0, 0])
  })

  it('parses oklab()', () => {
    expect(parseColour('oklab(0 0 0)')?.rgb).toEqual([0, 0, 0])
  })

  it('reports color-mix() as unresolved rather than silently passing it', () => {
    expect(parseColour('color-mix(in oklch, #c6ff34, white)')?.unresolved).toBe(true)
  })

  it('reports var()-containing colour functions as unresolved', () => {
    expect(parseColour('rgb(var(--brand) / 0.5)')?.unresolved).toBe(true)
  })

  it('treats CSS-wide keywords as allowed, not as colours', () => {
    expect(parseColour('transparent')?.keyword).toBe(true)
    expect(parseColour('currentColor')?.keyword).toBe(true)
    expect(parseColour('inherit')?.keyword).toBe(true)
  })

  it('returns null for values that are not colours at all', () => {
    expect(parseColour('16px')).toBeNull()
    expect(parseColour('cubic-bezier(0.2, 0.8, 0.2, 1)')).toBeNull()
    expect(parseColour('')).toBeNull()
  })
})

describe('the guard actually bites — equivalent colours across formats', () => {
  it('accepts an approved colour however it is written', () => {
    // #c6ff34 is the approved Lime and appears in the frozen source.
    for (const form of ['#c6ff34', 'rgb(198, 255, 52)', 'rgb(198 255 52 / 1)']) {
      expect(auditColours({ css: `a{color:${form}}`, label: 't', approved: APPROVED })).toEqual([])
    }
  })

  it('rejects an unapproved colour written as hex', () => {
    expect(auditColours({ css: 'a{color:#ff00ff}', label: 't', approved: APPROVED })).toHaveLength(1)
  })

  it('rejects the same unapproved colour written as rgb()', () => {
    expect(auditColours({ css: 'a{color:rgb(255,0,255)}', label: 't', approved: APPROVED })).toHaveLength(1)
  })

  it('rejects the same unapproved colour written as hsl() — invisible to the old hex-only guard', () => {
    expect(auditColours({ css: 'a{color:hsl(300 100% 50%)}', label: 't', approved: APPROVED })).toHaveLength(1)
  })

  it('rejects a shadcn-style oklch() token — the exact case that motivated this', () => {
    const findings = auditColours({
      css: ':root{--primary: oklch(0.7 0.28 328)}',
      label: 'theme',
      approved: APPROVED,
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatch(/unapproved colour/)
  })

  it('allows opacity variation on an approved hue', () => {
    // Slate rgba(72,76,94,.17) is approved; a different alpha is not a new colour.
    expect(auditColours({ css: 'a{color:rgba(72,76,94,.5)}', label: 't', approved: APPROVED })).toEqual([])
  })
})

describe('colour-bearing custom properties', () => {
  it('detects a custom property whose value is a colour', () => {
    const found = extractColourBearingCustomProperties(':root{--brand: oklch(0.7 0.2 140); --space-4: 16px}')
    expect(found.map(f => f.name)).toEqual(['--brand'])
  })

  it('ignores non-colour custom properties rather than flagging every --*', () => {
    const found = extractColourBearingCustomProperties(
      ':root{--space-4:16px;--ease-out:cubic-bezier(.2,.8,.2,1);--radius-sm:4px}',
    )
    expect(found).toEqual([])
  })

  it('detects colour carried inside a composite value such as a shadow', () => {
    const found = extractColourBearingCustomProperties(':root{--lift: 0 1px 2px rgba(0,0,0,.06)}')
    expect(found.map(f => f.name)).toEqual(['--lift'])
  })
})

describe('Tailwind arbitrary colour values', () => {
  it('extracts arbitrary colours from class names', () => {
    const found = extractTailwindArbitraryColours('<div className="bg-[#ff0000] text-[oklch(0.7_0.1_140)]" />')
    expect(found).toContain('#ff0000')
    expect(found.some(f => f.startsWith('oklch('))).toBe(true)
  })

  it('fails an unapproved arbitrary colour in JSX', () => {
    const findings = auditTailwindArbitrary({
      source: '<div className="bg-[#ff00ff]" />',
      label: 'Foo.tsx',
      approved: APPROVED,
    })
    expect(findings).toHaveLength(1)
  })

  it('passes an approved arbitrary colour', () => {
    const findings = auditTailwindArbitrary({
      source: '<div className="bg-[#c6ff34]" />',
      label: 'Foo.tsx',
      approved: APPROVED,
    })
    expect(findings).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// The live guard, applied to everything this project actually ships.
// ---------------------------------------------------------------------------

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, exts))
    } else if (exts.includes(extname(entry))) {
      out.push(full)
    }
  }
  return out
}

describe('live palette guard', () => {
  it('every authored stylesheet under src/ uses only approved colour', () => {
    const srcDir = resolve(__dirname, '../src')
    const findings: string[] = []
    for (const file of walk(srcDir, ['.css'])) {
      // styles.css is the frozen approved copy and is its own source of truth.
      if (file.endsWith('/styles.css')) continue
      findings.push(
        ...auditColours({ css: readFileSync(file, 'utf8'), label: file.replace(srcDir, 'src'), approved: APPROVED }),
      )
    }
    expect(findings).toEqual([])
  })

  it('no component introduces an unapproved Tailwind arbitrary colour', () => {
    const srcDir = resolve(__dirname, '../src')
    const findings: string[] = []
    for (const file of walk(srcDir, ['.tsx', '.ts'])) {
      findings.push(
        ...auditTailwindArbitrary({
          source: readFileSync(file, 'utf8'),
          label: file.replace(srcDir, 'src'),
          approved: APPROVED,
        }),
      )
    }
    expect(findings).toEqual([])
  })

  it('the approved palette is non-trivial, so a passing result means something', () => {
    // Guards against a silent regression where APPROVED ends up empty and
    // every colour trivially "matches" nothing.
    expect(APPROVED.size).toBeGreaterThan(100)
  })

  it('extracts the colour literals actually present in the frozen source', () => {
    const literals = extractColourLiterals(approvedCss)
    expect(literals.length).toBeGreaterThan(300)
  })
})
