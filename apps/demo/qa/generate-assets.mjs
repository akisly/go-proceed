/**
 * Regenerates every asset apps/demo ships that is *derived* from something
 * else: the two Evidence Atlas image derivatives, favicon.ico, and the
 * static package PDF. Committed and re-runnable — re-run this whenever the
 * source PNGs (design-references/evidence-atlas/assets/*.png, read-only,
 * never shipped as-is) or the /demo journey's final "package" step change.
 *
 * Usage: node qa/generate-assets.mjs [--skip-pdf]
 * (--skip-pdf is for local iteration on the images/favicon only; the
 * committed asset set always needs a full run before shipping.)
 *
 * RULING 1 (task 17 controller ruling) — why this uses puppeteer's Chrome
 * as an image encoder rather than a CLI tool:
 * This host has no cwebp, avifenc, magick, convert or ffmpeg, and macOS's
 * built-in `sips` has no WebP support. `sharp` is not installed, and the
 * task's global constraints forbid adding a new dependency to encode
 * images. `puppeteer` (full, self-managing Chrome) is already a
 * devDependency for the QA harness (qa/browser.mjs), and its bundled
 * Chrome can encode WebP from a <canvas> via
 * `canvas.toDataURL('image/webp', quality)` — verified working below.
 * AVIF is deliberately NOT produced: the same canvas call for
 * 'image/avif' silently falls back to PNG in this Chrome build (asserted
 * below, at generation time, not just claimed in a comment) — Chrome for
 * Testing has no AVIF *encoder*, only a decoder. Shipping a `.avif` file
 * that is secretly a re-labelled PNG would be worse than not shipping one
 * (a broken/oversized "AVIF" nobody asked to debug), and adding a real
 * AVIF encoder dependency for its marginal gain over WebP here is not
 * justified for two backgrounds under a 1.5MB page budget.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import { createServer } from 'vite'
import { launch } from './browser.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEMO_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(DEMO_ROOT, '../..')
const PUBLIC_DIR = path.join(DEMO_ROOT, 'public')
const SKIP_PDF = process.argv.includes('--skip-pdf')

const MAX_ASSET_BYTES = 400 * 1024 // RULING 2's per-asset hard constraint

// -----------------------------------------------------------------------
// Phase 1: Evidence Atlas WebP derivatives.
//
// RULING 2 — apps/demo/src/styles.css (frozen, deletion-only, never
// edited) references these two PNGs directly via `url()` in ~11
// `background-image` declarations. Measured before choosing between the
// two legitimate routes the ruling names: a PNG re-encode at any width
// that clears the 400KB budget was already too small to serve as a
// full-bleed cover background (533-612KB even downsized to 640px wide —
// see task-17-report.md's Step 1 measurement table), while WebP clears
// the budget by 2-3x *at full native resolution* (both sources are
// already a modest 1586x992 — no upscale, no downscale, no quality loss
// beyond WebP's own encoding). So this ships WebP derivatives and
// apps/demo/src/styles/demo.css (NOT frozen) overrides the affected
// `background-image` declarations to point at them instead.
// -----------------------------------------------------------------------
const IMAGE_DERIVATIVES = [
  {
    src: path.join(REPO_ROOT, 'design-references/evidence-atlas/assets/blueprint-folio.png'),
    out: path.join(PUBLIC_DIR, 'assets/evidence-atlas/blueprint-folio.webp'),
  },
  {
    src: path.join(REPO_ROOT, 'design-references/evidence-atlas/assets/cable-tray-evidence.png'),
    out: path.join(PUBLIC_DIR, 'assets/evidence-atlas/cable-tray-evidence.webp'),
  },
]
const WEBP_QUALITY = 0.85

async function encodeWebp(page, srcPath) {
  await page.goto(`file://${srcPath}`, { waitUntil: 'load' })
  const dataUrl = await page.evaluate(async quality => {
    const img = document.querySelector('img')
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d').drawImage(img, 0, 0)
    return canvas.toDataURL('image/webp', quality)
  }, WEBP_QUALITY)
  if (!dataUrl.startsWith('data:image/webp')) {
    throw new Error(`generate-assets: Chrome did not encode WebP for ${srcPath} (got prefix ${dataUrl.slice(0, 24)})`)
  }
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
}

async function probeAvifSupport(page) {
  await page.setContent('<canvas id="c" width="4" height="4"></canvas>')
  const dataUrl = await page.evaluate(() => {
    const canvas = document.getElementById('c')
    canvas.getContext('2d').fillRect(0, 0, 4, 4)
    return canvas.toDataURL('image/avif', 0.8)
  })
  return dataUrl.startsWith('data:image/avif')
}

// -----------------------------------------------------------------------
// Phase 2: favicon.ico.
//
// RULING 5 — the QA harness reports /favicon.ico missing and index.html
// declared no icon. Drawn to match `.brand__mark` (apps/demo/src/styles.css
// lines ~43-46) rather than inventing a new mark: Lime (--signal, #c6ff34)
// rounded square, two Carbon (--ink, #171717) bars — same colour pair,
// same two-bar motif, simplified to read cleanly at 16x16 (the CSS mark's
// -4deg rotation and per-corner radius asymmetry are dropped at small
// sizes; both survive at 48x48).
// -----------------------------------------------------------------------
const FAVICON_SIZES = [16, 32, 48]
const LIME = '#c6ff34'
const CARBON = '#171717'

async function drawFaviconPng(page, size) {
  await page.setContent(`<canvas id="c" width="${size}" height="${size}"></canvas>`)
  const dataUrl = await page.evaluate(
    (size, lime, carbon) => {
      const canvas = document.getElementById('c')
      const ctx = canvas.getContext('2d')
      const r = size * 0.3
      const rSmall = size * 0.07
      ctx.fillStyle = lime
      ctx.beginPath()
      ctx.roundRect(0, 0, size, size, [r, r, rSmall, r])
      ctx.fill()
      ctx.fillStyle = carbon
      const barW = size * 0.46
      const barH = Math.max(1, size * 0.11)
      const barX = (size - barW) / 2
      const gap = size * 0.19
      const cy = size / 2
      const radius = barH / 2
      ctx.beginPath()
      ctx.roundRect(barX, cy - gap - barH / 2, barW, barH, radius)
      ctx.fill()
      ctx.beginPath()
      ctx.roundRect(barX, cy + gap - barH / 2, barW, barH, radius)
      ctx.fill()
      return canvas.toDataURL('image/png')
    },
    size,
    LIME,
    CARBON,
  )
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
}

/** Minimal ICO container wrapping PNG-compressed images (Vista+, all modern browsers/OSes). */
function buildIco(images) {
  const count = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  let offset = 6 + 16 * count
  const dirEntries = []
  const dataBuffers = []
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    dirEntries.push(entry)
    dataBuffers.push(png)
  }
  return Buffer.concat([header, ...dirEntries, ...dataBuffers])
}

