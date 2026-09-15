# Test strategy

**Status:** Approved

**Applies to:** v0.0 and v0.1

**Last reviewed:** 2026-08-08

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
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


No test result, count, or baseline is claimed by this document. It says what
must be tested, never what currently passes.

**Written against the re-cut.**
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) makes v0.1 six steps and
moves the commercial half to v0.2; [ADR-007](../decisions/ADR-007-pilot-field-client.md)
makes the field client a browser page. This document follows both. The
operation catalog [`scope-v0.1.csv`](../../technical/openapi/scope-v0.1.csv) and
[`entity-catalog.csv`](../../technical/database/entity-catalog.csv) **were
rewritten against ADR-006 on this branch**, so the condition
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) §"The precedence problem"
places on that decision taking effect is met and this document no longer holds
milestone planning open on it. Where this document and those catalogs disagree
about which version owns a test, the disagreement is a defect in one of them and
is resolved by correcting it, never by writing a test against the older shape.
What remains outstanding is recorded in [version-0.1.md](version-0.1.md)
§"Corrections owed elsewhere"; nothing in that list is a reason to write a test
against a shape ADR-006 replaced.

## Principles

1. Every invariant in
   [invariant-catalog.csv](../../technical/database/invariant-catalog.csv) has
   named test evidence; the catalog's `test_evidence` column is the traceable
   index of required suites. An invariant whose capability moved to v0.2 keeps
   its row and its required test and loses only its v0.1 due date — ADR-006
   cancels nothing, it re-times.
2. Security and tenant-isolation suites can never be quarantined
   ([v0.0 gate](version-0.0.md) 2). See §"4. Tenant isolation" for what makes
   that enforceable rather than aspirational.
3. Environmental failures (unavailable local DB) are reported separately from
   code failures; a suite blocked by the environment is not "passing".
4. Tests run against the same Postgres engine as production (local Supabase);
   no mocked database for RLS, constraint, or transaction behavior.
5. **A test that pins current behaviour is not evidence that the behaviour is
   right.** Before changing a rule, read the test that already covers it: an
   assertion written to match what the code did will defend the defect against
   the fix. This principle earns its place in a re-cut, because moving a
   capability between versions is exactly when a suite gets rewritten around
   what it happened to assert.

## What proves the gate

The gate is the product's only differentiator
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 9), and a gate is
a **refusal**. A refusal is proved by a test that the command refuses and that
names its reason object. A report, a dashboard, a banner, a red count, or a derived status a user
can override is not evidence that a gate exists — the anti-pattern register in
[competitive-landscape.md](../product/competitive-landscape.md) §4 is a list of
products that shipped exactly that and called it a gate.

Four tests carry v0.1. If any one of them is absent, the pilot demonstrates
something other than the product.

### 1. A `hold` requirement blocks closure

**The test.** A work stage carries an applicable requirement occurrence with
`intervention_type = hold` and a `blocking_scope` that blocks stage closure, and
no current accepting evidence decision by its `approver_role` exists. The
closure command is called. **It refuses.**

**The shape of the refusal is half the test.** The response carries a named
problem code and a `blocked_reason` object naming the requirement occurrence,
the rule version, the missing evidence by kind and acceptance criterion, the
`approver_role` that owes the decision, `since`, and the blocked value by
currency. A refusal that returns a generic 403 or a bare status word fails this
test even though it refused; a refusal nobody can point at in a meeting with the
general contractor becomes a helpdesk cost
([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) decision 6).

**The negative half is equally load-bearing.** While the block is live,
recording performed quantity, capturing evidence, and recording that the stage
was in fact covered are all still permitted (INV-065). The gate refuses a
conclusion and a presentation; it never refuses to record a fact. A ledger that
refuses inconvenient reality is worth nothing as evidence.

**Removing the precondition must fail the suite** rather than degrade quietly.

