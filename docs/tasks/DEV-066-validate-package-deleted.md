# DEV-066 — BL-063: `scripts/validate_package.py` is deleted

## Assignment

- Objective and user-visible outcome: the orphaned 2,403-line spec-package validator, which nothing has invoked since 2026-08-20 and which crashes on the deleted `prototype/`, leaves the tree. The comments that described it as kept are corrected. Nothing that runs changes.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-24.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): a change to code under `scripts/` and to CI and validator comments → implementation, `gp-reviewer`, `gp-qa`.
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: none beyond the always-on two. `ci.yml` changes in one comment line only (no permission or pin), so no `gp-security`.
- Owning module and allowed edit paths: `scripts/validate_package.py` (deleted), `Makefile` (comment), `.github/workflows/ci.yml` (comment), `.gitignore` (comment), `scripts/validate-canonical-docs.mjs` (comment), `docs/BACKLOG.md` (BL-063), this record, `docs/tasks/README.md`.
- Read context and applicable local instructions: root `AGENTS.md`; `docs/README.md` («Source of truth», which calls `technical/openapi.yaml`, `technical/schema.sql` and the flat CSV catalogs legacy, not v0.1 implementation authority).
- Linked spec (`docs/specs/…`), ADR or earlier task: BL-063; the removal of `prototype/` in `a85e688` (2026-08-19) and of the `package-validate` CI job (2026-08-20).
- Baseline: `origin/main` `919a8c10`.
- Dependencies / constraints / out of scope: the other tooling entries of this cluster (BL-061, BL-062, BL-083) are separate records.
- Required acceptance criteria: AC-1 the file is gone and nothing live invokes it; AC-2 no live comment still describes it as kept or live; AC-3 `validate:canonical-docs` passes and `ci.yml` parses; AC-4 what stopped being enforced is recorded.
- Skipped stages and rationale: none.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | «удаляй скрипт» — delete rather than retarget | Owner, in this session |

## Plan

1. `git rm scripts/validate_package.py`; correct the `Makefile`, `ci.yml`, `.gitignore` and `validate-canonical-docs.mjs` comments. Check: AC-1…AC-3.
2. Record what the script asserted and what it found on its last possible run (below). Check: AC-4.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | Measured before deleting, at `66c3dd68`: `python3 scripts/validate_package.py` crashes (`FileNotFoundError: prototype/src/App.jsx`). Run in a scratch copy with missing files read as empty, it reports 206 findings: 67 about `prototype/` (routes, contract markers, QA assertions, missing artifacts) and 139 about the legacy spec package — `openapi.yaml` operations added after the package froze lack its conventions (`x-release`, `x-flow-id`, `X-Organization-Id`, `X-Request-Id`, 429 and default problem responses); `ui-actions.csv`, `traceability.csv` and `test-catalog.csv` do not own the newer operations and tests; `data-access-surface.csv` and `data-retention-catalog.csv` list tables `technical/schema.sql` never had. Since `docs/README.md` declares those files legacy, the drift is expected and gets no backlog entry | scratchpad `vp/` | Owner decision |
| 2 | Owner | Delete | Session | Implement |
| 3 | Coordinator | Deleted; four comments corrected; `pnpm validate:canonical-docs` OK; `node --check scripts/validate-canonical-docs.mjs` OK; `ci.yml` parses | working tree | gp-reviewer |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## What is not true after this task

- Nothing now checks the legacy spec package (`technical/openapi.yaml`, `technical/schema.sql`, `traceability.csv`, `test-catalog.csv`, `ui-actions.csv`, `command-availability.csv`) for internal consistency. Nothing had since 2026-08-20; this task only removes the dead checker. The v0.1 catalogs `validate-canonical-docs.mjs` and the test suites read are unaffected.
- Frozen records (`TODOS.md`, `HANDOFF.md`), `docs/legacy/`, `docs/superpowers/` and `migration/` still mention the script by name, as history.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 file gone; nothing live invokes it | Yes | working tree | `git ls-files scripts/validate_package.py` empty; `grep -rn validate_package Makefile package.json .github scripts` → comments only | PASS | |
| AC-2 no live comment calls it kept | Yes | working tree | `Makefile`, `ci.yml`, `.gitignore`, `validate-canonical-docs.mjs:233` corrected | PASS | |
| AC-3 validator and CI file | Yes | working tree | `pnpm validate:canonical-docs` OK; YAML parse OK | PASS | |
| AC-4 what stopped being enforced | Yes | working tree | row 1; «What is not true» | PASS | |

## Sources

None beyond the repository.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: static.
- Remaining risks / blocked requirements: none.
- Next bounded action and owner: `gp-reviewer`, `gp-qa`; then the owner merges.
- Final state and reason: implementing.
