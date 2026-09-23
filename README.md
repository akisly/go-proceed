# GoProceed

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-08-06

**Related decisions:** [ADR-001](docs/decisions/ADR-001-product-boundary.md),
[ADR-004](docs/decisions/ADR-004-roadmap-demo-and-documentation.md),
[ADR-005](docs/decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](docs/decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](docs/decisions/ADR-007-pilot-field-client.md)

GoProceed helps specialist construction teams make performed work ready for
acceptance. The **approved target design** is the whole chain: contract baseline
→ assignment and performed quantity → requirements and evidence → internal
review → immutable package → protected external decision → partial acceptance
and derived value at risk.

**v0.1 is not that chain.**
[ADR-006](docs/decisions/ADR-006-pilot-shaped-v0.1.md) decision 1 cuts v0.1 to
six steps a subcontractor can use unaided — an object with hand-typed work lines
and its loaded requirements; the phone that shows what must be photographed
before covering; the refused stage closure; the act by the form of Додаток В;
the personal link a технагляд decides in with no account; and the blocked-money
screen. Internal review, packages, claim segments, partial acceptance and the
value-at-risk projection are **v0.2**
([docs/delivery/version-0.2.md](docs/delivery/version-0.2.md)). v0.1 blocks
stage closure; it does not block payment-presentation eligibility, and no
demonstration may show a payment-presentation refusal that does not exist.

## Actual state (do not overclaim)

- **Product name is GoProceed, and the runtime identifiers now agree.** The
  workspace package identifiers say `@goproceed/*`; the user-visible copy moved
  2026-08-10; the five PostgreSQL roles moved 2026-08-17 (migration `0057`);
  and the domains, the Chrome-path env var, the pilot draft's localStorage key
  and the catalog identifiers followed. `scripts/validate-canonical-docs.mjs`
  fails the build if any of them comes back.
  *This bullet said the roles and the copy «have not moved, and each is its own
  later slice» until 2026-08-18 — in the section headed «do not overclaim»,
  which is exactly where a stale claim does the most damage. What remains is
  the historical v2.9 package below, which keeps the old name on purpose.*
- **The runtime was a 33-table foundation when it was last counted**, on the
  migration chain through `0040`. Later migrations exist and have not been
  re-counted; the latest one is recorded in [docs/STATUS.md](docs/STATUS.md).
  At that count, the v0.0 origin slice had named six
  tables (`organizations`, `legal_entities`, `memberships`, `audit_events`,
  `idempotency_records`, `transaction_outbox`), and the chain had grown
  additively to add one API view (`api.me_context`), 27 functions (22 in
  `app`, 5 in `public`; counting distinct schema-qualified name plus
  argument-type list, surviving all drops), and five database roles.
  *[Changed 2026-09-13 (DEV-004): this bullet stated the `0040` count as the
  runtime today.]*
- **Part of the v0.1 domain is implemented; the rest is not, and the re-cut
  moved the line.** 19 of the first 40 migrations name a v0.1 milestone: 4 name
  `v0.1-M1`, 16 name `v0.1-M2-A`, and one names `v0.1-M3`. Those sets overlap in
  two files — `0023` names M1 and M2-A, and `0015` names M2-A and M3 — which is
  why 4 + 16 + 1 counts 19 files and not 21. `0015`'s two `v0.1-M3` mentions are
  inline comments rather than its header, and it creates no M3 table; a header
  names an owning milestone, not delivery. Together they build the
  workspace-access, contract-baseline and execution/evidence modules.
  **Seventeen of the twenty-six v0.1 tables have no table in any applied
  migration, and after
  [ADR-006](docs/decisions/ADR-006-pilot-shaped-v0.1.md) decision 4 they run
  from M1, not from M3**: requirement rule versions, requirement library items
  and contract-version rule bindings (M1); requirement occurrences (M2); work
  stages, stage closures, evidence decisions, exceptions, the exception head,
  the evidence-decision head, readiness and blocked reasons (M3); statutory acts
  and act versions (M4); external access grants, external sessions and external
  decision batches (M5). The two heads and the decision batch entered v0.1 on
  2026-08-06 by owner decision, moving the build list from 23 to 26 and the new
  build from 14 to 17. No milestone boundary now separates built from unbuilt.
  Evidence links, internal review, packages, package lines, claim segments,
  acceptance and value at risk have no tables either and are
  **v0.2**. See
  [package review 2026-08-04](docs/delivery/package-review-2026-08-04.md).
