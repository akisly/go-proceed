# DEV-071 — BL-157: the hosted database ACL is compared, not assumed

## Assignment

- **Objective and user-visible outcome:** no behaviour a user sees changes. INV-116's catalog checks (DEV-060's T1, T2, T3, T6, T8) live in one read-only SQL file, `technical/database/checks/inv-116-temporary-privilege.sql`. Three things run it: `temporary-privilege.test.ts`, with a negative control per check; `pnpm db:catalog-snapshot`, which records the database ACL and the TEMP holders and exits 1 on a violation; and a new step, `infra/README-staging.md` §2.3, run through the Supabase connector after every hosted push or restore. The database ACL that `0102` set, which no migration re-checks, is then compared on the hosted project instead of assumed.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** executed code under `scripts/` and `packages/testing`, a catalog file read by tests, and a check of grants and database roles on a hosted project: `gp-architect` → owner decisions → failing test → implementation → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (how grants and database roles on a hosted project are checked); `gp-security` (grants, database roles; the runbook describes a hosted remedy that changes a grant and passing a hosted URL to a script); `gp-reviewer` (always); `gp-qa` (always). `gp-ui-reviewer`, `gp-mobile`: not triggered. `gp-researcher`: not needed — the Supabase and PostgreSQL documentation read directly (Sources).
- **Owning module and allowed edit paths:** `technical/database/checks/inv-116-temporary-privilege.sql` (new); `packages/testing/src/temporary-privilege.test.ts`; `scripts/snapshot-db-catalog.mjs`; `infra/README-staging.md` (§2.3); `technical/database/invariant-catalog.csv` (INV-116); `technical/data-access-surface.csv` (DA-202); `docs/architecture/tenancy-and-security.md` (control 8, rule 8, risk 4); `docs/architecture/data-model.md` (risk 4); `docs/delivery/pilot-execution-runbook.md`; `docs/BACKLOG.md` (BL-157, BL-161, BL-162); this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`; [DEV-060](DEV-060-no-product-temporary-schema.md) (its checks, the hosted preflight and postflight, findings R1-04, S1-02, S1-04).
- **Linked spec, ADR or earlier task:** BL-157, filed by DEV-060. No ADR: detection only (`gp-architect`).
- **Baseline:** `3ded684a` (main, #139 merged); local database at `0102`; `goproceed-staging` at `0102`.
- **Dependencies / constraints / out of scope:** no migration, grant or contract changes. A runtime self-check in the product, event triggers (they do not fire for shared objects), a re-asserting migration and a `pg_cron` check are rejected (architect; owner). A restore procedure is BL-161. A full snapshot of a hosted project needs the hosted `postgres` password and is not taken.
- **Required acceptance criteria:**
  1. The shared file returns 0 rows on the local database at `0102`; `temporary-privilege.test.ts` reads T1, T2, T3, T6 and T8 from it (red while the file is absent, green after), and a rolled-back negative control per check shows it returns rows for its own violation; a mutation of one clause turns its control red.
  2. `pnpm db:catalog-snapshot` writes `database_acl`, `temp_privilege` and `inv116_violations`, exits 0 on the local database, and exits 1 with the violations on stderr on a database that breaks INV-116; it never prints the URL.
  3. `infra/README-staging.md` §2.3 says when and how to compare, what to do with each check's rows, and records the first hosted run; that run on `goproceed-staging` returns 0 rows.
  4. INV-116, DA-202, the architecture and runbook docs, BL-157 and BL-161 are updated; `pnpm validate:canonical-docs` and `tsc` for `packages/testing` pass.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | BL-157 next | chat, «#134 влил, займись BL-157» |
| 2026-09-24 | The architect's approach: one shared SQL file for the test, the snapshot and a runbook step; no runtime self-check, no event triggers | chat, answer «Да, как предложено (Рекоменд.)» |
| 2026-09-24 | The coordinator may run the read-only check on `goproceed-staging` through the connector at any time — now and after every push or restore; hosted remedies still need the owner's word | chat, answer «Да, read-only всегда (Рекоменд.)» |
| 2026-09-24 | Hosted catalog snapshots are not committed; only the INV-116 result is recorded | chat, answer «Нет, только результат INV-116 (Рекоменд.)» |
| 2026-09-24 | File a backlog item for a restore/DR procedure | chat, answer «Да, завести (Рекоменд.)» → BL-161 |
| 2026-09-24 | (coordinator) BL-159 and BL-160 are held by DEV-061's unmerged branch `claude/field-decisions`, which the owner already cites; this task's items renumbered BL-161 (restore procedure) and BL-162 (`adminClient()` guard). The backlog validator needs BL-159 and BL-160 on main first | `git show origin/claude/field-decisions:docs/BACKLOG.md` |

## Plan

1. Facts: how Supabase backs up and restores; the plan of `goproceed-staging`'s organization. `gp-architect`.
2. Owner decisions.
3. Failing test: the suite reads the shared file before it exists.
4. The shared file; the snapshot's sections and exit code; the runbook step; the first hosted run.
5. Catalogs, docs, backlog.
6. Stages; commit.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | coordinator | `goproceed-staging`: PostgreSQL 17.6.1.155, organization «Lighthold Labs» on the **free** plan — no daily backups, no PITR, no «Restore to a new project»; the realistic restore is logical, which drops the database ACL. Physical backups and PITR (paid plans, Postgres ≥ 15.8.1.079) would keep it | connector `get_project`, `get_organization`; Supabase docs (Sources) | design |
| 2 | gp-architect | One read-only SQL file as the single source of INV-116's catalog checks, run by the test, by the snapshot (exit 1) and by a runbook step through the connector; reject a runtime self-check (fail-closed is disproportionate, log-only is unread), event triggers (no event for shared objects), a re-asserting migration and a `pg_cron` check; `pg_shdepend` (DEV-060 R1-04) is documentation; control 8 → Partial after the first hosted run; no ADR | architect report, 2026-09-24 | owner |
| 3 | owner | Decisions above | chat | test |
| 4 | coordinator | Red: the suite reads the file before it exists — «Error: ENOENT: no such file or directory, open '…/technical/database/checks/inv-116-temporary-privilege.sql'», «Test Files 1 failed (1)», «Tests 24 skipped (24)» (vitest 5 skips the cases when `beforeAll` fails) | `scratchpad/dev071-red.txt` | file |
| 5 | coordinator | The file; first green run: 22 passed, 2 failed on the test's own expectations — N-T8's `regprocedure` printed `dev071_temp()` without its schema (the file now prints `schema.name(args)`), and N-T6 found four holders, not one: `authenticated` and the three TEMP holders that can become it (`authenticator`, `supabase_realtime_admin`, `supabase_storage_admin`) — correct, the expectation widened. Then «Tests 24 passed (24)»; `tsc` exit 0 | `scratchpad/dev071-green.txt` | mutation |
| 6 | coordinator | Mutation: T1's predicate made `false` → «× N-T1 … Tests 1 failed \| 23 passed (24)»; file restored (`cmp` equal) | `scratchpad/dev071-mutation.txt` | snapshot |
| 7 | coordinator | Snapshot on the local database: exit 0, `## database_acl (22)` (PUBLIC `CONNECT` only), `## temp_privilege (23)`, `## inv116_violations (0)`. On the local `_supabase` database (default ACL; roles are cluster-wide): «INV-116 T1 PUBLIC: the database ACL is the default, which grants PUBLIC TEMPORARY», twelve T2 lines, exit 1 — no write to any database. Both snapshot files deleted, not committed | `scratchpad/dev071-snapshot.txt`, `dev071-snapshot-neg.txt` | hosted |
| 8 | coordinator | The file (sha256 `bb4bb04a…42b4`) run verbatim through the connector on `goproceed-staging` at 16:13 UTC as `postgres`, head `0102`: **0 rows** | connector `execute_sql`, 2026-09-24 | docs |
| 9 | gp-reviewer | R1 PASS WITH FINDINGS: R1-01..R1-03 minor (T2 remedies too coarse; no control for «product role missing» or the default-ACL arm; a hosted snapshot lands in the tracked directory), R1-04..R1-06 nit | review, 2026-09-24, on `scratchpad/dev071-r1.diff` | fixes |
| 10 | gp-security | S1 PASS WITH FINDINGS: S1-01, S1-02 medium (the hosted password on a command line or with an agent; no TLS verification), S1-03..S1-06 low (hosted snapshot not kept out of git; untyped literals open to operator shadowing; the «missing» arm untested and an empty file passes; remedy routing), S1-07, S1-08 info | security review, same diff | fixes |
| 11 | coordinator | Fixes (table below). The file's literals typed and its patterns `E''`: 0 rows locally with `standard_conforming_strings` on and off, no warning. Shadow evidence: with `public.~~(name,text)`, `public.~~(name,name)` and `public.=(oid,int4)` planted and PUBLIC given TEMP, round 1's file returned 197 rows and **no T1** (the shadows hid it and every product T2 row); round 2 returned 210 with T1 | `scratchpad/dev071-shadow.txt` | tests |
| 12 | coordinator | Suite: 28 passed (a whole-file-empty case, N-T1b, N-T2b, N-shadow added); `tsc` exit 0. Snapshot: local exit 0 «INV-116 on 127.0.0.1: 0 violation(s)»; `_supabase` exit 1 with 13 violations printed first; a remote URL without TLS and one with `sslmode=require` both refused, exit 2; the password in the test URLs appears nowhere in the output. Local snapshot files deleted | `scratchpad/dev071-r2-green.txt`, `dev071-r2-snapshot.txt` | hosted |
| 13 | coordinator | Round 2's file (sha256 `bbcbbb24…a629a`) run verbatim through the connector on `goproceed-staging` at 16:26 UTC as `postgres`, `search_path` `"$user", public, extensions`, head `0102`: **0 rows**; §2.3 Status has both runs with full hashes | connector `execute_sql` | re-review |
| 14 | gp-security | r2 re-check PASS on S1-01..S1-08; S2-01 low (a predictable shared temporary directory, default modes), S2-02..S2-04 info | re-check, 2026-09-24, on `scratchpad/dev071-r2.diff` | fixes |
| 15 | coordinator | S2-01: a hosted snapshot goes to `mkdtemp` and is written `0600`; S2-02: the TLS gate also refuses a `checkServerIdentity` override (a libpq-compat URL with a second `sslmode=require` now exits 2); S2-03: §2.3 forbids a port-forward to a hosted project; S2-04 recorded. Local snapshot exit 0 | `scratchpad/dev071-r3-snapshot.txt` | gp-reviewer r2 |
| 16 | gp-reviewer | r2 PASS WITH FINDINGS: R1-02..R1-06 PASS; R1-01 residual minor (a T2 row «via» another product role was routed to a membership revoke, though logins reach their roles by design; a superuser was routed to `0102`); R2-01 nit (a failed `cron.job` query would abort the read-only transaction), R2-02 nit (no run showed a compliant URL passing the TLS gate) | review, 2026-09-24, on `scratchpad/dev071-r2.diff` | fixes |
| 17 | coordinator | R1-01: §2.3 reads rows in order — «missing» stop; T1 first (its T2 rows clear with it); «via» a `goproceed_*` role → re-apply `0102`; «via» a non-product role → revoke the membership; a superuser → platform or owner action, not `0102`. R2-01: `cron.job` checked with `to_regclass` first, not caught (local snapshot exit 0, `## cron_jobs (3)`). R2-02: a compliant `verify-full` + `sslrootcert` URL to an unresolvable host passes the gate and fails at connect («getaddrinfo ENOTFOUND nonexistent.invalid», exit 1, not 2), and the output names neither the URL nor the CA path. §2.3 notes the free plan's IPv6-only direct host and the session pooler | `scratchpad/dev071-r4-snapshot.txt` | gp-qa |
| 18 | gp-qa | PASS on criteria 1–4, every stated fix in place: the file 0 rows as `postgres`, as `anon` and with `standard_conforming_strings` off; suite «Tests 28 passed (28)»; T3 mutation «× N-T3 … Tests 1 failed \| 27 passed (28)», restored (`cmp` equal); snapshot exit 0 locally, exit 1 on `_supabase` with violations first, exit 2 for no TLS, `require`, `verify-full` without a CA, the libpq-compat URL and a `?host=` override; a compliant URL fails at connect; a fake password echoed nowhere; the hosted write branch (proxy copy) wrote `drwx------`/`-rw-------` under `$TMPDIR`; the round-2 hash matches §2.3; `tsc`, `validate:canonical-docs`, `validate:agents` OK. Q-01 nit (`::1` never matches: pg reports `[::1]`), Q-02 nit (Completion said criteria 1–3) | QA report, 2026-09-24, on `scratchpad/dev071-r3.diff` | commit |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1-01 | medium | §2.3 | the hosted password inline on a command line (history, `ps`) or in an agent's transcript | coordinator | fixed: the snapshot and the re-apply are the owner's, in their own terminal; the password from `~/.pgpass` or `read -rs PGPASSWORD`, never in the URL; agents use the connector only |
| S1-02 | medium | §2.3; the script | no TLS verification | coordinator | fixed: `sslmode=verify-full&sslrootcert=<CA file>` in §2.3 (Supabase «SSL Enforcement»); the script refuses a non-local host without both (checked: exit 2 for none and for `require`) |
| S1-03 / R1-03 | low / minor | the script | a hosted snapshot written into the tracked directory; same-minute runs overwrote each other | coordinator | fixed: a non-local host writes to the OS temporary directory; the stamp has seconds |
| S1-04 | low | the check file | untyped literals let an operator in `public` for (name,name) or (oid,int4) empty a check; T8's pattern depended on `standard_conforming_strings` | coordinator | fixed: every literal typed, `E''` patterns; N-shadow control; round 1 vs round 2 evidence (row 11); the script runs `set local search_path = pg_catalog` in a read-only transaction |
| S1-05 / R1-02 | low / minor | tests; the script | the «product role missing» and default-ACL arms had no control; an empty file passed | coordinator | fixed: N-T2b, N-T1b; the script refuses a file lacking any of T1, T2, T3, T6, T8 (exit 2); §2.3 Status records the file's sha256 |
| S1-06 / R1-01 | low / minor | §2.3 | every T1/T2 row sent to «re-apply 0102»; round 2's table still misrouted «via» another product role and a superuser | coordinator | fixed in round 3: rows read in order, T2 routed by what X is (row 17); after a re-apply, compare its NOTICE list with DA-202 |
| R2-01 | nit | the script | a failed `cron.job` query would abort the read-only transaction | coordinator | fixed: `to_regclass('cron.job')` first |
| R2-02 | nit | evidence | no run showed a compliant URL passing the TLS gate | coordinator | fixed: row 17 |
| S1-07 | info | the script | `new URL(url)` would echo an unparseable URL | coordinator | fixed: the host comes from the pg client |
| S1-08 | info | `adminClient()` | no local-only guard | coordinator | filed as BL-162; §2.3's warning names the destructive fixtures |
| S2-01 | low | the script | the hosted snapshot directory predictable and world-readable on a shared host | coordinator | fixed: `mkdtemp`, mode `0600` |
| S2-02 | info | the script | a second `sslmode=require` with libpq compat disabled hostname checking but passed the gate | coordinator | fixed: the gate also requires no `checkServerIdentity` override; checked, exit 2 |
| S2-03 | info | §2.3 | a port-forward counts as local | coordinator | fixed: §2.3 forbids it |
| S2-04 | info | the script | the marker check guards truncation, not editing | coordinator | recorded: integrity rests on the negative controls in CI and the sha256 in §2.3 |
| Q-01 | nit | the script | `"::1"` in the local list never matches (pg reports `[::1]`) | coordinator | fixed: dropped, with a comment that IPv6 loopback counts as remote (fails closed) |
| Q-02 | nit | this record | Completion said criteria 1–3 | coordinator | fixed |
| R1-04 | nit | tests | no case asserted the whole file empty | coordinator | fixed |
| R1-05 | nit | the script | violations printed only after a successful write | coordinator | fixed: printed first |
| R1-06 | nit | this record | the ENOENT red shows only that the suite reads the file | coordinator | recorded: the behavioural reds are the T1 mutation (row 6) and the negative controls, each needing a specific row |

