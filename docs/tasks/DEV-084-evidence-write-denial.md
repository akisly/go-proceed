# DEV-084 — BL-170: the cross-workspace write minimum for the evidence rows

## Assignment

- Objective and user-visible outcome:
  - No user-visible change.
  - The 3 `evidence` rows of `technical/database/rls-write-coverage.csv` become `covered`. Each cites a test in `packages/testing/src/evidence-write-rls.test.ts` showing that a principal of one workspace cannot insert into another, in the shape the DEV-076 minimum sets. The three rows are the device capture event (`goproceed_app`), the server capture event (`goproceed_service`) and the upload intent (`goproceed_app`).
  - Migration `0108` does two things:
    - it binds `capture_events.work_assignment_id` to its workspace's assignment through a composite foreign key (BL-105);
    - it narrows both tables' INSERT grants to the columns their writers write.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-25.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): the change touches executed code under `packages/testing`, a migration that adds a constraint and narrows grants, catalogs the validator reads, and `technical/data-access-surface.csv`. The route is `gp-architect` → owner decisions → implementation → mutations → `gp-reviewer` + `gp-security` → `gp-qa`.
- Triggered stages:
  - `gp-architect`: a migration, a constraint, grants and RLS.
  - `gp-security`: grants and RLS, and evidence uploads.
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered.
- Owning module and allowed edit paths:
  - `supabase/migrations/0108_the_capture_event_bound_to_its_assignment.sql` (new);
  - `packages/testing/src/evidence-write-rls.test.ts` (new);
  - `technical/database/rls-write-coverage.csv`;
  - `technical/data-access-surface.csv`: DA-113, DA-114, DA-182 and DA-183;
  - `technical/database/invariant-catalog.csv` (INV-001, INV-060);
  - `technical/database/relationship-catalog.csv` (the capture event's assignment; the intent's occurrence key);
  - `scripts/validate-canonical-docs.mjs` (`RLS_WRITE_GAP_BASELINE` only);
  - `docs/BACKLOG.md` (BL-105, BL-170; BL-196 new), `docs/STATUS.md` (migrations row), this record, and `docs/tasks/README.md`.
- Read context:
  - [DEV-076](DEV-076-write-denial-minimum.md) … [DEV-083](DEV-083-statutory-write-denial.md);
  - `packages/testing/src/evidence-service-rls.test.ts`, `m2-policy-gaps.test.ts`, `m2-binding-hardening.test.ts`;
  - `supabase/migrations/0015_*`, `0016_*`, `0018_*`, `0031_*`, `0035_*`, `0087_*`;
  - `apps/app/src/lib/evidence/authorize-upload-intent.ts`, `finalize-upload-intent.ts`.
