# GoProceed Baseline 0 — Repository Cleanup and Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved migration ledger, update public GoProceed branding, move or delete legacy artefacts safely, and establish deterministic verification that closes Baseline 0 without changing auth/RLS/migrations.

**Architecture:** The completed ledger from Plan 02 is the deletion allowlist: no path is moved or removed without a reviewed row. Public brand text is centralized while technical `@aktflow` and database identifiers remain stable. Fast, database, demo, and legacy checks are separate; every default check has a clean-tree assertion.

**Tech Stack:** Next.js 16.2.11, React 19.2, Vite 8.1.5, pnpm 9.12.0, Turborepo 2.5.4, Vitest 3.2.4, GitHub Actions, Supabase CLI, Python 3.12 for the legacy validator.

## Global Constraints

- GoProceed is the public brand; do not rename package scopes, database roles, migrations, environment keys, or repository remote.
- Keep `apps/landing`, `apps/app`, and `apps/demo`.
- Do not create `apps/mobile` or `/demo` in this plan.
- Do not modify auth, RLS, grants, or existing migration SQL.
- Keep the old demo URL available for sent outreach.
- Never delete a path whose ledger decision is not `DELETE`.
- Never move a path whose ledger decision is not `ARCHIVE`, `MERGE`, or `REWRITE`.
- Preserve Git recovery for every tracked deletion.
- Do not delete the original dirty worktree, private external folder, or any worktree before content checks pass.
- Node must satisfy `>=24 <25`.
- CI action majors must be selected individually; do not blanket-upgrade all actions to the same major.

---

## File Structure

```text
packages/brand/
├── package.json
├── tsconfig.json
├── src/index.ts
└── src/index.test.ts

reference/legacy-v2.9/
├── README.md
├── docs/
├── technical/
├── prototype/
└── design-references/

docs/archive/
├── audits/
├── completed-plans/
└── changelogs/

scripts/
├── verify-clean-tree.mjs
└── validate_package.py       # path model updated for legacy root

docs/releases/
└── baseline-0.md
```

### Task 1: Centralize public brand text without renaming technical identifiers

**Files:**
- Create: `packages/brand/package.json`
- Create: `packages/brand/tsconfig.json`
- Create: `packages/brand/src/index.ts`
- Create: `packages/brand/src/index.test.ts`
- Modify: `apps/landing/package.json`
- Modify: `apps/app/package.json`
- Modify: `apps/demo/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/landing/app/layout.tsx`
- Modify: `apps/landing/app/page.tsx`
- Modify: `apps/app/app/(auth)/login/page.tsx`
- Modify: `apps/demo/src/pages/Landing.tsx`
- Modify: `apps/demo/src/pages/Pilot.tsx`
- Modify: `apps/demo/src/pages/Demo.tsx`
- Modify: `apps/demo/src/pages/Roadmap.tsx`
- Modify: `apps/demo/src/components/AppShell.tsx`
- Modify: `apps/demo/src/pilot/draft.ts`
- Modify: `apps/demo/tests/draft.test.ts`

**Interfaces:**
- Consumes: internal package namespace `@aktflow/brand`.
- Produces:

```ts
export const PUBLIC_BRAND_NAME = "GoProceed";
export const PUBLIC_BRAND_DESCRIPTION =
  "Evidence-to-payment workflow for construction acceptance.";
```

- [ ] **Step 1: Write failing brand tests**

Create the package manifest, TypeScript config, and test file first, but do not
create `src/index.ts` yet.

```ts
import { describe, expect, it } from "vitest";
import {
  PUBLIC_BRAND_DESCRIPTION,
  PUBLIC_BRAND_NAME,
} from "./index";

describe("public brand", () => {
  it("uses the approved public name", () => {
    expect(PUBLIC_BRAND_NAME).toBe("GoProceed");
    expect(PUBLIC_BRAND_DESCRIPTION).not.toContain("AktFlow");
  });
});
```

Run:

```bash
pnpm install --lockfile-only
pnpm --filter @aktflow/brand test
```

Expected: FAIL because `src/index.ts` does not exist.

- [ ] **Step 2: Implement the package entry point**

Use this already-created `packages/brand/package.json`:

```json
{
  "name": "@aktflow/brand",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "5.9.2",
    "vitest": "3.2.4"
  }
}
```

