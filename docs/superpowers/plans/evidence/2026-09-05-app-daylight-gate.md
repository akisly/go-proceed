# Evidence — `apps/app` on Daylight (spec 2026-09-05-app-daylight-migration-design.md)

## Baseline (Task 1, 2026-09-05, HEAD 88bc2e6)

Local stack: Docker up, `supabase_db_goproceed` at migration 0083 (equal to the repository).

`pnpm --filter @goproceed/app qa` on the pre-migration app:

```
seeding a user + world failed, authenticated screens will attempt to run anyway and report their own failures: Error: seedWorld: workspaces.create returned 500 {"code":"INTERNAL_ERROR","detail":"Внутрішня помилка.","fieldErrors":[],"requestId":"25253983-8432-4218-8287-fe6156f6f275","retryable":true,"userAction":"retry_later"}
    at httpStep (file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app/qa/field.mjs:426:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async seedWorld (file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app/qa/field.mjs:521:14)
    at async main (file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app/qa/field.mjs:1674:11)
    at async file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app/qa/field.mjs:4233:1
sign-in: audit crashed: TimeoutError: Waiting for selector `#otp-code` failed
    at CSSQueryHandler.waitFor (file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/node_modules/.pnpm/puppeteer-core@25.8.0_yauzl@2.10.0/node_modules/puppeteer-core/lib/puppeteer/common/QueryHandler.js:211:46)
    at async CdpFrame.waitForSelector (file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/node_modules/.pnpm/puppeteer-core@25.8.0_yauzl@2.10.0/node_modules/puppeteer-core/lib/puppeteer/api/Frame.js:546:21)
    at async CdpPage.waitForSelector (file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/node_modules/.pnpm/puppeteer-core@25.8.0_yauzl@2.10.0/node_modules/puppeteer-core/lib/puppeteer/api/Page.js:1404:20)
    at async Promise.all (index 0)
    at async file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app/qa/field.mjs:1728:9
    at async withPage (file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app/qa/field.mjs:1093:5)
    at async file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app/qa/field.mjs:1722:32
    at async runAudit (file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app/qa/field.mjs:1533:5)
    at async main (file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app/qa/field.mjs:1716:5)
    at async file:///Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app/qa/field.mjs:4233:1
