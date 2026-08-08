# Vision and positioning

**Status:** Approved

**Applies to:** v0.1 and v0.2

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


> **What this document sells, and what v0.1 ships.** This is the positioning
> document — the one a landing page, a demo script and a sales sentence are
> written from — so the boundary is stated here rather than left to be
> discovered. [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) re-cuts v0.1
> to six steps a subcontractor can use unaided and moves the commercial half of
> the loop — packages, internal review, claim segments, partial acceptance, the
> commercial decision, `witness`, `review` and the statutory notice — to **v0.2**.
> [ADR-007](../decisions/ADR-007-pilot-field-client.md) makes the v0.1 field
> client a **PWA** and withdraws four capture claims. Every capability below that
> v0.1 does not ship carries a version marker; a paragraph with no marker is a
> v0.1 claim and must survive being demonstrated.

## Product vision

GoProceed makes performed work presentable for acceptance and payment. It does
that by binding the evidence a unit of work must carry to that work **before the
work starts**, and by refusing to present scope whose evidence was never
obtained or never agreed. The binding and the refused closure are **v0.1**; the
refusal to *present* needs a package version and is **v0.2** — this is the
product's vision, and only its first half is a claim about what v0.1 does.

The product turns a recurring coordination problem into a shared,
evidence-backed process:

```text
what the contract permits
→ what the work must prove, known before it starts
→ what was performed
→ what proves it, and who accepted that proof
→ what closed                                                    ← v0.1 stops here
→ what closed without evidence                                            (v0.2)
→ what is eligible to enter a package version                             (v0.2)
→ what each required reviewer decided                                     (v0.2)
→ what value is accepted, returned, blocked, or still at risk             (v0.2)
```

The loop is unchanged in shape and shorter in reach:
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5 stops v0.1 at
the external evidence decision on a single requirement occurrence and the
closure it releases. Nothing after that line is cancelled and nothing loses its
specification — but none of it may be described, demonstrated or sold as
something v0.1 does.

Two of those steps are new in [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md)
and are the reason the product exists: requirements are known in advance and
bound to the work, and eligibility is a precondition of packaging rather than a
filter applied while packaging. **v0.1 delivers the first and not the second**,
because it has no package versions.

GoProceed is not an accounting system. Its early job is to produce trustworthy
acceptance facts that a commercial or accounting process can consume — Project
Commercials may begin in v0.4+ as a subledger over finalized acceptance facts
(ADR-001), and full accounting remains a separate bounded context.

## What the gate blocks, and what it does not

No software can stop a crew. Any product that claims to is either lying or
describing an administrative delay it did not cause. GoProceed's approved design
blocks exactly two recorded acts
([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) decision 1);
**v0.1 ships the first and not the second**, because v0.1 has no package versions
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5):

1. **the recorded closure of a hidden or covered stage** — v0.1, and
2. **the eligibility of performed quantity to enter a package version** for
   acceptance and payment — **v0.2, arriving with packages**.

Where positioning is stated, this sentence is used verbatim:

> «Ми не блокуємо роботу на майданчику — ми не даємо її пред'явити до оплати,
> поки доказ не отримано і не погоджено.»

Until packages ship in v0.2 that sentence may be used **only alongside an
explicit statement that payment-presentation eligibility is not in v0.1**, and
**no demonstration may show a payment-presentation refusal that does not exist**
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) Consequences).

**The gate never refuses to record a fact.** Recording performed quantity,
capturing evidence, and recording that a stage was in fact covered are always
permitted. What is refused is a *conclusion* — that a stage closed with its
evidence satisfied — and a *presentation* — that scope may be claimed for
payment. A ledger that refuses inconvenient reality is worth nothing as
evidence.

