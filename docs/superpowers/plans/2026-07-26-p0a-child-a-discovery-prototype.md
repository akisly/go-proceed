# Child A — Discovery Prototype (`apps/demo`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/demo` — a public, no-auth, Ukrainian-language static demo that a cold-emailed construction subcontractor can understand in five minutes on a phone, deployed behind a verification gate.

**Architecture:** A **new** Vite + React 19 + TypeScript SPA at `apps/demo`, inside the pnpm workspace so turbo and CI cover it. It is a fork, not a migration: `prototype/` is never modified (it is specification evidence under `scripts/validate_package.py` and `docs/29`, enforced by `make validate`). `apps/demo/src/styles.css` is a **copy** of `prototype/src/styles.css`, curated by deletion only. Nine routes, one guided `/demo` journey, a persistent Carbon disclosure strip, and its own QA harness whose artifacts never touch tracked files.

**Tech Stack:** Vite 8, React 19, react-router-dom 7, TypeScript 5.9 (strict), vitest 3.2 (node environment — no jsdom), puppeteer (full, self-managing browser), pnpm 9.12 workspace, turbo 2.5.

**Spec:** `docs/40-phase1-discovery-outreach.md` §A (§A.1–A.6). Acceptance criteria A.4.1–A.4.22 and the twenty-item gate at A.3.8 are the definition of done.

**Branch:** `feat/p0a-child-a-prototype`. Baseline is green at `762d4ab`.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Never modify `prototype/`.** No rename, no migration, no route deletion, no QA edit. `git diff --exit-code -- prototype` must stay clean (A.4.19).
- **Never edit `prototype/qa/verify.mjs` or `prototype/qa-results.json`.** `validate_package.py:2401-2402` asserts exactly 17 flow families and ≥19 screenshots against them.
- **No restyling.** `apps/demo/src/styles.css` is a copy with **deletions only**. Zero new literal hex values, zero changes to type scale, radii or spacing constants (A.4.18). Evidence Atlas is normative per `docs/05-design-system.md` §14.
- **Design tokens (doc 05 §2 / Evidence Atlas):** Carbon `#171717`, Paper `#FBFBFB`, White `#FFFFFF`, Lime `#C6FF34`, Slate `#484C5E`, Amber `#F2B84B`, Red `#E45C55`, Line `rgba(72,76,94,.18)`. Consume via CSS custom properties (`var(--ink)`, `var(--paper)`, `var(--signal)`, `var(--line)`, `var(--muted)`, `var(--amber)`), never literal hex.
- **Surface budget:** Paper/White 74–78%, Carbon 17–21%, **Lime ≤5%**. Lime means next-action or verified only, never ambient decoration.
- **Typography:** Manrope Variable 700–800 display, Inter Variable 400–700 UI/body, tabular numerals for money, body ≥16px everywhere.
- **Status labels are canonical.** Every rendered status string must be byte-identical to its `ui_uk` value in `technical/state-catalog.csv`. Never reword per page (doc 05 §5).
- **`accepted_external` and `returned_external` must not appear anywhere** in the shipped bundle — GA-gated in the catalog (A.4.7).
- **Zero absent-capability claims:** no pricing, no mobile app, no security-enforcement claim, no data-export claim (A.4.20).
- **Fictional company names only.** No real Ukrainian company, GC or brand anywhere in the deployed artifact.
- **UI language is Ukrainian.** No i18n framework, no second locale.
- **Hard exclusions:** no backend, no Supabase, no authentication, no RLS or multi-tenancy, no offline support, no real billing, no Child B, no Phase 2.
- **Node `>=24 <25`**, pnpm `9.12.0`. Active toolchain is node v24.18.0.
- **Root test invocation is `pnpm turbo run test --concurrency=1`.** `ci.yml:54` documents that `--concurrency=1` is load-bearing.

---

## Repository findings this plan must address

These came out of the worktree baseline audit and are called out explicitly.

**Finding 1 — QA artifacts dirty the worktree.** `prototype/`'s harness rewrites 19 tracked PNGs plus `qa-results.json` on every run, so the tree goes dirty after every `make validate`. **`apps/demo` must not repeat this.** Task 16 puts every generated artifact under `apps/demo/qa-output/` (gitignored). Visual baselines are written only under an explicit `--update-baselines` flag (Task 16, Step 7). Normal validation modifies zero tracked files.

**Finding 2 — `validate_package.py` crashes on absent hard-read docs.** `validate_package.py:756` reads `20-flow-catalog.md` unconditionally; ten docs are read this way, so removing one produces a `FileNotFoundError` traceback instead of a clean finding. **Child A does not require changing this.** Task 19 records it as deferred repository technical debt in `docs/40` §A.6 and stops there. Do not expand into a general validator error-handling refactor.

**Finding 3 — CI runs neither `make validate` nor browser QA.** `.github/workflows/ci.yml` runs typecheck, test and build only. Task 18 adds that coverage, and is deliberately sequenced **after** Task 16 proves the harness runs on both local Apple Silicon and Linux.

---

## File Structure

```
apps/demo/
  package.json                     scripts: dev/build/preview/lint/typecheck/test/qa
  vite.config.ts                   base path, build target, asset inlining limit
  tsconfig.json                    strict; noUncheckedIndexedAccess; exactOptionalPropertyTypes
  eslint.config.js                 flat config, **/*.{ts,tsx}, typescript-eslint
  vitest.config.ts                 environment: node, fileParallelism: false
  index.html
  public/
    package-demo.pdf               pre-rendered static file (no runtime PDF generation)
    assets/                        WebP/AVIF derivatives of the Evidence Atlas PNGs
  src/
    main.tsx                       entry; font imports
    App.tsx                        router + catch-all
    styles.css                     COPY of prototype/src/styles.css, deletions only
    domain/
      types.ts                     ReadinessState, WorkItem, Requirement, isUnrecoverable
      labels.ts                    READINESS_LABEL_UK (canonical ui_uk)
      readiness.ts                 derived view logic
    data/
      project.ts                   one fictional electrical subcontract
    components/
      DisclosureStrip.tsx          Carbon, persistent, role="note"
      ProofBoundary.tsx            landing's 4th above-fold slot
      AppShell.tsx                 Carbon sidebar + content-area /pilot CTA
      StatusChip.tsx               canonical label + icon + tone (never colour alone)
      UnrecoverableNote.tsx        Red annotation adjacent to the chip
      MoneyCard.tsx                tabular numerals, exact value to a11y tree
      EmptyState.tsx               named situation + primary action
    pages/
      Landing.tsx  Demo.tsx  App.tsx  Work.tsx  Evidence.tsx
      Rules.tsx    Pilot.tsx  Roadmap.tsx  Legal.tsx
    pilot/
      draft.ts                     localStorage autosave + mailto fallback
  qa/
    verify.mjs                     nine routes + eighteen redirects; own browser resolution
    routes.mjs                     single source of truth for the route lists
  qa-output/                       GITIGNORED — screenshots, qa-report.json
  tests/
    domain.test.ts  labels.test.ts  data.test.ts  draft.test.ts  claims.test.ts
```

**Gitignore additions (Task 1):** `apps/demo/dist/`, `apps/demo/qa-output/`, `apps/demo/qa-runtime-tmp/`.

---

## Task Dependency Graph

```
T1 scaffold ──┬─► T2 styles copy
              ├─► T3 domain types ──► T4 catalog conformance ──► T5 dataset
              │                                                    │
              └─► T6 shell + strip ──► T7 sidebar + CTA ───────────┤
                                                                   ▼
                            T8 /demo journey ◄── T9 three situations
                                    │
                    ┌───────────────┼──────────────┬─────────────┐
                    ▼               ▼              ▼             ▼
              T10 app routes  T11 landing    T12 legal     T13 /pilot
                    │               │              │             │
                    └───────────────┴──────┬───────┴─────────────┘
                                           ▼
                          T14 interaction states ──► T15 responsive + a11y
                                           │
                                           ▼
                                  T17 assets + PDF
                                           │
                                           ▼
                                  T16 QA harness ──► T18 CI coverage
                                                          │
                    T19 defer validator debt ─────────────┤
                                                          ▼
                                              T20 verification gate
```

---

### Task 1: Scaffold `apps/demo` in the workspace

Addresses A.4.22, and Finding 1's gitignore half.

**Files:**
- Create: `apps/demo/package.json`, `apps/demo/vite.config.ts`, `apps/demo/tsconfig.json`, `apps/demo/vitest.config.ts`, `apps/demo/eslint.config.js`, `apps/demo/index.html`, `apps/demo/src/main.tsx`, `apps/demo/src/App.tsx`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: a workspace package named `@aktflow/demo` with scripts `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `qa`. `pnpm-workspace.yaml` already globs `apps/*`, so **no workspace file change is needed**.

- [ ] **Step 1: Create `apps/demo/package.json`**

```json
{
  "name": "@aktflow/demo",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 5174",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1 --port 5174",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "qa": "node qa/verify.mjs"
  },
  "dependencies": {
    "@fontsource-variable/inter": "5.3.0",
    "@fontsource-variable/manrope": "5.3.0",
    "lucide-react": "1.25.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-router-dom": "7.18.1"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@types/react": "19.2.2",
    "@types/react-dom": "19.2.2",
    "@vitejs/plugin-react": "6.0.4",
    "eslint": "10.7.0",
    "eslint-plugin-react-hooks": "7.1.1",
    "eslint-plugin-react-refresh": "0.5.3",
    "globals": "17.7.0",
    "puppeteer": "24.10.2",
    "typescript-eslint": "8.65.0",
    "vite": "8.1.5"
  }
}
```

Runtime dependency versions are pinned to match `prototype/package.json` exactly so the copied CSS and component idioms port without surprise. `typescript` and `vitest` resolve from the workspace root.

**Why `puppeteer` (full) and not `puppeteer-core` + `@sparticuz/chromium`:** `@sparticuz/chromium` ships a Linux x86-64 ELF binary for Lambda and fails `ENOEXEC` on Apple Silicon — that is exactly the trap Finding 3 asks us not to inherit. Full `puppeteer` downloads a pinned per-platform Chrome for Testing at install time, which works identically on darwin/arm64 and Linux CI. `apps/demo` never runs in Lambda, so no serverless dependency belongs here.

- [ ] **Step 2: Create `apps/demo/tsconfig.json`**

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `apps/demo/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    // Keep the Evidence Atlas derivatives as real files so the QA harness can
    // measure per-asset transfer size against the A.3.8 item 13 budget.
    assetsInlineLimit: 4096,
  },
});
```

- [ ] **Step 4: Create `apps/demo/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node environment only. Component/DOM behaviour is asserted by the
    // puppeteer harness in qa/, matching the repo's existing split. No jsdom
    // and no @testing-library dependency is introduced.
    environment: "node",
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    // No test files exist until Task 2. Without this, an empty (or
    // filtered) run fails the pipeline instead of passing trivially.
    passWithNoTests: true,
  },
});
```

- [ ] **Step 5: Create `apps/demo/eslint.config.js`**

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist', 'qa-output', 'qa-runtime-tmp'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description' }],
    },
  },
  {
    files: ['qa/**/*.mjs'],
    languageOptions: { globals: globals.node, sourceType: 'module' },
  },
]
```

- [ ] **Step 6: Create `apps/demo/index.html`**

```html
<!doctype html>
<html lang="uk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>AktFlow — демонстраційний прототип</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`noindex, nofollow` is deliberate: this is a discovery artifact sent to named recipients, not a public marketing site.