**Two narrowings ADR-006 makes, and the two tests they owe to v0.2.** In v0.1
`intervention_type` is `hold` only — `witness` needs the notice event and
`review`'s only blocking scope is package inclusion — so the publication command
rejects the other two while the CHECK keeps all three values, and **that
rejection is itself a v0.1 test**, because it is what lets v0.2 be additive. And
a v0.1 `hold` is `blocks_stage_closure`, not the `blocks_both` that
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) decision 4
requires, because the other half of `both` has nothing to block yet. **The v0.2
package milestone owes a migration that widens every `hold` written during v0.1
to `blocks_both`, and a test that fails if one v0.1 row is left behind.** Without
it every requirement recorded during the pilot sits permanently outside the
payment-eligibility half of the gate and nobody would notice.

**Neighbours that ship with it.** INV-061 is the catalog row. INV-063 —
`not_applicable` rejected on a `hold` by the exception command itself, not by
convention — and INV-066 — `blocking_scope` stored on the rule version and
copied onto the occurrence, never inferred from a severity word at read time —
are tested alongside it. The v0.1 escape is the ADR-005 exception: `waiver` and
`accept_risk` by an authorised actor. The test proves the exception is
**attributed and visible on the scope**, not that it is available; an exception
that hides itself is worse than no exception.

### 2. The act contains no field outside Додаток В

The act is the one artifact a Ukrainian technical supervisor recognises
([package review](package-review-2026-08-04.md) §7), and a fabricated field on it
is read by an engineer's client's lawyer. This test has two halves, and **only
one of them can be written today**. Both facts are stated here rather than left
to be discovered by whoever writes the suite.