**What the norms do and do not say.** ДБН А.3.1-5:2016 п. 8.4.3.4 reads «В усіх
випадках **забороняється** виконання наступних робіт до підтвердження…».
Quoted verbatim — which is the only form the allow-list permits — it addresses
the performance of subsequent **work**. GoProceed makes no claim about what it
requires of **payment**, states no legal effect beyond the words themselves, and
whatever it obliges is obliged of a person on a site, not of software. No
statutory rule was found that forbids paying without an act on hidden works. The
bridge between evidence and money runs through the
contract and through технагляд, who must participate in hidden-works inspection
(ПКМУ № 903, п. 5 пп. 3) and may stop work until acts are drawn up (п. 6 пп. 5).
Any claim that технагляд also keeps account of accepted and paid volumes is
**not on the allow-list** and must not be asserted until
[hidden-works-content-rules.md](hidden-works-content-rules.md) adds it with a
fetched source and a підпункт.

## Initial customer hypothesis

The v0.1 target is one segment, named precisely enough that a wrong answer is
detectable:

| Dimension | The v0.1 ICP |
|---|---|
| Trade | MEP / electrical installation subcontractor — монтаж електротехнічних установок and внутрішні санітарно-технічні роботи. **Not** general construction |
| Market | Ukraine, work under ДБН А.3.1-5:2016 with acceptance through АВР / КБ-2в |
| Size | 15–100 staff |
| Concurrent sites | 2–10 active objects |
| Economic buyer | owner or commercial director — the person who feels an unsigned act as cash |
| Champion | head of ПТВ (виробничо-технічний відділ) — the person who assembles the evidence and takes the return |
| Daily users | site foremen and installers capturing evidence against assigned work |
| Adversarial counterpart | технагляд замовника, and the general contractor's кошторисник |
| Free read-only seat | the general contractor — a distribution channel, not the paying customer |

The scope restriction to MEP is deliberate and priced: the shipped requirement
library covers exactly Додаток Н positions **Н.14** (5 items) and **Н.15**
(7 items), twelve verified items in total
([dbn-a31-5-2016-dodatok-n.csv](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv)).
General construction would need the Додаток Н positions outside Н.14 and Н.15
sourced to the same verified standard; **how many such positions exist and what
they cover is not on the allow-list and is not asserted here**
([hidden-works-content-rules.md](hidden-works-content-rules.md)). Sourcing them
is a content-verification programme and not a code change
([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md)
assumption **c**).

The most useful first pilot has repeated work packages, identifiable
quantities, at least one external reviewer who actually refuses things, hidden
or covered stages on the critical path, and a real return/correction loop. A
pilot where the customer signs everything proves nothing about a gate.

