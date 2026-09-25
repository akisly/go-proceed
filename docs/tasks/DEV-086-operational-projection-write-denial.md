# DEV-086 — BL-172 and BL-173: the cross-workspace write minimum for the last operational row and the projections

## Assignment

- Objective and user-visible outcome:
  - No user-visible change.
  - The last three `gap` rows of `technical/database/rls-write-coverage.csv` become `covered`, each citing a test in the shape the DEV-076 minimum sets:
    - `idempotency_records` (`goproceed_app`): BL-172's last row, in `packages/testing/src/operational-write-rls.test.ts`. The service plane, which inherits the INSERT, is cited in the row's `reason`;
    - `readiness_projection` and `blocked_reasons` (`goproceed_service`): BL-173, in `packages/testing/src/projection-write-rls.test.ts`.
  - `RLS_WRITE_GAP_BASELINE` becomes empty: every gap DEV-076 filed is covered or revoked, and a write gap row is refused outright from now on.
  - Migration `0110` narrows the `idempotency_records` INSERT grant to the eleven columns `withIdempotency` writes.
- State: reviewing
- Coordinator: Claude Code primary session, 2026-09-25.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): the change touches executed code under `packages/testing`, a migration that narrows a grant, catalogs the validator reads, the validator's baseline, and `technical/data-access-surface.csv`. The route is `gp-architect` → owner decisions → implementation → mutations → `gp-reviewer` + `gp-security` → `gp-qa`.
- Triggered stages:
  - `gp-architect`: a migration, grants and RLS.
  - `gp-security`: grants and RLS.
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered.
- Owning module and allowed edit paths:
  - `supabase/migrations/0110_the_reply_record_takes_only_what_its_writer_writes.sql` (new);
  - `packages/testing/src/operational-write-rls.test.ts`, `packages/testing/src/projection-write-rls.test.ts` (new);
  - `technical/database/rls-write-coverage.csv`; `technical/database/rls-coverage.csv` (the two projection service rows' `reason`);
  - `technical/data-access-surface.csv`: DA-134, DA-179, DA-181;
  - `technical/database/invariant-catalog.csv` (INV-001, INV-060);
  - `scripts/validate-canonical-docs.mjs` (`RLS_WRITE_GAP_BASELINE` only);
  - `docs/delivery/test-strategy.md` (§4 annotation);
  - `docs/BACKLOG.md` (BL-172, BL-173, BL-101; BL-201 new), `docs/STATUS.md` (migrations row), this record, and `docs/tasks/README.md`.
- Read context:
  - [DEV-076](DEV-076-write-denial-minimum.md) … [DEV-085](DEV-085-external-review-write-denial.md);
  - `packages/testing/src/operational-rls.test.ts`, `projection-rls.test.ts`, `m3-closure-rls.test.ts`, `idempotency-expiry.test.ts`;
  - `supabase/migrations/0002_*`, `0003_*`, `0006_*`, `0007_*`, `0034_*`, `0045_*`, `0086_*`, `0087_*`, `0089_*`, `0100_*`;
  - `packages/database/src/idempotency.ts`, `packages/database/src/tx.ts`.
- Linked spec, ADR or earlier task: BL-172; BL-173; BL-099; BL-101; INV-001; INV-060.
- Baseline: `origin/main` `e665ff77` (after #167).
- Dependencies / constraints / out of scope:
  - BL-101 (the actor-bearing service plane) is unchanged; the test asserts the actor fence it leaves on `idempotency_records`.
  - Pushing `0103` … `0110` to `goproceed-staging` needs the owner's separate word.
  - The local database is this session's own disposable stack, started in the container. It holds no owner data, and no suite that resets it was run.
- Required acceptance criteria:
  - AC-1: each of the 3 rows cites one test meeting the minimum for every privilege it names, with its controls succeeding; `idempotency_records` on the member plane and, in `reason`, the service plane that inherits it.
  - AC-2: each of these mutations fails a test, except where the mutant cannot be observed across workspaces, which is stated:
    - `WITH CHECK (true)` on `idem_insert`, `rp_write_server` and `br_write_server`, and `USING (true)` on the latter two;
    - each conjunct and disjunct of `idem_insert` dropped;
    - both projection policies widened to «any declared workspace»;
    - each of the projections' foreign keys dropped.
  - AC-3: `0110` narrows the grant. The write registry, the empty baseline, the DA rows, INV-001 and INV-060 agree with the database, and the database comparison in `rls-coverage.test.ts` passes.
  - AC-4: the validator and `typecheck` pass.
  - AC-5: CI green on the pull request, with both new suites shown running in the log.
- Skipped stages and rationale: see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | BL-173: keep the projections' service INSERT, UPDATE and DELETE and test them, for the readiness rebuilder (Q1) | Owner's answer in the session («Keep and test») |
| 2026-09-25 | Narrow the `idempotency_records` INSERT to the eleven columns its writer writes, in `0110` (Q2) | Owner's answer in the session («Narrow in 0110») |
| 2026-09-25 | `readiness_projection.scope_ref`, which has no key, filed as a P3 residual, BL-201 (Q3) | Owner's answer in the session («File as P3 residual») |
| 2026-09-25 | F2 recorded in BL-101's scope (Q4); the service-plane idempotency case and the actor-bearing projection probes included (Q5); the old `projection-rls.test.ts` write cases kept, the read rows' `reason` re-pointed (Q6) | Coordinator, on the architect's recommendations, under the owner's standing order to close each stage and take the next |
| 2026-09-25 | BL-172's last row and BL-173 run as one stage, the last of BL-099 | Coordinator: three rows between them |
| 2026-09-24 | The DEV-076 rulings apply; P1 | [DEV-076](DEV-076-write-denial-minimum.md) |

## Plan

1. `gp-architect`: a plan per row and plane.
2. `0110`, applied to the local database.
3. The two test files. Every write policy of the three tables is mutated clause by clause, and their keys dropped.
4. The catalogs, the empty baseline, the docs and the record.
5. `gp-reviewer` + `gp-security`, then `gp-qa`; CI on the pull request.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | Dumped the 3 tables' policies, ACLs, column ACLs, triggers (none) and constraints from the local stack at `0109` | `scratchpad/dev086-policies.txt` | gp-architect |
| 2 | gp-architect | The plan:<br>• `idem_insert` reads the actor and an active membership; its only reference is `organization_id`, a single-column key, so there is no parent to mix;<br>• `withIdempotency` inserts eleven columns once and never updates; no completion UPDATE exists; the definers delete expired records;<br>• `goproceed_service` inherits the INSERT and `idem_insert`, so on the service plane the record is fenced by its actor, not by the declared workspace (F2, BL-101);<br>• the projections have no writer yet; `rp_write_server` and `br_write_server` are FOR ALL on `workspace_id = app.service_workspace()`, which reads the GUC alone, so `SET LOCAL ROLE goproceed_service` is faithful;<br>• **F1:** `readiness_projection.scope_ref` has no key;<br>• F3: `projection-rls.test.ts`'s write cases do not meet the minimum, though the read rows' `reason` calls them the write refusals;<br>• F4: `blocked_reasons_occurrence_fkey` omits `contract_id` (within one workspace);<br>• F5, F6: `created_at` chosen by the caller; DA-134 incomplete;<br>• Q1–Q6 for the owner; no ADR | Subagent report (session) | Owner |
| 3 | Coordinator | Owner decisions recorded. `0110` written and applied by hand as `postgres` with `-1`, then recorded in `schema_migrations`; its self-check passes. The column ACL now reads the eleven columns. Every app-role inserter writes a subset: `withIdempotency`, `foundation.test.ts`, `idempotency-expiry.test.ts` (its `created_at` insert runs as admin), `operational-rls.test.ts` (admin), `invitations.int.test.ts` (admin) | Session output | Tests |
| 4 | Coordinator | The two test files, on a superuser connection under `SET LOCAL ROLE` with the plane's GUCs, each statement in a savepoint of a rolled-back transaction. `beforeAll` asserts no RETURNING in a probed statement, no trigger on the three tables, the service's inheritance of the app role, and that `app.service_workspace()` does not read `session_user`. The fixture gives B's owner a suspended membership of A, so `m.status = 'active'` is what refuses it. Observed on the first run:<br>• the writer's ON CONFLICT on A's own key is refused by the policy, not skipped;<br>• a workspace that does not exist is refused by the policy before its key;<br>• a blocked reason carrying B's project breaks both composite keys and `blocked_reasons_occurrence_fkey` answers: the RI triggers are named by OID, so the key created first (`0045`) answers first. The first draft pinned the contract key by name order and failed; the header now says why.<br>Local run: `operational-write-rls` 2 of 2, `projection-write-rls` 2 of 2 | Session output | Mutations |
| 5 | Coordinator | 18 mutations: 13 to a policy, each restored from its stored text, and 5 key drops, each restored in the keys' original creation order. The md5 of the policies and of the keys' definitions, and the keys' OID order, were the same before and after.<br>**15 of 18 killed.** The 3 survivors were predicted:<br>• `idem_insert` without `m.user_id = app.current_actor()`: the EXISTS reads `memberships` under its own SELECT policies, which admit the actor's own rows and those of a workspace it is active in (as DEV-085 row 9 found for audit and outbox);<br>• `readiness_projection_workspace_id_fkey` and `blocked_reasons_workspace_id_fkey` dropped: every composite key of both tables includes `workspace_id`, so a row naming a workspace that does not exist breaks them too.<br>The first sweep restored each dropped key by re-adding it, which gave it a new OID and changed which of two broken keys answered first; its last two «kills» were that artifact. The key order was restored to `0045`'s, and the five key drops were rerun with order-preserving restores (`-2.out`) | `scratchpad/dev086-mutate.out`, `-2.out` | Catalogs |
| 6 | Coordinator | Catalogs and docs:<br>• the write registry: 3 rows `covered`; `idempotency_records` carries its column grant in `WRITE_PRIVILEGES_SQL`'s format, and names its service-plane case in `reason`; `readiness_projection` names BL-201 in `reason`;<br>• `RLS_WRITE_GAP_BASELINE` is empty;<br>• the two projection service read rows' `reason` names the new file (F3);<br>• DA-134, DA-179 and DA-181 updated;<br>• INV-001 cites both files and names `scope_ref` (BL-201) and the service plane's actor fence (BL-101); INV-060 records every DEV-076 gap closed;<br>• `test-strategy.md` annotated; the `STATUS.md` migrations marker is `0110`;<br>• BL-172 and BL-173 scheduled; BL-101's scope noted; BL-201 (P3) filed.<br>The validator and `typecheck` pass. The neighbouring suites pass against `0110`: `rls-coverage` 31, `operational-rls` 5, `projection-rls` 4, `m3-closure-rls` 28, `idempotency-expiry` 2, `foundation` 6, `privileges` 3, `outbox` 4 | `git diff`; session output | Reviews |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| F1 | minor | `readiness_projection.scope_ref` | No key: A's row can name B's stage | Owner | Deferred to BL-201 (P3); not asserted as covered |
| F2 | minor | `idempotency_records` on the service plane | Fenced by the actor, not the declared workspace | Owner | Recorded in BL-101's scope; the test asserts the actor fence |
| F3 | info | `projection-rls.test.ts` write cases; `rls-coverage.csv` rows 8, 49 | Called the write refusals, but do not meet the minimum | Coordinator | Fixed: the read rows' `reason` names the new file |
| F4 | info | `blocked_reasons_occurrence_fkey` | Omits `contract_id`: a blocked reason can name another contract of the same workspace | — | No action: within one workspace, no writer yet |
| F5 | info | `idempotency_records.created_at` | Chosen by an arbitrary-SQL caller | Coordinator | Fixed by `0110` |
| F6 | info | DA-134 | Omitted the service plane and the definer deletes | Coordinator | Fixed |

Rework count and hypothesis changes: none.

## What is not true after this task

- `0103` … `0110` are on the local database only, not on `goproceed-staging`. The owner decides the push.
- `readiness_projection.scope_ref` has no key (BL-201).
- BL-101 is unchanged: an actor-bearing service transaction writes `idempotency_records` wherever the actor is an active member, and reads the projections through the member policies.
- No readiness rebuilder exists; the projection tests prove the grants it will use.
- A rollback of `0110` owes the registry row, DA-134 and the test's privilege probes too.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 each row cites one test meeting the minimum | Yes | | | | |
| AC-2 every listed mutation fails a test, or is stated | Yes | | | | |
| AC-3 `0110`, the registry, the empty baseline, the DA rows, INV-001, INV-060 | Yes | | | | |
| AC-4 validator and typecheck | Yes | | | | |
| AC-5 CI green, both suites in the log | Yes | | | | |

## Sources

- PostgreSQL 17 row security and constraint order, observed on the local 17.6 stack, not read (DEV-076). A privilege refusal answers before any trigger or policy; the policy answers before CHECK, unique, ON CONFLICT arbitration and foreign-key checks; foreign-key triggers fire in the order of their OID-bearing names (row 4).

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: `gp-architect` ran as an independent native subagent; the reviews follow.
- Verified scope: rows 1–6.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-reviewer` and `gp-security`.
- Final state and reason: reviewing.