/: a signed-in foreman was redirected to /login instead of seeing his list
obligation screen: довідковий disclaimer text not found verbatim anywhere on the page
obligation screen: no norm-ref verification label in the rendered text — the citation's tag line is missing entirely
capture pass: no <input type="file"> found on the obligation screen — is there a photo-evidenceKind occurrence?
/dash/projects/undefined: the «Доручення» link's href is null, expected "/dash/projects/undefined/assignments" — the project → money → доручення chain is broken at its second hop
/dash/projects/undefined: no ₴ figure on the page — the headline sum did not render, or formatMoney produced something that does not look like money
/dash/projects/undefined: expected the approver role's Ukrainian label "технічний нагляд" (technical_supervisor via approverRoleLabel) on the page — either the row did not render, or the label regressed to a raw identifier
/dash/projects/undefined: the blocked-reasons list panel did not render
/dash/projects/undefined: expected the cause-split sentence "з них повернуто замовником: 0" verbatim — either it did not render, or byCause's CUSTOMER_MOTIVATED_REFUSAL count is wrong
register @1280: no longer on the register — path is /login
evidence screen: no <img alt="приклад-фото-qa.jpg"> on /dash/assignments/undefined — the seeded evidence object did not reach the card, or `readUrl` was absent and the «Зображення тимчасово недоступне» fallback rendered instead
evidence screen: the seeded occurrence undefined is not named anywhere on the page — the photo may be rendering in the «Без прив'язки до вимоги» group instead of under its obligation
evidence screen: the review-link form is not on the page (email input found, role input missing) — `IssueReviewLink` renders per occurrence group and this world has exactly one
external review: no link was issued above, so the no-account path was not driven
empty register: expected the «Немає доручень» empty state and no table on http://127.0.0.1:55718/dash/projects/undefined/assignments (tables found: 0) — this project is supposed to have no assignment, so everything below would be measuring the wrong screen
money refusal: no [role="status"] banner naming the missing access on the create screen — statuses found: []
money refusal: expected the heading «Нове доручення» to survive the refusal, found "GoProceed"
money refusal: the banner names the refusal but not what to do about it — its body did not render
assignment creation: expected the heading "Нове доручення", found "GoProceed"
assignment creation: the form did not render (work-item picker found: false, submit control found: false) — the checks below could not run
/dash: a signed-in user was redirected to /login
/Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @goproceed/app@0.0.0 qa: `node qa/field.mjs`
Exit status 1
```

`qa-output/qa-report.json`: `ok: false`, `auditsRun` covers all 8 `expectedAudits` (unauthenticated
surface, sign-in, my assignments list, obligation screen, capture in-flight banner, evidence/the
review link/the external plane, assignment creation, dashboard profile and sign-out), 23 findings.
The root cause is the first line: `seedWorld`'s `workspaces.create` call returns
`500 INTERNAL_ERROR` ("Внутрішня помилка."), so no user/world was seeded and every
authenticated-screen audit downstream fails as a consequence (redirected to `/login`, routes
carrying `undefined` IDs, the OTP selector timing out). Reproduced twice, back to back, on an
unmodified checkout — same failure, same shape, different `requestId` each time — so this is a
deterministic baseline defect in the pre-migration app against local Supabase at migration 0083,
not a flake. This migration must not make it worse; it is not this task's job to fix it.

Captures kept in `apps/app/qa-output-before/` (git-ignored): 11 screenshots.

### Baseline, round 2 (2026-09-05, HEAD fc58acf) — after the environment fix

The round-1 red run traced to `apps/app/.env.local` being absent in this worktree: `next start`
never reads `.env.example`, so `APP_DB_URL`/`SERVICE_DB_URL` were unset, `packages/database`'s
`getPool()` threw `APP_DB_URL is not set` inside every write route, and `POST /v1/workspaces`
answered `500 INTERNAL_ERROR` — see `task-1-diagnosis.md` for the full elimination (schema at
0083, both DB roles present, the identical `POST /v1/workspaces` call returning `201` once those
two vars were supplied by hand). The controller has since created `apps/app/.env.local`
(git-ignored) carrying the two local dev URLs, which fixed that route. Docker and the local
Supabase stack were already up (core containers — db, studio, pg_meta, storage, rest, realtime,
inbucket, auth, kong, vector, analytics — all healthy; only `imgproxy`/`edge_runtime`/`pooler` are
stopped, which nothing here touches) and DB is still at migration 0083.

Re-running `pnpm --filter @goproceed/app build` and `qa` with only that fix applied reproduced a
**second, independent** environment gap: the harness's `sign-in` audit crashed with the same
`Waiting for selector #otp-code failed` timeout as round 1, even though `seedWorld` now succeeded
(real UUIDs in every URL, not `undefined`) — proof this second failure is not a consequence of the
round-1 defect, just a coincidentally identical symptom. Cause: `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are inlined into the client bundle at `next build` time, and
`qa/field.mjs`'s `startNextServer()` only ever sets them (along with `NEXT_PUBLIC_APP_ORIGIN` and
the `EXTERNAL_LINK_*`/`EXTERNAL_SESSION_*` keys) for the **spawned `next start`** — never for the
separate `build` step, which is why `task-1-diagnosis.md` already flagged those two as
harness-provided only at run time. Neither var was exported in this shell, so the build left
`src/lib/supabase-browser.ts`'s `createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, …)`
unresolved; confirmed by grepping the built chunk for the literal env-var name instead of a URL.
In the browser this means `supabaseBrowser()` is constructed with `undefined` and
`signInWithOtp()` throws synchronously inside `otp-form.tsx`'s `requestCode` (a bare `try/finally`,
no `catch`), so the form's phase never advances past the email screen and `#otp-code` never
appears — exactly the observed timeout. `.github/workflows/ci.yml`'s `app-qa` job already documents
this: it sets `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH` (the same
value `supabase status` issues locally) as job-level env specifically because "this job's build
MUST use the real local publishable key: qa/field.mjs signs a real user in through the browser".
Remedy: export those same two variables in the shell before `pnpm --filter @goproceed/app build`,
matching CI. No app file, no `qa/field.mjs`, no migration, and no RLS/grant change was touched —
this is a build-environment gap identical in kind to the `.env.local` one, not a second app defect.

