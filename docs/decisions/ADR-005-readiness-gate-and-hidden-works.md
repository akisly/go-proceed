# ADR-005: The readiness gate and hidden works

**Status:** Approved

**Applies to:** v0.1 and v0.2

**Last reviewed:** 2026-08-08

**Related decisions:** [ADR-001](ADR-001-product-boundary.md),
[ADR-002](ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](ADR-004-roadmap-demo-and-documentation.md),
[ADR-006](ADR-006-pilot-shaped-v0.1.md),
[ADR-007](ADR-007-pilot-field-client.md),
[ADR-008](ADR-008-valuation-carves-at-admission.md)

> **Amendment note.** This ADR amends the v0.1 outcome boundary set by ADR-001.
> ADR-001 is **not** superseded: its loop, its financial boundary, and all
> thirteen of its deferrals remain in force except where this document names the
> exact clause it extends. ADR-002 and ADR-003 are unchanged; this ADR adds
> obligations that sit in front of the machinery they define.
>
> ### Amended twice on 2026-08-06, after this ADR was approved
>
> Every decision below **stands as approved design**; nothing in it is cancelled
> and no word of it is rewritten. What changed is **which of it v0.1 ships**, so
> `Applies to` now reads *v0.1 and v0.2* and each "v0.1" written below is the
> pre-re-cut boundary. Read them against these, and where this document and one
> of them disagree about a version, the later decision wins on the version and
> this one wins on the design:
>
> - **[ADR-006](ADR-006-pilot-shaped-v0.1.md) decision 5 moves five of the ten
>   decisions' contents into v0.2** — internal review's role in `satisfied(o)`,
>   `is_package_eligible` with freeze-refuses-ineligible-scope, the `witness` and
>   `review` intervention types, `commercial_decision`, and decision 8's corrected
>   precedence. **v0.1 blocks the first of decision 1's two recorded acts and not
>   the second**: there are no package versions in v0.1, so payment-presentation
>   eligibility arrives with packages. The positioning sentence decision 1 fixes
>   verbatim may be used **only alongside an explicit statement that
>   payment-presentation eligibility is not in v0.1**, and no demonstration may
>   show a payment-presentation refusal that does not exist (ADR-006
>   §"Consequences").
> - **Decision 3:** `intervention_type` is **`hold` only** in v0.1 (ADR-006
>   decision 4.3). The witness **notice event** of §"Witness scope in v0.1" moves
>   to v0.2 with `witness` — a narrowing ADR-006 records explicitly, because this
>   document shipped the event in v0.1 and deferred only the apparatus.
> - **Decision 4:** a v0.1 `hold` is **`blocks_stage_closure`**, not `blocks_both`
>   (ADR-006 decision 4.4), with a v0.2 widening migration owed. Consequently
>   `blocking_scope = none` — the advisory tier — is **unreachable in v0.1**, and
>   `review`'s pre-start warning moves to v0.2 with `review`. The pre-start
>   display survives through decision 2, which is client-agnostic.
> - **Decision 2:** the predicate narrows to **(work type, stage)**; `locations`
>   and location-subtree bulk instantiation are v0.2 (ADR-006 decision 4.2). The
>   dry run and its explicit uncovered-line list survive.
> - **Decision 5:** the bypass is **not shipped in v0.1** (ADR-006 decision 4).
>   The v0.1 escape is this document's exception — `waiver` and `accept_risk` by
>   an authorised actor, with `not_applicable` still rejected on a `hold`.
> - **Decision 10:** in v0.1 an act version is pinned by **the stage closure**,
>   not by a package version (ADR-006 decision 4.5).
> - **§"Untouched" names «the separate online-only Expo/React Native field
>   client».** [ADR-007](ADR-007-pilot-field-client.md) decisions 1–2 replace that
>   one item for v0.1: the field client is a **PWA** served from `apps/app`, and
>   `apps/mobile` is not on the v0.1 path. ADR-007 decision 5 additionally
>   **withdraws four claims from v0.1** — camera-only capture for a blocking
>   requirement, camera-versus-gallery distinguishability, tamper-evident
>   provenance, and verified capture-time GPS. This ADR asserts none of them and
>   none may be re-asserted anywhere without an ADR.
> - **§"Included in v0.1" is the approved-design list, not the v0.1 build list.**
>   The v0.1 build list is ADR-006 decision 4.
>
> ### Amended a third time on 2026-08-08
>
> Two settlements, neither of which cancels a decision below:
>
> - **Decision 2's predicate has a left-hand side at last.** The predicate
>   narrows to (work type, stage) in v0.1, and until 2026-08-08 nothing carried
>   the work type on the work line — so matching returned false for every line,
>   `assignments.create` materialised nothing, and **the gate this ADR exists to
>   specify had never once fired outside a fixture**. The owner settled that the
>   **carrier** is a column needing no ADR (migration `0050`,
>   `public.work_items.work_type_key`, INV-090); the **owning entity** stays
>   deferred. A hand-typed baseline now materialises obligations; an imported one
>   never will, because the frozen importer writes no work type and a published
>   version is immutable.
> - **Decision 9's money now has a settled admission point.**
>   [ADR-008](ADR-008-valuation-carves-at-admission.md) (Approved 2026-08-07)
>   puts the valuation carve inside the stage closure — this ADR's own gate — and
>   not at recording. Nothing here is rewritten; what changes is that «performed,
>   priced and not admitted» is now a nameable state the v0.1 money read reports
>   beside blocked value.
> - **Assumption b is untouched and stays open.** First-time acceptance rate and
>   days-to-signature are still the measures the gate is answerable to, and both
>   are still defined over claim segments, package versions, submissions and
>   `commercial_decision` — all v0.2. **Neither is computable in v0.1, neither
>   pre-gate baseline can be taken from the product, and no slice may invent a
>   definition.** This is the single reason M6 cannot close, and it is recorded
>   as such rather than worked around.
>
> **Approved is not deployed — and «written» is not deployed either.**
> *(Corrected 2026-08-08.)* This paragraph read: «None of this exists in the
> runtime: 33 tables plus migrations `0036`–`0040`, which create no table. No
> table of the gate, the act, the requirement library or the notice exists in any
> migration or application.» The first sentence still holds exactly — applied
> history is `0001`–`0040` and it defines **33 tables**, of which **9** are among
> ADR-006 decision 4's twenty-six. The second no longer does: migrations
> `0041`–`0050` were written on an uncommitted branch and between them create the
> gate's tables, the act's, the requirement library's and the external plane's —
> **seventeen of the twenty-six** — plus every trigger, policy and grant. **None
> of those ten files has been applied anywhere.** Having DDL is not existing, and
> the superseded sentence is kept above rather than deleted because the
> distinction it lost is the one that matters. No baseline state is claimed here,
> and nothing in this package may be called green, verified or confirmed working.

