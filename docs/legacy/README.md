# Legacy documentation policy

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md)

## Non-normative status

This policy is approved governance. The AktFlow-era documents, prototypes,
target schema, generated catalogs, audits, and handoff notes governed by it are
preserved as Historical migration evidence. Those legacy contents are
non-normative:
they do not define the current database, approved GoProceed scope, public API,
or release contents.

The canonical source-of-truth precedence is defined in
[`docs/README.md`](../README.md).

## Permitted use

Legacy material may be used to:

- recover a user need, workflow example, test idea, or design rationale;
- compare the implemented six-table foundation with prior intentions;
- identify contradictions, security gaps, or missing migration steps;
- preserve discovery and prototype evidence;
- trace why information was kept, rewritten, merged, deferred, or rejected.

It may not be used to:

- claim that an unapplied table, API route, role, or workflow exists;
- expand an approved release boundary without a new ADR;
- override canonical terminology or invariants;
- infer demand validation from lead or send counts;
- authorize destructive database or file cleanup.

## Disposition process

The completed per-source matrix lives at
[`migration/goproceed-canonical-v0.1/document-disposition.csv`](../../migration/goproceed-canonical-v0.1/document-disposition.csv)
(104 unique sources as of 2026-07-30). Four legacy files stay `keep` because
running code cites them directly: `docs/22-data-api-contract.md`,
`technical/schema.sql`, `technical/openapi.yaml`, `technical/error-catalog.csv`,
and `technical/data-access-surface.csv`; they may be archived only after v0.0
re-points those references. Every legacy source is mapped to one outcome:

- `keep` — remains active without semantic change;
- `rewrite` — useful information moves to a new canonical owner;
- `merge` — overlapping sources consolidate into one canonical owner;
- `defer` — valid idea assigned to a named later version or research question;
- `archive` — retained only as historical evidence;
- `delete_after_transfer` — eligible for deletion only after transfer or
  explicit rejection is verified and the user approves the exact path.

Until that review is complete, the old project tree remains read-only.

## Interpretation rule

If a legacy source conflicts with an approved ADR or canonical target document,
the canonical source wins. If a legacy source reveals a fact missing from the
canonical model, record the conflict and resolve it explicitly; do not silently
copy the old assumption forward.
