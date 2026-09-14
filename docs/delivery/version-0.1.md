# v0.1 delivery gates — M0–M7 vertical slices

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-08-08

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md),
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](../decisions/ADR-007-pilot-field-client.md),
[ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md)

> **Version note (2026-08-08) — two decisions taken after this document was
> last reviewed. Both change what v0.1 means, and both are recorded in every
> document that states v0.1 scope.**
>
> 1. **The valuation carve happens at admission, not at recording.**
>    [ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md) (Approved,
>    2026-08-07) moves it out of `progress.record` and into the **stage closure**,
>    which is v0.1's admission event. Performed quantity is recorded **unvalued**;
>    only admitted quantity competes for the work item's pool; admission is a
>    deliberate authorised act and not a side effect of measurement (INV-089, P0).
>    Until 2026-08-08 this ADR was named in no document but the glossary.
>    **What is built is not yet what it decided:** `progress.adjust` still carves
>    at measurement time whenever the root already holds an allocation — no
>    closure, `admitted_by_closure_id` NULL — and that is an open P0, not a
>    nuance.
> 2. **The work type's carrier is a column on the work line, and it needed no
>    ADR.** Settled by the owner on 2026-08-08. Migration `0050` adds
>    `public.work_items.work_type_key`, so the requirement-rule predicate's first
>    argument has a left-hand side at last and a **hand-typed** baseline
>    materialises obligations. Two things it did not settle: the **owning
>    entity** — a table that defines the set of work types — still needs an ADR
>    ([glossary.md](../domain/glossary.md) «Work type»), so a work type is validated as *a real one* and not as *the
>    right one*; and an **imported** baseline carries no work type at all, which
>    is permanent for the life of that contract version.
>
> **Neither decision is deployed, and neither is anything else.** Migrations
> `0041`–`0050` are ten files written on an uncommitted branch and **none has
> been applied anywhere**. Against applied history (`0001`–`0040`) the runtime is
> **33 tables**, of which **9** are among the 26 that ADR-006 decision 4 builds
> in v0.1. Nothing in this package may be described as green, verified, or
> confirmed working.


v0.1 is a **minimal finished product**: the smallest whole thing a subcontractor
can use unaided, handed to a customer early enough that a "no" is still cheap.
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 1 fixes it as six
steps, and nothing outside them is v0.1:

1. **The object.** ПТВ creates an object, enters the work lines **by hand**,
   picks a work type, and the requirements load from the shipped ДБН library at
   [dbn-a31-5-2016-dodatok-n.csv](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv).
2. **The phone.** The foreman opens the field client and sees what must be
   photographed **before covering**, in the standard's own wording, with a
   reference image. He takes it.
3. **The refusal.** The stage cannot be recorded as closed while a `hold`
   requirement on it is unmet, and the attempt names exactly what is missing.
4. **The act.** «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ» by the form of Додаток В,
   assembled only from already-recorded facts.
5. **The link.** Технічний нагляд opens a personal link with no account and
   accepts or returns with a reason.
6. **The money.** The owner sees what is blocked and how much money sits behind
   it, broken down by cause.

Eight milestones deliver them: **M0** makes the environment fit to hold someone
else's data, and **M1–M7** are one step each (M7 added 2026-09-03 by
[ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md) decision 9).
[ADR-007](../decisions/ADR-007-pilot-field-client.md) makes the M2 field client a
PWA served from `apps/app` and takes `apps/mobile` off the v0.1 path without
deleting it.

**Authority.** This re-cut is made on the owner's instruction of 2026-08-06,
recorded in ADR-006 and ADR-007. It is **not** made on the founder-reported
market signal of 2026-08-05, which
[validated-assumptions.md](../discovery/validated-assumptions.md) forbids from
driving a roadmap change or a capture-UX decision, and which is cited nowhere in
this document as a reason for anything.

This document adds the exact schema slice, API slice, exit gates, security tests,
acceptance evidence, and exclusions per milestone. Entry evidence lives in the
[roadmap](../product/roadmap.md); what left v0.1 lives in
[version-0.2.md](version-0.2.md).

Slices reference [entity-catalog.csv](../../technical/database/entity-catalog.csv)
(`status_version` column) and [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv)
(`milestone` column); those catalogs are authoritative for the row-level lists,
and every operation-count sentence below is cross-checked against
`scope-v0.1.csv` by `scripts/validate-canonical-docs.mjs`, which fails in both
directions — a stated count that the CSV contradicts, and a milestone in the CSV
that this document never states a count for. The **table** lists below come from
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4, which the entity
catalog must agree with for every table v0.1 **builds**. It is not a row-for-row
identity in the other direction: the catalog is an inventory and additionally
carries tables that are deployed and that v0.1 does not extend, which the ADR's
build list does not name.

## Nothing below is deployed

**Approved is not deployed — and, since the v0.1 build slices landed, «written»
is not deployed either.** Three states are kept apart in every sentence below.
Until 2026-08-06 only two of them existed, which is why the sentence this
section replaces could afford to blur them:

- **Applied.** Migrations `0001`–`0040` are history and have run. They define
  **33 tables**. **Nine** of the twenty-six tables ADR-006 decision 4's build
  list names are among them.
- **Written and never run.** Migrations `0041`–`0050` were written on this
  uncommitted branch. **Ten files, none of them applied anywhere** — not to
  production, not to staging, not to a local database, not once. Between them
  they carry `create table` for **20 tables**, **seventeen** of which are on the
  build list, plus every CHECK, trigger, policy and grant the readiness gate is
  made of, and — in `0050` — the `work_items.work_type_key` column the rule
  predicate's left-hand side lives in.
- **Neither.** Empty. Every table the build list names now exists in at least a
  file.

*(Corrected 2026-08-08. This section previously read: «Requirement occurrences,
stages, stage closures, evidence decisions, requirement exceptions, readiness,
blocked reasons, statutory acts, and external access have **no tables**. None of
the readiness gate exists.» That was true on the day it was written. It is now
wrong in the more dangerous of the two directions — those tables have DDL, and
having DDL is not existing. The superseded sentence is kept here rather than
deleted, because the distinction it lost is what this section is for.)*

**Seventeen of the twenty-six v0.1 tables still have no table in any APPLIED
migration.** Every milestone below is a target, no milestone is closed by a
document, and this document makes no test-count claim, no green-baseline claim,
and no claim that any migration applies.

## No customer evidence supports these slices

The discovery ledger records 21 evidenced sends, zero replies, zero interviews,
zero named projects, zero pilot commitments, zero willingness-to-pay signals, and
**zero customer documents of any kind**
([validated-assumptions.md](../discovery/validated-assumptions.md)). Every "real
sanitized example" named in an acceptance-evidence line below is a thing still to
be obtained, not a thing on hand.

Two consequences the re-cut draws from that, rather than from any market signal:

- **Import is frozen, not deleted** (ADR-006 decision 6). The XLSX/CSV importer
  built in M1 stays in the code exactly as it is, its tables are not dropped, no
  code path is removed, and an object created by import keeps working. What
  changes is that its **extension** is no longer v0.1 work and a representative
  sanitized customer artifact is no longer an entry condition for a milestone
  that already shipped. One real sanitized кошторис, АВР, or interim-works file
  from a named company unfreezes it, and nothing else does.
- **Manual work-line entry is a first-class capability** (ADR-006 decision 2). It
  is not a stopgap for a missing importer and no document, screen, error message
  or export may describe it as one. It gets the same schema quality, the same
  provenance, and the same tests as an imported line.

## Operations and tables per milestone

