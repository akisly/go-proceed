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

## P0 (OPEN) — the field client is built and NOBODY CAN OPEN IT: there is no origin

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
