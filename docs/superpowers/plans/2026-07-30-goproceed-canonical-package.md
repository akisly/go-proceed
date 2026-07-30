# GoProceed Canonical Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mixed AktFlow v2.9 documentation package with one reviewed GoProceed source of truth, complete migration ledger, canonical v0.0/v0.1 contracts, and a non-destructive cleanup proposal.

**Architecture:** Build the new package inside the isolated `/Users/akisliy/Downloads/GoProceed` worktree. Active human-readable documents live under `docs/`, machine-readable target contracts under `technical/`, and transfer evidence under `migration/goproceed-canonical-v0.1/`. Existing runtime migrations remain the truth for actual database state; legacy documents are never silently rewritten or deleted.

**Tech Stack:** Markdown, CSV, YAML, PostgreSQL design DDL, OpenAPI 3.1, Node.js 24 validation scripts, pnpm 9.12, Git.

## Global Constraints

- Product name is `GoProceed`; `AktFlow` appears in active docs only when identifying legacy history.
- v0.1 ends at protected partial external acceptance and derived value at risk.
- Expo/React Native iOS/Android `apps/mobile` is online-only in v0.1; full
  offline extends the same client in v0.3.
- One workspace supports multiple own legal entities.
- A project may contain contracts of different own legal entities.
- One package belongs to exactly one contract.
- External access uses bearer email link plus protected session, without OTP or mandatory account.
- Quantity and evidence decisions are separate.
- Partial multi-approver decisions target exact claim segments.
- Readiness, acceptance totals, and value at risk are derived projections.
- No receivable, payment, SaaS billing, support, or statutory-accounting tables enter v0.1.
- No old file is deleted before its disposition and information transfer are reviewed.
- Never modify `/Users/akisliy/Downloads/aktflow-product-package 2` while executing this plan.
- Use Node `>=24 <25` and pnpm `9.12.0`.
- Every active document declares status, applicable version, and last-reviewed date.
- Every task ends with an independently reviewable deliverable.

---

## File structure

```text
README.md
docs/
  README.md
  product/
    vision-and-positioning.md
    scope-and-boundaries.md
    personas-and-workflows.md
    roadmap.md
  domain/
    glossary.md
    domain-model.md
    execution-and-evidence.md
    packages-and-acceptance.md
    value-at-risk.md
  architecture/
    system-overview.md
    data-model.md
    tenancy-and-security.md
    files-and-storage.md
    jobs-events-and-audit.md
  delivery/
    version-0.0.md
    version-0.1.md
    test-strategy.md
    production-readiness.md
  discovery/
    outreach-log.md
    validated-assumptions.md
  decisions/
    ADR-001-product-boundary.md
    ADR-002-tenancy-parties-and-contracts.md
    ADR-003-evidence-packages-and-acceptance.md
    ADR-004-roadmap-demo-and-documentation.md
  legacy/
    README.md
  superpowers/
    specs/2026-07-30-goproceed-canonical-design.md
    plans/2026-07-30-goproceed-canonical-package.md
technical/
  database/
    entity-catalog.csv
    relationship-catalog.csv
    invariant-catalog.csv
    schema-v0.1.sql
  openapi/
    README.md
    scope-v0.1.csv
  permissions/
    capabilities.csv
    responsibility-presets.csv
  states/
    state-catalog.csv
    transition-catalog.csv
  events/
    event-catalog.csv
  templates/
    README.md
migration/
  goproceed-canonical-v0.1/
    README.md
    baseline-verification.md
    source-inventory.csv
    document-disposition.csv
    conflict-register.md
    decision-register.md
    transfer-checklist.md
scripts/
  validate-canonical-docs.mjs
```

### Responsibility boundaries

- `docs/product/` states why and what GoProceed builds.
- `docs/domain/` defines business meaning and invariant workflows.
- `docs/architecture/` defines system boundaries and implementation rules.
- `docs/delivery/` defines release evidence and operational gates.
- `technical/` is machine-readable target-contract material.
- `migration/` proves how every old source was handled.
- `docs/legacy/` is historical reference only.
- `scripts/validate-canonical-docs.mjs` prevents source-of-truth drift.