**The negative half, writable now.** A rendered act carries none of the fields
[hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
prohibition **E** names — «шифр», «аркуш», «ким видана», «паспорт», «Акт №»,
«м.п.» — and no fourth signatory. Exactly three typed signatory slots exist.
**No render exposes a free-text quantity field**, anywhere; the composer offers
only quantity entries already recorded against the line, with a share selector.
Nothing is printed for the технагляд's кваліфікаційний сертифікат серія and
номер, because whether Додаток В has a field for it is not established. The
title is «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ» and never «Акт огляду прихованих
робіт» (prohibition D). And the render does **not** silently normalise the
original's language (prohibition F): «На основі викладеного» in В against «На
підставі викладеного» in Г, «посада,номер» without its space, and the official
state file's «Притітка» typo all survive the renderer. A formatter that
"corrects" any of them fails this test.

**The positive half, and why it is blocked.** Asserting that the field set is
*exactly* В.1 and В.2 in the standard's order requires an enumerated field list.
[hidden-works-content-rules.md](../product/hidden-works-content-rules.md) item 3
allow-lists the form; `technical/database/schema-v0.1.sql` records that every
field of either form comes from the render template and that the schema names
none; and **no such enumeration is committed anywhere** —
[`technical/requirements/`](../../technical/requirements/) holds the Додаток Н
CSV and nothing else. Until the В.1/В.2 field list is committed there with its
`verification` tag and its source, the positive half cannot be written, and **no
test may substitute a field list typed from memory**. That substitution is
precisely the fabrication class the adversarial audit behind
`hidden-works-content-rules.md` was run to catch, and it would be worse in a
fixture than in a document, because a fixture looks verified. The gap is the same
open item as the unretained primary ДБН file and closes with it.

INV-073 is the catalog row for this half of the act.

### 3. No regulatory string renders without its verification tag

Two halves, and the storage half is what makes the render half unnecessary to
trust.

- **Storage.** A library row, a rule string, or an act form citation with a null
  or empty `verification` or `source` **cannot be inserted**. The rule lives in
  NOT NULL constraints and CHECKs, not in a template, so a future contributor
  cannot add an unsourced line to Н.15 by editing a view. A string with no
  source is unrenderable because it is unstorable.
- **Render.** The renderer refuses any normative string lacking a tag and a
  source, and the refusal is a failure — never a silent omission, which would
  produce a shorter list that still looks complete.

**Content fixtures, each taken from a written prohibition:**

- Н.14 has exactly five items and Н.15 exactly seven. The shipped library is the
  twelve `VERIFIED_PRIMARY` rows of
  [dbn-a31-5-2016-dodatok-n.csv](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv);
  a thirteenth is refused (prohibition A);
- the ten-position «Простий примірний перелік» that circulates on
  `marazm.org.ua` is a **hostile fixture** and must fail closed. It is in no
  edition of the standard and it is printed adjacent to a genuine extract so
  that it reads as a continuation (prohibition R);
- the string «орієнтовн» never appears in any rendered output; Додаток Н is
  «довідковий» (prohibition B), and the довідковий disclaimer under a generated
  requirement list renders **uncollapsed**, never collapsed and never omitted;
- anything the product recommends beyond Додаток Н renders in the separate
  «Додатково рекомендуємо (не з Додатка Н)» block, carrying no normative
  citation;
- the mapping of a Н.14/Н.15 position to form В or form Г renders labelled as
  the **product's assumption**, because no source establishes it (prohibition G);
- the disclaimer on every page of a generated act carries the recorded date of
  last verification against the Реєстр будівельних норм; a render with an empty
  date fails (M0 gate 10 in [production-readiness.md](production-readiness.md));
- a record below level 4 of the assurance ladder never renders «підпис» or
  «підписано» (prohibition S), and a level-3 record prints the negative
  statement beside its level.

**The `UNVERIFIED` rows have no renderable form at all**, so the test for them is
that no code path can produce one: both articles of Закон № 2155-VIII, ПУЕ:2026
clause numbering, and ДБН page numbers. A test fixture is a customer-facing
artifact the first time it is pasted into a bug report.

### 4. Tenant isolation, and the tests that cannot be quarantined

- **The un-quarantinable set** is tenant-isolation, authorization,
  migration-integrity, immutable-history, backup/restore, and external-decision
  security tests ([version-0.0.md](version-0.0.md) gate 2). Adding to that list
  is ordinary maintenance. **Removing from it is a boundary change.**
- **The quarantine ledger is the enforcement point.** Any temporarily skipped
  non-security test carries owner, reason, expiry, and removal condition in the
  repo, and a security or tenant-isolation test appearing in that ledger **fails
  the build** rather than waiting to be noticed. A control that depends on a
  human reading a list is not a control.
- **Coverage is per module, not sampled.** The cross-cutting minimum requires
  tenant-isolation tests for every module, so an exposed tenant relation with no
  positive and negative policy test is a gap. INV-060's default-privilege and
  RLS-coverage check is what makes that assertion mechanical instead of a claim.
- **How that check works** *[added 2026-09-16, [DEV-013](../tasks/DEV-013-m0-gate11-coverage-checker.md)]*.
  `technical/database/rls-coverage.csv` lists every relation that `anon`,
  `authenticated`, `goproceed_app`, `goproceed_service` or `goproceed_worker`
  can reach — by a direct table or column grant, a grant to PUBLIC, ownership,
  or a policy naming the principal on a relation it reaches through an
  inherited privilege — one row per principal, as `covered` (a cited positive
  and negative test), `gap` (with its backlog entry) or `exempt_no_grant`.
  `goproceed_service` reaches every `goproceed_app` table by inheritance; where
  no policy names it, it is judged by the member-plane row, because those
  policies key off `app.current_actor()`. `covered` means the v0.1 **read**
  minimum only: an authorised same-workspace read (or, without `SELECT`, a
  write) and a read denial to an active member of another workspace, or on the
  service plane the declared workspace reaching the row and another or no
  declared workspace refused. Cross-workspace write denial (BL-099), every other
  row of the `tenancy-and-security.md` test list, `SECURITY DEFINER` functions,
  storage paths, sequences and other schemas stay proved by review.
  `pnpm validate:canonical-docs` checks the registry against the migrations and
  the cited tests without a database, and accepts a cited test only in one
  plain, unskippable shape; `packages/testing/src/rls-coverage.test.ts` checks
  it against the running database, including grants to roles outside the five,
  row level security on every listed table, an owner outside the bypass roles
  only where RLS is forced, and no view in `public` or `app` without
  `security_invoker`. The scanner reads text, not a syntax tree: it does not parse regex literals
  (a quote or `//` inside one can mislead it), it does not see an array or nested
  destructuring that shadows `it` (`const [it] = …`), and its vitest config check
  does not see a shorthand key or an imported, merged config. None of these is in
  the cited files or the config today; a construct it cannot see is a reason for a
  reviewer, not the scanner, to refuse a citation. A table first created after
  `0085` cannot enter it as a gap. No quarantine ledger exists yet; when one
  does, it must refuse any test the registry cites. The evidence run for the
  cited tests is the unfiltered `pnpm --filter @goproceed/testing test`.
- This is also M0 gate 11 in
  [production-readiness.md](production-readiness.md). The same evidence closes
  both, and it must: a pilot admitted on a sampled coverage claim is admitted on
  nothing.

## Test families

### Unit

Pure domain logic in `packages/domain` and contract schemas in
`packages/contracts`: builders, validation, problem mapping, monetary
calculation helpers. Fast, no I/O.

### Migration

Each migration applies cleanly on an empty database and on the previous chain;
`supabase db reset` matches the incremental path. Additive-only checks: no
rename/drop of baseline objects without a separately approved destructive
migration. Backfill jobs produce reconciliation reports; rollback/forward-fix
paths are exercised (data-model.md "Additive migration rules").

**Two migrations are owed to v0.2 and each needs a test that fails if a v0.1 row
is left behind** ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md)
consequences): widening every v0.1 `hold` from `blocks_stage_closure` to
`blocks_both`, and pinning existing act versions to package versions once
packages exist. Work recorded during a pilot is the work most likely to be
looked at later, and a migration whose omission is invisible is the one that gets
omitted.

