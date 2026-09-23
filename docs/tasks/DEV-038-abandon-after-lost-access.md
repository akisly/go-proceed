# DEV-038 — BL-032: a creator who lost access can still abandon their upload

## Assignment

- **Objective and user-visible outcome:** when the creator of an upload has lost the workspace membership, or the project's read, between authorizing the upload and finalizing it, their finalize call orphans the intent at once — as losing `evidence.record` already did — so its bytes go at the next purge run instead of after the 24-hour intent TTL (INV-047). The creator sees the existing «Доступ відкликано під час завантаження. Байти позначено на очищення.» refusal instead of «not found». Anyone else sees exactly what they saw before.
- **State:** done
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a `SECURITY DEFINER` function and grants, a second authorization path: `gp-architect` (shared with DEV-036) → coordinator (tests first) → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` — a definer, grants, an authorization path. `gp-security` — authorization, uploads, deletion of personal data. `gp-ui-reviewer`, `gp-mobile`: not triggered (the refusal body already exists; no client change).
- **Owning module and allowed edit paths:** `supabase/migrations/0092_*` and, after review, `0094_*` (S1-01); `apps/app/src/lib/evidence/finalize-upload-intent.ts`; `apps/app/tests/upload-intents-finalize.int.test.ts` (a new describe block); `technical/data-access-surface.csv` (DA-190); `technical/database/invariant-catalog.csv` (INV-047); `docs/architecture/files-and-storage.md` (finalization rule 4); `docs/STATUS.md` (migration marker); `docs/BACKLOG.md` (BL-032); this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`; `apps/app/AGENTS.md`; `app.finalize_upload_intent`; policy `ui_select`; `app.member_id_any_status`, `app.active_member_id`, `app.has_project_capability`; `withServiceTx`.
- **Linked spec, ADR or earlier task:** BL-032 (legacy cite `TODOS.md`). No ADR.
- **Baseline:** `31ea13b` (DEV-037) on `claude/storage-purge`.
- **Dependencies / constraints / out of scope:** BL-032 named «a definer for the read, a second authorization path whose only caller is this case» — this is that. Telegram's pipeline also calls `finalizeUploadIntent`: in the narrow race where its actor loses the membership between the grant and the finalize, the failure code it records becomes `scope_project_denied` instead of `resource_not_found` (`ui_select` hid the row, `0016:151`, so `membership_inactive` was effectively unreachable there — corrected after `gp-reviewer` R1-04); both map to the same «failed» copy (`telegramEvidenceTerminalCopyKey`). **Deploy order:** `0092` and `0094` go to the database before the build that calls the function; if they are missing the call fails and the route logs `[FINALIZE_ABANDON_FAILED]` and gives today's refusal (R1-01); roll back in reverse order.
- **Required acceptance criteria:**
  1. A creator whose membership is suspended or ended, or who is active but lost the project's grants, gets 403 `SCOPE_PROJECT_DENIED` («Доступ відкликано…», `request_project_scope`) from finalize; the intent becomes `orphaned_for_purge` / `authorization_revoked`; no evidence object; the bytes stay for the purge; a retry gets the same 403 — red first.
  2. Another member with the capture grants, an outsider, a suspended creator whose intent has expired, and one whose intent the purge has claimed each get today's response and change nothing.
  3. The function refuses (false) a creator who is still fully authorized (asked directly; a mutant without that test turns the case red) and is executable by `goproceed_service` only.
  4. The finalize, vanishing-bytes, Telegram evidence, concurrency and upload-get suites pass.
  5. `pnpm turbo run typecheck --force`, `pnpm validate:canonical-docs`, `pnpm validate:agents` pass.
  6. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-23 | Cluster «Хранилище и purge», one PR, one record per entry (BL-032 included) | session brief |

## Plan

