# TODOS

Deferred findings from the post-implementation engineering review of v0.1-M1
(2026-07-31). The P1/P2 findings from that review were fixed on the milestone
branch; everything below was consciously deferred. Each item cites the code so
it can be picked up cold.

## What the M1–M6 build and the work-type carrier did to this file (2026-08-08)

Nine slices landed between 2026-08-06 and 2026-08-08 — M1 through M6, plus the
work-type carrier — adding migrations `0041`–`0050` and taking the v0.1 route set
to all 58 operations. Migration `0051`, the unimplied-stage-key guard, followed on
2026-08-08 out of the whole-build audit, so **the unapplied chain is `0041`–`0051`,
eleven files**. **None of it has been executed**: not one of the eleven has ever
been applied anywhere and no test in this repository has been run. This
section says what that build did to the entries below, so a reader does not have
to diff it themselves.

*Two counts elsewhere in the package still say ten and were not in this pass's
remit: `docs/delivery/version-0.1.md:178` («Ten of those fifty files have never
run» — eleven of fifty-one) and `docs/delivery/production-readiness.md:150` («the
ten migrations»). The count in the progress document's §7 runbook was corrected
on 2026-08-08 and now names `0051` among the files a `supabase db reset` would
execute for the first time.*

**Closed by the build**

- The M2 migration comment correction that `docs/delivery/version-0.1.md`
  §"Corrections owed elsewhere" carried as its last open row —
  `0043:808-814` and the column comment at `0043:839-841` now say the FK is added
  in `0043`, that `0015:251` said M3, and that `requirement_occurrences` is M2.
- The "`technical/openapi/README.md` still states 72 operations" half of the
  README entry below: it states **58**.
- `rule_bindings.manage` was in no responsibility preset, so no persona could bind
  a rule-version set and INV-083 refused every publication forever. It is now on
  `requirement_owner` and on `pto_engineer`.
- INV-083's second route: `import_batches.publish` published a baseline with no
  bindings at all. It now takes `ruleVersionIds` and refuses an empty set with the
  same code and user action as the manual route.

**Changed in shape rather than closed — each entry below is annotated in place**

- **P1 valuation redistribution.** [ADR-008](docs/decisions/ADR-008-valuation-carves-at-admission.md)
  narrows the window but does not close it, and says so in its own Consequences.
- **P3 responsibility assignments can never be ended.** Its stated dependency —
  "the append-only correction pattern M3 introduces" — has landed.
- **P3 dead surface added by the M1 migrations.** M4 and M5 turned it from a
  tidiness item into a blocker.
- **P1 the GoProceed rename.** The counts are unchanged and the **command that
  produces them has gone partly blind**.

**Created by the build, and not fixed** — seven entries, at the end of this file
under §"Opened by the v0.1 M1–M6 build". The v0.1 final review's money finding is
a **P0** and is the most serious open **defect** in this repository. The largest
open item is not a defect: **M4 ships a composer and no document**, because the
В.1/В.2 field list of Додаток В is committed nowhere and inventing it is
forbidden. That entry and the resolver's un-narrowed second arm were added on
2026-08-08 by the whole-build audit.

## Surfaced while verifying the 2026-08-04 package review (migrations 0036–0040)

These are not part of that slice and were deliberately not folded into it. See
[docs/delivery/package-review-2026-08-04.md](docs/delivery/package-review-2026-08-04.md).

Line references in this file point at a moving tree. Before acting on an item,
re-locate the cited text **by string, not by line** — four of the references
below were already stale one change set after they were written, and they were
re-pointed on 2026-08-06 against the tree as it stands at 40 migrations.

- **CLOSED 2026-08-18 (migration `0058`) — `service_role` held TRUNCATE, and on
  far more than one table.** The entry read: «`service_role` holds TRUNCATE on
  `outbox_dead_letters`. The append-only guarantee rests on a `BEFORE UPDATE OR
  DELETE` trigger (`0008:29-31`), and TRUNCATE fires neither. 0037 enabled RLS
  on the table, which does not gate TRUNCATE either. A TRUNCATE-shaped hole in
  an append-only table is worth closing on its own terms, not as a grant
  tweak.» Every sentence of that was true, and the scope and the prescription
  were both wrong.

  **Scope: 19 of 19, not one.** Every append-only or immutable trigger in
  `public` is `BEFORE UPDATE OR DELETE ... FOR EACH ROW` — `tgtype = 27`, no
  TRUNCATE bit — so the identical hole sat under `audit_events`,
  `evidence_objects`, `statutory_acts`, `stage_closures`,
  `requirement_evidence_decisions` and fourteen others, which is to say under
  most of the evidence chain rather than under one dead-letter table.

  **Root cause: nobody granted it.** No `grant truncate` appears anywhere in the
  migration chain. It comes from a default ACL the Supabase image installs
  (`pg_default_acl`, schema `public`, grantor `postgres`,
  `service_role=arwdDxtm`, where `D` is TRUNCATE), so all **53** tables in
  `public` acquired it silently at creation and every future table would too.
  Revoking on the nineteen would have fixed today and not tomorrow.

  **The prescribed fix was unimplementable, and would have bought nothing.** A
  TRUNCATE trigger must be `FOR EACH STATEMENT`, and `truncateAll`
  (`apps/app/tests/helpers/fixtures.ts`) truncates `public.audit_events ...
  cascade` between test files as the owner — a refusing trigger fails every
  run, recoverable only with `session_replication_role = replica`, which
  disables all triggers and is a wider hole than the one being closed. And a
  trigger cannot constrain the table's OWNER, who may drop it. Once measured,
  the only non-owner holder in `public` was `service_role`; `goproceed_app`,
  `goproceed_service` and `goproceed_worker` hold TRUNCATE nowhere, and
  `anon`/`authenticated` hold none in `public` at all. So «a grant tweak» IS the
  complete fix for every principal that is not already the database owner.

  `0058` revokes across all of `public` (owner decision) and revokes the default
  privilege so tables added later never acquire it.
  `packages/testing/src/truncate-privilege.test.ts` asserts the invariant over
  the WHOLE SCHEMA rather than a list — a list is what let this happen — and
  proves the forward half by creating a table and checking what it inherits.
  Both halves were shown to fail without the migration.
- **P3 — `technical/openapi/README.md` contradicts `scope-v0.1.csv`.** The
  README's auth-plane list says the `public` plane "can never consume a grant";
  the CSV lists `external.exchange` as `public,command,single_use` on POST. One
  of the two is wrong and M5 depends on which. Re-located 2026-08-06 after the
  [ADR-006](docs/decisions/ADR-006-pilot-shaped-v0.1.md) re-cut shortened the
  CSV to 58 rows: the `external.exchange` row is now `scope-v0.1.csv:56`. The
  **Half closed and half sharpened, 2026-08-08.** The "it still states 72
  operations" half is **closed**: the README states 58, which is what the CSV
  holds. The first half is **live and now demonstrable rather than suspected** —
  M5 built the exchange, and `app.exchange_external_grant` marks the grant
  consumed with a partial unique index making a second exchange unstorable
  (INV-057). So the `public`-plane row `external.exchange` both **performs a
  state change** and **is the only thing that can consume a grant**, and the
  README's sentence is wrong on both clauses. The README also repeats the claim
  at `:98` as the reason `external.exchange` is exempt from the capability rule.
  The exemption is right for a different reason — the caller holds a bearer token
  and no session — and the reason given is not. `technical/openapi/README.md` was
  outside the 2026-08-08 documentation slice's remit; it is owed the rewrite.
