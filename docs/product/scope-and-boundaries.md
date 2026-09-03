# Scope and boundaries

**Status:** Approved

**Applies to:** v0.0 and v0.1

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


> **Target, not runtime.** Everything listed under "v0.1 included capabilities"
> is an approved target. None of the readiness gate exists in the runtime today:
> a work assignment carries at most one optional nullable template pointer
> (`supabase/migrations/0015_execution_evidence_module.sql:85`), the requirement
> occurrence exists only as a placeholder column whose table is explicitly
> deferred (`supabase/migrations/0015_execution_evidence_module.sql:251`), and
> the template's `severity` and `timing` columns are frozen into a publish-time
> hash and read by no application code
> (`supabase/migrations/0015_execution_evidence_module.sql:45-46`).
> [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4 records that
> seventeen of the twenty-six tables v0.1 needs have no table in any applied
> migration — amended 2026-08-06 from fourteen of twenty-three, when the two
> requirement lineage heads and the external decision batch moved into v0.1.
> Implementation status belongs to delivery evidence and migration
> verification, never to this document.
>
> *(Qualified 2026-08-08 — «deployed» and «written» have come apart, and every sentence above
> is about the first. All of it is still exactly true of the **applied** migrations, `0001`–`0040`,
> which define 33 tables. Migrations `0041`–`0050` are ten files written on an uncommitted branch and
> **applied nowhere**; between them they carry `create table` for **seventeen of the twenty-six** v0.1
> tables, plus every CHECK, trigger, policy and grant the readiness gate is made of. Having DDL is not
> existing, and none of the ten files has ever been executed.)*

> **What changed on 2026-08-06, and on whose authority.**
> [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) re-cuts v0.1 to six steps
> and moves the commercial half of the loop to v0.2.
> [ADR-007](../decisions/ADR-007-pilot-field-client.md) makes the v0.1 field
> client a PWA instead of the Expo client. Both are made **on the owner's
> instruction of 2026-08-06**. Neither is made on the founder-reported market
> signal of 2026-08-05, which
> [validated-assumptions.md](../discovery/validated-assumptions.md) forbids from
> driving a roadmap change, a capture-UX decision, or a positioning sentence, and
> which is not cited anywhere in this document as a reason for anything.
>
> Every capability this document previously listed inside v0.1 and no longer
> lists is in [Not included in v0.1](#not-included-in-v01) with a **named owning
> version and the reason it moved**. None is cancelled, none loses its
> specification, its DDL, or its catalog rows, and no migration drops a table for
> one of them.

## Release boundary

v0.0 makes the foundation safe and reproducible. v0.1 is the smallest whole
thing a subcontractor can use unaided: it closes the online
contract-to-act-to-external-decision loop and stops there.
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) amended the
ADR-001 loop by binding requirements at baseline publication and inserting a
stage-closure step; [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md)
truncates its reach:

```text
contract baseline, with requirement rule versions bound at publication
→ assignment, with requirement occurrences materialised and visible before work
→ performed quantity, and evidence against requirements already known
→ closure of the hidden or covered stage, and the statutory act it produces
→ external evidence decision on a protected link
```

The remainder of the ADR-001/ADR-005 loop — internal review, the immutable
package version frozen only from eligible scope, the separate commercial
decision, partial acceptance, and derived acceptance value at risk — is **v0.2**.
The loop is unchanged in shape and shorter in reach.

### The six steps that are v0.1

1. **The object.** ПТВ creates an object, enters the work lines **by hand**,
   picks a work type, and the requirements load from the shipped ДБН library at
   [`dbn-a31-5-2016-dodatok-n.csv`](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv).
2. **The phone.** The foreman opens the field client and sees what must be
   photographed **before covering**, in the standard's own wording, with a
   reference image. He takes it. That is the whole interaction.
3. **The refusal.** The stage cannot be recorded as closed while a `hold`
   requirement on it is unmet, and the attempt names exactly what is missing.
4. **The act.** «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ» by the form of Додаток В,
   assembled only from already-recorded facts.
5. **The link.** Технічний нагляд opens a personal link with no account and
   accepts or returns with a reason.
6. **The money.** The owner sees what is blocked and how much money sits behind
   it — a sum over the manually entered lines with a breakdown by cause.

**No feature belongs to v0.1 unless a numbered step above cannot happen without
it.** "It is already specified", "it is already in the DDL", "the catalog already
has the row", and "it is only one more table" are each explicitly not reasons
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) replacement rule 1). Adding
a capability back into v0.1 requires an ADR, not a backlog item.

### What the gate blocks, and what it does not

No software can stop a crew. The product blocks exactly two recorded acts: the
recorded closure of a hidden or covered stage, and the eligibility of performed
quantity to enter a package version for acceptance and payment. It never refuses
to record a fact — performed quantity, evidence capture, and the fact that a
stage was in fact covered are always recordable, including when they happened
wrongly.

**v0.1 ships the first of those two blocks and not the second**, because v0.1 has
no package versions. That is the main cost of the re-cut and it is stated here so
that no product document, landing page, or demonstration has to discover it.
Where positioning is stated, this sentence is used verbatim:

> «Ми не блокуємо роботу на майданчику — ми не даємо її пред'явити до оплати,
> поки доказ не отримано і не погоджено.»

Until packages ship in v0.2, that sentence may be used **only alongside an
explicit statement that payment-presentation eligibility is not in v0.1**, and
**no demonstration may show a payment-presentation refusal that does not exist**
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) Consequences).

Two further limits on how the gate may be said. ДБН А.3.1-5:2016 п. 8.4.3.4 reads
«В усіх випадках **забороняється** виконання наступних робіт до підтвердження…»;
quoted verbatim, which is the only form the allow-list permits, it addresses the
performance of subsequent **work**, and no product document may restate it as a
duty, a prohibition, or any other characterisation of legal effect. No statutory
rule was found that forbids paying without an act on hidden works; the bridge
between evidence and money runs through the contract. And no product document may
sharpen the positioning into a claim that no other product blocks payment —
Oracle Textura, Payapps and Procore Pay all do. What is claimed is the **input**
of the gate, an agreed inspection on a priced line, not the mechanism
([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) Context).

## v0.0 foundation

v0.0 includes:

- canonical product, domain, architecture, and delivery documentation;
- explicit dispositions for legacy sources;
- tenant isolation for the existing foundation;
- permission-aware own-party management;
- serialized first-owner bootstrap;
- append-only audit enforcement;
- bounded, expiring idempotency records;
- real outbox claim, retry, backoff, error, and dead-letter behavior;
- environment-safe development seeds;
- deny-by-default future database privileges;
- resolved dependency build-script policy;
- a reproducible local database and green baseline test command;
- verified migration and rollback paths for additive changes.

v0.0 does not claim that the v0.1 domain already exists.

## v0.1 included capabilities

v0.1 is delivered through **eight milestones** (seven by ADR-006 decision 3; M7 added 2026-09-03 by [ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md) decision 9)
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 3): M0 *fit to
hold someone else's data*, M1 *the object and what it owes*, M2 *the phone*, M3
*the refusal*, M4 *the act*, M5 *the link*, M6 *the blocked money*. Every
capability below names the milestone that owns it, and every one of them is here
because a numbered step cannot happen without it.