Harness tail, verbatim, from the run kept as this round's baseline (rebuilt with
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` exported):

```
QA passed: 8 of 8 expected audits ran (unauthenticated surface, sign-in, my assignments list, obligation screen, capture in-flight banner, evidence, the review link, and the external plane, assignment creation, dashboard profile and sign-out), zero findings. See qa-output/qa-report.json for the full report and qa-output/screenshots/ for evidence.
```

Captures kept in `apps/app/qa-output-before/` (git-ignored, overwritten from round 1): **42**
screenshots.

The tree moved since round 1 (commits `fbe1ced`, `5e4198c`, `fc58acf`), but only inside
`packages/testing`, `packages/ui`'s `Button` (a new `destructive` variant), and the landing's
kitchen sink — none of which changes what the field client or the office dashboard renders (the
field client still imports its own private `Button`), so this remains a valid "before" capture of
`apps/app` on Daylight.

### Task 5 — first daylight run (2026-09-05, HEAD 24fd9f3)

Local stack unchanged from round 2: Docker up, `supabase_db_goproceed` healthy at migration 0083,
Mailpit at 54324, `apps/app/.env.local` present. `pnpm --filter @goproceed/app build` then
`pnpm --filter @goproceed/app qa`, both run with the daylight visual audit wired in (nine routes,
six widths, reduced motion at 1440/390, the sign-out confirm dialog, and the anonymous `/login` +
OTP code step).

The run is red — 120 findings, not zero. Two of them predate the daylight audit and are a
regression of Task 4, not new-audit input:

```
/a/fe12d03c-62f4-4232-a194-59594a275c8b @375: touch target below 44px — "← Мої доручення" 103x20
/a/fe12d03c-62f4-4232-a194-59594a275c8b @375: anchor "← Мої доручення" (href=/) renders with user-agent link styling — color rgb(36, 64, 217), text-decoration underline; app/globals.css's `a` reset has been lost
```

Both come from the pre-existing "obligation screen" audit (untouched by Task 5, `qa/field.mjs`
lines 1861-1993), at its own long-standing 375px mobile check — not from anything this task added.
The baseline (round 2, HEAD fc58acf, pre-Task-4) was zero findings, so this is new behaviour
introduced by Task 4's migration of the field client onto `@goproceed/ui`: the obligation screen's
"← Мої доручення" back link is a bare `<a>` outside `[data-slot="button"]`, and it now renders
with User-Agent link styling and a 103×20 touch target, where the pre-migration `app/globals.css`
reset apparently covered it. Per this task's brief, no app file is touched to fix it — recorded
here as a concern for Task 4's owner; `qa/field.mjs` itself is not implicated.

The remaining 118 findings are all inside "daylight visual audit" itself — Task 6's input, not
this task's failure. They cluster into three shapes across the nine routes: (1) a handful of
768px touch targets under 44px in the dash shell's tab bar and the seeded email chip; (2) a
"signal budget" finding on every authenticated route and width, `--gp-action-signal` resolving to
a colour that a very large fraction of the page's elements (39 to 141, growing with page
complexity) also carry as their own background — almost certainly the check's own resolved-colour
comparison catching a shared transparent/background-role value rather than a genuine signal-colour
misuse, but that determination is Task 6's, not this one's; and (3) one hard failure, "sign-out
confirm @390: no visible profile control" — `visibleHandle` found no rendered
`button[aria-label="Профіль і вихід"]` at 390px, so that width's inspect+screenshot pair was
skipped (`continue`), which is why the screenshot count below is 75 rather than the expected 76.
No status-colour-alone finding and no font-face finding fired anywhere in this run — the Onest
face and the status/colour rule both held on all nine routes at all six widths, including reduced
motion.

Harness tail, verbatim (`pnpm --filter @goproceed/app qa 2>&1 | tail -30`):

```
/dash/settings/profile (reduced motion) @1440: 104 elements carry the signal background (html, head, meta) — at most one per screen
/dash/settings/profile (reduced motion) @390: 104 elements carry the signal background (html, head, meta) — at most one per screen
sign-out confirm @1440: 116 elements carry the signal background (html, head, meta) — at most one per screen
sign-out confirm @390: no visible profile control
/login @1920: 39 elements carry the signal background (html, head, meta) — at most one per screen
/login @1440: 39 elements carry the signal background (html, head, meta) — at most one per screen
/login @1240: 39 elements carry the signal background (html, head, meta) — at most one per screen
/login @768: 39 elements carry the signal background (html, head, meta) — at most one per screen
/login @390: 39 elements carry the signal background (html, head, meta) — at most one per screen
/login @360: 39 elements carry the signal background (html, head, meta) — at most one per screen
/login (reduced motion) @1440: 39 elements carry the signal background (html, head, meta) — at most one per screen
/login (reduced motion) @390: 39 elements carry the signal background (html, head, meta) — at most one per screen
/login (code step) @1440: 42 elements carry the signal background (html, head, meta) — at most one per screen
/login (code step) @390: 42 elements carry the signal background (html, head, meta) — at most one per screen
/Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @goproceed/app@0.0.0 qa: `node qa/field.mjs`
Exit status 1
```

`ls apps/app/qa-output/screenshots/daylight | wc -l` → **75** (expected 76; the missing one is
`dash-sign-out-390.png`, accounted for above). `pgrep -fl "next start"` after the run: empty — the
harness's spawned server was killed as expected.

`node_modules/.pnpm/puppeteer-core@25.8.0_yauzl@2.10.0/node_modules/puppeteer-core/lib/puppeteer/api/Page.d.ts`
(puppeteer-core 25.8.0) confirms the three calls this audit uses: `setViewport(viewport)`,
`emulateMediaFeatures(features?)`, and `screenshot(options)` with a `fullPage` option — all used
as documented, no shape surprises against the installed version.

### Task 5 — fix round 1 (2026-09-05, HEAD e26bd3c)

Controller ruling on the first daylight run's three defects (R5) plus the Task 4 `link`-variant
regression (R6). Two files touched: `packages/ui/src/components/Button.tsx` and
`apps/app/qa/field.mjs`.

**Part A — `packages/ui/src/components/Button.tsx`.** The `link` variant composed `h-auto px-0`
with no touch floor, so `<Button asChild variant="link" size="sm">` around the field client's
"← Мої доручення" back link measured 103×20 at 375px — under the 44px floor the component's own
docstring promises. Fixed by making the `link` branch `"h-auto px-0
touch:min-h-(--gp-control-height-touch)"` (a token via `min-h-(…)`, Tailwind 4 syntax for
`min-height: var(…)`; `@custom-variant touch (@media (pointer: coarse))` already exists in
`base.css:49`). Separately, `data-slot="button"` is now rendered on both the `asChild` path
(`<Slot.Root data-slot="button" …>`) and the default path (`<Press data-slot="button" …>`) —
`Press.tsx` already spreads unknown props (including `data-*`, which TypeScript's JSX checker
allows on any component regardless of its declared prop type) onto the underlying `<button>` /
`motion.button`, so no change was needed inside `Press.tsx` itself. The docstring's size paragraph
gained one sentence: "`link` has no height of its own but keeps the touch floor as a minimum."

