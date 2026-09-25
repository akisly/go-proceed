# DEV-083 — BL-169: the cross-workspace write minimum for the statutory rows

## Assignment

- Objective and user-visible outcome:
  - No user-visible change.
  - The 4 `statutory` rows of `technical/database/rls-write-coverage.csv` become `covered`. Each cites a test in `packages/testing/src/statutory-write-rls.test.ts` showing that an owner of one workspace cannot insert, update or move rows into another, in the shape the DEV-076 minimum sets.
  - Migration `0107` does two things:
    - it withdraws UPDATE and DELETE on the two act-content tables, which no command used, and makes their policies INSERT-only;
    - it makes `sav_insert` admit a draft only, so a version can no longer be born `frozen` past the version guard's date checks and the deferred completeness check. The render and the content hash stay the freeze route's alone: no database check binds them, and an UPDATE by raw SQL skips them as an INSERT did (gp-security S1).
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-25.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): the change touches executed code under `packages/testing`, a migration that withdraws grants and replaces RLS policies, catalogs the validator reads, and `technical/data-access-surface.csv`. The route is `gp-architect` → owner decisions → implementation → mutations → `gp-reviewer` + `gp-security` → `gp-qa`.
- Triggered stages:
  - `gp-architect`: a migration, grants and RLS.
  - `gp-security`: grants and RLS.
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered.
- Owning module and allowed edit paths:
  - `supabase/migrations/0107_the_act_content_no_command_edits.sql` (new);
  - `packages/testing/src/statutory-write-rls.test.ts` (new);
  - `packages/testing/src/m4-act-schema.test.ts` (its grant assertion for the content tables, which 0107 changes);
  - `technical/database/rls-write-coverage.csv`;
  - `technical/data-access-surface.csv`: DA-231 … DA-234, new;
  - `technical/database/invariant-catalog.csv` (INV-001, INV-015, INV-060);
  - `scripts/validate-canonical-docs.mjs` (`RLS_WRITE_GAP_BASELINE` only);
  - `docs/BACKLOG.md` (BL-169; BL-193 … BL-195 new), `docs/STATUS.md` (migrations row), this record, and `docs/tasks/README.md`.
- Read context:
  - [DEV-076](DEV-076-write-denial-minimum.md) … [DEV-081](DEV-081-execution-write-denial.md);
  - `packages/testing/src/m4-act-fixture.ts`, `m4-act-rls.test.ts`, `m4-act-schema.test.ts`;
  - `supabase/migrations/0047_the_act_assembled_from_recorded_facts.sql`;
  - the compose and freeze routes.
