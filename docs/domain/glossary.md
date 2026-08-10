# Canonical glossary

**Status:** Approved

**Applies to:** v0.1, v0.2 and v0.3

**Last reviewed:** 2026-08-08

**Related decisions:** [ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
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
>    («Work type» in this glossary), so a work type is validated as *a real one* and not as *the
>    right one*; and an **imported** baseline carries no work type at all, which
>    is permanent for the life of that contract version.
>
> **Neither decision is deployed, and neither is anything else.** Migrations
> `0041`–`0050` are ten files written on an uncommitted branch and **none has
> been applied anywhere**. Against applied history (`0001`–`0040`) the runtime is
> **33 tables**, of which **9** are among the 26 that ADR-006 decision 4 builds
> in v0.1. Nothing in this package may be described as green, verified, or
> confirmed working.


## Usage rule

These terms are canonical in product copy, schema, API, events, states, and
tests. A legacy synonym may appear only in a migration alias or localized UI
label. It does not create a second domain concept.

**Every term now names its owning version where that is not v0.1.** Before the
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) re-cut this document was
labelled `Applies to: v0.1` throughout and defined v0.2 objects — packages, claim
segments, submissions, commercial decisions, internal review, the notice, the
bypass, the seven-state projection — as if they were v0.1 vocabulary. A term
marked **v0.2** or **v0.3** keeps its definition unchanged; it is simply not
something v0.1 has, and no v0.1 screen, test, exit gate or metric may be defined
over it. Where a term has a narrower v0.1 form, both are given and the v0.1 form
is the one v0.1 means.

Where a Ukrainian string is the canonical user-facing label it is given here.
Ukrainian regulatory strings are additionally governed by
[hidden-works content rules](../product/hidden-works-content-rules.md), which
outranks convenience: a normative string with no recorded source must be
unrenderable, and no clause number, form field, or Додаток Н item may be added
through this glossary.

**Two unrelated things are called a requirement.** A *requirement rule* and its
*requirement occurrences* are evidence obligations on the work. An *approval
requirement* is a package-approval rule identifying a required role and scope.
They never substitute for each other.

## Workspace and parties

| Term | Definition |
|---|---|
| Workspace | Tenant, governance, and default access boundary for one GoProceed customer environment. |
| Workspace display name | Product-facing label for a workspace; not an official legal identity. |
| Party | Tenant-local business participant such as an own company, customer, contractor, or technical-supervision organization. |
| Party legal profile | Official name, registration number such as EDRPOU, tax attributes, and legal address for one party. |
| Own legal entity | A party the workspace is authorized to act for, marked by an own legal entity profile with stricter completeness and edit permission. |
| Counterparty | A party that is not marked as the workspace's own legal entity; a contextual UI term, not a separate table identity. |
| Contact | A person associated with a party, including name, role/title, and communication coordinates. |
| Membership | A person's workspace governance relationship: owner, admin, member, or auditor. |
| Project access grant | Time-bounded permission for a workspace member to see or act within one project. |
| Project responsibility assignment | Time-bounded operational responsibility such as evidence recorder or package compiler; not an access grant. |
| Замовник | The customer party on a contract — the side that receives the work and owes the money. In GoProceed it is an `approver_role` value with commercial authority: it decides quantity and value, never evidence quality. No statutory duty is asserted by this term; it names a contract side and a decision authority. |
| Кошторисник | The estimator acting for the замовник — an `approver_role` value with the same commercial authority as замовник and no evidence authority. It is a person's function, not a separate party. |
| ГІП | Головний інженер проєкту — the designer's lead engineer, appearing in GoProceed only as an `approver_role` value with evidence authority: it may accept or return evidence, and it never decides quantity or money. No statutory duty is asserted by this term, and nothing on the allow-list is claimed for it. |
| Технагляд | Технічний нагляд замовника — the customer's technical supervision party, which must participate in hidden-works inspection (ПКМУ № 903, п. 5 пп. 3) and may stop work until acts are drawn up (п. 6 пп. 5), and whose person holds a кваліфікаційний сертифікат (п. 3). Any claim that технагляд also keeps account of accepted and paid volumes is **not on the allow-list** and must not be asserted until [hidden-works content rules](../product/hidden-works-content-rules.md) adds it with a fetched source and a підпункт. |

## Projects and contracts

