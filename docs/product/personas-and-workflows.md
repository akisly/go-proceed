# Personas and workflows

**Status:** Approved

**Applies to:** v0.1 and v0.2

**Last reviewed:** 2026-08-08

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
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


> **What changed on 2026-08-06, and what did not.** This document is the only
> user-facing flow description in the package, and it has been rebuilt against
> [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) (v0.1 is six steps and
> nothing else) and [ADR-007](../decisions/ADR-007-pilot-field-client.md) (the
> field client is a PWA). The actor model and the workflow ownership rule are
> unchanged in substance and are kept below. The two corrections made in place
> earlier the same day are preserved rather than re-stated: the retired
> requirement-template model does not reappear anywhere below, and
> `not_applicable` is still refused on a `hold` by the exception command itself.
>
> **Nothing below is deleted for being deferred.** Package freeze and
> submission, per-segment partial acceptance, return-and-resubmission across
> package versions, internal review, and the seven-state value-at-risk
> explanation keep their steps and carry a version label. A workflow with a
> `v0.2` label is not a workflow that was wrong; it is a workflow that a first
> pilot does not need.
>
> **Approved is not deployed.** The runtime is 33 tables plus migrations
> `0036`–`0040`, which create no table. None of the gate exists: no requirement
> occurrence, no stage, no closure, no act, no external grant. No workflow below
> is closed by being written, and this document makes no test-count,
> green-baseline, or delivery claim.
>
> *(Qualified 2026-08-08 — «deployed» and «written» have come apart, and every sentence above
> is about the first. All of it is still exactly true of the **applied** migrations, `0001`–`0040`,
> which define 33 tables. Migrations `0041`–`0050` are ten files written on an uncommitted branch and
> **applied nowhere**; between them they carry `create table` for **seventeen of the twenty-six** v0.1
> tables, plus every CHECK, trigger, policy and grant the readiness gate is made of. Having DDL is not
> existing, and none of the ten files has ever been executed.)*
>
> **The ADR-006 precedence condition is met on this branch.** [roadmap.md](roadmap.md),
> [version-0.1.md](../delivery/version-0.1.md),
> [scope-and-boundaries.md](scope-and-boundaries.md),
> [entity-catalog.csv](../../technical/database/entity-catalog.csv) and
> [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv) were each rewritten
> against ADR-006, which is what ADR-006 made a condition of the decision taking
> effect. What remains outstanding is recorded in
> [version-0.1.md](../delivery/version-0.1.md) §"Corrections owed elsewhere"; a
> milestone is planned from the roadmap and this document together, never from
> this document alone — product scope and the roadmap outrank an ADR for release
> contents ([docs/README.md](../README.md) §"Source of truth").

## Actor model

GoProceed separates four kinds of authority:

1. workspace governance;
2. project visibility;
3. project responsibility;
4. external review of granted scope.

A person may have more than one authority, but none is inferred from a job
title or party relationship. Only the **scope kind** of the fourth authority
changes by version: in v0.1 a grant targets a requirement occurrence, and in
v0.2 it may also target a package version.

## Workspace governance

| Role | Primary job | Boundary |
|---|---|---|
| Owner | Govern tenant, ownership, and highest-risk settings | At least one active owner must remain |
| Admin | Manage members, own parties, projects, and policy | Cannot silently become owner |
| Member | Perform authorized project work | Needs separate project access/responsibility |
| Auditor | Read approved scopes and audit evidence | No operational mutation by default |

These are access roles, not construction professions.

## Project responsibilities

| Responsibility | Job to be done | Version |
|---|---|---|
| Performer | Be accountable for the organization that performed the work | v0.1 |
| Progress recorder | Record measured performed quantity | v0.1 |
| Evidence recorder | Capture or upload evidence and provenance | v0.1 |
| Evidence custodian | Maintain the authoritative original and correction chain | v0.1 |
| Requirement owner | Define or assign the evidence obligations | v0.1 **binds** the shipped library's rule versions at baseline publication; **authoring** a workspace rule is v0.2 |
| Closure actor | Record that a stage was closed, and carry the refusal when it is not | v0.1 |
| Exception actor | Record an attributed, visible `waiver` or `accept_risk` on an occurrence | v0.1 |
| Internal verifier | Decide whether exact evidence/requirement facts are ready | v0.1 for the evidence decision on one occurrence; the review of a target set is v0.2 |
| Acceptance liaison | Coordinate returns and external review | v0.1 |
| Commercial observer | Inspect quantity/value exposure without deciding acceptance | v0.1 |
| Package compiler | Assemble ready scope into a package draft | v0.2 |
| Package submitter | Freeze and send the exact package version | v0.2 |
| Bypass actor and claimed authority | Record a closure without evidence and the authority claimed for it | v0.2 — its price is package ineligibility, and v0.1 has no packages |
| Clearing reviewer | Restore eligibility against named substitute evidence | v0.2, with the bypass |
| Notice recipient | Party contact invited to witness, recorded on the notice event | v0.2, with `witness` and the notice apparatus |

