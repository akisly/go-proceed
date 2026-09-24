# Data model architecture

**Status:** Approved

**Applies to:** v0.0 and v0.1

**Last reviewed:** 2026-08-06

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](../decisions/ADR-007-pilot-field-client.md)

## Purpose and authority

This document turns the approved [canonical domain model](../domain/domain-model.md)
into PostgreSQL implementation rules. It defines target invariants, key shapes,
index order, mutability boundaries, projection rules, and transaction/lock
contracts. It does not claim that the approved v0.1 target already exists.

Applied migrations remain authoritative for the database that exists today.
The target schema and later migrations must implement this document without
weakening the domain rules. Where an applied migration and this document
disagree about the shape of something that exists, the migration wins and this
document is corrected — that has happened repeatedly and is recorded below
rather than smoothed over.

**The version markers below follow the ADR-006 re-cut.**
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) fixes v0.1 at twenty-six
tables shaped around six pilot steps — twenty-three until the owner's decision of
2026-08-06 moved `requirement_exception_heads`,
`requirement_evidence_decision_heads` and `external_decision_batches` into v0.1
(decision 4, amendment note) — and moves packages, package versions,
package lines, claim segments and their lineage heads, the allocation ledger,
internal review, per-segment partial acceptance, decision coverage,
`commercial_decision`, `locations`, the seven-state
value-at-risk projection, the whole statutory notice apparatus, and the
closure-without-evidence bypass and its clearance to **v0.2**. What stays v0.2
around the decision batch is the commercial decision, the structured issues and
the coverage relation recorded against one; the batch row itself is v0.1-M5,
because `requirement_evidence_decisions` requires it on every externally
submitted decision (`technical/database/schema-v0.1.sql:1278-1283`). None of them is
cancelled and none of the rules below is weakened; each is stated against the
version it lands in. **Where a rule below names a package, a package version, a
claim segment, an allocation, an internal review, a witness notice, a location
node, or a closure-without-evidence and carries no marker, it is a v0.2 rule by
that fact alone.** Nothing in this document makes one of them a v0.1 obligation,
and a schema slice may not read an unmarked sentence as authority to build one.
[ADR-007](../decisions/ADR-007-pilot-field-client.md) changes nothing in this
document by design — its decision 3 forbids a client-specific column on an
evidence object, an upload intent, or a requirement occurrence, which is the one
thing a PWA could have tempted the schema into.

## Implementation status

### v0.0 origin slice: six tables (migrations 0001-0002)

Migrations `0001`-`0002` created exactly six application tables. The third column
records what has since been done to each, with the migration that did it.

| Current physical table | Current purpose | State today |
|---|---|---|
| `organizations` | Tenant root, with legal attributes duplicated from the first legal entity | RLS since `0004:3`; `SELECT`/`INSERT` only for `goproceed_app` after `0039:31` withdrew a table-wide `UPDATE` that RLS had made inert since `0004`. The duplicated legal attributes are not retired |
| `legal_entities` | Organization-local legal entity | RLS since `0004:4`; creation is governance-scoped (`0006:64-71`). Backfill into tenant-local party and own-legal-profile identities is target work |
| `memberships` | Membership with a mixed rigid role set | RLS since `0004:5`; four governance roles plus separate project access (`0010`) and responsibilities landed additively |
| `audit_events` | Command audit facts | RLS since `0006:23`; `SELECT` revoked from the app role outright (`0006:29`); append-only enforced by trigger (`0006:10-19`); `project_id` tenant-safe by composite FK since `0040:81-89` |
| `idempotency_records` | Command replay records | RLS since `0006:24`; actor-scoped read and write (`0006:50-59`); expiry and a scheduled purge since `0007`; since `0089` a record carrying a workspace is read only by an active member of it, and `withIdempotency` authorizes the caller before any replay (DEV-020) |
| `transaction_outbox` | Durable event intents | RLS since `0006:25`; INSERT tenant-bound and NULL-org-refusing (`0006:39-45`); claim/lease/retry/dead-letter protocol in `0008`. **No consumer** — see Current risks |

### What the chain is now

The migration chain in this repository runs to `0040`: 33 application tables,
one API view (`api.me_context`), 27 functions (22 in `app`, 5 in `public` —
counting distinct schema-qualified name plus argument-type list, surviving all
drops, including `SECURITY DEFINER` helpers and trigger functions), five
application roles — `goproceed_app` and `goproceed_app_login` (`0003:8,11`),
`goproceed_worker` (`0008:35`), `goproceed_service` and `goproceed_service_login`
(`0034:25,28`) — and optional `pg_cron` scheduling.

Migrations `0036`-`0040` add no table, no function, and no role. They retire the
outbox-drain schedule and its last non-superuser grant (`0036:40,53`), enable RLS
on the last table without it (`0037:37`), give the four purge functions a
principal other than the superuser (`0038:47-50`), withdraw the inert
`organizations` UPDATE grant (`0039:31`), and add the composite FK and partial
index on `audit_events.project_id` (`0040:47-49,81-89`).

**Read the catalog snapshot for what it can still prove, and no further.**
[`catalog-snapshots/20260731-2102.md`](../../migration/goproceed-canonical-v0.1/catalog-snapshots/20260731-2102.md)
independently corroborates the table and function counts — `## tables (33)`,
`## functions (27)` — and nothing after `0033`:

