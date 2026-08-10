# Version roadmap

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-08-08

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
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


## Roadmap policy

Versions close sequentially through evidence and acceptance criteria. Dates may
be used for planning and review but are not fixed scope promises. A later
version does not begin by silently borrowing unfinished authority or invariants
from an earlier version. The same rule applies between milestones inside v0.1.

For each gate, evidence means a reproducible artifact such as a passing test,
migration verification, security review, working vertical scenario, documented
pilot outcome, restore exercise, or explicit user approval.

**For a milestone whose outcome is a refusal, evidence means a test that proves
the command refuses and names its reason object.** A report, a dashboard, a
warning banner, a red count, or a derived status that a user can override is not
evidence that a gate exists. The anti-pattern register in
[competitive-landscape.md](competitive-landscape.md) §4 is a list of products
that shipped exactly that and called it a gate; a milestone below closes on the
refusal or it does not close.

**Milestones inside v0.1 are M0–M6**, re-cut by
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 3. M0 may be built
in parallel with M1–M5, but M6 cannot open until M0 is closed, and M0 may never
be reordered behind M6.

**This document is one of the five artifacts ADR-006 requires to be rewritten
against it.** ADR-006 states that until
[roadmap.md](roadmap.md), [version-0.1.md](../delivery/version-0.1.md),
[scope-and-boundaries.md](scope-and-boundaries.md),
[entity-catalog.csv](../../technical/database/entity-catalog.csv) and
[scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv) all carry the re-cut,
the package is internally contradictory and no milestone may be planned from
either the roadmap or that ADR. The catalogs remain authoritative for the
row-level entity and route lists; this document is authoritative for what a
version contains and what closes it
([docs/README.md](../README.md) §"Source of truth", level 4).

## v0.0 — Canonical and safe foundation

### Outcome

One authoritative GoProceed package describes actual runtime separately from
the approved v0.1 target, and the existing tenant foundation is safe to extend.

### Exit gates

- canonical documentation, ADRs, source inventory, and legacy dispositions
  pass automated validation;
- local dependency installation has an explicit allow/deny build-script policy;
- local database startup and one root test command are reproducible;
- all baseline tests pass or a time-bounded quarantine for a non-security test
  identifies its owner, reason, expiry, and removal condition;
- tenant-isolation, authorization, migration-integrity, immutable-history,
  backup/restore, and external-decision security tests cannot be quarantined;
- audit, idempotency, and outbox data are tenant-isolated;
- first-owner bootstrap is serialized;
- own-party creation is permission-aware;
- audit is append-only and idempotency expiry is enforced;
- outbox has real delivery claim, retry, backoff, error, and dead-letter paths;
- seed credentials are environment-safe;
- additive migration, compatibility, rollback, and live-catalog verification
  plans are approved.

## v0.1 — The pilot: six steps a subcontractor can use unaided

### What v0.1 is

v0.1 is the smallest whole thing a subcontractor can use without help. It is
**not** a milestone list that ends in a pilot; the pilot is its content.

1. **The object.** ПТВ creates an object, enters the work lines **by hand**,
   picks a work type, and the requirements load from the shipped ДБН library at
   [dbn-a31-5-2016-dodatok-n.csv](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv).
2. **The phone.** The foreman opens the field client and sees what must be
   photographed **before covering**, in the standard's own wording, with a
   reference image. He takes it. That is the whole interaction.
3. **The refusal.** The stage cannot be recorded as closed while a `hold`
   requirement on it is unmet, and the attempt names exactly what is missing.
4. **The act.** «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ» by the form of Додаток В,
   assembled only from already-recorded facts, with no free-text quantity field
   in any render.
5. **The link.** Технічний нагляд opens a personal link with no account and
   accepts or returns with a reason.
6. **The money.** The owner sees what is blocked and how much money sits behind
   it — a sum over the manually entered lines with a breakdown by cause.

**Nothing outside this list is v0.1.** A capability does not enter because it is
already specified, already catalogued, already in the DDL, or already written
down in an Approved document. "It is already specified" is the cheapest argument
available and it is not a reason to build. The test is the list above: name the
step the capability is necessary for
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 1 and its
protection 1).

**Manual work-line entry is a first-class capability.** ПТВ types the lines.
This is not a stopgap for a missing importer and no document, screen, test, or
demonstration may describe it as one. It is how a v0.1 object is created, it is
what the six steps are demonstrated on, and it is what the blocked-money sum in
step 6 is computed over. It gets the same schema quality, the same provenance,
and the same tests as an imported line
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 2).

### The re-cut, and its authority

Until 2026-08-06 this document delivered v0.1 through six milestones with the
pilot last, which meant building parties, contracts, import, assignments,
evidence, requirements, stage closure, internal review, immutable packages,
claim segments, protected external access, partial acceptance, decision
coverage and the seven-state value-at-risk projection **before one
subcontractor clicked anything**. The
[package review](../delivery/package-review-2026-08-04.md) §8 measured that
remainder at roughly the size of everything built so far, and ADR-005 made it
larger on purpose.

[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) re-cuts it. Seven
milestones: one is new (M0), four survive with changed contents (M1, M2, M5,
M6), one splits (old M3), and one moves out of v0.1 entirely (old M4).

| Old milestone | Fate |
|---|---|
| — | **New: M0 — Fit to hold someone else's data** |
| M1 — parties, contracts, versions, and import | **Survives, re-scoped** as *The object and what it owes*. Import extension leaves; manual entry enters; the requirement rules, the Додаток Н library, and the baseline rule binding **merge in** from old M2 |
| M2 — assignments, progress, and online evidence | **Survives, re-scoped** as *The phone*. Requirement-occurrence materialisation **merges in** from old M3; capture telemetry and location-subtree bulk instantiation leave |
| M3 — requirements, stage closure, internal review, and readiness | **Splits.** The closure refusal survives as the new M3, *The refusal*. Internal review and `is_package_eligible` move to v0.2 with packages |
| M4 — immutable package generation | **Moves to v0.2 entire.** What survives in v0.1 is the statutory act, which becomes the new M4, *The act* |
| M5 — protected external access and partial decisions | **Survives, halved**, as *The link*. The evidence decision on a requirement occurrence survives; the commercial decision and everything segment-shaped moves to v0.2 |
| M6 — value at risk and pilot hardening | **Survives, replaced in content**, as *The blocked money*. The seven-state projection moves to v0.2; the sum, the breakdown by cause, and the pilot survive |

**The authority for this re-cut is the owner's instruction of 2026-08-06**,
carried by [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md). It is **not**
made on the founder-reported market signal of 2026-08-05, which
[validated-assumptions.md](../discovery/validated-assumptions.md) forbids from
driving a roadmap change and which is cited nowhere in this document as a reason
for anything.

**The v0.1 table set is twenty-six tables, of which nine already have a table
in an applied migration**, so v0.1 builds seventeen
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4, amended
2026-08-06 from twenty-three when the two requirement lineage heads and the
external decision batch moved into v0.1). Every row is here because a numbered
step above cannot happen without it.

| Milestone | Tables | Already in the runtime |
|---|---|---|
| M1 — The object and what it owes | `parties`, `projects`, `contracts`, `contract_versions`, `work_items`, `requirement_rule_versions`, `requirement_library_items`, `contract_version_rule_bindings` | first five |
| M2 — The phone | `work_assignments`, `requirement_occurrences`, `progress_entries`, `upload_intents`, `evidence_objects` | all but `requirement_occurrences` |
| M3 — The refusal | `work_stages`, `stage_closures`, `requirement_evidence_decisions`, `requirement_exceptions`, `requirement_exception_heads`, `requirement_evidence_decision_heads`, `readiness_projection`, `blocked_reasons` | none |
| M4 — The act | `statutory_acts`, `statutory_act_versions` | none |
| M5 — The link | `external_access_grants`, `external_sessions`, `external_decision_batches` | none |
| M6 — The blocked money | none. It is a query over `blocked_reasons` and `work_items` | — |

### The gate, and which milestone owns it

[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) gives v0.1 a
two-sided readiness gate that blocks exactly two recorded acts — the recorded
closure of a hidden or covered stage, and the eligibility of performed quantity
to enter a package version. It never blocks physical work, and it never refuses
to record a fact: performed quantity, captured evidence, and the fact that a
stage was in truth covered are always recordable, including when they record
something that went wrong.