### M0 — Fit to hold someone else's data

This is the cross-cutting minimum that must be complete **before real pilot data
enters GoProceed**. It was previously a floating list at the end of this document
with no owner and no milestone; a list with no milestone is a list that gets done
last, and on a one-person project a list that gets done last is a list that gets
done never ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 7).

**Twelve exit gates, and twelve is eight plus four** — the eight cross-cutting
items below, then the four carried by
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) and
[hidden-works-content-rules.md](hidden-works-content-rules.md). The list is
unchanged in content from the one it replaces, and
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 7 enumerates it
item for item: **items 7 and 8 are two gates and not one**, the
export-formula-injection half of item 12 is not optional and is not inferable
from a shortened wording, and the ДБН retrieval record is **not a thirteenth
gate** — it is what closes item 9. A document that says "twelve **plus** four",
that reaches sixteen, or that counts a merged pair as one gate is contradicting
that decision.

- privacy notice and versioned external confirmation text;
- documented retention periods and manual closure/deletion procedure;
- workspace export;
- restricted audit and security telemetry;
- backup and restore verification;
- documented external-link assurance limits, including an explicit statement in
  the UI and on every printed page that link confirmation is not an electronic
  signature;
- secrets and environment separation;
- monitored job and message failure paths;
- no normative string renderable without its verification tag **and its source**,
  enforced in storage rather than in a template, so that an unsourced line cannot
  be added to Н.15 by editing a view. **What closes this item for the shipped
  library is the retrieval record for the primary ДБН file** — exact URL,
  retrieval date, and SHA-256 of the bytes, committed under
  `technical/requirements/`. Every `VERIFIED_PRIMARY` row rests today on one
  download no reviewer can reopen, which by
  [hidden-works-content-rules.md](hidden-works-content-rules.md)'s own vocabulary
  leaves the tag asserted and the source gone; a re-fetch that does not reproduce
  the same bytes downgrades every row it touches to `VERIFIED_SECONDARY`. It is
  **not a thirteenth gate** ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md)
  decision 7);
- a recorded date of last verification against the Реєстр будівельних норм,
  printed in the disclaimer on every generated act;
- tenant-isolation tests for every module;
- malware/content-type and resource-exhaustion controls for uploads/imports,
  including the formula, macro, archive, file-size, worksheet, and row safety
  limits of the frozen importer and export neutralization against spreadsheet
  formula injection — the workspace export above is what makes the second one
  a v0.1 obligation rather than a package concern.

Three rules about M0:

- it is numbered **0, not 5.5**, deliberately. It may be built in parallel with
  M1–M5, but it is not allowed to be last;
- **M6 cannot open until M0 is closed**, and closure means recorded evidence per
  item, not a checklist someone has read;
- its owner is the owner. There is one person, so naming anyone else would be
  fiction; what M0 adds is that the absence of an owner can no longer be the
  reason the list is not done.

### M1 — The object and what it owes

**Workspace, parties, and access**

- one workspace with several of its own legal entities;
- official legal profile and EDRPOU per own entity;
- projects that may contain contracts of different own entities;
- tenant-local counterparties and contacts — step 5 sends a personal link to a
  named технагляд, and a contact is how that person is named;
- workspace governance roles, separate project access, and composable
  responsibility assignments — the six steps are performed by four different
  people, and the waiver/accept-risk exception of M3 requires an *authorised*
  actor, which is a permission question and not a convention.

**Contract baseline**

- one own party and one customer party per contract;
- draft and immutable published contract versions;
- the requirement rule-version set pinned at baseline publication, alongside the
  party, currency, tax, terms, and approval-policy snapshots of ADR-002;
- **no baseline is published in v0.1 without a rule-version set.** Merging the
  rule half of the old M2 into M1 closes the contradiction
  [roadmap.md](roadmap.md) recorded — that a baseline published in M1 could never
  acquire a binding, because rules bind at publication and published versions are
  immutable. The milestone that publishes a baseline is now the milestone that
  binds its rules.

**Manual work-line entry — a first-class capability**

- ПТВ enters the acceptance-relevant work lines **by hand**: code, description,
  section, unit, quantity, unit price, amount, currency, tax basis, and external
  identifiers;
- a manually entered line carries its own provenance — the actor, the server
  time, and the fact that it was entered rather than imported — and gets the same
  schema quality and the same tests as an imported line;
- it is what the six steps are demonstrated on, and it is what the blocked-money
  sum of step 6 is computed over.

**This is not a stopgap for a missing importer and no document may describe it as
one** ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 2).

**Contract-baseline import is frozen, not deleted**

- **Frozen means** the XLSX/CSV importer built in M1 stays in the code exactly as
  it is. No migration drops its tables, no code path is removed, nothing is
  archived, and an object created by import continues to work.
- **What changes** is that no further import work is v0.1: no column-mapping,
  unit-inference, or number-format work, no АВК-5 adapter, no extension of
  reimport diff and lineage, and no customer artifact as an entry condition for a
  milestone that already shipped.
- **Why.** There are **zero customer documents of any kind** — no example акт, no
  кошторис, no КБ-2в, no виконавча документація
  ([validated-assumptions.md](../discovery/validated-assumptions.md)). That
  document makes **A-6 the sharpest open risk in the project, ahead of A-1**, and
  it does so without depending on any market signal: the import schema was
  specified against no real file, while the roadmap made a representative
  sanitized artifact an *entry* condition for M1, which shipped without one.
  Every further hour spent on column mapping, unit inference, or number-format
  handling is an hour spent guessing at a file nobody has seen.
- **What unfreezes it:** one real sanitized кошторис, АВР, or interim-works file
  from a named company, recorded in
  [validated-assumptions.md](../discovery/validated-assumptions.md) with the
  company and the date. One file is enough to unfreeze; it is **not** enough to
  validate, and resuming import work without one is a decision to build against
  an assumption that must be written down as such
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) replacement rule 3).
- **The frozen surface, described rather than deleted.** XLSX and CSV import of
  acceptance-relevant work rows — code, description, section, unit, quantity,
  unit price, amount, currency, tax basis, optional location, and external
  identifiers — carrying file hash, parser version, mapping version, worksheet,
  source row, raw values, normalized preview, validation, and explicit publish
  confirmation, with reimport as a new version producing diff and work-item
  lineage. **That provenance standard is the one manual entry must match**, and
  it is why manual entry is a first-class capability rather than a cheaper path.
  Its optional location column is part of the frozen surface and is not a v0.1
  capability: `locations` and the location axis are v0.2, and freezing the
  importer is what keeps that column from becoming v0.1 work.
- **Which of those behaviours are deployed is not stated here.** Applied
  migrations and delivery evidence answer that question
  ([docs/README.md](../README.md) precedence level 1); this document states only
  that the surface is frozen at whatever M1 built.

**Requirement rules, intervention, and blocking scope** — merged into M1 from the
old M2, because the rules must exist before a baseline can bind them:

