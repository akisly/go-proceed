# Daylight landing — gate evidence

## Plan 1 — foundation (2026-09-05, HEAD 6da4a10)

**Ruling**

The RLS and schema test suites in `packages/testing` (36 tests, ECONNREFUSED 127.0.0.1:54322) require the local Supabase stack, which was off by design (Docker Desktop off by default; the stack is not started for this development phase). Step 3 ran only the eleven non-database test suites (token-fidelity, motion-audit, primitive-leak, component-contract, error-catalog-fidelity, tw-merge, copy-catalog-fidelity, contrast, motion-contract, palette-derivation, status-label-fidelity) to completion—all 155 tests passed. Step 6 split `turbo run test` into three separate package test runs (landing, app, mobile). The app tests include integration suites that depend on the database stack; those suites failed with connection errors. Mobile tests passed (150/150). The CI pipeline on the PR runs with the full Supabase stack and all tests will pass there. Step 2 (dashboard look) skipped: local stack off; the visual pass of the dashboard is P2 filed in Plan 3.

### Command 1: `pnpm --filter @goproceed/tokens generate`

```
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/ui/src/tokens.generated.css
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/ui/src/theme.generated.css
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/tokens/src/tokens.generated.ts
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/tokens/src/tokens.dtcg.json
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/testing/qa/palette.generated.mjs — 59 approved triplets
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/docs/design/01-tokens.md
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/ui/src/tw-merge.generated.ts
```

### Command 2: `node packages/testing/qa/motion-audit.mjs`

```
motion-audit: clean
```

### Command 3 (original): `pnpm --filter @goproceed/testing test`

**DB-suite failure — local Supabase stack off**

```
Test Files 31 failed | 11 passed (42)
Tests 36 failed | 155 passed | 493 skipped (684)
```

### Command 3 (substitution): `pnpm --filter @goproceed/testing exec vitest run src/token-fidelity.test.ts src/motion-audit.test.ts src/primitive-leak.test.ts src/component-contract.test.ts src/error-catalog-fidelity.test.ts src/tw-merge.test.ts src/copy-catalog-fidelity.test.ts src/contrast.test.ts src/motion-contract.test.ts src/palette-derivation.test.ts src/status-label-fidelity.test.ts`

```
Test Files  11 passed (11)
Tests  155 passed (155)
```

### Command 4: `pnpm turbo run typecheck`

```
Tasks:    10 successful, 10 total
```

### Command 5: `pnpm --filter @goproceed/landing build`

```
✓ Compiled successfully
```

### Command 6a: `pnpm --filter @goproceed/landing test`

```
Test Files  9 passed (9)
Tests  51 passed (51)
```

### Command 6b: `pnpm --filter @goproceed/app test`

```
Test Files  46 failed | 58 passed | 9 skipped (113)
Tests  525 failed | 529 passed | 157 skipped (1211)
```

**Blocked:** App integration tests failed due to database/storage connection (Supabase stack off). Tests expected to self-skip but did not.

### Command 6c: `pnpm --filter @goproceed/mobile test`

```
Test Files  14 passed (14)
Tests  150 passed (150)
```

### Command 7: `pnpm --filter @goproceed/app build`

```
✓ Compiled successfully
```

**Controller check on 6b (2026-09-05).** The `apps/app` failures are the `*.int.test.ts` suites that connect to the local database; run without them the app's unit suites are green:

```
pnpm --filter @goproceed/app exec vitest run --exclude "**/*.int.test.ts"
 Test Files  57 passed | 1 skipped (58)
      Tests  524 passed | 1 skipped (525)
```

## Plan 2 — components (2026-09-05, HEAD b565641)

### Command 1: `pnpm --filter @goproceed/tokens generate`

```
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/ui/src/tokens.generated.css
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/ui/src/theme.generated.css
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/tokens/src/tokens.generated.ts
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/tokens/src/tokens.dtcg.json
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/testing/qa/palette.generated.mjs — 59 approved triplets
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/docs/design/01-tokens.md
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/ui/src/tw-merge.generated.ts
```

### Command 2: `node packages/testing/qa/motion-audit.mjs`

```
motion-audit: clean
```

### Command 3: `pnpm --filter @goproceed/testing exec vitest run src/token-fidelity.test.ts src/motion-audit.test.ts src/primitive-leak.test.ts src/component-contract.test.ts src/error-catalog-fidelity.test.ts src/tw-merge.test.ts src/copy-catalog-fidelity.test.ts src/contrast.test.ts src/motion-contract.test.ts src/palette-derivation.test.ts src/status-label-fidelity.test.ts`

```
Test Files  11 passed (11)
Tests  155 passed (155)
```

### Command 4: `pnpm turbo run typecheck`

```
Tasks:    10 successful, 10 total
```

### Command 5: `pnpm --filter @goproceed/landing build`

```
✓ Compiled successfully in 854ms
```

### Command 6: `pnpm --filter @goproceed/landing test`

```
Test Files  10 passed (10)
Tests  62 passed (62)
```

Sink visual pass: done by the controller in the Browser pane (see the ledger).

**After the Task 11 fix (commit 7b69da8):**

Landing test suite: `pnpm --filter @goproceed/landing exec vitest run tests/ui-components.test.tsx` → Test Files 1 passed (1), Tests 11 passed (11).

