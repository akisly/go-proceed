# Telegram identity erasure — gate record

**Date:** 2026-09-03
**Branch:** `claude/d1-telegram-identity-erasure`, from `claude/d3-0-decision-slice` @ `7817abe` (merge base), PR #65 → `claude/d3-0-decision-slice`
**Plan:** [2026-09-02-telegram-identity-erasure.md](../2026-09-02-telegram-identity-erasure.md)
**Spec:** [2026-09-02-telegram-identity-erasure-design.md](../../specs/2026-09-02-telegram-identity-erasure-design.md)
**Predecessor record:** [2026-08-03-rename-slice3-gate.md](2026-08-03-rename-slice3-gate.md) — the most recent gate record in this directory; this slice's shape is copied from it directly, per this task's brief.

This record is Task 8 of the plan above. It writes the evidence the seven prior
tasks left owed, in the repository's own vocabulary — PASS / PASS (negative) /
PASS (assisted) / NOT PROVEN — environmental / NOT RUN — and states plainly
where execution diverged from the plan. HEAD at the time of writing is
`60959f8` (Tasks 1–7); this task adds one more commit on top, listed at the
end.

## Read this first: what has *not* happened

**Nothing in this record was pushed by the writer of this record.** CI ran
twice on this branch before this task started — once on an intermediate
commit, once on `60959f8` — and both are read below rather than re-triggered.
This task did not push and does not push; the branch's controller does.

**Two things a reader will otherwise take from this record that it does not
support.**