### Invariant

Database-level proofs for the P0 rows of the invariant catalog: composite-FK
injection denial, terminal-decision uniqueness, append-only/immutability trigger
rejection, exception fork denial, reservation balance checks on the allocation
heads already in the runtime, and the head-serialization races that exist there
today (bootstrap, adjustment/allocation, head advance). Concurrency tests use
real parallel transactions, not sequential simulation.

The partition/decision and corrected-successor head races arrive with claim
segments and package heads in **v0.2**; their catalog rows and their required
tests are unchanged, only re-timed.

### Refusal

**A milestone whose outcome is a refusal closes on a test that proves the
command refuses and names its reason object** ([roadmap.md](../product/roadmap.md)
policy). Each test asserts the refusal **and** the shape of what comes back —
the named problem code, and a `blocked_reason` object naming the requirement, the
missing evidence, the owed `approver_role`, and the money.

The fifteen cases stay enumerated in
[execution-and-evidence.md](../domain/execution-and-evidence.md) §"Required
invariant tests" and are indexed by invariant through the `test_evidence` column
of [invariant-catalog.csv](../../technical/database/invariant-catalog.csv)
(INV-061…INV-080). ADR-006 re-times several of them without cancelling one:

| Refusal case | Version | Note |
|---|---|---|
| `can_close_stage` refuses while a blocking occurrence is unsatisfied, with a `blocked_reason` per occurrence | v0.1 | Proof 1 above |
| The exception command rejects `not_applicable` on a `hold` | v0.1 | INV-063 |
| A `hold` rule version is refused at publication with the wrong `blocking_scope` | v0.1, narrowed | `blocks_stage_closure` in v0.1; `blocks_both` returns with packages |
| The publication command rejects `witness` and `review` | v0.1, new | The CHECK keeps all three values, so v0.2 is additive |
| A stage cannot carry two current closures | v0.1 | INV-076 |
| An occurrence pins `rule_version_id` and is unaffected by later publication or retirement | v0.1 | INV-067, INV-080 |
| `timing = before_concealment` cannot be materialised on a stage not flagged concealed | v0.1 | INV-077 |
| An occurrence with `blocking_scope = none` never blocks and is never hidden | v0.2 | INV-078 — unreachable in v0.1, whose publication command admits `blocks_stage_closure` only (ADR-006 decision 4.4) |
| Blocked value is deduplicated per assignment | v0.1 | INV-070; the number in step 6 |
| The dry run names every uncovered line, and silent non-coverage is refused | v0.1, narrowed | The predicate is (work type, stage); location-subtree bulk instantiation moves with `locations` |
| A normative string without tag and source is unrenderable | v0.1 | Proof 3 above |
| A witness occurrence cannot be satisfied before `earliest_proceed_at` | v0.2 | Moves with `witness` |
| Recorded non-attendance after the period satisfies a witness occurrence | v0.2 | Moves with the notice event |
| A closure without evidence freezes the unmet occurrence set | v0.2 | The bypass moves; its price is package ineligibility, and v0.1 has no packages |
| A cleared bypass stays visible and stays in the manifest appendix | v0.2 | Requires a manifest |
| Freeze refuses ineligible scope, reported distinctly from a stale-source conflict | v0.2 | Requires package versions |
| A segment with no applicable blocking occurrence is eligible | v0.2 | Requires claim segments |