- [ ] **Step 7: Create `apps/demo/src/main.tsx` and a placeholder `App.tsx`**

```tsx
// apps/demo/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

```tsx
// apps/demo/src/App.tsx — replaced in Task 6
export default function App() {
  return <main>apps/demo scaffold</main>
}
```

Note on fonts: `@fontsource-variable/*` ships **no per-language subset CSS** — only axis files. The emitted `.woff2` files carry `unicode-range`, so a browser rendering Ukrainian fetches only the cyrillic and latin subsets regardless of how many are emitted into `dist`. Task 17 therefore measures **transferred** bytes, not `dist` size.

- [ ] **Step 8: Create a temporary `apps/demo/src/styles.css` placeholder**

```css
/* Replaced wholesale in Task 2 by a copy of prototype/src/styles.css */
```

- [ ] **Step 9: Add gitignore entries**

Append to the repo-root `.gitignore`:

```
# apps/demo build + QA artifacts. qa-output/ is ignored so a QA run never
# dirties tracked files (unlike prototype/qa-screenshots, which are tracked
# because validate_package.py:2404 requires them on disk).
apps/demo/dist/
apps/demo/qa-output/
apps/demo/qa-runtime-tmp/
```

- [ ] **Step 10: Install and verify the workspace picks it up**

Run:
```bash
pnpm install
pnpm turbo run typecheck build --filter=@aktflow/demo
```
Expected: both tasks succeed; turbo reports `@aktflow/demo:typecheck` and `@aktflow/demo:build`.

- [ ] **Step 11: Verify the prototype contract still holds**

Run:
```bash
git diff --exit-code -- prototype && echo "prototype clean"
make validate
```
Expected: `prototype clean`, and `AktFlow package validation: PASS`.

- [ ] **Step 12: Commit**

```bash
git add apps/demo .gitignore pnpm-lock.yaml
git commit -m "feat(demo): scaffold apps/demo in the pnpm workspace

Vite + React 19 + strict TypeScript SPA. Uses full puppeteer rather than
puppeteer-core + @sparticuz/chromium: the latter ships a Linux x86-64 ELF
binary and fails ENOEXEC on Apple Silicon.

qa-output/ and dist/ are gitignored so QA runs never dirty tracked files."
```

---

### Task 2: Copy and curate `styles.css`

Addresses A.4.18.

**Files:**
- Create: `apps/demo/src/styles.css` (copy)
- Test: `apps/demo/tests/styles.test.ts`

**Interfaces:**
- Consumes: `prototype/src/styles.css` (read-only source).
- Produces: CSS custom properties `--ink`, `--paper`, `--signal`, `--line`, `--muted`, `--amber` available to every component.

- [ ] **Step 1: Write the failing test**

```ts
// apps/demo/tests/styles.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const demoCss = readFileSync(resolve(__dirname, '../src/styles.css'), 'utf8')
const prototypeCss = readFileSync(resolve(__dirname, '../../../prototype/src/styles.css'), 'utf8')

