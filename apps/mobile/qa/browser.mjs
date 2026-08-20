// PORT of apps/app/qa/browser.mjs, verbatim apart from this header — same
// puppeteer version (package.json pins it to apps/app's exact 25.8.0, see
// that file's own comment on why a version drift here would point this
// harness at a different Chrome for Testing build than the one CI installs
// for apps/app's own pass), same launch() shape, same override variable. Two
// copies rather than a shared module because apps/mobile and apps/app are
// separate pnpm packages with no dependency between them, and — per
// ADR-009 — apps/mobile's own copy of everything ported from apps/app
// retires the day the PWA does; a shared internal package would outlive that
// boundary by design.
import puppeteer from 'puppeteer'

/**
 * apps/demo uses full `puppeteer`, which manages a pinned per-platform Chrome
 * for Testing. That is deliberate: prototype/ uses puppeteer-core +
 * @sparticuz/chromium, whose Linux x86-64 ELF binary fails ENOEXEC on Apple
 * Silicon. An explicit override remains for constrained environments.
 *
 * THE OVERRIDE IS `GOPROCEED_CHROME_PATH` AS OF 2026-08-17 — same spelling
 * apps/app/qa/browser.mjs uses, kept identical here so one exported variable
 * points both harnesses at the same browser when both run on one machine.
 */
export async function launch() {
  const executablePath = process.env.GOPROCEED_CHROME_PATH || undefined
  return puppeteer.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  })
}
