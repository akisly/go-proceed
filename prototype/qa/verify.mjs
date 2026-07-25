import puppeteer from 'puppeteer-core'
import chromiumBinary, { inflate } from '@sparticuz/chromium'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' }
const dist = path.resolve('dist')
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname
    const requested = path.join(dist, pathname === '/' ? 'index.html' : pathname)
    const file = await readFile(requested).catch(() => readFile(path.join(dist, 'index.html')))
    response.writeHead(200, { 'Content-Type': mime[path.extname(requested)] || (pathname.includes('.') ? 'application/octet-stream' : 'text/html') })
    response.end(file)
  } catch {
    response.writeHead(500)
    response.end('QA server error')
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = process.env.AKTFLOW_BASE_URL || `http://127.0.0.1:${server.address().port}`
const output = path.resolve('qa-screenshots')
const screenshotFiles = ['landing-desktop.png','dashboard-native.png','onboarding-desktop.png','field-today-mobile.png','field-capture-mobile.png','field-offline-success-mobile.png','rules-impact-desktop.png','rules-published-desktop.png','review-correction-approved-desktop.png','pilot-success-desktop.png','invite-accepted-desktop.png','package-submitted-desktop.png','external-review-accepted-desktop.png','team-invite-receipt-desktop.png','rules-impact-mobile.png','baseline-published-desktop.png','assignments-receipt-desktop.png','occurrence-closed-desktop.png','package-line-decisions-desktop.png']
await mkdir(output, { recursive: true })
await mkdir(path.resolve('qa-runtime-tmp/home'), { recursive: true })
await mkdir(path.resolve('qa-runtime-tmp/cache'), { recursive: true })

chromiumBinary.setGraphicsMode = false
const chromiumArchive = path.resolve('node_modules/@sparticuz/chromium/bin/chromium.br')
const chromiumCacheKey = createHash('sha256').update(await readFile(chromiumArchive)).digest('hex').slice(0, 16)
const chromiumCache = path.resolve(`qa-runtime-tmp/chromium-${chromiumCacheKey}`)
const inheritedTmpDir = process.env.TMPDIR
process.env.TMPDIR = chromiumCache
await mkdir(chromiumCache, { recursive: true })
let executablePath = await inflate(chromiumArchive)
let chromiumProbe = spawnSync(executablePath, ['--no-sandbox', '--headless', '--version'], { encoding: 'utf8' })
if (chromiumProbe.status !== 0) {
  await rm(chromiumCache, { recursive: true, force: true })
  await mkdir(chromiumCache, { recursive: true })
  executablePath = await inflate(chromiumArchive)
  chromiumProbe = spawnSync(executablePath, ['--no-sandbox', '--headless', '--version'], { encoding: 'utf8' })
}
if (chromiumProbe.status !== 0) {
  throw new Error(`Chromium integrity probe failed status=${chromiumProbe.status} signal=${chromiumProbe.signal || 'none'} stderr=${(chromiumProbe.stderr || '').trim()}`)
}
if (inheritedTmpDir === undefined) delete process.env.TMPDIR
else process.env.TMPDIR = inheritedTmpDir
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, HOME: path.resolve('qa-runtime-tmp/home'), XDG_CACHE_HOME: path.resolve('qa-runtime-tmp/cache') },
})
const findings = []

// v2.9 business-logic markers are DERIVED from executed assertions: a marker
// enters qa-results.json only when its assertion ran and passed in this run.
const MARKERS = ['persisted-baseline-previews', 'partial-assignment-row-receipts', 'exact-evidence-invalidation', 'resumable-package-decision-set', 'assignment-reassignment-receipt', 'reference-acknowledgement-receipt', 'organization-wide-member-offboarding', 'offline-authorization-lease', 'read-model-closure', 'deterministic-occurrence-strategies', 'post-invalidation-capture-quarantine', 'canonical-rule-preview-payload', 'staged-offboarding-plan']
const assertedMarkers = new Set()
function assertMarker(name, condition, failureMessage) {
  if (condition) assertedMarkers.add(name)
  else findings.push(failureMessage)
}

async function pageFor(width, height) {
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  page.on('console', message => { if (message.type() === 'error') findings.push(`console:${message.text()}`) })
  page.on('pageerror', error => findings.push(`pageerror:${error.message}`))
  return page
}

async function goto(page, route) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle0', timeout: 30000 })
}