| Term | Definition |
|---|---|
| Project | Construction object that groups relationships and contracts; it is not owned by one legal entity. |
| Project party | A party's business relationship to a project, such as customer, technical supervision, designer, or performer. |
| Contract | Stable agreement identity within a project, between one workspace-owned party and one customer party. |
| Contract version | Immutable published snapshot of parties, terms, currency, tax policy, approval policy, requirement-rule bindings, and acceptance-relevant work baseline. |
| Work item | One commercial row in a published contract version, with unit, contract quantity, price state, currency, tax basis, and source lineage. |
| Location | **v0.2.** Tenant/project-scoped physical or logical work location used to make assignments and acceptance scope precise. `locations`, the location axis of the rule predicate, and location scope on assignments and occurrences move to v0.2 ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4.2); the table stays in the runtime and is not dropped. |
| Manual work-line entry | The v0.1 way an object is created: ПТВ types the commercial rows of a contract version by hand. It is **not a stopgap for a missing importer** and no document may describe it as one ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 2). It gets the same schema quality, the same provenance and the same tests as an imported line, and it is what the blocked-money sum is computed over. Contract-baseline **import** is frozen — not deleted — until one real sanitized кошторис, АВР or interim-works file from a named company exists. |
| Import batch | One controlled attempt to parse, map, validate, and optionally publish source files into a contract version. |
| Import row result | Immutable lineage and validation result for one source worksheet row under one parser/mapping version. |

## Execution and evidence

| Term | Definition |
|---|---|
| Work assignment | Operational scope derived from a contract work item, optionally identifying location, performer, member, due date, and planned quantity; its requirement occurrences are materialised from the contract version's bound rules when it is created. |
| Progress entry | Append-only measurement or signed adjustment. Every adjustment references one root measurement; a mistaken adjustment is corrected by another compensating adjustment to the same root. |
| Performer | Party accountable for performing the work; not necessarily the member who records it. |
| Recorder | Authenticated member who records progress or evidence. |
| Evidence source party | Party from which an evidence object originated. |
| Evidence custodian | Party or member responsible for maintaining the authoritative original and correction chain. |
| Capture event | **v0.2.** Device/server fact describing an evidence-capture attempt and its local-to-server receipt progression. Capture telemetry moves to v0.2; the table exists in the runtime and is not dropped. |
| Field client | The surface a foreman uses on site. **In v0.1 it is a PWA served from `apps/app`** ([ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 1) — an authenticated member surface behind the same BFF boundary as the web product, holding no authority of its own. It shows what must be photographed before covering, with a reference image, and takes the photo. Nothing else lives in it. |
| PWA | Progressive web app: a browser page reached by a link, with no install step and no store distribution. The v0.1 field client. It is **not** a name for `apps/mobile`, and the two are never used interchangeably. |
| `apps/mobile` | **v0.3.** The Expo/React Native iOS/Android client. It stays in the tree with its scheme registered, and is **not on the v0.1 path** ([ADR-007](../decisions/ADR-007-pilot-field-client.md) decisions 2 and 8). It is the starting point for v0.3 offline work, not dead code and not a v0.1 deliverable. |
| Origin method | The provenance field on an evidence object recording how the bytes reached the product — native camera, photo picker, file picker, form, import, generated derivative, or **not distinguished**. |
| `origin_not_distinguished` | The mandatory origin-method value for any object captured through the v0.1 PWA, which cannot tell a sensor capture from a gallery file ([ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 5). No PWA capture is ever recorded as `native_camera`. **The value exists in the design layer and not in the runtime**: it is carried by the target DDL (`technical/database/schema-v0.1.sql:97`), by `technical/states/state-catalog.csv:127` and by INV-086, and it is absent from the deployed CHECK (`supabase/migrations/0015_execution_evidence_module.sql:254-255`, six values) and from the request contract (`packages/contracts/src/uploads.ts:9`, the four of those six a client may submit). Until it lands in the CHECK and the contract, no PWA capture may be recorded at all, because every other available value asserts a distinguished origin. |
| Reference image | The example photograph shown beside a requirement in the field client so a foreman can see what an acceptable frame looks like. A v0.1-M2 exit gate; it is product content, never a normative citation. |
| Upload intent | Idempotent server contract for one whole evidence upload, content hash, expected size/type, and receipt result. |
| Evidence object | Immutable content identity and provenance record for an original or derivative evidence file/form. |
| Original evidence | First received content from capture or upload; its bytes, hash, and storage key are not overwritten. |
| Evidence derivative | Annotation, redaction, rendition, or other content derived from a named evidence object without replacing it. |
| Evidence correction | Successor evidence object that explicitly corrects an earlier object while preserving both. |
| Evidence link | **v0.2 as a table.** Many-to-many relationship between an evidence object and a requirement occurrence. The v0.1 binding between an upload and its obligation is `upload_intents.requirement_occurrence_id`, whose foreign key is deferred today (`supabase/migrations/0015_execution_evidence_module.sql:251`). |
| Internal review decision | **v0.2.** Append-only verifier decision about exact evidence/requirement facts; not an external acceptance. Internal review moves with packages and the `review` intervention type ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5); **no v0.1 decision is an internal review decision.** |
| Review target set | **v0.2.** Immutable relational identity for the exact occurrence and normalized evidence/link items reviewed together by one internal decision. |
| Serialized head (coordination head) | One row per serialised scope naming the **current** member of an append-only lineage, so that a successor fork or a second independent root cannot be represented at all — the shape INV-035 requires of every lineage it governs. A head is a rebuildable serialization aid and never business authority: it is written only inside a named transaction that holds the head lock and supplies the expected `version`, no client receives a direct `UPDATE` grant, `entity-catalog.csv` records the shape as the `coordination_head` lifecycle, and `technical/states/README.md` calls its state kind `stored_head`. «Head» never means an editable status column and never means «the newest row by timestamp». **Which head belongs to which version:** the **requirement exception head** and the **requirement evidence-decision head** are **v0.1-M3** — they entered v0.1 on 2026-08-06 by owner decision ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4, amendment note), because `can_close_stage`, the one predicate v0.1 ships, reads a current exception and a current accepting decision, and without their heads a fork would be representable in the only milestone that refuses; the **progress allocation head** is **deployed** (migration `0015`) and stays at `v0.1-M2`, only the allocation-ledger work moving to v0.2; the **package scope/review head**, the **segment-lineage head** and the **internal review head** are **v0.2** with the objects they serialise. |
| Readiness | Derived explanation of whether exact quantity scope has the current requirements, decisions, and evidence needed to close a stage — and, from v0.2, to enter a package version. It stays a projection, is never an editable status column, and since ADR-005 it is also a **precondition a command enforces** rather than a filter the compiler applies. **In v0.1 the command is the stage closure**; package freeze arrives with packages in v0.2. |

