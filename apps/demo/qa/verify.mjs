import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { launch } from './browser.mjs'
import { REDIRECTED_ROUTES, SHIPPED_ROUTES } from './routes.mjs'
import { FORBIDDEN_CLAIM_PATTERNS } from './forbidden-claims.mjs'
import { PLACEHOLDER_TOKEN_PATTERN_GLOBAL } from './placeholder-tokens.mjs'
import { auditColours, buildApprovedPalette } from './colour-audit.mjs'

// FINDING 1: every generated artifact lands here, and this directory is
// gitignored. A QA run must leave `git status` clean. prototype/ writes 19
// tracked PNGs plus qa-results.json on every run; apps/demo must not.
const OUTPUT = path.resolve('qa-output')
const SHOTS = path.join(OUTPUT, 'screenshots')
const DIST = path.resolve('dist')
const UPDATE_BASELINES = process.argv.includes('--update-baselines')

await rm(OUTPUT, { recursive: true, force: true })
await mkdir(SHOTS, { recursive: true })

// -----------------------------------------------------------------------
// Static file server for dist/ — SPA fallback for routes, real 404s for
// assets. Every unknown *route* (no dot in the last path segment) must
// reach index.html so the client router can render it (including its own
// redirect-to-/demo catch-all). A genuinely missing *asset* (a dot in the
// last segment, e.g. .png/.pdf/.ico) must still 404 — an over-broad
// fallback would make Step 3's 404 accounting and RULING 3's missing-asset
// count meaningless (every 404 would silently become a 200 for index.html).
// -----------------------------------------------------------------------
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function looksLikeAssetPath(pathname) {
  const lastSegment = pathname.split('/').pop() ?? ''
  return lastSegment.includes('.')
}

async function startServer(distDir) {
  const server = createServer((req, res) => {
    void (async () => {
      try {
        const requestUrl = new URL(req.url ?? '/', 'http://internal')
        let pathname = decodeURIComponent(requestUrl.pathname)
        if (pathname === '/') pathname = '/index.html'
        const filePath = path.join(distDir, pathname)
        if (!filePath.startsWith(distDir)) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }
        try {
          const data = await readFile(filePath)
          res.writeHead(200, { 'Content-Type': contentTypeFor(filePath) })
          res.end(data)
        } catch {
          if (looksLikeAssetPath(pathname)) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('Not found')
            return
          }
          const indexHtml = await readFile(path.join(distDir, 'index.html'))
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(indexHtml)
        }
      } catch (err) {
        res.writeHead(500)
        res.end(String(err))
      }
    })()
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      server.closeAllConnections?.()
      await new Promise(resolve => server.close(resolve))
    },
  }
}

// -----------------------------------------------------------------------
// Diagnostics: one page per audit, console/pageerror/response listeners
// attached for its whole lifetime, torn down with the page.
// -----------------------------------------------------------------------
async function withPage(browser, task) {
  const page = await browser.newPage()
  const consoleErrors = []
  const pageErrors = []
  const notFound = []
  page.on('console', msg => {
    if (msg.type() !== 'error') return
    consoleErrors.push({ text: msg.text(), url: msg.location()?.url ?? null })
  })
  page.on('pageerror', err => pageErrors.push(String(err)))
  page.on('response', res => {
    if (res.status() === 404) notFound.push(res.url())
  })
  try {
    await task(page)
  } finally {
    await page.close()
  }
  return { consoleErrors, pageErrors, notFound }
}

// RULING 3: a genuinely missing asset (Task 17 has not shipped
// /package-demo.pdf, and styles.css's frozen background-image references
// under /assets/evidence-atlas/ have no derivative files yet) 404s, and
// Chrome logs that 404 to the console as an "error"-typed message. That is
// real, expected, already-known breakage — not a defect this harness
// exists to catch — so it is bucketed into `missingAssets`, counted and
// named, rather than either silently ignored (which would hide a real gap)
// or left to fail the zero-console-error gate (which would block on a
// defect this task is explicitly told not to chase). Any OTHER console
// error, page error, or unexpected (non-asset) 404 is a genuine finding.
/**
 * Step zero of the dashboard rewrite: audit the colour that actually SHIPS.
 *
 * tests/palette.test.ts guards authored source. This guards the built bundle —
 * the only place a Tailwind/shadcn theme's generated colour becomes visible,
 * because utilities and theme layers do not exist as authored CSS. Without it a
 * colour could enter through a class name or a plugin default and reach a real
 * page while every source-level check stayed green.
 */
async function auditGeneratedCss(findings) {
  const approvedCss = await readFile(path.resolve('../../prototype/src/styles.css'), 'utf8')
  const approved = buildApprovedPalette(approvedCss)
  const assetsDir = path.join(DIST, 'assets')
  let entries
  try {
    entries = await readdir(assetsDir)
  } catch {
    findings.push('generated CSS: dist/assets is missing — was the build run?')
    return
  }
  const sheets = entries.filter(f => f.endsWith('.css'))
  if (sheets.length === 0) {
    findings.push('generated CSS: no .css emitted into dist/assets')
    return
  }
  for (const sheet of sheets) {
    const css = await readFile(path.join(assetsDir, sheet), 'utf8')
    findings.push(...auditColours({ css, label: `dist/assets/${sheet}`, approved }))
  }
}

const ASSET_404_RE = /\.(png|jpe?g|gif|webp|svg|pdf|ico)$/i

function classifyDiagnostics(label, diagnostics, findings, missingAssetCounts) {
  const { consoleErrors, pageErrors, notFound } = diagnostics
  const missingAssetUrls = new Set()
  for (const url of notFound) {
    let pathname
    try {
      pathname = new URL(url).pathname
    } catch {
      pathname = url
    }
    if (ASSET_404_RE.test(pathname)) {
      missingAssetUrls.add(url)
      missingAssetCounts.set(url, (missingAssetCounts.get(url) ?? 0) + 1)
    } else {
      findings.push(`${label}: unexpected 404 for ${url}`)
    }
  }
  for (const err of consoleErrors) {
    if (err.url && missingAssetUrls.has(err.url)) continue
    findings.push(`${label}: console error: ${err.text}`)
  }
  for (const err of pageErrors) {
    findings.push(`${label}: uncaught page error: ${err}`)
  }
}