Counted from [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv) on
2026-08-06 — **58 operations in v0.1**; **60 as of 2026-08-18**; **62 as of 2026-08-22**; **65 as of 2026-08-24**; **68 as of 2026-08-28**; **69 as of 2026-08-29**; **75 as of 2026-09-01** — see the notes under the table. The per-milestone operation ids are listed
in each API slice below. The table columns come from ADR-006 decision 4.

| Milestone | Operations | v0.1 tables | Already in the runtime |
|---|---|---|---|
| M0 — cross-cutting | — | — | — |
| `v0.1-M1` | 35 | 8 | 8 |
| `v0.1-M2` | 9 | 5 | 5 |
| `v0.1-M3` | 6 | 8 | 8 |
| `v0.1-M4` | 6 | 2 | 2 |
| `v0.1-M5` | 6 | 3 | 3 |
| `v0.1-M6` | 3 | 0 | — |
| `v0.1-M7` | 10 | 0 | — |
| Total | 75 | 26 | 26 |

*The «v0.1 tables» column is ADR-006 decision 4's build list and stays at
its 26. `project_sourced_requirement_items` is a twenty-seventh v0.1 table,
added by [ADR-010](../decisions/ADR-010-project-sourced-requirements.md) on
2026-08-24 rather than by ADR-006, and it is deliberately not counted into a
list that names what ADR-006 decided. Its three operations ARE counted above,
because the operations column counts scope-v0.1.csv and nothing else.*

*M4 is 6 operations, not 4, as of 2026-08-18. `project_parties.create` and
`party_contacts.create` were added because the act's mandatory signatory slots
require a `projectPartyId` and a `partyContactId`, and NO v0.1 operation could
create either row — `statutory_acts.compose` was unreachable on any real
workspace, and the M4 suite was green only because its fixture inserted the rows
by SQL (`TODOS.md`, formerly «P3 — dead surface added by the M1 migrations»,
whose own 2026-08-08 escalation said exactly this). No new table: both existed
since migration 0010 with RLS and grants and were counted in the 26 all along.*

*`v0.1-M6` has thirteen operations as of 2026-09-01. `evidence.list` (Plan D slice D1, Task 3), `external.evidence_bytes` (the same slice, Task 4), the project Telegram channel commands, `telegram_webhook.accept`, `assignment_communication_cards.publish`, and the three `project_communications.*` timeline/reply/retry operations all share the tag — a compromise: M6 is nominally "the blocked money" and these operational channel reads/writes are not that, but the alternative (`v0.1-M7`) would need its own entry in ADR-006 decision 4's and [roadmap.md](../product/roadmap.md)'s milestone tables, which restructures the delivery taxonomy to accommodate one slice. `blocked_value.get` is no longer the only `v0.1-M6` row — see the two corrections below, in the M6 section itself. No new table accompanies the evidence or communication reads, and the Telegram ingress uses the already-deployed inbox table; `evidence.list` is a join over `upload_intents` and `evidence_objects`, and `external.evidence_bytes` reads one `evidence_objects` row and streams the object storage already holds. `telegram_webhook.accept` verifies the provider secret, bounds raw input to 1 MiB, and persists a pending update before acknowledgement; it resolves no tenant scope. Assignment cards and project communication replies/retries atomically record a queued immutable message and its Telegram delivery intent; provider acceptance is later work. The tag records the slice that built each operation rather than re-stating a shipped milestone's operation list after the fact.*

*Corrected 2026-09-03: ADR-011 decision 9 made the alternative the decision. The ten channel operations (`project_field_channel.configure`, `project_field_channel.get`, `projects.activate`, `telegram_binding_intents.create`, `telegram_member_link_intents.create`, `telegram_webhook.accept`, `assignment_communication_cards.publish`, `project_communications.list`, `.reply`, `.retry`) are `v0.1-M7`; M6 keeps `blocked_value.get`, `evidence.list` and `external.evidence_bytes`. The compromise above is history, kept as the record of why the question was asked.*

**Telegram ingress release blocker — Task 13 must configure and verify an edge
limit of 120 requests/minute with burst 30 before this public webhook is
operationally enabled.** The application route intentionally has no portable
in-process or `vercel.json` limiter. At that edge boundary an excess request
must receive an empty `429` and Telegram must retry; no deployment may claim
this production control exists until Task 13 records its concrete verification.

**Read the fourth column exactly.** *(Added 2026-08-08.)* «Already in the
runtime» is the count `scripts/validate-canonical-docs.mjs` derives, and what it
actually measures is **a `create table` statement somewhere under
`supabase/migrations/`, applied or not**. Ten of those fifty files have never
run. Against **applied** history — `0001`–`0040` — the same column reads
M1 **5**, M2 **4**, M3 **0**, M4 **0**, M5 **0**, M6 **0**: **9 of 26**, not 26
of 26. The guard is not wrong; it answers «is the DDL written» and that is the
question it was built for. It is recorded here because a reader who takes the
column at its heading reads seventeen tables as live that do not exist.

M0 has no row in `scope-v0.1.csv` and adds no table: its gates are documents,
procedures, controls, and tests. The workspace export it requires is an
operator-run procedure in v0.1; making it a member-plane operation would add a
row to the route set, and that is not decided here.

The **v0.1 tables** column is ADR-006's build list — every table a numbered step
cannot happen without. It is not an inventory of every table a milestone's
operations touch: several already-deployed tables (party legal profiles, own
legal-entity profiles, party contacts, project parties, project access grants,
responsibility assignments, the import module, `locations`, `unit_definitions`,
and the deployed half of the allocation ledger) keep working and are not
extended. Deployed is deployed; the list is what v0.1 **builds**.

## What left v0.1

Twenty-two operations moved to v0.2 with the capabilities they belong to. They
are recorded, with the reason each one moved and the exit gates each one keeps,
in [version-0.2.md](version-0.2.md), and their rows now live in
[scope-v0.2.csv](../../technical/openapi/scope-v0.2.csv) with the same schema.
Nothing was cancelled: every moved capability keeps its ADR-005 text, its DDL,
and its catalog rows.

Eight operations are new, all of them serving a numbered step that had no route:
`contract_versions.create`, `work_items.create`, `work_items.update`,
`work_items.remove` and `contract_versions.publish` are how a baseline is typed
by hand; `requirement_occurrences.list` is how the foreman sees what must be
photographed; `statutory_acts.render` is how the act becomes a document someone
can hold; `blocked_value.get` is the money screen. Two rule operations were
renamed in place — `requirement_rules.publish`/`.retire` become
`requirement_rule_versions.publish`/`.retire`, because ADR-006 decision 4.1
removes `requirement_rules` from v0.1 and a version can no longer be published
through a draft rule that does not exist.

## Contradictions closed, and one correction preserved

**Closed by this re-cut.** [roadmap.md](../product/roadmap.md) recorded that
contract versions published in M1 could never acquire a rule binding — rules bind
at publication, published versions are immutable, and `contract_versions.bind_rules`
was an M2 operation — which left every M1 baseline permanently outside the gate
and stopped delivery of the affected slice. ADR-006 decision 3 merges the rule
half of old M2 into M1, and this document carries that into the route set: the
binding operation is re-pathed from the contract to the **draft contract
version** (`/v1/contract-versions/{versionId}/rule-bindings`), and publication
refuses a version with no bound rule-version set. No baseline is published in
v0.1 without one. Delivery of the slice is unblocked by that decision, not by
this sentence.

**Preserved, because deleting a correction hides it.** On 2026-08-06 three gate
elements were dated one milestone earlier by the roadmap than by the catalogs,
and the catalogs won on [docs/README.md](../README.md) precedence — the route set
is level 3, release contents are level 4. That correction is now superseded in
its numbering, not reversed in its rule: ADR-006 moves the requirement rules, the
Додаток Н library and the baseline rule binding into M1, occurrence
materialisation into M2, and the statutory act into M4. The precedence rule that
settled it stands unchanged and settles the next disagreement the same way.