## Requirements and the readiness gate

| Term | Definition |
|---|---|
| Readiness gate | The two-sided refusal that blocks the recorded closure of a hidden or covered stage and the eligibility of performed quantity to enter a package version; it never blocks physical work and never refuses to record a fact. **v0.1 ships the first side only** ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5). The positioning sentence «Ми не блокуємо роботу на майданчику — ми не даємо її пред'явити до оплати…» may therefore be used only alongside an explicit statement that payment-presentation eligibility is not in v0.1, and no demonstration may show a payment-presentation refusal that does not exist. |
| Work type | First argument of the requirement-rule predicate: the classification of the work a rule applies to, carried as `work_type_key` **on the work item** (`public.work_items`, migration 0050 — nullable, and a null key matches nothing and is disclosed rather than refused) **and on the rule version** (`public.requirement_rule_versions`, migration 0041). It is still a **key with no owning fact** — no entity defines the set of work types and no v0.1 operation creates one, so a rule's first argument is matched by string. **Settled by the owner on 2026-08-08: the carrier is a column, and it needed no ADR.** Two migration authors read this entry in opposite ways — 0043's read it as forbidding the column, 0050's as forbidding only the entity — and the owner confirmed the second reading, so 0050 stands as written. What still needs an ADR is the owning ENTITY: a declared vocabulary table that both the line and the rule version reference. Until one exists, a work type is a string validated by set membership against the workspace's published rule versions (`app.work_type_key_is_bindable`, migration 0050), which refuses a key that resolves to nothing but cannot refuse a key that is merely the wrong one of two real ones.
| Location node | **v0.2.** Second argument of the requirement-rule predicate in the approved target design: one row of `locations`, the tenant/project-scoped location tree. "Location" and "location node" are the same concept — the second word names its position in the tree, never a second entity. **The v0.1 predicate has no location argument** ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4.2). |
| Published stage vocabulary | Third argument of the requirement-rule predicate in the approved target design and its **second argument in v0.1**: the closed set of stage names a contract baseline knows, pinned by the same contract-version binding as the rule set, so a rule can never name a stage its baseline does not carry. It is **not checked relationally** in the target DDL (`technical/database/schema-v0.1.sql`), which means the publish command is the only thing that can enforce it — and, like the work-type vocabulary, it has no owning entity or operation in any catalog while being an M1 entry condition. |
| Multiplicity | How many evidence objects satisfy one requirement, pinned from the rule version onto the occurrence and quantified over by `satisfied(o)`. In the DDL it is the pair `min_evidence_count` / `max_evidence_count`; `multiplicity` is the single domain name for that pair and the only name a predicate uses. |
| Requirement rule | Predicate over (work type, location node, stage) that yields the ordered set of requirements applying to matching work; it binds to the work, not to a person or a visit. **In v0.1 the predicate is (work type, stage)** ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4.2). `requirement_rules` as a workspace-authored table is **v0.2**; the only rule source in v0.1 is the shipped library, and rule *versions* stay publish/retire-only in every version. |
| Requirement rule version | Immutable published rule content — each requirement's evidence kind, acceptance criterion, norm reference, performer and approver roles, intervention type, and blocking scope; rule versions are published and retired, never updated. |
| Contract-version rule binding | Pin of the exact requirement-rule-version set to a published contract version at baseline publication, alongside its party, currency, tax, terms, and approval-policy snapshots. |
| Requirement library item | Shipped regulatory content row that carries its own `verification` tag and source in the data, and is unrenderable without them. |
| Requirement occurrence | Concrete, independently reviewable obligation for an assignment and exact quantity/location scope; it stores the `rule_version_id` it was materialised from, never a live reference to the rule. |
| Requirement occurrence materialisation | Creation of an assignment's requirement occurrences at assignment creation, with no evidence yet linked (projection `requirement_occurrence.review = occurrence`; there is no stored status column), so the field client shows the obligations before work starts. |
| Bulk instantiation dry run | Mandatory preview of a materialisation command that prints the generated occurrence names, the match count per rule, and the explicit list of uncovered lines. **In v0.1 it runs over a published contract version and reports its uncovered work lines**; its path drops `/bulk`. The subtree-wide form is **v0.2**, with `locations`. The uncovered list survives in both, because silent non-coverage means there is no gate. |
| Intervention type | The consequence class of a requirement — `hold`, `witness`, or `review`; it is a closed vocabulary, not a boolean. **`hold` is the only value a v0.1 rule version may publish** ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4.3); the CHECK keeps all three values and the publication command rejects the other two, so v0.2 is additive and no v0.1 record is reinterpreted. |
| Hold requirement | Requirement released only by a current accepting decision from its named approver role with no current return; it may never be marked not applicable. **In v0.1 it blocks stage closure only**, and its `blocking_scope` must be `blocks_stage_closure` ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4.4); from v0.2 it blocks package inclusion as well, after a migration widens every v0.1 `hold` to `blocks_both`. |
| Witness requirement | **v0.2.** Requirement released by a recorded inspection notice plus an elapsed notice period, with either attendance and an accepting decision or a recorded non-attendance. It moves with the notice apparatus. |
| Review requirement | **v0.2.** Document obligation that must be satisfied before the work starts; it bars presentation for payment and raises a pre-start warning, and never bars the recording of performed quantity. **Both halves are v0.2, including the pre-start warning**: no v0.1 rule version may publish a `review` requirement, so no v0.1 screen can raise it. |
| Blocking scope | Stored consequence of a requirement — `none`, `blocks_stage_closure`, `blocks_package_inclusion`, or `blocks_both` — materialised onto the occurrence and never inferred from a severity word at read time. All four values exist in every version; **only `blocks_stage_closure` is publishable in v0.1**. |
| Advisory requirement | Requirement whose blocking scope is `none`: it is recorded and surfaced, and blocks nothing. **Unreachable in v0.1**, because every v0.1 requirement is a `hold` that must be `blocks_stage_closure`. No v0.1 exit gate, invariant or test may demand an advisory occurrence as evidence; it is a v0.2 object. |
| Requirement exception | Append-only waiver, not-applicable, or accept-risk fact for one occurrence, with authority, reason, and supersession; `not_applicable` is rejected for a hold requirement by the exception command itself, not by convention. |
| Inspection notice | **v0.2.** Append-only fact that named recipients were invited to witness work, carrying server `sent_at`, the configured `required_notice`, and a server-computed `earliest_proceed_at`. The notice **event** moves to v0.2 together with the whole statutory notice apparatus ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5); the earlier reading that v0.1 ships the event is withdrawn, and **no document may describe a v0.1 notice.** |
| Notice period | **v0.2.** The configured `required_notice` duration, a workspace setting until the working-day calendar ships; it must not be labelled as the five-working-day rule, because the Ukrainian working-day calendar that rule needs arrives with it and calendar days and робочі дні produce different dates. |
| Notice attendance outcome | **v0.2.** Append-only record of attendance, or of non-attendance after the notice period elapsed; recorded non-attendance is evidence of process in favour of the performer. |
| Deemed released | **v0.2.** State of a witness occurrence treated as satisfied because its notice period elapsed and a non-attendance outcome was recorded; the elapsed clock alone never releases it. |
| Work stage | The closable unit: one assignment, one location node, and one stage from the published vocabulary, flagged concealed or not. **In v0.1 it is one assignment, one stage and the concealed flag** — the location node is v0.2. |
| Concealed stage | Work stage whose result will be covered by subsequent work, so its evidence has to exist before covering; «приховані роботи» is the user-facing Ukrainian label. |
| Stage closure | Append-only fact that a work stage was recorded closed, with actor, server time, and the closure-predicate result at that moment. |
| Closure predicate | The written condition `can_close_stage` — every applicable occurrence whose blocking scope includes stage closure is satisfied. |
| Closure without evidence | **v0.2. There is no bypass in v0.1** ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4): its price is package ineligibility, and in a version with no packages that price is zero, so shipping it would ship a defeat that costs nothing. Append-only bypass fact that a stage was closed while blocking requirements were unmet, carrying the actor, the claimed authority, a mandatory reason code and free text — the reason-code vocabulary is not yet enumerated anywhere and must not be called closed or structured until it is — the expected remedy, and the frozen set of unmet occurrences; its price is money waiting, not escalation. |
| Bypass clearance | **v0.2.** Append-only internal-reviewer fact naming substitute evidence that restores package eligibility for scope covered by a closure without evidence; it never deletes the bypass. |
| Requirement exception as the v0.1 escape | The **only** way past an unmet `hold` in v0.1: a `waiver` or `accept_risk` appended by an authorised actor, attributed and visible, with `not_applicable` rejected on a `hold` by the exception command itself. It is one attributed, visible escape, which is what ADR-005's argument against an absolute lock requires. It is **not** a bypass and must never be described as one: it records that an authorised person accepted the risk, not that evidence was skipped. |