Rework count and hypothesis changes: none (first review; fixes are the stated ones).

## What is not true after this task

- The hosted ACL is compared only when §2.3 runs; drift between runs is invisible. Nothing runs it on a schedule.
- The hosted checks read catalogs only; the refusal itself is proven locally and in CI.
- `adminClient()` still connects wherever `SUPABASE_DB_URL` points (BL-162).
- No full catalog snapshot of any hosted project exists (it needs the hosted `postgres` password); control 8 is Partial.
- Whether unpausing a free project or Supabase's in-place Postgres upgrade preserves the database ACL is undocumented; §2.3 lists both as moments to re-check.
- There is no restore procedure (BL-161).
- `0102`'s assertion block keeps its own copy of the checks (migrations are append-only).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | `3ded684a` + this task | `npx vitest run src/temporary-privilege.test.ts`: red «ENOENT … Tests 24 skipped (24)»; green «Tests 24 passed (24)», after the fixes «Tests 28 passed (28)»; mutation «Tests 1 failed \| 23 passed (24)»; shadow evidence (row 11) | PASS (coordinator) | the ENOENT red shows the suite reads the file; the behavioural reds are the mutation and the controls (R1-06) |
| 2 | yes | same | `pnpm db:catalog-snapshot` exit 0, `inv116_violations (0)`; on `_supabase` exit 1 with violations printed first; non-local without `verify-full` refused (exit 2); no password in any output | PASS (coordinator) | the exit-1 path shown on another local database, not by breaking `postgres`; the hosted path not run (it needs the owner's password) |
| 3 | yes | same | §2.3; connector runs on `goproceed-staging`: 0 rows (round 1 at 16:13, round 2 at 16:26 UTC, full hashes in §2.3) | PASS (coordinator) | — |
| 4 | yes | same | `pnpm validate:canonical-docs` «canonical documentation: OK»; `tsc --noEmit` for `packages/testing` exit 0; `pnpm validate:agents` OK | PASS (coordinator) | — |

## Sources

- Supabase, «Database Backups»: physical backups by default on Postgres `15.8.1.079` and newer; daily backups only on Pro, Team and Enterprise; free projects are told to export with `supabase db dump`; daily backups do not store custom roles' passwords, https://supabase.com/docs/guides/platform/backups, via `search_docs`, 2026-09-24.
- Supabase, «Restore to a new project»: copies «Database roles, permissions and users»; paid plans with physical backups only, https://supabase.com/docs/guides/platform/clone-project, via `search_docs`, 2026-09-24.
- PostgreSQL 17, «Overview of Event Trigger Behavior»: `ddl_command_start` «does not occur for DDL commands targeting shared objects — databases, roles, and tablespaces», https://www.postgresql.org/docs/17/event-trigger-definition.html, read 2026-09-24.
- PostgreSQL 17, «DROP OWNED»: privileges granted to the roles «on shared objects (databases, tablespaces, configuration parameters) will also be revoked», https://www.postgresql.org/docs/17/sql-drop-owned.html, read 2026-09-24.
- PostgreSQL 17, «pg_dump» `--create` (database ACL dumped only with it), https://www.postgresql.org/docs/17/app-pgdump.html, read 2026-09-24 (DEV-060). Local stack PostgreSQL 17.6; hosted 17.6.1.155.

## Completion / handoff

- Changed / inspected files: see «Owning module and allowed edit paths».
- Review independence: `gp-architect`, `gp-reviewer` (r1, r2), `gp-security` (r1, r2) and `gp-qa` as independent native subagents, before the commit.
- Verified scope: criteria 1–4 (`gp-qa` PASS).
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: CI on the pull request; the owner's merge; then a closure that sets BL-157 closed and this task done.
- Final state and reason: verifying.