**There is no bypass in v0.1**, so there is no bypass test in v0.1. The v0.1
escape is the attributed, visible exception of proof 1.

### RLS

Positive and negative policy tests per exposed table, following the matrix in
[tenancy-and-security.md](../architecture/tenancy-and-security.md): outsider
denial, same-user-other-workspace denial, membership-without-project-access
denial, responsibility/visibility separation, forced-RLS owner behavior, and
default-privilege checks proving new objects are inaccessible until granted.
Coverage is per module and is an M0 exit gate (proof 4).

### API integration

Route-level tests through the BFF: auth required, idempotency replay and
conflict, optimistic-version conflicts, problem+json codes, `X-Request-Id`
validation, and the command list for the six steps. The route set is
[`scope-v0.1.csv`](../../technical/openapi/scope-v0.1.csv), rewritten against
ADR-006 on this branch: **58 operations**, with the 22 the re-cut moved now in
[`scope-v0.2.csv`](../../technical/openapi/scope-v0.2.csv). An operation that is
a row in neither file is in neither version, and this family's scope is the v0.1
rows.

### Storage

Bucket privacy (no anonymous list/read), cross-workspace signed-URL denial,
key overwrite rejection, staging invisibility, orphan purge within 24 hours,
signed-URL expiry, and proxied revocation behavior
(files-and-storage.md "Required verification").

### External link

The protected-review protocol matrix, unchanged in discipline: prefetch/GET
non-consumption, exchange single-use concurrency, HMAC key rotation, generic
failure responses, cookie flags and TTLs, session rotation, CSRF/origin,
epoch/revocation denial, and token absence from logs, database and outbox.

What changes is the scope kind. In v0.1 the grant targets a **requirement
occurrence**, because there is no package version to target: step 5 is one
person accepting or returning one act through one link, with no account. The
exclusive-arc check is tested in the direction v0.1 has (INV-074); the
package-version direction, decision batches, `commercial_decision`, and the
decision-vs-partition and decision-vs-head-advance races arrive with packages in
v0.2. The v0.1 decision is named `evidence_decision` from the first migration, so
adding `commercial_decision` later is additive and no v0.1 record is
reinterpreted.

### Import fuzz

Hostile fixture corpus: macro/formula workbooks, ZIP bombs, deep nesting, path
traversal names, encoding attacks, NUL/control characters, oversized rows/cells,
MIME spoofing. Every fixture fails closed with a named error and no publishable
rows (INV-016). CSV export neutralization round-trips without losing source
provenance.

**This family survives the import freeze, and the reason matters.** ADR-006
decision 6 freezes import *extension* work — column mapping, unit inference,
number-format handling — because there are zero customer documents to specify it
against. It does not remove the parser: the XLSX/CSV importer built in M1 stays
in the code and stays reachable. A frozen feature that is still reachable is
still an attack surface, so the corpus keeps running and INV-016 keeps guarding a
live route.

### Manual work-line entry

**Manual entry is a first-class v0.1 capability, not a stopgap**
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 2), and it gets
the same tests as an imported line. A typed line carries its provenance — who
entered it, when, against which draft baseline — and is subject to the same
publication immutability, lineage and diff rules as a parsed one. No fixture may
assume every line came from a file, and no test may encode a typed line as a
second-class row. The blocked-money sum of step 6 is computed over these lines,
so a defect here is a defect in the only number the owner ever sees.

Synthetic fixtures use transparently fake names — the «Приклад-» prefix already
used in the M1 slice — and never plausible invented Ukrainian company names,
which is the same rule M0 gate 13 states for demo data.

### Blocked money

The v0.1 replacement for the seven-state value-at-risk suite, which moves to
v0.2 with the projection itself. Tests assert that the sum is:

- taken over the work lines under a blocked stage, at the price on the
  **published baseline**;