1. **`verify` is red on this branch, and stays red after this slice.** It was
   already red at the branch's own baseline — `4846e85`, the commit
   immediately before this slice's first `feat(erasure)` commit — with
   eighteen `apps/app` test failures that predate this work entirely (listed
   on PR #62). This record's job is to show the failure *set* is unchanged,
   not to claim `verify` passes. It does not.
2. **Retention is real code running against a table of NULLs.** `0081` ships
   the mechanism — the registry, the guard, the definer, the nightly cron job
   — and seeds `app.retention_policy` with three `NULL` durations. Every gate
   below that exercises retention does so with a duration *set inside the
   test*, never with a real one. No real duration has landed; see "The NOT
   PROVEN gates" below and `TODOS.md`'s new P2 section.

Every command in the tables and mutation sections below was run on this
machine, in this checkout, on 2026-09-03, while writing this record — migration
`0081` applied by hand as `postgres` (idempotent; re-applying after every
mutation is how the tree is proven clean again), never `supabase db reset`,
never a truncate.

## Evidence

| Gate | Result |
|---|---|
| `packages/testing` telegram-erasure §1–§5, locally at 0081 | **PASS** — 27 tests, green twice consecutively with no manual cleanup between runs |
| `packages/testing` telegram-rls, m5-external-rls | **PASS** — unchanged, 5 + 10 = 15 |
| `apps/app` erase-identity-cli | **PASS** — 5 tests (the plan's placeholder said 3; 5 is what runs and is what the rulings record) |
| `apps/app` typecheck | **PASS** — `tsc --noEmit`, 0 errors |
| `node scripts/validate-canonical-docs.mjs` | **PASS** — `canonical documentation: OK`, exit 0 |
| Mutation: §2 admission branch removed → "admits the exact redaction…" fails | **PASS (negative)** |
| Mutation: `app.erasure_subject` comparison removed → "refuses the redaction of a message that is not the subject's" fails | **PASS (negative)** |
| Mutation: both retention branches forced to scope `'all'` → both class-confinement bystander cases fail | **PASS (negative)** |
| Script `telegram-erase-identity.mjs` against an absent workspace | **PASS (negative)** — exit 1, FK-violation message, pepper absent from output |
| CI run [`33696166331`](https://github.com/akisly/go-proceed/actions/runs/33696166331) (commit `60959f8`) | **PASS (assisted)** — `verify` red with exactly the baseline's 18 pre-existing `apps/app` failures, none from this slice; this slice's own suites (`telegram-erasure.test.ts`, `erase-identity-cli.test.ts`) ran and passed in the run; `app-qa` green |
| The isolated `apps/app` int suites, locally | **NOT RUN** — their `beforeEach`/`beforeAll` calls `truncateAll()` against the only local database this checkout has, which would destroy state this record and every other local check depend on; verified by reading `apps/app/tests/helpers/fixtures.ts` and the suites that import it, not run |
| Retention under a real duration, in a real environment | **NOT PROVEN — environmental** — every retention gate above sets its own duration inside the test transaction; no row of `app.retention_policy` carries a non-NULL duration anywhere this task observed, and none should until an owner picks one (`TODOS.md`, new P2 section) |

The suite figure for `packages/testing` is this task's own run, twice in a row,
immediately after applying `0081` by hand — not transcribed from an earlier
task's report. The CI figure is read from the run's own log, not assumed from
a green icon on the PR page.

## The NOT PROVEN gates, with the exact command that settles each

Two rows above are not simple passes. Both are named with what would close
them, not left as a bare "no".

- **The isolated `apps/app` int suites** (`tests/telegram-evidence.int.test.ts`,
  `tests/telegram-delivery.int.test.ts`, `tests/project-communications.int.test.ts`,
  `tests/upload-intents-finalize.int.test.ts`, and the rest of `apps/app/tests/*.int.test.ts`)
  are gated on `hasIsolatedDatabaseCredentials()` and skip themselves without
  it (`describe.skip`, per commit `205c445` on this branch). CI supplies that
  credential and a database CI owns exclusively; a local checkout sharing one
  Postgres with other work does not, and running them here would call
  `truncateAll()` against the database this record's own mutation checks were
  just run against. The command that settles them is CI's own:
  ```
  $ grep -n 'hasIsolatedDatabaseCredentials' apps/app/tests/telegram-evidence.int.test.ts
  20:const databaseDescribe = hasIsolatedDatabaseCredentials() ? describe : describe.skip;
  ```
  and CI running `pnpm turbo run test --concurrency=1` against its own
  database is exactly what run `33696166331` did — see the CI row above,
  which is why these suites are NOT RUN rather than NOT PROVEN: what settles
  them already ran, just not in this checkout.
- **Retention under a real duration** — the command is a migration, not a
  test: `update app.retention_policy set duration = <interval> where
  data_class = '<class>'` for each of `customer_communication`,
  `customer_identity`, `operational_security`, landed by the owner once a
  number is chosen. Nothing in this slice can settle this gate, because the
  slice's whole design is to ship the mechanism inert until that owner
  decision (`TODOS.md`, new P2 section, cites the exact catalog rows and the
  two tables the catalog does not cover at all).

## Mutation checks

Three mutations, each performed by redefining the target function directly in
the running database with `create or replace function ...` via `psql`, never
by editing a file in the tree, then running the one test the mutation should
break, then re-applying `supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql`
verbatim and re-running the full suite to confirm the tree's own state is
restored.

1. **§2 admission branch removed.** `app.guard_communication_message()`
   redefined with the entire first `if` block deleted — the DELETE raise and
   the immutability check are the only thing left. Ran
   `pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts -t "admits the exact redaction"`:
   ```
   × §2 — the message guard admits the redaction and nothing else > admits the exact redaction of the subject's message under the markers
   AssertionError: expected 'P0001' to be 'ok'
   ```
   Restored by re-applying `0081`; `telegram-erasure.test.ts` full file back
   to 27/27.

2. **`app.erasure_subject` comparison removed.** Same function redefined with
   only the clause `and old.provider_user_id::text = current_setting('app.erasure_subject', true)`
   deleted from the admission branch — every other condition, including the
   surrogate check, left in place. Ran
   `pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts -t "refuses the redaction of a message that is not the subject's"`:
   ```
   × §2 — the message guard admits the redaction and nothing else > refuses the redaction of a message that is not the subject's
   AssertionError: expected 'ok' to be 'P0001'
   ```
   The direction inverts, as expected for a refusal test under a mutation
   that removes the very check the test exists to pin. Restored; 27/27.

3. **Both retention branches forced to scope `'all'`.** `app.apply_communication_retention`
   redefined with its two calls to `app.erase_telegram_identity_internal`
   changed from `'communication'` / `'identity'` to `'all'` — everything else
   copied verbatim from the migration. Ran
   `pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts -t "class confinement"`:
   ```
   × §5 — retention by age > redacts a sender whose messages are older than the customer_communication duration, … (class confinement)
   AssertionError: expected { …(11) } to deeply equal { …(11) }
     - "display_name_snapshot": "Іван Старий",       + "display_name_snapshot": null,
     - "revoked_at": null,                            + "revoked_at": 2026-09-02T23:44:13.445Z,
     - "telegram_user_id": "700003",                  + "telegram_user_id": "-283587073700090880",
   × §5 — retention by age > redacts a member link whose revocation is older than the customer_identity duration, … (class confinement)
   AssertionError: expected { …(29) } to deeply equal { …(29) }
     - "text": "Свіже повідомлення",                  + "text": "[текст стерто на запит]",
     - "provider_user_id": "700004",                  + "provider_user_id": "-2603334535355923456",
   ```
   Both bystander cases fail — the `customer_communication` run now also
   revokes and rewrites the sender's untouched member link, and the
   `customer_identity` run now also redacts the sender's fresh message —
   exactly the cross-class leak the scope argument exists to prevent.
   Restored; `telegram-erasure.test.ts` + `telegram-rls.test.ts` +
   `m5-external-rls.test.ts` back to 42/42.

No mutation left the mutated function in place after its check; each is
followed immediately by re-applying the migration file, and the database was
confirmed green on the full local suite (42/42) as the last step before this
record was written, and again after the script check below (which touches no
schema).

**Script against an absent workspace**, run for real, not mocked:
```
$ SERVICE_DB_URL=postgresql://goproceed_service_login:service_pw@127.0.0.1:54322/postgres \
  TELEGRAM_LINK_PEPPER=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  node scripts/telegram-erase-identity.mjs --workspace 00000000-0000-4000-8000-000000000abc --telegram-user-id 123456789
insert or update on table "telegram_erasures" violates foreign key constraint "telegram_erasures_workspace_id_fkey"
$ echo "exit=$?"
exit=1
```
The pepper string does not appear in the output — checked by grepping the
captured output for the literal pepper (0 matches) — consistent with the
script's own comment that the pepper never leaves the process.

## What this slice does not make true

- **`verify` passing.** It does not, before this slice or after it. This
  slice's evidence is that the *set* of failures did not grow, not that CI is
  green.
- **Any retention actually running.** `0081` ships a cron job that runs every
  night and does nothing, for every class, until an owner sets a duration.
  Nothing in this record or in CI has ever exercised
  `app.apply_communication_retention` against a real, owner-approved
  duration — only against durations the tests themselves set and unset.
- **Workspace closure.** `0081` and this slice erase one Telegram identity —
  by request or by age — not a workspace. M0 gate 4's first checkbox in
  `docs/delivery/production-readiness.md` §4 stays open; the identity-level
  procedure is `infra/README-staging.md` §7, and that is the whole of what
  exists.
- **Erasure that cannot be replayed by a trusted session acting alone.** A
  `goproceed_service` session can set both transaction-local markers and
  issue the admitted UPDATE directly, bypassing the registry and the audit
  row — a property of the guard recognising a transformation shape rather
  than gating on having gone through the definer, and of the service plane
  being the trust boundary. Tested on the rejection path only. Parked in
  `TODOS.md` as a design note for any future route built on top of the
  service plane for this.
- **A raw Telegram id gone from every table once a subject is erased.**
  `telegram_binding_intents.consumed_by_telegram_user_id` and
  `telegram_member_link_intents.consumed_by_telegram_user_id` are untouched
  by a request-driven erasure and reachable only through
  `operational_security`'s age-based delete, which is NULL today. Parked in
  `TODOS.md`, P2.
- **§2/§3's guard branch as a general-purpose "trusted write" bypass.** It
  recognises exactly one transformation, byte for byte; `DA-148`'s column
  grant and every other write path this migration does not touch stand
  exactly as they did before it.

## Deviations from the plan

Eight rulings changed the shipped shape against what the plan wrote, made
during Tasks 1–7 and recorded in full in
`.superpowers/sdd/2026-09-02-telegram-identity-erasure/task-8-rulings.md`
(git-ignored). In prose, not by line number, because that ledger is not part
of this repository's tracked history:

- The wrapper `app.erase_telegram_identity` **checks** the declared workspace
  against `app.service_workspace()` and raises on a mismatch, rather than
  **setting** `app.organization_id` the way the plan wrote — matching the
  codebase's existing convention (`app.record_service_audit`) and leaving
  room for a future `/v1` route to sit on the definer.
- The internal function carries a fifth argument, **a scope** —
  `'all'` / `'communication'` / `'identity'` — that confines retention's two
  age-based branches to their own catalog tables; the plan's four-argument
  overload does not exist in the shipped migration.
- **Retention classes reach only their own catalog tables** — clarified in
  the spec itself (§7.5) after a Task 5 review reproduced a case the plan's
  original wording did not rule out: an active member link surviving a
  message-text-duration sweep, and a fresh message surviving a
  link-revocation-duration sweep. Both are pinned as the two mutation-check
  bystander cases above.
- **`erased_at` holds the first erasure's timestamp** — a repeat call no
  longer overwrites it.
- **Retention restores `app.organization_id`** to whatever the caller's
  transaction already had, rather than blanking it, so a nested call inside a
  caller's own transaction is not observed to have cleared a setting it did
  not own.
- **Terminal inbox rows age by `coalesce(processed_at, received_at)`**, so a
  terminal row that somehow carries a NULL `processed_at` is not immortal.
- **`0081` was applied by hand as `postgres`**, not `supabase_admin` — a
  `supabase db reset` in this environment creates objects as `postgres`, and
  a superuser hand-apply under the other role broke owner-only semantics and
  test teardown locally. Local objects were re-owned by hand to match; this
  record's own re-applications all ran as `postgres` for the same reason.
- **The operator script takes an optional `clientFactory`** so `erase()` is
  unit-testable without a database — the query order and the
  rollback-then-rethrow path are pinned by `erase-identity-cli.test.ts`
  against a fake client, not against Postgres.

**Tests added beyond the plan**, all inside the two test files this slice
owns: failure-before-any-write, tenant-mismatch, and scope-validation cases
in §4; a live `customer_identity` case with a same-subject recent message as
bystander and a live `customer_communication` case with a same-subject active
link as bystander in §5 (these are exactly the two mutation-check targets
above); an `affected`-count pin; batch-argument validation; a second-run
allocates-no-surrogate case; unconditional inbox-seed cleanup in `afterAll`;
and, in the CLI test file, the query-order and rollback-then-rethrow cases
against a fake client.

**Parked findings**, recorded for the owner rather than fixed in this slice —
each now also carries its own `TODOS.md` entry where the finding needs a
decision rather than a code change:

- A `goproceed_service` session can set both markers itself and issue the
  admitted UPDATE directly, bypassing registry and audit.
- The raw Telegram id survives in the two intent tables'
  `consumed_by_telegram_user_id` columns until `operational_security` has a
  duration.
- An already-erased re-run still writes an audit row (`already_erased =
  true`, zero counts) — an attempt is auditable, by design, not a bug.
- The database cannot validate the HMAC-to-identifier binding, because the
  pepper never reaches it; a wrong HMAC from the operator registers a second
  surrogate. An operator-script bug class, not a database one.
- `customer_communication`'s candidate query aggregates
  `communication_messages` without a supporting index — fine at pilot
  volume, not fine forever.
- Two small test-side items, brief-verbatim: `client.connect()` sits outside
  a `try`/`finally` in the script (`pg` self-cleans on process exit); an
  unused `QueryResult` import in the test file.

## Commits

| # | Commit | What |
|---|---|---|
| 1 | `3ffb03e` | §1 — the surrogate registry and the retention policy, in schema `app` |
| 2 | `fa09bd9` | §2 — the message guard admits the redaction, and nothing else |
| 3 | `c08503e` | §3 — edit events get a guard of their own |
| 4 | `450f9a6` | §4 — one identity, erased on request |
| 5 | `a1015f7` | §4 fix round — registry teardown cleanup, and the failure-before-transformation case |
| 6 | `2b63c92` | §4 teardown — plain `admin.query`, no shell-out |
| 7 | `d0996d5` | plan correction — apply `0081` by hand as `postgres` |
| 8 | `af3ab92` | §4 fix round 3 — wrapper checks the tenant, `erased_at` holds, real failure assertions |
| 9 | `551ddd6` | §5 — retention by age, inert until a duration lands |
| 10 | `92f1e2a` | §5 fix round — live `customer_identity` case, second-run registry-count pin |
| 11 | `607365b` | spec — retention classes reach their own tables, and only those |
| 12 | `2852c6b` | fix — §4/§5 retention classes confined to their catalog tables via a scope |
| 13 | `c73a38b` | spec — a retention surrogate is per subject per class, and says so |
| 14 | `7e83c41` | the operator's entry — `telegram-erase-identity.mjs` |
| 15 | `531762c` | `erase()` — query order and rollback-on-failure, with a fake client |
| 16 | `60959f8` | the paperwork the schema rests on — DA-159, DA-160, INV-099, the procedure, two gate entries |
| 17 | *(this commit)* | this record, and the residuals it hands to `TODOS.md` |

Measured against the branch's own baseline `4846e85` (the plan/design commit,
immediately before commit 1 above): `11 files changed, 1365 insertions(+), 16
deletions(-)` through `60959f8`; the four files this task's own verification
touched most directly — the migration, the two new test files, and the
operator script — total `1268` of those insertion lines on their own.

CI observed two commits on this branch: `531762c` (Tasks 1–6, run
`33695254598`, `verify` failed for the same pre-existing reason `4846e85`'s
baseline run `33685727480` did) and `60959f8` (Tasks 1–7, run `33696166331`,
detailed in the Evidence table above). Both read against the same baseline
failure set; neither shows a new failure this slice introduced.
