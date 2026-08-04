# Data model architecture

**Status:** Approved

**Applies to:** v0.0 and v0.1

**Last reviewed:** 2026-08-03

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md)

## Purpose and authority

This document turns the approved [canonical domain model](../domain/domain-model.md)
into PostgreSQL implementation rules. It defines target invariants, key shapes,
index order, mutability boundaries, projection rules, and transaction/lock
contracts. It does not claim that the approved v0.1 target already exists.

Applied migrations remain authoritative for the database that exists today.
The target schema and later migrations must implement this document without
weakening the domain rules.

## Current baseline versus approved target

### v0.0 origin slice: six tables (migrations 0001-0002)

Migrations `0001`-`0002` created exactly six application tables, the v0.0
origin slice:

| Current physical table | Current purpose | v0.0 consequence |
|---|---|---|
| `organizations` | Existing tenant root with duplicated legal attributes | Preserve during compatibility; introduce canonical workspace/party ownership additively |
| `legal_entities` | Existing organization-local legal entity | Backfill into tenant-local party and own-legal-profile identities before any retirement |
| `memberships` | Existing membership with a mixed rigid role set | Migrate to four governance roles plus separate project access and responsibilities |
| `audit_events` | Command audit facts | Make tenant-safe and append-only; audit remains non-authoritative for domain history |
| `idempotency_records` | Command replay records | Require tenant binding, bounded keys, expiry, and a coherent replay lifecycle |
| `transaction_outbox` | Durable event intents | Require tenant binding, real claim/retry/error/backoff/dead-letter behavior |

The migration chain has since grown the baseline to 33 tables across 35
migrations (through `0035`). It also creates `api.me_context`; 27 functions
(22 in `app`, 5 in `public` — counting distinct schema-qualified name plus
argument-type list, surviving all drops, including `SECURITY DEFINER`
helpers and trigger functions); five roles — `aktflow_app`,
`aktflow_app_login` (`0003:8,11`), `aktflow_worker` (`0008:35`),
`aktflow_service`, `aktflow_service_login` (`0034:25,28`); and optional
`pg_cron` scheduling. This inventory is derived from migrations, and is
independently corroborated by the live `pg_catalog` snapshot in
[`catalog-snapshots/20260731-2102.md`](../../migration/goproceed-canonical-v0.1/catalog-snapshots/20260731-2102.md)
(`## tables (33)`, `## functions (27)`). The verified baseline and its known
gaps are recorded separately in
[baseline verification](../../migration/goproceed-canonical-v0.1/baseline-verification.md).

The baseline is not the v0.1 model. In particular, only three baseline tables
currently have RLS; audit/idempotency access and outbox writes are not yet
tenant-safe; first-owner bootstrap is not fully serialized; future privileges
are not deny-by-default; and the outbox drain is not delivery.

### Approved v0.1 target

The target adds the identities required by the domain, including:

- workspaces, memberships, invitations, tenant-local parties, legal profiles,
  own-legal-entity profiles, contacts, projects, project parties, project
  access, and project responsibilities;
- contracts, immutable contract versions and work items, units, locations,
  import batches/files/row results, and source provenance;
- assignments, root progress measurements and adjustments, requirement
  templates/occurrences/exceptions, evidence identities/links, normalized
  review target sets, and internal review facts;
- stable packages, immutable versions, package scope heads, lines, claim-scope
  lineages, claim segments, source-allocation ledgers, artifacts, submissions,
  approval requirements, grants/sessions, terminal external decisions,
  decision coverage, and prior-acceptance references;
- operational idempotency, audit, outbox, jobs, attempts, dead letters,
  deliveries, and notifications.

Exact table splits belong to the target DDL and catalogs. A table may merge or
split only when identity, lifecycle, constraint, query, or retention behavior
justifies it. No receivable, invoice, payment, SaaS billing, support-access,
offline-sync, or statutory-accounting table belongs to v0.1.

## Schema and exposure boundaries

Use three explicit database boundaries:

- `public` contains canonical application tables while the additive migration
  is in progress. Direct grants remain allowlisted and every exposed
  tenant-owned relation is protected by ROW LEVEL SECURITY.
- `api` contains only reviewed views and command/query functions intended for
  the Data API. Configure the exposed-schema list to this allowlist when
  compatibility permits.
