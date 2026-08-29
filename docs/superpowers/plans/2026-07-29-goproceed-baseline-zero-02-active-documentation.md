# GoProceed Baseline 0 — Active Documentation Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the contradictory flat documentation package with a small active GoProceed documentation layer, a compact feature registry, and a completed migration ledger while keeping all legacy sources available for review.

**Architecture:** Draft every active document under `migration/baseline-0/drafts/`, validate it against the approved design and source ledger, then promote it to `docs/current/` only after the thematic source group has no `UNREVIEWED` rows. Active docs describe current truth and approved near-term boundaries; detailed legacy contracts remain reference material until Plan 03 moves or deletes them.

**Tech Stack:** Markdown, YAML 1.2 via `yaml`, Node.js 24, pnpm 9.12.0, Node test runner, existing migration validator.

## Global Constraints

- GoProceed is the public brand; technical `aktflow` identifiers remain unchanged.
- `apps/landing`, `apps/app`, planned `apps/mobile`, and temporary `apps/demo` have separate responsibilities.
- `0.1.0` includes concierge web plus online mobile; offline is `0.3.0`.
- Development of the universal evidence core does not wait for a private end-to-end package.
- Worker, evidence owner, package assembler, reviewer, and submitter are separate actor capabilities.
- KB-2v, KB-3, hidden-work acts, and customer formats are versioned templates, not core database tables.
- Public sources inform fixtures and hypotheses; they do not prove legal acceptance or payment.
- Do not edit auth, RLS, grants, migrations, or production API behavior.
- Do not delete or physically move legacy sources in this plan.
- No private outreach data may enter Git.

---

## File Structure

```text
docs/
├── README.md
├── current/
│   ├── PRODUCT.md
│   ├── STATUS.md
│   ├── ROADMAP.md
│   ├── ARCHITECTURE.md
│   ├── DELIVERY.md
│   └── VALIDATION.md
├── decisions/
│   ├── ADR-0001-public-brand-goproceed.md
│   ├── ADR-0002-product-surfaces.md
│   ├── ADR-0003-v010-online-mobile.md
│   ├── ADR-0004-offline-v030.md
│   └── ADR-0005-demo-route-boundary.md
├── releases/
│   └── README.md
└── reference/
    └── README.md

spec/
└── features.yaml

migration/baseline-0/
├── drafts/
│   ├── current/
│   └── decisions/
├── migration-ledger.csv
└── reports/
    ├── product-discovery-audit.md
    ├── data-security-audit.md
    └── qa-design-operations-audit.md
```

### Task 1: Extend the validator for active documentation and feature metadata

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/baseline-migration.mjs`
- Modify: `scripts/baseline-migration.test.mjs`
- Create: `migration/baseline-0/drafts/current/.gitkeep`
- Create: `migration/baseline-0/drafts/decisions/.gitkeep`

**Interfaces:**
- Consumes: Markdown front matter and `spec/features.yaml`.
- Produces:
  - `validateActiveDocument(path, text): string[]`
  - `validateFeatureRegistry(registry): string[]`
  - `pnpm verify:docs`

- [ ] **Step 1: Add failing tests**

Add:

```js
test("active docs require title, status, applies_to, last_reviewed, and owner", () => {
  const text = "# Product\\n\\nstatus: active\\n";
  assert.deepEqual(validateActiveDocument("docs/current/PRODUCT.md", text), [
    "docs/current/PRODUCT.md: missing metadata applies_to",
    "docs/current/PRODUCT.md: missing metadata last_reviewed",
    "docs/current/PRODUCT.md: missing metadata owner",
  ]);
});

