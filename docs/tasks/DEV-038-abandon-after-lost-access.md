# DEV-038 — BL-032: a creator who lost access can still abandon their upload

## Assignment

- **Objective and user-visible outcome:** when the creator of an upload has lost the workspace membership, or the project's read, between authorizing the upload and finalizing it, their finalize call orphans the intent at once — as losing `evidence.record` already did — so its bytes go at the next purge run instead of after the 24-hour intent TTL (INV-047). The creator sees the existing «Доступ відкликано під час завантаження. Байти позначено на очищення.» refusal instead of «not found». Anyone else sees exactly what they saw before.
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a `SECURITY DEFINER` function and grants, a second authorization path: `gp-architect` (shared with DEV-036) → coordinator (tests first) → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` — a definer, grants, an authorization path. `gp-security` — authorization, uploads, deletion of personal data. `gp-ui-reviewer`, `gp-mobile`: not triggered (the refusal body already exists; no client change).
- **Owning module and allowed edit paths:** `supabase/migrations/0092_*`; `apps/app/src/lib/evidence/finalize-upload-intent.ts`; `apps/app/tests/upload-intents-finalize.int.test.ts` (a new describe block); `technical/data-access-surface.csv` (DA-190); `technical/database/invariant-catalog.csv` (INV-047); `docs/architecture/files-and-storage.md` (finalization rule 4); `docs/STATUS.md` (migration marker); `docs/BACKLOG.md` (BL-032); this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`; `apps/app/AGENTS.md`; `app.finalize_upload_intent`; policy `ui_select`; `app.member_id_any_status`, `app.active_member_id`, `app.has_project_capability`; `withServiceTx`.
- **Linked spec, ADR or earlier task:** BL-032 (legacy cite `TODOS.md`). No ADR.
- **Baseline:** `31ea13b` (DEV-037) on `claude/storage-purge`.
- **Dependencies / constraints / out of scope:** BL-032 named «a definer for the read, a second authorization path whose only caller is this case» — this is that. Telegram's pipeline also calls `finalizeUploadIntent`: in the narrow race where its actor loses the membership between the grant and the finalize, the failure code it records becomes `scope_project_denied` instead of `membership_inactive`; both map to the same «failed» copy (`telegramEvidenceTerminalCopyKey`).
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

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

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
