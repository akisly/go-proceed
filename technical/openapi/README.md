# GoProceed v0.1 API scope

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](../../docs/decisions/ADR-001-product-boundary.md),
[ADR-003](../../docs/decisions/ADR-003-evidence-packages-and-acceptance.md)

## What this directory is

`scope-v0.1.csv` is the reviewed list of v0.1 BFF operations. It is the input
for the future `openapi-v0.1.yaml`; that spec, once written, becomes the public
API truth per the source-of-truth precedence in [docs/README.md](../../docs/README.md).
The legacy `technical/openapi.yaml` (157 operations) remains historical
reference only and is not the v0.1 contract.

The scope lists 51 operations. The implementation plan estimated 35–45; the
overage is workflow completeness (invitation acceptance, source-amount
resolutions, upload receipt re-fetch, and the external shell/exchange pair are
listed explicitly instead of being folded into neighbours). Operation count is
an outcome, not a constraint — the same rule the approved design applies to
table count.

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

## Columns of `scope-v0.1.csv`

`operation_id,method,path,kind,idempotency,auth_plane,request_contract_owner,response_contract_owner,milestone`

- `kind` — `command` or `query`.
- `idempotency` — `required` (Idempotency-Key header), `natural` (safe method),
  `single_use` (token exchange: one concurrent winner, replays get a generic
  invalid-link response).
- `milestone` — v0.1 internal milestone (M1–M6) from
  [docs/product/roadmap.md](../../docs/product/roadmap.md).