## Context

### The mechanism was specified, then deleted without a record

The evidence gate is not a new idea in this repository. It was specified in the
AktFlow-era technical layer, in seven artifacts, at a level of detail the
canonical package has never reached:

| # | What was specified | Where |
|---|---|---|
| 1 | Requirements bound to the **estimate line**, not to a person or a visit — `work_item_requirements` | `technical/schema.sql:452` |
| 2 | Concealment-aware `timing`, a five-value CHECK including `before_concealment` | `technical/schema.sql:480` |
| 3 | The hold-point flag on a requirement — `hold_point_required` | `technical/schema.sql:486` |
| 4 | The decision object — `hold_point_decisions`, outcomes pass / pass_with_notes / failed, with separation of duties | `technical/schema.sql:988` |
| 5 | The closure fact — `concealment_events`, append-only, double-covering unrepresentable | `technical/schema.sql:1005` |
| 6 | The refusal and the authority to lift it — `HOLD_POINT_BLOCKED` (409) at `technical/error-catalog.csv:95`, capability `hold_point.decide` at `technical/permissions.csv:67` | as cited |
| 7 | The guarded state machine and its screen — occurrence transitions with closure guarded by `HOLD_POINT_BLOCKED` at `technical/state-transitions.csv:235-241`, screen `S40 — Hold point` at [`docs/legacy/04-screen-specification.md:373`](../legacy/04-screen-specification.md) | as cited |

A deterministic readiness algorithm existed alongside them —
lowest-state-wins across occurrences, with blocked value attributed once per
assignment so several missing requirements on one work never inflate the sum
([`docs/legacy/38-business-logic-closure.md`](../legacy/38-business-logic-closure.md) §8).

None of this survived canonicalisation, and **no ADR records its removal**. The
four documents carrying the thesis were dispositioned `archive`, which
`docs/legacy/README.md` defines as reviewed and not worth keeping
([package review §3](../delivery/package-review-2026-08-04.md)).

### The canonical package contained no trace of it (as of 2026-08-05)

As of 2026-08-05, before this ADR landed, a case-insensitive search for
`conceal|прихован|hold point|witness|ITP` returned **zero** across the fourteen
canonical directories enumerated in the
[package review §3](../delivery/package-review-2026-08-04.md) — the canonical doc
directories, the `technical/` v0.1 catalog subdirectories, the migrations,
`apps/app`, and `packages/`. That run was against 40 migrations and matched the
earlier one.

**This is a dated finding, not a current property of the tree.** The rebuild
this ADR authorises is what changed it: the same search now matches across
`docs/product/`, `docs/domain/`, `docs/architecture/`, `docs/decisions/`,
`technical/database/`, `technical/states/`, `technical/permissions/` and
`technical/requirements/`. The zero is preserved as the record of what had been
deleted from the package, and anyone re-running the search to check this section
should expect it to fail.

What the runtime has instead:

- `work_assignments.requirement_template_version_id` — **nullable**, at most one
  template pinned per assignment
  (`supabase/migrations/0015_execution_evidence_module.sql:85`). A work item
  carries no requirement column at all;
- a requirement template whose `severity` CHECK (`blocking`/`advisory`) and
  `multiplicity` are frozen into the published template hash and read by no
  application code, and whose `timing` has degraded from the five-value CHECK
  above to `jsonb not null default '{}'` with no constraint
  (`supabase/migrations/0015_execution_evidence_module.sql:45-46`);
- a placeholder column `requirement_occurrence_id uuid` on the evidence link,
  with its table explicitly deferred
  (`supabase/migrations/0015_execution_evidence_module.sql:251`).

There is no way to instantiate a requirement, therefore no evidence obligation
can be recorded, therefore readiness has nothing to be derived from. Readiness is
classified `Projection | Recomputed` and gates no command
([domain-model.md](../domain/domain-model.md) fact/snapshot/projection matrix).

### What the market analysis established

The market research in
[competitive-landscape.md](../product/competitive-landscape.md) (Draft; market
evidence only, not a design authority) covered thirty-plus products. Its finding,
in the form that survives attack:

- **The vocabulary is everywhere.** Hold / witness / review points, ITP plans and
  "required evidence to close" appear in Oracle Aconex, Dalux, InEight, Procore
  Action Plans, HoldPoint QA, Visibuild, FTQ360, Novade and BuildOps.
- **The enforcement is almost nowhere.** Novade defines hold points without
  blocking on them; FTQ360 lets a derived status be overridden by a checkbox;
  Siteline can skip a compliance requirement entirely; Raken's signature does not
  lock the report; InEight's certificate gate exists only in the legacy product.
- **Where a product does block, it blocks a document or a physical permission** —
  never a priced line. Nothing found ties agreed quality evidence for a specific
  priced line to that line's admission into a payment claim.

### The counter-evidence, stated first

The claim "no product gates money" is **false**, and this ADR records that
plainly so no one has to discover it in front of a general contractor:

- **Oracle Textura** withholds payment automatically on counterparty document
  status, across thirteen hold types;
- **Payapps** blocks both submission and approval of a payment application on
  compliance documents, under Security of Payment legislation;