async function textVisible(page, text) {
  return page.evaluate(value => document.body.innerText.includes(value), text)
}

const landing = await pageFor(1440, 1024)
await goto(landing, '/')
if (!await textVisible(landing, 'Майданчик працює')) findings.push('landing mobile core section missing')
const mobileDemoHref = await landing.$eval('.mobile-section__actions a', element => element.getAttribute('href'))
if (mobileDemoHref !== '/field') findings.push('landing mobile demo CTA is not wired to field app')
await landing.screenshot({ path: path.join(output, 'landing-desktop.png'), fullPage: true })
await landing.click('.hero__actions a[href="/app"]')
await landing.waitForFunction(() => location.pathname === '/app')
await landing.waitForFunction(() => document.body.innerText.includes('Контроль готовності до оплати'))
if (!await textVisible(landing, 'Контроль готовності до оплати')) findings.push('dashboard heading missing')
await landing.close()

const dashboard = await pageFor(1487, 1058)
await goto(dashboard, '/app')
await dashboard.screenshot({ path: path.join(output, 'dashboard-native.png'), fullPage: true })
await dashboard.click('button.work-row')
await dashboard.waitForSelector('.drawer aside')
if (!await textVisible(dashboard, 'Готовність доказів')) findings.push('work drawer did not open')
await dashboard.$eval('.drawer .button--signal', element => element.click())
if (!await textVisible(dashboard, 'Блокер лишається активним')) findings.push('dashboard evidence request receipt missing')
await dashboard.$eval('.drawer .button--outline', element => element.click())
await dashboard.waitForFunction(() => location.pathname === '/app/work' && new URLSearchParams(location.search).has('q'))
await dashboard.waitForFunction(() => document.querySelector('.search-box input')?.value.includes('EL-04.17'))
const focusedWorkQuery = await dashboard.$eval('.search-box input', element => element.value)
if (!focusedWorkQuery.includes('EL-04.17')) findings.push('work drawer did not preserve selected work context')
await goto(dashboard, '/app')
await dashboard.click('.app-header__actions .button')
await dashboard.waitForFunction(() => location.pathname === '/app/work' && location.search === '?new=1')
await dashboard.waitForSelector('.invite-dialog form')
await dashboard.click('.invite-dialog form .button--dark')
if (!await textVisible(dashboard, 'EL-16.03 створено')) findings.push('single work creation receipt missing')
await dashboard.click('.invite-dialog .payment-recorded .button')
if (!await textVisible(dashboard, '429 позицій')) findings.push('created work did not update register consequence')
await dashboard.close()

const onboarding = await pageFor(1440, 1024)
await goto(onboarding, '/onboarding')
if (!await textVisible(onboarding, '428 позицій · 184 КБ')) findings.push('import file state missing')
await onboarding.click('.validation-strip button')
await onboarding.waitForSelector('.import-success')
if (!await textVisible(onboarding, 'Перевірка завершена')) findings.push('import validation feedback missing')
await onboarding.screenshot({ path: path.join(output, 'onboarding-desktop.png'), fullPage: true })
await onboarding.click('.onboarding-footer .button--dark')
if (!await textVisible(onboarding, 'Оберіть правила доказів')) findings.push('onboarding rules handoff step missing')
await onboarding.click('.onboarding-footer .button--dark')
await onboarding.waitForFunction(() => location.pathname === '/app/rules' && location.search === '?setup=1')
await onboarding.waitForFunction(() => document.body.innerText.includes('Наслідки до публікації'))
if (!await textVisible(onboarding, 'Наслідки до публікації')) findings.push('onboarding did not hand off to rule impact flow')
// Setup-mode publish must return the user to onboarding step 5 (team step).
await onboarding.click('.rules-editor footer .button')
await onboarding.waitForSelector('.impact-metrics')
await onboarding.click('.impact-ack input')
await onboarding.click('.app-header__actions .button')
await onboarding.waitForSelector('.rule-publish-dialog')
await onboarding.click('.rule-publish-dialog .button--dark')
await onboarding.waitForSelector('.publish-receipt')
await onboarding.click('.publish-receipt .quiet-button')
await onboarding.waitForFunction(() => document.body.innerText.includes('428/428'))
await onboarding.click('.publish-receipt .quiet-button')
await onboarding.waitForFunction(() => location.pathname === '/onboarding' && new URLSearchParams(location.search).get('step') === '5' && document.body.innerText.includes('Запросіть команду'))
if (!await textVisible(onboarding, 'Запросіть команду')) findings.push('setup publish did not return to onboarding team step')
await onboarding.waitForSelector('.onboarding-footer .button--dark')
await onboarding.click('.onboarding-footer .button--dark')
await onboarding.waitForFunction(() => location.pathname === '/app')
await onboarding.close()

