# DEV-038 — BL-032: a creator who lost access can still abandon their upload

## Assignment

- **Objective and user-visible outcome:** when the creator of an upload has lost the workspace membership, or the project's read, between authorizing the upload and finalizing it, their finalize call orphans the intent at once — as losing `evidence.record` already did — so its bytes go at the next purge run instead of after the 24-hour intent TTL (INV-047). The creator sees the existing «Доступ відкликано під час завантаження. Байти позначено на очищення.» refusal instead of «not found». Anyone else sees exactly what they saw before.
- **State:** implementing
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

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1-01 | minor | `0092` lock before ownership | Actual: any caller who knows an id locks the row | coordinator | `0094`; a no-lock case (row 5) |
| R1-01 | minor | `finalize-upload-intent.ts` | Actual: a missing function turns today's 404 into a 500 | coordinator | Best-effort call, logged; a case with the function renamed away (row 5) |
| R1-04 | minor | «Dependencies» | Actual: the old Telegram code misnamed | coordinator | Corrected (row 5) |
| R1-06 | minor | `docs/BACKLOG.md` BL-032 | Actual: untouched | coordinator | Progress line; closure at done (row 5) |

Rework count and hypothesis changes: none counted (no QA FAIL yet); the review fixes are the first rework, before QA.

## What is not true after this task

- **Nothing calls finalize on the creator's behalf.** The path runs when the creator's client calls finalize; a client that never comes back still waits for the TTL, and the purge takes it after.
- **The refusal names the loss, to the creator only.** A creator who lost access learns that their own intent still existed; nobody else learns anything.
- **Re-granted access does not undo the orphan**: a retry after the creator regains access still answers 403, and the upload must be made again.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- None beyond the repository: no third-party behaviour is relied on.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: pending.
- Remaining risks / blocked requirements: see «What is not true».
- Next bounded action and owner: reviews (coordinator).
- Final state and reason: implementing.