```
pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts src/tw-merge.test.ts
  Test Files  2 passed (2)
       Tests  26 passed (26)

pnpm --filter @goproceed/ui typecheck
  tsc --noEmit — no output, exit 0

pnpm --filter @goproceed/landing test
  Test Files  10 passed (10)
       Tests  96 passed (96)
```

**Part B — `apps/app/qa/field.mjs`.** Three defects in the daylight visual audit itself, fixed
without touching any app component:

1. The signal-budget probe read `--gp-action-signal`, which does not exist —
   `packages/ui/src/tokens.generated.css:179` defines `--gp-action-signal-bg`. Fixed to read the
   right variable, and guarded: if the resolved colour is empty or `rgba(0, 0, 0, 0)`, the probe
   now pushes one finding (`"… signal probe: --gp-action-signal-bg did not resolve"`) instead of
   walking the DOM and reporting a huge, meaningless element count.
2. `width <= 768` treated 768 (the `md` breakpoint, the icon-rail DESK state) as touch. All five
   occurrences inside the new audit — the `inspect` touch-floor check, both `walkRoute` loops, the
   sign-out-confirm loop, and the anonymous code-step loop — now read `width < 768`, matching every
   other touch check already in the file.
3. Below 768 the profile control lives inside the mobile drawer. The sign-out-confirm loop now
   opens the drawer first when `width < 768` (`click 'button[aria-label="Відкрити меню"]'` →
   `waitForSelector('[role="dialog"]')` → `waitForAnimations`) and then looks for the profile
   trigger scoped to the dialog (`'[role="dialog"] button[aria-label="Профіль і вихід"]'`); the
   1440 path is unchanged.
