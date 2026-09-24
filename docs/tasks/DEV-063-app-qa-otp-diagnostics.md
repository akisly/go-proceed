# DEV-063 — app-qa: diagnose and repeat the daylight audit's code request

## Assignment

- Objective and user-visible outcome: CI's `app-qa` job stops failing with only «Waiting for selector `#otp-code` failed» to show for it. Each failed code request in the daylight audit records what GoTrue answered and what the page showed, and the request is repeated once. A pass that needed the repeat leaves a `::warning::` annotation. That way BL-158's cause turns up in the log without turning the run red.
- State: verifying
- Coordinator: primary Claude Code session, 2026-09-24
- Execution mode: independent subagents for the stages root `AGENTS.md` requires
- Selected route and why (`agents/COORDINATION.md`): "New behavior inside existing boundaries" (Implementer → `gp-reviewer` → `gp-qa`). The change is to executed code under `apps/`, the browser harness. The cause is not understood yet, so "bounded bug with an understood cause" does not fit.
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: none. `apps/app/qa/**` is not a UI path in the `gp-ui-reviewer` trigger list. No CI permissions, action pins, auth code, secrets or environment variables change, so `gp-security` is not triggered. The GoTrue and CLI facts were read from vendor source at the installed versions (Sources), not from a researcher.
- Owning module and allowed edit paths: `apps/app/qa/field.mjs`; `docs/BACKLOG.md` (BL-158); this record and `docs/tasks/README.md`.
- Read context and applicable local instructions: root `AGENTS.md`, `apps/app/AGENTS.md`, `.github/workflows/ci.yml` (`app-qa`), `supabase/config.toml` (`[auth.rate_limit]`, `[auth.email]`), `apps/app/app/(auth)/login/otp-form.tsx`, `apps/app/src/lib/otp-error.ts`.
- Linked spec (`docs/specs/…`), ADR or earlier task: BL-158 (opened here).
- Baseline: `9d050cca` (origin/main, merge of #133). The work started on `919a8c10` (merge of #132) and was rebased before commit (QA D1).
- Dependencies / constraints / out of scope:
  - Out of scope: the root cause. It is unknown, and BL-158 stays open until a run shows it.
  - Out of scope: the sign-in audit's own code request (`field.mjs`, "sign-in"). It has not failed and it still waits without a diagnostic.
  - Constraint: the local Supabase stack is shared. The owner chose not to run the full harness locally (Owner decisions).
- Required acceptance criteria:
  1. A failed code request in the daylight audit's `/login (code step)` loop becomes a finding that names, per attempt, the `POST /auth/v1/otp` status and body (or that none answered), the `role="alert"` text (or that none appeared), the URL, the typed address and the submit button's disabled state, plus a screenshot file. It is no longer an opaque crash.
  2. The request is repeated once, 2 s after a failure. A pass on the repeat prints a `::warning::` line carrying the first attempt's diagnostic, and the audit continues.
  3. A first-attempt pass behaves exactly as before: same screenshots and same `inspect` checks, with no warning.
  4. BL-158 records the observed failures, what was ruled out and how it closes.
  5. `node --check apps/app/qa/field.mjs` and `pnpm validate:canonical-docs` pass.
- Skipped stages and rationale: `gp-security`, `gp-ui-reviewer`, `gp-architect` and `gp-mobile` were not triggered (above).

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | Do not run the full harness against the shared local stack. Fix it in CI: add the diagnostic and one repeat with `::warning::`, so the cause shows in the next failure without turning the run red. | Chat, «Не гонять, чинить в CI» |

## Plan

1. Evidence. Fetch the five runs' app-qa job logs and the three runs' `app-qa-output` artifacts, and compare what each run produced. Check: which screenshots are missing in the failing runs.
2. Rule out the limits from GoTrue v2.195.0 and CLI 2.115.0 source (Sources).
3. Rule out a browser-side race. Run the audit's exact sequence against a production build of `apps/app` with GoTrue mocked, 15 rounds at 1x and 15 at 6x CPU throttling.
4. `apps/app/qa/field.mjs`: add `requestOtpCode(page, loginUrl, email, { retries, timeoutMs, failureShot })` and use it in the daylight loop with `retries: 1`. Check: `node --check`, plus the helper extracted and driven through four mocked outcomes (200; 500 then 200; always 429; `/otp` never answered).
5. BL-158 in `docs/BACKLOG.md`. Check: `pnpm validate:canonical-docs`.
6. `gp-reviewer`, then `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | coordinator | In both failing runs `login-code-1440.png` exists and `login-code-390.png` does not, so it is always the third code request of the run for the same address. Harness code was identical across all five runs (`git diff bfbc0f5d origin/main -- apps/app/qa/field.mjs` is empty). The `supabase db reset` retry appears in every run. | job logs 107635316713, 107654794894 (red); 107654265139, 107653314241, 107654782810 (green); artifacts of 36000385535, 36006179453, 36006019978 | GoTrue source |
| 2 | coordinator | The limits do not explain it. The CLI's `gotrue.service.ts` sets `GOTRUE_RATE_LIMIT_EMAIL_SENT: "360000"` and uses `email_sent` only when `[auth.email.smtp]` is set. `/otp` goes through `newLimiterPer5mOver1h(RateLimitOtp)` with burst 30. `sendMagicLink` refuses only within `SMTP.MaxFrequency` (config.toml `1s`) of `recovery_sent_at`. | Sources | browser repro |
| 3 | coordinator | No browser-side race. 0 of 30 rounds failed at 1x and 0 of 30 at 6x throttle, and the input had React props attached and the submit button was enabled at every click. | `scratchpad/repro.mjs` (not committed) | implement |
| 4 | coordinator | `requestOtpCode` added, and the daylight loop uses it with one repeat. Mocked outcomes: 200 passes with no attempts. 500 then 200 passes with one diagnostic (alert text, `→ 500` body, screenshot). Always 429 fails with two diagnostics carrying «Забагато спроб…» and `→ 429`. A request that is never answered fails with «no #otp-code and no alert», «no POST /auth/v1/otp answered» and `submitDisabled: true`. | `scratchpad/dev063-helper-scenarios.txt` | BL-158, review |
| 5 | `gp-reviewer` round 1 | PASS with minors: R1-01…R1-07, no blocker or major. | agent report, 2026-09-24 | rework within the stated fixes |
| 6 | coordinator (rework) | R1-01…R1-03, R1-05…R1-07 fixed as stated. For R1-04, the committed daylight loop and helper were extracted from `field.mjs` and run against the mocked build. 200: both widths inspected, no finding, no log. 500 then 200 and HTML 502 then 200: one `::warning::` line each, single-line, `%` sent as `%25`, both widths inspected. Connection refused every time: two findings, `failed: net::ERR_CONNECTION_REFUSED`, and the 390 width still ran. No answer, then 429: `sent yes, no answer within 15000ms` with the button reading «Надсилаємо…», then `answered 429`. | `scratchpad/dev063-r2-caller-scenarios.txt` (driver `helper-test2.mjs`) | `gp-qa` |
| 7 | `gp-qa` | Criteria 1, 2, 3 and 5 PASS on the mocked build; the coordinator's scenario output was reproduced. Every R1 fix is in place. Criterion 4 FAIL on D1 (backlog number taken on main). | agent report; `scratchpad/qa-run/scenarios.txt` | rebase, renumber |
| 8 | coordinator | Rebased onto `9d050cca`; BL-157 renumbered to BL-158 in `field.mjs`, the backlog, the index and this record; `pnpm validate:canonical-docs` OK; `node --check` OK. | this record | `gp-qa` re-check of criteria 4 and 5 |
| 9 | `gp-qa` round 2 | Criteria 1–5 PASS on `9d050cca` plus the staged change. `field.mjs` differs from the round-1 revision only by the BL number. No new defects. The CI-only items stay NOT RUN and do not block. | agent report, 2026-09-24 | commit, PR; record the first CI run |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | minor | `field.mjs` `requestOtpCode`, the `waitForFunction` rejection | Expected: the real error is named. Actual: every rejection was reported as a timeout. | coordinator | Keeps `{ err }`. A non-`TimeoutError` prints «the wait failed: name: message». |
| R1-02 | minor | same, the diagnostic | Expected: "never sent", network failure and slow answer can be told apart. Actual: all three printed «no POST … answered». | coordinator | Adds `waitForRequest` (`sent yes/no`), a `requestfailed` listener (`failed: …`), `submitLabel`, and the page's console warnings and errors for the attempt. The header lists which field tells which cause. Evidence: row 6. |
| R1-03 | minor | the `::warning::` line | Expected: one annotation. Actual: a multi-line body would split it, and `%` was not escaped. | coordinator | Each attempt line goes through `oneLine`, and the caller escapes `%` as `%25`. Evidence: row 6, the HTML 502 case. |
| R1-04 | minor | the caller's branches were unexercised | Expected: evidence for criterion 2. Actual: checked by reading only. | coordinator | The committed loop was run against the mock. Evidence: row 6. |
| R1-05 | nit | a screenshot named when it was not saved | Expected: an honest name. | coordinator | A failed screenshot is reported as «none (screenshot failed: …)». |
| R1-06 | nit | BL-158 and the header stated "seconds apart" as fact | Expected: say it was not measured. | coordinator | Both now say it was expected, not measured. |
| R1-07 | nit | the header said the helper prints the warning; BL-158 had no fallback exit | Expected: the header matches the code, and BL-158 has an exit if the failure never returns. | coordinator | The header names the caller. BL-158 proposes removing the repeat by 2026-10-31 if nothing appears; the owner still has to agree. |
| D1 | major (QA) | `docs/BACKLOG.md`, the backlog number | Expected: a free number. Actual: main's DEV-060 (#133, merged while this was in review) took BL-157. | coordinator | Rebased onto `9d050cca` and renumbered to BL-158. The validator requires sequential ids, so BL-159 fails while BL-158 is not on main. Open PR #135 (`claude/field-decisions`, DEV-061) also uses BL-158. Whichever of the two merges second renumbers. |
| D2 | nit (QA) | the record's Sources | Expected: every puppeteer API the helper relies on is cited. Actual: `waitForRequest` and the `requestfailed` event were missing. | coordinator | Both added to Sources. |

Rework count and hypothesis changes: hypothesis 1 (config.toml's `email_sent = 2`) was dropped at step 2: the CLI does not pass it to a local stack without custom SMTP. Hypothesis 2 (hydration race: the click lands on the SSR-disabled submit) was dropped at step 3.

## What is not true after this task

- The cause of the failure is not known. BL-158 stays open. The repeat can hide a real regression in the code request only while the second attempt passes. A regression that fails both attempts is still a finding.
- The fix has not run in CI yet. Whether the repeat absorbs the failure, and what the diagnostic says, is known only after a run.
- The sign-in audit's code request has neither the diagnostic nor the repeat.
- The full harness was not run locally (owner decision). The helper was exercised only against a production build of `apps/app` with GoTrue mocked in the browser.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. A double failure is a finding with the per-attempt diagnostic and a screenshot | yes | `9d050cca` + DEV-063 change | `gp-qa`'s run of `helper-test2.mjs` (the committed loop and helper, GoTrue mocked): the abort-always and hang-then-429 cases | PASS | assisted: GoTrue mocked in the browser against a production build; the "sent no" and non-timeout wait-error paths checked by reading only |
| 2. One repeat after 2 s; a pass on the repeat prints `::warning::`, and the audit continues | yes | same | the same run: the 500→200 and HTML 502→200 cases | PASS | assisted: mocked as above; whether Actions renders the annotation is known only after a CI run |
| 3. A first-attempt pass behaves as before | yes | same | the same run: the 200 case, with both widths inspected and screenshotted, no finding and no log | PASS | assisted: `inspect` and `waitForAnimations` stubbed in the driver; their lines are unchanged in the diff |
| 4. BL-158 records the failures, what was ruled out and how it closes | yes | same | `gp-qa` round 2 read of `docs/BACKLOG.md` | PASS | Open PR #135 also uses BL-158; whichever merges second renumbers |
| 5. `node --check` and `pnpm validate:canonical-docs` | yes | same | both exit 0 (coordinator and `gp-qa`) | PASS | |
| The real CI flake: whether the repeat absorbs it and what the diagnostic says | no | none | the first `app-qa` run that includes this change | NOT RUN | not-provable-locally: needs CI runs; the owner declined a local harness run |

## Sources

- Supabase CLI v2.115.0 (the pin in `.supabase-cli-version`), `apps/cli/src/legacy/commands/start/services/gotrue.service.ts`: https://github.com/supabase/cli/blob/v2.115.0/apps/cli/src/legacy/commands/start/services/gotrue.service.ts. Accessed 2026-09-24.
- Supabase Auth (GoTrue) v2.195.0, the image CI pulls (`supabase/gotrue:v2.195.0` in the job log). Files: `internal/api/mail.go` (`sendMagicLink`, `validateSentWithinFrequencyLimit`), `internal/api/api.go` (route limiters), `internal/api/apilimiter/apilimiter.go` (`newLimiterPer5mOver1h`, burst 30) and `internal/api/middleware.go` (`performRateLimiting`): https://github.com/supabase/auth/tree/v2.195.0/internal/api. Accessed 2026-09-24.
- puppeteer-core 25.8.0 (the version in the job's stack trace): `page.waitForResponse`, `page.waitForRequest`, `page.waitForFunction` and the `requestfailed` page event, used as documented at https://pptr.dev/api/puppeteer.page.waitforresponse, https://pptr.dev/api/puppeteer.page.waitforrequest, https://pptr.dev/api/puppeteer.page.waitforfunction and the `requestfailed` event in https://pptr.dev/api/puppeteer.pageevent. Accessed 2026-09-24.

## Completion / handoff

- Changed / inspected files: `apps/app/qa/field.mjs`, `docs/BACKLOG.md`, `docs/tasks/DEV-063-app-qa-otp-diagnostics.md`, `docs/tasks/README.md`.
- Review independence: independent — `gp-reviewer` (round 1) and `gp-qa` (rounds 1 and 2) as subagents.
- Verified scope: the daylight audit's `/login (code step)` loop and `requestOtpCode` against a production build with GoTrue mocked; BL-158; the docs validator.
- Remaining risks / blocked requirements: BL-158's cause. The BL-158 number collides with open PR #135.
- Next bounded action and owner: the owner merges the PR. The coordinator records the first `app-qa` run with this change under BL-158, and renumbers if #135 merges first.
- Final state and reason: verifying. Every required criterion passes; the record moves to done once the PR is merged.
