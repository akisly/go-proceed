# GoProceed Baseline 0 — Preservation and Migration Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve every valuable local/remote artefact, integrate the discovery work, and create a tracked migration workspace that can receive the rewritten GoProceed documentation without deleting legacy sources.

**Architecture:** Execute in an isolated Git worktree based on the current `origin/main`; never mutate or clean the existing dirty worktree until preservation evidence exists. Track only aggregate/source metadata in `migration/baseline-0/`; keep personal outreach material outside Git. The migration ledger is the gate for every later move, archive, or deletion.

**Tech Stack:** Git worktrees, pnpm 9.12.0, Node.js 24, Vitest 3.2.4, Markdown, CSV, existing TypeScript/discovery packages.

## Global Constraints

- Baseline 0 implements no new product feature.
- `apps/landing` is a permanent public GoProceed site.
- `apps/app` is the production web product and future host of `/demo`.
- `apps/mobile` is created only in `0.1.0`; this plan does not create it.
- GoProceed is the public brand; package names, database roles, migrations, environment keys, and repository identifiers remain `aktflow`.
- Do not modify auth, RLS, grants, or existing migrations.
- Do not delete any branch, worktree, tracked source, or untracked review file in this plan.
- Do not commit personal names, recipient emails, phone numbers, outreach drafts, or the campaign workbook.
- Node must satisfy `>=24 <25`.
- The old `aktflow-demo` Vercel URL must remain usable.
- Every generated verification command must leave the tracked working tree clean.

---

## File Structure

**Created in this plan:**

```text
migration/baseline-0/
├── README.md
├── preservation-manifest.md
├── inventory.csv
├── migration-ledger.csv
├── source-notes/
│   └── development-can-start.md
└── reports/
    └── source-conflicts.md

scripts/
├── baseline-migration.mjs
└── baseline-migration.test.mjs

discovery/
├── public-corpus/
│   ├── README.md
│   └── index.csv
└── private/                  # local only; ignored by Git
```

**Modified in this plan:**

```text
.gitignore
package.json
pnpm-lock.yaml
discovery/README.md
discovery/sources.md
```

**External private storage:**

```text
/Users/akisliy/Downloads/GoProceed-private/
├── README.md
├── outreach-drafts/
└── campaign-sources/
```

The external directory is not committed and must not contain Git metadata.

### Task 1: Create the isolated execution context and preservation manifest

**Files:**
- Create: `migration/baseline-0/preservation-manifest.md`
- Preserve and extend: `migration/baseline-0/README.md`
- Reference: `docs/superpowers/specs/2026-07-29-goproceed-baseline-zero-design.md`
- Reference: `docs/superpowers/plans/2026-07-29-goproceed-baseline-zero-01-preservation-and-workspace.md`

**Interfaces:**
- Consumes: the existing dirty worktree, `origin/main`, all local/remote branches, and `git worktree list --porcelain`.
- Produces: an isolated branch named `codex/goproceed-baseline-zero` and an auditable manifest that later cleanup tasks must consult.

- [ ] **Step 1: Create an isolated worktree**

Use the `superpowers:using-git-worktrees` skill. Base the worktree on the fetched `origin/main`, not the stale local `main`.

Expected branch:

```text
codex/goproceed-baseline-zero
```

Do not stash, reset, clean, or switch the original dirty worktree.

- [ ] **Step 2: Record the original and isolated Git state**

Run in the original worktree:

```bash
git rev-parse HEAD
git rev-parse origin/main
git status --short
git branch -vv
git worktree list --porcelain
git remote -v
```

Copy only these approved, currently untracked planning and scaffold files into the isolated
worktree at the same relative paths, then compare their SHA-256 hashes between
worktrees:

```text
docs/superpowers/specs/2026-07-29-goproceed-baseline-zero-design.md
docs/superpowers/plans/2026-07-29-goproceed-baseline-zero-01-preservation-and-workspace.md
docs/superpowers/plans/2026-07-29-goproceed-baseline-zero-02-active-documentation.md
docs/superpowers/plans/2026-07-29-goproceed-baseline-zero-03-cleanup-and-verification.md
migration/baseline-0/README.md
```

Do not copy any other untracked file as part of this step.

Write `migration/baseline-0/preservation-manifest.md` with these exact sections:

```markdown
# Baseline 0 preservation manifest

## Source worktree
- absolute path
- HEAD
- origin/main
- branch
- captured_at

## Existing tracked modifications

## Existing untracked project files

## Private/untracked outreach material
- count only
- source directories only
- no email addresses or content

## Worktrees requiring review

## Branch decisions
- integrate
- inspect before delete
- never merge

## Preservation assertions
- source worktree not mutated
- no worktree removed
- no branch removed
```

