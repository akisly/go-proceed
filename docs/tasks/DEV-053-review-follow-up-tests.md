# DEV-053 — BL-144: the schema list and two review fixes get their tests; the cluster's final run

## Assignment

- **Objective and user-visible outcome:** no behaviour changes. `m1-schema.test.ts` lists `project_responsibility_assignment_ends` with the other workspace-access tables; `project_responsibilities.end`'s lower-casing of the member id and `revokeProjectAccessRequest`'s bound on `capabilities` get tests. Then the cluster «Доступ к проекту» (DEV-047 to DEV-054) gets its final run: the suites that drive the changed routes and policies, one at a time, plus types and docs.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** tests for existing behaviour: tests → `gp-reviewer` → `gp-qa`, which also verifies the cluster's final run.
- **Triggered stages and why:** none beyond `gp-reviewer` and `gp-qa` (test files only).
- **Owning module and allowed edit paths:** `packages/testing/src/m1-schema.test.ts`; `apps/app/tests/responsibility-end.int.test.ts`; `packages/contracts/src/project-access.test.ts`; `docs/BACKLOG.md` (BL-144); this record; `docs/tasks/README.md`; the cluster's records (acceptance evidence of the final run).
- **Read context and applicable local instructions:** root `AGENTS.md` («What "the tests pass" means here»); DEV-044's record R1-05c; BL-144.
- **Linked spec, ADR or earlier task:** BL-144, filed by [DEV-044](DEV-044-responsibility-end.md); cluster DEV-047 to DEV-054.
- **Baseline:** `6fae61c0` (DEV-052).
- **Dependencies / constraints / out of scope:** `m1-schema.test.ts` calls `resetDb()`, which the owner does not allow locally, so the file itself is NOT RUN here; its four assertions that iterate the edited lists are checked by the same SQL on the local database. BL-144 item (1) closes on that SQL evidence; running `m1-schema.test.ts` itself is owed to the first CI run after the billing block. CI is blocked by billing.
- **Required acceptance criteria:**
  1. `responsibility-end.int.test.ts`: an upper-case member id ends the same assignment and the audit record names the member in lower case; red with the route's `toLowerCase` removed, green with it.
  2. `project-access.test.ts`: the revoke request accepts every capability once and refuses one more entry; red with `.max` removed, green with it.
  3. `m1-schema.test.ts` lists `project_responsibility_assignment_ends` in the NOT NULL/unique list and the composite-FK list; the file is NOT RUN locally (resetDb); the same four SQL checks (NOT NULL `workspace_id`, unique `(id, workspace_id)`, a two-column FK to `projects`, a workspace-leading index) pass on the local database at `0099`.
  4. The cluster's final run: every suite named in DEV-047 to DEV-054's criteria passes on the final revision, one at a time, with none skipped; `tsc` and `validate:canonical-docs` pass.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | BL-144 joins the cluster | chat, answer «… BL-144 тесты» (DEV-047's record) |
| 2026-09-24 | No local reset; truncating tenant tables is allowed | the session's standing brief (DEV-047's record) |

## Plan