- Linked spec, ADR or earlier task: BL-169; BL-099; INV-001; INV-015; INV-060.
- Baseline: `origin/main` `a54a5c46` (after #161).
- Dependencies / constraints / out of scope:
  - The other rows (BL-170 … BL-173) are out of scope.
  - Pushing `0103` … `0107` to `goproceed-staging` needs the owner's separate word.
  - The local database is this session's own disposable stack, started in the container. It holds no owner data, and no suite that resets it was run.
- Required acceptance criteria:
  - AC-1: each of the 4 rows cites one test meeting the minimum for every privilege it holds, with its control succeeding.
  - AC-2: each of these mutations fails a test, except where the mutant cannot be observed across workspaces, which is stated:
    - `WITH CHECK (true)` on every INSERT and UPDATE policy;
    - `USING (true)` on the UPDATE policy;
    - each capability and status arm made `true` or inverted;
    - the project scope dropped from every WITH CHECK.
  - AC-3: `0107` withdraws the grants and replaces the policies. The write registry, the baseline, DA-231 … DA-234, INV-015 and INV-060 agree with the database, and the database comparison in `rls-coverage.test.ts` passes.
  - AC-4: the validator and `typecheck` pass.
  - AC-5: CI green on the pull request.
- Skipped stages and rationale: see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | The act content's UPDATE and DELETE: revoke in `0107`, with INSERT-only policies | Owner's answer in the session («Revoke in 0107») |
| 2026-09-25 | The version UPDATE: keep the whole-table grant, test it, file the narrowing as P3 (BL-193) | Owner's answer in the session («Test it, file P3») |
| 2026-09-25 | A version born frozen: fix in `0107` with a draft arm on `sav_insert` | Owner's answer in the session («Fix in 0107») |
| 2026-09-24 | The DEV-076 rulings apply: the move-out is required where updatable; a trigger's refusal does not count; P1 | [DEV-076](DEV-076-write-denial-minimum.md) |

## Plan

1. `gp-architect`: a plan per row, the triggers, the unused grants.
2. `0107`, applied to the local database.
3. The test file. Every write policy is mutated clause by clause.
4. The catalogs, the baseline, the docs and the record.
5. `gp-reviewer` + `gp-security`, then `gp-qa`; CI on the pull request.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | Dumped the 4 tables' policies, triggers, grants, column grants, constraints (in OID order) and columns from the local stack at `0106` | `scratchpad/dev083-policies.txt` | gp-architect |
| 2 | gp-architect | The plan:<br>• the capability every policy asks, `statutory_acts.compose`;<br>• each composite FK and which a mixed INSERT can isolate (the act's stage cannot be: its closure key answers first);<br>• the guards to disable: the version guard and the two content guards;<br>• the deferred completeness check, which is not a tenancy defence;<br>• UPDATE and DELETE on the content tables used by nothing;<br>• the version UPDATE grant whole-table where the freeze sets ten columns;<br>• F3: a composer could INSERT a version already `frozen`;<br>• DA rows missing for all 4 tables; INV-015 stale | Subagent report (session) | Owner |
| 3 | Coordinator | Owner decisions recorded. `0107` written and applied by hand as `postgres`, then recorded in `schema_migrations`. The content tables are `SELECT|INSERT` with `savq_insert` and `savs_insert`; `sav_insert` asks a draft | Session output | Tests |
| 4 | Coordinator | The test file: 4 cases on DEV-081's harness. Changes to the harness: `confined` takes constant parameters, and a prelude inserts each side's second act (and its empty v1) inside the probe as the INSERT controls' parents. Each side's fixture: the act world; a second closure C2 with no act; act1 with v1 frozen by a committed freeze and v2, its draft correction, each with a quantity line and the two signatories. Each named constraint is the intended parent's. Local run: 4 of 4 | Session output | Mutations |
| 5 | Coordinator | 28 mutations, each applied to one policy and restored from its `pg_policies` text; the policies' md5 was identical before and after.<br>• **First sweep: 23 of 28.** It found a masking my own harness made: the probed act and version INSERTs were the fixture's statements, which end in `RETURNING id`. A RETURNING applies the SELECT policy to the new row, and its refusal reads exactly like the INSERT policy's, so `WITH CHECK (true)` and the project drop on `sa_insert`, and the capability made `true` and the project drop on `sav_insert`, survived.<br>• **The fix:** the file probes the two statements without their RETURNING.<br>• **Second sweep: 27 of 28**, each failing only its own table's case:<br>&nbsp;&nbsp;– `WITH CHECK (true)`, the capability inverted and the project scope dropped, on `sa_insert`, `savq_insert` and `savs_insert`;<br>&nbsp;&nbsp;– on `sav_insert`, those three plus its draft arm made `true` or inverted;<br>&nbsp;&nbsp;– on `sav_update`: `USING (true)`, `WITH CHECK (true)`, each clause's status arm made `true` or inverted, WITH CHECK's narrowed to `draft`, each capability made `true` or inverted, and WITH CHECK's project scope dropped.<br>One survivor, which cannot be observed across workspaces: the project scope dropped from `sav_update`'s USING. A's rows are in A's project, and B's fall away on the workspace | `scratchpad/dev083-mutate.out`, `dev083-mutate-2.out` | Catalogs |
| 6 | Coordinator | Catalogs and docs:<br>• the write registry: 4 rows `covered`, with the content tables now `INSERT`;<br>• the 4 keys removed from the baseline;<br>• DA-231 … DA-234 added, for the 4 tables that had no row;<br>• INV-001 and INV-060 cite the file; INV-015's enforcement names the version UPDATE the freeze needs and `0107`;<br>• the `STATUS.md` migrations marker is `0107`;<br>• BL-169 scheduled; BL-193 (the version UPDATE's narrowing), BL-194 (no status arm on the content INSERT policies) and BL-195 (the entity and relationship catalogs) filed, P3.<br>The validator, `typecheck` and `rls-coverage.test.ts` 31 of 31 pass. The earlier write suites use RETURNING only in admin fixtures, never in a probed statement | `git diff` | Reviews |
| 7 | Coordinator | The suites that touch these tables and do not reset, run one at a time against the local database at `0107`: `m4-act-rls` 12 of 12, `m5-external-rls` 10 of 10, `m5-external-schema` 42 of 42. `m4-act-schema` failed 1 of 58 on its grant assertion, which pinned UPDATE and DELETE on the content tables. It now asserts SELECT and INSERT held and UPDATE and DELETE withheld, and passes 58 of 58 | Session output | Reviews |
| 8 | gp-security | PASS, no blocker or major. 0107 narrows privileges and breaks no flow: compose inserts only a draft and never edits content; freeze updates and locks the version alone; no definer, job or the external exchange writes these tables. Reads are unchanged, since the select policies cover what the FOR ALL policies' USING added. Across workspaces, the composite FKs and the capability refuse everything with every guard off. Findings S1–S3 (below) | Subagent report (session) | Fixes |
| 9 | Coordinator | Fixes: S1, the claim about what a born-frozen INSERT skipped, corrected in 0107's comment, the objective and BL-194. S2 recorded in BL-194 with its fix and test. S3: the file asserts no probed INSERT carries a RETURNING. 4 of 4 pass | Session output | gp-reviewer |
| 10 | gp-reviewer | PASS, no blocker or major. Every probe fails for the reason it asserts; the born-frozen probe is also 0107's regression test; the minimum is met on every row; the kills and the survivor are right. Findings R1–R5 (below). Noted as a coverage limit, not a finding: a capability evaluated on the declared workspace rather than the row's would be refused only by the composite keys | Subagent report (session) | Fixes |
| 11 | Coordinator | R1–R5 fixed (below). 4 of 4 pass; `m4-act-schema` 58 of 58; typecheck and the validator pass | Session output | gp-qa |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1 | low | 0107's comment, this record | «past the render, the content hash»: the render and the hash are the route's alone, on either path | Coordinator | Fixed: wording (row 9) |
| S2 | low | `app.guard_statutory_act_content()` (0047), pre-existing | A content INSERT can race a freeze and land in a frozen version (raw SQL, one workspace) | Owner | Deferred to BL-194 (P3), with its fix and test |
| S3 | info | The file's RETURNING strip | A fixture change could silently re-mask the policies | Coordinator | Fixed: asserted in `beforeAll` |
| R1 | minor | INV-015 | «the one exception»: template and contract versions also hold UPDATE | Coordinator | Fixed |
| R2 | nit | BL-193 | «every move»: assignment and item are not moved alone | Coordinator | Fixed |
| R3 | nit | 0107's rollback note | Missed the schema test, INV-015, the DA rows and the role's name | Coordinator | Fixed, in the comment and «What is not true» |
| R4 | nit | `m4-act-schema.test.ts`, the FREEZE_SET comment | Stale rationale; nine of ten columns | Coordinator | Fixed |
| R5 | nit | The `statutory_act_id` move | Breaks two keys; which answers is trigger order | Coordinator | Fixed: comment |

Rework count and hypothesis changes: none.

## What is not true after this task

- `0103` … `0107` are on the local database only, not on `goproceed-staging`. The owner decides the push.
- The other write rows (BL-170 … BL-173) are still gaps.
- Capability scope within one workspace is outside the cross-workspace minimum.
- The deferred completeness check is exercised by this file's fixture freeze and by the m4 suites, not by a probe.
- A rollback of `0107` owes more than its revokes: the content tables' UPDATE and DELETE keys are out of the gap baseline, so restoring them fails the registry check until the full UPDATE and DELETE minimum is written; `m4-act-schema.test.ts`'s grant assertion, INV-015, DA-233 and DA-234 revert with it, and 0047's policies are recreated to `goproceed_app` (gp-reviewer R3).
- BL-193 … BL-195 (P3) stay open.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- PostgreSQL 17 row security and constraint order, observed on the local 17.6 stack, not read (DEV-076). A privilege refusal answers before any trigger; a BEFORE trigger answers before the policy; the policy answers before CHECK, unique and foreign-key checks.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: `gp-architect`, `gp-security` and `gp-reviewer` ran as independent native subagents; `gp-qa` is pending.
- Verified scope: rows 1–11.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-qa`.
- Final state and reason: implementing.