## M0 — Fit to hold someone else's data

- **User outcome:** the environment is fit to hold a real subcontractor's
  personal data and a real customer's commercial data **before** any of it
  arrives. A list with no milestone is a list that gets done last, and on a
  one-person project that means never (ADR-006 decision 7).
- **Schema slice:** none. M0 adds no table.
- **API slice:** none. M0 adds no operation to
  [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv).
- **Exit gates — twelve, and twelve is eight plus four**, each closed by
  recorded dated evidence and not by a
  checklist someone has read.** The eight cross-cutting items of
  [scope-and-boundaries.md](../product/scope-and-boundaries.md)
  §"M0 — Fit to hold someone else's data": privacy notice
  and versioned external confirmation text; documented retention periods and a
  manual closure/deletion procedure; workspace export; restricted audit and
  security telemetry; backup and restore verification; documented external-link
  assurance limits, including the explicit statement in the UI and on every
  printed page that link confirmation is not an electronic signature; secrets and
  environment separation; monitored job and message failure paths. Plus the four
  carried by ADR-005 and
  [hidden-works-content-rules.md](../product/hidden-works-content-rules.md): no
  normative string renderable without its `verification` tag and its source, held
  in the data and not in a template; a recorded date of last verification against
  the Реєстр будівельних норм, printed in the disclaimer on every generated act;
  tenant-isolation tests for every module; malware/content-type and
  resource-exhaustion controls for uploads and imports, **including the formula,
  macro, archive, file-size, worksheet and row safety limits of the frozen
  importer and export neutralization against spreadsheet formula injection** —
  the workspace export gate above is what makes the second of those a v0.1
  obligation rather than a package concern, so it cannot be inferred from the
  generic "uploads and imports" wording and is written out here.
  **What closes item 9 for the shipped library** is restated here so it is not
  lost between a neighbouring list that counts to twelve and a gate set that
  counts to fourteen. It is **not a thirteenth gate**
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 7): the
  retrieval record for the primary ДБН file —
  exact URL, retrieval date, and SHA-256 of the bytes — committed under
  [`technical/requirements/`](../../technical/requirements/). It closes the open
  item `hidden-works-content-rules.md` records against every `VERIFIED_PRIMARY`
  row the v0.1 library ships, which today rest on one download no reviewer can
  reopen; a re-fetch that does not reproduce the same bytes downgrades every row
  it touches to `VERIFIED_SECONDARY`.
- **Security tests:** the tenant-isolation suite for every module shipped by
  M1–M5, plus the upload malware/content-type and resource-exhaustion cases.
  Neither may be quarantined.
- **Acceptance evidence:** one dated evidence entry per gate in
  [production-readiness.md](production-readiness.md) — **all fourteen, gates 1
  through 14** — one executed restore exercise in an isolated environment, and
  one executed deletion-then-restore test proving tombstones are reapplied
  before restored data is reachable. There is no gate 8A, and gates 11 (tenant
  isolation for every module), 12 (upload and import safety), 13 (demo and data
  separation) and 14 (environment and secrets) are not optional: three of them
  carry M0's own cross-cutting items, and the tenant-isolation and upload
  controls named in the security-tests line above close nowhere else.
- **Exclusions:** M0 builds no product capability. It is numbered **0, not 5.5**:
  it may be built in parallel with M1–M5, but **M6 cannot open until M0 is
  closed**, and real customer data entering an environment that has not closed M0
  is a boundary violation regardless of which document or schedule requests it
  (ADR-006 replacement rule 5).
- **Gate evidence entries.** One dated entry per readiness gate, added when the
  gate closes; a gate with no entry below is open. Each entry names its task
  record, which holds the commands, the negative results and what the entry does
  not prove.
  - **Gate 10, Regulatory content (runbook items 9 and 10) — 2026-09-14 —
    [DEV-009](../tasks/DEV-009-m0-gate10-evidence.md).**
    - *No normative string renderable without its tag and source.* Held in the
      data by `requirement_library_items.verification` and `source_citation`
      checks and the same pattern in migrations `0043`, `0047` and `0059`;
      refused on render by `form_citation_unsourced` in the act and, since
      `c48a4a5` and `0359bcb`, carried by the Telegram assignment card. Tests
      green, none skipped, in CI run 34872695375 attempt 1 on 2026-09-14:
      `m4-act-schema` (58), `statutory-act-form` (41), `telegram/cards` (24),
      `requirement-library-fidelity` (13), `norm-ref-labels` (2).
    - *A recorded date of last verification, printed on every act.*
      `statutory_act_versions.registry_checked_on`, required at freeze, refused
      in the future, printed by `pageFooterText()`; the check of 2026-09-14 is
      recorded in
      [`technical/requirements/dbn-a31-5-2016.registry-checks.json`](../../technical/requirements/dbn-a31-5-2016.registry-checks.json)
      (ДБН А.3.1-5:2016 «Діючий», «Редакція від 20.04.2026», no change listed,
      confirmed by the owner), and the procedure for the next check is
      [`technical/requirements/README.md`](../../technical/requirements/README.md).
    - *The retrieval record, committed under `technical/requirements/`.*
      `dbn-a31-5-2016.pdf` and `dbn-a31-5-2016.retrieval.json`, bound to
      `DBN_RETRIEVAL` by `statutory-act-form.test.ts` (43 passed locally on
      2026-09-14; a one-byte change to the file turns both new tests red); the
      same 636 603 bytes were fetched again and matched on 2026-09-14. The owner
      ruled runbook Q-7 this way on 2026-09-14.
    - *Limits.* The new tests have not run in CI (GitHub Actions starts no jobs
      until October 2026); the database checks only that a check date is not in
      the future, not that a check behind it exists; one fetch reproduced is not
      two independent sources; the footer's «Реєстр будівельних норм» wording is
      BL-084.

## v0.1-M1 — The object and what it owes

- **User outcome:** ПТВ creates an object, types its work lines by hand, picks a
  work type, and the requirements load from the shipped ДБН library; publishing
  the baseline pins the exact rule-version set the work will be judged against.
- **Schema slice:** eight tables — `parties`, `projects`, `contracts`,
  `contract_versions`, `work_items`, `requirement_rule_versions`,
  `requirement_library_items`, `contract_version_rule_bindings`. The first five
  have a table in an applied migration, so M1 **builds three**. `requirement_rules`
  is not in v0.1: the only rule source is the shipped library, and
  workspace-authored rule drafting is v0.2 (ADR-006 decision 4.1). The rule
  predicate narrows to **(work type, stage)** — `locations` stays deployed and is
  not read by the predicate, and `unit_definitions` is used only as far as a
  manual line needs a unit (decision 4.2).