**v0.1 ships the first half and not the second, and that is the main cost of the
re-cut.** There are no package versions in v0.1, so there is nothing for the
payment-presentation half to refuse. The positioning sentence

> «Ми не блокуємо роботу на майданчику — ми не даємо її пред'явити до оплати,
> поки доказ не отримано і не погоджено.»

is used verbatim where positioning is stated, and until packages ship in v0.2 it
may be used **only alongside an explicit statement that payment-presentation
eligibility is not in v0.1**. No demonstration, landing page, screen, or sales
sentence may show a payment-presentation refusal that does not exist
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) Consequences).

Milestone assignment, in one table.

| Gate element | Owner |
|---|---|
| Requirement rule versions published from the shipped Додаток Н Н.14/Н.15 library, immutable, bound at contract-baseline publication | M1 |
| Requirement occurrences materialised at assignment creation and visible before work starts; the dry run and its explicit uncovered-line list | M2 |
| Stages, stage closures, the closure refusal, `hold` and `blocks_stage_closure`, the `blocked_reason` object, the written `can_close_stage` predicate, the waiver/accept-risk exception | M3 |
| The statutory act by the form of Додаток В, pinned by the stage closure | M4 |
| `evidence_decision` on a requirement occurrence, decided through the occurrence-scoped protected link | M5 |
| The blocked-money sum and its breakdown by cause; the pilot that exercises a refused closure | M6 |
| `witness`, `review`, the notice apparatus, internal review, `is_package_eligible`, package freeze refusing ineligible scope, the excluded-scope and bypass appendices, `commercial_decision`, the corrected value-at-risk precedence | **v0.2** |

Five amendments to how ADR-005 lands in v0.1, each of which amends that ADR and
none of which makes anything overridable:

1. **`requirement_rules` is not in v0.1.** The only rule source is the shipped
   library; workspace-authored rule drafting is v0.2. Rule *versions* stay
   publish/retire-only and an occurrence still stores `rule_version_id`.
2. **The rule predicate narrows to (work type, stage).** `locations` and
   location-subtree bulk instantiation are v0.2. The dry run and its explicit
   list of uncovered lines survive, because silent non-coverage means there is
   no gate.
3. **`intervention_type` is `hold` only in v0.1.** The CHECK keeps all three
   values and the publication command rejects the other two, so v0.2 is
   additive and no v0.1 record is reinterpreted.
4. **A v0.1 `hold` is `blocks_stage_closure`, not `blocks_both`**, because the
   other half of `both` has nothing to block. The v0.2 package milestone owes a
   migration widening every `hold` written during v0.1, and a test that fails if
   one is left behind.
5. **Act versions are pinned by the stage closure, not by a package version.**
   In v0.2 the package version pins them additionally. The freeze discipline is
   unchanged.

**There is no bypass in v0.1.** ADR-005 decision 5 is unchanged and unshipped:
the price of a bypass is that the money waits, and in a version with no packages
there is no money to make wait. The v0.1 escape is the ADR-005 exception —
`waiver` and `accept_risk` by an authorised actor, attributed and visible, with
`not_applicable` still rejected on a `hold` by the exception command itself.

### Two contradictions this re-cut closes

**Closed: contract versions published in M1 could never acquire a rule
binding.** Until 2026-08-06 this document recorded that rules bind at
contract-baseline publication, that published versions are immutable, and that
`contract_versions.bind_rules` was an M2 operation — so every baseline an M1
pilot published carried no rule-version set and no later command could add one,
and delivery of the affected slice was stopped. Merging the rule half of old M2
into the new M1 dissolves it: the milestone that publishes a baseline is now the
milestone that binds its rules. **No baseline is published in v0.1 without a
rule-version set.**

**Superseded: the roadmap/catalog milestone disagreement of 2026-08-06.** Three
gate elements were assigned one milestone earlier here than in
[scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv) and
[entity-catalog.csv](../../technical/database/entity-catalog.csv), and the
correction resolved it in the catalogs' favour. That question no longer exists
in the form it was asked: the six milestones it ranged over have been replaced.
The correction is recorded here rather than deleted, and the catalogs carry the
new assignment.

### Import is frozen, not deleted

**Frozen means:** the XLSX/CSV importer built in M1 stays in the code exactly as
it is. No migration drops its tables, no code path is removed, nothing is
archived, and an object created by import continues to work. What changes is
that this roadmap stops treating its extension as v0.1 work, and stops making a
customer artifact an entry condition for a milestone that already shipped.

**Why.** There are zero customer documents of any kind — no example акт, no
кошторис, no КБ-2в, no виконавча документація
([validated-assumptions.md](../discovery/validated-assumptions.md)). That
document makes A-6 the sharpest open risk in the project, ahead of A-1, without
depending on any market signal: the import schema was specified against no real
file, and this roadmap made a representative sanitized artifact an *entry*
condition for M1, which shipped without one. Every further hour spent on column
mapping, unit inference, or number-format handling is an hour spent guessing at
a file nobody has seen.

**What unfreezes it:** one real sanitized кошторис, АВР, or interim-works file
from a named company, recorded in
[validated-assumptions.md](../discovery/validated-assumptions.md) with the
company and the date. One file is enough to unfreeze; it is not enough to
validate. Resuming import work without one is a decision to build against an
assumption and must say so in writing
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) protection 3).

### What exists today

Nothing of the gate is deployed. The runtime is 33 tables defined by 40
migrations through `0040`; `0036`–`0040` change grants, policies, scheduling and
constraints only and create no table. Seventeen of the twenty-six v0.1 tables
have no table in any applied migration.

*(Qualified 2026-08-08 — «deployed» and «written» have come apart, and every sentence above
is about the first. All of it is still exactly true of the **applied** migrations, `0001`–`0040`,
which define 33 tables. Migrations `0041`–`0050` are ten files written on an uncommitted branch and
**applied nowhere**; between them they carry `create table` for **seventeen of the twenty-six** v0.1
tables, plus every CHECK, trigger, policy and grant the readiness gate is made of. Having DDL is not
existing, and none of the ten files has ever been executed.)*

`work_assignments.requirement_template_version_id` is nullable and pins at most
one template per assignment
(`supabase/migrations/0015_execution_evidence_module.sql:85`); that template's
`severity text not null default 'blocking' check (severity in ('blocking','advisory'))`
is read by no application code
(`supabase/migrations/0015_execution_evidence_module.sql:46`); and the evidence
link carries `requirement_occurrence_id uuid` as a placeholder with its table
explicitly deferred
(`supabase/migrations/0015_execution_evidence_module.sql:251`). No capture code
exists in `apps/mobile` and none exists in `apps/app`.

Approved is not deployed. No milestone below is closed by a document, and this
document makes no test-count, green-baseline, or delivery claim.

### Entry evidence, re-cut

An entry condition is a thing the person building the milestone can obtain
**before starting it**. A condition that requires a conversation nobody has had
is not an entry condition; it is a wish, and putting it in front of a milestone
stops nothing and teaches nothing. Every practitioner-dependent entry item this
roadmap has ever carried is unmet, and M1 shipped through one of them anyway.

The re-cut therefore splits them:

- **entry conditions are inside the builder's control** — a written list, a
  published vocabulary, a chosen domain, a purchased device, a committed file, a
  recorded decision. They are stated per milestone below and none of them
  depends on a reply;
- **practitioner-dependent items become fields of the pilot object**, which is
  the content of M6 and which M6 cannot open without;
- **one item keeps its own named unfreeze condition**: import extension, which
  resumes on one real sanitized file and not before.

This amends the rule this document carried until 2026-08-06 — "discovery runs
alongside delivery and precedes each irreversible schema or UX freeze". It could
not be kept by the previous ordering, because every milestone from M1 to M5
froze a schema or a UX and every one of them named entry evidence that requires
a practitioner. What replaces it is the ADR-006 argument: **v0.1 is sized so
that each freeze inside it is cheap to redo after the pilot**, and the pilot is
what produces the evidence the freezes were waiting for. A smaller v0.1 makes a
wrong answer cheaper, not less likely.

