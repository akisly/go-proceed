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

## P3 — publish uses the standard 30-day idempotency class

**What:** `apps/app/app/v1/import-batches/[batchId]/publish/route.ts` omits
`idempotencyClass`, so it takes `standard_30d`, while
`packages/database/src/idempotency.ts` reserves `ledger_400d` for
"financial/ledger-affecting operations that must stay replayable for the audit
retention window".

**Why:** publishing a contract version is the ledger event of this milestone.
**Pros:** one-line change, aligns retention with the audit window.
**Cons:** none known; confirm 400 days matches the retention catalog first.
**Depends on:** `technical/data-retention-catalog.csv` review.

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
while `technical/openapi/scope-v0.1.csv` has no operation for either. Reconcile
the two catalogs when the M2 slice is planned.

## P3 — no concurrency tests anywhere in M1

**What:** nothing in `apps/app/tests` or `packages/testing/src` runs two
commands in parallel. Publish serialisation (contract row lock), the
idempotency advisory lock, and unit auto-registration were all reasoned about
but never demonstrated under contention.

**Why:** the reasoning may be right and still not be true.
**Pros:** turns three arguments into three tests.
**Cons:** parallel DB tests need care with the serialized runner
(`turbo run test --concurrency=1` exists precisely because of shared-DB races).
**Depends on:** nothing; can be done any time.
