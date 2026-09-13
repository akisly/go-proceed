# AI workflow: the cases behind the rules

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-09-13

**Related decisions:** None. Owner rulings of 2026-09-13 are recorded in [DEV-002](tasks/DEV-002-workflow-rules.md).

**Why this file exists.** `CLAUDE.md` and `AGENTS.md` are read at the start of every session, so they carry the rules and nothing else. The cases that produced those rules are worth keeping: a rule whose reason is lost gets deleted by the next reader who finds it arbitrary. The cases don't need to be loaded every session, though. They live here, and the rules point here.

This file is a record. It names retired tools in order to explain what replaced them.

## The development workflow before 2026-09-13, and why it changed

**The old workflow.** Until 2026-09-13, `CLAUDE.md` made two globally installed skill packs the process:

- **Superpowers** was the implementation methodology: brainstorming, design approval, planning, TDD, plan execution and systematic debugging.
- **gstack** supplied seven named gates: `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/review`, `/cso`, `/qa-only` and `/ship`.

Specs, plans and gate records from that period live under `docs/superpowers/`. That directory is a frozen archive.

**Why it was replaced.** There were three reasons. The first is recorded below, in «The measured record of the retired loop»:

- **The gates stopped happening.** No `/plan-ceo-review`, `/plan-eng-review` or `/plan-design-review` verdict appears in any artifact after 2026-07-31, and `/qa-only` and `/ship` never produced a record.
- **The procedure had holes.** Where a brainstorm record goes, where a gate verdict goes, who approves an ADR, and what happens when a slice is aborted were all "undefined in repo".
- **Real review happened somewhere else.** It was per-task subagent review plus a whole-branch review, as the 2026-08-24 and 2026-08-27 handoffs describe, and the written process did not say so.

**The replacement.** The owner approved it on 2026-09-13:

- project roles `gp-*`, adapted from Agency Agents and generated for Claude Code and Codex (DEV-001);
- a coordination procedure with required independent review and QA, task records and task states, taken from the deploy-doc project's model (DEV-002).

For this project, the Superpowers plugin is disabled in `.claude/settings.json`. gstack is only removed from the rules; it is not blocked, because its skills share `~/.claude/skills` with design skills this repository still uses. Nothing was uninstalled globally.

**Where each method now lives:**

| Before | Now |
|---|---|
| Brainstorming and design approval | Owner decisions table in the task record; a spec under `docs/specs/` |
| Planning | The Plan section of the task record |
| TDD | Step 5 of the feature playbook |
| Systematic debugging | The bug-fix playbook |
| Gates | The stages in root `AGENTS.md` |
| Verification before completion | The acceptance evidence matrix, with its "blank cell is not a pass" rule |

### The measured record of the retired loop

Moved on 2026-09-13 (DEV-003) from `docs/delivery/pilot-execution-runbook.md` §4.2 and §4.3 as they stood at `6e5f568`. The runbook now describes the live process, and a live procedure may not name retired commands. The commands, skeleton, table and closing paragraph are copied unchanged apart from relative link paths; the two bold lead-ins and the dated annotation are new.

**Plan shape.** The 33 dated plans measured on 2026-09-01 shared one skeleton by convention, not by a validator. The counts below show how closely, and a header line in 32 of them required a skill from the retired pack.

Measured across the 33 dated plans on disk, 2026-09-01 at `7397d7d`, with the
command beside each figure and **one matching rule for both headings** (an
earlier revision of this paragraph printed 21 and 19, which reproduce under no
counting rule at all):

```
$ cd docs/superpowers/plans && ls 20*.md | wc -l
33
$ grep -l '^## Global Constraints' 20*.md | wc -l
30
$ grep -ril '^#\+ *file.\?structure' 20*.md | wc -l
23        # 14 write "## File Structure", 7 "## File structure",
          # 1 "## File structure (`apps/mobile`)", 1 "## File structure (this plan)"
$ grep -ril '^#\+ *self.\?review' 20*.md | wc -l
22        # includes "## Self-review" and the "checklist"/prose variants
$ c=0; for f in 20*.md; do sed -n '3p' "$f" | grep -qi "REQUIRED SUB-SKILL" && c=$((c+1)); done; echo $c
32
```

