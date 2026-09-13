# DEV-003 — Pilot runbook onto the gp-* process

## Assignment

- **Objective and user-visible outcome:** `docs/delivery/pilot-execution-runbook.md` describes the development process that actually runs.
  - §3 (roles), §4 (slice loop), §6.6 (gate placement) and §7 (evidence) name the `gp-*` stages, the task record and its PASS / FAIL / NOT RUN vocabulary. They no longer name the retired skill-driven loop.
  - The measured record of the retired loop (§4.2 plan shape, §4.3 gate verdicts) moves unchanged to `docs/ai-workflow.md`.
  - The validator's temporary exemption for the runbook is removed, so the retired-workflow guard covers it.
- **State:** verifying. `gp-reviewer` round 1 returned 14 findings, applied as stated fixes. `gp-qa` round 1 confirmed them and failed on Q1-01 (medium) and Q1-02 (low). Rework round 1 applied both. Q1-01 changed how a rule reads, so `gp-reviewer` re-ran on the rework: R2-01 to R2-04, applied as stated fixes. `gp-qa` round 2 passed the runbook and failed on two low record findings (Q2-01, Q2-02); rework round 2 applied them, and `origin/main` was merged in. The narrow re-check failed on Q3-01 (low, record only); rework round 3, the last of three, applied it. The narrow re-check on `6cba09b` verified the scoped criteria. Required criterion 6 (CI `verify`) is NOT RUN until the PR's run is read.
- **Coordinator:** primary Claude Code session, 2026-09-13.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types. The implementing session could not discover them (the main checkout predated `.claude/agents`); the reviewing session, started in the main checkout at `5140c3f`, does (DEV-001 criterion 6).
- **Selected route and why:** agent instructions or profiles → coordinator → `gp-reviewer` → `gp-qa` (`agents/COORDINATION.md`). The runbook's §3–§4 decide which stage runs when, and the validator is executed code, so this is a behavior change.
- **Triggered stages and why:**
  - None beyond reviewer and QA.
  - No schema, contract, security surface, UI or mobile path is touched.
  - The runbook's content about security, UI and mobile is restated from root `AGENTS.md`, not changed.
- **Owning module and allowed edit paths:**
  - `docs/delivery/pilot-execution-runbook.md`: the banner, `Last reviewed`, §1.1's CI-record sentence and §5.15's M7 «eighteen red cases» row (both added in rework round 1 for Q1-01), §1.6's lead sentence, §3.1, §3.2, §3.4, §4 intro and §4.0–§4.3, §5.5's and §6.1's `CLAUDE.md` citations, §6.6, §7, §10 Q-6 and Q-14, and the closing note.
  - `docs/ai-workflow.md`: the new measured-record section and its pointers.
  - `scripts/validate-canonical-docs.mjs`: one exemption line and its comment.
  - `docs/tasks/**`.
- **Read context:**
  - root `AGENTS.md`;
  - `agents/COORDINATION.md`, `agents/PLAYBOOKS.md` and `agents/TASK_TEMPLATE.md`;
  - DEV-002, including its "What is not true" on the runbook;
  - the runbook at `6e5f568`.
- **Linked spec, ADR or earlier task:** [DEV-002](DEV-002-workflow-rules.md).
- **Baseline:** `6e5f568` (main, "Merge pull request #80").
- **Dependencies, constraints and out of scope:**
  - **Measurements stay as they are.** The runbook's §1 measurements (2026-09-03, `1c418fb`) and every dated fact are records: they are not re-measured and not rewritten.
  - **Function names stay.** §3's names (Senior PM, Evidence Collector …) remain because §5 and §10 cite them. A column maps each name to who executes it today.
  - **Out of scope:**
    - ADR lifecycle and index, the status layer, `docs/specs/README.md` (PR-C);
    - `TODOS.md` line citations (PR-D2);
    - the stale "seven suites" comment in `.github/workflows/ci.yml`.
