# DEV-082 — BL-064: the XLSX parser read Node's shared buffer pool around an upload

## Assignment

- Objective and user-visible outcome:
  - An XLSX estimate that passed the upload guard no longer fails validation at random as malformed.
  - Before the fix, on Node 24 (the engine `package.json` pins, and CI's), about 1% of parses of a small workbook failed with `XLSX_MALFORMED`. The batch then went to `failed`, and an office user saw an import fail that a retry would pass.
  - The parser now reads exactly the bytes the guard checked.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-25.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): a bug fix in executed code under `packages/domain` on the upload path, which is a security trigger, plus a test assertion under `apps/app`. The route is: root cause → failing test → fix → `gp-reviewer` + `gp-security` → `gp-qa`.
- Triggered stages:
  - `gp-security`: uploads — the parser read process memory beyond the upload.
  - `gp-reviewer` and `gp-qa`: always.
  - `gp-architect`, `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered: there is no contract, schema or UI change.
- Owning module and allowed edit paths:
  - `packages/domain/src/import/xlsx.ts` and `xlsx.test.ts`;
  - `apps/app/tests/vertical-m1.int.test.ts` (the step 7 assertions);
  - `docs/BACKLOG.md` (BL-064), this record, and `docs/tasks/README.md`.
- Read context: BL-064; `packages/domain/src/import/xlsx-guard.ts` (INV-016); `apps/app/app/v1/import-batches/[batchId]/validate/route.ts`.
- Linked spec, ADR or earlier task: BL-064; INV-016.
- Baseline: `origin/main` `1dec107f` (after #157).
- Dependencies / constraints / out of scope:
  - `apps/app/tests/helpers/fake-telegram.ts` uses the same `.buffer` pattern in a test fake, where it is harmless (a whole ArrayBuffer is intended). It is left as it is.
- Required acceptance criteria:
  - AC-1: `parseXlsx` passes ExcelJS an ArrayBuffer of exactly the input's length and bytes, whatever buffer holds the input.
  - AC-2: a regression test fails on the old code and passes on the fix, on any Node version.
  - AC-3: the import tests pass on Node 24.
  - AC-4: `vertical-m1` step 7 asserts the upload and names the failure codes when it fails.
  - AC-5: typecheck, the validator and CI pass.
- Skipped stages and rationale: see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | Standing: open the PR and merge it into main, then take the next item | Owner, in the session |

## Plan

1. Root cause (a general-purpose subagent, reproduction outside any database).
2. Failing test, fix, and the vertical-m1 assertion.
3. `gp-reviewer` + `gp-security`, then `gp-qa`; CI.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | CI `verify` failed on docs-only #157 (run 36131358586, attempt 1): `vertical-m1` step 7's validate answered `failed` where the test expected `preview_ready`, and step 8 failed as a consequence. The same code was green on #156. The stand-down comment was posted on #157, and the one re-run passed | #157 comment; CI job 108059118983 | Root cause |
| 2 | Subagent (root cause) | **Cause:** `packages/domain/src/import/xlsx.ts:25` loaded `Buffer.from(bytes).buffer`, which is Node's shared pool ArrayBuffer (the offset and length are dropped).<br>• **Node 24:** `Buffer.poolSize` is 64 KiB, and a buffer under 32 KiB is pooled, so JSZip read the workbook among other allocations' bytes. A stray end-of-central-directory signature made it throw, and that surfaced as `XLSX_MALFORMED`. Reproduced at about 1.4% of V2 and 0.6% of V1 parses over 3,000 each on Node 24.21.0.<br>• **Node 22:** no failures, because the pool is 8 KiB and only buffers under 4 KiB are pooled.<br>• **Ruled out:** the fixture bytes, the guard, the files route's round trip, mapping and preview, and step 6's state.<br>This is also BL-064's 2026-08-10 and 2026-09-24 reds | Subagent report (session); `scratchpad/bad-v2.xlsx` | Fix |
| 3 | Coordinator | Confirmed: Node 24 `Buffer.from(new Uint8Array(7342)).buffer.byteLength` is 65536; on Node 22 it is 7342.<br>• **Fix:** `wb.xlsx.load(bytes.slice().buffer)`, an exact-length copy.<br>• **Regression test:** spies on the workbook reader's `load`, sets `Buffer.poolSize` to Node 24's value, and parses a view into a larger buffer. It asserts that the argument has exactly the input's length and bytes. It fails on the old code (65536 ≠ 6460) and passes on the fix, on Node 22.<br>• **Node 24:** the import tests pass 49 of 49.<br>• **vertical-m1 step 7:** it now asserts the upload's 201, and `{status, failureCodes}` against `{"preview_ready", []}`.<br>• **Typecheck:** domain and app pass | Session output | Reviews |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none.

## What is not true after this task

- Parses that already failed this way stay `failed`. A retry of the validate command re-parses and succeeds.
- The m1 vertical still parses in the real routes only in CI; locally it needs the database.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- Node.js `Buffer.poolSize` and `Buffer.from(Uint8Array)` pooling, observed on the installed 22.22.2 and on 24.21.0 (installed outside the repository for the reproduction), not read.
- ExcelJS `Workbook.xlsx.load(ArrayBuffer)`, the installed version, observed.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: the root cause came from an independent subagent; `gp-reviewer`, `gp-security` and `gp-qa` are pending.
- Verified scope: rows 1–3.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-reviewer` and `gp-security`.
- Final state and reason: implementing.
