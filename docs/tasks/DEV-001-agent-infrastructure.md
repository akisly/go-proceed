# DEV-001 — Agent infrastructure (inert)

## Assignment

- **Objective and user-visible outcome:** GoProceed gets its own development roles, adapted from Agency Agents. There are eight roles: `gp-architect`, `gp-implementer`, `gp-reviewer`, `gp-security`, `gp-qa`, `gp-researcher`, `gp-ui-reviewer` and `gp-mobile`.
  - Their canonical sources live in `agents/`.
  - Host profiles are generated from those sources into `.claude/agents/` and `.codex/agents/`, and CI rejects any drift between the two.
  - This task changes no rules and asks for no automatic delegation. `CLAUDE.md` is untouched and there is no root `AGENTS.md`; the workflow switch is the next task.
- **State:** verifying. Required criteria 6 (discovery in a fresh session) and 8 (CI) are NOT RUN; see Acceptance evidence.
- **Coordinator:** primary Claude Code session, 2026-09-13.
- **Area and role family:** GoProceed monorepo, `gp-*` (the only family).
- **Execution mode:** see [Bootstrap](#bootstrap). No repository rule defines required stages yet; those rules arrive in the next task.
- **Selected route and why:** implementer, then independent review, then coordinator verification. The change is agent configuration and tooling, not product behaviour.
- **Owning paths:**
  - `agents/**`
  - `.claude/agents/gp-*.md`
  - `.codex/agents/gp-*.toml`
  - `third_party/agency-agents/**`
  - `scripts/sync-agents.py`
  - `docs/tasks/**`
  - `package.json` (one script)
  - `.github/workflows/ci.yml` (one step, one comment)
  - `scripts/validate-canonical-docs.mjs` (three `REQUIRED` entries)
- **Read context:**
  - the approved migration plan (owner-approved 2026-09-13, outside the repository);
  - the reference implementation in the sibling project deploy-doc: `scripts/sync-agents.py`, `agents/`, `COORDINATION.md` and `TASK_TEMPLATE.md`;
  - `docs/architecture/tenancy-and-security.md`, `docs/design/02-building-ui.md`, `apps/landing/AGENTS.md` and `apps/mobile/AGENTS.md`.
- **Baseline:** `13e256e` (main, "Merge pull request #77").
- **Out of scope:**
  - rules (`CLAUDE.md`, `AGENTS.md`, coordination, playbooks, template);
  - project settings;
  - the pilot runbook;
  - the status layer;
  - triage of `TODOS.md` and the HANDOFF files;
  - clean-up of the design sources of truth.

  Each of these is a later task in the plan.
- **Required acceptance criteria:** see Acceptance evidence.
- **Skipped stages and rationale:**
  - gp-architect: no schema, contract or authorization change.
  - gp-security: CI permissions and action pins are unchanged, and no secret or trust boundary is touched.
  - gp-ui-reviewer and gp-mobile: no UI or mobile paths.

### Bootstrap

This task creates the roles that would normally review it.

- **Independent review:** an independent subagent running the user-level upstream persona Code Reviewer (`engineering-code-reviewer` in `~/.claude/agents`). It did not write this diff and does not carry GoProceed's invariants.
- **Project role discovery:** this session cannot exercise it. The session started before `.claude/agents` existed, and invoking `gp-reviewer` returned "Agent type 'gp-reviewer' not found".
- **QA-equivalent checks and verification of the review fixes:** run by the coordinator in the same session, and not claimed as independent.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-13 | Adopt the deploy-doc documentation model in full, as seven sequential PRs | Owner, in conversation |
| 2026-09-13 | One role family, `gp-*` | Owner, in conversation |
| 2026-09-13 | Superpowers is disabled for this project only. gstack is removed from the rules but not blocked. Global installs are untouched | Owner, in conversation |
| 2026-09-13 | Generate profiles for both Claude Code and Codex | Owner, in conversation |
| 2026-09-13 | RLS and grant defects: QA reports them, the implementer fixes them, and QA stays read-only | Owner, in conversation |
| 2026-09-13 | Keep `outputs/`; it holds the client-prospecting work | Owner, in conversation |

## Plan

1. Pin upstream `msitarzewski/agency-agents` at `ad9264e`, and hash the eight source files and the licence.
2. Write `agents/COMMON.md`, the eight role files and `agents/registry.json`.
3. Port `scripts/sync-agents.py`, adding an optional `codex_sandbox_mode`:
   - only a `*-qa` role may set `workspace-write`;
   - a write role inherits the host sandbox;
   - unknown registry keys are rejected.
4. Generate the profiles, and add `pnpm validate:agents`, a CI step and the `REQUIRED` entries.
5. Get an independent review, resolve the findings, verify, open the PR.

## Progress and decisions

| Order | State or role | Decision / result | Evidence | Next action |
|---|---|---|---|---|
| 1 | scoped (coordinator) | Upstream compare `6d29a9b...ad9264e` shows one commit touching only `scripts/*`, so the persona files are byte-identical to the ones deploy-doc adapted | `gh api repos/msitarzewski/agency-agents/compare/6d29a9b...main`: `ahead_by` 1, five files, all under `scripts/` | Pin `ad9264e` |
| 2 | implementing (coordinator) | Add `gp-ui-reviewer`, which deploy-doc has no equivalent for, adapted from `design/design-ui-finish-gate-reviewer.md`. No separate database role: database and RLS focus lives in the architect and security triggers | Owner decision (one family); plan | Write the sources |
| 3 | implementing (coordinator) | Codex read roles would get a `read-only` sandbox, so QA could not run test suites (they write caches and connect to the local database). Add `codex_sandbox_mode: workspace-write` for `gp-qa` only | Codex custom-agent documentation and configuration reference (see Sources) | Generate |
| 4 | reviewing (Code Reviewer, independent persona), round 1 | Six findings, R1–R6; no blocker in the generator, the lock or CI | Review over `dev-001.diff` against base `13e256e`. The reviewer also re-hashed all upstream sources, parsed every generated file with PyYAML 6.0.2 and `tomllib`, and ran the validator on a git-added copy | Rework |
| 5 | rework (coordinator), round 1 | R1–R6 resolved as stated fixes only | See Findings and rework | Verify the fixes |
| 6 | verifying (coordinator, same session) | Stated fixes verified; see criterion 10 | Commands in Acceptance evidence | Commit, open PR, run CI; discovery check in a fresh session |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1 | medium-high | `agents/registry.json`: the reviewer, security, qa and ui-reviewer descriptions said "Use proactively" | Expected: PR-A is inert. Actual: Claude Code picks up new profile files without a restart and delegates by description, so after merge it would delegate automatically while `CLAUDE.md` still names other gates — and `gp-qa`, which has Bash, could start unassigned | coordinator | Descriptions reworded to "Use when the coordinator assigns …". Proactive wording moves to the workflow-rules task, and `agents/README.md` says so. Evidence: `grep -l 'Use proactively' .claude/agents/*.md .codex/agents/*.toml` finds 0 files |
| R2 | medium | `agents/README.md` "Access boundaries" said Codex read roles "run in a read-only sandbox" | Expected: an accurate boundary. Actual: Codex reapplies the parent turn's live overrides (`/permissions`, `--yolo`) to a spawned child, so `sandbox_mode` is only a default | coordinator | Reworded as a default, with that caveat and passive-review advice |
| R3 | low-medium | `agents/roles/gp-qa.md` versus the root `CLAUDE.md` QA rule (changed 2026-09-02) | Expected: consistency with root policy. Actual: the profile silently put RLS fixes back on the implementer | coordinator | The profile now cites the root rule, the owner decision of 2026-09-13, and that the workflow-rules task revises the root rule |
| R4 | low | `agents/AGENTS.md` read root `AGENTS.md` unconditionally; `gp-implementer.md` pointed at a root `.env.example` | Expected: only paths that exist. Actual: two missing targets | coordinator | "when it exists"; "the owning app's `.env.example` (`apps/app`, `apps/landing` or `apps/mobile`)" |
| R5 | low | The principals table in `agents/COMMON.md` stated two targets as current facts | Expected: the delivered state. Actual: workers are one `goproceed_worker` with no login role, and `api` exposes only `api.me_context` without narrowing the exposed-schema list | coordinator | Added a "State today" column citing `tenancy-and-security.md` (control 7, grants rule 4), plus a rule not to assume a target. Evidence: the generated `gp-architect.md` contains the column |
| R6 | low | `scripts/sync-agents.py`: the description check covered newlines only | Expected: refuse every character the YAML frontmatter rejects. Actual: C1 controls, U+2028 and U+FEFF passed `--check` | coordinator | The check is now `description.isprintable()`. Evidence: criterion 3 |

Rework count and hypothesis changes: one round, covering all six findings from review round 1. There were no changes beyond the stated fixes, so the reviewer did not re-run. The coordinator verified the fixes in the same session.

## What is not true after this task

- No rule requires any `gp-*` stage, and no profile invites automatic delegation. `CLAUDE.md` describes the previous workflow until the workflow switch lands.
- Superpowers is still enabled for this project.
- No session has yet been observed discovering the project profiles.
- Nobody has exercised `gp-qa`'s `workspace-write` in Codex.
- Two principal rules in `agents/COMMON.md` are targets, not delivered controls: per-workload worker roles, and an exposed surface narrowed to `api`.

## Acceptance evidence

Results are on the working tree over `13e256e`, after rework round 1 and before commit.

| Criterion | Required? | Checked revision | Command or evidence | Result | Limitation |
|---|---|---|---|---|---|
| 1. Generated profiles match their canonical sources | yes | working tree | `pnpm validate:agents` printed `Verified 16 host profiles from 8 canonical roles (gp: 8).` | PASS | — |
| 2. Every Codex profile parses as TOML with the intended sandbox, and every Claude frontmatter parses as YAML matching the registry | yes | working tree | `tomllib` load of all 8: `gp-qa` `workspace-write`, `gp-implementer` inherits, the other six `read-only`. PyYAML `safe_load` of all 8 frontmatters: `description` and `tools` equal the registry | PASS | Parsing only; host runtime not exercised |
| 3. Registry rules reject violations | yes | working tree | Mutated copies in a scratch directory all exit 1: workspace-write on the reviewer; a sandbox set on the implementer; `danger-full-access`; `Edit` on the reviewer; the `Agent` tool; unknown key `model`; `write` on QA; a tampered generated file (`Missing or drifted`); a stray `gp-rogue.md` (`Stale/colliding profile`); descriptions containing U+2028, U+FEFF, U+0085 or a newline (`Invalid description`) | PASS | — |
| 4. Canonical-docs validator stays green | yes | working tree | `node scripts/validate-canonical-docs.mjs` printed `canonical documentation: OK`. The reviewer ran it on a git-added copy with the same result, and a case-insensitive grep for the retired product name over the new files found nothing | PASS | CI re-runs it on the committed tree |
| 5. Upstream sources match the pin | yes | `ad9264e` | `curl` from raw.githubusercontent.com and `shasum -a 256` for the 8 sources, the licence and 3 documentation files all match `agents/upstream.lock.json`; the licence copy matches. Independently repeated by the reviewer | PASS | — |
| 6. Claude Code discovers the eight project profiles | yes | — | This session predates the profiles (`Agent type 'gp-reviewer' not found`), and `claude -p` in the worktree failed with "OAuth session expired and could not be refreshed" | NOT RUN | environmental: open a new Claude Code session in the repository; `/agents` should list `gp-*` under Project, and `gp-reviewer` should report no Bash |
| 7. Codex discovers the profiles | no | — | No Codex session available | NOT RUN | environmental |
| 8. CI `verify` is green with the new step | yes | PR head | GitHub Actions | NOT RUN | Runs when the PR opens |
| 9. Independent review with no unresolved finding | yes | `dev-001.diff` (review round 1) | Code Reviewer persona: six findings, R1–R6, all resolved | PASS | Round-1 findings were fixed as stated fixes and not re-reviewed independently |
| 10. Stated fixes R1–R6 are in place | yes | working tree | R1: 0 generated files contain "Use proactively". R5: the "State today" column is present in the generated `gp-architect.md`. R6: criterion 3. R2–R4: text inspected in `agents/README.md`, `agents/roles/gp-qa.md`, `agents/AGENTS.md` and `agents/roles/gp-implementer.md` | PASS | Same-session verification |

## Sources

- **Claude Code subagents** — https://code.claude.com/docs/en/sub-agents, accessed 2026-09-13:
  - file locations and precedence (project above user);
  - frontmatter fields;
  - nesting: subagents may spawn subagents up to three levels deep unless `Agent` is withheld.
- **Codex custom agents** — https://learn.chatgpt.com/docs/agent-configuration/subagents (redirected from developers.openai.com/codex/subagents), accessed 2026-09-13:
  - files live in `.codex/agents/*.toml`;
  - `name`, `description` and `developer_instructions` are required;
  - `sandbox_mode` is optional and inherited when omitted;
  - Codex spawns a custom agent on explicit request or when `AGENTS.md` instructs it.
  - Per the reviewer, the same page says Codex reapplies the parent turn's live overrides to a spawned child.
- **Codex configuration reference** — https://learn.chatgpt.com/docs/config-file/config-reference (redirected from developers.openai.com/codex/config-reference), accessed 2026-09-13. `sandbox_mode` accepts `read-only`, `workspace-write` or `danger-full-access`. The generator admits only the first two, and `workspace-write` only for `*-qa`.
- **Agency Agents** at `ad9264e`: see `agents/upstream.lock.json`.

## Completion / handoff

- **Changed files:** the owning paths above, plus 16 generated profiles.
- **Review independence:** independent Code Reviewer persona for round 1; fix verification was same-session.
- **Verified scope:** criteria 1–5, 9 and 10.
- **Remaining risks / blocked requirements:** criterion 6 (fresh-session discovery) and criterion 8 (CI) are required and NOT RUN. Criterion 7 (Codex) is optional and NOT RUN.
- **Next bounded action and owner:** the coordinator opens the PR and records the CI result. The owner, or a new session, runs `/agents` to settle criterion 6.
- **Final state and reason:** not final.