- its `## roles (6)` block lists `goproceed_app`, `goproceed_app_login`,
  `goproceed_worker`, `anon`, `authenticated`, and `service_role`. It contains no
  `goproceed_service`, so it corroborates **three** of the five application roles,
  not five;
- its `outbox_dead_letters` row still reads `"rowsecurity": false`, which
  `0037:37` changed;
- its `## cron_jobs (3)` block still lists `outbox-drain`, which `0036:40`
  unscheduled;
- it records no constraints at all, so it cannot speak to `0040`;
- its header reads `Source host: 127.0.0.1`.

### Correction of the previous baseline paragraph

An earlier revision of this section stated that "only three baseline tables
currently have RLS; audit/idempotency access and outbox writes are not yet
tenant-safe; first-owner bootstrap is not fully serialized; future privileges are
not deny-by-default; and the outbox drain is not delivery." Four of those five
claims were false when written, and the fifth is now obsolete. The paragraph
descended from
[baseline verification](../../migration/goproceed-canonical-v0.1/baseline-verification.md)
§"Confirmed runtime risks", which was written against `0001`-`0005` and never
updated; it is finding 7 of the
[package review](../delivery/package-review-2026-08-04.md).

| Former claim | Actual |
|---|---|
| Only three baseline tables have RLS | All 33 application tables have RLS enabled — the last was `outbox_dead_letters` at `0037:37`. None is `FORCE`d, deliberately (`0037:29-31`) |
| Audit/idempotency access and outbox writes are not tenant-safe | `0006:29-59` — audit `SELECT` revoked and INSERT membership-bound, outbox INSERT membership-bound with `organization_id is not null`, idempotency confined to `user:<actor>` |
| First-owner bootstrap is not fully serialized | `0006:78-83` — `app.org_has_members` takes `pg_advisory_xact_lock` before reading membership, so the losing claim blocks until the winner commits and then fails the policy |
| Future privileges are not deny-by-default | `0009:8,28-62` — `CREATE` revoked on `public`, and default privileges revoked for every creator role discovered from `pg_default_acl`, plus the global-scope function revoke. One residual the runner cannot alter remains (Current risks) |
| The outbox drain is not delivery | Correct at the time, and now stronger: the drain is retired (`0036:40,53`) because it could settle a row a leaseholder owned, and the lease protocol that replaced it has no consumer either |

### What has no tables

The second half of the v0.1 chain does not exist. Neither internal review,
packages, package versions, package lines, claim segments, external access
grants, external sessions, decision batches, acceptance, nor value at risk has a
table in any migration. Everything
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) introduces is
in the same position: requirement rules and rule versions, contract-version rule
bindings, the requirement library, work stages, stage closures, unevidenced
closures and clearances, witness notices, attendance outcomes, occurrence
evidence decisions, blocked reasons, and statutory acts.

What exists in that area is a nullable single-template pin
(`0015:85`), a published template whose `severity` CHECK and
`timing jsonb` are read by no application code (`0015:45-46`), and a placeholder
column whose table is explicitly deferred (`0015:251`). ADR-005 retires the first
two and replaces the model behind the third. Milestones M3-M6 are design in this
directory and in `technical/`, and nowhere else.

Nothing in this document has been executed to produce a number. `node_modules` is
absent from this worktree, so no test count and no baseline state is claimed
here.

### Approved target, and which version builds each part

The target adds the identities required by the domain. The v0.1 build list is
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4 —
twenty-six tables, of which seventeen are new build, amended 2026-08-06 from
twenty-three and fourteen by the owner's decision to move the two requirement
lineage heads and the external decision batch into v0.1 — and
[`entity-catalog.csv`](../../technical/database/entity-catalog.csv) is the
inventory. Everything below is approved; the marker says when it is built.

**v0.1:**

- workspaces, memberships, invitations, tenant-local parties, legal profiles,
  own-legal-entity profiles, contacts, projects, project parties, project
  access, and project responsibilities;
- contracts, immutable contract versions and work items, the units a manually
  entered work line needs, and — for the frozen importer already built — import
  batches/files/row results and source provenance;
- immutable requirement rule versions, contract-version rule bindings, and the
  shipped requirement library;
- assignments, work stages, root progress measurements and adjustments,
  requirement occurrences and exceptions, occurrence evidence decisions, the
  requirement exception head and the requirement evidence-decision head that
  serialise those two lineages, stage
  closures, evidence identities, and the blocked-reason and readiness
  projections — the evidence **link** as a many-to-many table is **v0.2**, and
  the v0.1 binding between an upload and its obligation is
  `upload_intents.requirement_occurrence_id`;
- statutory acts and immutable statutory act versions;
- occurrence-scoped external access grants, external sessions, and the external
  decision batch that carries the receipt, the confirmation-text version and the
  idempotency record for one external submit;
- operational idempotency, audit, outbox, jobs, attempts, dead letters,
  deliveries, and notifications.

**v0.2** ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5):

- workspace-authored requirement rules — in v0.1 the shipped library is the only
  rule source (decision 4.1);
- `locations` and everything keyed on a location node;
- witness notices, notice attendance outcomes, and the working-day notice
  calendar;
- unevidenced closures and their clearances — **there is no bypass in v0.1**;
- normalized review target sets and internal review facts;
- stable packages, immutable versions, package scope heads, lines, claim-scope
  lineages, claim segments, source-allocation ledgers, artifacts, submissions,
  approval requirements, package-scoped grants/sessions, terminal external
  commercial decisions, decision coverage, and prior-acceptance references;
- the seven-state value-at-risk projection.

