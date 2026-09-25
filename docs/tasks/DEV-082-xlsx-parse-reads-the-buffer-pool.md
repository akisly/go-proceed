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
  - `packages/domain/src/import/xlsx.ts`, `xlsx.test.ts` and `version.ts` (`PARSER_VERSION`, gp-security S3);
  - `apps/app/tests/helpers/fake-telegram.ts` (the same pattern in a test fake, gp-security S6);
  - `apps/app/tests/vertical-m1.int.test.ts` (the step 7 assertions);
  - `docs/BACKLOG.md` (BL-064), this record, and `docs/tasks/README.md`.
- Read context: BL-064; `packages/domain/src/import/xlsx-guard.ts` (INV-016); `apps/app/app/v1/import-batches/[batchId]/validate/route.ts`.
- Linked spec, ADR or earlier task: BL-064; INV-016.
- Baseline: `origin/main` `1dec107f` (after #157); rebased onto `3b586956` (after #158, DEV-081).
- Dependencies / constraints / out of scope:
  - The audit of hosted parses (BL-190) is the owner's decision: it reads several workspaces' data.
  - The older INV-016 gaps gp-security found (BL-191, BL-192) are out of scope.
- Required acceptance criteria:
  - AC-1: `parseXlsx` passes ExcelJS an ArrayBuffer of exactly the input's length and bytes, whatever buffer holds the input.
  - AC-2: a regression test fails on the old code and passes on the fix, on any Node version.
  - AC-3: the import tests pass on Node 24.
  - AC-4: `vertical-m1` step 7 asserts the upload and names the failure codes when it fails.
  - AC-5: typecheck, the validator and CI pass.
  - AC-6: `PARSER_VERSION` is bumped, so fixed parses are distinguishable from pool-exposed ones.
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
| 2 | Subagent (root cause) | **Cause:** `packages/domain/src/import/xlsx.ts:25` loaded `Buffer.from(bytes).buffer`, which is Node's shared pool ArrayBuffer (the offset and length are dropped).<br>• **Node 24:** `Buffer.poolSize` is 64 KiB, and a buffer under 32 KiB is pooled, so JSZip read the workbook among other allocations' bytes. A stray end-of-central-directory signature made it throw, and that surfaced as `XLSX_MALFORMED`. Reproduced at about 1.4% of V2 and 0.6% of V1 parses over 3,000 each on Node 24.21.0.<br>• **Node 22:** no failures, because the pool is 8 KiB and only buffers under 4 KiB are pooled.<br>• **Ruled out:** the fixture bytes, the guard, the files route's round trip, mapping and preview, and step 6's state.<br>This explains BL-064's 2026-09-24 red (CI runs Node 24). The 2026-08-10 red fits too if that run used a Node with the 64 KiB pool, which was not recorded and was not checked | Subagent report (session); `scratchpad/bad-v2.xlsx` | Fix |
| 3 | Coordinator | Confirmed: Node 24 `Buffer.from(new Uint8Array(7342)).buffer.byteLength` is 65536; on Node 22 it is 7342.<br>• **Fix:** `wb.xlsx.load(bytes.slice().buffer)`, an exact-length copy.<br>• **Regression test:** spies on the workbook reader's `load`, sets `Buffer.poolSize` to Node 24's value, and parses a view into a larger buffer. It asserts that the argument has exactly the input's length and bytes. It fails on the old code (65536 ≠ 6460) and passes on the fix, on Node 22.<br>• **Node 24:** the import tests pass 49 of 49.<br>• **vertical-m1 step 7:** it now asserts the upload's 201, and `{status, failureCodes}` against `{"preview_ready", []}`.<br>• **Typecheck:** domain and app pass | Session output | Reviews |
| 4 | gp-reviewer | Changes requested:<br>• R1 (major): `Buffer.prototype.slice` returns a view, so a `Buffer` input still handed ExcelJS the pool;<br>• R2 (medium): the record understated the impact (below);<br>• R3, R4 (low): BL-064 wording, the fake-Telegram reason;<br>• R5, R6 (nits): the test's assertion order, and step 7 checking no HTTP status | Subagent report (session), on `4f3f284c` | Fixes |
| 5 | Coordinator | Fixes (Findings below):<br>• **Fix:** now `wb.xlsx.load(new Uint8Array(bytes).buffer)`: the typed-array constructor always copies exactly the input.<br>• **Test:** loops over a view and a pooled `Buffer`, asserting length and bytes before `r.ok`. It fails with the `slice()` variant (65536 ≠ 6460) and passes on the fix.<br>• **Node 24:** the domain `xlsx` tests pass 11 of 11 and the import tests 49 of 49.<br>• **Step 7:** it asserts `{http, code, status, failureCodes}` against `{200, undefined, "preview_ready", []}`.<br>• R2 was passed to `gp-security` | Session output | gp-security, gp-qa |
| 6 | gp-security | PASS for the worktree fix, with conditions. S1 (major at `4f3f284c`, the `Buffer#slice` view) is R1, already fixed. S2 answers R2: another workbook left in recycled pool memory after the upload could be parsed in its place, possibly another workspace's, and stored as this batch's rows. The crafted over-read the old load allowed is closed by the fix, and no pool bytes reach a log. S3–S6 below | Subagent report (session), on `4f3f284c` and the worktree | Measure S2 |
| 7 | Coordinator | **S2 measured** on the installed exceljs 4.4.0, alternating the two m1 fixture workbooks (7,359 and 7,342 bytes) through the DB round trip in one process:<br>• **Node 24.21.0, the old load:** of 3,000 parses, 2,314 returned their own rows, **58 returned the other workbook's rows**, and 628 failed;<br>• **Node 24.21.0, the fixed load:** 3,000 of 3,000 own rows;<br>• **Node 22.22.2, the old load:** 1,000 of 1,000 own rows.<br>The substitution is real, not hypothetical. The failure rate depends on what else the process allocates, so the tight loop's rate is not a production estimate.<br>**Fixes:** S3: `PARSER_VERSION` is `goproceed-import/1.0.1`. S6: the fake answers `new Uint8Array(options.bytes).buffer`. S2: BL-190 (P1, the owner's audit), and «What is not true» below. S4, S5: BL-191, BL-192 (P2) | Session output | gp-qa |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1 | major | `xlsx.ts`, a `Buffer` input | An exact copy expected; `Buffer#slice` returned a pool view | Coordinator | Fixed: `new Uint8Array(bytes).buffer`, plus the `Buffer` test case (row 5) |
| R2 | medium | This record | The impact covered only the malformed failures | Coordinator, gp-security | Answered by S2 and measured (row 7) |
| R3 | low | BL-064 | Re-rank attribution, #157 evidence, dependency satisfied | Coordinator | Fixed in `docs/BACKLOG.md` |
| R4 | low | This record, `fake-telegram.ts` | «a whole ArrayBuffer is intended» is inaccurate | Coordinator | Fixed: latent, no caller passes `bytes` |
| R5 | nit | `xlsx.test.ts` | Length and bytes asserted before `r.ok` | Coordinator | Fixed |
| R6 | nit | `vertical-m1` step 7 | Validate's HTTP status unchecked | Coordinator | Fixed |
| S1 | major | `xlsx.ts` at `4f3f284c` | = R1 | Coordinator | Fixed (row 5) |
| S2 | high impact | The old load | Another workbook, possibly another workspace's, could be parsed in the upload's place | Owner | Closed going forward by the fix; measured (row 7); the audit of hosted parses is BL-190 (P1) |
| S3 | low | `version.ts` | «Bump on ANY change» to the parser's behaviour | Coordinator | Fixed: `goproceed-import/1.0.1` |
| S4 | medium | `xlsx-guard.ts` vs JSZip, pre-existing | Guard and parser read the directory differently | Owner | Deferred to BL-191 (P2) |
| S5 | medium | JSZip inflation, pre-existing | Real inflation is unbounded | Owner | Deferred to BL-192 (P2) |
| S6 | info | `fake-telegram.ts` | The same `.buffer` pattern in a test fake | Coordinator | Fixed |

Rework count and hypothesis changes: none.

## What is not true after this task

- Before DEV-082, on Node 24, an XLSX under 32 KiB was parsed inside a 64 KiB region of process memory. JSZip took the last zip directory in that region, so an intact earlier workbook left in recycled memory after the upload — possibly another workspace's, parsed or uploaded earlier in the same process — could be parsed in the upload's place and stored as this batch's rows. Row 7 shows it happening in a test process. Parses that succeeded under `goproceed-import/1.0.0` on Node 24 are not proven to reflect their files; whether any hosted one did not is BL-190, the owner's audit.
- The hosted runtime's Node version was not checked here.
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
- Review independence: the root cause came from an independent subagent; `gp-reviewer` and `gp-security` ran as independent native subagents; `gp-qa` is pending.
- Verified scope: rows 1–7.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-qa`; the owner for BL-190.
- Final state and reason: implementing.
