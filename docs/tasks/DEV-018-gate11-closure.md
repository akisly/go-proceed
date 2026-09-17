# DEV-018 — M0 readiness gate 11: the evidence run and the closing entry

## Assignment

- **Objective and user-visible outcome:** readiness gate 11 («Tenant isolation for every module», `docs/delivery/production-readiness.md` §11) closes, or is shown not to close. `technical/database/rls-coverage.csv` has no `gap` row since [DEV-017](DEV-017-capture-event-service-workspace.md); what the gate still needs is the evidence run `docs/delivery/test-strategy.md` §4 names — the unfiltered `pnpm --filter @goproceed/testing test`, with every cited file passing and none skipped — and a dated entry in `docs/delivery/version-0.1.md` §M0, in the shape of the gate 10 entry.
- **State:** reviewing
- **Coordinator:** primary Claude Code session, 2026-09-18.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires.
- **Selected route and why:** no code, catalog or migration changes — the gate's evidence is a test run and the entry is prose. Coordinator runs the suite and drafts the entry → `gp-reviewer` (the claim against the evidence) → `gp-qa` (each closing condition against the run). `gp-architect` and `gp-security` are not triggered: nothing changes RLS, grants, contracts or catalogs.
- **Triggered stages and why:** `gp-reviewer` and `gp-qa` (the gate's claim must not exceed its evidence). `gp-security` is not triggered by a document, but the claim it records is a security claim, so its earlier PASSes on DEV-014 to DEV-017 are cited rather than re-run.
- **Owning module and allowed edit paths:** `docs/delivery/version-0.1.md` §M0 (the gate 11 entry); `docs/delivery/production-readiness.md` §11; `docs/delivery/pilot-execution-runbook.md` §5.11, §5.14 row 4 and §7.4 if needed; `docs/delivery/test-strategy.md` §4 (the run's result, dated); `docs/STATUS.md`; this record and the index. No test, migration, catalog or application change.
- **Read context:** root `AGENTS.md`; `docs/delivery/test-strategy.md` §4; `docs/delivery/version-0.1.md` §M0 «Gate evidence entries» (the gate 10 entry is the shape); `docs/delivery/production-readiness.md` §11; [DEV-013](DEV-013-m0-gate11-coverage-checker.md) to [DEV-017](DEV-017-capture-event-service-workspace.md) and their «What is not true».
- **Linked spec, ADR or earlier task:** DEV-013 (the registry and its checkers), DEV-014, DEV-015, DEV-016, DEV-017; INV-060.
- **Baseline:** `1bf5cea` (main after PR #98).
- **Dependencies / constraints / out of scope:** the evidence run calls `resetDb()` → `supabase db reset`, which wipes the local database and re-applies `0001`–`0087`; the owner allowed exactly that on 2026-09-18. Out of scope: BL-099, BL-101, BL-103, BL-104, BL-105, BL-106 and every other open entry — the gate closes on the v0.1 read minimum, not on them; CI (no jobs until October 2026).
- **Required acceptance criteria:**
  1. The unfiltered `pnpm --filter @goproceed/testing test` ran on this baseline against the local database re-created by the run, and passed with **no skipped test**; the record names the per-file results and the migration level after the reset.
  2. Every file the registry cites appears in that run and passed; `rls-coverage.test.ts` is one of them.
  3. The registry still holds 74 `covered`, 0 `gap`, 7 `exempt_no_grant`, and `pnpm validate:canonical-docs` passes.
  4. A dated gate 11 entry exists in `version-0.1.md` §M0 in the gate 10 shape: what it proves, the run, and a *Limits* bullet naming the v0.1 read minimum (BL-099), what stays review, the open entries BL-101 and BL-103 to BL-106, that nothing ran in CI, and that no hosted project holds `0059`–`0087`.
  5. `production-readiness.md` §11, runbook §5.11 and §5.14 row 4, `test-strategy.md` §4 and STATUS agree with the entry, and none of them claims more than it.
  6. `pnpm validate:agents` passes.
  7. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-architect`, `gp-security`, `gp-ui-reviewer`, `gp-mobile`: no design, RLS, UI or mobile change; the security claim rests on the reviews of DEV-014 to DEV-017.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-18 | Close gate 11 now (after PR #98 was merged) | chat, «смержил, давай закрывать gate 11» |
| 2026-09-18 | The unfiltered package run may reset the local database | chat, answer «Да, запускать с сбросом» |

## Plan

1. Record the database's state before the run, and the Supabase CLI version.
2. Run the unfiltered `pnpm --filter @goproceed/testing test`; keep its full output.
3. Cross-check every file the registry cites against that run, and the registry's counts.
4. Write the gate 11 entry in `version-0.1.md` §M0, then reconcile readiness §11, runbook §5.11 and §5.14, test-strategy §4 and STATUS with it.
5. `gp-reviewer` (the claim against the evidence) → `gp-qa` (each closing condition).

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | implementing (coordinator): the run | Before: local database at `0087`, 87 applied rows, 1 organization, 69 `auth.users` rows; Supabase CLI 2.114.0 against the pinned 2.115.0. **The unfiltered `pnpm --filter @goproceed/testing test`, owner-allowed with its reset: 55 files, 786 tests, all passed, none skipped, 163 s, exit 0** (01:19:56 to 01:22:40). The run rebuilt the database itself through `resetDb()`; afterwards it is at `0087` with 87 applied rows and 162 `public` policies | `scratchpad/dev018-before-reset.txt`, `dev018-full-run.txt`, `dev018-after-reset.txt` | Cross-check |
| 2 | implementing (coordinator): cross-check | All **18** files the registry cites appear in the passing run, with their counts (`workspace-access-rls` 13, `communication-rls` 16, `contract-baseline-rls` 8, `evidence-rls` 3, `evidence-service-rls` 2, `execution-rls` 3, `external-review-rls` 3, `operational-rls` 3, `requirements-rls` 1, `projection-rls` 4, `m1-rls-baseline` 9, `m1-rls-workspace` 8, `m1-rules-rls` 15, `m1-project-sourced-schema` 34, `m2-rls` 18, `m2-occurrences-rls` 13, `m3-closure-rls` 28, `m4-act-rls` 12), and `rls-coverage.test.ts` (22) passed in the same run. Registry: 81 rows — 74 `covered`, 0 `gap`, 7 `exempt_no_grant`. Validator and agent-profile checks rc 0 | `scratchpad/dev018-validator.txt`, `dev018-agents.txt` | The entry |
| 3 | implementing (coordinator): the entry | Gate 11's dated entry added to `version-0.1.md` §M0 in the gate 10 shape: what the registry is and what keeps it honest; the two defects the work found and fixed (`0086`, `0087`), each shown by a test that was red first; the run with its counts and the migration level it left behind; and a *Limits* bullet — the v0.1 read minimum, BL-099 and capability enforcement outside it, BL-101 and BL-103 to BL-106 open, local only, nothing in CI, the CLI version gap, the scanner's text-only limits, no quarantine ledger. Readiness §11 marked CLOSED with its boxes left unticked (the gate 10 precedent), runbook §5.11 CLOSED and §5.14 row 4, test-strategy §4's evidence-run sentence, STATUS's M0 row and next actions | `scratchpad/dev018-validator2.txt` | `gp-reviewer`, `gp-qa` |
| 4 | reviewing (`gp-reviewer`, `gp-qa`, native) on `39deb47` | **`gp-qa`: criteria 1, 2, 3, 4, 6 PASS on its own parse of the run and the CSV** — 55 files, 786 tests, no skip marker, all 18 cited files present with the counts the entry lists, 74/0/7, validator and agents rc 0, the database at `0087` with 162 policies — **criterion 5 FAIL** on document reconciliation, 7 NOT RUN. **`gp-reviewer`: CHANGES REQUESTED**, same class: it re-derived every number independently and found none contradicted, but four documents disagreed with each other and two claims went past the captured evidence. Findings Q1-01 to Q1-07 and R1-01 to R1-10, none a code, catalog or security defect | review reports | Stated fixes |
| 5 | rework (coordinator), stated fixes | Runbook §5.11's leading status rewritten in the DEV-009 form («CLOSED … *[Changed 2026-09-18: this read «PARTIAL»]*»), its INV-060 table row and Next action annotated; readiness §11's CLOSED bullet moved below DEV-017's so the list stays chronological; STATUS's State cell, Open cell and history paragraph corrected, and the `0087` merge clause; the tenancy note's «the evidence run is still owed» answered by a dated DEV-018 annotation; the §5.14 emphasis fixed. **The entry's Limits bullet rewritten**: it now says plainly that the gate closed on a condition narrower than its own first box, by the owner's decisions of 2026-09-15 and 2026-09-16, and replaces «stay proved by review» with the truth — the matrix's other rows are not proved by this registry or this run and no dated record proves them; the un-quarantinable clause is recorded as **not met** (the validator is narrower than a ledger that fails the build, and it runs only when a person runs it). Provenance narrowed to what the files show, with the CLI version and a labelled post-run query captured | `scratchpad/dev018-cli-version.txt`, `dev018-after-reset-labelled.txt`, `dev018-r1-validator.txt`, `dev018-r1-agents.txt` | `gp-qa` re-check |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| Q1-01 / R1-10 | major | Runbook §5.11 headline, table row, Next action | Actual: still «PARTIAL» and «no mechanical checker exists» | coordinator | Rewritten in the DEV-009 form and annotated (row 5) |
| Q1-02 / R1-01 | major | STATUS «M0 gates» State cell | Actual: «the other ten are open» beside a CLOSED item 11 | coordinator | «Items 9, 10 and 11 are closed … the other nine» (row 5) |
| Q1-03 / R1-06 | minor | STATUS Open cell | Actual: the subject repeated, credits dropped | coordinator | One sentence, credits kept (row 5) |
| Q1-04 / R1-03 | major | Readiness §11 bullet order | Actual: CLOSED above a «not closed» bullet | coordinator | CLOSED moved last (row 5) |
| R1-02 | medium | `tenancy-and-security.md` | Actual: its last dated word was «the evidence run is still owed» | coordinator | Dated DEV-018 annotation (row 5) |
| R1-04 | medium | The entry's Limits | Actual: the narrowing unstated; «stay proved by review» asserts a review cited nowhere; the un-quarantinable clause unanswered | coordinator | Rewritten: the narrowing and the owner's decisions named, the matrix's other rows stated as unproved, the clause recorded as not met (row 5) |
| R1-05 | low | Runbook §5.14 row 4 | Actual: unbalanced emphasis | coordinator | Fixed (row 5) |
| Q1-05 / Q1-06 | minor | STATUS history paragraph; the `0087` clause | Actual: out of order; «on its branch» after #98 merged | coordinator | Fixed (row 5) |
| Q1-07 / R1-07 | low | The saved run artifact | Actual: no exit status or revision inside it; the CLI version uncaptured; the post-run numbers unlabelled | coordinator | Narrowed to what the files show; CLI version and a labelled query captured; the gap recorded under «What is not true» |
| R1-08 | low | The entry's run bullet | Actual: «the suites» included `migrations.test.ts`, which ran before the first reset | coordinator | «every cited suite ran after a `resetDb()`» (row 5) |
| R1-09 | low | «What is not true» | Actual: three omissions | coordinator | The quarantine gap, the external-session insert branches and the by-hand checkers added |

Rework count and hypothesis changes: none — QA's FAIL was on document reconciliation, not on the evidence; no blocker.

## What is not true after this task

- **The gate closes on the v0.1 read minimum**, not on the whole tenancy test list: cross-workspace write denial (BL-099) and capability enforcement inside a workspace are not part of it, and `SECURITY DEFINER` functions, storage paths, sequences and other schemas stay proved by review.
- **Nothing hosted was verified.** The run was local; no hosted project holds `0059`–`0087`, and nothing ran in CI.
- **Five entries stay open and named, not fixed:** BL-101, BL-103, BL-104, BL-105, BL-106.
- **The `apps/app` suites are not cited** as isolation evidence, by the runbook's own rule; only `packages/testing` ran here.
- **The gate closed on a condition narrower than its own first box** (the matrix in `tenancy-and-security.md`), by the owner's decisions of 2026-09-15 and 2026-09-16. The matrix's other rows are not proved by this run, and no dated record proves them.
- **The un-quarantinable clause of that box is not met**: the validator refuses a skippable cited test, which is narrower than a ledger that fails the build, and it runs only when a person runs it (no CI until October 2026). Both checkers were run by hand here.
- **The external-session insert branches** (`audit_insert_external`, `outbox_insert_external`) are exercised by no test, and for `audit_events` and `transaction_outbox` the negative is a refused insert, not a read denial (DEV-016 S1-03).
- **The local Supabase CLI is 2.114.0** while `.supabase-cli-version` pins 2.115.0, so the reset used a CLI one patch behind the pin.
- **No quarantine ledger exists.** The validator's refusal of a skippable cited test stands in for it, as `test-strategy.md` §4 records.
- **The saved run output carries neither an exit status nor a revision** (Q1-07): the `exit 0` and the baseline are the session's observation around the saved file, not inside it. A later run should capture `echo $?` and `git rev-parse HEAD` into the same file.
- **This task changed no test, migration, catalog or application code**; it recorded a result.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

The Limitation column opens with at most one qualifier from this closed set, then its detail:

- **PASS:** `negative` (the command correctly produced nothing, and the absence is the evidence); `assisted:` what had to be arranged by hand first; `owner-reported` (the owner's report, not a session observation).
- **FAIL:** `known-red baseline:` the named set of pre-existing failures, with no case outside it failing.
- **NOT RUN:** `environmental:` the cause and the command that settles it; `not-provable-locally:` what would settle it; or, with no qualifier, the reason: why it was deliberately not attempted, or why a PASS was earned for the wrong reason (`agents/roles/gp-qa.md`).

Gate records written before 2026-09-13 keep their own tokens; `docs/delivery/pilot-execution-runbook.md` §7.4 maps them onto this set.

## Sources

Third-party documentation and primary sources checked for this task. Give each one its URL, the installed version it applies to, its publication date if known (never substitute today's date) and the access date.

## Completion / handoff

- Changed / inspected files:
- Review independence: same-session / independent (name the actual stage roles)
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
