# Package review, 2026-08-04

**Status:** Draft

**Applies to:** all

**Last reviewed:** 2026-08-06

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md),
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](../decisions/ADR-007-pilot-field-client.md)

> **Authority note.** This is a review record, not a design authority. It changes
> nothing on its own. Findings that require a scope or boundary change name the
> ADR that would have to carry it.
>
> **Its numbers are frozen at 2026-08-04 and several have since moved.** This
> document is a dated measurement, not a live status page, and it is cited as
> evidence elsewhere on that understanding. As of 2026-08-06 the branch holds
> **40** migrations (not 35), and the v0.1 route set is **58** operations in
> `technical/openapi/scope-v0.1.csv` (not 51) with a further **22** in
> `technical/openapi/scope-v0.2.csv`: the ADR-005 rebuild grew it, and the
> [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) re-cut then moved the
> commercial half out. **Every "v0.1" in this document means the pre-re-cut
> v0.1.** Its §2 loop table, its §8 ordering and its §6 over-engineering
> register all treat internal review, packages, claim segments, external
> decision batches, acceptance and value at risk as v0.1 work; ADR-006 makes
> them v0.2 ([version-0.2.md](version-0.2.md)), and
> [ADR-007](../decisions/ADR-007-pilot-field-client.md) makes the v0.1 field
> client a PWA, so §7 item 2's "online-only capture" is now a deliberate v0.1
> property rather than an under-engineering finding. The findings themselves
> stand except where a later document records them closed; for current counts
> read [README.md](../../README.md) and the catalogs themselves.

## Method

Twelve independent readers covered `docs/product`, `docs/domain`,
`docs/architecture`, `docs/delivery` + `docs/decisions` + `docs/discovery`,
`technical/`, `docs/legacy`, `supabase/migrations`, the `apps/app` v1 API surface
with `packages/*`, the user-facing surfaces, and tests/CI; two further readers
re-derived every cross-layer claim from primary files. 230 findings: 38 critical,
70 high, 70 medium, 52 low.

## 1. What GoProceed is today

A 33-table PostgreSQL foundation across 35 migrations, with the first half of the
v0.1 chain implemented to a genuinely high standard — tenant-safe composite
foreign keys, append-only enforced by `BEFORE UPDATE OR DELETE` triggers that
fire for the table owner too, serialized allocation heads, a service principal
that owns the storage verdict — and the second half absent entirely. Contract
baseline, XLSX/CSV import with full provenance, assignments, an append-only
progress ledger with monetary allocation, and evidence upload with server-verified
hash and custody all work. Requirements exist only as a template table with no
way to instantiate one. Internal review, packages, claim segments, external
grants, decisions, acceptance and value at risk have no tables at all.

Zero customer validation: 21 evidenced sends, 0 replies, 0 interviews, 0 named
projects, 0 pilot commitments, 0 willingness-to-pay signals
([validated-assumptions.md:38](../discovery/validated-assumptions.md)).

## 2. Implementation reality against the v0.1 loop

| Stage | State | Evidence |
|---|---|---|
| Contract baseline, versions, import | Implemented | migrations 0012–0014; 21 M1 operations |
| Assignment + performed quantity | Implemented | 0015, 0017, 0022, 0025; progress + allocation routes |
| Evidence capture and custody | Implemented (server half) | 0015, 0018, 0023, 0029–0035; upload intents, finalize |
| Requirements and occurrences | **Template table only** | `requirement_template_versions` exists; `requirement_occurrences` absent from all 35 migrations |
| Internal review | **Absent** | no `review_target_sets`, `internal_review_decisions`, `internal_review_heads` |
| Immutable package version | **Absent** | no `packages`, `package_versions`, `package_lines`, `claim_segments` |
| Protected external review | **Absent** | no `external_access_grants`, `external_sessions`, `decision_batches` |
| Acceptance and value at risk | **Absent** | projections with no source facts |

Roughly 30 of the 51 catalogued v0.1 operations are unimplemented. The design
defines 70 tables; 33 exist, and the 37 missing are contiguous — exactly the
second half of the chain.

## 3. The gate: designed, specified across seven artifacts, deleted without an ADR

The owner's sharpened thesis (2026-08-04) is that a work line knows its mandatory
evidence in advance; until that evidence is obtained and agreed, the hidden stage
cannot be closed and the work cannot enter the acceptance/payment package.

A case-insensitive search for `conceal|прихован|hold point|witness|ITP` returns
**zero** across fourteen directories: all six canonical doc directories, all six
`technical/` v0.1 catalog subdirectories, all 35 migrations, `apps/app`, and
`packages/`.

