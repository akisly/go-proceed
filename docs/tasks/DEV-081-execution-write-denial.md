# DEV-081 — BL-168: the cross-workspace write minimum for the execution rows

## Assignment

- Objective and user-visible outcome:
  - No user-visible change.
  - The 6 `execution` rows of `technical/database/rls-write-coverage.csv` become `covered`. Each cites a test in `packages/testing/src/execution-write-rls.test.ts` showing that an owner of one workspace cannot insert, update or move rows into another, in the shape the DEV-076 minimum sets.
  - Migration `0106` withdraws the `work_assignments` UPDATE grant and drops `wa_update`, which no command used.
- State: done
- Coordinator: Claude Code primary session, 2026-09-25.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): the change touches executed code under `packages/testing`, a migration that withdraws a grant and drops an RLS policy, catalogs the validator reads, and `technical/data-access-surface.csv`. The route is `gp-architect` → owner decision → implementation → mutations → `gp-reviewer` + `gp-security` → `gp-qa`.
- Triggered stages:
  - `gp-architect`: a migration, grants and RLS; the stage-closure catalog.
  - `gp-security`: grants and RLS.
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered.
- Owning module and allowed edit paths:
  - `supabase/migrations/0106_the_assignment_update_no_command_makes.sql` (new);
  - `packages/testing/src/execution-write-rls.test.ts` (new);
  - `technical/database/rls-write-coverage.csv`;
  - `technical/data-access-surface.csv`: DA-122 corrected; DA-225 … DA-230 new;
  - `technical/database/invariant-catalog.csv` (INV-001, INV-060);
  - `technical/states/transition-catalog.csv` (the assignment status rows, gp-reviewer R7);
  - `scripts/validate-canonical-docs.mjs` (`RLS_WRITE_GAP_BASELINE` only);
  - `docs/BACKLOG.md` (BL-168; BL-186 … BL-189 new), `docs/STATUS.md` (migrations row), this record, and `docs/tasks/README.md`.
- Read context:
  - [DEV-076](DEV-076-write-denial-minimum.md) … [DEV-080](DEV-080-requirements-write-denial.md);
  - `packages/testing/src/execution-rls.test.ts`, `m3-closure-fixture.ts`;
  - `supabase/migrations/0016_*`, `0043_*`, `0045_*`, `0048_*`, `0051_*`.