test("stable features require release and evidence", () => {
  const registry = {
    features: [{
      id: "GPR-FOUND-001",
      name: "Tenancy foundation",
      user_outcome: "An authenticated user can create and read their organization",
      status: "stable",
      target_release: "",
      evidence: [],
      dependencies: [],
      feature_flag: "none",
      data_api_impact: "existing",
      acceptance: ["organization create succeeds"],
      decision: "docs/decisions/ADR-0002-product-surfaces.md",
      last_updated: "2026-07-29",
    }],
  };
  assert.deepEqual(validateFeatureRegistry(registry), [
    "feature GPR-FOUND-001: stable requires target_release",
    "feature GPR-FOUND-001: stable requires evidence",
  ]);
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test scripts/baseline-migration.test.mjs
```

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Add YAML support and validators**

Install:

```bash
pnpm add -D yaml@2.8.1
```

Implement the two exports. Allowed feature statuses:

```text
hypothesis
validated
planned
building
beta
stable
deprecated
removed
deferred
rejected
```

Require unique IDs matching:

```regex
^GPR-[A-Z]+-[0-9]{3}$
```

Require every active document to contain:

```markdown
status: active
applies_to: <version or Baseline 0>
last_reviewed: YYYY-MM-DD
owner: founder
```

Add:

```json
"verify:docs": "node scripts/baseline-migration.mjs --check-active"
```

`--check-active` validates every active document and registry that currently
exists, but does not require the full final file set. The later `--check-final`
gate requires all six active documents, all five ADRs, and the feature
registry.

- [ ] **Step 4: Run tests and commit**

```bash
node --test scripts/baseline-migration.test.mjs
pnpm verify:migration
pnpm verify:docs
```

Expected: PASS.

```bash
git add package.json pnpm-lock.yaml scripts migration/baseline-0/drafts
git commit -m "test: define active documentation contracts"
```

### Task 2: Create the documentation map and approved ADRs

**Files:**
- Modify: `README.md`
- Create: `migration/baseline-0/drafts/decisions/ADR-0001-public-brand-goproceed.md`
- Create: `migration/baseline-0/drafts/decisions/ADR-0002-product-surfaces.md`
- Create: `migration/baseline-0/drafts/decisions/ADR-0003-v010-online-mobile.md`
- Create: `migration/baseline-0/drafts/decisions/ADR-0004-offline-v030.md`
- Create: `migration/baseline-0/drafts/decisions/ADR-0005-demo-route-boundary.md`
- Create: `docs/README.md`
- Create: `docs/releases/README.md`
- Create: `docs/reference/README.md`

**Interfaces:**
- Consumes: approved Baseline 0 design.
- Produces: immutable decision records referenced by active docs and feature registry.

- [ ] **Step 1: Write all five ADR drafts**

Every ADR contains:

```markdown
# ADR-NNNN: Title

status: accepted
date: 2026-07-29
applies_to: Baseline 0 and later
owner: founder

## Context
## Decision
## Consequences
## Rejected alternatives
## Migration or revisit trigger
```

Exact decisions:

- ADR-0001: public display name GoProceed; technical `aktflow` rename deferred.
- ADR-0002: permanent landing, production app, `0.1.0` mobile, temporary demo, legacy prototype.
- ADR-0003: Expo online mobile capture in `0.1.0`, Android-first acceptance.
- ADR-0004: durable offline/outbox/resumable sync in `0.3.0`.
- ADR-0005: public `/demo` route in `apps/app`; query parameters select scenarios only.

- [ ] **Step 2: Write the documentation map**

Rewrite the root `README.md` as a short GoProceed repository portal. It must
state the factual Baseline 0 status, explain the four product surfaces
(`apps/mobile` is planned, not present), and link to `docs/current`,
`docs/decisions`, `docs/releases`, and the legacy review notice. Remove package
size/readiness claims that are not backed by the current runtime.

`docs/README.md` must say:

- `docs/current/*` is active truth;
- `docs/decisions/*` is accepted decision history;
- `docs/releases/*` stores released evidence;
- `docs/reference/*` stores reviewed detail;
- numbered docs and `technical/` are `legacy_under_review` until Plan 03;
- completed plans are not product truth.

- [ ] **Step 3: Promote ADRs**

After cross-reading each ADR against the design specification, use
`apply_patch` to create the matching file under `docs/decisions/` with the
reviewed draft content. Do not use a bulk shell copy because promotion is the
review gate.

- [ ] **Step 4: Validate and commit**

Add the five approved ADRs to the inventory and ledger with `KEEP`.

```bash
pnpm verify:migration
git add README.md docs migration/baseline-0
git commit -m "docs: record GoProceed baseline decisions"
```

### Task 3: Rewrite the product definition

**Files:**
- Create: `migration/baseline-0/drafts/current/PRODUCT.md`
- Create: `docs/current/PRODUCT.md`
- Modify: `migration/baseline-0/migration-ledger.csv`
- Create: `migration/baseline-0/reports/product-discovery-audit.md`

**Interfaces:**
- Consumes: `docs/00`, `01`, `02`, `03`, `10`, `14`, `37`, `40`, the attached source note, and discovery evidence.
- Produces: one current product definition with hypotheses separated from invariants.

- [ ] **Step 1: Audit the product/discovery source group**

Review and record ledger decisions for:

```text
docs/00-product-brief.md
docs/01-prd.md
docs/02-market-competition.md
docs/03-personas-jtbd-workflows.md
docs/10-billing-pricing.md
docs/14-gtm-pilot.md
docs/37-functional-closure-feature-register.md
docs/40-phase1-discovery-outreach.md
migration/baseline-0/source-notes/development-can-start.md
discovery/experiments.md
discovery/sources.md
```

The audit report must list, for every source:

- retained product truth;
- hypothesis;
- rejected overconstraint;
- destination section;
- evidence gap.

- [ ] **Step 2: Write PRODUCT.md with the exact outline**

```markdown
# GoProceed Product

status: active
applies_to: Baseline 0–1.0.0
last_reviewed: 2026-07-29
owner: founder

## Product in one sentence
## Problem and economic outcome
## ICP hypothesis
## Actor capabilities
## Core workflow
## 0.1.0 promise
## 0.1.0 included scope
## Explicit exclusions
## Product principles
## Validation assumptions
## Kill or reshape signals
```

Required content:

- ICP is an initial Ukrainian specialized-contractor hypothesis, not a universal data-model invariant.
- Separate capabilities: performs work, captures evidence, owns evidence, assembles package, reviews, submits, accepts externally.
- Universal evidence/requirement/package model.
- KB-2v, KB-3, hidden-work acts, and customer packs are versioned templates/adapters.
- No guaranteed payment or legal acceptance claim.
- `0.1.0` contains web back office and online mobile capture.
- Offline is excluded until `0.3.0`.
- Founder-assisted configuration is explicit.

Remove:

- hardcoded synthetic amounts;
- one-line/one-day universal assumptions;
- claim that the subcontractor always owns and submits every document;
- automatic learning/AI requirements without evidence;
- pricing certainty not supported by a paid signal.

- [ ] **Step 3: Promote, validate, and commit**

Promote the reviewed draft to `docs/current/PRODUCT.md`.

Run:

```bash
pnpm verify:migration
pnpm verify:docs
```

Expected: PASS for every active document that exists at this point.

```bash
git add docs/current/PRODUCT.md migration/baseline-0
git commit -m "docs: define the current GoProceed product"
```

### Task 4: Rewrite current status and architecture

**Files:**
- Create: `migration/baseline-0/drafts/current/STATUS.md`
- Create: `migration/baseline-0/drafts/current/ARCHITECTURE.md`
- Create: `docs/current/STATUS.md`
- Create: `docs/current/ARCHITECTURE.md`
- Create: `migration/baseline-0/reports/data-security-audit.md`
- Modify: `migration/baseline-0/migration-ledger.csv`

**Interfaces:**
- Consumes: actual code under `apps`, `packages`, `supabase`, current CI, and docs 06–09/18–25/31–39.
- Produces: factual runtime snapshot and current/planned architecture boundary.

- [ ] **Step 1: Audit data, architecture, and security sources**

Review:

```text
docs/06-data-model-permissions.md
docs/07-technical-architecture.md
docs/08-api-integrations.md
docs/09-security-compliance.md
docs/18-domain-state-machines.md
docs/19-organizations-roles-access.md
docs/20-flow-catalog.md
docs/21-plans-entitlements-billing.md
docs/22-data-api-contract.md
docs/23-offline-media-protocol.md
docs/24-legal-regulatory-gates.md
docs/25-security-threat-model.md
docs/31-architecture-decisions.md
docs/32-customer-country-adapters.md
docs/33-support-admin-plane.md
docs/35-data-access-tenancy.md
docs/36-security-verification-profile.md
docs/38-business-logic-closure.md
docs/39-evidence-graph.md
technical/*
```

Do not weaken implemented P0-A tenancy invariants. Mark unimplemented target structures as reference or deferred.

- [ ] **Step 2: Write factual STATUS.md**

Required sections:

```markdown
## Current repository state
## Implemented runtime
## Current public surfaces
## Discovery status
## Verified checks
## Known gaps
## External gates
## Immediate next gate
```

State explicitly:

- runtime is partially implemented, not `NOT_STARTED`;
- current production code has organization bootstrap, context read, audit/outbox/idempotency, and initial tenancy migrations;
- `apps/demo` is tested but not the production product;
- `apps/landing` is a placeholder permanent product;
- `apps/mobile` does not exist yet;
- public deployment/domain status is unconfirmed;
- 50 sends are founder-reported while the attached workbook has a detailed 22-lead queue.

- [ ] **Step 3: Write ARCHITECTURE.md**

Required sections:

```markdown
## Current system
## Application boundaries
## Runtime request path
## Data and tenancy boundary
## Demo boundary
## Mobile boundary
## Public/private discovery boundary
## Planned 0.1.0 additions
## Deferred architecture
```

Use:

```text
/demo/*  synthetic public demo
/app/*   authenticated product
/login   authentication
/v1/*    production API
```

Describe `/demo` as planned, not implemented.

- [ ] **Step 4: Promote, validate, and commit**

```bash
pnpm verify:migration
pnpm verify:docs
git add docs/current/STATUS.md docs/current/ARCHITECTURE.md migration/baseline-0
git commit -m "docs: describe current runtime and architecture"
```

### Task 5: Create roadmap, delivery rules, and feature registry

**Files:**
- Create: `migration/baseline-0/drafts/current/ROADMAP.md`
- Create: `migration/baseline-0/drafts/current/DELIVERY.md`
- Create: `docs/current/ROADMAP.md`
- Create: `docs/current/DELIVERY.md`
- Create: `spec/features.yaml`
- Modify: `migration/baseline-0/migration-ledger.csv`

**Interfaces:**
- Consumes: approved release ladder and actual implementation status.
- Produces: milestone roadmap, scope-control rules, and machine-readable feature assignments.

- [ ] **Step 1: Audit roadmap sources**

Review:

```text
docs/12-roadmap-delivery.md
docs/15-risks-decisions.md
docs/17-production-readiness-index.md
docs/28-pilot-ga-delivery.md
docs/30-validation-evidence-register.md
docs/34-production-gate-checklist.md
technical/implementation-backlog.csv
```

Record why the 96-row backlog is not the active roadmap. Preserve only security dependencies and useful acceptance evidence.

- [ ] **Step 2: Write ROADMAP.md**

Required releases:

```text
Baseline 0  clean and truthful project
0.1.0       concierge web + online mobile pilot
0.2.0       repeatable web/mobile pilot
0.3.0       durable offline field workflow
0.4.0       multi-client paid operations
1.0.0       self-service core lifecycle
```

Include discovery gates D0.1–D0.4. State that Baseline 0 and synthetic/public-corpus work do not wait for D0.3, but real client data does.

- [ ] **Step 3: Write DELIVERY.md**

Include:

- milestone-based SemVer;
- patch/minor/major rules;
- feature admission rules;
- no silent scope expansion;
- definition of release closure;
- release notes and evidence;
- TDD for code;
- docs update in the same feature change;
- migration/rollback requirement;
- one active product slice for a solo founder with AI.

- [ ] **Step 4: Create the initial feature registry**

`spec/features.yaml` must contain at least:

```yaml
schema_version: 1
features:
  - id: GPR-FOUND-001
    name: Tenancy foundation
  - id: GPR-DISC-001
    name: Outreach accounting
  - id: GPR-PROJ-001
    name: Project and work baseline
  - id: GPR-IMPT-001
    name: Spreadsheet import
  - id: GPR-RULE-001
    name: Versioned evidence requirements
  - id: GPR-MOB-001
    name: Online mobile capture
  - id: GPR-READ-001
    name: Readiness and value at risk
  - id: GPR-REVW-001
    name: Internal review
  - id: GPR-PACK-001
    name: Versioned package export
  - id: GPR-OFFL-001
    name: Durable offline workflow
  - id: GPR-DEMO-001
    name: Product demo route
  - id: GPR-OPER-001
    name: Multi-client operations
```

Populate every required registry field. Mark only actually verified P0-A foundation elements `stable` or `beta`; planned functionality must not be marked implemented.

- [ ] **Step 5: Validate and commit**

```bash
pnpm verify:migration
pnpm verify:docs
git add docs/current/ROADMAP.md docs/current/DELIVERY.md spec/features.yaml migration/baseline-0
git commit -m "docs: define GoProceed roadmap and feature lifecycle"
```

### Task 6: Rewrite validation and evidence policy

**Files:**
- Create: `migration/baseline-0/drafts/current/VALIDATION.md`
- Create: `docs/current/VALIDATION.md`
- Modify: `discovery/public-corpus/index.csv`
- Modify: `migration/baseline-0/migration-ledger.csv`

**Interfaces:**
- Consumes: public corpus, discovery experiments, actual test commands, and external gates.
- Produces: one validation policy separating code evidence, public evidence, customer evidence, and legal/security review.

- [ ] **Step 1: Write VALIDATION.md**

Required sections:

```markdown
## Evidence classes
## Current automated checks
## Public corpus protocol
## Customer evidence protocol
## Discovery gates
## Legal and regulatory boundary
## Security and tenancy gates
## Release evidence
## Known unvalidated claims
```

Evidence classes:

```text
implemented_and_tested
public_source_verified
customer_validated
expert_reviewed
hypothesis
rejected
```

Explicitly state:

- public documents justify realistic templates/fixtures, not a promise of acceptance;
- one internal package refines workflow but does not define the universal schema;
- ownership/permission to share private documents must be recorded;
- the exact Prozorro package claim remains unverified until attachments are indexed;
- live customer data requires privacy, tenancy, backup/restore, and support gates.

- [ ] **Step 2: Complete public-source evidence rows**

For every `verified` corpus row, record:

- official authority;
- checked date;
- observed document/workflow/rejection signal;
- product usage limited to fixture, hypothesis, or rule candidate.

Do not infer unobserved attachments.

- [ ] **Step 3: Promote, validate, and commit**

```bash
pnpm verify:migration
pnpm verify:docs
git add docs/current/VALIDATION.md discovery/public-corpus migration/baseline-0
git commit -m "docs: define validation and evidence boundaries"
```

### Task 7: Complete the QA, design, and operations audit

**Files:**
- Create: `migration/baseline-0/reports/qa-design-operations-audit.md`
- Modify: `migration/baseline-0/migration-ledger.csv`
- Modify: `migration/baseline-0/inventory.csv`

**Interfaces:**
- Consumes: remaining docs, root audits/changelogs, design references, prototype evidence, and completed plans.
- Produces: no unreviewed tracked source in the Baseline 0 inventory.

- [ ] **Step 1: Review the remaining sources**

Review:

```text
docs/04-screen-specification.md
docs/05-design-system.md
docs/11-analytics-events.md
docs/13-qa-acceptance.md
docs/16-fidelity-ledger.md
docs/26-sre-operations.md
docs/27-qa-traceability.md
docs/29-prototype-coverage.md
ARCHITECTURE-AUDIT-ANSWERS.md
CHANGELOG-*.md
design-qa.md
design-references/**
prototype/**
docs/superpowers/plans/**
docs/superpowers/specs/2026-07-24-p0a-foundation-design.md
```

For generated/binary artefacts, record hashes and whether they are unique, duplicate, or regenerable.

- [ ] **Step 2: Finish every ledger row**

No tracked inventory row may remain `UNREVIEWED`.

Rules:

- `DELETE` requires evidence that the file is duplicate, generated, or fully superseded.
- `ARCHIVE` requires a destination.
- `MERGE`/`REWRITE` requires the active destination.
- `HYPOTHESIS` requires a validation destination in `VALIDATION.md` or feature registry.

- [ ] **Step 3: Add the no-unreviewed gate**

Extend `pnpm verify:migration` so `--check-final` fails if any inventory or ledger row remains unreviewed.

Test:

```js
test("final migration rejects unreviewed rows", () => {
  const rows = [{ source_path: "docs/04-screen-specification.md", decision: "UNREVIEWED" }];
  assert.match(validateFinalLedger(rows)[0], /UNREVIEWED/);
});
```

- [ ] **Step 4: Validate and commit**

```bash
node --test scripts/baseline-migration.test.mjs
node scripts/baseline-migration.mjs --check-final
pnpm verify:docs
git add migration/baseline-0 scripts
git commit -m "docs: complete baseline source audit"
```

### Task 8: Final active-document review

**Files:**
- Modify as needed: `README.md`
- Modify as needed: `docs/README.md`
- Modify as needed: `docs/current/*.md`
- Modify as needed: `docs/decisions/*.md`
- Modify as needed: `spec/features.yaml`
- Modify: `migration/baseline-0/reports/source-conflicts.md`

**Interfaces:**
- Consumes: all active docs, ADRs, feature registry, and completed ledger.
- Produces: a contradiction-free active layer ready for physical cleanup.

- [ ] **Step 1: Run terminology and contradiction scans**

Run:

```bash
rg -n 'AktFlow' README.md docs/current docs/decisions docs/README.md
rg -n 'runtime.*NOT_STARTED|NOT_STARTED.*runtime' docs/current
rg -n 'apps/mobile.*0\\.3\\.0|offline.*0\\.1\\.0|\\?demo=true' docs/current docs/decisions spec/features.yaml
rg -n 'aktflow\\.com|app\\.aktflow\\.com|demo\\.aktflow\\.com' docs/current docs/decisions
```

Expected:

- no public AktFlow branding;
- no `NOT_STARTED` runtime claim;
- online mobile is `0.1.0`;
- offline is `0.3.0`;
- demo mode is route-based;
- no custom-domain ownership claim.

- [ ] **Step 2: Close the known conflict report**

Every conflict in `source-conflicts.md` must have:

```text
resolution
decision link
active destination
```

- [ ] **Step 3: Run all documentation checks**

```bash
pnpm verify:migration
node scripts/baseline-migration.mjs --check-final
pnpm verify:docs
git diff --check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md docs spec migration/baseline-0
git commit -m "docs: finalize GoProceed active documentation"
```

## Plan 02 Completion Gate

The plan is complete only if:

- six active current documents exist and pass metadata validation;
- five ADRs reflect the approved decisions;
- the root README is a factual GoProceed portal rather than a readiness claim;
- `spec/features.yaml` passes schema validation;
- every inventory source has a final ledger decision;
- no legacy file has yet been physically removed;
- public sources and customer/private evidence are clearly separated;
- active docs contain no public AktFlow branding or custom-domain assumption.