## Packages and external review

**Everything in this section is v0.2 except the five terms marked v0.1.**
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5 moves packages,
lines, claim segments, the allocation ledger, submissions,
partial acceptance, decision coverage, prior-acceptance references, decision
issues and
`commercial_decision` to v0.2. **v0.1's step 5 is one person accepting one act
through one link**: an occurrence-scoped external access grant, an external
session, an external `evidence_decision`, and the decision batch that is the
receipt for that submit — the batch moved into v0.1-M5 on 2026-08-06 by owner
decision (decision 4, amendment note), and it is the one term in this section
whose version changed after the re-cut. No package-finalisation command
exists in any migration.

| Term | Definition |
|---|---|
| Package | **v0.2.** Stable container for one contract, package series, and reporting period. |
| Package version | **v0.2.** Draft that can be frozen into an immutable snapshot of all material contract, progress, requirement, review, evidence, template, renderer, and approval facts. |
| Package line | **v0.2.** Acceptance-homogeneous row for one contract work item, location/scope, unit price, currency, and tax basis. |
| Claim segment | **v0.2.** Exact, non-overlapping quantity slice inside a package line, linked to exact progress sources and used as the quantity-decision grain. |
| Claim scope lineage | **v0.2.** Contract-scoped identity for one exact progress-source allocation and homogeneous approval scope across package versions; unchanged prior acceptance references this identity. |
| Progress claim allocation | **v0.2.** Immutable signed ledger movement that reserves, activates, partitions, releases, or preserves accepted quantity from an exact root progress measurement. |
| Decision coverage | **v0.2.** Immutable relation showing which active partition descendants remain covered by an earlier commercial decision without copying that decision. |
| Package eligibility | **v0.2.** Derived precondition for a claim segment: every applicable occurrence whose blocking scope includes package inclusion is satisfied, no uncleared closure without evidence covers the scope, the current internal review head accepts, and every pinned evidence object is `available`. `is_package_eligible` requires packages; **`can_close_stage` — the half a foreman meets — ships in v0.1.** |
| Freeze refusal | **v0.2.** Named refusal of a package-version freeze on ineligible scope, returning a per-segment reason list plus the sums included and excluded by currency; it is a different failure from a stale-source conflict and must never be reported as one. **The v0.1 refusal is the stage closure**, and it refuses in exactly the same shape: named, with a reason object per occurrence. |
| Block reason | **v0.1.** Structured object naming the requirement occurrence, the rule version, the missing evidence by kind and acceptance criterion, the awaiting approver role, the `since` server time, the blocked value by currency, and a code. |
| Block reason code | Value from the closed, versioned vocabulary — at minimum `ACT_NOT_SIGNED`, `TEST_REPORT_MISSING`, `MATERIAL_CERTIFICATE_MISSING`, `SUPERVISION_SIGNATURE_MISSING`, `CUSTOMER_MOTIVATED_REFUSAL`, `NOTICE_PERIOD_NOT_ELAPSED`, `CLOSED_WITHOUT_ACT`. Two have **no v0.1 producer**: `NOTICE_PERIOD_NOT_ELAPSED` needs the notice and `CLOSED_WITHOUT_ACT` needs the bypass, both v0.2. The vocabulary is not narrowed for v0.1 — a closed vocabulary that changes shape between versions is not closed — and all seven values are enumerated as a `stored_vocabulary` machine in `technical/states/state-catalog.csv:112-118`, transcribed there on 2026-08-06 because [roadmap.md](../product/roadmap.md) makes the vocabulary an M3 entry condition. The **bypass** reason-code vocabulary is the one that is still unenumerated, and `state-catalog.csv:119` carries it as an explicit `NOT_ENUMERATED` gap row rather than an invented set. |
| Excluded-scope appendix | **v0.2.** The block reasons of a frozen package version rendered as «виключені позиції та підстави», beside the sum included and the sum excluded by currency. |
| Bypass appendix | **v0.2.** Named appendix of a frozen package manifest listing every closure without evidence covering the version's scope, with its value by currency. |
| Package artifact | **v0.2.** Immutable PDF, XLSX, ZIP, or manifest generated from one frozen package-version snapshot and renderer version. |
| Approval requirement | **v0.2.** Business rule pinned to a package version that identifies required/observer role, decision type, and exact applicable scope. An occurrence-scoped v0.1 evidence decision names **no approval requirement at all**; its role is pinned from the occurrence's own `approver_role`. |
| Package submission | **v0.2.** Append-only act of sending one frozen package version under a named approval policy. |
| External access grant | **v0.1.** Revocable, expiring bearer-email-link permission for one recipient and one scope target — a package version (**v0.2**) or a requirement occurrence (**v0.1**) — with the server storing only its token hash; grants never cross workspace, project, or contract boundaries. In v0.1 the occurrence-scoped grant is the only grant there is. |
| External session | **v0.1.** Short-lived server session exchanged from a valid access grant by deliberate POST. |
| Decision batch | **v0.1-M5.** Immutable receipt for one external submit action and its included decisions/issues, in an exclusive arc over its grant's scope kind — package version or requirement occurrence (INV-074). It entered v0.1 on 2026-08-06 by owner decision ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4, amendment note): it is the carrier of the receipt, the confirmation-text version and the idempotency record, and `requirement_evidence_decisions` requires it on every externally submitted decision (`technical/database/schema-v0.1.sql:1278-1283`). The commercial decisions, issues and coverage recorded against a batch stay v0.2. |
| Commercial decision | **v0.2.** Terminal accept or return outcome on quantity and value for one approval requirement and exact claim segment at submission time, made by замовник/кошторисник authority; derived coverage follows later partition descendants, and it governs the value-at-risk buckets. Naming the v0.1 decision `evidence_decision` from the first migration makes adding this additive. |
| Evidence decision | **v0.1.** Accept or return outcome on quality and compliance, made by технагляд, ГІП, or internal-verifier (**v0.2**) authority. In v0.1 it targets **one requirement occurrence and its `approver_role`**, is head-shaped and append-only, and releases the `hold` that blocks the stage closure. From v0.2 it also targets an approval requirement and an evidence object inside a package version and governs package eligibility. It is a precondition of admission, never a monetary act. |
| Decision issue | **v0.2.** Structured blocking or non-blocking reason recorded in a decision batch. A v0.1 external **return** must still record free text and the requirement occurrence it concerns. |
| Prior acceptance reference | **v0.2.** Reference from a new package version to an unchanged earlier accepted segment and its original decision; never a copied decision. |
| Approval scope hash | **v0.2.** Deterministic hash of all facts material to a named approval, used to prove that referenced prior scope is unchanged. |
| LINK_CONFIRMATION | The v0.1 assurance level of an external decision confirmed through a personal email link, recording recipient, IP, and server time. It is stated plainly, in the UI and on the printed page, **not** to be an electronic signature. Its evidentiary status under Law № 2155-VIII is `UNVERIFIED` — the primary text was never fetched — so no article of that law may be printed in any customer-facing artifact ([hidden-works-content-rules.md](../product/hidden-works-content-rules.md), Open items). |

