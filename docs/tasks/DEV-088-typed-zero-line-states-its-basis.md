# DEV-088 — BL-022: a hand-typed zero-priced line states the price basis an imported one does

## Assignment

- **Objective and user-visible outcome.** A work line typed with a zero price stores the version's price basis, as the same line imported from an estimate does. A line with a missing price still stores none. The published version then no longer tells a typed zero line from an imported one (ADR-006 decision 2). There is no change on screen, and the amounts, the line manifest hash and the API shape are unchanged.
- **State:** reviewing
- **Coordinator:** Claude Code primary session, 2026-09-25.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why** (`agents/COORDINATION.md`): the change touches executed code under `apps/app`. The route is implementation → `gp-reviewer` → `gp-qa`.
- **Triggered stages:**
  - `gp-reviewer` and `gp-qa`: always.
  - `gp-architect`: not triggered. There is no migration, and no contract, error code or state catalogue changes. `price_basis` already admits both values and null.
  - `gp-security`: not triggered. There is no RLS, grant, auth, upload, secret or retention change.
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher`: not triggered.
- **Owning module and allowed edit paths:**
  - `apps/app/src/lib/manual-baseline.ts` (`deriveLine`'s `priceBasis`);
  - `apps/app/src/lib/manual-baseline.test.ts` (new);
  - `apps/app/tests/manual-baseline.int.test.ts` and `apps/app/tests/import-publish.int.test.ts` (one assertion each);
  - `docs/BACKLOG.md` (BL-022), this record, and `docs/tasks/README.md`.
- **Read context:**
  - `apps/app/app/v1/import-batches/[batchId]/publish/route.ts` (`mp.unitPrice ? priceBasis : null`);
  - `packages/domain/src/import/validate.ts` (a zero price parses into `unitPrice`, with state `zero`);
  - `apps/app/app/v1/contract-versions/[versionId]/work-items/route.ts` and `apps/app/app/v1/work-items/[workItemId]/route.ts`, the two writers of `deriveLine`'s output;
  - `supabase/migrations/0012_contract_baseline_module.sql` (`price_basis`, with no check tying it to the state).
- **Linked spec, ADR or earlier task:** BL-022; ADR-006 decision 2.
- **Baseline:** `313a402c`, which is `origin/main` after #170 plus the DEV-087 closure.
- **Dependencies, constraints and out of scope:**
  - Rows already stored keep what they hold: this task includes no backfill.
  - The importer is unchanged.
- **Required acceptance criteria:**
  - AC-1: for a zero, a known and a missing price, `deriveLine` states the basis `import_batches.publish` states for the same line. A unit test proves it, and it fails on the baseline for the zero case.
  - AC-2: on CI's database, a typed zero line stores the same basis as a typed known line in the same version, a typed missing line stores none, and an imported zero line stores a basis.
  - AC-3: the app unit suite and `typecheck` pass. The line manifest hash is untouched, because `priceBasis` is not in it.
  - AC-4: CI is green on the pull request, and the two integration suites are shown running in the log.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | Take the next backlog item after DEV-087; BL-022, a P2 with no owner dependency | Coordinator, under the owner's standing order («мержи и давай дальше») |

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | **The divergence, read.**<br>• `import_batches.publish` writes `mp.unitPrice ? priceBasis : null`, and `validateRow` sets `unitPrice` for a zero price too (state `zero`). So an imported zero line states the basis.<br>• `deriveLine` set `unitPrice` only for state `known`, and wrote `unitPrice === null ? null : pins.priceBasis`. So a typed zero line stated none.<br>• A missing price states none on both paths.<br>• The line manifest hash (`lineManifestHash`) does not include the basis, so publication hashes are unaffected. | Files above | Fix |
| 2 | Coordinator | **The fix and its checks.**<br>• `deriveLine` now writes `input.unitPriceState === "missing" ? null : pins.priceBasis`.<br>• The unit test runs `validateRow` and `deriveLine` side by side for zero, known and missing. It passes 4 of 4, and against the baseline line it fails the two zero cases.<br>• One assertion in each integration suite checks the stored basis; these run on CI only.<br>• The app unit suite passes 532 tests, with 1 skipped (a DB-credential-gated evidence-service case), and `typecheck` is clean. | Session output | Reviews |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none.

## What is not true after this task

- Typed zero lines stored before this change keep a null basis; there is no backfill. Every such row is in a local or staging database: no customer data exists yet.
- Nothing in the schema ties `price_basis` to `unit_price_state`, so a future writer could diverge again. The unit test pins the two current writers.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 `deriveLine` states the importer's basis | Yes | | | | |
| AC-2 the stored bases on CI's database | Yes | | | | |
| AC-3 unit suite, typecheck, manifest unaffected | Yes | | | | |
| AC-4 CI green, the suites in the log | Yes | | | | |

## Sources

None beyond the repository: no external library or service is involved.

## Completion / handoff

- **Changed / inspected files:** see «Owning module».
- **Review independence:** the reviews follow.
- **Verified scope:** rows 1–2.
- **Remaining risks / blocked requirements:** «What is not true after this task».
- **Next bounded action and owner:** `gp-reviewer`.
- **Final state and reason:** reviewing.
