import puppeteer from 'puppeteer'

/**
 * apps/demo uses full `puppeteer`, which manages a pinned per-platform Chrome
 * for Testing. That is deliberate: prototype/ uses puppeteer-core +
 * @sparticuz/chromium, whose Linux x86-64 ELF binary fails ENOEXEC on Apple
 * Silicon. An explicit override remains for constrained environments.
 */
export async function launch() {
  const executablePath = process.env.AKTFLOW_CHROME_PATH || undefined
  return puppeteer.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  })
}