- requirement rules as a predicate over **work type and stage**, yielding an
  **ordered set** of requirements;
- each requirement carrying evidence kind, acceptance criterion, norm reference,
  performer role, approver role, intervention type, and blocking scope;
- immutable rule versions, publish and retire only, never updated, referenced by
  an occurrence through a stored rule-version identifier and never a live
  pointer;
- **`intervention_type` is `hold` only in v0.1.** The CHECK keeps all three
  values and the publication command rejects `witness` and `review`, so v0.2 is
  additive and no v0.1 record is reinterpreted;
- **a v0.1 `hold` is `blocks_stage_closure`, not `blocks_both`**, because the
  other half of `both` has nothing to block. The publication command rejects any
  `hold` that is not `blocks_stage_closure`. The four-value scope —
  `none`, `blocks_stage_closure`, `blocks_package_inclusion`, `blocks_both` — is
  stored on the rule version, materialised onto the occurrence, and never
  inferred from a severity word at read time;
- `hold` is never markable not-applicable; waiver and accept-risk exceptions
  remain available to an authorised actor and remain visible;
- the **dry run** that previews generated names, counts matches per rule, and
  prints an **explicit list of uncovered lines as part of the command output**,
  not as a report someone may choose to run. A work type with no matching rule
  must be named, because silent non-coverage means there is no gate;
- the shipped requirement library for Додаток Н positions **Н.14** (five items)
  and **Н.15** (seven items) — twelve items, all `VERIFIED_PRIMARY`, in
  [`dbn-a31-5-2016-dodatok-n.csv`](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv)
  — each string carrying its verification tag and source in the data;
- anything the product recommends beyond Додаток Н stored in a separate block
  labelled «Додатково рекомендуємо (не з Додатка Н)» carrying no normative
  citation.

Two limits belong to the scope statement itself. The library is **довідковий**:
the binding list for a site comes from робоча документація (п. 8.4.3.3), the
generated list carries that disclaimer uncollapsed, and
[hidden-works-content-rules.md](hidden-works-content-rules.md) governs every
regulatory string without exception. And **the notice-duration limit survives its
capability**: when the working-day calendar and the notice ship in v0.2, a
configured duration is a workspace setting and must not be labelled as the
five-working-day rule, because calendar days and робочі дні produce different
dates.

**One migration is owed to v0.2 and must not be forgotten.** The v0.2 package
milestone carries a migration that widens every `hold` written during v0.1 from
`blocks_stage_closure` to `blocks_both`, with a test that fails if one is left
behind. Without it, every requirement recorded during the pilot is permanently
outside the payment-eligibility half of the gate, and nobody would notice.

### M2 — The phone

- work assignments with optional member assignee and due date;
- performer party and planned quantity;
- **requirement occurrences materialised when the assignment is created**, with
  no evidence yet linked — projection `requirement_occurrence.review =
  occurrence`, never a stored status column. "Known in advance" is a claim about
  time: a placeholder created after covering is not advance notice;
- the field client showing each occurrence, its acceptance criterion, its
  intervention type, and a **reference image**, **before work starts**. The
  reference image freezes with the rule version that carries it, so the picture
  the foreman was shown is the picture that can be produced later. **No reference
  image exists yet** — the shipped library CSV carries no image column and the
  repository holds none — and sourcing them is v0.1 work. A reference image is a
  product illustration, never normative content: it carries no clause citation
  and may not be presented as part of Додаток Н;
- append-only performed-quantity entries and referenced corrections;
- idempotent whole-upload retry and visible send states — the six live client
  states already fixed in
  [`state-catalog.csv`](../../technical/states/state-catalog.csv)
  (`not_sent`, `sending`, `awaiting_receipt`, `server_confirmed`, `failed`,
  `discarded`), because a user still needs to tell not-sent from sending from
  confirmed from failed;
- immutable evidence hashes, provenance, recorder, performer, source party,
  custodian, device-claimed capture time, and server receipt time;
- originals, derivatives, and corrections. **Many-to-many evidence links are
  v0.2**: `evidence_links.create` and its link table left v0.1 with the
  commercial half ([`scope-v0.2.csv`](../../technical/openapi/scope-v0.2.csv)),
  and in v0.1 one original is bound to one occurrence by the upload intent it was
  captured under (`upload_intents.requirement_occurrence_id`).