- **Procore Pay** ships a Payment Requirements matrix whose entries are
  `Not Required` / `Allows` / `Prevents Payment`;
- **Turkey's yapı denetim** regime releases hakediş against a stage act — a
  statutory evidence-to-money gate.

The inputs of those gates are insurance certificates, lien waivers, counterparty
paperwork, arithmetic overrun, and a state inspector. None of the twelve Procore
requirements and none of the thirteen Textura hold types references an
inspection. **The novelty claimed here is the input of the gate, not the gate.**

Two further points from the same research must not be forgotten by anything
written against this ADR: the payer normally owns the gate and our buyer is the
payee (see assumption **a**); and part of this market pays to make
non-conformance invisible — a Ukrainian vendor sells reconstruction of executive
documentation for any past period. A gate is only credible in a product that
structurally cannot back-date.

### What this ADR is

This ADR is the missing record. It restores a deleted mechanism in canonical
vocabulary, decides the questions the deleted version left open, and states the
assumptions that only the owner can reverse. It is a target decision: **nothing
in it is deployed.** Requirement occurrences, internal review, packages, claim
segments, external decisions, acceptance and value at risk have no tables today.

*(Qualified 2026-08-08 — «deployed» and «written» have come apart, and every sentence above
is about the first. All of it is still exactly true of the **applied** migrations, `0001`–`0040`,
which define 33 tables. Migrations `0041`–`0050` are ten files written on an uncommitted branch and
**applied nowhere**; between them they carry `create table` for **seventeen of the twenty-six** v0.1
tables, plus every CHECK, trigger, policy and grant the readiness gate is made of. Having DDL is not
existing, and none of the ten files has ever been executed.)* See the third
amendment note at the head of this document.

## Decision

### 1. The gate is two-sided, and it does not block physical work

No software can stop a crew. Any product that claims to is either lying or
describing an administrative delay it did not cause. GoProceed therefore blocks
exactly two recorded acts:

1. **the recorded closure of a hidden or covered stage**, and
2. **the eligibility of performed quantity to enter a package version** for
   acceptance and payment.

Where positioning is stated, this sentence is used verbatim:

> «Ми не блокуємо роботу на майданчику — ми не даємо її пред'явити до оплати,
> поки доказ не отримано і не погоджено.»

**Sub-rule — the gate never refuses to record a fact.** Recording performed
quantity, capturing evidence, and recording that a stage was in fact covered are
always permitted. The gate refuses a *conclusion* (that a stage closed with its
evidence satisfied) and refuses a *presentation* (that scope may be claimed for
payment). The append-only progress ledger must always be able to record what
actually happened, including what happened wrongly; a ledger that refuses
inconvenient reality is worth nothing as evidence.

