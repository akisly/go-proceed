# State and transition catalogs

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-08-06

**Related decisions:** [ADR-005](../../docs/decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../../docs/decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](../../docs/decisions/ADR-007-pilot-field-client.md)

Two files, and the `kind` column that decides how to read them.

## Columns

`state-catalog.csv` — `state_machine,state,kind,description,source_document`.

`transition-catalog.csv` — `state_machine,from_state,to_state,trigger,guard_or_rule,source_document`.

## What `kind` means

This was previously implicit, and the implicitness produced real defects: two
append-only facts were catalogued as `stored_lifecycle` and so appeared to carry
a mutable status column the domain forbids. The five values are:

- **`stored_lifecycle`** — a status column that exists on the row and is updated
  in place. It has transition rows, and each of them is a write.
- **`stored_head`** — the current state of a serialized coordination head row
  (`package_scope_heads`, and the lineage heads). Also written, also transitions,
  but always under the head lock with an expected version.
- **`projection`** — **not stored anywhere.** Recomputed from append-only facts
  and, in some cases, from the server clock. A transition row for a projection
  describes a recomputation, and its trigger names the fact that was *appended*
  or the clock comparison that became true — never an update. An entity that
  `entity-catalog.csv` marks `append_only_fact` with `immutable_content=yes`
  may only carry projection states.
- **`stored_vocabulary`** — a closed set of values on a stored column with no
  transitions at all: the value is chosen once, at insert, and the row is
  immutable. A `stored_vocabulary` machine has **no** rows in
  `transition-catalog.csv`, and that absence is correct rather than missing.
  There are five: `requirement.timing`, `requirement_exception.kind`,
  `blocked_reason.code`, `capture.origin_method`, and — as markers rather than
  vocabularies — `unevidenced_closure.reason_code` and
  `requirement_evidence_decision.return_reason`.

  Four of these were transcribed on 2026-08-06 because four documents made them
  entry evidence for a milestone while this catalog carried zero rows for any of
  them: `blocked_reason.code` (ADR-005 decision 6, an M3 entry condition in
  `roadmap.md`), `requirement_exception.kind` (the same M3 entry condition),
  `capture.origin_method` ([ADR-007](../../docs/decisions/ADR-007-pilot-field-client.md)
  decision 5, which assigns the not-distinguished token to this catalog and
  deliberately does not invent it), and the two reason vocabularies below.

- **`NOT_ENUMERATED` is a marker and never a value.** Two vocabularies are
  *required* by an Approved document and are enumerated in no document in this
  package: the bypass `reason_code` (ADR-005 decision 5) and the M5 return
  reason (`scope-and-boundaries.md` §M5). Both sources say plainly that until
  the set is written down **no document may describe it as closed**, so this
  catalog records the machine and the obligation rather than inventing values.
  A row whose `state` is `NOT_ENUMERATED` must never be read as a permitted
  value, must never be rendered, and is discharged only by replacing it with
  real rows.
- **`client_local`** — state that exists only on the mobile client and is never
  a server fact.

## Version scope: neither file carries a milestone column

Both files describe the **whole target design**, not the v0.1 subset, and
neither has a milestone column to say which is which. That is deliberate — a
state machine is a property of an entity — but after
[ADR-006](../../docs/decisions/ADR-006-pilot-shaped-v0.1.md) it needs saying out
loud, because a majority of the machines below now describe states a v0.1
installation can never reach.

Since 2026-08-06 every row of a machine that v0.1 cannot reach **says so in its
own `description`**, so a reader of one row is not required to hold the list
below in their head. The two rules still run together, and the entity catalog
wins if they ever disagree.

**Read the version of a machine from its entity's `status_version` in
[`entity-catalog.csv`](../database/entity-catalog.csv).** A machine whose entity
is `v0.2` is a `v0.2` machine, whatever this file says about it. The converse is
not a licence: a `v0.1-M1` or `v0.1-M2` marker on a deployed table means the
table exists in an applied migration and is not extended by a numbered v0.1
step, not that every state of its machine is reachable in v0.1. As of
2026-08-06 that moves these whole machines out of v0.1: `unevidenced_closure.status`,
`requirement_notice.status`, `package_version.status`, `package_scope_head.head_state`,
`claim_segment.lineage`, `claim_segment.eligibility`, `package_review.projection`
and `var.workflow_state`. Three individual values move without their machines:
`work_stage.status = closed_without_evidence` (there is no bypass in v0.1),
`requirement_occurrence.satisfaction = awaiting_notice_period` (there is no
`witness` intervention type in v0.1), and the `evidence_linked` /
`reviewed_returned` readings of `requirement_occurrence.review` that depend on
internal review. `import_batch.status` **stays** in v0.1: ADR-006 decision 6
freezes the importer rather than removing it, and an imported object keeps
working.

Two `client_local` states are marked native-only in the rows themselves:
[ADR-007](../../docs/decisions/ADR-007-pilot-field-client.md) makes the v0.1
field client a PWA, and `quarantined` and `expired_purged` rest on a
Keychain/Keystore-bound key and on storage the OS will not reclaim, neither of
which a browser has. `mobile_pending_original` keeps its other six states on the
PWA path. The `client_local` bullet above should therefore be read as *the field
client* rather than *the mobile app*: in v0.1 that client is a browser page.

## The rule that follows from it

A state machine whose entity is append-only cannot be `stored_lifecycle`. If a
document describes a status moving `a → b` on an append-only fact, either the
kind is `projection` and the transition is a recomputation, or one of the two
documents is wrong. `technical/database/schema-v0.1.sql` states this per table
for `unevidenced_closures` and `requirement_notices`.