// -----------------------------------------------------------------------
// Phase 3: static package PDF (RULING 4).
//
// There is no PDF library in the dependency set and Cyrillic font
// embedding is out of scope, so the PDF is a pre-rendered static file:
// puppeteer's page.pdf() printing the /demo journey's own final "package"
// step, live off the running app — not hand-authored content. This means
// every honesty guarantee the step already has (claims scrubbing via
// tests/claims.test.ts + qa/forbidden-claims.mjs, the «Приклад-*» synthetic
// naming in src/data/project.ts, the non-dismissible disclosure strip)
// carries over automatically, because it IS that rendered page.
//
// Served from vite's own dev server (not a `dist/` build) so this script
// can run standalone before any build step — `pnpm build` afterwards picks
// up the finished PDF from public/ like any other static asset.
// -----------------------------------------------------------------------
async function generatePdf(browser) {
  const server = await createServer({
    root: DEMO_ROOT,
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'error',
  })
  await server.listen()
  const address = server.httpServer?.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    const page = await browser.newPage()
    await page.goto(`${baseUrl}/demo`, { waitUntil: 'networkidle0' })

    // Walk to the journey's final "package" step the same way qa/verify.mjs's
    // auditJourney does: click the "Далі" control until aria-current lands
    // on the last progress item.
    const stepCount = await page.$$eval('.demo-progress li', els => els.length)
    for (let i = 0; i < stepCount - 1; i++) {
      await page.click('.onboarding-footer button.button--dark')
      const targetIndex = i + 1
      await page.waitForFunction(
        expectedIndex =>
          Array.from(document.querySelectorAll('.demo-progress li')).findIndex(
            el => el.getAttribute('aria-current') === 'step',
          ) === expectedIndex,
        {},
        targetIndex,
      )
    }
    const finalStepId = await page.$eval('section[data-step]', el => el.getAttribute('data-step'))
    if (finalStepId !== 'package') {
      throw new Error(`generate-assets: expected to land on the "package" step, got "${finalStepId}"`)
    }

    const pdfPath = path.join(PUBLIC_DIR, 'package-demo.pdf')
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    })
    await page.close()
    return pdfPath
  } finally {
    await server.close()
  }
}