Exact table splits belong to the target DDL and catalogs. A table may merge or
split only when identity, lifecycle, constraint, query, or retention behavior
justifies it. Requirement definition and requirement obligation are split for
exactly that reason: publication authority, lifecycle, and retention differ
between a rule version and an occurrence.

No receivable, invoice, payment, SaaS billing, support-access, offline-sync, or
statutory-accounting table belongs to v0.1. Blocked value is exposure, never a
receivable.

## Schema and exposure boundaries

Use three explicit database boundaries:

- `public` contains canonical application tables while the additive migration
  is in progress. Direct grants remain allowlisted and every exposed
  tenant-owned relation is protected by ROW LEVEL SECURITY.
- `api` contains only reviewed views and command/query functions intended for
  the Data API (`0003:38`). Configure the exposed-schema list to this allowlist
  when compatibility permits. One view exists today.
- `app` contains RLS helpers, invariant functions, and implementation details
  (`0003:34`). It is never exposed through the Data API and grants no default
  `EXECUTE`.

**Naming correction.** Earlier revisions of this document, and
`technical/database/schema-v0.1.sql`, called the private schema `app_private`.
No such schema exists and none is planned: helpers live in `app`, and `0016:7-9`
records the decision. Any new document, catalog, or migration that says
`app_private` is naming a schema that is not there.

Provider-owned schemas such as `auth`, `storage`, and `cron` are not application
domain schemas. Application migrations reference their documented interfaces
without assuming ownership of provider-managed tables, and guard for their
absence: `0036:35-46` checks `pg_extension` before touching `cron.job`, because
`pg_cron` may not exist locally and a migration must not fail when it does not.

## Canonical identity chain

### Common columns

Every tenant-owned table stores:

- `workspace_id uuid not null`;
- a stable primary identity such as `id uuid`;
- `created_at timestamptz not null`;
- the creating actor or command identity where provenance matters.

**One naming split is real and permanent until a destructive migration retires
it.** The six origin tables spell the tenant column `organization_id`; every
table created from `0010` onward spells it `workspace_id`. The two names refer to
the same tenant root, and `0040:19-22` states that explicitly while joining
across the boundary. New tables use `workspace_id`. A constraint that spans the
boundary names both columns and says which is which, rather than aliasing one
into the other.

Mutable drafts and mutable coordination heads also store an optimistic
`version bigint not null`. Immutable facts use their fact identity and
append/supersession lineage instead of a mutable version.

Project-, contract-, package-, assignment-, stage-, or occurrence-scoped rows
duplicate the minimum ancestor identifiers needed to enforce their complete
identity chain. This is intentional denormalization for relational integrity,
RLS, and tenant-leading access paths.

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

This is delivered practice, not aspiration, for every table from `0010` onward:
`public.projects` and its siblings declare `unique (workspace_id, id)` precisely
so referencing rows can carry the tenant with them.

**The delivered worked example is `0040`,** and it is worth reading before
writing the next one. `0002:5-14` created `audit_events.project_id` with no FK
because `public.projects` did not exist yet, and left an instruction naming the
exact `ALTER` for whichever future migration created it. `0010` created the table
and did not run it. Thirty migrations later the column was still an unvalidated
uuid that could name a project in another tenant. Three rules come out of that:

- **the single-column ALTER left behind in an old migration is usually the wrong
  one.** `0002`'s instruction said `references public.projects(id)`, which admits
  a tenant-A audit row citing a tenant-B project. `0040:81-86` carries the tenant:
  `foreign key (organization_id, project_id) references public.projects
  (workspace_id, id)`;
- **`MATCH SIMPLE` is a decision, not a default to accept silently.** It is
  required here because `project_id` is nullable and most audit rows have none; a
  row with a NULL in any referencing column satisfies the constraint. `MATCH
  FULL` would reject every workspace-scoped audit row (`0040:24-28`). Any
  composite FK with a nullable ancestor states which match semantics it needs and
  why;
- **check for orphans before the constraint, not inside it.** `0040:53-75` counts
  rows that name a project outside their own tenant and raises with the exact
  query to list them, because a constraint violation names one row and an
  append-only table cannot be repaired by UPDATE.

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

ADR-005 adds four chains, each of which must be composite-key enforced rather
than checked in application code
([domain-model.md](../domain/domain-model.md) §Cross-boundary reference rule):

- **requirement instantiation** — published contract version → contract-version
  rule binding → requirement rule version → work item → assignment →
  requirement occurrence. An occurrence that cannot resolve this chain has no
  agreed basis and must not exist, so `rule_version_id` is part of the
  occurrence's key material, never a live foreign key to a mutable rule;
- **stage closure** — assignment → work stage → stage closure → the exact
  occurrences evaluated at that instant → statutory act version. The unevidenced
  closure is a v0.2 alternative head of the same chain, not a v0.1 one;
- **package eligibility — v0.2** — claim segment → covered assignments →
  applicable occurrences whose `blocking_scope` is `blocks_package_inclusion` or
  `blocks_both` → their satisfaction facts → any unevidenced closure covering the
  scope and its clearance → the current internal review head. Every link in this
  chain moves to v0.2 with packages, segments, the bypass and internal review;
- **occurrence-scoped external grant** — assignment → requirement occurrence →
  external access grant → external session → occurrence evidence decision. The
  grant's scope kind is part of its key, so a session cannot be resolved against
  the wrong scope kind at read time.

