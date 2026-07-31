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
