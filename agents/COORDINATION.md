# Development coordination

**Status:** adopted project procedure (DEV-002, 2026-09-13).

This is how GoProceed is developed with the `gp-*` roles. It adapts the upstream NEXUS model from Agency Agents to this repository; see [Provenance](#provenance).

No scheduler, background service or automatic pipeline is installed. No stage in this procedure can approve a merge, deploy, apply a migration to a hosted project, or send an outbound message.

## Coordinator and authority

The primary coding session is the coordinator.

**Before choosing a route**, it reads the root `AGENTS.md`, `START_HERE.md` and the current task record.

**It owns:**

- scope;
- task records and the task index;
- integration of the work;
- the final report.

Role profiles supply focused methods. They are never a second authority over repository policy.

**Approved design and plan.** When a stage's recommendation conflicts with an owner-approved spec, ADR or the task record's Plan, the approved design and plan win. A stage cannot expand approved scope: a conflict it finds goes back to the owner as a finding, not into the patch.

**Stages and independence.**

- Implementation and research may run in the coordinator's own session.
- The stages that root `AGENTS.md` requires run as independent subagents, started by the coordinator without waiting to be asked: `gp-architect`, `gp-mobile`, `gp-reviewer`, `gp-security`, `gp-ui-reviewer` and `gp-qa`.
- Fall back to running a stage in the same session only when subagents are unavailable or the user declines them. Record the fallback in the task record and the final report.
- Always state whether a review was same-session or independent. Changing the role name does not make a review independent.

**Delegation.**

- Do not spawn roles the route does not require.
- Only the coordinator delegates. Specialists never delegate, and the project settings cap subagent nesting at one level.
- Prefer sequential implementation for small changes.

## Areas and triggers

There is one role family, `gp-*`, for the whole monorepo. Where deploy-doc splits families by area, this repository uses path triggers instead, and the stage each trigger adds is fixed:

| Paths or subjects | Adds |
|---|---|
| `supabase/migrations/**`, `technical/database/**` | `gp-architect` before implementing |
| RLS, grants, `SECURITY DEFINER`, `goproceed_*` roles, `technical/data-access-surface.csv` | `gp-architect` before implementing; `gp-security` over the diff |
| `apps/app/app/v1/**`, `apps/app/app/external/**`, `packages/contracts/**`, `technical/openapi/**`, `technical/error-catalog.csv` | `gp-architect` before implementing |
| `technical/states/**`, `technical/permissions/**`, `technical/events/**`, outbox, workers, retention, erasure, the Telegram channel | `gp-architect` before implementing |
| Supabase Auth, sessions, `apps/app/proxy.ts`, `supabase/templates/**`, external capability links and HMAC keys, evidence storage, signed URLs and uploads, the Telegram webhook, bot tokens and identity erasure, `apps/landing/app/api/pilot/**`, application environment variables (`.env*`, `NEXT_PUBLIC_*`, hosted secrets) or secrets, `.github/workflows/**` permissions or pins, retention and deletion of personal data | `gp-security` over the diff |
| `apps/landing/**`, `apps/app/app/**`, `apps/app/src/components/**`, `apps/mobile/src/**`, `packages/ui/**`, `packages/tokens/**`, `technical/copy-catalog.csv` | `gp-ui-reviewer` over the diff, the §5 gate output and the §6 screenshots |
| `apps/mobile/**`, field-client installability, offline or capture behaviour, signing, store or OTA | `gp-mobile` before design or review |
| A question about an installed library, a hosted service or a regulatory source | `gp-researcher` before the dependent decision |

## Intake and routing

Every behavior change gets a record from [TASK_TEMPLATE.md](TASK_TEMPLATE.md) under `docs/tasks/`, titled `DEV-NNN-<short-title>.md` with the next free number. Prose-only edits may keep the same fields in the conversation, so the paperwork never outweighs the change. The task record owns the detail; `docs/tasks/README.md` lists each task's state.

| Trigger | Route | Required evidence |
|---|---|---|
| Prose documentation or plain comments only (no behavior change as root `AGENTS.md` defines it) | Coordinator → focused check (`pnpm validate:canonical-docs`, links) | Diff and validator output |
| Bounded bug with an understood cause | Implementer → `gp-reviewer` → `gp-qa` | A reproduction or failing test first, then the targeted check |
| New behavior inside existing boundaries | Implementer → `gp-reviewer` → `gp-qa` | Acceptance criteria and the relevant negative path |
| Schema, migration, RLS, grant, contract, catalog, worker or Telegram channel workflow change | `gp-architect` → implementer → `gp-reviewer` (+ `gp-security` when its triggers match) → `gp-qa` | Design decision, invariants touched, failure-path and negative-authorization checks |
| UI change | Implementer under `docs/design/02-building-ui.md` → `gp-reviewer` + `gp-ui-reviewer` → `gp-qa` | §5 gate output pasted; §6 screenshots |
| Agent instructions or profiles | Coordinator → `gp-reviewer` → `gp-qa` | `pnpm validate:agents`, `pnpm validate:canonical-docs`, and a discovery check in a fresh session |
| Unknown API, version or capability | `gp-researcher` → back to the chosen route | Primary sources, version, publication and access dates |
| A decision that needs an ADR (it expands scope, weakens a refusal, or changes an approved decision) | `gp-researcher` and/or `gp-architect` → coordinator drafts the ADR → **owner rules** | The owner's dated ruling recorded in the ADR |
| Research-only question | `gp-researcher` → coordinator synthesis | Evidence and applicability; no implementation or QA stage unless needed |

Choose only the stages the task needs, and record why any stage was skipped. The stages root `AGENTS.md` requires are never optional. When review finds a significant security or design issue, the work goes back to the earlier stage it belongs to. Keep product choices that only the owner can make separate from facts that can be researched.

## Task state

| State | Owner of work | Exit condition |
|---|---|---|
| planned | Coordinator | Objective and next action identified; no execution claimed |
| scoped | Coordinator | Baseline, allowed paths, constraints and acceptance criteria defined |
| researching | `gp-researcher` | Bounded question answered, or evidence gap recorded |
| designing | `gp-architect` (+ `gp-mobile`) | Minimal design, contracts, invariants and failure cases documented |
| implementing | Implementer / coordinator acting in role | Scoped change and its evidence ready for review |
| reviewing | `gp-reviewer`; `gp-security`, `gp-ui-reviewer` if triggered | Actionable findings resolved or returned to rework |
| verifying | `gp-qa` (independent subagent) | Acceptance criteria checked on the current revision |
| rework | Assigned owner | Concrete finding addressed, changed evidence resubmitted |
| blocked | Coordinator | Missing input, access or dependency identified |
| done | Coordinator | Every required gate passes for the current scope; limitations disclosed |
| cancelled | Coordinator | Work explicitly stopped; partial artifacts and remaining risks recorded |

**Normal path:** planned → scoped → researching or designing, when the route requires them → implementing → reviewing → verifying → done.

**Short paths:**

- Research-only work may go from researching to done after a sourced synthesis.
- Prose-only changes go from implementing to done after the coordinator's focused check.

**Other transitions:**

- A review or verification failure goes to rework, then back to the affected stage.
- Any active state may become blocked or cancelled, with a reason.
- Resume blocked work through scoped, and recheck the baseline.
- A done task that needs new scope becomes a linked new task, not a silent rewrite of past results.

## Assignment and handoff

**What every assignment includes:**

- task ID and objective;
- role;
- read context;
- owned edit paths;
- baseline;
- acceptance criteria;
- review or QA round number;
- expected report.

**Review assignments** also supply:

- the exact diff as a file, including new files (`git diff <base>` plus `git diff --no-index /dev/null <file>` for each untracked file);
- the base commit and `git status`, because review roles have no shell;
- the evidence to inspect.

UI review additionally receives the §5 gate output and the §6 screenshots.

Subagents inherit no conversation. Give them repository paths, exact commands and the expected shape of the answer; their report is all that survives.

**Editing rights.**

- Only the implementer, or the coordinator acting as implementer, edits implementation files.
- Review, research, architect, mobile and QA roles return reports.
- The coordinator writes task state and the index.
- If parallel implementation is authorized, give each agent disjoint edit paths and integrate shared contracts first. No agent may revert another's work.

**Browser and connector passes.** Role profiles carry no MCP tools, so the coordinator runs browser and MCP passes itself and hands the evidence to the stage that needs it. Examples are the QA harnesses, Supabase MCP `search_docs`, and the Vercel tools.

**What a result includes:**

- the changed or inspected paths;
- PASS, FAIL or NOT RUN for each criterion;
- reproducible evidence;
- limitations.

A required NOT RUN is not a PASS. A conditional acceptance records its reduced scope explicitly. The coordinator cannot relabel untested behaviour as verified.

## Review, rework and verification

**Findings.**

- A finding includes an ID, severity, concrete trigger, expected versus actual behaviour, location and proposed verification. There is no minimum finding count.
- Separate blockers from optional improvements.
- Fix material failures within the task's scope. Follow-up suggestions become linked tasks or `TODOS.md` entries; they never grow the patch unnoticed.

**Rework.**

- Record each rework round and its new evidence.
- Do not retry an unchanged approach.
- After two consecutive rounds with the same unresolved cause, the coordinator reassesses the hypothesis, decomposes the task, or documents the blocker before continuing.
- After three rounds, stop and escalate as root `AGENTS.md` describes.
- `gp-qa` verifies stated fixes.
- `gp-reviewer` runs again when rework changes behaviour beyond a stated fix.
- `gp-security` re-checks fixes to its own blocker and major findings.
- There are no open-ended Dev↔QA loops.

**Evidence.**

- Attach checks and reviews to an exact commit, or to the working tree over a named base.
- If the source changes after a review, identify the affected findings and criteria and re-run those checks.
- Generated profile changes require `pnpm validate:agents`.
- Documentation and catalog changes require `pnpm validate:canonical-docs`.
- `package.json` and `scripts/` define which checks exist.

## Completion and safety

The coordinator marks a task done only when scope, implementation and verification agree. Before reporting a behavior change done, confirm all of these:

- the task record exists;
- `gp-reviewer` ran on the implementation diff, and later changes are only stated fixes that `gp-qa` verified or that were reviewed again;
- every triggered stage ran (`gp-architect`, `gp-security`, `gp-ui-reviewer`, `gp-mobile`);
- `gp-security` re-checked fixes to its own blocker and major findings;
- the QA matrix is on the current revision, with no required NOT RUN;
- every finding is fixed or deferred;
- independence is stated.

Report what changed, the evidence, what was omitted and the next action.

A development PASS never grants authority to merge, deploy, change a hosted project, send outbound messages or make paid calls.

## Records

- **Task records:** `docs/tasks/DEV-NNN-<slug>.md`, one sequence. A task record carries the plan, the progress, the evidence and the owner's decisions for its change.
- **Design specs:** a slice that needs a written design, such as a new screen, schema or contract, gets one at `docs/specs/YYYY-MM-DD-<slug>.md`. The first such spec creates the directory. Its task record links to it.
- **ADRs:** under `docs/decisions/`. An agent drafts the ADR; the owner rules on it, and the ADR records that ruling with its date.
- **The frozen archive:** `docs/superpowers/` keeps the specs, plans and gate records written before 2026-09-13. Nothing new is added there.

## Provenance

This procedure adapts the pinned [NEXUS Quickstart](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/strategy/QUICKSTART.md) and [handoff templates](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/strategy/coordination/handoff-templates.md). It was shaped by the deploy-doc project's local adaptation of the same sources. The routes, triggers, states and thresholds are local decisions, not compatibility promises to upstream.

**Kept from upstream:**

- an orchestrating coordinator;
- the handoff fields;
- QA as a mandatory evidence gate on every task.

**Changed:**

- The coordinator is the primary coding session, not a separate orchestrator agent.
- A code reviewer is mandatory, and security, UI and architecture stages are trigger-based; both are stricter than upstream.
- Upstream's three-retry quota becomes an escalation to the user after three rounds.

**Not adopted:**

- Full, Sprint and Micro modes;
- phase gates;
- default-to-fail;
- minimum issue counts.

Licence and provenance of the role sources: `third_party/agency-agents/` and `agents/upstream.lock.json`.