1. The two tests and the schema list.
2. Mutation checks for the two tests.
3. The cluster's final run.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | coordinator | Green: contract suite 10 passed, responsibility-end 8 passed | `scratchpad/dev052-green.txt` | mutation |
| 2 | coordinator | Red with the route's `toLowerCase` and the schema's `.max` removed: one failure each (the audit record names the upper-case id; a list one entry longer than the vocabulary parses); both files restored, `git diff` empty for them | `scratchpad/dev052-red.txt` | schema SQL |
| 3 | coordinator | The four `m1-schema` assertions for `project_responsibility_assignment_ends` on the local database at `0099`: `workspace_id` NOT NULL, one unique `(id, workspace_id)`, one two-column FK to `projects`, and (after R1-01) a workspace-leading index (2) | `scratchpad/dev052-m1-schema-sql.txt` | review |
| 4 | gp-reviewer | R1 PASS: R1-01, R1-02 minor (record), R1-03 nit (test) | reviewer report, 2026-09-24, on `scratchpad/dev052-r1.diff` | fixes, gp-qa |
| 5 | coordinator | R1 fixes applied (the index check: 2 workspace-leading indexes; the record; `toHaveLength(1)`) | `scratchpad/dev052-m1-schema-sql.txt` | final run |
| 6 | coordinator | The cluster's final run on `6fae61c0` + this task, one suite at a time, none skipped: `packages/contracts` 153; `packages/testing` workspace-access-rls 26, rls-coverage 22, m2-rls 18, m2-policy-gaps 4, m1-rules-rls 17, m3-closure-rls 28, m2-occurrences-rls 13, m2-binding-hardening 36; `apps/app` command 16, project-path-ids 22, project-access-grant 10, project-access-revoke 20, project-access-dates 6, responsibility-end 8, idempotency-authorization 13, telegram-evidence 22, project-communications 9, telegram-delivery 10, upload-intents-create 23, upload-intents-get 9, upload-intents-finalize 36, evidence-purge 24, vertical-m2a 10, m6-blocked-value 23. `pnpm turbo run typecheck` 10/10; `validate:canonical-docs` OK | `scratchpad/cluster-final-run.txt` | gp-qa |
| 7 | gp-qa | Criteria 1–3 PASS (responsibility-end 8 twice, contract 10, the four SQL checks with negative controls); criterion 4 passes on QA's reruns once `request-hash.test.ts` (DEV-048 criterion 3) is in the run; it was added, 5 passed | QA report, 2026-09-24; `scratchpad/cluster-final-run.txt` | commit |
| 8 | coordinator | The late reviews of DEV-047, DEV-048 and DEV-049 (committed without them) found fixes to make; the cluster's final run is repeated after them, so criterion 4 is re-evidenced there | this record | final run after the review fixes |
| 9 | gp-qa | Criterion 4 PASS on the repeated final run | QA report, 2026-09-24 | commit |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | minor | criterion 3, row 3 | four `m1-schema` assertions iterate the edited list, three were checked | coordinator | fixed: the index check run by SQL (2 indexes) and named |
| R1-02 | minor | dependencies; BL-144 | how item (1) closes was not said | coordinator | fixed: closes on the SQL evidence; the file's run owed to the first CI run |
| R1-03 | nit | the upper-case test | no length check before reading the audit row | coordinator | fixed: `toHaveLength(1)` |

Rework count and hypothesis changes: none (first review; fixes limited to the stated ones).

## What is not true after this task

- `m1-schema.test.ts` itself has not run with the new entry (it resets the database; CI is blocked); its run is owed to the first CI run after the billing block.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | `6fae61c0` + this task | `npx vitest run tests/responsibility-end.int.test.ts` in `apps/app`: 8 passed; red with `toLowerCase` removed | PASS (`gp-qa`'s run) | the red run is the coordinator's |
| 2 | yes | same | `npx vitest run src/project-access.test.ts` in `packages/contracts`: 10 passed; red with `.max` removed | PASS (`gp-qa`'s run) | the red run is the coordinator's |
| 3 | yes | same | the four SQL checks on the local database at `0099` | PASS (`gp-qa`'s run); `m1-schema.test.ts` NOT RUN | the file resets the database; its run is owed to CI |
| 4 | yes | `506ce05` + the late-review rework | `scratchpad/cluster-final-run-2.txt`: every suite named in DEV-047..DEV-054's criteria, one at a time, none skipped; `pnpm turbo run typecheck` 10/10; `validate:canonical-docs` OK | PASS (`gp-qa` checked coverage and re-ran four) | CI blocked; `m1-schema` NOT RUN (criterion 3) |

## Sources

- No third-party behaviour.

## Completion / handoff

- Changed / inspected files: the three test files, BL-144, this record; the cluster's final run.
- Review independence: `gp-reviewer` and `gp-qa` as independent native subagents.
- Verified scope: criteria 1–4; `m1-schema.test.ts` NOT RUN.
- Remaining risks / blocked requirements: `m1-schema.test.ts`'s run is owed to the first CI run.
- Next bounded action and owner: merging is the owner's.
- Final state and reason: verifying until the owner's merge.