`auth.users.id` is a provider-global identity. It may be referenced as the
subject of a workspace membership, but it never replaces `workspace_id` in a
tenant-owned relation.

### Delete behavior

Use `restrict`/`no action` for published snapshots, facts, ledger movements,
decisions, grants/sessions, audit, stage closures, unevidenced closures,
clearances, statutory act versions, and accepted reservations. Business history
is never erased by cascading from an editable parent.

**A referential action may never be declared against a table protected by an
append-only trigger.** `ON DELETE CASCADE` and `ON DELETE SET NULL` have to
DELETE or UPDATE the referencing row; on `audit_events` that fires the
`BEFORE UPDATE OR DELETE` trigger of `0006:17-19` and raises at run time instead
of at review time (`0040:30-36`). `NO ACTION` is the correct choice, and its
consequence — a project cited by audit cannot be deleted — is the intended
behavior for an accountability record. Every ADR-005 append-only table inherits
this rule.

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
   not create foreign-key indexes automatically, and it only requires a unique
   index on the *referenced* side.
6. Use partial indexes for active/current/undelivered queues only when the query
   predicate exactly matches the index predicate.
7. Keep accepted/current uniqueness in constraints or partial unique indexes,
   not application-only checks.

Target examples:

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

create index occurrence_blocking_idx
  on public.requirement_occurrences
    (workspace_id, project_id, work_assignment_id, blocking_scope, id)
  where blocking_scope <> 'none';
```

Two deployed indexes are worth quoting exactly, because both differ from what an
illustrative example would have guessed:

```sql
-- 0002:66-68 — the outbox queue index. The column is processed_at, not
-- delivered_at; nothing in this database has a delivered_at.
create index if not exists transaction_outbox_unprocessed_idx
  on public.transaction_outbox (available_at)
  where processed_at is null;

-- 0040:47-49 — not required by the constraint (projects already declares
-- unique (workspace_id, id)); it serves the delete-time check on projects,
-- which without it scans audit_events. Partial, because the large majority of
-- audit rows carry no project and would only bloat it.
create index if not exists audit_events_project_idx
  on public.audit_events (organization_id, project_id)
  where project_id is not null;
