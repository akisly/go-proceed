# DEV-080 — BL-167: the cross-workspace write minimum for the requirements rows

## Assignment

- Objective and user-visible outcome:
  - No user-visible change.
  - The 9 `requirements` rows of `technical/database/rls-write-coverage.csv` become `covered`. Each cites a test in `packages/testing/src/requirements-write-rls.test.ts` showing an owner of one workspace cannot insert, update or move rows into another, in the shape the DEV-076 minimum sets.
  - No migration: every write grant is used by a route.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-25.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): the change touches executed code under `packages/testing`, catalogs the validator reads, and `technical/data-access-surface.csv`. The route is `gp-architect` → implementation → mutations → `gp-reviewer` + `gp-security` → `gp-qa`. `gp-security` joins because the tests prove RLS.
- Triggered stages:
  - `gp-architect`: RLS policies; the requirement and decision catalogs.
  - `gp-security`: RLS.
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered.
- Owning module and allowed edit paths:
  - `packages/testing/src/requirements-write-rls.test.ts` (new);
  - `technical/database/rls-write-coverage.csv`;
  - `technical/data-access-surface.csv` (DA-123 corrected; DA-217 … DA-224 new);
  - `technical/database/invariant-catalog.csv` (INV-001, INV-060);
  - `scripts/validate-canonical-docs.mjs` (`RLS_WRITE_GAP_BASELINE` only);
  - `docs/BACKLOG.md` (BL-167; BL-182 … BL-185 new), this record, and `docs/tasks/README.md`.
- Read context:
  - [DEV-076](DEV-076-write-denial-minimum.md) … [DEV-079](DEV-079-contract-baseline-write-denial.md);
  - `packages/testing/src/requirements-rls.test.ts`, `m1-rules-fixture.ts`, `m3-closure-fixture.ts`;
  - `supabase/migrations/0016_*`, `0041_*`, `0043_*`, `0045_*`, `0049_*`, `0059_*`, `0095_*`.