1. Tests red: the three ways to lose access, the retry, four unchanged cases, the grants.
2. `0092`; the route calls it after the tenant transaction when the read found nothing or refused the membership; green; a direct test and a mutant for the authorization check.
3. `gp-reviewer` + `gp-security` on the cluster diff → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native; DEV-036 row 1) | Premise corrected: a deactivated creator usually never reaches `requireActiveMembership` — `ui_select` already hides the row. `app.abandon_unauthorized_upload_intent(uuid) returns boolean`, definer, empty `search_path`, service-login assertion; ordered checks (actor; lock by id; creator via `member_id_any_status`; idempotent true for an intent already orphaned with `authorization_revoked`; `intent_authorized`, unpurged, unclaimed, unexpired; «fully authorized» = active member with `evidence.record` **and** `project.view`/`project.admin` → false); grants to `goproceed_service` only. The route calls it after the tenant transaction; false keeps today's response for that branch (404, or the original `MEMBERSHIP_INACTIVE` 403); no capture event, no audit, as finalize's own unauthorized path | architect report | Tests |
| 2 | implementing (coordinator): red | 4 of 8 red (the three lost-access cases and the grants); the four «changes nothing» guards pass before and after, by design | `scratchpad/dev038-red.txt` | Green |
| 3 | implementing (coordinator): green | `0092` applied locally as `postgres` (version recorded). The block 9 of 9, with the direct authorization case added; **mutant** (the «fully authorized» test disabled in the function) → that case red; the function restored. Suites: finalize 34, vanishing-bytes 1, telegram-evidence 22, concurrency 9, upload-get 9; typecheck 10/10 | `scratchpad/dev038-green*.txt`, `dev038-mutant-authz.txt`, `dev038-suite-*.txt` | Commit; reviews |
| 4 | reviewing (`gp-reviewer`, `gp-security`, native) on `52d6b63` (the five commits plus a merge of `origin/main` 206abec: DEV-035, #110 and #111, landed first; one conflict in the task index) | **`gp-security`: PASS WITH FINDINGS** (S1-01, S1-02 minor; S1-03 to S1-06 info). **`gp-reviewer`: CHANGES REQUESTED** (R1-01 to R1-06 minor, R1-07 and R1-08 nits). No blocker, no major. Both confirmed: only the purge role can call the purge functions; the abandon path answers only for the creator; the purge cannot reach an available object's bytes | review reports; `scratchpad/review1.diff` | Stated fixes |
| 5 | rework (coordinator), stated fixes, tests first | **S1-01** red first (the other connection could not take the row: «could not obtain lock»), then `0094`: the creator test moves into the locking select, so a stranger never holds the row; grants kept (checked). **R1-01** red first (500 without the function), then the call is best-effort: its failure is logged `[FINALIZE_ABANDON_FAILED]` with the request id and the caller gets today's refusal; the order is stated in README-staging §3.3. **R1-04** the Telegram code sentence corrected. **R1-06** a Progress line on BL-032. Green: finalize 36 | `scratchpad/dev038-s1-01-red.txt`, `dev038-s1-01-green.txt`, `r1-01-red.txt`, `r1-01-green.txt` | Re-review; `gp-qa` |
| 6 | re-review (`gp-reviewer`, native) on `51e31bb` | **CHANGES REQUESTED**: every round-1 finding fixed (S1-03's optional revokes deferred with a reason); new R2-01 minor (the new log lines logged `err.name`, which node-postgres sets to "error" for every database error, so a missing function looked like a misconfigured login), R2-02 to R2-05 nits. Confirmed: a finish error spends no attempt and leaves `exhausted`/`overdue` untouched; rows past the deadline are reclaimed by a later run; `0094` preserves `0092` exactly (`created_by_member_id` is NOT NULL) | re-review report; `scratchpad/review2.diff` | Stated fixes |
| 7 | rework (coordinator), stated fixes | **R2-01** `[FINALIZE_ABANDON_FAILED]` carries the SQLSTATE; the rename-away case asserts 42883. Green: finalize 36 | `scratchpad/r2-*.txt` | `gp-qa` |
| 8 | verifying (`gp-qa`, native) on `37b7f11` | **All criteria PASS; CI `verify` NOT RUN (not required).** Its own runs, one suite at a time, none skipped for credentials: purge 24, principal 8, route 13, fencing 10, storage 24, storage-read 7, evidence-read 6, finalize 36, create 23, get 9, vanishing-bytes 1, external-evidence 12, telegram-evidence 22, telegram-processing 17, vertical-m2a 10, concurrency 9; unit 515 (572 before the merge of DEV-035, which removed the PWA's tests); `packages/testing` 0038 section 2; typecheck, docs and agents validators; the live database's roles, grants, functions and constraint; everything its suites revoke, rename or lift restored. Every stated fix in place. New: Q1-01 info (the route's «run failed» line logged the raw error, whose database detail can quote a row), Q1-02 nit (no committed test of the route's request id) | QA report; `scratchpad/qa1-*.txt` | Closing |
| 9 | closing (coordinator) | QA's Q1-01 and Q1-02 belong to DEV-036 and were fixed there | DEV-036 | Push, PR |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1-01 | minor | `0092` lock before ownership | Actual: any caller who knows an id locks the row | coordinator | `0094`; a no-lock case (row 5) |
| R1-01 | minor | `finalize-upload-intent.ts` | Actual: a missing function turns today's 404 into a 500 | coordinator | Best-effort call, logged; a case with the function renamed away (row 5) |
| R1-04 | minor | «Dependencies» | Actual: the old Telegram code misnamed | coordinator | Corrected (row 5) |
| R1-06 | minor | `docs/BACKLOG.md` BL-032 | Actual: untouched | coordinator | Progress line; closure at done (row 5) |
| R2-01 | minor | `finalize-upload-intent.ts` best-effort catch | Actual: the log did not tell deploy-order skew from a misconfigured service login | coordinator | SQLSTATE logged; 42883 asserted (row 7) |

Rework count and hypothesis changes: none counted — no QA FAIL and no blocker; two review rounds fixed minor findings and nits before QA.

## What is not true after this task

- **Nothing calls finalize on the creator's behalf.** The path runs when the creator's client calls finalize; a client that never comes back still waits for the TTL, and the purge takes it after.
- **The refusal names the loss, to the creator only.** A creator who lost access learns that their own intent still existed; nobody else learns anything.
- **Re-granted access does not undo the orphan**: a retry after the creator regains access still answers 403, and the upload must be made again.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. Suspended, ended, or stripped creator: 403, orphaned, bytes kept, same on retry | yes | `37b7f11` | `gp-qa`: finalize 36 (`qa1-upload-intents-finalize.txt`); `dev038-red.txt` red first | PASS | |
| 2. Another member, an outsider, an expired or claimed intent: unchanged | yes | `37b7f11` | the same suite | PASS | |
| 3. A fully authorized creator refused; the mutant; service-only | yes | `37b7f11` | the direct and grant cases; `qa1-dbstate.txt`; `dev038-mutant-authz.txt` | PASS | assisted: the mutant ran before `0094`, whose authorization test is unchanged (`gp-qa` diffed the bodies) |
| 4. Finalize, vanishing-bytes, Telegram evidence, concurrency, upload-get | yes | `37b7f11` | `gp-qa`: 36, 1, 22, 9, 9 | PASS | |
| 5. Typecheck, docs, agents | yes | `37b7f11` | `gp-qa` static checks | PASS | |
| 6. CI `verify` | no | — | — | NOT RUN | environmental: GitHub Actions starts no jobs until October 2026 (billing); settled by CI `verify` on the PR head |

## Sources

- None beyond the repository: no third-party behaviour is relied on.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: independent — `gp-architect`, `gp-reviewer` (two rounds), `gp-security` and `gp-qa`, native project agents; the coordinator implemented.
- Verified scope: the scoped criteria on the local stack; nothing hosted.
- Remaining risks / blocked requirements: see «What is not true».
- Next bounded action and owner: the owner — merge the PR; then apply `0090`–`0094` to the hosted project before the production deploy that carries this build, set the purge login's password and `PURGE_DB_URL` and `CRON_SECRET` (Production only), per `infra/README-staging.md` §3.3.
- Final state and reason: done — every required criterion PASS on `37b7f11`; CI not required.