function slugRoute(route) {
  if (route === '/') return 'root'
  return route.replace(/^\//, '').replace(/\//g, '-')
}

// -----------------------------------------------------------------------
// Step 3 + RULING 2: every shipped route renders, has zero genuine console
// errors, carries the disclosure strip and exactly one <h1>, and — for the
// two routes whose headline number is a direct readout of the dataset —
// the number on screen matches src/data/project.ts exactly.
// -----------------------------------------------------------------------
/** WCAG relative luminance from a computed `rgb(r, g, b)` string. */
function luminance(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map(Number)
  const channel = c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * WCAG 2.x contrast ratio between two computed `rgb(...)` strings.
 * Lives here rather than in a unit test because it needs real computed
 * styles from a rendered page, which the node-only vitest env cannot produce.
 */
function contrastRatio(foreground, background) {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

async function auditShippedRoute(browser, baseUrl, route, ctx) {
  const url = `${baseUrl}${route}`
  const diagnostics = await withPage(browser, async page => {
    // Audit at an explicit desktop width. Previously this inherited
    // puppeteer's incidental 800x600 default — neither the desktop layout
    // (>=1240px rail + full table) nor the mobile one (<768px cards), so every
    // measurement here was taken at a width the design never targets. The
    // dedicated 360x800 responsive pass below covers the narrow case.
    await page.setViewport({ width: 1440, height: 900 })
    const response = await page.goto(url, { waitUntil: 'networkidle0' })
    if (!response || response.status() !== 200) {
      ctx.findings.push(`${route}: expected HTTP 200, got ${response ? response.status() : 'no response'}`)
    }

    const bodyText = await page.evaluate(() => document.body.innerText.trim())
    if (bodyText.length === 0) {
      ctx.findings.push(`${route}: body rendered no visible text`)
    }

    const disclosureCount = await page.$$eval('[data-testid="disclosure-strip"]', els => els.length)
    if (disclosureCount !== 1) {
      ctx.findings.push(`${route}: expected exactly 1 disclosure strip, found ${disclosureCount}`)
    }

    const h1Count = await page.$$eval('h1', els => els.length)
    if (h1Count !== 1) {
      ctx.findings.push(`${route}: expected exactly 1 <h1>, found ${h1Count}`)
    }

    /*
     * A class attribute containing source code means a function-valued
     * `className` reached the DOM as a string.
     *
     * How it happens: react-router's NavLink accepts `className` (and
     * `children`) as a function of `{ isActive }`, while Radix `asChild`
     * MERGES props onto its child and merges `className` by string
     * concatenation. Wrap a function-className NavLink in a Slot — a
     * TooltipTrigger, a Button asChild — and the arrow function is stringified
     * into the class attribute. React does not warn; TypeScript cannot see it,
     * because both prop types are individually valid.
     *
     * It shipped once, in the rail's tooltip range (768-1240px), and survived
     * a full-page screenshot AND a bounding-box probe, because a class
     * attribute is a token list and most Tailwind names inside the stringified
     * source are still valid tokens. Only the ones touching a quote or comma
     * were dropped — which happened to include both branches of the
     * active/inactive colour ternary, so the active nav item silently lost
     * every colour cue while everything still looked laid out.
     *
     * Hence a structural check rather than a visual one: no rendered class
     * attribute may contain `=>`, `function`, `{` or `;`. Cheap, and it covers
     * every component on every route, not just the one that was caught.
     */
    const codeInClass = await page.evaluate(() =>
      [...document.querySelectorAll('[class]')]
        .map(el => ({ tag: el.tagName, cls: el.getAttribute('class') ?? '' }))
        .filter(el => /=>|\bfunction\b|[{};]/.test(el.cls))
        .map(el => `${el.tag}: ${el.cls.slice(0, 60).replace(/\s+/g, ' ')}…`))
    for (const found of codeInClass) {
      ctx.findings.push(
        `${route}: a class attribute contains source code — a function-valued className reached the DOM (${found})`,
      )
    }

    // RULING 2: /app/work must show 14 rows — PROJECT.workItems.length,
    // read live off the rendered table, not re-asserted against the source.
    if (route === '/app/work') {
      const rowCount = await page.$$eval('[data-work-register] [data-work-row]', els => els.length)
      if (rowCount !== 14) {
        ctx.findings.push(`/app/work: expected 14 rows (PROJECT.workItems.length), found ${rowCount}`)
      }
    }

    // RULING 2: /app/evidence must show 5 items with a blocking gap and 2
    // with only a non-blocking gap, in the default (unfiltered) view.
    if (route === '/app/evidence') {
      const blockingCount = await page.$$eval(
        '[data-evidence-group="blocking"] [data-evidence-item]',
        els => els.length,
      )
      const nonBlockingCount = await page.$$eval(
        '[data-evidence-group="non-blocking"] [data-evidence-item]',
        els => els.length,
      )
      if (blockingCount !== 5) {
        ctx.findings.push(`/app/evidence: expected 5 items with a blocking gap, found ${blockingCount}`)
      }
      if (nonBlockingCount !== 2) {
        ctx.findings.push(`/app/evidence: expected 2 items with only a non-blocking gap, found ${nonBlockingCount}`)
      }

      // FALSE-CONSEQUENCE GUARD, added after the rewrite shipped exactly this
      // bug for one build: every card in the blocking section carried the
      // clause «Ця конкретна вимога подання пакета не блокує», because the
      // qualifier was derived from the work item alone when it is really a fact
      // about which SECTION the card is in. The counts above were both correct
      // and green while the page told the reader the opposite of the truth.
      //
      // A word-level check is crude, but this is the one claim on the page that
      // must never invert, and «не блокує» cannot appear anywhere inside a
      // section titled "requirements that block submission".
      const falseNonBlockingClaims = await page.$$eval(
        '[data-evidence-group="blocking"] [data-evidence-item]',
        els =>
          els
            .filter(el => /не\s+блокує/u.test(el.textContent ?? ''))
            .map(el => (el.textContent ?? '').trim().slice(0, 40)),
      )
      for (const claim of falseNonBlockingClaims) {
        ctx.findings.push(
          `/app/evidence: a card in the BLOCKING section claims "не блокує" — "${claim}…"`,
        )
      }
    }

    // Review 07 · B1: the landing header's link colours were scoped to
    // `.landing` in the frozen stylesheet, which in the prototype sat on a
    // DARK hero. Task 11's claim scrub removed that treatment but kept the
    // class, inverting three of four links into unreadability.
    if (route === '/') {
      const headerLinks = await page.evaluate(() => {
        const header = document.querySelector('[data-site-header]')
        if (!header) return []
        const headerBg = getComputedStyle(header).backgroundColor
        const pageBg = getComputedStyle(document.body).backgroundColor
        const opaque = headerBg === 'rgba(0, 0, 0, 0)' ? pageBg : headerBg
        return [...header.querySelectorAll('a')].map(a => ({
          text: a.textContent.trim(),
          color: getComputedStyle(a).color,
          background: opaque,
        }))
      })
      if (headerLinks.length === 0) {
        ctx.findings.push('/: expected links in [data-site-header], found none')
      }
      for (const link of headerLinks) {
        const ratio = contrastRatio(link.color, link.background)
        if (ratio < 4.5) {
          ctx.findings.push(
            `/: header link "${link.text}" contrast ${ratio.toFixed(2)}:1 against ${link.background} (needs 4.5:1)`,
          )
        }
      }
    }

    // Review 07 · Cluster B: money had no tabular figures anywhere (measured
    // 11px column jitter between rows), and sat left-aligned at body weight in
    // a currency column an estimator scans. Figures must line up vertically.
    if (route === '/app/work' || route === '/app') {
      const money = await page.evaluate(() =>
        [...document.querySelectorAll('[data-money]')].map(el => {
          const cs = getComputedStyle(el)
          // Right-alignment is a property of the TABLE rendering only. Below
          // 768px the register renders as cards where the amount leads the
          // card (RULING 6), so it is correctly left-aligned there — scoping
          // this to [data-work-table] keeps the assertion true at every width
          // instead of only at the one it happens to run at.
          return { fvn: cs.fontVariantNumeric, align: cs.textAlign, inTable: !!el.closest('[data-work-table]') }
        }))
      if (money.length === 0) {
        ctx.findings.push(`${route}: expected [data-money] elements, found none`)
      }
      for (const cell of money) {
        if (!/tabular-nums/.test(cell.fvn)) {
          ctx.findings.push(`${route}: money is not tabular (font-variant-numeric: ${cell.fvn})`)
        }
        if (cell.inTable && cell.align !== 'right') {
          ctx.findings.push(`${route}: money in the work table is not right-aligned (${cell.align})`)
        }
      }

      // Assert the RESULT, not the property. `text-align: right` is inert on an
      // inline box, so the declaration can be present while the column is still
      // ragged — which is exactly what happened first time round.
      if (route === '/app/work') {
        const edges = await page.evaluate(() =>
          [...new Set([...document.querySelectorAll('[data-work-table] [data-money]')]
            .map(el => Math.round(el.getBoundingClientRect().right)))])
        if (edges.length === 0) {
          ctx.findings.push('/app/work: expected money cells inside [data-work-table], found none')
        } else if (edges.length > 1) {
          ctx.findings.push(`/app/work: money column has ${edges.length} different right edges (${edges.join(', ')})`)
        }
      }
    }

    // Review 07 · I1: 56 elements rendered at 9px on /app/work at desktop
    // width, while 390px measured zero — Task 15's >=16px floor reached the
    // mobile card view and never the desktop table. This runs at the pinned
    // 1440x900 audit viewport, which is where the defect lives.
    if (route === '/app/work' || route === '/app') {
      const tiny = await page.evaluate(() =>
        [...document.querySelectorAll('*')]
          .filter(el => el.children.length === 0 && el.textContent.trim())
          .map(el => ({ px: parseFloat(getComputedStyle(el).fontSize), cls: el.className || el.tagName }))
          .filter(el => el.px < 12))
      if (tiny.length > 0) {
        const worst = [...new Set(tiny.map(t => `${t.px}px ${t.cls}`))].slice(0, 3).join('; ')
        ctx.findings.push(`${route}: ${tiny.length} elements render below 12px (${worst})`)
      }
    }

    // Review 07 · B3: the readiness split rendered three hard-coded states
    // summing to 9 beside a denominator reading «з 14 рядків». Five of
    // fourteen rows were unrepresented. On a product whose only asset is
    // honesty about numbers, the parts must equal the whole.
    if (route === '/app') {
      const split = await page.evaluate(() => {
        const counts = [...document.querySelectorAll('[data-readiness-count]')]
          .map(el => Number(el.textContent.trim()))
        const denominator = document.body.innerText.match(/з\s*(\d+)\s*рядк/u)
        return {
          sum: counts.reduce((total, n) => total + n, 0),
          states: counts.length,
          denominator: denominator ? Number(denominator[1]) : null,
        }
      })
      if (split.states === 0) {
        ctx.findings.push('/app: expected [data-readiness-count] elements in the readiness split, found none')
      } else if (split.denominator !== null && split.sum !== split.denominator) {
        ctx.findings.push(
          `/app: readiness split sums to ${split.sum} across ${split.states} states but the denominator says ${split.denominator}`,
        )
      }
    }

    // Step 5: [data-testid="pilot-cta"] exists on /app.
    if (route === '/app') {
      const ctaCount = await page.$$eval('[data-testid="pilot-cta"]', els => els.length)
      if (ctaCount < 1) {
        ctx.findings.push('/app: expected [data-testid="pilot-cta"] to be present')
      }
    }

    // Dashboard rewrite: the rail is `position: sticky` and has to come to rest
    // directly under the disclosure strip, which is also sticky and paints
    // over it. That offset is a hardcoded number in the theme (`--spacing-strip`)
    // because the strip's rendered height (37px) is not its declared
    // `min-height` (36px) — line-height decides it. Assert the two still agree,
    // so a copy or type change to the strip cannot silently slide the rail's
    // brand under it, or open a gap of bare page above the rail.
    if (route === '/app') {
      const offsets = await page.evaluate(() => {
        const strip = document.querySelector('[data-testid="disclosure-strip"]')
        const rail = document.querySelector('[data-app-rail]')
        if (!strip || !rail) return null
        return {
          stripHeight: Math.round(strip.getBoundingClientRect().height),
          railStickyTop: parseFloat(getComputedStyle(rail).top),
          railPosition: getComputedStyle(rail).position,
        }
      })
      if (offsets === null) {
        ctx.findings.push('/app: expected both [data-testid="disclosure-strip"] and [data-app-rail] to be present')
      } else if (offsets.railPosition !== 'sticky') {
        ctx.findings.push(`/app: expected the rail to be position:sticky at 1440px, got ${offsets.railPosition}`)
      } else if (Math.round(offsets.railStickyTop) !== offsets.stripHeight) {
        ctx.findings.push(
          `/app: rail sticky top is ${offsets.railStickyTop}px but the disclosure strip renders ` +
            `${offsets.stripHeight}px tall — update --spacing-strip in src/styles/theme.css`,
        )
      }
    }

    // RULING 2: screenshot every shipped route, including /app/rules
    // specifically (it previously shipped a claim the code could not
    // support and was rewritten — a visual record is worth having).
    const shotName = `${slugRoute(route)}.png`
    await page.screenshot({ path: path.join(SHOTS, shotName), fullPage: true })
    ctx.shotNames.push(shotName)
  })
  classifyDiagnostics(route, diagnostics, ctx.findings, ctx.missingAssetCounts)
}

// -----------------------------------------------------------------------
// Step 4 (per RULING: every one of the 18, not sampled): each redirected
// route must land on /demo, asserted per-path against the live router.
// -----------------------------------------------------------------------
async function auditRedirect(browser, baseUrl, route, ctx) {
  const url = `${baseUrl}${route}`
  const diagnostics = await withPage(browser, async page => {
    await page.goto(url, { waitUntil: 'networkidle0' })
    try {
      await page.waitForFunction(() => window.location.pathname === '/demo', { timeout: 5000 })
    } catch {
      // fall through — the assertion below reports whatever path it actually landed on
    }
    const finalPath = await page.evaluate(() => window.location.pathname)
    if (finalPath !== '/demo') {
      ctx.findings.push(`redirect ${route}: expected final path /demo, got ${finalPath}`)
    }
  })
  classifyDiagnostics(`redirect ${route}`, diagnostics, ctx.findings, ctx.missingAssetCounts)
}

// -----------------------------------------------------------------------
// RULING 2: the /demo journey has zero behavioural coverage today (only
// tests/journey.test.ts's static DEMO_STEPS array). Drive it for real:
// click through all five steps, assert each panel renders non-empty text,
// assert aria-current="step" moves with the active step, assert the back
// control is disabled at step 0 and enabled after, and assert
// [data-testid="demo-to-pilot"] is present on the final step. The final
// step's PDF download link is also exercised here (RULING 3) — its href is
// read live from the DOM, not hardcoded, and fetched to record its actual
// status; Task 17 has not shipped the file yet, so today it is expected to
// 404 (already accounted for by classifyDiagnostics as a missing asset).
// -----------------------------------------------------------------------
async function auditJourney(browser, baseUrl, ctx) {
  const url = `${baseUrl}/demo`
  const journey = { steps: [], pdfLink: null }
  const diagnostics = await withPage(browser, async page => {
    await page.goto(url, { waitUntil: 'networkidle0' })

    const stepCount = await page.$$eval('[data-demo-step]', els => els.length)
    if (stepCount !== 5) {
      ctx.findings.push(`/demo journey: expected 5 steps in the progress list, found ${stepCount}`)
    }

    for (let i = 0; i < stepCount; i++) {
      const activeIndex = await page.$$eval('[data-demo-step]', els =>
        els.findIndex(el => el.getAttribute('aria-current') === 'step'),
      )
      if (activeIndex !== i) {
        ctx.findings.push(
          `/demo journey step ${i}: expected aria-current="step" on progress item ${i}, found on item ${activeIndex}`,
        )
      }

      const panelText = await page.$eval('section[data-step]', el => el.textContent?.trim() ?? '')
      if (panelText.length === 0) {
        ctx.findings.push(`/demo journey step ${i}: panel rendered no visible text`)
      }

      const backDisabled = await page.$eval('[data-demo-back]', el => el.disabled)
      const expectedDisabled = i === 0
      if (backDisabled !== expectedDisabled) {
        ctx.findings.push(
          `/demo journey step ${i}: expected back control disabled=${expectedDisabled}, found ${backDisabled}`,
        )
      }

      journey.steps.push({ index: i, ariaCurrentMatchesIndex: activeIndex === i, panelTextLength: panelText.length, backDisabled })

      const isLast = i === stepCount - 1
      if (isLast) {
        const ctaCount = await page.$$eval('[data-testid="demo-to-pilot"]', els => els.length)
        if (ctaCount < 1) {
          ctx.findings.push('/demo journey: expected [data-testid="demo-to-pilot"] on the final step')
        }

        const pdfHref = await page.$eval('a[download]', el => el.getAttribute('href')).catch(() => null)
        if (pdfHref) {
          const status = await page.evaluate(async href => {
            try {
              const res = await fetch(href, { method: 'GET' })
              return res.status
            } catch {
              return -1
            }
          }, pdfHref)
          journey.pdfLink = { href: pdfHref, status }
        }
      } else {
        await page.click('[data-demo-next]')
        await page.waitForFunction(
          expectedIndex =>
            Array.from(document.querySelectorAll('[data-demo-step]')).findIndex(
              el => el.getAttribute('aria-current') === 'step',
            ) === expectedIndex,
          {},
          i + 1,
        )
      }
    }
  })
  classifyDiagnostics('/demo journey', diagnostics, ctx.findings, ctx.missingAssetCounts)
  return journey
}

// -----------------------------------------------------------------------
// RULING 2: the drawer focus trap at 360px. AppShell's own keydown handler
// computes `[data-app-rail] a[href], [data-app-rail] button,
// [data-rail-backdrop]` fresh on every Tab (see src/components/AppShell.tsx)
// — this audit uses the exact same selector so it is testing the real trap
// boundary, not a guess at it. Both the close button and the backdrop share
// aria-label "Закрити меню" (confirmed by reading AppShell.tsx), so wraps are
// identified by their data hook, not by aria-label.
//
// Dashboard rewrite: these were `.sidebar*` class names until the shell moved
// to Tailwind. They are now `data-*` attributes precisely so the audit hook and
// the visual styling cannot be coupled — a class rename during a restyle used
// to silently turn this whole audit into a no-op, since a `page.click` on a
// selector matching nothing throws and was caught as "audit crashed" rather
// than as a failing accessibility contract.
// -----------------------------------------------------------------------
const RAIL_FOCUSABLE = '[data-app-rail] a[href], [data-app-rail] button, [data-rail-backdrop]'
// Review 07 · I5 — touch targets at phone width.
//
// The usage context is a site engineer on a building site: outdoors, one hand,
// often gloved. WCAG 2.5.5 puts the floor at 44x44 CSS px; measured, the
// /app/work search input was 22px tall and /pilot's «Конфіденційність» link
// 20px — both roughly half target on the viewport where it matters most.
// -----------------------------------------------------------------------
async function auditTouchTargets(browser, baseUrl, ctx) {
  for (const route of ['/', '/demo', '/app', '/app/work', '/pilot']) {
    await withPage(browser, async page => {
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle0' })
      const small = await page.evaluate(() =>
        [...document.querySelectorAll('a, button, input, select, textarea')]
          .map(el => {
            const r = el.getBoundingClientRect()
            return {
              label: (el.textContent || el.getAttribute('type') || el.tagName).trim().slice(0, 24),
              w: Math.round(r.width),
              h: Math.round(r.height),
            }
          })
          .filter(r => r.h > 0 && (r.h < 44 || r.w < 44)))
      for (const t of small) {
        ctx.findings.push(`${route} @390: touch target below 44px — "${t.label}" ${t.w}x${t.h}`)
      }
    })
  }
}

// -----------------------------------------------------------------------
// /pilot's structural contract.
//
// This page was rewritten off the frozen `.pilot-form` markup onto the design
// system, and a restyle is exactly the kind of change that silently breaks a
// form: a `<label>` that stops wrapping its control still LOOKS like a label,
// a `for` that no longer resolves still renders bold text above an input, and
// a dropped `required` is invisible until someone submits an empty field. The
// screenshot is identical in all three cases. So the contract is asserted
// structurally, on the real DOM, rather than trusted to survive a refactor.
//
// The nine fields are restated here on purpose, rather than imported from
// src/pilot/draft.ts. A guard that reads its expectations out of the module it
// guards cannot catch a change to that module — it would just agree with
// whatever it finds. `required` encodes RULING 4: Компанія and Email only.
// -----------------------------------------------------------------------
const PILOT_FIELDS = [
  { name: 'company', id: 'pilot-company', required: true },
  { name: 'email', id: 'pilot-email', required: true },
  { name: 'specialisation', id: 'pilot-specialisation', required: false },
  { name: 'siteCount', id: 'pilot-site-count', required: false },
  { name: 'capture', id: 'pilot-capture', required: false },
  { name: 'storage', id: 'pilot-storage', required: false },
  { name: 'returnReason', id: 'pilot-return-reason', required: false },
  { name: 'closingTime', id: 'pilot-closing-time', required: false },
  { name: 'willingToShare', id: 'pilot-willing-to-share', required: false },
]

async function auditPilotForm(browser, baseUrl, ctx) {
  // `withPage` resolves to its own console/404 diagnostics, not to the task's
  // return value, so the measurement is hoisted out of the closure — the same
  // shape `auditIconRail` below uses. Returning `withPage(...)` directly here
  // silently reported `{consoleErrors, pageErrors, notFound}` as the form
  // audit's result, which looked plausible in qa-report.json and said nothing.
  let measured = { sections: null, fields: null, problems: null }

  await withPage(browser, async page => {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${baseUrl}/pilot`, { waitUntil: 'networkidle0' })

    const result = await page.evaluate(expected => {
      const problems = []
      const form = document.querySelector('form')
      if (!form) return { problems: ['no <form> on /pilot'], sections: 0, fields: 0 }

      for (const field of expected) {
        const control = document.getElementById(field.id)
        if (!control) {
          problems.push(`no control with id="${field.id}"`)
          continue
        }
        if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(control.tagName)) {
          problems.push(`#${field.id} is a <${control.tagName.toLowerCase()}>, not a form control`)
        }
        if (control.getAttribute('name') !== field.name) {
          problems.push(`#${field.id} has name="${control.getAttribute('name')}", expected "${field.name}"`)
        }
        if (!form.contains(control)) {
          problems.push(`#${field.id} is outside the <form>`)
        }

        // RULING 4: a real <label for>, never a placeholder standing in for one.
        const labels = [...document.querySelectorAll(`label[for="${field.id}"]`)]
        if (labels.length !== 1) {
          problems.push(`#${field.id} has ${labels.length} <label for> elements, expected exactly 1`)
        } else if ((labels[0].textContent ?? '').trim().length === 0) {
          problems.push(`#${field.id}'s <label> is empty`)
        }

        const isRequired = control.hasAttribute('required')
        if (isRequired !== field.required) {
          problems.push(
            `#${field.id} is ${isRequired ? '' : 'not '}required, expected ${field.required ? '' : 'not '}required`,
          )
        }
      }

      // Every control inside the form must be one of the nine, the submit
      // button, or the privacy link — an unexpected input here means a field
      // was added without being declared to this guard or to /legal/privacy's
      // enumeration, which is how the two pages drift apart about what is
      // actually collected.
      const declared = new Set(expected.map(f => f.id))
      for (const control of form.querySelectorAll('input, select, textarea')) {
        if (!declared.has(control.id)) {
          problems.push(`undeclared form control in /pilot's <form>: <${control.tagName.toLowerCase()} id="${control.id}">`)
        }
      }

      const sections = form.querySelectorAll('section')
      for (const section of sections) {
        if (!section.querySelector('h2')) problems.push('a /pilot form section has no <h2>')
      }
      const grouped = [...sections].reduce((n, s) => n + s.querySelectorAll('input, select, textarea').length, 0)
      if (grouped !== expected.length) {
        problems.push(`${grouped} of ${expected.length} fields sit inside a titled section`)
      }

      const submit = form.querySelector('button[type="submit"]')
      if (!submit) problems.push('/pilot has no submit button')

      return { problems, sections: sections.length, fields: expected.length }
    }, PILOT_FIELDS)

    for (const problem of result.problems) {
      ctx.findings.push(`/pilot form: ${problem}`)
    }
    measured = { sections: result.sections, fields: result.fields, problems: result.problems.length }
  })

  return measured
}