- `app_private` contains RLS helpers, invariant functions, and implementation
  details. It is never exposed through the Data API and grants no default
  `EXECUTE`.

Provider-owned schemas such as `auth` and `storage` are not application domain
schemas. Application migrations reference their documented interfaces without
assuming ownership of provider-managed tables.

## Canonical identity chain

### Common columns

Every tenant-owned table stores:

- `workspace_id uuid not null`;
- a stable primary identity such as `id uuid`;
- `created_at timestamptz not null`;
- the creating actor or command identity where provenance matters.

Mutable drafts and mutable coordination heads also store an optimistic
`version bigint not null`. Immutable facts use their fact identity and
append/supersession lineage instead of a mutable version.

Project-, contract-, package-, assignment-, or occurrence-scoped rows duplicate
the minimum ancestor identifiers needed to enforce their complete identity
chain. This is intentional denormalization for relational integrity, RLS, and
tenant-leading access paths.

### Tenant-safe composite foreign keys

An `id`-only foreign key is forbidden between tenant-owned aggregates. Every
referenced table exposes a tenant-leading candidate key, and every referencing
row uses a composite FK that contains the same tenant and required ancestors.

Minimum patterns:

```sql
unique (workspace_id, id)

foreign key (workspace_id, party_id)
  references public.parties (workspace_id, id)

unique (workspace_id, project_id, id)

foreign key (workspace_id, project_id, contract_id)
  references public.contracts (workspace_id, project_id, id)

unique (workspace_id, project_id, contract_id, package_id, id)

foreign key (
  workspace_id,
  project_id,
  contract_id,
  package_id,
  package_version_id
) references public.package_versions (
  workspace_id,
  project_id,
  contract_id,
  package_id,
  id
)
```

The full package-decision chain is:

```text
workspace
→ project
→ contract
→ package
→ package version
→ approval requirement
→ package line
→ claim segment or evidence/occurrence target
```

External decisions, decision coverage, and prior-acceptance references must use
candidate keys that prove the referenced decision belongs to that exact chain.
Independent foreign keys that merely prove each identifier exists are not
enough.

The same rule applies to:

- assignment → work item → published contract version;
- root progress adjustment → non-adjustment root → assignment/work item;
- evidence link → evidence object and requirement occurrence;
- review target item → immutable target set, occurrence, and exact
  evidence/link identity;
- claim source allocation → claim segment and root progress measurement;
- package grant/session/decision → exact current package version and pinned
  approval scope.

`auth.users.id` is a provider-global identity. It may be referenced as the
subject of a workspace membership, but it never replaces `workspace_id` in a
tenant-owned relation.

### Delete behavior

Use `restrict`/`no action` for published snapshots, facts, ledger movements,
decisions, grants/sessions, audit, and accepted reservations. Business history
is never erased by cascading from an editable parent.

`on delete cascade` is allowed only for a subordinate draft or ephemeral row
whose lifecycle and retention are identical to its parent. Every cascade must
be named in the target relationship catalog and covered by a deletion test.

## Workspace-leading indexes

Every tenant-scoped primary lookup, uniqueness rule, foreign-key lookup, RLS
predicate, queue, and lock acquisition has a workspace-leading index.

Rules:

1. Put `workspace_id` first.
2. Put equality ancestors next: `project_id`, `contract_id`, or aggregate ID.
3. Put state/equality filters before time or other range columns.
4. Put deterministic pagination/lock-order columns last.
5. Index the complete referencing side of every composite FK; PostgreSQL does
   not create foreign-key indexes automatically.
6. Use partial indexes for active/current/undelivered queues only when the query
   predicate exactly matches the index predicate.
7. Keep accepted/current uniqueness in constraints or partial unique indexes,
   not application-only checks.

Examples:

```sql
create index project_access_actor_idx
  on public.project_access_grants
    (workspace_id, member_id, project_id, valid_until);

create index progress_adjustments_root_idx
  on public.progress_entries
    (workspace_id, root_progress_entry_id, created_at, id)
  where entry_kind = 'adjustment';

create unique index package_scope_one_head_idx
  on public.package_scope_heads
    (workspace_id, project_id, contract_id, package_series_id, scope_key);

create index outbox_available_idx
  on public.transaction_outbox
    (workspace_id, available_at, id)
  where delivered_at is null;
```

