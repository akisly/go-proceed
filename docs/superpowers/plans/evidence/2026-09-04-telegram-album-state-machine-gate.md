# Telegram album state machine — gate record

**Date:** 2026-09-04
**Branch:** `claude/vigorous-elbakyan-0f49e5`, from `main` @ `8aab0a2` (the merge of PR #68), PR → `main`
**Inherits:** `TODOS.md` «P1 — eighteen `apps/app` cases fail in CI…», subsection «What the deep session on the album state machine inherits» — the eleven cases and what PR #68 measured
**Spec:** [2026-08-28-telegram-project-channel-design.md](../../specs/2026-08-28-telegram-project-channel-design.md) §§ Evidence media, 6.3, 8.3, 8.4, 11
**Predecessor record:** [2026-09-03-telegram-identity-erasure-gate.md](2026-09-03-telegram-identity-erasure-gate.md) — this record copies its shape and vocabulary (PASS / PASS (negative) / PASS (assisted) / NOT PROVEN / NOT RUN)

This record closes the eleven cases of `apps/app/tests/telegram-evidence.int.test.ts`
that PR #68 left red, one root cause each. Seven were answered in the test
file (an expectation that predated a designed behaviour, or a fixture that
carried its own bug); four were answered in the code, by two migrations and
one rewrite, and the test kept. No expected number was changed without
tracing what the code produces and why; where the number changed, the
commit cites the design paragraph the new number rests on.

## Read this first: the two facts underneath nine of the eleven

**1. The service plane cannot read member-plane tables inline.**
`public.memberships`, `project_access_grants`, `requirement_occurrences`,
`project_field_channels`, `work_assignments` carry policies `to goproceed_app`
only, keyed on `app.current_actor()`. `goproceed_service` is an INHERIT
member of `goproceed_app` (`pg_auth_members`), so those policies bind a
service transaction too, and a service transaction always runs with an
empty actor. Measured 2026-09-04 on the local stack at 0081, as
`goproceed_service_login` with `set local role goproceed_service`, the
workspace GUC set to the one organization present and the actor empty:

```
org=set memberships 0          (admin sees 1)
org=set project_access_grants 0
org=set requirement_occurrences 0
org=set project_field_channels 0
```

and, probed inside the anchor case with a temporary `console.log` (not
committed), every `communication_messages.author_member_id` and the album's
`telegram_media_groups.uploader_member_id` was `NULL`. 0080's header had
already named this mechanism for one policy; the reads it also broke were
`processor.ts` `linkedMemberId` (every inbound author), the callback
locator's `memberships` join, the retry claim's four joins and the retry
revalidation's three.

**2. A service transaction with no workspace declared sees nothing at all.**
Every telegram service policy is `workspace_id = app.service_workspace()`,
and `app.service_workspace()` is `nullif(current_setting('app.organization_id'),'')`.
With `organizationId: null` that is `workspace_id = NULL`. Measured the same
way with the GUC empty: `communication_attachments`, `telegram_requirement_choice_sessions`,
`telegram_media_groups`, `telegram_member_links`, `organizations` — each
counts 0. The album claim and the inbox claim never noticed because they go
through SECURITY DEFINER functions; the choice callback and the retry claim
ran inline and found nothing — TODOS.md's «the locator finds no session by
token_hash although the stored hash equals SHA-256 of the token» and «zero
already at `communication_attachments` with `state='processing'`» were both
exact measurements of this.

## The eleven, each with its root cause

| # | Case | Root cause | Fix | Commit |
|---|---|---|---|---|
| 1 | uses the exact delivered card… | The third delivery is the accept/return keyboard (design §8.4; landed 19f05ff on 2026-08-31, after the case counted two) | test — names the keyboard, expects 3 | `373b46b` |
| 2 | enqueues one canonical unbound receipt on replay… | (a) the unbound receipt was still queued when `deliverCard()` counted the batch; (b) `expires_at` alone into the past violates CHECK `expires_at > created_at`; (c) then `uploader_member_id` NULL → 0070's recipient check raised | test for (a)(b); code for (c) via 0082 | `6fc6101`, `a02d93f` |
| 3 | never downloads unsupported, quota-refused, or revoked media… | Four outbound texts the design asks for (§8.3), counted as two when only the ready path spoke (49ab4ce); a revoked link on a live card is refused evidence, not `unbound` (§11; a145414) | test — asserts the four texts and `not_evidence`/`evidence_authorization_failed` | `c73385e` |
| 4 | binds opaque multiple-occurrence choices… | CHECK violation on expiry; an expired choice is terminal under 0071 (§8.3 «the user must reply again»); fixture message lacked `author_member_id`; then the positive select was refused (fact 2) | test for the three premises; code for the select | `a3e68e5`, `43c4175` |
| 5 | waits two seconds for a three-image album… | Callback locator ran with no workspace declared (fact 2) and joined `memberships` (fact 1) | code — `selectTelegramOccurrence` resolves the chat through `app.resolve_telegram_chat`, adopts the workspace, resolves the uploader through 0082 | `43c4175` |
| 6 | retains successful album evidence… | Downstream of 5 | code (same) | `43c4175` |
| 7 | fences an expired prepared album worker… | Claim read with `select *` → millisecond Dates → fences never matched; then two statements in one prepared query | test — reads the claim `::text`, one statement per query | `1a4c0a0` |
| 8 | authorizes every album part against the same card anchor and uploader | `linkedMemberId` inline join to `memberships` found no one (fact 1): author and uploader NULL, 0071's uploader check compared NULL with NULL, the other member's part was downloaded | code — migration 0082 `app.resolve_telegram_linked_member`, `linkedMemberId` calls it | `a02d93f` |
| 9 | reports a previously-terminal album with mismatched common context… | PDF parts are terminal `unsupported_media` at store time (design: PDFs never evidence); 0071's context classification runs on `staged` parts only; no revision ever produced `album_anchor_mismatch` for this fixture | test — expects the reason the parts carry, full receipt text | `a8e2e0d` |
| 10 | waits for retryable album parts… | Retry claim ran with no workspace (fact 2) and joined four member-plane tables (fact 1); revalidation joined three (fact 1) | code — migration 0083 `app.claim_telegram_evidence_retries`, `app.revalidate_telegram_evidence_retry` | `c6e354b` |
| 11 | does not download due retries after identity relink… | Same as 10; plus two fixture defects (receipts queued before the second card; two statements in one query) | test for the fixture; code via 0083 | `920a72e`, `c6e354b` |

Not touched, because they were not red: the other nine cases of the file,
and the four cases in other files that PR #68 closed.

## Evidence

Every command below was run on this machine, in this checkout, on
2026-09-04, against the local Supabase database (Docker Desktop started for
the purpose; migrations 0082 and 0083 applied by hand as `postgres`, each
with a ledger row; never `supabase db reset`; the database held one
organization and no projects before the first run). The four isolated URLs
were set as CI sets them.

| Gate | Result |
|---|---|
| `apps/app/tests/telegram-evidence.int.test.ts`, the whole file | **PASS** — 20/20 (was 9/20 at `8aab0a2`: the eleven named in TODOS.md, reproduced first, none other) |
| `packages/testing/src/telegram-rls.test.ts` (0082 and 0083 pins added) | **PASS** — 15/15 (was 5) |
| `apps/app/src/lib/telegram/schema-contract.test.ts` | **PASS** — 11/11 (one case moved to read 0083, one added for the claim's lock order) |
| Full workspace suite, `pnpm turbo run test --concurrency=1`, twice in a row, no manual cleanup between | **PASS** — both runs exit 0: contracts 136, discovery 73, domain 102, testing 676, mobile 150, database 7, landing 46, app 1210 (2400 tests each run), nothing skipped that CI runs, nothing cleaned between |
| `pnpm --filter @goproceed/app typecheck` | **PASS** — `tsc --noEmit`, 0 errors |
| `node scripts/validate-canonical-docs.mjs` | **PASS** — `canonical documentation: OK` |
| Mutation: `app.resolve_telegram_linked_member` redefined to return no row → «authorizes every album part…» red | **PASS (negative)** |
| Mutation: `adoptServiceWorkspace` call removed from `selectTelegramOccurrence` → «waits two seconds for a three-image album…» red | **PASS (negative)** |
| Mutation: `app.revalidate_telegram_evidence_retry` redefined to `select false` → «waits for retryable album parts…» red | **PASS (negative)** — after the case was strengthened; see below |
| The eleven, each traced to what the code produces before the assertion was touched | **PASS** — the two probes under «Read this first» and the per-case history in the commits (`git log -L` on each changed line; `git log -S` on each moved branch) |
| CI on the PR, read against the eighteen-case baseline run `33685727480` | **PASS** — run [`33870171989`](https://github.com/akisly/go-proceed/actions/runs/33870171989) on PR #69: `verify` success, `app-qa` success; see «CI reading» below |

The first two full-suite passes made while writing this record (14:29 and
14:37) each had exactly one red case, `schema-contract.test.ts` «revalidates
persisted retry identity…», which pinned the revalidation predicate as text
inside `processor.ts` after 0083 had moved it; fixed in `2c8023c` and the
suite run twice again from the final tree — the row above is that pair.

## Mutation checks

Three mutations, each made against the running database with `psql` (never
by editing a file in the tree) or by a one-line edit to `evidence.ts`
reverted with `git checkout`, then the one case the mutation should break
run alone, then the migration re-applied verbatim (dropping the mutated
function first — `create function` in 0082/0083 does not replace) and the
case run again.

1. **`app.resolve_telegram_linked_member` returns no row.** Redefined as
   `select null::uuid, null::uuid where false`. Ran «authorizes every album
   part against the same card anchor and uploader»:
   ```
   × … authorizes every album part against the same card anchor and uploader
   AssertionError: expected [ 'anchor-ok', 'uploader-other' ] to deeply equal [ 'anchor-ok' ]
   ```
   — the exact red the case showed on `main`. Restored (drop, re-apply
   0082; `pg_language` confirms plpgsql again); green.

2. **`selectTelegramOccurrence` does not declare its workspace.** The
   `adoptServiceWorkspace(tx, bound.workspace_id)` line replaced by a
   comment. Ran «waits two seconds for a three-image album…»:
   ```
   AssertionError: expected 'rejected_requirement_choice' to be 'selected_requirement_occurrence'
   ```
   — the exact red the case showed on `main`. `git checkout` of the file;
   green.

3. **`app.revalidate_telegram_evidence_retry` answers false.** First
   attempt with `create or replace` failed to apply (parameter names), so
   the case's green meant nothing; redone with `drop` then `create`. The
   case STAYED GREEN: a retry refused before download is settled `failed`
   and writes a receipt naming 790 too, and the case counted receipts
   naming 790. Strengthened in `f120495` to assert the second download, the
   attachment `available`, and the `telegram.evidence.complete` copy key;
   under the mutation:
   ```
   AssertionError: expected [ 'retry-once' ] to have a length of 2 but got 1
   ```
   Restored (drop both 0083 functions, re-apply 0083); green.

No mutation left the mutated function in place; the final full-suite pair
was run after the last restoration.

## CI reading

Run [`33870171989`](https://github.com/akisly/go-proceed/actions/runs/33870171989)
(PR #69, head `f120495` plus the docs commit), read from the run's own log
(`gh run view --log`, ANSI stripped), not from the icon:

| Package | CI | Local (each of the two final runs) |
|---|---|---|
| contracts | 136 passed | 136 |
| discovery | 73 passed | 73 |
| mobile | 150 passed | 150 |
| testing | 676 passed | 676 |
| domain | 102 passed | 102 |
| landing | 46 passed | 46 |
| database | 7 passed | 7 |
| app | 1210 passed | 1210 |

`tests/telegram-evidence.int.test.ts (20 tests)` ✓ in 5342 ms — it ran, it
was not `describe.skip`ped; `src/telegram-rls.test.ts (15 tests)` ✓;
`src/lib/telegram/schema-contract.test.ts (11 tests)` ✓. Zero `×` marks in
the log. Against the eighteen-case baseline run `33685727480` (PR #63) and
PR #68's eleven (run `33811646042`): no remaining title. `verify` is green
on this branch for the first time since the isolated suites started running
in CI (PR #62).

## Deviations

- **The reproduction ran on this machine, not only in CI.** The brief allowed
  it and named the conditions: the local database held one organization and
  no projects before the first run (the same state the 2026-09-03 session
  recorded), so the suites' `truncateAll()` destroyed nothing the owner
  needs. Docker Desktop was not running and was started (`open -a Docker`);
  the Supabase containers came up on their own. Migrations 0082 and 0083
  were applied by hand as `postgres` with a ledger row each; `supabase db
  reset` was never run.
- **Two migrations, not one.** Each carries one root cause and names the
  test it answers (CLAUDE.md's rule for QA-owned migration commits): 0082
  the linked-member resolver, 0083 the retry claim and revalidation.
  Neither adds a policy or a table grant; both are SECURITY DEFINER
  functions in the shape of 0062/0071/0078, with `EXECUTE` to
  `goproceed_service` only. Auth code was not touched.
- **Item 9 kept its PDFs.** TODOS.md suggested sending `image/png` «if the
  case is about context». Read against the design, a PNG variant becomes
  either a choice prompt (two occurrences) or a partial receipt after a
  download (one occurrence) — neither is «previously-terminal» nor «no
  download», so it would have been a second copy of item 8. The case keeps
  its fixture and its shape, and asserts the reason its parts truly carry.
- **Item 3's quota code is `upload_size_limit`, not «quota exhausted».**
  That is the code `authorize-upload-intent.ts` raises for an exhausted
  organization quota (the same `UPLOAD_SIZE_LIMIT` problem as the
  per-file ceiling); the receipt carries it lowercased. Renaming it is a
  product decision, not this slice's.
- **`vitest -t` with `|` matched one title, not several,** on this
  machine; every multi-case check below was made by running the whole file.
- **TODOS.md P1 is marked closed in the section header,** with a paragraph
  pointing here; the measured inheritance list below it is kept as the
  record of what was measured before the fix. P3 (the `origin_method` pin
  owed once this suite is green) is left for its own slice.

## What this slice does not make true

- **That the decision keyboard, once delivered, is exercised here.** Item 1
  asserts the third message is the keyboard; the decision path itself is
  pinned by `telegram-decisions` suites, not this file.
- **That every service-plane inline read of a member-plane table is gone.**
  The four this slice met are. `reconcileTelegramEvidenceReceipt` still
  LEFT JOINs `requirement_occurrences` and falls back to the card's
  assignment; the receipt RPC recomputes the expected assignment inside a
  definer, so the receipt is right, but the fallback is a read that sees
  nothing. Named in `TODOS.md`'s parked findings would be the next step;
  not done here, because no case is red for it.
- **That `verify` is green in CI.** It is the goal of the PR this record
  belongs to; the CI row below says what the run showed.