---

### Task 1: Capture the reproducible baseline and full source inventory

**Files:**
- Create: `migration/goproceed-canonical-v0.1/README.md`
- Create: `migration/goproceed-canonical-v0.1/baseline-verification.md`
- Create: `migration/goproceed-canonical-v0.1/source-inventory.csv`
- Create: `migration/goproceed-canonical-v0.1/decision-register.md`
- Create: `migration/goproceed-canonical-v0.1/conflict-register.md`
- Create: `migration/goproceed-canonical-v0.1/transfer-checklist.md`

**Interfaces:**
- Consumes: approved canonical design and the read-only audits of actual runtime, documented target, and domain roles.
- Produces: a row-complete ledger consumed by every later rewrite and cleanup decision.

- [ ] **Step 1: Record immutable source coordinates**

Write both source roots, branch, commit, current date, workbook path, and the rule
that the old tree is read-only.

- [ ] **Step 2: Inventory tracked files**

Run:

```bash
git ls-files | LC_ALL=C sort
```

Classify every file into `runtime`, `active_documentation`, `machine_contract`,
`prototype`, `infrastructure`, `historical`, or `tooling`.

- [ ] **Step 3: Inventory untracked old-tree files without copying them**

Run in the old source:

```bash
git status --short
```

Add one inventory row per untracked or modified path with
`source_state=uncommitted_old_tree` and `copied=no`.

- [ ] **Step 4: Record actual baseline verification**

Include:

- six migrated runtime tables;
- one API view, three functions, and two application roles;
- current test result: 143 passed and 22 failed because local Supabase or
  `APP_DB_URL` is unavailable;
- three additional demo suites blocked by missing `@/lib/utils`;
- pnpm build-script approval gap for `esbuild`, `puppeteer`, and `sharp`;
- no live-catalog verification.

- [ ] **Step 5: Seed the conflict register**

Record at minimum:

- runtime 6 tables versus documented 126;
- workspace/legal-entity duplication;
- one rigid membership role versus composable responsibilities;
- online capture requiring offline lease;
- multiple readiness sources;
- internal/external/acceptance decision overlap;
- package-wide decision versus partial line/evidence decisions;
- finance/SaaS/support mixed into early schema;
- audit/idempotency/outbox tenant-isolation gaps.

- [ ] **Step 6: Seed the decision register**

Record every approved conversation decision with date, rationale, and the exact
canonical document that will own it.

- [ ] **Step 7: Verify inventory completeness**

Run:

```bash
test "$(tail -n +2 migration/goproceed-canonical-v0.1/source-inventory.csv | wc -l | tr -d ' ')" -gt 0
rg -n "uncommitted_old_tree|runtime|active_documentation" migration/goproceed-canonical-v0.1/source-inventory.csv
```

Expected: both commands succeed and all three categories appear.

- [ ] **Step 8: Commit**

```bash
git add migration/goproceed-canonical-v0.1
git commit -m "docs: capture GoProceed migration baseline"
```

---

### Task 2: Establish documentation governance and approved ADRs

**Files:**
- Create: `docs/README.md`
- Create: `docs/decisions/ADR-001-product-boundary.md`
- Create: `docs/decisions/ADR-002-tenancy-parties-and-contracts.md`
- Create: `docs/decisions/ADR-003-evidence-packages-and-acceptance.md`
- Create: `docs/decisions/ADR-004-roadmap-demo-and-documentation.md`
- Create: `docs/legacy/README.md`

**Interfaces:**
- Consumes: Task 1 decision register.
- Produces: the authority hierarchy and decisions referenced by all later docs.

- [ ] **Step 1: Define document metadata**

Every active document begins with:

```markdown
**Status:** Approved | Draft | Implemented | Historical
**Applies to:** v0.0 | v0.1 | v0.2+ | all
**Last reviewed:** YYYY-MM-DD
**Related decisions:** ADR links
```

- [ ] **Step 2: Define source-of-truth precedence**

Document:

