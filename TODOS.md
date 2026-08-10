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

- **P2 — `service_role` holds TRUNCATE on `outbox_dead_letters`.** The
  append-only guarantee rests on a `BEFORE UPDATE OR DELETE` trigger
  (`0008:29-31`), and TRUNCATE fires neither. 0037 enabled RLS on the table,
  which does not gate TRUNCATE either. A TRUNCATE-shaped hole in an
  append-only table is worth closing on its own terms, not as a grant tweak.
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
- **P2 — `aktflow_service` inherits `select` on `evidence_objects` via
  `aktflow_app`** (`0034:32`, `0016:160-162`) while
  `tenancy-and-security.md:338` says an upload finalizer "cannot review
  evidence". An open least-privilege deviation, reasoned at `0034:13-17`.
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

## P3 — dead surface added by the M1 migrations

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

## P1 — valuation funding is first-come and is never redistributed

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

**A SECOND CANDIDATE DESIGN, which this re-run is what suggests.** The entry
frames the fix as «a correction on one root writes allocations for OTHER roots»
and rejects it on the engineering review's D1 finding. B's own closure is a
second address for the same repair: an admission could top up roots whose
admitted quantity is not yet funded and for which headroom now exists, writing
only inside the lineage whose closure is running. A's correction would still
touch nothing but A. That keeps D1 satisfied and changes something else instead
— whether admission is a one-shot event per entry or a standing claim — which is
the decision to take, and it is a decision rather than a patch.

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

## P3 — the Supabase CLI is unpinned, so the toolchain changes without a commit

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

## P1 — the product is renamed to GoProceed, and the runtime and copy identifiers have not followed

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

### P1 — six project-plane capabilities are in no responsibility preset

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

### BLOCKER (not a defect) — M4 ships a composer and no document, and no code can change that

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