- **API slice:** the 35 `v0.1-M1` operations — `workspaces.create`,
  `me.context`, `invitations.create`, `invitations.accept`, `members.list`,
  `parties.create`, `parties.update`, `parties.legal_profile.put`,
  `parties.own_profile.create`, `projects.create`, `projects.list`,
  `project_access.grant`, `project_responsibilities.assign`, `contracts.create`,
  `contract_versions.create`, `work_items.create`, `work_items.update`,
  `work_items.remove`, `contract_versions.bind_rules`, `contract_versions.publish`,
  `contract_versions.get`, `import_batches.create`, `import_files.add`,
  `import_batches.validate`, `import_batches.get`, `import_resolutions.create`,
  `import_batches.publish`, `requirement_rule_versions.publish`,
  `requirement_rule_versions.retire`, `requirement_library.list`,
  `requirement_templates.create`, `requirement_templates.publish`,
  `project_requirements.create`, `project_requirements.archive`,
  `project_requirements.list`.
  Three notes on that list, because three groups of rows are there for different
  reasons:
  - **Five are new and are the manual baseline** — `contract_versions.create`,
    `work_items.create`, `work_items.update`, `work_items.remove`,
    `contract_versions.publish`. `work_items.remove` is the only `DELETE` in the
    v0.1 route set and is permitted **only while the version is a draft**,
    because a published version is immutable.
  - **Six are the frozen importer** — `import_batches.*`, `import_files.add`,
    `import_resolutions.create`. They are listed because they are **deployed**,
    and removing them would make this catalog contradict the runtime, which
    outranks it ([docs/README.md](../README.md) precedence level 1). Freezing
    means no extension work, not deletion.
  - **Two author a model this package retires.**
    `requirement_templates.create` and `.publish` are listed because they are
    deployed, not because they are approved:
    [glossary.md](../domain/glossary.md) retires the requirement template, the
    routes exist in running code
    (`apps/app/app/v1/workspaces/[workspaceId]/requirement-templates/route.ts`,
    `apps/app/app/v1/requirement-templates/[templateVersionId]/publish/route.ts`)
    with the `requirement_templates.manage` capability in
    `packages/domain/src/authz.ts`. **Recorded, not resolved (2026-08-06):**
    retiring the authoring path needs its own slice — route removal, capability
    removal, a `@goproceed/contracts` change, and the `requirement_owner`
    responsibility preset in
    [responsibility-presets.csv](../../technical/permissions/responsibility-presets.csv)
    — and until that slice lands v0.1 ships a way to author a retired model.