const hexes = (css: string) => new Set((css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map(h => h.toLowerCase()))

describe('styles.css is a deletion-only copy', () => {
  it('introduces zero new literal hex values', () => {
    const introduced = [...hexes(demoCss)].filter(hex => !hexes(prototypeCss).has(hex))
    expect(introduced).toEqual([])
  })

  it('preserves the Evidence Atlas custom properties', () => {
    for (const token of ['--ink', '--paper', '--signal', '--line', '--muted', '--amber']) {
      expect(demoCss).toContain(token)
    }
  })

  it('is not larger than the source (deletions only)', () => {
    expect(demoCss.length).toBeLessThanOrEqual(prototypeCss.length)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @aktflow/demo test`
Expected: FAIL — the placeholder `styles.css` has no tokens.

- [ ] **Step 3: Copy the stylesheet verbatim**

```bash
cp prototype/src/styles.css apps/demo/src/styles.css
```

Do not edit it yet. Curation by deletion happens as routes land — a rule is removed only when the last component using it is gone.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter @aktflow/demo test`
Expected: PASS, 3 tests.

- [ ] **Step 5: Confirm `prototype/` is untouched**

Run: `git diff --exit-code -- prototype && echo "prototype clean"`
Expected: `prototype clean`.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/src/styles.css apps/demo/tests/styles.test.ts
git commit -m "feat(demo): copy Evidence Atlas stylesheet with a deletion-only guard test"
```

---

### Task 3: Domain types, canonical labels, derived readiness

Addresses A.4.1, A.4.5, A.4.6, A.4.7.

**Files:**
- Create: `apps/demo/src/domain/types.ts`, `apps/demo/src/domain/labels.ts`, `apps/demo/src/domain/readiness.ts`
- Test: `apps/demo/tests/domain.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ReadinessState = 'not_started' | 'evidence_missing' | 'review_pending' | 'ready_internal' | 'overridden_ready' | 'packaged' | 'submitted'`
  - `const READINESS_LABEL_UK: Readonly<Record<ReadinessState, string>>`
  - `interface WorkItem`, `interface Requirement`
  - `function isUnrecoverable(item: WorkItem, today: string): boolean`
  - `function readinessTone(state: ReadinessState): 'signal' | 'amber' | 'neutral'`

- [ ] **Step 1: Write the failing test**

```ts
// apps/demo/tests/domain.test.ts
import { describe, expect, it } from 'vitest'
import { isUnrecoverable, readinessTone, type WorkItem } from '../src/domain/readiness'
import { READINESS_LABEL_UK } from '../src/domain/labels'

const base: WorkItem = {
  id: 'wi-1',
  code: 'ЕМ-04.02',
  title: 'Прокладання кабелю ВВГнг-LS 3х2,5 у гофрі',
  locationId: 'loc-1',
  plannedQuantity: 420,
  capturedQuantity: 420,
  unit: 'м',
  valueUah: 184_000,
  readiness: 'evidence_missing',
  concealmentHoldPoint: true,
  concealedAt: '2026-07-10',
  recoveryCostUah: 46_000,
  requirements: [],
}

describe('isUnrecoverable', () => {
  it('is true when evidence is missing, a hold point exists and the date has passed', () => {
    expect(isUnrecoverable(base, '2026-07-26')).toBe(true)
  })

  it('is false when the work is already internally ready', () => {
    expect(isUnrecoverable({ ...base, readiness: 'ready_internal' }, '2026-07-26')).toBe(false)
  })

  it('is false when there is no concealment hold point', () => {
    expect(isUnrecoverable({ ...base, concealmentHoldPoint: false }, '2026-07-26')).toBe(false)
  })

  it('is false when nothing has been concealed yet', () => {
    expect(isUnrecoverable({ ...base, concealedAt: null }, '2026-07-26')).toBe(false)
  })

  it('is false when concealment is still in the future', () => {
    expect(isUnrecoverable({ ...base, concealedAt: '2026-08-01' }, '2026-07-26')).toBe(false)
  })

  it('is true on the exact concealment date (boundary)', () => {
    expect(isUnrecoverable({ ...base, concealedAt: '2026-07-26' }, '2026-07-26')).toBe(true)
  })
})

describe('READINESS_LABEL_UK', () => {
  it('covers every readiness state exactly once', () => {
    expect(Object.keys(READINESS_LABEL_UK).sort()).toEqual([
      'evidence_missing', 'not_started', 'overridden_ready',
      'packaged', 'ready_internal', 'review_pending', 'submitted',
    ])
  })

  it('has no GA-gated external states', () => {
    const keys = Object.keys(READINESS_LABEL_UK)
    expect(keys).not.toContain('accepted_external')
    expect(keys).not.toContain('returned_external')
  })
})

describe('readinessTone', () => {
  it('maps ready_internal to the signal tone', () => {
    expect(readinessTone('ready_internal')).toBe('signal')
  })
  it('maps evidence_missing to the amber tone', () => {
    expect(readinessTone('evidence_missing')).toBe('amber')
  })
  it('maps not_started to the neutral tone', () => {
    expect(readinessTone('not_started')).toBe('neutral')
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @aktflow/demo test tests/domain.test.ts`
Expected: FAIL — cannot resolve `../src/domain/readiness`.

- [ ] **Step 3: Write `apps/demo/src/domain/types.ts`**

```ts
/** Canonical readiness projection. Source: technical/state-catalog.csv, domain=readiness. */
export type ReadinessState =
  | 'not_started'
  | 'evidence_missing'
  | 'review_pending'
  | 'ready_internal'
  | 'overridden_ready'
  | 'packaged'
  | 'submitted'
// accepted_external and returned_external are GA-gated per the catalog and are
// deliberately absent: showing them would over-claim (spec A.4.7).

export type EvidenceKind = 'photo' | 'file' | 'voice_note' | 'quantity' | 'typed_form'
export type RequirementStatus = 'pending' | 'satisfied'
export type Unit = 'м' | 'м²' | 'м³' | 'шт' | 'компл' | 'т'

export interface Requirement {
  readonly id: string
  readonly kind: EvidenceKind
  readonly label: string
  readonly status: RequirementStatus
  readonly capturedAt: string | null
  readonly blocksSubmission: boolean
}

export interface WorkItem {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly locationId: string
  readonly plannedQuantity: number
  readonly capturedQuantity: number
  readonly unit: Unit
  readonly valueUah: number
  readonly readiness: ReadinessState
  readonly concealmentHoldPoint: boolean
  /** ISO 8601 date the structure was closed, or null if still open. */
  readonly concealedAt: string | null
  /** Cost to reopen the structure; drives the Red annotation. */
  readonly recoveryCostUah: number | null
  readonly requirements: readonly Requirement[]
}
```

- [ ] **Step 4: Write `apps/demo/src/domain/labels.ts`**

```ts
import type { ReadinessState } from './types'

/**
 * Canonical ui_uk labels, byte-identical to technical/state-catalog.csv.
 * doc 05 §5: these may not be reworded per page. This object is the single
 * source of truth for every status string rendered anywhere in apps/demo.
 */
export const READINESS_LABEL_UK: Readonly<Record<ReadinessState, string>> = {
  not_started: 'Не розпочато',
  evidence_missing: 'Бракує доказів',
  review_pending: 'Очікує перевірки',
  ready_internal: 'Внутрішньо готово',
  overridden_ready: 'Готово з винятком',
  packaged: 'У пакеті',
  submitted: 'Подано',
} as const
```

- [ ] **Step 5: Write `apps/demo/src/domain/readiness.ts`**

```ts
import type { ReadinessState, WorkItem } from './types'

export type { ReadinessState, Requirement, Unit, WorkItem } from './types'

/**
 * Concealment is NOT a domain state — technical/state-catalog.csv has 262 rows
 * and no such value. It is a DERIVED VIEW FACT. The status chip still renders
 * the canonical 'Бракує доказів'; this predicate only drives the adjacent Red
 * annotation (spec A.3.3, decision D3).
 */
export function isUnrecoverable(item: WorkItem, today: string): boolean {
  return (
    item.readiness === 'evidence_missing' &&
    item.concealmentHoldPoint &&
    item.concealedAt !== null &&
    item.concealedAt <= today
  )
}

/** Visual tone for a chip. Never the sole signal — always paired with icon + label. */
export function readinessTone(state: ReadinessState): 'signal' | 'amber' | 'neutral' {
  switch (state) {
    case 'ready_internal':
    case 'overridden_ready':
    case 'packaged':
    case 'submitted':
      return 'signal'
    case 'evidence_missing':
    case 'review_pending':
      return 'amber'
    case 'not_started':
      return 'neutral'
  }
}
```

Dates are compared as ISO 8601 strings, which sort lexicographically — correct and dependency-free for `YYYY-MM-DD`.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm --filter @aktflow/demo test tests/domain.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @aktflow/demo typecheck`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/demo/src/domain apps/demo/tests/domain.test.ts
git commit -m "feat(demo): typed readiness domain with derived concealment predicate

Concealment is a derived view fact, not a domain state: the catalog has no
such value, so the canonical chip stays and only an annotation changes."
```

---

### Task 4: Canonical-label conformance against `state-catalog.csv`

Addresses A.4.6, A.4.7. This is the test that stops label drift.

**Files:**
- Test: `apps/demo/tests/labels.test.ts`

**Interfaces:**
- Consumes: `READINESS_LABEL_UK` from Task 3; `technical/state-catalog.csv` (read-only).
- Produces: nothing at runtime — a guard.

- [ ] **Step 1: Confirm the CSV shape before writing the parser**

Run: `head -1 technical/state-catalog.csv && grep '^readiness,' technical/state-catalog.csv | cut -d, -f2,6`
Expected header: `domain,state,storage_scope,release,terminal,ui_uk,definition`. Expected pairs include `evidence_missing,Бракує доказів` and `ready_internal,Внутрішньо готово`.

- [ ] **Step 2: Write the failing test**

```ts
// apps/demo/tests/labels.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { READINESS_LABEL_UK } from '../src/domain/labels'

/** Minimal RFC 4180 row splitter — the catalog quotes fields containing commas. */
function splitCsvRow(row: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i]
    if (quoted && ch === '"' && row[i + 1] === '"') { cell += '"'; i += 1; continue }
    if (ch === '"') { quoted = !quoted; continue }
    if (ch === ',' && !quoted) { cells.push(cell); cell = ''; continue }
    cell += ch
  }
  cells.push(cell)
  return cells
}

const csv = readFileSync(resolve(__dirname, '../../../technical/state-catalog.csv'), 'utf8')
const rows = csv.split(/\r?\n/).filter(Boolean).map(splitCsvRow)
const header = rows[0]!
const idx = {
  domain: header.indexOf('domain'),
  state: header.indexOf('state'),
  release: header.indexOf('release'),
  uiUk: header.indexOf('ui_uk'),
}
const readiness = rows.slice(1).filter(r => r[idx.domain] === 'readiness')

describe('canonical readiness labels', () => {
  it('finds readiness rows in the catalog', () => {
    expect(readiness.length).toBeGreaterThan(0)
  })

  it('matches every label byte-for-byte with the catalog', () => {
    for (const [state, label] of Object.entries(READINESS_LABEL_UK)) {
      const row = readiness.find(r => r[idx.state] === state)
      expect(row, `catalog has no readiness row for "${state}"`).toBeDefined()
      expect(row![idx.uiUk]).toBe(label)
    }
  })

  it('omits every GA-gated readiness state', () => {
    const gaOnly = readiness.filter(r => r[idx.release] === 'GA').map(r => r[idx.state])
    expect(gaOnly.length).toBeGreaterThan(0)
    for (const state of gaOnly) {
      expect(Object.keys(READINESS_LABEL_UK)).not.toContain(state)
    }
  })

  it('covers every Pilot-release readiness state', () => {
    const pilot = readiness.filter(r => r[idx.release] === 'Pilot').map(r => r[idx.state]).sort()
    expect(Object.keys(READINESS_LABEL_UK).sort()).toEqual(pilot)
  })
})
```

- [ ] **Step 3: Run it**

Run: `pnpm --filter @aktflow/demo test tests/labels.test.ts`
Expected: PASS, 4 tests. If the fourth fails, the label map is out of step with the catalog — **fix the map, never the catalog**.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/tests/labels.test.ts
git commit -m "test(demo): assert readiness labels match state-catalog.csv byte-for-byte"
```

---

### Task 5: Synthetic electrical dataset

Addresses A.3.4, A.4.5 (all three situations reachable), and the fictional-names rule.

**Files:**
- Create: `apps/demo/src/data/project.ts`
- Test: `apps/demo/tests/data.test.ts`

**Interfaces:**
- Consumes: `WorkItem`, `Requirement` from Task 3.
- Produces: `const PROJECT: { name: string; customer: string; workItems: readonly WorkItem[] }`, `const TODAY: string`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/demo/tests/data.test.ts
import { describe, expect, it } from 'vitest'
import { PROJECT, TODAY } from '../src/data/project'
import { isUnrecoverable } from '../src/domain/readiness'
import { READINESS_LABEL_UK } from '../src/domain/labels'

describe('synthetic project', () => {
  it('has enough work items to populate a register', () => {
    expect(PROJECT.workItems.length).toBeGreaterThanOrEqual(12)
  })

  it('uses only canonical readiness states', () => {
    for (const item of PROJECT.workItems) {
      expect(Object.keys(READINESS_LABEL_UK)).toContain(item.readiness)
    }
  })

  it('keeps line values inside the plausible 20k–400k UAH band', () => {
    for (const item of PROJECT.workItems) {
      expect(item.valueUah).toBeGreaterThanOrEqual(20_000)
      expect(item.valueUah).toBeLessThanOrEqual(400_000)
    }
  })

  it('totals into the 1.5M–6M UAH subcontract band', () => {
    const total = PROJECT.workItems.reduce((sum, item) => sum + item.valueUah, 0)
    expect(total).toBeGreaterThanOrEqual(1_500_000)
    expect(total).toBeLessThanOrEqual(6_000_000)
  })

  it('exposes all three argument situations', () => {
    const ready = PROJECT.workItems.filter(i => i.readiness === 'ready_internal')
    const missing = PROJECT.workItems.filter(i => i.readiness === 'evidence_missing')
    const unrecoverable = PROJECT.workItems.filter(i => isUnrecoverable(i, TODAY))
    expect(ready.length).toBeGreaterThan(0)
    expect(missing.length).toBeGreaterThan(0)
    expect(unrecoverable.length).toBeGreaterThan(0)
  })

  it('gives every unrecoverable item a recovery cost to display', () => {
    for (const item of PROJECT.workItems.filter(i => isUnrecoverable(i, TODAY))) {
      expect(item.recoveryCostUah).not.toBeNull()
      expect(item.recoveryCostUah!).toBeGreaterThan(0)
    }
  })

  it('uses real electrical trade vocabulary', () => {
    const corpus = PROJECT.workItems.map(i => i.title).join(' ')
    for (const term of ['кабел', 'щит', 'ізоляц']) {
      expect(corpus.toLowerCase()).toContain(term)
    }
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @aktflow/demo test tests/data.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `apps/demo/src/data/project.ts`**

Write **fictional** names only. Fourteen line items. Below is the required shape plus the three items the acceptance criteria depend on; fill the remaining eleven in the same form, varying trade vocabulary (ВРУ, ЩР, лотки, заземлення, кабельні траси, випробування) and readiness states so the register looks like a real close week.

```ts
import type { WorkItem } from '../domain/types'

/** Frozen "today" so the demo is deterministic across runs and screenshots. */
export const TODAY = '2026-07-26'

const workItems: readonly WorkItem[] = [
  {
    id: 'wi-em-0402',
    code: 'ЕМ-04.02',
    title: 'Прокладання кабелю ВВГнг-LS 3х2,5 у гофрі по стелі 2 поверху',
    locationId: 'Секція Б · 2 поверх · осі 4-9',
    plannedQuantity: 620,
    capturedQuantity: 620,
    unit: 'м',
    valueUah: 184_000,
    readiness: 'evidence_missing',
    concealmentHoldPoint: true,
    concealedAt: '2026-07-10',
    recoveryCostUah: 46_000,
    requirements: [
      { id: 'r-1', kind: 'photo', label: 'Фото траси до закриття стелі', status: 'pending', capturedAt: null, blocksSubmission: true },
      { id: 'r-2', kind: 'quantity', label: 'Обсяг прокладеного кабелю', status: 'satisfied', capturedAt: '2026-07-09', blocksSubmission: true },
    ],
  },
  {
    id: 'wi-em-0711',
    code: 'ЕМ-07.11',
    title: 'Монтаж щита ЩР-2.1 з комутацією відхідних ліній',
    locationId: 'Секція Б · 2 поверх · електрощитова',
    plannedQuantity: 1,
    capturedQuantity: 1,
    unit: 'шт',
    valueUah: 142_500,
    readiness: 'ready_internal',
    concealmentHoldPoint: false,
    concealedAt: null,
    recoveryCostUah: null,
    requirements: [
      { id: 'r-3', kind: 'photo', label: 'Фото змонтованого щита', status: 'satisfied', capturedAt: '2026-07-21', blocksSubmission: true },
      { id: 'r-4', kind: 'typed_form', label: 'Протокол вимірювання опору ізоляції', status: 'satisfied', capturedAt: '2026-07-22', blocksSubmission: true },
    ],
  },
  {
    id: 'wi-em-0903',
    code: 'ЕМ-09.03',
    title: 'Випробування опору ізоляції відхідних ліній ЩР-2.1',
    locationId: 'Секція Б · 2 поверх',
    plannedQuantity: 18,
    capturedQuantity: 12,
    unit: 'шт',
    valueUah: 38_400,
    readiness: 'review_pending',
    concealmentHoldPoint: false,
    concealedAt: null,
    recoveryCostUah: null,
    requirements: [
      { id: 'r-5', kind: 'typed_form', label: 'Протокол на кожну лінію', status: 'satisfied', capturedAt: '2026-07-24', blocksSubmission: true },
    ],
  },
  // … eleven more items in the same shape.
]

export const PROJECT = {
  /** Fictional. No real Ukrainian company, GC or brand may appear here. */
  name: 'ЖК «Приклад-Північ» · черга 2',
  customer: 'ТОВ «Приклад-Буд» (синтетичний генпідрядник)',
  workItems,
} as const
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @aktflow/demo test tests/data.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/demo/src/data apps/demo/tests/data.test.ts
git commit -m "feat(demo): deep synthetic electrical dataset with invariant tests"
```

---

### Task 6: App shell, router, catch-all, disclosure strip

Addresses A.4.3, A.4.8, A.3.5 (surface 1).

**Files:**
- Create: `apps/demo/src/components/DisclosureStrip.tsx`, `apps/demo/qa/routes.mjs`
- Modify: `apps/demo/src/App.tsx`
- Test: `apps/demo/tests/routes.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `SHIPPED_ROUTES: string[]` (nine paths) and `REDIRECTED_ROUTES: string[]` (eighteen paths) from `qa/routes.mjs`, imported by both the router test and the QA harness so there is exactly one source of truth.

- [ ] **Step 1: Create `apps/demo/qa/routes.mjs`**

```js
/**
 * Single source of truth for the apps/demo route contract.
 * Imported by tests/routes.test.ts AND qa/verify.mjs so the two can never drift.
 */
export const SHIPPED_ROUTES = [
  '/', '/demo', '/app', '/app/work', '/app/evidence',
  '/app/rules', '/pilot', '/roadmap', '/legal/privacy', '/legal/terms',
]

/** Never written into apps/demo. Every one must resolve to the /demo entry point. */
export const REDIRECTED_ROUTES = [
  '/login', '/reset-password', '/invite/demo', '/onboarding',
  '/app/billing', '/app/payments', '/app/variations', '/app/external-review',
  '/app/receivables', '/app/baseline', '/app/assignments', '/app/occurrence',
  '/app/field', '/app/close', '/app/packages', '/app/settings',
  '/app/team', '/review/demo',
]
```

Note: `SHIPPED_ROUTES` has ten entries because `/legal/privacy` and `/legal/terms` are counted as one surface in the spec's "nine routes" phrasing. The QA harness asserts against this list, not against the prose count.

- [ ] **Step 2: Write the failing test**

```ts
// apps/demo/tests/routes.test.ts
import { describe, expect, it } from 'vitest'
import { REDIRECTED_ROUTES, SHIPPED_ROUTES } from '../qa/routes.mjs'

describe('route contract', () => {
  it('ships the curated surface set', () => {
    expect(SHIPPED_ROUTES).toContain('/demo')
    expect(SHIPPED_ROUTES).toContain('/pilot')
    expect(SHIPPED_ROUTES).toContain('/roadmap')
  })

  it('never ships an auth or commercial surface', () => {
    for (const forbidden of ['/login', '/reset-password', '/app/billing', '/app/payments']) {
      expect(SHIPPED_ROUTES).not.toContain(forbidden)
      expect(REDIRECTED_ROUTES).toContain(forbidden)
    }
  })

  it('keeps the two lists disjoint', () => {
    const overlap = SHIPPED_ROUTES.filter(route => REDIRECTED_ROUTES.includes(route))
    expect(overlap).toEqual([])
  })
})
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm --filter @aktflow/demo test tests/routes.test.ts`
Expected: FAIL — `qa/routes.mjs` not resolvable until Step 1 is saved; if Step 1 is done, this passes immediately and acts as a regression guard.

- [ ] **Step 4: Write `apps/demo/src/components/DisclosureStrip.tsx`**

```tsx
/**
 * Surface 1 of the honesty contract (spec A.3.5, decision D1).
 * Carbon is doc 05's semantic colour for high-consequence chrome, so the
 * disclosure reads as designed rather than as a browser warning bar.
 * Non-dismissible, present on every route including deep links, and in the
 * accessibility tree (never aria-hidden).
 */
export default function DisclosureStrip() {
  return (
    <div className="disclosure-strip" role="note" data-testid="disclosure-strip">
      <strong>Демонстраційний прототип</strong>
      <span aria-hidden="true"> · </span>
      <span>синтетичні дані</span>
      <span aria-hidden="true"> · </span>
      <span>без клієнтів</span>
    </div>
  )
}
```

Add to `apps/demo/src/styles.css` **using existing tokens only**:

```css
.disclosure-strip {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 8px 16px;
  background: var(--ink);
  color: #fff;
  font-size: 13px;
  line-height: 1.3;
  text-align: center;
}
```

This is an addition of a rule, not a restyle: it introduces no new literal hex beyond `#fff`, which already exists in the source stylesheet. If the Task 2 hex test fails on `#fff`, use `var(--paper)` instead.

- [ ] **Step 5: Write `apps/demo/src/App.tsx`**

```tsx
import { Navigate, Route, Routes } from 'react-router-dom'
import DisclosureStrip from './components/DisclosureStrip'
import Landing from './pages/Landing'
import Demo from './pages/Demo'
import Roadmap from './pages/Roadmap'
import Legal from './pages/Legal'
import Pilot from './pages/Pilot'
import AppShell from './components/AppShell'

export default function App() {
  return (
    <>
      <DisclosureStrip />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/pilot" element={<Pilot />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/legal/:document" element={<Legal />} />
        <Route path="/app/*" element={<AppShell />} />
        {/* Every never-written path lands on the guided story, never a 404
            and never a login form (spec A.3.2, A.4.3). */}
        <Route path="*" element={<Navigate to="/demo" replace />} />
      </Routes>
    </>
  )
}
```

`/app/*` is handled inside `AppShell` (Task 7), which itself renders a catch-all `Navigate` for unknown `/app` children such as `/app/billing`.

- [ ] **Step 6: Create minimal placeholder pages so the build compiles**

Create `apps/demo/src/pages/{Landing,Demo,Roadmap,Legal,Pilot}.tsx` and `apps/demo/src/components/AppShell.tsx`, each exporting a default component returning a single `<main>` with an `<h1>`. They are replaced in Tasks 7–13.

```tsx
// apps/demo/src/pages/Landing.tsx — replaced in Task 11
export default function Landing() {
  return <main><h1>AktFlow</h1></main>
}
```

- [ ] **Step 7: Verify build, typecheck and tests**

Run:
```bash
pnpm --filter @aktflow/demo typecheck
pnpm --filter @aktflow/demo lint
pnpm --filter @aktflow/demo test
pnpm --filter @aktflow/demo build
```
Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/demo/src apps/demo/qa/routes.mjs apps/demo/tests/routes.test.ts
git commit -m "feat(demo): router, catch-all redirect and persistent Carbon disclosure strip"
```

---

### Task 7: Curated sidebar and the `/pilot` content CTA

Addresses A.4.9, A.3.2a (decision D2, ER-7c).

**Files:**
- Modify: `apps/demo/src/components/AppShell.tsx`
- Test: `apps/demo/tests/nav.test.ts`

**Interfaces:**
- Consumes: `SHIPPED_ROUTES`.
- Produces: `const SIDEBAR_ITEMS: readonly { to: string; label: string }[]` exported from `AppShell.tsx` for the nav test.

- [ ] **Step 1: Write the failing test**

```ts
// apps/demo/tests/nav.test.ts
import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEMS } from '../src/components/AppShell'

describe('curated sidebar', () => {
  it('has exactly three live entries plus one roadmap entry', () => {
    expect(SIDEBAR_ITEMS).toHaveLength(4)
    expect(SIDEBAR_ITEMS.filter(i => i.to === '/roadmap')).toHaveLength(1)
  })

  it('does not list /pilot as a sidebar item', () => {
    // A.4.9 constrains the sidebar only; the /pilot CTA lives in the content area.
    expect(SIDEBAR_ITEMS.map(i => i.to)).not.toContain('/pilot')
  })

  it('uses the exact Ukrainian labels', () => {
    expect(SIDEBAR_ITEMS.map(i => i.label)).toEqual(['Роботи', 'Докази', 'Правила', 'Що далі'])
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @aktflow/demo test tests/nav.test.ts`
Expected: FAIL — `SIDEBAR_ITEMS` is not exported.

- [ ] **Step 3: Write `apps/demo/src/components/AppShell.tsx`**

```tsx
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from '../pages/App'
import Work from '../pages/Work'
import Evidence from '../pages/Evidence'
import Rules from '../pages/Rules'

/**
 * Exactly three live entries plus one roadmap entry, zero disabled items
 * (spec A.4.9). doc 05 §10's three nav groups are honestly collapsed to what
 * exists; everything else is named once, on /roadmap.
 */
export const SIDEBAR_ITEMS = [
  { to: '/app/work', label: 'Роботи' },
  { to: '/app/evidence', label: 'Докази' },
  { to: '/app/rules', label: 'Правила' },
  { to: '/roadmap', label: 'Що далі' },
] as const

export default function AppShell() {
  return (
    <div className="app-shell">
      <nav className="app-sidebar" aria-label="Основна навігація">
        <ul>
          {SIDEBAR_ITEMS.map(item => (
            <li key={item.to}>
              <NavLink to={item.to} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="app-main">
        {/* ER-7c: /pilot is the only structured capture surface and the email
            permits exactly one link, so it needs a reachable entry that is NOT
            a sidebar item. */}
        <aside className="pilot-cta">
          <NavLink to="/pilot" className="button button--signal" data-testid="pilot-cta">
            Розкажіть, як у вас
          </NavLink>
        </aside>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="work" element={<Work />} />
          <Route path="evidence" element={<Evidence />} />
          <Route path="rules" element={<Rules />} />
          <Route path="*" element={<Navigate to="/demo" replace />} />
        </Routes>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Create placeholder `apps/demo/src/pages/{App,Work,Evidence,Rules}.tsx`**

Same one-`<h1>` shape as Task 6 Step 6. Replaced in Task 10.

- [ ] **Step 5: Run tests, typecheck, build**

Run: `pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo typecheck && pnpm --filter @aktflow/demo build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/src/components/AppShell.tsx apps/demo/src/pages apps/demo/tests/nav.test.ts
git commit -m "feat(demo): curated Carbon sidebar with content-area /pilot CTA"
```

---

### Task 8: The `/demo` guided journey

Addresses A.4.4, A.3.3 steps 1–5.

**Files:**
- Create: `apps/demo/src/pages/Demo.tsx` (replacing the placeholder), `apps/demo/src/components/StatusChip.tsx`
- Test: `apps/demo/tests/journey.test.ts`

**Interfaces:**
- Consumes: `PROJECT`, `TODAY`, `READINESS_LABEL_UK`, `readinessTone`, `isUnrecoverable`.
- Produces: `const DEMO_STEPS: readonly { id: string; title: string }[]` exported from `Demo.tsx`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/demo/tests/journey.test.ts
import { describe, expect, it } from 'vitest'
import { DEMO_STEPS } from '../src/pages/Demo'

describe('guided demo journey', () => {
  it('has exactly five steps in spec order', () => {
    expect(DEMO_STEPS.map(s => s.id)).toEqual([
      'work-item', 'requirements', 'capture', 'readiness', 'package',
    ])
  })

  it('names every step in Ukrainian', () => {
    for (const step of DEMO_STEPS) {
      expect(step.title.length).toBeGreaterThan(0)
      expect(/[а-яіїєґА-ЯІЇЄҐ]/.test(step.title)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @aktflow/demo test tests/journey.test.ts`
Expected: FAIL — `DEMO_STEPS` is not exported.

- [ ] **Step 3: Write `apps/demo/src/components/StatusChip.tsx`**

```tsx
import { AlertTriangle, Check, Clock } from 'lucide-react'
import { READINESS_LABEL_UK } from '../domain/labels'
import { readinessTone, type ReadinessState } from '../domain/readiness'

const ICON = { signal: Check, amber: AlertTriangle, neutral: Clock } as const

/**
 * Renders the canonical ui_uk label and never a reworded one (doc 05 §5).
 * Status never relies on colour alone: icon + label + tone, always
 * (Evidence Atlas README).
 */
export default function StatusChip({ state }: { state: ReadinessState }) {
  const tone = readinessTone(state)
  const Icon = ICON[tone]
  return (
    <span className={`status-chip status-chip--${tone}`} data-state={state}>
      <Icon size={15} aria-hidden="true" />
      <span>{READINESS_LABEL_UK[state]}</span>
    </span>
  )
}
```

- [ ] **Step 4: Write `apps/demo/src/pages/Demo.tsx`**

Five steps, one at a time, no dead ends. Progress is kept in component state — no router state, no persistence.

```tsx
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PROJECT, TODAY } from '../data/project'
import { isUnrecoverable } from '../domain/readiness'
import StatusChip from '../components/StatusChip'
import UnrecoverableNote from '../components/UnrecoverableNote'

export const DEMO_STEPS = [
  { id: 'work-item', title: 'Рядок робіт' },
  { id: 'requirements', title: 'Вимоги до доказів' },
  { id: 'capture', title: 'Фіксація на об’єкті' },
  { id: 'readiness', title: 'Готовність до подання' },
  { id: 'package', title: 'Пакет періоду' },
] as const

const FOCUS = PROJECT.workItems.find(item => isUnrecoverable(item, TODAY))!

export default function Demo() {
  const [step, setStep] = useState(0)
  const current = DEMO_STEPS[step]!
  const isLast = step === DEMO_STEPS.length - 1

  return (
    <main className="demo-page">
      <ol className="demo-progress" aria-label="Кроки демонстрації">
        {DEMO_STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === step ? 'step' : undefined}>{s.title}</li>
        ))}
      </ol>

      <section className="demo-step" data-step={current.id}>
        <h1>{current.title}</h1>
        {/* Each step renders FOCUS from a different angle. Step content is
            written out per step; no step may render an empty panel. */}
        {current.id === 'work-item' && (
          <>
            <p className="demo-code">{FOCUS.code}</p>
            <h2>{FOCUS.title}</h2>
            <StatusChip state={FOCUS.readiness} />
          </>
        )}
        {current.id === 'readiness' && (
          <>
            <StatusChip state={FOCUS.readiness} />
            <UnrecoverableNote item={FOCUS} today={TODAY} />
          </>
        )}
        {/* requirements / capture / package panels follow the same pattern. */}
      </section>

      <nav className="demo-nav">
        <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
          Назад
        </button>
        {!isLast && (
          <button type="button" className="button button--dark" onClick={() => setStep(s => s + 1)}>
            Далі
          </button>
        )}
        {isLast && (
          <>
            {/* PRIMARY action at the moment of maximum willingness (ER-7c). */}
            <NavLink to="/pilot" className="button button--signal" data-testid="demo-to-pilot">
              Розкажіть, як у вас
            </NavLink>
            <a className="button button--outline" href="/package-demo.pdf" download>
              Завантажити пакет (PDF)
            </a>
            <NavLink to="/app" className="button button--outline">Подивитись усе</NavLink>
          </>
        )}
      </nav>
    </main>
  )
}
```

- [ ] **Step 5: Run tests, typecheck, build**

Run: `pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo typecheck && pnpm --filter @aktflow/demo build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/src/pages/Demo.tsx apps/demo/src/components/StatusChip.tsx apps/demo/tests/journey.test.ts
git commit -m "feat(demo): five-step guided journey ending on the /pilot ask"
```

---

### Task 9: The three situations and the unrecoverable annotation

Addresses A.4.5. This is the product argument; it gets its own reviewable task.

**Files:**
- Create: `apps/demo/src/components/UnrecoverableNote.tsx`, `apps/demo/src/components/MoneyCard.tsx`
- Test: `apps/demo/tests/unrecoverable.test.ts`

**Interfaces:**
- Consumes: `WorkItem`, `isUnrecoverable`.
- Produces: `formatUah(value: number): string` exported from `MoneyCard.tsx`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/demo/tests/unrecoverable.test.ts
import { describe, expect, it } from 'vitest'
import { formatUah } from '../src/components/MoneyCard'

describe('formatUah', () => {
  it('groups thousands with a non-breaking space and appends the sign', () => {
    expect(formatUah(184_000)).toBe('184 000,00 ₴')
  })
  it('renders zero explicitly rather than as an empty string', () => {
    expect(formatUah(0)).toBe('0,00 ₴')
  })
  it('keeps two decimal places', () => {
    expect(formatUah(46_500.5)).toBe('46 500,50 ₴')
  })
})
```

Note: the expected strings use U+00A0 (non-breaking space) as the group separator, which is what `uk-UA` produces. Write the test with an explicit ` ` if the literal is ambiguous in your editor.

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @aktflow/demo test tests/unrecoverable.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `apps/demo/src/components/MoneyCard.tsx`**

```tsx
const UAH = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Full money form for tables (doc 05 §5). Tabular numerals come from the CSS. */
export function formatUah(value: number): string {
  return `${UAH.format(value)} ₴`
}

export default function MoneyCard({ label, value, denominator }: {
  label: string
  value: number
  denominator?: string
}) {
  return (
    <div className="money-card">
      <small>{label}</small>
      {/* The exact value always reaches assistive tech even when the visual
          form is abbreviated (doc 05 §5). */}
      <b aria-label={formatUah(value)}>{formatUah(value)}</b>
      {denominator ? <span>{denominator}</span> : null}
    </div>
  )
}
```

- [ ] **Step 4: Write `apps/demo/src/components/UnrecoverableNote.tsx`**

```tsx
import { ShieldAlert } from 'lucide-react'
import { isUnrecoverable, type WorkItem } from '../domain/readiness'
import { formatUah } from './MoneyCard'

/**
 * The Red annotation sits ADJACENT to the canonical chip and never replaces it
 * (spec A.3.3, decision D3). The chip keeps saying «Бракує доказів» because
 * that is what the catalog models; what makes this case unrecoverable is a
 * fact about time and the hold point, not a different status.
 */
export default function UnrecoverableNote({ item, today }: { item: WorkItem; today: string }) {
  if (!isUnrecoverable(item, today)) return null
  return (
    <p className="unrecoverable-note" role="note">
      <ShieldAlert size={16} aria-hidden="true" />
      <span>
        Конструкцію закрито {item.concealedAt}. Доказ не відновити без розкриття —
        орієнтовна вартість {formatUah(item.recoveryCostUah ?? 0)}.
      </span>
    </p>
  )
}
```

Add to `styles.css`, tokens only:

```css
.unrecoverable-note { display: flex; gap: 8px; align-items: flex-start; color: var(--red, #E45C55); font-size: 14px; line-height: 1.45; }
```

If `--red` does not already exist in the copied stylesheet, add the custom property to the existing `:root` block rather than introducing a literal at the use site.

- [ ] **Step 5: Run tests, typecheck, build**

Run: `pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo typecheck && pnpm --filter @aktflow/demo build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/src/components apps/demo/src/styles.css apps/demo/tests/unrecoverable.test.ts
git commit -m "feat(demo): canonical chip plus adjacent Red unrecoverable annotation"
```

---

### Task 10: The four `/app` routes and `/roadmap`

Addresses A.3.2 (port table).

**Files:**
- Modify: `apps/demo/src/pages/App.tsx`, `Work.tsx`, `Evidence.tsx`, `Rules.tsx`, `Roadmap.tsx`

**Interfaces:**
- Consumes: `PROJECT`, `StatusChip`, `MoneyCard`, `UnrecoverableNote`, `EmptyState` (Task 14).
- Produces: nothing new.

- [ ] **Step 1: Port `/app` (Dashboard)**

Read `prototype/src/pages/Dashboard.jsx` (38 lines) as a **read-only reference**. Rewrite in TSX using `PROJECT`. Per A.3.2a the hierarchy is: money at risk first, readiness split second, work table third.

```tsx
import { PROJECT, TODAY } from '../data/project'
import { isUnrecoverable } from '../domain/readiness'
import MoneyCard from '../components/MoneyCard'
import StatusChip from '../components/StatusChip'

export default function Dashboard() {
  const atRisk = PROJECT.workItems
    .filter(i => i.readiness === 'evidence_missing')
    .reduce((sum, i) => sum + i.valueUah, 0)
  const unrecoverable = PROJECT.workItems.filter(i => isUnrecoverable(i, TODAY))

  return (
    <>
      <h1>Готовність до закриття періоду</h1>
      <MoneyCard label="Під ризиком" value={atRisk} denominator={`з ${PROJECT.workItems.length} рядків`} />
      <section aria-label="Розподіл готовності">
        {(['ready_internal', 'review_pending', 'evidence_missing'] as const).map(state => (
          <p key={state}>
            <StatusChip state={state} />
            <span>{PROJECT.workItems.filter(i => i.readiness === state).length}</span>
          </p>
        ))}
      </section>
      <p>Неповоротних рядків: {unrecoverable.length}</p>
    </>
  )
}
```

- [ ] **Step 2: Port `/app/work`, `/app/evidence`, `/app/rules`**

Same pattern, referencing `prototype/src/pages/{Work,Evidence,Rules}.jsx` read-only. `Work` renders the register with `StatusChip` per row. `Evidence` renders the requirement checklist, each missing requirement stating why it is missing and its financial impact (doc 05 §3). `Rules` explains versioned requirements in prose — no config workshop, no editor.

- [ ] **Step 3: Write `/roadmap`**

```tsx
/**
 * Conceptual capabilities, Slate-annotated. NOT a feature grid: no icon-in-circle
 * cards, no 3-column symmetry (AI-slop blacklist #2 and #3). A single annotated
 * list, one job for the section.
 */
const CONCEPTUAL = [
  { title: 'Зміни та додаткові роботи', note: 'Концептуально · не реалізовано' },
  { title: 'Зовнішній перегляд пакета', note: 'Концептуально · не реалізовано' },
  { title: 'Дебіторська заборгованість і платежі', note: 'Концептуально · не реалізовано' },
] as const

export default function Roadmap() {
  return (
    <main className="roadmap-page">
      <h1>Що далі</h1>
      <p>Нижче — напрям, а не наявні функції. Нічого з цього зараз не працює.</p>
      <dl className="roadmap-list">
        {CONCEPTUAL.map(entry => (
          <div key={entry.title}>
            <dt>{entry.title}</dt>
            <dd>{entry.note}</dd>
          </div>
        ))}
      </dl>
    </main>
  )
}
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo typecheck && pnpm --filter @aktflow/demo lint && pnpm --filter @aktflow/demo build`
Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/demo/src/pages
git commit -m "feat(demo): port /app, /app/work, /app/evidence, /app/rules and write /roadmap"
```

---

### Task 11: Landing, proof boundary, absent-capability scrub

Addresses A.4.20, A.3.5 (surface 2). **The highest-risk content task.**

**Files:**
- Modify: `apps/demo/src/pages/Landing.tsx`
- Create: `apps/demo/src/components/ProofBoundary.tsx`
- Test: `apps/demo/tests/claims.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `const FORBIDDEN_CLAIM_PATTERNS: readonly RegExp[]` exported from `tests/claims.test.ts` helpers — re-used by the QA harness in Task 16.

- [ ] **Step 1: Create `apps/demo/qa/forbidden-claims.mjs`**

```js
/**
 * Capability claims that must never appear in the shipped bundle (spec A.4.20).
 * The ported prototype Landing.jsx contains all four. Shared by the unit test
 * and the QA harness so a claim cannot slip past one of them.
 */
export const FORBIDDEN_CLAIM_PATTERNS = [
  { id: 'pricing', pattern: /₴\s*\/\s*міс|грн\s*\/\s*міс|\bтариф/iu },
  { id: 'mobile-app', pattern: /\biOS\b|\bAndroid\b/iu },
  { id: 'security-enforcement', pattern: /гаранту[єм].{0,40}(доступ|безпек)/iu },
  { id: 'data-export', pattern: /експорт\s+(усіх|всіх)\s+даних|гарантований\s+експорт/iu },
]
```

- [ ] **Step 2: Write the failing test**

```ts
// apps/demo/tests/claims.test.ts
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FORBIDDEN_CLAIM_PATTERNS } from '../qa/forbidden-claims.mjs'

const srcDir = resolve(__dirname, '../src')

function allSource(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .map(entry => {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) return allSource(full)
      return /\.tsx?$/.test(entry.name) ? readFileSync(full, 'utf8') : ''
    })
    .join('\n')
}

describe('absent-capability claims', () => {
  const corpus = allSource(srcDir)
  for (const { id, pattern } of FORBIDDEN_CLAIM_PATTERNS) {
    it(`never claims ${id}`, () => {
      expect(corpus).not.toMatch(pattern)
    })
  }
})

describe('GA-gated states', () => {
  it('never mentions accepted_external or returned_external', () => {
    const corpus = allSource(srcDir)
    expect(corpus).not.toContain('accepted_external')
    expect(corpus).not.toContain('returned_external')
  })
})
```

- [ ] **Step 3: Run it and watch it fail once the landing is ported**

Run: `pnpm --filter @aktflow/demo test tests/claims.test.ts`
Expected at this point: PASS (the placeholder landing is empty). It becomes a real guard in Step 5 — port the landing first, watch the test go red, then scrub.

- [ ] **Step 4: Write `apps/demo/src/components/ProofBoundary.tsx`**

```tsx
/**
 * Surface 2 of the honesty contract, occupying doc 05 §10's fourth
 * above-the-fold slot — the "conservative proof boundary" the layout grammar
 * already reserves. The landing therefore still OPENS with the outcome
 * statement rather than with an apology (decision D1).
 */
export default function ProofBoundary() {
  return (
    <section className="proof-boundary" aria-labelledby="proof-boundary-heading">
      <h2 id="proof-boundary-heading">Це демонстраційний прототип.</h2>
      <p>
        Дані повністю синтетичні. Це не робочий продукт: немає реєстрації,
        збереження даних та інтеграцій. Продукт не має клієнтів і не має
        підтвердженого попиту — саме це я зараз і досліджую.
      </p>
      <ul className="proof-boundary__not">
        <li>Не гарантує оплату або прийняття замовником.</li>
        <li>Не надає юридичної сили жодному типу доказу.</li>
        <li>Не замінює кошторисника, ПТО чи юриста.</li>
      </ul>
    </section>
  )
}
```

- [ ] **Step 5: Port `Landing.tsx` and scrub the four claim classes**

Read `prototype/src/pages/Landing.jsx` (148 lines) read-only. Rewrite in TSX keeping doc 05 §10's fixed above-fold order: **outcome statement → explanation → demo CTA → proof boundary**.

**Delete outright** while porting:
- the whole pricing table (`₴ / міс.` tiers) — doc 30 **V-007** gates public pricing as unvalidated;
- «iOS та Android — ядро Pilot» and «iOS + Android · у межах Pilot» — no mobile app exists;
- any security-enforcement guarantee;
- any data-export guarantee.

Run the claims test after porting and before scrubbing to see it catch them:

Run: `pnpm --filter @aktflow/demo test tests/claims.test.ts`
Expected: FAIL, listing `pricing` and `mobile-app`. Then scrub and re-run.

- [ ] **Step 6: Re-run and confirm green**

Run: `pnpm --filter @aktflow/demo test tests/claims.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/demo/src/pages/Landing.tsx apps/demo/src/components/ProofBoundary.tsx apps/demo/qa/forbidden-claims.mjs apps/demo/tests/claims.test.ts
git commit -m "feat(demo): landing with proof boundary, absent-capability claims scrubbed

Removes the pricing table (doc 30 V-007 gates public pricing), the iOS/Android
claim (no mobile app exists), and the security/export guarantees. Guarded by a
shared pattern list the QA harness also enforces against the built bundle."
```

---

### Task 12: `/legal` rewritten for this deployment

Addresses A.3.5, and the localStorage disclosure that Task 13 depends on.

**Files:**
- Modify: `apps/demo/src/pages/Legal.tsx`

**Interfaces:**
- Consumes: `useParams` from react-router-dom.
- Produces: nothing.

- [ ] **Step 1: Rewrite `Legal.tsx`**

Two documents behind `/legal/:document`. This must describe **this deployment**, not a hypothetical product.

`/legal/privacy` must state, in Ukrainian:
- exactly what `/pilot` collects (company, email, and the free-text answers);
- that a **local draft is stored in the browser** under `aktflow.pilot.draft`, why, and that it is cleared on successful submission (this is the D4 disclosure);
- where a submission goes and how long it is kept;
- how to request deletion;
- that there is **no analytics, no tracking pixel and no session recorder** (doc 24 §22 gates cookie/analytics consent and this artifact has no consent surface).

`/legal/terms` must state that this is a demonstration prototype with no service commitment, no availability guarantee and no contractual relationship.

- [ ] **Step 2: Verify**

Run: `pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo typecheck && pnpm --filter @aktflow/demo build`
Expected: all exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/demo/src/pages/Legal.tsx
git commit -m "feat(demo): legal pages describing this deployment, incl. local-draft disclosure"
```

---

### Task 13: `/pilot` async capture with autosave and mailto fallback

Addresses A.4.10, A.4.11, A.3.6 (decision D4). **Never lose an answer.**

**Files:**
- Create: `apps/demo/src/pilot/draft.ts`
- Modify: `apps/demo/src/pages/Pilot.tsx`
- Test: `apps/demo/tests/draft.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `const DRAFT_KEY = 'aktflow.pilot.draft'`
  - `interface PilotDraft { company: string; email: string; specialisation: string; siteCount: string; capture: string; storage: string; returnReason: string; closingTime: string; willingToShare: string }`
  - `function serialiseDraft(d: PilotDraft): string`
  - `function parseDraft(raw: string | null): PilotDraft | null`
  - `function buildMailto(to: string, d: PilotDraft): string`

- [ ] **Step 1: Write the failing test**

```ts
// apps/demo/tests/draft.test.ts
import { describe, expect, it } from 'vitest'
import { buildMailto, parseDraft, serialiseDraft, type PilotDraft } from '../src/pilot/draft'

const draft: PilotDraft = {
  company: 'ТОВ «Приклад»',
  email: 'pto@example.com.ua',
  specialisation: 'electrical',
  siteCount: '2-5',
  capture: 'Прораб надсилає фото у Viber, потім ПТО збирає вручну.',
  storage: 'Google Drive і локальні папки',
  returnReason: 'Немає фото прихованих робіт',
  closingTime: '3-7',
  willingToShare: 'yes',
}

describe('draft round-trip', () => {
  it('survives serialise -> parse unchanged', () => {
    expect(parseDraft(serialiseDraft(draft))).toEqual(draft)
  })
  it('returns null for absent storage', () => {
    expect(parseDraft(null)).toBeNull()
  })
  it('returns null for corrupt JSON rather than throwing', () => {
    expect(parseDraft('{not json')).toBeNull()
  })
  it('returns null when the shape is wrong', () => {
    expect(parseDraft('{"company":123}')).toBeNull()
  })
})

describe('buildMailto', () => {
  const url = buildMailto('founder@example.com', draft)
  it('targets the given recipient', () => {
    expect(url.startsWith('mailto:founder@example.com?')).toBe(true)
  })
  it('carries every free-text answer in the body', () => {
    const body = decodeURIComponent(new URL(url).searchParams.get('body') ?? '')
    expect(body).toContain(draft.capture)
    expect(body).toContain(draft.storage)
    expect(body).toContain(draft.returnReason)
  })
  it('percent-encodes Cyrillic safely', () => {
    expect(url).not.toContain(' ')
    expect(() => new URL(url)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @aktflow/demo test tests/draft.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `apps/demo/src/pilot/draft.ts`**

```ts
export const DRAFT_KEY = 'aktflow.pilot.draft'

export interface PilotDraft {
  company: string
  email: string
  specialisation: string
  siteCount: string
  capture: string
  storage: string
  returnReason: string
  closingTime: string
  willingToShare: string
}

const FIELDS: readonly (keyof PilotDraft)[] = [
  'company', 'email', 'specialisation', 'siteCount',
  'capture', 'storage', 'returnReason', 'closingTime', 'willingToShare',
]

export function serialiseDraft(draft: PilotDraft): string {
  return JSON.stringify(draft)
}

/** Never throws. A corrupt draft must not break the form. */
export function parseDraft(raw: string | null): PilotDraft | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Record<string, unknown>
  for (const field of FIELDS) {
    if (typeof record[field] !== 'string') return null
  }
  return Object.fromEntries(FIELDS.map(f => [f, record[f]])) as unknown as PilotDraft
}

const LABEL: Record<keyof PilotDraft, string> = {
  company: 'Компанія',
  email: 'Email',
  specialisation: 'Спеціалізація',
  siteCount: 'Активних об’єктів',
  capture: 'Як збираються фото і обсяги',
  storage: 'Де зберігається',
  returnReason: 'Причина повернення акта',
  closingTime: 'Час на підготовку закриття',
  willingToShare: 'Готові показати знеособлений приклад',
}

export function buildMailto(to: string, draft: PilotDraft): string {
  const body = FIELDS.map(field => `${LABEL[field]}:\n${draft[field]}`).join('\n\n')
  const params = new URLSearchParams({ subject: `AktFlow · ${draft.company}`, body })
  return `mailto:${to}?${params.toString()}`
}
```

- [ ] **Step 4: Run and confirm the tests pass**

Run: `pnpm --filter @aktflow/demo test tests/draft.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write `apps/demo/src/pages/Pilot.tsx`**

Requirements, all from A.3.6:
- Nine fields; only **Компанія** and **Email** required.
- The core discovery question — «Як зараз збираються фото і обсяги з об'єкта» — is **first** among the free-text fields (A.3.2a hierarchy).
- **Visible persistent labels.** Placeholder-as-label is prohibited (A.3.7).
- **No call booking, no calendar embed.**
- Autosave: write `serialiseDraft` to `localStorage[DRAFT_KEY]` on input, debounced 500ms. On mount, `parseDraft` and restore, showing a visible «чернетку відновлено» notice.
- Submit: POST to `import.meta.env.VITE_PILOT_ENDPOINT`. Disable the button, label it «Надсилаю…», preserve its width.
- On success: clear `DRAFT_KEY`, render a receipt stating what was received, what happens next, and how to request deletion.
- On non-2xx or network error: render an **inline banner that persists until resolved** (doc 05 §3 — not a toast), offering `buildMailto(...)` prefilled, and **keep the draft**.

- [ ] **Step 6: Verify**

Run: `pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo typecheck && pnpm --filter @aktflow/demo lint && pnpm --filter @aktflow/demo build`
Expected: all exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/demo/src/pilot apps/demo/src/pages/Pilot.tsx apps/demo/tests/draft.test.ts
git commit -m "feat(demo): /pilot async capture with localStorage autosave and mailto fallback

The three textareas are the most valuable output of Phase 1 discovery; a
third-party endpoint failure must never destroy them."
```

---

### Task 14: Interaction state coverage

Addresses A.4.12, A.3.7a. Every cell of the spec's state table.

**Files:**
- Create: `apps/demo/src/components/EmptyState.tsx`, `apps/demo/src/components/InlineBanner.tsx`, `apps/demo/src/components/SkeletonRows.tsx`
- Modify: the pages that need each state

**Interfaces:**
- Consumes: nothing.
- Produces: `EmptyState({ title, action })`, `InlineBanner({ tone, children })`, `SkeletonRows({ rows })`.

- [ ] **Step 1: Write `EmptyState.tsx`**

```tsx
import type { ReactNode } from 'react'

/**
 * Empty states are features. Every one names the situation in Ukrainian and
 * offers a primary action. A bare "нічого не знайдено" is a spec violation
 * (A.4.12).
 */
export default function EmptyState({ title, hint, action }: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <b>{title}</b>
      {hint ? <p>{hint}</p> : null}
      {action}
    </div>
  )
}
```

- [ ] **Step 2: Implement each row of the A.3.7a table**

| Surface | State | Implementation |
|---|---|---|
| `/demo` | loading | Step transition ≤180ms, no spinner |
| `/demo` | error | Missing step data renders an inline note, never a blank step |
| `/demo` | partial | Progress preserved across back/forward |
| `/app` | loading | `SkeletonRows` preserving final height, no layout shift |
| `/app` | empty | «Дані демонстрації не завантажились» + reload action |
| `/app/work` | empty | «Немає робіт за цим фільтром» + the active filter named + one-tap clear |
| `/app/evidence` | empty | «Усі вимоги закрито» + Lime verified stamp + link onward to the package |
| `/pilot` | loading | Submit disabled, «Надсилаю…», width preserved |
| `/pilot` | error | `InlineBanner` persisting until resolved + mailto fallback, draft preserved |
| `/pilot` | partial | «чернетку відновлено» notice |
| PDF | error | Names the reason and offers retry |

- [ ] **Step 3: Verify**

Run: `pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/src/components apps/demo/src/pages
git commit -m "feat(demo): full interaction state coverage — loading, empty, error, partial"
```

---

### Task 15: Responsive and WCAG 2.2 AA

Addresses A.4.14, A.4.17, A.3.7.

**Files:**
- Modify: `apps/demo/src/styles.css`, all page components

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Implement the three viewports**

| Viewport | Sidebar | Work table | `/demo` steps | Money card |
|---|---|---|---|---|
| ≥1240px | Carbon rail, always visible | Full table, sticky header | Step + persistent progress rail | Full value + denominator + timestamp |
| 768–1239px | Collapsed to icons, labels on hover/focus | Fewer columns, no pinning | Progress rail above content | Full value, denominator wraps |
| <768px | Off-canvas behind a ≥44px control | **Cards, not horizontal scroll**; each card leads with UAH and state | One step per screen, next/back at thumb height | Compact `2,65 млн ₴`, exact value via `aria-label` |

Content max width 1240px (doc 05 §2); the dashboard may go full width.

- [ ] **Step 2: Implement the accessibility contract**

- Every interactive element keyboard-reachable and operable; logical tab order; no traps. `/demo` steps advance with Enter/Space and arrow keys.
- Visible focus: 2px Carbon outline at 2px offset. **Never `outline: none`.**
- Contrast ≥4.5:1 body, ≥3:1 large text and UI boundaries. **Lime `#C6FF34` is never body text on white** — use `signal-700 #84A625` for accent text.
- Status independence: icon + label + tone on every chip.
- Touch targets ≥44×44px, ≥8px apart.
- Body ≥16px everywhere.
- Landmarks: `<header> <nav> <main> <footer>`, one `<h1>` per route, no skipped heading levels.
- Forms: visible persistent labels; errors linked via `aria-describedby`, announced politely.
- Images: meaningful Ukrainian `alt` on the three Evidence Atlas derivatives; `alt=""` for decorative.
- `prefers-reduced-motion` removes transforms and continuous movement, leaving opacity-only change (doc 05 §12).
- The disclosure strip is `role="note"` and never `aria-hidden`.

- [ ] **Step 3: Verify at 360px**

Run: `pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo preview`
Then in a browser at 360×800, walk all ten routes. Expected: no horizontal page scroll anywhere.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/src
git commit -m "feat(demo): three-viewport responsive layout and WCAG 2.2 AA implementation"
```

---

### Task 16: The `apps/demo` QA harness — **artifacts never touch tracked files**

Addresses A.4.21, A.3.2b, and **Finding 1** directly.

**Files:**
- Create: `apps/demo/qa/verify.mjs`, `apps/demo/qa/browser.mjs`
- Uses: `apps/demo/qa/routes.mjs`, `apps/demo/qa/forbidden-claims.mjs`

**Interfaces:**
- Consumes: `SHIPPED_ROUTES`, `REDIRECTED_ROUTES`, `FORBIDDEN_CLAIM_PATTERNS`.
- Produces: `apps/demo/qa-output/qa-report.json` and `apps/demo/qa-output/screenshots/*.png` — **both gitignored**.

**Why this harness is new rather than copied:** `prototype/qa/verify.mjs` drives 25 routes that `apps/demo` never writes, hardcodes `buildSource: 'prototype/dist'` at line 447, and declares the exact 17 `flowFamilies` at line 449 that `validate_package.py:2401` asserts. Copying it fails on contact; editing it breaks `make validate`.

- [ ] **Step 1: Write `apps/demo/qa/browser.mjs`**

```js
import puppeteer from 'puppeteer'

/**
 * apps/demo uses full `puppeteer`, which manages a pinned per-platform Chrome
 * for Testing. That is deliberate: prototype/ uses puppeteer-core +
 * @sparticuz/chromium, whose Linux x86-64 ELF binary fails ENOEXEC on Apple
 * Silicon. An explicit override remains for constrained environments.
 */
export async function launch() {
  const executablePath = process.env.AKTFLOW_CHROME_PATH || undefined
  return puppeteer.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  })
}
```

- [ ] **Step 2: Write `apps/demo/qa/verify.mjs` — output directory first**

```js
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { launch } from './browser.mjs'
import { REDIRECTED_ROUTES, SHIPPED_ROUTES } from './routes.mjs'
import { FORBIDDEN_CLAIM_PATTERNS } from './forbidden-claims.mjs'

// FINDING 1: every generated artifact lands here, and this directory is
// gitignored. A QA run must leave `git status` clean. prototype/ writes 19
// tracked PNGs plus qa-results.json on every run; apps/demo must not.
const OUTPUT = path.resolve('qa-output')
const SHOTS = path.join(OUTPUT, 'screenshots')
const UPDATE_BASELINES = process.argv.includes('--update-baselines')

await rm(OUTPUT, { recursive: true, force: true })
await mkdir(SHOTS, { recursive: true })
```

- [ ] **Step 3: Serve `dist/` and assert every shipped route**

For each entry in `SHIPPED_ROUTES`, assert:
1. HTTP 200;
2. non-blank render (`document.body.innerText.trim().length > 0`);
3. **zero console errors** (collect via `page.on('console')` and `page.on('pageerror')`);
4. the Carbon disclosure strip is present (`[data-testid="disclosure-strip"]`);
5. exactly one `<h1>`.

- [ ] **Step 4: Assert every redirect**

For each entry in `REDIRECTED_ROUTES`, navigate and assert the final path is `/demo`. Assert **per path**, not sampled — eighteen assertions.

- [ ] **Step 5: Assert `/pilot` reachability from both entries**

Assert `[data-testid="demo-to-pilot"]` exists on `/demo` step 5, and `[data-testid="pilot-cta"]` exists on `/app`.

- [ ] **Step 6: Assert forbidden claims and GA states against the built bundle**

Read every file under `dist/` and assert none matches any `FORBIDDEN_CLAIM_PATTERNS` entry, and that neither `accepted_external` nor `returned_external` appears. This is the bundle-level counterpart to the Task 11 source-level test.

- [ ] **Step 7: Write the report to the ignored directory**

```js
const report = {
  ok: findings.length === 0,
  buildSource: 'apps/demo/dist',
  generatedAt: new Date().toISOString(),
  routes: SHIPPED_ROUTES,
  redirects: REDIRECTED_ROUTES,
  screenshots: shotNames,
  findings,
}
await writeFile(path.join(OUTPUT, 'qa-report.json'), `${JSON.stringify(report, null, 2)}\n`)
if (!report.ok) { console.error(findings.join('\n')); process.exit(1) }
```

**Baselines:** screenshots are written to `qa-output/screenshots/` on every run and are **never** compared by default. Only when `--update-baselines` is passed are they copied to `apps/demo/qa/baselines/` (a tracked directory), and that is the only circumstance in which a QA run may modify a tracked file. Committing a baseline is therefore always a deliberate, separate act.

- [ ] **Step 8: Run it and prove the tree stays clean**

Run:
```bash
pnpm --filter @aktflow/demo build
pnpm --filter @aktflow/demo qa
git status --porcelain
```
Expected: QA exits 0, and **`git status --porcelain` prints nothing.** If it prints anything, Finding 1 has been reintroduced — fix before continuing.

- [ ] **Step 9: Prove the prototype contract still holds**

Run:
```bash
git diff --exit-code -- prototype && echo "prototype clean"
make validate
```
Expected: `prototype clean`; `AktFlow package validation: PASS`.

- [ ] **Step 10: Commit**

```bash
git add apps/demo/qa apps/demo/package.json
git commit -m "feat(demo): QA harness writing only to gitignored qa-output/

Generated artifacts never modify tracked files, unlike prototype/'s harness
which rewrites 19 PNGs and qa-results.json every run. Visual baselines are
copied into the tracked tree only under an explicit --update-baselines flag."
```

---

### Task 17: Asset derivatives, font weight, static PDF

Addresses A.3.8 items 13–14, ER-7d.

**Files:**
- Create: `apps/demo/public/assets/*.{webp,avif}`, `apps/demo/public/package-demo.pdf`
- Modify: `apps/demo/src/main.tsx` (font imports), components using imagery

**Interfaces:**
- Consumes: `design-references/evidence-atlas/assets/*.png` (read-only source).
- Produces: derivative assets referenced via `<picture>`.

- [ ] **Step 1: Measure the real transfer weight before optimising**

Run:
```bash
pnpm --filter @aktflow/demo build
pnpm --filter @aktflow/demo preview &
# In the QA harness or devtools, record transferred bytes for a cold load of "/"
```
Record the number. **The A.3.8 item 13 budget is 1.5MB gzipped transferred, not `dist` size.** `@fontsource-variable` emits every language subset into `dist`, but each `@font-face` carries a `unicode-range`, so a browser rendering Ukrainian fetches only cyrillic and latin. Do not "fix" a problem the measurement does not show.

- [ ] **Step 2: Generate derivatives from the three source PNGs**

Source totals **6.16MB** (2,286,618 + 2,300,478 + 1,571,812 bytes) — roughly 4× the whole page budget, and PNG does not gzip meaningfully. Generate WebP and AVIF at delivery dimensions, **≤400KB per asset**:

```bash
# Requires a local encoder; sips ships with macOS, cwebp/avifenc via homebrew.
mkdir -p apps/demo/public/assets
for f in blueprint-folio cable-tray-evidence verified-stamp; do
  cwebp -q 80 -resize 1600 0 "design-references/evidence-atlas/assets/$f.png" -o "apps/demo/public/assets/$f.webp"
done
ls -l apps/demo/public/assets
```
Expected: each file ≤400KB. The source PNGs stay in `design-references/` as the source of truth and are **never shipped** (§A.6).

- [ ] **Step 3: Reference them via `<picture>` with meaningful Ukrainian `alt`**

- [ ] **Step 4: Produce the static PDF**

`/demo` step 5 offers a downloadable package PDF. There is **no PDF library in the dependency set** and Cyrillic font embedding is disproportionate (§A.6), so this is a **pre-rendered static file**. Produce it once by printing the package view to PDF from a browser, then commit it to `apps/demo/public/package-demo.pdf`. Confirm the Cyrillic text renders correctly in the exported file before committing.

- [ ] **Step 5: Re-measure and verify the budget**

Run: `pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa`
Expected: cold-load transfer <1.5MB gzipped; no single image >400KB.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/public apps/demo/src
git commit -m "feat(demo): Evidence Atlas derivatives, measured font weight, static package PDF"
```

---

### Task 18: CI coverage for `make validate` and browser QA

Addresses **Finding 3**. Sequenced deliberately **after** Task 16 so the harness is known to work on both platforms first.

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `apps/demo`'s `qa` script.
- Produces: CI jobs.

- [ ] **Step 1: Confirm the harness works on Linux before wiring CI**

The harness has only been proven on darwin/arm64. Full `puppeteer` downloads a per-platform browser at install, so Linux should work, but **verify rather than assume**: run the harness once in a Linux container.

Run:
```bash
docker run --rm -v "$PWD":/w -w /w node:24 bash -lc \
  "corepack enable && pnpm install --frozen-lockfile && pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa"
```
Expected: exit 0. If Chrome fails to launch for missing shared libraries, add the documented dependency install to the CI step rather than switching browser strategy.

- [ ] **Step 2: Add a `demo-qa` job to `.github/workflows/ci.yml`**

```yaml
  demo-qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @aktflow/demo build
      - run: pnpm --filter @aktflow/demo qa
      - name: Upload QA artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: demo-qa-output
          path: apps/demo/qa-output/
          retention-days: 14
```

Screenshots and the report go to **CI artifact storage**, never into the repository — the CI half of Finding 1.

- [ ] **Step 3: Add a `package-validate` job**

```yaml
  package-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: npm --prefix prototype ci
      - run: make validate
      - name: Assert prototype tree is unmodified
        run: git diff --exit-code -- prototype
```

The final step is A.4.19 enforced in CI: `make validate` runs the prototype QA harness, which rewrites tracked screenshots, so this job proves the *committed* state is self-consistent. **If this step fails because the harness produces non-deterministic screenshots, do not paper over it — report it and stop.** Non-determinism there is pre-existing repository debt (see Task 19) and needs an explicit decision, not a `git checkout` in CI.

- [ ] **Step 4: Verify locally what can be verified**

Run: `make validate && git diff --exit-code -- prototype`
Expected: PASS, then the diff step's real behaviour is observed and recorded.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run make validate and apps/demo browser QA

CI previously ran only typecheck, test and build, so neither the package
contract nor any browser assertion was covered. QA artifacts go to CI artifact
storage rather than the repository."
```

---

### Task 19: Record deferred repository technical debt

Addresses **Finding 2**. Deliberately a documentation-only task.

**Files:**
- Modify: `docs/40-phase1-discovery-outreach.md` §A.6

**Interfaces:** none.

- [ ] **Step 1: Append rows to the §A.6 "NOT in scope for Child A" table**

```markdown
| **`validate_package.py` crashes on absent hard-read docs** | `validate_package.py:756` reads `20-flow-catalog.md` unconditionally; ten docs are read this way, so removing one produces a `FileNotFoundError` traceback instead of a clean finding. Child A does not require changing this. **Deferred repository technical debt** — do not expand Child A into a general validator error-handling refactor |
| **`prototype/` QA screenshots are not byte-stable** | Every `npm --prefix prototype run qa` / `make validate` rewrites 19 tracked PNGs plus `qa-results.json`, leaving the worktree dirty. `apps/demo` avoids this by design (A.3.2b, gitignored `qa-output/`), but the prototype behaviour is unchanged and remains **deferred repository technical debt**. Decide separately whether those artifacts should be tracked at all |
```

- [ ] **Step 2: Verify the doc contract still passes**

Run: `make validate`
Expected: `AktFlow package validation: PASS`, `documents=41`.

- [ ] **Step 3: Commit**

```bash
git add docs/40-phase1-discovery-outreach.md
git commit -m "docs: record validator crash and screenshot non-determinism as deferred debt"
```

---

### Task 20: Deploy and the twenty-item verification gate

Addresses A.3.8 (all twenty items), A.4.13.

**Files:**
- Create: `apps/demo/README.md`
- Modify: `design-qa.md`

**Interfaces:** none.

- [ ] **Step 1: Configure the static deploy**

`apps/demo` is a static Vite SPA. The host must rewrite **all** unknown paths to `/index.html`, otherwise the client-side catch-all in Task 6 never runs and A.4.3 fails at the CDN rather than in the app. Record the chosen host and its rewrite rule in `apps/demo/README.md`.

- [ ] **Step 2: Run the automatable gate items**

Run:
```bash
git diff --exit-code -- prototype          # item 2
make validate                              # item 1
pnpm turbo run build typecheck             # item 4
pnpm --filter @aktflow/demo qa             # items 3, 5, 6, 7, 11, 12
git status --porcelain                     # must be empty — Finding 1
```
Expected: all exit 0; `git status` empty.

- [ ] **Step 3: Run the manual gate items and record them**

Items 8, 9, 10, 16, 17, 18, 19, 20 are manual and **not substitutable by any tool**:
- incognito load with no extensions and no cached session;
- real Android phone and real iPhone over mobile data (not desktop emulation);
- `/pilot` submission actually delivering, and the receipt stating retention and deletion;
- doc 05 §13 visual QA against `design-references/evidence-atlas/selected-direction.png`;
- full keyboard pass on every shipped route;
- screen-reader pass on `/demo` and `/pilot` (VoiceOver or NVDA);
- contrast audit against the Evidence Atlas tokens;
- surface-proportion check — Paper/White 74–78%, Carbon 17–21%, **Lime ≤5%**.

Record each with **date, device and browser**.

- [ ] **Step 4: Write the visual QA decision to `design-qa.md`**

doc 05 §13.4 requires the decision recorded in project-root `design-qa.md`. Append a dated section covering crop quality, route/header context, money hierarchy, evidence visibility, responsive overflow, focus states and the reduced-motion fallback.

- [ ] **Step 5: Commit**

```bash
git add apps/demo/README.md design-qa.md
git commit -m "docs(demo): deploy configuration and completed twenty-item verification gate"
```

- [ ] **Step 6: Report the gate result**

Child B may not send anything until **all twenty items pass**. If any fails, report it and stop — do not partially open the gate.

---

## Open dependency, carried from review

**The deploy domain is unresolved.** §A.3.8 prefers `demo.aktflow.com` over a `*.vercel.app` subdomain for credibility and deliverability, but nothing in the repo shows `aktflow.com` is registered or controlled. Task 18's deploy step and Task 20's step 1 both need an answer. This is the single unresolved decision carried from the design, engineering and CEO reviews. It blocks cold sending only — the CEO review ungated the warm, community and public-corpus tracks from the demo.

---

## Self-Review

**Spec coverage.** §A.3.0 design binding → Global Constraints + Task 2. §A.3.1 tree and types → Tasks 1, 3. §A.3.2 route set → Tasks 6, 10. §A.3.2b QA harness → Task 16. §A.3.2a navigation → Tasks 6, 7. §A.3.3 journey → Tasks 8, 9. §A.3.4 data → Task 5. §A.3.5 honesty → Tasks 6, 11. §A.3.6 `/pilot` → Task 13. §A.3.7 responsive/a11y → Task 15. §A.3.7a states → Task 14. §A.3.8 gate → Tasks 17, 20. A.4.1–A.4.22 all mapped. Findings 1, 2, 3 → Tasks 16, 19, 18.

**Type consistency.** `WorkItem`, `Requirement`, `ReadinessState` defined once in `domain/types.ts` and re-exported through `domain/readiness.ts`; `isUnrecoverable(item, today)` keeps that signature in Tasks 3, 5, 8, 9. `formatUah` defined in Task 9 and used in Task 9 only. `SIDEBAR_ITEMS`, `DEMO_STEPS`, `SHIPPED_ROUTES`, `REDIRECTED_ROUTES`, `FORBIDDEN_CLAIM_PATTERNS`, `DRAFT_KEY`, `PilotDraft` each defined once and consumed by name.

**Known gap, stated rather than hidden.** Tasks 10, 12, 13 Step 5, 14 Step 2 and 15 describe requirements and give partial component code rather than complete file listings, because the page bodies are long, largely presentational, and derived from named read-only references in `prototype/src/pages/`. Every acceptance-criterion-bearing detail — class names, `data-testid` hooks, canonical strings, forbidden strings, state-table cells, a11y rules — is specified exactly. An implementer will need to read the referenced prototype file for layout, which is why each of those steps names the exact source path.
