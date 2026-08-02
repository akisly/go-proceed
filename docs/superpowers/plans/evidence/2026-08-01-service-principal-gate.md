# v0.1-M2 service-principal gate record

**Date:** 2026-08-01
**Branch:** `claude/m2-service-principal` (8 commits ahead of `main`)
**Baseline:** `main` @ `6e91000` (merge of PR #5, `claude/m2-superpowers-brainstorm-6e5ec1` — the v0.1-M2-A work recorded in
[2026-07-31-m2a-gate.md](2026-07-31-m2a-gate.md))
**Plan:** `.superpowers/sdd/2026-08-01-goproceed-v0.1-m2-service-principal/` (four tasks: role and login, a second connection pool, the database refusing the old path, this record)

## What this slice is

Four tasks, executed in order, each reviewed before the next began:

1. A new database role `aktflow_service` (`NOLOGIN`, `NOBYPASSRLS`, member of
   `aktflow_app`) and a login `aktflow_service_login` (`LOGIN`, `NOINHERIT`,
   member of `aktflow_service` only). `aktflow_app_login` is **not** a member
   of `aktflow_service`; `SET ROLE aktflow_service` from the application login
   fails with `42501`. Migration `0034_service_principal_role.sql`.
2. A second connection pool and transaction helper in `packages/database`
   (`getServicePool()`, `withServiceTx()`) so the application can act as the
   service principal for specific writes without granting the application
   login that identity outright. The finalize route now reads and authorizes
   on the application connection and makes every post-inspection write on the
   service connection.
3. The database refusing the old path: migration
   `0035_server_facts_are_service_only.sql` makes
   `app.finalize_upload_intent` raise unless
   `pg_has_role(session_user, 'aktflow_service', 'member')`, and splits the
   capture-event insert policy — `ce_insert` (to `aktflow_app`) now requires
   `event_source = 'device'`; a new `ce_insert_server` (to `aktflow_service`)
   requires `event_source = 'server'` and an existing intent that agrees on
   workspace and project.
4. This record: closing the two TODOS.md items the service principal was
   built to close, correcting the M2-A gate record to say so, and stating
   plainly what the work does and does not buy.

## Evidence

| Gate | Result |
|---|---|
| Migrations | `0034`–`0035` added; all **35** apply from a clean `supabase db reset` |
| Serialized suite | `pnpm turbo run test --concurrency=1 --force` — 6/6 tasks, **618 tests**: app 246, demo 134, testing 128, domain 98, contracts 6, database 6 |
| Typecheck | `pnpm typecheck` — 8/8 |
| Build | `pnpm build` — 3/3 |
| Canonical docs | `node scripts/validate-canonical-docs.mjs` — OK |

The suite figure is Task 3 Step 8's forced run against that task's HEAD
(`d1f0cdc`) on a clean `supabase db reset`, unchanged by this task, which
edits no code. `@aktflow/testing` carries the delta against the M2-A
baseline: 122 → 128, the six tests this slice's Tasks 1–3 added (four for the
role/login shape, one for `withServiceTx`, one more folded into the binding
hardening suite); every other package is unchanged.

## TODOS.md items closed

Both were opened by the v0.1-M2-A review (2026-07-31) as depending on "the
same service-principal work," to be done together — which this slice did:

- **P1 — nothing proves inspection actually ran.** `app.finalize_upload_intent`
  took `inspection_status` from its caller, and the database could not tell
  the server's verdict from a member's claim about their own upload, because
  both arrived as `aktflow_app`. Closed by the service-only guard in `0035`.
- **P2 — capture_events cannot tell the server's assertion from a member's.**
  `event_source` could be set to `'server'` by any member with
  `evidence.record`. Closed by the `ce_insert` / `ce_insert_server` policy
  split in `0035`.

Both are marked `CLOSED` in `TODOS.md` with a note pointing back to this
record, and neither entry's original text was deleted.

## Mutation checks (Task 3 Step 7)

Three checks, each performed by hand-editing the running database and
re-running the suite, then restoring with `supabase db reset`. Each broke
exactly one test, and it was the right one:

1. **Definer guard removed** (`app.finalize_upload_intent` recreated without
   the `pg_has_role` check) — only *"refuses a member creating evidence, even
   with every capability"* failed (`expected '' to match /service/i`).
2. **`ce_insert`'s `event_source = 'device'` clause replaced by `true`** —
   only *"refuses a member claiming an event came from the server"* failed
   (`expected '' to be '42501'`).
3. **`ce_insert_server` dropped** — only *"lets the server record what the
   server did"* failed (`expected '42501' to be ''`), because the server's
   own write then falls through to the tightened `ce_insert` and is refused.

No mutation disturbed a test other than the one that names the mechanism it
removed, and each was applied and reverted independently.

## What this does not buy

> A compromised application process holds both credentials. This closes SQL
> injection and a member with database access. It does not close code execution
> in the web process.

> It does not prove inspection ran correctly. It proves the row was written from
> the server's own connection rather than a member's. `inspection_status =
> 'passed'` continues to mean "the magic bytes matched the declared type", and
> v0.1 still ships no scanner.

## Operations step NOT performed

Staging and production need `SERVICE_DB_URL` and a real credential set by an
operator before any deploy — `scripts/set-local-app-password.mjs` only sets
both logins' *local* passwords, and `SERVICE_DB_URL` in
`apps/app/.env.example` and in the CI verify job are development/CI values,
not a claim about any deployed environment. Nothing in CI proves that
operator step happened; it is recorded here as outstanding, not as done.

## Known limitation this record does not close

`ce_insert_server`'s intent-linkage check constrains workspace and project
agreement but carries no ownership clause — the service connection is
trusted for scope, by design, because the server acts on intents it did not
create. Noted in the Task 3 report as worth a reviewer's eye; not a defect in
this task, and not reopened here.
