# ADR-002: Tenancy, parties, projects, and contracts

**Status:** Approved

**Applies to:** v0.0 and v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](ADR-001-product-boundary.md),
[ADR-003](ADR-003-evidence-packages-and-acceptance.md)

## Context

The existing foundation duplicates the first enterprise's official name and
registration number on the workspace. Legacy target documents also mix
workspace roles, construction job titles, free-text counterparties, legal
entities, and project access. That breaks down when one workspace manages
contracts for several of its own legal entities.

## Decision

### Workspace

A workspace is the tenant, governance, and default access boundary. It owns
product settings such as display name, branding, timezone, locale, lifecycle
state, and an optional default own-party reference.

The workspace does not authoritatively store one enterprise's official name,
EDRPOU, VAT attributes, or legal address.

### Tenant-local parties

Business participants are tenant-local. GoProceed does not use a global
cross-customer company registry.

- `parties` identifies an organization or participant within one workspace.
- `party_legal_profiles` stores official name, registration number such as
  EDRPOU, tax attributes, and legal address.
- `own_legal_entity_profiles` marks the parties the workspace is authorized to
  act for and applies stricter completeness and edit permissions.
- `party_contacts` stores people associated with a party.

The same real-world company may therefore have separate records in different
workspaces. Published contract and package versions preserve immutable party
snapshots so later profile corrections do not rewrite history.

### Projects, relationships, and access

A project represents a construction object. It is not owned by exactly one
legal entity. One project may contain contracts of different workspace-owned
legal entities.

Technical supervision, general contractor, designer, customer, performer, and
other participants are modeled as project relationships. A relationship does
not itself grant application access.

Workspace governance roles are:

- `owner`;
- `admin`;
- `member`;
- `auditor`.

Project visibility grants and time-bounded responsibility assignments are
separate. Construction titles such as foreman, PTO engineer, or estimator are
UI presets, not governance roles. One person may combine responsibilities in
v0.1; the system records a separation-of-duties warning rather than blocking
the workflow.

### Contracts and packages

Every contract:

- belongs to exactly one workspace and one project;
- identifies exactly one workspace-owned party;
- identifies exactly one customer party;
- pins party, currency, tax, terms, and approval-policy snapshots when
  published;
- versions its acceptance-relevant work baseline.

Contract number uniqueness is scoped at least by workspace-owned party plus
normalized contract number.

Every evidence package belongs to exactly one contract. Its version pins the
contract version used. Package lines, evidence, grants, sessions, and decisions
cannot cross workspace, project, contract, or package-version boundaries.

## Required invariants

- a relation never joins records from different workspaces;
- a contract cannot select another workspace's own party;
- an own-party profile is unique for a party within its workspace;
- project participation and project access are independent;
- a package cannot contain work from another contract;
- published party and contract snapshots are immutable;
- tenant-leading indexes support every tenant-scoped constraint and lookup.

## Migration consequences

The existing workspace and legal-entity tables are retained during v0.0
hardening. Official attributes move only through an additive, backfilled,
verified migration with a compatibility period. No destructive rename or field
removal is authorized by this ADR alone.

## Rejected alternatives

- **One legal entity per workspace:** rejected because the user requires
  several own legal entities.
- **Legal entity selected on project:** rejected because one project may contain
  contracts belonging to different own parties.
- **Global company registry:** rejected because it creates cross-tenant
  identity, privacy, merge, and authorization problems without v0.1 value.
- **One global membership role for all work:** rejected because governance,
  project access, and construction responsibility are different concerns.
