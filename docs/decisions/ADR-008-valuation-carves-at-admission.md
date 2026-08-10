# ADR-008: Valuation carves at admission, not at recording

**Status:** Approved

**Applies to:** v0.1 and v0.2

**Last reviewed:** 2026-08-08

**Related decisions:** [ADR-003](ADR-003-evidence-packages-and-acceptance.md),
[ADR-005](ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](ADR-006-pilot-shaped-v0.1.md)

> **Authority.** The owner's decision of 2026-08-07, taken on the question
> [`2026-08-06-v0.1-implementation.md`](../superpowers/plans/2026-08-06-v0.1-implementation.md)
> §"Decisions this plan raises and does not take" item 2 raised and deliberately
> left open. It is not made on the founder-reported market signal, which
> [validated-assumptions.md](../discovery/validated-assumptions.md) forbids from
> driving a design change.

## Context

### The pipeline runs in the opposite order to the thesis

`progress.record` inserts the progress entry, opens the allocation head, and
then calls `appendValuationAllocation`, which reads the work item's price, tax
mode and valuation basis and writes a `valuation_allocations` row carving real
minor units out of the work-item pool
(`apps/app/app/v1/assignments/[assignmentId]/progress/route.ts:74-90`,
[valuation-writer.ts:66-78](../../apps/app/src/lib/valuation-writer.ts)). The
words `evidence`, `requirement`, `occurrence` and `readiness` do not occur
anywhere in that file.

The flagship vertical test states the ordering in its own step names: money is
carved at step 3, evidence is uploaded at step 4
([vertical-m2a.int.test.ts:98](../../apps/app/tests/vertical-m2a.int.test.ts)).

[ADR-005](ADR-005-readiness-gate-and-hidden-works.md) says the opposite: a
quantity without its proof is not yet a claim. The
[package review](../delivery/package-review-2026-08-04.md) recorded this as one
of the three findings more serious than the gate's absence, on the grounds that
"the gate is missing" is easier to retrofit than "the design commits value
before the gate would fire".

### The obvious fix is forbidden

Adding a readiness check before the carve would put a readiness predicate in the
recording path, which INV-065 forbids. That prohibition is correct and is not
being relaxed here: recording a measured quantity must never depend on whether
somebody has photographed anything. A foreman who measured 40 metres measured
40 metres.

So the choice is not *whether recording consults readiness*. It is **where the
carve happens at all**.

## Decision

**The valuation carve leaves the recording path and moves to the moment of
admission.**

### What recording does after this

`progress.record` continues to:

- insert the append-only progress entry, unchanged;
- open the allocation head, unchanged — the head is the serialization point for
  adjustments and for allocation, and it must exist before either can be
  ordered;
- record audit and enqueue the outbox event, unchanged.

It no longer writes a `valuation_allocations` row. Performed quantity is
therefore **recorded and unvalued** until it is admitted.

### What admission means

Admission is the moment the work passes the gate, and its name differs by
version because the gate bites in two places
([ADR-005](ADR-005-readiness-gate-and-hidden-works.md) decision 1):

| Version | Admission event | What it means |
|---|---|---|
| v0.1 | The stage closure command (M3) | Every `hold` requirement on the line has an accepting decision, so the stage may be recorded closed |
| v0.2 | Package eligibility at freeze | The segment may enter a package version for acceptance and payment |

In v0.1 the carve happens inside the stage-closure transaction, against the same
allocation head, for the quantity the closure covers. A closure that is refused
carves nothing, because a refused closure writes nothing at all.

### What this does to the numbers

A quantity that is recorded but not admitted is **performed, priced, and not
allocated**. That is a real state and it needs a name in the value-at-risk
projection rather than being folded into an existing bucket: it is not
`evidence_blocked` (a blocker may not exist yet — nobody has tried to close the
stage), and it is not `ready_not_packaged` (readiness is not established). The
projection owes it a bucket, and `blocked_value.get` (M6) owes it a line.

## Consequences

**This is a behaviour change to a deployed route, not a target-design change.**
`progress.record` shipped in v0.1-M2-A and is live in the 33-table runtime. A
caller that reads the 201 body for allocation figures will stop receiving them.
The plan's narrower fix — returning net/tax/gross minor units to the v0.1 caller
— is superseded: after this decision there is nothing to return at record time.

**Three test files assert the old ordering and must change.** This is the
"passing test defends the defect" pattern the project has already been bitten
by, so it is named rather than discovered later:

- [`vertical-m2a.int.test.ts:98`](../../apps/app/tests/vertical-m2a.int.test.ts)
  — the step is titled "records progress and carves a reconciling exposure
  slice"; the carve moves out of that step;
- [`progress-record.int.test.ts:40`](../../apps/app/tests/progress-record.int.test.ts)
  — "the valuation matrix" exercises the full price/tax/basis matrix through
  `progress.record`. The matrix itself is correct and must be preserved; it
  moves to the admission command;
- [`packages/domain/src/valuation.test.ts`](../../packages/domain/src/valuation.test.ts)
  — the pure domain calculation is unaffected. Only its caller moves.

Rewriting these to keep passing without moving the assertion would freeze the
inverted ordering. The matrix must be exercised somewhere; that somewhere is now
the admission command.