### Entry-evidence status as of 2026-08-06

The discovery ledger records 21 evidenced sends and **zero replies, zero
interviews, zero named projects, zero pilot commitments, zero
willingness-to-pay signals, and zero customer documents of any kind**
([validated-assumptions.md](../discovery/validated-assumptions.md)). Every field
of the pilot object below is empty. Nothing in this roadmap may be read as
evidence that any entry-evidence item was collected.

**The pilot-device inventory still does not exist**, so the iOS 16.4+ and
Android 10+ support floor is an assumption and not a measurement.
[ADR-007](../decisions/ADR-007-pilot-field-client.md) changes what the devices
are for and when they are needed, and it removes the procurement chain that
stood in front of them:

| Was an M2 entry condition | Now |
|---|---|
| An Apple Developer Program membership (with a D-U-N-S number for organisational enrolment), a Google Play Console account, and a funded Expo plan with build minutes | **Removed entirely.** The v0.1 field client is a PWA served from `apps/app`; its whole distribution requirement is an HTTPS origin, which the product already requires |
| The test iPhone's UDID registered under that membership | **Removed entirely.** No internal-distribution build is installed in v0.1 |
| EAS internal preview builds installing on both platforms; TestFlight and Google Play internal-testing distribution | **Removed entirely**, as entry evidence and as exit evidence |
| An actual pilot-device inventory confirming the support floor, before capture UX is frozen | **Moved from entry to exit.** The devices are still required and matter more, not less — but what they are now needed for is measuring what a browser does with EXIF, with the `capture` attribute, and with storage eviction, and that measurement runs against the client M2 builds. A measurement of a built client cannot precede the build. What is entry is the written measurement plan; what is exit is the measurement |

The two physical devices — one supported iPhone, one lower-resource Android —
remain a requirement and remain unprocured. They are a purchase, not a
conversation, which is why they can be an exit gate honestly and could never be
an entry gate honestly.

The evidence for the gate itself is a landscape inference plus the owner's
judgement, not customer validation. Question 2 of
[competitive-landscape.md](competitive-landscape.md) §8 — whether evidence gaps
are even a top-two cause of delayed payment in Ukraine — is unanswered and can
invalidate the gate rather than merely its wording. Answering it is the pilot's
job.

### The pilot is an object, not a date

The pilot is no longer "M6". It is a record with required fields, and **every
field is empty as of 2026-08-06**. M6 does not open until all of them are
filled, and filling them is discovery work, not delivery work
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 8).

| Field | What it must contain | State |
|---|---|---|
| **Named partner** | One named company, one named object, and one named person who agreed. Not a lead, not a send, not a reply | Empty |
| **The технагляд** | Named, and **adversarial** | Empty |
| **Success measures** | First-time acceptance rate and days-to-signature ([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) assumption **b**), plus one measure the partner names themselves. If the partner cannot name one, that is a finding to record, not a field to skip | Empty |
| **Baseline** | Both measures taken on that object **before the gate is switched on**. Without a pre-gate baseline the pilot cannot show the gate helped, and a pilot that cannot fail cannot succeed. It can only come from the partner's own historical records — the project holds **zero customer documents of any kind** — and both measures still need a v0.1 definition, since the ones in [glossary.md](../domain/glossary.md) are written over v0.2 objects | Empty |
| **Sample** | How many stages, over what period, on what scope. Written down before the first act, so the sample cannot be chosen after the results are visible | Empty |
| **Stopping conditions** | What ends the pilot early, in both directions — the result that says stop building, and the result that says stop measuring and start selling. Named in advance, or the pilot runs until someone gets tired | Empty |

**The технагляд is adversarial by decision, not by accident**
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 9). One pilot
with a hostile технагляд, not three with loyal ones. A gate is a refusal, a
refusal is only observable when someone wanted to pass, and a client who signs
everything never wanted to pass — so a loyal reviewer produces a clean run, a
happy customer, and no evidence whatsoever about the product's only
differentiator. Three consequences are accepted in advance: the pilot is harder
to sell, it is more likely to fail, and **failure is recorded as a result, not
as a bug**. Choosing a loyal технагляд instead requires an ADR that supersedes
that decision and records what the resulting evidence will not prove.

### v0.1-M0 — Fit to hold someone else's data

**Outcome:** GoProceed is fit to hold a real company's data before any of it
arrives, with a recorded evidence artifact per item rather than a checklist
someone has read.

It is numbered **0, not 5.5**, deliberately. A list with no milestone is a list
that gets done last, and on a one-person project a list that gets done last is a
list that gets done never — while a pilot with real personal data on a real site
waits for it. Its owner is the owner; there is one person, so naming anyone else
would be fiction. What M0 adds is that the absence of an owner can no longer be
the reason the list is not done.

**Entry evidence:**

- the twelve exit gates of
  [scope-and-boundaries.md](scope-and-boundaries.md) §"M0 — Fit to hold someone
  else's data" transcribed into a per-item record that names the artifact which
  will close it and the form that artifact takes. Nothing else, because every
  item is inside the builder's control — which is why this milestone can open
  first.

**Exit gates — twelve, and twelve is eight plus four**
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 7 enumerates them;
this list is the same twelve in the same order). Each closes on a recorded
artifact:

- privacy notice published, and the external confirmation text stored with an
  explicit version identifier;
- documented retention periods and a manual closure/deletion procedure,
  exercised once end to end on synthetic data;
- workspace export produced and reopened;
- audit and security telemetry restricted, each event carrying a declared
  purpose and retention;
- a backup taken and restored into an empty environment, with the restore
  verified rather than assumed;
- external-link assurance limits documented, including the explicit statement in
  the UI and on every printed page that link confirmation **is not an electronic
  signature** — level 3 of the assurance ladder in
  [hidden-works-content-rules.md](hidden-works-content-rules.md), never level 4
  or 5;
- secrets and environment separation;
- monitored job and message failure paths — **a separate gate from the one above,
  not merged with it**, because a merged pair is a list of twelve carrying eleven
  obligations;
- **no normative string renderable without its `verification` tag and its
  source**, enforced in storage rather than in a template, so a later
  contributor cannot add an unsourced line to Н.15 by editing a view. **What
  closes this gate for the shipped library is the retrieval record for the
  primary ДБН file** — exact URL, retrieval date, and SHA-256 of the bytes —
  committed under `technical/requirements/`. Today every `VERIFIED_PRIMARY` row
  rests on one download no reviewer can reopen, which is the open item
  [hidden-works-content-rules.md](hidden-works-content-rules.md) records against
  each of them; a re-fetch that does not reproduce the same bytes downgrades
  every row it touches to `VERIFIED_SECONDARY`. It is **not a thirteenth gate**
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 7);
- a recorded date of last verification against the Реєстр будівельних норм,
  printed in the disclaimer on every generated act;
- tenant-isolation tests for every module v0.1 ships;
- malware/content-type and resource-exhaustion controls for uploads **and
  imports**, including the formula, macro, archive, file-size, worksheet and row
  safety limits of the frozen importer **and export neutralization against
  spreadsheet formula injection** — the workspace export gate above is what makes
  the second half a v0.1 obligation rather than a package concern, and it is not
  inferable from a shortened "uploads and imports" wording.

**M6 cannot open until this milestone is closed.** Real customer data entering
an environment that has not closed M0 is a boundary violation regardless of
which document or schedule requests it.

### v0.1-M1 — The object and what it owes

**Outcome:** ПТВ creates an object, types its work lines by hand, picks a work
type per line, and publishes a baseline that pins the exact rule-version set the
work will be judged against — drawn from the shipped ДБН library.

**Entry evidence:**

- the field list a ПТВ types for one work line — code, description, section,
  unit, quantity, unit price, currency, tax basis, work type — written down and
  reviewed before the manual-entry schema is frozen. It is derived from the
  fields the published contract baseline already carries and from what the
  blocked-money sum of step 6 must be computed over, **not** from a customer
  document, and that origin is recorded beside it so nobody later reads it as
  validated;
- the work-type vocabulary the rule predicate keys on, enumerated and published,
  because a predicate over (work type, stage) cannot be written against an open
  set;