- [ ] **Step 3: Verify the original worktree was not mutated**

Run the same `git status --short` in the original worktree and compare it byte-for-byte with the captured pre-work status.

Expected: no new, removed, or changed status entries.

- [ ] **Step 4: Commit the manifest**

```bash
git add \
  migration/baseline-0/preservation-manifest.md \
  docs/superpowers/specs/2026-07-29-goproceed-baseline-zero-design.md \
  docs/superpowers/plans/2026-07-29-goproceed-baseline-zero-01-preservation-and-workspace.md \
  docs/superpowers/plans/2026-07-29-goproceed-baseline-zero-02-active-documentation.md \
  docs/superpowers/plans/2026-07-29-goproceed-baseline-zero-03-cleanup-and-verification.md \
  migration/baseline-0/README.md
git commit -m "docs: record GoProceed baseline zero design"
```

### Task 2: Create the migration workspace and its fail-closed validator

**Files:**
- Modify: `migration/baseline-0/README.md`
- Create: `migration/baseline-0/inventory.csv`
- Create: `migration/baseline-0/migration-ledger.csv`
- Create: `migration/baseline-0/reports/source-conflicts.md`
- Create: `scripts/baseline-migration.mjs`
- Create: `scripts/baseline-migration.test.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: repository-relative source paths and CSV files encoded as UTF-8.
- Produces:
  - `validateInventory(rows): string[]`
  - `validateLedger(rows, inventoryPaths): string[]`
  - `readCsvFile(path): Promise<Record<string, string>[]>`
  - CLI command `node scripts/baseline-migration.mjs --check`
  - package command `pnpm verify:migration`

- [ ] **Step 1: Write failing validator tests**

Create `scripts/baseline-migration.test.mjs` using `node:test`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  validateInventory,
  validateLedger,
} from "./baseline-migration.mjs";

test("inventory rejects duplicate and missing source paths", () => {
  const rows = [
    { source_path: "docs/00-product-brief.md", source_type: "document", area: "product", tracked: "true", contains_private_data: "false", review_status: "unreviewed" },
    { source_path: "docs/00-product-brief.md", source_type: "document", area: "product", tracked: "true", contains_private_data: "false", review_status: "unreviewed" },
  ];
  assert.deepEqual(validateInventory(rows), [
    "inventory: duplicate source_path docs/00-product-brief.md",
  ]);
});

test("ledger rejects unknown decisions and missing evidence", () => {
  const rows = [{
    source_path: "docs/00-product-brief.md",
    decision: "MAYBE",
    destination: "",
    reason: "",
    evidence: "",
    owner: "founder",
    reviewed_at: "",
  }];
  assert.deepEqual(validateLedger(rows, new Set(["docs/00-product-brief.md"])), [
    "ledger: docs/00-product-brief.md has invalid decision MAYBE",
    "ledger: docs/00-product-brief.md is missing reason",
    "ledger: docs/00-product-brief.md is missing evidence",
    "ledger: docs/00-product-brief.md is missing reviewed_at",
  ]);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
node --test scripts/baseline-migration.test.mjs
```

Expected: FAIL because `scripts/baseline-migration.mjs` does not exist.

- [ ] **Step 3: Implement the minimal validator**

Create `scripts/baseline-migration.mjs` with:

```js
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DECISIONS = new Set([
  "UNREVIEWED",
  "KEEP",
  "MERGE",
  "REWRITE",
  "HYPOTHESIS",
  "ARCHIVE",
  "DELETE",
]);

export function validateInventory(rows) {
  const errors = [];
  const seen = new Set();
  for (const row of rows) {
    const source = row.source_path?.trim();
    if (!source) errors.push("inventory: blank source_path");
    else if (seen.has(source)) errors.push(`inventory: duplicate source_path ${source}`);
    else seen.add(source);
  }
  return errors;
}

export function validateLedger(rows, inventoryPaths) {
  const errors = [];
  for (const row of rows) {
    const source = row.source_path?.trim();
    if (!inventoryPaths.has(source)) errors.push(`ledger: unknown source_path ${source}`);
    if (!DECISIONS.has(row.decision?.trim())) {
      errors.push(`ledger: ${source} has invalid decision ${row.decision?.trim()}`);
    }
    if (!row.reason?.trim()) errors.push(`ledger: ${source} is missing reason`);
    if (!row.evidence?.trim()) errors.push(`ledger: ${source} is missing evidence`);
    if (!row.reviewed_at?.trim()) errors.push(`ledger: ${source} is missing reviewed_at`);
  }
  return errors;
}
```