```

The outbox index is tenant-trailing rather than tenant-leading, which is a known
deviation from rule 1: the queue is claimed cross-tenant by a worker, not read
per tenant by a member. Any index that omits the tenant lead says why, in the
migration.

Do not add a second non-leading convenience index unless a measured
cross-workspace administrative query requires it. v0.1 has no cross-tenant
support plane.

## Fact, snapshot, head, and projection rules

### Mutable working aggregates

Draft contract/package content and narrowly scoped coordination heads may be
updated with optimistic concurrency. A write includes the expected version and
must fail with a stale-state result when no row matches.

Head tables are rebuildable serialization aids, not business authority:

- requirement exception head — **v0.1**;
- requirement evidence-decision head — **v0.1**;
- progress allocation head — **deployed** (`0015:167`), carried at `v0.1-M2` in
  [`entity-catalog.csv`](../../technical/database/entity-catalog.csv). What moves
  to v0.2 is the allocation-ledger **work**, never the row: ADR-006 decision 4
  forbids tagging a deployed table to a future version, because a `v0.2` marker
  on a table that exists in the runtime asserts something false about the world;
- package scope/review head — **v0.2**;
- segment-lineage head — **v0.2**;
- internal review head — **v0.2**.

**Resolved 2026-08-06 by the owner.** INV-035 is P0 and says a lineage without a
head row cannot enforce root uniqueness and that none may be added without one.
`requirement_exceptions` and `requirement_evidence_decisions` are v0.1-M3 build
targets, and until 2026-08-06 their heads sat in v0.2 — so `can_close_stage`,
the one predicate v0.1 ships, read two lineages v0.1 could not serialise. The
owner moved both heads into v0.1-M3 rather than amend INV-035
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4, amendment
note), and [`entity-catalog.csv`](../../technical/database/entity-catalog.csv)
now carries both at `v0.1-M3`. The two `v0.1` markers above state what the
catalog carries and what the invariant requires, and they agree.

Only named transaction functions/commands may update heads. Clients receive no
direct `UPDATE` grant. `0039:20-25` is the governing precedent for how such a
grant is introduced when one is finally needed: a column-scoped `UPDATE` grant,
its policy, and its capability arrive in one migration — never the policy alone,
and never a table-wide grant ahead of the policy that scopes it.

### Immutable snapshots

Published contract/template versions, published requirement rule versions,
frozen package versions, frozen package contents, manifests, statutory act
versions, and artifact identities are immutable.

Enforce immutability with all three layers:

- no ordinary `UPDATE` or `DELETE` grants;
- database triggers that reject content mutation/deletion;
- checks/tests proving correction creates a successor instead.

Requirement rule versions publish and retire only. A retirement is a state
change on the rule's lineage, not an edit to published content, and an
occurrence stores `rule_version_id` rather than a live foreign key so that
retiring a rule can never rewrite what an occurrence was agreed to require.

Artifact storage keys contain immutable content identity and renderer/version
identity. A rerender never overwrites an earlier artifact.

**A statutory act version is pinned by the stage closure that produced it**
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4.5). ADR-005
decision 10 pinned it to the package version that carries it; in v0.1 there are
no package versions, so the closure is the pin, and in v0.2 the package version
pins it additionally. **A migration is owed to v0.2** that pins every act
version written during the pilot to the package version that comes to carry it,
with a test that fails if a v0.1 row is left behind.

### Append-only facts and ledgers

Progress roots/adjustments, requirement exceptions, witness notices, notice
attendance outcomes, occurrence evidence decisions, stage closures, unevidenced
closures, unevidenced-closure clearances, evidence identities and corrections,
internal review decisions, package submissions, allocation ledger movements,
external decision batches/decisions/issues, decision coverage, prior-acceptance
references, and audit events append.

An append-only table:

- denies `UPDATE` and `DELETE` to application and worker roles;
- has a trigger rejecting mutation even if a grant is widened accidentally —
  `app.reject_mutation` (`0006:10-15`) is the delivered implementation, and it
  raises for the table owner too;
- carries command, actor, timestamp, and predecessor/root identity where
  required;
- corrects through a compensating/superseding fact, never an in-place edit;
- declares no referential action that would UPDATE or DELETE one of its rows.

Two ADR-005 facts have an extra rule each. **Both are v0.2**: the
closure-without-evidence bypass and its clearance move with packages
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4 —
"**There is no bypass in v0.1**"), because the bypass's price is package
ineligibility and a version with no packages has no money to make wait. The
rules are unchanged and are stated here against v0.2:

- **an unevidenced closure freezes the exact set of unmet occurrence identities
  at the moment of bypass.** That set is stored, not recomputed. Later
  satisfaction of those occurrences must not be able to rewrite what was unmet
  when the bypass was taken;
- **a clearance never deletes, edits, or hides the bypass it clears.** It is a
  separate append-only fact that restores eligibility while the bypass remains
  readable and remains printable in the frozen manifest appendix.

The v0.1 escape is the ADR-005 exception instead — `waiver` and `accept_risk`
recorded by an authorised actor, attributed and visible, with `not_applicable`
still refused on a `hold` by the exception command itself. No schema rule may
supply a v0.1 substitute for the bypass, and no command may filter where
ADR-005 says refuse.

`TRUNCATE` fires neither an `UPDATE` nor a `DELETE` trigger, and RLS does not
gate it. An append-only table therefore also needs its `TRUNCATE` privilege
withheld; migration `0058` (2026-08-18) revoked it from `service_role`, `anon` and
`authenticated` on every table in `public`, and from their default privileges *[corrected 2026-09-14 (DEV-006): this said it was not yet true of `outbox_dead_letters`, as recorded in `TODOS.md`]*.

Audit records command activity but never substitutes for an absent domain fact.
Under ADR-005 this is sharper: a stage closure, a bypass, and a clearance are
domain facts with their own tables. An audit row must never be the only record
that a gate was bypassed. Outbox rows describe delivery intent but never
substitute for the transaction that created the domain fact.

### Derived projections

Readiness, eligibility, blocked reasons, current package/review status, quantity
acceptance, and VaR are reconstructable projections. They are exposed through
views or rebuildable projection tables with source watermark and algorithm
version.

Projection rows:

- are never writable by a member/external client;
- do not contain manual override fields;
- can be discarded and rebuilt from authoritative facts;
- preserve separate currency, net/tax/gross, missing/zero-price, and
  over-contract outcomes;
- map each effective exposure slice to exactly one workflow state — **v0.2**,
  with the seven-state value-at-risk projection
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5). v0.1's
  blocked-money figure is a sum over `blocked_reasons` and `work_items`, broken
  down by `blocked_reason.code` and attributed once per assignment, not a state
  machine over states that cannot occur.

**Readiness is now also a precondition, and that does not change its kind**
(ADR-005 decision 7). It remains recomputed and remains unwritable. What changes
is what refuses: `can_close_stage(s)` gates recorded stage closure and
`is_package_eligible(segment)` gates package freeze. **v0.1 ships
`can_close_stage` and not `is_package_eligible`**, which moves to v0.2 with
packages and with internal review's part in `satisfied(o)`
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5). The
predicates are written out in [domain-model.md](../domain/domain-model.md)
§Readiness and blocking and are testable as written.

Three storage consequences follow:

- **a blocked reason is a stored-shape object, not a rendered string.** It
  carries `requirement_occurrence_id`, `rule_version_id`, `missing_evidence[]`
  by `evidence_kind` and `acceptance_criterion`, `awaiting_approver_role`,
  `since`, `blocked_value_by_currency`, and a `code` from a closed versioned
  vocabulary. An unknown code is a projection error, never a free label.
  **That vocabulary is enumerated in
  [`state-catalog.csv`](../../technical/states/state-catalog.csv) rows 112-118**,
  transcribed there on 2026-08-06 as a `blocked_reason.code` `stored_vocabulary`
  machine: all seven values, with `NOTICE_PERIOD_NOT_ELAPSED` and
  `CLOSED_WITHOUT_ACT` marked unreachable in v0.1. Closing and versioning it was
  an M3 entry condition and it is met. The **bypass** reason-code vocabulary is
  the one still unenumerated (`state-catalog.csv:119`, an explicit
  `NOT_ENUMERATED` gap row). Codes named in passing elsewhere are examples, not a closed
  set. Closing and versioning it is an M3 entry condition, and no schema slice
  may treat it as already closed;
- **blocked value deduplicates by assignment.** Several unmet occurrences on one
  work reference the same assignment-scoped value, so the projection sums
  distinct assignments and not distinct occurrences. Getting this wrong inflates
  the headline number by a factor equal to the number of requirements per work;
- **freeze reads the projection but does not trust a cached row.** The
  eligibility evaluation at freeze happens inside the serialized command
  transaction against authoritative facts, under the locks below. A projection
  table is a reporting convenience; it is never the thing that decides a refusal.

## Numeric and temporal representation

- Canonical quantities use `numeric` with unit-pinned scale; binary floating
  point is forbidden.
- Canonical money uses signed integer minor units after the pinned
  work-item-version rounding policy. Store currency and tax basis alongside
  every monetary identity.
- Every child monetary row enforces `gross_minor_units =
  net_minor_units + tax_minor_units`.
- `blocked_value_by_currency` follows the same rules and is stored per currency.
  There is no cross-currency total, in storage or in a render.
- Timestamps are `timestamptz`; claimed capture time, server receipt time,
  submission time, and processing time remain separate columns.
- A witness notice stores server `sent_at`, the configured `required_notice`
  duration, and a **server-computed** `earliest_proceed_at`. No client supplies
  that value. **The witness notice does not exist in v0.1**: the notice event,
  its attendance outcome, the notice-period setting and the whole statutory
  notice apparatus are v0.2, and `witness` moves with them
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decisions 4.3 and 5).
  The rule above binds v0.2, where the duration starts as a workspace setting in
  calendar time that must not be stored, labelled, or rendered as the
  five-working-day rule; the Ukrainian working-day calendar follows it
  (ADR-005 decision 3). No v0.1 document, screen, or migration may describe a
  notice period.
- Hashes/verifiers are fixed-length `bytea` or strictly checked encodings with
  an algorithm/key identifier.
- Normalized business identifiers store both original display value and
  normalized comparison value where uniqueness depends on normalization.
- Every regulatory string stores its `verification` tag and its source
  alongside the text, in the data. A string without both must be unrenderable by
  construction, so a contributor cannot add an unsourced line by editing a
  template ([hidden-works-content-rules.md](../product/hidden-works-content-rules.md)).

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

ADR-005 adds these, and each is a database constraint or a command-level refusal
with a test, never a convention:

- `intervention_type ∈ {hold, witness, review}` and `blocking_scope ∈ {none,
  blocks_stage_closure, blocks_package_inclusion, blocks_both}` are stored
  values under CHECK constraints, never words interpreted at read time. **Both
  CHECKs keep all their values in v0.1**, so v0.2 is additive and no v0.1 record
  is reinterpreted; what narrows is the publication command, below. The
  degradation of `timing` from a five-value CHECK to `jsonb not null default
  '{}'` with no constraint (`0015:45-46`) is the failure mode to avoid;
- **the rule-version publication command rejects any `intervention_type` other
  than `hold`, and rejects a `hold` whose `blocking_scope` is anything other
  than `blocks_stage_closure`**
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decisions 4.3 and 4.4).
  ADR-005 decision 4 required `blocks_both`; in v0.1 the other half of `both`
  has nothing to block, because there are no packages. `witness` needs the
  notice event and `review`'s only blocking scope is package inclusion, so both
  move to v0.2 with the objects they depend on. **A migration is owed to v0.2**
  that widens every `hold` written during v0.1 from `blocks_stage_closure` to
  `blocks_both`, with a test that fails if one is left behind: without it every
  requirement recorded during the pilot sits permanently outside the
  payment-eligibility half of the gate and nobody would notice. Each of these
  two refusals needs an invariant of its own in
  [`invariant-catalog.csv`](../../technical/database/invariant-catalog.csv);
  neither has one today, and INV-066 still states the ADR-005 form;
- a `hold` occurrence can never carry a `not_applicable` exception. The
  exception command refuses it; waiver and accept-risk remain available and
  remain visible;
- an occurrence pins exactly one `rule_version_id` and materialises
  `intervention_type`, `blocking_scope`, `evidence_kind`,
  `acceptance_criterion`, `norm_ref`, `performer_role`, and `approver_role` from
  it;
- at most one current closure lineage exists per work stage; double-covering the
  same stage is unrepresentable, and a correction appends a superseding closure
  referencing its predecessor;
- **v0.2** — an unevidenced closure requires a non-null reason code — whose
  vocabulary is not yet enumerated and is therefore not a closed set — a claimed
  authority, an expected remedy, and a non-empty frozen unmet set;
- **v0.2** — a clearance references exactly one unevidenced closure and names
  substitute evidence; its author is not the author of the bypass;
- a statutory act version exists only as a by-product of a stage closure whose
  applicable requirements are satisfied, and **no column, view, or render carries
  a free-text quantity**. The composer references `quantity_entries` already
  recorded against the line, with a share selector;
- an external access grant carries exactly one scope kind — one package version
  or one requirement occurrence — and its constraints make holding both
  unrepresentable rather than merely invalid. **v0.1 issues the
  occurrence-scoped kind only**, because it has no package versions; the scope
  kind is nevertheless part of the grant's key from the first migration, so
  adding the package kind in v0.2 is additive.

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
  network/file work before or after the lock-holding transaction. Act rendering
  and manifest rendering are outside the lock; the facts they read are pinned
  inside it.
- Use expected head/version values plus database uniqueness, not
  read-then-write application checks.
- Record the authoritative facts, idempotency result, audit event, and outbox
  intents in the same commit.
- A retry with the same bounded idempotency key and request hash returns the
  same durable result; the same key with a different request fails. The request
  hash covers the command's target (its path parameters) and its body, since
  DEV-022, so the same key on another target fails too.

### Command serialization matrix

| Command family | Required lock/constraint | Atomic outcome |
|---|---|---|
| Workspace bootstrap | Workspace/bootstrap key and membership uniqueness | Workspace plus exactly one initial owner or no result |
| Requirement instantiation | Assignment identity plus the contract version's rule binding | Every occurrence the bound rule versions yield, or none; the dry run reports uncovered lines and the command fails closed without it |
| Progress adjustment/allocation | Every affected root `progress_allocation_head`, stable order | Effective quantity and reservation invariant both hold |
| Stage closure | The stage's closure lineage plus every applicable occurrence's current satisfaction facts | One append-only closure and, where the stage is concealed and satisfied, one draft statutory act version — or a refusal naming the unmet occurrences |
| Requirement-exception correction | Per-target head and expected version | One immutable successor; uniqueness prevents forks |
| Occurrence evidence decision | The occurrence's `(workspace, occurrence, approver_role)` decision head and its expected version | One append-only accepting or returning decision, its head advance, and — when the submit came through an external session — the immutable `external_decision_batches` row the CHECK at `technical/database/schema-v0.1.sql:1278-1283` requires; eligibility recomputes, and no money moves |
| Unevidenced closure — **v0.2** | The same lock set as stage closure | Closure fact, frozen unmet set, and the resulting ineligibility of every covering claim segment commit together |
| Unevidenced-closure clearance — **v0.2** | The bypass fact plus the affected segments' eligibility inputs | Clearance appended and eligibility restored, with the bypass unchanged and still visible |
| First package freeze — **v0.2** | Empty `package_scope_head` plus affected allocation heads, and the eligibility evaluation for every candidate segment | Frozen snapshot becomes sole `current_prepared`; allocations activate — or a per-segment refusal with sums included and excluded by currency |
| Candidate freeze — **v0.2** | Package head/source expected versions | Immutable candidate only; no reservation or VaR effect |
| Package-head advance — **v0.2** | Package head, affected segment heads, allocation heads | Old unaccepted reservation releases, accepted reservation remains, successor activates, epoch advances |
| Segment partition/commercial decision — **v0.2** | Shared package/segment-lineage head and affected allocation heads | Children, source/minor-unit reconciliation, decision, and coverage facts commit together |
| Internal review correction — **v0.2** | Per-target head and expected version | One immutable successor; uniqueness prevents forks |
| Package-scoped external submit — **v0.2** | Review epoch/head, target heads, terminal unique keys | One immutable batch/receipt covering commercial and package-scoped evidence targets; no same-version override |

Every row marked **v0.2** requires an object
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5 moved out of
v0.1. The v0.1 external decision is the occurrence evidence decision above,
submitted through an occurrence-scoped session. It **does** write one immutable
batch — `external_decision_batches` entered v0.1-M5 on 2026-08-06 by owner
decision (ADR-006 decision 4, amendment note) and the decision CHECK admits an
externally submitted decision only with one — in the exclusive occurrence arc of
INV-074. What it has no part of is coverage, the structured issue rows and
`commercial_decision`.

Decision submission and partition must use the same segment-lineage
serialization point. If a decision commits first, partition derives descendant
coverage from it. If partition commits first, a decision against the old parent
fails with current leaves. No interleaving may lose coverage.

Freeze evaluates eligibility inside the same transaction that takes the package
and allocation head locks. Evaluating it before the lock would let an occurrence
be returned, or a bypass be recorded, between the check and the freeze.

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
   successor payload, accepted floor, and the eligibility of every segment the
   successor will carry;
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
by this command. An ineligible segment produces the named eligibility refusal of
step 3, not a stale-source conflict.

## Additive migration rules

The v0.0 origin slice's six tables were hardened and evolved additively into the
current 33-table baseline across 40 migrations, following these rules:

1. create new target tables/columns/constraints without renaming or dropping
   baseline objects;
2. backfill deterministic tenant and lineage keys with reconciliation reports;
3. add foreign keys as `not valid` where needed, then validate after backfill;
4. run tenant-isolation, uniqueness, reconciliation, and rollback tests;
5. dual-read or expose compatibility views for a bounded period;
6. switch writers only after invariant verification;
7. retire old columns/tables only under a separately approved destructive
   migration.

Rule 3 has a delivered worked example in `0040:77-89`, and the reasoning matters
more than the syntax: `ADD CONSTRAINT … NOT VALID` takes `SHARE ROW EXCLUSIVE`
briefly and skips the scan; `VALIDATE CONSTRAINT` then runs under `SHARE UPDATE
EXCLUSIVE`, which does not block concurrent inserts. On an environment where the
table has grown large, the `VALIDATE` goes in its own migration so it commits
alone.

Four further conventions are now established by `0036`-`0040` and should be kept:

- **every migration states what it does not do.** `0038:29-32` says in its own
  header that granting the purge functions does not make the purge work;
  `0036:20-23` says the drain function is kept rather than dropped, and why;
- **every migration carries an executable rollback in a comment**, including the
  case where the rollback restores something equally inert (`0039:27-29`);
- **a migration never restores a grant it identified as unintended.** `0038:39-40`
  says so explicitly for the `anon`/`authenticated` execute that `0021` failed to
  strip;
- **a table comment records a non-obvious posture** so the next reader does not
  "fix" it: RLS with no policy (`0037:44-49`), a deliberately narrow grant set
  (`0039:33-40`), and a retired function (`0036:55-62`).

No documentation target authorizes destructive runtime cleanup.

## Current risks

Open items as of this revision, each cited to the file that decides it. None is a
stale pre-`0006` bullet; those claims are retracted in Implementation status
above.

1. **The `supabase_admin` default-ACL residual cannot be closed by a
   migration.** `0009:21-27` records why: the migration runner (`postgres`) is
   not a superuser on Supabase and cannot alter another role's default
   privileges. The catalog snapshot shows the exact shape — `postgres`'s three
   `public`-schema entries carry no `anon`/`authenticated`, while
   `supabase_admin`'s three still grant both on tables, sequences, and functions
   (`catalog-snapshots/20260731-2102.md`, `## default_acls (31)`). It applies
   only to objects `supabase_admin` itself creates in `public`, and user
   migrations never run as `supabase_admin`; the control is detection through
   `scripts/snapshot-db-catalog.mjs`, not prevention.