## Statutory hidden-works content

| Term | Definition |
|---|---|
| Statutory act | Draft act produced as a by-product of closing a concealed stage whose requirements are satisfied, assembled only from already-recorded facts — progress entries, available evidence objects, occurrence decisions, party and certificate data — with no free-text quantity field in any render. |
| Act version | Immutable rendered version of a statutory act. **In v0.1 it is pinned by the stage closure**, not by a package version ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4.5); from v0.2 the package version pins it additionally, under the same freeze discipline as every other artifact. v0.2 owes a migration that pins existing v0.1 act versions, with a test that fails if one is left behind. |
| Act form version | The exact statutory blank an act version was rendered against — Додаток В (обов'язковий) or Додаток Г (обов'язковий) of ДБН А.3.1-5:2016 — recorded on the act version and printed with it, never inferred at render time. |
| Додаток В | The mandatory hidden-works act form of ДБН А.3.1-5:2016, whose heading is «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ»; no field may be added to it. **v0.1 renders form В only.** |
| Додаток Г | **v0.2.** The separate mandatory act form used for responsible structures; it is a distinct template, not a variant render of Додаток В. No v0.1 step reaches it: ADR-005 assumption **c** limits v0.1 to MEP / electrical installation, and prohibition **H** forbids calling electrical installations «відповідальні конструкції». |
| Додаток Н | The **довідковий** appendix of ДБН А.3.1-5:2016 listing hidden-works positions, of which the product ships Н.14 (five items) and Н.15 (seven items) verbatim; it is never called an «орієнтовний перелік» and never presented as mandatory or exhaustive. The allow-list carries the verbatim contents of **Н.14 and Н.15 only**; how many other positions the appendix has and what they cover is **not asserted anywhere in this package**. |
| Робоча документація | The working design documentation that determines the binding list of hidden works for a given site (п. 8.4.3.3); the shipped Додаток Н list does not replace it and says so, uncollapsed, under every generated requirement list. |
| Акт огляду прихованих робіт | Live normative Ukrainian vocabulary for the inspection of hidden works; it is not the heading of the form blank, and it must never be presented to users as obsolete. |
| Form mapping assumption | The product's own mapping of a Додаток Н position to form В or form Г, labelled as an assumption in the UI and in every render, because no source establishes it. |
| Signatory slot | One of the three typed act signatories — будівельна організація, технічний нагляд замовника, авторський нагляд (п. 8.4.3.5). The технагляд's кваліфікаційний сертифікат (ПКМУ № 903, п. 3) is held on the participant record; whether Додаток В has a field for its серія and номер is not established, so nothing is printed into the form for it until [hidden-works-content-rules.md](../product/hidden-works-content-rules.md) allow-lists that field against the В.1/В.2 field list. |
| Verification tag | The per-string provenance label carried in the data by every normative item — `VERIFIED_PRIMARY`, `VERIFIED_SECONDARY`, or `UNVERIFIED`; `UNVERIFIED` is never shown as normative. |
| Assurance ladder | The five-level scale in [hidden-works-content-rules.md](../product/hidden-works-content-rules.md) that fixes what a recorded acknowledgement, decision or signature may be **called**: workflow comment, operational acknowledgement, authenticated acceptance record, electronic signature, qualified electronic signature. It decides how strongly a record speaks, never who had authority to make it. |
| Assurance level | The explicit level a record carries from that ladder, **displayed in the UI and printed on the page**. v0.1 records level 3, `LINK_CONFIRMATION`, and every rendered decision block prints its level — a package or act that cannot state the level of a decision it carries must not render that decision. **The v0.1 render obligation is not deferred**; what is deferred to v0.2 is the `assurance_level` *field* as the carrier of a КЕП claim, and КЕП itself. Never render «підпис» or «підписано» for a record below level 4. |
| Додатково рекомендуємо (не з Додатка Н) | The separately labelled, non-normative block where any recommended item that is not verbatim Додаток Н content is shown, with no normative citation. |