Add a strict CSV reader that supports quoted commas and escaped double quotes. The CLI must:

1. read both CSV files;
2. validate headers;
3. reject duplicate ledger source paths;
4. reject `DELETE` without a non-empty evidence field;
5. reject private paths in the tracked inventory;
6. print all errors and exit `1`;
7. print counts by decision and exit `0` when valid.

Export that reader as:

```js
export async function readCsvFile(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return parseCsv(text);
}
```

- [ ] **Step 4: Create the workspace contracts**

`migration/baseline-0/inventory.csv` header:

```csv
source_path,source_type,area,tracked,contains_private_data,review_status
```

`migration/baseline-0/migration-ledger.csv` header:

```csv
source_path,decision,destination,reason,evidence,owner,reviewed_at
```

Seed both files with the approved design specification, all three Baseline 0
implementation plans, and the migration workspace README. Use `KEEP`, not
`UNREVIEWED`, because the planning set and scaffold are already approved
evidence.

`migration/baseline-0/README.md` must define:

- temporary purpose;
- promotion flow `source → draft → review → final destination`;
- allowed ledger decisions;
- prohibition on private data;
- removal condition: only after Baseline 0 release evidence is accepted.

`migration/baseline-0/reports/source-conflicts.md` starts with these known conflicts:

```markdown
- Runtime is partially implemented, while README/doc 17 say NOT_STARTED.
- The 96-row backlog says not_started for partially implemented P0-A work.
- The old P0-A design defers all mobile; approved design includes online mobile in 0.1.0.
- The old P0-A design proposes an ephemeral demo tenant; approved design requires session-local synthetic /demo.
- Old docs assume AktFlow as the public brand; GoProceed is approved.
- Old docs prefer a custom domain; free Vercel hostnames are approved for now.
```

- [ ] **Step 5: Add the package command and run tests**

Add:

```json
"verify:migration": "node scripts/baseline-migration.mjs --check"
```

Run:

```bash
node --test scripts/baseline-migration.test.mjs
pnpm verify:migration
```

Expected: both PASS.

- [ ] **Step 6: Commit the workspace**

```bash
git add migration/baseline-0 scripts/baseline-migration.mjs scripts/baseline-migration.test.mjs package.json pnpm-lock.yaml
git commit -m "chore: add baseline zero migration workspace"
```

### Task 3: Integrate the discovery branch without merging invalid CI work

