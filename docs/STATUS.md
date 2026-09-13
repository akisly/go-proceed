# GoProceed status

The current state of GoProceed, area by area: what is merged, what runs, what is verified and what is open. The rules for changing it are in root [AGENTS.md](../AGENTS.md) and [agents/COORDINATION.md](../agents/COORDINATION.md); the precedence ladder in [docs/README.md](README.md) outranks everything here.

Only the coordinator updates this file; specialist roles return handoffs. **Every entry is an observation as of its date.** Re-check git, CI and `supabase/migrations/` before relying on one. A row cites what a reader can re-run or open; where an older document disagrees with git, the row follows git and the disagreement is listed under «Open issues».

`scripts/validate-canonical-docs.mjs` fails when the latest-migration marker below differs from the last file in `supabase/migrations/`. Updating the number means re-observing that row, not only the number.

## Current — 2026-09-13

Observed at `main` `dbd4c36`. Nothing here queried a hosted database or the Vercel API; hosted state comes from the dated records cited.

| Area | State | Evidence | Open |
|---|---|---|---|
| Database migrations | The tree ends at <!-- latest-migration -->`0084` (84 files, `0001`–`0084`). `0084` was added in `bd08da9` (2026-09-09) and merged in #78 (`a75b0d8`, 2026-09-13). The only hosted apply on record is staging, 58/58, on 2026-08-19 | `ls supabase/migrations`; [infra/README-staging.md](../infra/README-staging.md) §Status | No apply record for `0059`–`0084` (26 migrations). Who pushes, on what trigger, and the rollback are undecided (runbook §10 Q-9). The local database head was not re-observed |
| v1 API | 75 v0.1 scope rows (M1 35, M2 9, M3 6, M4 6, M5 6, M6 3, M7 10); 66 `route.ts` files under `apps/app/app/v1`. A read-only subagent pass found a route file exporting the method for every scope row, and one route in no scope file (`POST /v1/organizations`) | `technical/openapi/scope-v0.1.csv`; `find apps/app/app/v1 -name route.ts` | No milestone M1–M7 is formally closed, and no closure procedure exists (runbook Q-2). The route check covers method exports, not behaviour |
| PWA field client (`apps/app`) | Built, and the pilot's working field client. Production at `goproceed-app.vercel.app` was recorded on 2026-08-19 (`/login` 200, one owner sign-in on a laptop). Last page change: #72 (Daylight, 2026-09-05) | `infra/README-staging.md` §Status; `git log -- 'apps/app/app/(app)'` | The parity gate (runbook §8.3, ADR-009) is open: iPhone measurements exist from 2026-08-21, none from Android. `TODOS.md:665` (P1, plan C) |
| Office dashboard | Plan D slices D0–D3 are merged: #45 (2026-08-22), #46 and #48 (2026-08-23), #54 (2026-08-29); its Daylight pass is in #72. D4, members and access, has no route | Merge commits on `main`; `apps/app/app/(dash)/dash/` | D4 waits on the member-identity decision (runbook Q-15). The dashboard shows no assurance level (M0 item 6) |
| Landing (`apps/landing`) | Vercel project `goproceed-landing`, first deployed 2026-08-20. Daylight and prototype parity merged in #71–#77 (2026-09-05 to 2026-09-08). `/api/pilot` delivers a request by Telegram or Resend and stores nothing | `infra/README-staging.md:454-487`; `apps/landing/app/api/pilot/route.ts` | No record says production serves the 2026-09-08 tree. The five delivery variables are owner actions (`infra/README-staging.md:468-471`) with no record of being set |
| Mobile (`apps/mobile`) | Expo SDK 57 (`expo` 57.0.9), shipped only as a web export at Vercel `goproceed-field` (created 2026-08-21; iPhone Safari sign-in measured). Never built with EAS; `app.json` has no EAS project id; no store listing | `apps/mobile/package.json`, `app.json`, `eas.json`; [apps/mobile/AGENTS.md](../apps/mobile/AGENTS.md) | The parity gate (§8.3). The Daylight pass of `apps/mobile` was deferred by the owner on 2026-09-05 |
| Telegram channel (ADR-011, M7) | Merged and enabled in no environment: #58 (2026-09-03, `0061`–`0079`), #65 (identity erasure, `0081`), #68 and #69 (2026-09-04, `0082`–`0083`), #78 (the card's tag and source, `0084`, 2026-09-13) | Merge commits; `apps/app/vercel.json` has no crons, so `app/internal/telegram/jobs/route.ts` has no caller; `src/lib/telegram/ingress.ts` has no rate-limit code | Before any environment enables the webhook: the Task 13 edge rate limit, a scheduler for the jobs route (Q-12), and the real-group staging pass (Q-17, blocked by M0's real-data rule). Retention durations are NULL (`TODOS.md:3313`) |
| M0 gates | None of the twelve is closed. The `production-readiness.md` checklist has 32 open items and none checked; dated evidence entries exist for gates 2 and 4 (2026-09-03) | `grep -c -- '- \[ \]' docs/delivery/production-readiness.md`; runbook §5.1–§5.12, measured 2026-09-03 | Owner decisions Q-3 (domain), Q-4 (retention durations), Q-9, Q-10 (malware control), Q-11 (export), Q-12 (monitoring). The card half of item 9 landed on 2026-09-13 with no evidence entry |
| CI | `main` green on every completed run observed: 34771325867 (#81), 34758143582 (#80), 34754767259 (#79). Run 34778658900 (#82, `dbd4c36`) was in progress. The eighteen red `apps/app` cases closed on 2026-09-04. Supabase CLI pin `2.115.0` | `gh run list --workflow ci --branch main`; `TODOS.md:3433`; `.supabase-cli-version` | The runbook's statements of the eighteen cases (dated 2026-09-03) still read as open. `test-strategy.md` §Baseline (C-16). No quarantine ledger (Q-8), no supply-chain gate (Q-16) |
| Agent workflow | The `gp-*` roles and task records are the process. DEV-001 to DEV-003 are done: #79, #80, #81 and #82, all merged 2026-09-13. DEV-004 is this change | [docs/tasks/README.md](tasks/README.md) | The retired workflow plugin stays enabled at user level, owner-accepted (DEV-002 criterion 8b); `CLAUDE.md` and `docs/ai-workflow.md` still say it is disabled. DEV-005 to DEV-007 (backlog triage, TODOS freeze, design sources) are not started |
| Outreach | Last evidenced send: 2026-07-28, 21 emails. Four follow-up materials drafted 2026-08-23, unsent. A ten-company pilot outreach pack prepared 2026-08-25, unsent | [outreach-log.md](discovery/outreach-log.md); [2026-08-23-validation-push.md](discovery/2026-08-23-validation-push.md); `outputs/` | The send and the URL it points at are owner decisions (runbook Q-3). Assumptions A-1 to A-8 are unvalidated. `outputs/` tracks 250 files, some naming companies and contact routes: a privacy review is planned for DEV-007 |
| Deployments | Three Vercel projects are documented: `goproceed-app` (Production builds only, 2026-08-19), `goproceed-landing` (2026-08-20), `goproceed-field` (2026-08-21) | `infra/README-staging.md` | Which commit each project serves today was not observed. No custom domain (Q-3) |

## Review independence

- **From 2026-09-13**, root AGENTS.md requires an independent `gp-reviewer` and `gp-qa` on every behavior change. DEV-003 ran them as native `gp-*` roles; DEV-002 ran them as independent subagents through the Markdown fallback; DEV-001 used an independent upstream reviewer persona, with same-session verification of its fixes.
- **Before 2026-09-13**, a slice's review is whatever its gate record under `docs/superpowers/plans/evidence/` records; [docs/superpowers/README.md](superpowers/README.md) lists the specs and their outcomes. The runbook's §4.3 measured that the product, engineering and design review gates last produced a verdict on 2026-07-31.
- Rows above that cite only merge commits (dashboard slices, landing, mobile) carry the review their own PR or gate record shows; this file does not re-grade them.

## Open issues

Places where a live document disagrees with git on 2026-09-13. Each is a correction owed, not made here.

- **The eighteen red cases and the card tag.** Runbook §1.1, §1.3, §1.6, §5.9, §5.11, §5.14 and §5.15, and ADR-011 §"Status against the runtime", describe both as open. #69 closed the first on 2026-09-04 and #78 the second on 2026-09-13.
- **Hosted migrations.** `docs/delivery/version-0.1.md` (last reviewed 2026-08-08) says `0041`–`0050` were never applied; the staging record says 58/58 on 2026-08-19. The runbook counts 23 unapplied migrations; the tree now has 26 after `0058`.
- **`infra/README-staging.md` contradicts itself** on whether anything has run, on whether `goproceed-landing` has environment variables, and on where `apps/mobile/vercel.json` lives.
- **`TODOS.md:741`** says D1–D4 remain; D1–D3 are merged (runbook C-12).
- **The card's closure date.** `TODOS.md` and ADR-011 say 2026-09-08; the commits are dated 2026-09-09 and the merge 2026-09-13.

## Next action

1. Review and merge DEV-004. The owner confirms its Progress row 3: the frozen specs were not edited, and their outcomes are recorded in `docs/superpowers/README.md` instead.
2. DEV-005: triage `TODOS.md` and the HANDOFF files into `docs/BACKLOG.md`, moving HANDOFF facts here only after checking them against git.
3. Write the M0 evidence entries the runbook orders first (§5.14 order 1: items 9 and 10). The card half of item 9 is now on `main`.
4. Before any environment enables the Telegram webhook: the Task 13 edge rate limit and the scheduler decision (Q-12). The migration push decision (Q-9) now covers 26 migrations.
