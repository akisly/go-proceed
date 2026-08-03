# GoProceed documentation

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-08-03

**Related decisions:** [ADR-001](decisions/ADR-001-product-boundary.md),
[ADR-002](decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](decisions/ADR-004-roadmap-demo-and-documentation.md)

## Purpose

This directory is the canonical reader entry point for GoProceed. It separates
what exists now, what is approved for a target version, what belongs to a
release, and what is retained only as historical evidence.

No document is authoritative merely because it is detailed. Authority comes
from its type, status, applicable version, and the precedence below.

## Source of truth

When sources disagree, use this precedence for the specific question:

1. **Actual database:** applied migrations are the source of truth for objects,
   constraints, grants, policies, and data transformations that the repository
   can prove are deployed. A live catalog comparison is still required to
   detect environment drift.
2. **Target version design:** approved canonical domain, architecture, and
   database design are the source of truth for what a named target version must
   become. Target design never pretends to be deployed state.
3. **Public API:** the canonical OpenAPI contract is the source of truth for
   supported public routes, inputs, outputs, errors, and authentication.
4. **Release contents:** product scope and the version roadmap are the source of
   truth for what is included in, deferred from, and required to close a
   version.
5. **Approved decisions:** ADRs are the source of truth for why a boundary or
   architecture choice was approved and what would be required to replace it.
6. **Legacy material:** files marked Historical or located under `docs/legacy`
   are non-normative reference. They may supply evidence or rationale but may
   not override an active source.

If two sources at the same level conflict, delivery stops for that slice until
the conflict is recorded and resolved by an ADR or an explicit correction to
the authoritative artifact.

## Status meanings

- **Approved:** agreed design or policy; implementation may still be pending.
- **Draft:** under review and not an implementation authority.
- **Implemented:** verified against the actual runtime or operating process.
- **Historical:** preserved evidence; non-normative.

`Approved` does not mean deployed. Implementation status belongs in delivery
evidence and migration verification.

## Required metadata

Every active Markdown document starts with:

```markdown
**Status:** Approved | Draft | Implemented | Historical

**Applies to:** v0.0 | v0.1 | v0.2+ | all

**Last reviewed:** YYYY-MM-DD

**Related decisions:** ADR links or None
```

Documents must name exact versions. `Future`, `later`, and similar language is
allowed only when accompanied by the owning roadmap version or an explicit
uncommitted research label.

## Canonical structure

| Area | Purpose | Authority |
|---|---|---|
| `product/` | Vision, scope, actors, workflows, roadmap | Release contents |
| `domain/` | Terms, roles, entities, invariants, calculations | Target domain design |
| `architecture/` | Runtime boundary, tenancy, security, imports, files | Target architecture |
| `delivery/` | Milestones, acceptance gates, tests, rollout | Execution evidence |
| `discovery/` | Leads, sends, replies, interviews, pilot evidence | Market evidence only |
| `decisions/` | Approved trade-offs and supersession rules | Decision authority |
| `legacy/` | How historical material may be used | Non-normative reference |
| `../technical/` | Database, API, permissions, states, events, templates | Machine-facing target contracts |
| `../migration/` | Source inventory, conflicts, dispositions, transfer gates | Migration evidence |

The current legacy files under `technical/*` do not become canonical merely
because this structure reserves that location. Each replacement remains
non-normative until it has canonical metadata or a machine-readable version
declaration, is scoped to a named target version, passes its validator, and is
marked Approved. In particular, the existing legacy `technical/openapi.yaml`,
`technical/schema.sql`, and CSV catalogs are not v0.1 implementation authority.

## Change control

1. A scope change starts by updating the relevant ADR or adding a new one.
2. Approved product and domain documents are updated before implementation
   planning.
3. Machine-facing contracts are updated before or with implementation.
4. Applied migrations remain append-only history; corrections use new
   migrations.
5. Version closure requires acceptance evidence, not a target date.
6. Historical sources are never silently edited into appearing canonical.

## Current baseline

The implemented foundation represented by repository migrations contains 33
tables, one API view (`api.me_context`), 27 functions (22 in `app`, 5 in
`public` — counting distinct schema-qualified name plus argument-type list,
surviving all drops), and five database roles, defined by 35 migrations
through `0035`. GoProceed v0.1 is an approved target, not the current
runtime. The reproducible baseline and known gaps are recorded in
[`migration/goproceed-canonical-v0.1`](../migration/goproceed-canonical-v0.1/README.md).