One member may combine responsibilities in v0.1, and no combination creates an
artificial hard stop for a small pilot team. **The audit and UI warning for a
sensitive combination is v0.2**, not v0.1: it warns about self-review, and the
internal review it protects moves to v0.2
([scope-and-boundaries.md](scope-and-boundaries.md) §"Displaced from v0.1"). The
risk is recorded rather than dismissed — until it ships, nothing warns an
authorised actor who waives their own requirement, and the exception's
attributed visibility is what carries that weight.

**Two names come from the rule, not from an assignment.** `performer_role` and
`approver_role` are carried by the requirement and materialised onto the
occurrence. They record who owes the work and who owes the decision; they grant
nothing. A rule naming `approver_role = технагляд` states who owes the decision;
it does not let that person into the workspace
([execution-and-evidence.md](../domain/execution-and-evidence.md) §"Actor
distinctions").

## External actors

### Technical-supervision reviewer — v0.1

Reviews technical evidence on the scope granted to them and records an
accepting or returning `evidence_decision`. This is the only external decision
in v0.1, and the decision is **named `evidence_decision` from the first
migration** so that `commercial_decision` is additive in v0.2 and no v0.1
record has to be reinterpreted.

### Customer reviewer — v0.2

Reviews the contractual quantity/value scope assigned by an approval
requirement and may accept or return exact claim segments and record issues.
Segments, approval requirements, and the commercial decision are all v0.2, so
this actor has nothing to decide in v0.1.

### Observer — v0.2

Can inspect the exact submitted package version but cannot submit a decision.
There is no package version in v0.1.

External reviewers are not workspace members. They use a protected personal
email link and short session. Possession of the link is access assurance, not
verified legal identity: the record is level 3 of the assurance ladder in
[hidden-works-content-rules.md](hidden-works-content-rules.md), it prints
«Це не електронний підпис», and it is never labelled підпис.

## System actors

System workers may:

- parse import files;
- generate immutable artifacts;
- project readiness and the blocked-money sum (v0.1), and acceptance and the
  seven-state value at risk (v0.2);
- claim and deliver messages;
- retry jobs and move exhausted work to dead letters;
- record audit and delivery evidence.

A system actor cannot invent a human acceptance decision. Automated results
must identify their input version and algorithm/renderer version. Server receipt
time, closure time, and decision time are server-generated regardless of which
client sent the bytes.

## How to read the workflows below

Workflows 1–6 are the six steps of
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 1, in its order and
with its numbering, and **nothing outside them is v0.1**. A capability does not
enter because it is already specified, already catalogued, or already in the
DDL; the test is to name the step it is necessary for.

Workflow 0 is v0.1 because step 1 cannot happen without it: the parties,
project, contract and published contract version it creates are four of the five
M1 tables ADR-006 records as already in the runtime, on top of the v0.0
workspace and access foundation. It is a prerequisite of the list, not an
addition to it.

Workflows 7–11 are v0.2. Each keeps the steps it had and carries its owning
version. Where an old workflow moved, the mapping is here:

| Before 2026-08-06 | Now |
|---|---|
| Workflow 0 — Workspace and multi-entity setup | Workflow 0, unchanged in substance |
| Workflow 1 — Contract import | Workflow 1 (manual entry is the v0.1 path); import kept as a frozen sub-flow |
| Workflow 2 — Assignment and online capture | Workflow 2, rewritten for the PWA (ADR-007) |
| Workflow 3 — Requirement and internal review | Split: the requirement and evidence half is workflows 2–3; internal review is workflow 7 (v0.2) |
| Workflow 4 — Package freeze and submission | Workflow 8 (v0.2) |
| Workflow 5 — Multi-party partial acceptance | Workflow 9 (v0.2); the single external evidence decision survives as workflow 5 |
| Workflow 6 — Return, correction, and resubmission | Workflow 10 (v0.2); the v0.1 return is inside workflow 5 |
| Workflow 7 — Value-at-risk explanation | Workflow 11 (v0.2); the blocked sum survives as workflow 6 |

**One precondition sits in front of all of them.** M0 is **twelve exit gates, and
twelve is eight plus four** — eight cross-cutting items and four carried by
ADR-005 and [hidden-works-content-rules.md](hidden-works-content-rules.md), all
twelve listed together in [scope-and-boundaries.md](scope-and-boundaries.md)
§"M0 — Fit to hold someone else's data" and enumerated item for item in ADR-006
decision 7. They must be closed with recorded evidence per item before real pilot
data enters GoProceed, and workflow 6 cannot open until they are. **Twelve
*plus* four is sixteen and is a different list**; this document said that until
2026-08-06, and the four are inside the twelve rather than beside them.

## The workflow the product leads with

**This is the demonstration and the pilot path.** It is a composition of
workflows 1–6 in the order a subcontractor meets them, and it is the shortest
statement of what the product does: **the requirement is known in advance, the
photograph is taken before covering, the closure is refused, the act is
assembled from what was recorded, and one external person decides.**

**Primary actors:** requirement owner (ПТВ), performer, evidence recorder,
closure actor, technical-supervision reviewer, owner.

1. ПТВ creates the object, types the work lines by hand, picks a work type, and
   the requirements load from the shipped ДБН library. Publishing the baseline
   pins the rule-version set.
2. An assignment is created, and the requirement occurrences materialise with it
   — before work starts, with no evidence yet linked.
3. The foreman opens a link on his phone and sees what must be photographed
   **before covering**, in the standard's own wording, with a reference image.
   He takes it. That is the whole interaction.
4. The stage cannot be recorded as closed while a `hold` on it is unmet. The
   attempt names exactly what is missing, who owes the decision, and the money
   behind it.
5. Технічний нагляд opens a personal link with no account and accepts the
   evidence, or returns with a reason.
6. With the `hold` satisfied, the closure is recorded and the act by the form of
   Додаток В is assembled **only** from already-recorded facts.
7. The owner sees what is blocked and how much money sits behind it, broken down
   by cause.

Steps 5 and 6 appear in ADR-006 decision 1 in the other order, because that is
the order the two artifacts reach the subcontractor. The decision precedes the
act it makes possible, and workflow 5 records why.

**What this workflow must not be shown doing.** v0.1 blocks the recorded closure
of a hidden stage. It does **not** block the eligibility of performed quantity
to enter a package version, because v0.1 has no package versions. The positioning
sentence — «Ми не блокуємо роботу на майданчику — ми не даємо її пред'явити до
оплати, поки доказ не отримано і не погоджено» — describes a product whose second
clause arrives with packages in v0.2, and until then it may be used only
alongside an explicit statement that payment-presentation eligibility is not in
v0.1. **No demonstration may show a payment-presentation refusal that does not
exist** (ADR-006 §Consequences).

**Completion evidence:** the pilot record of ADR-006 decision 8 — named partner,
named and **adversarial** технагляд, success measures, a pre-gate baseline,
sample, and stopping conditions. **Every one of those fields is empty as of
2026-08-06**, and filling them is discovery work, not delivery work. A refusal is
only observable when someone wanted to pass, so a compliant технагляд produces a
clean run and no evidence about the product's only differentiator. If the
технагляд refuses to open the link, refuses to decide inside it, or demands
paper, that is a result: it invalidates A-3 and is written into
[validated-assumptions.md](../discovery/validated-assumptions.md) as an
invalidation, never deleted.

## End-to-end workflow 0: Workspace and multi-entity setup — v0.1 (M1)

**Primary actors:** owner, admin.

1. Owner creates the workspace and becomes its first active owner through a
   serialized bootstrap.
2. Owner or authorized admin records two workspace-owned legal parties, each
   with its own official name, EDRPOU, legal/tax attributes, and contacts.
3. Admin records a customer party and contact without publishing either party
   into a global registry.
4. Admin creates one construction project.
5. Admin grants project visibility and assigns time-bounded responsibilities
   independently.
6. Admin creates two contracts in the same project, selecting a different own
   legal party on each contract.
7. Published contract versions pin the correct own/customer party snapshots
   **and the rule-version set** the work will be judged against.

**Completion evidence:** tenant-isolation tests and one working scenario prove
that a project can hold two contracts for different own legal entities without
crossing party, access, or contract boundaries.

## End-to-end workflow 1: The object and what it owes — v0.1 (M1)

**Primary actors:** admin or authorized contract editor, requirement owner (ПТВ).

**Manual work-line entry is a first-class capability.** It is not a stopgap for
a missing importer and no document may describe it as one (ADR-006 decision 2).
It is how a v0.1 object is created, it is what the six steps are demonstrated
on, and it is what the blocked-money sum of workflow 6 is computed over. It gets
the same schema quality, the same provenance, and the same tests as an imported
line.

1. User creates a project and chooses the contract's own and customer parties.
2. User **types the work lines**: code, description, unit, quantity, unit price,
   currency, and tax basis, with the recording member and server time kept as
   provenance exactly as an imported row keeps its file, sheet, and row.
3. User picks a **work type** for each line.
4. The requirements load from the shipped library at
   [`technical/requirements/dbn-a31-5-2016-dodatok-n.csv`](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv)
   — Додаток Н positions Н.14 (five items) and Н.15 (seven items), twelve rows,
   each carrying its `verification` tag and its source **in the data**. A string
   with no source is unrenderable, enforced in storage rather than in a template.
5. The generated list carries the довідковий disclaimer uncollapsed: the binding
   list for a site comes from робоча документація (п. 8.4.3.3). Anything the
   product recommends beyond Додаток Н sits in a separate block labelled
   «Додатково рекомендуємо (не з Додатка Н)» with no normative citation, and the
   mapping of a Н.14/Н.15 position to form В or form Г is labelled in the UI and
   in the render as the product's assumption.
6. A dry run over the lines prints an **explicit list of uncovered lines**. A
   work type with no matching rule is named in the command's output, not in a
   report someone may choose to run — silent non-coverage means there is no gate.
7. User explicitly publishes a contract version. GoProceed freezes the
   party/currency/tax/terms snapshots, the work lines, **and the exact
   rule-version set**. Rule versions are publish/retire only, never updated; an
   occurrence stores `rule_version_id` and never a live pointer.

**No baseline is published in v0.1 without a rule-version set.** The milestone
that publishes a baseline is now the milestone that binds its rules, which
closes the long-open contradiction that a baseline published in M1 could never
acquire a binding (ADR-006 decision 3).

**Four narrowings apply to this workflow and are not weakenings.** The rule
predicate is `(work type, stage)`; `locations` and location-subtree bulk
instantiation are v0.2. Workspace-authored rule drafting is v0.2, so the shipped
library is the only rule source in v0.1. `intervention_type` is `hold` only —
the CHECK keeps all three values and the publication command rejects `witness`
and `review`, so v0.2 is additive. And a v0.1 `hold` is `blocks_stage_closure`
rather than `blocks_both`, because the other half of `both` has nothing to
block; **v0.2 owes a migration widening every `hold` written during v0.1 to
`blocks_both`, and a test that fails if one is left behind.**

**Completion evidence:** a published version reproduces every work line from its
recorded fields and its recording actor, yields the same rule set after a rule
version is retired, and refuses to accept a binding after publication.

### Contract import — built, and frozen (ADR-006 decision 6)

The XLSX/CSV importer stays in the code exactly as it is. No migration drops its
tables, no code path is removed, and an object created by import continues to
work. What changed is that the roadmap stops treating its **extension** as v0.1
work.

1. User uploads XLSX or CSV.
2. GoProceed stores file hash and immutable source provenance without executing
   formulas or macros.
3. User maps columns for this import and reviews every inferred normalization.
4. Parser shows raw values, normalized values, warnings, and blocking errors per
   source row.
5. User fixes the source or mapping and reruns validation, then publishes.
6. A later reimport produces a new version, diff, and row lineage; it never
   edits the published version.

**Completion evidence, unchanged:** a published version can reproduce each
imported work row from its file, sheet, row, parser version, and mapping
version.

**Why frozen.** There are **zero customer documents of any kind** — no example
акт, кошторис, КБ-2в, or виконавча документація. The import schema was specified
against no real file, while the roadmap made a representative sanitized artifact
an *entry* condition for a milestone that shipped without one, which is why
[validated-assumptions.md](../discovery/validated-assumptions.md) makes A-6 the
sharpest open risk in the project.

**What unfreezes it:** one real sanitized кошторис, АВР, or interim-works file
from a named company, recorded in
[validated-assumptions.md](../discovery/validated-assumptions.md) with the
company and the date. One file is enough to unfreeze; it is not enough to
validate.

## End-to-end workflow 2: The phone — v0.1 (M2)

**Primary actors:** progress recorder, evidence recorder, performer.

**The client is the `apps/mobile` Expo client, shipped as a web export, with
the Telegram project channel beside it** ([ADR-009](../decisions/ADR-009-three-pilot-surfaces.md) decision 2 and
«Amendment, 2026-09-23»). The Expo client is an authenticated member surface
behind the same BFF boundary the web product already uses, which it reaches
cross-origin with a bearer token; its web export needs no store install, and its
native builds come later from the same codebase. The Telegram channel is built
and enabled in no environment yet (BL-024). `apps/app` serves no field pages.
The API and the domain are unchanged, which is what makes the client replaceable.
*[2026-09-23, DEV-035 — was: «**The client is a PWA served from `apps/app`** — an
authenticated member surface behind the same BFF boundary the web product already
uses ([ADR-007] decision 1). There is no install step: a link opens the capture
screen. `apps/mobile` stays in the tree and is not on the v0.1 path; it is the
starting point for the v0.3 offline work.» The owner retired that PWA; see
[ADR-009](../decisions/ADR-009-three-pilot-surfaces.md) «Amendment, 2026-09-23». Below, «PWA capture» and «the PWA
path» read as the web field client from `apps/mobile`, whose capture code is a
port of the PWA's; every limit and refusal stated for the PWA binds it.]*
*[2026-09-23, DEV-042 — changed by [ADR-013](../decisions/ADR-013-native-field-client.md) (owner, 2026-09-22): the Expo client is
now the native iOS/Android build, installed through TestFlight or Google Play
Internal Testing for the internal beta; the web export and its `goproceed-field`
deployment are retired (the owner deleted the project on 2026-09-23). It reaches
`/v1` with a bearer token and no CORS. «PWA capture» and «the PWA path» below
describe the retired web client. Not merged; device and store evidence NOT RUN
([DEV-042](../tasks/DEV-042-mobile-native.md)).]*

1. Authorized member creates an operational assignment from a work line, with
   performer party, planned quantity, and optional member assignee and due date.
2. The requirement occurrences **materialise when the assignment is created**,
   with no evidence yet linked, each carrying `rule_version_id`,
   `intervention_type`, `blocking_scope`, `evidence_kind`,
   `acceptance_criterion`, `norm_ref`, `performer_role`, and `approver_role`.
3. The foreman opens the field client and sees, **before work starts**, what must
   be photographed before covering — in the standard's own wording, with a
   reference image. The image is product content used to show what a good frame
   looks like; it is not a normative string and asserts nothing about the norm.
   A placeholder that appears only after the stage is covered is not advance
   notice and does not satisfy this step.
4. He takes the photo. One interaction. The client uploads immediately and does
   not offer a durable local queue it cannot honour.
5. **Nothing is reported as recorded before the receipt.** `upload_received` is
   not `evidence_available`; no screen shows a photo as recorded until the
   `available` receipt is persisted.
6. If an upload cannot complete, or the page is about to be left with an
   in-flight or unsent original, the user is told plainly that GoProceed has not
   saved the photo and that it must be retaken or kept by them. **A silent loss
   is the one outcome this must not produce.**
7. A connection failure retries the whole upload with the same idempotency key.
   The six client-state labels already fixed in the copy and state catalogs stay:
   a user still needs to tell not-sent from sending from confirmed from failed.
8. Progress recorder adds an append-only performed-quantity entry. Corrections
   reference the original progress or evidence fact.

**What may be claimed about a captured photo, and nothing more:** a
client-computed content hash verified at finalization against the bytes the
server received; a server receipt time generated by the server and never by the
client; and a device-claimed capture time stored beside it and **explicitly
labelled untrusted**. The hash binds the uploaded artifact, not the sensor
output.

**What may not be claimed, in the UI, in a demo, or in a sales sentence:**
camera-only capture for a blocking requirement; that a photo is distinguishable
as camera-taken rather than gallery-supplied; tamper-evident provenance; or
verified capture-time GPS. The evidence record's origin method needs a value that
says the origin is **not distinguished**; **that value does not yet exist in any
catalog, DDL or contract, and until it does no PWA capture may be recorded at
all** — the deployed enum offers only values that assert a distinguished origin
(`supabase/migrations/0015_execution_evidence_module.sql:254-255`). Re-asserting
any of these requires an ADR, not a UI change.

**What v0.1 does not promise the field.** Capture is online-only and a pending
original is **not durable**. The durable-pending-original invariants are the
native client's and become v0.3 obligations; they are not claimed for the PWA
path. This is a real reduction in what the product guarantees a foreman, and it
is accepted because the alternative is a client nobody can install.
*[2026-09-23, DEV-042 — changed by [ADR-013](../decisions/ADR-013-native-field-client.md) (owner, 2026-09-22): the native client
brings durable encrypted pending captures (INV-013, INV-014, INV-053) into the
v0.1 internal beta, installed from TestFlight or Google Play Internal Testing.
Capture stays online-authorized; the warned seven-day expiry is not wired and
device evidence is NOT RUN ([DEV-042](../tasks/DEV-042-mobile-native.md)).]*

**Completion evidence:** a server-confirmed evidence object retains hash,
provenance, claimed capture time, receipt time, recorder, source party, and
custodian; no screen reports a photo as recorded before the receipt; and a
failed upload is surfaced rather than swallowed. The physical device inventory
is still required and **matters more, not less** — one supported iPhone and one
lower-resource Android, neither of which exists as of 2026-08-06. Browser
behaviour on EXIF, on the `capture` hint, and on storage eviction is **measured
on those devices, never asserted from memory** in any customer-facing artifact.

## End-to-end workflow 3: The refusal — v0.1 (M3)

**Primary actors:** evidence recorder, requirement approver role, closure actor,
exception actor.

1. Recorder links evidence to an occurrence. **In v0.1 one original is bound to
   one occurrence by the upload intent it was captured under**; the many-to-many
   link table and `evidence_links.create` left v0.1 with the commercial half
   ([`scope-v0.2.csv`](../../technical/openapi/scope-v0.2.csv)), so a
   many-to-many link is not a step of this workflow and is not a v0.1 gate.
2. The approver named by `approver_role` records an accepting or returning
   evidence decision on the occurrence. Decisions are append-only; a correction
   supersedes a prior decision and does not mutate history. Until workflow 5
   ships the occurrence-scoped link, the rule publication command enforces that
   a `hold` names an **internal** approver role — enforced by the command, not
   by convention.
3. Closure actor attempts to record the stage closed. A stage is the closable
   unit: one assignment, one stage from the published vocabulary, flagged
   concealed or not.
4. **`can_close_stage(s)` refuses** while any applicable occurrence with
   `blocking_scope ∈ {blocks_stage_closure, blocks_both}` is unsatisfied.
5. The refusal returns `blocked_reason` objects — requirement occurrence, rule
   version, missing evidence by kind and criterion, awaiting approver role,
   since, blocked value by currency, and a code from the closed versioned
   vocabulary. A refusal that cannot be shown in a meeting with the general
   contractor becomes a helpdesk cost, which is why the reason is an object and
   not a UI state.
6. **The gate never refuses to record a fact.** Performed quantity, evidence
   capture, and the fact that a stage was in truth covered stay recordable,
   including when they record something that went wrong.
7. The escape is the ADR-005 exception: `waiver` or `accept_risk` by an
   authorised actor, attributed and visible. **`not_applicable` is refused on a
   `hold`** by the exception command itself — an intervention that exists to stop
   work cannot be waived by declaring it inapplicable.
8. Readiness stays a projection. There is no editable status column and no
   manual override of a derived state.

**There is no bypass in v0.1.** The closure-without-evidence fact and its
clearance are v0.2: their price is that the money waits, and in a version with
no packages there is no money to make wait, so shipping them would ship a defeat
that costs nothing. One attributed, visible escape exists, which is what
ADR-005's argument against an absolute lock actually requires.

**Two consequences for the code vocabulary.** It stays closed and versioned and
loses no code, and two of the codes ADR-005 names cannot be produced in v0.1:
`CLOSED_WITHOUT_ACT`, because there is no bypass, and
`NOTICE_PERIOD_NOT_ELAPSED`, because there is no `witness`.

**Completion evidence:** a test proves the command **refuses** and names its
reason object. A report, a dashboard, a warning banner, a red count, or a screen
that displays «не готово» is not evidence that a gate exists.

## End-to-end workflow 4: The act — v0.1 (M4)

**Primary actors:** closure actor, evidence custodian.

1. Closing a concealed stage whose requirements are satisfied produces a **draft
   act** strictly by the form of **Додаток В (обов'язковий)** ДБН А.3.1-5:2016,
   titled «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ». The act for responsible structures
   uses **Додаток Г** and is a separate template.
2. The act is assembled **only from already-recorded facts** — performed-quantity
   entries already on the line, evidence objects already available, occurrence
   decisions already made, and party data already on the participant records.
3. **There is no free-text quantity field, anywhere, in any render.** The
   composer offers only the performed-quantity entries already recorded against
   the line, with a share selector. A quantity a human types into an act is
   literature.
4. Act versions are immutable and are pinned **by the stage closure** in v0.1;
   in v0.2 the package version pins them additionally. The freeze discipline is
   unchanged either way.
5. Three typed signatory slots per п. 8.4.3.5 — будівельна організація,
   технічний нагляд замовника, авторський нагляд. The технагляд's
   кваліфікаційний сертифікат is held on the participant record; **whether
   Додаток В has a field for its серія and номер is not established**, so nothing
   is printed into the form for it, and prohibition E bans the adjacent «ким
   видана».
6. Every rendered decision block prints its assurance level. A level-3 record
   prints «Це підтвердження за електронним посиланням із зафіксованими IP та
   серверним часом. **Це не електронний підпис.**» and is never labelled підпис
   or підписано.
7. Every page carries the required disclaimer, including the **recorded date of
   last verification against the Реєстр будівельних норм**.

**Content authority.** [hidden-works-content-rules.md](hidden-works-content-rules.md)
governs every regulatory string without exception and wins at every precedence
level. This workflow names no Додаток В field, adds no Додаток Н item, and cites
no clause number that its allow-list does not carry.

**Completion evidence:** the render is deterministic from one snapshot for the
same renderer version; no free-text quantity field exists in any render; and a
normative string without its `verification` tag and its source is unrenderable
in storage, not merely hidden in a template.

## End-to-end workflow 5: The link — v0.1 (M5)

**Primary actors:** acceptance liaison, technical-supervision reviewer.

1. A stage closure is blocked on a `hold` whose `approver_role` is external. An
   authorized member issues a personal grant scoped to that **requirement
   occurrence**. Grants cannot cross workspace, project, or contract boundaries.
2. Reviewer opens the fragment-bearing email link. The public shell removes the
   fragment from history and exchanges it by same-origin POST for a short,
   revocable session. **No account, no separately entered code.** An email
   scanner or prefetch GET cannot consume access.
3. Reviewer sees only the granted scope: the requirement itself — its acceptance
   criterion, its norm reference, and the rule version it came from — and the
   evidence objects linked to it.
4. Reviewer **accepts, or returns with a reason.** The recorded fact is an
   `evidence_decision` on the requirement occurrence.
5. An accepting decision from the role named by `approver_role`, with no current
   return, satisfies the occurrence; the closure then passes and produces the act
   of workflow 4. A return names what is missing and reopens **exactly that
   requirement**, not the line as a whole, and the team corrects at the source
   fact and re-presents.
6. The evidence decision has **no monetary effect**. v0.1 creates no accounting
   entry and no payment obligation, and the financial boundary of ADR-001 is
   untouched.
7. Possession of the link is access assurance, not verified legal identity. v0.1
   verifies no signatory's authority to sign for their organisation; it records
   the assurance label and the actor, and nothing more.

**The decision comes before the act, and that is not a re-ordering of the six
steps.** ADR-005 decision 9 makes an external evidence decision a precondition of
admission, and decision 10 makes the act a by-product of closure — so a `hold`
with an external approver has to be decidable *before* the closure it releases,
or the model is circular. ADR-006 lists the act at step 4 and the link at step 5
because that is the order in which the two **artifacts** appear to the
subcontractor; the decision that releases the closure necessarily precedes the
act the closure produces.

**What is deliberately not in this link.** No claim segments, no partial quantity
partition, no `commercial_decision`, no decision coverage, no approval-requirement
policy, and no observer over a package version. All of them are workflow 9.

**One resolved, one still open (2026-08-06).**

- **What the reviewer is handed after submitting — resolved 2026-08-06 by the
  owner.** `external_decision_batches` entered **v0.1-M5**
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4, amendment
  note), so the immutable decision receipt, the confirmation-text version and the
  idempotency record are carried by the batch in v0.1, created by the same submit
  action that records the `evidence_decision`.
  [`schema-v0.1.sql`](../../technical/database/schema-v0.1.sql) lines 1278–1283
  require a `decision_batch_id` on every externally submitted decision, so the
  requirement
  [`relationship-catalog.csv`](../../technical/database/relationship-catalog.csv)
  declares — a batch required exactly when the decision came through an external
  session, forbidden for an internal one — is satisfiable in v0.1. This bullet
  previously recorded that requirement as a contradiction needing an ADR; the
  owner settled it in place on 2026-08-06, not by a superseding ADR and not by a
  catalog edit ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4,
  amendment note). What stays v0.2
  is the commercial content recorded against a batch: `commercial_decision`,
  decision issues and decision coverage.
- **How the reviewer reaches the produced act — still open.** Through the same
  occurrence grant, through a second grant, or not at all in v0.1. **Nothing
  above assumes a new grant scope kind or a new artifact**, and this one needs an
  answer before the workflow is planned.

**Completion evidence:** revoked, expired, reissued, replayed, CSRF, and
wrong-scope submissions fail safely, and an occurrence grant confers access to
nothing else.

## End-to-end workflow 6: The blocked money — v0.1 (M6)

**Primary actors:** owner, commercial observer.

1. The owner opens one view: what is blocked, and how much money sits behind it.
2. The sum is over the work lines under a blocked stage, at the price on the
   **published baseline** — the same manually entered lines of workflow 1.
3. Value is attributed **once per assignment**. Several unmet requirements on one
   work reference the same assignment-scoped value and are deduplicated by
   assignment when summed, so the headline number cannot be inflated by counting
   the same money under three requirements.
4. The breakdown is by `blocked_reason.code`.
5. Sums stay **within one baseline and are never taken across baselines in
   different currencies.** There is no hidden exchange conversion.
6. Missing price, zero price, and over-contract performance stay distinct and are
   reported **beside** the sum rather than folded into it.
7. No user edits the aggregate to make it match an expected number; corrections
   occur at the authoritative source fact.

**Blocked value is exposure, never a receivable**, and it is reported beside
first-time acceptance rate and days-to-signature, never as the hero number
(ADR-005 assumption **b**, which the owner may reverse). This step is a query
over blocked reasons and work lines; it adds no table.

**Not in this workflow:** the seven-state value-at-risk projection with
currencies and tax bases, and its corrected precedence. Five of its seven states
name packaging or submission, and this step needs a sum and a cause, not a state
machine over states that cannot occur. It is workflow 11.

**Two preconditions, both hard.** M6 cannot open until **M0** is closed, and
closure means recorded evidence per item rather than a checklist someone has
read. And the pilot is an object, not a date: named partner, adversarial
технагляд, success measures, pre-gate baseline, sample, and stopping conditions
— all empty as of 2026-08-06.

## v0.2 workflow 7: Internal review

**Version:** v0.2. **Was:** part of workflow 3.

**Primary actors:** internal verifier, evidence recorder.

**Why it moved.** Internal review is a precondition of package eligibility and
of the `review` intervention type. Both move to v0.2, so it moves with them.
`is_package_eligible` and the freeze-refuses-ineligible-scope rule move with it;
`can_close_stage` — the half a foreman meets — ships in v0.1.

1. A review target set names the exact evidence and occurrence facts under
   review; its identity is immutable.
2. Verifier reviews those exact facts and accepts or returns.
3. Accept and return actions create append-only internal review decisions. The
   exception path — `waiver` and `accept_risk`, with `not_applicable` still
   refused on a `hold` by the exception command itself — is **v0.1** and is
   unchanged by this workflow (workflow 3).
4. A correction supersedes a prior decision; it does not mutate history.
5. GoProceed derives current readiness for homogeneous scope and explains each
   blocker.
6. Internal queues never become a second source of truth, and an internal
   outcome never accepts contractual quantity.

The two deferred intervention types release here: `review` on acceptance by the
current internal review head, and `witness` on a recorded notice event whose
server-computed `earliest_proceed_at` has elapsed. **The notice workflow is not
written in this document**, because the statutory notice apparatus — the
Ukrainian working-day calendar with state holidays, delivery proof, the push at
window opening, and the printed notice artifact — is v0.2 and undecided in
detail. Its absence here is not evidence that it is out of scope.

**Completion evidence:** every ready or blocked state resolves to exact current
facts and no queue/status row acts as an independent authority.

## v0.2 workflow 8: Package freeze and submission

**Version:** v0.2. **Was:** workflow 4.

**Primary actors:** package compiler, internal verifier, package submitter.

1. Compiler selects ready progress for one contract, package series, and period.
2. GoProceed prevents overclaim and creates homogeneous package lines and claim
   segments linked to exact progress sources.
3. Compiler selects a versioned package template and approval policy.
4. Internal checks show missing, conflicting, or out-of-scope inputs.
5. **Freeze refuses ineligible scope** instead of filtering it out: the
   finalisation command returns a per-segment reason list built from
   `blocked_reason` objects, together with the sum included and the sum excluded
   by currency. An ineligible segment is a named refusal and is never reported as
   a stale-source conflict.
6. Frozen contents pin contract/version, party snapshots, sources, requirements,
   reviews, evidence hashes, approval requirements, template, and renderer.
   Statutory act versions become additionally pinned by the package version that
   carries them.
7. PDF, XLSX, ZIP, and manifest artifacts derive from the same snapshot and
   cannot be overwritten. Every frozen version renders «виключені позиції та
   підстави» as an appendix, and the closure-without-evidence facts as a separate
   named appendix, each with value by currency.
8. Submitter creates a submission and personal grants for required reviewers and
   observers.

**Two migrations are owed before this workflow is correct on v0.1 data.** Every
`hold` written during v0.1 must be widened from `blocks_stage_closure` to
`blocks_both`, and existing act versions must be pinned to package versions.
Each needs a test that fails if a v0.1 row is left behind. Work recorded during
the pilot is the work most likely to be looked at later.

**Completion evidence:** package manifest deterministically identifies every
material input and artifact.

## v0.2 workflow 9: Multi-party partial acceptance

**Version:** v0.2. **Was:** workflow 5.

**Primary actors:** customer reviewer, technical-supervision reviewer,
acceptance liaison.

1. Reviewer opens the fragment-bearing email link.
2. Public shell removes the fragment from history and exchanges it by
   same-origin POST for a short session.
3. Reviewer sees only the exact package version and scope granted.
4. Reviewer may decide assigned quantity segments, evidence items, or both,
   according to the pinned approval requirement.
5. Partial quantity selection atomically partitions a pending segment into
   reconciled child segments.
6. One submit action creates an immutable decision batch and receipt.
7. Quantity acceptance requires acceptance from every required quantity approver
   covering the same segment.
8. Return from any required commercial approver blocks that segment; unaddressed
   scope remains pending.
9. Evidence return records a compliance issue but has no automatic monetary
   effect.

`commercial_decision` enters here as an **addition** to the `evidence_decision`
of workflow 5, which was named that way from the first migration precisely so
that no v0.1 record has to be reinterpreted.

**Completion evidence:** every current acceptance outcome is reproducible from
exact grants, requirements, sessions, batches, and segment decisions.

## v0.2 workflow 10: Return, correction, and resubmission

**Version:** v0.2. **Was:** workflow 6.

**Primary actors:** acceptance liaison, evidence recorder, verifier, compiler,
submitter.

1. Team receives structured returned quantity/evidence issues.
2. Correction creates successor progress/evidence/review facts.
3. Compiler prepares v2 from corrected facts.
4. Previously accepted unchanged segments are not claimed again.
5. v2 may reference v1 acceptance only when claim-scope lineage and approval
   scope hash match.
6. Material change to quantity, price/currency/tax, relevant evidence, contract
   terms, or approval policy requires a new decision.
7. New grants bind only to v2. Old decisions remain facts of v1.

The **v0.1 return** is smaller and lives in workflow 5: one reviewer returns one
requirement occurrence with a reason, the team corrects at the source fact, and
the same occurrence is decided again. Prior-acceptance references require a prior
acceptance, which requires a package.

**Completion evidence:** no decision is copied between versions and every prior
acceptance reference verifies unchanged material scope.

## v0.2 workflow 11: Value-at-risk explanation

**Version:** v0.2. **Was:** workflow 7.

**Primary actors:** commercial observer, acceptance liaison, management.

1. GoProceed assigns each exact segment to one disjoint state by precedence,
   first match wins, in the corrected order
   `accepted → returned → evidence_blocked → submitted_pending →
   packaged_not_submitted → internal_review → ready_not_packaged`.
2. Quantity value uses the pinned contract price, currency, tax basis,
   precision, and rounding policy.
3. Project totals remain grouped by currency.
4. User drills from state total to contract, package, line, segment, and blocker.
5. Missing price, zero price, and over-contract performance appear separately.
6. No user edits the aggregate to make it match an expected number; corrections
   occur at the authoritative source fact.
7. **No eighth state exists for a bypass:** `CLOSED_WITHOUT_ACT` is a
   `blocked_reason.code` inside `evidence_blocked`, so the state set stays
   disjoint and exhaustive.

The ADR-005 correction that ranks `evidence_blocked` above the packaging states
stands and applies the moment packages exist; with no packaging states there is
nothing to rank, which is why the whole projection waits. The **v0.1** answer to
the same question is the sum and the cause of workflow 6.

**Completion evidence:** every displayed amount reconciles to its segment facts
and rounded children reconcile to the canonical line total.

## Two workflows this document still does not contain

Named so their absence is never read as evidence that they are out of scope.
Both are v0.2 and neither is decided in enough detail to write down:

- **The witness notice and its attendance outcomes.** `witness` releases on a
  recorded notice event whose server-computed `earliest_proceed_at` has elapsed,
  with recorded non-attendance kept as evidence of process in favour of the
  performer. It moves to v0.2 with the statutory notice apparatus, and until the
  Ukrainian working-day calendar ships, a configured duration **must not be
  labelled as the five-working-day rule** of the примітка to Додаток В/Г —
  calendar days and робочі дні produce different dates.
- **The closure without evidence and its clearance.** The bypass is an
  attributed append-only fact whose price is package ineligibility, cleared only
  by an internal reviewer naming substitute evidence. It moves to v0.2 with
  packages, because in a version with no packages its price is zero.

## Workflow ownership rule

Job titles may preselect responsibilities in the UI, but only explicit
workspace role, project access, responsibility assignment, approval
requirement, or external grant authorizes an action.
