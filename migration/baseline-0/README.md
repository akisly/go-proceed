# GoProceed Baseline 0 migration workspace

status: planning_scaffold
created: 2026-07-29
owner: founder

This tracked directory is the temporary review and migration workspace for the
GoProceed Baseline 0 cleanup.

## Current state

- The approved design and implementation plans exist under
  `docs/superpowers/`.
- No legacy source has been moved or deleted yet.
- No private outreach material belongs in this directory or anywhere else in
  Git.
- Execution must happen in the isolated
  `codex/goproceed-baseline-zero` worktree described by Plan 01.

## Planned flow

```text
source inventory
  → reviewed migration ledger
  → thematic drafts
  → active docs / reference archive / approved deletion
  → Baseline 0 release evidence
```

## Planned contents

```text
migration/baseline-0/
├── README.md
├── preservation-manifest.md
├── inventory.csv
├── migration-ledger.csv
├── source-notes/
├── drafts/
└── reports/
```

## Safety rules

1. A source is not moved or removed without a reviewed ledger decision.
2. Private contacts, recipient-specific messages, replies, and campaign
   workbooks remain outside Git.
3. The original dirty worktree is not reset, cleaned, or overwritten.
4. This directory is removed only after Baseline 0 release evidence is
   accepted and every promoted artefact has a permanent destination.