- Linked spec, ADR or earlier task: BL-167; BL-099; INV-001; INV-015; INV-060; INV-067.
- Baseline: `origin/main` `699dd7cf` (after #155).
- Dependencies / constraints / out of scope:
  - The other six modules' rows (BL-168 … BL-173) are out of scope.
  - The external-session write branches on decisions and their heads are a third principal outside the member and service planes this minimum names (BL-182).
  - The local database is this session's own disposable stack, started in the container. It holds no owner data, and no suite that resets it was run.
- Required acceptance criteria:
  - AC-1: each of the 9 rows cites one test meeting the minimum for every privilege it holds, with its control succeeding.
  - AC-2: each of these mutations fails a test:
    - `WITH CHECK (true)` on every INSERT and UPDATE policy, the external ones included;
    - `USING (true)` on every UPDATE policy;
    - each arm of `rrv_insert` made `true`, and its status arm inverted;
    - the project scope dropped from every capability-on-project policy.
  - AC-3: the write registry, the baseline, DA-123, DA-217 … DA-224 and INV-060 agree with the database, and the database comparison in `rls-coverage.test.ts` passes.
  - AC-4: the validator and `typecheck` pass.
  - AC-5: CI green on the pull request.
- Skipped stages and rationale: see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | The DEV-076 rulings apply: the move-out is required where updatable; a trigger's refusal does not count; P1 | [DEV-076](DEV-076-write-denial-minimum.md) |

No new owner decision was needed: every grant has a product writer, so nothing is offered for revocation.

## Plan

1. `gp-architect`: a plan per row and the fixture.
2. The test file. Every write policy is mutated clause by clause.
3. The catalogs, the baseline, the docs and the record.
4. `gp-reviewer` + `gp-security`, then `gp-qa`; CI on the pull request.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | Dumped the 9 tables' policies, triggers, grants, column grants, constraints and columns from the local stack at `0105` | `scratchpad/dev080-policies.txt` | gp-architect |
| 2 | gp-architect | The plan:<br>• the capability each policy asks for, all held by the owner once the closure world's four and `assignments.manage` are added;<br>• per-table parent chains and FK names;<br>• the guards to disable: the reference-image guards on INSERT, which read under the actor's RLS, and the template and head guards on UPDATE;<br>• the unit-free slots the fixture leaves: an unmaterialised stage, an occurrence with a decision and an exception but no head, and a non-Додаток source for the library control;<br>• heads have no `id`, so `confined` takes a key;<br>• every grant used by a route; DA-123 drifted and 8 tables have no row | Subagent report (session) | Implement |
| 3 | Coordinator | The test file: 9 cases on DEV-079's probe, with `confined` keyed per table. Each multi-FK probe was run first with a placeholder, and the constraint that answered was named. Each named constraint is the intended parent's:<br>• the occurrence's rule → `requirement_occurrences_from_binding_fkey`, and its image → `ro_reference_image_fkey`;<br>• a decision head's decision → `…_outcome_fkey`, and its occurrence → `…_occurrence_fkey`;<br>• an exception head's occurrence → `…_occurrence_fkey`.<br>Local run: 9 of 9 pass | Session output | Mutations |
| 4 | Coordinator | 29 mutations, each applied to one policy and restored from its `pg_policies` text; the policies' md5 (now ordered by table and policy, per DEV-079's QA) was identical before and after. All 29 fail their own table's case:<br>• `WITH CHECK (true)` on the 11 INSERT policies (the two external ones included) and the 4 UPDATE policies;<br>• `USING (true)` on the 4 UPDATE policies;<br>• `rrv_insert`'s role arm and status arm each made `true`, and the status inverted;<br>• the project scope replaced by active membership on the 7 capability-on-project policies (`ro`, `red`, `redh`, `re`, `reh` insert, `redh` and `reh` update).<br>Equivalent, stated rather than run: the same project drop in the USING of the two head update policies (A's rows are the same set, and B's stay out by membership), and a single conjunct dropped from an external policy, which is false on the member plane. For the external plane, `m5-external-schema.test.ts` kills two of those conjuncts (a decision on a sibling occurrence; an observer's head); the rest, `redh_external_update` and every cross-workspace target, are BL-182 | `scratchpad/dev080-mutate.out` | Catalogs |
| 5 | Coordinator | Catalogs and docs:<br>• the write registry: 9 rows `covered`;<br>• the 9 keys removed from the baseline;<br>• DA-123 corrected to `SELECT|INSERT` and `bff` (it listed an UPDATE never granted);<br>• DA-217 … DA-224 added for the 8 tables that had no row;<br>• INV-001 and INV-060 cite the file;<br>• BL-167 scheduled;<br>• BL-182 (P2, the external-plane write probe) and BL-183 (P3, the whole-table UPDATE grants) filed.<br>The validator passes | `git diff` | Reviews |
| 6 | gp-security | PASS, no blocker or major. No probe can pass for the wrong reason:<br>• a trigger's error is P0001, not a policy refusal;<br>• the external policies are false with an actor set;<br>• the helpers are bound to the actor, with a pinned search path;<br>• the DA rows match the grants.<br>Findings S1–S7 (below) | Subagent report (session), on `536c5b8a` | Fixes |
| 7 | Coordinator | S1 and S2: BL-182 rewritten. It is raised to P1 and tied to BL-171's two-workspace external fixture. It cites the m5 refusals that already exist, names what stays untested, and carries S2's route hardening (the external decision route's head read and advance filtered by workspace and occurrence). S3 is written into BL-182's test. S4 → BL-184 and S5 → BL-185 (P3). S6: DA-217 and DA-219 name the SECURITY DEFINER writers of an archive and a retirement. S7 not applied: the closure world seeds no location, and no route writes `location_id` | `git diff` | gp-reviewer |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1 | low | BL-182 | Filed apart from BL-171, whose fixture it needs; its evidence missed the m5 refusals that exist | Coordinator | Fixed: P1, tied to BL-171, evidence corrected (row 7) |
| S2 | low | `apps/app/app/external/occurrence-decisions/route.ts` | The head is read and advanced by role and version alone; RLS is the primary control on the external plane | Owner | Deferred into BL-182 (a route change with its own review) |
| S3 | low | BL-182's test | Only the policy refuses a null-pointer head on a foreign occurrence | Coordinator | Written into BL-182 |
| S4 | info | `requirement_evidence_decisions_grant_fkey` | A decision's grant is not pinned to its session's grant (within a workspace) | Owner | Deferred to BL-184 (P3) |
| S5 | info | `guard_requirement_head` | A head's pointer is not constrained to its lineage's tip (within a workspace; unverified) | Owner | Deferred to BL-185 (P3) |
| S6 | low | DA-217, DA-219 | The definers that archive and retire were unnamed | Coordinator | Fixed |
| S7 | info | occurrences probe | `location_id` has no mixed probe | Coordinator | Not applied: no location in the fixture, no route writes it; the FK is tenant-composite |

Rework count and hypothesis changes: none.

## What is not true after this task

- The other 21 write rows (BL-168 … BL-173) are still gaps.
- The external-session write branches are not probed across workspaces (BL-182).
- Capability scope within one workspace (a member without the decide capabilities) is outside the cross-workspace minimum.
- BL-182 (P1) and BL-183 … BL-185 (P3) stay open.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- PostgreSQL 17 row security and constraint order, observed on the local 17.6 stack, not read. A BEFORE trigger answers before the policy. The policy answers before CHECK, unique and foreign-key checks. Where several composite foreign keys break together, the one that answered was observed and named. The `postgresql.org` pages stay blocked from this container, as recorded in DEV-076.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: `gp-architect` and `gp-security` ran as independent native subagents; `gp-reviewer` and `gp-qa` are pending.
- Verified scope: rows 1–7.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-reviewer` and `gp-security`.
- Final state and reason: implementing.
