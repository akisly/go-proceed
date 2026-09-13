# DEV-003 — Pilot runbook onto the gp-* process

## Assignment

- **Objective and user-visible outcome:** `docs/delivery/pilot-execution-runbook.md` describes the development process that actually runs.
  - §3 (roles), §4 (slice loop), §6.6 (gate placement) and §7 (evidence) name the `gp-*` stages, the task record and its PASS / FAIL / NOT RUN vocabulary. They no longer name the retired skill-driven loop.
  - The measured record of the retired loop (§4.2 plan shape, §4.3 gate verdicts) moves unchanged to `docs/ai-workflow.md`.
  - The validator's temporary exemption for the runbook is removed, so the retired-workflow guard covers it.
- **State:** implementing. Implementation is done and committed as WIP. The next steps are the `gp-reviewer` and `gp-qa` stages, which a new session runs natively (see Progress row 3).
- **Coordinator:** primary Claude Code session, 2026-09-13.
- **Execution mode:** independent subagents for the required stages. Native `gp-*` agent types are not discoverable in this session: the main checkout's `main` predates `.claude/agents`. Stages therefore run through the Markdown fallback (`agents/README.md`) and are recorded as such.
- **Selected route and why:** agent instructions or profiles → coordinator → `gp-reviewer` → `gp-qa` (`agents/COORDINATION.md`). The runbook's §3–§4 decide which stage runs when, and the validator is executed code, so this is a behavior change.
- **Triggered stages and why:**
  - None beyond reviewer and QA.
  - No schema, contract, security surface, UI or mobile path is touched.
  - The runbook's content about security, UI and mobile is restated from root `AGENTS.md`, not changed.
- **Owning module and allowed edit paths:**
  - `docs/delivery/pilot-execution-runbook.md`: the banner, `Last reviewed`, §1.6's lead sentence, §3.1, §3.2, §3.4, §4 intro and §4.0–§4.3, §5.5's and §6.1's `CLAUDE.md` citations, §6.6, §7, §10 Q-6 and Q-14, and the closing note.
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

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

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
| 4. Independent `gp-reviewer` with no unresolved finding | yes | — | Not started | NOT RUN | Deferred to a new session with native roles (owner decision 2026-09-13) |
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