- the stage vocabulary published as the second key of that predicate; `work_stages`
  as a closable unit is M3, but the value set is needed here;
- the shipped library file present and complete —
  [dbn-a31-5-2016-dodatok-n.csv](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv),
  Н.14 (5 items) and Н.15 (7 items), twelve rows, each carrying its
  `verification` tag and its source;
- a recorded decision that contract-baseline import is frozen at what M1 already
  shipped, naming the one file that would unfreeze it.

**Exit gates:**

- tenant-local parties and stricter own legal profiles work end to end;
- one project holds contracts for different own parties;
- every contract pins own/customer parties, currency, tax, terms, and approval
  policy;
- **manual work-line entry is a first-class path**: a hand-typed line carries the
  same provenance record as an imported one — actor, server time, the baseline
  draft it belongs to, and the values as entered — and it is covered by the same
  tests. A test or document that describes it as a stopgap fails this gate;
- the XLSX/CSV importer keeps working unchanged, its tables are not dropped, and
  an object created by import continues to work;
- published versions are immutable, and reimport still produces diff and lineage
  for objects that were imported;
- requirement rules exist as a predicate over **(work type, stage)** yielding an
  ordered requirement set, and each requirement carries `evidence_kind`,
  `acceptance_criterion`, `norm_ref`, `performer_role`, `approver_role`,
  `intervention_type`, `blocking_scope`, `timing`, and `multiplicity`;
- rule versions are published **from the shipped library only**; there is no
  workspace-authored rule drafting in v0.1, and a test proves the publication
  command accepts no other source;
- rule versions are publish/retire only and are never updated in place; a
  consumer addresses a rule version by id, never through a live pointer;
- the publication command **rejects any `intervention_type` other than `hold`**,
  while the CHECK keeps all three values, so v0.2 is additive and no v0.1 record
  is reinterpreted;
- the publication command **rejects any `hold` whose `blocking_scope` is
  anything other than `blocks_stage_closure`**;
- publishing a contract baseline pins the exact rule-version set beside the
  party, currency, tax, terms, and approval-policy snapshots; a test proves the
  binding cannot be added to an already published version; and **no baseline is
  published without a rule-version set**;
- the shipped requirement library carries Додаток Н positions Н.14 and Н.15
  verbatim, each row storing its `verification` tag and its source in the data;
- a library or rule string with no source is unrenderable, enforced in storage
  rather than in a template;
- anything the product recommends beyond Додаток Н is stored in a separate block
  labelled «Додатково рекомендуємо (не з Додатка Н)» and carries no normative
  citation. [hidden-works-content-rules.md](hidden-works-content-rules.md)
  governs every regulatory string without exception;
- tenant-isolation tests and one working vertical scenario through the
  UI/API/database boundary.

**Not in M1:** `locations` and the location tree, `unit_definitions` beyond the
units a manual line needs, `requirement_rules` as an authoring surface, and any
extension of the importer — all v0.2.

### v0.1-M2 — The phone

**Outcome:** the foreman opens a link on his own phone, sees what must be
photographed **before covering** in the standard's own wording with a reference
image, and takes it. One interaction, and fewer actions than sending a photo to
a group chat.

**Entry evidence:**

- an HTTPS origin serving `apps/app`, which the product already requires. Under
  [ADR-007](../decisions/ADR-007-pilot-field-client.md) that is the entire
  distribution requirement for the v0.1 field client. No store account, no
  D-U-N-S number, no funded Expo plan, no UDID registration, and no
  internal-distribution track is an entry condition for this milestone or an
  exit gate for it;
- a written measurement plan for the browser behaviours ADR-007 refuses to
  assume: which engines and OS versions strip or re-encode image metadata, how
  each honours the `capture` attribute on a file input, the storage-eviction
  rule, and whether an installed home-screen PWA is exempt from it. The plan is
  entry; the measurement is exit, because it measures the client this milestone
  builds;
- the six client-state labels the PWA path has — `not_sent`, `sending`,
  `awaiting_receipt`, `server_confirmed`, `failed` and `discarded` — re-read for
  a browser client before the capture screen is written. They are fixed in
  [`technical/states/state-catalog.csv`](../../technical/states/state-catalog.csv),
  which also carries `quarantined` and `expired_purged` as **native-client-only**
  states. [`technical/copy-catalog.csv`](../../technical/copy-catalog.csv) is
  **not yet aligned**: it carries a `quarantined` label, which is native-only,
  and **no `discarded` label at all**, so the copy row this milestone needs is
  owed before the capture screen is written;
- M1 closed: an occurrence cannot be shown before a rule version is bound to a
  published baseline to materialise it from.

**Exit gates:**

- the v0.1 field client is a **PWA served from `apps/app`**, behind the same BFF
  boundary the web product uses: the server authenticates the subject, resolves
  membership, project access and permission, and executes one bounded
  transaction. The client trusts nothing it holds;
- `apps/mobile` is **not on the v0.1 path** and is not deleted: it stays in the
  tree on Expo SDK 57.0.9 with its scheme registered, as the starting point for
  v0.3;
- assignment supports performer, quantity, optional member and due date, and the
  requirement occurrences materialised from the rule versions bound to the
  published contract version;
- occurrences are materialised **when the assignment is created**, with no
  evidence yet linked, carrying `rule_version_id`, `intervention_type`,
  `blocking_scope`, `evidence_kind`, `acceptance_criterion`, `norm_ref`,
  `performer_role`, and `approver_role`;
- occurrences are visible in the field client **before work starts**; a
  placeholder that appears only after the stage is covered does not close this
  gate;
- the materialisation command has a **dry run** that previews what it will
  create, counts matches per rule version, and prints an **explicit list of work
  lines whose work type no bound rule version covers**. The uncovered list is
  command output, not a report someone may choose to run, because silent
  non-coverage means there is no gate;
- each occurrence renders the standard's wording verbatim from the shipped
  library, with its `verification` tag and source, beside a reference image that
  is the product's own illustration and carries no normative citation;
- `work_assignments.requirement_template_version_id`
  (`supabase/migrations/0015_execution_evidence_module.sql:85`) is retired by a
  new migration and nothing reads it after this milestone closes; `severity` as
  a free axis is retired with it, its consequence replaced by `blocking_scope`;
- the client uploads the `File` bytes **unmodified** and never draws a photo to a
  canvas before upload;
- **no screen reports success before the receipt.** `upload_received` is not
  `evidence_available`, and no photo is shown as recorded until the `available`
  receipt is persisted;
- the client uploads immediately and offers no durable local queue it cannot
  honour. If an upload cannot complete, or the page is about to be left with an
  in-flight or unsent original, the user is told plainly that GoProceed has not
  saved the photo and that it must be retaken or kept by them. **A silent loss
  fails this gate**;
- INV-013, INV-014 and INV-053 are **not claimed on the PWA path**. They remain
  the native client's invariants and become v0.3 obligations, and the weaker
  v0.1 invariant — no success before the receipt, no silent loss — is added to
  [`invariant-catalog.csv`](../../technical/database/invariant-catalog.csv) with
  its own identifier;
- `quarantined` and `expired_purged` are recorded as native-client states; on
  logout, revocation or account switch the PWA discards the in-memory original
  and says so;
- the evidence record carries a **client-computed content hash** verified at
  finalization against the bytes the server received, a **server receipt time**
  generated by the server and never by the client, and a **device-claimed
  capture time stored beside it and explicitly labelled untrusted**;
- `origin method` carries a value meaning the origin is **not distinguished**,
  and no object captured through the PWA is recorded with a value asserting a
  native camera session. **That value now exists in the target DDL
  (`technical/database/schema-v0.1.sql:97`), in the state catalog and in
  INV-086, but not in the deployed enum or the request contract — and until it
  lands in both, no PWA capture may be recorded at all**: the
  deployed enum offers `native_camera`, `photo_picker`, `file_picker`, `form`,
  `import` and `generated_derivative`
  (`supabase/migrations/0015_execution_evidence_module.sql:254-255`), every one
  of which asserts a distinguished origin, and
  `packages/contracts/src/uploads.ts` accepts the first four. Adding it — to the
  domain layer, the enum, the contract and the catalogs — is work of this
  milestone and closes before the first capture is recorded;
