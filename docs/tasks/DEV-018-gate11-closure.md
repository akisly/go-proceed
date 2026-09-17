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

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

- **The gate closes on the v0.1 read minimum**, not on the whole tenancy test list: cross-workspace write denial (BL-099) and capability enforcement inside a workspace are not part of it, and `SECURITY DEFINER` functions, storage paths, sequences and other schemas stay proved by review.
- **Nothing hosted was verified.** The run was local; no hosted project holds `0059`–`0087`, and nothing ran in CI.
- **Five entries stay open and named, not fixed:** BL-101, BL-103, BL-104, BL-105, BL-106.
- **The `apps/app` suites are not cited** as isolation evidence, by the runbook's own rule; only `packages/testing` ran here.
- **The local Supabase CLI is 2.114.0** while `.supabase-cli-version` pins 2.115.0, so the reset used a CLI one patch behind the pin.
- **No quarantine ledger exists.** The validator's refusal of a skippable cited test stands in for it, as `test-strategy.md` §4 records.
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