- attributed **once per assignment**, so several unmet requirements on one work
  never inflate it (INV-070);
- broken down by `blocked_reason.code`;
- summed **within one baseline and never across baselines in different
  currencies** (INV-012);
- reported with missing price, zero price and over-contract performance kept
  **distinct and beside the sum**, never folded into it.

Blocked value is exposure, never a receivable, and it is reported beside
first-time acceptance rate and days-to-signature rather than as the hero number
([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) assumption
**b**).

### Rounding and property

Property-based tests over decimal quantities keep guarding what the runtime
already has: largest-remainder ties and the valuation-pool reconciliation that
prevents the same quantity being independently rounded twice
(INV-011/037/055). Coupled net/tax/gross allocation across claim segments,
pool-to-claim allocation, and reviewer-order equivalence for partitioned
decisions arrive in **v0.2** with the allocation ledger, claim segments and
decision coverage; the harness stays in the repository so it does not have to be
rebuilt.

### Field client

This family replaces "Mobile interruption" and is the direct consequence of
[ADR-007](../decisions/ADR-007-pilot-field-client.md).

**What is removed is the distribution chain, not the devices.** No Apple
Developer Program membership, no D-U-N-S registration, no Google Play Console,
no funded Expo plan, no UDID registration, no EAS internal build, and no
TestFlight or Play internal-testing track. "EAS internal build installation on
both platforms" stops being closing evidence for the field milestone, because a
browser page needs an HTTPS origin and nothing else.

**What replaces a physical device matrix is three things, not one.**

1. **An engine matrix, run in automation.** The capture screen is a page, so
   most of what previously required hardware is now a headless browser run
   against the engines the support floor names — WebKit for iOS 16.4+,
   Chromium for Android 10+, plus desktop. Covered there: the client states,
   the receipt-before-success rule, whole-upload retry idempotency, integrity
   mismatch, connection loss before and after bytes are sent, and the warning
   raised when the page is about to be left with an in-flight or unsent
   original. These are **structural assertions** — attributes, states, request
   bodies, persisted rows — never screenshots. A screenshot and a geometry
   probe both pass on broken markup.