- **nothing stronger is claimed anywhere** — not in the UI, not in a package, not
  in a demo, not in a sales sentence: no camera-only capture for a blocking
  requirement, no camera-versus-gallery label, no tamper-evident provenance, no
  verified capture-time GPS. The hash binds the uploaded artifact, not the
  sensor output, and no document may describe it as binding the sensor output;
- **push is not shipped and is not claimed** on either platform;
- the measurement plan is executed on one physical supported iPhone and one
  lower-resource physical Android device, and recorded. Until it is recorded the
  client behaves as though eviction can happen at any time, and no
  customer-facing artifact asserts anything about EXIF, `capture`, or eviction
  from memory;
- the camera-permission failure path has an explanation and a file/photo
  alternative;
- progress correction is append-only; evidence original, hash, provenance,
  actors, capture time and receipt time are immutable; whole-upload retry is
  idempotent; evidence correction and derivative lineage are testable;
- tenant-isolation tests and one working vertical scenario.

**Not in M2, and previously here:** the three `apps/mobile` gates — an
Expo/React Native client, camera capture on a device matrix, and EAS/TestFlight/
Play distribution — are replaced by the PWA gates above. The two persistence
gates that stood beside them — a simulated connection loss retaining the local
original until verified server receipt, and pending original plus retry state
surviving an ordinary app restart — are **withdrawn from v0.1**, because a
browser gives neither an OS-sandboxed app area nor a hardware-backed key and
Safari may evict script-writable site storage. They become v0.3 obligations of
the native client. This is a real reduction in what the product guarantees a
foreman, accepted because the alternative is a client nobody can install.

Also not in M2: capture telemetry, location-subtree bulk instantiation, and
offline anything.

### v0.1-M3 — The refusal

**Outcome:** GoProceed **refuses** to record the closure of a stage while a
`hold` on it is unmet, and every refusal names the requirement, the missing
evidence, the role that owes the decision, and the money that waits. Recording
what actually happened is never refused.

**Entry evidence:**

- the `blocked_reason` code vocabulary closed and versioned in
  [`state-catalog.csv`](../../technical/states/state-catalog.csv) before the
  first refusal is written, because a refusal whose reason is free text is a
  message and not an object;
- the exception-kind vocabulary — `waiver`, `accept_risk`, `not_applicable` —
  recorded with the command-level rule that `not_applicable` is rejected on a
  `hold`;
- the stage vocabulary published in M1, and M2 closed.

No practitioner artifact is an entry condition here. The real sanitized cases
this milestone previously demanded — an evidence-requirement example, a review
outcome, a stage covered without an act, and the practitioner's answer to who
decides evidence acceptance — are **pilot observations**, and they are carried by
the pilot object above.

**Exit gates — each one a refusal or an append-only fact, never a report:**

- `intervention_type` and `blocking_scope` are stored on the rule version and
  materialised onto the occurrence, never inferred from a severity word at read
  time;
- `can_close_stage(s)` is implemented as written in
  [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) decision 7,
  quantified over the occurrences whose `blocking_scope` is
  `blocks_stage_closure`, and the closure command **refuses**. A test proves the
  refusal; a screen that displays «не готово» closes nothing;
- the refusal returns the `blocked_reason` object — requirement occurrence, rule
  version, missing evidence by kind and criterion, awaiting approver role,
  since, blocked value by currency, and a code from the closed vocabulary
  including `ACT_NOT_SIGNED`, `TEST_REPORT_MISSING`,
  `MATERIAL_CERTIFICATE_MISSING`, `SUPERVISION_SIGNATURE_MISSING`, and
  `CUSTOMER_MOTIVATED_REFUSAL`;
- blocked value is attributed **once per assignment** and deduplicated by
  assignment when summed, so several unmet requirements on one work cannot
  inflate the number;
- readiness remains a projection, is never an editable status column, and has no
  manual override of a derived state;
- **the exception command itself rejects `not_applicable` on a `hold`**; waiver
  and accept-risk exceptions remain available to an authorised actor and remain
  visible, because an exception that hides itself is worse than no exception.
  This is the only escape in v0.1;
- recording a covered stage, a performed quantity, or a captured photo is never
  refused, including when it records something that went wrong;
- requirement rule versions and occurrences are immutable, and exceptions
  preserve history. **Many-to-many evidence links are not a v0.1 gate:**
  `evidence_links.create` and its link table left v0.1 with the commercial half
  ([`scope-v0.2.csv`](../../technical/openapi/scope-v0.2.csv)), and in v0.1 one
  original is bound to one occurrence by the upload intent it was captured under;
- readiness is derived at homogeneous quantity scope and every blocker drills to
  authoritative facts. **The audit warning for sensitive combined
  responsibilities is v0.2** and is not a gate of this milestone
  ([scope-and-boundaries.md](scope-and-boundaries.md) §"Displaced from v0.1"): it
  warns about self-review, and the internal review it protects moves to v0.2.
  Until it ships, nothing warns an authorised actor who waives their own
  requirement, and the exception's visibility is what carries that weight;
- while M5 is open, the rule publication command enforces that a `hold` names an
  **internal** approver role — enforced by the command, not by convention;
- tenant-isolation tests and one working vertical scenario.

**Not in M3:** internal review and `is_package_eligible`, which are preconditions
of package eligibility and move to v0.2 with packages; `witness` and its notice
event and attendance outcomes; `review`; and the closure-without-evidence bypass
with its clearance. `can_close_stage` — the half a foreman meets — ships here;
`is_package_eligible` ships in v0.2.

### v0.1-M4 — The act

