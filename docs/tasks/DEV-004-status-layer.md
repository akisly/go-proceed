# DEV-004 — Status layer and evidence vocabulary

## Assignment

- **Objective and user-visible outcome:** a reader can find the current state of GoProceed, its decisions, its sources and its specs from four index files, and the validator keeps those indexes true.
  - `docs/STATUS.md`: one dated observation table (Area | State | Evidence | Open), written only by the coordinator, with a latest-migration marker the validator checks against `supabase/migrations/`.
  - `docs/decisions/README.md`: the ADR index (ADR | Title | Status | Added | Last reviewed | Supersedes / amends), checked against the ADR files.
  - `docs/research/SOURCES.md`: the S-register of third-party sources, with publication date kept apart from access date and what each source does and does not prove.
  - `docs/specs/README.md`: where new specs go and the metadata they carry.
  - `docs/superpowers/README.md`: the frozen archive's banner and a table of each archived spec's actual outcome, without editing any archived file.
  - `docs/README.md`: document statuses `Draft | Approved | Superseded | Historical` (`Implemented` removed), ADR lifecycle `Proposed | Approved | Superseded | Rejected`, the ADR approval procedure (§10 Q-6's open half), and a precedence note naming STATUS, tasks, specs and the future backlog; the stale 40-migration baseline replaced by a pointer to STATUS.
  - `agents/TASK_TEMPLATE.md`: the closed set of Limitation qualifiers for PASS / FAIL / NOT RUN.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-13.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types. Read-only `Explore` subagents gather evidence for STATUS and the archive table; they are research helpers, not review stages.
- **Selected route and why:** documentation plus executed validator code and one agent-instruction file → coordinator → `gp-reviewer` → `gp-qa` (`agents/COORDINATION.md`). The validator is executed code under `scripts/`, and `agents/TASK_TEMPLATE.md` is an agent instruction, so this is a behavior change.
- **Triggered stages and why:** none beyond reviewer and QA. No schema, contract, catalog, RLS, auth, CI permission, UI or mobile path is touched.
- **Owning module and allowed edit paths:**
  - new: `docs/STATUS.md`, `docs/decisions/README.md`, `docs/research/SOURCES.md`, `docs/specs/README.md`, `docs/superpowers/README.md`, this record;
  - `docs/README.md` (Status meanings, Required metadata, a new ADR lifecycle and approval section, a precedence note, Current baseline);
  - `README.md` (the runtime-baseline bullet, and «19 of the first 40 migrations» in the bullet after it);
  - `docs/decisions/ADR-011-telegram-locked-project-channel.md` (one dated amendment note on the Draft paragraph);
  - `agents/TASK_TEMPLATE.md` (the Acceptance evidence note);
  - `scripts/validate-canonical-docs.mjs` (REQUIRED entries, new guards and their self-tests);
  - `docs/tasks/README.md`; `docs/tasks/DEV-003-runbook-process.md` (its State line only, see Progress row 2).
- **Read context:** the approved migration plan (PR-C, owner-approved 2026-09-13, outside the repository); the deploy-doc reference `docs/product/STATUS.md` and `docs/blog-engine/docs/research/SOURCES.md`; root `AGENTS.md`; `START_HERE.md`; `agents/COORDINATION.md`; DEV-002 and DEV-003.
- **Linked spec, ADR or earlier task:** [DEV-003](DEV-003-runbook-process.md) (runbook §10 Q-6 left the ADR-approval half open for this task).
- **Baseline:** `dbd4c36` (main, "Merge pull request #82").
- **Dependencies / constraints / out of scope:**
  - **`docs/superpowers/` stays frozen.** `START_HERE.md` says the archive is "never moved or rewritten". The plan also lists "status lines of the two shipped Draft specs"; that edit is not made, and the specs' actual outcomes are recorded in `docs/superpowers/README.md` instead. See Progress row 3.
  - **STATUS records observations, not claims from older documents.** Each row cites something re-checkable on its date.
  - **Out of scope:** `docs/BACKLOG.md` and the TODOS / HANDOFF triage (DEV-005); freezing TODOS and re-pointing `TODOS.md:<n>` citations (DEV-006); design sources of truth (DEV-007); correcting the runbook's dated eighteen-red-cases statements; the `CLAUDE.md` / `docs/ai-workflow.md` sentence about the disabled plugin; the rest of the root `README.md` v0.1 table narrative.
- **Required acceptance criteria:** see Acceptance evidence.
- **Skipped stages and rationale:** `gp-architect`, `gp-security`, `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered (see above). No third-party fact decides anything here; the S-register records sources earlier tasks already cited.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-13 | Start PR-C after #82 merged; #82 merged as `dbd4c36` | Owner, in conversation |
| 2026-09-13 | PR-C scope as the approved plan tabulates: STATUS, ADR index, SOURCES, specs README, archive README, docs/README statuses and ADR procedure, vocabulary, validator guards | Owner, in conversation (plan) |

## Plan

1. Scope and record (this file; `docs/tasks/README.md` row). Fix DEV-003's State line, which says `verifying` while its record and the index say done.
2. Write `docs/decisions/README.md`, `docs/research/SOURCES.md` and `docs/specs/README.md`.
3. Gather evidence for STATUS (read-only subagent), verify each row against git and CI, write `docs/STATUS.md` with `<!-- latest-migration -->` equal to the last file in `supabase/migrations/`.
4. Gather each archived spec's outcome (read-only subagent), verify, write `docs/superpowers/README.md`. `git diff dbd4c36 -- docs/superpowers/specs docs/superpowers/plans` stays empty.
5. Edit `docs/README.md`, the two `README.md` bullets, the ADR-011 amendment note, and `agents/TASK_TEMPLATE.md`.
6. Validator: add the new files to `REQUIRED`; exempt `docs/STATUS.md` from the metadata block by name; add pure guards with failing-first self-tests for (a) document Status enum on `METADATA_DOCS`, (b) ADR index ↔ ADR files ↔ ADR Status enum, (c) `docs/tasks/README.md` ↔ records ↔ State enum, (d) STATUS latest-migration marker, (e) unique S-ids.
7. Checks: `pnpm validate:canonical-docs`, a positive control per new guard on a scratch copy, `pnpm validate:agents`, links.
8. `gp-reviewer` → rework → `gp-qa` → PR → CI.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoped (coordinator) | Measured at `dbd4c36`: 11 ADRs, all `Approved`, index absent (`docs/README.md` names ADR-001..007 only); latest migration `0084_the_button_that_carried_a_normative_string.sql` (the plan said 0083); every `METADATA_DOCS` file already reads `Approved`, so the enum needs no normalisation; `Implemented` appears only in `docs/README.md` and the frozen canonical-package plan; 22 archived specs, 8 without a `**Status:**` line (2 of them carry a Russian `Статус:`); `docs/specs/`, `docs/research/` and `docs/STATUS.md` do not exist | `ls supabase/migrations \| tail -1`; `git grep '^\*\*Status:\*\*'`; per-ADR `head` | Implement |
| 2 | scoped (coordinator) | DEV-003's State line reads "verifying" while its body says done and the index says `done`: the closing edit replaced the sentence after the state word, not the word. Fixed here as a one-word correction; guard (c) exists to catch this class | `docs/tasks/DEV-003-runbook-process.md:9` at `dbd4c36` | Implement |
| 3 | scoped (coordinator) | The plan's "status lines of two shipped Draft specs" conflicts with `START_HERE.md` ("never moved or rewritten"), which merged after the plan was approved. Coordinator choice: do not edit the archive; record outcomes in `docs/superpowers/README.md`. Returned to the owner for confirmation in the PR | `START_HERE.md` «Current development»; plan PR-C «Изменить» | Owner confirmation |
| 4 | implementing (coordinator) | Plan steps 1–7 done. Two read-only `Explore` subagents gathered evidence: one per STATUS area, one per archived spec. The coordinator re-checked the facts STATUS relies on (migration count and head, scope and route counts, main CI runs, readiness checkbox counts, `apps/app/vercel.json` crons, the ingress rate limit, `outputs/` size) and ten of the archive table's PR claims with `gh pr view` and `git merge-base --is-ancestor`. One correction from that check: `plans/` holds 41 plans, not 42. `docs/README.md` edits keep the lines other files cite (`:80`, `:84`, `:169-176`, `:190`, the last cited by applied migration `0050`); new sections go at the end | Acceptance evidence 1–8 | `gp-reviewer` |
| 5 | reviewing (`gp-reviewer`, native), round 1 on `7ed4238` | **Changes requested**, no blocker: five medium (R1-01 to R1-05), ten low. Questions found correct: the guards against the real tree, removal of `Implemented`, the cited `docs/README.md` lines (all but `:180-188`, disclosed), six STATUS spot-checks, the archive's placement and quotes, index titles and statuses, scope | `dev-004.diff` against `dbd4c36` | Rework |
| 6 | rework (coordinator), after review round 1 | All fifteen applied as stated fixes. Four needed facts the reviewer could not run, checked first: `plans/` holds 40 plans and one handoff, `plans/evidence/` 12 gate records plus notes and screenshots (R1-01); #62 and #65 merged into #58's branch, and `0061`–`0081` reached `main` in #58 (R1-09); ADR-005 to ADR-008 were added to `main` in `c2ca50d` on 2026-08-08, confirmed with `--follow`; 8 specs lack a `**Status:**` line (R1-10). R1-03's fix also changes «An agent writes an ADR only in this state» to «drafts», the same contradiction at `docs/README.md` «ADR lifecycle and approval». Not a rework round: no QA FAIL preceded it | See Findings | `gp-qa` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | medium | `docs/superpowers/README.md` «What is here» | Expected: true counts. Actual: «22 gate records», «41 implementation plans» | coordinator | «40 implementation plans and one handoff»; «12 gate records (`*-gate.md`) and their companions: two notes, seven screenshots, and the `2026-09-06-landing-parity/` screenshot directory», from `ls` |
| R1-02 | medium | `docs/decisions/README.md`, rows ADR-006, ADR-007, ADR-009 | Expected: every relationship the ADR states. Actual: ADR-009's amendment of ADR-007 decision 1 and ADR-006's amendment of ADR-001 missing | coordinator | ADR-006: «Amends ADR-001's v0.1 boundary (the second time); …». ADR-007: «amended by ADR-009 (2026-08-20) and ADR-011 decision 11 (2026-09-03)». ADR-009: «Amends ADR-007 decision 1». Checked at ADR-009:18-19, :68; ADR-007:197, :210; ADR-006:17-18 |
| R1-03 | medium | `docs/README.md` «ADR lifecycle and approval»; `docs/specs/README.md` | Expected: the coordinator may transcribe an owner ruling (COORDINATION, PLAYBOOKS, ADR-011 precedent). Actual: «no agent moves an ADR out of `Proposed`», «An agent never writes `Approved`» | coordinator | Step 3 now: no stage's PASS and no agent on its own; the coordinator writes the Approval section and Status change only to transcribe an owner ruling, and the owner's merge ratifies it. Specs: «An agent writes `Approved` only to transcribe the owner's dated approval». «writes an ADR only in this state» → «drafts» |
| R1-04 | medium | `docs/STATUS.md` intro | Expected: the rules it names mention STATUS. Actual: pointed at AGENTS.md and COORDINATION.md, neither of which names it | coordinator | Now points at `docs/README.md` «Observation layers» and the paragraph below. «What is not true» discloses that START_HERE, AGENTS.md and COORDINATION.md do not name STATUS and that a migration PR fails until the marker is re-observed |
| R1-05 | medium | `docs/README.md` «Approval procedure»; `docs/STATUS.md` «Open issues» | Expected: Q-6's other open part stated; the stale runbook statements listed. Actual: «closes the half … that DEV-003 left open» | coordinator | «answers the ADR-status and approval-procedure part … its other open part, a retroactive record for the channel's migrations, stays open». STATUS «Open issues» gains «ADR approval» (runbook Q-6, §1.1, §1.4's `:180-188` citation) |
| R1-06 | low | `agents/TASK_TEMPLATE.md` NOT RUN qualifiers | Expected: a form for gp-qa's «PASS earned for the wrong reason». Actual: none | coordinator | The unqualified NOT RUN names both reasons and cites `agents/roles/gp-qa.md` |
| R1-07 | low | `docs/README.md` «Required metadata» vs the ADR enum | Actual: the metadata enum claims every active document, ADRs included | coordinator | A sentence at the end of the file (no cited line moves): the ADR enum replaces the metadata Status values for ADR files |
| R1-08 | low | `docs/research/SOURCES.md` S03, S05, S06, S07 | Actual: claims beyond the records | coordinator | S05 attributes the override claim to DEV-001's reviewer; S07 «access date» (one, lock-level); S03 names the `claude-code-guide` helper; S06 «no record shows it exercised» |
| R1-09 | low | `docs/STATUS.md` Telegram row | Actual: `0080` missing; #65 listed as its own merge | coordinator | «#58 (2026-09-03, `0061`–`0081`, including #62's `0080` and #65's identity erasure `0081`, both merged into its branch)»; `git merge-base --is-ancestor` shows all four migrations reached `main` via #58 |
| R1-10 | low | This record, Progress row 1 and criterion 5 | Actual: «10 without a Status line»; criterion 5 Limitation «—» | coordinator | «8 without a `**Status:**` line (2 of them carry a Russian `Статус:`)»; criterion 5 names the `:180-188` change |
| R1-11 | low | `sourceIdErrors` regex | Actual: «## Superseded» a false positive; «## S08 — title» a false negative | coordinator | `/^## (S\d+)(?=[ \t]\|$)/gm`; self-tests for a titled duplicate and a word starting with S |
| R1-12 | low | Self-tests | Actual: duplicate row, missing task table and out-of-lifecycle index Status untested | coordinator | Four self-tests added: task index missing table and duplicate row; ADR index duplicate row and `Accepted` status |
| R1-13 | low | `WORKFLOW_DOCS` | Actual: `docs/superpowers/README.md` not link-checked | coordinator | Added to `WORKFLOW_DOCS` (link check only; path exemptions stay) |
| R1-14 | low | ADR-011 amendment | Actual: lines after :39 moved; item 12 still says undefined | coordinator | «What is not true» records the shift and DEV-003's moved citations; item 12's bracket gains «[Answered 2026-09-13: docs/README.md «ADR lifecycle and approval».]» on the same line |
| R1-15 | low | This record, Sources | Actual: a local absolute path with the OS username | coordinator | Replaced with «a local reference project, `deploy-doc`» |

Rework count and hypothesis changes: review round 1's fifteen findings were applied as stated fixes; no rework round used. Two of the five medium findings (R1-01, R1-02) were counts and relationships taken from a subagent's report and written without re-running; the coordinator's spot-checks had covered PR claims but not directory counts or amendment lines. Changed practice: every number or relationship a subagent supplies is re-run before it is written.

## What is not true after this task

- STATUS observes nothing hosted. The staging migration head, the commit each Vercel project serves, and whether landing production runs the 2026-09-08 tree come from dated records or are marked not observed.
- The M0 row repeats the runbook's §5.1–§5.12 measurements of 2026-09-03; only the checkbox count was re-measured.
- The v1 API route-to-method coverage is a read-only subagent's check, not the coordinator's.
- The archived specs whose Status still says Draft (`2026-08-24-project-sourced-requirements`, `2026-08-28-assignment-creation`, `2026-09-05-app-daylight-migration`) still say Draft; their outcome is recorded only in `docs/superpowers/README.md`, pending the owner's confirmation (Progress row 3). The archive table was assembled by a subagent and spot-checked on ten PRs, not all.
- The corrections STATUS lists under «Open issues» are not made: the runbook's eighteen-red-cases and card statements, `version-0.1.md` on hosted migrations, `infra/README-staging.md`'s contradictions, `TODOS.md:741`, the card's closure date.
- Runbook §1.4's citation of `docs/README.md:180-188` now points at the dated paragraph that replaced the stale baseline sentence.
- ADR-006, ADR-009, ADR-010 and ADR-011 are held to the ADR enum and the index, but not to the metadata-block and link checks that ADR-001 to ADR-008 get through `REQUIRED`.
- The validator does not check links in `docs/superpowers/README.md` (the archive is outside `METADATA_DOCS`).
- `docs/BACKLOG.md` does not exist; the observation-layers table names it for DEV-005.
- No ADR has yet gone through the new approval procedure.
- The four new policy files (`docs/decisions/README.md`, `docs/research/SOURCES.md`, `docs/specs/README.md`, and the new `docs/README.md` sections) carry `Approved` on the owner's approval of the PR-C plan; under the procedure they introduce, the owner's merge of this pull request is what confirms them.
- `START_HERE.md`, root `AGENTS.md` and `agents/COORDINATION.md` do not yet name `docs/STATUS.md`. A pull request that adds a migration fails the validator until STATUS's marker, and the row it sits in, are re-observed.
- ADR-011's lines after :39 moved by seven. DEV-003's out-of-scope note cites `:1007, :1015, :1023`, which now read `:1014, :1022, :1030`.
- The ADR index's «Added» dates for ADR-005 to ADR-008 are the commit that added them to `main`'s history (`c2ca50d`, 2026-08-08, confirmed with `git log --follow`). `docs/README.md` already listed ADR-006 and ADR-007 on its 2026-08-06 review, so the files may predate that commit on another branch.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. Canonical-docs validator green, with the new guards and their self-tests | yes | working tree over `dbd4c36` | `node scripts/validate-canonical-docs.mjs` → `canonical documentation: OK` (a self-test failure exits 2 before main) | PASS | Coordinator's run; `gp-qa` re-runs it |
| 2. Each new guard fails on its defect (positive controls) | yes | scratch worktree carrying the working tree | Six mutations, each exit 1 with the named message: STATUS marker `0083` («ends at 0084»); glossary Status `Implemented`; index DEV-003 `verifying` («'done' in the record's State line»); ADR-010 row deleted («missing from the index»); ADR-009 file `Proposed` («'Approved' in the index and 'Proposed' in the file»); `## S02` renamed `## S01` («used twice») | PASS | Coordinator's run |
| 3. STATUS latest-migration marker equals the last migration; each row cites re-checkable evidence | yes | working tree | Marker `0084` = `ls supabase/migrations \| tail -1`; the re-checks in Progress row 4 | PASS | Hosted state not observed (see «What is not true») |
| 4. The ADR index lists every ADR with the file's Status | yes | working tree | Validator guard (criterion 1); 11 rows, 11 files | PASS | — |
| 5. `docs/README.md`: document statuses without `Implemented`, ADR lifecycle and approval procedure, observation layers, no present-tense 40-migration baseline; cited lines unchanged | yes | working tree | `sed -n '80p;84p;190p' docs/README.md` show the cited text; `git grep -n 'Implemented' docs/README.md` only in the dated change note | PASS | `:180-188` (runbook §1.4's last row) changed meaning; see «What is not true» |
| 6. The frozen archive is unchanged; its README accounts for all 22 specs | yes | working tree | `git diff --stat dbd4c36 -- docs/superpowers/specs docs/superpowers/plans` empty; 22 table rows; ten PR claims checked with `gh pr view` | PASS | Ten of the archive's evidence claims checked, not all |
| 7. Generated agent profiles unaffected | yes | working tree | `pnpm validate:agents` → `Verified 16 host profiles from 8 canonical roles (gp: 8).` | PASS | — |
| 8. Relative links resolve in the new and changed files | yes | working tree | Validator link checks (`METADATA_DOCS`, and `WORKFLOW_DOCS` now including `docs/STATUS.md`) | PASS | `docs/superpowers/README.md` checked by hand only |
| 9. Independent `gp-reviewer` with no unresolved finding | yes | `7ed4238` (review round 1) | Native `gp-reviewer`: 15 findings, R1-01 to R1-15, all resolved as stated fixes | PASS | Fixes are verified by `gp-qa`, not re-reviewed, as root AGENTS.md prescribes for stated fixes |
| 10. Independent `gp-qa` on the final revision | yes | — | — | NOT RUN | After review |
| 11. CI `verify` green | yes | PR head | — | NOT RUN | The PR is not opened yet |

## Sources

No third-party documentation decides anything in this task. Reference implementation: a local reference project, `deploy-doc` (`docs/product/STATUS.md`, `docs/blog-engine/docs/research/SOURCES.md`). The S-register entries S01–S07 carry the sources DEV-001 and DEV-002 already recorded, with those records' access dates.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
