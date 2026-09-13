# The pre-2026-09-13 slice archive

**Historical archive, frozen on 2026-09-13.** Nothing in this directory is moved, renamed or rewritten, and no file is added to `specs/`, `plans/` or `plans/evidence/`. Applied migrations, catalogs and code comments cite these files by path and line, so a move or an edit would break a record that cannot itself be changed.

New work is recorded elsewhere:

- design specs: [docs/specs/](../specs/README.md);
- task records, findings and acceptance evidence: [docs/tasks/](../tasks/README.md);
- the current state of the product: [docs/STATUS.md](../STATUS.md).

## What is here

| Directory | Contents |
|---|---|
| `specs/` | 22 design specs, 2026-07-24 to 2026-09-06 |
| `plans/` | 40 implementation plans and one handoff (`HANDOFF-dashboard-rewrite.md`) |
| `plans/evidence/` | 12 gate records (`*-gate.md`) and their companions: two notes, seven screenshots, and the `2026-09-06-landing-parity/` screenshot directory |

## What each spec became

A spec's own Status line was written when the spec was, and several were never updated. This table records the outcome observed on 2026-09-13 without editing any spec. «Outcome» is one of: Implemented, Partly implemented, Superseded, Documentation slice (a docs change that landed). Evidence is a merge on `main`, a gate record under `plans/evidence/`, or the superseding document.

| Spec | Status as written | Outcome | Evidence | Note |
|---|---|---|---|---|
| `2026-07-24-p0a-foundation-design.md` | «approved design» (Russian) | Partly implemented | Sub-slice 1 committed to `main` without a PR, 2026-07-24/25 (migrations `0001`–`0005`) | Sub-slices 2–4 were never built under this spec; the canonical design replaced its assumptions |
| `2026-07-29-goproceed-baseline-zero-design.md` | «approved design» (Russian) | Superseded | `specs/2026-07-30-goproceed-canonical-design.md`:7 | None of its plans ran |
| `2026-07-30-goproceed-canonical-design.md` | Approved, 2026-07-30 | Implemented | #3 (2026-07-30) | ADR-006 later re-cut its v0.1 milestones |
| `2026-07-31-goproceed-v0.1-m2a-execution-evidence-design.md` | Approved for planning | Implemented | #5 (2026-07-31); `plans/evidence/2026-07-31-m2a-gate.md` | The gate record keeps the M2 milestone open; the status line names no approver |
| `2026-08-01-goproceed-v0.1-m2-b0-foundations-design.md` | none | Implemented | #7 (2026-08-03); `plans/evidence/2026-08-01-b0-gate.md` | The device install is recorded as not done |
| `2026-08-01-goproceed-v0.1-m2-service-principal-design.md` | none | Implemented | #6 (2026-08-02); `plans/evidence/2026-08-01-service-principal-gate.md` | No approval record found |
| `2026-08-03-docs-slice0-truth-design.md` | none | Documentation slice | #8 (2026-08-04); `plans/evidence/2026-08-03-docs-slice0-gate.md` | — |
| `2026-08-03-docs-slice1-gate-design.md` | none | Documentation slice | #8; `plans/evidence/2026-08-03-docs-slice1-gate.md` | Also changed the package validator and CI |
| `2026-08-03-docs-slice2-archive-design.md` | none | Documentation slice | #8; `plans/evidence/2026-08-03-docs-slice2-gate.md` | Moved 34 documents to `docs/legacy/` |
| `2026-08-03-rename-slice3-packages-design.md` | none | Implemented | #8; `plans/evidence/2026-08-03-rename-slice3-gate.md` | The gate record, not the spec, holds the correct counts |
| `2026-08-10-pwa-field-client-design.md` | Approved by the owner, 2026-08-10 | Implemented | #14 (2026-08-17); follow-ups #16, #41–#43 | ADR-009 and ADR-011 amend ADR-007, which this spec implements |
| `2026-08-20-landing-site-design.md` | Approved in chat, 2026-08-20 | Superseded | Built without a PR, 2026-08-20; replaced by `specs/2026-08-25-landing-redesign-design.md` | Its product-truth and accessibility rules stayed binding on the redesign |
| `2026-08-22-evidence-read-design.md` | Approved by the owner, 2026-08-22 | Implemented | #46 (2026-08-23) | — |
| `2026-08-24-project-sourced-requirements-design.md` | Draft, awaiting owner review | Implemented | #51 (2026-08-27) | Status never updated; the owner's decision is recorded in [ADR-010](../decisions/ADR-010-project-sourced-requirements.md) |
| `2026-08-25-landing-redesign-design.md` | Approved direction in chat, 2026-08-25; written review pending | Superseded | Built in #53 (2026-08-28); replaced by `specs/2026-09-05-landing-daylight-design.md` | The written review was never recorded |
| `2026-08-28-assignment-creation-design.md` | Draft, awaiting owner review | Implemented | #54 (2026-08-29) | Status never updated; owner confirmations are in the spec body and ADR-009's 2026-08-28 amendment |
| `2026-08-28-telegram-project-channel-design.md` | Approved by the owner in conversation, 2026-08-28 | Implemented | #58 (2026-09-03); fixes #68, #69; card tag #78 (2026-09-13) | [ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md) cites this Status line as the only record of the approval |
| `2026-08-30-landing-motion-vocabulary-design.md` | Approved 2026-08-30 | Implemented | #55 (2026-08-31) | — |
| `2026-09-02-telegram-identity-erasure-design.md` | Approved by the owner in conversation | Implemented | #65, reaching `main` in #58 (2026-09-03); `plans/evidence/2026-09-03-telegram-identity-erasure-gate.md` | Shipped inert: retention durations are NULL |
| `2026-09-05-app-daylight-migration-design.md` | Draft for owner review, 2026-09-05 | Implemented | #72 (2026-09-05); `plans/evidence/2026-09-05-app-daylight-gate.md` | Status never updated; owner decisions are in the spec's §1. The `apps/mobile` half was deferred |
| `2026-09-05-landing-daylight-design.md` | Approved by the owner, 2026-09-05 | Implemented | #71 (2026-09-05); `plans/evidence/2026-09-05-landing-daylight-gate.md` | The parity spec reversed its decision D4 |
| `2026-09-06-landing-prototype-parity-design.md` | Approved by the owner, 2026-09-06 | Implemented | #73 (2026-09-06); follow-ups #74, #75, #77; `plans/evidence/2026-09-06-landing-parity-gate.md` | #77 narrowed ruling R2 on the owner's call; the spec was not corrected |

Counts: 15 Implemented, 1 Partly implemented, 3 Superseded, 3 Documentation slice.

PR numbers are GitHub pull requests on `akisly/go-proceed`. The table was assembled on 2026-09-13 by a read-only subagent from `git log`, the merged pull requests and the gate records, and spot-checked by the coordinator ([DEV-004](../tasks/DEV-004-status-layer.md)).