const mobile = await pageFor(390, 844)
await goto(mobile, '/field')
await mobile.screenshot({ path: path.join(output, 'field-today-mobile.png'), fullPage: true })
await mobile.click('.field-nav button:nth-child(2)')
if (!await textVisible(mobile, 'ОСТАННІ 7 ДНІВ')) findings.push('field captures tab is inert')
await mobile.click('.field-nav button:nth-child(3)')
if (!await textVisible(mobile, '1 запис очікує мережу')) findings.push('field sync queue tab is inert')
assertMarker('post-invalidation-capture-quarantine', await textVisible(mobile, 'У карантині — авторизацію інвалідовано') && await textVisible(mobile, 'Security Admin'), 'post-invalidation capture quarantine copy missing in field sync queue')
await mobile.click('.field-nav button:first-child')
await mobile.click('.task-list > button')
await mobile.waitForSelector('.camera-zone')
await mobile.screenshot({ path: path.join(output, 'field-capture-mobile.png'), fullPage: true })
await mobile.click('.camera-zone')
await mobile.click('.camera-zone')
await mobile.click('.field-footer .button')
await mobile.waitForSelector('.local-receipt')
if (!await textVisible(mobile, 'Збережено на пристрої')) findings.push('offline local receipt state missing')
await mobile.screenshot({ path: path.join(output, 'field-offline-success-mobile.png'), fullPage: true })
await mobile.click('.field-success main > .button')
if (!await textVisible(mobile, 'Підтверджено сервером')) findings.push('server-confirmed state missing')
await mobile.close()

const flows = await pageFor(1200, 850)
await goto(flows, '/login')
await flows.click('.auth-card form .button--dark')
await flows.waitForFunction(() => location.pathname === '/app')
await flows.waitForSelector('.org-switch')
await flows.click('.org-switch')
if (!await textVisible(flows, 'Керувати простором')) findings.push('project context switcher is inert')
await flows.click('.org-switch')
await flows.click('.notification-anchor .icon-button')
if (!await textVisible(flows, '3 докази очікують review')) findings.push('notification popover is inert')
await goto(flows, '/app/work')
await flows.click('.work-table--select .work-row input')
if (!await textVisible(flows, 'Обрано: 1')) findings.push('bulk selection state missing')
await goto(flows, '/app/billing')
await flows.click('.billing-plans > button:first-child')
const disabled = await flows.$eval('.plan-action .button', element => element.disabled)
if (disabled) findings.push('billing plan selection did not enable action')
await flows.click('.plan-action .button')
if (!await textVisible(flows, 'Запит надіслано')) findings.push('billing plan change confirmation receipt missing')
// Read-model closure: every core register renders populated read surfaces.
const readSurfaces = [
  ['/app/evidence', 'CAP-742'],
  ['/app/packages', 'Готово до подання'],
  ['/app/payments', 'ACT-HR-0626'],
  ['/app/team', 'Ірина Коваленко'],
  ['/app/baseline', 'EXACT VERSION BOUNDARY'],
]
let readClosureIntact = true
for (const [route, expected] of readSurfaces) {
  await goto(flows, route)
  if (!await textVisible(flows, expected)) {
    readClosureIntact = false
    findings.push(`read-model surface ${route} is missing its register content`)
  }
}
assertMarker('read-model-closure', readClosureIntact, 'read-model closure sweep failed')
await flows.close()

