# DEV-060 — BL-155: no product role can create a temporary object

## Assignment

- **Objective and user-visible outcome:** no behaviour a user sees changes. PUBLIC loses TEMPORARY on the database, and so does every `goproceed_*` role and login; every other role that held it through PUBLIC keeps it by direct grant. A session on an application, service or purge connection can then never create a temporary schema, so `pg_temp` is in no path it runs, and the class BL-152 belonged to — a definer resolving a name through the caller's temporary schema — is closed for product sessions, not only narrowed (DEV-059's `gp-security` S1-01).
- **State:** verifying
- **Coordinator:** primary Claude Code session («Close BL-153: revoke TEMP from product roles»), 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a grant on the database and the product roles in a migration: `gp-architect` → failing tests → migration and catalogs → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (a grant and database roles in `supabase/migrations`); `gp-security` (grants, database roles); `gp-reviewer` (always); `gp-qa` (always). `gp-ui-reviewer`, `gp-mobile`: not triggered. `gp-researcher`: not needed — the PostgreSQL 17 and Supabase documentation read directly (Sources).
- **Owning module and allowed edit paths:** `supabase/migrations/0102_the_temporary_schema_no_product_role_creates.sql` (new); `packages/testing/src/temporary-privilege.test.ts` (new), `packages/testing/src/pg.ts` (`purgeClient`, `superuserClient`), `packages/testing/src/definer-search-path.test.ts`, `packages/testing/src/workspace-access-rls.test.ts`; `apps/app/tests/upload-intents-finalize.int.test.ts` (F-01, one subquery); `technical/database/invariant-catalog.csv` (INV-116 new; INV-105, INV-114, INV-115); `technical/data-access-surface.csv` (DA-202); `docs/architecture/tenancy-and-security.md`; `docs/BACKLOG.md` (BL-155, BL-157); `docs/STATUS.md`; this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`; `agents/COMMON.md`; DEV-059's record (BL-152, `0101`, gp-security S1-01); `0003`, `0034`, `0090` (the product roles).
- **Linked spec, ADR or earlier task:** BL-155, filed by [DEV-059](DEV-059-temporary-schema-searched-last.md) (BL-152, PR #131). No ADR: the change only tightens a privilege (`gp-architect`).
- **Baseline:** `e420e3be` (`claude/definer-search-path`, DEV-059 = `ef3c7809` merged with main `66c3dd68`; unmerged, PR #131); local database at `0101`.
- **Dependencies / constraints / out of scope:** DEV-059 must merge first (this branch contains it). The definers still trusting `public` (BL-146). Other databases on the cluster (`_supabase` exists locally, not on the hosted project). `0102` is applied to the local database by hand; the hosted push is the owner's.
- **Required acceptance criteria:**
  1. `temporary-privilege.test.ts`: PUBLIC holds no TEMPORARY; nothing a `goproceed_*` role reaches holds it or is a superuser; no TEMP holder short of a superuser or the owner can become a product role or reach a definer in `app`/`public`/`api`; the application, service and purge logins, before and after SET ROLE, are refused a temporary table and a `pg_temp` domain (42501, «permission denied to create temporary tables in database») and have no temporary schema; the owner is not refused (positive control); a product role cannot add to a temporary schema a superuser created in the same backend; no function body creates a temporary object. The cases that assert the revoke are red at `0101` and green at `0102`.
  2. `0102` applies by hand as `postgres` on a database at `0101`, in one transaction; its assertion block passes; a before/after capture shows only the seven product roles lost TEMP; a re-run grants nothing and passes; the assertion raises when a product role can reach TEMP.
  3. DEV-055's and DEV-059's temporary-object cases keep their assertions, planted on the local superuser's connection, and pass at both `0101` and `0102`; the harness still catches a definer whose path loses `pg_temp`.
  4. Every `packages/testing` suite that does not call `resetDb`, `packages/database`, and every `apps/app` integration suite pass one at a time after `0102`, none skipped — nothing in the product needs TEMP.
  5. INV-116, DA-202, the architecture doc, BL-155/BL-157, STATUS updated; `pnpm validate:canonical-docs` passes.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | BL-155 (filed as BL-153 before DEV-059's renumbering) as a separate cluster in a new session | chat, «займись BL-153 отдельным кластером в новой сессии» |
| 2026-09-24 | Which database runs: the coordinator chooses the necessary suites, one at a time; truncating tenant tables is allowed; never a reset; hosted pushes only on the owner's explicit word | the session brief |

## Plan

1. Read-only facts, locally and on `goproceed-staging`: database owner, ACL, TEMP holders, memberships, who can reach a definer; a grep for temporary objects in code. `gp-architect`.
2. Failing tests (`temporary-privilege.test.ts`); the DEV-055 and DEV-059 cases moved to a superuser harness (green at `0101`).
3. `0102`; before/after capture; re-run; negative assertion check.
4. Suites one at a time; catalogs, architecture doc, backlog, STATUS.
5. `gp-reviewer` + `gp-security`, fixes, `gp-qa`, commit.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | coordinator | Coordinated with the BL-152 session: it took DEV-059, BL-155 and `0101`; this task DEV-060, `0102`, BL-157+; the local database handed over after its suites. Branch `claude/revoke-temp` from `e420e3be` | cross-session messages, 2026-09-24 | facts |
| 2 | coordinator | Local (PostgreSQL 17.6, head `0101`): database `postgres` owned by `postgres` (not a superuser here); ACL `{=Tc/postgres,postgres=CTc/postgres,supabase_etl_admin=C/postgres,supabase_storage_admin=C/postgres,dashboard_user=CTc/postgres}`; every role holds TEMP through PUBLIC; `postgres` cannot SET ROLE into the product roles. Hosted `goproceed-staging` (connector, read-only, head `0101`): the same owner and ACL; `cli_login_postgres` → `postgres` (set, no inherit); `postgres` holds ADMIN on every `goproceed_*` role; no `_supabase` database; no non-product role short of a superuser or `postgres` can reach a definer. Code: no temporary object outside the two test files | connector queries and local `psql`, 2026-09-24 | design |
| 3 | gp-architect | `0102` as one DO block: refuse unless run with the owner's rights; product set by pattern `goproceed\_%` plus seven named roles; keep-list = holders now minus `pg_*`, product, `cli_login_*` and anything that can become or inherit a product role; revoke from PUBLIC and every product role; grant back directly; assert both membership directions. INV-116 new; DA-202; BL-157 (restore/ACL drift); the DEV-055/DEV-059 guards move to a superuser harness (`supabase_admin`, already used by `packages/database/src/tx.test.ts`); no ADR | architect report, 2026-09-24 | tests |
| 4 | coordinator | Red at `0101`: `temporary-privilege.test.ts` 16 failed, 3 passed (T3, T8 guards; T5 control) | «Acceptance evidence» below; `scratchpad/dev060-red.txt` | harness |
| 5 | coordinator | The rewritten DEV-059 probes (7) and `workspace-access-rls` (31) pass at `0101`. Mutation check on the superuser harness, rolled back: with `app.accept_invitation` set back to `search_path=''`, the probe raised «BL152-PROBE ran as postgres» | `scratchpad/dev060-mutation.txt` | migration |
| 6 | coordinator | `0102` applied by hand as `postgres` in one transaction (`psql -1`), version recorded. NOTICE: TEMPORARY granted back to 13 roles (Appendix); no TEMPORARY for the seven product roles. Before/after: only those seven lost TEMP. Re-run in a rolled-back transaction: 0 granted back, passes. Negative: with a role holding TEMP granted to `goproceed_service`, the assertion raised «a product role reaches TEMPORARY or a superuser: goproceed_service via dev060_x, …» | `scratchpad/dev060-before.txt`, `dev060-after.txt`, `dev060-apply.txt`, `dev060-rerun.txt`, `dev060-neg.txt` | green |
| 7 | coordinator | Green at `0102`: `temporary-privilege.test.ts` 19 passed | «Acceptance evidence» | suites |
| 8 | coordinator | `packages/testing`: 53 suites one at a time, 839 tests passed, none skipped; the four `resetDb` suites (`m1-rls-baseline`, `m1-rls-workspace`, `m1-schema`, `rls`) not run | `scratchpad/dev060-testing-suites.txt` | app suites |
| 9 | coordinator | `packages/database` 32 passed; `apps/app`: 64 integration suites one at a time (all but `external-evidence`, which rewrites RLS policies by DDL during its run), 832 passed, 1 failed: `upload-intents-finalize` «never abandons the upload of a creator who is still fully authorized» — the case DEV-059 saw fail once without a message. Root cause found and reproduced (F-01) | `scratchpad/dev060-app-suites.txt`, `dev060-uif-repro.txt` | review |
| 10 | gp-reviewer | R1 PASS WITH FINDINGS: R1-01..R1-03 minor (a member of a product role could lose TEMP with only a NOTICE; STATUS's hosted head; the DEV-055 harness never shown red), R1-04..R1-07 nit | reviewer report, 2026-09-24, on `scratchpad/dev060-r1.diff` | fixes |
| 11 | gp-security | S1 PASS WITH FINDINGS: S1-01 medium (= R1-01), S1-02..S1-04 low (pre-existing backends; T8's pattern and scope; «reach a definer» only tested locally, `service_role` revoke unwritten), S1-05..S1-07 info; a hosted preflight list P1–P9 | security report, 2026-09-24, same diff | fixes |
| 12 | coordinator | Hosted preflight P2, P3, P8 (read-only, connector): the only member of `postgres` is `cli_login_postgres` (inherit f, set t); no role would silently lose TEMP (the only non-product member of a product role is `postgres`, which holds TEMP directly); predicted NOTICE list 12 roles (Appendix); head `0101` | connector query, 2026-09-24 | fixes |
| 13 | coordinator | Fixes (below). `0102` re-checked in rolled-back transactions on a pre-`0102` ACL: passes («ok-pos»); with a role that inherits `goproceed_app` and held TEMP only through PUBLIC: «ERROR: 0102: a role that held TEMPORARY lost it: dev060_y». T8's pattern checked on sample bodies. DEV-055 harness mutation: `current_actor()` unqualified alone → no error (masked by `0101`'s paths); with the helpers' paths also back at `''` → «ERROR: return type mismatch in function declared to return pg_catalog.uuid». Re-runs: upload-intents-finalize 36 (with B's stray membership present), temporary-privilege 19, definer-search-path 7, workspace-access-rls 31; `tsc` for `packages/testing` and `apps/app` exit 0; `validate:canonical-docs` OK | `scratchpad/dev060-r2-assert.txt`, `dev060-mutation-dev055.txt`, `dev060-r2-green.txt` | re-review, gp-qa |
| 14 | gp-security | r2 re-check PASS on S1-01..S1-07; F-01 no security effect; S2-01, S2-02 info | security re-check, 2026-09-24, on `scratchpad/dev060-r2.diff` | gp-reviewer r2 |
| 15 | gp-reviewer | r2 PASS on R1-01..R1-07 and F-01; R2-01..R2-03 nit | review, 2026-09-24, on `scratchpad/dev060-r2.diff` | fixes |
| 16 | coordinator | R2-01..R2-03 fixed; re-runs: temporary-privilege 19, definer-search-path 7, workspace-access-rls 31, `tsc` exit 0; the guard checked with a remote and a `?host=` URL | `scratchpad/dev060-r3-green.txt` | gp-qa |
| 17 | gp-qa | PASS on criteria 1–5, every stated fix in place. Re-ran one at a time: temporary-privilege 19, definer-search-path 7, workspace-access-rls 31 (its first run of the last two may have overlapped — both pass, the first writes nothing — so it re-ran each alone), `packages/database` 32, upload-intents-finalize 36 twice (around signatory-participants 17, with B's stray membership present), evidence-purge-principal 8, invitations 9, `external-evidence` 12 (a before/after snapshot of 167 policy expressions: unchanged); red state re-created in rolled-back transactions (T2 12 rows, T6 197 rows, as recorded); the final `0102` on a re-created pre-`0102` ACL: 13 granted back, 7 without, the resulting ACL equals the live one; re-run 0 granted; four negative cases raise, `anon` is refused as a non-owner; `tsc` exit 0 in both; `validate:canonical-docs` OK. Q-01 info, Q-02 record hygiene | QA report, 2026-09-24, on `scratchpad/dev060-r3.diff` | commit |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| F-01 | minor (pre-existing) | `apps/app/tests/upload-intents-finalize.int.test.ts:664-667` | the revoke's `(select id from public.memberships where user_id = $2)` has no workspace filter; `signatory-participants` leaves user B's membership in its own workspace, so in a sequential run the subquery returns two rows: «more than one row returned by a subquery used as an expression». Reproduced: run `signatory-participants`, then this suite | coordinator | fixed: `and organization_id = $1`; passes with the stray membership present. Not caused by `0102` (DEV-059 saw it at `0101`) |
| R1-01 / S1-01 | minor / medium | `0102` keep-list and «lost it» check | a role left off the keep-list for being a member of a product role (on hosted, any member of `postgres`) loses TEMP with only a NOTICE | coordinator | fixed: `held` = every non-predefined holder before the revoke; the migration raises if any role but a product role or `cli_login_*` lost TEMP; negative check above; hosted P3 shows none today |
| R1-02 | minor | STATUS «Database migrations» | «hosted head is `0100`» and «All 100» contradicted the new clause | coordinator | fixed from the connector's `0101` |
| R1-03 | minor | the DEV-055 harness | never shown red | coordinator | mutation run: live when `0100` and `0101` both regress; `0100` alone is masked by `0101`, so INV-114 now says its catalog-shape case guards `0100` by itself |
| R1-04 | nit | `0102`'s direct grants | pin platform roles in `pg_shdepend` | coordinator | recorded in «What is not true» and BL-157 |
| R1-05 | nit | DA-202; INV-105 | the local NOTICE list stated as fact; INV-105 cited no test for its new clause | coordinator | fixed |
| R1-06 / S1-04 | nit / low | INV-116, INV-115, the architecture doc | the roles that keep TEMP stay away from definers only through EXECUTE revokes; «non-extension»; `service_role` unwritten; T6 local only | coordinator | fixed in INV-116, rule 8 and the definer bullet; hosted T6 is preflight P6; BL-157 adds T6 to the snapshot |
| R1-07 / S1-03 | nit / low | T8 | missed `SELECT … INTO TEMP` and objects named into `pg_temp.` | coordinator | fixed; INV-116 names run-time-assembled statements and other schemas as not covered |
| S1-02 | low | INV-116 | a backend that created a temporary schema before the push keeps USAGE | coordinator | added to INV-116 «Not covered»; postflight P7 in the handoff |
| S1-05 | info | grant-back | `anon`, `authenticated` now hold TEMP by explicit grant | coordinator | recorded in «What is not true»; no BL filed |
| S1-06 | info | `superuserClient()` | a mis-set env could split a run across databases | coordinator | fixed: throws when a product or admin URL is not loopback |
| S1-07 | info | the name pattern | product roles found by `goproceed_*` | coordinator | stated in rule 8 |
| S2-01 / R2-03 | info / nit | `superuserClient()` | the loopback check read the URL text (a `?host=` override passed it) and ignored port and database | coordinator | fixed: each URL parsed; host, port and database must equal the local superuser's, and `host`/`port`/`dbname` parameters are refused; checked: a remote `APP_DB_URL` and a `?host=remote` one both throw, the local set does not |
| R2-01 | nit | STATUS | attributed the hosted `0101` to DEV-059's record, which does not record the push | coordinator | fixed: «observed by DEV-060» |
| R2-02 | nit | `workspace-access-rls.test.ts` header | said the cases guard `0100` on their own | coordinator | fixed: independent of `0102`, not of `0101`; the catalog-shape case guards `0100` alone |
| Q-01 | info | `0102`'s «reaches TEMPORARY» message | lists self-pairs («goproceed_service via goproceed_service») because the privilege is inherited | coordinator | not changed: excluding product roles as `x` would hide a direct TEMP grant to a product role; the culprit is still named |
| Q-02 | record | this record | `external-evidence` NOT RUN and «gp-qa pending» | coordinator | fixed from the QA pass |
| S2-02 | info | the local apply | the local database recorded r1's `0102`; r2 only adds the `held` assertion | coordinator | recorded: r2 was checked in rolled-back transactions only (row 13); the local ACL is the one r2 would produce |

Rework count and hypothesis changes: none (first review; the fixes are the stated ones, plus F-01, a pre-existing test-isolation defect found by criterion 4's run and sent back to `gp-reviewer`).

## What is not true after this task

- A superuser, or a role with the database owner's rights, can still create a temporary schema and then SET ROLE into a product role; that session is covered only by definer paths (INV-115) and qualified bodies.
- Roles created after `0102` hold no TEMP unless a migration grants it — a future Supabase-managed role that needs it would fail until then.
- The database ACL lives outside every schema: a restore or clone without `pg_dump --create` would bring PUBLIC's TEMP back silently, and nothing compares the hosted ACL (BL-157).
- Backends of the product logins opened on the hosted project before the push keep a temporary schema they already created until they exit (USAGE only); terminating them is a hosted action.
- Eleven definers still trust `public` (BL-146). Other databases on the local cluster (`_supabase`) keep PostgreSQL's default ACL.
- The Supabase-managed roles keep TEMP, `anon` and `authenticated` now by an explicit grant; only the EXECUTE revokes (T6, local only) keep them away from the definers.
- Each direct grant records a dependency on its platform role, so a platform-side `DROP ROLE` would need a revoke first (BL-157).
- T8 cannot see a statement a body assembles at run time, nor definers outside `app`, `public` and `api`.
- `0102` is applied to the local database only; the hosted project needs the owner's push, after DEV-059's `0101` (already on staging).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | `e420e3be` + this task | `npx vitest run src/temporary-privilege.test.ts` (packages/testing). Red at `0101`: «Tests 16 failed \| 3 passed (19)» — T1 «expected [ { explicit: true, …(1) } ] to deeply equal …», T2 «expected [ …(12) ] to deeply equal []», each T4 «expected '' to match /permission denied to create temporary…/», T6 «expected [ …(197) ] to deeply equal []», T7 «expected '' to match /permission denied for schema pg_temp_/». Green at `0102`: «Tests 19 passed (19)» | PASS (coordinator; `gp-qa` re-ran green and re-created the red state in rolled-back transactions) | the red run at `0101` is the coordinator's |
| 2 | yes | same | `psql -v ON_ERROR_STOP=1 -1 -f 0102` as `postgres`: exit 0, «DO», 13 «granted back», 7 «no TEMPORARY for goproceed_*»; before/after diff: the ACL and the seven product rows only; re-run: 0 granted back; negative: «ERROR: 0102: a product role reaches TEMPORARY or a superuser: goproceed_service via dev060_x, …» | PASS (coordinator; `gp-qa` on the final file) | the one-transaction apply was r1's; r2/r3 checked in rolled-back transactions (S2-02) |
| 3 | yes | same | at `0101`: definer-search-path «Tests 7 passed (7)», workspace-access-rls «Tests 31 passed (31)»; mutation: «ERROR: BL152-PROBE ran as postgres» | PASS (coordinator; `gp-qa` re-ran the mutation) | the `0101` runs are the coordinator's |
| 4 | yes | same | 53 `packages/testing` suites «839 passed», none skipped; `packages/database` «Tests 32 passed (32)»; 64 `apps/app` integration suites «832 passed», 1 failed (F-01), fixed and re-run: «Tests 36 passed (36)» | PASS (coordinator's full run; `gp-qa` re-ran a subset and `external-evidence` 12/12) | the four `resetDb` suites NOT RUN (a reset is the owner's; CI runs them); CI not yet run |
| 5 | yes | same | `pnpm validate:canonical-docs`: «canonical documentation: OK» | PASS (coordinator, `gp-qa`) | — |

## Sources

- PostgreSQL 17 documentation, «Privileges» (§5.8): TEMPORARY «Allows temporary tables to be created while using the database»; PUBLIC's default privileges on a database are TEMPORARY and CONNECT; «Ordinarily, only the object's owner (or a superuser) can grant or revoke privileges on an object», https://www.postgresql.org/docs/17/ddl-priv.html, read 2026-09-24.
- PostgreSQL 17 documentation, «Client Connection Defaults» — `search_path`: the temporary schema «is always searched if it exists … If it is not listed in the path then it is searched first … only searched for relation … and data type names», https://www.postgresql.org/docs/17/runtime-config-client.html, read 2026-09-24.
- PostgreSQL 17 documentation, «pg_dump» — `--create`: «Access privileges for the database itself are also dumped» only with it, https://www.postgresql.org/docs/17/app-pgdump.html, read 2026-09-24.
- Supabase documentation, «Postgres Roles» (https://supabase.com/docs/guides/database/postgres/roles) and «Roles, superuser access and unsupported operations» (https://supabase.com/docs/guides/database/postgres/roles-superuser), via the Supabase MCP `search_docs`, 2026-09-24: neither states which managed roles need TEMP, so `0102` keeps it for every one that held it. Applies to the local stack (PostgreSQL 17.6) and the hosted project (17.6.1).

## Completion / handoff

- Changed / inspected files: see «Owning module and allowed edit paths».
- Review independence: `gp-architect`, `gp-reviewer` (r1, r2), `gp-security` (r1, r2) and `gp-qa` as independent native subagents, before the commit.
- Verified scope: criteria 1–5 (`gp-qa` PASS).
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: CI on the PR; the owner's merge of #131 and this PR, and the owner's word for the hosted push of `0102` — before it, preflight P1, P4–P7 (`gp-security`'s list; P2, P3, P8 done); after it, P7 and P9, the NOTICE list pasted below, and the product logins' backends terminated only if P7 shows temporary objects owned by a `goproceed_*` role (a hosted action, the owner's).
- Final state and reason: verifying.

## Appendix — roles `0102` granted TEMPORARY back to (local, 2026-09-24)

`anon`, `authenticated`, `authenticator`, `pgbouncer`, `service_role`, `supabase_auth_admin`, `supabase_etl_admin`, `supabase_functions_admin`, `supabase_privileged_role`, `supabase_read_only_user`, `supabase_realtime_admin`, `supabase_replication_admin`, `supabase_storage_admin`. `postgres` and `dashboard_user` held it directly and are unchanged; `supabase_admin` is a superuser. On `goproceed-staging`, preflight P3 (read-only, 2026-09-24) predicts 12: the same less `supabase_functions_admin` (absent there). `cli_login_postgres` loses TEMP deliberately (it works as `postgres`); `postgres` and `dashboard_user` hold it directly. The hosted push's NOTICE list is to be pasted here.