Do not add a second non-leading convenience index unless a measured
cross-workspace administrative query requires it. v0.1 has no cross-tenant
support plane.

## Fact, snapshot, head, and projection rules

### Mutable working aggregates

Draft contract/package content and narrowly scoped coordination heads may be
updated with optimistic concurrency. A write includes the expected version and
must fail with a stale-state result when no row matches.

Head tables are rebuildable serialization aids, not business authority:

- progress allocation head;
- package scope/review head;
- segment-lineage head;
- internal review head;
- requirement exception head.

Only named transaction functions/commands may update heads. Clients receive no
direct `UPDATE` grant.

### Immutable snapshots

Published contract/template versions, frozen package versions, frozen package
contents, manifests, and artifact identities are immutable.

Enforce immutability with all three layers:

- no ordinary `UPDATE` or `DELETE` grants;
- database triggers that reject content mutation/deletion;
- checks/tests proving correction creates a successor instead.

Artifact storage keys contain immutable content identity and renderer/version
identity. A rerender never overwrites an earlier artifact.

### Append-only facts and ledgers

Progress roots/adjustments, requirement exceptions, evidence identities and
corrections, internal review decisions, package submissions, allocation ledger
movements, external decision batches/decisions/issues, decision coverage,
prior-acceptance references, and audit events append.

An append-only table:

- denies `UPDATE` and `DELETE` to application and worker roles;
- has a trigger rejecting mutation even if a grant is widened accidentally;
- carries command, actor, timestamp, and predecessor/root identity where
  required;
- corrects through a compensating/superseding fact, never an in-place edit.

Audit records command activity but never substitute for an absent domain fact.
Outbox rows describe delivery intent but never substitute for the transaction
that created the domain fact.

### Derived projections

Readiness, current package/review status, quantity acceptance, and VaR are
reconstructable projections. They are exposed through views or rebuildable
projection tables with source watermark and algorithm version.

Projection rows:

- are never writable by a member/external client;
- do not contain manual override fields;
- can be discarded and rebuilt from authoritative facts;
- preserve separate currency, net/tax/gross, missing/zero-price, and
  over-contract outcomes;
- map each effective exposure slice to exactly one workflow state.

## Numeric and temporal representation

- Canonical quantities use `numeric` with unit-pinned scale; binary floating
  point is forbidden.
- Canonical money uses signed integer minor units after the pinned
  work-item-version rounding policy. Store currency and tax basis alongside
  every monetary identity.
- Every child monetary row enforces `gross_minor_units =
  net_minor_units + tax_minor_units`.
- Timestamps are `timestamptz`; claimed capture time, server receipt time,
  submission time, and processing time remain separate columns.
- Hashes/verifiers are fixed-length `bytea` or strictly checked encodings with
  an algorithm/key identifier.
- Normalized business identifiers store both original display value and
  normalized comparison value where uniqueness depends on normalization.

## Required relational constraints

At minimum, the target DDL enforces:

- one active owner remains, and first-owner bootstrap is serialized;
- one own-legal-entity profile per workspace party;
- contract own party is an own legal entity in the same workspace;
- normalized contract number is unique within workspace and own party;
- published/frozen content cannot mutate;
- progress adjustment references one non-adjustment root in the same
  assignment/work item, and effective quantity cannot become negative;
- one normalized immutable review target-set identity for its exact item set;
- internal-review and requirement-exception successor lineages cannot fork;
- claim children and their source/minor-unit allocations reconcile to parent;
- `0 <= reserved_quantity <= effective_progress_quantity`;
- one current package version per package series/scope;
- terminal external decision uniqueness for the complete target tuple;
- a same-requirement decision cannot overlap an ancestor/descendant segment;
- prior acceptance is requirement-specific, tenant-safe, and unchanged-scope
  only;
- accepted reservations cannot be reduced or released in v0.1.

Checks that require several tables run inside the serialized command
transaction and are backed by the relevant head lock. A later asynchronous
validator may detect corruption, but it is not the primary enforcement.

## Transaction and lock contracts

### Global rules

- Acquire all locks in the documented global order:
  package-scope/review heads, segment-lineage heads, then progress-allocation
  heads; within each class order by `(workspace_id, id)`.
- Lock all affected rows before evaluating balances or current-head facts.
- Keep transactions short; do parsing, rendering, hashing, email, and other
  network/file work before or after the lock-holding transaction.