**This is a product hypothesis.** No interview, named project, or pilot
commitment supports any part of it — see [Evidence and claim
discipline](#evidence-and-claim-discipline) below.

## Category boundary and wedge

The market already has broad products for mobile field capture, checklists,
drawings, document versions, and approval workflows. Examples include
[Autodesk Forma field and approval workflows](https://construction.autodesk.com/resources/autodesk-build/onboarding-to-autodesk-build/),
[PlanRadar document approvals](https://help.planradar.com/hc/en-gb/articles/31373315559837-Approvals),
[Dalux Field quality control](https://www.dalux.com/products/dalux-field/), and
[Fieldwire mobile inspections](https://help.fieldwire.com/hc/en-us/articles/360004919952-Introduction-to-Inspection-Request-Forms).
GoProceed should not begin as another broad field-management suite.

The wedge is narrower than "acceptance", and the market research behind it
covered thirty-plus products
([competitive-landscape.md](competitive-landscape.md); Draft, market evidence
only, not a design authority). Three findings define the boundary:

- **The vocabulary is everywhere.** Hold, witness and review points, ITP plans,
  and "required evidence to close" appear in Oracle Aconex, Dalux, InEight,
  Procore Action Plans, HoldPoint QA, Visibuild, FTQ360, Novade and BuildOps.
- **The enforcement is almost nowhere.** Novade defines hold points without
  blocking on them; FTQ360 lets a derived status be overridden by a checkbox;
  Siteline can skip a compliance requirement entirely; Raken's signature does
  not lock the report; InEight's certificate gate exists only in the legacy
  product.
- **Where a product does block, it blocks a document or a physical permission** —
  never a priced line. Nothing found ties agreed quality evidence for a specific
  priced line to that line's admission into a payment claim.

Element by element, each half is occupied and only the combination is empty:

| Element of the gate | Already done well by | What is still missing |
|---|---|---|
| Requirement known in advance, bound to work | FTQ360, Dalux, Aconex, BuildOps | Binding to a **priced line** with its currency, not to a location, asset, or visit |
| Hard block on a transition | Aconex, Dalux, InEight (legacy), HoldPoint QA | What is blocked is a document or a permission, never a monetary position |
| External party decides | Clearstory, Siteline, HoldPoint QA | The decision is a signature on a finished document, not the condition that lifts a gate |
| A gate on money | Oracle Textura, Payapps, Procore Pay, Turkey's yapı denetim | Its inputs are certificates, waivers, counterparty paperwork, arithmetic, or a state inspector — never "the evidence for this line was agreed" |

### The counter-evidence, stated first

The claim "no product gates money" is **false**, and this document records that
so no one discovers it in front of a general contractor. Oracle Textura
withholds payment automatically on counterparty document status across thirteen
hold types; Payapps blocks both submission and approval of a payment
application on compliance documents; Procore Pay ships a Payment Requirements
matrix whose entries include `Prevents Payment`; Turkey's yapı denetim regime
releases hakediş against a stage act.

**The novelty claimed here is the input of the gate, not the gate.** No product
document may sharpen that into "nobody blocks money", and the positioning must
survive a demonstration against Aconex and Textura.

Two further constraints from the same research:

- **The payer normally owns the gate, and our buyer is the payee.** The
  counter-example that makes this survivable is Siteline, which sells to the
  subcontractor's A/R manager and lives — because the sub is buying *speed of
  signature*, not self-restraint
  ([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md)
  assumption **a**).
- **Part of this market pays to make non-conformance invisible.** A Ukrainian
  vendor sells reconstruction of виконавча документація for any past period. A
  gate is only credible in a product that structurally cannot back-date, which
  is why append-only facts and immutable versions are load-bearing rather than
  decorative.

## User value

### For the site crew

- the requirements for an assignment are materialised when the assignment is
  created and are visible in the field client **before work starts** — not a
  placeholder that appears after the stage is covered;
- each requirement names its evidence kind, its acceptance criterion, and the
  norm it comes from, so "надішли фото" stops being both unarguable and
  unfulfillable;
- the field client keeps capture focused on assigned work. In v0.1 it is a
  **PWA served from `apps/app`** — a link opens the capture screen and there is
  no install step ([ADR-007](../decisions/ADR-007-pilot-field-client.md)
  decision 1). `apps/mobile` stays in the tree and is not on the v0.1 path;
- **capture is online-only and a pending original is not durable.** The client
  never reports success before the receipt and **warns rather than silently
  losing bytes**, and it promises nothing else about a photograph: a
  client-computed hash verified at finalization, a server receipt time, and a
  device-claimed capture time labelled untrusted. Camera-only capture for a
  blocking requirement, a camera-versus-gallery label, tamper-evident provenance
  and verified capture-time GPS are **withdrawn** and may not be claimed in a
  screen, a package, a demo or a sales sentence
  ([ADR-007](../decisions/ADR-007-pilot-field-client.md) decisions 5 and 6);
- a refusal to close a stage names the requirement, the missing evidence, and
  the role that owes the decision — a support surface, not a red badge.

### For the head of ПТВ

- requirement rules are bound at contract-baseline publication and pinned by
  the published contract version, so what was agreed cannot drift underneath a
  finished job. In v0.1 the rule predicate is **(work type, stage)** and the only
  rule source is the shipped library; the location axis and workspace-authored
  rule drafting are v0.2
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4);
- materialisation runs with a dry run that previews names, counts matches per
  rule, and prints an **explicit list of uncovered lines** — silent non-coverage
  means there is no gate. The uncovered list is v0.1; **bulk instantiation across
  a location subtree is v0.2**, with `locations`;
- one contract baseline links performed quantity to evidence and stage closures;
  package lines are **v0.2**;
- closing a hidden stage whose requirements are satisfied produces a **draft
  act** by the form of Додаток В (обов'язковий) ДБН А.3.1-5:2016, assembled only
  from already-recorded facts, with no free-text quantity field anywhere. The act
  version is pinned by the stage closure in v0.1; the package version pins it
  additionally in v0.2;
- **v0.2** — a witness requirement records the invitation and its notice period,
  and **records non-attendance after the period**, turning the inspector's
  silence from the subcontractor's problem into evidence of process. `witness`,
  the notice event and the whole statutory notice apparatus are v0.2, and **no
  document, screen or demonstration may describe a v0.1 notice**;
- **v0.2** — package freeze **refuses** ineligible scope with a per-segment
  reason list instead of assembling a package with a silent hole. `can_close_stage`
  is the half a foreman meets and it ships in v0.1; `is_package_eligible` waits
  for packages;
- **v0.2** — package contents and versions remain reproducible, and missing or
  returned scope is visible before and after submission;
- responsibility is explicit without forcing construction job titles into access
  roles.

### For the owner or commercial director

- the headline numbers are **first-time acceptance rate** and
  **days-to-signature**; blocked value is reported beside them, never as the
  hero number;
- blocked value is an object, not a mood: requirement, missing evidence,
  awaiting approver role, since when, and value by currency — so it can be
  pointed at in a meeting with the general contractor;
- blocked value is **attributed once per assignment**, so the number cannot be
  inflated by counting the same money under three requirements;
- **v0.2** — a closure without evidence is recorded, attributed, priced, and
  printed in the frozen package manifest as a named appendix, so the bypass costs
  money rather than producing an escalation email nobody reads. **There is no
  bypass in v0.1**: its price is package ineligibility, and with no packages that
  price is zero. The v0.1 escape is the ADR-005 exception — `waiver` and
  `accept_risk` by an authorised actor, attributed and visible;
- currencies, missing prices, and over-contract work are not silently blended;
- **v0.2** — accepted, returned, pending, and blocked value is explainable down
  to claim segments. What v0.1 explains is the blocked sum and its cause, over
  the manually entered work lines;
- the system shows where acceptance is blocked rather than inventing a single
  opaque status.

### For the customer or technical supervisor

- a personal protected link opens exactly the granted scope. In v0.1 the only
  grant scope is a **requirement occurrence** and the reviewer sees one
  requirement with its evidence; the package-version scope kind arrives with
  packages in **v0.2**;
- no workspace account and no separately entered code is required — the one
  structural advantage over Aconex, Visibuild, Zutec, Novade and InEight, all of
  which demand an account;
- **v0.2 — two decisions, not one**: an evidence decision (quality and
  compliance) governs whether scope may be presented at all, and a commercial
  decision (quantity and value) governs the value-at-risk buckets. "Accepted on
  quality, disputed on quantity" becomes expressible when `commercial_decision`
  ships. **v0.1 has one decision**, named `evidence_decision` from the first
  migration precisely so that the second is additive and no v0.1 record has to be
  reinterpreted;
- an external evidence decision is made **before any package version exists**,
  because the v0.1 access grant targets a requirement occurrence;
- **v0.2** — quantity and evidence can be accepted or returned independently, and
  partial decisions do not force an all-or-nothing package result. Claim segments
  and per-segment partial acceptance move with packages;
- every submitted decision has a stable receipt and target;
- what v0.1 records is a `LINK_CONFIRMATION` — email link, IP, server time — and
  the UI and the printed page say plainly that it **is not an electronic
  signature**. v0.1 prints only that negative statement, which asserts nothing
  and therefore needs no source; the admissibility argument rests on Law
  № 2155-VIII art. 17(7), which is carried as `UNVERIFIED` and may not be
  printed. Qualified electronic signature is v0.2.

### For the general contractor

- a free read-only seat over the subcontractor's act drafts, and — **from v0.2** —
  over frozen package versions and their manifests;
- this seat is a **distribution channel, not the paying customer**. If that
  inverts, the gate inverts with it — the cost is recorded in
  [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) assumption
  **a**, not discovered later.

## Positioning statement

For a Ukrainian MEP or electrical installation subcontractor of 15–100 people
whose cash depends on acts being signed the first time, GoProceed is a
contract-to-acceptance evidence gate: each unit of work knows its required
evidence before it starts, a hidden or covered stage cannot be recorded as
closed without that evidence, and unevidenced scope cannot enter a package
version for acceptance and payment. Unlike a field-management suite, a document
register, or a spreadsheet, the requirement is bound to the priced line, and its
satisfaction is a precondition of presentation rather than a reminder.

**The third clause of that paragraph is v0.2.** v0.1 delivers the first two —
the requirement known in advance and the refused closure — and has no package
version for anything to be kept out of. Stating the paragraph without saying so
sells a refusal that does not exist.

Stated to a customer, verbatim:

> «Ми не блокуємо роботу на майданчику — ми не даємо її пред'явити до оплати,
> поки доказ не отримано і не погоджено.»

Until packages ship in v0.2 that sentence may be used **only alongside an
explicit statement that payment-presentation eligibility is not in v0.1**, and
**no demonstration may show a payment-presentation refusal that does not exist**
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) Consequences).

## Product principles

1. **Facts before dashboards.** Current status is derived from immutable or
   append-only source facts.
2. **Exact scope before aggregate status.** Quantity decisions address stable
   claim segments, not unidentified portions.
3. **Evidence and money remain connected but distinct.** Returning evidence
   cannot silently change accepted value.
4. **External review must be simpler than onboarding.** A protected email link
   opens a narrow review surface without a workspace account.
5. **Version history is not rewritten.** Contract, package, and decision history
   remains attributable to the exact version reviewed.
6. **No hidden financial assumptions.** Currency, tax basis, price state, and
   rounding are explicit.
7. **AI proposes; people decide.** Any later AI assistance remains reviewable
   and cannot become a contract or acceptance authority.
8. **The gate refuses conclusions and presentations, never facts.** Quantity,
   evidence, and the fact that a stage was covered are always recordable,
   including when they were recorded wrongly.
9. **A bypass is attributed and priced, never hidden and never merely
   escalated.** An absolute lock is routed around outside the system; the only
   price a product can actually charge is that the money waits.
10. **No normative string without its source.** Every regulatory item the
    product displays carries its verification tag and source **in the data**, so
    an unsourced line cannot be added by editing a template
    ([hidden-works-content-rules.md](hidden-works-content-rules.md)).

## What the gate does not change

The rigour already in this package is the asset the gate is built on top of, and
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) leaves all of
it standing:

- the tenancy and party model, including multiple workspace-owned legal entities
  and explicit own and customer parties (ADR-002);
- immutable published contract versions, versioned work items, and full import
  provenance for controlled XLSX and CSV baselines;
- the append-only performed-quantity ledger and its serialized allocation heads;
- evidence custody, server-side hashing, and the service principal that owns the
  storage verdict;
- protected external review by personal email link with no workspace account —
  extended in v0.1 only by a new scope kind (a requirement occurrence), which is
  the **only** grant scope v0.1 has, unchanged in discipline;
- parallel required approvers and observers, and line- and segment-level partial
  acceptance or return — all **v0.2**, with packages and claim segments;
- the v0.1 financial boundary: no accounting entry, no payment obligation, and
  blocked value as exposure rather than a receivable;
- the deferral of accounting, invoices, payments, and change orders, and of
  offline capture to v0.3 (ADR-001, ADR-004).

## Assumptions this positioning rests on

Five judgements were made by the owner on 2026-08-05 without customer
validation. They are recorded, with their reversal costs, under "Assumptions the
owner may reverse" in
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md); reversing one
requires editing that section in the same change.

| # | Assumption | If it reverses |
|---|---|---|
| a | The buyer is the subcontractor; the general contractor gets a free read-only seat | Domain model survives; positioning, pricing, permission defaults, and the whole go-to-market are rewritten |
| b | The headline metric is first-time acceptance rate and days-to-signature, not blocked value | Near-zero inside v0.1; both numbers come from the same projections. The cost is a landing page, a demo script, and credibility if it changes after a pilot |
| c | Scope is MEP / electrical installation, not general construction | The Додаток Н positions outside Н.14 and Н.15 must be sourced to the same verified standard — weeks of content verification, no schema change. How many such positions exist and what they cover is **not on the allow-list and is not asserted here** ([hidden-works-content-rules.md](hidden-works-content-rules.md)) |
| d | КЕП is v0.2; v0.1 ships `LINK_CONFIRMATION` and says plainly it is not an electronic signature | Pulling it forward requires a КНЕДП integration and a qualified signature in the hands of the customer's технагляд, colliding with the no-account link |
| e | ЄДЕССБ integration is not built | The state responsibility matrix carries no виконавча документація obligation for a specialist subcontractor. The standing cost is that the question is asked at every demonstration |

## Evidence and claim discipline

The product is in documented design and pre-pilot development. Outreach volume
is not market validation. The canonical discovery record must separate lead
mapping, evidenced sends, founder-reported sends, replies, interviews, artifact
access, named pilot projects, and commitments.

**As of 2026-08-06 there is zero customer validation.** The discovery ledger
records 21 evidenced sends and **zero** replies, zero artifact accesses, zero
interviews, zero named projects, zero pilot commitments, zero customer documents
of any kind, and zero willingness-to-pay signals
([validated-assumptions.md](../discovery/validated-assumptions.md)). All
**eight** ledger assumptions remain `Unvalidated`, A-8 included: the ledger did
move on 2026-08-05, when the owner's report that several unnamed companies
confirmed the problem and photograph work through Telegram was recorded as
`founder-reported`. Under that document's own rule it upgraded nothing —
unnamed, undated, and with zero customer documents — and it must not be read
here or anywhere else as validation. The market research behind the wedge
does not change that: it is a landscape inference plus the owner's judgement,
and the question of whether evidence gaps are even a top-two cause of delayed
payment in Ukraine is open and can invalidate the product rather than merely its
wording.

**What the re-cut rests on.** The authority for
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) and
[ADR-007](../decisions/ADR-007-pilot-field-client.md) — and therefore for every
version marker in this document — is the **owner's instruction of 2026-08-06**.
Neither is made on the founder-reported signal of 2026-08-05, which
[validated-assumptions.md](../discovery/validated-assumptions.md) forbids from
driving a roadmap change, a capture-UX decision, or a positioning sentence, and
which is cited nowhere here as a reason for anything.