- Linked spec, ADR or earlier task: BL-168; BL-099; INV-001; INV-060; INV-061.
- Baseline: `origin/main` `1dec107f` (after #157).
- Dependencies / constraints / out of scope:
  - The other five modules' rows (BL-169 … BL-173) are out of scope.
  - Pushing `0103` … `0106` to `goproceed-staging` needs the owner's separate word.
  - The local database is this session's own disposable stack, started in the container. It holds no owner data, and no suite that resets it was run.
- Required acceptance criteria:
  - AC-1: each of the 6 rows cites one test meeting the minimum for every privilege it holds, with its control succeeding.
  - AC-2: each of these mutations fails a test, except where the mutant cannot be observed across workspaces, which is stated:
    - `WITH CHECK (true)` on every INSERT and UPDATE policy;
    - `USING (true)` on every UPDATE policy;
    - each arm and status condition made `true` or inverted;
    - the project scope dropped from the WITH CHECK of every capability-on-project policy.
  - AC-3: `0106` withdraws the grant and drops the policy. The write registry, the baseline, DA-122, DA-225 … DA-229 and INV-060 agree with the database, and the database comparison in `rls-coverage.test.ts` passes.
  - AC-4: the validator and `typecheck` pass.
  - AC-5: CI green on the pull request.
- Skipped stages and rationale: see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | `work_assignments`: revoke the UPDATE grant in `0106` and drop `wa_update`; the command that needs it adds grant, policy and capability together. Pushing `0106` to staging stays a separate decision | Owner's answer in the session («Revoke + drop wa_update») |
| 2026-09-24 | The DEV-076 rulings apply: the move-out is required where updatable; a trigger's refusal does not count; P1 | [DEV-076](DEV-076-write-denial-minimum.md) |

## Plan

1. `gp-architect`: a plan per row, the deferred triggers, and the unused grant.
2. `0106`, applied to the local database.
3. The test file. Every write policy is mutated clause by clause.
4. The catalogs, the baseline, the docs and the record.
5. `gp-reviewer` + `gp-security`, then `gp-qa`; CI on the pull request.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | Dumped the 6 tables' policies, triggers, grants, column grants, constraints (in OID order) and columns from the local stack at `0105` | `scratchpad/dev081-policies.txt` | gp-architect |
| 2 | gp-architect | The plan:<br>• the capability each policy asks for;<br>• a committed closure with no members (on the stage that carries no occurrence) and a committed root entry per side, as the targets the admission arm and the adjustment need;<br>• an admin `prelude` inside the probe for the two closure tables, which need a closed stage and a closure;<br>• the guards to disable: the stage guards and the closure-member window;<br>• the three DEFERRED constraint triggers (the frozen set, the closure fact, the funded lineage), which never fire in a rolled-back probe and are not the tenancy defence;<br>• the `work_assignments` UPDATE grant used by nothing;<br>• DA-122 drifted, and 5 tables have no row.<br>The coordinator's own scan agrees: the only row lock that joins an assignment locks `OF b` (the Telegram binding) | Subagent report (session); session scan | Owner |
| 3 | Coordinator | Owner decision recorded. `0106` written and applied by hand as `postgres`, then recorded in `schema_migrations`; `work_assignments` is `SELECT|INSERT` | Session output | Tests |
| 4 | Coordinator | The test file: 6 cases on DEV-080's harness, with `insertOutcomes` taking an admin prelude. The multi-FK probes were run with a placeholder first. Each named constraint is the intended parent's:<br>• the assignment's work item → `…_contract_id_contr_fkey`, and its template → `…_requirement_template_version_fkey`;<br>• the stage's assignment → `…_work_assignment_id_con_fkey`;<br>• the entry's assignment → `…_work_assignment_i_fkey`, and its root → `progress_entries_root_is_root_fkey`;<br>• the allocation's contract → `…_contract_id__fkey`.<br>My own first allocation probe used an ambiguous parameter (42P08) and was corrected. Local run: 6 of 6 | Session output | Mutations |
| 5 | Coordinator | 32 mutations, each applied to one policy and restored from its `pg_policies` text; the policies' md5 (ordered by table and policy) was identical before and after. 31 fail their own table's case:<br>• `WITH CHECK (true)` on the 6 INSERT policies and `ws_update`;<br>• `USING (true)` on `ws_update`;<br>• both arms of `pe_insert`;<br>• the status and capability of `ws_insert` and of both clauses of `ws_update`, each dropped, inverted or made `true`;<br>• `va_insert`'s view conjunct, its EXISTS, the EXISTS's `p.id` match and the admitted arm's `admitted_by_closure_id IS NOT NULL`;<br>• the project scope dropped from the 8 capability-on-project WITH CHECKs.<br>One survivor, which cannot be observed across workspaces: `admitted_by_closure_id IS NULL` dropped from `va_insert`'s unadmitted arm. It changes the outcome only for an actor lacking `stage_closures.close` in their own workspace, and the owner holds it; capability scope within one workspace is outside the minimum.<br>Also survivors, stated rather than run, for the same reason (gp-reviewer R5):<br>• `va_insert`'s `p.workspace_id` comparison;<br>• its admitted-arm capability, and that capability's project scope (the view conjunct still refuses);<br>• the project scope of the EXISTS's capability (`p.workspace_id` already pins the lookup);<br>• the USING project drop of `ws_update` | `scratchpad/dev081-mutate.out`, `dev081-mutate-extra.out` | Catalogs |
| 6 | Coordinator | Catalogs and docs:<br>• the write registry: 6 rows `covered`, with `work_assignments` now `INSERT`;<br>• the 6 keys removed from the baseline;<br>• DA-122 corrected: `SELECT|INSERT`, `bff`, and the mobile projection that does not exist removed;<br>• DA-225 … DA-229 added for the 5 tables that had no row;<br>• INV-001 and INV-060 cite the file;<br>• the `STATUS.md` migrations marker is `0106`;<br>• BL-168 scheduled; BL-186 (P3, the whole-table `work_stages` UPDATE) filed.<br>The validator passes | `git diff` | Reviews |
| 7 | gp-security | PASS, no blocker or major. `0106` closes an untested in-workspace edit path and breaks no flow: FK checks run as the owner, the one joined lock is `OF b`, and the m3 fixture updates as admin. The tests prove confinement: the admin preludes strengthen them, and no deferred trigger carries a cross-workspace guarantee alone. `va_insert`'s `p.workspace_id` comparison cannot be observed, and FKs back it. Findings S1–S7 (below) | Subagent report (session), on `d2c8def8` | Fixes |
| 8 | Coordinator | Fixes:<br>• S1: the entry's work item → `progress_entries_workspace_id_work_item_id_fkey`; the member's occurrence → `stage_closure_occurrences_occurrence_fkey`, both observed and then named.<br>• S2: `policy` now means only a new row's WITH CHECK refusal, and `privilege` only «permission denied for table».<br>• S5: DA-230 for `progress_allocation_heads`.<br>• S7: `0106`'s self-check covers every `goproceed_*` role; it passes, and a column UPDATE granted to `goproceed_worker` fires it.<br>• S3, S4, S6: filed as BL-187, BL-188 and BL-189 (P3).<br>6 of 6 pass | Session output | gp-reviewer |
| 9 | gp-reviewer | PASS, no blocker or major. R1 and R2 were already fixed by S1 (row 8). Findings R3–R8 (below) | Subagent report (session), on `d2c8def8` | Fixes |
| 10 | Coordinator | Fixes:<br>• R3: a location per side is seeded, and the assignment's `location_id` (written by the route from the client) is probed. B's location is refused by `work_assignments_workspace_id_project_id_location_id_fkey`, observed with a placeholder and then named;<br>• R4: a comment in the test explains why `work_assignment_id` is not moved alone: the occurrences scoped to A's open stages hold a referenced-side NO ACTION check that would answer first, for the wrong reason, and the `contract_id` move breaks the same composite FK;<br>• R5: row 5 now calls the unrun mutants survivors, and lists two more;<br>• R6: the rollback note is below;<br>• R7: the five assignment status rows of `transition-catalog.csv` are marked not written in v0.1;<br>• R8: INV-001 names the closures' frozen members.<br>6 of 6 pass; the validator passes | Session output | gp-qa |
| 11 | gp-qa | AC-1, AC-3 and AC-4 PASS on `cd429b86`; every finding fix confirmed.<br>• `execution-write-rls.test.ts` 6 of 6, none skipped; each registry citation matches its test title exactly; no fixture rows remain and every user trigger is enabled afterwards.<br>• `0106`: `goproceed_app` holds `INSERT` and `SELECT` only, no role holds a column UPDATE, only `wa_insert` and `wa_select` remain, and the `schema_migrations` row exists. Its self-check passes, and three positive controls fire it (a worker column grant, an UPDATE policy, a revoked INSERT), each rolled back.<br>• `rls-coverage.test.ts` 31 of 31 and `execution-rls.test.ts` 3 of 3, each read first for `resetDb`.<br>• AC-2: confirmed from the sweep's scripts and outputs, and the policies' md5 is unchanged. Its own re-run at head was refused by the host's permission check, because the sweep alters policies on the local database. It was not worked around, and the coordinator did not run it in QA's place | Subagent report (session) | CI |
| 12 | Coordinator | PR #158 CI green on `cd429b86` (run 36135056414: `verify`, `app-qa`). The `verify` log shows, on CI's migrated database:<br>• `execution-write-rls.test.ts` 6 of 6;<br>• `rls-coverage.test.ts` 31 of 31;<br>• `execution-rls.test.ts` 3 of 3.<br>Merged in #158 (`3b586956`) | CI job log | Done |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1 | low | The entry and member probes | The cited title named an item probe that did not exist; the occurrence override was unused | Coordinator | Fixed: both probes added, FK named (row 8) |
| S2 | low | The refusal classifier | A SELECT policy's refusal or a function's «permission denied» would have counted | Coordinator | Fixed: anchored patterns |
| S3 | low | `app.stage_key_is_admissible` (0051) | A cross-tenant boolean oracle; predates DEV-081 | Owner | Deferred to BL-187 (P3) |
| S4 | low | The allocation-head definers (0017) | An existence oracle, and EXECUTE revoked from PUBLIC only; predates DEV-081 | Owner | Deferred to BL-188 (P3) |
| S5 | low | `progress_allocation_heads` | No DA row | Coordinator | Fixed: DA-230 |
| S6 | info | `va_insert`'s admitted arm | No transaction window, within one workspace | Owner | Deferred to BL-189 (P3) |
| S7 | nit | `0106`'s self-check | Covered two roles | Coordinator | Fixed: every `goproceed_*` role |
| R1 | minor | The entry probes | No probe for the entry's work item | Coordinator | Fixed by S1 |
| R2 | minor | The member probes | No probe for the member's occurrence | Coordinator | Fixed by S1 |
| R3 | minor | The assignment probes | The route writes a client-supplied `location_id`; no probe | Coordinator | Fixed: location probe, FK named (row 10) |
| R4 | nit | The stage moves | Why `work_assignment_id` is not moved alone was not stated | Coordinator | Fixed: test comment, row 10 |
| R5 | nit | Row 5 | Unrun mutants to be called survivors; two unlisted | Coordinator | Fixed: row 5 |
| R6 | nit | `0106`'s rollback note | A rollback needs the whole UPDATE minimum, not just the assertion removed | Coordinator | Fixed: «What is not true» (the migration is applied locally and stays as written) |
| R7 | nit | `transition-catalog.csv` | The assignment status commands read as live | Coordinator | Fixed: marked not written in v0.1 |
| R8 | nit | INV-001 | The closure members were not named | Coordinator | Fixed |

Rework count and hypothesis changes: none.

## What is not true after this task

- `0103` … `0106` are on the local database only, not on `goproceed-staging`. The owner decides the push.
- The other 15 write rows (BL-169 … BL-173) are still gaps.
- Capability scope within one workspace (a member without the close or progress capabilities) is outside the cross-workspace minimum.
- The three deferred constraint triggers are exercised by the m3 suites, not here.
- BL-186 … BL-189 (P3) stay open.
- A rollback of `0106` owes more than its note says. The `work_assignments` UPDATE key is out of the gap baseline, so restoring the grant cannot return as a gap: the registry check would then fail until the rollback adds the full UPDATE minimum (the confined UPDATE and the move-outs) to `execution-write-rls.test.ts`, alongside the registry row, DA-122 and the transition rows.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 each row cites one test meeting the minimum | Yes | `cd429b86` | gp-qa: 6 of 6, none skipped, citations exact; CI: 6 of 6 (rows 11, 12) | PASS | Member plane; deferred triggers exercised by the m3 suites |
| AC-2 every listed mutation fails a test | Yes | `d2c8def8` | 31 of 32 killed; the survivor and the unrun mutants stated as unobservable (row 5); gp-qa confirmed the scripts, outputs and restored md5 (row 11) | PASS | The sweep predates `64995ddf` and `cd429b86`, which only add probes and narrow the classifier; the re-run at head was refused by the host's permission check and not run |
| AC-3 `0106`, the registry, the baseline, the DA rows, INV-060 | Yes | `cd429b86` | gp-qa's database checks and positive controls; the comparison 31 of 31 locally and on CI (rows 11, 12) | PASS | Local 17.6 stack |
| AC-4 validator and typecheck | Yes | `cd429b86` | `pnpm validate:canonical-docs` OK; `@goproceed/testing` typecheck exit 0 | PASS | Node 22 locally |
| AC-5 CI green | Yes | `cd429b86` | run 36135056414: `verify` and `app-qa` success | PASS | |

## Sources

- PostgreSQL 17 row security and constraint order, observed on the local 17.6 stack, not read. A BEFORE trigger answers before the policy. The policy answers before CHECK, unique and foreign-key checks. A DEFERRED constraint trigger is queued and dropped at rollback. The `postgresql.org` pages stay blocked from this container, as recorded in DEV-076.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: `gp-architect`, `gp-security`, `gp-reviewer` and `gp-qa` ran as independent native subagents.
- Verified scope: rows 1–12.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: BL-169 is the next stage. Pushing `0103` … `0106` to staging is the owner's.
- Final state and reason: done — every required criterion PASS; #158 merged with CI green (row 12).