2. **Two measurements that only real hardware can make**, recorded as
   measurements rather than as assertions. **The physical device inventory is
   still required and now matters more, not less** (ADR-007 §"What this decision
   does not remove"): one supported iPhone and one lower-resource supported
   Android device. Browser behaviour varies by engine and version in ways a
   native camera API does not, so the two measurements are (a) how each engine
   and version honours the `capture` attribute, and whether it strips or
   transcodes image metadata before the page receives the bytes, and (b) the
   storage-eviction rule, including whether an installed home-screen PWA is
   exempt. Each is recorded with the device, the OS version and the browser
   version. **Neither is asserted from memory in any customer-facing artifact**,
   and until measured the client behaves as though eviction can happen at any
   time. The decision does not depend on how they resolve — v0.1 withdraws the
   provenance claim either way — so these gate what may be *said* in v0.2, not
   whether the client ships.
3. **A claim test, which is new.** No screen, render, export, manifest, demo or
   sales sentence asserts camera-only capture for a blocking requirement, a
   camera-versus-gallery distinction, tamper-evident provenance, or verified
   capture-time GPS. This is a test over strings and over the evidence record's
   origin value, and it exists because those are exactly the claims a UI reaches
   for when a badge would look good. Its counterpart is M0 gate 9 in
   [production-readiness.md](production-readiness.md).

**Invariants that change hands.** INV-013 (upload failure does not delete the
original), INV-014 (an app restart does not lose a pending capture) and INV-053
(pending originals envelope-encrypted, logout quarantines rather than deletes)
are **native-client invariants**. They rest on an OS-sandboxed app area and a
Keychain/Keystore-bound wrapping key, and a browser gives neither. **No v0.1
test asserts them**, and re-scoping them back onto the browser path by a catalog
edit is prohibited without an ADR (ADR-007 replacement rule 2). They remain the
native client's invariants and become v0.3 obligations.

**What v0.1 tests in their place is weaker and testable:**

- **no success before the receipt.** `upload_received` is not
  `evidence_available`; no screen shows a photo as recorded until the
  `available` receipt is persisted;
- **the client does not transform the bytes.** The original is uploaded
  unmodified and is never drawn to a canvas before upload — the ScaneReport
  anti-pattern named in
  [competitive-landscape.md](../product/competitive-landscape.md) §3.3. The
  uploaded bytes hash equals the selected file's bytes. The client can promise
  only that **it** did not transform them; it cannot promise the browser did
  not, so the hash binds the uploaded artifact and never the sensor output;
- **loss is never silent.** If an upload cannot complete, the user is told
  plainly that GoProceed has not saved the photo and that it must be retaken or
  kept by them. This is owed a row in
  [invariant-catalog.csv](../../technical/database/invariant-catalog.csv), and
  **this document does not invent its identifier** — ADR-007 deliberately
  assigned none, because inventing a catalog id outside the catalog is how
  catalogs stop being authoritative;
- **a v0.1 capture records an origin that does not assert a native camera
  session.** The domain layer must carry a value meaning the origin is not
  distinguished; the token belongs to
  [execution-and-evidence.md](../domain/execution-and-evidence.md) and the state
  and entity catalogs, and is not invented here either. **It now exists in the design layer** —
  `schema-v0.1.sql`'s `capture_origin` enum, the state catalog and INV-086 —
  **and not in the runtime**: neither the deployed CHECK nor
  `packages/contracts/src/uploads.ts` carries it, and every value those two
  offer asserts a distinguished origin. So the test that can be written now is
  still the negative one:
  **no code path records a PWA capture at all** until the token lands, and once
  it lands, no PWA capture is recorded as `native_camera`. A suite that picks
  `photo_picker` or `file_picker` to make the path work would assert exactly the
  distinction ADR-007 decision 5 withdrew, and would then defend it.

**Client states.** `mobile_pending_original` keeps its live states in
[`state-catalog.csv`](../../technical/states/state-catalog.csv); `quarantined`
and `expired_purged` are **native-only** and no v0.1 test asserts them. One
discrepancy is recorded rather than silently resolved: the six approved labels in
[`copy-catalog.csv`](../../technical/copy-catalog.csv) include `quarantined`,
which v0.1 must not render, and do **not** include `discarded`, which is the
state the browser client reaches on logout, revocation or account switch. A state
with no approved label cannot be rendered and a label for a state v0.1 does not
have must not appear, so the copy catalog needs a correction before the client
ships. This document names the gap and adds no copy.

**`apps/mobile` is not on the v0.1 path and is not deleted.** It stays in the
tree on Expo SDK 57.0.9 with its scheme registered and its token-proof screen
intact, keeps whatever tests it has, and acquires no new v0.1 obligation. It is
the starting point for v0.3 offline work, where the two costs above are precisely
the properties an offline outbox cannot tolerate.

### End-to-end

One scripted vertical scenario per milestone — seven of them now, M0 through M6
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 3) — plus the
six-step loop. **M0 is the exception: its evidence is recorded evidence per item
([production-readiness.md](production-readiness.md)), not a scenario.**

The six-step scenario, in order, is what the pilot is:

1. ПТВ creates an object, **types the work lines by hand**, picks a work type,
   and the requirements load from the shipped ДБН library;
2. the foreman opens a link on a phone and sees what must be photographed
   **before covering**, in the standard's own wording, with a reference image,
   **before work starts** — a requirement that appears after the stage is
   covered fails this test, because "known in advance" is a claim about time;
   he takes the photo, and it is not reported saved until the receipt;
3. the closure is **refused**, and the refusal names exactly what is missing;
4. the requirement is satisfied, the closure succeeds, and it produces the act
   by the form of Додаток В, assembled only from already-recorded facts;
5. технагляд opens a personal link with **no account**, returns with a reason,
   and then accepts;
6. the owner reads the blocked sum and its breakdown by cause.

E2E asserts **structural facts** — rows, receipts, the refusal's reason object,
the act's field set, the sum's breakdown — and not only screenshots.