**Approved is not deployed.** The gate is a target decision. The runtime on this
branch is **33 tables plus migrations `0036`–`0040`, which create no table**;
neither the gate, nor the statutory act, nor the requirement library, nor the
notice, nor the PWA exists in any migration or application code. Nothing described
above exists in the runtime: the only occurrence of `requirement_occurrence_id`
in the repository migrations is a placeholder column whose table is explicitly
deferred (`supabase/migrations/0015_execution_evidence_module.sql:251`), and
`work_assignments.requirement_template_version_id` is nullable and pins at most
one template per assignment
(`supabase/migrations/0015_execution_evidence_module.sql:85`). Requirement
occurrences, internal review, packages, claim segments, external decisions,
acceptance, and value at risk have no tables
([package review](../delivery/package-review-2026-08-04.md) §2).

*(Qualified 2026-08-08 — «deployed» and «written» have come apart, and every sentence above
is about the first. All of it is still exactly true of the **applied** migrations, `0001`–`0040`,
which define 33 tables. Migrations `0041`–`0050` are ten files written on an uncommitted branch and
**applied nowhere**; between them they carry `create table` for **seventeen of the twenty-six** v0.1
tables, plus every CHECK, trigger, policy and grant the readiness gate is made of. Having DDL is not
existing, and none of the ten files has ever been executed.)*

