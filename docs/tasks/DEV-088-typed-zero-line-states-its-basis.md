# DEV-088 — BL-022: a hand-typed zero-priced line states the price basis an imported one does

## Assignment

- **Objective and user-visible outcome.** A work line typed with a zero price stores the version's price basis, as the same line imported from an estimate does. A line with a missing price still stores none. The published version then no longer tells a typed zero line from an imported one (ADR-006 decision 2). There is no change on screen, and the amounts, the line manifest hash and the API shape are unchanged.
- **State:** done
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
  - No backfill. A typed zero line in a draft takes the basis on its next correction, since `work_items.update` re-derives and rewrites `price_basis`; published rows and untouched drafts keep null.
  - The manual path is aligned to the importer, not the reverse: imported rows in published versions are immutable, so changing the importer would leave them as the divergent ones.
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
| 3 | gp-reviewer | PASS on `9dc7e53b`, no blocker or major. The importer stores a basis for a zero price (the stored `{ scaled: "0" }` object is truthy); `state === "missing"` is exactly the importer's test for every state a typed line can reach; when `pins.priceBasis` is null both writers store null; **nothing reads `price_basis`** (the three writers, the column and fixtures only; every `select *` either passes through `workItemView`, which has no basis, or is only correction input — the update route's `select * … for update` re-derives the line and does not read the basis, gp-qa Q1); no hash, manifest, contract or OpenAPI includes it. R1–R5 (below) | Subagent report (session) | Fixes |
| 4 | Coordinator | R1: both integration assertions pin `"net"`, the fixture's exclusive-tax basis, so the typed zero, typed known and imported zero lines are equal under the same pins. R2: the record says a draft's zero line takes the basis on its next correction, and why the manual path follows the importer. R5: coherent inclusive pins; the unused zero price removed. R3, R4 recorded. Unit test 4 of 4; `typecheck` clean | Session output | gp-qa |
| 5 | gp-qa | **PASS on `a98b7958`** (the pre-rebase head of `ea2c31bd`, same tree), no blocker, major or minor. AC-1 PASS: 4 of 4, the baseline line fails the two zero cases (`expected null to be 'net'`), and an always-basis mutant fails the missing case; the file restored by sha256. AC-3 PASS: app unit suite 532 passed, 1 skipped (the credential-gated `evidence-service.test.ts` case), `typecheck` clean, `validate:canonical-docs` OK; nothing reads `price_basis`. AC-2 and AC-4 NOT RUN (CI only). R1, R2, R5 confirmed fixed; R3, R4 recorded. Q1: the record's `select *` wording; Q2: BL-022's Evidence cites the pre-fix line | Subagent report (session) | CI |
| 6 | Coordinator | **CI and merge.** #172 green on `ea2c31bd`: `verify` and `app-qa` success. The `verify` log shows `tests/import-publish.int.test.ts` (17 tests), `tests/manual-baseline.int.test.ts` (22 tests) and `src/lib/manual-baseline.test.ts` (4 tests) passing, in the app run of 135 files and 1519 tests, all passed. Merged as `2c33404d`. Q1 reworded in row 3; Q2: BL-022's Evidence marked as the pre-fix state; BL-022 closed → DEV-088 | [akisly/go-proceed#172](https://github.com/akisly/go-proceed/pull/172), `verify` job 108251051421 | Done |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1 | minor | The two integration assertions | Accepted net or gross; the import one held before the fix | Coordinator | Fixed: `"net"` |
| R2 | minor | The record | «Rows keep what they hold» ignored the update route; the direction of alignment unexplained | Coordinator | Fixed |
| R3 | info | The unit test | Restates the importer's rule | — | Recorded in «What is not true» |
| R4 | info | `m2-fixture.ts` | Seeds the old rule | — | Recorded in «What is not true»; nothing reads the column |
| R5 | nit | The unit test's pins | An exclusive contract with a gross basis; an unused price | Coordinator | Fixed |

Rework count and hypothesis changes: none.

## What is not true after this task

- Typed zero lines in published versions, and drafts not corrected since, keep a null basis; there is no backfill, and nothing reads the column. Every such row is in a local or staging database: no customer data exists yet.
- The unit test restates the importer's rule rather than sharing it, and `packages/testing/src/m2-fixture.ts` still seeds the old rule (gp-reviewer R3, R4); a shared `priceBasisFor(state, basis)` in `packages/domain` would close both.
- Nothing in the schema ties `price_basis` to `unit_price_state`, so a future writer could diverge again. The unit test pins the two current writers.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 `deriveLine` states the importer's basis | Yes | `a98b7958` (= `ea2c31bd`'s tree) | gp-qa: `manual-baseline.test.ts` 4 of 4; the baseline line fails the two zero cases; CI: 4 tests passed | PASS | The test restates the importer's rule (R3) |
| AC-2 the stored bases on CI's database | Yes | `ea2c31bd` | CI `verify`: `tests/manual-baseline.int.test.ts` (22) and `tests/import-publish.int.test.ts` (17) passed | PASS | The import assertion passes on the baseline too; it guards the importer, not the fix |
| AC-3 unit suite, typecheck, manifest unaffected | Yes | `a98b7958` | gp-qa: 532 passed, 1 skipped (credential-gated); `typecheck` clean; `lineManifestHash` leaves the basis out | PASS | — |
| AC-4 CI green, the suites in the log | Yes | `ea2c31bd` | #172 `verify` and `app-qa` success; the app run 135 files, 1519 tests, all passed | PASS | — |

## Sources

None beyond the repository: no external library or service is involved.

## Completion / handoff

- **Changed / inspected files:** see «Owning module».
- **Review independence:** `gp-reviewer` ran as an independent native subagent.
- **Verified scope:** rows 1–6.
- **Remaining risks / blocked requirements:** «What is not true after this task».
- **Next bounded action and owner:** none; a shared `priceBasisFor` would close R3 and R4 (not filed: nothing reads the column).
- **Final state and reason:** done: every acceptance criterion PASS, merged in #172 (`2c33404d`).