**Outcome:** closing a stage whose requirements are satisfied produces «АКТ НА
ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ» by the form of Додаток В (обов'язковий), assembled
only from already-recorded facts.

**Entry evidence:**

- the В.1/В.2 field list exactly as
  [hidden-works-content-rules.md](hidden-works-content-rules.md) allow-lists it,
  transcribed into the render's field map before the composer is written, with
  prohibition E's banned fields — «шифр», «аркуш», «ким видана», «паспорт»,
  «Акт №», «м.п.», a fourth signatory — listed beside it so a later contributor
  cannot add one;
- the required disclaimer text and the recorded date of last verification
  against the Реєстр будівельних норм, both from M0;
- M3 closed, since the act is a by-product of a satisfied closure.

Checking the render against a document a practitioner already recognises is a
**pilot observation**, not an entry condition. No signed акт exists to check it
against, and requiring one in front of this milestone stopped nothing when it
was required in front of the old M3.

**Exit gates:**

- the act is assembled **only from already-recorded facts** — progress entries
  already on the line, evidence objects already available, occurrence decisions
  already made, and party data already on the participant records. **There is no
  free-text quantity field in any render**, and the composer offers only
  `quantity_entries` already recorded against the line, with a share selector;
- act versions are immutable and are **pinned by the stage closure**; in v0.2 the
  package version pins them additionally, and the freeze discipline is unchanged;
- the act carries three typed signatory slots. The технагляд's кваліфікаційний
  сертифікат (ПКМУ № 903, п. 3) is held on the participant record; **whether
  Додаток В has a field for its серія and номер is not established**, so nothing
  is printed into the form for it until
  [hidden-works-content-rules.md](hidden-works-content-rules.md) allow-lists that
  field against the В.1/В.2 field list, and prohibition E bans the adjacent «ким
  видана»;
- Додаток Г is a separate template for responsible structures, and the mapping of
  a Н.14/Н.15 position to form В or form Г is labelled in the UI and in the
  render as **the product's assumption**;
- the довідковий disclaimer under a generated requirement list is rendered
  uncollapsed;
- no normative string renders without its `verification` tag and its source, and
  the act render refuses one that has neither;
- repeated generation is deterministic from one snapshot for the same renderer
  version, and frozen content and artifact keys cannot be mutated or
  overwritten;
- tenant-isolation tests and one working vertical scenario.

**Not in M4:** packages, package versions, package lines, package artifacts,
approval requirements, the «виключені позиції та підстави» appendix, the bypass
appendix, and КБ-2в (Додаток 36) and КБ-3 (Додаток 37) rendering — all v0.2.

### v0.1-M5 — The link

**Outcome:** технічний нагляд opens a personal link with no account, sees one
requirement occurrence with its evidence, and accepts or returns with a reason.

**Entry evidence:**

- the GoProceed domain chosen, and its HTTPS origin serving the external review
  shell. The link host is undecided today and neither well-known file exists;
  under [ADR-007](../decisions/ADR-007-pilot-field-client.md) this is a plain
  URL problem rather than an app-association problem, but a domain still has to
  be chosen, and it is chosen here. «A link is a destination, never an
  authorization» binds the external shell unchanged;
- the versioned external confirmation text and the level-3 assurance strings
  from M0, because the reviewer reads them before they decide;
- M3 closed, since an accepting decision by the occurrence's `approver_role` is
  what satisfies a `hold`.

The reviewer walkthroughs this milestone previously demanded are **pilot
observations** and belong to the pilot object above; A-3 — that an external
reviewer will decide inside a protected link without an account — is
`Unvalidated` and this milestone does not improve it by an inch.

**Exit gates:**

- an external access grant targets a **requirement occurrence**. The
  package-version scope kind arrives with packages in v0.2, and a grant still
  cannot cross workspace, project, or contract boundaries;
- the bearer token uses the URL fragment, with immediate history cleanup,
  same-origin POST exchange, hashed storage, redacted logs, and a short
  revocable session;
- an email scanner or prefetch GET cannot consume access;
- an observer cannot decide;
- the decision is **named `evidence_decision` from the first migration**, so
  adding `commercial_decision` in v0.2 is additive and no v0.1 record has to be
  reinterpreted; the API cannot express one as the other;
- an accepting `evidence_decision` by the occurrence's `approver_role` satisfies
  a `hold`; a return names its reason and leaves the `hold` unsatisfied. Where
  the approver is external, this decision precedes the closure of M3 and
  therefore the act of M4 — which is the whole reason the grant scope kind is a
  requirement occurrence and not a package version;
- from this milestone a `hold` may name an external approver role, and the M3
  restriction is lifted by the same change that ships the occurrence grant;
- revoked, expired, reissued, replayed, CSRF, and wrong-version submissions fail
  safely;
- the reviewer receives an **immutable decision receipt**, and every rendered
  decision block prints its assurance level. A level-3 record prints «Це не
  електронний підпис» and is never described, labelled, exported, or
  demonstrated as an electronic signature;
- external review is never routed into a native client. v0.1 has no native
  client on its path, so the rule is not engaged here and binds unchanged the
  moment one returns in v0.3;
- tenant-isolation tests and one working vertical scenario.

**One delivery consequence, resolved on 2026-08-06 rather than left open.**
[version-0.1.md](../delivery/version-0.1.md) records that a decision batch was
the carrier of the receipt, the confirmation-text version and the idempotency
record for an occurrence-scoped submit. `external_decision_batches` entered
**v0.1-M5** on the owner's instruction of 2026-08-06
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4, amendment
note), so the batch is that carrier in v0.1 too, and
[`schema-v0.1.sql`](../../technical/database/schema-v0.1.sql) lines 1278–1283
require a `decision_batch_id` on every externally submitted decision. What stays
v0.2 is the commercial content recorded against a batch, not the batch.

**Not in M5:** `commercial_decision`, decision issues, decision coverage,
per-segment partial acceptance, prior-acceptance references — all v0.2 with
packages. КЕП is v0.2; v0.1 prints `LINK_CONFIRMATION` and the negative
statement.

### v0.1-M6 — The blocked money, and the pilot

**Outcome:** the owner sees what is blocked and how much money sits behind it — a
sum over the manually entered lines with a breakdown by cause — and one named
subcontractor runs all six steps on one named object with an adversarial
технагляд.

**Entry evidence:**

- **M0 closed**, with a recorded artifact per item;
- **every field of the pilot object filled.** All six are empty as of
  2026-08-06, and filling them is discovery work, not delivery work;
- M1–M5 closed.

**Exit gates:**

- the blocked-money sum is the amount of the work lines under a blocked stage,
  at the price on the published baseline, attributed **once per assignment**,
  broken down by `blocked_reason.code`, and summed **within one baseline and
  never across baselines in different currencies**;
- missing price, zero price, and over-contract performance stay distinct and are
  reported beside the sum rather than folded into it;
- blocked value is **exposure, never a receivable**; v0.1 creates no accounting
  entry, no payment obligation, and no cross-currency sum, and ADR-001's
  financial boundary is untouched;
- **there is no seven-state value-at-risk projection in v0.1.** Five of its seven
  states name packaging or submission and cannot occur here; the projection, its
  currencies and tax bases, and the corrected precedence arrive in v0.2;
- first-time acceptance rate and days-to-signature are reported as the headline
  pair against the pre-gate baseline, with blocked value beside them and never
  as the hero number
  ([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) assumption
  **b**, which the owner may reverse). Whether either is computed inside the
  product or recorded beside it is a delivery question for
  [version-0.1.md](../delivery/version-0.1.md); the reporting rule binds either
  way. **Neither measure has a v0.1 definition yet, and this milestone cannot
  open without one.** [glossary.md](../domain/glossary.md) defines first-time
  acceptance rate over claim segments and their first submission, and
  days-to-signature from a frozen package version's submission to a terminal
  commercial decision — claim segments, package versions, submissions and
  `commercial_decision` are all **v0.2** — `external_decision_batches` moved
  into v0.1-M5 on 2026-08-06 and is the one object of the five that did not — so
  as defined today neither number can be computed on v0.1 data and the pre-gate
  baseline of the pilot record cannot be taken. A v0.1 definition of both is owed
  by the domain layer before M6 opens, and it is a definition question, not a
  reporting one;
- the pilot exercises all six steps end to end on the named object: an object
  created by hand with its lines typed, a requirement read on the phone before
  covering, a **refused closure with its named reason object**, a satisfied
  closure with its act, an external acceptance and an external return with a
  reason, and the blocked sum with its breakdown by cause;
- **at least one refusal the технагляд disputed, escalated, or routed around is
  recorded** — or its absence is recorded, with what that absence does and does
  not prove. This is the single most valuable observation available to the
  project and it cannot be obtained from a loyal reviewer;
- if the технагляд refuses to open the link, refuses to decide inside it, or
  demands paper, that **invalidates A-3** and is written into
  [validated-assumptions.md](../discovery/validated-assumptions.md) as an
  invalidation, marked `Invalidated` and never deleted;
- no demonstration during the pilot shows a payment-presentation refusal, which
  does not exist in v0.1;
- pre-pilot privacy, retention, export, deletion, telemetry, assurance and
  restore controls remain verified throughout the pilot;
- pilot findings, unresolved operating constraints, and **what the pilot did not
  answer** are documented, against the stopping conditions written down in
  advance.

## v0.2 — The commercial half, and pilot hardening

### Outcome

The half of the loop v0.1 does not build — presentation of performed quantity
for acceptance and payment — is delivered on top of a pilot-tested v0.1, and
observed pilot friction is reduced without changing v0.1 source-of-truth
boundaries.

Calling this version "pilot hardening" alone is no longer accurate. It now
carries the commercial half of the product, and it is much larger than
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md) describes.

### The commercial half, moved here by ADR-006

Every row keeps its ADR-005 text unchanged. None is cancelled; each is named
with the reason it is not needed by one of the six steps. Each still requires
its own decision before it enters the version; an owning version is a routing
note, not an approval. **What moves is the work, never the row:** several of the
objects below — `progress_allocation_heads`, `valuation_allocations`,
`locations`, `unit_definitions` among them — already have a table in an applied
migration and stay exactly where they are, and no catalog may re-tag a deployed
table to a future version
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4;
[scope-and-boundaries.md](scope-and-boundaries.md) §"Size decision" carries the
full list of eleven).