**The P1 redistribution finding changes shape.** [TODOS.md](../../TODOS.md)
records that pool funding is first-come and never redistributed, with the
minimal case being a root that records early, takes the pool, and later
withdraws. Carving at admission does not solve that, but it narrows the window:
only admitted quantity competes for the pool, and admission is a deliberate
authorised act rather than a side effect of measurement. The finding stays open
and its analysis needs revisiting against this ordering.

**`progress_allocation_heads` gains a state it did not have.** A head can now
exist with `reserved_quantity = 0` and no allocation row, for an arbitrary
period. The columns already permit it; nothing writes that state today. The
invariant catalogue should say so explicitly rather than leaving it inferable.

**It satisfies INV-065 rather than straining it.** No readiness predicate enters
the recording path. The predicate lives where it already belongs — in the
closure command, which is a gate by construction.

## What this ADR does not decide

- **Whether an admitted-then-corrected quantity releases its allocation**, and
  by what command. The atomic corrected-successor path in
  [packages-and-acceptance.md](../domain/packages-and-acceptance.md) is written
  against packages, which are v0.2. v0.1 needs its own answer for a closure that
  is later found wrong, and this ADR does not give one.
- **The v0.2 transition.** When packages arrive, admission moves from stage
  closure to package eligibility, and a v0.1 allocation carved at closure must
  either be re-anchored or read as already-admitted. That is a v0.2 migration
  question.
- **The two headline measures.** Still undefined for v0.1
  ([ADR-005](ADR-005-readiness-gate-and-hidden-works.md) assumption b); M6
  cannot open without them, and this decision does not supply them.
  *(Updated 2026-08-08: M6 was built anyway, because `blocked_value.get`'s sum,
  partition and drill-down are defined entirely over `blocked_reasons` and
  `work_items` and need neither measure. The sentence that is true now is «M6 is
  built and cannot CLOSE without them» — the requirement the measures carry is a
  reporting rule, that blocked value is reported beside them and never as the
  hero number. The operation ships with no key claiming either measure and its
  suite asserts their absence. Still undefined, still not this ADR's to supply,
  and still the single reason M6 cannot close.)*

## Replacement rule

Moving the carve back into the recording path, or adding a readiness predicate
to `progress.record`, requires a superseding ADR that identifies the user
evidence for the change, the effect on the value-at-risk projection, and the
migration for allocations already carved at admission. A performance argument is
not sufficient: the ordering is the product's central claim about itself.

## Status of this decision against the runtime

*(Rewritten 2026-08-08. The section previously read: «Nothing here is
implemented. `progress.record` still carves at recording time in the deployed
code, and no admission command exists — the stage-closure command is M3 and has
no route, no table for its result, and no test. This ADR describes required
behaviour, and the milestone that must deliver it is M3.» M3 has since been
written. The superseded paragraph is kept because the state it describes is what
every date-stamped citation of this ADR before 2026-08-08 was written against.)*

**Three states, and this decision is in a different one on each of the three
write paths.**

1. **`progress.record` — implemented as decided.** The carve is gone from the
   route, the import is removed, and the 201 returns `admitted: false` rather
   than a null allocation. The allocation **head** still opens at record time,
   which this ADR did not move; INV-089 makes a head with `reserved_quantity = 0`
   and no allocation beside it a REQUIRED state, not an error.
2. **The stage closure — implemented as decided.** `apps/app/src/lib/admission.ts`
   performs the carve inside the closure transaction, migration `0046` gives
   `valuation_allocations` its `admitted_by_closure_id` /
   `admitted_work_assignment_id` provenance and splits the write policy by arm,
   and a refused closure carves nothing because a refused closure writes nothing.
3. **`progress.adjust` — NOT implemented as decided, and this is a live P0.**
   The route gates the carve on «does this lineage already hold money», so one
   legitimate admission opens the door permanently for that root: a positive
   correction afterwards carves at **measurement** time, with no closure and with
   `admitted_by_closure_id` NULL. «Admission is a deliberate authorised act
   rather than a side effect of measurement» is therefore false on this path, and
   INV-089 is violated on it. The fix identified by the v0.1 final review is to
   let the already-admitted test gate the **negative** branch only, which leaves
   this ADR's genuinely open question — what a correction to admitted money does
   — exactly where §"What this ADR does not decide" leaves it. **A passing test
   asserts the current behaviour as required**, so the fix must invert that
   assertion in the same change.

**None of it is deployed.** Migration `0046` is one of ten files (`0041`–`0050`)
written on an uncommitted branch, and not one of the ten has been applied
anywhere. No test in this repository has been run.

**And admission has only just acquired something to admit.** A closure admits a
quantity only if every `hold` on the line is satisfied, and until 2026-08-08 no
`hold` could exist at all: the requirement-rule predicate had no carrier for its
first argument, so `assignments.create` materialised nothing and every closure
was vacuous. The owner settled the carrier on 2026-08-08 (migration `0050`;
[glossary.md](../domain/glossary.md) «Work type»), so a **hand-typed** baseline
now produces obligations. An **imported** baseline still produces none, so on an
imported кошторис this ADR's admission event remains a formality.