The same search returns hits in twelve legacy `technical/` flat files, which
specify the mechanism more completely than anything in the canonical package:

| Object | Location |
|---|---|
| `timing` CHECK with five values incl. `before_concealment` | `technical/schema.sql:480` |
| `hold_point_required` | `technical/schema.sql:486` |
| `work_item_requirements` — requirements bound to the estimate line | `technical/schema.sql:452` |
| `rule_assignments` with `subject_type` and effective dating | `technical/schema.sql:2152` |
| `hold_point_decisions` — pass / pass_with_notes / failed, with SoD | `technical/schema.sql:988` |
| `concealment_events` — append-only closure, double-covering unrepresentable | `technical/schema.sql:1005` |
| `HOLD_POINT_BLOCKED` (409) | `technical/error-catalog.csv:95` |
| `hold_point.decide` capability | `technical/permissions.csv:67` |
| occurrence state machine with guarded closure | `technical/state-transitions.csv:235-241` |
| screen `S40 — Hold point` | `docs/legacy/04-screen-specification.md:373` |
| deterministic readiness algorithm, lowest-state-wins | `docs/legacy/38-business-logic-closure.md` §8 |

No ADR records the removal. `document-disposition.csv` marks the four documents
carrying the thesis (02, 37, 38, 39) `archive`, which `docs/legacy/README.md`
defines as "reviewed and nothing in it was worth keeping".

### Distance, clause by clause

| Clause | What exists | What is missing |
|---|---|---|
| Requirement known in advance | `work_assignments.requirement_template_version_id`, **nullable**, at most one per assignment; `work_items` has 30 columns and no requirement column | Binding at work-item/work-type level; a rule/scoping model; set-valued requirements |
| Blocking | `readiness` classified `Projection \| Recomputed`; none of 60 invariants gates a command on evidence | A written readiness predicate and at least two invariants. No new storage needed |
| Closure event | `assignment: active→completed` in the transition catalog, guarded by a capability, with no operation, no route, no writer | The event itself, with timestamp and approver |
| Package inclusion | Sole freeze precondition is approver coverage (INV-034). Compilation "selects ready progress" — a filter, not a refusal | An eligibility predicate that makes freeze fail |
| Inspector call-out | Nothing in either generation; legacy has only `witness_label text` | Notice object, notice period, delivery proof |

### Three findings more serious than the gate's absence

1. **The pipeline runs in the opposite order.** `progress.record` inserts the
   entry, opens the allocation head and carves real minor units out of the
   work-item pool. The words `evidence`, `requirement`, `occurrence` and
   `readiness` do not appear in the file
   ([progress/route.ts:74-90](../../apps/app/app/v1/assignments/[assignmentId]/progress/route.ts)).
   `vertical-m2a.int.test.ts:98` makes the ordering explicit: money at step 3,
   evidence at step 4.
2. **The VaR precedence specifies what to report after unready scope is
   packaged.** States are disjoint, first match wins; `packaged_not_submitted` is
   rank 4 and `evidence_blocked` is rank 6
   ([value-at-risk.md:161](../domain/value-at-risk.md)). A precedence rule between
   two states asserts the combination is reachable.
3. **The socket exists and is wired to nothing.** `severity in
   ('blocking','advisory')` (0015:46) and `multiplicity` are frozen into a sha256
   template hash at publish and read by no code. The only runtime effect of a
   published template is a MIME allowlist. `timing` degraded from a five-value
   CHECK to `jsonb not null default '{}'` with no constraint.