2. **The outbox has no consumer.** `0036:40` unscheduled the drain and `0036:53`
   revoked its last non-superuser grant, removing a sweep that could mark a row
   processed while a correct consumer held a live lease on it (`0036:14-18`).
   Nothing replaced it: `app.claim_outbox` / `app.complete_outbox` /
   `app.fail_outbox` (`0008:42-58`, `:60`) have no deployed caller, so committed
   outbox rows stay unprocessed indefinitely. Every rule in this document about
   committing facts and outbox intents together still holds; what does not happen
   is anything downstream of the commit.
3. **Artifact rendering, projection rebuilding, and scheduled maintenance have no
   principal.** No role, no login credential, and no runtime exists for any of
   the three; the two surviving `pg_cron` jobs (`0007:45`, `0021:132`) run as the
   scheduling superuser. Nothing in the projection rules above is executed by
   anything today.
4. **Catalog snapshots cover the local stack only, so staging and production
   drift is unverified.** Every file in
   `migration/goproceed-canonical-v0.1/catalog-snapshots/` records `Source host:
   127.0.0.1`, and the newest predates `0034`. No snapshot in the repository
   corroborates `0034`-`0040` on any environment, and none records constraints at
   all, so `0040`'s foreign key is unverified outside the migration text.
   *[2026-09-24, DEV-071: only the database ACL (INV-116) is now compared on
   `goproceed-staging`, `infra/README-staging.md` §2.3.]*