4. In passing: the `measureUaStyledLinks` docstring's `src/ui/button.tsx` reference (a Task 4
   leftover — that private component no longer exists) was reworded to `@goproceed/ui`'s Button
   `link` variant.

Local stack unchanged: Docker up, `supabase_db_goproceed` healthy at migration 0083, Mailpit at
54324, `apps/app/.env.local` present.

```
pnpm --filter @goproceed/app build
  ✓ Compiled successfully — no errors

pnpm --filter @goproceed/app qa
```

Harness tail, verbatim:

```
> @goproceed/app@0.0.0 qa /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/apps/app
> node qa/field.mjs

QA passed: 9 of 9 expected audits ran (unauthenticated surface, sign-in, my assignments list, obligation screen, capture in-flight banner, evidence, the review link, and the external plane, assignment creation, daylight visual audit, dashboard profile and sign-out), zero findings. See qa-output/qa-report.json for the full report and qa-output/screenshots/ for evidence.
```

**Zero findings remain.** All three of the new audit's own defects (shapes 1-3 in the first-run
entry above) were caused by the bugs just fixed — the signal-budget storm was the wrong variable
name resolving to nothing and matching everything; the 768px tab-bar findings were the icon-rail's
DESK state being probed as touch; the `sign-out confirm @390` hard failure was the profile control
being looked for outside the drawer that now hides it. Fixing the audit's own defects, rather than
the app, made all 118 daylight findings disappear along with them — there is nothing left over
for Task 6 to triage from this run. The two Task 4 regression findings (the obligation screen's
"← Мої доручення" link) are also gone, fixed by Part A's touch floor and `data-slot` change.

`ls apps/app/qa-output/screenshots/daylight | wc -l` → **76** (the expected count; `dash-sign-out-390.png`
is present — the drawer fix let that width's profile control be found).
`pgrep -fl "next start"` after the run: empty.

## Task 6 — the visual pass (2026-09-05, captures at b9def69)

**Reviewed by the controller** against `DESIGN.md` Do/Don't, `docs/design/02-building-ui.md` §6 and §9, and the rewrite plan §10. The captures are `apps/app/qa-output/screenshots/daylight/` at commit b9def69 (76 files: 9 routes × 6 widths, 9 × 2 reduced-motion, the sign-out confirm at 1440/390, the OTP code step at 1440/390); the «before» set is `apps/app/qa-output-before/` from the round-2 baseline (673f9b3). Read in the plan's order: the sign-out confirm and the OTP code step first, then the dash shell, register and money screen, the creation and evidence screens, the three field screens against their before-captures, and the reduced-motion passes — 28 captures opened, the rest covered by the audit's assertions (overflow, touch floor, UA links, the signal budget, status-with-text, the face).

**Machine assertions:** `pnpm --filter @goproceed/app qa` → `QA passed: 9 of 9 expected audits ran … zero findings` (tail pasted under «Task 5 — fix round 1»).

| # | Route @ width | Defect | Rule | Fix | Disposition |
|---|---|---|---|---|---|
| 1 | `/a/{id}` @375, @390 | the back link «← Мої доручення» rendered 103×20 and was reported as UA-styled: the shared Button's `link` variant had no touch floor and emitted no `data-slot` | «never below 44px on touch» (system.md §5, Button.tsx) | `touch:min-h-(--gp-control-height-touch)` on `link`; `data-slot="button"` on both render paths | fixed here (177dcbe) |
| 2 | every authenticated route, every width | 118 findings from the new audit — the probe read `--gp-action-signal` (the variable is `--gp-action-signal-bg`), treated 768 as touch, and looked for the profile control outside the drawer at 390 | the audit's own defects, not the app's | the audit corrected | fixed here (b9def69) |
| 3 | `apps/app/app/globals.css` header; four comments in `src/components/**`; `qa/field.mjs:1175` | the header does not name four legacy rules and their disposition (`svg{flex-shrink:0}`, the `border-color` default, `table{border-spacing:0}`, `h1–h3{letter-spacing}`); four comments describe the legacy stylesheet in the present tense | documentation accuracy (Task 4 review, Low ×2) | one sentence in the header; the comments repointed; `/dash-theme/` added to the retired list | fixed here (Task 6 fix commit) |
| 4 | `/dash/**` rail, every width | the four nav items read as disabled grey with no active marker | rewrite plan §10.1 (active item `text.primary` + 3px signal bar) | none here: the items are deliberate `disabled` placeholders until slices D1–D4 (`sidebar.tsx`, «all four become real links in D1–D4»); identical in the before-capture | TODOS |
| 5 | `/dash/projects/{id}/assignments` @390, @360 | the register is a horizontally scrolling table inside the panel, not the `< md` card rendering | rewrite plan §10.2 / system.md §5 «three renderings» | none here: structural, pre-existing, not palette-caused | TODOS |
| 6 | `/` («Мої доручення») @390 | the row subtitle renders a bare «м» for a work item with no quantity | copy/data, present in the before-capture | none here | TODOS |

**What reads right:** warm paper canvas and white panels with `line` rules; ink primary buttons («Вийти», «Нове доручення», «Відправити на перевірку») and exactly one cobalt signal per screen (the OTP submit); Onest on every heading and body, `tabular` figures on the money screen with `MoneySummary` the only 32px figure; the focus ring in cobalt on the OTP input and the dialog's «Скасувати»; the drawer over the canvas with `shadow-modal` and static under reduced motion; the field screens byte-identical in copy and layout to their before-captures with the palette and face swapped — the obligation card, the requirement box on `subtle`, the «Не надіслано» state, the disclaimer under a `line` rule. The dash captures are identical before and after: it was already on the roles.

**Not looked at (out of scope by spec §8):** `apps/mobile`; the external plane's own screens (its `app/external/**` files carry no legacy name — measured in Task 2's scan).