- **Required acceptance criteria:** see Acceptance evidence.
- **Skipped stages and rationale:** `gp-architect`, `gp-security`, `gp-ui-reviewer` and `gp-mobile` are skipped because no trigger in root `AGENTS.md` applies.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-13 | Start B2 only after #80 merges; #80 merged | Owner, in conversation |
| 2026-09-13 | Runbook §3.1 maps functions to the coordinator and `gp-*` roles, as the approved plan tabulates | Owner, in conversation (plan) |
| 2026-09-13 | Stop before review. Fast-forward the main checkout to `origin/main` and continue DEV-003 in a new session, so the stages run as native `gp-*` roles | Owner, in conversation |

## Plan

1. Branch from `6e5f568`.
2. Copy the runbook's §4.2 measurements and §4.3 gate table unchanged into `docs/ai-workflow.md`. This keeps a live record of what the old loop did without the runbook naming retired commands.
3. Remove the runbook entry from `RETIRED_WORKFLOW_RECORD_FILES`.
4. Rewrite runbook §3.1 (the "Executed as" column and the gates), §3.2, §3.4, the §4 intro, §4.0–§4.3, §6.6 and §7. The rewrite:
   - maps the gate-record tokens to PASS / FAIL / NOT RUN with a qualifier;
   - answers Q-6's record, verdict and abort halves;
   - leaves Q-6's ADR-approval half open.
