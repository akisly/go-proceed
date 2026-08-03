# TODOS

Deferred findings from the post-implementation engineering review of v0.1-M1
(2026-07-31). The P1/P2 findings from that review were fixed on the milestone
branch; everything below was consciously deferred. Each item cites the code so
it can be picked up cold.

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
**Depends on:** the membership lifecycle commands (not in v0.1-M1's 21 operations).

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

## P3 — dead surface added by the M1 migrations

**What:** `public.project_parties` (migration 0010) and
`organizations.default_own_party_id` have no writer anywhere in the codebase.

**Why:** both are in the approved entity catalog for M1, but no M1 operation
populates them — a reader cannot tell "not built yet" from "broken".
**Pros:** either wire them up or document them as deliberately schema-only.
**Cons:** project_parties needs its own command and capability decision.
**Context:** `technical/database/entity-catalog.csv` lists both as `v0.1-M1`
while `technical/openapi/scope-v0.1.csv` has no operation for either.
**Partly addressed in v0.1-M2-A:** `project_parties` is now annotated in the
entity catalog as deliberately schema-only, so a reader can tell "not built yet"
from "broken". Wiring it up still needs its own command and capability
decision.

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

## P3 — doc 07's Expo SDK baseline is behind what v0.1-M2-B0 initialises

**What:** `docs/legacy/07-technical-architecture.md:8` names "Expo SDK 56" and `:20`
fixes it as the version baseline with the rule "Pin exact patch versions and
image digests". `apps/mobile` was initialised with `create-expo-app` on the
owner's instruction and resolves to Expo SDK 57.0.9.

**Why it is recorded rather than fixed:** the document carries no Historical
marker and is not under `docs/legacy`, so by `docs/README.md:25-41` it is target
version design — precedence rank 2, normative for architecture. Editing a
normative architecture document is not a foundations slice's call. The owner's
instruction governs what was built; the document should catch up deliberately.

**Pros of fixing:** the architecture document stops naming a version nothing
uses, and the next reader does not have to discover the divergence the way this
one did.
**Cons:** it is a normative-document edit and should be made by whoever owns the
architecture baseline, alongside a check of the Node and Next.js pins in the
same paragraph, which may have drifted for the same reason nobody noticed.

## P2 — the pilot-device inventory does not exist

**What:** `docs/product/roadmap.md`, `docs/product/scope-and-boundaries.md`
and `ADR-004` all require an actual pilot-device inventory — one supported
iPhone and one lower-resource supported Android device, physical, confirming
the iOS 16.4+ / Android 10+ support floor — as *entry* evidence for v0.1-M2,
required before capture UX is frozen. No such inventory exists.
`docs/superpowers/plans/evidence/2026-08-01-b0-procurement.md` records the
two devices as unprocured; this entry is the standing tracker for that gap.

**Why:** the requirement sits in front of capture UX, which is B1's work, but
the roadmap only asks that the inventory confirm the support floor before
that UX is frozen, not before B1 starts. Nothing in B1 or B2 reads a device
inventory or blocks on one. The document that does depend on it is B3's —
the acceptance matrix and device-install step need the physical devices
themselves, and the inventory is how their model numbers and OS versions get
into that matrix in the first place. So this is a prerequisite for B3, not
for B1 or B2, and should not be read as blocking either of them.

**Pros of fixing:** closes an entry-evidence gap the roadmap has carried
open since before B0, and gives B3's acceptance matrix real device rows
instead of placeholders.
**Cons:** none technical — it is a purchasing/logistics task, not code.
**Depends on:** the same two devices named in the B0 procurement record.
Buying them is independent of the account procurement, but the iPhone's UDID
still has to be registered under the Apple Developer Program membership
before an internal-distribution build will install on it, so the inventory
is complete in practice only after that account exists.

## P1 — the product is renamed to GoProceed, and the aktflow identifiers have not followed

**What:** the owner stated on 2026-08-03 that the product is GoProceed and that
the `aktflow` identifiers are being replaced. `apps/mobile`'s deep-link scheme
was corrected immediately because it had just landed. Everything else still says
`aktflow`, measured on this branch:

- **10** `package.json` files declaring `@aktflow/*` names, and **55** source
  files importing them.
- **46** files referencing the PostgreSQL roles `aktflow_app`,
  `aktflow_app_login`, `aktflow_service`, `aktflow_service_login` and
  `aktflow_worker` — migrations, RLS policies, grants, the local-credentials
  script, CI env, and `.env.example`.
- **58** documents and catalogs under `docs/` and `technical/`.
- Four domains: `aktflow.app`, `aktflow.com`, `aktflow.example`, `aktflow.pilot`.

**Why it is not swept here:** the database roles are the hard part and they are
already merged. `ALTER ROLE ... RENAME TO` is not a text substitution — a role
rename clears an md5-hashed password, every connection string and CI secret has
to move in the same window, and the rename must land in a migration that runs
against an environment whose app is already connecting under the old name. That
is a deployment-ordering problem, not a find-and-replace, and it belongs in a
slice with its own plan and its own rollback story.

`docs/legacy/04-screen-specification.md` also still specifies `aktflow://` and
`aktflow.app` universal links with four route patterns. It is now archived
under `docs/legacy/` and non-normative by `docs/README.md`'s precedence, but
it is the only record of that link contract, so its content still has to be
carried into the rename slice deliberately rather than left to be
contradicted silently by code.

**Pros of fixing:** one name. Today a reader cannot tell whether `aktflow` is the
old product name, a namespace that outlived it, or a separate system.
**Cons:** the role rename touches a deployed database and cannot be done as part
of unrelated work. The package-name and documentation halves are safe and could
go first; the role half needs a maintenance window.
**Suggested split:** (1) packages, imports and docs — mechanical, reviewable;
(2) domains and the screen specification's link contract; (3) database roles,
with its own plan.