1. applied migrations for actual DB;
2. approved canonical design for target version;
3. OpenAPI for public API;
4. version scope for release contents;
5. ADRs for approved decisions;
6. legacy as non-normative reference.

- [ ] **Step 3: Write ADR-001**

Record the contract-to-acceptance-and-risk v0.1 boundary and defer finance.

- [ ] **Step 4: Write ADR-002**

Record workspace, tenant-local parties, own legal profiles, multi-entity
projects, contract ownership, and package-per-contract.

- [ ] **Step 5: Write ADR-003**

Record immutable evidence/package facts, claim segments, external sessions,
separate quantity/evidence decisions, prior-acceptance references, and derived
VaR.

- [ ] **Step 6: Write ADR-004**

Record version-gated roadmap, separate landing, `/demo` in `apps/app`,
Expo/React Native `apps/mobile` for online-only iOS/Android work in v0.1,
offline extension in v0.3, no hard dates, and the documentation migration
hierarchy.

- [ ] **Step 7: Verify active authority**

Run:

```bash
rg -n "source of truth|non-normative|Status:" docs/README.md docs/decisions docs/legacy/README.md
```

Expected: metadata and authority language appear in every target.

- [ ] **Step 8: Commit**

```bash
git add docs/README.md docs/decisions docs/legacy/README.md
git commit -m "docs: establish GoProceed decision authority"
```

---

### Task 3: Rewrite the product package

**Files:**
- Create: `docs/product/vision-and-positioning.md`
- Create: `docs/product/scope-and-boundaries.md`
- Create: `docs/product/personas-and-workflows.md`
- Create: `docs/product/roadmap.md`

**Interfaces:**
- Consumes: ADR-001, ADR-002, ADR-004.
- Produces: product language used by delivery, landing, discovery, and demo.

- [ ] **Step 1: Write positioning without unverified claims**

State that GoProceed helps specialist construction teams make performed work
ready for acceptance through traceable quantity, evidence, package, and external
decision flow.

Do not claim paying customers, proven ROI, qualified signature, full offline,
full accounting, or production-grade compliance.

- [ ] **Step 2: Define v0.1 in/out boundary**

Use the approved closed-loop flow and explicitly list every deferred context.

- [ ] **Step 3: Define actors and jobs**

Separate workspace governance, project responsibility, external reviewer, and
system actor. Describe the customer, technical-supervision, performer, evidence
recorder/custodian, compiler, verifier, and submitter workflows.

- [ ] **Step 4: Define end-to-end workflows**

Cover:

- XLSX/CSV import;
- assignment and online capture;
- requirement/evidence review;
- package freeze and submission;
- multi-party partial acceptance;
- return, correction, and resubmission;
- value-at-risk explanation.

- [ ] **Step 5: Write version-gated roadmap**

Use v0.0, v0.1 M1–M6, v0.2, v0.3, v0.4+, and v1.0 exactly as approved.
Use evidence gates rather than dates.

- [ ] **Step 6: Verify claims**

Run:

```bash
! rg -n "paying customers|fully offline|qualified signature|full accounting|production[- ]ready" docs/product
rg -n "v0\\.1-M1|v0\\.1-M6|/demo|v0\\.3" docs/product/roadmap.md
```

Expected: prohibited claims are absent; milestone and demo references exist.

- [ ] **Step 7: Commit**

```bash
git add docs/product
git commit -m "docs: define GoProceed product and roadmap"
```

---

### Task 4: Write the canonical domain model

**Files:**
- Create: `docs/domain/glossary.md`
- Create: `docs/domain/domain-model.md`
- Create: `docs/domain/execution-and-evidence.md`
- Create: `docs/domain/packages-and-acceptance.md`
- Create: `docs/domain/value-at-risk.md`

**Interfaces:**
- Consumes: ADR-002 and ADR-003.
- Produces: terms and invariants used by schema, states, events, API, and tests.

- [ ] **Step 1: Write the canonical glossary**