5. Re-point `CLAUDE.md:<line>` citations to sections of root `AGENTS.md`. Update Q-14, the §1.6 lead, the banner and the closing note.
6. Run `pnpm validate:canonical-docs`, including the guard now scanning the runbook. Run a link check.
7. Run `gp-reviewer`, then rework, then `gp-qa`. Open the PR.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoped (coordinator) | Retired-workflow references in the runbook: the banner; §1.6 line 321; §3.1–§3.4; §4 intro, §4.0–§4.3; §6.6 row 10; §7.3's Reviews rows; closing note. `CLAUDE.md` line citations: §3.1, §3.2, §3.4, §4, §5.5, §6.1 Group D, Q-14 | `grep` over the runbook at `6e5f568` | Implement |
| 2 | implementing (coordinator) | Plan steps 1–6 done: the runbook sections were rewritten, the measurements moved to `docs/ai-workflow.md`, and the exemption was removed | See Acceptance evidence 1–3 | Review |
| 3 | implementing (coordinator), handoff | Stopped before review, on the owner's decision (2026-09-13). The native `gp-*` agent types were not discoverable, because the session started in the main checkout at `13e256e`, 12 commits behind `origin/main`, without `.claude/agents`. The owner chose to fast-forward the main checkout and continue in a new session. That session sees `gp-reviewer` and `gp-qa` natively, and the new `AGENTS.md`, `CLAUDE.md` and project settings. It should: (1) confirm that it lists the eight `gp-*` subagent types and no `superpowers:*` skills (this also settles DEV-001 criterion 6 and DEV-002 criterion 8); (2) build the diff file against `6e5f568`; (3) run `gp-reviewer`, then rework, then `gp-qa`; (4) open the PR | WIP commit on `claude/agency-agents-runbook` | New session: `gp-reviewer` |
| 4 | done elsewhere (coordinator, new session) | Step (1) settled in the new session: DEV-001 closed and DEV-002 closed with criterion 8b accepted by the owner (PR #81, merged as `5140c3f`) | [DEV-002](DEV-002-workflow-rules.md) | `gp-reviewer` |
| 5 | reviewing (`gp-reviewer`, native), round 1 | **Changes requested.** 14 findings: one major (R1-01), five medium (R1-02 to R1-06), eight low. Criteria 2 (moved record exact), 3 (validator), 4 (dated content) and the scope check found correct | `dev-003.diff` against `6e5f568`, HEAD `76fb263` | Rework |
| 6 | rework (coordinator), after review round 1 | All 14 applied as the reviewer's stated fixes, wording taken from the fix column; nothing beyond them. R1-05 changes a rule's reading (a known-red-baseline CI run is FAIL, not PASS), which is the template's own rule, so no owner decision was needed. Not a rework round: no QA FAIL preceded it | See Findings | `gp-qa` |
| 7 | verifying (`gp-qa`, native), QA round 1 on `d4a3860` | **Needs fixes.** Passed: criteria 1–4 (validator with a positive control on the runbook, retired-workflow regex 0 matches, links, all 14 stated fixes in place with nothing beyond them) and the moved-measurement spot-check. Failed: Q1-01 (medium), Q1-02 (low). Not run: CI (no PR), typecheck/build/agents (nothing they check changed), database suites (none cover this) | QA report; scratch `dev-003/` (`guard.mjs`, `links.py`, base extracts) | Rework |
| 8 | rework (coordinator), rework round 1 | Q1-01 and Q1-02 applied as QA's smallest fixes. Q1-01 needed two lines outside the allowed paths (§1.1, §5.15); the allowed paths were widened to exactly those lines. Because Q1-01 changes how a live rule reads, `gp-reviewer` re-runs on the rework diff | See Findings | `gp-reviewer` on the rework, then `gp-qa` round 2 |
| 9 | reviewing (`gp-reviewer`, native), re-review of the rework on `68127bb` | **Changes requested:** R2-01 (medium), R2-02 to R2-04 (low). The P1 behind §1.1's instruction closed on 2026-09-04, so "Until it lands" was stale | Re-review report; `dev-003-rw1.diff` | Rework |
| 10 | rework (coordinator) at `5036d04` | R2-01 to R2-04 applied as stated fixes; the P1 closure checked in `TODOS.md:3433` and `:3602`. Still rework round 1 | See Findings | `gp-qa` round 2 |
| 11 | verifying (`gp-qa`, native), QA round 2 on `5036d04` | **Needs fixes (low, record only).** Passed: criteria 1–4 for the runbook, validator and `docs/ai-workflow.md` (unchanged since `d4a3860`); every live statement of the CI-row rule agrees with §7.4; R1-01 to R1-14 still present; R2-01, R2-03, R2-04 in place. Failed: Q2-01, Q2-02. Not run: CI (no PR), typecheck/build/agents, database suites | QA round 2 report; scratch `dev-003/sec10-r2.txt` | Rework |
| 12 | rework (coordinator), rework round 2 | Q2-01 and Q2-02 applied as QA's smallest fixes, in this record only. Then `origin/main` (PR #81) was merged in as `6349dd2`; the `docs/tasks/README.md` conflict kept main's DEV-001/DEV-002 `done` rows and this task's row | See Findings | `gp-qa` narrow re-check of the record |
| 13 | verifying (`gp-qa`, native), narrow re-check on `6349dd2` | **Needs fixes (low, record only).** Passed: the merge (DEV-001/DEV-002 changes identical to PR #81; only the five DEV-003 files differ from `origin/main`), validator with the positive control, links, runbook/ai-workflow/scripts unchanged since `5036d04`, Q2-01 and Q2-02 in place. Failed: Q3-01 | Narrow QA report | Rework |
| 14 | rework (coordinator), rework round 3 | Q3-01 applied as QA's smallest fix | See Findings | `gp-qa` narrow re-check |
| 15 | verifying (`gp-qa`, native), narrow re-check on `6cba09b` | **Verified for the scoped criteria**, no new finding. Q3-01 in place; record consistent with the commit history; validator OK; links resolve; only the five DEV-003 files differ from `origin/main`. Unchanged paths carried forward from earlier passing checks, as stated in the report | Narrow QA report | Open the PR; read CI `verify` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | major | Runbook §10 Q-6 row | Expected: one table row. Actual: blank lines and bullets inside the row ended the GFM table, so Q-7 to Q-16 rendered as loose text | coordinator | Collapsed to one line, same content |
| R1-02 | medium | Runbook §3.2, §4.0 item 2, §4.1 step 6 | Expected: auth code always takes the `gp-architect` and `gp-security` route (root AGENTS.md). Actual: only "never a QA fix" | coordinator | Route sentence added in §3.2; auth-code bullet added to §4.0 item 2; "or auth code" added to step 6's triggers |
| R1-03 | medium | Runbook §4.1 step 10 and Abort | Expected: AGENTS.md's round definition, rework scope and escalation. Actual: absent; `fix round N` numbering counted differently | coordinator | Step 10's artifact cell carries rework scope, the round definition, the note that `fix round N` is not that count, and the three-round escalation. Abort row reworded |
| R1-04 | medium | Runbook §7.5 first bullet | Expected: "a skipped suite is NOT RUN" restated. Actual: removed by the rewrite | coordinator | Sub-bullet added |
| R1-05 | medium | Runbook §7.4 last paragraph | Expected: a known-red-baseline CI read does not become PASS (`agents/TASK_TEMPLATE.md`, `gp-qa.md`). Actual: mapped to PASS `assisted:` | coordinator | Maps to FAIL with `known-red baseline:` and the set; acceptance goes through an explicit scope revision |
| R1-06 | medium | `docs/ai-workflow.md` moved-record lead-ins, heading and annotation | Expected: nothing new stated as measurement. Actual: "every plan followed one skeleton"; "only link paths adjusted"; a heading date the base lacked; ambiguous "its §7.1" | coordinator | Four sentences replaced with the stated wording; numbers, dates, SHAs and verdicts untouched |
| R1-07 | low | Runbook §7.1 | Actual: "gate record means the task record" contradicted by dated uses in the same section | coordinator | Scoped to forward-looking instructions; dated gate records named as files under `docs/superpowers/plans/evidence/` |
| R1-08 | low | Runbook §1.6 lead | Actual: cited §7.1 for a statement that moved to `docs/ai-workflow.md` | coordinator | Citation re-pointed |
| R1-09 | low | Runbook §4.1 steps 2, 5, 6 | Actual: Owner decisions written before the record existed; design after plan | coordinator | Record opened at step 2; step 5 renamed "Task record: Assignment and Plan"; step 6 revises the Plan before step 7 |
| R1-10 | low | Runbook §4.1 step 8, §6.6 row 8 | Actual: database reset without the owner-confirmation note | coordinator | Note added in both |
| R1-11 | low | Runbook §3.1 Senior PM gate | Actual: cited AGENTS.md for a rule in COORDINATION «Task state» | coordinator | Citation re-pointed |
| R1-12 | low | Runbook §4 intro, §4.3 | Actual: dropped the design-review gate | coordinator | "product, engineering or design review verdict" in both |
| R1-13 | low | Runbook closing note | Actual: "no independent review stage" becomes false | coordinator | Now points to this record for the review stages |
| R1-14 | low | This record, State and Execution mode | Actual: stale | coordinator | Updated with this round |
| Q1-01 | medium | Runbook §1.1 CI sentence (`:213-214`) and §5.15's M7 «eighteen red cases» row (`:1071`) | Expected: agree with §7.4 as changed by R1-05 (known-red-baseline CI read is FAIL). Actual: §1.1 still said every gate record writes `PASS (assisted)` for CI, and R1-07 made «gate record» there mean the task record; §5.15's row assumed a PASS "without «assisted»" | coordinator | §1.1: "every task record's CI row is FAIL, Limitation `known-red baseline:` with the set named (§7.4) — never PASS" (reworded again by R2-01). §5.15: "a task record whose CI row says PASS with no `known-red baseline:` limitation". Scope widened to these two lines |
| R2-01 | medium | Runbook §1.1 `:213-214` | Expected: an instruction whose precondition still holds, with §7.4's full condition. Actual: "Until it lands" restated in present tense, but the P1 closed on 2026-09-04 (`TODOS.md:3433`; run 33870171989 `verify` success); "no case outside it failing" dropped | coordinator | "While `verify` is red on a known set, a task record's CI row is FAIL, Limitation `known-red baseline:` with that set named and no case outside it failing (§7.4) — never PASS". The stale dated statements are disclosed under «What is not true» |
| R2-02 | low | This record: allowed paths, Progress row 8, Q1-01 | Actual: the `:1071` row was labelled §5.14; it is in §5.15's M7 table | coordinator | Relabelled §5.15 in all three |
| R2-03 | low | This record: the post-Q1-01 search note and the rework hypothesis | Actual: "found no other statement of the rule" is wrong (`:308`, `:329`, `:1048` state it in «gate record … CI row» terms); `TODOS.md:3467` called a residual entry though its P1 is CLOSED | coordinator | Both sentences replaced with the stated wording |
| R2-04 | low | This record: Acceptance evidence 1, 4, 5 | Actual: stale against QA round 1 and this re-review | coordinator | Rows updated |
| Q2-01 | low | This record, Q1-01 row, Expected vs actual cell | Expected: no §5.14 label left for the `:1071` row after R2-02. Actual: "§5.14 assumed a PASS" | coordinator | "§5.15's row assumed a PASS" |
| Q2-02 | low | This record, Progress | Expected: Progress agrees with State, Findings and the rework note. Actual: it stopped at row 8, without the re-review and its rework | coordinator | Rows 9–12 added: re-review, its rework, QA round 2, rework round 2 |
| Q3-01 | low | This record, rework-count text, "Rework round 2" bullet | Expected: one count. Actual: "Two of three rounds used. One of three rounds used." | coordinator | Trailing "One of three rounds used." deleted |
| Q1-02 | low | `docs/tasks/README.md` DEV-003 row | Expected: the record's current state. Actual: `implementing` | coordinator | Set to the record's state |

Out of scope and not changed: `TODOS.md:3467`, the dated 2026-09-03 entry for the eighteen red cases, still says "PASS (assisted) for CI with this set named". It sits in the P1 entry closed 2026-09-04 (`TODOS.md:3433`); it is a record and stays as written. The search after Q1-01 (`grep -n -i 'assisted\|known-red'` over the runbook; `git grep -i 'PASS (assisted)\|known-red'` over live files) found no other statement that disagrees with §7.4; `:308`, `:329` and `:1048` state the rule as «gate record … CI row» and agree under §7.1's scoping. Also noted by the reviewer and not changed: `docs/decisions/ADR-011-telegram-locked-project-channel.md:1007, :1015, :1023` cite a stale runbook line (stale already at the base); `docs/design/02-building-ui.md:215` lacks the owner-confirmation note.

Rework count and hypothesis changes:
- **Review round 1.** 14 findings, applied as stated fixes; not a round.
- **Rework round 1** (after QA round 1 FAIL). Q1-01 was introduced by the R1-05 fix: it changed a rule in §7.4 without searching the runbook for the other statements of the same rule. Changed hypothesis: a fix that changes how a rule reads is followed by a search for every other statement of that rule, by meaning as well as by token (here, also `CI row` and `PASS for CI`), and a check that its precondition still holds, before it is committed. `gp-reviewer` re-ran on the rework (R2-01 to R2-04), all applied as stated fixes.
- **Rework round 2** (after QA round 2 FAIL). Q2-01 and Q2-02 are bookkeeping misses in this record: R2-02's relabel covered the location cell but not the same row's text, and Progress was not advanced when the re-review ran. Changed hypothesis: after each stage, the coordinator adds its Progress row before applying its fixes, and a relabel is searched across the whole record. Two of three rounds used.
- **Rework round 3** (after the narrow QA re-check FAILed on `6349dd2`). Q3-01: the round-2 edit left round 1's count sentence at the end of round 2's bullet. Fixed by deleting it. Three of three rounds used: a further FAIL stops the task for an owner escalation.

## What is not true after this task

- ADRs still have no defined status lifecycle. §10 Q-6 keeps that half open until the status layer lands.
- No `docs/specs/` directory exists yet; the first spec creates it.
- The channel's nineteen migrations still have no evidence record.
- `TODOS.md` line citations in the runbook (`:3089-3092`, `:712-716`) are unchanged until PR-D2.
- The runbook's statements of the eighteen red cases (§1.1 `:195-216`, `:255`, `:308`, `:329`, `:469`, §5.14 order 0 `:1048`, §5.15 `:1071` OPEN, §6 `:1263`) are dated 2026-09-03 and predate the P1's closure on 2026-09-04 (`TODOS.md:3433`; run 33870171989). A dated correction is owed and not made here.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. Canonical-docs validator green, with the guard now scanning the runbook | yes | WIP commit | `node scripts/validate-canonical-docs.mjs` → `canonical documentation: OK` | PASS | Coordinator's run; `gp-qa` round 1 re-ran it on `d4a3860`: PASS |
| 2. No retired-workflow form left in the runbook | yes | WIP commit | The validator's own regex, extracted from the file and run over the runbook, finds 0 matches. The only remaining `CLAUDE.md` mention is the dated banner's sentence about re-pointed citations | PASS | Coordinator's own run |
| 3. Relative links resolve in the runbook and `docs/ai-workflow.md` | yes | WIP commit | Python resolver over both files → `broken: []` for each | PASS | Coordinator's own run |
| 4. Independent `gp-reviewer` with no unresolved finding | yes | `76fb263` (review round 1) | Native `gp-reviewer`: 14 findings, R1-01 to R1-14, all resolved as stated fixes | PASS | Fixes are verified by `gp-qa`, not re-reviewed, as root AGENTS.md prescribes for stated fixes; `gp-reviewer` re-ran on the rework `68127bb` because Q1-01 changes a rule's reading (R2-01 to R2-04, applied as stated fixes) |
| 5. Independent `gp-qa` on the final revision | yes | `6cba09b` | `gp-qa` round 1 on `d4a3860`: needs fixes (Q1-01, Q1-02). Round 2 on `5036d04`: needs fixes (Q2-01, Q2-02, record only). Narrow re-check on `6349dd2`: needs fixes (Q3-01, record only). Narrow re-check on `6cba09b`: verified, no new finding | PASS | Narrow re-check; paths unchanged since `5036d04` carried forward from QA round 2. This row and Progress row 15 were written after that verdict, as bookkeeping |
| 6. CI `verify` green | yes | PR head | — | NOT RUN | The PR is not opened yet |

## Sources

No third-party documentation is involved. The sources are repository files at `6e5f568`: root `AGENTS.md`, `agents/COORDINATION.md`, `agents/PLAYBOOKS.md`, `agents/TASK_TEMPLATE.md` and `docs/delivery/pilot-execution-runbook.md`.

## Completion / handoff

- **Changed files:** `docs/delivery/pilot-execution-runbook.md`, `docs/ai-workflow.md`, `scripts/validate-canonical-docs.mjs` (exemption removed), this record, `docs/tasks/README.md`.
- **Commits:** `76fb263` (implementation), `d4a3860` (R1 fixes), `68127bb` (rework round 1), `5036d04` (R2 fixes), `5c1632c` (rework round 2), `6349dd2` (merge of `origin/main`), `6cba09b` (rework round 3), plus this bookkeeping commit.
- **Review independence:** `gp-reviewer` (round 1 and the re-review of rework round 1) and `gp-qa` (rounds 1–2 and two narrow re-checks) each ran as native `gp-*` subagents. The coordinator verified none of its own fixes as independent evidence.
- **Verified scope:** criteria 1–5.
- **Remaining risks / blocked requirements:**
  - Criterion 6, CI `verify`, is required and NOT RUN until the PR's run is read.
  - All three rework rounds were used; all findings in them were low or medium and record- or wording-level.
  - Out of scope and disclosed: the dated eighteen-red-cases statements (see What is not true), `ADR-011`'s stale runbook line citations, the `02-building-ui.md:215` owner-confirmation gap, `TODOS.md:3467`.
- **Next bounded action and owner:** coordinator: open the PR and record CI; owner: decide the merge.
- **Final state and reason:** not final. Blocked on criterion 6.
