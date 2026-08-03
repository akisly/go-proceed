# GoProceed

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-08-03

**Related decisions:** [ADR-001](docs/decisions/ADR-001-product-boundary.md),
[ADR-004](docs/decisions/ADR-004-roadmap-demo-and-documentation.md)

GoProceed helps specialist construction teams make performed work ready for
acceptance: contract baseline → assignment and performed quantity →
requirements and evidence → internal review → immutable package → protected
external decision → partial acceptance and derived value at risk.

## Actual state (do not overclaim)

- **Product name is GoProceed.** `AktFlow` survives only as legacy history and
  in not-yet-renamed runtime identifiers (a v0.0 item).
- **The runtime today is a 33-table foundation**, defined by 35
  `supabase/migrations/` through `0035`. Its v0.0 origin slice named six
  tables (`organizations`, `legal_entities`, `memberships`, `audit_events`,
  `idempotency_records`, `transaction_outbox`); the chain has since grown
  additively to add one API view (`api.me_context`), 27 functions (22 in
  `app`, 5 in `public`; counting distinct schema-qualified name plus
  argument-type list, surviving all drops), and five database roles.
  Nothing of the v0.1 domain is implemented yet.
- **The baseline is not green.** As recorded in
  [baseline verification](migration/goproceed-canonical-v0.1/baseline-verification.md):
  143/165 tests passed; failures are dominated by the unavailable local
  database, three demo suites with a broken `@/lib/utils` import, and an
  undecided pnpm build-script policy.
- **The old AktFlow v2.9 target package is historical.** Its 126-table /
  157-operation model is not the implementation baseline; every legacy source
  has an explicit disposition in
  [document-disposition.csv](migration/goproceed-canonical-v0.1/document-disposition.csv).

## Canonical documentation

Source-of-truth precedence lives in [docs/README.md](docs/README.md). In short:
applied migrations → approved canonical design → OpenAPI → version scope →
ADRs → legacy (non-normative).

| Area | Where |
|---|---|
| Product: vision, scope, personas, roadmap | [docs/product/](docs/product/) |
| Domain: glossary, model, evidence, packages, VaR | [docs/domain/](docs/domain/) |
| Architecture: system, data, security, storage, jobs | [docs/architecture/](docs/architecture/) |
| Delivery gates: v0.0, v0.1 M1–M6, tests, readiness | [docs/delivery/](docs/delivery/) |
| Discovery evidence (honest counts) | [docs/discovery/](docs/discovery/) |
| Decisions | [docs/decisions/](docs/decisions/) + [decision register](migration/goproceed-canonical-v0.1/decision-register.md) |
| Machine-readable v0.1 target contracts | [technical/database/](technical/database/), [technical/openapi/](technical/openapi/), [technical/permissions/](technical/permissions/), [technical/states/](technical/states/), [technical/events/](technical/events/), [technical/templates/](technical/templates/) |
| Migration ledger and legacy dispositions | [migration/goproceed-canonical-v0.1/](migration/goproceed-canonical-v0.1/) |

Validate the package at any time:

```bash
pnpm validate:canonical-docs
```

## Product surfaces

- `apps/landing` — permanent separate marketing product/deployment.
- `apps/app` — the web product and BFF; the durable isolated `/demo` arrives
  inside it in v0.2.
- `apps/mobile` — approved Expo/React Native iOS/Android field client;
  online-only in v0.1, full offline in v0.3.
- `apps/demo`, `prototype/` — legacy reference material, not product surfaces.

## Next executable milestone

**v0.0 foundation hardening** per [docs/delivery/version-0.0.md](docs/delivery/version-0.0.md):
environment/build policy, green baseline, tenant isolation for
audit/idempotency/outbox, serialized bootstrap, deny-by-default grants,
seed-credential safety, and migration safety rails. v0.1 M1–M6 follow per
[docs/delivery/version-0.1.md](docs/delivery/version-0.1.md).

## Toolchain

Node `>=24 <25`, pnpm `9.12.0`, Supabase CLI for the local stack. The legacy
Makefile drives the prototype package validator used by CI.
