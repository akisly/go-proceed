# GoProceed canonical-package migration ledger

**Status:** Active migration evidence

**Applies to:** v0.0 and v0.1 documentation rebuild
**Last reviewed:** 2026-07-30

## Purpose

This directory proves how the mixed AktFlow package is converted into the
canonical GoProceed package without silently losing user work, deployed runtime,
or useful historical evidence.

## Source coordinates

| Item | Value |
|---|---|
| Read-only comparison source | `../aktflow-product-package 2` |
| Comparison-source branch | `main` |
| Comparison-source HEAD | `e578243ced66a7aecb74a8704728b0f29eb5f49e` |
| Canonical worktree | `.` |
| Canonical branch | `codex/goproceed-canonical` |
| Worktree base commit | `e578243ced66a7aecb74a8704728b0f29eb5f49e` |
| Approved design commit | `1ce4e51` |
| Outreach workbook | `../aktflow_ukraine_leads_50_demo_outreach_2026-07-28.xlsx` |
| Ledger date | 2026-07-30 |

Paths are resolved from the canonical repository root. This keeps the
coordinates reproducible without committing a machine-local username. In the
inventory, the same locations use stable root identifiers: `canonical`,
`legacy`, and `external_outreach_workbook`.

The old comparison source is read-only throughout this plan. Its modified and
untracked files are inventoried but never copied automatically.

## Files

- `baseline-verification.md` — verified runtime, repository, dependency, and test baseline.
- `source-inventory.csv` — every tracked file at the approved canonical head,
  every user-added canonical tooling file confirmed during migration, and every
  modified or untracked old-tree path.
- `decision-register.md` — approved product and architecture decisions.
- `conflict-register.md` — contradictions that the canonical package must resolve.
- `transfer-checklist.md` — non-destructive promotion gates.

## Classification

Every source is classified as one of:

- `runtime`;
- `active_documentation`;
- `machine_contract`;
- `prototype`;
- `infrastructure`;
- `historical`;
- `tooling`.

This inventory is descriptive. Final `keep / rewrite / merge / defer / archive /
delete_after_transfer` disposition is recorded later in
`document-disposition.csv`.

## Review units

The inventory remains file-complete for preservation. For later disposition
review, vendored tooling is grouped without losing its file-level rows.

The 220 canonical `.agents/**` files added and confirmed by the user on
2026-07-30 form one protected tooling unit:

- review unit: `vendor_agents_canonical`;
- source prefix: `canonical:.agents/`;
- content-manifest SHA-256:
  `869d2a25d2ce8412c7928cf4b83f86984dd00b6d05eeeccac73399cd62359f06`;
- lock file: `canonical:skills-lock.json`;
- lock-file SHA-256:
  `3cb3fa21814ad47ae48278aa26144be04d7024d71e0f00c3f4f10e960f342fee`;
- disposition: preserve as user-added canonical tooling.

The 201 uncommitted legacy `.agents/**` files form a separate review unit:

- review unit: `vendor_agents_legacy`;
- source prefix: `legacy:.agents/`;
- inventory-manifest SHA-256:
  `29c6bbc4fdf8b535127354f229f1881dc145960db3ca436c98cad64fcbec7a34`;
- disposition: pending explicit vendor-unit review; the files are not
  automatically transferred.

All non-vendored rows remain individually reviewable.

## Safety rules

1. Applied migrations are evidence of actual DB state.
2. `technical/schema.sql` is a legacy target, not deployed state.
3. Uncommitted old-tree files are user work until proven otherwise.
4. No old file is deleted before reviewed disposition.
5. No runtime table is renamed or dropped during documentation migration.
6. Legacy content never overrides the approved canonical design.
