# GoProceed documentation

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-09-13

**Related decisions:** [ADR-001](decisions/ADR-001-product-boundary.md),
[ADR-002](decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](decisions/ADR-004-roadmap-demo-and-documentation.md),
[ADR-005](decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](decisions/ADR-007-pilot-field-client.md)

## Purpose

This directory is the canonical reader entry point for GoProceed. It separates
what exists now, what is approved for a target version, what belongs to a
release, and what is retained only as historical evidence.

No document is authoritative merely because it is detailed. Authority comes
from its type, status, applicable version, and the precedence below.

## Source of truth

When sources disagree, use this precedence for the specific question:

1. **Actual database:** applied migrations are the source of truth for objects,
   constraints, grants, policies, and data transformations that the repository
   can prove are deployed. A live catalog comparison is still required to
   detect environment drift.
2. **Target version design:** approved canonical domain, architecture, and
   database design are the source of truth for what a named target version must
   become. Target design never pretends to be deployed state.
3. **Public API:** no OpenAPI document holds this authority today, because the
   canonical one has not been written — `technical/openapi/` contains a README
   and a scope CSV and no schemas. Until it exists, three artifacts carry that
   authority between them, each for the question it actually answers:
   - [`technical/openapi/scope-v0.1.csv`](../technical/openapi/scope-v0.1.csv) —
     the **route set**: which operations exist in v0.1, and each one's method,
     path, `command`/`query` kind, idempotency rule, auth plane, and owning
     milestone. An operation that is not a row there is not in v0.1.
   - [`packages/contracts`](../packages/contracts) (package name
     `@goproceed/contracts`) — **request and response shapes**, and the
     `application/problem+json` envelope: `ProblemJson` is declared at
     `packages/contracts/src/problem.ts:2-9`, and every route serialises through
     `jsonProblem` with that media type at `apps/app/src/lib/http.ts:37-45`.
   - [`technical/error-catalog.csv`](../technical/error-catalog.csv) — the
     **problem codes**, each with its HTTP status, retryability, user action,
     log policy, producer, and UI surface. It is enforced, not decorative:
     `packages/testing/src/error-catalog-fidelity.test.ts:28-33` fails when a
     route emits a code the catalog does not define.

   These three are authoritative only within those three questions, and only
   for v0.1. A future `technical/openapi/openapi-v0.1.yaml` supersedes all
   three for routes, inputs, outputs, errors, and authentication — but only
   once it is written, scoped to v0.1, passing its validator, and marked
   Approved. Until that file meets all four conditions, **no OpenAPI file has
   authority**, and that explicitly includes the legacy 157-operation
   `technical/openapi.yaml`, which is historical reference describing a
   different product surface.
4. **Release contents:** product scope and the version roadmap are the source of
   truth for what is included in, deferred from, and required to close a
   version.
5. **Approved decisions:** ADRs are the source of truth for why a boundary or
   architecture choice was approved and what would be required to replace it.
6. **Legacy material:** files marked Historical or located under `docs/legacy`
   are non-normative reference. They may supply evidence or rationale but may
   not override an active source.

If two sources at the same level conflict, delivery stops for that slice until
the conflict is recorded and resolved by an ADR or an explicit correction to
the authoritative artifact.

## Status meanings

- **Approved:** agreed design or policy; implementation may still be pending.
- **Draft:** under review and not an implementation authority.
- **Superseded:** replaced by the document its `**Superseded by:**` line names.
- **Historical:** preserved evidence; non-normative.

`Approved` does not mean deployed. Whether something is built, deployed or
verified is not a document status: it belongs in [STATUS.md](STATUS.md) and delivery evidence.

## Required metadata

Every active Markdown document starts with:

```markdown
**Status:** Draft | Approved | Superseded | Historical

**Applies to:** v0.0 | v0.1 | v0.2+ | all

**Last reviewed:** YYYY-MM-DD

**Related decisions:** ADR links or None
```

Documents must name exact versions. `Future`, `later`, and similar language is
allowed only when accompanied by the owning roadmap version or an explicit
uncommitted research label.

One active file is exempt, and the exemption is recorded here so its bare head
is not read as an oversight:
[`docs/22-data-api-contract.md`](22-data-api-contract.md) carries no metadata
block because eight running code comments cite it at exactly `:166` and `:170`
(in `apps/app` and `packages/database`), and a metadata block would move both
lines. Its disposition
([`document-disposition.csv`](../migration/goproceed-canonical-v0.1/document-disposition.csv))
is `keep` **only** until v0.0 re-points those references, then archive. It is
AktFlow-era, Historical, and non-normative in full: it defines no current table,
API surface, state value, or term, and the objects it names —
`hold_point_decisions`, `concealment_events`, `occurrence_trigger_events`,
`typed_evidence_records` — are the model
[ADR-005](decisions/ADR-005-readiness-gate-and-hidden-works.md) replaces and
have no migration. Its own §1 now says so. No other document may inherit this
exemption, and it ends when the code citations move.