Define at minimum workspace, party, own legal entity, contact, project,
contract, contract version, work item, work assignment, progress entry,
requirement template version, occurrence, evidence object, package, package
version, package line, claim segment, approval requirement, access grant,
external session, decision batch, quantity decision, evidence decision,
acceptance, readiness, and value at risk.

- [ ] **Step 2: Write aggregate boundaries**

Document workspace/access, contract baseline, execution, requirements, evidence,
internal review, package, external review, and deferred Project Commercials.

- [ ] **Step 3: Write execution and evidence lifecycle**

Distinguish performer, recorder, source party, custodian, original, derivative,
server receipt, claimed capture time, review decision, and exception.

- [ ] **Step 4: Write package and acceptance lifecycle**

Define draft, freeze, artifact generation, submission, grant/session, partial
decision batch, claim-segment partition, return, prior acceptance reference, and
resubmission.

- [ ] **Step 5: Define VaR math and precedence**

Document:

```text
accepted
→ returned
→ submitted_pending
→ packaged_not_submitted
→ internal_review
→ evidence_blocked
→ ready_not_packaged
```

Specify currency grouping, tax basis, decimal precision, rounding reconciliation,
missing versus zero price, and over-contract exposure.

- [ ] **Step 6: Verify terminology consistency**

Run:

```bash
rg -n "claim segment|approval requirement|bearer_email_link|prior acceptance|over-contract" docs/domain
! rg -n "workspace legal name|workspace EDRPOU|package-level editable acceptance" docs/domain
```

Expected: canonical concepts exist and rejected concepts are absent.

- [ ] **Step 7: Commit**

```bash
git add docs/domain
git commit -m "docs: define GoProceed canonical domain"
```

---

### Task 5: Write architecture and security documents

**Files:**
- Create: `docs/architecture/system-overview.md`
- Create: `docs/architecture/data-model.md`
- Create: `docs/architecture/tenancy-and-security.md`
- Create: `docs/architecture/files-and-storage.md`
- Create: `docs/architecture/jobs-events-and-audit.md`

**Interfaces:**
- Consumes: canonical domain model.
- Produces: implementation rules used by technical catalogs and v0.0 plans.

- [ ] **Step 1: Describe system boundaries**

Map `apps/landing`, `apps/app`, Expo/React Native `apps/mobile`,
Supabase/PostgreSQL,
private object storage, background workers, and email delivery.

- [ ] **Step 2: Document relational design rules**

Require workspace-leading indexes, tenant-safe composite FKs, immutable
published contents, append-only facts where approved, and derived projections.

- [ ] **Step 3: Document tenancy and authorization**

Cover workspace governance, project access, responsibilities, external
capabilities, BFF/worker roles, RLS on every exposed tenant table, and
deny-by-default future grants.

- [ ] **Step 4: Document external-link protocol**

Include token hash, deliberate POST exchange, short session, cleaned URL,
HttpOnly/Secure/SameSite cookie, CSP, no-referrer, revocation version, CSRF,
prefetch safety, and assurance wording.

- [ ] **Step 5: Document file and import safety**

Cover immutable storage keys, hashes, upload receipt, local mobile preservation,
signed short-lived URLs, MIME/size limits, malware boundary, formula/macro
non-execution, ZIP-bomb limits, and CSV formula neutralization.

- [ ] **Step 6: Document jobs, outbox, and audit**

Define job attempts, lease, retry/backoff, dead-letter, idempotent consumer
effect, audit actor consistency, append-only protection, and the difference
between audit, domain event, and outbox.

- [ ] **Step 7: Verify security coverage**

Run:

```bash
rg -n "composite FK|ROW LEVEL SECURITY|HttpOnly|no-referrer|dead-letter|formula" docs/architecture
```

Expected: every security family is present.

- [ ] **Step 8: Commit**

```bash
git add docs/architecture
git commit -m "docs: define GoProceed architecture and security"
```

---

### Task 6: Build the canonical technical catalogs