const rules = await pageFor(1440, 1024)
await goto(rules, '/app/rules')
if (!await textVisible(rules, 'Наслідки до публікації')) findings.push('rules screen missing')
await rules.click('.rules-editor footer .button')
await rules.waitForSelector('.impact-metrics')
if (!await textVisible(rules, 'RIP-260722-18')) findings.push('rule impact receipt missing')
await rules.screenshot({ path: path.join(output, 'rules-impact-desktop.png'), fullPage: true })
await rules.click('.rule-table article:first-child .rule-switch input')
await rules.waitForSelector('.impact-stale')
if (!await textVisible(rules, 'Preview застарів')) findings.push('stale rule preview guard missing')
const stalePublishDisabled = await rules.$eval('.app-header__actions .button', element => element.disabled)
if (!stalePublishDisabled) findings.push('stale rule preview did not block publish')
await rules.click('.rule-table article:first-child .rule-switch input')
await rules.click('.rules-editor footer .button')
await rules.click('.impact-ack input')
await rules.click('.app-header__actions .button')
await rules.waitForSelector('.rule-publish-dialog')
const initialDialogFocus = await rules.evaluate(() => document.activeElement?.textContent?.includes('Підтвердити publish'))
if (!initialDialogFocus) findings.push('rule publish dialog did not receive initial focus')
await rules.keyboard.press('Escape')
await rules.waitForSelector('.rule-publish-dialog', { hidden: true })
const restoredDialogFocus = await rules.evaluate(() => document.activeElement?.textContent?.includes('Опублікувати v2'))
if (!restoredDialogFocus) findings.push('rule publish dialog did not restore focus')
await rules.click('.app-header__actions .button')
const dialogShowsCanonicalPayload = await textVisible(rules, 'RIP-260722-18') && await textVisible(rules, 'sha256:9c5d…e41a')
await rules.click('.rule-publish-dialog .button--dark')
await rules.waitForSelector('.publish-receipt')
if (!await textVisible(rules, 'v2 стала незмінною версією')) findings.push('rule publish receipt missing')
assertMarker('canonical-rule-preview-payload', dialogShowsCanonicalPayload && await textVisible(rules, 'v2 стала незмінною версією'), 'canonical rule preview payload (preview ID + input hash) is not consumed by publish')
const publishedRuleDisabled = await rules.$eval('.rule-table article:first-child .rule-switch input', element => element.disabled)
if (!publishedRuleDisabled) findings.push('published rule version remains editable')
await rules.click('.publish-receipt .quiet-button')
if (!await textVisible(rules, '428/428 позицій')) findings.push('rule evaluation completion missing')
await rules.screenshot({ path: path.join(output, 'rules-published-desktop.png'), fullPage: true })
await rules.close()

const correction = await pageFor(1440, 1100)
await goto(correction, '/app/evidence')
// Direct approve path (docs/29 §2): approve without return, then reset.
await correction.click('.decision-panel .button--signal')
if (!await textVisible(correction, 'Докази схвалено')) findings.push('direct approve receipt missing')
await correction.click('.decision-receipt .quiet-button')
await correction.waitForSelector('.decision-panel')
await correction.click('.decision-panel .button--outline')
await correction.click('.decision-receipt .button--dark')
await correction.waitForSelector('.correction-workspace')
if (!await textVisible(correction, 'CAP-742 · оригінал незмінний')) findings.push('correction lineage missing')
await correction.click('.replacement-upload')
await correction.click('.correction-workspace footer .button')
await correction.waitForSelector('.correction-receipt')
if (!await textVisible(correction, 'RCP-742-R2')) findings.push('correction server receipt missing')
await correction.click('.correction-receipt .button--signal')
if (!await textVisible(correction, 'RVW-2207-91')) findings.push('correction re-review decision missing')
await correction.screenshot({ path: path.join(output, 'review-correction-approved-desktop.png'), fullPage: true })
await correction.close()

