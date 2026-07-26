/**
 * Colour-format-agnostic palette guard.
 *
 * WHY THIS EXISTS
 * ---------------
 * `apps/demo/src/styles.css` is a deletion-only copy of the approved Evidence
 * Atlas system (doc 05). The original guard in tests/styles.test.ts compared
 * *hex literals only*:
 *
 *     css.match(/#[0-9a-fA-F]{3,8}\b/g)
 *
 * That was sufficient while every colour in the project was hex. It stops being
 * sufficient the moment a Tailwind/shadcn theme layer lands, because those
 * themes are written as HSL triplets or `oklch()` — neither of which that regex
 * can see. The guard would keep passing while arbitrary colour entered the
 * codebase, which is the exact failure it exists to prevent.
 *
 * This module detects colour in any CSS form, normalises it to sRGB, and
 * compares it against the palette actually present in the frozen source.
 *
 * COMPARISON RULE
 * ---------------
 * Approval is on the **RGB triplet**, not the literal string. `#c6ff34`,
 * `rgb(198 255 52)` and the `oklch()` that resolves to it are the same approved
 * colour. Alpha is free: `rgba(72,76,94,.17)` and `rgba(72,76,94,.5)` are both
 * the approved Slate, at different opacities. Introducing a *new hue* fails;
 * varying the opacity of an approved one does not.
 *
 * WHAT COUNTS AS A COLOUR-BEARING CUSTOM PROPERTY
 * -----------------------------------------------
 * Not every `--*`. A property is treated as colour-bearing when its *value*
 * parses as a colour, or when it is a `var()` alias chain that resolves to one.
 * `--space-4: 16px` and `--ease-out: cubic-bezier(...)` are ignored. This
 * matters: flagging every custom property would make the guard noisy enough to
 * be switched off, which is how guards die.
 */

// ---------------------------------------------------------------------------
// Colour parsing
// ---------------------------------------------------------------------------

/** CSS-wide keywords and non-colours that are always allowed. */
const ALLOWED_KEYWORDS = new Set([
  'transparent',
  'currentcolor',
  'inherit',
  'initial',
  'unset',
  'revert',
  'none',
  'auto',
])

/** Named colours that map onto values already in the approved palette. */
const NAMED_COLOURS = {
  white: [255, 255, 255],
  black: [0, 0, 0],
}

const clamp255 = n => Math.max(0, Math.min(255, Math.round(n)))

function srgbFromLinear(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/** OKLab → sRGB. Needed because shadcn themes increasingly ship `oklch()`. */
function oklabToRgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  return [clamp255(srgbFromLinear(r) * 255), clamp255(srgbFromLinear(g) * 255), clamp255(srgbFromLinear(bl) * 255)]
}

function hslToRgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360
  const ss = s / 100
  const ll = l / 100
  const c = (1 - Math.abs(2 * ll - 1)) * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = ll - c / 2
  const seg = Math.floor(hh / 60) % 6
  const table = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ]
  const [r, g, b] = table[seg]
  return [clamp255((r + m) * 255), clamp255((g + m) * 255), clamp255((b + m) * 255)]
}

/** Split a functional colour's arguments, tolerating both legacy and modern syntax. */
function args(inner) {
  return inner
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .map(t => t.trim())
    .filter(Boolean)
}

const num = t => {
  if (typeof t !== 'string') return NaN
  if (t.endsWith('%')) return parseFloat(t)
  return parseFloat(t)
}

/**
 * Parse any CSS colour literal to `{ rgb: [r,g,b], format }`, or `null` when the
 * token is not a colour. Returns `{ unresolved: true }` for forms whose value
 * cannot be determined statically (`color-mix()`, `var()` chains) so callers can
 * decide how strict to be rather than silently passing them.
 */
export function parseColour(raw) {
  if (typeof raw !== 'string') return null
  const value = raw.trim().toLowerCase()
  if (value === '') return null
  if (ALLOWED_KEYWORDS.has(value)) return { keyword: true, format: 'keyword' }
  if (NAMED_COLOURS[value]) return { rgb: NAMED_COLOURS[value], format: 'named' }

  const hex = value.match(/^#([0-9a-f]{3,8})$/)
  if (hex) {
    const h = hex[1]
    const expand = c => parseInt(c + c, 16)
    if (h.length === 3 || h.length === 4) {
      return { rgb: [expand(h[0]), expand(h[1]), expand(h[2])], format: 'hex' }
    }
    if (h.length === 6 || h.length === 8) {
      return {
        rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)],
        format: 'hex',
      }
    }
    return null
  }

  const fn = value.match(/^([a-z-]+)\((.*)\)$/s)
  if (!fn) return null
  const [, name, inner] = fn

  // Statically unresolvable: report rather than guess.
  if (name === 'color-mix' || inner.includes('var(')) {
    return { unresolved: true, format: name }
  }

  const parts = args(inner)
  switch (name) {
    case 'rgb':
    case 'rgba': {
      const [r, g, b] = parts
      const conv = t => (String(t).endsWith('%') ? clamp255((num(t) / 100) * 255) : clamp255(num(t)))
      if ([r, g, b].some(t => t === undefined || Number.isNaN(num(t)))) return null
      return { rgb: [conv(r), conv(g), conv(b)], format: 'rgb' }
    }
    case 'hsl':
    case 'hsla': {
      const [h, s, l] = parts
      if ([h, s, l].some(t => t === undefined || Number.isNaN(num(t)))) return null
      return { rgb: hslToRgb(num(h), num(s), num(l)), format: 'hsl' }
    }
    case 'oklch': {
      const [L, C, H] = parts
      if ([L, C, H].some(t => t === undefined || Number.isNaN(num(t)))) return null
      const lightness = String(L).endsWith('%') ? num(L) / 100 : num(L)
      const hueRad = (num(H) * Math.PI) / 180
      return {
        rgb: oklabToRgb(lightness, num(C) * Math.cos(hueRad), num(C) * Math.sin(hueRad)),
        format: 'oklch',
      }
    }
    case 'oklab': {
      const [L, a, b] = parts
      if ([L, a, b].some(t => t === undefined || Number.isNaN(num(t)))) return null
      const lightness = String(L).endsWith('%') ? num(L) / 100 : num(L)
      return { rgb: oklabToRgb(lightness, num(a), num(b)), format: 'oklab' }
    }
    default:
      return null
  }
}