## 4. Correctness and operations register

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | Critical | `README.md:29` "Nothing of the v0.1 domain is implemented yet" is false — 26 of 35 migrations carry `v0.1-M1`/`v0.1-M2-A` headers | README.md:22-29 vs 0010:1, 0012:1, 0015:1 |
| 2 | High | `outbox_dead_letters` is the only table without RLS, is tenant-owned, and grants `select` to `aktflow_worker` (`nobypassrls`). Two risk lists name three protected tables and omit this one | 0008:14-16, :35; tenancy-and-security.md:297 |
| 3 | High | The 30-second `outbox-drain` cron marks every row delivered, defeating the claim/lease protocol of 0008. No migration unschedules it | 0005:37-47, :91 vs 0008:46-48 |
| 4 | High | The purge worker's three functions are granted to no role; the only caller is a test file, while `files-and-storage.md:226` states the 24-hour purge as operative and verified | 0021:108-111; no matching `grant execute` in any migration |
| 5 | High | `organizations` has an UPDATE grant and no UPDATE policy, so the quota (0026) and retention (0027) columns cannot be set by the product at all | 0003:57 vs 0004 (only `org_select`, `org_insert`) |
| 6 | High | README's "143/165 tests" is retracted three times inside the file it cites as evidence, which records 196/196 green | README.md:30-34 vs baseline-verification.md:149 |
| 7 | High | Two architecture documents list four security controls as open blockers within a dozen lines of correctly citing the snapshot that shows them delivered by 0006 and 0009 | data-model.md:54-57; tenancy-and-security.md:36-46 |
| 8 | High | Precedence level 3 assigns source-of-truth authority to a canonical OpenAPI contract that does not exist — `technical/openapi/` holds a README and a scope CSV with no schemas | docs/README.md:34-35 |
| 9 | High | `version-0.1.md` per-milestone operation counts disagree with the catalog it declares authoritative on three of six milestones | version-0.1.md:53, :75, :118 vs scope-v0.1.csv |
| 10 | Medium | A service-principal authority entered architecture and migrations with no ADR and no ADR-002 amendment | 0034:25,28; ADR-002:57-62 |
| 11 | Medium | `audit_events.project_id` still has no FK five migrations after `public.projects` was created, with the exact ALTER left as an instruction in the file | 0002:11-14; 0010:137 |
| 12 | Medium | The reservation mechanism — the hinge between quantity and a payment package — has columns, checks and readers but no writer outside tests | 0015:171-184 |
| 13 | Medium | v0.0 is formally open by its own exit rule (staging password verification) while 26 v0.1 migrations have landed, against the roadmap's sequencing rule | version-0.0.md:78-79; roadmap.md:16-17 |
| 14 | Medium | `supabase/functions/outbox-drain` is counted in the certified green baseline but is not a workspace member, so `turbo run test` never reaches it | vitest.workspace.ts:13; pnpm-workspace.yaml:1-3 |
| 15 | Low | `packages/domain` (10 test files) and `packages/contracts` are absent from the root vitest workspace | vitest.workspace.ts:9-14 |

Where implementation and target design disagree, the implementation is repeatedly
the stronger artifact and says so in writing (0015:5-11, 0017, 0021, 0023:35) —
the inverse of the documented precedence, and worth recording as a strength.

## 5. Legacy value that has no canonical successor

Deleting `docs/legacy` today would lose, with no other copy in the repository:
the hold-point and concealment model above; all Ukrainian statutory and
regulatory content including the electronic-signature assurance ladder (legacy
24); the entire competitive map and the only market sizing with its KVED
replacement instruction and wartime scenario correction (legacy 02, 40); the only
pricing document with plan table, pilot economics and kill criteria (legacy 10);
the deterministic readiness algorithm (legacy 38 §8); and the mobile deep-link
contract (legacy 04). The canonical docs contain exactly two Ukraine-specific
tokens (EDRPOU, twice) and cite no Ukrainian regulation at all.

## 6. Over-engineering register

- `jobs-events-and-audit.md` prescribes a nine-record-type job runtime with lease
  fences and replay generations that the codebase has deliberately rejected; the
  document should record what was built, or the divergence should carry an ADR.
- The decision-coverage and partition machinery in `packages-and-acceptance.md`
  is designed for reviewer-order independence across arbitrary partial partitions
  — correct, and far ahead of any evidence that a pilot needs it.
- The canonical documentation is ~6.6k lines with ~11k lines of legacy behind it,
  governing a product with zero customer conversations. The governance system is
  genuinely good; its volume is now itself a source of drift, and this review
  found nine stale cross-layer claims inside documents marked `Approved`.

## 7. Under-engineering register — what a pilot hits first

1. No way to instantiate a requirement, so no evidence obligation can be recorded.
2. Online-only capture, in a workflow whose defining moment is a basement or a
   riser immediately before covering.
3. The whole loop depends on the general contractor opening a link and deciding
   inside the subcontractor's tool, with no evidence that any will.
4. Nothing produces a document a Ukrainian technical supervisor recognises.
5. The purge worker runs nowhere, so storage is never returned.

## 8. Honest distance to a first paying pilot

Named work items, in order: (1) close the v0.0 staging gate; (2) fix the register
in section 4; (3) decide the gate as a boundary change and record it in an ADR;
(4) requirement occurrences, evidence links, exceptions and a written readiness
predicate; (5) internal review; (6) packages, lines and claim segments with an
eligibility precondition on freeze; (7) statutory act generation; (8) external
access and decisions; (9) acceptance and VaR projections; (10) offline capture.

Items 4–9 are M3–M6 and are approximately the same size as everything built so
far. Before any of it: the discovery ledger has no evidence at all, and
[competitive-landscape.md](../product/competitive-landscape.md) §8 lists ten
decisions that only the owner can make.