// -----------------------------------------------------------------------
// The 768-1239px icon rail had NO coverage at all, and that is exactly where
// a real defect shipped: `TooltipTrigger asChild` is only mounted in this
// range, and Radix's Slot stringified NavLink's function-valued `className`
// into the class attribute. The shipped-route audit pins 1440 (no tooltip),
// the touch-target audit pins 390 (drawer, no tooltip), and the focus-trap
// audit pins 360. Three viewports, none of them the one with the bug.
//
// The shell documents three states as a contract. Each of them needs a pass.
// -----------------------------------------------------------------------
async function auditIconRail(browser, baseUrl, ctx) {
  const rail = { width: null, activeLinks: null, distinctColours: null }
  const diagnostics = await withPage(browser, async page => {
    await page.setViewport({ width: 900, height: 900 })
    await page.goto(`${baseUrl}/app/work`, { waitUntil: 'networkidle0' })

    // Same structural check as the shipped-route audit, run at the width where
    // the Slot-wrapped trigger actually exists.
    const codeInClass = await page.evaluate(() =>
      [...document.querySelectorAll('[class]')]
        .map(el => ({ tag: el.tagName, cls: el.getAttribute('class') ?? '' }))
        .filter(el => /=>|\bfunction\b|[{};]/.test(el.cls))
        .map(el => `${el.tag}: ${el.cls.slice(0, 60).replace(/\s+/g, ' ')}…`))
    for (const found of codeInClass) {
      ctx.findings.push(
        `/app/work @900: a class attribute contains source code — a function-valued className reached the DOM (${found})`,
      )
    }

    const measured = await page.evaluate(() => {
      const aside = document.querySelector('[data-app-rail]')
      const links = [...document.querySelectorAll('[data-app-rail] nav a')]
      return {
        width: aside ? Math.round(aside.getBoundingClientRect().width) : null,
        active: links.filter(a => a.getAttribute('aria-current') === 'page').length,
        colours: [...new Set(links.map(a => getComputedStyle(a).color))],
        labelsHidden: links.every(a => {
          const span = a.querySelector('span:not([aria-hidden])')
          return span !== null && Math.round(span.getBoundingClientRect().width) <= 1
        }),
      }
    })
    rail.width = measured.width
    rail.activeLinks = measured.active
    rail.distinctColours = measured.colours.length

    if (measured.width !== 68) {
      ctx.findings.push(`/app/work @900: expected the rail collapsed to 68px, measured ${measured.width}px`)
    }
    if (measured.active !== 1) {
      ctx.findings.push(`/app/work @900: expected exactly 1 nav link with aria-current="page", found ${measured.active}`)
    }
    // THE ACTUAL REGRESSION. When the class attribute was source text, both
    // branches of the active/inactive colour ternary were dropped and all four
    // links inherited one colour — "you are here" was invisible. Asserting the
    // rendered RESULT (two distinct colours) rather than the declaration.
    if (measured.colours.length < 2) {
      ctx.findings.push(
        `/app/work @900: every nav link renders the same colour (${measured.colours.join(', ')}) — ` +
          'the active item is indistinguishable from the inactive ones',
      )
    }
    if (!measured.labelsHidden) {
      ctx.findings.push('/app/work @900: expected nav labels to be visually hidden in the icon rail')
    }

    await page.screenshot({ path: path.join(SHOTS, 'app-work-icon-rail.png'), fullPage: true })
    ctx.shotNames.push('app-work-icon-rail.png')
  })
  classifyDiagnostics('/app/work @900 (icon rail)', diagnostics, ctx.findings, ctx.missingAssetCounts)
  return rail
}