- **Exit gates:**
  - a work line entered by hand carries the same provenance fields, the same
    validation, and the same tests as an imported line, and no render, error, or
    export describes it as a stopgap;
  - `work_items.update` and `work_items.remove` are refused on a published
    version and permitted on a draft; a published version stays immutable and a
    reimport still produces diff and work-item lineage;
  - `contract_versions.publish` **refuses** a version with no bound rule-version
    set, and `import_batches.publish` refuses on the same condition — no baseline
    is published in v0.1 without a rule-version set;
  - rule versions are publish/retire only and are never updated in place; a
    consumer addresses a rule version by id and never through a live pointer
    (INV-067);
  - the publication command **rejects** an `intervention_type` other than `hold`
    (ADR-006 decision 4.3) and **rejects** a `hold` whose `blocking_scope` is
    anything other than `blocks_stage_closure` (decision 4.4). The CHECK keeps
    all three intervention types and all four blocking scopes, so v0.2 is
    additive and no v0.1 record is reinterpreted;
  - the shipped library carries Додаток Н positions Н.14 (5 items) and Н.15 (7
    items) verbatim from
    [dbn-a31-5-2016-dodatok-n.csv](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv),
    each row storing its `verification` tag and its source **in the data**, so a
    string with no source is unrenderable in storage rather than merely
    undecorated;
  - anything the product recommends beyond Додаток Н is stored in a separate
    block labelled «Додатково рекомендуємо (не з Додатка Н)» and carries no
    normative citation.
    [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
    governs every regulatory string without exception.
- **Security tests:** cross-workspace party/contract injection (INV-001/002),
  own-profile permission separation (INV-020), contract-number uniqueness
  (INV-022), import fuzz including formula/macro/ZIP-bomb fail-closed (INV-016),
  discrepancy blocking (INV-054); rule-version mutation denial and
  retired-version stability (INV-067); the publication rejections above — the
  v0.1 form of INV-066, whose `blocks_both` text in
  [invariant-catalog.csv](../../technical/database/invariant-catalog.csv) is its
  v0.2 form and is owed a widening migration with packages; unsourced-string
  storage denial over the twelve `VERIFIED_PRIMARY` rows (INV-073, storage half).
- **Acceptance evidence:** create a project and a contract; type twenty work
  lines by hand; correct one; remove one; be refused publication until a
  rule-version set is bound; publish; prove the published version immutable and
  the hand-typed line indistinguishable in provenance quality from an imported
  one; then run the frozen importer on a synthetic file and prove an object
  created by import still works end to end.
- **Exclusions:** no assignments, evidence, stages, closures, packages, or
  external access; no PDF import authority; **no import extension** — no further
  column-mapping, unit-inference, or number-format work until the file arrives
  (ADR-006 decision 6 and replacement rule 3); no location tree; no
  workspace-authored requirement rules.
- **Entry condition removed:** "at least one representative sanitized
  estimate/contract artifact" is no longer an entry condition for M1. M1 shipped
  without one, and the milestone that would have used it is frozen.

## v0.1-M2 — The phone

- **User outcome:** the foreman opens a link on his own phone, sees what must be
  photographed **before covering** in the standard's own wording with a reference
  image, and takes it. That is the whole interaction.
- **Schema slice:** five tables — `work_assignments`, `requirement_occurrences`,
  `progress_entries`, `upload_intents`, `evidence_objects`. All but
  `requirement_occurrences` have a table, so of **these five** M2 builds one.
  *(Corrected 2026-08-08: this read «so M2 **builds one**» full stop, and the
  milestone's migration builds **two**. `supabase/migrations/0043_the_obligation_before_the_covering.sql`
  creates `requirement_occurrences` **and `work_stages`**, because a stage is the
  unit an occurrence is scoped to and the occurrence cannot be keyed without it.
  `entity-catalog.csv` marks `work_stages` `v0.1-M3` and that marker is not
  wrong either: the **table** is M2 and the **command** that closes one is M3.
  The milestone table above counts by the catalog's marker, so M2 reads 5 and M3
  reads 8; this sentence counts by the migration. Both are true and they are not
  the same count — the catalog owes the note, not a different number.)* It also
  activates the deferred foreign key `upload_intents.requirement_occurrence_id`
  (`supabase/migrations/0015_execution_evidence_module.sql:251`), which is what
  binds a captured original to the obligation it was captured against.
  `work_assignments.requirement_template_version_id`
  (`supabase/migrations/0015_execution_evidence_module.sql:85`) is retired by a
  new migration in this milestone, and the free `severity` axis with it (ADR-005
  decisions 2 and 4). Capture telemetry (`capture_events`) leaves v0.1; the
  deployed allocation-ledger tables keep working and are not extended, because
  what they exist for — carving minor units out of a work-item pool for admission
  into a claim — has nothing to be admitted to until packages ship in v0.2.
- **API slice:** the 9 `v0.1-M2` operations — `assignments.create`,
  `assignments.list`, `requirement_occurrences.list`,
  `requirement_occurrences.dry_run`, `progress.record`, `progress.adjust`,
  `upload_intents.create`, `upload_intents.finalize`, `upload_intents.get`.
  `requirement_occurrences.create` and `.bulk_instantiate` leave v0.1: the only
  way an occurrence exists in v0.1 is materialisation from the rule versions
  bound to the published contract version, at assignment creation. A hand-made
  obligation is also a hand-removed one. The dry run survives with its uncovered
  list and loses only the location subtree — its path drops `/bulk`, and it now
  reports the uncovered **work lines** of a published contract version.
  **RESOLVED 2026-08-08 — the path gained the version.** This paragraph read:
  «Recorded, not resolved (2026-08-06): the route set keeps that operation
  project-scoped — `POST /v1/projects/{projectId}/requirement-occurrences/dry-run`
  — so the published contract version it reports over is named in the request and
  not in the path, and no `@goproceed/contracts` module defines that request.
  Either the path gains the version or the contract does; this document invents
  neither.» Both halves are settled, and the path was the half that moved:
  [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv) row 37 now carries
  `POST /v1/projects/{projectId}/contract-versions/{versionId}/requirement-occurrences/dry-run`,
  the route file sits at the matching path, and
  `packages/contracts/src/requirement-occurrences.ts` defines the request — an
  empty strict object, because with both identifiers in the path there is nothing
  left for a body to carry. Keeping the **project** segment is deliberate and is
  what a version-only path could not do: a `projectId`/`versionId` pair that does
  not belong together is a 404 rather than a silently-wrong report.
  `evidence_links.create` leaves with the many-to-many link table; in v0.1 one
  original is bound to one occurrence by the intent it was captured under.
- **Exit gates:**
  - occurrences are materialised **when the assignment is created**, before the
    first quantity entry, with no evidence yet linked, carrying `rule_version_id`,
    `intervention_type`, `blocking_scope`, `evidence_kind`, `acceptance_criterion`,
    `norm_ref`, `performer_role`, and `approver_role`. **This gate was
    unreachable until 2026-08-08 and nothing in this document said so** — the
    rule predicate's first argument had no carrier on `public.work_items`, so
    `assignments.create` matched no rule and materialised zero occurrences for
    every line in the product. Migration `0050` adds `work_items.work_type_key`
    and the owner settled on 2026-08-08 that the **carrier** is a column needing
    no ADR (the owning **entity** still needs one —
    [glossary.md](../domain/glossary.md) «Work type»). The gate is now reachable
    **for a hand-typed line**. It is **permanently unreachable for an imported
    one**: the frozen importer writes no work type and a published line is
    immutable, so an imported кошторис materialises nothing and the only remedy
    is a successor version typed by hand, one line at a time;
  - the field client shows the set **before work starts**; a placeholder that
    appears only after the stage is covered does not close this gate;
  - the dry run prints an explicit list of uncovered lines as part of the
    command's own output, not as a report someone may choose to run, because
    silent non-coverage means there is no gate (INV-072, in its v0.1 form over a
    contract version rather than a location subtree);
  - the field client is a **PWA served from `apps/app`** behind the same BFF
    boundary as the web product (ADR-007 decision 1); `apps/mobile` is not on the
    v0.1 path and is not deleted (decision 2);
  - capture is **online-only** and a pending original is **not durable**: no
    screen reports success before the persisted `available` receipt, the client
    uploads immediately rather than offering a queue it cannot honour, and the
    loss of a pending original is always surfaced to the user and never silent
    (ADR-007 decision 6);
  - the client uploads the `File` bytes unmodified and never draws a photo to a
    canvas before upload; the hash therefore binds the uploaded artifact and no
    document may describe it as binding the sensor output (ADR-007 Cost 1);
  - the evidence record carries a value meaning the origin is **not
    distinguished** for PWA capture; no object captured through the PWA is
    recorded with a value asserting a native camera session. This document does
    not invent the token — it belongs to
    [execution-and-evidence.md](../domain/execution-and-evidence.md) and the state
    and entity catalogs (ADR-007 decision 5). **That value does not yet exist in
    any catalog, DDL or contract**: `execution-and-evidence.md` enumerates only
    native camera, photo picker, file picker, form, import and generated
    derivative; `schema-v0.1.sql`'s `capture_origin` enum carries the same six;
    and `packages/contracts/src/uploads.ts` carries four. Every value available
    today asserts a distinguished origin, so **until the token lands no PWA
    capture may be recorded at all**, and this gate cannot close;
  - **no UI, package, render, demo, or sales sentence claims** camera-only
    capture for a blocking requirement, camera-versus-gallery discrimination,
    tamper-evident provenance, or verified capture-time GPS. Re-asserting any of
    them requires an ADR, not a UI change;
  - progress correction is append-only; whole-upload retry is idempotent;
    evidence original, hash, provenance, actors, claimed capture time and server
    receipt time are immutable, with claimed device time stored beside server
    receipt time and explicitly labelled untrusted;
  - `progress.record`, `progress.adjust` and `upload_intents.*` carry **no**
    readiness predicate — the gate never refuses to record a fact (INV-065).
- **Security tests:** adjustment root/lineage denial (INV-023/024), reservation
  invariant property tests (INV-025), upload authorization recheck and orphan
  purge (INV-046/047), storage key immutability (INV-045); occurrence
  materialisation copying `blocking_scope` rather than inferring it at read time
  (INV-066); uncovered lines refusing silent non-coverage (INV-072); the
  recording path proved free of a readiness predicate (INV-065). **INV-013,
  INV-014 and INV-053 are not claimed for the PWA path** — ADR-007 Cost 2
  re-scopes them to the native client and to v0.3, and owes
  [invariant-catalog.csv](../../technical/database/invariant-catalog.csv) the
  weaker v0.1 invariant in their place, with its own identifier.
- **Acceptance evidence:** on one physical supported iPhone and one
  lower-resource physical Android device — still required, and now the only way
  to know what the client actually does (ADR-007 "What this decision does not
  remove") — open the PWA as a foreman, read the occurrence set before work
  starts, and capture through a simulated connection loss, a backgrounded tab,
  and a retry. Prove no success is reported before the receipt and that a lost
  pending original is surfaced. Record, per browser and OS version, the measured
  behaviour of the `capture` hint, of image-metadata stripping or transcoding,
  and of site-storage eviction: none of it may be asserted from memory in any
  customer-facing artifact.
- **Closing evidence:** the device-matrix recording plus that measurement table.
  **EAS internal build installation on both platforms is no longer closing
  evidence for this milestone** (ADR-007 decision 2).
- **Exclusions:** no offline authorization, task access, background sync, or
  resumable chunks (v0.3); **no push on either platform** — and web push on iOS
  additionally requires an installed home-screen PWA, which is a v0.2 decision
  and not a solved problem (ADR-007 decision 7); no location-subtree bulk
  instantiation; no many-to-many evidence links; no stages and no closure (M3).
  No requirement content beyond Додаток Н Н.14/Н.15. **Recorded gap, older than
  this re-cut:** the route set carries no member-plane read of evidence bytes;
  the re-cut neither adds nor removes one.

## v0.1-M3 — The refusal

- **User outcome:** GoProceed **refuses** to record the closure of a hidden or
  covered stage while a `hold` requirement on it is unmet, and every refusal
  names the requirement, the missing evidence, the role that owes the decision,
  and the money that waits. Recording what actually happened is never refused.
- **Schema slice:** eight tables, **none of which has a table in any applied
  migration** — `work_stages`, `stage_closures`, `requirement_evidence_decisions`,
  `requirement_exceptions`, `requirement_exception_heads`,
  `requirement_evidence_decision_heads`, `readiness_projection`,
  `blocked_reasons`. The two heads entered v0.1 on 2026-08-06 by owner decision
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4, amendment
  note) so that INV-035 root uniqueness is enforceable for the two lineages
  `can_close_stage` reads. This is the milestone that builds the gate.
- **API slice:** the 6 `v0.1-M3` operations — `work_stages.create`,
  `requirement_exceptions.create`, `evidence_decisions.create`,
  `stage_closures.create`, `readiness.get`, `blocked_reasons.get`.
- **Exit gates — each one a refusal or an append-only fact, never a report:**
  - `can_close_stage` is implemented exactly as written in ADR-005 decision 7 and
    the closure command **refuses**; a test proves the refusal and reads its
    reason object. A screen that displays «не готово» closes nothing;
  - recording that a stage was in fact covered stays permitted under a live
    block, as does recording performed quantity and capturing evidence
    (INV-065);
  - the exception command itself rejects `not_applicable` on a `hold`; `waiver`
    and `accept_risk` remain available to an authorised actor and remain visible
    on the scope (INV-063). **This is the only escape in v0.1**: there is no
    bypass, because ADR-005 decision 5 prices a bypass in money that waits, and
    in a version with no packages there is no money to make wait (ADR-006
    decision 4);
  - `blocked_reason` is a stored object — requirement occurrence, rule version,
    missing evidence by kind and criterion, awaiting approver role, since,
    blocked value by currency, code — with the closed, versioned code vocabulary
    of ADR-005 decision 6;
  - blocked value is attributed **once per assignment** and deduplicated by
    assignment when summed (INV-070);
  - readiness stays a projection: no editable status column, and no manual
    override of a derived state;
  - while M5 is open, the rule publication command enforces that a `hold` names
    an **internal** approver role — enforced by the command, not by convention.
- **Security tests:** self-decision and self-clearance denial (INV-069),
  responsibility-versus-visibility separation (INV-021), closure denial for an
  unsatisfied `hold` (INV-061, whose `witness` half has no v0.1 form because
  `witness` is v0.2), `not_applicable` rejection with waiver and accept-risk
  still available and visible (INV-063), per-assignment deduplication of blocked
  value (INV-070), a covered stage still recordable under a live block (INV-065).
- **Acceptance evidence:** on a hand-typed baseline, create a stage; be refused
  its closure and read the `blocked_reason` object with the money behind it;
  record an `accept_risk` exception and watch the refusal lift while the
  exception stays visible and attributed; decide the occurrence internally and
  close; verify readiness recomputes and every blocker drills to authoritative
  facts.
- **Exclusions:** no internal review and no `is_package_eligible` — both move to
  v0.2 with packages, and `can_close_stage`, the half a foreman meets, is the
  half v0.1 ships; no `witness` and none of the notice apparatus; no `review`; no
  closure-without-evidence bypass and no clearance; `intervention_type` is `hold`
  only. Nothing in v0.1 may be labelled the five-working-day rule of the примітка
  to Додаток В/Г — the notice event does not exist in this version at all.

## v0.1-M4 — The act

- **User outcome:** a satisfied closure yields «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ
  РОБІТ» by the form of Додаток В (обов'язковий), assembled only from
  already-recorded facts, as a document someone can print and hand over.
- **Schema slice:** two tables, neither in any applied migration —
  `statutory_acts` and `statutory_act_versions`. **Act versions are pinned by the
  stage closure, not by a package version** (ADR-006 decision 4.5); v0.2 adds the
  package-version pin and owes the migration that applies it to acts written
  during the pilot. The freeze discipline is unchanged: an act version is
  immutable and is assembled only from recorded facts.
- **API slice:** the 6 `v0.1-M4` operations — `statutory_acts.compose`,
  `statutory_act_versions.freeze`, `statutory_acts.get`, `statutory_acts.render`,
  and, since 2026-08-18, `project_parties.create` and `party_contacts.create`.
  The render is new and is necessary: package artifacts are v0.2, so the act's
  own deterministic render is the only artifact surface in v0.1, and without it
  the milestone produces a row instead of a document. The two participant
  commands are necessary in a plainer way: the act's mandatory signatory slots
  require a `projectPartyId` and a `partyContactId`, and until they existed no
  operation could create either row — so `statutory_acts.compose` was
  unreachable on any real workspace and the milestone was green only in a
  fixture that inserted the rows by SQL.
- **Exit gates:**
  - the act is assembled **only from already-recorded facts** — progress entries
    already on the line, evidence objects already available, occurrence decisions
    already made, party data already on the participant records;
  - **there is no free-text quantity field in any render**, and the composer
    offers only `quantity_entries` already recorded against the line, with a
    share selector (ADR-005 decision 10, unchanged);
  - an act version is immutable, and repeated rendering of one frozen version is
    deterministic for a given renderer version;
  - three typed signatory slots. Nothing is printed for the технагляд's
    кваліфікаційний сертифікат серія/номер until
    [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
    allow-lists that field against the В.1/В.2 field list; prohibition E bans the
    adjacent «ким видана»;
  - every rendered decision block prints its assurance level, and a level-3
    `LINK_CONFIRMATION` record is never labelled, exported, or demonstrated as a
    signature (assurance ladder, prohibition S);
  - the довідковий disclaimer under a generated requirement list renders
    uncollapsed; the Н.14/Н.15-to-form mapping is labelled in the UI and in the
    render as the product's assumption; the footer prints the recorded date of
    last verification against the Реєстр будівельних норм (an M0 gate);
  - no normative string renders without its `verification` tag and its source
    (INV-073).
- **Security tests:** frozen-content immutability (INV-015); act renders exposing
  no free-text quantity field and refusing any normative string without a
  verification tag and source (INV-073); cross-workspace act access denial
  (INV-001/002); the composer refusing a quantity that is not an existing
  recorded entry — a refusal that carries **no invariant identifier of its own**
  today. INV-073 carries the "no free-text quantity field" rule as a rendering
  constraint; the composer-side refusal is owed a row in
  [invariant-catalog.csv](../../technical/database/invariant-catalog.csv), and
  this document does not invent its identifier.
- **Acceptance evidence:** close a satisfied stage; compose the act; freeze it;
  render twice and diff the bytes; attempt to type a quantity and be stopped by
  the absence of the field rather than by validation; check the render field by
  field against the В.1/В.2 list. **Entry evidence still owed and still absent:**
  one signed акт на закриття прихованих робіт from the target workflow,
  sanitized, so the generated draft can be checked against a document a
  practitioner already recognises.
- **Exclusions:** no packages, package versions, package lines, claim segments,
  artifacts, manifests, or manifest appendices — all v0.2; no КБ-2в (Додаток 36)
  and no КБ-3 (Додаток 37); no КЕП. **Додаток Г is not rendered in v0.1**: step 4
  names Додаток В, the ICP is MEP and electrical installation (ADR-005 assumption
  **c**), and prohibition H forbids calling electrical installations
  «відповідальні конструкції», so form Г has no v0.1 use. The mapping stays
  labelled as the product's assumption either way; no source establishes it.

## v0.1-M5 — The link

- **User outcome:** технічний нагляд opens a personal link with no account, sees
  one requirement and the evidence against it, and accepts or returns it with a
  reason.
- **Schema slice:** three tables, none in any applied migration —
  `external_access_grants`, `external_sessions` and `external_decision_batches`.
  The batch entered v0.1 on 2026-08-06 by owner decision
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4, amendment
  note): it is the carrier of the immutable receipt, the confirmation-text
  version and the idempotency record that this milestone's exit gate requires,
  and `requirement_evidence_decisions` requires it on every externally submitted
  decision
  ([schema-v0.1.sql:1278-1283](../../technical/database/schema-v0.1.sql)). The
  grant carries one scope kind in v0.1, `requirement_occurrence`; the
  package-version scope kind arrives with packages in v0.2, and INV-074's
  exclusivity rule is what makes that addition additive rather than a
  reinterpretation.
- **API slice:** the 6 `v0.1-M5` operations — `occurrence_grants.issue`,
  `external_grants.revoke_reissue`, `external.review_shell`, `external.exchange`,
  `external.occurrence_scope`, `external.occurrence_decision_submit`.
- **Exit gates:**
  - bearer token uses URL fragment, immediate history cleanup, same-origin POST
    exchange, hashed storage, redacted logs, and a short revocable session;
  - an email scanner or prefetching GET cannot consume access;
  - revoked, expired, reissued, replayed, CSRF, and wrong-target submissions fail
    safely, and a grant never crosses a workspace, project, or contract boundary;
  - the decision is named `evidence_decision` **from the first migration**, so
    adding `commercial_decision` in v0.2 is additive and no v0.1 record has to be
    reinterpreted (ADR-006 decision 5);
  - an evidence decision admits scope and **moves no money** (INV-075, first
    half; its second half has no v0.1 form, because there is no commercial
    decision to keep away from an evidence block);
  - the reviewer receives an immutable decision receipt;
  - `LINK_CONFIRMATION` is level 3 of the assurance ladder and is stated, in the
    UI and on every printed page, **not** to be an electronic signature; КЕП is
    v0.2 (ADR-005 assumption **d**);
  - from this milestone the rule publication command may accept an **external**
    approver role on a `hold`; the M3 restriction is lifted by the same change
    that ships the occurrence grant.
- **Security tests:** the external-link matrix from
  [tenancy-and-security.md](../architecture/tenancy-and-security.md) — prefetch
  non-consumption (INV-010), exchange single-use race (INV-057),
  revocation/expiry/reissue/epoch denial (INV-009/041/056), CSRF and origin
  (INV-058), observer denial (INV-031), token absence from database, logs and
  outbox (INV-044), idempotent submit (INV-007); grant scope-kind exclusivity,
  with an occurrence grant conferring no access to anything else (INV-074).
- **Acceptance evidence:** an **adversarial** технагляд (ADR-006 decision 9)
  opens the link with no account, reads the requirement in the standard's own
  wording with the photo, and returns it with a reason; the return is visible as
  a refusal on the closure; the crew corrects and the decision is retaken. A
  технагляд who refuses to open the link, refuses to decide inside it, or demands
  paper **invalidates A-3 and is recorded as a result, not as a bug**
  ([validated-assumptions.md](../discovery/validated-assumptions.md) update rule).
- **Exclusions:** no package submissions, no package-version grant scope, no
  `commercial_decision`, no decision issues, coverage, or
  prior-acceptance references; no per-segment partial acceptance; no OTP or
  reviewer accounts; no sequential approval routing; no КЕП. **The v0.1 link
  decides a requirement occurrence, not the act.** The ordering follows from
  ADR-005 decision 7: an external `hold` must be decidable before closure, so the
  decision precedes the act and the act then carries it as a recorded fact.
  Whether the технагляд also wants to see and accept the act itself inside the
  link is a pilot finding to record, and it is not built.

## v0.1-M6 — The blocked money

- **User outcome:** the owner opens one screen and sees what is blocked and how
  much money sits behind it, broken down by cause.
- **Schema slice:** none. It is a query over `blocked_reasons` and `work_items`.
- **API slice:** `blocked_value.get` — this milestone's own row in
  [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv), a member-plane query.
  *Corrected 2026-08-22: no longer the only `v0.1-M6` row — `evidence.list`
  and `external.evidence_bytes` (both Plan D slice D1) share the tag; see the note
  under the operations-per-milestone table above for why.*
- **Exit gates:**
  - the sum is over the work lines under a blocked stage, at the price on the
    published baseline, attributed **once per assignment** (INV-070), broken down
    by `blocked_reason.code`, and summed **within one baseline and never across
    baselines in different currencies**;
  - missing price, zero price, and over-contract performance stay distinct and
    are reported **beside** the sum rather than folded into it;
  - blocked value is exposure, never a receivable: v0.1 creates no accounting
    entry, no payment obligation, and no cross-currency total — ADR-001's
    financial boundary is untouched;
  - blocked value is reported beside first-time acceptance rate and
    days-to-signature and **never as the hero number** (ADR-005 assumption **b**,
    which the owner may reverse);
  - **M6 does not open until M0 is closed**, and until every field of the pilot
    record in ADR-006 decision 8 is filled — named partner, named adversarial
    технагляд, success measures, pre-gate baseline, sample, stopping conditions.
    **Every one of those fields is empty as of 2026-08-06**, and filling them is
    discovery work, not delivery work.
- **Recorded, not resolved (2026-08-06) — the two headline measures have no v0.1
  definition.** [glossary.md](../domain/glossary.md) defines first-time
  acceptance rate over **claim segments** and their **first submission**, and
  days-to-signature from the submission of a **frozen package version** to the
  terminal **commercial decision**, bounded by
  `external_decision_batches.server_received_at`. Claim segments, package
  versions, submissions and `commercial_decision` are all v0.2
  ([version-0.2.md](version-0.2.md) blocks 1 and 2) —
  `external_decision_batches` moved into v0.1-M5 on 2026-08-06 and is the one
  object of the five that did not — so as written neither measure can be
  computed in v0.1 and neither pre-gate baseline can be taken.
  This document does not invent v0.1 definitions for them — the glossary is the
  canonical term authority and owes them. Until it carries a v0.1 definition of
  each, the ADR-006 decision 8 pilot record cannot record a pre-gate baseline.
  **Corrected 2026-08-08: this read «and M6 cannot open on one».** M6 was built
  anyway, and it did not need either measure to be built —
  `blocked_value.get`'s sum, partition and drill-down are defined entirely over
  `blocked_reasons` and `work_items`. The requirement the measures carry is a
  **reporting** rule, not an input, so the sentence that is true now is **«M6
  cannot CLOSE without them»**, and this is the single M6-cannot-close blocker.
  The operation therefore ships with **no key claiming either measure** and its
  integration suite asserts their **absence**, which is the only assertion
  available that does not require inventing a definition three documents decline
  to give. **No slice of the implementation may write those definitions.** A
  second gap sits behind it and is named here so it is not discovered late: both
  baselines have to be taken from a partner's historical records, and the project
  holds **zero customer documents of any kind**.
- **Settled here, because [roadmap.md](../product/roadmap.md) §"v0.1-M6" defers
  it to this document: neither headline measure is computed inside the product
  in v0.1.** *Corrected 2026-08-22: `blocked_value.get` is no longer the only
  `v0.1-M6` row (`evidence.list` and `external.evidence_bytes`, both Plan D slice
  D1, share the tag — see the note under the operations-per-milestone table
  above); the argument is unaffected, because none of the three rows computes
  either measure.* No operation in
  [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv)
  computes or stores first-time acceptance rate or days-to-signature. Both are
  therefore **recorded beside the product**, in the pilot record of ADR-006
  decision 8, by the owner. The reporting rule binds either way: blocked value
  is reported beside them and never as the hero number. Computing either inside
  the product would add operations and the objects they read, which is a v0.2
  question and not a v0.1 one.
- **Security tests:** per-assignment deduplication in the sum (INV-070), currency
  separation (INV-012), missing/zero price distinction (INV-038), over-contract
  exclusion (INV-039), rounding reconciliation including largest-remainder ties
  (INV-011/037/055). INV-071 — value-at-risk precedence — has **no v0.1 form**:
  the seven-state projection is v0.2, five of its seven states name packaging or
  submission, and the corrected precedence applies the moment packages exist.
- **Acceptance evidence:** the pilot loop, end to end, on a named object with a
  named adversarial технагляд — a hand-typed baseline, an occurrence read on the
  phone before work started, a refused closure, an attributed exception, a
  satisfied closure and its act, an external return and its correction, and the
  blocked-money screen — measured against a pre-gate baseline for first-time
  acceptance rate and days-to-signature taken **before the gate is switched on**.
  A pilot that cannot fail cannot succeed.
- **Closing evidence:** the pilot findings document, plus the M0 evidence
  verified as still holding throughout the pilot.
- **Exclusions:** no seven-state value-at-risk projection, no acceptance
  projection, no tax-basis machinery, no receivables, invoices, payments, or FX.
  `value_at_risk.get` and `acceptance.get` are v0.2.

## v0.1-M7 — The channel

*Added 2026-09-03 by [ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md)
decision 9; the design is
[2026-08-28-telegram-project-channel-design.md](../superpowers/specs/2026-08-28-telegram-project-channel-design.md).*

- **User outcome:** a project's site participants, PTV staff and the GoProceed
  bot share one closed Telegram group chosen before activation; evidence is a
  photo sent as a reply to an assignment card; a PTV reply from the web returns
  to that group; one person who wrote there can be forgotten on request.
- **Schema slice:** fifteen tables outside ADR-006 decision 4's twenty-six,
  built by migrations `0061` through `0081` and tagged `v0.1-M7` in
  [entity-catalog.csv](../../technical/database/entity-catalog.csv), plus the
  two `app`-schema tables of `0081` (the surrogate registry and the retention
  policy). The validator's two-way build-list check does not cover this
  milestone; ADR-010's accounting pattern carries the fifteen.
- **API slice:** the ten operations named in the correction under the
  operations-per-milestone table above, authorised by ADR-011; nine on the
  member plane, `telegram_webhook.accept` on the provider ingress.
- **Exit gates:** ADR-011 decision 10 — the M0 gates the channel engages
  (1, 2, 3, 4, 5, 7, 8, 9, 11 and 12) close with recorded evidence; the
  identity-level deletion procedure of gate 4 is exercised
  ([2026-09-03-telegram-identity-erasure-gate.md](../superpowers/plans/evidence/2026-09-03-telegram-identity-erasure-gate.md));
  and before any environment enables the webhook: Task 13's edge rate limit,
  the real-group staging pass, the scheduler, and the assignment card carrying
  the verification tag and the source of every normative string it renders
  (gate 9, ADR-011 open item 9). *[The card half landed 2026-09-08 and leaves
  that list; the edge limit, the staging pass and the scheduler stay on it. The
  same gap in the second Telegram renderer — the requirement-choice button —
  was found by the review of that change and closed with it (migration `0084`),
  so it never joined the list.]* M0's real-data rule applies as it does to M6:
  no real group until M0 is closed.
- **Evidence today:** built and merged to `main` (`7bf8e4b`, 2026-09-03);
  the erasure gate record is the only gate record; deployed nowhere; the
  webhook is enabled in no environment.

## Cross-milestone rules

Every milestone closes with tenant-isolation tests and one working vertical
scenario through the UI/API/database boundary. Discovery entry evidence precedes
each irreversible schema or UX freeze.

From M3 onward a milestone also closes with at least one **refusal** proved by
test — a closure denied and named, a `not_applicable` rejected on a `hold`, an
external decision returned. A screen that displays «не готово» closes nothing.
Weakening any of these refusals requires a superseding ADR, not a backlog item
(ADR-005 replacement rule).

**Adding a capability back into v0.1 requires an ADR, not a backlog item.** "It
is already specified", "it is already in the DDL", "the catalog already has the
row", and "it is only one more table" are each explicitly not reasons; the test
is ADR-006 decision 1 — name the numbered step it is necessary for.

**What v0.1 may not claim.** ADR-005 decision 1 blocks two recorded acts, and
v0.1 ships the first and not the second. The positioning sentence «Ми не блокуємо
роботу на майданчику — ми не даємо її пред'явити до оплати, поки доказ не
отримано і не погоджено» may be used only alongside an explicit statement that
payment-presentation eligibility is not in v0.1, and **no demonstration may show
a payment-presentation refusal that does not exist.**

## Two migrations owed to v0.2

Recorded here because work written during a pilot is the work most likely to be
looked at later, and both are silent failures if forgotten (ADR-006
consequences):

1. every `hold` written during v0.1 with `blocking_scope = blocks_stage_closure`
   is widened to `blocks_both` when packages ship, with a test that fails if one
   v0.1 row is left behind. Without it, every requirement recorded during the
   pilot sits permanently outside the payment-eligibility half of the gate;
2. every act version written during v0.1, pinned by its stage closure, gains its
   package-version pin when packages ship, with a test that fails if one is left
   behind.

## Corrections owed elsewhere

This document is the delivery view; it does not silently rewrite the artifacts it
now disagrees with. Each is a correction owed, and delivery of a slice that
depends on one stops until it lands ([docs/README.md](../README.md) §"Source of
truth"). **A row leaves this table when it lands**, because a correction recorded
as owed after it is done stops delivery on nothing and buries the rows that
genuinely do. Eight rows left on 2026-08-06 — four with the re-cut, and four more once the
audit fixes landed: the route-set count, the entity catalog's deployed-table
rule, the invariant re-scoping and the two headline measures. The
four that left with the re-cut were the roadmap's seventh milestone and
its replaced store-distribution gates, `scope-and-boundaries.md`'s
included-capabilities list, and `production-readiness.md`'s evidence format,
which no longer points at "the v0.1-M6 entry checklist" and now points at the M0
record below.

**The 26-table row was removed twice on 2026-08-06 and is recorded here once,
because the first removal was wrong.** The owner's decision closed the
*question* — whether the two requirement heads and the external decision batch
belong to v0.1 — but it performed none of the *edits* it required, and the row
was struck while roughly twenty documents and catalogs still enumerated
twenty-three tables, still tagged the three rows `v0.2`, or still stopped M3 on
a conflict that no longer existed. Emptying the table asserted that none of that
was outstanding and removed the one mechanism that would have shown it without
an audit. The edits then landed on 2026-08-06 across the ADRs, the product,
domain, architecture and delivery documents, the five catalogs and
`scripts/validate-canonical-docs.mjs`, and each was verified against
`technical/database/schema-v0.1.sql` and the applied migrations rather than
against a sibling document. Only then did the row leave. What guards it now is
mechanical rather than editorial: the validator's guards 11–13 fail if the
transcribed build list, ADR-006 decision 4's milestone table, `roadmap.md`'s
milestone table and this document's own `v0.1 tables` column stop enumerating
the same twenty-six names.

| Artifact | What must change |
|---|---|
| ~~The M2 migration that activates `upload_intents.requirement_occurrence_id`~~ **LANDED 2026-08-08, and by this table's own rule the row leaves — it is struck rather than deleted because it was the last one and an empty table is a claim.** `supabase/migrations/0043_the_obligation_before_the_covering.sql:808-814` states it in the migration's own header and the column comment at `:839-841` repeats it on the object: the FK is added in `0043`, `0015:251` said M3, and `requirement_occurrences` is M2. The applied migration is untouched, which is the only place the correction could have landed. **Written, not applied** — `0043` is one of ten files (`0041`–`0050`) that have never run, so the corrected comment is in the repository and not in any database. | ~~Its comment must correct the one in the applied migration it completes.~~ Done; nothing outstanding. |

**This table is now empty of open rows, and that is a statement about corrections owed ELSEWHERE — not about this document being correct.** Two of the eight rows that left on 2026-08-06 were struck once and had to be re-opened because the decision had closed the question while none of the edits had been made. What replaced editorial discipline there was mechanical: the validator's guards 11–13. Nothing mechanical guards the rows that were here. The 2026-08-08 documentation sweep found four corrections owed to artifacts outside its own remit and they are recorded where a slice will meet them rather than here — `technical/openapi/README.md`'s claim that the `public` plane «can never consume a grant» (false: `external.exchange` is the only thing that consumes one), and the three catalog rows that describe the work-type write refusal without naming INV-090. See [TODOS.md](../../TODOS.md) §"Opened by the v0.1 M1–M6 build".
