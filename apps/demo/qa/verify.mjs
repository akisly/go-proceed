import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { launch } from './browser.mjs'
import { REDIRECTED_ROUTES, SHIPPED_ROUTES } from './routes.mjs'
import { FORBIDDEN_CLAIM_PATTERNS } from './forbidden-claims.mjs'
import { PLACEHOLDER_TOKEN_PATTERN_GLOBAL } from './placeholder-tokens.mjs'

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

    // RULING 2: /app/work must show 14 rows — PROJECT.workItems.length,
    // read live off the rendered table, not re-asserted against the source.
    if (route === '/app/work') {
      const rowCount = await page.$$eval('.full-work-table .work-row', els => els.length)
      if (rowCount !== 14) {
        ctx.findings.push(`/app/work: expected 14 rows (PROJECT.workItems.length), found ${rowCount}`)
      }
    }

    // RULING 2: /app/evidence must show 5 items with a blocking gap and 2
    // with only a non-blocking gap, in the default (unfiltered) view.
    if (route === '/app/evidence') {
      const blockingCount = await page.$$eval(
        'section[aria-label="Вимоги, що блокують подання"] > article.blockers-panel',
        els => els.length,
      )
      const nonBlockingCount = await page.$$eval(
        'section[aria-label="Вимоги без блокування"] > article.blockers-panel',
        els => els.length,
      )
      if (blockingCount !== 5) {
        ctx.findings.push(`/app/evidence: expected 5 items with a blocking gap, found ${blockingCount}`)
      }
      if (nonBlockingCount !== 2) {
        ctx.findings.push(`/app/evidence: expected 2 items with only a non-blocking gap, found ${nonBlockingCount}`)
      }
    }

    // Review 07 · B1: the landing header's link colours were scoped to
    // `.landing` in the frozen stylesheet, which in the prototype sat on a
    // DARK hero. Task 11's claim scrub removed that treatment but kept the
    // class, inverting three of four links into unreadability.
    if (route === '/') {
      const headerLinks = await page.evaluate(() => {
        const header = document.querySelector('.site-header')
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
        ctx.findings.push('/: expected links in .site-header, found none')
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

    // Step 5: [data-testid="pilot-cta"] exists on /app.
    if (route === '/app') {
      const ctaCount = await page.$$eval('[data-testid="pilot-cta"]', els => els.length)
      if (ctaCount < 1) {
        ctx.findings.push('/app: expected [data-testid="pilot-cta"] to be present')
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

    const stepCount = await page.$$eval('.demo-progress li', els => els.length)
    if (stepCount !== 5) {
      ctx.findings.push(`/demo journey: expected 5 steps in the progress list, found ${stepCount}`)
    }

    for (let i = 0; i < stepCount; i++) {
      const activeIndex = await page.$$eval('.demo-progress li', els =>
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

      const backDisabled = await page.$eval('.onboarding-footer > button.button--outline', el => el.disabled)
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
        await page.click('.onboarding-footer button.button--dark')
        await page.waitForFunction(
          expectedIndex =>
            Array.from(document.querySelectorAll('.demo-progress li')).findIndex(
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
// computes `.sidebar a[href], .sidebar button, .sidebar-backdrop` fresh on
// every Tab (see src/components/AppShell.tsx) — this audit uses the exact
// same selector so it is testing the real trap boundary, not a guess at it.
// Both the close button and the backdrop share aria-label "Закрити меню"
// (confirmed by reading AppShell.tsx), so wraps are identified by class
// name (.sidebar__close vs .sidebar-backdrop), not by aria-label.
// -----------------------------------------------------------------------
async function auditDrawerFocusTrap(browser, baseUrl, ctx) {
  const url = `${baseUrl}/app/work`
  const trap = { forwardWrap: null, backwardWrap: null }
  const diagnostics = await withPage(browser, async page => {
    await page.setViewport({ width: 360, height: 800 })
    await page.goto(url, { waitUntil: 'networkidle0' })
    await page.click('.mobile-menu')
    await page.waitForSelector('.sidebar--open')

    const readActiveElement = () =>
      page.evaluate(() => {
        const el = document.activeElement
        return { tagName: el?.tagName ?? null, className: el && 'className' in el ? String(el.className) : null }
      })

    // Forward wrap: Tab from the last focusable element must cycle to the first.
    await page.evaluate(() => {
      const list = document.querySelectorAll('.sidebar a[href], .sidebar button, .sidebar-backdrop')
      const lastEl = list[list.length - 1]
      if (lastEl instanceof HTMLElement) lastEl.focus()
    })
    await page.keyboard.press('Tab')
    trap.forwardWrap = await readActiveElement()
    if (!trap.forwardWrap.className?.includes('sidebar__close')) {
      ctx.findings.push(
        `drawer focus trap: Tab from the last focusable element should wrap to .sidebar__close, ` +
          `document.activeElement was ${JSON.stringify(trap.forwardWrap)}`,
      )
    }

    // Backward wrap: Shift+Tab from the first focusable element must cycle to the last.
    await page.evaluate(() => {
      const list = document.querySelectorAll('.sidebar a[href], .sidebar button, .sidebar-backdrop')
      const firstEl = list[0]
      if (firstEl instanceof HTMLElement) firstEl.focus()
    })
    await page.keyboard.down('Shift')
    await page.keyboard.press('Tab')
    await page.keyboard.up('Shift')
    trap.backwardWrap = await readActiveElement()
    if (!trap.backwardWrap.className?.includes('sidebar-backdrop')) {
      ctx.findings.push(
        `drawer focus trap: Shift+Tab from the first focusable element should wrap to .sidebar-backdrop, ` +
          `document.activeElement was ${JSON.stringify(trap.backwardWrap)}`,
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
 * any unreplaced `{{TOKEN}}` — but both `{{CONTACT_EMAIL}}` and
 * `{{FORM_PROCESSOR}}` are genuinely unresolved today, so a routine QA run
 * would fail forever, training everyone to ignore red and burying the rest
 * of a real QA report behind a known, deliberate failure.
 *
 * The hard, failing gate now lives in `qa/preflight.mjs`
 * (`pnpm --filter @aktflow/demo preflight`), a separate command documented
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

    let drawerFocusTrap = { forwardWrap: null, backwardWrap: null }
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
    // The hard, failing gate is `pnpm --filter @aktflow/demo preflight`.
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
      // once both {{CONTACT_EMAIL}} and {{FORM_PROCESSOR}} are replaced;
      // non-empty today. `pnpm --filter @aktflow/demo preflight` is the
      // command that actually fails on this — see README.md §3.
      placeholderTokens,
      journey,
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
      // affect the exit code. `pnpm --filter @aktflow/demo preflight` is
      // the command that fails on this before a real deploy (README.md §3).
      console.warn(
        `NOTE (not a failure): ${placeholderTokens.length} unreplaced placeholder token(s) still in the built bundle ` +
          `(${placeholderTokens.map(t => t.token).join(', ')}). Run "pnpm --filter @aktflow/demo preflight" before deploying.`,
      )
    }
  } finally {
    await browser.close()
    await closeServer()
  }
}

await main()