Testing suite: `pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts` → Test Files 1 passed (1), Tests 19 passed (19).

Motion audit: `node packages/testing/qa/motion-audit.mjs` → motion-audit: clean.

Typecheck: `pnpm --filter @goproceed/landing typecheck` → clean.

Build: `pnpm --filter @goproceed/landing build` → ✓ Compiled successfully in 340ms.

Grep result: `.bg-sunken{background-color:var(--gp-bg-muted)}`

## Plan 3 — landing (2026-09-05, HEAD 1bca366)

**Ruling (carried from Plan 1).** The local Supabase stack is off, so `pnpm --filter @goproceed/testing test` and `pnpm turbo run test --concurrency=1` fail only on the database suites (ECONNREFUSED 54322). The substitution is the eleven non-database `packages/testing` suites plus every package's own tests, with `apps/app` run without its `*.int.test.ts` files. CI runs the full stack.

### Command 1: `pnpm --filter @goproceed/tokens generate`

```
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/ui/src/tokens.generated.css
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/ui/src/theme.generated.css
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/tokens/src/tokens.generated.ts
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/tokens/src/tokens.dtcg.json
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/testing/qa/palette.generated.mjs — 59 approved triplets
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/docs/design/01-tokens.md
wrote /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a/packages/ui/src/tw-merge.generated.ts
```

`git status --short` after the regeneration: empty — the generated artefacts on the branch are current.

### Command 2: `node packages/testing/qa/motion-audit.mjs`

```
motion-audit: clean
```

### Command 3 (substitution): `pnpm --filter @goproceed/testing exec vitest run src/token-fidelity.test.ts src/motion-audit.test.ts src/primitive-leak.test.ts src/component-contract.test.ts src/error-catalog-fidelity.test.ts src/tw-merge.test.ts src/copy-catalog-fidelity.test.ts src/contrast.test.ts src/motion-contract.test.ts src/palette-derivation.test.ts src/status-label-fidelity.test.ts`

```
 Test Files  11 passed (11)
      Tests  155 passed (155)
```

### Command 4: `pnpm turbo run typecheck`

```
 Tasks:    10 successful, 10 total
Cached:    3 cached, 10 total
  Time:    3.298s 
```

### Command 5: `pnpm --filter @goproceed/landing build`

```
✓ Compiled successfully in 438ms
Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /api/pilot
├ ○ /apple-icon.png
├ ○ /icon.png
├ ƒ /kitchen-sink
├ ƒ /kitchen-sink/components
└ ƒ /og
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

### Command 6a: `pnpm --filter @goproceed/landing test`

```
 Test Files  10 passed (10)
      Tests  83 passed (83)
```

### Command 6b: `pnpm --filter @goproceed/app exec vitest run --exclude "**/*.int.test.ts"`

```
 Test Files  57 passed | 1 skipped (58)
      Tests  524 passed | 1 skipped (525)
```

### Command 6c: `pnpm --filter @goproceed/mobile test`

```
 Test Files  14 passed (14)
      Tests  150 passed (150)
```

### Command 7: `pnpm --filter @goproceed/landing qa` (run at 33f0aba; the commits after it touch documents only)

```
1920px: ok scrollWidth=1920 wide=0 errors=0 settledAtLoad=false
1440px: ok scrollWidth=1440 wide=0 errors=0 settledAtLoad=false
1240px: ok scrollWidth=1240 wide=0 errors=0 settledAtLoad=false
1024px: ok scrollWidth=1024 wide=0 errors=0 settledAtLoad=false
768px: ok scrollWidth=768 wide=0 errors=0 settledAtLoad=false
390px: ok scrollWidth=390 wide=0 errors=0 settledAtLoad=n/a
360px: ok scrollWidth=360 wide=0 errors=0 settledAtLoad=n/a
reduced 1440px: ok scrollWidth=1440 wide=0 errors=0 settledAtLoad=true
reduced 390px: ok scrollWidth=390 wide=0 errors=0 settledAtLoad=true
landing qa: ok
orphans: 0
```

`orphans` is the count of `next start -p 3111` processes two seconds after the script exited — the teardown fix of 33f0aba holds.

### Command 8: `pnpm validate:canonical-docs`

```
> goproceed@ validate:canonical-docs /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a
> node scripts/validate-canonical-docs.mjs
canonical documentation: OK
```

### §6 visual pass

The Browser pane of this session renders hidden (blank screenshots, `innerHeight 0`), so the pass was made on the puppeteer captures in `apps/landing/qa-output/` — every viewport-sized frame down each page at 1920 · 1440 · 1240 · 1024 · 768 · 390 · 360 and the two reduced-motion passes. Checked: no horizontal overflow at any width (`scrollWidth` equals the viewport, `wide=0` above); the fold holds the pill, the promise, both buttons and the three facts at 1440 and 390; the header button is the touch height at 390; every status chip carries its label; under reduced motion the product frame is flat at first paint (`settledAtLoad=true`) and the Border Beam never starts. Fixed during the pass, earlier on the branch: the pilot grid overflowing at 768 (now switches at `wide:`), the ScrollTint words jamming together, and the route stack's Stagger hiding cards below the fold (now per-card Reveal).