const COLOUR_LITERAL_RE =
  /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch|oklab|color-mix)\([^()]*(?:\([^()]*\)[^()]*)*\)/gi

/** Every colour literal in a CSS (or JSX) string, in source order. */
export function extractColourLiterals(css) {
  return (css.match(COLOUR_LITERAL_RE) ?? []).map(raw => raw.trim())
}

/**
 * Tailwind arbitrary colour values written in class names —
 * `bg-[#ff0000]`, `text-[oklch(0.7_0.1_140)]`, `border-[rgb(1_2_3)]`.
 * These never reach a stylesheet the CSS scanner sees until build time, so they
 * are extracted from source separately.
 */
export function extractTailwindArbitraryColours(source) {
  const found = []
  const re = /-\[((?:#|rgba?\(|hsla?\(|oklch\(|oklab\(|color-mix\()[^\]]*)\]/gi
  let m
  while ((m = re.exec(source)) !== null) {
    found.push(m[1].replace(/_/g, ' ').trim())
  }
  return found
}

/** `--foo: <colour>` declarations. Non-colour custom properties are ignored. */
export function extractColourBearingCustomProperties(css) {
  const out = []
  const re = /(--[a-z0-9-]+)\s*:\s*([^;{}]+)[;}]/gi
  let m
  while ((m = re.exec(css)) !== null) {
    const [, name, rawValue] = m
    const value = rawValue.trim()
    const parsed = parseColour(value)
    if (parsed) {
      out.push({ name, value, parsed })
      continue
    }
    // A value that *contains* a colour literal (e.g. a shadow) still carries colour.
    const literals = extractColourLiterals(value)
    if (literals.length > 0) {
      out.push({ name, value, literals })
    }
  }
  return out
}

const key = rgb => rgb.join(',')

/** Build the approved RGB set from the frozen source stylesheet. */
export function buildApprovedPalette(approvedCss) {
  const approved = new Set()
  for (const literal of extractColourLiterals(approvedCss)) {
    const parsed = parseColour(literal)
    if (parsed?.rgb) approved.add(key(parsed.rgb))
  }
  for (const [, rgb] of Object.entries(NAMED_COLOURS)) approved.add(key(rgb))
  return approved
}

/**
 * Audit one source for unapproved colour.
 *
 * `strictUnresolved` fails on `color-mix()` and `var()`-containing colour
 * functions. Those can be legitimate (an alias chain ending at an approved
 * token) but cannot be proven statically, so they are surfaced rather than
 * assumed either way.
 */
export function auditColours({ css, label, approved, strictUnresolved = false }) {
  const findings = []
  const seen = new Set()

  for (const literal of extractColourLiterals(css)) {
    if (seen.has(literal)) continue
    seen.add(literal)
    const parsed = parseColour(literal)
    if (!parsed) continue
    if (parsed.unresolved) {
      if (strictUnresolved) {
        findings.push(`${label}: colour "${literal}" cannot be resolved statically (${parsed.format})`)
      }
      continue
    }
    if (parsed.rgb && !approved.has(key(parsed.rgb))) {
      findings.push(
        `${label}: unapproved colour "${literal}" → rgb(${parsed.rgb.join(', ')}) is not in the doc 05 palette`,
      )
    }
  }

  return findings
}

/** Audit Tailwind arbitrary colour values found in component source. */
export function auditTailwindArbitrary({ source, label, approved }) {
  const findings = []
  for (const raw of extractTailwindArbitraryColours(source)) {
    const parsed = parseColour(raw)
    if (!parsed) {
      findings.push(`${label}: Tailwind arbitrary value "[${raw}]" is not a parseable colour`)
      continue
    }
    if (parsed.unresolved) {
      findings.push(`${label}: Tailwind arbitrary colour "[${raw}]" cannot be resolved statically`)
      continue
    }
    if (parsed.rgb && !approved.has(key(parsed.rgb))) {
      findings.push(
        `${label}: unapproved Tailwind arbitrary colour "[${raw}]" → rgb(${parsed.rgb.join(', ')})`,
      )
    }
  }
  return findings
}
