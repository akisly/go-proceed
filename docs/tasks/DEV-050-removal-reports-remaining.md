# DEV-050 — BL-142: removing a member from a project reports what stays live

## Assignment

- **Objective and user-visible outcome:** a `project_access.revoke` that names `project.view` (a removal) answers with `remaining` beside `revoked`: the external review links the member issued on the project that are still `active` and unexpired — `grantId`, `requirementOccurrenceId`, `version`, `expiresAt`, `exchanged`, `decidesEvidence`, never the recipient's address — and `telegramGroupBound`, whether the project has a connected Telegram group. The office can then retire each link with `external_grants.revoke_reissue`, which needs the id and version no route lists. Nothing cascades. A revoke that keeps `project.view` answers as before.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a `/v1` response contract change on an existing command, with an ADR amendment: `gp-architect` (cluster design) → owner ruling → failing test → contract and route → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (a `/v1` contract); `gp-security` (the response discloses external review links — capability links — and reads two more tables under the actor's RLS; personal data: the recipient's address must not leak). `gp-ui-reviewer`, `gp-mobile`, `gp-researcher`: not triggered (no UI, no field client, no third-party behaviour).
- **Owning module and allowed edit paths:** `packages/contracts/src/project-access.ts` and its test; `apps/app/app/v1/projects/[projectId]/access-grants/revoke/route.ts`; `apps/app/tests/project-access-revoke.int.test.ts`; `docs/decisions/ADR-014-revoke-access-and-end-responsibility.md` (amendment) and `docs/decisions/README.md`; `docs/architecture/tenancy-and-security.md`; `technical/data-access-surface.csv` (DA-145); `docs/BACKLOG.md` (BL-142, BL-148); this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`, `apps/app/AGENTS.md`; ADR-014 decision 1 and «What this decision does NOT authorise»; `supabase/migrations/0049` (`eag_select`), `0062` (`telegram_chat_bindings_read`); INV-102 (no bearer secret in a stored idempotent body).
- **Linked spec, ADR or earlier task:** BL-142, filed by [DEV-043](DEV-043-project-access-revoke.md)'s `gp-security` review; ADR-014 decision 5 (amendment of 2026-09-24); cluster DEV-047 to DEV-053.
- **Baseline:** `0d0968d` (DEV-049) on `origin/main` `20f2b67`.
- **Dependencies / constraints / out of scope:** no migration. Removing the person from the Telegram group, or recording that the office must, is decided with BL-024 (owner, 2026-09-24); BL-142 stays open for that half. No list route for links (BL-139's class). The response key is `externalGrants`, not «…links»: `withIdempotency` refuses to store a body key ending in `link` (INV-102).
- **Required acceptance criteria:**
  1. `packages/contracts/src/project-access.test.ts`: the response accepts `remaining` and refuses an extra key in a link (e.g. `recipientEmail`), a missing `telegramGroupBound`, and an unknown key in `remaining`. Red at the baseline, green after.
  2. `apps/app/tests/project-access-revoke.int.test.ts` (truncates nothing; its own `de43…` workspaces): a removal lists exactly the member's active, unexpired links on this project (not a revoked, an expired, another member's or another project's link), with the fields above, and the connected group; the body never contains the recipient's address; the audit record carries `remainingExternalGrantIds`; the listed links stay `active`. A removal with nothing left reports `{ externalGrants: [], telegramGroupBound: false }`, a disconnected group not counting. An administrator removing themselves still gets the report. A revoke that keeps `project.view` has no `remaining`. The first three red at the baseline; the fourth is a guard. The file's other 16 cases still pass.
  3. ADR-014 carries the owner's ruling as decision 5; `pnpm validate:canonical-docs` passes; `tsc` for `apps/app` passes.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | BL-142 is in this session's cluster «Доступ к проекту» | chat, answer «Доступ к проекту (Рекоменд.)» (DEV-047's record) |
| 2026-09-24 | A removal reports what it leaves live and cascades nothing | chat, answer «Только отчёт (Рекоменд.)» |
| 2026-09-24 | The Telegram group (remove the person, or record it) is decided with BL-024 | chat, answer «Решить при BL-024 (Рекоменд.)» |

## Plan

1. Failing tests: the contract case and the four route cases.
2. The contract: `projectAccessRemaining`, optional `remaining` on the response.
3. The route: read the links and the binding under RLS before the update, only for a removal; add the ids to the audit record.
4. ADR-014 amendment; BL-142 narrowed; DA-145; architecture paragraph.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | Cluster design of 2026-09-24 in this session: report, don't cascade; read under the actor's RLS before the update. Its report was not kept in a file; the reviewers check the implementation against ADR-014 decision 5 | this session | owner ruling |
| 2 | owner | «Только отчёт», «Решить при BL-024» | chat, 2026-09-24 | ADR amendment |
| 3 | coordinator | Red (route and contract at `0d0968d`, tests of this change): route suite 3 failed, 17 passed (the fourth new case is the guard); contract suite 1 failed, 5 passed | `scratchpad/dev049-red.txt` | — |
| 4 | coordinator | Green: route suite 20 passed; contract suite 6 passed; `tsc --noEmit -p apps/app` exit 0 | `scratchpad/dev049-green.txt` | review |
| 5 | coordinator | `external_access_grants` has no row in `technical/data-access-surface.csv` (its RLS is in `rls-coverage.csv`, row 22); a pre-existing gap of that file, not widened here | `grep external_access_grants technical/data-access-surface.csv` (none) | — |
| 6 | gp-reviewer | R1 PASS: no blocker or major; R1-01..R1-03 minor, R1-04..R1-05 nit | reviewer report, 2026-09-24, on `scratchpad/dev049-r1.diff` | fixes |
| 7 | gp-security | S1 PASS: no blocker or major; S1-01..S1-03 minor (record), S1-04..S1-05 nit | security report, 2026-09-24, same diff | fixes |
| 8 | coordinator | Stated fixes applied; route suite 20 passed, contract suite 6 passed, `tsc` exit 0, `validate:canonical-docs` OK | `scratchpad/dev049-green-r2.txt` | gp-qa |
| 9 | gp-qa | PASS on criteria 1–3; every stated fix in place; the rework stayed within them, so no second review; the `scope_kind` filter is checked by reading only (no `package_version` fixture) | QA report, 2026-09-24, on `scratchpad/dev049-r2.diff` (byte-identical to the tree) | commit; the cluster's final run (DEV-053) |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 / S1-03 | minor | route `remainingAfterRemoval` | a package-scoped active link (v0.2 arc, null occurrence) would make the response parse throw and the removal 500 | coordinator | fixed: `and scope_kind = 'requirement_occurrence'`, the condition `app.external_session_scope()` uses; limit recorded in «What is not true» |
| R1-02 / S1-01 | minor | ADR-014 decision 5; route | the read is a snapshot; a concurrent issue can commit after it | coordinator | fixed in wording: «as of the read» in the ADR, the tenancy paragraph and the route comment; recorded in «What is not true» |
| R1-03 / S1-04 | minor / nit | ADR-014 decision 5; tenancy paragraph | retiring a link needs `packages.submit`, which the docs did not say | coordinator | fixed: one sentence in each; self-removal case in «What is not true» |
| S1-02 | minor | `0049` exchange bumps `version`; revoke-reissue 409 | a reported version goes stale once the link is opened | coordinator | recorded, not fixed («What is not true»); belongs with BL-139's list route |
| R1-04 | nit | BL-142 annotation; ADR «Not decided here» | the Telegram member link was not accounted for | coordinator | fixed: stays open with the group half (BL-142, BL-024) |
| R1-05 | nit | test comment; DA gap | «four columns» stale; the `external_access_grants` DA gap only in this record | coordinator | fixed: comment; filed BL-148 |
| S1-05 | nit | test | the address check covered the response only | coordinator | fixed: the test also checks the stored idempotent body and the audit details |

Rework count and hypothesis changes: none (first review; fixes limited to the stated ones).

## What is not true after this task

- A removed member may still be in the project's Telegram group and read the cards posted there (BL-142's group half, BL-024).
- The links the member issued stay live until the office retires them one by one.
- A revoke of action capabilities only, or a membership suspension, reports nothing.
- The report is a snapshot as of its read: a link the member issues concurrently can commit after it and go unlisted (S1-01, R1-02); `occurrence_grants.issue` does not take the member lock.
- A reported `version` goes stale when the recipient opens the link afterwards (the exchange bumps it), and `revoke_reissue` then answers 409 with the current version only in its Ukrainian `detail` (S1-02); no route re-reads a link (BL-139's class).
- Retiring a link needs `packages.submit`; a plain administrator must grant it to themselves, and one who removed themselves cannot act on the report (R1-03, S1-04).
- Package-scoped links (the v0.2 `package_version` arc) are not reported; a v0.2 slice that issues them must extend the contract (R1-01, S1-03).
- The person's Telegram member link is neither reported nor ended (R1-04; BL-142 with the group).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | `0d0968d` + the working tree (`dev049-r2.diff`) | `npx vitest run src/project-access.test.ts` in `packages/contracts`: 6 passed; red at the baseline 1 failed, 5 passed | PASS (`gp-qa`'s run) | the red run is the coordinator's |
| 2 | yes | same | `npx vitest run tests/project-access-revoke.int.test.ts` in `apps/app` (APP_DB_URL, SERVICE_DB_URL set): 20 passed; red at the baseline 3 failed, 17 passed | PASS (`gp-qa`'s run) | the red run is the coordinator's; no test drives a `package_version` link |
| 3 | yes | same | ADR-014 decision 5 and its Approval; `pnpm validate:canonical-docs` OK; `npx tsc --noEmit -p apps/app` exit 0 | PASS (`gp-qa`'s run) | — |
| Cluster suites | yes, at DEV-053 | — | `apps/app` and `packages/testing` suites that drive the revoke route | NOT RUN | deferred to the cluster's final run; CI blocked by billing |

## Sources

- No third-party behaviour beyond PostgreSQL row-level security the local stack exercises (PostgreSQL 17.6).

## Completion / handoff

- Changed / inspected files: the contract and its test, the revoke route and its suite, ADR-014 and the ADR index, the tenancy paragraph, DA-145, BL-142 and BL-148, this record and the task index.
- Review independence: `gp-reviewer`, `gp-security` and `gp-qa` ran as independent native subagents on the diff file.
- Verified scope: criteria 1–3.
- Remaining risks / blocked requirements: «What is not true after this task»; the cluster suites (DEV-053).
- Next bounded action and owner: the coordinator's cluster run at DEV-053; push and merge are the owner's.
- Final state and reason: verifying until the cluster's final run.
