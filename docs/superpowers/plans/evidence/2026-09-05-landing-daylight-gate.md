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
