# DEV-052 — BL-138: a grant's revoke is written once

## Assignment

- **Objective and user-visible outcome:** no behaviour a user sees changes. `project_access_grants` accepts only its revoke — `revoked_at` from null to the transaction's `now()`, `version` unchanged or up by one — and a revoked grant never changes again; no grant is deleted. The guard fires for every role, superusers included, so a product defect or a support session can no longer un-revoke, re-date, rewrite or delete a grant. Fixtures that stage lapsed, re-granted or removed grants go through replica mode.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a trigger in a migration on an access table: `gp-architect` → owner ruling → failing test → migration, fixtures and catalogs → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (a migration on `project_access_grants`); `gp-security` (a guard on the grant table every capability check rests on; BL-138 depends on it). `gp-ui-reviewer`, `gp-mobile`, `gp-researcher`: not triggered (no UI, no field client; PostgreSQL trigger behaviour is exercised by the local stack, PostgreSQL 17.6).
- **Owning module and allowed edit paths:** `supabase/migrations/0099_the_revoke_that_could_be_undone.sql` (new); `packages/testing/src/pg.ts` (`bypassingGuards`); `packages/testing/src/workspace-access-rls.test.ts`, `m2-rls`, `m2-policy-gaps`, `m1-rules-rls`, `m3-closure-rls`, `m2-occurrences-rls`, `m2-binding-hardening`; `apps/app/tests/helpers/fixtures.ts` (`qBypassingGuards`); `apps/app/tests/idempotency-authorization`, `telegram-evidence`, `project-communications`, `project-access-grant` (`.int.test.ts`); `technical/database/invariant-catalog.csv` (INV-113, INV-111); `technical/database/entity-catalog.csv` (the grant row); the revoke-only fixture statements in `packages/testing/src` and `apps/app/tests` (`and revoked_at is null`, R1-05); `technical/data-access-surface.csv` (DA-195, DA-201); `technical/database/rls-coverage.csv`; ADR-014 and its index row; `docs/architecture/tenancy-and-security.md`; `docs/STATUS.md` (the migration marker); `docs/BACKLOG.md` (BL-138); this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`; `supabase/migrations/0010`, `0011`, `0096`, `0097`; `0049`'s and `0059`'s guards; ADR-014 decision 4 and «What this decision does NOT authorise».
- **Linked spec, ADR or earlier task:** BL-138, filed by [DEV-043](DEV-043-project-access-revoke.md); ADR-014 decision 6 (amendment of 2026-09-24); cluster DEV-047 to DEV-054.
- **Baseline:** `8db97a77` (DEV-054, after DEV-051's `b73b290b`); local database at `0098` before this task.
- **Dependencies / constraints / out of scope:** `0099` is applied to the local database by hand as `postgres` and recorded; the hosted project is the owner's. The suites that call `resetDb` (`rls`, `m1-rls-baseline`, `m1-rls-workspace`, `m1-schema`) only insert grants and are not run locally. Insert paths are unchanged: a superuser can still insert a grant outside the product.
- **Required acceptance criteria:**
  1. `packages/testing/src/workspace-access-rls.test.ts` gains «project_access_grants: revoked_at is written once (DEV-052, BL-138)»: the application role's un-revoke and re-dated revoke are refused with P0001 naming INV-113, as are a backdated revoke, a version-only update and a version skip; the owner of B declaring A and a view-only member reach no row; a revoke without a version bump is accepted; a superuser's un-revoke, each column rewrite and DELETE are refused; replica mode deletes; the trigger is a BEFORE UPDATE OR DELETE row trigger with default enablement on an invoker function with the empty search path that no application role executes. Red at `0098` (4 failed), green at `0099`.
  2. `0099` applies by hand on a database at `0098` and its assertion block passes.
  3. Every suite with a reworked fixture passes, and the suites whose fixtures only revoke still pass: in `packages/testing` `workspace-access-rls`, `m2-rls`, `m2-policy-gaps`, `m1-rules-rls`, `m3-closure-rls`, `m2-occurrences-rls`, `m2-binding-hardening`; in `apps/app` `project-access-grant`, `project-access-revoke`, `project-access-dates`, `idempotency-authorization`, `telegram-evidence`, `project-communications`, `telegram-delivery`, `upload-intents-create`, `upload-intents-get`, `upload-intents-finalize`, `evidence-purge`, `vertical-m2a`, `m6-blocked-value`. Run one at a time, none skipped.
  4. INV-113, DA-201, DA-195, the rls-coverage row, ADR-014 decision 6, the tenancy paragraph and the STATUS marker agree; `pnpm validate:canonical-docs` passes; `tsc` for `apps/app` and `packages/testing` passes.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | BL-138 joins the cluster | chat, answer «BL-141 + BL-143, BL-138 write-once, …» (DEV-047's record) |
| 2026-09-24 | Build the trigger now, with `version` unchanged or up by one | chat, answer «Делать, version +0/+1 (Рекоменд.)» |
| 2026-09-24 | Which database runs: the coordinator chooses the necessary suites, one by one; truncating tenant tables is allowed; never a reset | the session's standing brief (DEV-047's record) |

## Plan

1. Failing test in `workspace-access-rls.test.ts`.
2. `0099`: the guard and its assertion block; applied locally, version recorded.
3. `bypassingGuards` / `qBypassingGuards`; the 20 fixture statements that un-revoke, re-date or delete go through them.
4. Catalogs, ADR amendment, STATUS marker.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | Guard design (invoker, empty path, default enablement, jsonb comparison without the two writable keys, `revoked_at = now()`, version +0/+1); 19 statements in 10 files break, 21 revoke-only statements do not; no suite that must run calls `resetDb`; an ADR-014 amendment since «does NOT authorise» names the trigger | architect report, 2026-09-24 | owner |
| 2 | owner | «Делать, version +0/+1» | chat, 2026-09-24 | failing test |
| 3 | coordinator | Red at `0098`: 4 failed, 21 passed | `scratchpad/dev051-red.txt` | migration |
| 4 | coordinator | `0099` applied locally as `postgres` in one transaction, assertion block passed, version `0099` recorded | the psql transcript, 2026-09-24 | green |
| 5 | coordinator | First green run: 1 failure was the test's own — `member_id = member_id` with a revoke changes nothing and is a valid revoke; the cases now change a value each. 25 passed | `scratchpad/dev051-green.txt` | fixtures |
| 6 | coordinator | Fixtures: 15 statements in `packages/testing` and 5 in `apps/app` (the DEV-051 lapse case included; the architect counted 19 before it) go through replica mode. All 20 suites of criterion 3 passed, one at a time. `evidence-purge` and `vertical-m2a` first failed on an unset `PURGE_DB_URL` and passed with the local purge login; `telegram-evidence` and `project-communications` ran with `TEST_DB_ADMIN_URL` set to the local stack | `scratchpad/dev051-suites.txt` | catalogs, review |
| 7 | coordinator | `rls-coverage.test.ts` 22 passed (it reads the catalog and never resets); `tsc --noEmit` for `apps/app` and `packages/testing` exit 0; `validate:canonical-docs` OK | `scratchpad/dev051-suites.txt` | gp-reviewer, gp-security |
| 8 | gp-reviewer | R1 PASS: R1-01..R1-03 minor, R1-04 nit, R1-05 low (all wording, catalogs or fixture hardening) | reviewer report, 2026-09-24, on `scratchpad/dev051-r1.diff` | fixes |
| 9 | gp-security | S1 PASS: S1-01 low (nothing pins the bypass), S1-02 low (the «every role» wording); records S1-R1..R3 | security report, 2026-09-24, same diff | fixes |
| 10 | coordinator | Stated fixes applied; the 22 suites of criterion 3 plus `rls-coverage` and `responsibility-end` passed one at a time (workspace-access-rls now 26); `tsc` exit 0; `validate:canonical-docs` OK | `scratchpad/dev051-suites-r2.txt` | gp-qa |
| 11 | gp-qa | PASS on criteria 1–4 (21 suites one at a time, none skipped; the applied body's md5 equals the file's; 0099's DO block re-run in a rolled-back transaction); QA-01 low: the S1-01 case's SET check missed the supautils path (`supabase_privileged_role`) | QA report, 2026-09-24, on `scratchpad/dev051-r2.diff` | QA-01 |
| 12 | coordinator | QA-01 fixed: the check also counts membership of `supabase_privileged_role`, and `postgres` is the positive control (flagged as owner and as able to set it); workspace-access-rls 26 passed | `scratchpad/dev051-suites-r3.txt` | gp-qa re-verifies QA-01 |
| 13 | gp-qa | QA-01 re-verified: the fix matches its statement, the control passes only through the new membership check, workspace-access-rls 26 passed | QA report, 2026-09-24 | commit |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | minor | INV-111 «Not covered» | dropped the case of a `project.view` revoked on its own outside the product | coordinator | fixed: restored in INV-111 |
| R1-02 / S1-02 | minor / low | INV-113, DA-201, DA-195, the tenancy paragraph, ADR-014 decision 6, the `0099` header | «every role» overstated: the owner can TRUNCATE (`0058`, `truncateAll`) or `DISABLE TRIGGER` (`dropM2Workspaces`) | coordinator | fixed: scoped to row-level UPDATE and DELETE, the owner's three bypasses named everywhere; `0099`'s header gains «What this does not change» (comment only; the applied body is unchanged) |
| R1-03 | minor | `entity-catalog.csv` grant row | the row stopped at `0096` | coordinator | fixed: purpose text names `0099`; lifecycle left `draft_mutable` (inserts and the revoke still write it); path added to the allowed paths |
| R1-04 | nit | tenancy paragraph | «or delete one» read as allowing deletion | coordinator | fixed |
| R1-05 | low | 22 revoke-only fixture statements | a statement matching an already-revoked row now raises INV-113 far from its cause | coordinator | fixed: `and revoked_at is null` appended to each; the two negative cases in the DEV-052 block are left as they are on purpose |
| S1-01 | low | the DEV-052 block | nothing asserted that no product role can set `session_replication_role` or acts as the table's owner | coordinator | fixed: new case over every `goproceed*` role, `service_role`, `authenticated`, `anon` |
| QA-01 | low | the S1-01 case | `has_parameter_privilege` does not see supautils' grant of replica mode to `supabase_privileged_role` members | coordinator | fixed: the membership counted; `postgres` as the positive control |
| S1-R1 | record | `service_role`'s default TRIGGER and REFERENCES grants | a later BEFORE trigger sorting after the guard could rewrite NEW; unreachable today, and the test's one-trigger assertion would catch it | coordinator | recorded in «What is not true» |
| S1-R2 | record | erasure | grant rows are frozen; an erasure design must amend the guard | coordinator | recorded in «What is not true» |
| S1-R3 | record | hosted | `0099` not pushed (hosted at `0097`; `0098` first); whether hosted `postgres` may set replica mode is unchecked | coordinator | recorded in «What is not true»; the push is the owner's |

Rework count and hypothesis changes: none (first review; fixes limited to the stated ones).

## What is not true after this task

- A superuser can still insert a grant outside the product, including one that leaves an action capability without a covering view (INV-111's «Not covered»).
- `0099` is applied to the local database only; the hosted project needs the owner's push.
- The suites that call `resetDb` are not run locally; they insert grants only.
- The table owner can still bypass the guard: replica mode, `DISABLE TRIGGER`, `TRUNCATE` (INV-113 «Not covered»).
- `service_role` keeps Supabase's default TRIGGER and REFERENCES on the table (S1-R1).
- Grant rows are frozen; a future erasure or pseudonymisation of `member_id`/`granted_by` needs a migration that amends the guard (S1-R2).
- On the hosted project, whether the `postgres` role may set `session_replication_role` is unchecked; an operator procedure that rewrites grants would need it or `DISABLE TRIGGER` (S1-R3).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | `8db97a77` + the working tree (`dev051-r2.diff`, then QA-01) | `npx vitest run src/workspace-access-rls.test.ts` in `packages/testing`: 26 passed; red at `0098` 4 failed, 21 passed | PASS (`gp-qa`'s runs) | the local `postgres` is the table owner and a `supabase_privileged_role` member, not a superuser; that the trigger fires for superusers is PostgreSQL's documented behaviour |
| 2 | yes | same | `0099` recorded; the applied function body equals the file's (md5); the DO block re-run in a rolled-back transaction | PASS (`gp-qa`) | applied once, by the coordinator, on a database at `0098` |
| 3 | yes | same | 21 suites one at a time, none skipped (counts in `scratchpad/dev051-suites-r2.txt` and QA's `qa051-*.txt`) | PASS (`gp-qa`'s runs) | the `resetDb` suites are NOT RUN (they only insert grants); CI blocked |
| 4 | yes | same | catalogs, ADR-014 decision 6, tenancy paragraph and STATUS agree; `validate:canonical-docs` OK; `tsc` for `apps/app` and `packages/testing` exit 0 | PASS (`gp-qa`) | — |

## Sources

- PostgreSQL 17 documentation, «ALTER TABLE» (`ENABLE TRIGGER`) and «session_replication_role»: a trigger with the default enablement fires when the role is `origin` or `local`, not `replica`, https://www.postgresql.org/docs/17/sql-altertable.html. Observed on the local stack (PostgreSQL 17.6): replica mode deletes past the guard, and 0096's column-privilege refusals keep SQLSTATE 42501 with the trigger in place (the DEV-043 case still passes).

## Completion / handoff

- Changed / inspected files: `0099`, the two bypass helpers, the DEV-052 test block, 20 un-revoke/re-date/delete fixture statements and 22 revoke-only statements across `packages/testing` and `apps/app/tests`, INV-111, INV-113, DA-195, DA-201, the rls-coverage and entity-catalog rows, ADR-014 decision 6, the tenancy paragraph, STATUS, BL-138, this record and the task index.
- Review independence: `gp-architect`, `gp-reviewer`, `gp-security` and `gp-qa` ran as independent native subagents.
- Verified scope: criteria 1–4.
- Remaining risks / blocked requirements: «What is not true after this task»; the hosted push of `0098` and `0099`.
- Next bounded action and owner: the cluster's final run (DEV-053); pushing `0098`–`0099` to the hosted project, and merging, are the owner's.
- Final state and reason: verifying until the cluster's final run.
