# Architecture decision records

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-09-13

**Related decisions:** every ADR listed below

This is the index of the active ADR series. `scripts/validate-canonical-docs.mjs` fails when a file in this directory is missing from the table, when a row names a file that does not exist, or when a row's Status differs from the file's own `**Status:**` line.

The lifecycle and the approval procedure are in [docs/README.md](../README.md) («ADR lifecycle and approval»). In short: an agent drafts an ADR as `Proposed`; it becomes `Approved` only by the owner's dated ruling, recorded in the ADR, in a pull request the owner merges.

«Added» is the date of the commit that added the file (`git log --diff-filter=A`). «Last reviewed» is the file's own metadata. Neither is the approval date; where an ADR records its approval, the ADR says so.

| ADR | Title | Status | Added | Last reviewed | Supersedes / amends |
|---|---|---|---|---|---|
| [ADR-001](ADR-001-product-boundary.md) | GoProceed v0.1 product boundary | Approved | 2026-07-30 | 2026-07-30 | — |
| [ADR-002](ADR-002-tenancy-parties-and-contracts.md) | Tenancy, parties, projects, and contracts | Approved | 2026-07-30 | 2026-07-30 | — |
| [ADR-003](ADR-003-evidence-packages-and-acceptance.md) | Evidence packages and acceptance authority | Approved | 2026-07-30 | 2026-07-30 | — |
| [ADR-004](ADR-004-roadmap-demo-and-documentation.md) | Version roadmap, product surfaces, and documentation | Approved | 2026-07-30 | 2026-07-30 | — |
| [ADR-005](ADR-005-readiness-gate-and-hidden-works.md) | The readiness gate and hidden works | Approved | 2026-08-08 | 2026-08-08 | Amends ADR-001; supersedes nothing |
| [ADR-006](ADR-006-pilot-shaped-v0.1.md) | A pilot-shaped v0.1 | Approved | 2026-08-08 | 2026-08-08 | Amends ADR-001's v0.1 boundary (the second time); supersedes ADR-004's milestone structure; ADR-001 and ADR-005 stand |
| [ADR-007](ADR-007-pilot-field-client.md) | The pilot field client is a PWA | Approved | 2026-08-08 | 2026-09-03 | Amends ADR-004; amended by ADR-009 (2026-08-20) and ADR-011 decision 11 (2026-09-03) |
| [ADR-008](ADR-008-valuation-carves-at-admission.md) | Valuation carves at admission, not at recording | Approved | 2026-08-08 | 2026-08-08 | — |
| [ADR-009](ADR-009-three-pilot-surfaces.md) | Three pilot surfaces, separately deployed | Approved | 2026-08-20 | 2026-08-20 | Amends ADR-007 decision 1 |
| [ADR-010](ADR-010-project-sourced-requirements.md) | Requirements a site supplies from its own робоча документація | Approved | 2026-08-24 | 2026-08-24 | Supersedes one clause of ADR-006 decision 4.1 |
| [ADR-011](ADR-011-telegram-locked-project-channel.md) | Telegram as the locked project channel | Approved | 2026-09-02 | 2026-09-03 | Amends ADR-007 on three passages; decisions 9–11 ruled by the owner on 2026-09-03 |

The «Supersedes / amends» column quotes each ADR's own statement of its relationship; it adds no relationship an ADR does not state. An ADR numbered 011 also exists under `docs/legacy/`; that file is historical and is not part of this series (ADR-011 lists the collision).