## Canonical structure

| Area | Purpose | Authority |
|---|---|---|
| `product/` | Vision, scope, actors, workflows, roadmap | Release contents |
| `domain/` | Terms, roles, entities, invariants, calculations | Target domain design |
| `architecture/` | Runtime boundary, tenancy, security, imports, files | Target architecture |
| `delivery/` | Milestones, acceptance gates, tests, rollout | Execution evidence |
| `design/` | Design system: tokens, motion, components, and the procedure for building UI | Target design |
| `discovery/` | Leads, sends, replies, interviews, pilot evidence | Market evidence only |
| `decisions/` | Approved trade-offs and supersession rules | Decision authority |
| `legacy/` | How historical material may be used | Non-normative reference |
| `../technical/` | Database, API, permissions, states, events, templates | Machine-facing target contracts |
| `../migration/` | Source inventory, conflicts, dispositions, transfer gates | Migration evidence |

The current legacy files under `technical/*` do not become canonical merely
because this structure reserves that location. Each replacement remains
non-normative until it has canonical metadata or a machine-readable version
declaration, is scoped to a named target version, passes its validator, and is
marked Approved. In particular, the existing legacy `technical/openapi.yaml`,
`technical/schema.sql`, and the flat CSV catalogs are not v0.1 implementation
authority.

One catalog is a named exception, so that this rule and precedence level 3 do
not contradict each other: `technical/error-catalog.csv` is v0.1 authority for
problem codes, HTTP status, retryability, user action, and log policy. Its
`retryable` is the code's default; a route that knows more about one failure
case may send the other value, and the response's own `retryable` is what a
client acts on for that response. A scan of `apps/app` on 2026-09-24 (DEV-047,
BL-141) found five codes sent against their default: `VERSION_CONFLICT` as
`false` from 16 route files, among them the revoke and end commands, where
repeating the identical request cannot succeed (DEV-021, DEV-043, DEV-044);
`ASSIGNMENT_CONFLICT`, `IMPORT_JOB_CONFLICT` and `UPLOAD_GRANT_EXPIRED` as
`false` from one file each; and `UPLOAD_INTENT_CONFLICT` as `true` from the upload
finalizer while the bytes have not arrived
(`apps/app/src/lib/evidence/finalize-upload-intent.ts`). It earns
the exception by being enforced against running code rather than by being
detailed — `packages/testing/src/error-catalog-fidelity.test.ts:28-33` reads it
and fails the build on any emitted code it does not define. The exception is
narrow in two ways. Its 118 codes still describe the legacy surface, so a code's
presence there never makes an operation part of v0.1 — only
`technical/openapi/scope-v0.1.csv` decides that. And it ends when a v0.1-scoped
error catalog with a version declaration replaces it, or when
`technical/openapi/openapi-v0.1.yaml` absorbs it under precedence level 3.

A second named exception runs the other way, restricting rather than granting:
[`docs/product/hidden-works-content-rules.md`](product/hidden-works-content-rules.md)
is binding on Ukrainian regulatory content at every precedence level, including
over ADRs. No document — ADR, canonical design, catalog, migration comment, or
product copy — may assert a Ukrainian norm, clause, підпункт, form field, or
Додаток Н item that its allow-list does not carry, and no document may add one
by asserting it. It was promoted from Draft to Approved on 2026-08-06 for
exactly this reason; its allow-list is a prohibition list, and a prohibition may
not be weaker than the documents it constrains. Its Open items record what is
still unsourced; an open item is never a licence to assert.

## Change control

1. A scope change starts by updating the relevant ADR or adding a new one.
2. Approved product and domain documents are updated before implementation
   planning.
3. Machine-facing contracts are updated before or with implementation.
4. Applied migrations remain append-only history; corrections use new
   migrations.
5. Version closure requires acceptance evidence, not a target date.
6. Historical sources are never silently edited into appearing canonical.

## Current baseline