Marketing, demo, and sales material may not claim:

- proven commercial impact, regulated identity assurance, comprehensive offline
  operation, statutory accounting, or verified operational compliance, until
  corresponding evidence and release gates exist;
- that any part of the gate is shipped, or that a target design is runtime;
- a green test baseline or a test count;
- **that v0.1 refuses to admit scope to a payment presentation.** v0.1 has no
  package version, so no demonstration, screen, landing page or sales sentence
  may show a payment-presentation refusal, and the positioning sentence may be
  used only alongside an explicit statement that this half is not in v0.1
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) Consequences);
- **that a photograph is distinguishable as camera-taken rather than
  gallery-supplied**, that capture for a blocking requirement is camera-only,
  that provenance is tamper-evident, or that capture-time GPS is verified. All
  four are **withdrawn** for the browser field client, and re-asserting one
  requires an ADR, not a UI change
  ([ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 5 and
  replacement rule 1);
- **that a pending original survives a lost connection, a closed tab, or a
  restart.** Capture is online-only and the pending original is not durable
  (ADR-007 decision 6); the durable-original invariants are the native client's
  and are v0.3;
- that v0.1 sends a push notification of any kind, on either platform;
- that a Ukrainian statutory rule forbids paying without a signed act on hidden
  works. No such rule was found;
- that no product blocks money. Textura, Payapps, Procore Pay, and Turkey's yapı
  denetim do. The defensible claim is about the **input** of the gate;
- that `LINK_CONFIRMATION` is a qualified electronic signature;
- any Додаток Н item, Додаток В field, clause number, or normative string not
  permitted by [hidden-works-content-rules.md](hidden-works-content-rules.md).
  Додаток Н is **довідковий**; the binding list for a site comes from робоча
  документація (п. 8.4.3.3), and every generated list carries that disclaimer
  uncollapsed.

## North-star outcome

The primary v0.1 outcome is six steps a subcontractor can use unaided
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 1); the package,
internal-review and partial-acceptance outcome below is **v0.2** and is recorded
here as the target the pilot is ordered ahead of:

> **v0.1.** A requirement set is bound to a published contract baseline and
> materialised on an assignment before the crew starts; the foreman sees what
> must be photographed before covering and takes it; the closure of a hidden
> stage is **refused** while a `hold` on it is unmet, naming the requirement,
> the missing evidence, the role that owes the decision and the money that
> waits; технічний нагляд accepts or returns on a personal link with no account;
> the satisfied closure produces a draft act by the form of Додаток В assembled
> only from already-recorded facts; and the owner sees the blocked sum with its
> breakdown by cause.

> **v0.2.** A package version is frozen that **refuses** ineligible scope with a
> per-segment reason list; it is reviewed internally, opened through a protected
> link with no account, and decided partially by every required external
> reviewer on evidence and on quantity separately; and every hryvnia is
> explained as accepted, returned, pending, or blocked — with each block naming
> its requirement, its missing evidence, and the role that owes the decision —
> without losing provenance.

The commercial outcome the product is sold on is **first-time acceptance rate
and days-to-signature**. Blocked value is reported beside them and never as the
hero number. Usage counts are supporting signals, not substitutes for either.