The M6 run is measured against a **pre-gate baseline** for first-time acceptance
rate and days-to-signature, taken on that object before the gate is switched on
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 8). Without it the
pilot cannot show the gate helped, and a pilot that cannot fail cannot succeed.
**Neither measure has a v0.1 definition today**:
[glossary.md](../domain/glossary.md) defines both entirely over claim segments,
package versions, first submissions and `commercial_decision`, all of which are
v0.2; `external_decision_batches` moved into v0.1-M5 on 2026-08-06 and no longer
carries the gap, which changes nothing about either measure. No test may invent a v0.1
definition to make the baseline computable — a fixture that does so fixes the
headline metric of the pilot to a shape nobody approved. The gap is recorded in
[version-0.1.md](version-0.1.md) §"v0.1-M6" and the glossary owes both
definitions.
The технагляд is chosen **adversarial** (decision 9): a client who signs
everything never wanted to pass, so a compliant reviewer produces a clean run and
no evidence whatsoever about the product's only differentiator. If that reviewer
refuses to open the link, refuses to decide inside it, or demands paper, the run
is recorded as a **result** and written into
[validated-assumptions.md](../discovery/validated-assumptions.md) as an
invalidation of A-3 — never as a bug, and never deleted.

## Execution

- Local/CI: `supabase start` + `supabase db reset`, then the root test command
  serialized across packages that share one database (`--concurrency=1` stays
  load-bearing until suites stop truncating shared tables).
- Quarantine ledger: any temporarily skipped non-security test carries owner,
  reason, expiry, and removal condition in the repo. A security or
  tenant-isolation test in that ledger fails the build (proof 4).
- **The rule, unchanged.** Pass/fail counts are recorded verbatim **from a
  dated run that a reader can reproduce**, distinguishing environmental from
  code failures. No document in this package may state a passing suite, a test
  count, or a green baseline as a present fact except by pointing at such a run.

### Baseline (recorded 2026-09-01)

**Until 2026-09-01 this document named no baseline**, and said so: `node_modules`
was absent from the worktree, the last recorded run predated migrations
`0036`–`0040` and the suites added with them, and the two figures previously in
circulation disagreed with each other — which the
[package review](package-review-2026-08-04.md) §4 records as its own finding.
That is now closed by a run, not by an assertion.

**Run:** GitHub Actions `ci`, run id **33540108319**, workflow event
`pull_request` (PR #56), head SHA **`18411ea`**, 2026-09-01T17:50:16Z →
18:03:24Z, conclusion `success`. Both jobs green: `verify` and `app-qa`.
The log is public and the run is re-runnable, which is what makes this
reproducible rather than merely dated.

`pnpm turbo run test --concurrency=1` — **176 files, 2174 tests, all passed**,
across eight suites. Counts are verbatim from the run log; the per-package
attribution was cross-checked against test files on disk at `18411ea` and
matches for all eight:

| Suite | Test files | Tests |
|---|---|---|
| `@goproceed/app` | 90 | 1034 |
| `@goproceed/testing` | 40 | 631 |
| `@goproceed/mobile` | 14 | 150 |
| `@goproceed/contracts` | 6 | 131 |
| `@goproceed/domain` | 10 | 102 |
| `@goproceed/discovery` | 6 | 73 |
| `@goproceed/landing` | 8 | 46 |
| `@goproceed/database` | 2 | 7 |
| **Total** | **176** | **2174** |

Also green in the same run: `pnpm validate:canonical-docs`
(`canonical documentation: OK`), `pnpm turbo run typecheck`,
`pnpm turbo run build`, the Supabase CLI pin assertion
(`want 2.115.0, have 2.115.0`), and `pnpm --filter @goproceed/app qa` —
**8 of 8 expected audits ran, zero findings**.

**What this baseline does NOT cover, and must not be read as covering.** Three
commands this repository owns are in no CI job and therefore did not run:
`node packages/testing/qa/motion-audit.mjs` (the motion gate — the known CI gap
recorded in [02-building-ui.md](../design/02-building-ui.md) §5),
`pnpm --filter @goproceed/mobile qa` (the field client's browser harness — the
150 `@goproceed/mobile` tests above are its unit suite, not that harness), and
`pnpm --filter @goproceed/tokens generate`. It is also a CI baseline only: no
run has been reproduced in a local worktree, and it says nothing about staging
or about any environment holding real data.