- Linked spec, ADR or earlier task: BL-170; BL-105; BL-099; INV-001; INV-060.
- Baseline: `origin/main` `a1429a4a` (after #163).
- Dependencies / constraints / out of scope:
  - The other rows (BL-171 … BL-173) are out of scope.
  - The service keeps its actor, so the inherited `ce_insert` admits a device event in any workspace that actor is entitled to while another is declared. This is BL-101, named in the test's header and not asserted as a denial.
  - Pushing `0103` … `0108` to `goproceed-staging` needs the owner's separate word.
  - The local database is this session's own disposable stack, started in the container. It holds no owner data, and no suite that resets it was run.
- Required acceptance criteria:
  - AC-1: each of the 3 rows cites one test meeting the minimum for its INSERT, with its control succeeding, on both planes where the row has one.
  - AC-2: each of these mutations fails a test, except where the mutant cannot be observed across workspaces, which is stated:
    - `WITH CHECK (true)` on every INSERT policy;
    - each conjunct of `ce_insert`, `ce_insert_server` and `app.upload_intent_scope_matches` dropped;
    - the capability inverted, and the project scope dropped.
  - AC-3: `0108` adds the foreign key and narrows the grants. The write registry, the baseline, the DA rows, INV-001 and INV-060 agree with the database, and the database comparison in `rls-coverage.test.ts` passes.
  - AC-4: the validator and `typecheck` pass.
  - AC-5: CI green on the pull request.
- Skipped stages and rationale: see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | BL-105: add the composite foreign key on `capture_events` in `0108`, folding BL-105 into this stage | Owner's answer in the session («Add the FK in 0108») |
| 2026-09-25 | Narrow both evidence INSERT grants to the columns production writes, in `0108` | Owner's answer in the session («Narrow in 0108») |
| 2026-09-25 | `ce_insert`'s intent-less device arm: keep it and test it | Owner's answer in the session («Keep, test it») |
| 2026-09-24 | The DEV-076 rulings apply; P1 | [DEV-076](DEV-076-write-denial-minimum.md) |

## Plan

1. `gp-architect`: a plan per row and plane.
2. `0108`, applied to the local database.
3. The test file. Every INSERT policy and the scope definer are mutated clause by clause.
4. The catalogs, the baseline, the docs and the record.
5. `gp-reviewer` + `gp-security`, then `gp-qa`; CI on the pull request.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | Dumped the 2 tables' policies, triggers, grants, column grants and constraints (in OID order) from the local stack at `0107` | `scratchpad/dev084-policies.txt` | gp-architect |
| 2 | gp-architect | The plan:<br>• every conjunct of the three policies and the definer;<br>• the policy reads the project and the intent, so a foreign project or intent is refused by the policy, not by a key;<br>• no INSERT trigger on either table;<br>• `capture_events.work_assignment_id` bound by nothing (BL-105), so the two capture-event rows could not be `covered`;<br>• the INSERT grants include columns no writer writes: `id` and `reported_at` on capture events, and twelve state and purge columns on intents;<br>• the harness on the real logins, so the definer's `session_user` check is live;<br>• DA-113, DA-114, DA-182 and DA-183 drifted; the relationship catalog's occurrence key was short;<br>• Q4, an intent may name another member as its creator | Subagent report (session) | Owner |
| 3 | Coordinator | Owner decisions recorded. `0108` written; its preflight found no violating row locally; applied by hand as `postgres`, then recorded in `schema_migrations`. The write registry now reads `INSERT(<11 columns>)` for both capture-event rows and `INSERT(<22 columns>)` for intents | Session output | Tests |
| 4 | Coordinator | The test file: 3 cases, run on `goproceed_app_login` and `goproceed_service_login` under `SET LOCAL ROLE`, each statement in a savepoint of a rolled-back transaction. No capture event is committed. `beforeAll` asserts no INSERT trigger and no RETURNING in a probed statement. Local run: 3 of 3. The neighbouring suites also pass against `0108`:<br>• `evidence-service-rls` 2;<br>• `m2-policy-gaps` 4;<br>• `m2-binding-hardening` 36;<br>• `m2-service-principal` 11;<br>• `privileges` 3;<br>• `rls-coverage` 31;<br>• `m5-external-rls` 10. | Session output | Mutations |
| 5 | Coordinator | 23 mutations, each applied to one policy or to the definer's body and restored from its stored text. The md5 of the policies and of the function was identical before and after.<br>• **First sweep: 14 of 23.** It found a missing probe: a device event with no intent is bound to its project by the capabilities alone. Replacing both with «an active member» survived, because the intent conjunct refused the mixed-project probe. A probe with B's project and no intent was added.<br>• **Second sweep: 15 of 23.** The definer's own declared-workspace check was then pinned by calling it directly: true for A's triple and false for B's while declaring A, and refused to the member role.<br>• **Final: 16 of 23.** The survivors cannot be observed across workspaces:<br>&nbsp;&nbsp;– `ce_insert` without `project.view`, or without `evidence.record`: the other capability on the same project still refuses;<br>&nbsp;&nbsp;– without the EXISTS's `u.workspace_id`: the EXISTS reads under the actor's `ui_select`, and B's intent is not there;<br>&nbsp;&nbsp;– without `u.project_id`: the capabilities on the row's project answer first;<br>&nbsp;&nbsp;– without `u.created_by_member_id`: needs a second member of A;<br>&nbsp;&nbsp;– `ce_insert_server` without its declared workspace: the definer repeats it;<br>&nbsp;&nbsp;– the definer without its `session_user` check: every session here is the service's, as in production | `scratchpad/dev084-mutate.out`, `-2.out`, `-3.out` | Catalogs |
| 6 | Coordinator | Catalogs and docs:<br>• the write registry: 3 rows `covered`, with column-grant privileges;<br>• the 3 keys removed from the baseline;<br>• DA-113 corrected (it read `UPDATE`; `0031` withdrew it); DA-114 marked superseded (no worker grant exists); DA-182 and DA-183 completed;<br>• INV-001 and INV-060 cite the file;<br>• the relationship catalog gains the capture event's assignment, and the intent's occurrence key is its full four columns;<br>• the `STATUS.md` migrations marker is `0108`;<br>• BL-170 and BL-105 scheduled; BL-196 (P3, the intent's creator) filed.<br>The validator and `typecheck` pass | `git diff` | Reviews |
| 7 | gp-security | PASS, no blocker or major.<br>• `0108` breaks no path: authorize writes exactly the 22 intent columns and 10 of the 11 event columns; finalize's three server events stay within the 11; the Telegram path shares both; no definer inserts into either table; the external plane only reads.<br>• The new key cannot reject a production row: the event's workspace, project and assignment are copied from the intent, which the same key already binds.<br>• After `0108` no role holds a privilege without a policy, or a policy without a privilege.<br>• The scope definer is an acceptable, bounded existence check.<br>• The tests prove confinement on the real logins.<br>Findings S1–S6 (below) | Subagent report (session) | Fixes |
| 8 | Coordinator | Fixes: S1 filed as BL-197, with `0108`'s comment and DA-113 qualified; S2, the afterAll count now runs before the drop; S3 recorded in BL-101; S6, `0108` sets `lock_timeout = '5s'` for the hosted apply (after `0095`). 3 of 3 pass; the validator passes | Session output | gp-reviewer |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1 | low | `upload_intents`' kept columns, pre-existing | A negative quota reservation, or a foreign bucket and key for the purge to delete, inside one workspace | Owner | Deferred to BL-197 (P3); `0108`'s comment and DA-113 qualified |
| S2 | low | The file's afterAll | The count ran after the drop and could never fail | Coordinator | Fixed |
| S3 | info | BL-101's scope | The inherited `ui_insert` belongs in it | Coordinator | Fixed: recorded in BL-101 |
| S4 | info | `failure_code`'s grant | Only the service writes it; the member plane holds it through the shared grant | Owner | No change: the service's INSERT is inherited (BL-019); narrowing it means a service-only grant, the owner's call |
| S5 | info | `app.upload_intent_scope_matches` | A bounded existence check | — | No action |
| S6 | info | `0108`'s hosted apply | No lock timeout | Coordinator | Fixed: `set local lock_timeout = '5s'` |

Rework count and hypothesis changes: none.

## What is not true after this task

- `0103` … `0108` are on the local database only, not on `goproceed-staging`. The owner decides the push. The foreign key's preflight will read the hosted rows when `0108` is pushed.
- `capture_events.project_id` still has no foreign key; the policies bind it (through the capability, and through the intent when one is named).
- BL-101 (the service's inherited device-event path) is unchanged.
- The other write rows (BL-171 … BL-173) are still gaps.
- A rollback of `0108` owes the registry, the DA rows and the test's column and assignment probes too; the gap baseline no longer carries these rows.
- BL-196 (P3) stays open.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- PostgreSQL 17 row security and constraint order, observed on the local 17.6 stack, not read (DEV-076). A privilege refusal answers before any trigger or policy; the policy answers before CHECK, unique and foreign-key checks.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: `gp-architect` ran as an independent native subagent; `gp-reviewer`, `gp-security` and `gp-qa` are pending.
- Verified scope: rows 1–8.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-reviewer` and `gp-security`.
- Final state and reason: implementing.
