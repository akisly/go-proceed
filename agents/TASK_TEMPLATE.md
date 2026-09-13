# DEV-NNN — Task title

Copy this file to `docs/tasks/DEV-NNN-<short-title>.md`, taking the next free number, and add a row to `docs/tasks/README.md`.

- Replace the template values before starting work.
- Only the coordinator updates the record.
- This blank template is not an active task.

## Assignment

- Objective and user-visible outcome:
- State: planned
- Coordinator:
- Execution mode: independent subagents for the stages root `AGENTS.md` requires / same-session fallback (reason recorded)
- Selected route and why (`agents/COORDINATION.md`):
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why:
- Owning module and allowed edit paths:
- Read context and applicable local instructions:
- Linked spec (`docs/specs/…`), ADR or earlier task:
- Baseline: commit, or explicit file list with content hashes
- Dependencies / constraints / out of scope:
- Required acceptance criteria:
- Skipped stages and rationale:

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|

## Plan

Numbered steps. For each step, name the files it touches and the check that proves it. A step that adds a contract, refusal or invariant starts with its failing test.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

List what a reader might assume this task achieved but it did not. Examples: untested platforms, targets not yet delivered, NOT RUN criteria, and follow-ups.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

## Sources

Third-party documentation and primary sources checked for this task. Give each one its URL, the installed version it applies to, its publication date if known (never substitute today's date) and the access date.

## Completion / handoff

- Changed / inspected files:
- Review independence: same-session / independent (name the actual stage roles)
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