```
# <Slice title>

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** …
**Architecture:** …
**Tech Stack:** …
**Spec:** <link to the matching file in `docs/superpowers/specs/`>
**Base:** <branch> @ <sha>

## Global Constraints
## File structure

### Task N: <title>
**Files:**  Create: …  Modify: …  Test: …
**Interfaces:**  Produces: …  Consumes: …
- [ ] **Step 1: <what>** — the literal code, the literal command, the expected
      output, and what a specific failure means

## Self-Review
  spec coverage (each spec § → the Task implementing it)
  placeholder scan (every ellipsis/TBD named and justified)
  type consistency (each type at its producing Task and its consuming Tasks)
  soft spots, stated rather than cast
```

**The review gates' last recorded verdicts, as the runbook recorded them on 2026-09-03.**

| gstack gate | CLAUDE.md trigger | Last recorded verdict anywhere in the repo |
|---|---|---|
| `/plan-ceo-review` | product-level decisions | 2026-07-30/31 |
| `/plan-eng-review` | after an approved design | 2026-07-31 ([2026-07-31-m2a-gate.md](superpowers/plans/evidence/2026-07-31-m2a-gate.md):36-43) |
| `/plan-design-review` | user-facing flows | 2026-07-31 |
| `/review` | after implementation | 2026-07-31 as a gstack verdict. Since then the whole-branch review is a subagent pass recorded in the gate record's «Reviews» table (2026-09-03) |
| `/cso` | security-sensitive slices | **2026-09-02**, over the channel branch. **The report itself is untracked** (`.gstack/` is git-ignored); what the tree holds is its consequence: PR #62's description names the three defects it fixes as «Fix now» decisions on that report, and PR #65 and [2026-09-02-telegram-identity-erasure-design.md](superpowers/specs/2026-09-02-telegram-identity-erasure-design.md):38 name finding #1 (MEDIUM, VERIFIED) as the erasure slice's reason. Any count beyond those comes from PR descriptions, not from a file in `docs/` |
| `/qa-only` | staging verification | none recorded |
| `/ship` | approved delivery | none recorded |

**No `/plan-ceo-review`, `/plan-eng-review` or `/plan-design-review` verdict is recorded in any artifact after 2026-07-31.** `/cso` ran on 2026-09-02 and its findings drove two merged PRs, which is the first gstack gate with a recorded consequence in a month. What replaced the review gates in practice is per-task subagent review plus a whole-branch final review, both recorded in the gate record's «Reviews» table since 2026-09-03, and residuals filed in [TODOS.md](../TODOS.md). Whether that substitution is a decision or a drift is **undefined in repo** and is filed as §10 Q-6. *[Changed 2026-09-13: the pilot runbook's §10 Q-6 is answered for records, verdicts and aborts by DEV-002; see the runbook's §7.1 and §10 Q-6.]*

## Why QA may not modify RLS policies and grants, and who does

**Until 2026-09-02**, `CLAUDE.md` said:

> Do not let QA automatically modify auth, RLS, grants, or migration code.

**On 2026-09-02** the owner lifted the RLS-and-grants half. PR #58's first CI run had found that the tenant-isolation sweep and the schema disagreed on one column-level grant, and the prohibition left that fix in nobody's hands. RLS and grants exist only in `supabase/migrations/`, so the permission had to extend to the migration that carries them, or it meant nothing. From that date the rule read:

> QA may modify RLS policies and grants, and the migration that carries them.

It added that every such change is its own commit naming the test it answers, and keeps the catalog paperwork in agreement.

