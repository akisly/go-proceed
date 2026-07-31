# GoProceed v0.1-M2-A — execution, valuation, and server-side evidence

**Status:** Approved for planning

**Applies to:** v0.1-M2 (server slice)

**Written:** 2026-07-31

**Baseline:** `main` @ `7a6d8b8` (v0.1-M1 merged, migrations 0010–0014 applied)

**Related:** [delivery/version-0.1.md](../../delivery/version-0.1.md#v01-m2--assignments-progress-and-online-evidence),
[domain/execution-and-evidence.md](../../domain/execution-and-evidence.md),
[domain/value-at-risk.md](../../domain/value-at-risk.md),
[architecture/files-and-storage.md](../../architecture/files-and-storage.md),
[technical/database/schema-v0.1.sql](../../../technical/database/schema-v0.1.sql)

---

## 1. Scope decision: M2 splits into M2-A and M2-B

The approved M2 milestone contains two independent subsystems:

| | Subsystem | Delivered in |
|---|---|---|
| A | Server: assignments, progress, valuation lineage, upload protocol, evidence identity | **this spec** |
| B | `apps/mobile`: Expo/React Native capture client, encrypted pending originals, quarantine, EAS builds | separate spec |

The split is forced by verifiability, not preference. M2-B's exit gates —
EAS internal builds, TestFlight and Google Play internal distribution, and
acceptance on a physical iPhone plus a lower-resource Android — depend on the
owner's developer accounts and hardware. A plan that mixes them with server
work cannot reach a green state in one execution pass.

M2-B inherits invariants INV-013, INV-014, and INV-053, which the invariant
catalog already scopes as `mobile`. M2-A owns INV-023, INV-024, INV-025,
INV-045, INV-046, and INV-047, all of which are server-enforceable and
server-testable.

**The roadmap M2 exit gate is not closed by this spec alone.** M2-A closes the
server half; the milestone closes when M2-B lands.

## 2. User outcome

A workspace that has published a contract baseline can:

1. define a published evidence requirement template;
2. create work assignments against exact work items, optionally pinning that
   template version;
3. record measured performed quantity, and correct it by signed append-only
   adjustment;
4. have every quantity fact split the work item's canonical money pool into a
   stable exposure slice at the moment it is recorded;
5. authorize, stage, verify, and finalize a whole-file evidence upload into
   private object storage, with an idempotent receipt that survives retry.

## 3. Operation slice — nine operations

Seven are the catalogued `v0.1-M2` operations. Two are pulled forward from
`v0.1-M3` because the M2 exit gate requires template pinning and the upload
protocol needs an authoritative source for allowed media type and size.

| Operation | Method | Path | Idempotency class |
|---|---|---|---|
| `requirement_templates.create` | POST | `/v1/workspaces/{workspaceId}/requirement-templates` | `standard_30d` |
| `requirement_templates.publish` | POST | `/v1/requirement-templates/{templateVersionId}/publish` | `standard_30d` |
| `assignments.create` | POST | `/v1/contracts/{contractId}/assignments` | `standard_30d` |
| `assignments.list` | GET | `/v1/projects/{projectId}/assignments` | natural |
| `progress.record` | POST | `/v1/assignments/{assignmentId}/progress` | **`ledger_400d`** |
| `progress.adjust` | POST | `/v1/progress-entries/{entryId}/adjustments` | **`ledger_400d`** |
| `upload_intents.create` | POST | `/v1/assignments/{assignmentId}/upload-intents` | `standard_30d` |
| `upload_intents.finalize` | POST | `/v1/upload-intents/{intentId}/finalize` | `standard_30d` |
| `upload_intents.get` | GET | `/v1/upload-intents/{intentId}` | natural |

`progress.record` and `progress.adjust` take `ledger_400d` because they append
money lineage. `packages/database/src/idempotency.ts` already reserves that
class for ledger-affecting commands; M1 shipped `import_batches.publish`
without it, and this slice corrects that one-line omission as well (deferred
finding in `TODOS.md`).

Only the two pulled-forward template operations reduce the M3 slice. Occurrence
generation, evidence links, exceptions, internal review, and readiness stay in
M3 untouched.

### Pulled-forward template scope is deliberately narrow

`requirement_templates.create`/`.publish` in M2-A freeze only the fields the
assignment pin and the upload gate actually read:

- `evidence_type`;
- `allowed_media` (MIME allowlist and maximum byte size);
- `multiplicity`;
- `severity`;
- `template_hash` and `version_no`.

`condition_expr`, `form_schema`, `timing`, `satisfier_policy`,
`reviewer_policy`, and `exception_policy` exist as columns per the target
schema, accept only their empty defaults in M2-A, and are rejected with a
`VALIDATION_FAILED` problem if supplied. M3 opens them. This keeps the frozen
template hash meaningful without pretending the policy surface is implemented.

## 4. Schema slice

Two migrations, following the M1 shape (`0012` module DDL, `0013` security):

- `0015_execution_evidence_module.sql`
- `0016_execution_evidence_security.sql`

Tables materialize `technical/database/schema-v0.1.sql` lines 573–812:
`work_assignments`, `progress_entries`, `progress_allocation_heads`,
`valuation_allocations`, `upload_intents`, `capture_events`,
`evidence_objects`, `requirement_template_versions`.

### 4.1 Deliberate divergences from `schema-v0.1.sql`

The target schema is a design artifact written before M1 was built. Where the
realized database already diverges, **the realized database wins** — a mixed
style is worse than a documented deviation.

| Target schema says | M2-A builds | Why |
|---|---|---|
| `references public.workspaces(id)` | `references public.organizations(id)` | M1 named the workspace table `organizations` in migration 0001; all 14 migrations use it. |
| `create type … as enum` (8 enums) | `text` + `check (… in (…))` | M1 built zero enums; every state column in 0010–0014 is text+check. Enum value evolution also needs `alter type`, which complicates additive migrations. |
| `expected_content_hash bytea`, `content_hash bytea` | `text` with `check (~ '^[0-9a-f]{64}$')` | M1's `import_files.content_hash` is text with exactly this check; hashes cross the API boundary as hex. |
| `valuation_allocations` has only `root_progress_entry_id` | adds `progress_entry_id uuid not null` with FK and `unique (workspace_id, progress_entry_id)` | Without it there is no enforceable "exactly one allocation per progress fact", and an adjustment's allocation cannot be told from its root's. `lineage_key` is derived from this id, so the tie-break stays stable. |

Two additive constraints are required on existing M1 tables so the M2 composite
foreign keys can exist. Both are `alter table … add constraint`, never edits to
0010–0014:

1. `memberships` gains `unique (organization_id, id)` — it currently has only
   `unique (organization_id, user_id)` and `unique (organization_id, user_id, id)`,
   neither of which can back a `(workspace_id, member_id)` reference.
2. `work_items` gains
   `unique (workspace_id, project_id, contract_id, contract_version_id, id)`,
   required by the `work_assignments` five-column FK, and
   `unique (workspace_id, project_id, contract_id, id)`, required by the
   `valuation_allocations` four-column FK.

### 4.2 Actor references

Recorder and assignee columns reference `memberships (organization_id, id)`,
not `auth.users`. A user can belong to several workspaces; accountability is a
membership fact. This follows the target schema and is stricter than M1's
`import_files.uploaded_by → auth.users(id)`. M1's column is not migrated —
that would be a rewrite of applied history for no user-visible gain.

### 4.3 INV-023 enforced by the database, not only by the command

`progress_entries` carries the check constraint from the target schema:

```sql
check ((entry_kind = 'root'       and root_progress_entry_id is null
        and quantity > 0 and reason_code is null)
    or (entry_kind = 'adjustment' and root_progress_entry_id is not null
        and quantity <> 0 and reason_code is not null))
```

That constraint cannot express "the referenced row is itself a root". The
self-FK `(workspace_id, root_progress_entry_id) → (workspace_id, id)` permits an
adjustment pointing at another adjustment. M2-A closes the gap structurally
rather than by command-level validation alone:

```sql
is_root boolean generated always as (entry_kind = 'root') stored,
unique (workspace_id, id, is_root),
-- adjustments only:
root_is_root boolean check (root_is_root),
foreign key (workspace_id, root_progress_entry_id, root_is_root)
  references public.progress_entries (workspace_id, id, is_root)
```

`root_is_root` is nullable and tied to the entry kind by
`check ((entry_kind = 'adjustment') = (root_is_root is not null))`. A root row
leaves it NULL, so its composite FK is not enforced (MATCH SIMPLE). An
adjustment row must set it `true`, and the FK then only resolves against a row
whose `is_root` is true. A chain is unrepresentable. This is the direct
application of M1 review lesson 2 — an invariant enforced in exactly one route
is not enforced.

### 4.4 `app_private.assert_reservation_invariant`

`schema-v0.1.sql:1795` declares this function as a design interface whose body
raises `'design interface: implemented by v0.1 migrations'`. M2-A implements it
for real: holding the allocation-head lock, it recomputes effective quantity
from `progress_entries` and proves
`0 <= reserved_quantity <= effective_quantity`, raising otherwise. In M2-A
`reserved_quantity` has no writer (claims are M4), so the function is exercised
by tests that seed the head directly — see §7.3.

## 5. Money: coupled valuation allocation

`work_items` already carries the canonical pool from M1
(`net_amount_minor_units`, `tax_amount_minor_units`, `gross_amount_minor_units`,
`currency`, `tax_mode`, `unit_price_state`, `valuation_basis`, `contract_quantity`,
`unit_precision` — migration 0012 lines 219–260). M2-A partitions it.

### 5.1 Where allocation happens

In the **same transaction** as the progress fact. `progress.record` and
`progress.adjust` each append exactly one `valuation_allocations` row for the
entry they create, keyed `unique (workspace_id, progress_entry_id)`.

Serialization is on the `work_items` row (`select … for update` by
`(workspace_id, id)`), not on a new head table. `work_item_pool_heads` is not
in the entity catalog and is not introduced; the remaining unperformed pool is
derived under that lock as pool minus the sum of existing allocations. This
keeps the reconciliation identity a queryable property rather than a cached
number that can drift.

### 5.2 Algorithm

A new `packages/domain/src/valuation.ts`, built on M1's BigInt engine.

Allocation is **incremental and per-root**, which is what
[value-at-risk.md](../../domain/value-at-risk.md) prescribed all along:

- **positive quantity** carves from the *current* unperformed pool —
  `floor(remaining × q / remainingQuantity)` on each allocated component, with
  the one leftover minor unit going to the larger remainder. The leftover here
  is the unperformed pool, which carries no lineage identifier, so an exact tie
  goes to the slice — the side that does have a stable identity;
- **negative quantity** re-proportions within the entry's **own root** and
  returns the difference, so a correction can only hand back money that root
  actually received.

The allocator therefore needs two levels of state, both read under the
work-item row lock: the work item's performed quantity and allocated amounts,
and the same pair for the entry's root.

An earlier revision of this design computed a slice as the difference of two
cumulative allocations keyed off total work-item quantity. It was rejected in
engineering review: it reconciles in aggregate but corrupts lineage. With a
one-cent pool over quantity 2, root A takes 0 and root B takes 1; correcting A
by −1 then strips B's cent and leaves A holding −1 at zero quantity. M4 package
lines SUM per-slice amounts, so each slice has to be meaningful on its own, not
merely as a term in a telescoping series. The property test that defended the
telescopic version was itself a tautology — summing terms that telescope by
construction cannot fail.

The reviewed alternative — store quantity plus exact rational entitlement in M2
and allocate minor units only in M4 — was also rejected, because
value-at-risk.md requires a package line to sum *already allocated* canonical
amounts rather than recompute them. Adopting it would change an approved domain
document, not just this slice.

Quantity beyond `contractQuantity` allocates nothing further: the pool covers
within-contract scope only, and over-contract exposure is INV-039's concern in
M6, not a second pool here.

Per [value-at-risk.md](../../domain/value-at-risk.md) "Segment allocation and
rounding", components are never allocated independently:

| `tax_mode` | Allocate | Derive |
|---|---|---|
| `exclusive` (net-priced) | net, tax | `gross = net + tax` |
| `inclusive` (gross-priced) | gross, tax | `net = gross - tax` |
| `exempt`, `out_of_scope` | pinned primary component, `tax = 0` | the other component |
| `unknown` | — | slice is `valued: false`, all three columns NULL |

Each allocated component floors; the third is derived, never floored
independently. Because both the slice and the unperformed remainder derive the
same component the same way, `gross = net + tax` holds for every slice, for
their sum, and for the leftover.

**The pool numbers alone are not sufficient input.** M1's publish writes
`mp.net ?? "0"` into `net_amount_minor_units` (`publish/route.ts:200`), so a
work item whose money is unknown carries a pool of `0`, indistinguishable by
value from work that is genuinely free. `net_amount_minor_units` is `not null`,
so every work item looks priced. Allocation therefore reads the qualifying
facts, and this is the INV-038 missing-versus-zero distinction being preserved
at write time — M6 cannot reconstruct it later if the allocation rows say `0`:

| Work item facts | Slice |
|---|---|
| `tax_mode = 'unknown'` | unvalued, reason `unknown_tax_basis` |
| `valuation_basis = 'unit_price_derived'` and `unit_price_state = 'missing'` | unvalued, reason `missing_unit_price` |
| `valuation_basis = 'unit_price_derived'` and `unit_price_state = 'zero'` | **valued**, all components `0` — genuinely free work |
| `valuation_basis = 'approved_source_amount'` | valued from the approved amount; `unit_price_state` is irrelevant |

An unvalued slice stores NULL in all three minor-unit columns, which the target
schema's check constraint already permits, plus a reason code. It never stores
`0`.

A negative adjustment returns money to the unperformed pool: its allocation row
carries negative quantity and negative minor units, computed from the pool
*after* the earlier slices, so the identity holds at every commit.

### 5.3 The invariant that actually matters

```
work_item pool component = unperformed component + Σ allocation components
```

on **all three** of net, tax, and gross, exactly, in minor units, after any
sequence of records and adjustments. This is a property test, not an example
test — see §7.2.

The identity is asserted over valued work items. For an unvalued work item the
paired assertion is categorical rather than numeric: **every** slice on it is
unvalued with the same reason, and no slice on it carries minor units. A work
item never has a mix of valued and unvalued slices, because valuation depends
only on immutable work-item facts, and `contract_versions` are immutable. If a
mix is ever observable, the allocation input is being read from somewhere it
should not be.

## 6. Upload protocol

### 6.1 Storage substrate

**One** private Supabase Storage bucket, `evidence`, declared in
`supabase/config.toml` and created by migration `0020`.

The design first called for a staging bucket and an originals bucket with a
promotion step between them. Engineering review rejected that (finding D3):
moving an object between buckets cannot be atomic with the PostgreSQL
transaction that creates the evidence row, so a crash or rollback in between
leaves bytes nobody references, and a sweep for unreferenced originals can
delete an object a still-committing transaction is about to claim.

Removing the move removes the failure mode rather than mitigating it. The
storage key is issued when the intent is authorized and never changes, which is
also the most direct reading of INV-045. Staged bytes are not evidence because
no `evidence_objects` row points at them — which is what
[files-and-storage.md](../../architecture/files-and-storage.md) already says:
an object existing in storage does not make it evidence.

The two logical storage classes in that document stay separated by policy
rather than by bucket, which it explicitly permits. A second bucket would not
carry retention either: "delete if no evidence row after 24 hours" is a
domain-state rule that bucket lifecycle cannot express, so the purge job reads
PostgreSQL in either design.

`storage.objects` carries no policy for `anon` or `authenticated` on this
bucket, so RLS denies them by default. Every read and write goes through the
server, which checks PostgreSQL first. Storage keys are opaque (`{uuid}/{uuid}`)
and carry no workspace name, filename, contract number, or other business
identifier.

Tests run against the same local Supabase Storage service the deployed system
uses. No in-memory or Postgres-backed fake adapter is built: M1's review lesson
was that defects hid where fixtures exercised one unrealistic shape, and a fake
storage adapter guarantees the whole suite runs against the unrealistic shape.

### 6.2 Flow

```
upload_intents.create
  validate actor capability, assignment, pinned template media rules,
  expected size against template maximum, workspace quota
  → insert intent (intent_authorized) + device-sourced capture_event
  → issue short-lived signed upload URL for an intent-bound staging key

  [client PUTs whole bytes to staging]

upload_intents.finalize
  → read staged object server-side; verify byte size and sha256 against the
    intent's expectations                        → integrity_verified
  → inspection policy hook                       → scan_pending → passed
                                                 | scan_blocked (terminal)
  → RECHECK authorization (INV-047)              → orphaned_for_purge on failure
  → atomically: copy to evidence-originals key, insert evidence_objects,
    set intent available + finalized_evidence_object_id, append
    server-sourced capture_event
```

`inspection_status` in the target schema has only `passed` and `not_required` —
there is no blocked value. That is correct and load-bearing: **a scan-blocked
upload never produces an `evidence_objects` row.** The blocked state lives on
the intent. Nothing downstream can accidentally read blocked content as
evidence.

M2-A ships no real anti-malware engine. The inspection hook is an injectable
module with a recorded `inspection_policy_version`; the default policy passes
allowlisted media families and blocks everything else. The `scan_blocked` path
is fully implemented and tested through an injected inspector that blocks. This
is honest: the state machine is real, the scanner is a policy stub, and the
spec says so rather than implying an AV exists.

### 6.3 Idempotency and conflict

`upload_intents` carries `unique (workspace_id, created_by_member_id, idempotency_key)`
from the target schema, plus `request_hash`.

- same key + same `(expected_content_hash, expected_byte_size)` → same intent
  returned, same signed URL semantics, no duplicate row;
- same key + different hash or size → `409` conflict, per the domain doc's
  step 8;
- repeated `finalize` of an already-`available` intent → the same receipt,
  exactly one `evidence_objects` row;
- `upload_intents.get` re-fetches the receipt by intent identity, covering the
  "server receipt succeeded but local write failed" row of the failure table.

### 6.4 Orphan purge (INV-047)

A SQL function `public.purge_orphaned_upload_intents()` selects intents that are
`intent_authorized`/`staged`/`integrity_verified`/`orphaned_for_purge` past
their `expires_at` or older than 24 hours, marks them, and emits a
`evidence.staging_purge_requested` outbox event. The existing outbox drain and
dead-letter machinery (migrations 0005 and 0008) carries the alerting
requirement. An app-side worker module consumes the event and deletes the
staging object; it is idempotent and covered by integration tests.

The `pg_cron` schedule follows the guarded pattern of
`0005_outbox_drain_cron.sql` — the extension may be absent locally, and the
migration must not fail when it is. Wiring the schedule on staging is an
operations step, recorded as such, not claimed as verified here.

## 7. Testing strategy

### 7.1 Fixture shape discipline (M1 lesson 1)

M1 passed 340 tests while inclusive-tax work items double-counted VAT and
lump-sum lines published as zero, because every fixture was exclusive-tax,
single-file, and priced. The M2-A money suite is parameterized over the cross
product:

`tax_mode` ∈ {exclusive, inclusive, exempt, out_of_scope, unknown}
× `unit_price_state` ∈ {known, zero, missing}
× `valuation_basis` ∈ {unit_price_derived, approved_source_amount}

Combinations the domain forbids assert the fail-closed behaviour instead of
being skipped.

### 7.2 Property tests

- reconciliation: for a random sequence of records and adjustments,
  `pool = unperformed + Σ slices` holds exactly on net, tax, and gross for
  valued work items, and every slice on an unvalued work item is unvalued;
- order independence: effective quantity is independent of adjustment append
  order;
- no double rounding: two quantity-1 slices at unit price `0.005` allocate from
  the one-cent quantity-2 pool rather than becoming two cents (the worked
  example in value-at-risk.md);
- over-contract quantity allocates nothing beyond the pool, and the slice that
  crosses the contract quantity allocates only its within-contract part.

### 7.3 Invariant tests

| Invariant | Test |
|---|---|
| INV-023 | adjustment referencing an adjustment is rejected by the FK, not only by the route; adjustment across assignments/work items rejected |
| INV-024 | adjustment driving effective quantity below zero rejected under the head lock |
| INV-025 | head seeded with `reserved_quantity > 0`; adjustment crossing it rejected as a standalone command — the only way to exercise this in M2-A, since claims are M4 |
| INV-045 | second `evidence_objects` row on one storage key rejected; UPDATE of `storage_key` or `content_hash` denied by trigger |
| INV-046 | staged, integrity-verified, scan-pending, blocked, and orphaned bytes are unreadable through every query path |
| INV-047 | authorization revoked between staging and finalize → `orphaned_for_purge`, no evidence object; purge function is idempotent |

Every write path that can reach a protected state is enumerated and tested, and
the RLS write policies are exercised directly at the database layer in
`packages/testing`, not only through routes. Migration 0014 exists because M1's
RLS write policies were a capability no-op; that regression class is checked
explicitly here.

### 7.4 Concurrency tests (closes a deferred M1 finding)

M1 shipped with no parallel-command tests at all. M2-A introduces the harness
in `packages/testing` and uses it for:

- two adjustments on one root in parallel → head serializes, no negative
  effective quantity, both outcomes consistent;
- two `finalize` calls on one intent → exactly one `evidence_objects` row;
- two `progress.record` with the same `Idempotency-Key` → exactly one entry and
  one allocation;
- carry-over: two `import_batches.publish` on one batch → one version.

The harness must respect the serialized runner constraint —
`turbo run test --concurrency=1` exists because the suite shares one database —
so parallelism is created inside a test, with its own connections, never by
relaxing the runner.

### 7.5 Vertical scenario

Replacing M2's device-matrix scenario, which belongs to M2-B:

publish a requirement template → create an assignment pinning it → record
progress → assert the exposure slice and pool reconciliation → create an upload
intent → stage bytes → finalize → assert the available receipt and immutable
evidence identity → replay finalize and assert the same receipt → append a
negative adjustment → assert money returns to the pool and the identity still
holds → revoke authorization mid-upload on a second intent → assert
`orphaned_for_purge` with no evidence object → run purge and assert the staging
object is gone.

## 8. Catalog reconciliation

M1's review left the two catalogs disagreeing, and `TODOS.md` asks for
reconciliation when the M2 slice is planned. This slice does it:

- `technical/openapi/scope-v0.1.csv`: `requirement_templates.create` and
  `.publish` move to `v0.1-M2`;
- `technical/database/entity-catalog.csv`: `requirement_template_versions`
  moves to `v0.1-M2`;
- `public.project_parties` and `organizations.default_own_party_id` are
  annotated as deliberately schema-only with the milestone that will write
  them, so a reader can tell "not built yet" from "broken";
- `technical/database/invariant-catalog.csv` gains the M2-A test evidence
  references.

## 9. Out of scope

`apps/mobile` and everything mobile-local: encrypted pending originals,
quarantine, restart persistence, EAS, TestFlight, Play internal testing,
INV-013/014/053. Real anti-malware scanning. Derivative and thumbnail
generation. Offline authorization, background sync, resumable chunks (v0.3).
Requirement occurrences, evidence links, exceptions, internal review, readiness
(M3). Packages, claim segments, the progress-claim allocation ledger, the
atomic corrected-successor command (M4). Reservation writers — M2-A implements
the guard and the assertion function, but nothing in M2-A reserves quantity.

Deferred M1 findings that stay deferred: invitation email binding, membership
reactivation, ending responsibility assignments. Each needs a product decision
this slice does not force.

## 10. Definition of done

1. Migrations 0015 and 0016 applied; catalog snapshot refreshed.
2. Nine operations implemented on the existing `commandRoute`/`queryRoute`
   plumbing with the established problem-detail contract.
3. Money property tests green across the full fixture matrix of §7.1.
4. Invariant tests of §7.3 green, including the database-layer RLS checks.
5. Concurrency harness green, including the M1 publish carry-over.
6. Vertical scenario of §7.5 green.
7. Full suite serialized (`turbo run test --concurrency=1`), typecheck, build.
8. Catalogs reconciled per §8; `TODOS.md` updated for what this slice closed.
9. `/plan-eng-review` run, findings triaged, P1/P2 fixed before the slice is
   called done.
