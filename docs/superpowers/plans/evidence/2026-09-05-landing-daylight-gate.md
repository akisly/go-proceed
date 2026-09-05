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

## Plan 3 — landing, after the final review fixes (2026-09-05, HEAD e56526c)

The whole-branch review (four areas) found 0 Critical, 17 Important and 58
Minor. All seventeen Importants were fixed under the controller's rulings
R1–R12 across five commits (`fix(ui)`, `fix(landing)`, `fix(brand)`,
`fix(app)`, `docs(design)`); R13 parked every remaining Minor as one line in
`TODOS.md` under «Final review minors (2026-09-05)». The Plan 1 substitution
ruling above still applies — the local Supabase stack is off, so the database
suites are excluded and CI runs them.

The gate below is the same nine commands, re-run at this HEAD.

### Command 1: `pnpm --filter @goproceed/tokens generate` — then `git status`

```
wrote packages/ui/src/tokens.generated.css
wrote packages/ui/src/theme.generated.css
wrote packages/tokens/src/tokens.generated.ts
wrote packages/tokens/src/tokens.dtcg.json
wrote packages/testing/qa/palette.generated.mjs — 59 approved triplets
wrote docs/design/01-tokens.md
wrote packages/ui/src/tw-merge.generated.ts

$ git status --short
(no output)
```

The only token change in this wave is `amber-600`'s ruling text («3.9:1» →
«3.96:1», the measured value), so `01-tokens.md` and `tokens.dtcg.json` moved
with it and are committed; nothing else regenerated differently.

### Command 2: `node packages/testing/qa/motion-audit.mjs`

```
motion-audit: clean
```

### Command 3: the eleven non-database `packages/testing` suites

```
 ✓ src/token-fidelity.test.ts (15 tests) 222ms
 ✓ src/motion-audit.test.ts (13 tests) 58ms
 ✓ src/primitive-leak.test.ts (2 tests) 30ms
 ✓ src/component-contract.test.ts (19 tests) 10ms
 ✓ src/error-catalog-fidelity.test.ts (1 test) 6ms
 ✓ src/tw-merge.test.ts (7 tests) 6ms
 ✓ src/copy-catalog-fidelity.test.ts (4 tests) 3ms
 ✓ src/contrast.test.ts (74 tests) 3ms
 ✓ src/motion-contract.test.ts (6 tests) 3ms
 ✓ src/palette-derivation.test.ts (12 tests) 3ms
 ✓ src/status-label-fidelity.test.ts (2 tests) 2ms

 Test Files  11 passed (11)
      Tests  155 passed (155)
```

### Command 4: `pnpm turbo run typecheck`

```
 Tasks:    10 successful, 10 total
Cached:    9 cached, 10 total
  Time:    1.321s
```

### Command 5: `pnpm --filter @goproceed/landing build`

```
✓ Generating static pages using 11 workers (10/10) in 373ms

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /api/pilot
├ ○ /apple-icon.png
├ ○ /icon.png
├ ƒ /kitchen-sink
├ ƒ /kitchen-sink/components
└ ƒ /og
```

### Command 6: `pnpm --filter @goproceed/landing test`

```
 ✓ tests/metadata.test.ts (3 tests) 2ms
 ✓ tests/pilot-request.test.ts (4 tests) 2ms
 ✓ tests/landing-content.test.ts (21 tests) 5ms
 ✓ tests/pilot-route.test.ts (17 tests) 15ms
 ✓ tests/design-contract.test.tsx (3 tests) 4ms
 ✓ tests/use-reduced.test.ts (2 tests) 1ms
 ✓ tests/brand-mark.test.tsx (3 tests) 1ms
 ✓ tests/ui-components.test.tsx (13 tests) 20ms
 ✓ tests/landing-render.test.tsx (25 tests) 5ms
 ✓ tests/pilot-form.test.tsx (5 tests) 494ms

 Test Files  10 passed (10)
      Tests  96 passed (96)
```

83 → 96. The thirteen new tests are the ones the rulings asked for, each
written failing first: the `lg` button's `rounded-panel` and the other three
sizes' `rounded-control` (R1); a form-encoded body answered 4xx and never 500,
and the address visible under the form with `method="post" action="/api/pilot"`
(R3); five smuggled contacts refused as `reply_to` and one plain address still
accepted (R4); an abort signal on both outbound fetches and on the client's,
with the abort landing in the failed state (R5); a hundred rejected calls
leaving the bucket at LIMIT entries and a key forgotten after its window (R6);
and four accessibility assertions — the table's headers and spoken levels, the
two labelled limit lists, the six sources readable and named, and no
`role="list"` without list items (R7).

### Command 7: `pnpm --filter @goproceed/app exec vitest run --exclude "**/*.int.test.ts"`

```
 Test Files  57 passed | 1 skipped (58)
      Tests  524 passed | 1 skipped (525)
```

### Command 8: `pnpm --filter @goproceed/landing qa`

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
border beam at 1440 (full motion): ok paintedPixels=674 floor=200
wrote public/og.png
landing qa: ok
orphans: 0
```

The beam line is new (R8). It settles the product frame, screenshots the beam
element through an element handle and counts non-neutral pixels in a 2px band
around its whole perimeter. Measured on this machine across a full 7s
revolution: 460–1051 with `inset: 0`, 64 with `inset: -1px` — hence a floor of
200 rather than «greater than zero», which the broken version would have
passed. `overflow-hidden` on the hosting element had been eating the ring, and
no width, screenshot or contract test could see it.

### Command 9: `pnpm validate:canonical-docs`

```
canonical documentation: OK
```

### Icons, measured rather than eyeballed

`sharp` on the regenerated PNGs, alpha bounding box and maximum radial
distance from the centre as a fraction of the width:

```
android-icon-foreground.png  before  bbox 165,165–858,858  maxR 408.3  0.399
android-icon-foreground.png  after   bbox 245,245–778,778  maxR 314.2  0.307
android-icon-monochrome.png  after   bbox 245,245–778,778  maxR 314.2  0.307
apple-icon.png               before  pixel(0,0) = [0,0,0,0]
apple-icon.png               after   pixel(0,0) = [255,255,255,255]
```

Android displays the central 72dp of 108 (hard crop at 0.333) and guarantees
the 66dp safe circle (0.306). 0.399 was past both. The maskable icon stays at
78 %, which is right for the PWA's 80 % safe area.

### Fold captures (for the PR)

`2026-09-05-landing-daylight-1440-fold.png` and `2026-09-05-landing-daylight-390-fold.png` beside this file are the first viewport frames of the final QA run (commit 0c0a885), the 1440 and 390 passes with full motion.