- **P3 — `0026:11-13` attributes the external-gate sentence to migration
  0015**; the text is at `technical/database/schema-v0.1.sql:791` ("EXTERNAL
  GATE: per-workspace storage quota values and scan-blocked retention
  periods…"). A migration comment is history and cannot be edited — this needs
  a docs correction.
- **CLOSED 2026-08-06 — `tenancy-and-security.md`'s "Before domain expansion,
  v0.0 must:" list.** It named seven items, six delivered, while domain
  expansion had already happened. The list no longer exists: the same change
  set that added migrations `0036`–`0040` retracted it and replaced it with the
  per-control evidence table under §"The v0.0 control set, proved per control",
  which cites the deciding migration text for each of the eight controls. The
  two that remain open there — `aktflow_worker` having no login role, and the
  absent live catalog comparison — are tracked in that table, not here.
- **P3 — `baseline-verification.md:53-66`** is the upstream source of the stale
  risk bullets corrected elsewhere, and is still linked as evidence.
- **CLOSED 2026-08-18 (accepted and bounded) — `goproceed_service` inherits
  `select` on `evidence_objects` via `goproceed_app`.** The entry was accurate
  and named one table; measured, the inheritance is `select` on **50** tables,
  `insert` on 48, `update` on 24, `delete` on 3, against DIRECT grants on
  exactly two (`readiness_projection`, `blocked_reasons`). So the deviation was
  understated by forty-nine tables.

  **It is not narrowed, and that is the decision rather than an omission.**
  `0034:13-17` rejected a parallel grant surface in terms — «every future table
  grant had to be made twice — a divergence nobody would notice until a policy
  quietly stopped applying» — and removing the membership means exactly that
  surface. The reasoning still holds.

  **What was actually missing was the BOUND, from both documents.**
  `goproceed_service` is `NOBYPASSRLS`, and `withServiceTx` carries the caller's
  `app.actor_user_id` into the service transaction, so every policy on those 50
  tables evaluates against the acting member: the service connection sees
  exactly what that member could already see. The grant is wide; the reach is
  not. Neither this entry nor `tenancy-and-security.md` said so, which made the
  deviation read as an unbounded read of every tenant's evidence.

  `tenancy-and-security.md` now states the real breadth and the real bound, and
  `m2-service-principal.test.ts` makes the bound falsifiable: a real evidence
  row read through the service connection as its entitled actor (1 row) and as a
  stranger (0 rows). Proved non-vacuous by granting `BYPASSRLS` and watching the
  stranger case go red — the first draft ran against an empty table, where zero
  rows proves nothing.

  **The residual, named rather than closed silently:** the grant surface still
  lets a service transaction reach rows it has no business reading, for an actor
  who is entitled to them, with only the command's own code saying otherwise.
  The successor is the per-workload `NOLOGIN` worker roles the Workers section of
  `tenancy-and-security.md` describes — v0.2 work, with its own deployment
  story, not a narrowing of this role.
- **P3 — `supabase/functions/outbox-drain` is outside every pnpm workspace
  glob**, so `turbo run test` never runs its 2 tests even though they are
  counted in the 2026-07-30 recorded run — which is one reason no figure from
  that record may be restated as a current baseline. Fixing it means adding
  `supabase/functions/*` to `pnpm-workspace.yaml`, which forces a lockfile
  regeneration against `ci.yml`'s `--frozen-lockfile`. Its
  `drain.test.ts` is now marked frozen history (0036 retired the function).

## P3 — `app.accept_invitation` ignores the invited email address

**What:** `supabase/migrations/0011_workspace_access_security.sql` looks the
invitation up by `token_hash` alone. Any authenticated user holding the link
can consume an invitation addressed to somebody else.

**Why:** `invitations.email` is modelled and uniquely indexed, so the address
looks authoritative while the token is really a pure bearer credential. That
gap matters once invitations travel by email to external accountants.

**Pros of fixing:** the address becomes a real second factor.
**Cons:** needs a product decision — matching on email breaks the common
"forward the link to my colleague" flow.
**Context:** decide the product rule first; M5's external-access work faces the
same bearer-vs-identity question, so settle both together.
**Depends on:** nothing technical.

## P3 — a suspended or ended member can never be re-admitted

**What:** the `ALREADY_MEMBER` guard in `app.accept_invitation` matches on
`organization_id + user_id` with no `status` filter, so a membership in
`suspended`/`ended` blocks acceptance forever, and no route reactivates one.

**Why:** offboarding is one-way today; a rehired foreman cannot get back in.
**Pros:** closes a dead end an operator will hit.
**Cons:** reactivation is a governance command with its own audit and
capability questions — it is not a one-line change.
**Depends on:** the membership lifecycle commands, which are not among the 32
`v0.1-M1` operations in `technical/openapi/scope-v0.1.csv` (32 as of the
2026-08-06 re-cut; the figure was 21 when this item was written).

## P3 — responsibility assignments can never be ended

**What:** `project_responsibility_assignments` rejects UPDATE and DELETE
(migration 0013), and `responsibilities/route.ts` only ever sets `valid_until`
at insert time. An open-ended assignment is permanent, so separation-of-duties
warnings accumulate forever.

**Why:** people leave projects; accountability history should close, not vanish.
**Pros:** makes the SoD warning meaningful over time.
**Cons:** needs a superseding-fact command (append a closing fact), because the
table is deliberately append-only.
**Depends on:** the append-only correction pattern M3 introduces for review facts.
**2026-08-08 — the dependency has landed and the item has not.** M3 built that
pattern twice over: `requirement_exceptions` and `requirement_evidence_decisions`
are append-only fact tables, each with a serialising head row that a new fact
supersedes rather than overwrites (migration `0045`). There is now a worked
shape in this repository to copy, so this item is no longer blocked on a pattern
being invented — only on someone deciding the governance command. **Written, not
applied:** `0045` is one of the eleven migrations (`0041`–`0051`) that have never
run.

## P1 (CLOSED 2026-08-18) — the act's signatory slots pointed at rows no command could create; filed as a P3 «dead surface»

**What:** `public.project_parties` (migration 0010) and
`organizations.default_own_party_id` have no writer anywhere in the codebase.

**Why:** both are in the approved entity catalog, but no operation populates
them — a reader cannot tell "not built yet" from "broken".
**Pros:** either wire them up or document them as deliberately schema-only.
**Cons:** project_parties needs its own command and capability decision.
**Context:** `technical/database/entity-catalog.csv` carries a row for
`project_parties` while neither `technical/openapi/scope-v0.1.csv` nor
`technical/openapi/scope-v0.2.csv` has an operation for it or for
`organizations.default_own_party_id`. That row's `status_version` is itself
under correction — see
[version-0.1.md](docs/delivery/version-0.1.md) §"Corrections owed elsewhere" —
so read the row, not a version tag quoted here.
**Partly addressed in v0.1-M2-A:** `project_parties` is now annotated in the
entity catalog as deliberately schema-only, so a reader can tell "not built yet"
from "broken". Wiring it up still needs its own command and capability
decision.

**ESCALATED 2026-08-08 by M4 and M5 — this stopped being a tidiness item.** Two
built milestones now depend on records no v0.1 operation can create:

- **M4.** A statutory act version carries three typed signatory slots, and each
  names a `project_parties` / `party_contacts` row. `scope-v0.1.csv` carries no
  operation for either table and `apps/app/app/v1/` has no route for either, so a
  pilot workspace reaches `statutory_acts.compose` **with nothing to put in any
  slot**. Both M4 suites insert the rows directly and say so.
- **M5.** `external_access_grants.recipient_contact_id` is therefore permanently
  unpopulated, and `recipient_email` is the only reachable way to address a
  reviewer.

Separately, `party_contacts` does not carry the кваліфікаційний сертифікат in the
deployed database at all: `schema-v0.1.sql:279-283` gives it
`qualification_certificate_series`/`_number` and migration `0010:119-133` has
neither, with no later migration adding them — so "the certificate lives on the
participant record", said by the content rules, by ADR-005 decision 10 and by the
glossary, is **false in the runtime**. M4 needs nothing from it today because
nothing is printed.

**CLOSED 2026-08-18, AND RE-RANKED FROM P3 TO P1 IN THE SAME BREATH.** The
heading said «dead surface — tidiness item». The entry's own 2026-08-08
escalation, three paragraphs down, said what it actually was, and TODOS orders
by heading. Re-measured against the tree before touching anything:
`composeSignatorySlot` REQUIRES `projectPartyId` and `partyContactId`; the
compose route 422s if either row is absent; two of the three slots are
mandatory; and NO route could create either row. So `statutory_acts.compose` —
ADR-006 step 4, the акт — was unreachable through the API on any real
workspace, and M4 was green only because `m4-act.int.test.ts` inserted the rows
by SQL and said so («reported rather than routed around»). The moment the origin
exists and someone closes a concealed stage and tries to print the act, this
was the wall.

**Two commands, no migration.** `project_parties.create`
(`POST /v1/projects/{projectId}/parties`, `project.admin`) and
`party_contacts.create` (`POST /v1/parties/{partyId}/contacts`,
`parties.manage`, tightened to `own_legal_profiles.manage` for an own party
through the same `requirePartyEditCapability` the legal-profile route uses —
INV-020). **The capability decision this entry said was needed had already been
taken by migration 0010:** `pp_write` requires `project.admin`, `pc_insert`
requires workspace owner/admin, and both routes match their policy exactly —
which is the whole of the decision, and `src/lib/authz.ts:70-75` says why a
route may not be stricter or laxer than the policy behind it.

**The M4 fixture now goes through the routes.** `seedParticipant` calls both
commands, so all 45 M4 tests compose acts on rows a real member could have
created, and `statutory_acts.compose` is proved reachable end to end for the
first time. `signatory-participants.int.test.ts` (17 cases) covers the
refusals: RLS hides an ungranted project entirely (404, existence-safe — the
first draft expected 403 and the database correctly answered 404); a member with
only `project.view` gets 403 `SCOPE_PROJECT_DENIED` from the ROUTE, which is
what proves the route matches `pp_write` rather than the policy doing all the
work; a foreign party is a field error indistinguishable from an invented uuid;
the duplicate `(project, party, relationship)` is 409 `VERSION_CONFLICT`
rather than a 500 — the constraint's auto-generated name is TRUNCATED to 63
bytes and the route matches a prefix, measured, because the full name would
silently miss; INV-020's own-party tightening holds; the contract refuses
qualification-certificate fields the runtime table does not have.

**One defect the fixture caught before any user could:** the first draft of
both routes built `ctx` with `organizationId: null` (the workspace is resolved
from the row inside the transaction) and never passed the resolved id to
`recordAudit`, which throws — a 500 on a write that had succeeded. Fixed with the
`{ organizationId }` override `assignments.create` uses.

**Catalogs:** two rows in `scope-v0.1.csv` under v0.1-M4; `version-0.1.md`
counts M4 4→6, total 58→60 (the validator held me to a prose count too);
`related_operations` on `project.admin` and `parties.manage`; the entity
catalog's «still schema-only» annotation on `project_parties` retracted with a
date. **Still open and named:** `organizations.default_own_party_id` has no
writer (the other half of the original entry — a workspace default, its own
small decision), and `party_contacts` still lacks the qualification-certificate
columns the content rules assume (a schema decision, not this slice's).

## Closed by v0.1-M2-A (2026-07-31)

- **publish idempotency class** — `import_batches.publish` now takes
  `ledger_400d`, with a test asserting the 400-day retention window.
- **no concurrency tests** — `apps/app/tests/concurrency.int.test.ts` covers the
  work-item lock under different idempotency keys, parallel adjustments on one
  allocation head, parallel finalize on one upload intent, and the M1 carry-over
  of two parallel publishes of one import batch. Mutation-checked by removing
  the work-item lock.

## P2 — a zero unit price used to break publish (fixed, kept as context)

**What:** `apps/app/app/v1/import-batches/[batchId]/publish/route.ts` derived
`unit_price_decimal` from whether a price parsed. A price of `0,00` parses into
a truthy `Decimal` object, so a row with `unit_price_state = 'zero'` was stored
with a non-null decimal and violated
`(unit_price_state = 'known') = (unit_price_decimal is not null)`. Publishing
any estimate containing a zero-priced row returned 500.

**Why it is here:** the defect was found while building the v0.1-M2-A valuation
fixture matrix, not by the M1 review, because no M1 fixture ever imported a
zero-priced row — and rows priced at zero are ordinary, being work bundled into
another line. Fixed with a regression test that fails without the change. Kept
as a record of the fixture-shape gap that hid it.

## P2 (CLOSED 2026-08-19, same day) — the Supabase API keys were the legacy JWT form, which stops working at the end of 2026

**What:** every environment — local (`supabase start` issues only this form),
CI (`ci.yml`), and staging as provisioned 2026-08-19 — uses the LEGACY `anon`
and `service_role` JWTs, in variables named `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. Supabase's current docs present the successors —
`sb_publishable_…` and `sb_secret_…` — under `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
and its changelog says the legacy keys **work until the end of 2026**.

**Why it is a P2 and not a P3:** a deadline, not a preference. On 2027-01-01 a
deploy that still carries the legacy keys stops signing anyone in.

**Measured on `goproceed-staging`, 2026-08-19, before deciding anything:** the
hosted Auth server answers `200` to BOTH forms — the legacy JWT and
`sb_publishable_…` sent as a Bearer the way `supabase-js 2.47.10` sends it. So
the new key is not broken on the installed SDK, contrary to an earlier guess in
this session made from reading the SDK's header code rather than the server.
The legacy form was kept for staging for CONSISTENCY — it is the only form the
local stack issues, the only one `app-qa` has proved the sign-in flow against,
and the one the variable name in the code matches — not because the new one
fails. Switching only staging would have made it the one environment on a
different key form with zero test coverage of that form.

**Fix, as one coherent slice:** upgrade `@supabase/supabase-js` (2.47.10) and
`@supabase/ssr` (0.5.2) to current, rename the variable in code, `.env.example`,
`turbo.json`, `ci.yml`, `qa/field.mjs` and the runbook to the publishable
spelling, switch `evidence-storage.ts` to `sb_secret_…`, and confirm the LOCAL
stack's CLI version issues the new keys (it must — or local and hosted diverge).
Per `CLAUDE.md`'s rule: read the current docs and the changelog for the target
SDK version first; do not code from memory.
**Depends on:** nothing. **Deadline:** before 2026-12-31, with a month of slack.

**CLOSED THE SAME DAY, because the owner asked for every library to be current
before the Vercel sitting rather than after.** Done as the one coherent slice
this entry described, per `CLAUDE.md`'s current-docs rule — every step read from
the installed version and the vendor's own source, not recalled:

- `supabase-js 2.47.10 → 2.112.3`, `@supabase/ssr 0.5.2 → 0.12.4` (ssr 0.12.4
  peer-requires supabase-js ^2.111, so they move together). Release notes read
  across the whole span: nothing breaking on the calls this app makes. The
  PUBLISHED 2.112.3 bundle classifies the new key family explicitly
  (`isNewApiKey = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")`);
  the 2.47.10 bundle had no such code. Committed on its own first and proved by
  818/818 plus a real OTP sign-in through the browser pass, so the SDK jump and
  the key switch are separately verifiable.
- Variables renamed everywhere — `NEXT_PUBLIC_SUPABASE_ANON_KEY →
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY →
  SUPABASE_SECRET_KEY` — across 12 files; CI and `qa/field.mjs` defaults moved
  to the `sb_publishable_`/`sb_secret_` the local CLI issues. **The repo was
  already half on the new format**: two tests and `evidence-storage.ts`
  hard-coded `sb_publishable_`/`sb_secret_` local defaults under the OLD
  variable names — name and value had disagreed for as long as nobody looked.
- Measured: even CLI 2.75.0 issues both forms (`supabase status` shows
  PUBLISHABLE_KEY/SECRET_KEY beside ANON_KEY/SERVICE_ROLE_KEY), so local, CI and
  hosted all run the new format with no divergence.
- `deploy-preflight.mjs` now REFUSES a legacy JWT pasted into either new
  variable, by shape and by name — the dashboard still shows the legacy key right
  beside the new one, and a deploy carrying it would work today and die on
  2027-01-01 with no earlier symptom. Proved both ways.
- Every explanatory comment, `.env.example` and the staging runbook's variable
  table say the new name, the new form, and the date.

One verification detour, recorded because it looked like the keys and was not:
the first full run showed 5 failures / 17 skips in `@goproceed/testing`, caused
by `supabase db reset` pulling `storage-api:v1.69.0` mid-run — the local CLI
had been upgraded to 2.114.0 during the P0 sitting (from 2.75.0) and wanted an
image it had not cached. One-time, infrastructure; 461/461 on re-run. Side
effect worth noting: local is now one release behind CI's pin instead of forty,
which is the pin doing its job.

**For the Vercel sitting:** the two variable NAMES changed. Set
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the `sb_publishable_…` value and
`SUPABASE_SECRET_KEY` to an `sb_secret_…` value; the preflight refuses the
legacy forms by name.

## P2 (item 1 CLOSED 2026-08-24) — three major-version migrations, measured and deliberately NOT folded into the 2026-08-19 freshness pass

**Context:** on 2026-08-19 the owner asked for every library to be current
before the Vercel sitting. Tier 1 (Supabase SDK + key format) and Tier 2 (every
safe minor/patch bump, plus Next 16.3's `middleware → proxy` rename) were done
on that branch. These three were MEASURED against the tree and the vendor's
changelog, per `CLAUDE.md`'s current-docs rule, and each turned out to be a
migration with its own blast radius rather than a bump. Folding any of them into
a "freshen the libraries" branch would have been the scope creep that rule is
there to prevent. Each gets its own slice; the measurements are here so it
starts from facts.

**1. zod 3.24.1 → 4.4.3 — DONE 2026-08-24.** https://zod.dev/v4/changelog

> Landed on `claude/ui-reference-foundation` alongside the shadcn/TanStack
> foundation, on the owner's instruction «используй последние версии для
> библиотек, никаких пришпилены к 3.24.1». Every suite passed with **no
> test-fixture edits**, which is the strongest available evidence that the
> upgrade changed no accepted request.
>
> **This entry is the one place counts for this migration live.** Every number
> below is dated, scoped, and paired with the command that produced it, because
> a count with none of those rots on contact and this migration has already
> been mis-summarised twice. Do not copy them into source comments.
>
> - **Five type-level breaks, in `packages/contracts` and `apps/app/src/lib`.**
>   `z.record(x)` single-arg (`contracts-baseline.ts`), `.default({})` on an
>   object with inner defaults (`contracts-baseline.ts`, `imports.ts`,
>   `requirements.ts`), and `z.ZodType<T, z.ZodTypeDef, unknown>`
>   (`command.ts`, `external-session.ts`).
> - **`.default()` was the one with teeth.** Zod 4 did not merely retype it;
>   `$ZodDefault`'s own source says it «returns the default value immediately
>   in forward direction. It doesn't pass the default value into the
>   validator». `.prefault()` is the zod-3 behaviour and is what those sites
>   now use. Without it `roundingPolicy.midpoint` and `multiplicity.min` would
>   have disappeared from the parsed contract.
> - **`ZodType`'s parameters were reordered and `ZodTypeDef` was dropped.** zod
>   3 `<Output, Def, Input>` → zod 4 `<Output, Input, Internals>`, and
>   `ZodTypeDef` is not exported by zod 4 (`'ZodTypeDef' in z` → `false`; only
>   `$ZodTypeDef`, in `v4/core`). Now `z.ZodType<T, unknown>`.
>   **CORRECTED 2026-08-24 — an earlier version of this entry called this «the
>   silent break». It was the loudest one.** Reproduced by restoring the old
>   spelling and running `npx tsc --noEmit` in `apps/app` on 2026-08-24: the
>   run fails with, among others, `TS2724` («has no exported member named
>   'ZodTypeDef'. Did you mean 'ZodType'?») at the token itself, `TS2344`
>   («Type 'unknown' does not satisfy the constraint '$ZodTypeInternals<T,
>   z.ZodTypeDef>'») at the THIRD argument — not the middle Input slot the
>   first write-up blamed — and a large tail of `TS18046` where `a.body` had
>   degraded to `unknown`. The false claim came from reading a `| head -30`
>   slice of turbo's interleaved output and inferring silence from a
>   truncation. **The transferable lesson: every TYPE-level break in this
>   upgrade was caught by tsc. `.uuid()`, below, was not — the compiler said
>   nothing and the contracts suite caught it. Those are the two classes to
>   plan for, and «silent generic break» is not one of them.**
> - **`.uuid()` tightened to RFC 9562 and this repo could not take it.**
>   Measured 2026-08-24 by extracting every distinct UUID-shaped literal from
>   `packages/ apps/ supabase/ scripts/ migration/` (`.ts .tsx .sql .mjs .md`)
>   and parsing each with both schemas: **88 of 112 rejected by `z.uuid()`, 0
>   by `z.guid()`.** Postgres's own `uuid` type checks neither version nor
>   variant, so a `.uuid()` contract is narrower than the column it describes
>   and every hand-seeded row is in the gap. Every site is now
>   `z.string().guid()`; `packages/contracts/src/index.ts`'s header carries the
>   reasoning.
> - **`fieldErrors`' `path` is unchanged and is now pinned.** `issue.path` is
>   still `PropertyKey[]` (`zod/v4/core/errors.d.ts:9`) and `i.path.join(".")`
>   still yields `items.1.qty`. `command.test.ts` asserts that string exactly —
>   it is what a Ukrainian-speaking caller reads off a 422.
> - **`.strict()` and `z.string().datetime()` were NOT rewritten, and
>   `datetime()` is NOT behaviourally identical.** An earlier version of this
>   entry claimed it was. `.strict()` is unchanged
>   (`zod/v4/classic/schemas.d.ts:465`, still rejecting unknown keys), but
>   `datetime()` changed twice, measured side by side against zod 3.24.1 and
>   zod 4.4.3 in this repository's own store on 2026-08-24:
>
>   | input | zod 3 | zod 4 |
>   |---|---|---|
>   | `2026-08-08T09:00Z` (no seconds) | rejected | **accepted** |
>   | `2026-08-08T09:00:00+0300` (`{offset:true}`, no colon) | accepted | **rejected** |
>
>   Only the tightening can reject input that used to pass, and the producers
>   in this system are Node's `Date.prototype.toISOString()` (always `…Z`) and
>   Postgres `timestamptz` rendered to JSON (extended form, with the colon).
>   The app suite round-trips real `timestamptz` values through these contracts
>   and passes unchanged.
>
>   **The decision not to rewrite them stands, on the correct reason:** both
>   APIs still exist, the guide says they will not be removed, and
>   `z.iso.datetime()` inherits exactly the same two changes — so a sweep would
>   not fix them either, it would only churn the diff. **Owed:** if a caller
>   ever needs the basic offset form back, that is a per-field `regex`, not a
>   library setting.
> - **`errorMap`, `ZodError` and `.flatten()`: no uses in source.** The
>   estimate below feared the `fieldErrors` shape; nothing builds it from
>   `.flatten()`.

**Original 2026-08-19 estimate, kept for the record:**
- 30 files, 309 `z.string()`, 115 `z.object()`, 52 `z.enum()`.
- `.strict()` ×94 deprecated → `z.strictObject()`; `.email()` ×4 deprecated →
  `z.email()`; `z.record(x)` single-arg ×2 **removed** (hard break);
  `.default()` ×30 changes semantics on `z.coerce.*`.
- **`.uuid()` ×89 tightens to RFC 9562** — ids valid today could start
  answering 422. Must be measured against real ids before, not after.
- **`ZodError` issue formats «dramatically streamlined»**, and this repo's
  problem-JSON `fieldErrors` (42 sites) is built from them; `.flatten()`
  deprecated. This is a contracts-layer change that touches every `/v1`
  request schema and `technical/error-catalog.csv`'s documented shape. Needs a
  brainstorm, a branch, and a test plan of its own.

**2. vitest 3.2.4 → 4.1.11** — https://vitest.dev/guide/migration
- `vitest.workspace.ts` is REMOVED in v4 (→ `projects` in the config); 4 config
  files, 124 test files, 45 config-sensitive call sites (`vi.mock`,
  `hookTimeout`, `fileParallelism`, `environment`).
- The load-bearing part is not the API, it is the TIMING: `--concurrency=1`,
  `fileParallelism:false` and the 10 s hook budget are what keep the shared
  local Postgres from deadlocking (HANDOFF.md §4 records exactly how that
  fails). Any change to the runner must be proved against a full serialized
  run, not a green unit file.

**3. TypeScript → 7.0.2 (the Go port)** — https://devblogs.microsoft.com/typescript/
- Root is 5.9.2, `apps/mobile` is 6.0.3 — the workspace already disagrees with
  itself. 10 tsconfigs, `moduleResolution: Bundler`, `verbatimModuleSyntax`.
- Next 16.3's own release notes mention TS6 `baseUrl`/`node10 moduleResolution`
  deprecations, so 5.9 → 6 is itself a config migration that this repo has not
  absorbed, before 7 is even considered. Unify on one version first.

**Not done on 2026-08-19, on purpose.** Everything that WAS safe is done; these
three are named so nobody mistakes "freshened" for "finished".

## P0 (CLOSED 2026-08-19) — the field client is built and NOBODY CAN OPEN IT: there is no origin

**There is an origin, and it is public, and a person has signed in through
it.** `https://goproceed-app.vercel.app` — attached by the owner on the evening
of 2026-08-19 (the `goproceed-app-akislys-projects.vercel.app` alias serves the
same deployment); a Vercel-provided hostname, so `{{APP_HOSTNAME}}` is still a
token and a custom domain is still undecided (§0 of the runbook). At 20:34 UTC
the owner signed in on a laptop: OTP code by email, `login_method: otp` in the
Auth logs, `auth.users.last_sign_in_at` set, and — same second — Supavisor
authenticated `goproceed_app_login` for the page's `/v1/projects` self-fetch;
«Мої доручення» rendered its empty state, correct for a user with no grant.
Measured 2026-08-19 after PR #30 merged (`caff92c`), production deployment
`dpl_9tVwSHyKCg2sRsafN3cxFZtQ1bVT`:

- the build log printed `deploy preflight (VERCEL_ENV=production): OK — origin,
  Supabase, database and external-link variables are all present and
  non-local` — all twelve variables, the `sb_publishable_`/`sb_secret_` key
  forms, an https origin with no path — and no turbo platform-env warning;
- `GET /` → 307 `/login?next=%2F` and `GET /assignments` → 307 (the auth gate,
  `proxy.ts`, is live); `GET /login` → 200 `text/html` over TLS with HSTS, and
  the page is the OTP form («Вхід за одноразовим кодом…», `#otp-email`,
  «Надіслати код»); `GET /v1/projects` and `/v1/me/context` → 401
  `application/problem+json` unauthenticated;
- the shipped client bundle carries the staging Supabase URL and the staging
  `sb_publishable_…` key in exactly one chunk each, and no local value
  (`127.0.0.1`, the local demo key) anywhere;
- staging Postgres, through the connector: 58/58 migrations (`0058` last),
  `pg_cron` present, 140 policies, 53/53 `public` tables with RLS, both
  `goproceed_*_login` roles with SCRAM-SHA-256 verifiers that differ, 0 auth
  users, 0 organizations — clean;
- one dashboard setting stood between the build and the public, and the
  runbook had not mentioned it: a new Vercel project ships with **Vercel
  Authentication** protecting every URL except custom domains, and the
  `*.vercel.app` production alias is not a custom domain — every path answered
  302 to `vercel.com/sso-api`. Changed to «Only Preview Deployments» with the
  owner's explicit yes (Previews are skipped by `ignoreCommand` anyway).

**What this closes is exactly the sentence in the heading.** What it does not
close, each tracked under its own heading below: the §6.1–6.8 evidence (an Auth
user, the idempotent bootstrap, cross-tenant isolation, one finalize through
`SERVICE_DB_URL`) — the owner's `curl`s, because they carry a bearer token; the
§6.9 phone session; and the P1 directly below, without which no foreman outside
the Supabase project's own team can receive the code.

---

## P1 (CLOSED 2026-08-20) — OTP email for outsiders: Brevo custom SMTP is live; the non-team delivery test was waived by the owner

**Read from the current Supabase docs on 2026-08-19
(https://supabase.com/docs/guides/auth/auth-smtp):** the default email service
is «best-effort», «2 messages per hour», and — the part that decides this item —
«Unless you configure a custom SMTP server for your project, Supabase Auth will
refuse to deliver messages to addresses that are not part of the project's
team.» So today the owner can sign in at the live origin with their own address,
twice an hour, and a foreman with any other address gets no code at all. Custom
SMTP (Authentication settings → SMTP) starts at 30 messages per hour and is
raised on the Rate Limits page. This is the last thing between «/login renders»
and «a foreman signs in», and it is an account decision (which provider, which
sending domain), not code — the app sends nothing itself. **The app's hostname
does not solve it:** `goproceed-app.vercel.app` is Vercel's, and no DNS record
(SPF/DKIM) can be added under `vercel.app` — the sending domain has to be one
the owner controls, which is the same open question as `{{APP_HOSTNAME}}`.
Also still to do in the dashboard on the same page: Auth Site URL is
`http://localhost:3000` (GoTrue logs it as the referrer on every request) —
set it to the origin; and the hosted «Magic Link» template must keep
`{{ .Token }}` (it was the dashboard default — a link with no code — until
2026-08-19 20:3x, and the client's code-only flow had nothing to type).

**How it closed (2026-08-20).** The owner configured Brevo
(`smtp-relay.brevo.com:587`, relay login `b…@smtp-brevo.com`, sender the
gmail address, minimum interval 60 s) — and the decisive evidence turned out
to be retroactive: the headers of the very email the first sign-in used
(19 Aug, 20:34 UTC) show «отправлено через ha.d.sender-sib.com», DKIM
`11932482.brevosend.com` — **that email already went through Brevo.** Brevo
cannot authenticate `gmail.com`, so it rewrites the From to
`akisliy2306@11932482.brevosend.com` and keeps gmail in Reply-To; SPF/DKIM
therefore align and deliverability holds — the earlier fear that a gmail
sender would fail DMARC was wrong, Brevo handles it. The built-in service's
«team addresses only» rule left the path the moment custom SMTP went live.
Site URL was set to the origin by the owner the same day.

**What was NOT measured, by explicit owner decision.** Delivery to a
non-team address from THIS project. One attempt was made: a second user was
created and a code arrived — but `auth.users` on staging still held exactly
one row and the owner's `recovery_sent_at` had not moved, so whatever sent
that code, it was not staging's GoTrue (likely another project's dashboard).
Rather than repeat the test, the owner chose to accept custom SMTP's
documented behaviour (the team-only rule is specific to the built-in
service). Recorded as a waiver, not a verification — if a foreman's first
code ever fails to arrive, start here. The Supabase logs backend answered
«Backend error» all afternoon, so the `mail.send` timeline could not be
re-read either; the email headers above are primary evidence and did not
need it.

**Spawned, still open:** (1) the From a recipient sees is
`support <akisliy2306@11932482.brevosend.com>` — functional, but it reads as
phishing to a stranger; the fix is an authenticated sending domain in Brevo,
which is the same undecided `{{APP_HOSTNAME}}` question, plus renaming the
sender from «support» to «GoProceed». Pilot-acceptable as is. (2) Free-tier
Brevo caps daily volume; irrelevant at pilot scale, revisit before real
rollout.

---

## P1 — Three pilot surfaces (ADR-009): plans B, C, D

[ADR-009](docs/decisions/ADR-009-three-pilot-surfaces.md) (2026-08-20) recut
the pilot into three separately-deployed surfaces — landing, the system
(`apps/app`'s `/v1` BFF plus a dashboard UI-minimum), and a field client whose
codebase moves to `apps/mobile` (Expo), shipped Expo-web for the pilot. The
ADR itself, the ADR-007 §1 amendment pointer, and this README/TODOS pass are
what this entry tracks as done; `apps/landing/vercel.json` and the landing
project's actual deploy are Tasks 2–3 of the same implementation plan
(`docs/superpowers/plans/2026-08-20-three-pilot-surfaces.md`), tracked there
rather than duplicated here. The three items below are the follow-up plans
this entry names but does not yet execute, each its own scope-split slice per
`superpowers:writing-plans`.

1. **Plan B — `/v1` cross-origin access**, DONE 2026-08-20 — CORS in the proxy
   per the vendor's Next 16.3.1 pattern; unset-means-unchanged pinned by tests;
   bearer needed no work — `auth.ts` already prioritizes `Authorization: Bearer`,
   its comment names mobile. Planned as
   `docs/superpowers/plans/2026-08-20-v1-cors-bearer.md`. CORS lives in
   `proxy.ts`, behind a `{ source: "/v1/:path*", has: [{ type: "header", key:
   "origin" }] }` matcher entry, per the vendor's own Next 16.3.1 proxy#cors
   pattern; all the logic lives in `apps/app/src/lib/cors.ts`, with an
   allowlist via a new `FIELD_CLIENT_ORIGINS` env var (declared in
   `turbo.json` `build.env`). The shared route wrappers
   (`apps/app/src/lib/command.ts` `queryRoute`/`commandRoute`) were never
   touched.
2. **Plan C — Expo-web field client to parity**, planned as
   `docs/superpowers/plans/2026-08-20-expo-field-client.md`. **Progress as of
   2026-08-21, on branch `claude/expo-field-client`: the client EXISTS.**
   Login, «Мої доручення», the assignment screen and capture are ported
   against `apps/mobile`'s Expo/RN codebase — copy carried over
   byte-identical, the receipt renders the SERVER's hash (not a
   client-computed one), and INV-081's unsaved-photo banner plus the
   `beforeunload` guard are wired exactly as the PWA's. 123 unit tests cover
   it, and it has its own five-audit browser harness
   (`apps/mobile/qa/field-web.mjs`), reaching `ok:true` against the exported
   build with Plan B's CORS actually exercised on the wire —
   `FIELD_CLIENT_ORIGINS` set on the qa server, not assumed. A human also ran
   the full flow by hand against the local stack on 2026-08-21, not only the
   harness. The restored-strictness audits earned their keep: they caught,
   and the branch fixed, two real defects — user-agent link-blue anchors (the
   same class of bug the PWA's own `qa/field.mjs` caught, item 3 of the
   2026-08-17 residuals above) and a missing `html lang`. A Vercel project
   exists — `goproceed-field` (id `prj_q0pHp3k54YSlqw0CZUIylZ56FGBg`, root
   `apps/mobile`) — created link-only, the same MCP path §4.4 used for
   `goproceed-landing`; it is awaiting the owner's dashboard environment
   steps and this branch's merge before a first real deploy exists.
   **EXPLICITLY NOT CLOSED:** none of the above is the parity gate. Per
   ADR-009 that gate is the two physical phones against README-staging §6.9 /
   INV-081 — a passing harness and a passing human smoke test on a laptop are
   evidence toward it, not a substitute for it. `apps/app`'s field pages stay
   deployed until the phones say otherwise.
3. **Plan D — the office dashboard**, planned as
   `docs/superpowers/plans/2026-08-21-plan-d-dashboard.md` (the
   `2026-08-XX-dashboard-ui-minimum.md` filename this entry used to predict
   was never written). **Slice D0 — the shell — is DONE as of 2026-08-22**;
   D1–D4 are named there with their anchors already discovered, so nobody
   rediscovers them the expensive way.

   D0 shipped: `Dialog`/`DropdownMenu`/`Avatar` in `packages/ui` (never a
   second component tree in the app), the `/dash` shell — desktop rail,
   mobile drawer, workspace identity, disabled nav for the slices that do not
   exist yet — a profile page, and **the first way to sign out this product
   has ever had**. Structure follows plane's hierarchy per
   `docs/design/03-ui-references.md`: `app/**` is routes only, components are
   kebab-case under a domain folder, anything that talks to an API is a
   `src/services/*.service.ts`. Which screen serves which role, and the
   evidence sentence behind each, is `docs/design/04-role-pain-map.md`.

   **Two corrections this slice forced on the plan's own text**, recorded so
   D1–D4 do not repeat them: the route is `/dash` as a REAL segment, not the
   `(dash)` route group the plan named — `(dash)` and the field client's
   `(app)` both resolve to `/` and Next refuses the build; and
   `GET /v1/me/context` carries **no email and no name**, so the signed-in
   address comes from the Supabase session, not from `/v1`.

   D1–D4 remain, in the order the demand scan ranks the pain: evidence by
   assignment (ПТВ, and the one new API this plan needs — record it in
   ADR-009 as a dated amendment), overview/blocked value (the payer),
   assignments over the full contract chain, members & access.

**Meanwhile, the pilot runs on the PWA.** `apps/app`'s field pages stay
deployed and functional and are the pilot's only working field client until
Plan C's parity measurement lands. No task in any of the three plans above may
remove them first.

---

## Surfaced by Plan D slice D0 (the dashboard shell), 2026-08-22

Six residuals the slice found and deliberately did not fix inside it. Each is
recorded with what was actually established, so the next person does not have
to re-derive it.

**P2 — no container role means «a dialog» or «a short message», and
`packages/ui`'s own `Dialog` default is dead in the dashboard.**
`packages/ui/src/theme.generated.css` does `--container-*: initial`, clearing
the whole default container namespace, and defines exactly three roles:
`measure` (680px), `content` (1240px), `nav` (880px). The built dash chunk
therefore emits **no `.max-w-sm` and no `.max-w-md`** — and `max-w-md` is
`DialogContent`'s own default width, which means **every dialog in the
dashboard is full-width unless its caller overrides it**. Nothing is visibly
broken today because both existing dialogs override (the sign-out confirm now
uses `max-w-96`, verified in the rebuilt chunk; the drawer sets its own
width), so this is a trap for the next dialog, not a live defect. **FOUR** call
sites already carry a dead `max-w-*`, and the fourth is the one most easily
missed because it is not in this app: `shell-error.tsx` (`max-w-sm`),
`no-workspace-empty-state.tsx` and `no-projects-empty-state.tsx` (`max-w-md`),
and `packages/ui/src/components/Dialog.tsx:49` (`max-w-md`) — the component
default named two sentences above. (`app/(auth)/login/page.tsx` also writes
`max-w-sm` and is NOT one of them: it is a field-client route, where
`globals.css` does emit that utility.) This is
`docs/design/02-building-ui.md` §3.3 question 2 — a missing ROLE, to be added
in `packages/tokens/src/tokens.json` and regenerated, not one scattered edit
per call site. **Discovered the same way as the Georgia-font bug below: by
grepping the compiled CSS chunk, not by reading the source** — a class that
does not exist produces no error, only an element that renders wrong.

**P3 — the dashboard's headings rendered in a font `apps/app` does not
install (fixed 2026-08-22, kept for the lesson).** `dash-theme.css`'s header
claimed the `--font-display` collision with the field client's pre-token
`app/globals.css` was «sidestepped entirely» by separate compilation units.
It was not: both files still land in one document, so the dashboard inherited
Georgia. Fixed and the header corrected. The general hazard — the dash theme
and the field client's legacy stylesheet sharing a document — outlives this
instance and is the same mechanism as the P2 above.

**P3 — `next=/dash` is hardcoded in all three `session_expired` arms of
`apps/app/app/dash/layout.tsx`,** so a deep link to a nested `/dash/**` route
is discarded on re-authentication. **Deliberately not fixed, with evidence:**
every cold open with a dead cookie is already caught by `proxy.ts`, which
redirects with the full `pathname + search` before the layout runs, so this
arm is reachable only when the session dies *between* the proxy's `getUser()`
and the render — a same-request race. The App Router gives a server layout no
supported way to read the child pathname; the fix is a `proxy.ts`-set request
header, which means editing the auth gate's cookie-rebuild path (`response`
is reassigned inside `setAll`) to improve a redirect target in a race. Its own
change, with its own proof.

**P3 — the browser pass has an unexplained reopen race.** Reopening the
profile menu immediately after the sign-out confirm closes intermittently
finds the menu shut. Diagnostic when it happens: nothing covering the control,
nothing inert or `aria-hidden`, no pointer-events lock on the body, zero
dialogs/menus/poppers, focus already restored to the trigger. Mitigated —
`settleAfterDialog` now waits on three observable conditions plus two
animation frames instead of sleeping — and **six consecutive green runs
followed the mitigation** (three by the implementer, three by the controller
from the repository root). The mechanism is still not established and no one
has claimed one; the diagnostic stays in the harness so a recurrence names
what it saw. Candidate fix is `modal={false}` on the profile `DropdownMenu`,
NOT shipped because the menu renders inside the modal drawer, which applies
`hideOthers()`, and a non-modal menu does not call `hideOthers` for its own
content — trading a verified-passing accessibility path against an
unestablished race needs its own proof.

**P3 — `apps/app/src/ui/button.tsx` is the field client's own pre-token kit**
(pre-existing on main, not introduced by Plan D). It is used by the four field
pages **and by `app/(auth)/login/otp-form.tsx`**. When the PWA field pages
retire per ADR-009, login remains and must move to `packages/ui`'s `Button` —
otherwise the retirement leaves one screen on a component tree nothing else
uses.

**P3 — the three components D0 added to `packages/ui` have no kitchen-sink
entry,** and `DialogClose` hand-rolls its ghost+icon styling rather than
composing `Button asChild` (the size map has no icon-sm, and `Button` does not
forward a ref). Both were judged defensible at the time; revisit when a second
such control appears.

---

## P2 — `evidence-storage.ts` puts raw storage keys into error messages, and they reach the console

**Found 2026-08-22, researching the evidence read (Plan D slice D1); scope
corrected 2026-08-22 in the D1 final fix wave.** FIVE of the ten exported
functions in `apps/app/src/lib/evidence-storage.ts` interpolate the key into
their thrown message — `createSignedUpload` (:65), `putObject` (:78),
`downloadObject` (:83), `objectSize` (:102) and `removeObject` (:123):
`storage: signed upload failed for ${key}`, `download failed for ${key}`,
`list failed for ${bucket}/${key}`, `remove failed for ${bucket}/${key}`. The
other five do not: `newEvidenceKey` throws nothing, `objectExists` returns a
boolean and swallows the error, and the three functions D1 added
(`createSignedReadUrl`, `createSignedReadUrls`, `openObjectStream`) were built
under an explicit instruction not to copy this house style, so they carry
`error.code`/`error.status` and never the key. This entry originally said
«every function» and «all six functions»; both were wrong, and the count is
what a reader would have used to size the fix.

These five are bare `Error`s, so `toProblemResponse` falls through
to `apps/app/src/lib/http.ts`'s `console.error("[INTERNAL_ERROR]", requestId,
err)` branch and the key goes to the platform log verbatim.

`docs/architecture/files-and-storage.md` §Downloads is explicit: «Logs record
the domain object and authorization result, never the signed URL or raw storage
key.»

Two things make this worth fixing rather than noting. A storage key is not a
capability on its own, but it is the input to one — signing is a service-key
operation over a key, so a leaked key narrows an attacker's search to nothing.
And the file is the house style a new helper would copy: the D1 signed-read
helper had to be told explicitly NOT to follow it, and the next one may not be.

The fix is to throw the domain object's id and keep the key out of the message
entirely, in those five functions.

## P3 — the browser pass cannot assert «no signed URL in the logs», because there are no logs

**Found 2026-08-22, same research; the number corrected 2026-08-22 in the D1
final fix wave.** `apps/app` has no logging library and no log lines on any
happy path. The shipped app contains exactly ONE `console.error` call —
`apps/app/src/lib/http.ts:97`, `toProblemResponse`'s unmapped-error branch —
plus two idle-client handlers in `packages/database/src/pool.ts`. There is no
`middleware.ts`, no `instrumentation.ts`, and `next.config.ts` is empty.

This entry used to say «`console.error` appears three times in the whole app».
That was a FILE count read as a call count, and two of the three files are not
the app: `apps/app/qa/field.mjs` (3 calls) is the browser harness and
`apps/app/scripts/deploy-preflight.mjs` (5 calls) runs before a build. The
conclusion the number was defending is unchanged and is if anything stronger —
there is no happy-path logging, so «never in logs» cannot be asserted — but a
false number defending a true conclusion is the defect class this branch spent
five review rounds on, so it is corrected rather than left standing. The same
sentence appears in `apps/app/tests/evidence-read.int.test.ts` beside the leak
test and is corrected there too.

So D1's leak test asserts what it can — no signed URL in `audit_events`, in
`transaction_outbox`, or in any idempotency body — and cannot assert the log
half of the rule. The rule still binds every future line; there is simply
nothing to assert against yet. Worth revisiting when structured logging arrives,
which is also when the P2 above becomes urgent rather than latent.

Not established, and outside this repository: whether Vercel's own platform
access log records request URLs with query strings for these routes. Nothing in
`apps/app/vercel.json` configures logging either way.

## P3 — `technical/schema.sql` reads as current truth and is a design-time reference

**Found 2026-08-22, while designing the evidence read (Plan D slice D1).** The
file's own first line says what it is: «AktFlow Pilot v2.9 executable reference
schema. Convert to ordered reviewed migrations before runtime use.» It is the
design the migrations were derived FROM, not a snapshot of the database, so a
migration departing from it is the process working rather than drift.

The hazard is that nothing in the file says WHICH tables have departed, and
`scripts/validate-canonical-docs.mjs` lists it among the canonical documents —
so it reads as current truth. `evidence_objects` is the worst case found so far:

| `technical/schema.sql` | `supabase/migrations/0015_execution_evidence_module.sql` |
|---|---|
| `organization_id`, `sha256`, `mime_type` | `workspace_id`, `content_hash`, `media_type` |
| `scan_state`, `lifecycle_state` | neither exists; `inspection_status` instead |
| `assignment_id`, `work_item_id` on the row | neither; the link is via `upload_intents` |

The shipped `apps/app/app/external/occurrence/route.ts` selects the migration's
columns, so the migrations are what runs. Anyone checking a column against
`schema.sql` for this table gets a confident wrong answer — which is exactly
what happened while the D1 design was being written, and was caught only by
reading the migration.

**The fix is a header, not a rewrite:** state the file's status on its own face
and name `supabase/migrations/**` as the runtime authority. Optionally list the
tables known to have diverged. Rewriting the schema to match the migrations
would destroy the design record the file exists to be.


## P3 — `packages/tokens`' `generate-palette.mjs` still writes into the deleted `apps/demo` tree

**Observed 2026-08-21, during the field-client build.** `outDir` in
`packages/tokens/scripts/generate-palette.mjs:27` defaults to
`apps/demo/qa` (`process.env.TOKENS_OUT_DIR ?? join(repoRoot, "apps/demo/qa")`),
and the generator writes `apps/demo/qa/palette.generated.mjs` there
unconditionally unless the caller overrides `TOKENS_OUT_DIR`. `apps/demo` was
retired on 2026-08-20 (see the "Record" section above), so a plain
`pnpm --filter @goproceed/tokens generate` today recreates part of a directory
the owner deliberately removed — a demo-retirement leftover the retirement
pass did not catch because nobody ran the tokens generator that day. Its own
micro-slice: point `outDir` at wherever colour-approval consumption actually
lives now (or drop the palette-generation step entirely if nothing reads it
post-retirement — `apps/demo/qa/colour-audit.mjs`, the file this generator's
own header and in-file comments say the output is FOR, no longer exists),
and confirm `packages/testing/src/token-fidelity.test.ts` (named in the
generated file's own header as the consumer that "fails if this drifts")
still has a subject to check against.

---

## P2 — a page render costs ~3 auth round trips and 2 self-fetch hops, by design

Measured 2026-08-20 against the live origin: a cold request took 2.2 s, a warm
one 0.4–0.5 s, and `/v1/projects` answering **401** — before it reaches the
database at all — still took ~0.4 s warm, because `getUser()` is a network call
to GoTrue, not a local JWT decode (`apps/app/src/lib/auth.ts`).

Where a single «Мої доручення» render goes: `proxy.ts` calls `getUser()` on
every navigation; the page then self-fetches its OWN `/v1/projects` over HTTP
(`apps/app/src/lib/api.ts` — deliberate, and documented there as «the read goes
through the route, not around it»), which is a second function invocation that
re-runs `getUser()` and opens its own pool connection; then, strictly after it
(the project ids are needed), one self-fetch per project to
`/v1/projects/{id}/assignments?assignee=me`, each again `getUser()` + connect.
For one project that is ~3 GoTrue round trips, 2 pooler connects and 21 SQL
statements — of which **14 are fixed `begin` / `set local role` / 5×
`set_config` / `commit` overhead carrying no page data**. For N projects it is
N+1 of everything (the assignment hops parallelise, but each still pays its
own auth + connect).

The `regions: ["arn1"]` fix (§4.1 of the runbook) removes the ~100 ms Atlantic
tax from each of those round trips, which is the dominant term today — but the
COUNT of round trips is an architecture decision and survives it. Two options
when it next matters, both touching auth/data-fetching and therefore needing
their own approved slice:

1. `getClaims()` (local JWKS verification) instead of `getUser()` per hop —
   requires asymmetric JWT signing enabled on the project and a `supabase-js`
   version that ships it; check the installed version and current docs first,
   per CLAUDE.md. Removes ~N+1 network calls.
2. Let the server component call `src/lib` directly instead of self-fetching
   its own routes — removes N+1 function invocations. `api.ts` refuses this on
   purpose (one enforcement point for authz/RLS), so it is a design change,
   not a cleanup: whoever makes it must keep the guarantee some other way.

Not yet done, and not to be done as a drive-by.

**One candidate was tried on 2026-08-20 and rejected on measurement:** making
`exceljs` a lazy `await import()` inside `parseXlsx`, so the package barrel
(`packages/domain/src/index.ts` re-exports `./import/xlsx`) would stop pulling
it into every route that imports `@goproceed/domain`. It typechecked, all 101
domain tests passed, the app built, and a probe confirmed that importing the
barrel under Node/vitest leaves zero `exceljs` modules in `require.cache`. But
the built output did not move: comparing `.next` traces before and after, the
assignments route stayed at **3.39 MB** and the import-validate route at
**3.41 MB**, with only a 275→277 file-count difference from chunk splitting.
Turbopack already distributes exceljs across shared chunks, so the shipped
payload is identical and the only remaining benefit would be fewer modules
EVALUATED at cold start — which the trace cannot show and which was not worth a
lazy chunk on the workbook-parsing path. Reverted. If cold-start weight is
attacked again, measure evaluation time in a deployed function first, not the
module graph.

---

## Record (2026-08-20) — `apps/demo` and its CI job are retired

Removed on the owner's decision, on the reasoning that the live demo will be
served by `apps/app`. This was not a reversal: `README.md` already filed
`apps/demo` as «legacy reference material, not product surfaces», and
[ADR-004](docs/decisions/ADR-004-roadmap-demo-and-documentation.md) already
decided both that «the durable interactive product demo belongs to `apps/app`
at `/demo`» and that «a visual prototype under `apps/demo` is not the permanent
product demo architecture». The interim surface simply outlived its purpose.

What went, and what that costs:

- `apps/demo/` (92 files) and the `demo-qa` CI job. No package depended on it —
  it was a leaf — and no import in `apps/app` or `apps/landing` reached into
  it, so nothing broke structurally. `apps/app` builds unchanged.
- **143 unit tests and a browser QA pass, not re-homed.** They asserted the
  demo's own routes, drawer focus trap and bundle colour; there is nothing left
  to assert them against. `app-qa` remains the repository's browser pass.
- **The approved-palette colour guard is gone** (see the P2 entry below for how
  it got there in the first place). `apps/app`'s colour discipline is the token
  package plus the §5 gate in `docs/design/02-building-ui.md`.
- `apps/app/app/globals.css` was a PORT of the demo's theme and said «do not let
  these drift silently». With no upstream left it now owns the theme outright;
  its header records that, and the two decisions worth keeping (the
  `.goproceed-app` scoping, and `--font-display` deliberately not following the
  demo's Manrope).

**Left for the owner, outside the repository:** the Vercel project
`aktflow-demo` (root directory `apps/demo`) still exists and will fail its next
build, because the directory it points at is gone. Delete or pause it in the
Vercel dashboard — nothing in this repository can do it.

Historical references to `apps/demo` in `HANDOFF.md` and in CLOSED entries here
were deliberately left alone: they are dated records of what was true when they
were written, and rewriting them would falsify the record.

---

## P2 — `scripts/validate_package.py` is orphaned: its subject was deleted

Commit `a85e688` («remove») deleted `prototype/` from the tree on 2026-08-19,
together with the `_to_delete/` archives. Three things depended on it and were
red on `main` and on every branch cut from it until 2026-08-20:

| What | How it broke |
|---|---|
| CI job `package-validate` | setup-node could not resolve `prototype/package-lock.json` for its npm cache — the job died before its first real step |
| `make validate` | `validate-prototype`, `validate-qa` and `validate-contracts` all reach into `prototype/` |
| `apps/demo` palette checks | `tests/palette.test.ts`, `tests/styles.test.ts` and `qa/verify.mjs` read `prototype/src/styles.css` as the approved-colour standard — 2 test files failed with ENOENT |

**Done on 2026-08-20, then partly undone hours later.** The approved palette
was first copied byte-identical to `apps/demo/design/approved-palette.css` and
the three demo consumers repointed at it, so the «no colour outside doc 05»
guard survived losing `prototype/`. Later the same day the owner retired
`apps/demo` itself (see the entry below), so that copy and the three checks
reading it went with it. The net position: the demo-era colour guard no longer
exists anywhere, and colour discipline for the surviving apps is
`packages/tokens` + `@goproceed/ui`, enforced by `docs/design/02-building-ui.md`
rather than by a test. The dead `package-validate` CI job was removed and
`make validate` reduced to `validate-canonical` — the one target that never
needed `prototype/` and which `verify` already runs on every push.

**Still open — this item.** `scripts/validate_package.py` (~2,400 lines) is
still tracked but no longer invoked by anything. It reads prototype's
`App.jsx`, its pages, `qa-results.json` and `styles.css` in 29 places, so it
cannot be pointed at the real apps by editing paths: what it asserts —
route-by-route screen ownership, critical contract markers, the v2.9 package's
flow completeness — describes an artefact that no longer exists in the tree.
Two honest options, both a slice of their own:

1. **Delete it**, and with it the last mechanical check on the v2.9 package
   contract. Record in `docs/` what stopped being enforced, so the loss is
   deliberate rather than discovered later.
2. **Retarget it** at `apps/app` — a rewrite, and only worth it if someone can
   say which of its assertions still describe the product. (`apps/demo`, named
   here when this entry was written, is gone too.)

Until then it is dead code that looks alive, which is the state this entry
exists to stop being invisible. Note also that `prototype/` is still listed in
`ROLE_RECORD_DIRS` in `scripts/validate-canonical-docs.mjs`: the exemption is
inert now (there is nothing at that path) and was left alone deliberately —
it costs nothing and would be correct again if the directory ever returns.

---

## P3 — `turbo-ignore` is deprecated; Vercel has a built-in «skip unaffected projects»

The production build log of 2026-08-19 said so in so many words:
`"turbo-ignore" is deprecated. Use Vercel's built-in project skipping instead.
https://vercel.com/docs/monorepos#skipping-unaffected-projects`. It still works
and decided correctly (`No previous deployments found … Proceeding`). When it
is replaced, the `VERCEL_ENV` guard in `apps/app/vercel.json`'s `ignoreCommand`
(Production only, for the pilot) has to survive the replacement — read the
linked page first, per CLAUDE.md. Additionally, `apps/landing/vercel.json` (added
2026-08-20) is a second `ignoreCommand` caller with different semantics (no
`VERCEL_ENV` guard; previews allowed), so the replacement must cover both files.

---

## P3 — CI's `apt-get` step hung for 17 minutes once (runner mirror), and the job timed out

`app-qa` on `5b28c9b` (a docs-only commit): «Install Chrome headless runtime
libraries» ran from 18:59:55 to the 20-minute job timeout while `demo-qa`'s
identical step on the same run took seconds. Same class as the Docker flakes
the five-container stack and the `db reset` retry addressed; a `timeout` plus
one retry around `apt-get update && apt-get install` in both jobs would make it
countable instead of a red run. Not done yet — noted on the day it happened.


**This is the largest open item in the repository and it is not a code defect.**
`apps/app` has no deployed origin: no `vercel.json` for it, no deploy step in
`.github/workflows/ci.yml`, and `infra/README-staging.md` records that staging
has never been provisioned. Every one of the eleven tasks of
`docs/superpowers/plans/2026-08-10-pwa-field-client.md` is complete and verified
locally, and none of them puts the client in a foreman's hand.

**Two things wait on it and cannot be faked.** ADR-007 requires both to be
MEASURED rather than assumed, on the two physical devices its «What this decision
does not remove» section still keeps as a requirement: which browser engines strip
or transcode EXIF and how each honours the `capture` attribute, and the exact
storage-eviction rule including whether an installed home-screen PWA is exempt.
`crypto.subtle` also needs a secure context — localhost qualifies, so local work
is unaffected and only the real thing is blocked.

**2026-08-18 — everything the REPOSITORY can decide about this is now decided,
checked in, and gated. The P0 is NOT closed; what changed is that closing it is
now one sitting of credentialed steps rather than a discovery exercise.**

- `apps/app/vercel.json` — framework, root-relative install and build through
  turbo, `turbo-ignore`. Vercel reads it once the root directory is `apps/app`.
- `apps/app/scripts/deploy-preflight.mjs`, wired as `prebuild` — on a
  deployment build (`VERCEL=1`) it REFUSES to build if any of the twelve
  variables is unset or carries a local value, naming each; silent in CI and on
  a developer's machine, so `verify`/`app-qa` are untouched. Proved in five
  modes and through the real turbo path.
- `NEXT_PUBLIC_APP_ORIGIN` added to `turbo.json` `build.env` — it was NOT in
  the build-cache key, so a redeploy to a different hostname could have served
  a cached bundle with the old origin baked in. That is the rebuild trap the
  note below warns about, arriving through the cache instead of the dashboard.
- `.env.example` is now the complete contract, split into BUILD-TIME and
  RUNTIME. **Two variables it never listed were hard requirements:**
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, read by
  `src/lib/evidence-storage.ts`, which DEFAULTS them to the local stack — a
  deploy setting only the documented variables would have aimed every evidence
  upload at `127.0.0.1:54321` on the server, and the first photo would have been
  the first symptom.
- `infra/README-staging.md` §4 rewritten against the real config (it described
  a 5-migration foundation slice; the chain is 58), §5 reads the preflight line
  before anything else, §6 gains step 9 — the field client on a real phone at the
  real origin, which is where ADR-007's two required measurements finally
  become possible.
- `.vercel/` gitignored.

**What is still yours and only yours:** the Supabase project, the two role
passwords (§3), the Vercel project and its twelve variables (§4.3), the domain
(§0 — still `{{APP_HOSTNAME}}`, still undecided), and two phones (§6.9).

**Note for whoever provisions it:** `NEXT_PUBLIC_APP_ORIGIN` must be set at
BUILD time. A container built once and deployed to a named origin will refuse
every request until it is REBUILT with the value set — `resolveBaseOrigin` fails
closed by design (see the P1 below). Setting it only in the runtime environment
of an already-built image is the shape of mistake this note exists to prevent.

*Measured against `.next/server` output on 2026-08-17, because the mechanism is
not quite what the sentence above suggests and the difference is a debugging
trap. A value PRESENT at build is inlined as a literal and beats anything the
runtime environment says — that is the rebuild requirement. A value ABSENT at
build survives, on the server only, as a real `process.env` read performed at
runtime; the client bundle gets `undefined` either way. So a runtime-only value
appears to work on a build that never had one, and silently does nothing on a
build that did. Set it at build time and the question does not arise.*

**`next start` is a production build and therefore needs it too**, loopback or
not — there is no header-derived origin in a production build as of 2026-08-17
(P1 item 4 below). `qa/field.mjs` sets it to its own ephemeral origin, which is
why the browser pass now exercises the same branch a real deployment will.

## P1 (CLOSED 2026-08-17) — seven residuals from the field-client final review

Adjudicated and parked on 2026-08-11 after the whole-branch review's single fix
wave; all seven closed on 2026-08-17. Recorded here because the review artefacts
are gitignored and would take them with them.

**Two of the seven were recorded WRONG, and that is the part worth reading.**
Both were written from inspection rather than from execution, and both were
adjudicated as low-value on the strength of the description rather than the
behaviour. Items 4 and 6 below carry what was actually measured. The rule this
argues for: a parked item's description is a hypothesis, and re-measuring it
costs less than the work it is describing.

1. **CLOSED — INV-081's catalogue row overstated its own enforcement.** It reads
   «every failed or abandoned in-flight upload raises an explicit unsaved-photo
   warning»; the banner was gated on `holdsUnsavedBytes`, which excludes
   `failed`. **The banner gate was widened rather than the row narrowed** (owner
   decision, 2026-08-17): a P0 invariant's enforcement column should be made
   true, not made smaller. It is a SECOND predicate, `serverDoesNotHaveThePhoto`,
   not a wider first one — `holdsUnsavedBytes` still gates the `beforeunload`
   dialog and the discard control, and must not follow the banner into `failed`,
   where the browser no longer holds the bytes. Worse than the row: the browser
   pass drove that exact failure and **asserted the banner must have cleared** —
   a green gate defending the defect. That assertion is inverted.
2. **CLOSED — `verifyCode` collapsed 429 into «Невірний або прострочений код».**
   The rule moved to `apps/app/src/lib/otp-error.ts` and both phases are forced
   through it, so the next status worth splitting is split for both by
   construction. It takes a status, never a message, so GoTrue's English string
   has no parameter to arrive through.
3. **CLOSED — every `<a>` under `/app/**` rendered with user-agent link
   styling.** Not the design decision it was parked as: «Мої доручення» renders
   each obligation row AS an anchor, so a foreman's list turned purple row by row
   as he worked through it, and `text-decoration` propagates to in-flow
   descendants so the rows' own colour classes could not undo the underline. An
   `a` reset in `globals.css`, plus the gate the entry said it lacked
   (`measureUaStyledLinks` in `qa/field.mjs`).
4. **CLOSED — the loopback port was request-chosen**, but NOT by the fix this
   entry proposed. «Refusing outright when `NODE_ENV === "production"`» would
   have turned the `app-qa` job red: `qa/field.mjs` runs `next start`, which IS
   production, on an ephemeral loopback port and set no origin. The harness now
   names its own origin, which is strictly better — the browser pass exercises
   the branch a real deployment takes instead of a developer fallback no
   deployment may use — and production then refuses every header-derived origin.
   Two facts measured against `.next/server` output while doing it, both now
   written down: `NODE_ENV` is inlined by `next build` (so a shipped bundle
   cannot be argued back into the fallback at runtime), and a
   `NEXT_PUBLIC_APP_ORIGIN` **absent** at build survives as a runtime
   `process.env` read on the server, while one **present** at build is baked in
   and beats the runtime environment. The second corrects the note under the P0
   above, which says only the baked-in half.
5. **CLOSED — the plan still printed the pre-fix recovery mapping.** It printed
   three superseded things, not one: the mapping, `holdsUnsavedBytes`'s
   pre-`CaptureHold` signature, and (as of item 1) the banner's gate. A dated
   header names all three, with inline markers at each site so a reader landing
   mid-document cannot copy them.
6. **CLOSED, AND THE ENTRY WAS WRONG.** It claimed a bracketless `Host: ::1`
   «passes the allowlist and then makes `new URL` throw». It does not and never
   did: the port-strip regex `/:\d+$/` matches the trailing `:1` and normalises
   `::1` to `":"`, which is refused with `UntrustedHostError` — the correct
   error, naming the remedy. What was real is the inverse: that same
   normalisation made the `hostname === "::1"` arm **unreachable from the day it
   was written**, while the function's comment advertised the spelling as
   accepted. Dead arm removed, comment corrected to the bracketed form RFC 7230
   permits, and a test now walks every accepted spelling through `new URL`.
7. **CLOSED — `/context` had no audit at all**, not merely no overflow gate. It
   now has one, listed in `EXPECTED_AUDITS` so dropping the call is a finding.
   The audit did not bless the stub, and the entry recorded that «building the
   real screen is open work and is owed a decision».

   **THE DECISION, 2026-08-18: the route is DELETED, not built.** It was
   foundation-slice scaffolding — `dc59713`, the commit that added
   `GET /v1/me/context` — and it never became a screen. Nothing in the product
   linked to it. No ADR, spec or design listed it: the field-client design's own
   «In» section names exactly three screens (sign-in, «Мої доручення», the
   assignment screen) and this was not among them. The one job it could have
   justified — choosing a workspace — the architecture does not need, because
   `GET /v1/projects` «takes no workspace or member id from the caller at all;
   RLS IS the filter», so «Мої доручення» already spans everything a session may
   see. What the route did do was serve un-themed Ukrainian placeholder text to
   anyone who guessed the URL.

   The audit that covered it goes with it, and the screen counts in
   `qa/field.mjs` and `globals.css` are corrected rather than left to drift.
   **The `/v1/me/context` API is untouched** — a real route with real tests, and
   `infra/README-staging.md` §6 still verifies staging through it.

   *Adding an audit for a page and then deleting the page is not wasted work in
   the wrong order: the audit was right while the gap was real, and the gap is
   how the question «what is this page for?» finally got asked.*

## P1 (CLOSED 2026-08-10) — valuation funding was first-come and was never re-offered

**What:** the work-item pool is claimed by whichever root records first. When
that root later withdraws, the freed money is not offered to roots whose
performed quantity now sits within the contract quantity. Minimal case, contract
quantity 4 and a pool of 400: root A records 4 and takes all 400; root B records
4 and gets nothing; A corrects away its 4 and returns 400. Performed quantity is
now exactly 4 and the pool is entirely idle, with B holding nothing for work
that is fully within contract.

**Why:** M6's value-at-risk projection reports B's four units as performed but
unvalued, which is wrong — they are within contract and priced.

**Pros of fixing:** the pool matches performed scope in every ordering, not only
the ones where nobody over-performs and then corrects.
**Cons:** closing it means a correction on one root writes allocations for OTHER
roots. That is a lineage decision, not a patch: `progress.adjust` currently
touches only its own root by design, and the engineering review's D1 finding was
specifically about money moving between roots.
**Context:** found by the over-contract property walk in
`packages/domain/src/valuation.test.ts`, which documents the gap as a named
test rather than leaving it implicit. Migration `0022` added
`valuation_allocations.funded_quantity`, which is the fact any redistribution
scheme will need.
**Depends on:** a design decision about whether allocation lineage may be
rewritten by a command acting on a different root.

**2026-08-08 — reshaped by [ADR-008](docs/decisions/ADR-008-valuation-carves-at-admission.md),
not closed by it.** The ADR says so in its own Consequences: carving at admission
narrows the window, because only **admitted** quantity competes for the pool and
admission is a deliberate authorised act rather than a side effect of
measurement. The minimal case above survives the narrowing — it needs A and B
each to reach an admission — and the analysis still owes a re-run against the new
ordering.

**2026-08-10 — THE RE-RUN THIS ENTRY OWED, EXECUTED.** Against the applied chain,
after the P0 denominator fix, on a line of contract quantity 4 and a pool of
40 000 minor units, two assignments on one work item:

| step | allocated | root A | root B |
|---|---|---|---|
| A records 4, admits | 40 000 / 40 000 | 40 000, funded 4 | — |
| B records 4, admits | 40 000 / 40 000 | 40 000, funded 4 | **0, funded 0** |
| A corrects −4 | **0 / 40 000** | 0, funded 0 | 0, funded 0 |
| B closes a second stage | **0 / 40 000** | 0, funded 0 | 0, funded 0 |

The line has measured 4 of its 4 contracted units, every unit is within contract
and priced, and the pool is **entirely idle**. So the case survives ADR-008
intact.

**AND IT IS WORSE THAN THIS ENTRY DESCRIBED.** «Not redistributed» understates
it: B's admission is SPENT. Its root already holds an allocation — of zero — so
B has no pending entry left, and the last row above is the finding. A later
closure on B does not reopen anything. Once a root is admitted into an exhausted
pool it can never be funded for that work again, by any action on B.

**CLOSED 2026-08-10 BY THE OWNER'S DECISION: admission is a STANDING CLAIM, not
a one-shot event.** The second candidate below is the one taken.

**What changed, and it is four lines.** `appendValuationAllocation` writes NO
ROW for a valued, positive entry whose carve funded nothing and moved no money;
`admitClosedStageQuantity` skips it instead of counting it. The entry therefore
keeps its one allocation slot, stays pending, and the assignment's next closure
offers it to a pool that may by then have room. Verified on the minimal case:
B's first closure now admits 0 and writes nothing, A's correction returns the
pool, and B's SECOND closure funds it — 40 000 of 40 000, one row for B's root.

**Why this shape rather than a successor allocation.** A second row per entry
would have meant dropping `unique (workspace_id, progress_entry_id)`, and
migration `0046:150-152` rests on exactly that key: «no entry is ever admitted
twice, so the failure is early admission, never double admission». This does the
opposite of weakening it — an entry that funded nothing has not been admitted at
all, so the slot it never took is still there. No migration, no schema change.

**D1 is satisfied.** A's correction still writes nothing outside A's lineage. It
is B's OWN closure that funds B, which is what made this address available where
«a correction on one root writes allocations for other roots» was not.

**Three narrowings, each load-bearing.** An UNVALUED entry still writes its row —
its zero means «this line has no price», which the M6 read is entitled to see,
not «no room». A NEGATIVE entry always settles: a removal that returns nothing
has still done its work, and leaving it pending would re-offer it forever. And
both money and funded quantity must be zero — a partial carve is a real
admission of the part it paid for.

**Covered by** `apps/app/tests/admission-valuation.int.test.ts` §"the pool is
offered again when the root that held it gives it back", verified to fail
without the change.

**A SECOND CANDIDATE DESIGN, which this re-run is what suggests — and which is
the one taken above.** The entry
frames the fix as «a correction on one root writes allocations for OTHER roots»
and rejects it on the engineering review's D1 finding. B's own closure is a
second address for the same repair: an admission could top up roots whose
admitted quantity is not yet funded and for which headroom now exists, writing
only inside the lineage whose closure is running. A's correction would still
touch nothing but A. That keeps D1 satisfied and changes something else instead
— whether admission is a one-shot event per entry or a standing claim — which is
the decision to take, and it is a decision rather than a patch.

## P1 (CLOSED 2026-08-10) — M4 prints. The ДБН retrieval record landed.

**CLOSED the same day it was half-closed.** The owner supplied the download URL;
the file was re-fetched from it and hashed independently — 636 603 bytes,
`sha256=4592eda…`, matching the digest the Додаток В transcription had already
been verified against. `DBN_RETRIEVAL_RECORD` carries the URL, the date and the
hash, and `statutory_acts.render` returns a document.

`url` records the durable `laws_detail` page rather than the
`files-token` link the bytes actually came from: a signed token link expires, and
a record that stops resolving leaves the tag asserted again — the exact failure
this field exists to end. Both URLs are named in the code so neither is lost.

**The provenance string is now DERIVED from the record.** It used to say
«URL/дата/хеш не збережені», which was true and became false the moment the
record landed; a sentence maintained in step with a record is a sentence that
will one day contradict it. The independence caveat is not derived and stays
verbatim, because it is still true: reproducing one fetch is not two independent
sources agreeing.

**Original entry, kept because it is the record of the blocker**

**HALF CLOSED 2026-08-10.** `statutory_act_versions.freeze` still ALWAYS refuses
and M4 still ships a composer and no document — but for ONE reason now instead
of two.

**Closed.** `dodatok_v_field_list_not_committed`. The owner supplied the official
ДБН А.3.1-5:2016 file and confirmed the edition is current. It is the same file
the 2026 audit used, identified by content and not by name: 636 603 bytes and
`sha256=4592edafaa8097d3b9305b7934d080256d649616a2741b6a5537a28606a665e3`, with
the three byte-level quirks prohibition F protects all present — `посада,номер`
without its space against `посада, номер` with it two lines below,
`На основі викладеного`, and the `Притітка` typo (p. 51, under Додаток Н's
electrical list, NOT in Додаток В). The forms also mix apostrophes: U+0027 in
`обов'язковий`, U+2019 in `ім’я`.

All 51 printed lines of В.1 «Форма першої сторінки» and В.2 «Форма останньої
сторінки» are in `technical/requirements/dbn-a31-5-2016-dodatok-v.csv`,
machine-transcribed and verified byte-for-byte;
`apps/app/src/lib/dodatok-v.ts` is generated from it and
`dodatok-v-fidelity.test.ts` re-checks the two with `Buffer.equals` every run.
Додаток В is **обов'язковий**, and the В.1/В.2 split the docs assumed is real.

**Still open — and it is two strings.** `DBN_RETRIEVAL_RECORD` needs the URL the
file was downloaded from and the retrieval date. The hash is already recorded. A
hash proves two people hold the same bytes; it says nothing about where they came
from, and while the record is null no `VERIFIED_PRIMARY` string reaches a
customer-facing render.

**And when it lands, the act prints with TEN blank fields.** That is the owner's
decision of 2026-08-10 — fill what the product knows, leave the rest for the hand
that signs — not an oversight. Ten of 51 lines are bound: the act date, three
representatives in В.1, the builder's organisation, the works presented for
closure (`quantity_lines`), the decision block, and three names in В.2. Blank by
design: проектна документація, матеріали з сертифікатами, відхилення, дати
початку/закінчення — none of those facts exist in the data model at all (no
column anywhere matches material, certificate or deviation).

**Two of the blanks are cheaper than the rest — CLOSED 2026-08-10.**
«Найменування робіт» and «об'єкт будівництва» ARE in the database —
`work_items.description`, `projects.name` — and never reached the renderer,
because `StatutoryActVersionView` carried ids and not names. The view is widened
and ordinals 6 and 8 are bound; **ten blanks are now eight.** The remaining eight
stay blank because no column anywhere holds them.

It was not two read-only fields, and the reason is worth keeping. `projects` takes
an UPDATE from any `project.admin` at any time (`projects_update`, 0011:125-127) —
no trigger, no status, no terminal state. An act that read its project's name LIVE
would be destroyed by an ordinary rename: `content_hash` was pinned over the old
string, so `statutory_acts.render` would answer `frozen_content_hash_divergence`
for ever after. So the name, the address and the source version are PINNED at the
freeze (migration 0056), the way a signatory's organisation name already is, and
`loadActVersionView` branches on `status` rather than coalescing — a coalesce would
let an address added later start printing into an act frozen without one.

`work_items.description` needed no column and is read live: a line an act can name
belongs to a PUBLISHED contract version, and `app.guard_work_item()` refuses every
update to one. That is the same chain `unit_code` already rides on (0047:421-437).

Covered at three levels: the two CHECKs from the table owner in
`packages/testing/src/m4-act-schema.test.ts` (verified to fail without 0056), the
widened view and the draft-follows-a-rename arc in `apps/app/tests/m4-act.int.test.ts`,
and the binding map in `dodatok-v-fidelity.test.ts`. **The frozen arc has no
end-to-end cover and cannot have one until the retrieval record lands**, because
the freeze still refuses — that gap is recorded in the test that stops at it.

## P1 (CLOSED 2026-08-10) — apps/demo could be published with an unreplaced placeholder

**Closed both halves, in the order that mattered.** The owner chose to remove the
naming rather than turn CI red: /legal/privacy no longer names a form-handling
service, because there is none to name — `VITE_PILOT_ENDPOINT` is unset and
`submitPilotDraft` short-circuits to `mailto`. All three submission states are
still disclosed, including the two involving a third party; that party is
described by its ROLE («цей сторонній сервіс»), which is true, instead of by a
name this deployment does not have. Inventing one would have been a false
statement about a data processor on the page that exists to prevent exactly that.

**Only then did `preflight` go into CI**, before `build` in the demo-qa job. That
order is the whole point and preflight.mjs's own header argues it: «a suite that
is red by design trains everyone to ignore red». Added while the token was still
live, the gate would have been permanently red and would have taught people to
ignore it. It is green now, and what it stops is the NEXT token.

**A new hole opened where the old one closed, and it is covered.** Removing the
name means that setting `VITE_PILOT_ENDPOINT` would start sending nine field
values to an unnamed processor — the same misdescription in different clothes,
and one nobody would notice because the thing preflight watched is gone.
`apps/demo/tests/claims.test.ts` now asserts the implication (an endpoint implies
a named processor) and exercises the predicate against both sides, so it cannot
decay into a check that passes by matching nothing.

**Original entry, kept because it is the record of what was wrong**

**Found 2026-08-10 while walking the pilot path by hand.**
`/legal/privacy` renders the literal `{{FORM_PROCESSOR}}` twice, inside `<code>`,
in the sentence naming who processes a visitor's data. `src/pages/Legal.tsx`'s own
header calls this a LAUNCH BLOCKER — «the site must not go live with this token
unreplaced» — and `pnpm --filter @goproceed/demo preflight` exits 1 for exactly
this reason.

**The gate exists and is not on the path that publishes.** `.github/workflows/ci.yml`
runs typecheck, lint, test, build and `qa` for demo-qa; `preflight` is run by
nobody, and `qa`'s own scan of the token is report-only and does not fail. Vercel
deploys on every PR.

**Not a data-loss bug.** `VITE_PILOT_ENDPOINT` is unset, so `submitPilotDraft`
short-circuits to `mailto` and submissions arrive as email; the defect is the
disclosure text, which is the worst page to carry a placeholder.

**Fix:** add `pnpm --filter @goproceed/demo preflight` to the demo-qa job, or
remove the sentence. One line either way.

## P3 — the two retention figures v0.1-M2-A had to choose are defaults, not policy

**What:** `organizations.evidence_quota_bytes` (NULL, meaning unlimited) and
`organizations.blocked_content_retention_days` (7). Both mechanisms are
implemented and tested; both numbers are placeholders.

**Why:** `technical/data-retention-catalog.csv` marks every duration in this
product `duration_external_gate`, so neither figure is this slice's to settle.
The quota defaults to unlimited because that is the behaviour that already
shipped — turning it on with an invented number would break workspaces to
enforce a rule nobody approved. The blocked-content window defaults to seven
days because the domain already fixes seven days for the analogous quarantine
(a revoked pending original), and files-and-storage.md puts both in one
"Restricted quarantine" class.

**Pros of settling them:** the quota starts protecting storage instead of only
being enforceable.
**Cons:** none technical; this is a policy decision with a retention schedule
behind it.
**Depends on:** the approved retention schedule (external gate V-003).

## P2 — purge claims are not fenced

**What:** `public.claim_upload_purge` marks a row claimed with a timestamp, and
`complete_upload_purge` / `fail_upload_purge` take only the intent id. A worker
that stalls past the one-hour reclaim window, then resumes, can clear a newer
worker's claim or spend its retry budget — neither function can tell the current
claimant from a stale one.

**Why:** today the purge worker has no deployed runner at all, so there is
exactly one caller and the window is theoretical. It stops being theoretical the
moment a second instance runs.

**Pros of fixing:** the claim becomes a lease with an owner, which is what the
one-hour window already implies.
**Cons:** a claim token column plus signature changes to three functions and the
worker; worth doing WITH the deployment work rather than before it, so the
fencing matches whatever runner is chosen.
**Depends on:** wiring the purge worker to a runtime (see the gate record).

## CLOSED — nothing proves inspection actually ran

**What:** `app.finalize_upload_intent` (migration 0029) is the only way to create
evidence, and it fixes provenance, content identity and the state transition.
The one thing it cannot check is whether the bytes were really downloaded,
hashed and inspected — it takes `inspection_status` from its caller.

**Why:** in v0.1-M2-A the route IS the server. The database has no way to tell
the server's verdict from a member's claim about their own upload, because both
arrive as `aktflow_app`. A member willing to call the function directly can
assert `passed` for content nobody looked at, provided they present the hash
their own intent declared.

**Pros of fixing:** `inspection_status` becomes a fact rather than an assertion,
which is what the whole evidence chain rests on.
**Cons:** needs the service plane. `service.upload_finalize` already exists in
`technical/permissions/capabilities.csv`; the work is a second database role,
credentials for it, and routes that act as it for exactly this call.
**Depends on:** the same service-principal work as the `event_source` item
below. Doing them together is the point.

**Closed** 2026-08-01 by migrations `0034` and `0035` on
`claude/m2-service-principal`. The verdict is now writable only from a
connection whose login is a member of `aktflow_service`, which
`aktflow_app_login` is not. This does not make inspection *correct* — see the
gate record for what remains true.

## CLOSED — capture_events cannot tell the server's assertion from a member's

**What:** `capture_events.event_source` distinguishes what the device claimed
from what the server observed, but v0.1-M2-A has no service principal separate
from `aktflow_app`. Migration 0023 binds a capture event to an intent the actor
created, which stops forging events on somebody else's upload, but a member can
still write `event_source = 'server'` on their own.

**Why:** the column is provenance. If it can be set by the party it is meant to
distinguish from, it records less than it appears to.

**Pros of fixing:** the server's account of an upload becomes unforgeable.
**Cons:** needs the service plane — `service.upload_finalize` already exists in
`technical/permissions/capabilities.csv` — which means a second database role
and a way for routes to act as it. That is infrastructure, not a policy tweak.
**Depends on:** the service-principal work the capability catalog anticipates.

**Closed** 2026-08-01 by migrations `0034` and `0035` on
`claude/m2-service-principal`. The verdict is now writable only from a
connection whose login is a member of `aktflow_service`, which
`aktflow_app_login` is not. This does not make inspection *correct* — see the
gate record for what remains true.

## P2 — a deactivated member cannot abandon their own upload through the route

**What:** migration 0031 makes the commands answer ownership with
`app.member_id_any_status`, so a member deactivated mid-upload can still orphan
their own bytes at the database level, and the hardening suite proves it. The
finalize ROUTE still cannot reach that path: its front door calls
`requireActiveMembership`, and the intent's own SELECT policy requires an active
membership, so a deactivated caller gets 404 before any command runs.

**Why:** INV-047 wants revoked content marked for purge promptly. Losing the
`evidence.record` capability is handled — the finalization command orphans the
bytes itself, inside the row lock. Losing the membership outright is not: those
bytes wait for the 24-hour intent TTL, get swept to `expired`, and enter the
purge queue from there.

**Pros of fixing:** the two revocation shapes behave the same, and the promptness
INV-047 asks for stops depending on which one happened.
**Cons:** the route cannot read the intent at all without an active membership,
so this needs a definer for the read as well — a second authorization path whose
only caller is this case. Worth doing deliberately, not as a patch.
**Bounded by:** the intent TTL. The bytes are collected within 24 hours either
way; what differs is whether that happens at revocation or at expiry.

## P2 — the evidence purge worker still runs nowhere

**What:** unchanged from the pre-landing review, but 0031 raises the stakes.
Usage now counts every unpurged byte, so storage that is never purged is storage
that is never given back, and a workspace with a quota set will eventually stop
accepting uploads rather than silently overrun.

**Why:** `0021` schedules only the expiry marking, which is pure SQL. Deleting
bytes needs storage credentials, so `apps/app/src/lib/evidence-purge.ts` must be
wired to a runtime that holds them.

**Pros of fixing:** INV-047's 24-hour guarantee starts operating instead of being
demonstrated by tests, and the quota becomes a bound rather than a ratchet.
**Cons:** deployment work, not code — it is written and tested already.

## P3 (CLOSED 2026-08-18) — the Supabase CLI was unpinned, so the toolchain changed without a commit

**What:** `.github/workflows/ci.yml` pins the `supabase/setup-cli` action by SHA
and then asks it for `version: latest`. The action is reproducible; the tool it
installs is not. At the time of writing CI runs CLI **2.111.0** while local
development runs **2.75.0** — 36 releases apart.

**Why it surfaced:** the first CI run of the v0.1-M2-A branch failed in
`supabase db reset`, after all 33 migrations applied, with a 502 from the local
stack while restarting containers. A rerun with no code change passed, so that
one was a runner flake. But diagnosing it meant asking whether a CLI release had
changed behaviour, and the honest answer was that nobody could tell — which is
the actual problem. A green build that depends on an unpinned tool is a build
whose result can change overnight for reasons no commit explains.

**Pros of fixing:** CI failures become attributable to the diff. Local and CI
run the same tool, so "works on my machine" stops being a category of answer.
**Cons:** a pinned CLI has to be bumped deliberately, and a stale pin drifts from
the Supabase platform it talks to. That is a maintenance cost, not a hidden one.
**Not done here** because it changes CI policy for the whole repo, and `main`
has been passing with `latest` since long before this branch.

**CLOSED 2026-08-18.** Pinned to **2.115.0** — the version CI resolved on that
day, so nothing about what runs green changed; local (2.75.0) is now the one that
differs, and says so. The drift the entry measured at 36 releases was 40 by
closing time, and **the pin value moved from 2.114.0 to 2.115.0 during the hour
it was being decided** — the CLI's own upgrade banner was already one release
stale — which is the entry's argument demonstrated live.

The shape is what makes it durable rather than a number in a YAML file:
- `.supabase-cli-version` at the root is the SINGLE source, mirroring `.nvmrc`.
- Both CI jobs read it into `setup-cli`'s `version` input, and then ASSERT the
  installed CLI equals it and print both — until now no step recorded which CLI
  actually ran, so «which version failed?» could not be answered from a red run.
- `scripts/check-supabase-cli.mjs` (`pnpm db:check-cli`, and run first by
  `db:local-credentials`) WARNS on a local mismatch and never refuses: the point
  is a printed difference instead of a silent one. The message names the
  magic-link case as the shape of failure it explains.
- `infra/README-staging.md` §2 now says which CLI to `db push` with, and why
  pushing 58 migrations with a version CI has never run means meeting a
  CLI-default difference for the first time on staging.

The maintenance cost the entry named is real and is now explicit: bumping the
CLI is one edit to one file, in a commit that can be bisected — the entire
point. `main` had been passing with `latest` since long before this entry;
that was true, and it was also the fragility.

## CLOSED 2026-08-06 — doc 07's Expo SDK baseline

**What it recorded:** doc 07 named "Expo SDK 56" while `apps/mobile` resolves to
Expo SDK 57.0.9, and the entry argued the document was normative architecture
because it carried no Historical marker and did not sit under `docs/legacy`.

**Closed on both halves.** The document is now
`docs/legacy/07-technical-architecture.md`; `docs/legacy/README.md` makes
everything it governs Historical and non-normative, which is precedence level 6
and not level 2. Its content also moved: `:8` reads "Expo SDK 57" and `:20`
fixes the baseline at "Expo SDK 57.0.9". Nothing here is outstanding.

**One thing this closure does not say.** It says nothing about whether
`apps/mobile` should be on the delivery path.
[ADR-007](docs/decisions/ADR-007-pilot-field-client.md) decisions 1–2 take it
off the v0.1 path entirely — the v0.1 field client is a PWA served from
`apps/app` — and keep the tree as the starting point for v0.3 offline work. Its
SDK therefore ages without being on the delivery path, which ADR-007 accepts as
a named cost.

## P2 — the pilot-device inventory does not exist

**What:** `docs/product/roadmap.md`, `docs/product/scope-and-boundaries.md`
and `ADR-004` all require an actual pilot-device inventory — one supported
iPhone and one lower-resource supported Android device, physical, confirming
the iOS 16.4+ / Android 10+ support floor — as *entry* evidence for v0.1-M2,
required before capture UX is frozen. No such inventory exists.
`docs/superpowers/plans/evidence/2026-08-01-b0-procurement.md` records the
two devices as unprocured; this entry is the standing tracker for that gap.

**[ADR-007](docs/decisions/ADR-007-pilot-field-client.md) makes this item
sharper, not softer**, and names this entry in §"What this decision does **not**
remove". The v0.1 field client is a PWA, so the whole distribution chain is
gone — no Apple Developer Program membership, no D-U-N-S registration, no Google
Play Console, no funded Expo plan, no UDID registration, no EAS internal build,
no TestFlight or Play internal-testing track. The two physical devices are not
gone. They now matter more: browser behaviour on the `capture` hint, on image
metadata stripping and transcoding, and on site-storage eviction varies by
engine and version in ways a native camera API does not, and those are
measurements only real hardware can make
([test-strategy.md](docs/delivery/test-strategy.md) §"Field client",
[version-0.1.md](docs/delivery/version-0.1.md) §"v0.1-M2").

**Why:** the requirement sits in front of capture UX, and nothing in the earlier
capture work reads a device inventory or blocks on one. What depends on it is
the closing evidence for M2: the device-matrix recording and the per-browser,
per-OS measurement table, which need the physical devices themselves, and the
inventory is how their model numbers and OS versions get into that table.

**Pros of fixing:** closes an entry-evidence gap the roadmap has carried
open since before the field-client work started, and gives the M2 measurement
table real device rows instead of placeholders.
**Cons:** none technical — it is a purchasing/logistics task, not code.
**Depends on:** the same two devices named in the B0 procurement record, and on
nothing else. Buying them no longer waits on any account: with the store chain
removed, a PWA needs an HTTPS origin, which the product already requires.

## P1 (CLOSED 2026-08-18) — the product is renamed to GoProceed, and every runtime identifier has followed

**What:** the owner stated on 2026-08-03 that the product is GoProceed and that
the `aktflow` identifiers are being replaced. `apps/mobile`'s deep-link scheme
was corrected immediately because it had just landed. A three-task rename
slice on 2026-08-03 then moved every workspace package identifier
(`@aktflow/*` → `@goproceed/*`, 10 `package.json` files and the source files
importing them), the root `package.json` name, and the `aktflow-app` CSS
class. What is left, measured on this branch:

- **79** tracked files referencing the five PostgreSQL roles `aktflow_app`,
  `aktflow_app_login`, `aktflow_service`, `aktflow_service_login` and
  `aktflow_worker` — migrations, RLS policies, grants, the local-credentials
  script, CI env, and `.env.example`
  (`git grep -lE "aktflow_(app|app_login|service|service_login|worker)" | wc -l`,
  2026-08-06; the figure was 77 when this item was written).
- **75** tracked documents and catalogs under `docs/` and `technical/` still
  mention `aktflow` in some form — 66 under `docs/` and 9 under `technical/`
  (`git grep -li aktflow -- docs technical | wc -l`, 2026-08-06; 71 when this
  item was written, 58 before that). Three intervening docs slices moved
  documents into `docs/legacy/`, which grew this count rather than shrinking it.
  Both counts are stated with the command that produces them because a bare
  number in this file has already gone stale twice.
- **2026-08-08 — the counts are unchanged and the COMMAND has gone partly
  blind.** Re-run on this branch, `git grep` still reports **79** and **75/66/9**.
  It reports them because `git grep` reads only **tracked** files, and migrations
  `0036`–`0051` are all untracked: **13** of the **38** migration files that
  reference the five roles are invisible to it. Counted over the working tree
  instead — `grep -rlE "aktflow_(app|app_login|service|service_login|worker)"
  --exclude-dir=.git --exclude-dir=node_modules .` — the figure is **110** files,
  not 79. Neither number is wrong; they answer different questions, and the entry
  above quietly asked the first while meaning the second. **The role rename now
  has to move eleven unapplied migrations as well as the deployed ones**, which is
  cheaper than it sounds — an unapplied file is a text substitution — and is
  cheapest before they are applied.
  *(Re-measured 2026-08-08 with the command above, after migration `0051`
  landed: the working-tree figures read 12/37/108 before it and 13/38/110 after.
  They are measurements of a moving uncommitted tree — re-run the command rather
  than quoting these.)*
- ~~The user-visible product copy is untouched~~ — **DONE 2026-08-10.** All 26
  on-screen `AktFlow` strings across 11 files now read `GoProceed`: the login
  heading, the demo shell's brand and every page header, the demo `<title>`, the
  pilot page's prose and its mailto subject, and the landing page's title and
  meta description. No test asserted any of them, so nothing had to be inverted;
  the whole workspace stays green. This is the half a pilot customer can see,
  and it was the cheap half.
- Four domains: `aktflow.app`, `aktflow.com`, `aktflow.example`, `aktflow.pilot`.
- Two env vars: `AKTFLOW_CHROME_PATH`, `AKTFLOW_BASE_URL`.

**Why the ROLES are still not swept here, and this is unchanged:** the database
roles are the hard part and they are already merged. `ALTER ROLE ... RENAME TO` is not a text substitution — a role
rename clears an md5-hashed password, every connection string and CI secret has
to move in the same window, and the rename must land in a migration that runs
against an environment whose app is already connecting under the old name. That
is a deployment-ordering problem, not a find-and-replace, and it belongs in a
slice with its own plan and its own rollback story.

> **ROLES DONE 2026-08-17 — migration `0057`. The paragraph above was reasoning
> about a deployed environment, and there is none.**
>
> `infra/README-staging.md` §Status still records that staging has never been
> provisioned: no Supabase cloud project, no Vercel project for `apps/app`, no
> deploy step in CI. The only databases that have ever run this chain are the
> local stack and CI's, both rebuilt from scratch every run. There was no live
> connection string to coordinate and no session to keep alive — so the whole
> «deployment-ordering problem» applied to a future that had not happened yet,
> and the rename was free. **It stops being free the day the P0 above is
> provisioned**, which is why it landed first.
>
> **Two of that paragraph's three technical claims were also wrong on this
> stack**, measured before the migration was written, in a transaction that was
> rolled back:
> - «clears an md5-hashed password» — `show password_encryption` is
>   `scram-sha-256`, whose verifier is not salted with the role name. The
>   password survived the rename intact.
> - «not a text substitution» — true of the FILES, and irrelevant to the
>   catalog: 137 RLS policies and 126 table grants named `aktflow_app` before
>   the rename and named `goproceed_app` after it, with zero still naming the
>   old one, because `pg_policy.polroles` and ACLs hold OIDs rather than names.
>   Role membership survived too. No policy is rewritten and no grant re-issued.
>
> **AND THE OID ARGUMENT HAS AN EDGE THE PROBE DID NOT COVER — the role name
> stored as TEXT.** `0057`'s first draft said it «renames and does nothing
> else». That was wrong, and the TEST SUITE is what said so: six tests in
> `m2-binding-hardening` and `m2-service-principal` failed at once with
> `role "aktflow_service" does not exist`. `app.finalize_upload_intent`
> (migration `0035`) guards on
> `pg_has_role(session_user, 'aktflow_service', 'member')` — a string inside
> `prosrc`, which is not a dependency the catalog tracks, so the rename left it
> pointing at nothing and every server-side finalize raised. It fails closed,
> but the whole evidence path was down.
>
> `0057` now rewrites function bodies and object comments too, by SEARCHING the
> catalog rather than naming the objects this tree happens to contain, and
> asserts afterward that none of either kind is left. The full catalog was then
> swept for every other place a name can hide as text — policy expressions,
> check constraints, column defaults, views, rules, trigger definitions, cron
> commands, default ACLs, event triggers, per-role settings. All zero; only
> function bodies (1) and object comments (4) carried anything.
>
> *The lesson is narrower than «test your migrations» and worth the line: a
> probe that measures the mechanism you thought of is not evidence about the
> mechanisms you did not. The rolled-back transaction proved OIDs follow a
> rename, which was true, and said nothing about the one reference that was
> not an OID.*
>
> Only the third claim held: every connection string and CI secret did have to
> move in the same commit, and did — `packages/database/src/tx.ts`, its test,
> `scripts/set-local-app-password.mjs`, four `ci.yml` connection strings,
> `.env.example`, `validate_package.py`, and the reference sweep across 44 live
> files.
>
> **The 40 files under `supabase/migrations/` are NOT edited**, by owner
> decision the same day. Substituting the text there would have left a
> textually clean tree and would have been safe in the narrow sense that
> nothing had applied them for real — it is refused because a migration is
> history in this repository (this very file says so about a migration
> *comment*), and history should say what happened: these roles were created as
> `aktflow_*` and renamed afterward. A fresh `db reset` creates the old names in
> `0003`/`0034` and renames them in `0057`, which looks redundant and is exactly
> right.
>
> **A gate keeps them gone.** `staleRoleNameErrors` in
> `scripts/validate-canonical-docs.mjs` walks every tracked file and fails the
> build on any of the five old names outside a record — `supabase/migrations/`,
> `docs/legacy/`, `docs/superpowers/`, `migration/`, the two dated review
> records, this file, and the validator that defines the rule. It also corrected
> that validator's own comment, which had said the roles «are not being
> renamed» while excusing them from the branding check.
>
> **Still open in this entry, and deliberately not folded in:** the four
> `aktflow.*` domains, the two `AKTFLOW_*` env vars, and the documents that
> mention `aktflow` in non-role forms. None of them shares the closing window
> the roles had — they will cost exactly the same after staging exists.

### DOMAINS AND ENV VARS CLOSED 2026-08-18 — and one of them WAS on the P0's path after all

**The sentence above was wrong about the domains.** They did share a closing
window, for a reason the roles' argument did not cover:
`infra/README-staging.md` — the runbook an operator follows to PROVISION the P0
— spelled the pre-rename hostnames in **nine** places, including every `curl` of
its §6 verification checklist and the Supabase project name in §1. Following it
would have bound DNS and a Vercel domain to a product that no longer exists, at
the one moment where that is expensive to undo. That is not "the same cost
later"; it is a defect sitting directly on the next thing the owner does.

**They are placeholder tokens, not corrected literals** (owner decision,
2026-08-18): `{{APP_HOSTNAME}}` and `{{LANDING_HOSTNAME}}`, matching the
`{{CONTACT_EMAIL}}` / `{{DEMO_HOSTNAME}}` convention already in the tree, and
defined in a new §0 of the runbook. No domain for this product is recorded
anywhere as registered, and `apps/demo/README.md` §2 forbids inventing one —
a plausible `goproceed.com` would have read as settled fact.

**The counts in the bullets above were also wrong, in both directions.**
`aktflow.app` had ALREADY left every live file; `aktflow.example` survived live
only in `technical/openapi.yaml` (the rest is `prototype/`, which
`.github/workflows/ci.yml` records as out of scope). Against that, the entry
never mentioned the Supabase project name, the pilot draft's localStorage key,
or the catalog-snapshot script below.

**A silent regression from the ROLE rename, found here rather than by that
slice.** `scripts/snapshot-db-catalog.mjs` selected roles with
`rolname like 'aktflow%'`. After migration `0057` that query still SUCCEEDS and
still returns `anon`/`authenticated`/`service_role` — it just returns no project
roles, so `pnpm db:catalog-snapshot` produced a snapshot missing the five rows a
reviewer reads to see who can log in and who bypasses RLS. Nothing failed.
`staleRoleNameErrors` matched whole identifiers and could not see a LIKE prefix
written to match them as a set; it matches `aktflow%` now, and the negative test
for it is the fixed script itself.

**The draft key is a data migration, not a substitution.**
`aktflow.pilot.draft` → `goproceed.pilot.draft` in
`apps/demo/src/pilot/draft.ts`, with the old key read once and moved forward on
load. Renaming it outright would have shown an empty form to a contractor who
typed three free-text answers and came back after the deploy — the outcome that
module's own header calls «unrecoverable». `/legal`'s D4 disclosure names the
key to the visitor, so it can only be truthful about ONE key; `Legal.tsx` now
IMPORTS the constant instead of re-declaring it under a comment that said the
two «must never disagree» and left it to discipline.

**Gated:** `staleDomainErrors` fails the build on `aktflow.(com|app|example)`
in any live file, sharing the role guard's record exemptions.
`aktflow.pilot` is deliberately not matched — it is a storage namespace, and it
survives on purpose as the migration constant.

### CLOSED 2026-08-18 — the rename is finished, and the gate is now total

The catalog identifiers (`platform_billing`, `external`, `support`,
`audit_writer` in `technical/data-access-surface.csv`), the `*_control` /
`*_requirement` CSV column headers, `technical/permissions.csv`'s prose and
`scripts/validate_package.py`'s expected column sets all moved together — a
header and the code asserting it cannot move in separate commits.

**`supabase/config.toml`'s `project_id` is `goproceed`**, and the ORDER matters
enough to be written down: `supabase stop` reads that value to find the
containers, so the stack must be stopped BEFORE the edit. Editing first leaves
the old containers running and unreachable by the CLI, and `supabase start` then
builds a second stack beside them. Recorded in the file itself, above the value.

**The case-sensitive scans had been missing the brand in its own spelling.**
Every `aktflow` grep in this entry — including the ones that produced its
counts — was lower-case, so `AktFlow` survived in
`scripts/validate_package.py`'s own PASS/FAILED output, in
`technical/terminology.csv`'s Ukrainian terms («Оплата AktFlow»), and in the
title of `.interface-design/system.md`, a file that calls itself «source of
truth for every rewritten `/app/**` route».

**And `README.md`'s «Actual state (do not overclaim)» section said the roles and
the user-visible copy «have not moved».** Both had — the copy on 2026-08-10, the
roles on 2026-08-17. A stale claim in the section named for not overclaiming is
the sharpest version of the failure this repository keeps finding.

**The gate is a whole-brand ban now, which is the rule that could not be written
until the rename was done.** `staleBrandErrors` fails the build on `aktflow` in
any case in any live file. The two narrow rules are kept for their better
messages and their occurrences are not double-reported. Three exemptions, each
argued at the call site: a line that is explicitly historical (the era happened
and the repository may describe it — now allowed in `.sql` and `.md` alike, not
just under `docs/`); the pilot-draft migration constant and its test, by exact
line rather than by file, so those files are still checked for every other
spelling; and record paths, which grew by `prototype/` (frozen, out of scope per
`ci.yml`), `design-references/`, `docs/22-data-api-contract.md` (self-declared
HISTORICAL / NON-NORMATIVE, partly in Russian, which the English legacy test
cannot read), and **`technical/openapi.yaml` + `technical/schema.sql` — the v2.9
target package `README.md` itself calls historical.** Those keep «AktFlow API»
and `LicenseRef-AktFlow-Proprietary` deliberately: a licence identifier is not a
branding string to flip, and renaming a record makes it describe a package that
never existed.

**Nothing is left of this entry.** Verified by the gate rather than by a grep:
the build fails if any of it returns.

`docs/legacy/04-screen-specification.md` §S29 specified `aktflow://` and
`aktflow.app` universal links with four route patterns. **As of 2026-08-06 that
contract has a canonical successor** — the "Mobile deep links" section of
[docs/architecture/system-overview.md](docs/architecture/system-overview.md) —
so it is no longer the only record, and the archived file stays archived and
non-normative under `docs/README.md`'s precedence.

**The scheme rename itself belongs to this slice, and only its remainder is
left.** `apps/mobile/app.json` already registers `goproceed`, so the custom
scheme is done. What is outstanding is the link **host**: no GoProceed domain
has been chosen to replace `aktflow.app`, and neither
`/.well-known/apple-app-site-association` nor `/.well-known/assetlinks.json`
exists anywhere in the repository. Split item (2) below owns it, together with
the other three domains.
[ADR-007](docs/decisions/ADR-007-pilot-field-client.md) §"What this decision
does **not** remove" keeps this open and changes its shape: the v0.1 field
client is a PWA, so for v0.1 this is a plain URL problem rather than an app
association problem, and the two well-known files belong with `apps/mobile` in
v0.3. A GoProceed domain still has to be chosen, and «a link is a destination,
never an authorization» binds the PWA unchanged.

**Pros of fixing:** one name. Today a reader cannot tell whether `aktflow` is the
old product name, a namespace that outlived it, or a separate system.
**Cons:** the role rename touches a deployed database and cannot be done as part
of unrelated work. The product-copy rewrite is mechanical but wide and worth
its own review pass rather than folding into a database change.
**Suggested split:** (1) packages, imports and the workspace root — done, see
the 2026-08-03 rename slice; (2) product copy, domains, env vars and the
screen specification's link contract; (3) database roles, with its own plan.

## Opened by the v0.1 M1–M6 build (2026-08-06 → 2026-08-08)

Seven entries, all found by reviewers reading the finished tree. **Two of the
seven were added on 2026-08-08 by the whole-build audit** — the M4 render
blocker, which is not a defect and is the largest thing standing between this
build and a usable milestone, and the resolver's un-narrowed second arm.

**This paragraph read «none is fixed».** That was true when it was written and is
false as of 2026-08-08: the P0 immediately below and the auto-exchange P1 below it
have both been closed **in code**, on this same uncommitted branch, and each now
carries a marker naming the line that closes it. The other five are open. CLOSED
IN CODE IS NOT FIXED IN ANY ENVIRONMENT — none of the code behind any entry in
this section has ever been executed, so a marker records what the file now says
and nothing more. The branch is uncommitted and still moving; read the cited line
before quoting an entry's state. The
standing per-milestone owed list lives in
[`docs/superpowers/plans/2026-08-06-v0.1-implementation-progress.md`](docs/superpowers/plans/2026-08-06-v0.1-implementation-progress.md)
§5; only the repo-level items are repeated here.

### P0 (CLOSED 2026-08-10) — the pool stranded once an over-removal parted quantity from money

**CLOSED 2026-08-10, AND EXECUTED RATHER THAN DERIVED — which is what this entry
asked for.** The sequence below was run against the local stack and reproduced
exactly as written: seven units of a ten-unit line settled holding **65 %** of
the pool where the control — a lineage that simply measured 7 — holds **70 %**.
5 % stranded, silently.

**The decision this needed.** The entry ends «closing it means deciding which of
[admitted quantity and allocated money] the carve denominator is answerable to».
It is answerable to the MONEY. The denominator exists to keep
`unallocated / remaining` equal to the line's unit price, and that holds only
while the money already carved corresponds to the quantity being subtracted.
`work_item_allocated` sums money, which follows `funded_quantity`;
`work_item_performed` summed the entries' own `quantity`, which follows what was
MEASURED. Two figures, two sets, and an over-removal parts them.

**The change** is one subquery in `apps/app/src/lib/valuation-writer.ts`:
`work_item_performed` now sums `funded_quantity` over the same
`valuation_allocations` rows `work_item_allocated` sums the money of. The unit
price is then constant by construction rather than by coincidence. In every
ordinary state the two readings are identical — an admitted entry funds its own
quantity — and they differ exactly where a unit was admitted and NOT funded: the
over-contract remainder and the lineage ceiling, where the outcomes already
agreed, and the parted case, which is the defect. No migration; the lineage
ceiling and `0048` §3 are untouched and remain the backstop.

**Covered by** `apps/app/tests/progress-adjust.int.test.ts` §"the pool a line
holds is the share its effective quantity bought", which asserts against a
control rather than a computed figure — `pool * 7 / 10` is 167991 where the
carve lands on 167992, because gross is built from independently carved net and
tax. Verified to FAIL on the old denominator (155993) and pass on the new one.

The original entry follows, because it is the reasoning the fix rests on.

**WAS: OPEN. Found 2026-08-08 by the arithmetic verifier, after the lineage-ceiling
fix closed the crash it was looking for. It is the residual, not a regression.**

**What.** `work_item_performed` sums admitted **quantity**; `work_item_allocated`
sums **money**. While every removal is smaller than what the lineage has funded,
the two move together. An over-removal parts them, and from then on every
positive carve on that line divides the unallocated pool by a denominator that no
longer corresponds to it.

**Reachable in ONE lineage and ONE assignment** — the fixer's own disclosure says
it needs a second assignment or a second root, and the verifier disproved that.
Ten-unit line: `record 4` → close (funded 4, 40 %) → `adjust +6` (waits) →
`adjust +5` (waits) → `adjust −8` (returns the whole 40 %, effective 7, funded 0,
commits) → close a second stage. It settles at funded 7 and leaves **5 % of the
pool stranded**.

**Why it is worse than the crash it replaced.** The crash raised at COMMIT: loud,
attributable, and it refused to write. This does not raise. No constraint
compares funded quantity to money; `assert_funded_within_lineage` bounds funded
only from above; nothing reports a stranded remainder. The line is simply worth
less than it should be, and the number that says so exists nowhere.

**Not a patch.** The lineage ceiling is correct and provably cannot under-fund on
its own (`headroom = D_i − F_{i-1} ≥ 0` is a theorem). The defect is that two
quantities the design treats as one — admitted quantity and allocated money —
diverge under over-removal, and closing it means deciding which of them the carve
denominator is answerable to. That is the ADR-008 successor's question, and it
should be answered against a running database rather than by static reading.

**Depends on:** nothing technical. It needs the eleven unapplied migrations run
once, so the sequence above can be executed instead of derived.

### P0 (CLOSED IN CODE) — a positive `progress.adjust` on an admitted root carves the pool with no closure

**CLOSED IN CODE 2026-08-08 — NEVER EXECUTED.** The gate below is in the tree:
`apps/app/app/v1/progress-entries/[entryId]/adjustments/route.ts:191` now reads
`const allocation = (rootAdmitted && delta < 0n) ? …`, and the test that asserted
the defect as required behaviour was inverted rather than deleted — the case at
`apps/app/tests/progress-adjust.int.test.ts:235-266` now asserts `admitted: false`
and a null allocation for a `+3` on an admitted root, and its own comment records
what it used to assert and why. The whole-build audit then found a SECOND defect
behind the first — a `+N` followed by a `−N` spent the same quantity twice, and
`0048` §3 turned the over-payment into a permanent 500 — and as of this reading
that is closed in code too (`packages/domain/src/valuation.ts:382` bounds the
correction by `rootAdmittedQuantity − rootFundedQuantity`, and
`apps/app/tests/progress-adjust.int.test.ts:276-369` walks record → close →
`+2` → `−2` → second closure).

**A THIRD MEMBER OF THE SAME FAMILY WAS FOUND AND CLOSED ON 2026-08-08, LATER THE
SAME DAY.** Where the second spent a quantity twice, this one funds a quantity
the lineage no longer has: `record 4`, admit, `+6`, `−8` leaves an effective 2,
and the waiting `+6` was then admitted alone at its own quantity — funded 6
against an effective 2, the same deferred trigger, the same permanent 500. The
`+2`/`−2` fix does not reach it; both readings of the unfunded remainder arrive
at the same place, because the removal here EXCEEDS the funding the lineage
holds. Migration `0051` does not reach it either: it stops an unimplied second
stage on a COVERED line, and `0051:97-113` leaves an UNCOVERED line's second
stage deliberately legal — which is every imported line, permanently. Closed by
a ceiling on the positive carve (`packages/domain/src/valuation.ts:313`) fed by a
queue `apps/app/src/lib/admission.ts:378` derives from the pending list, and
walked by `apps/app/tests/progress-adjust.int.test.ts:371`. **No migration:** the
fix is entirely route and domain code, `0048` §3 stays exactly as written and
remains the backstop, and nothing in `0041`–`0051` needed correcting because
`0048` §3's stated reason for being DEFERRED — a closure is momentarily funded 10
against an effective 6 — is the state the queue exists to keep legal.

All of these statements are readings of files. The entry is kept in full below
because it is the reasoning the fix rests on.

**What:** `apps/app/app/v1/progress-entries/[entryId]/adjustments/route.ts`
decides whether to carve by asking «does this lineage already hold a
`valuation_allocations` row», not «was this quantity admitted». One legitimate
admission therefore opens the door permanently for that root. Contract quantity
10, pool P: record `0.000001`; satisfy the hold point and close the stage, which
admits a millionth of a unit; then `progress.adjust +9.999999` on the same root.
The correction carves with `admitted_by_closure_id` NULL and takes essentially
all of P, on one closure that covered nothing, with `progress.adjust` — a
foreman's capability — and no second stage.

**Why:** it violates **INV-089**, a P0, and it makes
[ADR-008](docs/decisions/ADR-008-valuation-carves-at-admission.md)'s central
sentence — «admission is a deliberate authorised act rather than a side effect of
measurement» — false on the shipping route. `blocked_value.get` cannot show it:
after the carve the adjustment holds an allocation and therefore reads as
admitted, which is the same predicate answering wrongly a second time. Three
independent layers pass it, including migration `0048`'s new
`assert_funded_within_lineage`, which bounds a lineage by what it **performed**
and says nothing about what was **admitted**.

**Fix:** gate the existing already-admitted test on the **negative** branch only —
`rootAdmitted && delta < 0n`. A reduction against admitted money still runs, so
ADR-008's genuinely open question (what a correction to admitted money does)
stays where the ADR left it, and a positive delta becomes ordinary unadmitted
quantity that the next closure admits through `pendingEntries`, which already
handles a root that carries an allocation while its later entries do not.
**Cons:** none identified; the belt-and-braces half — extending
`assert_funded_within_lineage` with a second bound over admitted allocations —
needs a cutoff timestamp for pre-ADR-008 NULL rows and can follow.

**A passing test asserts the defect as required behaviour.**
`apps/app/tests/progress-adjust.int.test.ts` records 2, admits, adjusts `+3` and
asserts `grossMinorUnits > 0`. Inverting that assertion is part of the fix, not a
regression, and this is the third time this repository has been bitten by the
same shape. *(It was inverted on 2026-08-08 — see the marker at the head of this
entry. The assertion now reads `admitted: false` and a null allocation, and the
test carries the old line in a comment so the fourth occurrence is recognisable.)*

### P1 — the external review shell auto-exchanges, so a mail scanner burns the grant

**CLOSED IN CODE 2026-08-08 — NEVER EXECUTED.** `apps/app/app/external/review/route.ts`
no longer exchanges on load: the token now shows a button and the POST runs from
`el("open").addEventListener("click", openLink)` at `:335`, with `openLink`
rejecting an untrusted event at `:342-343`. The route's own header at `:51-71`
states what that does NOT stop and it belongs in this entry: **a CDP-driven click
is trusted and indistinguishable**, so a gateway that clicks every button on every
page still burns the grant. The residue is throttling, which does not exist — the
external-plane rate-limit gap is the standing item, not this one.

**What:** `apps/app/app/external/review/route.ts` runs an IIFE on load that reads
`location.hash` and immediately POSTs to `/external/exchange`. No user gesture.

**Why:** corporate mail security that opens links in a real browser with the
fragment intact — Defender Safe Links, Proofpoint URL Defense — executes that
script and consumes the single-use grant. The технагляд then receives
`EXTERNAL_SHARE_INVALID`, which is indistinguishable from revoked, on a link
nobody has opened. The route's header claims no scanner «can burn the grant»;
that holds only for a fetcher that never runs the script, and
`apps/app/tests/m5-external.int.test.ts` models exactly that case and no other.

**Fix:** put the exchange behind a click. **Cons:** one more step for the
reviewer, against a failure mode that is silent and unrecoverable.

### P1 (CLOSED 2026-08-17) — six project-plane capabilities were in no responsibility preset

**What:** `technical/permissions/capabilities.csv` carries 17 project-plane v0.1
capabilities; `technical/permissions/responsibility-presets.csv` maps 11. The six
it maps nowhere are `progress.adjust`, `requirement_exceptions.decide`,
`evidence_decisions.decide`, `stage_closures.close`, `readiness.view` and
`statutory_acts.compose`.

**Why:** with the shipped presets nobody can correct a quantity, close a stage,
decide an occurrence, record the only escape v0.1 has, read the blocked money, or
compose an act. Every M3 and M4 suite grants them by hand, which is exactly the
shape of a gap a fixture hides — and it is the third recurrence of one finding
(M1 review finding 8). The other three planes are **not** gaps and are counted
out deliberately: the eight workspace-plane capabilities resolve from the
governance role, the two external ones are excluded from the
`project_access_grants` vocabulary on purpose, and the three service ones belong
to the service principal.

**Fix:** decide which persona owns each of the six, then add them.
**Cons:** it is a permissions decision — `stage_closures.close` in particular
should not land on the same persona as `evidence_decisions.decide` without
someone thinking about separation of duties first.

### CLOSED 2026-08-18 — the two couplings that mapping left open, and a defect the mapping itself introduced

**The mapping of 2026-08-17 broke a persona, and the gate it shipped with could
not see it.** `readiness.view` went onto `commercial_manager` on the strength of
that preset's own description naming it as the persona's money screen. All three
money reads — `readiness.get`, `blocked_reasons.get`, `blocked_value.get` — call
`requireProjectCapability` TWICE, for `readiness.view` AND `project.view`, and
`commercial_manager` had no `project.view`. The persona could not open the screen
it was given the capability for. `presetCoherenceErrors` stayed green because
rule 1 asks whether a capability is REACHABLE from some preset, never whether
that preset can USE it.

**Four presets carried it, not one.** Thirteen routes require two project
capabilities and in every one the second is `project.view`, so seven capabilities
have an unstated prerequisite. `requirement_owner` (requirements.assign,
requirement_exceptions.decide), `internal_verifier` (evidence_decisions.decide),
`package_submitter` (packages.submit) and `commercial_manager` (packages.submit,
readiness.view) all granted something they could not exercise. **Three of those
are responsibilities that no ui_persona bundles** — the deliberate choice of
2026-08-17 — so a pilot naming a verifier from `internal_verifier` would have
named someone who could not decide.

**Fixed structurally, not by four edits.** `capabilities.csv` gains a `requires`
column recording the prerequisite, and `presetCoherenceErrors` gains rule 3,
SUFFICIENCY: a preset granting a capability must grant its prerequisites.
`project.admin` satisfies `project.view` there, because
`IMPLIED_BY_PROJECT_ADMIN` makes the ROUTE accept it — a gate stricter than the
routes it models would fail `project_manager` for no reason. Proved by removing
`project.view` from `commercial_manager` again and watching both its capabilities
report, and by stubbing the prerequisite loop and watching the validator's own
self-test name the failure.

**The act coupling is ACCEPTED, not split (owner decision).**
`statutory_acts.compose` governs four operations of two kinds — two POST commands
and two GET queries — so a member who may read an act may compose and freeze one.
That is a real authorization defect and `capabilities.csv` now says so in its own
row rather than leaving it to a route comment that called it «uncomfortable».
It is not split because no v0.1 persona needs read-only act access: the
capability is on `pto_engineer` alone, and an external reviewer reaches an act
through the external plane and a bearer grant. Splitting costs a migration — the
vocabulary is pinned by `project_access_grants_capability_check` — plus four
routes, the preset mapping and its tests, paid for a reader who does not exist
yet. **The successor is a `statutory_acts.view` capability for the two GETs, and
it should land WITH the first persona that must read an act without writing
one.**

### CLOSED 2026-08-17 — all six mapped, and the Cons above was right but named only half the hazard

**Owner decisions**, taken against the invariants rather than against an org chart:

| Capability | Preset | Kind |
|---|---|---|
| `progress.adjust` | `progress_recorder` + `foreman` | responsibility + persona |
| `readiness.view` | `pto_engineer` + `commercial_manager` | persona ×2 |
| `statutory_acts.compose` | `pto_engineer` | persona |
| `stage_closures.close` | `pto_engineer` | persona |
| `evidence_decisions.decide` | `internal_verifier` | responsibility, no persona |
| `requirement_exceptions.decide` | `requirement_owner` | responsibility, no persona |

**The Cons above named `evidence_decisions.decide` and stopped one capability
short.** An occurrence becomes satisfied TWO ways, not one: `readiness.ts`'s
`satisfiedFor()` counts a current `waiver` or `accept_risk` head exactly as it
counts an accepting evidence decision, and INV-063 keeps both kinds available
even on a `hold`. So `requirement_exceptions.decide` is a second route past
`can_close_stage`, and bundling it with the closure is the same hazard the Cons
warns about — with INV-069 silent, because the closer never captured anything.
A draft of this change put it on `pto_engineer` and was withdrawn for that
reason. `readiness.ts:407` had already been reasoning from «The CLOSER holds
`stage_closures.close` and need not hold either», which was an assumption about
a CSV that nothing validated.

**So `pto_engineer` closes the stage and composes the act it pins (INV-084), and
holds NEITHER way of satisfying an occurrence.** Both of those sit on
responsibilities that no v0.1 persona bundles, so a pilot must name those people
deliberately.

**The gate is the durable half.** `validate-canonical-docs.mjs` held
`responsibility-presets.csv` to EXISTENCE only, which is why six could go
orphaned for four milestones with every suite green. `presetCoherenceErrors` now
enforces four rules: reachability, resolvability, plane discipline (a preset is a
bundle of `project_access_grants` rows, so it may only name project-plane
capabilities), and the separation of duties above. Its exemption set is empty and
the call site argues for keeping it that way.

*Plane discipline is a measured correction, not a guess: the first draft required
a preset for every v0.1 capability and produced 13 false positives — the eight
workspace, two external and three service capabilities this entry's own «Why»
paragraph had already counted out. The guard now encodes that paragraph instead
of contradicting it.*

**Verified three ways:** reverting the CSV reports exactly the six; re-adding
`requirement_exceptions.decide` to `pto_engineer` reports the SoD violation by
name; stubbing the detector makes the validator's own self-test exit 2, so the
self-test is not vacuous either.

**Seventeen stale claims swept with it**, in four routes, nine suites, two
fixtures and the progress document — every `*_PRESET_GAP` constant and every
comment asserting one of the six «is in no responsibility preset». **Two of the
seventeen were already wrong before this change**, which is the same lesson the
field-client residuals taught: `rule_bindings.manage` had been in two presets
since 2026-08-07 and `packages.submit` since 2026-08-08, and a constant and a
comment went on asserting their gaps regardless.

### P0 (CLOSED 2026-08-10) — every act would freeze successfully and then be permanently unrenderable

**Found within minutes of the render first working**, by the acceptance walk's own
step 4 — «render twice and diff the bytes». It could not have been found before:
the render refused for the whole of v0.1, so this code had never executed.

**What was wrong.** `statutory_act_versions.freeze` loaded the DRAFT view, rendered
it through `renderForFreeze` (which flips `status` and changes nothing else),
hashed that document into `content_hash`, and only THEN wrote `frozen_at = now()`.
Додаток В's act date binds to `frozenAt ?? composedAt` and carries the column it
came from in its provenance. So the hashed document was dated
`statutory_act_versions.composed_at` and the stored row was dated `…frozen_at`.
The very next `statutory_acts.render` read the frozen row, produced different
bytes and refused with `frozen_content_hash_divergence`.

**Every act. On every input. Permanently** — INV-015 makes `frozen` terminal, so
there is no correction except a successor version, which would do the same thing.
And the refusal named NOTHING: it reports which of renderer version, template hash
or content moved, and the first two matched, so the message pointed at content
with no indication of what in it had changed.

**Fix.** The freeze reads `select now()` before rendering, puts it on the view it
renders, and passes that same value to the UPDATE. `now()` is the transaction's
timestamp in PostgreSQL and does not advance inside one, so this is the same
instant `now()` in the UPDATE would have written — it is passed explicitly all the
same, so the value that goes into the hash and the value that goes into the column
are one value rather than two that happen to agree. The frozen project name
(migration 0056) is pinned from the rendered view for the same reason.

**Covered by** «renders twice and the bytes are identical» and «SURVIVES a rename
once frozen», both of which fail without the fix.

**The lesson is the one this codebase keeps relearning:** a refusal that has never
stopped refusing is hiding whatever is behind it. Two blockers stood in front of
this for the whole milestone.

### P1 (CLOSED 2026-08-10) — Додаток Н printed a provenance line that was false

**Closed on the owner's instruction, the same day it was opened.** All 12 rows of
`technical/requirements/dbn-a31-5-2016-dodatok-n.csv` and the `SOURCE_SINGLE_FETCH`
constant generated from them now carry the recorded record — the URL, `2026-08-10`
and `sha256=4592eda…` — in place of «одне завантаження, URL/дата/хеш не збережені».
The two are byte-identical (364 bytes) and `requirement-library-fidelity` re-checks
them every run. Only the parenthetical moved; the independence caveat is unchanged,
because reproducing one fetch is still not two independent sources agreeing.

**THE BACKFILL QUESTION THIS ENTRY RAISED WAS ALREADY ANSWERED BY THE SCHEMA, and
that is worth more than the edit.** `requirement_library_items_immutable`
(0041:618) and `requirement_occurrences_immutable` (0043:986) reject every update
and every delete, so rows already written keep the string they were written with
and there is no backfill to perform. It is the right answer twice over:

- a citation records **what was cited**, not what the citing system later learned
  about its own record-keeping;
- an occurrence's `norm_ref_source` is read LIVE by `renderStatutoryAct` and is
  inside the `content_hash` of every frozen act. **A backfill would have broken
  every act ever frozen** — precisely the failure migration 0056 was written to
  prevent for the project's name, arriving from a second direction. Had these
  tables been mutable, the obvious fix would have been the destructive one.

**What the tag rests on is stronger than when it was written.** `dodatok-n.ts`'s
own comment named the condition — «a re-fetch that does not reproduce the same
bytes must downgrade every row it touches to VERIFIED_SECONDARY». The re-fetch was
performed and reproduced the bytes exactly, so VERIFIED_PRIMARY stands, checked.

**Original entry, kept because it is the record of what was wrong**

**Opened by closing the render.** Every row of
`technical/requirements/dbn-a31-5-2016-dodatok-n.csv`
carries this as its `source`, and `apps/app/src/lib/dodatok-n.ts` is generated
from it and byte-verified against it:

> ДБН А.3.1-5:2016 Додаток Н; офіційний файл e-construction.gov.ua (одне
> завантаження, **URL/дата/хеш не збережені** — див. hidden-works-content-rules.md,
> Open items); незалежність будь-яких додаткових копій не встановлена

**The bolded clause stopped being true today**, and the pointer beside it now
leads to a bullet that says the opposite: §"Open items" records the URL, the
retrieval date and the hash, with the bytes re-fetched and re-hashed.

**Why it matters more than it did yesterday.** That string is the `norm_ref_source`
on every requirement occurrence, and `renderStatutoryAct` prints it inside each
decision block as a `normative` provenance. Until today the render refused, so the
sentence was only ever read in a CSV. **It now reaches a customer-facing
document** — an act that tells a reader the source of its own regulatory citation
was not recorded, when it was.

**It errs conservatively**, which is why this is P1 and not P0: it UNDERSTATES the
provenance. Nothing is overclaimed and no tag is stronger than its evidence.

**Not fixed here, deliberately.** The `source` column of a committed regulatory
content file is content under `hidden-works-content-rules.md` §"Change control",
not code — the same rule that kept this session from inventing a ДБН caption. The
Додаток В file was regenerated by its owner-supplied source; this one would be
edited on a maintainer's judgement, and 12 rows of an Approved artifact plus every
`requirement_library_items.source_citation` already seeded from them is not a
change to make silently.

**Fix, when the owner says so:** replace the parenthetical in the CSV's `source`
column with the recorded record — the URL, `2026-08-10`, and `sha256=4592eda…` —
regenerate `dodatok-n.ts`, and let `requirement-library-fidelity.int.test.ts`
re-verify. Then decide whether already-materialised occurrences are backfilled or
left carrying the string that was true when they were written. **Leaving them is
defensible** and is what INV-073's «the source it was read from» arguably asks
for; that is the actual question.

### P2 (OPEN, UNREPRODUCED) — vertical-m1 steps 7 and 8 went red once and would not do it again

**Recorded because it was a real red and I could not explain it, not because I
know what it is.** During one full `pnpm turbo run test --concurrency=1` on
2026-08-10:

```
× v0.1-M1 vertical … > 7. reimport publishes v2 with diff {added 1, removed 1,
                          changed 2, unchanged 5} and lineage        47ms
× v0.1-M1 vertical … > 8. published immutability: v1 identical after v2 …  9ms
```

**Not the shared-Postgres artefact.** That one produces lock waits with absurd
durations; these failed in 47ms and 9ms, which is an assertion or an early
non-200, not a wait. Step 8 reads `v1Snapshot`, which step 7 assigns, so 8 is
almost certainly a cascade of 7 and there is really one failure here.

**It did not reproduce.** `vertical-m1.int.test.ts` alone: 9 of 9. A clean full
`apps/app` run afterwards: 45 files, 678 of 678. The same suite had passed 672
earlier the same day before any of that session's changes.

**It is not the Додаток Н provenance edit that was in the tree when it fired.**
That change is one string constant on twelve regulatory citations; there is no
path from it to an import diff's `{added, removed, changed, unchanged}` counts or
to a `predecessorWorkItemId`. Said as a reasoned claim, not a measurement.

**The hypothesis worth testing first:** the failing run had `@goproceed/app`
executing after `@goproceed/testing`, which drives its own workspaces through
`seedRulesWorld` / `dropRulesWorkspaces`; the passing runs had `apps/app` alone.
Cross-PACKAGE residue would look exactly like this — a vertical that depends on
its own earlier steps failing at a step that reads state. If it recurs, capture
the assertion text before re-running: this entry exists because that output
scrolled past and the run could not be repeated.

### P2 — a hand-typed zero-priced line and an imported one store different provenance

**What:** `apps/app/src/lib/manual-baseline.ts` writes
`priceBasis: unitPrice === null ? null : pins.priceBasis`, and `unitPrice` is
assigned only for `unit_price_state = 'known'`. The importer writes the basis for
a zero-priced row, because — see §"P2 — a zero unit price used to break publish"
above — `0,00` parses into a truthy `Decimal`. So a line priced at zero stores
`price_basis = null` when typed and the basis when imported, and the manual
path's own comment claims parity with the importer.

**Why:** ADR-006 decision 2 makes manual entry first-class, and version-0.1.md's
M1 exit gate is that a hand-typed line is «indistinguishable in provenance
quality from an imported one». This is a stored divergence on exactly that axis,
on a row shape the entry above records as ordinary rather than exotic.

**Fix:** `priceBasis: derivedMinor === null ? null : pins.priceBasis`, and correct
the comment whichever way the decision goes.

### BLOCKER — CLOSED 2026-08-10. M4 composes, freezes and renders end to end.

**Both artifacts landed on the same day, and neither was code.** This entry's own
rule — «no slice may close this item with code, and any change that makes the
render succeed without the artifact below is a regression, not a fix» — held to
the end: what closed it was the owner supplying the official ДБН file (morning)
and then the URL it was downloaded from (afternoon).

- `dodatok_v_field_list_not_committed` — all 51 lines of В.1/В.2 are in
  `technical/requirements/dbn-a31-5-2016-dodatok-v.csv`, machine-transcribed from
  the official file and re-verified byte-for-byte on every run.
- `dbn_retrieval_record_absent` — `DBN_RETRIEVAL_RECORD` carries the URL, the date
  and the hash. **The bytes were re-fetched from that URL and hashed
  independently**: 636 603 bytes and `sha256=4592eda…`, matching the digest the
  transcription had been verified against. The record is now reproducible rather
  than asserted, which is the entire distinction it exists for — a hash proves two
  people hold the same bytes and says nothing about where they came from.

**Neither refusal was deleted.** Both are still computed from the absence of their
datum, so setting `DBN_RETRIEVAL_RECORD` back to `null` makes the render refuse
again with no other edit. The suites assert the ABSENCE of the two closed codes
rather than dropping them, so a regression that reopens either fails loudly.

**The acceptance walk is complete.** Its two unperformable steps — «render twice
and diff the bytes» and «check the render field by field against the В.1/В.2
list» — are now both performed in `apps/app/tests/m4-act.int.test.ts`, the second
comparing all 51 captions with `Buffer.equals` and asserting prohibition F's
quirks survived into the document itself.

**AND MAKING THE RENDER WORK IMMEDIATELY FOUND A P0 IN THE FREEZE.** See the
entry below. It could not have been found by reading, and no suite could have
caught it while the render refused.

**Original entry, kept because it is the record of what was blocked**

**What:** `DODATOK_V_TEMPLATE.fieldList` is `null`
(`apps/app/src/lib/statutory-act-form.ts:205`). `renderStatutoryAct` pushes the
blocker `dodatok_v_field_list_not_committed` for any template with a null field
list (`:510-521`) and returns `{ ok: false }` whenever the blocker list is
non-empty (`:526-528`) — **neither test looks at the act**. So
`statutory_acts.render` refuses for every act, on every input, in every
workspace, and `statutory_act_versions.freeze` hashes the render and therefore
always refuses too (`apps/app/app/v1/statutory-act-versions/[actVersionId]/freeze/route.ts:47-65`,
which states this in its own header). `DBN_RETRIEVAL_RECORD` is `null` at
`statutory-act-form.ts:129` and is a second, independent, equally unconditional
blocker. **An act can be composed as a draft and can never become a document.**

**Why this is an entry and not a bug:** the behaviour is correct and the refusal
is the only correct behaviour available. `hidden-works-content-rules.md`
allow-list item 3 *licenses* the product to print every field of В.1 and В.2 in
the standard's order; it does not supply them, and nothing in this repository
does — `technical/requirements/` holds `dbn-a31-5-2016-dodatok-n.csv` and nothing
else. Transcribing the captions from memory or from a secondary source is the one
thing that document forbids without qualification, and
`docs/delivery/test-strategy.md:139-152` extends the ban to fixtures because «a
fixture looks verified». A renderer is worse than a fixture: an invented caption
is printed onto a document a client's lawyer reads and looks decided. **No slice
may close this item with code, and any change that makes the render succeed
without the artifact below is a regression, not a fix.**

**What it costs:** M4's user outcome in `docs/delivery/version-0.1.md` §v0.1-M4
— «as a document someone can print and hand over» — is not met and cannot be met
from this repository. Two of the six steps of that section's acceptance walk
(«render twice and diff the bytes», «check the render field by field against the
В.1/В.2 list») are unperformable. Three of the four M4 operations do their whole
job; the fourth produces nothing a person can be handed.

**Fix — one artifact, not code.** Commit the enumerated **В.1/В.2 field list**:
every field of both sections, in the standard's order, with **the standard's own
captions**, under `technical/requirements/` in the same shape as
`dbn-a31-5-2016-dodatok-n.csv`, carrying per row a `verification` tag and the
source it was read from. It must be transcribed from the **primary** ДБН
А.3.1-5:2016 file by someone holding it — which is the same retrieval that
produces the ДБН retrieval record (URL, retrieval date, SHA-256) M0 gate 10 owes,
so the two blockers are one errand. Then populate `DODATOK_V_TEMPLATE.fieldList`
and `DBN_RETRIEVAL_RECORD` from those files. Both blockers stop being produced
with no other change, because both are derived from the absence rather than
declared.
**Cons:** none. The only alternative — shipping a field list nobody sourced — is
the fabrication class the audit behind the content rules exists to catch.

**One document still states M4 without this, and it is the one an acceptance
session would be planned from.** `docs/delivery/version-0.1.md` §v0.1-M4 carries
the user outcome — «as a document someone can print and hand over» — and a
six-step **Acceptance evidence** walk, two of whose steps («render twice and diff
the bytes», «check the render field by field against the В.1/В.2 list») cannot be
performed at all, and it says nothing about either. It owes one sentence there:
that `statutory_acts.render` and `statutory_act_versions.freeze` refuse
unconditionally while `DODATOK_V_TEMPLATE.fieldList` and `DBN_RETRIEVAL_RECORD`
are `null`, that the refusal is correct behaviour rather than a defect, and that
the two steps become performable only when the В.1/В.2 field list is committed —
so the milestone is walked knowing it cannot pass its own gate. That file was not
in this pass's remit, which is why this is recorded as owed rather than made.

*Recorded 2026-08-08. The absence predates this build and was written down in
`test-strategy.md`, in migration `0047` §11 item 1 and in the renderer's own
header; what was written down nowhere is that it makes the freeze unconditional
and leaves M4 with no deliverable. Cross-referenced from the progress document's
standing statement and its §5 item 1a.*

### P3 — `app.work_type_key_is_bindable` arm 2 is not scoped to a draft

**What:** `supabase/migrations/0050_the_left_hand_side_of_the_predicate.sql:336`
defines the resolver SECURITY DEFINER and grants execute to `aktflow_app`. Arm 2
accepts **any** `contract_version_id` in a workspace the caller is an active
member of and answers whether that version binds a rule version carrying a given
work-type key — a bit `cvrb_select` (0041 §9) withholds from a member with no
`project.view`/`project.admin` grant on the project. The file's own
bounded-disclosure argument was stated as a property of the function; it is a
property of the function's two callers.

**Why:** unreachable through any v0.1 route. Both callers —
`requireBindableWorkType` (`apps/app/src/lib/manual-baseline.ts:107`) and the
trigger `app.guard_work_item_work_type()` (0050 §5) — pass the contract version
of the row being written, never one the caller named, and a row can only be
written into a draft. So this is a **widened surface, not a disclosed leak**. It
is an entry because `apps/app/tests/work-type-carrier.int.test.ts:528-530`
already calls the resolver directly, which is the shape a third caller would
take, and because the next reader of that comment would otherwise trust an
argument that does not hold.

**Fix:** a new migration — **0052**, the next free file as the chain stands on
2026-08-08. *(This entry read «migration 0051» when it was written. `0051` was
claimed later the same day by `0051_the_stage_nobody_agreed_to.sql`, the
stage-key guard, which does not touch this function; the number was corrected
here and in `0050` §4 and §6.5. Search for the `create or replace` below, not for
a number.)* `create or replace function
app.work_type_key_is_bindable`, arm 2 gaining
`and exists (select 1 from public.contract_versions v where v.workspace_id = ws
and v.id = cv and v.status = 'draft')`. Behaviour-preserving for both current
callers, so no route and no fixture changes; add one case asserting the resolver
answers false for a published version the caller holds no grant on.
**Cons:** none identified. It cannot be done by editing `0050` — a function body
is behaviour, and only comments of the unapplied chain are corrected in place.
*The stale comment itself was corrected in `0050` §4 on 2026-08-08 and the owed
migration is recorded in that file's §6.5.*

### P3 — INV-090 is allocated and two catalogs do not point at it

**What:** `technical/database/invariant-catalog.csv` gained **INV-090** on
2026-08-08 for the write-path work-type refusal, from the text migration `0050`
§6.4 dictates and deliberately did not allocate an id for.
`technical/database/entity-catalog.csv`'s `work_items` row and
`technical/database/relationship-catalog.csv`'s
`work_items typed_as requirement_rule_versions` row both describe that refusal
and cite no id; the relationship row's `invariant_id` column reads INV-072, which
is the **disclosure** half.

**Why:** an invariant nothing references is an invariant no suite is keyed to.
**Fix:** point both rows at INV-090. Neither file was in the 2026-08-08
documentation slice's remit, which is the only reason this is an entry rather
than a change.

## CLOSED 2026-08-10/11 — ADR-007 is implemented: the PWA field client is BUILT (and not yet reachable)

**The client is built and verified locally. A customer still cannot click
through the pilot, because NO DEPLOYED ORIGIN EXISTS.** There is no
`vercel.json` for `apps/app`, no deploy step in `.github/workflows/ci.yml`,
and `infra/README-staging.md` records that staging has never been provisioned.
The plan that produced this work says so in its own words — «none of them puts
the client in a foreman's hand» — and an earlier version of this section
opened «A customer can now click through the pilot», which was false on the
day it was written. **Provisioning an HTTPS origin for `apps/app` is now the
single largest open item; it is the first entry in `HANDOFF.md` §0's priority
list.** Two things wait behind it and cannot be done without it:

- **ADR-007's two required measurements.** How each engine handles EXIF and
  the `capture` attribute, and the storage-eviction rule — both need real
  devices against a real origin (`docs/decisions/ADR-007-pilot-field-client.md`
  §"What must be measured, not assumed" and §"Also to be measured, not
  assumed"). The decision does not depend on how they resolve; the copy and the
  claims this client is allowed to make do.
- **`crypto.subtle` needs a secure context.** `localhost` qualifies, so every
  local run and the CI browser pass are fine, and nothing else is.

**One deployment requirement this created:** `NEXT_PUBLIC_APP_ORIGIN` must be
set on any origin that is not loopback. `src/lib/api.ts`'s `resolveBaseOrigin`
refuses to self-fetch (with the session cookie attached) against a host it
cannot trust, and off loopback that variable is the only way to name one.

**What IS done —** `docs/superpowers/plans/2026-08-10-pwa-field-client.md`'s
eleven tasks: sign-in by email + 6-digit OTP, «Мої доручення», the
obligation screen (both required obligations — the acceptance criterion in
the standard's own wording, and the capture control), the pure capture core
and its state machine, the `beforeunload` guard for an at-risk photo
(INV-081), and a real-browser puppeteer pass (`apps/app/qa/field.mjs`) with
its own CI job (`app-qa`) that drives the whole thing authenticated — a real
Supabase Auth user minted through the local Admin API, a real email-OTP
sign-in read back out of Mailpit, a real seeded workspace/project/contract/
assignment built entirely over `/v1` (never a raw SQL insert standing in for
a command), and the real obligation screen it renders. This closes the
*building* of the client, which both handoffs above named as blocking a pilot
— it does not close *reaching* it; see the origin above.

**INV-086's "NOT YET IMPLEMENTABLE" note is closed** — see
`technical/database/invariant-catalog.csv`'s INV-086 row, corrected in place.
`origin_not_distinguished` is in the deployed CHECK (migration 0043) and in
`packages/contracts/src/uploads.ts`'s `originMethod` enum, and
`apps/app/src/lib/capture/upload.ts`'s `buildCreateIntentBody` is the one
place the PWA's request body is assembled — it carries no parameter that
could route `native_camera` (or anything else) through it, proven three ways
(`apps/app/tests/field-capture.int.test.ts`, `src/lib/capture/upload.test.ts`,
and a browser-driven capture in `qa/field.mjs`).

**Owed, not built: the reference image.** ADR-007 decision 4 names one —
shown beside the acceptance criterion on the obligation screen, before work
starts — and it exists in **no form**: no column, no contract field, no
asset, no owner, no licence. The owner decided on 2026-08-10 to ship the
obligation text without it (see
`docs/superpowers/specs/2026-08-10-pwa-field-client-design.md` §3 "Out,
deliberately"), so `apps/app/app/(app)/a/[assignmentId]/page.tsx` renders the
acceptance criterion, its norm reference, and the capture control — and
nothing else where the picture would go.

**And the documents disagree about which milestone owns it — recorded here
as owed, not resolved.** Three sources, three different answers:

- [ADR-007](docs/decisions/ADR-007-pilot-field-client.md) decision 4 and
  `docs/domain/glossary.md:121` ("Field client" row) both say v0.1-M2.
- `docs/product/competitive-landscape.md` says v0.3.
- `docs/delivery/version-0.1.md`'s own v0.1-M2 exit-gate list **omits it
  entirely** — neither requiring nor excluding it.

**Fix:** an owner decision on which milestone actually owns the reference
image, followed by making the three documents agree (and, if v0.1-M2, a
follow-up slice sourcing the image the same way the ДБН citations were
sourced — from a primary, verification-tagged origin, never invented).
**Cons:** none technical; this is a documentation-consistency and
content-sourcing question, not a code change.
**Depends on:** nothing technical. `apps/app`'s obligation screen already has
the one place the image would render (`ObligationCard` in
`app/(app)/a/[assignmentId]/page.tsx`) if and when the owner supplies one.

---

## P3 — `GET /v1/projects/{id}/assignments?assignee=me` has no status filter; `cancelled` assignments still show in «Мої доручення»

**Seen 2026-08-21**, after retiring the occurrence-less demo assignment that
the field-client installable work's phone pass needed replaced (see
`infra/README-staging.md` §4.5/§6.9 item 3). The route
(`apps/app/app/v1/projects/[projectId]/assignments/route.ts:52-53`) filters
only on `workspace_id`, `project_id`, and `assignee_member_id` — its `where`
clause carries no `status` condition at all, so a `cancelled`
`work_assignments` row is returned exactly like an active one. Both field
clients render whatever the route sends: `apps/app`'s own «Мої доручення»
page and `apps/mobile/src/screens/my-assignments.tsx` /
`apps/mobile/src/lib/field/load-assignments.ts` (the Expo client). Fix is
either route-level (add a `status <> 'cancelled'` predicate, or an explicit
allow-list, to the query) or client-level (filter in both clients'
load-assignments layer identically, since neither client shares code with
the other — see the P3 below for the same duplication contract). Owner
decision pending on which layer owns the filter.

---

## P3 — INV-081's "unsaved photo" banner reads as a failure while the upload is still in flight

**Raised by the owner, 2026-08-21**, watching the Expo field client mid-photo.
The banner text — `"GoProceed не зберіг це фото. Зробіть його ще раз або
збережіть у себе."` ("GoProceed has not saved this photo. Take it again or
save it yourself.") — is shown for as long as the browser tab, not the
server, holds the only copy of the bytes
(`holdsUnsavedBytes`/`UNSAVED_PHOTO_WARNING`,
`apps/app/src/lib/capture/state.ts:185` and the identical duplicated string
at `apps/mobile/src/lib/capture/state.ts:187` — the two clients keep
independent copies of this state machine by design, per the duplication
contract those files' own headers describe). This is BY DESIGN, not a bug:
INV-081 requires the warning to be up from the moment the original exists
only in memory until the finalize receipt exists, and that loss must never
be silent — so the banner cannot wait to see whether the upload succeeds
before appearing. But read cold, mid-upload, the present tense ("has not
saved") reads as an already-failed state rather than a not-yet-confirmed
one. **Proposed fix, not built:** split the copy into two variants — an
in-flight/awaiting-receipt wording ("надсилання триває…" / "still sending…")
and the current text reserved for the state that follows an actual failure
— while keeping `holdsUnsavedBytes`'s gate (the enforcement column, per that
file's own comments) exactly as strict as it is today. Touches: the
copy-catalog (`technical/copy-catalog.csv`,
`packages/testing/src/copy-catalog-fidelity.test.ts`), `state.ts` in BOTH
`apps/app` and `apps/mobile` (duplication contract — the same change made
twice, not shared), each client's tests, and the puppeteer harness
assertions on the banner's exact text (`apps/app/qa/field.mjs`,
`apps/mobile/qa/field-web.mjs`). Owner decision pending on the two strings'
exact wording.

---

## P3 — the install hint does not recognise an iPad in desktop-class mode

`apps/mobile/src/lib/install-hint.ts`'s `classifyIOSBrowser` keys on
`/iPad|iPhone|iPod/` in the UA. Since iPadOS 13, Safari on iPad reports a
Macintosh UA by default («Request Desktop Website» is the default), so a real
iPad in default configuration gets no install hint at all — it is neither
recognised as iOS nor offered the Chromium prompt. Found at review on
2026-08-21 (PR for the iOS-browsers hint). The pilot is two phones (ADR-007
inventory), so this is deferred; the fix is the usual heuristic
(`navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1` → iPad)
plus a test and a harness UA case.

---

## P3 — Plan D slice D1 task 6 (the evidence screen) renders full-size
originals, with no thumbnail pipeline

`apps/app/src/components/evidence/evidence-card.tsx` puts every evidence
photo — `readUrl`, the signed URL `evidence_objects` route hands back — into
a plain `loading="lazy"` `<img>` inside a fixed-aspect-ratio container, at
whatever resolution the original upload was captured at. `04-role-pain-map`'s
office screen this task builds may show a dozen-plus full-resolution JPEGs on
one page.

Named rather than solved because the obvious fix costs money this slice was
not asked to spend: Supabase Storage's image-transformation add-on
(resize/format-negotiation on the signed-URL request) is a paid add-on on the
project's current plan, so a resized `readUrl` is not available to ask for,
and building a resize pipeline of our own (a derivative-generation worker
writing `evidence_objects.relation_kind = 'derivative'` rows, or an
on-the-fly edge resize) is its own slice, not a two-line addition to a read
screen. `next/image` was considered and rejected for the same reason: without
either the add-on or a custom loader, it buys nothing over a bare `<img>`.

Deferred because the pilot's own evidence volume is small (ADR-007's two-phone
inventory, v0.1's single-pilot-project scope) and `loading="lazy"` already
keeps an off-screen photo from downloading at all — the cost is real only once
one assignment accumulates enough photographed occurrences that the panel
itself becomes slow to open, which nothing in the pilot's plan has hit yet.
Revisit if a real assignment's evidence count grows past what one scroll
comfortably holds.

---

## P2 — Plan D slice D1 task 6 (the evidence screen) formats
`serverReceivedAt` against a hardcoded default zone, not the workspace's own

Fixed round 1 CRITICAL, kept open in a narrower form. `evidence-card.tsx`'s
`formatReceivedAt` used to call `toLocaleString("uk-UA", { dateStyle,
timeStyle })` with no `timeZone` at all — silently correct on a Kyiv
developer machine and silently wrong the moment this server component runs
somewhere else (Vercel's runtime clock is UTC), with no zone marker on
screen to warn anyone. Fixed by naming `Europe/Kyiv` — the same default
`packages/contracts/src/workspaces.ts:5` and `organizations.ts:9` already
commit to for a workspace/organization that never overrides it — as an
explicit `timeZone`, plus `timeZoneName: "short"` so a reader always sees
which zone a time is in, never just the bare digits.

What is still open: this is the DEFAULT, not the CALLER's actual workspace
timezone. `assignmentEvidenceResponse` (`packages/contracts/src/
evidence.ts`) carries no `timezone` field, and neither does anything else
`GET /v1/assignments/{assignmentId}/evidence` returns, so this screen has no
way to know whether the workspace that owns this assignment actually set a
non-default zone at creation. Every real workspace today is `Europe/Kyiv`
(the pilot's own single-timezone scope), so the default is correct in
practice, not merely convenient — but it is silently wrong the day a second
timezone exists and nobody threads the real value through. The actual fix,
and it is a real column, not a guess: `public.organizations.timezone`
(`supabase/migrations/0001_core_tenancy.sql:12`, `not null default
'Europe/Kyiv'`) is what `POST /v1/workspaces` (`app/v1/workspaces/route.ts:
27-29`) actually writes into — "workspace" is this product's name for an
`organizations` row, there is no separate `workspaces` table — so the fix is
either the evidence route joining that column into its response body, or
`/dash`'s session/workspace context (already resolved once per request for
the shell, `getMeContext`) carrying it down to this screen. Either is a
real, separate change — not a two-line addition to `evidence-card.tsx`.

---

## P3 — Plan D slice D1 task 6 (the evidence screen) labels an occurrence
group with its bare UUID, not a human-readable requirement description

`evidence-by-occurrence.tsx`'s section heading for a real occurrence group is
the literal word "Вимога" plus the occurrence's own UUID underneath, `break-
all`-wrapped. Every occurrence section in a given assignment carries the
identical heading text, distinguished only by a 36-character identifier — a
ПТВ scanning the screen for a photo tied to a specific requirement has to
read UUIDs, not requirement names, to tell sections apart. Not what
"grouped by obligation" (this task's own commit message) reads as to the
person actually looking at the screen, even though it is literally true of
the data shape.

Named rather than fixed because the ONE interface this task's brief
authorises consuming — `assignmentEvidenceResponse` — carries `occurrenceId`
as a bare UUID and nothing else describing it. A human-readable label (the
requirement's own acceptance-criterion text, or a shorter derived title)
lives on `RequirementOccurrenceView`, returned by a DIFFERENT, unconsumed
endpoint (`GET /v1/assignments/{assignmentId}/requirement-occurrences`,
`packages/contracts/src/requirement-occurrences.ts`). Fetching it from this
screen would be a second round trip and undocumented scope beyond what the
brief's own "Interfaces" list authorised — a decision for whoever owns this
screen's next iteration, not a two-line addition here. The page's own
identity line (`Доручення {assignmentId}`) has the identical limitation for
the identical reason: no assignment-description endpoint exists at all (see
`evidence-by-occurrence.tsx`'s own header on `app/dash/assignments/
[assignmentId]/page.tsx`'s missing `GET /v1/assignments/{assignmentId}`).


## P3 — Plan D slice D1: the evidence screen's occurrence groups come back in UUID order

**Found 2026-08-22, in D1's final whole-branch review; filed rather than fixed
because the fix extends a contract.** `GET /v1/assignments/{assignmentId}/
evidence` orders its rows `order by ui.requirement_occurrence_id nulls last, …`
and then groups them into a `Map` keyed on that id, so the `groups` array — and
therefore the order `evidence-by-occurrence.tsx` renders sections in — is
ascending occurrence UUID. A UUID is a meaningless key to sort a screen by: two
requirements that a ПТВ thinks of as "first" and "second" appear in whichever
order their random identifiers happen to fall in, and the order changes for no
reason a reader can see when a third is added. The null group (unbound photos)
is correctly last by construction and is not part of this.

**What the fix needs, and why it is not a one-liner here.**
`assignmentEvidenceResponse` (`packages/contracts/src/evidence.ts`) carries
`occurrenceId` and nothing else per group. The ordinal that would give the
sections a meaningful order exists — `requirement_occurrences.ordinal`, exposed
as `ordinal: z.number().int().min(1)` on `RequirementOccurrenceView`
(`packages/contracts/src/requirement-occurrences.ts:80`) and again on the
external plane's `externalOccurrenceScopeResponse.occurrence.ordinal` — but it
is returned by a DIFFERENT call (`GET /v1/assignments/{assignmentId}/
requirement-occurrences`). So the options are: add `ordinal` to the group object
in `assignmentEvidenceResponse` and join `requirement_occurrences` in the route's
query (a contract change, an OpenAPI scope row's shape, and a second table in a
tenant-scoped read), or have the screen make a second round trip. Both are
decisions for whoever owns this screen's next iteration.

Same family as the P3 above it — that one is about what a group is CALLED, this
one is about what order the groups come in — and the same interface would close
both.

## P3 — Plan D slice D1: the evidence route discards `failedKeys`, so a wholesale storage failure is a silent HTTP 200

**Found 2026-08-22, in D1's final whole-branch review; filed rather than fixed
because it needs a logging decision this app has not made.**
`createSignedReadUrls` returns `{ urls, failedKeys }`
(`apps/app/src/lib/evidence-storage.ts:259-278`) — the split is deliberate and
was itself a ruling: a per-object failure must not 500 the whole assignment's
read, because "1 of 1 failed" is the modal shape at pilot start. `GET /v1/
assignments/{assignmentId}/evidence` destructures `const { urls } = await
createSignedReadUrls(keys, bucket)` and drops `failedKeys` on the floor.

The consequence is correct for ONE object and wrong for all of them. A lost
grant, a renamed bucket or a storage outage that fails every key returns HTTP
200 with a well-formed body in which every row simply has no `readUrl`, so the
screen renders N cards of «Зображення тимчасово недоступне» — which is exactly
what it should render for one purged object, and gives an operator nothing to
distinguish "one object is gone" from "the whole store is unreachable". Only a
top-level SDK error (auth, transport, an invalid bucket name) still throws.

**The constraint that makes this a decision rather than a fix.** The obvious
remedy is to log the count when `failedKeys.length === keys.length`, and this
app has NO happy-path logging to log it into: the shipped app contains exactly
one `console.error` call (`src/lib/http.ts:97`, the unmapped-error branch), no
logging library, no `middleware.ts` and no `instrumentation.ts` — see the P3
"the browser pass cannot assert «no signed URL in the logs», because there are
no logs" entry above, which is the same gap seen from the other side. Adding a
lone `console.error` here would be the first happy-path log line in the app and
would set the format for every one after it, and the same entry records the
reason to be careful about what goes into it: a storage key must never reach a
log. The alternative — a partial-failure signal in the response body — is a
contract change to `assignmentEvidenceResponse`.

Worth revisiting together with structured logging, which is also when the P2
"`evidence-storage.ts` puts raw storage keys into error messages" above stops
being latent.

## P3 — `readiness.ts`'s `codeFor` comment cites a bare `state-catalog.csv`, and two files share that basename

**Found 2026-08-23, in Plan D slice D2's fix round 3, on a citation `blocked-
reasons-list.tsx` copied verbatim from `readiness.ts:463-464` (`codeFor`'s own
leading comment): "a current RETURN is `CUSTOMER_MOTIVATED_REFUSAL` by
state-catalog.csv:116's own definition, and everything else is `SUPERVISION_
SIGNATURE_MISSING` by :115's."**

**This is a citation-clarity defect, not a factual one — verified both ways
before filing, because the first report of it treated the two as the same
thing.** Two files in this repository share the exact basename
`state-catalog.csv`:

- `technical/state-catalog.csv` (singular) — LEGACY, explicitly non-normative.
  `docs/README.md`'s own ruling, quoted in `apps/app/src/lib/
  assignment-status-labels.ts:18`: "the flat CSV catalogs are not v0.1
  implementation authority." Its lines 115–117 are `package,submitted` /
  `package,pending_reconciliation` / `package,returned` — a different entity
  (packages, not blocked reasons) in a different column shape
  (`domain,state,storage_scope,release,terminal,ui_uk,definition`).
- `technical/states/state-catalog.csv` (plural) — CURRENT, 23 references
  elsewhere in this codebase. Its lines 115–116 are exactly
  `blocked_reason.code,SUPERVISION_SIGNATURE_MISSING,stored_vocabulary,The
  occurrence awaits a decision from the approver_role that owes it,…` and
  `blocked_reason.code,CUSTOMER_MOTIVATED_REFUSAL,stored_vocabulary,A current
  return by the approver_role names a motivated refusal;…` — verified with
  `awk 'NR==115||NR==116' technical/states/state-catalog.csv`, matching
  `readiness.ts`'s citation byte for byte.

So a reader who resolves the bare filename to the WRONG one of the two — as
happened once already, in this same round's own re-review — reaches a
sentence about packages and concludes the citation has no source at all. It
does; the sentence is true of the plural, canonical file. `blocked-
reasons-list.tsx` (`apps/app/src/components/projects/blocked-reasons-list.
tsx`, the row rendering `missingEvidence.length === 0`'s two fallback
sentences) was fixed in this same round: it now cites the full path
`technical/states/state-catalog.csv`, cites the CSV rows by their own key
(`blocked_reason.code,CUSTOMER_MOTIVATED_REFUSAL` /
`,SUPERVISION_SIGNATURE_MISSING`, not a line number) rather than the bare
filename, and ADDITIONALLY names the real DB-level source `codeFor` branches
on — `EvaluatedOccurrence.currentDecisionOutcome`, read off
`requirement_evidence_decision_heads.current_outcome`, `check
(current_outcome is null or current_outcome in ('accepted','returned'))`
(`supabase/migrations/0045_the_refusal_and_the_facts_behind_it.sql`) — so the
comment states what the code actually branches on directly, rather than only
through a catalog row that explains what the OUTPUT code means.

**`readiness.ts:463-464` — the source this text was originally copied from,
predating this slice — was NOT touched by this round**, on the reasoning that
a comment fix inside a shared M3 file is outside a D2 slice's remit; this
entry is that deferral, named rather than silently carried. The fix owed
there is the same shape already applied to the copy: qualify the bare
`state-catalog.csv` citation with the full `technical/states/` path (or the
CSV row's own key), and state `codeFor`'s real branch condition
(`current_outcome`) alongside it rather than relying on the catalog citation
alone to carry that weight.

## Surfaced by the Plan D UI-foundation correction (shadcn one-to-one + TanStack), 2026-08-23

The owner's correction — «я же дал тебе указания использовать один в один из
референсов, то же самое shadcn», plus TanStack Table for tables and zod for
validation — landed as: `@tanstack/react-table`, `react-hook-form`,
`@hookform/resolvers` and `class-variance-authority` installed; shadcn's
`table`, `form`, `label`, `select` and `checkbox` taken through the shadcn MCP
and restyled onto token roles; `Table/Th/Td/Tr` replaced by shadcn's own
primitive set so there is one table and not two; a `DataTable` composition built
on satnaing/shadcn-admin's own `tasks-table.tsx`; and the two real
`<table>`-markup screens migrated onto it, and — after the owner's 2026-08-24
version correction — the whole stack moved to latest, zod 3 → 4 included.

**THE SLICE'S OWN REPORT FILE COULD NOT BE WRITTEN** (the agent harness refuses
report `.md` files), so the findings that would have lived at
`.superpowers/sdd/2026-08-23-ui-foundation/report.md` are recorded here
instead, where they will actually be read.

**CLOSED 2026-08-24 — the version policy changed and both version entries
below went with it.** The owner overrode the pinning decision outright:
«используй последние версии для библиотек, никаких пришпилены к 3.24.1». The
whole stack is now on latest — `zod ^4.4.3`, `@hookform/resolvers ^5.9.1`,
`@tanstack/react-table ^9.1.2`, `react-hook-form ^7.86.0`,
`class-variance-authority ^0.7.1`, each re-read from the npm registry at
install time rather than taken on trust. What the two retired entries said, and
what actually happened:

- **`@hookform/resolvers` is no longer pinned to `4.1.3`.** The pin existed
  only because `5.x`'s zod entry does `import * as n from "zod/v4/core"`, a
  subpath `zod@3.24.1` did not expose. On zod 4.4.3 that subpath is the
  library's own core and the problem does not exist. **Verified by running it,
  not by reading the peer range:** `zodResolver` over a zod 4 schema with a
  nested object returned `{ description: {...}, nested: { qty: {...} } }` —
  correct react-hook-form nested paths, custom Ukrainian messages preserved,
  and `{}` errors plus parsed values on the valid input.
- **`@tanstack/react-table` is on `9.1.2`, not the reference's `^8.21.3`.**
  The coordinator ruled on the conflict between «follow the reference
  literally» and «latest versions»: latest wins, and the reference's
  composition is ADAPTED. `DataTable.tsx` says at each line why it departs
  from `shadcn-admin`'s v8 shape. The map used was the vendor's own, shipped
  inside the installed package —
  `node_modules/@tanstack/react-table/skills/migrate-v8-to-v9/SKILL.md`,
  `library_version: 9.1.2`. The changes that mattered here: `useReactTable` →
  `useTable` with an explicit `features` object; `getCoreRowModel()` removed
  (automatic in v9); `getSortedRowModel()` → the `sortedRowModel:
  createSortedRowModel()` slot beside `rowSortingFeature`; and `TFeatures`
  first on every public type, which is why callers now write
  `DataTableColumnDef<T>` from `@goproceed/ui/components` instead of
  `ColumnDef<T>` from TanStack.

**P3 — v9 makes every feature opt-in, and several of this table's absences
are now load-bearing rather than incidental.** `rowSelectionFeature` is NOT
registered, so `row.getIsSelected()` does not exist and `DataTable` no longer
emits `data-state="selected"` — `TableRow` keeps the matching style, so the day
selection arrives only the feature and that one attribute have to be added.
`columnVisibilityFeature` IS registered purely so `row.getVisibleCells()`
exists (it is declared on that feature, not on core —
`@tanstack/table-core/dist/features/column-visibility/columnVisibilityFeature.types.d.ts:70`);
`row.getAllCells()` would render identically today and would silently ignore a
hidden column once the reference's view-options menu lands. Pagination,
filtering, faceting, grouping, pinning and sizing are all unregistered.
**The vendor's own named failure mode applies here: «An API is missing because
its feature was not registered, not because v9 removed it.»** `stockFeatures`
would bundle the lot and the skill's last checklist item is to audit it away,
so it is deliberately never introduced.


**P2 — `Checkbox` does not meet the 44px touch floor and nothing on a dash
route uses it yet.** `packages/ui/src/components/Checkbox.tsx` is shadcn's
`size-4` (16px). `apps/app/qa/field.mjs`'s `measureSmallTargets` collects every
`a, button, input, select, textarea` at 390 and 360 and reports anything under
44 in either dimension — and Radix renders BOTH a `button role="checkbox"` and
a hidden bubble `input`, so one checkbox on a dash route produces two findings.
Enlarging the box is the wrong fix (a 44px checkbox is wrong at desk density);
the fix is a hit area larger than the paint, and choosing its shape — padded
wrapper, `::before` expansion, or a label that owns the whole row — is a design
decision no brief in this slice makes. **The first dash screen that reaches for
this component owes that decision**, and the harness will refuse the screen
until it is made, which is the right order.

**P2 — this package now carries two answers to «how do I build a form», and
two `Textarea`s' worth of that same split.** `Field` (render prop, no library)
and `FormItem`/`FormLabel`/`FormControl`/`FormDescription`/`FormMessage`
(react-hook-form context) solve the same problem — id minting,
`aria-describedby`, `aria-invalid`, an error that is never colour alone — by
opposite mechanisms, and every screen shipped so far uses the first.
Separately, shadcn's `textarea` was NOT taken, because `Input.tsx` already
exports one and replacing it is a restyle of a shipped control rather than an
addition; the two differ in exactly `field-sizing-content` and `min-h-16`
versus this system's `min-h-24`. Both are recorded in
`packages/ui/src/components/index.ts` so they cannot go unnoticed. **Which
survives is a decision for the first real form (D3), with screens in front of
it** — not one to make ahead of one. Whichever loses, the loser's call sites
have to move in the same commit that retires it.

**CLOSED 2026-08-24 — `class-variance-authority` is no longer a dependency of
`packages/ui`.** It was added there on the original instruction as part of the
shadcn baseline, and then no file in the package imported it: shadcn does not
use `cva` in `table`, `form`, `label`, `select` or `checkbox`. An unused runtime dependency in a shared
package ships in every consumer's graph and later reads as licence for a second
styling idiom, so it is removed until the Button/Chip/Banner migration actually
needs it — at which point it comes back in the same commit as its first import.
`apps/app` keeps its own copy, which `apps/app/src/ui/button.tsx` really does
use. **That file is still a SECOND Button**, independent of `packages/ui`'s,
and that duplication predates all of this and belongs to the same migration.

**FIXED IN THIS SLICE, recorded because the mechanism generalises — a
`data-[…]` variant BEATS a `touch:` variant on specificity, and the 44px floor
lost silently.** shadcn's `SelectTrigger` sets its height with
`data-[size=default]:h-9 data-[size=sm]:h-8`; rewritten to token roles that
became `data-[size=default]:h-(--gp-control-height-desk)` sitting beside
`touch:h-(--gp-control-height-touch)`. Measured in a real browser at 390px with
`(pointer: coarse)` emulated: **the trigger stayed 36px, not 44.**
`.data-\[size\=default\]\:h-…[data-size=default]` is a class plus an
attribute selector (0,2,0); `.touch\:h-…` inside `@media (pointer: coarse)` is
a class (0,1,0), and a media query contributes nothing to specificity. Both
classes were in the stylesheet, both applied, and nothing warned — `cn()`
cannot help either, since they are different variant groups and neither is a
conflict it can resolve. The fix is to compose the height into ONE class per
size, the way `Button.tsx`'s `SIZE` map already does; re-measured at 360 with
coarse pointer, the trigger is 44px. **The general rule, which no test yet
enforces: never put a control height behind a `data-[…]` variant in this
system — the touch floor is a `touch:` variant and will lose.**

**FIXED IN THIS SLICE — both kitchen-sink tables were overflowing their column
headings at 390 and 360**, the same defect the assignments register shipped
once, on the page whose entire job is to demonstrate the ruling. «ЗАПЛАНОВАНО»
needs 118px; the `w-1/5` cells were 85px (the `Table` case) and 68px (the new
`DataTable` case). Both now carry the measured `min-w-160`, and both were
re-measured at 390 and 360 with `thOverflow: []` and page overflow 0.

**NOT A DEFECT, AND NOT MIGRATED ON PURPOSE — `blocked-reasons-list.tsx` is not
a table.** The brief that ordered this slice named it as one of «three tables …
hand-written `<table>` markup over a hand-rolled `Table.tsx`». It is a `<ul>`
of stacked list items, each carrying a `<dl>`, a wrapped norm-ref paragraph and
a nested evidence list, and it imports `Panel`/`PanelHeader`/`PanelBody` and
never `Table` — confirmed by grep (only `assignments-list.tsx`,
`unvalued-register.tsx`, `apps/landing/components/mock-panels.tsx` and
`apps/landing/components/blocks/comparison.tsx` imported `Table`) and visible
in `qa-output/screenshots/dash-project-money.png`. **Converting it to a table
is a redesign no brief authorises**, and it would put D2's measured
`break-words` fix on its norm-ref paragraph — a real 149–178px sideways page
overflow at 390/360 — back at risk. Left as it is, deliberately.

---

## Residuals left by the project-sourced-requirements slice (2026-08-27)

The slice that added [ADR-010](docs/decisions/ADR-010-project-sourced-requirements.md), migration 0059 and the `project_requirements` operations surfaced five follow-up items and one stale record correction below.

**1. The dashboard screen for requirement authoring was deliberately NOT built.** [ADR-010](docs/decisions/ADR-010-project-sourced-requirements.md) §"What this decision does NOT authorise" names it explicitly. A screen slice to build it would need four things: (a) a dated amendment to [ADR-009](docs/decisions/ADR-009-three-pilot-surfaces.md) decision 3; (b) a row in `docs/design/04-role-pain-map.md` naming the role (ПТВ) and the pain sentence from the demand scan; (c) a browser command call with an `Idempotency-Key` header — precedent exists in `apps/app/src/services/grants.service.ts`, `issueReviewLink` function; (d) the full procedure from `docs/design/02-building-ui.md` and its §5 gate. All four are specification work that must be in place before the screen slice runs.

**2. `apps/mobile` duplicates the verification vocabulary by design.** This slice changed `apps/mobile/src/lib/field/obligations.ts`, `apps/mobile/src/lib/field/obligations.test.ts` and `apps/mobile/src/screens/assignment.tsx` alongside their counterparts in the app. The header of `obligations.ts` names the duplication as «Transitional duplication under ADR-009: … fix bugs in BOTH files.» The rule stands: bugs in either copy must be fixed in both.

**3. The stale chain end.** This file's own §"What the M1–M6 build did" records that «the unapplied chain is `0041`–`0051`, eleven files». That was true on 2026-08-08. The chain now ends at `0059`. Verified 2026-08-27: `ls supabase/migrations | tail -1` → `0059_the_requirement_a_site_supplies.sql`. **This correction is a dated addition, not an edit to the old paragraph** — the record of what was true then stays as written.

**4. (CLOSED 2026-08-28, migration `0060`) Race condition — `app.retire_requirement_rule_version` (migration 0041) has the same SELECT-then-unguarded-UPDATE shape that `app.archive_project_sourced_requirement_item` (migration 0059) fixed in this slice.** The retire function SELECTs the status, checks it is `'published'`, then UPDATEs — but two concurrent calls can both pass the SELECT; the loser's UPDATE then blocks on the winner's row lock, re-evaluates its WHERE against the committed row once unblocked, still matches (the WHERE has no status filter), and the guard trigger (0041) then RAISES — so a racing call to an idempotency-required operation errors instead of being the promised no-op. The 0059 fix: `and status = 'active'` in the UPDATE's WHERE clause (migration 0059, archive function). That WHERE clause makes the loser's UPDATE affect zero rows — no error, no state change, idempotent. Apply the same pattern to `app.retire_requirement_rule_version`, in a `create or replace` in a new migration.

**CLOSED 2026-08-28 by migration `0060_the_retirement_that_raced_itself.sql`** — the prescribed `create or replace` with `and status = 'published'` on the UPDATE's WHERE, everything else byte-for-byte 0041's body (search_path moved to `''`, 0059's spelling; every reference was already schema-qualified). Pinned by the forced-interleave case «keeps the first retiree when a second one RACES it» in `packages/testing/src/m1-rules-schema.test.ts`, driven by polling `pg_stat_activity` for the blocked backend — the archive race test's own instrument. Shown RED against the unfixed function first, failing with exactly the predicted guard raise («admits only the published -> retired transition (INV-067); attempted retired -> retired»), then GREEN after 0060; 36/36 in the file.

**5. Test typechecking is narrower than its claim.** `apps/app/tsconfig.json`'s `include` is `["src", "app", "next-env.d.ts", ".next/types/**/*.ts"]`. It does not cover `apps/app/tests/**`, so `tsc --noEmit` checks only test files that are transitively imported from `src` or `app`. `vitest` still RUNS all tests (transpile-level errors surface), but it does not perform full type-checking. If a test typechecking gate is needed, the claim must be narrowed or `include` must be widened and a separate tsconfig created.

**Added 2026-08-27 by the final whole-branch review — four further residuals.** A dated addition, not an edit: the paragraph introducing this section counts what the slice's own retro surfaced and is left exactly as written.

**6. (CLOSED 2026-08-28) `capabilities.csv` and the list route disagree about who may read a workspace's project requirements.** `technical/permissions/capabilities.csv` puts `project_requirements.list` in the `operations` column of `project_requirements.manage` (owner/admin) alongside `.create` and `.archive`. The route does not gate it that way: `GET /v1/workspaces/{workspaceId}/project-requirements` (`apps/app/app/v1/workspaces/[workspaceId]/project-requirements/route.ts`) requires ACTIVE MEMBERSHIP only and leaves the row filter to the `psri_select` policy, which admits any active member — and its own header records why («a route stricter than the policy denies a read the policy allows») and that the catalog is what owes the correction. The read is deliberate and the catalog line is the stale half. The fix is a catalog edit, not a route edit: `project_requirements.list` moves out of `project_requirements.manage`'s operation list to wherever a membership-gated read belongs. It is left here rather than done inline because moving an operation between capability rows is a permission-catalog decision with its own review.

**CLOSED 2026-08-28, and the decision came out one step wider than the entry asked.** «Wherever a membership-gated read belongs» turned out to be the catalog's own exemption mechanism — the validator's `CAPABILITY_EXEMPT` set, whose members are listed with their reason in `technical/openapi/README.md` §Conventions («an operation governed by no capability is an authorisation hole rather than a scope statement… deliberately outside that rule») — not another capability row, because no capability means «any active member» and inventing one would restate membership. `project_requirements.list` moved there, and so did `requirement_library.list`: the identical defect, recorded in `requirement-library/route.ts`'s header since M1 («CAPABILITIES.CSV THEREFORE OWES A CORRECTION»), same policy wording, same fix, one decision. Both capability rows carry dated corrections, both route headers record the landing, ADR-010 decision 5 took a dated amendment for its `list` third, and the contracts-package header stopped claiming one capability governs all three. `pnpm validate:canonical-docs` green.

**7. `apps/mobile` renders the raw verification token where the content rules now mandate a label.** `apps/mobile/src/screens/assignment.tsx` prints `{item.normRef.verification} · {item.normRef.source}` — so a project-sourced obligation reaches a foreman's phone as the literal string `PROJECT_DOCUMENTATION`. `docs/product/hidden-works-content-rules.md` §"Project-sourced strings" gives the label in terms: «Its UI label is «за робочою документацією об'єкта» — an origin, not a verification strength.» The map that produces it exists only in the app: `NORM_REF_VERIFICATION_LABELS` / `normRefVerificationLabel` in `apps/app/src/lib/norm-ref-labels.ts`, checked against the running database by `apps/app/tests/norm-ref-labels.int.test.ts`. Porting it is a field-client copy change and needs its own slice — the mobile app has no dependency on `@goproceed/contracts` by design (`assignment.tsx` restates the three-value union locally for that reason), so the port duplicates the map under the standing rule residual 2 records: a bug in either copy is fixed in both.

**8. Two wire-layer narrownesses in the project-sourced contracts, both currently harmless.** (a) `packages/contracts/src/project-requirements.ts` validates the REQUEST fields with `z.string().trim().min(1)` and the RESPONSE fields (`projectSourcedRequirementItem`: `itemTextUk`, `sourceDocument`, `sourceSheet`, `sourceDrawingNo`, `sourceRevision`) with `z.string().min(1)` and no `.trim()`, so a whitespace-only value would parse on the way out. Nothing can produce one — migration 0059 §1 carries `length(btrim(<col>, E' \t\n\r\f\v\u00A0')) > 0` CHECKs on all four mandatory columns and the conditional one on `source_revision` — so the wire is a second layer over a storage guarantee rather than the only guard; aligning it would make the two directions read the same. (b) The read views reuse the three-valued `verificationTag` over columns whose CHECKs stay narrower: `projectSourcedRequirementItem.verification` is `verificationTag` while the only storable value on that table is `PROJECT_DOCUMENTATION`, and `requirementLibraryItem.verification` is the same constant while `requirement_library_items_verification_check` stays two-valued. `packages/contracts/src/requirement-library.ts`'s own header documents the asymmetry and why the constant widened for the copy tables and not for the library; neither is a defect and both are places a reader can mistake the type for the storable set.

**9. (CLOSED 2026-08-28) The external-plane test drivers exist in three near-duplicate copies.** `apps/app/tests/m5-external.int.test.ts` (`exchange` / `cookieOf` / `scope`), `apps/app/tests/external-evidence.int.test.ts` (`issue`, plus an inline exchange and cookie read) and `apps/app/tests/project-sourced-chain.int.test.ts` (`issueGrant` / `exchange` / `cookieOf` / `externalScope`) each carry their own copy of the same four moves, including the `EXTERNAL_SESSION_COOKIE` regex that matches the opaque session value rather than a token. The chain suite's header says why it mirrored rather than imported: neither existing suite exports its copy and that slice could not restructure either. Extraction to `apps/app/tests/helpers/` — beside `fixtures.ts` and `manual-baseline.ts` — is the follow-up, and it must keep each suite's deliberate differences (m5's `origin` override is what its cross-origin refusals are made of).

**CLOSED 2026-08-28 by `apps/app/tests/helpers/external-plane.ts`** — `issueGrant` / `tokenOf` / `exchange` / `cookieOf` / `externalScope`, plus the shared `EXTERNAL_TEST_ORIGIN` / `EXTERNAL_TEST_APPROVER` constants all three suites restated. The deliberate differences survived as parameters, not forks: m5's cross-origin refusals pass `exchange(token, origin)` (the request URL stays on the real origin while the header lies), its cookieless read passes `externalScope(null)`, and external-evidence's varying recipients ride the body override `issueGrant` merges over the shared default. Deliberately NOT extracted: m5's `submit` (one consumer; its CSRF/content-type/origin knobs are that suite's refusal matrix) and both `openLink` composites (they assert on the way through, and an assertion inside a shared helper is a hidden test). The chain suite's mirror-not-import header — the paragraph this entry quotes — is replaced by the extraction note. All three suites green (40/40) with `tsc` clean.