5. **The purge worker's byte-deleting half is wired to no runtime.**
   `0038:29-32` is explicit that the grants do not make the purge work: marking
   an intent expired is scheduled (`0021:132`), but deleting the bytes needs
   storage credentials and a runner that does not exist. Storage is never
   reclaimed. `0038`'s change is that a future runner need not be a superuser.

## Verification requirements

Every schema slice must include:

- introspection proving every tenant-owned relation has a tenant column, and
  naming which of `workspace_id` / `organization_id` it uses;
- a report for missing tenant-leading FK/RLS indexes;
- cross-workspace insert/update/reference denial tests, including a composite FK
  test that inserts a valid-but-foreign ancestor id and expects a constraint
  violation rather than an application error;
- immutability and append-only mutation-denial tests, exercised as the table
  owner as well as the application role;
- concurrent bootstrap, adjustment/allocation, partition/decision,
  head-advance, and corrected-successor tests;
- property tests for quantity and coupled monetary reconciliation;
- projection rebuild equivalence from the same source watermark;
- migration backfill/reconciliation and downgrade/forward-fix evidence.

The ADR-005 slices additionally need, in the v0.1 shape ADR-006 gives them:

- a rule version whose `intervention_type` is `witness` or `review` **rejected
  at publication**, and a `hold` rule version with
  `blocking_scope <> 'blocks_stage_closure'` rejected at publication
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decisions 4.3 and 4.4).
  A test written against the ADR-005 `blocks_both` form would pin the wrong
  refusal and pass while the v0.1 command was wrong;