## Task 8 — the gate (2026-09-06, HEAD 9d47fd3)

**Ruling (carried from the landing work).** The local stack is up for the browser harness, but `packages/testing`'s database suites and `apps/app`'s `*.int.test.ts` stay CI's: the eleven non-database suites plus the new `app-entry.test.ts` stand in for `pnpm --filter @goproceed/testing test`, and the app's unit suites run with the integration files excluded.

### 1. `pnpm --filter @goproceed/tokens generate` → `git status --short`

```
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/ui/src/tokens.generated.css
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/ui/src/theme.generated.css
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/tokens/src/tokens.generated.ts
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/tokens/src/tokens.dtcg.json
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/testing/qa/palette.generated.mjs — 59 approved triplets
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/docs/design/01-tokens.md
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/ui/src/tw-merge.generated.ts
```

`git status --short` afterwards: empty.

### 2. `node packages/testing/qa/motion-audit.mjs`

```
motion-audit: clean
```

### 3. the twelve non-database `packages/testing` suites

```
 Test Files  12 passed (12)
      Tests  163 passed (163)
```

### 4. `pnpm turbo run typecheck`

```
 Tasks:    10 successful, 10 total
```

### 5. `pnpm --filter @goproceed/app build`

```
✓ Compiled successfully in 1010ms
```

### 6. `pnpm --filter @goproceed/app exec vitest run --exclude "**/*.int.test.ts"`

```
 Test Files  57 passed | 1 skipped (58)
      Tests  524 passed | 1 skipped (525)
```

### 7. `pnpm --filter @goproceed/landing test`

```
 Test Files  10 passed (10)
      Tests  96 passed (96)
```

### 8. `pnpm --filter @goproceed/app qa`

```
QA passed: 9 of 9 expected audits ran (unauthenticated surface, sign-in, my assignments list, obligation screen, capture in-flight banner, evidence, the review link, and the external plane, assignment creation, daylight visual audit, dashboard profile and sign-out), zero findings. See qa-output/qa-report.json for the full report and qa-output/screenshots/ for evidence.
```

`pgrep -fl "next start"` afterwards: empty.

### 9. `pnpm validate:canonical-docs`

```
> goproceed@ validate:canonical-docs /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a
> node scripts/validate-canonical-docs.mjs
canonical documentation: OK
```