async function auditDrawerFocusTrap(browser, baseUrl, ctx) {
  const url = `${baseUrl}/app/work`
  const trap = { focusableCount: 0, forwardWrap: null, backwardWrap: null }
  const diagnostics = await withPage(browser, async page => {
    await page.setViewport({ width: 360, height: 800 })
    await page.goto(url, { waitUntil: 'networkidle0' })
    await page.click('[data-rail-toggle]')
    await page.waitForSelector('[data-app-rail][data-open="true"]')

    /*
     * The contract is "the cycle closes", NOT "the cycle closes on this
     * particular control". The previous version named the two expected
     * elements outright (`.sidebar__close`, `.sidebar-backdrop`), which meant
     * that reordering the drawer's own markup — putting the brand ahead of the
     * close button, as the rewrite did — reported a FAILING focus trap while
     * the trap was in fact working perfectly. An assertion that fires on a
     * correct change is worse than no assertion: it trains you to edit the
     * assertion, which is how a real regression eventually gets waved through.
     *
     * So both wrap targets are resolved live from the same query the shell's
     * own handler uses, and identity is compared against the actual ends of
     * that list. `count` is asserted too — a one-element list would satisfy
     * both wraps trivially.
     */
    const describeFocus = () =>
      page.evaluate(selector => {
        const list = [...document.querySelectorAll(selector)]
        const el = document.activeElement
        const identify = node =>
          node instanceof HTMLElement
            ? {
                tag: node.tagName,
                label: (node.getAttribute('aria-label') ?? node.textContent ?? '').trim().slice(0, 32),
              }
            : null
        return {
          count: list.length,
          active: identify(el),
          activeIsFirst: el === list[0],
          activeIsLast: el === list[list.length - 1],
        }
      }, RAIL_FOCUSABLE)

    const focusEnd = which =>
      page.evaluate(
        (selector, end) => {
          const list = document.querySelectorAll(selector)
          const node = end === 'first' ? list[0] : list[list.length - 1]
          if (node instanceof HTMLElement) node.focus()
        },
        RAIL_FOCUSABLE,
        which,
      )

    // Forward wrap: Tab from the last focusable element must cycle to the first.
    await focusEnd('last')
    await page.keyboard.press('Tab')
    trap.forwardWrap = await describeFocus()
    trap.focusableCount = trap.forwardWrap.count
    if (!trap.forwardWrap.activeIsFirst) {
      ctx.findings.push(
        `drawer focus trap: Tab from the last focusable element should wrap to the first, ` +
          `document.activeElement was ${JSON.stringify(trap.forwardWrap.active)}`,
      )
    }

    // Backward wrap: Shift+Tab from the first focusable element must cycle to the last.
    await focusEnd('first')
    await page.keyboard.down('Shift')
    await page.keyboard.press('Tab')
    await page.keyboard.up('Shift')
    trap.backwardWrap = await describeFocus()
    if (!trap.backwardWrap.activeIsLast) {
      ctx.findings.push(
        `drawer focus trap: Shift+Tab from the first focusable element should wrap to the last, ` +
          `document.activeElement was ${JSON.stringify(trap.backwardWrap.active)}`,
      )
    }

    // A trap over one element wraps onto itself and proves nothing. The drawer
    // ships a brand link, a close button, four nav links, the /pilot CTA and
    // the backdrop.
    if (trap.focusableCount < 8) {
      ctx.findings.push(
        `drawer focus trap: expected at least 8 focusable elements in the drawer, found ${trap.focusableCount}`,
      )
    }
  })
  classifyDiagnostics('drawer focus trap (/app/work @360px)', diagnostics, ctx.findings, ctx.missingAssetCounts)
  return trap
}