`packages/brand/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Export the two constants exactly as defined in Interfaces.

- [ ] **Step 3: Update public surfaces**

Add `"@aktflow/brand": "workspace:*"` to the dependencies of
`apps/landing`, `apps/app`, and `apps/demo`, then refresh the lockfile.

Replace user-visible `AktFlow` with `GoProceed` in:

- landing metadata and page;
- app login heading;
- demo landing, pilot, roadmap, demo flow, application shell, legal copy, email subject, and accessibility labels.

Do not rename:

- `.aktflow-app` CSS class;
- `aktflow.pilot.draft` localStorage key;
- `@aktflow/*` imports;
- `AKTFLOW_CHROME_PATH`;
- database roles;
- migration content.

Add a one-release compatibility read for the old localStorage key if public draft storage is renamed. The old key must not be deleted before its value is copied.

- [ ] **Step 4: Add a public-brand scan**

Extend `scripts/baseline-migration.mjs` to scan public UI text and fail on `AktFlow`, while allowing:

```text
@aktflow/
aktflow_app
aktflow_app_login
.aktflow-app
aktflow.pilot.draft
AKTFLOW_CHROME_PATH
reference/legacy-v2.9/
docs/archive/
migration/baseline-0/
```

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @aktflow/brand test
pnpm --filter @aktflow/brand typecheck
pnpm --filter @aktflow/landing typecheck
pnpm --filter @aktflow/app typecheck
pnpm --filter @aktflow/demo typecheck
pnpm verify:docs
git diff --check
```

```bash
git add packages/brand apps package.json pnpm-lock.yaml scripts
git commit -m "feat: apply GoProceed public branding"
```

### Task 2: Replace hardcoded public URLs with environment-owned configuration

**Files:**
- Create: `packages/brand/src/urls.ts`
- Create: `packages/brand/src/urls.test.ts`
- Modify: `apps/landing/app/page.tsx`
- Create: `apps/landing/.env.example`
- Modify: `apps/app/.env.example`
- Create: `apps/demo/.env.example`
- Modify: `docs/current/ARCHITECTURE.md`
- Modify: `docs/current/STATUS.md`

**Interfaces:**
- Produces:

```ts
export type PublicUrls = {
  landingUrl: string | null;
  appUrl: string | null;
  demoUrl: string;
};

export function resolvePublicUrls(input: {
  landingUrl?: string;
  appUrl?: string;
  demoUrl?: string;
}): PublicUrls;
```

- [ ] **Step 1: Write failing URL tests**

```ts
import { resolvePublicUrls } from "./urls";

it("uses configured URLs without assuming a custom domain", () => {
  expect(resolvePublicUrls({
    landingUrl: "https://goproceed-landing.vercel.app",
    appUrl: "https://goproceed-app.vercel.app",
    demoUrl: "https://aktflow-demo.vercel.app",
  })).toEqual({
    landingUrl: "https://goproceed-landing.vercel.app",
    appUrl: "https://goproceed-app.vercel.app",
    demoUrl: "https://aktflow-demo.vercel.app",
  });
});

it("keeps unknown deployments unset and preserves the sent demo URL", () => {
  expect(resolvePublicUrls({})).toEqual({
    landingUrl: null,
    appUrl: null,
    demoUrl: "https://aktflow-demo.vercel.app",
  });
});
```

- [ ] **Step 2: Implement strict URL resolution**

Reject non-HTTPS values outside localhost. Missing landing or app values stay
`null`; the UI must omit or disable the corresponding link instead of
rendering a broken destination. The demo URL defaults to the already-sent
`https://aktflow-demo.vercel.app` address. Do not invent an actual Vercel
project name. Create `apps/landing/.env.example` and extend
`apps/app/.env.example` with:

```dotenv
NEXT_PUBLIC_LANDING_URL=https://<landing-project>.vercel.app
NEXT_PUBLIC_APP_URL=https://<app-project>.vercel.app
NEXT_PUBLIC_DEMO_URL=https://aktflow-demo.vercel.app
```

Create `apps/demo/.env.example` with the Vite equivalents:

```dotenv
VITE_LANDING_URL=https://<landing-project>.vercel.app
VITE_APP_URL=https://<app-project>.vercel.app
VITE_DEMO_URL=https://aktflow-demo.vercel.app
```

Landing and app map `process.env.NEXT_PUBLIC_*` into `resolvePublicUrls`.
The Vite demo maps `import.meta.env.VITE_*` into the same function.

- [ ] **Step 3: Replace embedded links and update docs**

Landing uses configured demo/app URLs. Current demo retains its old deployment URL. Document that the future switch to `APP_URL/demo` requires the parity gate.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @aktflow/brand test
pnpm --filter @aktflow/landing build
pnpm --filter @aktflow/demo test
pnpm --filter @aktflow/demo build
```

```bash
git add packages/brand apps docs/current
git commit -m "feat: configure public GoProceed URLs"
```

### Task 3: Normalize project tooling and local-only files

**Files:**
- Create: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `.gitignore`
- Create after validation: `skills-lock.json`
- Move outside Git after validation:
  `/Users/akisliy/Downloads/aktflow-product-package 2/apps/demo/.gitignore`
  → `/Users/akisliy/Downloads/GoProceed-private/recovery/apps-demo.gitignore`
- Move outside Git after validation:
  `/Users/akisliy/Downloads/aktflow-product-package 2/apps/demo/.nvmrc`
  → `/Users/akisliy/Downloads/GoProceed-private/recovery/apps-demo.nvmrc`
- Modify: `migration/baseline-0/migration-ledger.csv`
- Modify: `migration/baseline-0/preservation-manifest.md`

**Interfaces:**
- Consumes: the reviewed root instructions, root Node version, generated local
  skill directories, and the current skill lock.
- Produces: one canonical instruction source, one Node version source, tracked
  reproducible skill metadata, and ignored generated tool state.

- [ ] **Step 1: Add tooling rows to the ledger**

Record exact decisions for:

```text
AGENTS.md
CLAUDE.md
skills-lock.json
.agents/
.claude/
apps/demo/.gitignore
apps/demo/.nvmrc
```

`AGENTS.md` is `KEEP`. `CLAUDE.md` is `REWRITE` to a short pointer to
`AGENTS.md`. `.agents/` and `.claude/` are local generated state and remain
ignored. The original-only nested demo ignore and Node files are `ARCHIVE`
only after the root files are shown to cover the same rules.

- [ ] **Step 2: Validate the skill lock before tracking**

Read the original worktree locations for `AGENTS.md` and `skills-lock.json`
from the preservation manifest. Recreate them in the isolated worktree with
`apply_patch`, then compare SHA-256 hashes with the captured originals.

Parse `skills-lock.json` as JSON and fail if it contains a secret-like value,
an absolute home path, an email address, or a path outside the repository.
The lock may record public package sources, relative skill paths, versions,
and hashes. If the validation fails, stop and leave it untracked; do not
silently sanitize evidence. Do not import any other untracked original file
in this step.

- [ ] **Step 3: Canonicalize instructions and local ignores**

Keep the approved workflow in `AGENTS.md`. Replace duplicated tracked
`CLAUDE.md` content with a pointer that says all project agents must follow
`AGENTS.md`.
Ensure `.gitignore` contains:

```gitignore
.agents/
.claude/
.env*
!.env.example
!.env.*.example
```

Keep the root `.nvmrc` value `24`. After confirming the original nested
`.nvmrc` has the same value and its hash is recorded, move it to the exact
external recovery path listed above. After confirming every nested ignore
rule is covered by the root ignore and its hash is recorded, move the nested
ignore file to its exact external recovery path. Do not overwrite an existing
recovery file; compare hashes and stop on a mismatch.

- [ ] **Step 4: Verify and commit**

```bash
node -e 'JSON.parse(require("node:fs").readFileSync("skills-lock.json","utf8"))'
test "$(cat .nvmrc)" = "24"
git check-ignore -v .agents/example .claude/example apps/demo/.env.local
pnpm verify:migration
git diff --check
```

```bash
git add AGENTS.md CLAUDE.md skills-lock.json .gitignore migration/baseline-0
git commit -m "chore: normalize project tooling metadata"
```

### Task 4: Apply the ledger and move legacy sources

**Files:**
- Move: `docs/00-*.md` through `docs/40-*.md` → `reference/legacy-v2.9/docs/`
- Move: `technical/` → `reference/legacy-v2.9/technical/`
- Move: `prototype/` → `reference/legacy-v2.9/prototype/`
- Move: `design-references/` → `reference/legacy-v2.9/design-references/`
- Move: `ARCHITECTURE-AUDIT-ANSWERS.md` → `docs/archive/audits/`
- Move: `CHANGELOG-*.md` → `docs/archive/changelogs/`
- Move: completed old plans → `docs/archive/completed-plans/`
- Create: `reference/legacy-v2.9/README.md`
- Create: `migration/baseline-0/reports/move-plan.txt`
- Modify: source references throughout tracked Markdown/code comments
- Modify: `migration/baseline-0/migration-ledger.csv`

**Interfaces:**
- Consumes: final migration ledger with no `UNREVIEWED` rows.
- Produces:
  - active docs at `docs/current`;
  - legacy package under one explicit root;
  - `findLegacyPathReferences(options): Promise<string[]>`;
  - no unresolved relative links.

- [ ] **Step 1: Add a failing path-reference test**

Extend `scripts/baseline-migration.test.mjs`:

```js
test("active files do not reference removed legacy root paths", async () => {
  const errors = await findLegacyPathReferences({
    roots: ["README.md", "docs/current", "docs/decisions", "apps", "packages", "infra"],
    allowRoots: ["reference/legacy-v2.9", "docs/archive", "migration/baseline-0"],
  });
  assert.deepEqual(errors, []);
});
```

Expected before path updates: FAIL.

- [ ] **Step 2: Move only ledger-authorized paths**

Generate `migration/baseline-0/reports/move-plan.txt` from reviewed ledger
rows. Every line must contain one exact repository-relative source and one
exact destination; broad directories and globs are forbidden in this
executable list. Review the list, then before each move assert the ledger
decision and destination match. Move one exact path at a time and stop on any
mismatch.

Keep the new Baseline 0 spec and plan suite under `docs/superpowers/`; archive only completed older plans/specs classified `ARCHIVE`.

- [ ] **Step 3: Write the legacy README**

Required content:

- package status: historical target/reference, not current runtime;
- original package version: v2.9;
- active replacements;
- legacy validation command;
- no product readiness claim;
- Git history recovery note.

- [ ] **Step 4: Implement and use the path-reference checker**

Add `findLegacyPathReferences` to `scripts/baseline-migration.mjs`. It must
walk only the supplied roots, skip the supplied allow-roots, inspect UTF-8
text files, and return entries formatted as:

```text
relative/path:line:stale reference
```

Then run:

Run:

```bash
rg -n 'docs/(0[0-9]|[1-3][0-9]|40)-|technical/|prototype/|design-references/' \
  README.md docs/current docs/decisions apps packages infra scripts Makefile .github
```

Update each result to either:

- an active doc;
- the corresponding destination under `reference/legacy-v2.9`;
- an ADR.

- [ ] **Step 5: Validate and commit**

```bash
node --test scripts/baseline-migration.test.mjs
pnpm verify:migration
pnpm verify:docs
git diff --check
```

```bash
git add README.md docs reference apps packages infra scripts Makefile .github migration/baseline-0
git commit -m "docs: separate active and legacy product sources"
```

### Task 5: Remove duplicate and generated legacy artefacts

**Files:**
- Delete after path update: duplicate copies listed below
- Modify: legacy prototype asset imports
- Modify: legacy prototype QA writer
- Modify: `scripts/validate_package.py`
- Modify: `Makefile`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: legacy root from Task 4.
- Produces: one canonical copy of each large image and untracked generated QA output.

- [ ] **Step 1: Verify duplicate hashes**

Confirm these pairs remain byte-identical:

```text
design-references/evidence-atlas/assets/cable-tray-evidence.png
prototype/public/assets/evidence-atlas/cable-tray-evidence.png

design-references/evidence-atlas/assets/blueprint-folio.png
prototype/public/assets/evidence-atlas/blueprint-folio.png

design-references/evidence-atlas/assets/verified-stamp.png
prototype/public/assets/evidence-atlas/verified-stamp.png

design-references/evidence-atlas/selected-direction.png
design-references/visual-directions/02-evidence-atlas.png
```

After Task 4, use the corresponding paths under
`reference/legacy-v2.9/design-references` and
`reference/legacy-v2.9/prototype`.

- [ ] **Step 2: Keep one canonical copy and update imports**

Keep the copy actually served by the legacy prototype for its three runtime assets. Delete the duplicate design-reference copies. Keep `visual-directions/02-evidence-atlas.png`; delete `selected-direction.png`.

Update the legacy README with canonical asset locations.

- [ ] **Step 3: Make legacy QA output untracked**

Change the legacy QA harness to write:

```text
reference/legacy-v2.9/prototype/qa-output/
```

Remove tracked generated screenshots and `qa-results.json` only after the validator reads the generated output path.

Add the output path to `.gitignore`.

- [ ] **Step 4: Rename validation commands**

`Makefile` targets:

```make
validate-legacy:
	# lint/build/qa legacy package and validate its internal contracts

validate:
	@echo "Use pnpm verify for current GoProceed; use make validate-legacy for legacy v2.9."
```

Do not keep a default command that mutates tracked files.

- [ ] **Step 5: Verify clean-tree behavior and commit**

Capture:

```bash
before=$(git status --porcelain)
make validate-legacy
after=$(git status --porcelain)
test "$before" = "$after"
```

Expected: PASS.

```bash
git add -A reference Makefile scripts .gitignore
git commit -m "chore: remove duplicate and generated legacy assets"
```

### Task 6: Split fast, database, demo, and legacy verification

**Files:**
- Create: `scripts/verify-clean-tree.mjs`
- Create: `scripts/verify-clean-tree.test.mjs`
- Modify: `package.json`
- Modify: `apps/app/package.json`
- Modify: `apps/demo/package.json`
- Modify: `packages/contracts/package.json`
- Modify: `packages/domain/package.json`
- Modify: `packages/database/package.json`
- Modify: `packages/testing/package.json`
- Modify: `packages/brand/package.json`
- Modify: `turbo.json`
- Modify: `docs/current/DELIVERY.md`
- Modify: `docs/current/VALIDATION.md`

**Interfaces:**
- Produces package commands:

```text
pnpm verify
pnpm verify:db
pnpm verify:demo
pnpm verify:legacy
pnpm verify:all
```

- [ ] **Step 1: Write failing clean-tree tests**

`verify-clean-tree.mjs` is invoked as:

```text
node scripts/verify-clean-tree.mjs -- pnpm verify:fast
```

It captures `git status --porcelain` before and after, runs the child command, and fails if:

- child exit code is non-zero;
- status differs;
- new untracked output appears outside ignored paths.

Test with a temporary Git repository using `node:test`.

- [ ] **Step 2: Split app unit and DB tests**

`apps/app/package.json`:

```json
"test:unit": "vitest run src",
"test:db": "vitest run tests"
```

`packages/database` and `packages/testing` expose `test:db`. `packages/contracts`, `packages/domain`, `apps/demo`, and brand expose `test:unit`.

- [ ] **Step 3: Add root verification commands**

```json
"verify": "node scripts/verify-clean-tree.mjs -- pnpm verify:fast",
"verify:fast": "pnpm verify:docs && pnpm typecheck && pnpm test:unit && pnpm build",
"test:unit": "turbo run test:unit",
"verify:db": "turbo run test:db --concurrency=1",
"verify:demo": "pnpm --filter @aktflow/demo lint && pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa",
"verify:legacy": "make validate-legacy",
"verify:all": "pnpm verify && pnpm verify:db && pnpm verify:demo && pnpm verify:legacy"
```

Ensure Turborepo tasks exist for `test:unit` and `test:db`.

- [ ] **Step 4: Verify locally**

Without Docker:

```bash
pnpm verify
pnpm verify:demo
pnpm verify:legacy
```

Expected: PASS and clean tree.

With Supabase running:

```bash
supabase start
supabase db reset
pnpm verify:db
```

Expected: PASS with database suites serialized.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml turbo.json apps packages scripts docs/current
git commit -m "test: establish truthful verification commands"
```

### Task 7: Update CI with exact action majors and clean-tree gates

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/current/DELIVERY.md`
- Modify: `docs/current/STATUS.md`

**Interfaces:**
- Consumes: root verification commands.
- Produces: CI jobs `fast`, `database`, `demo`, and `legacy`, each calling the same local command.

- [ ] **Step 1: Replace duplicated CI command sequences**

Jobs:

```text
fast      → pnpm verify
database  → Supabase start/reset → pnpm verify:db
demo      → browser prerequisites → pnpm verify:demo
legacy    → Python/npm prerequisites → pnpm verify:legacy
```

- [ ] **Step 2: Update actions individually**

Use the reviewed majors current at implementation time:

```text
actions/checkout@v6
actions/setup-node@v6
actions/setup-python@v6
pnpm/action-setup@v6
supabase/setup-cli@v2
actions/upload-artifact@v7
```

Before editing, confirm each major exists in its official repository. If an official action has a different current major, use that verified major and record the URL in the commit message body. Never apply a blanket `v7`.

- [ ] **Step 3: Assert clean trees**

Every job that runs generators must finish with:

```bash
git status --porcelain
test -z "$(git status --porcelain)"
```

- [ ] **Step 4: Validate workflow and commit**

Run available local YAML/workflow validation plus:

```bash
pnpm verify
git diff --check .github/workflows/ci.yml
```

```bash
git add .github/workflows/ci.yml docs/current
git commit -m "ci: align current verification gates"
```

### Task 8: Remove obsolete local and remote work only after preservation checks

**Files:**
- Modify: `migration/baseline-0/preservation-manifest.md`
- Modify: `migration/baseline-0/migration-ledger.csv`
- No product source changes.

**Interfaces:**
- Consumes: preservation manifest, merged discovery branch, archived P0-A reviews, and user confirmation for remote deletion.
- Produces: reduced local worktree/branch clutter with recovery SHAs recorded.

- [ ] **Step 1: Verify integrated content**

For each candidate worktree/branch, record:

- HEAD SHA;
- unique commit count versus cleanup branch;
- untracked file count;
- destination commit/path for preserved content.

Stop if unique or untracked work lacks a destination.

- [ ] **Step 2: Remove only local obsolete worktrees**

Use exact paths returned by `git worktree list --porcelain`. Never use globs, `$HOME`, `~`, or a broad directory.

Resolve and record the candidate's literal absolute path and literal HEAD SHA
from the two read-only commands above. Validate that the path is one exact
registered worktree and is not the repository root or the Baseline 0
worktree. Then run `status` and `merge-base --is-ancestor` using those literal
values. Do not construct the target from an environment variable, command
substitution, or glob.

If the worktree is dirty or the ancestry check fails, do not remove it. If
both checks pass, remove only that single literal worktree path.

- [ ] **Step 3: Prune stale local metadata**

```bash
git worktree prune --dry-run
git worktree prune
git remote set-head origin -a
```

Expected: `origin/HEAD` points to `origin/main`.

- [ ] **Step 4: Do not delete remote branches without explicit approval**

List remote deletion candidates and recovery SHAs in the manifest. Stop before `git push --delete`; remote deletion is a separate external-state approval.

- [ ] **Step 5: Commit manifest updates**

```bash
git add migration/baseline-0
git commit -m "chore: record preserved branch cleanup"
```

### Task 9: Close Baseline 0

**Files:**
- Create: `docs/releases/baseline-0.md`
- Modify: `docs/current/STATUS.md`
- Modify: `docs/current/ROADMAP.md`
- Modify: `spec/features.yaml`
- Modify: `migration/baseline-0/README.md`
- Modify: `migration/baseline-0/migration-ledger.csv`

**Interfaces:**
- Consumes: all Plan 01–03 gates.
- Produces: release evidence for internal Baseline 0 and an explicit next plan boundary for `0.1.0`.

- [ ] **Step 1: Write the release evidence**

Required sections:

```markdown
# Baseline 0 Release Evidence

## Outcome
## Preserved work
## Active documentation
## Public brand
## Legacy disposition
## Verification commands and results
## Known limitations
## Deferred technical rename
## 0.1.0 entry criteria
## Recovery references
```

- [ ] **Step 2: Update current status and roadmap**

Set Baseline 0 to closed only if all gates pass. Do not mark product feature `0.1.0` as released.

- [ ] **Step 3: Run the full gate**

```bash
pnpm verify
pnpm verify:db
pnpm verify:demo
pnpm verify:legacy
node scripts/baseline-migration.mjs --check-final
git status --short
```

Expected:

- every command passes;
- final status contains only the intended release-evidence changes before commit;
- no private files are tracked;
- no active doc refers to old public branding or stale target readiness.

- [ ] **Step 4: Commit**

```bash
git add docs/releases/baseline-0.md docs/current spec/features.yaml migration/baseline-0
git commit -m "chore: close GoProceed baseline zero"
```

- [ ] **Step 5: Final clean verification**

```bash
pnpm verify
git status --porcelain
```

Expected: PASS and no output from Git status.

## Plan 03 Completion Gate

Baseline 0 is complete only if:

- GoProceed is the public name across active surfaces;
- technical `aktflow` identifiers remain stable and documented;
- active docs and feature registry are the only current source of truth;
- legacy sources are consolidated under `reference/legacy-v2.9` or deleted per ledger;
- generated QA output does not dirty Git;
- `verify`, `verify:db`, `verify:demo`, and `verify:legacy` have truthful prerequisites;
- private outreach material remains outside Git;
- remote branches have not been deleted without explicit approval;
- `docs/releases/baseline-0.md` contains reproducible evidence.