const acquisition = await pageFor(1440, 1050)
await goto(acquisition, '/pilot')
await acquisition.click('.pilot-form__actions .button--dark')
await acquisition.waitForSelector('select[name="closeProcess"]')
if (!await textVisible(acquisition, 'Як зараз закриваєте роботи?')) findings.push('pilot qualification step 2 missing')
const marketingInitiallyOff = await acquisition.$eval('input[name="marketingConsent"]', element => !element.checked)
if (!marketingInitiallyOff) findings.push('pilot marketing consent is not separate and opt-in')
await acquisition.click('input[name="serviceConsent"]')
await acquisition.click('.pilot-form__actions .button--dark')
await acquisition.waitForSelector('.pilot-success')
if (!await textVisible(acquisition, 'LEAD-26Q3H7M2')) findings.push('pilot opaque receipt missing')
await acquisition.screenshot({ path: path.join(output, 'pilot-success-desktop.png'), fullPage: true })
await goto(acquisition, '/invite/demo')
const inviteInitiallyDisabled = await acquisition.$eval('.invite-card .button--dark', element => element.disabled)
if (!inviteInitiallyDisabled) findings.push('invite terms gate is not enforced')
await acquisition.click('.invite-card .consent input')
await acquisition.click('.invite-card .button--dark')
if (!await textVisible(acquisition, 'Захистіть рішення перевірки')) findings.push('invite MFA step missing')
await acquisition.click('.invite-card .button--dark')
if (!await textVisible(acquisition, 'Доступ активовано')) findings.push('invite acceptance receipt missing')
await acquisition.screenshot({ path: path.join(output, 'invite-accepted-desktop.png'), fullPage: true })
await goto(acquisition, '/reset-password')
await acquisition.click('.reset-page form .button--dark')
if (!await textVisible(acquisition, 'RECOVERY-260722')) findings.push('password recovery receipt missing')
await goto(acquisition, '/legal/privacy')
if (!await textVisible(acquisition, 'Повідомлення про приватність')) findings.push('privacy route missing')
await goto(acquisition, '/legal/terms')
if (!await textVisible(acquisition, 'Умови демонстраційного використання')) findings.push('terms route missing')
await acquisition.close()

const commercial = await pageFor(1440, 1100)
await goto(commercial, '/app/variations')
await commercial.click('.app-header__actions .button')
await commercial.waitForSelector('.variation-composer')
await commercial.click('.variation-composer footer .button--dark')
await commercial.click('.variation-composer footer .button--dark')
await commercial.click('.variation-composer footer .button--dark')
if (!await textVisible(commercial, 'VAR-025 · версія 1')) findings.push('variation immutable notice receipt missing')
await goto(commercial, '/app/close')
await commercial.click('.blocker-list article:first-child .button')
if (!await textVisible(commercial, 'запит надіслано, блокер активний')) findings.push('evidence request did not preserve blocker')
await commercial.click('.blocker-list article:first-child .button')
await commercial.click('.blocker-list article:first-child .button')
await commercial.waitForSelector('.override-dialog')
await commercial.click('.override-dialog .button--dark')
const snapshotDisabled = await commercial.$eval('.close-checklist > .button--dark', element => element.disabled)
if (snapshotDisabled) findings.push('resolved hard blockers did not unlock snapshot')
await commercial.click('.close-checklist > .button--dark')
if (!await textVisible(commercial, 'Snapshot періоду зафіксовано')) findings.push('period close snapshot receipt missing')
await commercial.click('.close-checklist > .button--signal')
await commercial.waitForFunction(() => location.pathname === '/app/packages/current')
await commercial.waitForSelector('.generation-state .button')
await commercial.click('.generation-state .button')
await commercial.waitForFunction(() => document.body.textContent.includes('Готово до подання'))
await commercial.click('.package-validation .button--outline')
if (!await textVisible(commercial, 'EXP-2207-41')) findings.push('package download receipt missing')
await commercial.click('.package-validation .button--signal')
if (!await textVisible(commercial, 'SUB-2026-118')) findings.push('package submission receipt missing')
await commercial.screenshot({ path: path.join(output, 'package-submitted-desktop.png'), fullPage: true })
await commercial.close()

const external = await pageFor(1440, 1050)
await goto(external, '/review/demo')
await external.click('.external-entry .button--dark')
if (!await textVisible(external, 'Лише для версії v2')) findings.push('external review version boundary missing')
await external.click('.external-grid > aside:first-child button:nth-of-type(4)')
if (!await textVisible(external, 'Чинний до 31.07.2026')) findings.push('external dossier section navigation is inert')
await external.click('.external-decision .button--outline')
if (!await textVisible(external, 'Повернено на уточнення')) findings.push('external return receipt missing')
await external.click('.external-receipt .button--dark')
await external.click('.external-decision .button--signal')
if (!await textVisible(external, 'Операційно погоджено')) findings.push('external acceptance receipt missing')
await external.screenshot({ path: path.join(output, 'external-review-accepted-desktop.png'), fullPage: true })
await external.close()