// -----------------------------------------------------------------------
// Step 6: the bundle-level counterpart to tests/claims.test.ts — reads
// every text file under dist/ (binary font files carry no copy, so they
// are skipped) and asserts none matches FORBIDDEN_CLAIM_PATTERNS, and that
// neither `accepted_external` nor `returned_external` appears anywhere.
// -----------------------------------------------------------------------
const TEXT_FILE_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.map'])

async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)))
    } else {
      files.push(full)
    }
  }
  return files
}

async function scanBundleForForbiddenClaims(distDir, ctx) {
  const allFiles = await walkFiles(distDir)
  const textFiles = allFiles.filter(file => TEXT_FILE_EXTENSIONS.has(path.extname(file).toLowerCase()))
  for (const file of textFiles) {
    const content = await readFile(file, 'utf8')
    const relPath = path.relative(distDir, file)
    for (const { id, pattern } of FORBIDDEN_CLAIM_PATTERNS) {
      if (pattern.test(content)) {
        ctx.findings.push(`bundle scan: forbidden claim pattern "${id}" matched in ${relPath}`)
      }
    }
    if (content.includes('accepted_external')) {
      ctx.findings.push(`bundle scan: literal "accepted_external" found in ${relPath}`)
    }
    if (content.includes('returned_external')) {
      ctx.findings.push(`bundle scan: literal "returned_external" found in ${relPath}`)
    }
  }
  return textFiles.length
}