- a contract version with no bound rule-version set **refused at publication**
  (ADR-006 decision 3). This refusal has no invariant of its own today and needs
  one;
- a `not_applicable` exception on a `hold` occurrence rejected by the command,
  with `waiver` and `accept_risk` still accepted from an authorised actor and
  visible afterwards;
- a stage closure refused when `can_close_stage` is false, with the refusal
  carrying the requirement, the missing evidence, the owed role, and the money;
- blocked value summed across several unmet occurrences on one assignment,
  proving deduplication by assignment;
- an occurrence-scoped grant proven unable to resolve a package version;
- a render test proving no statutory act surface exposes a free-text quantity
  field, and that a regulatory string without a `verification` tag and source
  cannot be rendered at all.

Deferred with the objects they test, to **v0.2**: package freeze refused for
ineligible scope and distinguishable from a stale-source conflict; an
unevidenced closure whose frozen unmet set is unchanged after its occurrences
are later satisfied; a clearance attempted by the bypass author, refused; and a
package-scoped grant proven unable to resolve an occurrence.

## Implementation references

- [Canonical domain model](../domain/domain-model.md)
- [Execution, requirements, and evidence](../domain/execution-and-evidence.md)
- [Packages and acceptance](../domain/packages-and-acceptance.md)
- [Acceptance value at risk](../domain/value-at-risk.md)
- [Tenancy and security architecture](tenancy-and-security.md)
- [Hidden-works content rules](../product/hidden-works-content-rules.md)
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL: ALTER TABLE, NOT VALID and VALIDATE CONSTRAINT](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Supabase query optimization](https://supabase.com/docs/guides/database/query-optimization)