- **No baseline state is claimed on this branch.** The last recorded run is
  dated 2026-07-30 — 196 tests / 31 files, zero failures
  ([baseline verification](migration/goproceed-canonical-v0.1/baseline-verification.md)) —
  and it predates migrations `0036`–`0040`, the new
  `packages/testing/src/review-fixes-0036-0040.test.ts` suite, and the
  `vitest.workspace.ts` correction that added `packages/contracts` and
  `packages/domain`. `node_modules` is absent from this worktree, so nothing
  here has been executed to produce a current number. The 143/165 figure
  earlier in that same file is the historical starting point, not a later
  state. v0.0 does not formally close until staging/production role-password
  verification is recorded ([version-0.0.md](docs/delivery/version-0.0.md)).
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
| Delivery gates: v0.0, v0.1 M0–M7, v0.2 transfer record, tests, readiness | [docs/delivery/](docs/delivery/) |
| Discovery evidence (honest counts) | [docs/discovery/](docs/discovery/) |
| Decisions | [docs/decisions/](docs/decisions/) + [decision register](migration/goproceed-canonical-v0.1/decision-register.md) |
| Machine-readable v0.1 target contracts | [technical/database/](technical/database/), [technical/openapi/](technical/openapi/), [technical/permissions/](technical/permissions/), [technical/states/](technical/states/), [technical/events/](technical/events/), [technical/templates/](technical/templates/) |
| Migration ledger and legacy dispositions | [migration/goproceed-canonical-v0.1/](migration/goproceed-canonical-v0.1/) |

Validate the package at any time:

```bash
pnpm validate:canonical-docs
```

## Product surfaces

As of 2026-08-20 ([ADR-009](docs/decisions/ADR-009-three-pilot-surfaces.md)),
GoProceed is architected as three separately-deployed pilot surfaces, not one:

- `apps/landing` — permanent separate marketing product/deployment, as a
  second Vercel project.
- `apps/app` — the system: the `/v1` BFF and, later, the office
  dashboard UI-minimum (create workspace/project + access grants; create
  assignment; view photo evidence); the durable isolated `/demo` arrives
  inside it in v0.2.
- `apps/mobile` — the field client's codebase, for the person taking photos.
  It is Expo/React Native, shipped as **Expo-web for the pilot** and native
  later from the same codebase
  ([ADR-009](docs/decisions/ADR-009-three-pilot-surfaces.md) decision 2), and
  will deploy as its own, third, Vercel project once the Expo-web client
  ships.

**Transition state, in force now:** the **v0.1 field client is still a PWA
served from `apps/app`**, behind the same BFF boundary as the web product
([ADR-007](docs/decisions/ADR-007-pilot-field-client.md) decision 1). Its
capture is online-only and a pending original is **not durable**. `apps/app`'s
field pages retire **only after** the Expo-web client in `apps/mobile` passes
its parity checklist, measured on two physical phones
([ADR-009](docs/decisions/ADR-009-three-pilot-surfaces.md) «The parity gate»).
Until that measurement, `apps/mobile` is not on the pilot's *live* path even
though it is now the field client's codebase — the pilot is never blocked on
the migration.

*[2026-09-23, DEV-035 — no longer in force. The owner retired the PWA before
the parity gate («удали все что в (app)», «Удалить сейчас»): `apps/app`'s field
pages are gone and the office dashboard is its root (`/`; old `/dash/**`
addresses redirect). The field client is `apps/mobile`'s Expo client, deployed
as a web export at Vercel project `goproceed-field` (observed serving on
2026-09-23); the Telegram project channel is built but not yet enabled. See
[ADR-009](docs/decisions/ADR-009-three-pilot-surfaces.md) «Amendment,
2026-09-23».]*

`apps/demo` and `prototype/` were the legacy reference material and are
**gone** — `prototype/` on 2026-08-19, `apps/demo` on 2026-08-20. Neither
was a product surface; the durable `/demo` named above arrives inside
`apps/app`, which is what makes the standalone one redundant rather than
missing. Their history is in git if a screen ever needs to be recovered.

## Next executable milestone

**v0.0 foundation hardening** per [docs/delivery/version-0.0.md](docs/delivery/version-0.0.md):
environment/build policy, green baseline, tenant isolation for
audit/idempotency/outbox, serialized bootstrap, deny-by-default grants,
seed-credential safety, and migration safety rails. v0.1 **M0–M7** follow per
[docs/delivery/version-0.1.md](docs/delivery/version-0.1.md); M0 is the
cross-cutting minimum that makes the environment fit to hold someone else's
data, and **M6 cannot open until M0 is closed**.

## Toolchain

Node `>=24 <25`, pnpm `9.12.0`, Supabase CLI for the local stack. The legacy
Makefile drives the prototype package validator used by CI.