// -----------------------------------------------------------------------
// PDF verification: "confirm the Cyrillic actually renders" (RULING 4)
// means extracting the text back out of the PDF bytes and checking it,
// not eyeballing a screenshot. Chrome's print-to-PDF (Skia/PDF) embeds a
// Type0/CIDFontType2 subset per typeface with an Identity-H content
// encoding plus a `/ToUnicode` CMap stream (bfchar/bfrange) — the same
// mechanism that lets a human select/copy text from the file in a normal
// PDF viewer. This walks that structure directly with Node's built-in
// zlib (PDF's FlateDecode is plain zlib deflate) — no PDF library needed.
// -----------------------------------------------------------------------
function inflate(buf) {
  try {
    return zlib.inflateSync(buf)
  } catch {
    return zlib.inflateSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH })
  }
}

function parseToUnicodeCMap(text) {
  const map = new Map()
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const code = parseInt(pair[1], 16)
      let str = ''
      for (let i = 0; i < pair[2].length; i += 4) str += String.fromCharCode(parseInt(pair[2].slice(i, i + 4), 16))
      map.set(code, str)
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]/g)) {
      const lo = parseInt(m[1], 16)
      const hexes = [...m[3].matchAll(/<([0-9a-fA-F]+)>/g)].map(x => x[1])
      hexes.forEach((h, i) => {
        let str = ''
        for (let j = 0; j < h.length; j += 4) str += String.fromCharCode(parseInt(h.slice(j, j + 4), 16))
        map.set(lo + i, str)
      })
    }
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const lo = parseInt(m[1], 16)
      const hi = parseInt(m[2], 16)
      const startCode = parseInt(m[3], 16)
      for (let c = lo; c <= hi; c++) map.set(c, String.fromCharCode(startCode + (c - lo)))
    }
  }
  return map
}

// codeBytes: how many bytes make up one character code in this font's
// content-stream hex strings. Identity-H composite fonts (/Subtype
// /Type0, the case a generic sans-serif like Helvetica produces) use
// 2-byte codes. Simple fonts — including the /Subtype /Type3 fonts Skia
// emits here for the app's variable web fonts (Inter/Manrope; Skia cannot
// subset a variable TrueType font as a normal CIDFontType2, so it falls
// back to per-glyph vector Type3 procedures) — use single-byte codes.
function decodeHexRun(hex, font) {
  if (!font) return ''
  const step = font.codeBytes * 2
  let out = ''
  for (let i = 0; i < hex.length; i += step) out += font.map.get(parseInt(hex.slice(i, i + step), 16)) ?? ''
  return out
}

/**
 * Given `text[openIdx..]` starting at a `<<`, returns the index just past
 * its matching `>>` (nesting-aware). PDF resource dictionaries nest
 * (Resources -> Font/XObject/ExtGState/Pattern, each its own `<<...>>`),
 * so a plain non-greedy `<<([\s\S]*?)>>` regex stops at the *first* inner
 * `>>` it meets rather than the outer dictionary's own close — this was
 * the actual bug behind the first attempt at this extractor coming back
 * empty (it was reading only the ExtGState sub-dict and never reaching
 * /Font at all).
 */
function matchingDictEnd(text, openIdx) {
  let depth = 0
  for (let i = openIdx; i < text.length - 1; i++) {
    if (text[i] === '<' && text[i + 1] === '<') {
      depth++
      i++
    } else if (text[i] === '>' && text[i + 1] === '>') {
      depth--
      i++
      if (depth === 0) return i + 1
    }
  }
  return -1
}