const administration = await pageFor(1440, 1000)
await goto(administration, '/app/payments')
await administration.click('.app-header__actions .button')
await administration.waitForSelector('.payment-dialog')
await administration.click('.payment-dialog .button--dark')
if (!await textVisible(administration, 'PAY-2207-18')) findings.push('project payment allocation receipt missing')
await goto(administration, '/app/team')
await administration.click('.app-header__actions .button')
await administration.waitForSelector('.invite-dialog')
if (!await textVisible(administration, 'Не зможе:')) findings.push('least-privilege invite preview missing')
await administration.click('.invite-dialog .button--dark')
if (!await textVisible(administration, 'Запрошення поставлено в чергу')) findings.push('team invitation receipt missing')
await administration.screenshot({ path: path.join(output, 'team-invite-receipt-desktop.png'), fullPage: true })
await administration.click('.invite-dialog .button--dark')
await administration.click('.member-table article:nth-of-type(3) .quiet-button')
const stagedPlanVisible = await textVisible(administration, 'Закрийте відповідальності в усіх проєктах')
await administration.click('.preview-offboarding')
if (!await textVisible(administration, 'Fresh preview готовий')) findings.push('member offboarding exact preview missing')
if (!await textVisible(administration, '2 projects')) findings.push('organization-wide member offboarding coverage missing')
assertMarker('staged-offboarding-plan', stagedPlanVisible && await textVisible(administration, 'Fresh preview готовий'), 'staged offboarding plan (planning → fresh preview) missing')
await administration.click('.confirm-offboarding')
if (!await textVisible(administration, 'OFB-2407-10')) findings.push('atomic member offboarding receipt missing')
assertMarker('organization-wide-member-offboarding', await textVisible(administration, 'OFB-2407-10') && await textVisible(administration, '2 projects закрито'), 'organization-wide offboarding commit receipt missing')
await goto(administration, '/app/settings')
await administration.click('.app-header__actions .button')
if (!await textVisible(administration, 'WSP-260722-04')) findings.push('workspace settings receipt missing')
await goto(administration, '/app/packages')
await administration.type('.search-box input', 'неіснуючий пакет')
if (!await textVisible(administration, 'За цим фільтром пакетів немає')) findings.push('package search empty state missing')
await administration.close()

const rulesMobile = await pageFor(390, 844)
await goto(rulesMobile, '/app/rules')
await rulesMobile.click('.rules-editor footer .button')
await rulesMobile.waitForSelector('.impact-metrics')
const rulesOverflow = await rulesMobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
if (rulesOverflow) findings.push('rules mobile horizontal overflow')
const skipLinkVisible = await rulesMobile.$eval('.skip-link', element => element.getBoundingClientRect().bottom > 0)
if (skipLinkVisible) findings.push('hidden skip link leaks into mobile viewport')
await rulesMobile.screenshot({ path: path.join(output, 'rules-impact-mobile.png'), fullPage: true })
await rulesMobile.close()