**Files:**
- Create: `technical/database/entity-catalog.csv`
- Create: `technical/database/relationship-catalog.csv`
- Create: `technical/database/invariant-catalog.csv`
- Create: `technical/database/schema-v0.1.sql`
- Create: `technical/openapi/README.md`
- Create: `technical/openapi/scope-v0.1.csv`
- Create: `technical/permissions/capabilities.csv`
- Create: `technical/permissions/responsibility-presets.csv`
- Create: `technical/states/state-catalog.csv`
- Create: `technical/states/transition-catalog.csv`
- Create: `technical/events/event-catalog.csv`
- Create: `technical/templates/README.md`

**Interfaces:**
- Consumes: domain and architecture documents.
- Produces: exact target contracts used to write later migration and API plans.

- [ ] **Step 1: Create the entity catalog**

Use columns:

```text
module,entity,status_version,purpose,identity,lifecycle,workspace_scoped,project_scoped,contract_scoped,immutable_content,retention_class,source_document
```

Include every approved logical entity. Do not force a target row count.

- [ ] **Step 2: Create the relationship catalog**

Use columns:

```text
from_entity,relationship,to_entity,cardinality,required,tenant_safe_key,on_delete,invariant_id
```

Every project/contract/package/evidence/decision relationship must name its
tenant-safe key.

- [ ] **Step 3: Create the invariant catalog**

Use columns:

```text
invariant_id,severity,scope,statement,enforcement,test_evidence,source_document
```

Include every invariant from canonical design section 20.

- [ ] **Step 4: Write design DDL**

`schema-v0.1.sql` is target design, not a migration. It must:

- define schemas and enums explicitly;
- define all columns, PKs, tenant-safe FKs, unique constraints, and checks;
- separate content immutability from lifecycle;
- define claim-segment reconciliation and no-overclaim enforcement interface;
- define quantity/evidence decision tables separately;
- include external grants and sessions;
- define projection views for readiness and VaR contracts;
- contain comments identifying unresolved statutory/retention values as external
  gates rather than invented defaults.

- [ ] **Step 5: Define API scope**

List approximately 35–45 v0.1 operations by workflow and milestone. Every row
has method, path, command/query, idempotency requirement, auth plane, request
contract owner, response contract owner, and milestone.

- [ ] **Step 6: Define capabilities and presets**

Capabilities are closed policy identifiers. Responsibility presets map UI
personas to capabilities but never become authorization truth.

- [ ] **Step 7: Define states and transitions**

Only store lifecycle states that are facts. Mark readiness, current acceptance,
and VaR states as projections.

- [ ] **Step 8: Define events**

Separate domain events from audit actions and delivery topics. Include payload
version, aggregate, idempotency/effect key, producer, consumers, and milestone.

- [ ] **Step 9: Validate catalog references**

Run:

```bash
python3 - <<'PY'
import csv
from pathlib import Path

root = Path("technical")
for path in root.rglob("*.csv"):
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))
    assert len(rows) > 1, f"{path} has no data rows"
    width = len(rows[0])
    assert all(len(row) == width for row in rows), f"{path} has ragged rows"
print("technical CSV catalogs: OK")
PY
```

Expected: `technical CSV catalogs: OK`.

- [ ] **Step 10: Commit**

```bash
git add technical
git commit -m "docs: add GoProceed v0.1 technical contracts"
```

---

### Task 7: Write delivery, testing, readiness, and discovery evidence

**Files:**
- Create: `docs/delivery/version-0.0.md`
- Create: `docs/delivery/version-0.1.md`
- Create: `docs/delivery/test-strategy.md`
- Create: `docs/delivery/production-readiness.md`
- Create: `docs/discovery/outreach-log.md`
- Create: `docs/discovery/validated-assumptions.md`

**Interfaces:**
- Consumes: roadmap, technical catalogs, baseline verification, and source workbook analysis.
- Produces: executable release gates and honest discovery status.

- [ ] **Step 1: Define v0.0 exit criteria**

Include foundation tenant isolation, secrets, audit, idempotency, outbox,
dependency-build policy, missing demo utility, local test environment, and green
baseline.

- [ ] **Step 2: Define v0.1 M1–M6**

For each milestone name the user outcome, schema slice, API slice, required
security tests, vertical test, explicit exclusions, and evidence required to
close it.