**Files:**
- Modify: `.gitignore`
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`
- Create/modify: `discovery/**` from `origin/feat/phase1-child-b-outreach`
- Modify: `migration/baseline-0/preservation-manifest.md`
- Modify: `migration/baseline-0/inventory.csv`
- Modify: `migration/baseline-0/migration-ledger.csv`

**Interfaces:**
- Consumes: `origin/feat/phase1-child-b-outreach`.
- Produces: discovery package with its tests, source registry, reports, templates, and no committed private lead/contact files.

- [ ] **Step 1: Confirm branch divergence before merge**

Run:

```bash
git rev-list --left-right --count origin/main...origin/feat/phase1-child-b-outreach
git diff --stat origin/main...origin/feat/phase1-child-b-outreach
```

Expected: the discovery branch has unique commits. Record the exact counts and head SHA in the preservation manifest.

- [ ] **Step 2: Merge the discovery branch**

Run:

```bash
git merge --no-ff origin/feat/phase1-child-b-outreach
```

Resolve only `.gitignore`, workspace, lockfile, and documentation conflicts. Preserve:

- current `origin/main` demo improvements;
- all discovery package code and tests;
- PII ignores for `leads.csv`, `outreach-log.csv`, `suppression.csv`, `drafts/`, and `*.db`;
- root Node 24 and pnpm 9.12.0 constraints.

Do not merge `origin/claude/dashboard-rewrite-*`.

- [ ] **Step 3: Verify discovery**

Run:

```bash
pnpm install --frozen-lockfile
pnpm --filter @aktflow/discovery typecheck
pnpm --filter @aktflow/discovery test
```

Expected: typecheck PASS and all discovery tests PASS.

- [ ] **Step 4: Add discovery sources to the inventory**

Inventory every tracked file under:

```text
discovery/src/
discovery/templates/
discovery/evals/
discovery/reports or existing report files
discovery/*.md
```

Set `review_status=unreviewed`. Do not add ignored lead/contact/database files.

Create matching ledger rows with:

```text
decision=UNREVIEWED
destination=
reason=Pending thematic discovery audit
evidence=origin/feat/phase1-child-b-outreach
owner=founder
reviewed_at=2026-07-29
```

- [ ] **Step 5: Validate and commit**

Run:

```bash
pnpm verify:migration
git status --short
```

Expected: only intended integration and inventory changes.

Commit:

```bash
git add .gitignore pnpm-workspace.yaml pnpm-lock.yaml discovery migration/baseline-0
git commit -m "feat: integrate discovery evidence workflow"
```

### Task 4: Preserve private outreach material outside Git

**Files:**
- Create outside Git: `/Users/akisliy/Downloads/GoProceed-private/README.md`
- Create outside Git: `/Users/akisliy/Downloads/GoProceed-private/outreach-drafts/`
- Create outside Git: `/Users/akisliy/Downloads/GoProceed-private/campaign-sources/`
- Modify: `.gitignore`
- Modify: `discovery/README.md`
- Modify: `migration/baseline-0/preservation-manifest.md`

**Interfaces:**
- Consumes: untracked `apps/V2-*.md`, `.claude/V2-*.md`, and the external campaign workbook.
- Produces: one external private location plus an aggregate manifest with no personal data.

- [ ] **Step 1: Add fail-closed ignores**

Ensure `.gitignore` contains:

```gitignore
.agents/
.claude/
discovery/private/
discovery/drafts/
discovery/*.db
discovery/leads.csv
discovery/outreach-log.csv
discovery/suppression.csv
.env*
!.env.example
!.env.*.example
```

Do not remove the existing build/cache ignores.

- [ ] **Step 2: Create the external private README**

The external README must say:

```markdown
# GoProceed private discovery material

This directory is outside Git.

- outreach-drafts/: recipient-specific drafts
- campaign-sources/: source workbooks and exports

Do not copy this directory into the repository.
Do not place secrets here; use a password manager.
Do not commit recipient emails, phone numbers, suppression records, or replies.
```

- [ ] **Step 3: Copy and verify private material**

Copy, do not delete:

- all current `.claude/V2-*.md`;
- all current `apps/V2-*.md`;
- `aktflow_ukraine_leads_50_demo_outreach_2026-07-28.xlsx`.

Record in the preservation manifest:

- source path;
- destination directory;
- file count;
- total byte count;
- copy verification result.

Do not record filenames containing recipient names, email addresses, or file contents.

- [ ] **Step 4: Update discovery privacy guidance**

Add a `Private data boundary` section to `discovery/README.md` stating:

- Git contains methodology, code, aggregate metrics, public source URLs, and anonymized examples;
- private storage contains contacts, messages, replies, suppression state, and raw campaign exports;
- only aggregate campaign counts may be promoted to `docs/current/VALIDATION.md`.

- [ ] **Step 5: Verify no private material is tracked**

Run:

```bash
git ls-files | rg '(^|/)(V2-[0-9]+\\.md|leads\\.csv|outreach-log\\.csv|suppression\\.csv|.*\\.db)$'
```

Expected: no output.

Run:

```bash
pnpm verify:migration
git check-ignore -v discovery/private/example.txt .claude/settings.local.json .env.local
```

Expected: each sample path is ignored.

- [ ] **Step 6: Commit only policy files**

```bash
git add .gitignore discovery/README.md migration/baseline-0/preservation-manifest.md
git commit -m "chore: isolate private discovery material"
```

### Task 5: Normalize the attached analysis and seed the public evidence corpus

**Files:**
- Create: `migration/baseline-0/source-notes/development-can-start.md`
- Create: `discovery/public-corpus/README.md`
- Create: `discovery/public-corpus/index.csv`
- Modify: `discovery/sources.md`
- Modify: `migration/baseline-0/inventory.csv`
- Modify: `migration/baseline-0/migration-ledger.csv`
- Modify: `migration/baseline-0/reports/source-conflicts.md`

**Interfaces:**
- Consumes: the attached 121-line analysis, existing docs 00/01/24/30/40, and official public sources.
- Produces: a source note that classifies every attached claim and a public-corpus registry containing URLs and evidence status, not downloaded customer/private files.

- [ ] **Step 1: Write the normalized source note**

Use these exact sections:

```markdown
# Source note: development can start before a private package

## Accepted
- Development of the universal evidence core does not wait for one private package.
- Worker, evidence owner, package assembler, reviewer, and submitter are distinct actors.
- Public regulations, forms, procurement attachments, and rejection records can seed realistic fixtures.
- Customer-specific forms are versioned templates, not hardcoded database tables.
- One private end-to-end example validates daily operations but does not define the whole product.

## Corrected by approved product decisions
- ICP remains specialized Ukrainian contractors as a hypothesis, not a universal actor invariant.
- Online mobile capture is in 0.1.0.
- Durable offline capture is deferred to 0.3.0.
- Public evidence does not authorize claims of legal acceptance or payment.

## Rejected
- One response disproves the ICP.
- A single package removes most uncertainty.
- Hundreds of additional cold emails are a prerequisite for development.
- Synthetic amounts or one-day windows are universal domain rules.
- KB-2v is the core database structure.

## Evidence required
- Each legal/normative claim needs an official URL, checked date, scope, and non-legal-advice caveat.
- The cited Prozorro package remains candidate_unverified until its attachments are retrieved and indexed.
```

Do not paste the attachment verbatim.

- [ ] **Step 2: Create the corpus method**

`discovery/public-corpus/README.md` must define:

- target: 10–20 public packages/rejection records;
- official/public sources only;
- no contact harvesting in this corpus;
- source statuses: `verified`, `candidate_unverified`, `unavailable`, `superseded`;
- extract only document types, fields, workflow/rejection signals, and provenance;
- no legal conclusion;
- no production rule promotion without a product decision and test fixture.

- [ ] **Step 3: Seed the corpus index**

Header:

```csv
source_id,source_type,title,authority,url,checked_at,access_status,document_types,workflow_signal,rejection_signal,product_usage,notes
```

Seed these official sources:

```text
DBN-A315-2016
https://e-construction.gov.ua/laws_detail/3113373519350597353?doc_type=2

KB2V-FORM
https://e-construction.gov.ua/files/upload/82159f90-3e25-11ec-8f92-33a6d0d35025.pdf

EDESSB-REMARKS-01
https://e-construction.gov.ua/document_detail/doc_id%3D2466165643649484612/optype%3D100

EDESSB-REMARKS-02
https://e-construction.gov.ua/document_detail/doc_id%3D2355264108669961383/optype%3D100

EDESSB-REMARKS-03
https://e-construction.gov.ua/document_detail/doc_id%3D2465227803247773538/optype%3D100
```

Add `UA-2018-11-21-003226-c` as `candidate_unverified`; do not state which attachments it contains until retrieved from an official procurement API/page.

- [ ] **Step 4: Reconcile discovery source contradictions**

Update `discovery/sources.md` so that:

- ProZorro is a verified identity/activity and candidate document source;
- the original “cannot yield contractor identities” conclusion is marked superseded by the extraction spike;
- a procurement award does not prove self-performance, document ownership, or contact permission;
- public corpus and outreach lead sourcing are separate purposes.

- [ ] **Step 5: Validate source coverage**

Add tests to `scripts/baseline-migration.test.mjs` asserting:

```js
import { readCsvFile } from "./baseline-migration.mjs";

test("public corpus rows have stable ids, https URLs, and allowed statuses", async () => {
  const rows = await readCsvFile("discovery/public-corpus/index.csv");
  const ids = rows.map((row) => row.source_id);
  const allowed = new Set([
    "verified",
    "candidate_unverified",
    "unavailable",
    "superseded",
  ]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(rows.every((row) => row.url.startsWith("https://")));
  assert.ok(rows.every((row) => allowed.has(row.access_status)));
});
```

Run:

```bash
node --test scripts/baseline-migration.test.mjs
pnpm verify:migration
```

Expected: PASS.

- [ ] **Step 6: Add inventory/ledger rows and commit**

Classify the attached source note as `KEEP` into `migration/baseline-0/source-notes/`. Classify the public corpus files as `KEEP` into `discovery/public-corpus/`.

Commit:

```bash
git add migration/baseline-0 discovery/public-corpus discovery/sources.md scripts/baseline-migration.test.mjs
git commit -m "docs: seed verified public evidence corpus"
```

## Plan 01 Completion Gate

Run:

```bash
pnpm verify:migration
pnpm --filter @aktflow/discovery typecheck
pnpm --filter @aktflow/discovery test
git status --short
```

Expected:

- migration validation passes;
- discovery tests pass;
- no private material is tracked;
- original dirty worktree is unchanged;
- no branch/worktree has been deleted;
- the isolated branch contains the approved spec, this plan, discovery integration, migration workspace, and public evidence seed.
