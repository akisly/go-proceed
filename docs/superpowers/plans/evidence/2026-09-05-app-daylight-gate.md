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