**On 2026-09-13** the owner moved the fix to the implementer, and `gp-qa` stays read-only. QA reports the defect as FAIL, with the smallest fix and the test that exposes it. The implementer applies it as its own commit naming that test, with the same paperwork rule. `gp-security` re-checks it and `gp-qa` re-verifies it.

The 2026-09-02 concern still holds: the fix is in someone's hands. The change is that the stage verifying a fix is no longer the stage that wrote it. Auth code stays out of QA's hands, as it always did.

## Why `docs/design/02-building-ui.md` is not inlined into AGENTS.md or CLAUDE.md

It is over 300 lines, and most work in this repository is not UI. Inlining it would spend context on every migration and every route handler. The pointer costs three lines, and the procedure loads when someone actually touches the UI.

## Why third-party documentation is read before every external integration

**The case, 2026-08-19.** Supabase renamed the browser key from the legacy `anon` JWT to `sb_publishable_…`. The variable in its docs changed from `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. This repository's installed `supabase-js 2.47.10` still sent the key as a Bearer JWT and could not accept the new format. So the correct answer that day was the LEGACY key in the OLD variable name. That was only discoverable by checking both the installed version and the current docs; memory could supply neither. The legacy keys stop working at the end of 2026, and the upgrade is tracked in `TODOS.md`.

**The correction, 2026-08-21, which is itself an instance of the rule.** The premise "installed supabase-js 2.47.10 cannot accept the new format" went stale when PR #30 bumped the workspace to 2.112.3, which handles `sb_publishable_` keys. The legacy-key workaround is no longer needed anywhere, and the Expo field client uses the publishable key directly. The rule the story motivates stands unchanged. The fact was re-checked against the installed version before being relied on, which is exactly what the rule asks for.

## Habits this codebase rewards

Carried forward from the session handoffs (`HANDOFF.md` §7, `HANDOFF-2026-08-24.md` §7, `HANDOFF-2026-08-27.md` §7). Each habit cost at least one round to learn.

### Tests and guards

- **A refusal that has never stopped refusing is hiding whatever is behind it.** When a long-standing refusal is about to be closed, expect the code behind it never to have executed. Write the positive assertions before believing it.
- **A guard that fires is doing its job.** Assert the absence of the closed condition instead of deleting the check.
- **Never bend a test to green.** Do not compute an expectation the product computes.
- **Verify the fix fails without itself.** Migration 0056's constraints were checked by reverting them on the live database and watching the new schema test go red.
- **Regulatory content is generated, never typed.** A provenance string maintained by hand alongside a record will one day contradict it; derive it from the record.

### Claims and review

- **Claims lose to files.** A ruling about what code does is a claim. Two coordinator claims were refuted by reading the file, and both refutations were accepted.
- **The coordinator reads every diff it commits.** Delegation does not delegate verification. A fast-tier draft once invented an ADR filename, a route path and a CI run during a billing pause.
- **Run the gate yourself.** Every number in a report is re-run on the tree being offered, not carried from another report. One report claimed 528 failing tests; the cause was an unset `APP_DB_URL`.

### Comments

- **Do not state a mechanism you have not executed or read at a specific location.** The acceptable form is "I could not establish this, and here is what I checked". Review caught more than a dozen comments that argued a wrong mechanism and reached the right conclusion anyway.
- **No counts in source comments.** A count is measured once and wrong thereafter. Keep counts in dated records.
- **Cite the symbol, not the line.** A line number rots on the next edit.
- **When a sentence keeps producing wrong versions of itself, delete it.**

### Browser and environment

- **Run the browser.** A green browser pass is evidence about the paths it walks and nothing else. Three defects in one week were invisible to diff review and reading.
- **Check bytes.** Invisible characters, such as a literal non-breaking space, are caught only by byte-level checks.
- **The local test database is shared.** `@goproceed/testing` and `apps/app` suites must never run concurrently against the same local database: deadlocks and vanished fixtures were observed. `supabase db reset` wipes the development role passwords, so run `pnpm -w db:local-credentials` after any reset. Resets are not run here without the owner.
