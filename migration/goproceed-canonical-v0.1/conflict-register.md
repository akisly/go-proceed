# Canonical conflict register

**Status:** Active resolution ledger

**Applies to:** v0.0 and v0.1 rewrite
**Last reviewed:** 2026-07-30

| ID | Severity | Conflict | Evidence | Canonical resolution | Decision status | Implementation status |
|---|---|---|---|---|---|---|
| C-001 | P0 | Runtime has six tables while target docs describe 126 as one early platform. | Migrations `0001`–`0005`; `technical/schema.sql` | Runtime foundation and target v0.1 are documented separately. | Resolution approved | Pending |
| C-002 | P0 | Audit and idempotency rows are readable across tenants by the app DB role. | Grants in `0003`; RLS only in `0004` for three tables | v0.0 adds tenant isolation before domain expansion. | Resolution approved | Pending |
| C-003 | P0 | Outbox permits cross-tenant insert and marks work processed without delivery. | `0003`, `0005`, drain function | Tenant-bound write plus claim/retry/error/backoff/dead-letter delivery. | Resolution approved | Pending |
| C-004 | P0 | Known development role password can enter an unsafe environment. | `supabase/seed.sql`, seed config | Environment-safe secrets and explicit non-production seed path. | Resolution approved | Pending |
| C-005 | P1 | Workspace duplicates legal name and EDRPOU from the initial legal entity. | `0001_core_tenancy.sql`; organization builder dual-write | Workspace display identity; tenant-local parties and own legal profile hold legal data. | Resolution approved | Pending |
| C-006 | P1 | Legacy pilot assumes one legal entity. | `docs/19-organizations-roles-access.md` | Multi-own-entity workspace; own party selected on each contract. | Resolution approved | Pending |
| C-007 | P1 | Project and contract store free-text customer names alongside party concepts. | `technical/schema.sql` project/contract fields | Tenant-local parties and immutable published party snapshots. | Resolution approved | Pending |
| C-008 | P1 | Contract does not identify both own and customer parties. | Legacy contract table | Required `own_party_id` and `customer_party_id`, with own-party constraint. | Resolution approved | Pending |
| C-009 | P1 | One membership contains one rigid role and mixes governance with job titles. | Runtime role enum; legacy persona/permission docs | Four governance roles plus independent project access and responsibility assignments. | Resolution approved | Pending |
| C-010 | P1 | Any active member may insert legal entities. | Current RLS policy | Permission-aware own-party management. | Resolution approved | Pending |
| C-011 | P1 | Concurrent actors can race to claim a membershipless organization. | Bootstrap policy and check-then-insert flow | Serialized bootstrap and owner invariants. | Resolution approved | Pending |
| C-012 | P1 | Online capture requires an offline authorization lease. | Legacy `capture_sessions.authorization_lease_id` | Online current authorization in v0.1; offline lease only in v0.3. | Resolution approved | Pending |
| C-013 | P1 | Work assignment requires one user and due date. | Legacy work assignment table | Performer party allowed; assignee and due date optional. | Resolution approved | Pending |
| C-014 | P1 | Requirements and readiness have multiple authoritative states. | Work requirement, occurrence, evaluation, snapshot tables | Append-only facts; current readiness projection only. | Resolution approved | Pending |
| C-015 | P1 | Waiver is represented both as review decision and independent object. | Legacy review/waiver tables | Requirement exception is the single waiver/not-applicable/accept-risk fact. | Resolution approved | Pending |
| C-016 | P0 | Legacy external decision is package-level and cannot represent partial line/evidence outcomes. | Legacy external decision schema | Decision batches with separate claim-segment quantity and evidence decisions. | Resolution approved | Pending |
| C-017 | P0 | Aggregate multi-approver quantities do not identify the same physical/acceptance portion. | Independent design review | Acceptance-homogeneous lines and exact claim segments. | Resolution approved | Pending |
| C-018 | P0 | Copying prior acceptance to a new version would misstate what was reviewed. | Exact-version decision rule | Keep v1 decision; v2 references unchanged prior acceptance after scope-hash match. | Resolution approved | Pending |
| C-019 | P0 | Protected link design omitted a durable external session. | Independent design review | Grant plus explicit POST exchange and revocable short session. | Resolution approved | Pending |
| C-020 | P1 | One returned evidence object could silently change accepted money. | Mixed external decision model | Evidence and quantity decisions are separate; financial change is explicit. | Resolution approved | Pending |
| C-021 | P1 | Project-wide periods and uniqueness do not support multiple contracts cleanly. | Legacy reporting-period constraints | Package belongs to one contract; period/series policy is contract-scoped. | Resolution approved | Pending |
| C-022 | P1 | Readiness `lowest-wins` can block the value of an entire work item. | Legacy state-machine rule | Readiness and acceptance operate on homogeneous quantity/location claim segments. | Resolution approved | Pending |
| C-023 | P1 | VaR lacks currency, tax, rounding, and over-contract rules. | Legacy analytics and decision totals | Per-currency projection, explicit tax/precision/rounding, separate excess exposure. | Resolution approved | Pending |
| C-024 | P1 | Published content is called immutable while mutable lifecycle flags remain on the same rows. | Legacy work items and package models | Immutable contents are separated from lifecycle projections/events and enforced in DB. | Resolution approved | Pending |
| C-025 | P1 | Import lacks exact provenance and malicious-file limits. | Legacy import model | File hash, parser/mapping version, raw row lineage, limits, no formula/macro execution. | Resolution approved | Pending |
| C-026 | P1 | Existing audit hashes are unused and manual calls can be bypassed. | Runtime audit table/helper | Append-only enforcement and complete command coverage; audit is not domain reconstruction. | Resolution approved | Pending |
| C-027 | P1 | Idempotency expiry and states are not implemented coherently. | Runtime idempotency helper | Bounded keys, expiry/purge, explicit replay state machine. | Resolution approved | Pending |
| C-028 | P1 | Legacy target mixes finance, SaaS billing, support, integrations, and offline into pilot. | Schema, OpenAPI, backlog, roadmap | Defer those contexts and keep only explicit extension boundaries. | Resolution approved | Pending |
| C-029 | P1 | Adapter/template extension is described but not versioned coherently. | Legacy adapter docs and free-text package fields | Versioned immutable requirement/package templates with hashes and renderer version. | Resolution approved | Pending |
| C-030 | P1 | Discovery documents can overstate validation and send volume. | 50-row workbook; 22-row queue with 21 marked sent | Separate mapped leads, evidenced sends, founder report, replies, artifacts, and pilot commitment. | Resolution approved | Pending |
| C-031 | P1 | Baseline cannot run green in the isolated worktree. | Vitest and pnpm verification on 2026-07-30 | v0.0 resolves local Supabase/env, demo alias, and build-script policy. | Resolution approved | Pending |
| C-032 | P1 | Privacy/retention was deferred too late for evidence and external contact data. | Independent design review | Minimum policy, export, deletion, and restore gate before pilot data. | Resolution approved | Pending |
| C-033 | P1 | Internal review, external response, package decision sets, and acceptance records compete as authorities for one business outcome. | Legacy `review_decisions`, `package_decision_sets`, `external_decisions`, and `acceptance_records` | Internal review governs evidence readiness; immutable external decision batches govern external outcomes; current acceptance is a projection from exact quantity decisions. | Resolution approved | Pending |
