# Personas and workflows

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md)

## Actor model

GoProceed separates four kinds of authority:

1. workspace governance;
2. project visibility;
3. project responsibility;
4. external package review.

A person may have more than one authority, but none is inferred from a job
title or party relationship.

## Workspace governance

| Role | Primary job | Boundary |
|---|---|---|
| Owner | Govern tenant, ownership, and highest-risk settings | At least one active owner must remain |
| Admin | Manage members, own parties, projects, and policy | Cannot silently become owner |
| Member | Perform authorized project work | Needs separate project access/responsibility |
| Auditor | Read approved scopes and audit evidence | No operational mutation by default |

These are access roles, not construction professions.

## Project responsibilities

| Responsibility | Job to be done |
|---|---|
| Performer | Be accountable for the organization that performed the work |
| Progress recorder | Record measured performed quantity |
| Evidence recorder | Capture or upload evidence and provenance |
| Evidence custodian | Maintain the authoritative original and correction chain |
| Requirement owner | Define or assign the evidence obligations |
| Package compiler | Assemble ready scope into a package draft |
| Internal verifier | Decide whether exact evidence/requirements are ready |
| Package submitter | Freeze and send the exact package version |
| Acceptance liaison | Coordinate returns and external review |
| Commercial observer | Inspect quantity/value exposure without deciding acceptance |

One member may combine responsibilities in v0.1. Sensitive combinations are
visible in audit and UI warnings. They do not create an artificial hard stop for
a small pilot team.

## External actors

### Customer reviewer

Reviews the contractual quantity/value scope assigned by an approval
requirement. The reviewer may accept or return exact claim segments and record
issues.

### Technical-supervision reviewer

Reviews technical evidence and, when policy requires, quantity scope. Technical
evidence decisions are separate from monetary quantity decisions.

### Observer

Can inspect the exact submitted package version but cannot submit a decision.

External reviewers are not workspace members. They use a protected personal
email link and short session. Possession of the link is access assurance, not
verified legal identity.

## System actors

System workers may:

- parse import files;
- generate immutable artifacts;
- project readiness, acceptance, and value at risk;
- claim and deliver messages;
- retry jobs and move exhausted work to dead letters;
- record audit and delivery evidence.

A system actor cannot invent a human acceptance decision. Automated results
must identify their input version and algorithm/renderer version.

## End-to-end workflow 0: Workspace and multi-entity setup

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
7. Published contract versions pin the correct own/customer party snapshots.

**Completion evidence:** tenant-isolation tests and one working scenario prove
that a project can hold two contracts for different own legal entities without
crossing party, access, or contract boundaries.

## End-to-end workflow 1: Contract import

**Primary actors:** admin or authorized contract editor, package compiler.

1. User creates a project and chooses the contract's own and customer parties.
2. User uploads XLSX or CSV.
3. GoProceed stores file hash and immutable source provenance without executing
   formulas or macros.
4. User maps columns for this import and reviews every inferred normalization.
5. Parser shows raw values, normalized values, warnings, and blocking errors per
   source row.
6. User fixes the source or mapping and reruns validation.
7. User explicitly publishes a contract version.
8. GoProceed freezes party/currency/tax/terms snapshots and work items.
9. A later reimport produces a new version, diff, and row lineage; it never
   edits the published version.

**Completion evidence:** published version can reproduce each work row from its
file, sheet, row, parser version, and mapping version.

## End-to-end workflow 2: Assignment and online capture

**Primary actors:** progress recorder, evidence recorder, performer.

1. Authorized member creates an operational assignment from contract work.
2. Assignment may select location, performer party, planned quantity, member,
   due date, and requirement-template version.
3. Recorder adds an append-only performed-quantity entry.
4. Evidence recorder uses the Expo/React Native `apps/mobile` client on a
   supported iOS or Android device to capture a photo or select a platform
   photo/file while connected and currently authorized.
5. The local original remains present while upload is not confirmed.
6. UI distinguishes not sent, sending, server-confirmed, and failed.
7. A connection failure retries the whole upload with the same idempotency key.
8. The pending original and retry state survive an ordinary app restart.
9. Local cleanup becomes eligible only after server receipt, content hash, and
   integrity confirmation.
10. Corrections reference the original progress or evidence fact.

**Completion evidence:** a server-confirmed evidence object retains hash,
provenance, claimed capture time, receipt time, recorder, source party, and
custodian. The scenario passes on at least one supported iPhone and one
lower-resource supported Android device.

## End-to-end workflow 3: Requirement and internal review

**Primary actors:** requirement owner, evidence recorder, internal verifier.

1. Published requirement template creates concrete occurrences for assignment
   and quantity/location scope.
2. Recorder links one or more evidence objects to each occurrence.
3. Verifier reviews exact evidence/occurrence facts.
4. Accept, return, waiver, not-applicable, and accept-risk actions create
   append-only decisions or exceptions.
5. A correction supersedes a prior decision; it does not mutate history.
6. GoProceed derives current readiness for homogeneous scope and explains each
   blocker.

**Completion evidence:** every ready or blocked state resolves to exact current
facts and no queue/status row acts as an independent authority.

## End-to-end workflow 4: Package freeze and submission

**Primary actors:** package compiler, internal verifier, package submitter.

1. Compiler selects ready progress for one contract, package series, and period.
2. GoProceed prevents overclaim and creates homogeneous package lines and claim
   segments linked to exact progress sources.
3. Compiler selects a versioned package template and approval policy.
4. Internal checks show missing, conflicting, or out-of-scope inputs.
5. Submitter freezes the version.
6. Frozen contents pin contract/version, party snapshots, sources, requirements,
   reviews, evidence hashes, approval requirements, template, and renderer.
7. PDF, XLSX, ZIP, and manifest artifacts derive from the same snapshot and
   cannot be overwritten.
8. Submitter creates a submission and personal grants for required reviewers
   and observers.

**Completion evidence:** package manifest deterministically identifies every
material input and artifact.

## End-to-end workflow 5: Multi-party partial acceptance

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
7. Quantity acceptance requires acceptance from every required quantity
   approver covering the same segment.
8. Return from any required quantity approver blocks that segment; unaddressed
   scope remains pending.
9. Evidence return records a compliance issue but has no automatic monetary
   effect.

**Completion evidence:** every current acceptance outcome is reproducible from
exact grants, requirements, sessions, batches, and segment decisions.

## End-to-end workflow 6: Return, correction, and resubmission

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

**Completion evidence:** no decision is copied between versions and every prior
acceptance reference verifies unchanged material scope.

## End-to-end workflow 7: Value-at-risk explanation

**Primary actors:** commercial observer, acceptance liaison, management.

1. GoProceed assigns each exact segment to one disjoint state by precedence.
2. Quantity value uses the pinned contract price, currency, tax basis,
   precision, and rounding policy.
3. Project totals remain grouped by currency.
4. User drills from state total to contract, package, line, segment, and blocker.
5. Missing price, zero price, and over-contract performance appear separately.
6. No user edits the aggregate to make it match an expected number; corrections
   occur at the authoritative source fact.

**Completion evidence:** every displayed amount reconciles to its segment facts
and rounded children reconcile to the canonical line total.

## Workflow ownership rule

Job titles may preselect responsibilities in the UI, but only explicit
workspace role, project access, responsibility assignment, approval
requirement, or external grant authorizes an action.
