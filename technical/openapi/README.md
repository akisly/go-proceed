# GoProceed v0.1 API scope

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-08-06

**Related decisions:** [ADR-001](../../docs/decisions/ADR-001-product-boundary.md),
[ADR-003](../../docs/decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-005](../../docs/decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../../docs/decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](../../docs/decisions/ADR-007-pilot-field-client.md)

## What this directory is

`scope-v0.1.csv` is the reviewed list of v0.1 BFF operations. It is the input
for the future `openapi-v0.1.yaml`; that spec, once written, becomes the public
API truth per the source-of-truth precedence in [docs/README.md](../../docs/README.md).
The legacy `technical/openapi.yaml` (157 operations) remains historical
reference only and is not the v0.1 contract.

`scope-v0.2.csv` carries the same columns for the operations the
[ADR-006](../../docs/decisions/ADR-006-pilot-shaped-v0.1.md) re-cut moved out of
v0.1. Nothing there is cancelled; a row in it is simply not in v0.1, and a
capability, event, or catalog row that names one as a v0.1 producer or a v0.1
permission is a defect in that catalog.

The scope lists **58 operations** in `scope-v0.1.csv`, with **22** more in
`scope-v0.2.csv` after the ADR-006 re-cut. The implementation plan estimated
35–45; the first overage was workflow completeness (invitation acceptance,
source-amount resolutions, upload receipt re-fetch, and the external
shell/exchange pair are listed explicitly instead of being folded into
neighbours). The second overage was the readiness gate:
[ADR-005](../../docs/decisions/ADR-005-readiness-gate-and-hidden-works.md) added
the gate operations, and ADR-006 then moved the commercial half of it — the
witness notice and its attendance outcome, internal review, packages, claim
segments and `commercial_decision` — into `scope-v0.2.csv`, leaving v0.1 with
requirement rule versions and their contract-version binding, occurrence
materialisation and its uncovered-line dry run, the evidence decision on an
occurrence, work stages with their closure, the blocked-reason read, statutory
act composition freeze and render, and the occurrence-scoped external grant with
its own scope and decision pair. There is **no bypass and no clearance in v0.1**
(ADR-006 decision 4). Operation count is an outcome, not a constraint — the same
rule the approved design applies to table count.

Eight operations are new with the re-cut and each serves a numbered ADR-006
step that had no route: `contract_versions.create`, `work_items.create`,
`work_items.update`, `work_items.remove` and `contract_versions.publish` are how
a baseline is typed by hand (decision 2); `requirement_occurrences.list` is how
the foreman sees what must be photographed; `statutory_acts.render` is how the
act becomes a document someone can hold; `blocked_value.get` is the money
screen. Two rule operations were renamed in place —
`requirement_rules.publish`/`.retire` became
`requirement_rule_versions.publish`/`.retire`, because ADR-006 decision 4.1
removes `requirement_rules` from v0.1 and a version can no longer be published
through a draft rule that does not exist. **Neither old id exists in either
scope CSV**, and a catalog still naming one is a defect against this file.

Nothing in this file is deployed. It is the reviewed v0.1 **target** surface;
the runtime baseline is recorded in
[docs/README.md](../../docs/README.md) and
[migration/goproceed-canonical-v0.1](../../migration/goproceed-canonical-v0.1/README.md).

## Conventions

- Errors are `application/problem+json` with catalog codes; `X-Request-Id` is
  optional but validated when present and echoed on every response.
- Every command (unsafe method) requires `Idempotency-Key` where the row says
  `required`; same key + same request hash replays the stored receipt, same key
  + different request returns `409 IDEMPOTENCY_CONFLICT`. Mutating commands on
  drafts/heads also carry the expected optimistic version and fail with a
  stale-state conflict.
- Auth planes:
  - `member` — Supabase Auth session/bearer via the BFF; server resolves
    membership, project access, and responsibility; the client never supplies a
    trusted `workspace_id` or role.
  - `external` — protected review session cookie obtained by the deliberate
    POST exchange; CSRF synchronizer token + origin checks on every state
    change.
  - `public` — unauthenticated same-origin shell only; performs no state
    change and can never consume a grant.
  - `service` — worker/service principals; not exposed to browsers.
- Contract owners: request/response schemas live in `packages/contracts`
  (target package name `@goproceed/contracts`); the external review plane uses
  its dedicated module noted as `@goproceed/contracts#external`. Storage
  staging PUT targets are provider-signed URLs, not part of this API.
- Reads marked `query` are safe/idempotent by construction. VaR/acceptance
  responses name every monetary field `*_net` / `*_tax` / `*_gross`; an
  unqualified `acceptance_var` field is forbidden (docs/domain/value-at-risk.md).
- **Every v0.1 operation is named by a capability row in
  [`technical/permissions/capabilities.csv`](../permissions/capabilities.csv),
  and an operation governed by no capability is an authorisation hole rather
  than a scope statement.** Three are deliberately outside that rule and are
  listed here so their absence is not read as an oversight: `me.context` is the
  caller's own resolved context and is governed by the session itself rather
  than by a capability; `external.review_shell` and `external.exchange` are
  `public`-plane rows that perform no state change and can never consume a
  grant, and are governed by INV-010, INV-044 and INV-057 instead. No other
  v0.1 row may be added without one.

## Columns of `scope-v0.1.csv`

`operation_id,method,path,kind,idempotency,auth_plane,request_contract_owner,response_contract_owner,milestone`

- `kind` — `command` or `query`.
- `idempotency` — `required` (Idempotency-Key header), `natural` (safe method),
  `single_use` (token exchange: one concurrent winner, replays get a generic
  invalid-link response).
- `milestone` — v0.1 internal milestone (**M0–M6**,
  [ADR-006](../../docs/decisions/ADR-006-pilot-shaped-v0.1.md) decision 3; M0
  has no row here because it adds no operation). **This column is authoritative
  here, not derived from the roadmap.** `scope-v0.1.csv` is precedence level 3
  in [docs/README.md](../../docs/README.md); `docs/product/roadmap.md` is level
  4 and follows this column. It named M1/M2/M3 for three gate elements this
  file dated M2/M3/M4; the roadmap was corrected to match on 2026-08-06, ADR-006
  then re-cut the milestone contents around those dates, and the same precedence
  rule decides any future disagreement.
  [`technical/database/entity-catalog.csv`](../database/entity-catalog.csv)
  carries the same column for entities and must agree with this one wherever
  both date the same slice. It is **not** a row-for-row mapping in either
  direction: the entity catalog is an inventory that additionally carries every
  table already deployed in an applied migration, and a deployed table is never
  tagged to a future version even when no numbered v0.1 step extends it
  (`docs/delivery/version-0.1.md` §"Operations and tables per milestone").
