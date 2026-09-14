# DEV-006 — Freeze `TODOS.md` and the HANDOFF files; re-point live line citations to backlog ids

## Assignment

- **Objective and user-visible outcome:** `TODOS.md`, `HANDOFF.md`, `HANDOFF-2026-08-24.md` and `HANDOFF-2026-08-27.md` say on their first line that they are historical and where current state lives, and the validator fails on any further change to them. No live file cites a `TODOS.md` line number any more: each citation DEV-005 mapped now names its backlog entry, or says why none exists. The validator checks `docs/BACKLOG.md` against its own preamble.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-14.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** executed validator code, comments beside executed code, the agent-read `docs/STATUS.md` and `docs/BACKLOG.md`, and documentation → coordinator → `gp-reviewer` → `gp-qa` (`agents/COORDINATION.md`).
- **Triggered stages and why:** none beyond reviewer and QA. Checked against root `AGENTS.md`'s security triggers and the trigger table in `agents/COORDINATION.md`:
  - the seven TypeScript edits change comments only, and none is under `apps/app/app`, `apps/app/src/components`, `apps/mobile/src`, `packages/ui` or `packages/tokens`;
  - `apps/app/tests/evidence-read.int.test.ts` is named by the evidence-storage trigger's subject, but its edit is one comment word-swap and changes no assertion;
  - no migration, RLS policy, grant, contract, catalog, auth, environment, CI workflow, UI or mobile path is touched.
- **Owning module and allowed edit paths:**
  - `TODOS.md`, `HANDOFF.md`, `HANDOFF-2026-08-24.md`, `HANDOFF-2026-08-27.md`: line 1 only;
  - comments at `apps/app/src/lib/admission.ts:502`, `apps/app/src/lib/valuation-writer.ts:161` and `:310`, `packages/domain/src/valuation.ts:234`, `apps/app/tests/admission-valuation.int.test.ts:511`, `evidence-read.int.test.ts:224`, `progress-adjust.int.test.ts:728`;
  - `docs/decisions/ADR-007-pilot-field-client.md:111`, `:112`, `:114`, `:511`, `:526`; `docs/decisions/ADR-011-telegram-locked-project-channel.md:566`;
  - `docs/delivery/pilot-execution-runbook.md:279`, `:304`, `:491`, `:500`, `:501`, `:1353`, `:1415`, `:1568`, `:1681`, `:1687`, and C-12 and C-13's cells at `:304-305` (R1-03);
  - `docs/architecture/data-model.md:579-580`; `docs/architecture/tenancy-and-security.md:863-867` (R1-01);
  - `agents/COMMON.md:125-126` and the 16 profiles generated from it, `START_HERE.md:36` (R1-02);
  - `docs/BACKLOG.md` (preamble lines 5, 17, 19 and 23; three legacy cites; four Why lines; new BL-077); `docs/STATUS.md` (lines 13, 26, 43, 49, 50);
  - `scripts/validate-canonical-docs.mjs`; this record; `docs/tasks/README.md`.