/** Finds `/Key <<...>>` anywhere in `text` and returns the inner dict body, nesting-aware. */
function extractSubDict(text, key) {
  const keyMatch = text.match(new RegExp(`\\/${key}\\s*(<<)`))
  if (!keyMatch || keyMatch.index === undefined) return null
  const openIdx = keyMatch.index + keyMatch[0].length - 2
  const endIdx = matchingDictEnd(text, openIdx)
  if (endIdx === -1) return null
  return text.slice(openIdx + 2, endIdx - 2)
}

function extractPdfText(data) {
  const text = data.toString('latin1')

  // Locate every indirect object, splitting streams from plain dicts.
  // (Non-greedy dict regexes across the whole file mis-span object
  // boundaries when a dict has no stream — walking `N 0 obj` -> next
  // `endobj` per-object avoids that.)
  const objStartRe = /(\d+)\s+0\s+obj\s*/g
  const starts = []
  let m
  while ((m = objStartRe.exec(text))) starts.push({ num: Number(m[1]), bodyStart: objStartRe.lastIndex })

  const objects = new Map() // objNum -> dict text
  const streams = new Map() // objNum -> decoded Buffer
  for (const { num, bodyStart } of starts) {
    const endobjIdx = text.indexOf('endobj', bodyStart)
    if (endobjIdx === -1) continue
    const body = text.slice(bodyStart, endobjIdx)
    const streamKwIdx = body.indexOf('stream')
    if (streamKwIdx === -1) {
      objects.set(num, body)
      continue
    }
    const dict = body.slice(0, streamKwIdx)
    objects.set(num, dict)
    let dataStart = bodyStart + streamKwIdx + 'stream'.length
    if (text[dataStart] === '\r') dataStart++
    if (text[dataStart] === '\n') dataStart++
    const dataEndIdx = text.indexOf('endstream', dataStart)
    if (dataEndIdx === -1) continue
    let raw = data.subarray(dataStart, dataEndIdx)
    if (raw[raw.length - 1] === 0x0a) raw = raw.subarray(0, raw.length - 1)
    if (raw[raw.length - 1] === 0x0d) raw = raw.subarray(0, raw.length - 1)
    if (/\/Filter\s*\/FlateDecode/.test(dict)) {
      try {
        streams.set(num, inflate(raw))
      } catch {
        // not a text-bearing stream we need (e.g. an image XObject) — skip
      }
    } else {
      streams.set(num, raw)
    }
  }

  const fontCMaps = new Map() // font obj num -> { map, codeBytes }
  for (const [num, dict] of objects) {
    const subtypeMatch = dict.match(/\/Subtype\s*\/(Type0|Type3)\b/)
    if (!subtypeMatch) continue
    const tu = dict.match(/\/ToUnicode\s+(\d+)\s+0\s+R/)
    if (!tu) continue
    const stream = streams.get(Number(tu[1]))
    if (!stream) continue
    const map = parseToUnicodeCMap(stream.toString('latin1'))
    const codeBytes = subtypeMatch[1] === 'Type0' ? 2 : 1
    fontCMaps.set(num, { map, codeBytes })
  }

  let fullText = ''
  for (const [, dict] of objects) {
    if (!/\/Type\s*\/Page\b/.test(dict)) continue
    const resBody = extractSubDict(dict, 'Resources')
    const fontNameToObj = new Map()
    if (resBody) {
      const fontBody = extractSubDict(resBody, 'Font')
      if (fontBody) {
        for (const e of fontBody.matchAll(/\/(\w+)\s+(\d+)\s+0\s+R/g)) fontNameToObj.set(e[1], Number(e[2]))
      }
    }
    const contentsMatch = dict.match(/\/Contents\s+(\d+)\s+0\s+R/)
    if (!contentsMatch) continue
    const content = streams.get(Number(contentsMatch[1]))
    if (!content) continue
    const contentText = content.toString('latin1')

    let activeFont = null
    const tokenRe = /\/(\w+)\s+[\d.]+\s+Tf|<([0-9a-fA-F]*)>\s*Tj|\[((?:<[0-9a-fA-F]*>|[^\]])*)\]\s*TJ/g
    let t
    while ((t = tokenRe.exec(contentText))) {
      if (t[1] !== undefined) {
        const fontObjNum = fontNameToObj.get(t[1])
        activeFont = fontObjNum !== undefined ? (fontCMaps.get(fontObjNum) ?? null) : null
      } else if (t[2] !== undefined) {
        fullText += decodeHexRun(t[2], activeFont)
      } else if (t[3] !== undefined) {
        for (const h of t[3].matchAll(/<([0-9a-fA-F]*)>/g)) fullText += decodeHexRun(h[1], activeFont)
      }
    }
    fullText += '\n'
  }
  return fullText
}