**Reasoning.** ДБН А.3.1-5:2016 п. 8.4.3.4 reads «В усіх випадках
**забороняється** виконання наступних робіт до підтвердження…». Quoted
verbatim — which is the only form allow-list item 2 permits — it addresses the
performance of subsequent **work**. This ADR draws no conclusion about what it
requires of **payment**, and states no legal effect the allow-list does not
carry. Whatever it obliges is obliged of a person on a site, not of software.
No statutory rule was found that forbids paying without an act on hidden works;
the bridge between
evidence and money runs through the contract and through технагляд, who must
participate in hidden-works inspection (ПКМУ № 903, п. 5 пп. 3) and may stop work
until acts are drawn up (п. 6 пп. 5). Any claim that технагляд also keeps account
of accepted and paid volumes is **not on the allow-list** and must not be asserted
until [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
adds it with a fetched source and a підпункт.

### 2. Requirements are known in advance, bound to the work, not to the person

A **requirement rule** is a predicate over `(work type, location node, stage)`
that yields an **ordered set** of requirements. Each requirement in the set
carries `evidence_kind` (photo, measurement with value/unit/tolerance, document,
checkbox), `acceptance_criterion`, `norm_ref`, `performer_role`, `approver_role`,
`intervention_type`, `blocking_scope`, `timing`, and `multiplicity` — nine
fields. `timing` and `multiplicity` are named here rather than left to the
domain layer because `satisfied(o)` below quantifies over both: it requires the
occurrence to meet its multiplicity, and `timing = before_concealment` is what
attaches a requirement to a concealed stage at all. In the DDL, multiplicity is
the pair `min_evidence_count` / `max_evidence_count`; `multiplicity` is the one
domain name for that pair and the only name used in a predicate.

- Rules are **bound at contract-baseline publication**. The published contract
  version pins the exact rule-version set, in the same way it pins party,
  currency, tax, terms, and approval-policy snapshots (ADR-002).
- Rule versions are **publish/retire only, never update**. An occurrence stores
  `rule_version_id`, not a live foreign key.
- Concrete **requirement occurrences are materialised when an assignment is
  created**, with no evidence yet linked, and are visible in the field client **before
  work starts**. A placeholder that appears only after the work is covered is not
  advance notice.
- Bulk instantiation across a location subtree is a single command with a dry
  run that previews generated names, counts matches per rule, and prints an
  **explicit list of uncovered lines**. Silent non-coverage means there is no
  gate; the uncovered list is part of the command's output, not a report someone
  may run.

This **replaces** the current model — one optional nullable template pinned per
assignment (`supabase/migrations/0015_execution_evidence_module.sql:85`).
`work_assignments.requirement_template_version_id` is retired; a template pinned
to an assignment cannot express a set, cannot vary by stage or location, and is
absent by default, which is the same as having no gate.

### 3. Three intervention types, not a boolean

`intervention_type ∈ {hold, witness, review}`. A boolean is defeated in a week:
if everything blocks, users learn to route around every block.

| Type | Meaning | Release condition |
|---|---|---|
| `hold` | The strong point. Closure and package eligibility are both blocked. | An accepting decision exists on the occurrence, from the role named by `approver_role`, with no current return. |
| `witness` | The invited-inspection point. | A recorded notification event exists **and** its notice period has elapsed. Attendance with an accepting decision releases it; **non-attendance after the period is itself recorded** and becomes evidence of process in favour of the performer. |
| `review` | A document obligation that must be satisfied **before the work starts**. | The required document is linked, available, and accepted by the current internal review head. |

**A `hold` requirement may never be marked "not applicable".** Waiver and
accept-risk exceptions remain available to an authorised actor and remain
visible, because an exception that hides itself is worse than no exception; but
`not_applicable` — the exception that asserts the obligation never existed — is
rejected for `hold` by the exception command itself, not by convention.

**Witness scope in v0.1.** The notice **event** is v0.1: recipients, server
`sent_at`, a configured `required_notice` duration, and a server-computed
`earliest_proceed_at`. The statutory notice apparatus — the Ukrainian
working-day calendar with state holidays, delivery proof, the push when the
notice window opens, and the printed notice artifact — is v0.2 and is named in
Explicitly deferred. Until that ships, the configured duration is a workspace
setting and **must not be labelled as the five-working-day rule** of the примітка
to Додаток В/Г, because calendar days and робочі дні produce different dates.

### 4. Blocking scope is explicit

`blocking_scope ∈ {none, blocks_stage_closure, blocks_package_inclusion,
blocks_both}` is stored on the rule and materialised onto the occurrence. It is
never inferred from a severity word at read time.

| Type | Permitted `blocking_scope` | Default |
|---|---|---|
| `hold` | `blocks_both` only — the publication command rejects anything else | `blocks_both` |
| `witness` | `blocks_stage_closure` or `blocks_both` | `blocks_stage_closure` |
| `review` | `blocks_package_inclusion` or `blocks_both` | `blocks_package_inclusion` |
| any | `none` — advisory: recorded, surfaced, never blocking | — |

`none` is the successor of today's `severity = 'advisory'`
(`supabase/migrations/0015_execution_evidence_module.sql:46`). `severity` as a
free axis is retired: a requirement's consequence is its blocking scope.

A `review` requirement never bars the recording of performed quantity (decision 1
sub-rule). It bars presentation, and it raises a pre-start warning in the field
client.

### 5. Bypass exists, is attributed, and costs money rather than escalation

An absolute lock is routed around outside the system, and then the product is the
enemy. A bypass whose only consequence is escalation to management — the
Visibuild pattern — teaches that the gate is theatre.

**Closure without evidence is a first-class append-only fact.** The command
records:

- the actor and the **claimed authority** under which they acted;
- a **mandatory** reason code plus free text. Its vocabulary is **not
  enumerated anywhere in this package** — unlike the block-reason vocabulary,
  which is closed and listed in five places — so this ADR does not call it
  closed or structured. `schema-v0.1.sql` stores it as `reason_code text not
  null` and says the vocabulary is not invented there. It must be enumerated,
  in `technical/states/state-catalog.csv` as a `stored_vocabulary` machine and
  in [glossary.md](../domain/glossary.md), before `stage_closures.bypass`
  ships; until then no document may describe it as a closed set;
- the **exact set of unmet requirement occurrences at that moment**, frozen into
  the fact, not recomputed later;
- the expected remedy.

Consequences, all of them mechanical:

- the stage is recorded as closed — reality is recorded (decision 1 sub-rule);
- the requirement occurrences are **not** satisfied and are not closed;
- every claim segment covering that scope becomes **ineligible for any package
  version**, with `blocked_reason.code = CLOSED_WITHOUT_ACT`;
- ineligibility is cleared only by an **internal reviewer** appending a clearance
  fact that names substitute evidence. The clearance does not delete the bypass;
- the bypass appears in the frozen package manifest as a **named appendix**, with
  its value by currency.

The price of a bypass is that the money waits. That is a price the buyer can
weigh, and it is the only price a product can actually charge.

### 6. The block reason is an object, not a UI state

A gate is worth what you can point at in a meeting with the general contractor.
`blocked_reason` is a structured object:

```text
blocked_reason {
  requirement_occurrence_id
  rule_version_id            -- what was agreed, and in which version
  missing_evidence[]         -- by evidence_kind and acceptance_criterion
  awaiting_approver_role     -- who owes the decision
  since                      -- server time the block began
  blocked_value_by_currency  -- net, tax, gross minor units per currency
  code                       -- fixed vocabulary, see below
}
```

The code vocabulary is closed and versioned. It includes at minimum:
`ACT_NOT_SIGNED`, `TEST_REPORT_MISSING`, `MATERIAL_CERTIFICATE_MISSING`,
`SUPERVISION_SIGNATURE_MISSING`, `CUSTOMER_MOTIVATED_REFUSAL`,
`NOTICE_PERIOD_NOT_ELAPSED`, `CLOSED_WITHOUT_ACT`.

Two rules on the value:

- values follow the ADR-003 currency, tax, precision and rounding rules; there is
  no cross-currency total;
- **blocked value is attributed once per assignment.** Several unmet
  requirements on one work reference the same assignment-scoped value and are
  deduplicated by assignment when summed. This preserves the legacy rule at
  [`38-business-logic-closure.md`](../legacy/38-business-logic-closure.md) §8 and
  prevents the headline number from being inflated by counting the same money
  under three requirements.

Every frozen package version renders these objects as an appendix,
**«виключені позиції та підстави»**, next to the sum included and the sum
excluded by currency.

### 7. Readiness gets a written predicate and becomes a precondition

This is the single most important change in this ADR. Readiness remains a
projection — it is never an editable status column, and ADR-003's immutable-facts
rule is untouched. What changes is that **package freeze refuses ineligible
scope** instead of relying on the compiler to filter it out silently.

Two predicates are written down and testable.

```text
satisfied(o) ⇔
     o.intervention_type = 'hold'
       ∧ ∃ current accepting evidence decision on o by o.approver_role
       ∧ no current return on o
  ∨  o.intervention_type = 'witness'
       ∧ ∃ notice event n for o ∧ now ≥ n.earliest_proceed_at
       ∧ (attendance recorded with an accepting decision
          ∨ non-attendance recorded after the period)
  ∨  o.intervention_type = 'review'
       ∧ linked evidence is available and meets multiplicity
       ∧ the current internal review head for its target set accepts
  ∨  ∃ current exception head on o with kind ∈ {waiver, accept_risk}
  ∨  ∃ current exception head on o with kind = not_applicable
       ∧ o.intervention_type ≠ 'hold'

can_close_stage(s) ⇔
     ∀ o applicable to s with blocking_scope ∈ {blocks_stage_closure,
                                                blocks_both} : satisfied(o)

is_package_eligible(segment) ⇔
     ∀ o applicable to the segment's scope
       with blocking_scope ∈ {blocks_package_inclusion,
                              blocks_both} : satisfied(o)
  ∧  no uncleared closure-without-evidence fact covers the segment's scope
  ∧  the current internal review head for the applicable target set accepts
  ∧  every pinned evidence object is in state `available`
```

Consequences of making it a precondition:

- **freeze refuses.** The finalisation command returns a per-segment reason list
  built from `blocked_reason` objects, together with the sum included and the sum
  excluded by currency. It never assembles a package with a silent hole;
- readiness recomputation triggers are unchanged in kind: a new or corrected
  quantity entry, a change in an occurrence's satisfaction, a new rule-version
  binding, an exception appended or revoked, a package claim or withdrawal, an
  external decision;
- a stale-source conflict at freeze remains a stale-source conflict
  ([packages-and-acceptance.md](../domain/packages-and-acceptance.md)); an
  ineligible segment is a **different, named refusal** and must not be reported
  as a concurrency error.

### 8. Value-at-risk precedence is corrected

Today `packaged_not_submitted` is rank 4 and `evidence_blocked` is rank 6
([value-at-risk.md](../domain/value-at-risk.md) state precedence). A precedence
rule between two states asserts the combination is reachable — so the current
document specifies the reporting semantics for exactly the state that decision 7
makes impossible to create.

The corrected precedence, first match wins:

```text
accepted
→ returned
→ evidence_blocked
→ submitted_pending
→ packaged_not_submitted
→ internal_review
→ ready_not_packaged
```

- `accepted` stays first: ADR-003's rule that evidence return after quantity
  acceptance creates a compliance exception without moving money is unchanged;
- `returned` stays second: an external return is a decided fact and outranks an
  internal one;
- `evidence_blocked` moves **above** the packaging states. The combination is now
  reachable in only two ways — scope packaged before this ADR was implemented,
  and evidence invalidated after a freeze — and in both, "blocked" is the
  actionable truth. Reporting such money as merely awaiting a signature is a lie
  told to the person who has to fix it.

**No eighth state is added for bypass.** `CLOSED_WITHOUT_ACT` is a
`blocked_reason.code` inside `evidence_blocked`. The alternative — a
`blocked_by_bypass` state — was rejected because the state set must stay disjoint
and exhaustive, and because the reason object (decision 6) already carries the
discrimination without duplicating it in two places that can disagree.

The `RISK_STATES` membership and the net/tax/gross reporting contract in
[value-at-risk.md](../domain/value-at-risk.md) are otherwise unchanged.

### 9. Two decisions on a segment, not one

A segment carries two decision kinds with different authorities and different
consequences:

| Decision | Authority | Governs |
|---|---|---|
| `evidence_decision` | технагляд / ГІП / internal verifier — quality and compliance | **Package eligibility.** Whether the scope may be presented at all |
| `commercial_decision` | замовник / кошторисник — quantity and value | **Value-at-risk buckets.** Accepted, returned, pending |

"Accepted on quality, disputed on quantity" is the most common real outcome, and
a single-signature model cannot express it. This renames and sharpens ADR-003
rather than contradicting it: ADR-003's *external quantity decisions* are
`commercial_decision`; its *external evidence decisions* are `evidence_decision`.
ADR-003's rule that **evidence return never changes money automatically** holds
unchanged for scope already commercially decided. What is new is that an
`evidence_decision` is a **precondition of admission**, which is a different
moment in time from a monetary effect.

**Consequence — the protected link gains a second grant scope.** A `hold`
requirement whose `approver_role` is external must be decidable *before any
package version exists*, or the model is circular: eligibility would wait for a
decision that only exists after freeze. An external access grant may therefore
target a **requirement occurrence** as well as a package version. The grant
discipline of ADR-003 is unchanged in every respect — hashed token, fragment-only
delivery, POST exchange for a short-lived session, no account, no code, GET never
consumes. Only the scope kind is new, and grants still cannot cross workspace,
project, or contract boundaries.

### 10. The statutory act is a by-product of closure

Closing a concealed stage whose requirements are satisfied produces a **draft
act** strictly by the form of **Додаток В (обов'язковий) ДБН А.3.1-5:2016**,
titled «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ». The act for responsible structures
uses **Додаток Г** and is a separate template.

Rules, all of them binding:

- the act is **assembled only from already-recorded facts** — progress entries
  already on the line, evidence objects already available, occurrence decisions
  already made, party and certificate data already on the participant records.
  **There is no free-text quantity field**, anywhere, in any render. A quantity a
  human types into an act is literature;
- the composer offers only `quantity_entries` already recorded against the line,
  with a share selector;
- act versions are immutable and are pinned by the package version that carries
  them, under the same freeze discipline as every other artifact;
- three typed signatory slots per п. 8.4.3.5 — будівельна організація, технічний
  нагляд замовника, авторський нагляд. The технагляд's кваліфікаційний сертифікат
  (ПКМУ № 903, п. 3) is held on the participant record. **Whether Додаток В has a
  field for its серія and номер is not established**, so nothing is printed into
  the form for it until
  [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
  allow-lists that field against the В.1/В.2 field list; prohibition E bans the
  adjacent «ким видана».

**Content authority.** [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
governs every regulatory string, without exception. This ADR **names no field of
Додаток В and adds none**. In particular, and repeating the prohibitions because
inventing a clause number, a form field, or a Додаток Н item is the worst failure
available here:

- never add a field to Додаток В that is not in it («шифр», «аркуш», «ким
  видана», «паспорт», «Акт №», «м.п.», a fourth signatory);
- never add an item to Н.15, which has exactly seven lines, or to Н.14, which has
  exactly five. The verified text is
  [`technical/requirements/dbn-a31-5-2016-dodatok-n.csv`](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv),
  twelve items, all `VERIFIED_PRIMARY` — and every one of those tags rests on the
  **single unreproduced ДБН fetch** recorded in
  [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
  §"Verification status of the allow-list itself" and its Open items. Anything
  else ships in a separate block
  labelled «Додатково рекомендуємо (не з Додатка Н)» with no normative citation;
- never call Додаток Н an «орієнтовний перелік» or present it as mandatory. It is
  **довідковий**; the binding list for a site comes from робоча документація
  (п. 8.4.3.3), and the generated list carries that disclaimer uncollapsed;
- the mapping of a Н.14/Н.15 position to form В or form Г is **the product's
  assumption** and is labelled as such in the UI and in the render; no source
  establishes it;
- every normative string carries its `verification` tag and its source **in the
  data**. A string with no source must be unrenderable, so that a future
  contributor cannot add an unsourced line to Н.15 by editing a template.

## Relationship to ADR-001

ADR-001 remains in force. This ADR extends six of its clauses and touches nothing
else.

### Extended

| ADR-001 clause | Extension |
|---|---|
| The v0.1 loop (ADR-001 Decision) | A stage-closure step is inserted between performed quantity and packaging, and the statutory act becomes a by-product of it |
| "assignments and append-only performed-quantity entries" | Requirement occurrences are materialised at assignment creation and are visible before work starts (decision 2) |
| "requirements, exceptions, internal review, and readiness" | Requirements become rule-bound ordered sets with three intervention types and explicit blocking scope; readiness gains a written predicate (decisions 2, 3, 4, 7) |
| "immutable package versions and artifacts" | Freeze acquires an eligibility precondition and refuses ineligible scope; the manifest gains the excluded-scope and bypass appendices (decisions 5, 6, 7) |
| "separate quantity and evidence decisions" | The two become `commercial_decision` and `evidence_decision` with distinct authorities and consequences; the evidence decision becomes a precondition of admission (decision 9) |
| "accepted, returned, pending, and **blocked** quantities and values" | "Blocked" gains a structured reason object and is re-ranked above the packaging states (decisions 6, 8) |

### Added to the v0.1 boundary

- the statutory act (Додаток В / Додаток Г) as an immutable by-product of stage
  closure;
- the shipped requirement library for Додаток Н positions Н.14 and Н.15;
- the closure-without-evidence fact and its clearance;
- the requirement-occurrence grant scope on the protected external link.

### Untouched

Multiple workspace-owned legal entities; projects and contracts with explicit own
and customer parties; controlled XLSX and CSV import; versioned work items and
source provenance; the separate online-only Expo/React Native field client; the
protected external review by personal email link without a workspace account
(extended in scope kind only, unchanged in discipline); parallel required
approvers and observers; line- and claim-segment-level partial acceptance or
return; value at risk grouped by currency with explicit tax and rounding rules;
and the whole **financial boundary** — v0.1 still creates no accounting entry and
no payment obligation, and blocked value is exposure, never a receivable.

**All thirteen ADR-001 deferrals remain deferred**, including variations and
change orders, sequential enterprise approval routing, and qualified electronic
signature. This ADR assigns owning versions to three of them (below); it removes
none.

## New domain objects

The relational shape belongs to the domain and technical layers. This table fixes
identity and purpose only.

| Object | Purpose |
|---|---|
| `requirement_rules` | The predicate over (work type, location node, stage) that yields an ordered requirement set |
| `requirement_rule_versions` | Immutable published rule content; publish/retire only, never update |
| `contract_version_rule_bindings` | Pins the exact rule-version set to a published contract version at baseline publication |
| `requirement_library_items` | Shipped regulatory content — Додаток Н Н.14/Н.15 — each row carrying its `verification` tag and source, unrenderable without them |
| `work_stages` | The closable unit: one assignment, one location node, one stage from the published vocabulary, flagged concealed or not |
| `stage_closures` | Append-only fact that a stage was recorded closed, with actor, server time, and the closure predicate result |
| `unevidenced_closures` | Append-only bypass fact: actor, claimed authority, mandatory reason, expected remedy, and the frozen set of unmet occurrences |
| `unevidenced_closure_clearances` | Append-only internal-reviewer fact restoring eligibility against named substitute evidence |
| `requirement_notices` | The witness notification event: recipients, server `sent_at`, `required_notice`, server-computed `earliest_proceed_at` |
| `notice_attendance_outcomes` | Attendance or recorded non-attendance after the period elapsed — evidence of process |
| `requirement_evidence_decisions` | Accepting or returning decision on one occurrence by its `approver_role`, internal or external |
| `blocked_reasons` | The projection object of decision 6, deduplicated per assignment for value |
| `statutory_acts` / `statutory_act_versions` | The immutable act by the form of Додаток В or Г, assembled only from recorded facts |

Extended existing objects: `requirement_occurrences` gains `rule_version_id`,
`intervention_type`, `blocking_scope`, `evidence_kind`, `acceptance_criterion`,
`norm_ref`, `performer_role`, `approver_role`; external access grants gain a
`requirement_occurrence` scope kind. Retired:
`work_assignments.requirement_template_version_id` and the free `severity` axis.

## Assumptions the owner may reverse

These are the owner's judgements, made on 2026-08-05 without customer
validation. Each is reversible; each has a price. They are recorded here, not
buried in a product document, so that reversing one is a decision and not a
discovery.

### a. The buyer is the subcontractor; the general contractor gets a free read-only seat

The GC seat is a **distribution channel, not the paying customer**. Every working
money gate in the world is configured and lifted by the payer; our ICP is the
payee. The counter-example that makes this survivable is Siteline, which sells to
the subcontractor's A/R manager and lives — because the sub is buying **speed of
signature**, not self-restraint.

**Reversal cost.** If the GC is the buyer, the gate inverts: blocking scope
becomes payer-side policy, the free no-account external link stops being a
differentiator because the payer already has accounts, and the pricing unit
(active object, in ₴) must be rebuilt against construction volume. The domain
model of this ADR survives intact; positioning, pricing, permission defaults, and
the entire go-to-market are rewritten. No migration; a full GTM rewrite. First
detectable in the ten to fifteen discovery interviews that have not happened.

### b. The headline metric is first-time acceptance rate and days-to-signature

Blocked value is secondary and is reported beside them, never as the hero number.
The skeptic's argument is that leading with «ми заблокували ₴X» repels a
cash-poor buyer, who hears a product that stops him invoicing.

**Reversal cost.** Inside v0.1, near zero: both numbers derive from the same
projections and neither requires a schema change. The cost is external — a
landing page and a demo script. After a pilot has been sold on one framing,
switching costs the credibility of the repositioning, which is the expensive part.

### c. Scope is MEP / electrical installation, not general construction

The shipped library covers Додаток Н positions Н.14 and Н.15 — exactly this ICP,
and exactly twelve verified items.

**Reversal cost.** General construction needs the Додаток Н positions **outside
Н.14 and Н.15** sourced to the same `VERIFIED_PRIMARY` standard, plus a widened
stage vocabulary. How many such positions exist and what they cover is **not on
the allow-list and is not asserted here**
([hidden-works-content-rules.md](../product/hidden-works-content-rules.md)):
that document carries the verbatim contents of Н.14 and Н.15 only, and «Н.1–Н.13»
is not an allow-listed range. That is a
content-sourcing programme measured in weeks of verification, not a code change,
and hidden-works-content-rules.md forbids shipping an item without a verified
source. Onetrace made exactly this transition, from fire stopping outward, and
thinned everywhere. No schema change; a content and focus cost.

### d. КЕП is v0.2, not v0.1

v0.1 ships `LINK_CONFIRMATION` — email link, IP, server time — and says plainly,
in the UI and on the printed page, that it **is not an electronic signature**.
The negative statement is the only thing v0.1 prints, and it is deliberately
the only thing: it asserts nothing and therefore needs no source. The
admissibility argument rests on Article 17(7) of Law № 2155-VIII, whose primary
text was never fetched; it is carried as `UNVERIFIED` in
[hidden-works-content-rules.md](../product/hidden-works-content-rules.md) and
**may not be printed in any customer-facing artifact**, nor relied on in
positioning, until that document allow-lists it against a fetched source.
Presenting a link confirmation as a qualified signature under Article 18 would
be a legal falsehood regardless.

**Reversal cost.** Pulling КЕП into v0.1 requires superseding ADR-001's deferral
of qualified electronic signature, a КНЕДП integration, and — the real cost — that
the customer's технагляд, a person entirely outside the workspace, holds and uses
a qualified signature. That collides head-on with the no-account link, which is
the only structural advantage this product has over Aconex, Visibuild, Zutec,
Novade and InEight, all of which demand an account. Deferring further is cheap;
pulling forward is a boundary change plus a demo that may not run.

### e. ЄДЕССБ integration is not built

The state responsibility matrix contains no виконавча документація obligation for
a specialist subcontractor — no journals, no acts on hidden works, no КБ-2в. The
only construction position is «відомості про виконання будівельних робіт», which
is the general contractor's duty.

**Reversal cost.** Building it now means engineering against an obligation that
does not exist for our buyer. If the matrix changes, the cost is an adapter over
already-frozen, self-describing package versions — additive, because package
versions are immutable. The standing cost of not building it is that the question
is asked at every demonstration and must be answerable in one paragraph. It
belongs in a quarterly watch register, not in a roadmap version.

### Which owner questions this ADR does not answer

Of the **ten** open questions in
[competitive-landscape.md](../product/competitive-landscape.md) §8, this ADR
answers **five** through assumptions **a**, **b**, **c**, **d**, **e**
(questions 1, 6, 9, 4, 8), and answers question 7 only to the extent of fixing
the positioning sentence and forbidding the false statutory claim. It leaves
open questions 2, 3, 5 and 10, plus the remainder of question 7 — the exact
contract clause wording, which the positioning sentence does not settle:

- **which pain is being sold** — evidence gaps versus the customer having no
  money. This requires ten to fifteen interviews and can invalidate the product,
  not merely the wording;
- **whether to refuse back-dated reconstruction publicly.** The mechanism already
  makes it structurally impossible; the public promise is a brand decision;
- **the exact contract clause wording** that ties evidence to presentation, which
  a counterparty's lawyer will read;
- **one-sided or counter-signed gate.** v0.1's gate is one-sided in its *rules*
  and two-sided in its *decisions* (decision 9). The counter-signed
  `evidence_plan` is v0.2 and is not decided here;
- **whether the first pilot is chosen adversarial** (question 10 — one pilot
  with a hostile технагляд, or three with loyal ones). This ADR does not answer
  it, and it decides whether the gate is tested at all: an acceptance that signs
  everything cannot refuse, and a gate that is never refused has demonstrated
  nothing. [roadmap.md](../product/roadmap.md) §M6 sets entry evidence that
  depends on the answer.

## Included in v0.1

- requirement rules, immutable rule versions, and binding at contract-baseline
  publication;
- requirement occurrences materialised at assignment creation and visible in the
  field client before work starts;
- bulk instantiation across a location subtree with a dry run and an explicit
  uncovered-line list;
- `intervention_type` and `blocking_scope` as described in decisions 3 and 4,
  with `hold` never markable not-applicable;
- the witness notice **event** with server-computed `earliest_proceed_at`, and
  recorded non-attendance;
- stages and append-only stage closures;
- the closure-without-evidence fact, its per-segment ineligibility, and its
  internal clearance;
- the `blocked_reason` object with its closed code vocabulary and per-assignment
  value deduplication;
- the written readiness predicate, and package freeze refusing ineligible scope
  with a per-segment reason list;
- the corrected value-at-risk precedence;
- `evidence_decision` and `commercial_decision` as separate decisions, with the
  requirement-occurrence scope kind on the protected external link;
- statutory act generation by the form of Додаток В and Додаток Г, assembled only
  from recorded facts, with three typed signatories;
- the Додаток Н Н.14/Н.15 requirement library with per-string verification tags
  and sources.

## Explicitly deferred

Named version, named owner, each requiring **its own decision** before it enters
that version. A version tag in the market research is a routing note, not an
approval.

| Deferred | Owning version |
|---|---|
| `evidence_plan` — the counter-signed, externally agreed requirement list that makes the gate two-sided in its rules | v0.2 |
| The statutory notice apparatus: Ukrainian working-day calendar with holidays, delivery proof, push at notice-window opening, printed notice artifact | v0.2 |
| The silence clock and the unilateral act on a counterparty's unmotivated refusal to sign | v0.2. **The statutory basis is not established.** No civil-code article, part, or court decision may be cited for this item until [hidden-works-content-rules.md](../product/hidden-works-content-rules.md) allow-lists one against a fetched primary text; until then this row names a product behaviour and no norm |
| The submission-requirements matrix (Not tracked / Warn / Prevents submission) with attributed per-requirement waivers | v0.2 |
| КЕП: `assurance_level` on decisions, detached `.p7s` over the frozen version hash — ADR-001's deferral of qualified electronic signature, now given an owning version | v0.2 |
| Qualified timestamps (RFC 3161) over evidence hashes and package-version Merkle roots | v0.2 |
| КБ-2в (Додаток 36) and КБ-3 (Додаток 37) rendering with mandatory `form_version` | v0.2 |
| Non-conformance objects whose disposition moves money | v0.2 |
| Додаткові угоди as first-class baseline amendments — ADR-001 defers variations and change orders; this names the version, not an approval | v0.2 |
| Offline capture, queue, and sync — unchanged from ADR-004's v0.3 | v0.3 |
| Material certificates as scoped, expiring evidence satisfying many lines | v0.3 |
| Automatic un-blocking on acceptance of remedial evidence | v0.3 |
| Sequential approver chains — ADR-001's deferral of sequential enterprise approval routing, unchanged | v0.3 |
| ЄДЕССБ integration | Watch register; no version |

## Consequences

- **v0.1 gets larger.** The package review's honest distance to a first paying
  pilot already put items 4–9 at roughly the size of everything built so far;
  this ADR adds stages, closures, the bypass fact, the notice event, act
  generation, and the requirement library on top of that. The owner is choosing a
  longer v0.1 over a shorter one that is a photo album.
- **The evidence for this decision is a landscape inference plus the owner's
  judgement. It is not customer validation.** As of 2026-08-05 the discovery
  ledger records 21 evidenced sends and zero replies, zero interviews, zero named
  projects, zero pilot commitments, and zero willingness-to-pay signals
  ([validated-assumptions.md](../discovery/validated-assumptions.md)). Question 2
  of the market research — whether evidence gaps are even a top-two cause of
  delayed payment in Ukraine — is unanswered and can invalidate this ADR.
- **Approved is not deployed.** Nothing described here exists in the runtime.
  `requirement_occurrences` appears in the migrations only as a nullable
  placeholder column with its table deferred
  (`supabase/migrations/0015_execution_evidence_module.sql:251`). No test count,
  green baseline, or delivery claim is made by this document. *(Qualified
  2026-08-08: still true of the **applied** migrations. `requirement_occurrences`
  is created by `0043` and its FK activated there, in a file that has never been
  applied — see the third amendment note at the head of this document.)*
- **The pipeline order must change.** `progress.record` currently opens the
  allocation head and carves minor units out of the work-item pool without any
  reference to evidence, requirement, occurrence, or readiness
  ([package review §3](../delivery/package-review-2026-08-04.md)). Money is
  allocated before evidence exists. Decision 7 makes eligibility a precondition of
  *freeze*, not of *recording* — so this ordering is not itself illegal — but the
  value-at-risk projection will report allocated money as blocked until the
  requirements are satisfied, and that is intended.
- **A refusal is a support surface.** Every refusal must name the requirement,
  the missing evidence, the owed role, and the money — or the first blocked user
  will ask a human, and the gate will become a helpdesk cost. This is why
  decision 6 makes the reason an object.
- **The regulatory content is a liability as well as an asset.** Shipping a wrong
  clause number to an engineer whose client's lawyer reads it is worse than
  shipping no content. The unrenderable-without-a-source rule exists so the
  liability cannot grow by accident.
- **Positioning must survive a demonstration against Aconex and Textura.** Both
  do block. The sentence in decision 1 and the input-not-mechanism framing in the
  Context are the only defensible claim, and no product document may sharpen them
  into "nobody blocks money".

## Replacement rule

This ADR amends ADR-001 and does not supersede it. Changing any of the ten
decisions above requires a superseding ADR that identifies the user evidence, the
version impact, the data ownership, the security impact, and the migration cost.

Three specific protections:

1. **Weakening the gate requires an ADR, not a backlog item.** Making `hold`
   markable not-applicable, allowing a manual override of a derived readiness
   state, letting freeze filter instead of refuse, or restoring `evidence_blocked`
   below the packaging states are each a boundary change.
2. **Reversing an owner assumption requires editing this ADR's assumption section
   in the same change**, so the reversal and its recorded cost stay together.
3. **No regulatory content changes without
   [hidden-works-content-rules.md](../product/hidden-works-content-rules.md).**
   Adding a Додаток Н item, a Додаток В field, or a clause number through any
   other route is prohibited regardless of which document requests it.