| Moved from v0.1 to v0.2 | Reason |
|---|---|
| Package versions, package lines, `package_scope_heads`, package artifacts, package approval requirements | Step 5 is one person accepting one act through one link. A frozen multi-line claim document is the commercial half, and no step needs it |
| Claim segments and their lineage heads | A segment exists to be partially decided inside a package. With no package, a segment is a row with nothing to say |
| The allocation ledger — `progress_allocation_heads`, `valuation_allocations`, `progress_claim_allocations` | It carves minor units out of a work-item pool for admission into a claim. Nothing in v0.1 is admitted to anything |
| Per-segment partial acceptance | Requires segments |
| Decision coverage | Reviewer-order independence across arbitrary partial partitions is correct and far ahead of any evidence that a first pilot needs it ([package review](../delivery/package-review-2026-08-04.md) §6) |
| Prior-acceptance references | Requires a prior acceptance, which requires a package |
| The seven-state value-at-risk projection with currencies and tax bases, and the corrected precedence | Five of its seven states name packaging or submission. Step 6 needs a sum and a cause, not a state machine over states that cannot occur. The correction stands and applies the moment packages exist |
| Internal review — `review_target_sets`, `review_target_items`, `internal_review_decisions` and their heads | Internal review is a precondition of package eligibility and of the `review` intervention type; both move, so it moves with them |
| `is_package_eligible`, and freeze refusing ineligible scope with a per-segment reason list | Requires packages |
| The closure-without-evidence bypass and its clearance | Its price is package ineligibility, and in a version with no packages that price is zero |
| `witness` and the notice event; `review` | `witness` needs the notice apparatus; `review`'s only blocking scope is package inclusion |
| `commercial_decision`, decision issues, and coverage | Step 5 is an evidence decision. `external_decision_batches` itself does **not** move: it entered v0.1-M5 on 2026-08-06 ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4, amendment note) as the carrier of the occurrence-scoped receipt. What moves is the commercial content recorded against a batch |
| `locations`, location-subtree bulk instantiation, `unit_definitions` beyond the units a manual line needs | The rule predicate narrows to (work type, stage) in v0.1 |
| Contract-baseline **import** — extension only | One real sanitized file unfreezes it; the importer itself keeps running unchanged |

### Two migrations owed to v0.2, and not to be forgotten

Work recorded during the pilot is the work most likely to be looked at later.

1. **Widen every `hold` written during v0.1** from `blocks_stage_closure` to
   `blocks_both`, with a test that fails if one v0.1 row is left behind. Without
   it, every requirement recorded during the pilot is permanently outside the
   payment-eligibility half of the gate and nobody would notice.
2. **Pin existing act versions to package versions** once packages exist, with a
   test that fails if a v0.1 act version is left unpinned.

### Gate capabilities owned by v0.2

Assigned an owning version by
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md). Each still
requires its own decision before it enters the version.

- `evidence_plan` — the counter-signed, externally agreed requirement list that
  makes the gate two-sided in its rules and not only in its decisions;
- the statutory notice apparatus: Ukrainian working-day calendar with state
  holidays, delivery proof, the push when the notice window opens, and the
  printed notice artifact. Until it ships, a configured notice duration is a
  workspace setting and **must not be labelled as the five-working-day rule** of
  the примітка to Додаток В/Г, because calendar days and робочі дні produce
  different dates;
- the silence clock and the unilateral act on a counterparty's unmotivated
  refusal to sign. **The statutory basis is not established.** No civil-code
  article, part, or court decision may be cited for this item until
  [hidden-works-content-rules.md](hidden-works-content-rules.md) allow-lists one
  against a fetched primary text; until then this row names a product behaviour
  and no norm;
- the submission-requirements matrix (Not tracked / Warn / Prevents submission)
  with attributed per-requirement waivers;
- КЕП: `assurance_level` on decisions and a detached `.p7s` over the frozen
  version hash. v0.1 ships `LINK_CONFIRMATION` only and states plainly, in the
  UI and on the printed page, that it is not an electronic signature — level 3
  of the assurance ladder in
  [hidden-works-content-rules.md](hidden-works-content-rules.md);
- qualified timestamps (RFC 3161) over evidence hashes and package-version
  Merkle roots;
- КБ-2в (Додаток 36) and КБ-3 (Додаток 37) rendering with a mandatory
  `form_version` on every document;
- non-conformance objects whose disposition moves money;
- додаткові угоди as first-class baseline amendments.

### Candidate scope

- additional import adapters and package/requirement templates, once the file
  that unfreezes import exists;
- reusable versioned import mappings justified by repeated source formats;
- workspace-authored requirement rules beside the shipped library;
- guided onboarding and safe sample workspace creation;
- product analytics with privacy controls;
- durable `/demo` inside `apps/app` using isolated synthetic data;
- demo reset and abuse controls;
- the first optional AI-assist capability selected from observed work;
- the decision between an installed home-screen PWA and the native client for
  recipients who want push, since web push on iOS requires the PWA to be
  installed and iOS 16.4 or later. The OS floor costs nothing because it matches
  the stated support floor; the **installation** requirement does not, and it
  reintroduces an install step for the one capability the no-install argument
  cannot cover;
- **a free public generator of a перелік прихованих робіт and an act blank, no
  account required**, with an account needed only to import the result into a
  project and collect evidence against it
  ([competitive-landscape.md](competitive-landscape.md) §7, decision 34).

**Publishing the generator is an owner decision, not a delivery decision.** It
puts Ukrainian regulatory content in front of strangers and their lawyers, where
a wrong clause number is worse than no content at all, and it is adjacent to the
unanswered brand question of whether to refuse back-dated reconstruction
publicly ([competitive-landscape.md](competitive-landscape.md) §8, question 3).
The decision to publish is recorded before the surface is built, not after it
exists and is waiting for a switch.

### Exit gates

- package freeze **refuses** ineligible scope with a per-segment reason list
  built from `blocked_reason` objects, together with the sum included and the
  sum excluded by currency, and a test proves a package is never assembled with
  a silent hole;
- the two owed migrations above have landed, each with its failing-if-forgotten
  test;
- the seven-state projection assigns every in-scope segment exactly once, in the
  corrected order `accepted → returned → evidence_blocked → submitted_pending →
  packaged_not_submitted → internal_review → ready_not_packaged`
  ([value-at-risk.md](../domain/value-at-risk.md)), with no eighth state for
  bypass — `CLOSED_WITHOUT_ACT` is a `blocked_reason.code` inside
  `evidence_blocked`;
- currency, tax basis, precision, and rounding are explicit and reconcile;
- each added adapter/template is versioned and tested against real sanitized
  samples;
- `/demo` cannot access or mutate a customer tenant;
- analytics events have a declared purpose and retention;
- any AI suggestion is reviewable, has provenance, and requires human
  confirmation;
- if the generator ships, it renders no regulatory string without a
  `verification` tag and a source, carries the довідковий disclaimer
  uncollapsed, labels the В/Г mapping as the product's assumption, and cannot
  read or write a customer tenant;
- at least three observed attempts across one or more pilot users record the
  original task, baseline time/error/friction, target change, post-change result,
  and remaining issue.

## v0.3 — Offline mobile

### Outcome

Authorized field users can safely browse assigned work, capture, and synchronize
through extended loss of connectivity.

### The client returns to `apps/mobile`

[ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 8 scopes the PWA
to the pilot, never to the product forever. The two costs it accepts — storage
the OS may reclaim under a policy the page does not control, and no
hardware-backed key to bind ciphertext to — are precisely the properties an
offline outbox cannot tolerate, so the honest expectation is that **v0.3 returns
to `apps/mobile`**, which is why that workspace stays in the tree. Nobody
planning v0.3 may read ADR-007 as establishing that a browser is sufficient for
the product.

Three invariants become v0.3 obligations, having been withdrawn from the v0.1
PWA path: INV-013 (upload failure does not delete the original; local cleanup
requires a persisted `available` receipt with a matching hash), INV-014 (an
ordinary app restart does not lose a pending online capture), and INV-053
(pending originals are envelope-encrypted and inaccessible to another identity;
logout or revocation quarantines rather than deletes). They may not be re-scoped
back onto a browser path by a catalog edit.

### Also owned by v0.3

Assigned by [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md),
each requiring its own decision before it enters the version:

- material certificates as scoped, expiring evidence satisfying many lines;
- automatic un-blocking on acceptance of remedial evidence;
- sequential approver chains, unchanged from ADR-001's deferral of sequential
  enterprise approval routing.

### Exit gates

- offline authorization is time-bounded and revocable;
- only explicitly authorized task scope is stored on device;
- encrypted local storage and device/session lifecycle are defined, with the
  per-file key wrapped by an installation/account/workspace-bound key held in
  the iOS Keychain or Android Keystore;
- multi-device and server conflict rules preserve source facts;
- resumable upload verifies chunk and final content integrity;
- background retries expose durable user-visible states;
- revoked users and expired leases cannot submit;
- recovery from app restart while operating under an offline lease, device clock
  drift, duplicate send, and partial chunk upload is tested;
- the external review shell is never routed into the native client.

## v0.4+ — Project Commercials

### Outcome

Commercial teams consume finalized acceptance facts through a separate
subledger/export layer without changing evidence or acceptance history.

### Candidate sequence

- change-order boundary and approved contract adjustments. **One divergence is
  recorded here and not resolved:** ADR-005 assigns *додаткові угоди as
  first-class baseline amendments* to **v0.2** — a contract-baseline concern —
  while this line has carried change orders at v0.4+ since before that decision.
  [scope-and-boundaries.md](scope-and-boundaries.md) §"Commercial and accounting
  contexts" records the same divergence and requires the two to be reconciled
  under the scope-change rule **before v0.2 planning**. Neither is in v0.1 either
  way, and reconciling them is a decision, not an edit;
- formal accepted-quantity dispute, reversal, and compensation authority;
- acceptance subledger and accounting export;
- receivable/invoice assistance;
- retentions and deductions;
- payment allocation and reconciliation.

Each capability requires its own decision on accounting authority, jurisdiction,
rounding, correction, close/reopen, and integration responsibility.

## v1.0 — Validated operating product

### Outcome

GoProceed operates a validated contract-to-acceptance workflow with documented
limits and repeatable operations.

### Exit gates

- at least two complete contract-to-acceptance cycles on a named project are
  recorded with participating roles, result, exceptions, and no manual database
  correction;
- security controls and tenant isolation have independent evidence;
- restore, retention, deletion, incident, monitoring, and support procedures
  are exercised;
- migrations, rollback, and compatibility are repeatable;
- external review assurance and legal limitations are communicated clearly;
- service objectives and failure ownership are documented;
- product claims match discovery, pilot, and operating evidence.

## Watch register

Items with a recorded product consequence and **no owning version**. They are
reviewed quarterly and enter a version only through the scope-change rule below.

- **ЄДЕССБ integration.** The state responsibility matrix contains no виконавча
  документація obligation for a specialist subcontractor; the only construction
  position is «відомості про виконання будівельних робіт», which is the general
  contractor's duty. Building it now means engineering against an obligation our
  buyer does not have. If the matrix changes, the cost is an adapter over
  already-frozen, self-describing package versions, which is additive because
  package versions are immutable. The standing cost of not building it is that
  the question is asked at every demonstration and must be answerable in one
  paragraph.
- Further candidates come from the rows marked `watch` in
  [competitive-landscape.md](competitive-landscape.md) §7 and each requires its
  own decision before it acquires a version.

## Surface roadmap

- `apps/landing`: separate marketing product and deployment throughout.
- `apps/app`: authenticated product from v0.0 onward, and **the host of the v0.1
  field client**, which is a PWA behind the same BFF boundary as the web product
  ([ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 1). Its whole
  distribution requirement is an HTTPS origin: no store account, no UDID
  registration, no internal-distribution track.
- `apps/mobile`: stays in the tree on Expo SDK 57.0.9 with its scheme registered
  and its token-proof screen intact, and is **not on the v0.1 path** — not in the
  v0.1 milestone outcome, not in v0.1 entry evidence, not in v0.1 closing
  evidence. It is the starting point for v0.3. It is not free while it sits: it
  is a workspace in CI with an SDK that ages off the delivery path.
- online-only browser capture with a **non-durable pending original**, and a
  client that warns rather than silently losing bytes: v0.1. Native online
  capture with OS-sandboxed persistence through an ordinary restart: v0.3.
- capture provenance in v0.1 is a client-computed hash verified at finalization,
  a server receipt time, and a device-claimed time labelled untrusted — and
  nothing more. Camera-only capture, a camera-versus-gallery label,
  tamper-evident provenance, and verified capture-time GPS are **not v0.1
  claims** and re-asserting one requires an ADR, not a UI change.
- push: not in v0.1 on either platform, and not claimed. Web push on iOS
  requires an installed home-screen PWA and iOS 16.4+; v0.2 decides between an
  installed PWA and the native client.
- the protected external review shell keeps its own discipline — fragment-only
  delivery, POST exchange, short session, no account — and is never routed into
  a native client. v0.1 has no native client on its path.
- `/demo` in `apps/app`: durable isolated surface in v0.2.
- public no-account requirement-list and act-blank generator: v0.2 **if the owner
  approves publication**; it is a public unauthenticated surface and belongs
  beside `apps/landing` rather than inside the authenticated product. Until that
  approval is recorded there is no such surface.
- full offline mobile: v0.3.
- initial hosting: separate free Vercel domains are acceptable. A GoProceed
  domain still has to be chosen for the personal external link, and choosing it
  is M5 entry evidence.

## Scope-change rule

Moving a capability between versions requires:

1. evidence for the change;
2. affected ADR and domain-owner update;
3. security, data, and migration impact;
4. revised acceptance gates;
5. explicit approval before implementation.

Three further protections apply to the gate, because a gate is weakened by
backlog grooming far more often than by an argument:

6. **Weakening the gate requires a superseding ADR, not a backlog item and not a
   milestone-scope trim.** Making a `hold` markable not applicable, allowing a
   manual override of a derived readiness state, letting package freeze filter
   instead of refuse, or restoring `evidence_blocked` below the packaging states
   are each a boundary change.
7. **Reversing an owner assumption** recorded in
   [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) under
   "Assumptions the owner may reverse" requires editing that section in the same
   change, so the reversal and its recorded cost stay together.
8. **No regulatory content enters or leaves the product except through**
   [hidden-works-content-rules.md](hidden-works-content-rules.md). Adding a
   Додаток Н item, a Додаток В field, or a clause number through any other route
   is prohibited regardless of which document requests it.

Five protections come from
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md), because the value of a
small v0.1 is destroyed one reasonable-sounding addition at a time:

9. **Adding a capability to v0.1 requires an ADR, not a backlog item.** "It is
   already specified", "it is already in the DDL", "the catalog already has the
   row", and "it is only one more table" are each explicitly not reasons. The
   test is the six steps: name the step the capability is necessary for.
10. **Moving the pilot later requires an ADR.** The pilot's position ahead of the
    commercial half is the substance of ADR-006; moving it back to the end
    restores exactly the ordering that ADR exists to fix.
11. **Unfreezing import requires the file** — one real sanitized кошторис, АВР,
    or interim-works file, recorded in
    [validated-assumptions.md](../discovery/validated-assumptions.md) with the
    named company and the date. Resuming import work without one is a decision
    to build against an assumption and must say so in writing.
12. **Choosing a loyal технагляд for the first pilot requires an ADR that
    supersedes ADR-006 decision 9** and records what the resulting evidence will
    not prove. Three loyal pilots are not a substitute for one adversarial one,
    and the reason must be written down at the time, not reconstructed after the
    results are in.
13. **M0 cannot be reordered behind M6.** Real customer data entering an
    environment that has not closed M0 is a boundary violation regardless of
    which document or schedule requests it.

Three come from [ADR-007](../decisions/ADR-007-pilot-field-client.md), because
each of them is a promise to a foreman or to his client's lawyer:

14. **Re-asserting a withdrawn provenance claim requires an ADR, not a UI
    change.** Camera-only capture for a blocking requirement, a
    camera-versus-gallery label, tamper-evident provenance, and verified
    capture-time GPS are each a boundary change while the field client is a
    browser page, whatever a screen, a badge, a demo, or a landing page would
    find convenient.
15. **Claiming a durable pending original requires an ADR.** INV-013, INV-014
    and INV-053 may not be re-scoped back onto the PWA path by a catalog edit.
16. **The domain and the API stay client-agnostic.** A PWA-specific field on an
    evidence object, an upload intent, or a requirement occurrence would destroy
    the replaceability that makes the client reversible without a migration, and
    is prohibited without an ADR that says so on purpose.