- [ ] **Step 3: Write test strategy**

Cover unit, migration, invariant, RLS, API integration, storage, external-link,
import-fuzz, rounding/property, mobile interruption, and end-to-end tests.

- [ ] **Step 4: Write pilot readiness gates**

Require privacy notice, retention choice, export, manual deletion, backup/restore,
monitoring, incident path, link-assurance copy, and no production data in demo.

- [ ] **Step 5: Write outreach evidence accurately**

Record:

- 50 lead-map rows;
- 28 legacy and 22 new;
- 10 priority A and 12 priority B among new leads;
- workbook evidence of 21 sent on 2026-07-28 and one unsent;
- all 22 awaiting response in the workbook;
- founder report of outreach to 50, explicitly unreconciled with workbook
  evidence.

Do not copy recipient email addresses into active documentation.

- [ ] **Step 6: Define validated and unvalidated assumptions**

Do not convert public research, send count, or internal specification into
customer validation. Track reply, artifact access, interview, named project,
pilot commitment, and willingness to pay separately.

- [ ] **Step 7: Verify delivery gates**

Run:

```bash
rg -n "M1|M2|M3|M4|M5|M6" docs/delivery/version-0.1.md
rg -n "21|one unsent|unreconciled|awaiting" docs/discovery/outreach-log.md
```

Expected: all milestones and evidence caveats appear.

- [ ] **Step 8: Commit**

```bash
git add docs/delivery docs/discovery
git commit -m "docs: define delivery gates and discovery evidence"
```

---

### Task 8: Complete the legacy disposition ledger

**Files:**
- Modify: `migration/goproceed-canonical-v0.1/source-inventory.csv`
- Create: `migration/goproceed-canonical-v0.1/document-disposition.csv`
- Modify: `migration/goproceed-canonical-v0.1/transfer-checklist.md`
- Modify: `docs/legacy/README.md`

**Interfaces:**
- Consumes: all completed canonical docs and catalogs.
- Produces: proof that every old document has an explicit destination.

- [ ] **Step 1: Define disposition columns**

Use:

```text
source_path,source_state,disposition,target_path,information_moved,information_rejected,reason,review_status
```

- [ ] **Step 2: Classify every old numbered document**

Assign exactly one of `keep`, `rewrite`, `merge`, `defer`, `archive`, or
`delete_after_transfer`.

- [ ] **Step 3: Classify root audits and changelogs**

Architecture audit answers and contradiction-free changelog claims become
historical evidence, not active requirements.

- [ ] **Step 4: Classify old technical catalogs**

Map each old CSV/OpenAPI/schema artifact to its canonical replacement,
historical archive, or deferred future context.

- [ ] **Step 5: Classify uncommitted old-tree paths**

Do not copy them automatically. Record whether they are user work, obsolete
hypothesis, generated output, or require manual review.

- [ ] **Step 6: Verify one disposition per source**

Run:

```bash
python3 - <<'PY'
import csv
from pathlib import Path

path = Path("migration/goproceed-canonical-v0.1/document-disposition.csv")
with path.open(newline="", encoding="utf-8") as handle:
    rows = list(csv.DictReader(handle))
sources = [row["source_path"] for row in rows]
assert len(sources) == len(set(sources)), "duplicate source dispositions"
assert all(row["disposition"] and row["reason"] for row in rows)
print(f"document dispositions: {len(rows)} unique sources")
PY
```

Expected: unique-source count is printed without assertion failure.

- [ ] **Step 7: Commit**

```bash
git add migration/goproceed-canonical-v0.1 docs/legacy/README.md
git commit -m "docs: map every legacy source to GoProceed"
```

---

### Task 9: Add canonical-document validation