// Known Ukrainian strings that must survive the round trip: the
// non-dismissible disclosure strip (RULING 4's "same synthetic-data
// disclosure the site does") plus the package step's own heading and the
// «Приклад-*» synthetic org names (src/data/project.ts) — never a real or
// plausible-sounding company.
const REQUIRED_PDF_SUBSTRINGS = [
  'Демонстраційний прототип',
  'синтетичні дані',
  'без клієнтів',
  'Пакет періоду',
  'Приклад-Північ',
  'Приклад-Буд',
]

async function verifyPdfCyrillic(pdfPath) {
  const data = await readFile(pdfPath)
  const extracted = extractPdfText(data)
  const missing = REQUIRED_PDF_SUBSTRINGS.filter(s => !extracted.includes(s))
  if (missing.length > 0) {
    console.error('--- extracted PDF text ---')
    console.error(extracted)
    throw new Error(
      `generate-assets: PDF Cyrillic verification failed — missing substring(s) after text extraction: ${missing.join(', ')}`,
    )
  }
  return extracted
}

// -----------------------------------------------------------------------
async function main() {
  const browser = await launch()
  try {
    const page = await browser.newPage()

    console.log('--- image derivatives ---')
    for (const { src, out } of IMAGE_DERIVATIVES) {
      const buf = await encodeWebp(page, src)
      if (buf.byteLength > MAX_ASSET_BYTES) {
        throw new Error(`generate-assets: ${out} is ${buf.byteLength} bytes, over the ${MAX_ASSET_BYTES}-byte budget`)
      }
      await mkdir(path.dirname(out), { recursive: true })
      await writeFile(out, buf)
      console.log(`  wrote ${path.relative(PUBLIC_DIR, out)} (${(buf.byteLength / 1024).toFixed(1)}KB)`)
    }

    // A fresh page/tab: the loop above left `page` navigated to a raw
    // image file (file://…png), and Chrome's built-in image-preview
    // document does not reliably accept a subsequent setContent() call.
    await page.close()
    const page2 = await browser.newPage()
    const avifSupported = await probeAvifSupport(page2)
    console.log(`\n--- AVIF probe --- Chrome for Testing AVIF encoder available: ${avifSupported}`)
    if (avifSupported) {
      console.log('  (unexpected — re-evaluate shipping AVIF derivatives; see RULING 1 in this file header)')
    } else {
      console.log('  confirms RULING 1: canvas.toDataURL("image/avif") falls back silently; no AVIF shipped.')
    }

    console.log('\n--- favicon.ico ---')
    const faviconImages = []
    for (const size of FAVICON_SIZES) {
      const png = await drawFaviconPng(page2, size)
      faviconImages.push({ size, png })
    }
    const ico = buildIco(faviconImages)
    await writeFile(path.join(PUBLIC_DIR, 'favicon.ico'), ico)
    console.log(`  wrote favicon.ico (${(ico.byteLength / 1024).toFixed(1)}KB, sizes ${FAVICON_SIZES.join('/')})`)

    await page2.close()

    if (SKIP_PDF) {
      console.log('\n--skip-pdf passed: leaving public/package-demo.pdf untouched.')
    } else {
      console.log('\n--- package-demo.pdf ---')
      const pdfPath = await generatePdf(browser)
      const stat = await readFile(pdfPath)
      console.log(`  wrote ${path.relative(PUBLIC_DIR, pdfPath)} (${(stat.byteLength / 1024).toFixed(1)}KB)`)
      const extracted = await verifyPdfCyrillic(pdfPath)
      console.log(`  Cyrillic verification passed — all ${REQUIRED_PDF_SUBSTRINGS.length} required substrings extracted.`)
      console.log(`  (${extracted.replace(/\s+/g, ' ').trim().length} chars of text extracted total)`)
    }
  } finally {
    await browser.close()
  }
}

await main()