- **Read context:** the approved migration plan (PR-D2 and «Проверка», owner-approved 2026-09-13, outside the repository); root `AGENTS.md`; `START_HERE.md`; `agents/COORDINATION.md`; `docs/README.md` «ADR lifecycle and approval»; [DEV-005](DEV-005-backlog-triage.md): Baseline, «Citation map for DEV-006», «What is not true after this task», Findings.
- **Linked spec, ADR or earlier task:** [DEV-005](DEV-005-backlog-triage.md), whose Citation map this task executes; its R1-08 (ADR-011:566) and its QA observation that three legacy cites match two lines.
- **Baseline:** `6fd98d0` (main, «Merge pull request #86»). Freeze point F = `5480d2e`. On the fresh branch at `6fd98d0`, `shasum -a 256` of the four files equalled DEV-005's table at F, so nothing changed them between F and the baseline.

  | File | sha256 at F (DEV-005) | sha256 after the banner (`FROZEN_RECORDS`) |
  |---|---|---|
  | `TODOS.md` | `6d3cd3ca217fb89dcce7a578a4cc19dec37d67852d4dd649e58eaffd2228f757` | `2c1abaad470107eb87b4a92ebf4ee2a2cfcd61cb1117f41b4a246973d2306d50` |
  | `HANDOFF.md` | `c090243acd874a76080ebe05422a65ecbcfebf4235b3e745332d917f65c2bdb7` | `c1bf4af0d90b6cb7791e74e236c5bf1f2de5a78ebbd42f967185a047488917a1` |
  | `HANDOFF-2026-08-24.md` | `70a22426988248e6a0e0f43a56357ff7594854bc0d774af0eccb2d4486b50c9a` | `697e1352c81168b75b12ee5ca1e68544ddb4141986d29ee673d2c6d909c98248` |
  | `HANDOFF-2026-08-27.md` | `527ea840d381e0748b79bbba9320f8c702004ef6c558eef76fd0b6de0f1588c7` | `ec44258365ddb97fa3f2bab4a226824c61fb8956a08fc67d61aa5c8a722df604` |

- **Dependencies / constraints / out of scope:**
  - The four files are not deleted or moved: applied migrations, `ci.yml` and scripts cite them.
  - `supabase/migrations/`, `docs/superpowers/` and the dated records DEV-001 to DEV-005 are not edited, including their `TODOS.md:<n>` citations.
  - Prose mentions of `TODOS.md` without a line number are not rewritten (BL-077).
  - No test suite runs (root `AGENTS.md` «What "the tests pass" means here»).
- **Required acceptance criteria:** see Acceptance evidence.
- **Skipped stages and rationale:** `gp-architect`, `gp-security`, `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered (above). No third-party fact decides anything.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-13 | PR-D2 scope as the approved plan states it: banner the four files, re-point live `TODOS.md:<n>` citations to backlog ids, validator guards (`FROZEN_RECORDS`, no new `TODOS.md:<n>`, unique BL ids) | Owner, in conversation (plan) |
| 2026-09-14 | Start DEV-006 once #86 merges, from `origin/main`; add the backlog guards named in the brief (State from the preamble's vocabulary, fields, anchors, index, one-line legacy cites); decide the four side items and record the decision | Owner, in conversation (task brief) |

## Plan

1. Choose a banner form that moves no line; apply it to the four files. Check: `wc -l` against F; `git diff 5480d2e -- TODOS.md 'HANDOFF*.md'` shows only the banners.
2. Re-point the 22 Citation map rows and ADR-011:566 in place, keeping every edited file's line count. Check: `git grep` for `TODOS.md:<n>` outside records; `wc -l` per file; the TypeScript diff is comment-only.
3. Make the three two-line legacy cites unique. Check: every cite on exactly one line.
4. Validator: `FROZEN_RECORDS`, the line-citation guard, the backlog guard. Each starts with self-test fixtures that fail when the detector is stubbed, and a positive control; then plants in the real tree.
5. Decide the side items (STATUS «Next action», `data-model.md:580`, runbook `:920`, the prose mentions) and record the decision.
6. `gp-reviewer` on the diff, rework, `gp-qa`, the PR, CI.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoped (coordinator) | #86 merged as `6fd98d0` (2026-09-14 09:47 UTC); branch `claude/freeze-todos` from `origin/main` in worktree `.claude/worktrees/agency-agents`. **Banner form: appended to the H1 on line 1.** In all four files line 2 is blank and line 3 is text. A banner line inserted at the top would move every line: the runbook's `HANDOFF-2026-08-27.md:234-239` at `:243`, the `TODOS.md:<n>` citations in `docs/superpowers/` and in DEV-003 to DEV-005. Put in place of the blank line 2, it would run into line 3's paragraph. A last line moves nothing but is not seen by a reader who opens the file. Appended to the heading, it is seen first and moves nothing. No link targets a fragment of the four files | `sed -n '1,4l'` per file; `gh pr view 86`; `` git grep -nE '(TODOS\|HANDOFF[-0-9]*)\.md#' `` prints nothing | Side items |
| 2 | scoped (coordinator) | **Side items.** In scope: (a) STATUS «Next action» items 1–2 and the «Agent workflow» row, coordinator-owned and made stale by this migration's own merges; (b) `data-model.md:579-580`, a live Approved statement that sends the reader into the frozen file for a gap migration `0058` closed. Checked: `0058` runs `revoke truncate on all tables in schema public from service_role` and the same `from anon, authenticated`, and `TODOS.md`'s entry reads «CLOSED 2026-08-18 (migration `0058`)». Out of scope: (c) runbook `:920` (§5.9), one of the sections STATUS «Open issues» already lists as owing the card-tag correction; fixing one of them alone would leave that set half-corrected; (d) the prose mentions, filed as BL-077; (e) runbook §6.1's «Thirteen guards», already short of the DEV-002 and DEV-004 guards before this task | `supabase/migrations/0058_the_privilege_no_trigger_could_see.sql:67`, `:86`; `TODOS.md:70`; `awk` heading lookup for runbook `:920`; STATUS «Open issues» first bullet | Implement |
| 3 | implementing (coordinator) | Banners on line 1 of the four files. The 22 mapped citations and ADR-011:566 re-pointed in place (table below): ADR-007 (Approved) with a dated bracket at each site; the runbook (Draft) without one, since no statement changed; ADR-011:566 names the constant and its check instead of line numbers. The two map rows with no entry are worded as history: ADR-007:114 cites `TODOS.md` and quotes «no UDID registration», the frozen file's one line on UDID registration (the sentence ADR-007 itself cited at `c2ca50d^:TODOS.md:312` is gone); runbook `:1353` quotes «THE SLICE'S OWN REPORT FILE COULD NOT BE WRITTEN». Legacy cites: BL-012 «**The two headline measures.**», BL-015 «P3 — responsibility assignments can never be ended», BL-033 «… into error messages, and they reach the console». BACKLOG preamble: a closed commit is «written as its hash in a code span»; a cite is on «exactly one line», or `none` for an entry added after the triage. BL-077 files the prose mentions. Validator: 275 added lines, inserted after `sourceIdErrors` so no earlier line moves; the `node:crypto` import sits beside its use for that reason | `git status --short`: 18 modified files and this record; validator diff | Checks |
| 4 | implementing (coordinator) | Criteria 1–11 pass. The checks corrected the work three times. The first runbook plant never ran: its anchor `#bl-001))` occurs twice, the script's assert stopped it, and the validator then passed the untouched tree; it was re-run with a unique anchor. A planted `TODOS.md:12` was reported as `TODOS.md:1`, so the match now takes the whole number and range; what the guard detects did not change. STATUS first cited `git log --merges --oneline -9` as `-8`, which stops at #80 because of the non-PR merge `6349dd2` | Acceptance evidence | Commit; `gp-reviewer` |
| 5 | reviewing (`gp-reviewer`, native), round 1 on `c5a6eba` | **Changes requested**, no blocker: two medium (R1-01, `tenancy-and-security.md:863-867`, the sibling of side item (b); R1-02, the coordinator's own finding that `agents/COMMON.md:119`, `:125-126` still says these records are «annotated when stale», confirmed with a sharper fix) and five low (R1-03 to R1-07). Found correct: all 22 re-points and ADR-011:566 against the Citation map and the entries' meaning; every quoted phrase present in the frozen files; the three new legacy cites; one-for-one line replacement and no cited line moved; the validator's regex, exemptions, parsing, State forms, wiring and self-test counts; the banner form; the TypeScript comment-only edits; STATUS; scope | Review round 1 report | Rework |
| 6 | rework (coordinator), after review round 1 | All seven findings applied as their stated fixes; not a rework round, since no QA FAIL preceded it. Facts checked before fixing: `tenancy-and-security.md:863-867` against `0058:67-87` and BL-019's Why (R1-01); `agents/COMMON.md:119-126` and its 16 generated copies (R1-02); runbook `:304-305` (R1-03); ADR-011:40's bracket form and the size check inside `main()` at validator `:1991` (R1-04); BACKLOG `:23` (R1-05); `TODOS.md:915` «The only route back is a superuser UPDATE» (R1-06). Searched by meaning for other statements of the annotation rule before R1-02: none outside `agents/COMMON.md` and its generated copies. `START_HERE.md:36` took the reviewer's optional wording. No lint or formatter rule limits line length (`.editorconfig` has none; no prettier or eslint length rule). The first run of the fix script stopped at a wrong `START_HERE.md` line number after three files; the rest ran from there. After the fixes: `sync-agents.py --write`, then `--check` verifies 16 profiles; the validator is green; every edited file keeps its line count | See Findings; criteria 5, 7, 10 | `gp-qa` |
| 7 | verifying (`gp-qa`, native), QA round 1 on `c4051f7` | **Pass with one low finding.** Criteria 1–11 PASS on QA's own runs in a scratch worktree (banner-only diff at F; pins against `shasum`, a CRLF conversion and a deleted file; the 22 re-points and every quoted phrase; line counts for all 38 changed files; the comment-only TypeScript; stubbed detectors and ten backlog plants; its own legacy-cite parse `cites 84 none 1 bad []`; profiles regenerated with no change; the merge log and `0058`). R1-01 to R1-07 verified; `c5a6eba..c4051f7` holds only the stated fixes. Every number in the record reproduced. Q1-01 (low): the record does not disclose three gaps of the line-citation guard. Observations: `agents/COMMON.md:119`'s general heading still says «annotated when stale» above the two «never annotated» items; «from their default privileges» covers the `postgres`-granted defaults, not `supabase_admin`'s, which `0058` leaves on purpose | QA round 1 report | Fix Q1-01 (record text), narrow re-check, PR |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | medium | `docs/architecture/tenancy-and-security.md:863-867` (Approved) | Expected: the same correction side item (b) gave `data-model.md`. Actual: «Two further open deviations are recorded in `TODOS.md`», one closed by `0058`, the other accepted and bounded as BL-019 | coordinator | Five lines for five: the first deviation closed by `0058` with its default privilege, the second is BL-019, dated bracket. `data-model.md:580` also names the default privileges (the reviewer's note) |
| R1-02 | medium | `agents/COMMON.md:119`, `:125-126`; the 16 generated profiles | Expected: live agent instructions agree with the freeze. Actual: the four files listed among records «annotated when stale», and «dated `HANDOFF*.md` files» both misses the undated `HANDOFF.md` and covers future files the pins do not | coordinator (found), reviewer (confirmed, sharper fix) | `:125` names the three HANDOFF files, «frozen at `5480d2e` (DEV-006), never annotated»; `:126` `TODOS.md` «frozen likewise; its open items are in `docs/BACKLOG.md`, and a correction goes in the live document that cites it». Regenerated; `--check` 16 profiles; `START_HERE.md:36` adds «DEV-006 froze them» |
| R1-03 | low | runbook C-12 (`:304`), C-13 (`:305`) | Expected: no correction listed as owed to a file that can no longer change. Actual: C-12 still owed «D1–D4 remain → only D4 remains» to the frozen file | coordinator | C-12: «discharged 2026-09-14 by the freeze (DEV-006), BL-045 carrying the current statement»; C-13: both files frozen, the inventory is BL-002 |
| R1-04 | low | ADR-007 `:111`, `:112`, `:114`, `:511`, `:526`; ADR-011 `:566` | Expected: one dated-bracket form, the ADRs' own `*[… 2026-09-14 (DEV-006): …]*`. Actual: two forms; «in `main`» ambiguous | coordinator | All six read `*[re-pointed 2026-09-14 (DEV-006)…]*`; ADR-011 says «in `main()`» |
| R1-05 | low | BL-077 Evidence; BACKLOG preamble `:23` | Actual: «six numbered citations» (seven, in six files); «Ranked by DEV-006» had no preamble basis | coordinator | «seven numbered citations in six files; one of those lines still names `TODOS.md`»; `:23` adds «An entry added later names the task that ranked it («ranked by DEV-NNN»)» |
| R1-06 | low | runbook `:500`, `:1687` | Actual: the quote «the only route back is a superuser `UPDATE`» read as BL-021's text, and was inexact | coordinator | Both read `TODOS.md` (now BL-021) records …; the quote is `TODOS.md:915`'s «The only route back is a superuser UPDATE» |
| R1-07 | low | `backlogErrors` self-test; `splitTableRow` | Actual: no fixture fails on a P-column drift alone; a `\|` inside a code span in a title would split a cell | coordinator | Fixture «backlog (index P drift)» added. The split fails closed (a false error, never a missed one) and is listed under «What is not true» |
| Q1-01 | low (record only) | This record, «What is not true» and criterion 3 | Expected: the line-citation guard's uncovered cases disclosed. Actual: QA's plants passed a `TODOS.md:238` in `Makefile` and `apps/app/.env.example` (extensions not scanned), in a new `docs/tasks/DEV-007-x.md` (every DEV record path exempt), and as `#L238` or «line 238» (forms not matched); none was disclosed | coordinator | QA's smallest fix: one «What is not true» bullet naming the scanned extensions, the DEV-record exemption and the unmatched forms; criterion 3's Limitation points at it. No guard changed |

Rework count and hypothesis changes: review round 1's seven findings were applied as stated fixes; no rework round used. Q1-01 changed record text only, after a QA pass on every criterion; not a rework round.

## Citation re-points

The DEV-005 Citation map rows as executed. «Was» is the text at `6fd98d0`.

| Site | Was | Now |
|---|---|---|
| `apps/app/src/lib/admission.ts:502` | the P1 at `TODOS.md:238` | the P1 filed as BL-075 (`docs/BACKLOG.md`) |
| `apps/app/src/lib/valuation-writer.ts:310` | the P1 at `TODOS.md:238` | the P1 filed as BL-075 |
| `apps/app/tests/admission-valuation.int.test.ts:511` | THE P1 AT `TODOS.md:238` | THE P1 FILED AS BL-075 |
| `apps/app/src/lib/valuation-writer.ts:161` | the P0 recorded at `TODOS.md:585` | the P0 filed as BL-076 |
| `apps/app/tests/progress-adjust.int.test.ts:728` | THE P0 AT `TODOS.md:585` | THE P0 FILED AS BL-076 |
| `packages/domain/src/valuation.ts:234` | the P0 at `TODOS.md:585` | the P0 filed as BL-076 |
| `apps/app/tests/evidence-read.int.test.ts:224` | the spec and `TODOS.md:783` | the spec and the TODOS.md entry now BL-035 |
| ADR-007 `:111`, `:112` | `TODOS.md:334-342`, `TODOS.md:342` | `TODOS.md` «the pilot-device inventory does not exist», now BL-002, `*[re-pointed 2026-09-14 (DEV-006)]*` |
| ADR-007 `:114` | `TODOS.md:357-361` | `TODOS.md`, dated bracket: history, no entry, «no UDID registration» |
| ADR-007 `:511` | `TODOS.md:334-361` | BL-002 (from `TODOS.md`), dated |
| ADR-007 `:526` | `TODOS.md:363-418` split item 2 | BL-004, from `TODOS.md`'s split item 2, dated |
| runbook `:279`, `:304` | `TODOS.md:741-745` | `TODOS.md` (frozen), now BL-045 |
| runbook `:491`, `:1415` | `TODOS.md:712-716` | `TODOS.md` (now BL-001); BL-001 |
| runbook `:500`, `:1687` | `TODOS.md:900-930` | `TODOS.md` (now BL-021); `:500`'s quote made exact (R1-06) |
| runbook `:501` | `TODOS.md:746-750` | `TODOS.md`, now BL-001 |
| runbook `:1353` | `TODOS.md:3089-3092` | `TODOS.md` «THE SLICE'S OWN REPORT FILE COULD NOT BE WRITTEN» |
| runbook `:1568` | `TODOS.md:1788-1796` | `TODOS.md` «the pilot-device inventory does not exist» (now BL-002) |
| runbook `:1681` | `TODOS.md:2248-2257` | `TODOS.md` (now BL-023) |
| ADR-011 `:566` | `scripts/validate-canonical-docs.mjs`:563, :1431-1437 | the file, «the constant and its size check in `main()`», `*[re-pointed 2026-09-14 (DEV-006): …]*` |

## What is not true after this task

- **Prose mentions remain.** `git grep -n TODOS -- apps packages` lists 46 lines in 38 files; documents, `.github/workflows/ci.yml` and `infra/README-staging.md` add more (BL-077). Each resolves through a backlog entry's legacy cite or to a closed item.
- **Only `TODOS.md` line citations are guarded.** A `HANDOFF*.md:<n>` citation (runbook `:243`) and line citations into live files still rot; the plan asked for `TODOS.md`. Runbook `:243` stays correct because no line of the HANDOFF files moved.
- **The line-citation guard reads tracked files** (`git ls-files`), as guard 12 does; an untracked file is checked once it is added.
- **The line-citation guard has three more gaps** (QA Q1-01). It scans only the extensions ts, tsx, mjs, js, sql, md, csv, yml, yaml, json, py, toml and sh, so not `Makefile` (whose `:13` mentions `TODOS.md` without a line) or `.env.example`. It exempts every `docs/tasks/DEV-NNN-*.md`, later records included. It matches `TODOS.md:<n>` in the bare, code-span and link forms, not a `#L<n>` fragment or «line <n>» in prose. On `c4051f7` no tracked file holds a line citation in any of those forms.
- **The banner is on line 1 only.** A `grep` hit in the body of a frozen file shows no banner.
- **The sha256 pins stop every edit, a correction included.** A deliberate change to a frozen file has to change `FROZEN_RECORDS` in the same commit.
- **The pins are byte-exact.** The repository has no `.gitattributes`; `.editorconfig` sets `end_of_line = lf`, and CI checks out on Linux. A checkout that converts line endings (Git's `core.autocrlf` on Windows) would fail them.
- **Only the four named files are pinned.** A new `HANDOFF-<date>.md` would not be frozen; `agents/COMMON.md` now names the three handoff files rather than a glob.
- **The backlog guard does not check** index row order, field order, a Resume on an entry that is not deferred, or the «ranked by» markers. A `|` inside a code span in an entry title would split its index cell and fail the guard with a false error. BL-077's priority is DEV-006's ranking, not confirmed by the owner.
- **Runbook `:920`** still counts the card among the four webhook blockers (STATUS «Open issues»). **Runbook §6.1** still says «Thirteen guards».
- **ADR-007 and ADR-011** carry dated brackets at the re-pointed sites, and `tenancy-and-security.md` and `data-model.md` at their corrections; none of their «Last reviewed» dates moved. The runbook's re-points carry no bracket; its C-12 and C-13 cells name the date.
- **No test suite and no typecheck ran.** The TypeScript changes are comments only (criterion 6); `tsc` was not run because the worktree has no `node_modules`.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. The four files carry the banner; `git diff 5480d2e -- TODOS.md 'HANDOFF*.md'` shows only the banners; their line counts equal F's | yes | working tree over `6fd98d0` | `git diff 5480d2e --stat`: 4 files, 4 insertions, 4 deletions; `-U0` shows line 1 of each, title plus banner. `wc -l`: 3723, 1383, 250, 249, as at F | PASS | — |
| 2. `FROZEN_RECORDS` pins the sha256 after the banner and fails on any change | yes | working tree | Pins equal `shasum -a 256` (Baseline). Self-test «frozen record (edited)»: with `frozenRecordErrors` stubbed to return nothing → `validator self-test FAILED: frozen record (edited)`. Plant: a heading appended to `TODOS.md` → `1 problem(s)`, `TODOS.md: sha256 faeaf0c… is not the frozen 2c1abaa…`; file restored, `cmp` equal | PASS | — |
| 3. No live file cites a `TODOS.md` line number, and a new one fails the validator | yes | working tree | `` git grep -nE 'TODOS\.md(`?\]\([^)]*\))?`?:[0-9]' -- . ':!TODOS.md' ':!HANDOFF*.md' ':!docs/superpowers' ':!docs/tasks' `` lists only the validator's own self-test lines, which are exempt. Stubbing `todosLineCitationErrors` fails nine named cases, stubbing `isLegacyCitationRecordPath` six. Plants, one problem each: `See TODOS.md:12-14.` in `docs/ai-workflow.md`; the link form `[TODOS.md](../../TODOS.md):712-716` at runbook `:1415`; `the P1 at TODOS.md:238` at `admission.ts:502` | PASS | Tracked files with the listed extensions, and the listed forms only («What is not true», Q1-01) |
| 4. Every DEV-005 Citation map row and ADR-011:566 re-pointed as mapped; the two rows without an entry worded as history | yes | working tree | «Citation re-points» above, 22 sites and ADR-011:566; `git diff` | PASS | Coordinator's check; `gp-reviewer` samples the mapping |
| 5. Every edited file that other files cite by line keeps its line count | yes | working tree | `wc -l` against `git show 6fd98d0:<file>`: the four frozen files, the seven TypeScript files, ADR-007 (612), ADR-011 (1035), the runbook (1932), `data-model.md` (979), `tenancy-and-security.md` (945), `agents/COMMON.md` (181), `START_HERE.md` (50), STATUS (52) and the generated profiles (`gp-qa.md` 251, `gp-qa.toml` 5) unchanged. `docs/BACKLOG.md` grows by 11 (BL-077 and its index row), and no file cites it by line. The validator grows by 276 after its last line cited elsewhere (`:239-251` in `0050`, `:169-179`, `:172`) | PASS | — |
| 6. The TypeScript changes are comments only | yes | working tree | `git diff -U0 -- apps packages \| grep -E '^[-+] ' \| grep -vE '^[-+]\s*(//\|\*)'` prints nothing | PASS | `negative` |
| 7. The backlog guard: ids unique and sequential; State from the preamble's list only; required fields once each, Resume on `deferred (owner)`; one anchor per entry; the index matches the entries; each legacy cite on exactly one line | yes | working tree | Self-test, 33 cases: three positive controls (an agreeing backlog, every listed State form, two single-line cites) and 30 failing fixtures, among them the Q2-01 shape `` closed → `a306ec2` (2026-08-10) ``. Stubbing `backlogErrors` fails 30 named cases (29 on `c5a6eba`, before R1-07's P-column fixture); stubbing `legacyCiteErrors` fails 5; widening the closed form to `/^closed → .+$/` fails 3, and to an optional date fails 1. Plants in the real file, each detected: BL-075's State with a date (2 problems: the State and the index drift); BL-015's cite put back to the two-line phrase; BL-077's index row removed; a sixth State form added to the preamble; BL-001's Resume removed | PASS | — |
| 8. Every legacy cite is on exactly one line of its file, the three two-line cites included | yes | working tree | The guard over the real tree; the scratchpad check prints `cites 84` and no mismatch | PASS | — |
| 9. `pnpm validate:canonical-docs` green | yes | working tree | `node scripts/validate-canonical-docs.mjs` → `canonical documentation: OK` | PASS | `node` run directly: the worktree has no `node_modules` |
| 10. `pnpm validate:agents` green | yes | working tree | After R1-02: `python3 scripts/sync-agents.py --write`, then `--check` → `Verified 16 host profiles from 8 canonical roles (gp: 8).` | PASS | The same check `pnpm validate:agents` runs |
| 11. STATUS's re-observed row and «Next action» match git; the `data-model.md` correction matches `0058` | yes | working tree | `git log --merges --oneline -9 origin/main` ends at #79 (`85bdcb9`) and lists #84 `5480d2e`, #85 `bdbf64b`, #86 `6fd98d0`, dated 2026-09-14; `0058:67`, `:86` | PASS | — |
| 12. Independent `gp-reviewer` with no unresolved finding | yes | `c5a6eba` (review round 1) | Native `gp-reviewer`: changes requested, no blocker; R1-01 to R1-07 resolved as stated fixes (Findings). Its sample: all 22 re-points and ADR-011:566, every quoted phrase, the three legacy cites, line preservation, the validator logic and counts, the banner, STATUS | PASS | Fixes are verified by `gp-qa`, not re-reviewed, as root `AGENTS.md` prescribes for stated fixes |
| 13. Independent `gp-qa` on the final revision | yes | — | — | NOT RUN | After review |
| 14. CI `verify` green | yes | — | — | NOT RUN | After the PR |

## Sources

No third-party documentation decides anything in this task. The validator uses `createHash` from Node's standard `node:crypto` module.

## Completion / handoff

- **Changed files:** see «Owning module and allowed edit paths».
- **Review independence:** `gp-reviewer` round 1 ran as a native `gp-*` subagent; `gp-qa` to follow.
- **Verified scope:** criteria 1–11 by the coordinator.
- **Remaining risks / blocked requirements:** «What is not true after this task».
- **Next bounded action and owner:** `gp-qa` (coordinator).
- **Final state and reason:** verifying.