/**
 * Fix round (final review, finding I1, then re-scoped by a follow-up review
 * round) — the built-bundle counterpart to the deploy-blocking placeholder
 * check. Originally this pushed a `ctx.findings` entry (a FAILING gate) for
 * any unreplaced `{{TOKEN}}` — but `{{FORM_PROCESSOR}}` is genuinely
 * unresolved today (as was `{{CONTACT_EMAIL}}`, now a real mailbox in
 * src/data/contact.ts), so a routine QA run would fail forever, training
 * everyone to ignore red and burying the rest of a real QA report behind a
 * known, deliberate failure.
 *
 * The hard, failing gate now lives in `qa/preflight.mjs`
 * (`pnpm --filter @goproceed/demo preflight`), a separate command documented
 * in README.md §3 as a hard prerequisite before publishing. This scan stays
 * in the routine QA run for VISIBILITY only: it populates
 * `ctx.placeholderTokenOccurrences` (reported as `report.placeholderTokens`,
 * the same non-failing treatment as `missingAssets` below) so a QA report
 * still surfaces exactly which tokens and which built files carry them,
 * without ever affecting `report.ok`.
 */
async function scanBundleForPlaceholderTokens(distDir, ctx) {
  const allFiles = await walkFiles(distDir)
  const textFiles = allFiles.filter(file => TEXT_FILE_EXTENSIONS.has(path.extname(file).toLowerCase()))
  for (const file of textFiles) {
    const content = await readFile(file, 'utf8')
    const relPath = path.relative(distDir, file)
    const matches = content.match(PLACEHOLDER_TOKEN_PATTERN_GLOBAL)
    if (!matches) continue
    for (const token of new Set(matches)) {
      if (!ctx.placeholderTokenOccurrences.has(token)) {
        ctx.placeholderTokenOccurrences.set(token, new Set())
      }
      ctx.placeholderTokenOccurrences.get(token).add(relPath)
    }
  }
}