- Use expected head/version values plus database uniqueness, not
  read-then-write application checks.
- Record the authoritative facts, idempotency result, audit event, and outbox
  intents in the same commit.
- A retry with the same bounded idempotency key and request hash returns the
  same durable result; the same key with a different request fails.

### Command serialization matrix

| Command family | Required lock/constraint | Atomic outcome |
|---|---|---|
| Workspace bootstrap | Workspace/bootstrap key and membership uniqueness | Workspace plus exactly one initial owner or no result |
| Progress adjustment/allocation | Every affected root `progress_allocation_head`, stable order | Effective quantity and reservation invariant both hold |
| First package freeze | Empty `package_scope_head` plus affected allocation heads | Frozen snapshot becomes sole `current_prepared`; allocations activate |
| Candidate freeze | Package head/source expected versions | Immutable candidate only; no reservation or VaR effect |
| Package-head advance | Package head, affected segment heads, allocation heads | Old unaccepted reservation releases, accepted reservation remains, successor activates, epoch advances |
| Segment partition/quantity decision | Shared package/segment-lineage head and affected allocation heads | Children, source/minor-unit reconciliation, decision, and coverage facts commit together |
| Internal review/exception correction | Per-target head and expected version | One immutable successor; uniqueness prevents forks |
| External submit | Review epoch/head, target heads, terminal unique keys | One immutable batch/receipt; no same-version override |

Decision submission and partition must use the same segment-lineage
serialization point. If a decision commits first, partition derives descendant
coverage from it. If partition commits first, a decision against the old parent
fails with current leaves. No interleaving may lose coverage.

### Atomic corrected successor

A standalone negative adjustment fails when it would cross
`reserved_quantity`. A correction that reduces only returned or pending
reservation uses one atomic command; it cannot be implemented as
"adjustment first" or "successor first."

The command:

1. accepts a deterministic non-authoritative correction/package draft and
   expected source hashes;
2. locks the package-scope head, affected segment-lineage heads, and affected
   progress-allocation heads in global order;
3. revalidates source hashes, review epoch, correction delta, complete
   successor payload, and accepted floor;
4. releases only `current_unaccepted_reserved_quantity`;
5. appends the immutable adjustment and proves accepted reservation does not
   exceed new effective progress;
6. creates the frozen successor from that exact post-adjustment state;
7. activates successor allocations, re-proves the full reservation invariant,
   and installs the successor as `current_prepared`;
8. advances the review epoch, revokes old grants/sessions, and writes audit,
   idempotency, and outbox facts.

Any failure rolls back the release, adjustment, successor, allocation swap,
head, epoch, revocation, and outbox. Accepted reservations are never released
by this command.

## Additive migration rules

The v0.0 origin slice's six tables were hardened and evolved additively into
the current 33-table baseline, following these rules:

1. create new target tables/columns/constraints without renaming or dropping
   baseline objects;
2. backfill deterministic tenant and lineage keys with reconciliation reports;
3. add foreign keys as `not valid` where needed, then validate after backfill;
4. run tenant-isolation, uniqueness, reconciliation, and rollback tests;
5. dual-read or expose compatibility views for a bounded period;
6. switch writers only after invariant verification;
7. retire old columns/tables only under a separately approved destructive
   migration.

No documentation target authorizes destructive runtime cleanup.

## Verification requirements

Every schema slice must include:

- introspection proving every tenant-owned relation has `workspace_id`;
- a report for missing tenant-leading FK/RLS indexes;
- cross-workspace insert/update/reference denial tests;
- immutability and append-only mutation-denial tests;
- concurrent bootstrap, adjustment/allocation, partition/decision,
  head-advance, and corrected-successor tests;
- property tests for quantity and coupled monetary reconciliation;
- projection rebuild equivalence from the same source watermark;
- migration backfill/reconciliation and downgrade/forward-fix evidence.

## Implementation references

- [Canonical domain model](../domain/domain-model.md)
- [Execution, requirements, and evidence](../domain/execution-and-evidence.md)
- [Packages and acceptance](../domain/packages-and-acceptance.md)
- [Acceptance value at risk](../domain/value-at-risk.md)
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Supabase query optimization](https://supabase.com/docs/guides/database/query-optimization)
