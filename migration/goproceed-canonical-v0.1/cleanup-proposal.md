# Cleanup proposal

**Status:** Proposed — awaiting explicit user approval of exact paths

**Applies to:** documentation migration
**Last reviewed:** 2026-07-30

Nothing in this proposal has been moved or deleted. Per the migration
principle, deletion happens only after the user approves the exact paths
below. The authoritative per-source mapping is
[document-disposition.csv](document-disposition.csv).

## 1. Propose: archive (move under `docs/legacy/` in one reviewed commit)

Historical evidence, no active authority. 13 sources:

- `docs/02-market-competition.md`
- `docs/16-fidelity-ledger.md`
- `docs/29-prototype-coverage.md`
- `docs/37-functional-closure-feature-register.md`
- `docs/38-business-logic-closure.md`
- `docs/39-evidence-graph.md`
- `ARCHITECTURE-AUDIT-ANSWERS.md`
- `CHANGELOG-ARCH-AUDIT-20260724.md`
- `CHANGELOG-AUDIT-FIX-20260723.md`
- `CHANGELOG-PRODUCTION-READINESS-20260724.md`
- `design-qa.md`
- `design-qa/` (2 tracked files)
- `technical/implementation-backlog.csv`

Archiving keeps the files in git under a legacy path; it is reversible.

## 2. Propose: delete after transfer (requires explicit approval)

Machine-generated reports reproducible from source. 2 files:

- `technical/openapi-redocly-report.txt`
- `technical/sql-parser-report.txt`

## 3. Deferred manual review (old tree only — never copied)

Uncommitted paths in the read-only comparison tree
(`aktflow-product-package 2`). The user decides their future; GoProceed takes
no action:

- old-tree `.agents/` (201 paths) — user work
- old-tree `.claude/` (22 paths) — user tooling state
- old-tree modified `apps/` files (7) and `docs/` files (4)
- old-tree `.gitignore`, `AGENTS.md`, `migration/` artifact, `skills-lock.json`

## 4. Preserve as runtime or user work (no action ever proposed)

- Runtime: `supabase/`, `apps/app/`, `apps/landing/`, `packages/`,
  `scripts/`, root manifests (`package.json`, `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`,
  `.editorconfig`, `.gitignore`, `.github/workflows/ci.yml`, `Makefile`,
  `infra/README-staging.md`).
- Runtime-cited legacy references (keep until v0.0 re-points references, then
  re-propose): `docs/22-data-api-contract.md`, `technical/schema.sql`,
  `technical/openapi.yaml`, `technical/error-catalog.csv`,
  `technical/data-access-surface.csv`.
- Reference material: `prototype/`, `apps/demo/`, `design-references/`,
  `.interface-design/` (per-file dispositions inside `prototype/` deferred to
  a later reviewed pass; CI still validates the package contract).
- User work in the canonical tree, preserved untracked, never staged:
  `.agents/`, `skills-lock.json`.
- Numbered docs marked `defer` in the disposition matrix (25 sources) stay in
  place unchanged until their named later-version owner exists.

## Approval protocol

1. The user names which of sections 1–2 to execute (all, subset, or none).
2. Archive moves land as one commit with `git mv` so history follows.
3. Deletions land as a separate commit listing each exact path.
4. `validate:canonical-docs` and the CI package validator must stay green
   after each commit.
