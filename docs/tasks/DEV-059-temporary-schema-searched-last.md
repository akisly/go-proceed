# DEV-059 — BL-152: every definer searches the temporary schema last

## Assignment

- **Objective and user-visible outcome:** no behaviour a user sees changes. Every SECURITY DEFINER function in `app`, `public` and `api`, and every function there that pins its own `search_path`, lists `pg_temp` last (`pg_catalog, pg_temp`; BL-146's eleven keep `public, pg_temp`). A session with arbitrary SQL on an application, service or purge connection can no longer make a definer resolve a type or relation through its temporary schema and so run code with the definer owner's rights. The definer rule in `agents/COMMON.md`, `agents/roles/gp-reviewer.md` and `docs/architecture/tenancy-and-security.md` changes from «an empty `search_path`» to «`pg_temp` listed last».
- **State:** done
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** SECURITY DEFINER functions in a migration and an agent-instruction change: `gp-architect` → owner ruling → failing tests → migration, rule and catalogs → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (definer functions in `supabase/migrations`); `gp-security` (definers, grants, the trust boundary of every connection role); `gp-reviewer` (always; the rule text in `agents/` is an agent-instruction change). `gp-ui-reviewer`, `gp-mobile`: not triggered. `gp-researcher`: not needed — PostgreSQL 17's documentation read directly (Sources).
- **Owning module and allowed edit paths:** `supabase/migrations/0101_the_temporary_schema_searched_last.sql` (new); `packages/testing/src/definer-search-path.test.ts` (new), `packages/testing/src/pg.ts` (`serviceClient`), `packages/testing/src/workspace-access-rls.test.ts`; `agents/COMMON.md`, `agents/roles/gp-reviewer.md` and the generated `.claude/agents/`, `.codex/agents/`; `docs/architecture/tenancy-and-security.md`; `technical/database/invariant-catalog.csv` (INV-115, INV-114, INV-105); `technical/data-access-surface.csv` (DA-198..201); `docs/BACKLOG.md` (BL-110, BL-146, BL-152, BL-155); `docs/STATUS.md`; this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`; `agents/COMMON.md` (the definer rule); every SECURITY DEFINER function's latest definition in `supabase/migrations/`; DEV-055's record (gp-security S1-01).
- **Linked spec, ADR or earlier task:** BL-152, filed by [DEV-055](DEV-055-inlined-helpers-qualified.md); closes BL-110; narrows BL-146. No ADR: the change tightens a rule that does not come from an ADR (gp-architect).
- **Baseline:** `406f5efe` (main, #123 merged); local database at `0100`.
- **Dependencies / constraints / out of scope:** BL-146's eleven (`public, pg_temp`: `pg_temp` already last, `public` still trusted); PUBLIC's TEMP (BL-155, filed); the inlinable invoker helpers without a SET clause (INV-114). `0101` is applied to the local database by hand; the hosted push is the owner's.
- **Required acceptance criteria:**
  1. `definer-search-path.test.ts`: with a `pg_temp` domain shadowing `uuid` or `text` whose CHECK raises a marker naming `current_user`, `app.accept_invitation`, `app.retire_requirement_rule_version`, `app.org_has_members` (application plane) and `app.abandon_unauthorized_upload_intent` (service plane) answer their own outcome, not the marker; each case's positive control shows the shadow live in the session. Every definer and every path-pinning function lists `pg_temp` last; the `public`-trusting set is exactly BL-146's eleven. All six red at `0100` (the marker ran as `postgres` in all four probes), green at `0101`.
  2. `0101` applies by hand as `postgres` on a database at `0100`, in one transaction; its assertion block passes; a before/after catalog diff shows only `proconfig` changed (OID, owner, `prosecdef`, volatility, ACL and the body's md5 unchanged).
  3. The updated `workspace-access-rls` suite and every suite that exercises definers pass, one at a time, none skipped.
  4. The rule text is amended in `agents/COMMON.md`, `agents/roles/gp-reviewer.md` and `docs/architecture/tenancy-and-security.md`; the profiles are regenerated; `pnpm validate:agents` and `pnpm validate:canonical-docs` pass.
  5. The owner's ruling is recorded here.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | BL-152 as a separate cluster | chat, «займись BL-152 отдельным кластером» |
| 2026-09-24 | `pg_catalog, pg_temp` everywhere (the ten `public` definers included); the rule changes; the TEMP revoke is a separate BL-155 | chat, answer «pg_catalog, pg_temp везде (Рекоменд.)» |
| 2026-09-24 | BL-152 raised to P1 | chat, answer «P1 (Рекоменд.)» |
| 2026-09-24 | Which database runs: the coordinator chooses the necessary suites, one by one; truncating tenant tables is allowed; never a reset | the standing brief (DEV-047's record) |

## Plan

1. A harmless probe on the local database; failing tests.
2. `0101`; before/after catalog capture.
3. The rule text in three files; profiles regenerated.
4. Catalogs and backlog.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | coordinator | Probe on the local database at `0100`, on the application login in a rolled-back transaction: a `pg_temp` domain `uuid` whose CHECK raises made `app.accept_invitation('not-a-token')` raise «BL152-MARKER ran as postgres» | `scratchpad/bl152-probe-before.txt` | design |
| 2 | gp-architect | Inventory: 99 definer or path-pinning functions — 77 `''`, 11 `public` (10 `app` definers and `public.drain_outbox`), 11 `public, pg_temp`; exposed definers on the application, service and purge planes; the ten `public` bodies fully qualified. Option 1 (`ALTER FUNCTION … SET search_path = pg_catalog, pg_temp`), rejecting TEMP revoke now (BL-155) and hand-qualifying bodies; rule amendment required; no ADR | architect report, 2026-09-24 | owner |
| 3 | owner | «pg_catalog, pg_temp везде», BL-152 → P1 | chat, 2026-09-24 | tests |
| 4 | coordinator | Red at `0100`: 6 failed — the four probes each «BL152-PROBE ran as postgres», 88 functions without `pg_temp` last, 22 path entries naming `public` | `scratchpad/dev056-red.txt` | migration |
| 5 | coordinator | `0101` applied locally as `postgres` in one transaction: «77 functions moved from search_path="" to pg_catalog, pg_temp»; assertion block passed; version recorded. Before/after: 99 functions, same OIDs; 88 `proconfig` changed; owner, `prosecdef`, volatility, ACL and body md5 unchanged for all 99 | `scratchpad/dev056-before.txt`, `dev056-after.txt`, `dev056-apply.txt` | green |
| 6 | coordinator | Green: definer-search-path 6, workspace-access-rls 31 (the DEV-047 helpers and DEV-052's guard now expect `pg_catalog, pg_temp`) | `scratchpad/dev056-green.txt` | rule, catalogs |
| 7 | coordinator | Rule amended in `agents/COMMON.md`, `agents/roles/gp-reviewer.md`, `docs/architecture/tenancy-and-security.md`; `python3 scripts/sync-agents.py --write` regenerated 16 profiles; `pnpm validate:agents` verified | this change | suites, review |
| 8 | coordinator | Suites one at a time: all 51 `packages/testing` suites that do not call `resetDb` passed (797 tests, none skipped); every `apps/app` integration suite except `external-evidence` (it rewrites RLS policies by DDL during its run) | `scratchpad/dev056-testing-suites.txt`, `dev056-app-suites.txt` | review |
| 9 | gp-reviewer | R1 PASS: R1-01..R1-04 minor (DA wording, B and D asserted only the probe's absence, the rollback list lived in the scratchpad, «trusted schema» undefined), R1-05..R1-09 nit | reviewer report, 2026-09-24, on `scratchpad/dev056-r1.diff` | fixes |
| 10 | gp-security | S1 PASS: S1-01 medium (pg_temp still supplies any name no earlier schema defines; nothing mechanical keeps bodies qualified — INV-115 overstated; BL-155 to P2), S1-02..S1-04 low (hosted preflight, the check accepted repeated or other schemas before `pg_temp`, the rule omitted types), S1-05, S1-06 info | security report, 2026-09-24, same diff | fixes |
| 11 | coordinator | Fixes: DA-198..201 wording; INV-115 and `0101`'s header say what `pg_temp` last does and does not stop; BL-155 → P2; the rule (three files, profiles regenerated) says «once and last», defines a trusted schema and adds types; `0101`'s assertion accepts only `pg_catalog, pg_temp` or `public, pg_temp` (re-run in a rolled-back transaction: passes); the 77 names in the Appendix; B and D assert their own outcomes; the catalog case matches the two exact paths; `drain_outbox` and `purge_expired_idempotency` run; stale comments; STATUS's local history | this record | suites, gp-qa |
| 12 | coordinator | `apps/app`: 64 integration suites one at a time (all but `external-evidence`), 783 tests passed, none skipped; one case of `upload-intents-finalize` («never abandons the upload of a creator who is still fully authorized», which calls `abandon_unauthorized_upload_intent`) failed once in the long run — its message was not captured — and passed alone and in three full re-runs of the suite (36/36 each); `gp-qa` ran it twice more in under 0.4 s, so a timeout does not explain it; recorded as not reproduced. `contracts` 5 and `imports` 13 re-run for their summary lines. After the fixes: definer-search-path 7, workspace-access-rls 31; `tsc` for `packages/testing` exit 0; both validators OK | `scratchpad/dev056-app-suites.txt`, `dev056-green-r2.txt` | gp-qa |
| 13 | coordinator | Hosted preflight (gp-security S1-02), read-only through the connector on `goproceed-staging` at `0100`: 77 `''`, 11 `public`, 11 `public, pg_temp` definer or path-pinning functions in `app`/`public`/`api`, all owned by `postgres` (the same sets as local); database owner `postgres`; TEMPORARY held by PUBLIC, `postgres`, `dashboard_user`; CREATE on schema `public` only by `pg_database_owner` — so `public` is effectively trusted there (BL-146) | connector query, 2026-09-24 | owner's push |
| 14 | owner | BL-155 goes to a separate cluster in a new session | chat, «займись BL-155 отдельным кластером в новой сессии» | — |
| 15 | gp-qa | PASS on criteria 1–5: definer-search-path 7, workspace-access-rls 31, outbox 4, idempotency-expiry 2, m2-definer-authz 2, telegram-erasure 38; invitations 9, evidence-purge-principal 8, upload-intents-finalize 36 twice, m5-external 27, telegram-evidence 22; live catalog equals `dev056-after.txt` (88 `pg_catalog, pg_temp`, 11 `public, pg_temp`); `0101` re-runs cleanly (0 moved) and its assertion raises on six bad paths; N1 fixed («once» in `gp-reviewer.md`) | QA report, 2026-09-24, on `scratchpad/dev056-r2.diff` | commit |
| 16 | Owner; coordinator (hosted push) | Renumbered DEV-056 → DEV-059 and BL-153 → BL-155 (main had taken both), merged `origin/main`, PR #131. On the owner's word «накати 0101 на hosted»: from a `git archive` of `supabase/` at `e420e3be`, `supabase link --project-ref asrvzhjaueyvrfozxpzo`, `supabase db push --linked --dry-run` (exactly `0101`; no seeds, no roles), then the push, 13:49:37–13:49:42 UTC, exit 0, CLI 2.114.0. After (read-only, connector): head `0101`; 88 functions at `pg_catalog, pg_temp`, 11 at `public, pg_temp`, none other, all owned by `postgres`; the application, service and purge roles keep EXECUTE, `anon` and `authenticated` have none. Production runs `main`, whose functions keep their bodies | `scratchpad/push-0101-dryrun.txt`, `push-0101.txt` | — |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 / S1-05 | minor / info | DA-198..201 | the notes read as a three-entry path | coordinator | fixed |
| R1-02 | minor | cases B and D | asserted only that the probe did not fire | coordinator | fixed: B asserts its own refusal, D its answer |
| R1-03 / S1-06 | minor / info | `0101`'s rollback | the 77 names lived in the scratchpad | coordinator | fixed: Appendix |
| R1-04 / S1-04 | minor / low | the rule text | «trusted schema» undefined; types omitted | coordinator | fixed in the three files; profiles regenerated |
| R1-05 / S1-01 | nit / medium | INV-115, `0101`'s header; BL-155 | «can supply neither a relation nor a type name» overstated: `pg_temp` still supplies any name no earlier schema defines, and nothing mechanical keeps bodies qualified | coordinator | INV-115 and the header reworded; BL-155 raised to P2 as the change that closes the class |
| S1-02 | low | hosted push | nobody has read the hosted catalog | coordinator | recorded: the preflight queries run before the owner's push |
| S1-03 | low | `0101`'s assertion; the catalog case | accepted a repeated `pg_temp` or another schema before it | coordinator | fixed: exactly `pg_catalog, pg_temp` or `public, pg_temp`; the eleven pinned by name in the test |
| R1-06 | nit | `technical/database/schema-v0.1.sql`; a vendor skill | still show `''` | coordinator | recorded in «What is not true» (the snapshot is a design artefact; vendor text is not edited) |
| R1-07 | nit | stale comments | the DEV-047 comment and a purge-principal probe modelled `''` | coordinator | fixed |
| R1-08 | nit | STATUS | the local history lacked `0101` | coordinator | fixed |
| R1-09 | nit | coverage | `drain_outbox` and `purge_expired_idempotency` never ran after the change | coordinator | fixed: a rolled-back call with batch 0 |

Rework count and hypothesis changes: none (first review; fixes limited to the stated ones).

## What is not true after this task

- Eleven definers still trust `public` on their path (BL-146).
- PUBLIC still holds TEMP on the database, and `pg_temp` — searched last — still supplies any name no earlier schema defines; only qualified bodies keep that closed (BL-155, P2).
- `technical/database/schema-v0.1.sql` (a design snapshot) still shows `set search_path = ''` on three trigger functions, and a vendor skill under `.agents/skills/` still recommends `''`.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | `406f5efe` + this task | `definer-search-path.test.ts`: 7 passed; red at `0100` 6 failed, each probe «ran as postgres» | PASS (`gp-qa`'s run) | the stricter r2 assertions were not run red (it needs a database at `0100`); `0101`'s assertion covers the same logic and fails on bad paths |
| 2 | yes | same | one-transaction apply («77 functions moved»); before/after: only `proconfig` differs on 88 of 99; the assertion re-run passes | PASS (`gp-qa`) | applied locally once, by the coordinator |
| 3 | yes | same | 51 `packages/testing` and 64 `apps/app` suites one at a time (coordinator); 11 re-run by `gp-qa` | PASS | `external-evidence` and the `resetDb` suites NOT RUN; one `upload-intents-finalize` case failed once and did not reproduce in six later runs; CI blocked |
| 4 | yes | same | the rule in `COMMON.md`, `gp-reviewer.md`, `tenancy-and-security.md`; 16 profiles; `validate:agents`, `validate:canonical-docs` OK | PASS (`gp-qa`) | — |
| 5 | yes | same | «Owner decisions» | PASS | — |

## Sources

- PostgreSQL 17 documentation, «CREATE FUNCTION» — «Writing SECURITY DEFINER Functions Safely»: the temporary-table schema «is searched first by default, and is normally writable by anyone. A secure arrangement can be obtained by forcing the temporary schema to be searched last. To do this, write `pg_temp` as the last entry in `search_path`», https://www.postgresql.org/docs/17/sql-createfunction.html, read 2026-09-24. Applies to the local stack (PostgreSQL 17.6) and the hosted project (17.6.1).

## Completion / handoff

- Changed / inspected files: `0101`, the new test file and `pg.ts`, `workspace-access-rls.test.ts`, the purge-principal probe, the rule in three files and 16 generated profiles, INV-105/114/115, DA-198..201, BL-110/146/152/153, STATUS, this record and the task index.
- Review independence: `gp-architect`, `gp-reviewer`, `gp-security` and `gp-qa` as independent native subagents, before the commit.
- Verified scope: criteria 1–5.
- Remaining risks / blocked requirements: «What is not true after this task»; BL-155 is a separate cluster (owner).
- Next bounded action and owner: none; BL-155 (PUBLIC's TEMP) is the separate cluster DEV-060.
- Final state and reason: done — merged in #131 (`5d027a21`, 2026-09-24 13:50 UTC); `0101` on staging since 13:49 UTC.

## Appendix — the 77 functions `0101` moved from `search_path=""`

Captured on the local database at `0100`, 2026-09-24 (`scratchpad/dev056-before.txt`); `0101`'s rollback restores `''` on exactly these.

- `app.abandon_unauthorized_upload_intent(uuid)`
- `app.active_member_id(uuid)`
- `app.apply_communication_retention(integer)`
- `app.archive_project_sourced_requirement_item(uuid,uuid)`
- `app.assert_keyed_hmacs(text[],text[],text)`
- `app.bind_telegram_decision_return_prompt(uuid,uuid,uuid)`
- `app.bump_telegram_media_group_generation()`
- `app.claim_outbox_topic(text,integer,text,integer)`
- `app.claim_telegram_evidence_decision_attempts(integer,text,integer)`
- `app.claim_telegram_evidence_decision_token(text,bigint,bigint,bigint,bigint)`
- `app.claim_telegram_evidence_retries(integer,integer)`
- `app.claim_telegram_inbox(integer,text,integer)`
- `app.claim_telegram_media_groups(integer,integer)`
- `app.claim_upload_purge(integer)`
- `app.complete_telegram_delivery_outbox(uuid,uuid,uuid)`
- `app.complete_telegram_inbox(bigint,bigint,uuid,text)`
- `app.complete_telegram_media_group_claim(uuid,uuid,bigint,timestamp with time zone)`
- `app.complete_upload_purge(uuid,uuid)`
- `app.consume_telegram_binding_intent(text[],text[],bigint,bigint,text,text,bigint)`
- `app.consume_telegram_member_link_intent(text[],text[],bigint,text,text)`
- `app.enqueue_communication_delivery_outbox(uuid,uuid,uuid)`
- `app.enqueue_telegram_evidence_receipt(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid,uuid,timestamp with time zone)`
- `app.enqueue_telegram_evidence_receipt_0070(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid)`
- `app.enqueue_telegram_evidence_receipt_0071(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid,uuid,timestamp with time zone)`
- `app.enqueue_telegram_inbox_update(bigint,bigint,jsonb,text)`
- `app.enqueue_telegram_processor_outbox(uuid,uuid,text,uuid,bigint,text)`
- `app.erase_telegram_identity(uuid,bigint,text,text[],text[],text[])`
- `app.erase_telegram_identity_internal(uuid,bigint,text,text,text,text)`
- `app.exchange_external_grant(text,bytea,text,bytea,bytea,integer,integer)`
- `app.expire_telegram_evidence_choices(integer)`
- `app.expire_upload_intents()`
- `app.external_session_lineage()`
- `app.external_session_scope()`
- `app.fail_telegram_delivery_outbox(uuid,uuid,uuid,integer)`
- `app.fail_telegram_evidence_decision_attempt(uuid,uuid,text)`
- `app.fail_telegram_inbox(bigint,bigint,uuid,text)`
- `app.fail_upload_purge(uuid,uuid,text)`
- `app.finalize_telegram_evidence_decision_attempt(uuid,uuid,uuid)`
- `app.guard_communication_message()`
- `app.guard_communication_message_event()`
- `app.guard_occurrence_reference_image()`
- `app.guard_project_access_grant()`
- `app.guard_project_field_channel()`
- `app.guard_rule_reference_image()`
- `app.guard_telegram_chat_binding()`
- `app.guard_telegram_evidence_decision_attempt()`
- `app.guard_telegram_evidence_decision_token()`
- `app.guard_telegram_evidence_decision_token_v2()`
- `app.has_project_capability(uuid,uuid,text[])`
- `app.issue_telegram_evidence_decision_tokens(uuid,uuid,uuid,uuid,text,uuid,bigint,uuid,text,text)`
- `app.list_due_telegram_evidence_decision_controls(integer)`
- `app.prepare_telegram_decision_return_prompt(uuid,uuid)`
- `app.prepare_telegram_delivery(uuid,uuid,bigint,integer)`
- `app.prepare_telegram_delivery_with_markup(uuid,uuid,bigint,integer)`
- `app.prepare_telegram_evidence_decision_issue(uuid,uuid,uuid,uuid,text,uuid,bigint)`
- `app.project_has_grants(uuid,uuid)`
- `app.project_in_workspace(uuid,uuid)`
- `app.reconcile_telegram_evidence_legacy_decision(uuid)`
- `app.record_service_audit(uuid,text,text,text,text,text,jsonb,bigint,text)`
- `app.resolve_external_session(text,bytea,integer)`
- `app.resolve_telegram_chat(bigint,bigint)`
- `app.resolve_telegram_evidence_context(uuid,uuid,uuid,bigint,bigint)`
- `app.resolve_telegram_evidence_decision_context(uuid,uuid,uuid,uuid)`
- `app.resolve_telegram_evidence_return_reply(uuid,uuid,bigint,uuid,bigint)`
- `app.resolve_telegram_linked_member(uuid,bigint)`
- `app.retire_requirement_rule_version(uuid,uuid)`
- `app.retry_telegram_decision_inbox(bigint,bigint,uuid,text)`
- `app.retry_telegram_evidence_decision_attempt(uuid,uuid,text)`
- `app.revalidate_telegram_evidence_retry(uuid,uuid,uuid,uuid,uuid,bigint,bigint,bigint,uuid,timestamp with time zone,bigint,timestamp with time zone,uuid)`
- `app.set_project_field_channel_health(uuid,uuid,boolean)`
- `app.settle_telegram_evidence_attachment(uuid,uuid,text,uuid,text,uuid,uuid,timestamp with time zone,bigint,timestamp with time zone)`
- `app.stage_key_is_admissible(uuid,uuid,text)`
- `app.start_telegram_evidence_decision_attempt(uuid,uuid,uuid,bigint,text)`
- `app.terminalize_telegram_media_group_staged(uuid,uuid,uuid,timestamp with time zone,bigint,timestamp with time zone,text)`
- `app.upload_intent_scope_matches(uuid,uuid,uuid)`
- `app.upload_purge_health()`
- `app.write_erasure_audit(uuid,bigint,jsonb,text)`
