# ADR-004: Version roadmap, product surfaces, and documentation

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](ADR-001-product-boundary.md),
[ADR-002](ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](ADR-003-evidence-packages-and-acceptance.md)

## Context

The earlier package mixed current runtime, prototypes, target design, and future
capabilities. Dates could appear as promises even though one founder working
with AI tools will close versions according to learning and implementation
evidence. The marketing landing and product demo also need separate,
non-ambiguous surfaces.

## Decision

### Version gates

GoProceed closes versions sequentially by acceptance criteria and evidence, not
by hard calendar commitments.

- **v0.0:** canonical documentation, foundation security, safe migration, and a
  reproducible green baseline.
- **v0.1:** complete online contract-to-acceptance-and-risk outcome.
- **v0.2:** pilot hardening, additional adapters and templates, onboarding,
  product analytics, isolated product demo, and at most the first AI-assist
  feature justified by observed pilot work.
- **v0.3:** full offline mobile authorization, local task access,
  synchronization, conflict handling, and resumable upload.
- **v0.4+:** Project Commercials as a subledger/export layer over finalized
  acceptance facts.
- **v1.0:** validated production workflow with verified security, restore,
  retention, monitoring, support, and operating constraints.

Actual work may complete faster or slower. A version moves only when its
acceptance gates are satisfied; no date silently changes its scope.

### v0.1 internal milestones

v0.1 is delivered as six vertical milestones:

1. M1 — parties, contracts, versions, and import;
2. M2 — assignments, progress, and online evidence;
3. M3 — requirements, internal review, and readiness;
4. M4 — immutable package generation;
5. M5 — protected external access and partial decisions;
6. M6 — value at risk and end-to-end pilot hardening.

Every milestone ends with tenant-isolation tests and a working vertical
scenario.

### Product surfaces

- `apps/landing` is a permanent, separately deployed marketing product.
- `apps/app` is the authenticated GoProceed product.
- The durable interactive product demo belongs to `apps/app` at `/demo`.
- A query switch such as `?demo=true` must not turn a real tenant session into
  demo mode.
- The demo uses isolated synthetic data and cannot write into customer tenant
  data.
- Initial deployments may use separate free Vercel domains.

Online mobile use is included in v0.1. It retains the local original until the
server confirms receipt and safely retries the whole upload. This is not full
offline mode; full offline belongs to v0.3.

### Documentation migration

Canonical work is built in the separate `GoProceed` worktree. The legacy tree
remains read-only until each source has a reviewed disposition.

Documentation authority follows [`docs/README.md`](../README.md):

1. applied migrations for actual database state;
2. approved canonical design for a target version;
3. OpenAPI for the public API;
4. product scope and roadmap for release contents;
5. ADRs for approved decisions;
6. legacy material as non-normative reference.

Every old source receives one explicit disposition: keep, rewrite, merge,
defer, archive, or delete only after confirmed transfer or explicit rejection.

## Discovery and claims

Lead lists, sends, replies, artifact access, interviews, named projects, and
pilot commitments are separate evidence stages. Lead or send count is not
demand validation. Product and landing copy may claim only what recorded
evidence supports.

## Consequences

- Roadmap versions are stable decision boundaries, not schedule promises.
- A visual prototype under `apps/demo` is not the permanent product demo
  architecture.
- Landing development does not force deployment of the authenticated app and
  vice versa.
- Legacy files can remain useful without competing with canonical authority.
- Cleanup is reversible and evidence-based; no unreviewed user work is deleted.

## Replacement rule

Moving a capability between versions, changing the `/demo` isolation model, or
changing documentation precedence requires a superseding ADR with explicit
scope, security, migration, and user-evidence consequences.