## Derived outcomes

| Term | Definition |
|---|---|
| Acceptance | **v0.2.** Projection over exact commercial decisions and valid prior acceptance references. It is not a manually editable record. |
| Accepted quantity | **v0.2.** Claim-segment quantity accepted by every required commercial approver whose scope covers it. |
| Returned quantity | **v0.2.** Claim-segment quantity returned by at least one required commercial approver. |
| Pending quantity | **v0.2.** In-scope performed quantity that is neither accepted nor returned and remains in a named workflow state. |
| Evidence blocked | **v0.2.** Value-at-risk state for exposure slices whose evidence obligations are unmet, currently returned, or covered by an uncleared closure without evidence; it outranks the packaging states in the precedence. The seven-state projection and the corrected precedence move with packages; the correction stands and applies the moment packages exist. |
| Blocked value | Value that cannot yet be presented, grouped by currency, **attributed once per assignment** so several unmet requirements on one work never inflate the sum, and reported beside first-time acceptance rate and days-to-signature rather than as the hero number. It is exposure, never a receivable. **In v0.1 it is the blocked-money sum below.** From v0.2 it is the value of exposure slices in `evidence_blocked`. |
| Blocked-money sum | **v0.1.** The amount of the work lines under a blocked stage, at the price on the published baseline, attributed once per assignment, broken down by `blocked_reason.code`, and summed **within one baseline and never across baselines in different currencies**. It is a query over `blocked_reasons` and `work_items` and adds no table. Missing price, zero price and over-contract performance stay distinct and are reported beside it, never folded into it. It has no state machine: five of the seven value-at-risk states name packaging or submission and cannot occur in v0.1. |
| Performed not admitted | **v0.1 and v0.2.** Quantity that is recorded, priced, and carries no valuation allocation — performed work whose money has not yet been carved, because in v0.1 the carve happens at the stage closure and not at measurement ([ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md)). It is **neither** `evidence_blocked` (a blocker may not exist yet — nobody has tried to close the stage) **nor** `ready_not_packaged` (readiness is not established), which is why ADR-008 says the projection owes it a bucket of its own; the name is fixed here and the bucket is emitted by `blocked_value.get` as `performed_not_admitted`. Its money is what admission would carve, computed by the same allocator the closure calls, so the screen and the closure cannot disagree. It **overlaps** blocked value — a blocked stage's quantity is both — and is therefore reported **beside** the sum and never added to it. `technical/states/state-catalog.csv` has no machine for it and [value-at-risk.md](value-at-risk.md) has no row: both are owed, and the v0.2 seven-state projection is where the row belongs. |
| Compliance exception | **v0.2.** Evidence/requirement problem that remains after monetary acceptance and requires remediation without silently reversing quantity acceptance. |
| Acceptance exposure slice | **v0.2.** Derived, acceptance-homogeneous portion of effective performed quantity used by the VaR projection; before packaging it comes from progress/readiness facts, and after packaging it maps to an active claim segment. |
| Value at risk (VaR) | **v0.2.** Value of performed, acceptance-relevant, priced quantity that is not currently accepted, grouped by currency and workflow state. |
| Missing price | Price is unknown or absent; quantity is reported as unvalued and excluded from monetary totals. Distinct in both versions. |
| Zero price | Known contractual price of zero; quantity is valued at zero and is not treated as missing. Distinct in both versions. |
| Over-contract exposure | Performed quantity above the approved contract baseline; reported separately and never silently valued at the contract rate. Distinct in both versions. |
| First-time acceptance rate | **Definition below is v0.2. It has no v0.1 definition anywhere in this package, and that is an open blocker.** Share of claim segments accepted without a return on their first submission. Claim segments and submissions are v0.2, so **M6 cannot compute this measure and the pre-gate baseline cannot be taken from the product.** [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 8 makes it a required pilot-record field and gates M6 on it; the roadmap leaves «whether either is computed inside the product or recorded beside it» to [version-0.1.md](../delivery/version-0.1.md), which does not settle it. Until it is settled — by naming a v0.1 carrier, or by recording the measure outside the product from the partner's own records — **M6 does not open.** This glossary does not invent a v0.1 definition, because choosing one is a delivery decision and the objects it would be defined over (the occurrence evidence decision head, the stage closure, the act version) each carry a different meaning. |
| Days-to-signature | **Definition below is v0.2, and the same blocker applies.** Elapsed time from the submission of a frozen package version to the terminal commercial decision on its scope, measured in whole days from server timestamps: `external_decision_batches.server_received_at` of the terminal decision minus the submission fact, per package version and never averaged across currencies. **Every object in that definition but one is v0.2** — package versions, submissions and `commercial_decision`; `external_decision_batches` moved into v0.1-M5 on 2026-08-06, which changes nothing about the measure because the other three did not — so it too has no v0.1 form. It was newly written on 2026-08-06, *after* the re-cut, and still bound to v0.2 tables; recording that here is the point, not softening it. |
| Pre-gate baseline | **Both headline measures taken on the pilot object before the gate is switched on** ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 8). Without it the pilot cannot show the gate helped, and a pilot that cannot fail cannot succeed. It must come from the partner's historical records; **the project holds zero customer documents of any kind**, so nothing in the repository can supply it and no one currently owns it. |
| Pilot object | The record that replaces «M6 is the pilot» ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 8): named partner, named **adversarial** технагляд, success measures, pre-gate baseline, sample, and stopping conditions in both directions. **Every field is empty as of 2026-08-06**, M6 does not open until all are filled, and filling them is discovery work rather than delivery work. A pilot with a compliant технагляд produces a clean run and no evidence about the product's only differentiator. |