**The v0.1 field client is a PWA served from `apps/app`**
([ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 1). It is an
authenticated member surface behind the same BFF boundary the web product already
uses, and it does **not** merge with the protected external review shell, which
keeps its own discipline unchanged. `apps/mobile` stays in the tree and is not on
the v0.1 path.

**Capture is online-only and a pending original is not durable**
([ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 6). The client:

- never reports success before the receipt — `upload_received` is not
  `evidence_available`, and no screen shows a photo as recorded until the
  `available` receipt is persisted;
- uploads immediately rather than presenting a durable local queue, and does not
  offer a queue affordance it cannot honour;
- **warns rather than silently losing bytes.** If an upload cannot complete, or
  the page is about to be left with an in-flight or unsent original, the user is
  told plainly that GoProceed has not saved the photo and that it must be retaken
  or kept by them. A silent loss is the one outcome v0.1 must not produce;
- discards the in-memory original on logout, revocation or account switch, and
  says so.

**What v0.1 may claim about a captured photo, and what it may not**
([ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 5). May be
claimed, and this is all that may be claimed:

- a client-computed content hash, verified at finalization against the bytes the
  server received. It proves the object was not altered between declaration and
  receipt; it proves nothing about where the bytes came from;
- a server receipt time, generated by the server and never by the client;
- a device-claimed capture time, stored beside the server time and **explicitly
  labelled untrusted**.

May **not** be claimed in the UI, in a package, in a demo, or in a sales
sentence: camera-only capture for blocking requirements; that a photo is
distinguishable as camera-taken rather than gallery-supplied; tamper-evident
provenance; verified capture-time GPS. The evidence record's origin method needs
a value meaning **not distinguished**; **that value does not yet exist in any
catalog, DDL or contract, and until it does no PWA capture may be recorded at
all.** The deployed enum offers only `native_camera`, `photo_picker`,
`file_picker`, `form`, `import` and `generated_derivative`
(`supabase/migrations/0015_execution_evidence_module.sql:254-255`,
[`schema-v0.1.sql`](../../technical/database/schema-v0.1.sql) `capture_origin`),
and `packages/contracts/src/uploads.ts` accepts the first four — every one of
which asserts a distinguished origin. Adding the value is M2 work owned by the
domain layer and the catalogs ([ADR-007](../decisions/ADR-007-pilot-field-client.md)
decision 5); no object captured through the PWA may be recorded with a value that
asserts a native camera session. The client
uploads the `File` bytes unmodified and never draws a photo to a canvas before
upload — but it can only promise that *it* did not transform the bytes, not that
the browser did not, so the hash binds the uploaded artifact and never the sensor
output.

**The physical device inventory is not removed and matters more, not less.** One
supported iPhone and one lower-resource Android device are still required, and
the iOS 16.4+ / Android 10+ support floor is still an assumption until confirmed
against them before the M2 capture-UX freeze. Browser behaviour on EXIF, on the
`capture` attribute, and on storage eviction varies by engine and version in ways
a native camera API does not, so the inventory is now the only way to know what
the client actually does. What ADR-007 removes is the **distribution** chain, not
the testing.

### M3 — The refusal

- stages as the closable unit — one assignment, one stage from the published
  vocabulary, flagged concealed or not;
- append-only stage closures carrying actor, server time, and the result of the
  closure predicate;
- **the refusal itself**: `can_close_stage`, a written and testable predicate,
  derived, with enumerated recomputation triggers and no editable status column.
  The command refuses; it does not warn, flag, or produce a red count;
- the refusal **names exactly what is missing** — the block reason as a
  **structured object**: requirement occurrence, rule version, missing evidence,
  awaiting approver role, since, blocked value in the baseline's currency, and a
  code from a closed versioned vocabulary. Two of that vocabulary's codes cannot
  occur in v0.1 — `CLOSED_WITHOUT_ACT`, because there is no bypass, and
  `NOTICE_PERIOD_NOT_ELAPSED`, because there is no witness notice. The vocabulary
  keeps both values, so v0.2 is additive;
- blocked value attributed **once per assignment**, so several unmet requirements
  on one work never inflate the sum, preserving the rule at
  [`38-business-logic-closure.md`](../legacy/38-business-logic-closure.md) §8;
- append-only internal evidence/requirement decisions on an occurrence;
- append-only waiver, not-applicable, and accept-risk exceptions, with
  `not_applicable` **rejected for a `hold` requirement by the exception command
  itself**, not by convention.

**The exception is the only escape in v0.1, and there is no bypass.** ADR-005
decision 5 is unchanged and unshipped: the price of a closure-without-evidence
bypass is that the money waits, and in a version with no packages there is no
money to make wait, so shipping it would ship a defeat that costs nothing. What
ships instead is the ADR-005 exception — `waiver` and `accept_risk` by an
authorised actor, attributed and visible. One attributed, visible escape exists,
which is what ADR-005's argument against an absolute lock actually requires.

### M4 — The act

- a **draft act** produced by closing a concealed stage whose requirements are
  satisfied, strictly by the form of **Додаток В (обов'язковий)**
  ДБН А.3.1-5:2016, titled «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ»;
- act content assembled **only from already-recorded facts** — progress entries
  already on the line, evidence already available, occurrence decisions already
  made, party and certificate data already on the participant records — with no
  free-text quantity field in any render, and a composer that offers only
  quantity entries already recorded against the line, with a share selector;
- **immutable act versions, pinned by the stage closure.** In v0.1 the closure is
  the pin; when packages arrive in v0.2 the package version pins them
  additionally. The freeze discipline is unchanged: an act version is immutable
  and assembled only from recorded facts;
- a corrected act after a return is a **new version threaded to its predecessor
  act**, which is why both `statutory_acts` and `statutory_act_versions` ship
  rather than versions alone;
- three typed signatory slots per п. 8.4.3.5. The технагляд's кваліфікаційний
  сертифікат (ПКМУ № 903, п. 3) is held on the participant record; **whether
  Додаток В has a field for its серія and номер is not established**, so nothing
  is printed into the form for it until
  [hidden-works-content-rules.md](hidden-works-content-rules.md) allow-lists that
  field against the В.1/В.2 field list, and prohibition E bans the adjacent «ким
  видана»;
- the required disclaimers of
  [hidden-works-content-rules.md](hidden-works-content-rules.md) on every page,
  including the recorded date of last verification against the Реєстр будівельних
  норм (an M0 exit gate).

**v0.1 renders form В only.** Додаток Г, the separate template for responsible
structures, is v0.2: scope assumption **c** limits v0.1 to MEP / electrical
installation, and prohibition **H** forbids calling electrical installations
«відповідальні конструкції», so no v0.1 step reaches form Г. Prohibition **G**
binds unchanged even with one form on screen: neither ДБН А.3.1-5:2016 nor
ДСТУ 9258:2023 says which Н position takes which act, so the product must not
assert that В is the correct form for a given Н.14/Н.15 position — any such
mapping is the product's assumption and is labelled as such in the UI and in the
render. Adding a Додаток Н item, a Додаток В field, or a clause number through
any route other than
[hidden-works-content-rules.md](hidden-works-content-rules.md) is prohibited
regardless of which document requests it.

### M5 — The link

- personal protected email link with no workspace account and no separately
  entered code;
- fragment-to-POST token exchange and short revocable session;
- a **requirement-occurrence grant scope** — in v0.1 the only grant scope — so an
  external `hold` approver decides on the occurrence and the act it produced,
  with the grant discipline of ADR-003 otherwise unchanged and grants still
  unable to cross workspace, project, or contract boundaries;
- a single **`evidence_decision`** (quality and compliance — технагляд): accept,
  or return. It is **named `evidence_decision` from the first migration**, so
  adding `commercial_decision` in v0.2 is additive and no v0.1 record has to be
  reinterpreted;
- link confirmation recorded with IP and server time, at **level 3** of the
  assurance ladder in
  [hidden-works-content-rules.md](hidden-works-content-rules.md), stated plainly
  in the UI and on every printed page **not to be an electronic signature**. The
  admissibility argument rests on Law № 2155-VIII art. 17(7), which is carried as
  `UNVERIFIED` and may not be printed; v0.1 prints only the negative statement,
  which asserts nothing and therefore needs no source.

**One obligation this milestone must close before it ships.** Step 5 requires a
return to carry a reason. The return reason's vocabulary is **not enumerated
anywhere in this package** — unlike the block-reason vocabulary, which is closed
and listed — so no document may describe it as a closed set. It must be
enumerated in [`state-catalog.csv`](../../technical/states/state-catalog.csv) as
a `stored_vocabulary` machine and in [glossary.md](../domain/glossary.md), or the
return must record free text plus the requirement occurrence it concerns and say
so, before the decision command ships. This is the same discipline ADR-005
applies to the bypass reason code.

### M6 — The blocked money

- **the sum**: the amount of the work lines under a blocked stage, at the price
  on the published baseline, attributed **once per assignment**, broken down by
  `blocked_reason.code`;
- summed **within one baseline and never across baselines in different
  currencies**, and never through a hidden exchange conversion;
- **missing price, zero price, and over-contract performance stay distinct** and
  are reported beside the sum rather than folded into it;
- drill-down from project summary to the exact contract, work line, stage, and
  blocking occurrence;
- first-time acceptance rate and days-to-signature as the headline measures, with
  blocked value reported beside them and never as the hero number.

M6 adds no table: it is a query over `blocked_reasons` and `work_items`. Blocked
value is exposure, never a receivable. The financial boundary of ADR-001 is
unchanged and is easier to keep, not harder: v0.1 creates no accounting entry, no
payment obligation, and no cross-currency sum.

**The pilot is an object, not a date.** M6 does not open until M0 is closed and
until the pilot record of
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 8 is filled — named
partner, the технагляд, success measures, a pre-gate baseline, a sample written
down before the first act, and stopping conditions in both directions. **Every
field is empty as of 2026-08-06**, and filling them is discovery work, not
delivery work. The технагляд must be **adversarial**: a gate is a refusal, a
refusal is only observable when someone wanted to pass, and a pilot with a
compliant технагляд produces a clean run, a happy customer, and no evidence
whatsoever about the product's only differentiator. Choosing a loyal технагляд
for the first pilot requires an ADR that supersedes that decision.

## Size decision: what left v0.1, and what it costs

**The previous version of this section said "Nothing was removed. v0.1 is now
larger." That is retired.** Things are removed now, and the honest accounting is
below.

[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4 puts v0.1 at
**twenty-six tables of the 86** in
[`schema-v0.1.sql`](../../technical/database/schema-v0.1.sql); nine already have
a table in an applied migration, so v0.1 builds **seventeen** — amended
2026-08-06 from twenty-three and fourteen (ADR-006 decision 4, amendment note).
Three tables moved in, for two different reasons:
`requirement_exception_heads` and `requirement_evidence_decision_heads` (M3),
so that the two lineages `can_close_stage` reads can be serialised in the
version that reads them and a fork or a second root decision stays
unrepresentable; and `external_decision_batches` (M5), which serialises no
lineage and is there because it is the carrier of the occurrence-scoped receipt,
the confirmation-text version and the idempotency record. The
owner's instruction set a target of roughly 15–18 tables and the disciplined
list is 26; that gap is stated rather than hidden, and it **widened** on
2026-08-06 rather than closing. The two nearest further cuts were
considered and not taken: dropping `upload_intents` costs the whole-upload retry
contract, and a foreman who loses a photo in a basement has no reason to open the
app again; dropping `statutory_acts` and keeping only its versions leaves a
corrected act with no thread to its predecessor.

**Moving to v0.2 is not deletion.** Everything in the next section keeps its
specification, its DDL, and its catalog rows, and no migration drops a table for
it. **Eleven** of the moved objects already have a table in an applied migration
— `party_legal_profiles`, `own_legal_entity_profiles`, `party_contacts`,
`project_parties`, `project_access_grants`,
`project_responsibility_assignments`, `locations`, `unit_definitions`,
`progress_allocation_heads`, `valuation_allocations`, and `capture_events` — and
they stay exactly where they are. What moves is the **work**, not the row, and no
catalog may re-tag a deployed table to a future version.

**One reduction candidate that was previously "not decided here" is now
decided.** The decision-coverage and partition machinery in
[packages-and-acceptance.md](../domain/packages-and-acceptance.md), which the
[package review](../delivery/package-review-2026-08-04.md) §6 calls correct and
far ahead of any evidence that a pilot needs it, moves to v0.2 with packages.

Three things stay retired, and they are **replacements, not savings**:

| Retired from v0.1 | Replaced by |
|---|---|
| one nullable requirement-template version pinned per assignment (`supabase/migrations/0015_execution_evidence_module.sql:85`) | rule versions bound at baseline publication and occurrences materialised per assignment |
| the free `severity` axis, `blocking`/`advisory` (`supabase/migrations/0015_execution_evidence_module.sql:46`) | explicit blocking scope, with `none` as the successor of `advisory` |
| freeze that filters unready scope out of the compilation | freeze that refuses ineligible scope with a per-segment reason list — **now v0.2**, arriving with packages |

**What the cut costs, stated so nobody has to discover it:**

- the positioning is **half delivered**. v0.1 blocks closure, not
  payment-presentation eligibility;
- **the buyer gets a signature, not an invoice.** v0.1 delivers a signed act
  faster; it does not deliver a payment application at all. Whether that is
  enough to pay for is **A-7**, and A-7 is unvalidated. This is the sharpest
  commercial risk the re-cut creates;
- **two migrations are owed to v0.2** — widening every v0.1 `hold` to
  `blocks_both`, and pinning existing act versions to package versions once
  packages exist. Each needs a test that fails if a v0.1 row is left behind;
- **v0.2 is now much larger** than "pilot hardening" describes. It carries
  packages, claim segments, the allocation ledger, internal review, partial
  acceptance, the value-at-risk projection, `witness`, `review`,
  `commercial_decision`, and the КЕП and КБ-form work it already had;
- **a smaller v0.1 makes a wrong answer cheaper, not less likely.** If the pilot
  says the product is not wanted, the re-cut saves roughly the second half of a
  build. If the pilot says it is wanted, it costs one extra release boundary and
  the two migrations above.

## Not included in v0.1

### Displaced from v0.1 on 2026-08-06

Each row was inside v0.1 before this revision. Each has a named owning version
and the reason it is not needed by one of the six steps. Each requires **its own
decision** before it enters that version; adding one back to v0.1 requires an
ADR.

| Displaced capability | Owning version | Why it moved |
|---|---|---|
| Package versions, package lines, package scope heads, package artifacts, package approval requirements, deterministic PDF/XLSX/ZIP/manifest artifacts, acceptance-homogeneous package lines, the «виключені позиції та підстави» appendix, multiple parallel required approvers and observers | v0.2 | Step 5 is one person accepting one act through one link. A frozen multi-line claim document is the commercial half of the product, and no step needs it |
| Freeze that refuses ineligible scope, its per-segment reason list, the ineligible-segment named refusal, and `is_package_eligible` | v0.2 | Requires packages. `can_close_stage` — the half a foreman meets — ships in v0.1 |
| Exact claim segments linked to progress sources, and their lineage heads | v0.2 | A segment exists to be partially decided inside a package. With no package, a segment is a row with nothing to say |
| The allocation ledger — `progress_allocation_heads`, `valuation_allocations`, `progress_claim_allocations` | v0.2 | It carves minor units out of a work-item pool for admission into a claim. Nothing in v0.1 is admitted to anything |
| Per-segment partial acceptance and partial commercial decisions with a reconciled segment partition | v0.2 | Requires segments |
| Decision coverage and reviewer-order independence across arbitrary partial partitions | v0.2 | Correct, and far ahead of any evidence that a first pilot needs it ([package review](../delivery/package-review-2026-08-04.md) §6) |
| Decision issues, package submission receipts, package correction and resubmission, references to unchanged prior acceptance | v0.2 | A prior acceptance requires a package. The v0.1 loop is one decision on one act, and a corrected act version replaces resubmission. **`external_decision_batches` is not in this row:** it entered **v0.1-M5** on 2026-08-06 ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4, amendment note) as the carrier of the occurrence-scoped receipt, the confirmation-text version and the idempotency record, and [`schema-v0.1.sql`](../../technical/database/schema-v0.1.sql) lines 1278–1283 require one on every externally submitted decision. What moved here is the commercial content recorded against a batch, not the batch |
| `commercial_decision` (quantity and value — замовник) | v0.2 | Step 5 is an evidence decision. Naming the v0.1 decision `evidence_decision` from the first migration makes this additive |
| The seven-state value-at-risk projection with currencies and tax bases; accepted, returned and pending quantity; the corrected `evidence_blocked` precedence; the "no eighth state" rule | v0.2 | Five of its seven states name packaging or submission. Step 6 needs a sum and a cause, not a state machine over states that cannot occur. The precedence correction stands and applies the moment packages exist |
| Internal review — `review_target_sets`, `review_target_items`, `internal_review_decisions` and their heads — and the internal queues that must not become a second source of truth | v0.2 | Internal review is a precondition of package eligibility and of the `review` intervention type. Both move, so it moves with them |
| The closure-without-evidence bypass, its clearance, `CLOSED_WITHOUT_ACT`, and the named bypass appendix in the frozen manifest | v0.2 | Its price is package ineligibility. With no packages the price is zero, and a free bypass teaches that the gate is theatre |
| `witness` and `review` intervention types | v0.2 | `witness` needs the notice event and its attendance outcomes; `review`'s only blocking scope is package inclusion. The CHECK keeps all three values |
| The witness notice event — recipients, server send time, configured required notice, server-computed earliest proceed time — and recorded non-attendance | v0.2 | Moves with `witness` and with the statutory notice apparatus it belongs to |
| `requirement_rules` — workspace-authored rule drafting | v0.2 | The only rule source in v0.1 is the shipped library. Rule *versions* stay publish/retire-only and an occurrence still stores `rule_version_id` |
| `locations`, the location-node axis of the rule predicate, location scope on assignments and occurrences, and location-subtree bulk instantiation | v0.2 | The predicate narrows to (work type, stage). The dry run and its uncovered-line list survive without the subtree |
| `unit_definitions` beyond the units a manual work line needs | v0.2 | Nothing in the six steps converts or reconciles units |
| Contract-baseline import **extension** — column mapping, unit inference, number formats, an АВК-5 adapter, extension of reimport diff and lineage | v0.2, and **frozen** until the file exists | Zero customer documents. Unfreezing requires one real sanitized file from a named company |
| Додаток Г as a separate template for responsible structures | v0.2 | Scope assumption **c** is MEP / electrical, and prohibition **H** forbids calling electrical installations «відповідальні конструкції». No v0.1 step reaches form Г |
| Audit warning when one person combines sensitive responsibilities | v0.2 | It warns about self-review, and the internal review it protects moves to v0.2. The v0.1 blocking decision is made by an external технагляд, not by the capturer. **The risk is recorded, not dismissed:** until it ships, nothing warns an authorised actor who waives their own requirement, and the exception's visibility is what carries that weight |
| Capture telemetry | v0.2 | No step needs it, and `capture_events` already exists in the runtime and is not dropped |
| The `apps/mobile` Expo client, EAS internal preview distribution, and TestFlight / Google Play internal pilot distribution | v0.3 | [ADR-007](../decisions/ADR-007-pilot-field-client.md) decisions 1–2: the v0.1 field client is a PWA. `apps/mobile` stays in the tree as the starting point for v0.3 offline work |
| The durable pending original — local original retained until server receipt, survival across an ordinary app restart, envelope-encrypted quarantine (INV-013, INV-014, INV-053) | v0.3 | They rest on an OS-sandboxed app area and a Keychain/Keystore-bound key. A browser gives neither, and site storage may be evicted. They remain the native client's invariants |
| Camera-only capture for blocking requirements, camera-versus-gallery labelling, tamper-evident provenance, verified capture-time GPS | **Withdrawn; uncommitted research** | The `capture` attribute is a hint, not a guarantee, and browsers may strip or re-encode metadata before the page sees the bytes, so the server-side inference loses both inputs. Which engines and versions do what is **measured on the two physical devices**, and the measurement decides what may be said in v0.2 — not whether the PWA ships. Re-asserting any of these requires an ADR, not a UI change |
| Push notification of any kind in the field client | v0.2 at the earliest | The earliest push named anywhere in the package is the v0.2 statutory-notice push. Web push on iOS additionally requires an **installed** home-screen PWA on iOS 16.4+, which reintroduces an install step; v0.2 decides between an installed PWA and the native client. No document may describe v0.1 as push-capable on either platform |

### Gate capabilities with a named owning version

Deferred before this revision and unchanged by it. Each requires **its own
decision** before it enters that version. A version tag in market research is a
routing note, not an approval.

| Deferred | Owning version |
|---|---|
| `evidence_plan` — the counter-signed, externally agreed requirement list that makes the gate two-sided in its rules | v0.2 |
| The statutory notice apparatus: Ukrainian working-day calendar with holidays, delivery proof, push at notice-window opening, printed notice artifact | v0.2 |
| The silence clock and the unilateral act on a counterparty's unmotivated refusal to sign | v0.2. **The statutory basis is not established.** No civil-code article, part, or court decision may be cited for this item until [hidden-works-content-rules.md](hidden-works-content-rules.md) allow-lists one against a fetched primary text; until then this row names a product behaviour and no norm |
| The submission-requirements matrix (Not tracked / Warn / Prevents submission) with attributed per-requirement waivers | v0.2 |
| КЕП: `assurance_level` on decisions, detached `.p7s` over the frozen version hash | v0.2 |
| Qualified timestamps (RFC 3161) over evidence hashes and package-version Merkle roots | v0.2 |
| КБ-2в (Додаток 36) and КБ-3 (Додаток 37) rendering with mandatory `form_version` | v0.2 |
| Non-conformance objects whose disposition moves money | v0.2 |
| Додаткові угоди as first-class baseline amendments | v0.2 |
| Offline capture, queue, and sync | v0.3 |
| Material certificates as scoped, expiring evidence satisfying many lines | v0.3 |
| Automatic un-blocking on acceptance of remedial evidence | v0.3 |
| Sequential approver chains | v0.3 |
| ЄДЕССБ integration | Watch register; no version |

### Offline and device operation

- offline authorization;
- offline task browsing;
- background synchronization;
- multi-device conflict resolution;
- resumable chunk upload.

These belong to v0.3. v0.1 connection-loss protection is a safe retry of an
online capture, not an offline workflow — and in a browser it is not even a
durable queue: the pending original is held in memory, the client uploads
immediately, and a loss is always surfaced. **v0.3 is expected to return to the
`apps/mobile` client** rather than to extend the PWA
([ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 8): an offline
outbox cannot tolerate storage the OS may reclaim under a policy the page does
not control, or the absence of a hardware-backed key to bind ciphertext to.
ADR-007 scopes a pilot client and never establishes that a browser is sufficient
for the product.

### Commercial and accounting contexts

- variations and change orders;
- receivables and invoices;
- retentions and deductions;
- payments and allocations;
- bank reconciliation;
- statutory and tax ledgers;
- posting periods and journals;
- official accounting documents.

Project Commercials begins no earlier than v0.4+ and consumes finalized
acceptance facts through a separate subledger/export boundary.

**One divergence is recorded, not resolved.** ADR-005 assigns *додаткові угоди
as first-class baseline amendments* to v0.2 — a contract-baseline concern,
distinct from the commercial machinery of dispute, reversal, compensation
authority and invoicing that Project Commercials owns from v0.4+.
[roadmap.md](roadmap.md) still lists "change-order boundary and approved
contract adjustments" in the v0.4+ candidate sequence. The two must be
reconciled under the roadmap scope-change rule before v0.2 planning; neither is
in v0.1 either way.

### Platform expansion

- SaaS subscription billing;
- custom entitlement packaging;
- customer support access or impersonation;
- public webhooks and third-party integrations (the Telegram webhook of
  `v0.1-M7` is the product's own ingress to its own bot, not a public webhook —
  [ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md), 2026-09-03);
- custom role builder;
- sequential enterprise approval routing — ADR-005 assigns v0.3 as the owning
  version;
- automated retention and legal-hold engine;
- regulated e-signature assurance — ADR-005 assigns v0.2 as the owning version
  for КЕП. v0.1 ships link confirmation, and the UI and the printed page say
  plainly that it **is not an electronic signature**. v0.1 prints only that
  negative statement, which asserts nothing and therefore needs no source; the
  admissibility argument rests on Law № 2155-VIII art. 17(7), which is carried
  as `UNVERIFIED` and may not be printed.

### State registry integration

ЄДЕССБ integration is not built and carries no version. The state
responsibility matrix contains no виконавча документація obligation for a
specialist subcontractor — no journals, no acts on hidden works, no КБ-2в; the
only construction position is «відомості про виконання будівельних робіт», which
is the general contractor's duty. Package versions are immutable and
self-describing, so if the matrix changes the cost is an adapter over already
frozen artifacts. The standing cost of not building it is that the question is
asked at every demonstration and must be answerable in one paragraph. It belongs
in a quarterly watch register, not in a roadmap version.

### AI

v0.1 has no required AI runtime or unused AI tables. Later assistance may
suggest mappings, extraction, evidence-quality checks, links, summaries, or
remediation. Every suggestion requires human confirmation and retains run/model
provenance appropriate to that feature.

## Scope assumptions the owner may reverse

These bound the scope above. Each is the owner's judgement, made on 2026-08-05
without customer validation; each has a reversal cost stated in
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) under
"Assumptions the owner may reverse". Reversing one requires editing that section
in the same change, so the reversal and its recorded cost stay together.

- **a.** The buyer is the **subcontractor**; the general contractor gets a free
  read-only seat as a distribution channel, not as the paying customer.
  Reversal: no migration, a full go-to-market rewrite.
- **b.** The headline metric is **first-time acceptance rate and
  days-to-signature**; blocked value is secondary. Reversal: near zero inside
  v0.1, expensive after a pilot has been sold on one framing.
- **c.** Scope is **MEP / electrical installation**, not general construction —
  which is why the shipped library is Н.14 and Н.15 and nothing else. Reversal:
  the Додаток Н positions outside Н.14 and Н.15 sourced to the same
  `VERIFIED_PRIMARY` standard, plus a widened stage vocabulary; a content-sourcing
  programme, not a code change. **How many such positions exist and what they
  cover is not on the allow-list and is not asserted here**
  ([hidden-works-content-rules.md](hidden-works-content-rules.md)).
- **d.** **КЕП is v0.2**; v0.1 ships link confirmation. Reversal: a boundary
  change plus a КНЕДП integration, colliding with the no-account external link.
- **e.** **ЄДЕССБ integration is not built.** Reversal: an additive adapter over
  frozen package versions.

The decisions ADR-006 and ADR-007 make are deliberately **not** on this list.
They are not owner-reversible by an edit here: the pilot's position ahead of the
commercial half, the adversarial технагляд, the frozen importer, M0's position,
and the PWA each require a superseding ADR with the user evidence, the version
impact, the data ownership, the security impact, and the migration cost.

## Scope decision test

A proposed v0.1 feature must answer yes to all of:

1. Does it close or protect the approved end-to-end outcome?
2. Is its authoritative fact and owning module clear?
3. Can tenant, contract, and decision boundaries be tested?
4. Is its pilot acceptance evidence defined?
5. Is it smaller and safer to implement now than to preserve an extension
   boundary?

If not, assign it to a named later version or research backlog. A detailed
legacy design is not sufficient reason to include it, and neither is a detailed
approved one: **"it is already specified" is the cheapest argument available.**

Question 3 previously read "tenant, contract, package-version, and decision
boundaries". v0.1 has no package version to test a boundary against; that clause
returns with packages in v0.2, and its removal here narrows what a v0.1 feature
must prove by exactly one boundary that cannot exist yet.

### The test applied to every capability that remains in v0.1

| Capability | Owner | 1 — closes or protects | 2 — owning fact | 3 — testable boundary | 4 — acceptance evidence | 5 — now versus an extension boundary |
|---|---|---|---|---|---|---|
| Fitness to hold someone else's data | M0 | Protects: it is the only thing standing between real personal data on a real site and an environment that has not earned it | Twelve exit gates — eight plus four — each with recorded evidence | Tenant-isolation tests for every module; restore exercise; upload content-type and resource limits | M0 exit: recorded evidence per item, not a read checklist | Yes: a pilot cannot be un-run after the data has entered |
| Manual work-line entry | M1 | Closes: step 1 has no other way to create an object, and step 6 sums over exactly these lines | `work_items`, with entry provenance beside import provenance | Cross-tenant and cross-contract line creation rejected; a line's provenance distinguishes entry from import | M1 exit: an object created by hand carries the same lineage assertions as an imported one | Yes: it is the same table either way, and building it after the importer would mean retrofitting provenance onto rows that already exist |
| Requirement rules bound at baseline publication | M1 | Closes: without a bound obligation the evidence step of the loop is decorative | `requirement_rule_versions`, `contract_version_rule_bindings` | Binding pinned to a published contract version; cross-tenant and cross-contract binding rejected | M1 exit: a published baseline yields the same rule set after a rule version is retired, and no baseline publishes without one | Yes: retrofitting a binding onto already-published immutable contract versions has no clean path |
| The shipped Додаток Н Н.14/Н.15 library | M1 | Closes: step 1 loads requirements from it, and it is the only rule source in v0.1 | `requirement_library_items`, each row carrying its verification tag and source in the data | A string with no source is unrenderable, enforced in storage rather than in a template | M1 exit: twelve items render verbatim with the довідковий disclaimer uncollapsed | Yes: the enforcement is storage-shaped, and a template-level rule can be edited away by one contributor |
| `hold` as the only intervention type | M1 | Protects: a boolean gate is routed around within a week; a typed one names its release condition | `intervention_type` on the rule version, materialised on the occurrence | Publication rejects `witness` and `review`, and rejects a `hold` that is not `blocks_stage_closure`; `hold` rejects `not_applicable` | M1/M3 exit: the release condition demonstrated once, and both rejections proven | Yes: the CHECK carries three values now, so v0.2 adds behaviour and not a data migration over frozen rule hashes |
| Blocking scope | M1 | Closes: it is what makes a two-sided gate expressible at all, even while only one side ships | `blocking_scope` on the rule version, materialised on the occurrence | Closure reads the stored value; no severity word is interpreted at read time | M1 exit: publication **rejects** any `hold` whose scope is not `blocks_stage_closure`; M3 exit: the closure predicate quantifies over the stored scope and never over a severity word. **`none` is unreachable in v0.1** — every v0.1 requirement is a `hold` and every v0.1 `hold` is `blocks_stage_closure` (ADR-006 decisions 4.3 and 4.4) — so the advisory occurrence that is recorded, surfaced and never blocking is a **v0.2** gate and no v0.1 milestone may be closed on it | Yes: the alternative is inferring consequence from a severity word forever. The v0.2 widening migration is the recorded price |
| Occurrence materialisation | M2 | Closes: "known in advance" is a claim about time; a placeholder created after covering is not advance notice | `requirement_occurrences` | Occurrence exists before the first quantity entry; the dry run lists uncovered lines | M2 exit: the field client shows the set before work starts | Yes: the placeholder column already exists and is deferred (`0015:251`); that extension boundary has already failed once |
| The PWA field client and online-only capture | M2 | Closes: step 2 is the whole product for the person holding the phone, and it must cost fewer actions than a group chat | `upload_intents`, `evidence_objects`; the client holds no authority | The client is behind the same BFF boundary; no PWA-specific field on any domain object | M2 exit: capture on the two physical devices, with the loss path surfaced and never silent | Yes: the domain and API stay client-agnostic, so the client is replaceable without a migration — which is what makes the reversal in [ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 9 cheap |
| The closure event and its refusal | M3 | Closes: the inserted loop step; the act hangs off it, and it is the one refusal v0.1 ships | `work_stages`, `stage_closures` | Closure refused while a blocking occurrence is unsatisfied; double-covering unrepresentable | M3 exit: a guarded closure **fails**, naming the requirement, the missing evidence, and the owed role — a test that the command refuses, not a report | Yes: the transition already exists in the catalog with no writer; adding it later means adding it to history that never had one |
| The block-reason object | M3 | Protects: a refusal that cannot be shown in a meeting with the general contractor becomes a helpdesk cost | `blocked_reasons`, a projection over occurrences and decisions | Value deduplicated per assignment; codes from a closed versioned vocabulary | M3/M6 exit: every blocker drills to authoritative facts | Yes: a projection over facts this version already records |
| The readiness predicate `can_close_stage` | M3 | Closes: the reason the closure command can refuse at all | Derived; never an editable status column | One invariant with enumerated recomputation triggers | M3 exit: the same stage classifies identically after each trigger | Yes: no new storage; the cheapest item in this list. `is_package_eligible` waits for packages |
| The exception as the only escape | M3 | Protects: an absolute lock is routed around outside the system, and then the product is the enemy | `requirement_exceptions`, append-only | `not_applicable` rejected on a `hold` by the command; every exception attributed and visible | M3 exit: a waived `hold` closes the stage and the waiver is visible on the act and in the blocked-money breakdown | Yes: the bypass whose price is package ineligibility cannot ship before packages, and shipping a free bypass teaches that the gate is theatre |
| The statutory act | M4 | Closes: nothing else produces a document a Ukrainian technical supervisor recognises ([package review](../delivery/package-review-2026-08-04.md) §7) | `statutory_acts`, `statutory_act_versions`, assembled only from recorded facts | No free-text quantity field in any render; unsourced normative strings unrenderable; the version pinned by the closure | M4 exit: deterministic render from one snapshot, and a correction freezes a successor threaded to its predecessor | Yes on the boundary, and this is the largest single item in v0.1: an artifact type retrofitted into already-frozen versions is not an additive change |
| The protected link and the evidence decision | M5 | Closes: step 5 is the only place an external party ever touches the product, and A-3 is what it tests | `external_access_grants`, `external_sessions`; the decision lands on `requirement_evidence_decisions` | Grants cannot cross workspace, project or contract; fragment-to-POST exchange; short revocable session | M5 exit: an external decision recorded with no account, at level 3, printed with the negative statement | Yes: naming it `evidence_decision` from the first migration is what makes `commercial_decision` additive in v0.2 |
| The blocked-money sum | M6 | Closes: step 6, and it is the only number the owner is asked to act on | A query over `blocked_reasons` and `work_items`; no new table | Deduplicated per assignment; one baseline only; no cross-currency total | M6 exit: the sum reconciles to the blocked stages, with missing/zero price and over-contract performance reported beside it | Yes: it stores nothing, so a wrong shape costs a query rewrite |

**Three rows left this table on 2026-08-06**, and they are named here so the
removal is auditable rather than silent: **the bypass fact** (no packages, so its
price is zero), **freeze refusal** (requires packages), and **the inspection
notice** (moves with `witness` and the statutory notice apparatus). Each is in
the displacement table above with its owning version.

**Question 4 carries a caveat that applies to every row.** Acceptance evidence is
*defined*; it is not *collected*. The entry evidence [roadmap.md](roadmap.md)
requires — real sanitized requirement, exception and act examples, and a
practitioner who has walked through what makes each one ready or blocked — does
not exist. The discovery ledger at
[validated-assumptions.md](../discovery/validated-assumptions.md), last reviewed
2026-08-06, still records 21 evidenced sends, zero replies, zero interviews,
zero named projects, zero pilot commitments, zero willingness-to-pay signals, and
**zero customer documents of any kind**; A-1 through A-7 carry no evidence of any
kind and A-8 carries one founder-reported signal that may not move an assumption.
Every field of the pilot record is empty as of 2026-08-06. Whether evidence gaps
are even a top-two cause of delayed payment in Ukraine is question 2 of
[competitive-landscape.md](competitive-landscape.md) §8 and is unanswered; it can
invalidate this scope rather than merely its wording.

**Weakening the gate is a boundary change, not a backlog item.** Making `hold`
markable not-applicable, allowing a manual override of a derived readiness state,
letting a command filter where ADR-005 says refuse, or restoring `evidence_blocked`
below the packaging states each requires a superseding ADR
([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) replacement
rule).

**Five further protections came with the re-cut** and are listed so that no edit
to this document can quietly undo one:

1. **Adding a capability back to v0.1 requires an ADR**, and the test is naming
   the numbered step it is necessary for
   ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) replacement rule 1).
2. **Moving the pilot later requires an ADR**, and **M0 cannot be reordered
   behind M6**: real customer data entering an environment that has not closed M0
   is a boundary violation regardless of which document or schedule requests it.
3. **Unfreezing import requires the file** — one real sanitized кошторис, АВР, or
   interim-works file from a named company, recorded with the company and the
   date.
4. **Re-asserting a withdrawn provenance claim requires an ADR, not a UI change**
   — camera-only capture for a blocking requirement, a camera-versus-gallery
   label, tamper-evident provenance, and verified capture-time GPS are each a
   boundary change while the field client is a browser page
   ([ADR-007](../decisions/ADR-007-pilot-field-client.md) replacement rule 1).
5. **Claiming a durable pending original requires an ADR.** INV-013, INV-014 and
   INV-053 may not be re-scoped back onto the PWA path by a catalog edit, and the
   domain and API stay client-agnostic so the client remains replaceable.
