# DEV-003 — Pilot runbook onto the gp-* process

## Assignment

- **Objective and user-visible outcome:** `docs/delivery/pilot-execution-runbook.md` describes the development process that actually runs.
  - §3 (roles), §4 (slice loop), §6.6 (gate placement) and §7 (evidence) name the `gp-*` stages, the task record and its PASS / FAIL / NOT RUN vocabulary. They no longer name the retired skill-driven loop.
  - The measured record of the retired loop (§4.2 plan shape, §4.3 gate verdicts) moves unchanged to `docs/ai-workflow.md`.
  - The validator's temporary exemption for the runbook is removed, so the retired-workflow guard covers it.
- **State:** reviewing. `gp-reviewer` round 1 returned 14 findings, applied as stated fixes. `gp-qa` round 1 confirmed them and failed on Q1-01 (medium) and Q1-02 (low). Rework round 1 applied both. Q1-01 changes how a rule reads beyond a stated fix, so `gp-reviewer` sees it again before `gp-qa` re-verifies.
- **Coordinator:** primary Claude Code session, 2026-09-13.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types. The implementing session could not discover them (the main checkout predated `.claude/agents`); the reviewing session, started in the main checkout at `5140c3f`, does (DEV-001 criterion 6).
- **Selected route and why:** agent instructions or profiles → coordinator → `gp-reviewer` → `gp-qa` (`agents/COORDINATION.md`). The runbook's §3–§4 decide which stage runs when, and the validator is executed code, so this is a behavior change.
- **Triggered stages and why:**
  - None beyond reviewer and QA.
  - No schema, contract, security surface, UI or mobile path is touched.
  - The runbook's content about security, UI and mobile is restated from root `AGENTS.md`, not changed.
- **Owning module and allowed edit paths:**
  - `docs/delivery/pilot-execution-runbook.md`: the banner, `Last reviewed`, §1.1's CI-record sentence and §5.14's «eighteen red cases» row (both added in rework round 1 for Q1-01), §1.6's lead sentence, §3.1, §3.2, §3.4, §4 intro and §4.0–§4.3, §5.5's and §6.1's `CLAUDE.md` citations, §6.6, §7, §10 Q-6 and Q-14, and the closing note.
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
| 8 | rework (coordinator), rework round 1 | Q1-01 and Q1-02 applied as QA's smallest fixes. Q1-01 needed two lines outside the allowed paths (§1.1, §5.14); the allowed paths were widened to exactly those lines. Because Q1-01 changes how a live rule reads, `gp-reviewer` re-runs on the rework diff | See Findings | `gp-reviewer` on the rework, then `gp-qa` round 2 |

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
| Q1-01 | medium | Runbook §1.1 CI sentence (`:213-214`) and §5.14 M7 «eighteen red cases» row (`:1071`) | Expected: agree with §7.4 as changed by R1-05 (known-red-baseline CI read is FAIL). Actual: §1.1 still said every gate record writes `PASS (assisted)` for CI, and R1-07 made «gate record» there mean the task record; §5.14 assumed a PASS "without «assisted»" | coordinator | §1.1: "every task record's CI row is FAIL, Limitation `known-red baseline:` with the set named (§7.4) — never PASS". §5.14: "a task record whose CI row says PASS with no `known-red baseline:` limitation". Scope widened to these two lines |
| Q1-02 | low | `docs/tasks/README.md` DEV-003 row | Expected: the record's current state. Actual: `implementing` | coordinator | Set to the record's state |

Out of scope and not changed: `TODOS.md:3467`, the dated 2026-09-03 entry for the eighteen red cases, still says "PASS (assisted) for CI with this set named". It is a residual entry, not a procedure; it moves in the TODOS triage (PR-D1). The search after Q1-01 (`grep -n -i 'assisted\|known-red'` over the runbook; `git grep -i 'PASS (assisted)\|known-red'` over live files) found no other statement of the rule. Also noted by the reviewer and not changed: `docs/decisions/ADR-011-telegram-locked-project-channel.md:1007, :1015, :1023` cite a stale runbook line (stale already at the base); `docs/design/02-building-ui.md:215` lacks the owner-confirmation note.

Rework count and hypothesis changes:
- **Review round 1.** 14 findings, applied as stated fixes; not a round.
- **Rework round 1** (after QA round 1 FAIL). Q1-01 was introduced by the R1-05 fix: it changed a rule in §7.4 without searching the runbook for the other statements of the same rule. Changed hypothesis: a fix that changes how a rule reads is followed by a search for every other statement of that rule (here, `grep -n 'assisted\|known-red'` over the runbook) before it is committed. One of three rounds used.

## What is not true after this task

- ADRs still have no defined status lifecycle. §10 Q-6 keeps that half open until the status layer lands.
- No `docs/specs/` directory exists yet; the first spec creates it.
- The channel's nineteen migrations still have no evidence record.
- `TODOS.md` line citations in the runbook (`:3089-3092`, `:712-716`) are unchanged until PR-D2.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. Canonical-docs validator green, with the guard now scanning the runbook | yes | WIP commit | `node scripts/validate-canonical-docs.mjs` → `canonical documentation: OK` | PASS | Coordinator's own run; re-run by `gp-qa` pending |
| 2. No retired-workflow form left in the runbook | yes | WIP commit | The validator's own regex, extracted from the file and run over the runbook, finds 0 matches. The only remaining `CLAUDE.md` mention is the dated banner's sentence about re-pointed citations | PASS | Coordinator's own run |
| 3. Relative links resolve in the runbook and `docs/ai-workflow.md` | yes | WIP commit | Python resolver over both files → `broken: []` for each | PASS | Coordinator's own run |
| 4. Independent `gp-reviewer` with no unresolved finding | yes | `76fb263` (review round 1) | Native `gp-reviewer`: 14 findings, R1-01 to R1-14, all resolved as stated fixes | PASS | Fixes are verified by `gp-qa`, not re-reviewed, as root AGENTS.md prescribes for stated fixes |
| 5. Independent `gp-qa` on the final revision | yes | — | Not started | NOT RUN | As above |
| 6. CI `verify` green | yes | PR head | — | NOT RUN | The PR is not opened yet |

## Sources

No third-party documentation is involved. The sources are repository files at `6e5f568`: root `AGENTS.md`, `agents/COORDINATION.md`, `agents/PLAYBOOKS.md`, `agents/TASK_TEMPLATE.md` and `docs/delivery/pilot-execution-runbook.md`.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