const functionalClosure = await pageFor(1440, 1100)
await goto(functionalClosure, '/app/baseline')
await functionalClosure.click('.preview-terms')
const termsPreviewPersisted = await textVisible(functionalClosure, 'TIP-2407-03')
await functionalClosure.click('.publish-terms')
await functionalClosure.click('.preview-reference')
const referencePreviewPersisted = await textVisible(functionalClosure, 'RIP-2407-11')
await functionalClosure.click('.publish-reference')
if (!await textVisible(functionalClosure, 'CTR-TERMS-v3')) findings.push('contract terms publish receipt missing')
if (!await textVisible(functionalClosure, 'REF-E101-R7')) findings.push('reference revision publish receipt missing')
assertMarker('persisted-baseline-previews', termsPreviewPersisted && referencePreviewPersisted && await textVisible(functionalClosure, 'TIP-2407-03 спожито'), 'persisted baseline previews are not consumed by publish')
await functionalClosure.screenshot({ path: path.join(output, 'baseline-published-desktop.png'), fullPage: true })
await goto(functionalClosure, '/app/assignments')
await functionalClosure.click('.create-assignments')
if (!await textVisible(functionalClosure, 'NO WRITES YET')) findings.push('assignment persisted preview boundary missing')
await functionalClosure.click('.create-assignments')
if (!await textVisible(functionalClosure, 'ASB-2407-18')) findings.push('assignment occurrence receipt missing')
assertMarker('partial-assignment-row-receipts', await textVisible(functionalClosure, '2 committed · 1 rejected'), 'assignment partial row receipt missing')
assertMarker('deterministic-occurrence-strategies', await textVisible(functionalClosure, '6 occurrences створено один раз'), 'assignment committed occurrence count missing')
await functionalClosure.click('.reassign-assignment')
assertMarker('assignment-reassignment-receipt', await textVisible(functionalClosure, 'ARR-741-05'), 'assignment reassignment receipt missing')
await functionalClosure.click('.acknowledge-reference')
assertMarker('reference-acknowledgement-receipt', await textVisible(functionalClosure, 'RAK-742-04'), 'reference acknowledgement receipt missing')
await functionalClosure.click('.issue-execution-bundle')
assertMarker('offline-authorization-lease', await textVisible(functionalClosure, 'OAL-741-05'), 'offline authorization lease receipt missing')
await functionalClosure.screenshot({ path: path.join(output, 'assignments-receipt-desktop.png'), fullPage: true })
await functionalClosure.click('.assignment-receipt a')
await functionalClosure.waitForFunction(() => location.pathname === '/app/occurrences/demo')
await functionalClosure.waitForSelector('.typed-form input')
if (await functionalClosure.$('.conceal-work')) findings.push('concealment control is reachable before an eligible hold decision')
await functionalClosure.click('.typed-form input')
await functionalClosure.keyboard.down('Control')
await functionalClosure.keyboard.press('KeyA')
await functionalClosure.keyboard.up('Control')
await functionalClosure.keyboard.press('Backspace')
await functionalClosure.type('.typed-form input', '0.52')
await functionalClosure.click('.validate-evidence')
if (await functionalClosure.$('.conceal-work')) findings.push('concealment control is reachable before an eligible hold decision')
await functionalClosure.click('.pass-hold')
await functionalClosure.click('.conceal-work')
if (!await textVisible(functionalClosure, 'CON-742-19')) findings.push('hold point concealment receipt missing')
await functionalClosure.click('.invalidate-evidence')
assertMarker('exact-evidence-invalidation', await textVisible(functionalClosure, 'EVI-742-20') && await textVisible(functionalClosure, 'CR-742-21'), 'evidence invalidation dependency receipt missing')
await functionalClosure.screenshot({ path: path.join(output, 'occurrence-closed-desktop.png'), fullPage: true })
await goto(functionalClosure, '/app/packages/current')
if (!await textVisible(functionalClosure, 'PENDING_RECONCILIATION')) findings.push('package pending reconciliation state missing')
await functionalClosure.click('.record-line-decisions')
assertMarker('resumable-package-decision-set', await textVisible(functionalClosure, '3/3 pending · item versions v1') && await textVisible(functionalClosure, 'PENDING_RECONCILIATION'), 'package partial decision save receipt missing or caused premature state effect')
if (!await textVisible(functionalClosure, '3/3 pending · item versions v1')) findings.push('package partial decision save receipt missing')
if (!await textVisible(functionalClosure, 'PENDING_RECONCILIATION')) findings.push('package partial save caused premature state effect')
await functionalClosure.click('.record-line-decisions')
if (!await textVisible(functionalClosure, 'PDC-2207-14')) findings.push('package line decision receipt missing')
if (!await textVisible(functionalClosure, 'RECONCILED')) findings.push('package decision set final state missing')
await functionalClosure.screenshot({ path: path.join(output, 'package-line-decisions-desktop.png'), fullPage: true })
await functionalClosure.close()

await browser.close()
await new Promise(resolve => server.close(resolve))
const report = {
  ok: findings.length === 0,
  specVersion: '2.9.0',
  executedAt: new Date().toISOString(),
  method: 'Puppeteer + packaged headless Chromium deterministic repository smoke harness',
  buildSource: 'prototype/dist',
  viewportCoverage: ['1487x1058', '1440x1100', '1440x1050', '1440x1024', '1200x850', '390x844'],
  flowFamilies: ['acquisition', 'auth-invite', 'onboarding-import', 'rule-versioning', 'work-detail', 'review-correction', 'variation', 'close-package-submission', 'external-review', 'project-commercials', 'saas-subscription', 'team-access', 'field-offline', 'contract-reference-baseline', 'assignment-occurrences', 'hold-point-concealment', 'package-line-decisions'],
  businessLogicDelta: MARKERS.filter(name => assertedMarkers.has(name)),
  screenshots: screenshotFiles,
  findings,
}
await writeFile(path.resolve('qa-results.json'), `${JSON.stringify(report, null, 2)}\n`)
if (findings.length) {
  console.error(JSON.stringify(report, null, 2))
  process.exit(1)
}
console.log(JSON.stringify(report, null, 2))