**Files:**
- Create: `scripts/validate-canonical-docs.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: final active-document paths and metadata contract.
- Produces: `pnpm validate:canonical-docs`.

- [ ] **Step 1: Write a failing validation fixture in memory**

The script self-tests its parsers against:

- missing required file;
- missing metadata;
- forbidden active `AktFlow` branding outside legacy context;
- broken relative Markdown link;
- duplicate disposition source.

- [ ] **Step 2: Implement required-path validation**

Hard-code the required active paths from this plan and report every missing
path in one run.

- [ ] **Step 3: Implement metadata validation**

Require `Status`, `Applies to`, `Last reviewed`, and `Related decisions` in
active human-readable docs.

- [ ] **Step 4: Implement branding and link validation**

Allow `AktFlow` only in explicit legacy/history paragraphs. Resolve relative
Markdown file links and reject missing targets.

- [ ] **Step 5: Implement CSV shape and disposition validation**

Reject ragged CSV rows, duplicate source dispositions, and unknown disposition
values.

- [ ] **Step 6: Add package script**

Add:

```json
"validate:canonical-docs": "node scripts/validate-canonical-docs.mjs"
```

- [ ] **Step 7: Run validation**

Run:

```bash
PATH="/Users/akisliy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
  node scripts/validate-canonical-docs.mjs
```

Expected: `canonical documentation: OK`.

- [ ] **Step 8: Commit**

```bash
git add scripts/validate-canonical-docs.mjs package.json
git commit -m "test: validate canonical GoProceed documentation"
```

---

### Task 10: Promote the new package without destructive cleanup

**Files:**
- Modify: `README.md`
- Modify: `migration/goproceed-canonical-v0.1/transfer-checklist.md`
- Create: `migration/goproceed-canonical-v0.1/cleanup-proposal.md`
- Create: `migration/goproceed-canonical-v0.1/final-review.md`

**Interfaces:**
- Consumes: all canonical docs, catalogs, validation, and disposition ledger.
- Produces: the active GoProceed entry point and a user-reviewable cleanup list.

- [ ] **Step 1: Rewrite the root entry point**

Lead with the actual state:

- product name GoProceed;
- six-table foundation exists;
- canonical v0.0/v0.1 docs are active;
- baseline limitations are linked;
- old target package is historical;
- next executable milestone is v0.0 foundation hardening.

- [ ] **Step 2: Run full documentation validation**

Run:

```bash
PATH="/Users/akisliy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
  node scripts/validate-canonical-docs.mjs
```

Expected: `canonical documentation: OK`.

- [ ] **Step 3: Re-run baseline tests without hiding failures**

Run:

```bash
PATH="/Users/akisliy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
  ./node_modules/.bin/vitest run
```

Record exact pass/fail counts and distinguish environmental DB failures from
code/import failures.

- [ ] **Step 4: Perform spec-coverage review**

Check every section of
`docs/superpowers/specs/2026-07-30-goproceed-canonical-design.md` has an active
document or technical-catalog owner.

- [ ] **Step 5: Scan for placeholders**

Run:

```bash
rg -n "TBD|TODO|implement later|fill in|similar to" docs technical migration
```

Expected: no unresolved placeholder in approved active material.

- [ ] **Step 6: Write the cleanup proposal**

List exact files proposed for:

- archive;
- deletion after transfer;
- deferred manual review;
- preservation as runtime or user work.

Do not move or delete them in this task.

- [ ] **Step 7: Write final review**

Include:

- resolved conflict count;
- remaining external gates;
- current test baseline;
- discovery evidence discrepancy;
- exact next implementation plan required for v0.0;
- statement that no source data was destructively removed.

- [ ] **Step 8: Commit**

```bash
git add README.md migration/goproceed-canonical-v0.1
git commit -m "docs: promote canonical GoProceed package"
```

---

## Self-review checklist

- Spec coverage: every approved design section maps to Tasks 2–7.
- Legacy coverage: every source maps through Task 8 before cleanup.
- Security coverage: current P0 findings and external-link protocol map to Task 5.
- Data-contract coverage: entities, relationships, invariants, API, permissions,
  states, events, and templates map to Task 6.
- Discovery accuracy: 50 lead-map rows are separated from 21 workbook-evidenced
  sends in Task 7.
- No destructive operation occurs in this plan.
- No finance, offline, AI, SaaS billing, or support runtime is pulled into v0.1.
