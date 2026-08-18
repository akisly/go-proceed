import puppeteer from 'puppeteer'

/**
 * apps/demo uses full `puppeteer`, which manages a pinned per-platform Chrome
 * for Testing. That is deliberate: prototype/ uses puppeteer-core +
 * @sparticuz/chromium, whose Linux x86-64 ELF binary fails ENOEXEC on Apple
 * Silicon. An explicit override remains for constrained environments.
 *
 * THE OVERRIDE IS `GOPROCEED_CHROME_PATH` AS OF 2026-08-17, and one sibling
 * still reads the old spelling. `prototype/qa/verify.mjs` goes on honouring
 * the old `AKTFLOW_CHROME_PATH` spelling (alongside `PUPPETEER_EXECUTABLE_PATH` and
 * `CHROME_PATH`) because `prototype/` is frozen — `.github/workflows/ci.yml`
 * records it as out of scope to change, and its harness rewrites tracked
 * screenshots on every run, so touching it is its own slice.
 *
 * The consequence is worth knowing before you debug it: exporting ONE of the
 * two variables does not point both harnesses at the same browser. Set both,
 * or use `PUPPETEER_EXECUTABLE_PATH`, which prototype/ also accepts and
 * puppeteer honours here natively.
 */
export async function launch() {
  const executablePath = process.env.GOPROCEED_CHROME_PATH || undefined
  return puppeteer.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  })
}