The object counts here were measured on the migration chain through `0040` and
have not been re-measured since: 33 tables, one API view (`api.me_context`), 27
functions (22 in `app`, 5 in `public` — counting distinct schema-qualified name
plus argument-type list, surviving all drops), and five database roles. They are
a dated measurement, not the current baseline: later migrations exist, and the
latest one is recorded in [STATUS.md](STATUS.md), whose marker the validator
checks against `supabase/migrations/`. *[Changed 2026-09-13 (DEV-004): this
paragraph stated «40 migrations through `0040`» as the present baseline.]*
GoProceed v0.1 is an
approved target, not the current runtime. After the
[ADR-006](decisions/ADR-006-pilot-shaped-v0.1.md) re-cut, **seventeen of the
twenty-six v0.1 tables have no table in any applied migration**, and they are
spread across **M1 through M5**, not M3–M6: requirement rule versions,
requirement library items and contract-version rule bindings (M1); requirement
occurrences (M2); work stages, stage closures, requirement evidence decisions,
requirement exceptions, the requirement exception head, the requirement
evidence-decision head, readiness projection and blocked reasons (M3); statutory
acts and their versions (M4); external access grants, external sessions and
external decision batches (M5). The two heads and the decision batch entered
v0.1 on 2026-08-06 by owner decision, moving the build list from 23 to 26 and
the new-build count from 14 to 17. Objects
moved out of v0.1 entirely have no tables either — internal review, packages and
claim segments, `commercial_decision`, acceptance, and the
seven-state value-at-risk projection are **v0.2**. Milestone
numbering runs **M0–M7**, not M1–M7 (M7, the channel, added 2026-09-03 by
ADR-011); M0 adds no table. The
migration inventory and known gaps are recorded in
[`migration/goproceed-canonical-v0.1`](../migration/goproceed-canonical-v0.1/README.md).

**No baseline state is claimed on this branch.** The last recorded run in that
directory is dated 2026-07-30 and predates migrations `0036`–`0040`, the
`packages/testing/src/review-fixes-0036-0040.test.ts` suite, and the
`vitest.workspace.ts` correction that added `packages/contracts` and
`packages/domain`. `node_modules` is absent from this worktree, so nothing here
has been executed to produce a current number. No document in this package may
state a passing suite, a test count, or a green baseline as a present fact.

## Observation layers

These files record the state of the work. None of them holds a precedence
level above: when one disagrees with the source it describes, the observation
is re-checked and the stale side is corrected.

| Location | What it records | Authority |
|---|---|---|
| [STATUS.md](STATUS.md) | What was observed on a date, area by area, each row with re-checkable evidence | Observation only; written by the coordinator |
| [tasks/](tasks/README.md) | One record per development change: its route, findings and PASS / FAIL / NOT RUN evidence | The record of that change |
| [specs/](specs/README.md) | Design specs written from 2026-09-13 | Target design once `Approved` |
| [research/SOURCES.md](research/SOURCES.md) | Third-party sources, with publication and access dates | Evidence only |
| [superpowers/](superpowers/README.md) | Specs, plans and gate records written before 2026-09-13 | Historical record, frozen |
| [BACKLOG.md](BACKLOG.md) | Open and deferred work, one `BL-NNN` entry each; triaged from `TODOS.md` and the HANDOFF files by DEV-005 | Planning only |

A document whose Status is `Superseded` carries a `**Superseded by:**` line
under its metadata block, linking the document that replaced it.
*[Changed 2026-09-13 (DEV-004): `Implemented` was removed from the Status
values. No active document used it, and whether something is built belongs in
STATUS.md with evidence, not in a document's status.]*

## ADR lifecycle and approval

An ADR's `**Status:**` is one of:

- **Proposed:** drafted and not in force. An agent drafts an ADR only in this state.
- **Approved:** in force, on the owner's ruling recorded in the ADR.
- **Superseded:** replaced by a later ADR, named in a `**Superseded by:**` line.
- **Rejected:** the owner ruled against it; kept as the record of the option.

[decisions/README.md](decisions/README.md) indexes every ADR, and
`scripts/validate-canonical-docs.mjs` fails when the index and a file disagree.

**Approval procedure.** This answers the ADR-status and approval-procedure part
of [pilot-execution-runbook.md](delivery/pilot-execution-runbook.md) §10 Q-6; its
other open part, a retroactive record for the channel's migrations, stays open.

1. The coordinator drafts the ADR as `Proposed`
   ([agents/COORDINATION.md](../agents/COORDINATION.md), «Intake and routing»),
   with `gp-architect` or `gp-researcher` where the decision needs them.
2. The owner rules. The ruling is written into the ADR in a dated **Approval**
   section: what was approved, the date, and where the owner gave it
   (conversation or pull-request review). A ruling that accepts only some of
   the decisions names them.
3. The Status moves to `Approved` (or `Rejected`) in the same pull request as
   that section, together with the index row, and the owner merges it. No
   stage's PASS moves an ADR out of `Proposed`, and no agent does so on its
   own: the coordinator writes the Approval section and the Status change only
   to transcribe an owner ruling, and the owner's merge ratifies the
   transcription.

ADRs approved before 2026-09-13 keep the form their approval already has, such
as ADR-011's «Open items — ruled by the owner on 2026-09-03»; they are not
rewritten into an Approval section.

For `docs/decisions/ADR-NNN-*.md`, this enum replaces the Status values listed
under «Required metadata»; the other three metadata fields are unchanged.