// -----------------------------------------------------------------------
// Orchestration. Every audit is wrapped so one crashing selector still
// yields a full report covering everything else, rather than an early,
// uninformative process crash.
// -----------------------------------------------------------------------
async function main() {
  const { baseUrl, close: closeServer } = await startServer(DIST)
  const browser = await launch()

  const ctx = {
    findings: [],
    missingAssetCounts: new Map(),
    // Fix round (I1 re-scope): token -> Set<relative dist/ path>. Populated
    // by scanBundleForPlaceholderTokens, never pushed to `findings` — see
    // that function's comment for why this is report-only, not a gate.
    placeholderTokenOccurrences: new Map(),
    shotNames: [],
  }

  try {
    for (const route of SHIPPED_ROUTES) {
      try {
        await auditShippedRoute(browser, baseUrl, route, ctx)
      } catch (err) {
        ctx.findings.push(`${route}: audit crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
      }
    }

    for (const route of REDIRECTED_ROUTES) {
      try {
        await auditRedirect(browser, baseUrl, route, ctx)
      } catch (err) {
        ctx.findings.push(`redirect ${route}: audit crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
      }
    }

    let journey = { steps: [], pdfLink: null }
    try {
      journey = await auditJourney(browser, baseUrl, ctx)
    } catch (err) {
      ctx.findings.push(`/demo journey: audit crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    }

    try {
      await auditTouchTargets(browser, baseUrl, ctx)
    } catch (err) {
      ctx.findings.push(`touch targets: audit crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    }

    let pilotForm = { sections: null, fields: null, problems: null }
    try {
      pilotForm = await auditPilotForm(browser, baseUrl, ctx)
    } catch (err) {
      ctx.findings.push(`/pilot form: audit crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    }

    try {
      await auditGeneratedCss(ctx.findings)
    } catch (err) {
      ctx.findings.push(`generated CSS colour audit: crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    }

    let iconRail = { width: null, activeLinks: null, distinctColours: null }
    try {
      iconRail = await auditIconRail(browser, baseUrl, ctx)
    } catch (err) {
      ctx.findings.push(`icon rail: audit crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    }

    let drawerFocusTrap = { focusableCount: 0, forwardWrap: null, backwardWrap: null }
    try {
      drawerFocusTrap = await auditDrawerFocusTrap(browser, baseUrl, ctx)
    } catch (err) {
      ctx.findings.push(`drawer focus trap: audit crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    }

    let bundleFilesScanned = 0
    try {
      bundleFilesScanned = await scanBundleForForbiddenClaims(DIST, ctx)
      await scanBundleForPlaceholderTokens(DIST, ctx)
    } catch (err) {
      ctx.findings.push(`bundle scan: crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    }

    if (UPDATE_BASELINES) {
      const baselinesDir = path.resolve('qa/baselines')
      await mkdir(baselinesDir, { recursive: true })
      for (const name of ctx.shotNames) {
        await copyFile(path.join(SHOTS, name), path.join(baselinesDir, name))
      }
    }

    const missingAssets = [...ctx.missingAssetCounts.entries()]
      .map(([url, occurrences]) => ({ url, occurrences }))
      .sort((a, b) => a.url.localeCompare(b.url))

    // Fix round (I1 re-scope): same non-failing treatment as missingAssets
    // above — visible in the report, never a cause for report.ok === false.
    // The hard, failing gate is `pnpm --filter @goproceed/demo preflight`.
    const placeholderTokens = [...ctx.placeholderTokenOccurrences.entries()]
      .map(([token, files]) => ({ token, files: [...files].sort() }))
      .sort((a, b) => a.token.localeCompare(b.token))

    // RULING 4: this report must be honest about what it does not check —
    // a green run means "no known claim class reappeared and every shipped
    // surface renders", not "this deployment is fully verified".
    const notCovered = [
      'No automated colour-contrast scan was run — WCAG 2.2 AA contrast ratios are not measured by this harness.',
      'No screen-reader verification was performed (no NVDA/VoiceOver/JAWS pass).',
      'No real-device testing was performed — headless Chrome via puppeteer only, no physical phones/tablets, no Safari/Firefox engines.',
      'No native-speaker review of the Ukrainian copy was performed by this run (see qa/forbidden-claims.mjs\'s own header for the same caveat on claim detection: known claim classes only, not a general claim detector).',
    ]

    const report = {
      ok: ctx.findings.length === 0,
      buildSource: 'apps/demo/dist',
      generatedAt: new Date().toISOString(),
      routes: SHIPPED_ROUTES,
      redirects: REDIRECTED_ROUTES,
      screenshots: ctx.shotNames,
      findings: ctx.findings,
      // RULING 3: known, already-tracked missing assets (Task 17 has not
      // shipped /package-demo.pdf or the evidence-atlas PNG derivatives
      // yet), counted and named separately from `findings` so this run
      // passes on genuine correctness today while the gap stays visible.
      // The set of missing URLs (3: blueprint-folio.png, package-demo.pdf,
      // favicon.ico — the last is the browser's own automatic favicon
      // probe, not app content, but equally a missing asset today) is
      // stable across runs; `occurrences` is not — /app/*-prefixed
      // REDIRECTED_ROUTES mount AppShell (and its .sidebar background
      // image) for one paint before AppShell's own inner catch-all
      // <Navigate> fires, so how many of those redirects' image requests
      // land before `networkidle0` resolves depends on scheduling timing.
      // This whole category must drop to 0 kinds once Task 17 ships those
      // files (favicon aside).
      missingAssets,
      // Fix round (I1 re-scope): unreplaced {{TOKEN}} placeholders found in
      // the built bundle — informational only, does not affect `ok`. Empty
      // once {{FORM_PROCESSOR}} is replaced, the last one left now that
      // {{CONTACT_EMAIL}} is resolved; non-empty today.
      // `pnpm --filter @goproceed/demo preflight` is the command that actually
      // fails on this — see README.md §3.
      placeholderTokens,
      journey,
      pilotForm,
      iconRail,
      drawerFocusTrap,
      summary: {
        shippedRoutesChecked: SHIPPED_ROUTES.length,
        redirectsChecked: REDIRECTED_ROUTES.length,
        journeyStepsChecked: journey.steps.length,
        bundleFilesScanned,
        missingAssetKinds: missingAssets.length,
        missingAssetOccurrences: missingAssets.reduce((sum, a) => sum + a.occurrences, 0),
        placeholderTokenKinds: placeholderTokens.length,
      },
      notCovered,
    }

    await writeFile(path.join(OUTPUT, 'qa-report.json'), `${JSON.stringify(report, null, 2)}\n`)

    if (!report.ok) {
      console.error(ctx.findings.join('\n'))
      process.exitCode = 1
      return
    }
    console.log(
      `QA passed: ${SHIPPED_ROUTES.length} routes, ${REDIRECTED_ROUTES.length} redirects, ` +
        `${journey.steps.length}-step journey, drawer focus trap, ${bundleFilesScanned} bundle files scanned. ` +
        `${missingAssets.length} known missing asset(s) (${report.summary.missingAssetOccurrences} occurrence(s)) — see qa-output/qa-report.json.`,
    )
    if (placeholderTokens.length > 0) {
      // Deliberately console.warn, not console.error — this must never
      // affect the exit code. `pnpm --filter @goproceed/demo preflight` is
      // the command that fails on this before a real deploy (README.md §3).
      console.warn(
        `NOTE (not a failure): ${placeholderTokens.length} unreplaced placeholder token(s) still in the built bundle ` +
          `(${placeholderTokens.map(t => t.token).join(', ')}). Run "pnpm --filter @goproceed/demo preflight" before deploying.`,
      )
    }
  } finally {
    await browser.close()
    await closeServer()
  }
}

await main()