## Retired terms

Retired by [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md).
Each may still appear as a migration alias or in historical material. None of
them names a live domain concept, and none may be reintroduced without a
superseding ADR.

| Retired term | Replaced by |
|---|---|
| Requirement template version | Requirement rule, requirement rule version, and contract-version rule binding — a template pinned to one assignment cannot express an ordered set, cannot vary by stage or location, and was absent by default. |
| Requirement severity (`blocking` / `advisory`) | Blocking scope; a requirement's consequence is its blocking scope, not a severity word read at query time. |
| Quantity decision | Commercial decision — the same ADR-003 fact, renamed so it cannot be confused with an evidence decision. |
| Hold-point boolean | Intervention type `hold`; «hold point» remains market and legacy vocabulary for a hold requirement and is not a second concept. |

## Reserved later terms

Receivable, invoice, retention, deduction, payment, reconciliation, journal,
and posting period belong to Project Commercials or accounting contexts after
v0.1. They are not synonyms for a package, submission, acceptance, or
value-at-risk projection. This reservation covers accounting and tax documents,
including КБ-2в (Додаток 36) and КБ-3 (Додаток 37), whose rendering is v0.2. It
does **not** cover the statutory hidden-works act of Додаток В and Додаток Г,
which is in v0.1.

**`assurance_level` is not reserved.** It was listed here as v0.2, which
contradicted the v0.1 exit gate that **every rendered decision block prints its
assurance level** — an act or package that cannot state the level of a decision
it carries must not render that decision
([hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
§"Standing rules"). The v0.1 value is `LINK_CONFIRMATION` at level 3. What is
reserved to v0.2 is **КЕП and level 5**, not the act of printing a level.

These terms are reserved with a named owning version and are not v0.1
vocabulary:

| Reserved term | Owning version |
|---|---|
| Evidence plan — the counter-signed, externally agreed requirement list | v0.2 |
| Working-day notice calendar, delivery proof, printed notice artifact | v0.2 |
| Silence clock and unilateral act | v0.2 |
| Submission-requirements matrix and per-requirement submission waiver | v0.2 |
| КЕП, qualified electronic signature, detached `.p7s` | v0.2 |
| Qualified timestamp over an evidence hash or package-version Merkle root | v0.2 |
| Non-conformance object whose disposition moves money | v0.2 |
| Додаткова угода as a first-class baseline amendment | v0.2 |
| Material certificate as scoped, expiring evidence satisfying many lines | v0.3 |
| Automatic un-blocking on acceptance of remedial evidence | v0.3 |
| Sequential approver chain | v0.3 |
| Offline capture, queue, and sync | v0.3 |
| ЄДЕССБ integration | Watch register; no version |
