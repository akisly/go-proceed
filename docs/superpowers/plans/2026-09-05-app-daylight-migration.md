# `apps/app` on Daylight — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the field client of `apps/app` off its legacy stylesheet onto `@goproceed/ui` (one Tailwind entry point, one Button, Onest), and give the office dashboard its six-viewport visual pass under the Daylight palette — fixing what the pass finds.

**Architecture:** `apps/app/app/globals.css` becomes a forty-line file that imports `@goproceed/ui/base.css`; `dash-theme.css`, `src/ui/button.tsx` and `src/ui/cn.ts` are deleted; the five field-client files are rewritten onto the role vocabulary and the shared `Button`/`Input`/`Label`; `packages/ui`'s Button gains a `destructive` variant with a counted call site; `qa/field.mjs` gains a «daylight visual audit» over nine routes × six widths (+ two reduced-motion passes) whose screenshots the controller reviews; two source-level tests in `packages/testing` make the migration permanent.

**Tech Stack:** Next 16.3.1 (App Router), React 19.2.8, Tailwind 4.3.3 (`@goproceed/ui/base.css`, Preflight), `@goproceed/ui` components, `@fontsource-variable/onest` 5.3.1, vitest 3.2.4 (node), puppeteer 25.8.0, local Supabase stack (Docker Desktop, migration 0083).

**Spec:** `docs/superpowers/specs/2026-09-05-app-daylight-migration-design.md` — every task below argues from it; conflicts resolve against the spec.

## Global Constraints

- **Roles, never values.** No hex, no `var(--gp-<ramp>-<step>)`, no literal control height (`h-11`, `size-9`): token heights (`h-(--gp-control-height-touch)`) or the shared component. `primitive-leak.test.ts` and `component-contract.test.ts` are the gates.
- **GENERATED files are never hand-edited** (`packages/ui/src/*.generated.*`, `docs/design/01-tokens.md`, `packages/tokens/src/tokens.dtcg.json`). This plan does not need to touch `tokens.json` at all; `pnpm --filter @goproceed/tokens generate` must produce no diff.
- **Motion only from `@goproceed/ui/motion`.** No `motion/react` import in `apps/app`.
- **No Tailwind class as a template literal.** `cx("a", cond && "b")` is fine; `` `bg-${tone}` `` is not.
- **At most one `bg-action-signal` per screen** (`02-building-ui.md` rule 10 as corrected 2026-09-05).
- **Public copy Ukrainian, repo docs English, `design-references/visual-directions/README.md` Russian.** No copy on the five field screens changes in this plan — the QA asserts the strings «Вхід за одноразовим кодом», «Надіслати код», «Мої доручення», «Скасувати фото», «Вийти з системи?» verbatim.
- **The owner never wants `supabase db reset` run without asking.** Bring the stack up with `open -a Docker`; migrations already match (0083). `qa/field.mjs` mints and deletes its own users and seeds through the API.
- **Never `git stash`.** Never touch auth code (`src/lib/auth*`, `proxy.ts`, `app/v1/**`) or `supabase/migrations/**`.
- **Third-party docs first** (CLAUDE.md): before touching Tailwind's `@source`/Preflight behaviour or puppeteer's `emulateMediaFeatures`, read the installed docs (`node_modules/tailwindcss/…`, `node_modules/puppeteer-core/lib/esm/puppeteer/api/Page.d.ts`) and cite version + path in the commit body.
- **Gate before «done»** (spec §6.4), output pasted into `docs/superpowers/plans/evidence/2026-09-05-app-daylight-gate.md`, never paraphrased.
- Branch: `claude/daylight-app-p2` (already exists, based on `origin/main` at `efc2cdb`). One commit per task, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File map

| Path | Action | Owner task |
|---|---|---|
| `packages/testing/src/app-entry.test.ts` | Create | 2 |
| `packages/testing/src/component-contract.test.ts` | Modify (one `it`) | 3 |
| `packages/ui/src/components/Button.tsx` | Modify (docstring + `VARIANT.destructive`) | 3 |
| `apps/landing/app/kitchen-sink/components/page.tsx` | Modify (Case 01) | 3 |
| `apps/app/app/(app)/page.tsx` | Modify (classes, import) | 4 |
| `apps/app/app/(app)/a/[assignmentId]/page.tsx` | Modify | 4 |
| `apps/app/app/(app)/a/[assignmentId]/capture.tsx` | Modify | 4 |
| `apps/app/app/(auth)/login/page.tsx` | Modify | 4 |
| `apps/app/app/(auth)/login/otp-form.tsx` | Modify (Input/Label) | 4 |
| `apps/app/src/ui/button.tsx`, `apps/app/src/ui/cn.ts` | Delete | 4 |
| `apps/app/app/globals.css` | Rewrite in place | 4 |
| `apps/app/app/dash/dash-theme.css` | Delete | 4 |
| `apps/app/app/layout.tsx`, `apps/app/app/dash/layout.tsx` | Modify | 4 |
| `apps/app/package.json`, `pnpm-lock.yaml` | Modify (deps) | 4 |
| `apps/app/qa/field.mjs` | Modify (font probe, new audit, `EXPECTED_AUDITS`) | 5 |
| `.gitignore` | Modify (`apps/app/qa-output-before/`) | 1 |
| whatever the screenshot review names | Modify | 6 |
| `.interface-design/system.md`, `docs/design/02-building-ui.md`, `docs/design/2026-08-19-design-system-rewrite-plan.md`, `docs/design/03-ui-references.md`, `TODOS.md`, `HANDOFF.md` | Modify | 7 |
| `docs/superpowers/plans/evidence/2026-09-05-app-daylight-gate.md` | Create (Task 1 baseline, Task 6 review, Task 8 gate) | 1, 6, 8 |

---

### Task 1: The baseline — stack up, harness green, «before» captures

**Files:**
- Modify: `.gitignore` (one line)
- Create: `docs/superpowers/plans/evidence/2026-09-05-app-daylight-gate.md`

**Interfaces:** Produces `apps/app/qa-output-before/` (screenshots + `qa-report.json` of the pre-migration app) that Task 6 compares against.

- [ ] **Step 1: Bring the local stack up**

```bash
open -a Docker
until docker info >/dev/null 2>&1; do sleep 3; done
cd /Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a
supabase start 2>&1 | tail -5
supabase status 2>&1 | grep -E "API URL|DB URL|Studio" 
docker exec -i supabase_db_goproceed psql -U postgres -tAc "select max(version) from supabase_migrations.schema_migrations"
```

Expected: the last line prints `0083`. If it prints less, **stop and report** — do not apply migrations (the owner applies them by hand).

- [ ] **Step 2: Build and run the harness as it is**

```bash
pnpm --filter @goproceed/app build 2>&1 | tail -3
pnpm --filter @goproceed/app qa 2>&1 | tail -5
```

Expected: `QA passed: 8 of 8 expected audits ran (...), zero findings.` If it is not green on `main`, record the findings verbatim in the evidence file under «Baseline» and continue — the migration must not make them worse, and it is not asked to fix them.

- [ ] **Step 3: Keep the captures**

```bash
rm -rf apps/app/qa-output-before && cp -R apps/app/qa-output apps/app/qa-output-before
printf '%s\n' 'apps/app/qa-output-before/' >> .gitignore
ls apps/app/qa-output-before/screenshots | wc -l
```

- [ ] **Step 4: Start the evidence file**

Create `docs/superpowers/plans/evidence/2026-09-05-app-daylight-gate.md`:

```markdown
# Evidence — `apps/app` on Daylight (spec 2026-09-05-app-daylight-migration-design.md)

## Baseline (Task 1, <date>, HEAD <sha>)

Local stack: Docker up, `supabase_db_goproceed` at migration 0083 (equal to the repository).

`pnpm --filter @goproceed/app qa` on the pre-migration app:

```
<paste the tail: the QA passed/failed line and every finding, if any>
```

Captures kept in `apps/app/qa-output-before/` (git-ignored): <N> screenshots.
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore docs/superpowers/plans/evidence/2026-09-05-app-daylight-gate.md
git commit -m "docs(evidence): apps/app Daylight — the baseline harness run before the migration

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The source test that makes the migration permanent (red)

**Files:**
- Create: `packages/testing/src/app-entry.test.ts`

**Interfaces:** Consumes the repo tree only. Produces the gate Task 4 turns green; Task 8 adds the file to the eleven-suite command.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * `apps/app` has ONE Tailwind entry point and it is `@goproceed/ui/base.css`.
 *
 * Until 2026-09-05 it had two. `app/globals.css` was a 391-line hand-rolled
 * `@theme` from before `packages/tokens` existed (Evidence Atlas hex, Inter,
 * its own scale) and loaded on every route; `app/dash/dash-theme.css` imported
 * the real system for `/dash/**` only, and pinned `--font-display` back
 * because the legacy sheet read it on every heading. Two `@theme` blocks in
 * one document, two Buttons, two `cn` helpers — and a visual pass that could
 * never cover the field client, because its names were not the system's.
 *
 * This test is what stops it happening again: one `.css` under `app/`, it
 * imports the shared base, and no retired name survives anywhere in the app.
 * Spec: docs/superpowers/specs/2026-09-05-app-daylight-migration-design.md §6.1.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");
const appRoot = join(repoRoot, "apps/app");

/** Names the legacy `@theme` defined and the roles replaced (spec §4.1). */
const RETIRED = [
  "text-foreground", "bg-surface-muted", "bg-surface-sunken", "border-border",
  "text-destructive", "-warning-", "bg-carbon", "bg-accent", "text-accent-ink",
  "readiness-", "font-display", "goproceed-app", "ease-out-strong",
  "shadow-drawer", "animate-chip-in",
];

/** Packages the legacy Button/cn pulled in; the shared package owns them now. */
const RETIRED_IMPORTS = [
  "@fontsource-variable/inter", "class-variance-authority", "tailwind-merge", "clsx",
];

const EXTENSIONS = [".ts", ".tsx", ".css"];

function* walk(path: string): Generator<string, void, unknown> {
  let st;
  try { st = statSync(path); } catch { return; }
  if (st.isFile()) { yield path; return; }
  for (const entry of readdirSync(path)) {
    if (entry === "node_modules" || entry === ".next" || entry === "qa-output" || entry === "qa-output-before") continue;
    yield* walk(join(path, entry));
  }
}

const sources = () =>
  [...walk(join(appRoot, "app")), ...walk(join(appRoot, "src"))]
    .filter((f) => EXTENSIONS.some((e) => f.endsWith(e)));

describe("apps/app has one stylesheet, and it is the system's", () => {
  it("exactly one .css file under app/, and it imports @goproceed/ui/base.css", () => {
    const css = [...walk(join(appRoot, "app"))].filter((f) => f.endsWith(".css"));
    expect(css.map((f) => relative(repoRoot, f))).toEqual(["apps/app/app/globals.css"]);
    expect(readFileSync(css[0]!, "utf8")).toContain('@import "@goproceed/ui/base.css";');
  });

  it("no retired token name survives under app/ or src/", () => {
    const findings: string[] = [];
    for (const file of sources()) {
      const text = readFileSync(file, "utf8");
      for (const name of RETIRED) {
        if (text.includes(name)) findings.push(`${relative(repoRoot, file)}: ${name}`);
      }
    }
    expect(findings).toEqual([]);
  });

  it("no file imports a package the shared Button/cn made redundant", () => {
    const findings: string[] = [];
    for (const file of sources()) {
      const text = readFileSync(file, "utf8");
      for (const pkg of RETIRED_IMPORTS) {
        if (new RegExp(`from ["']${pkg}["']|import ["']${pkg}["']`).test(text)) {
          findings.push(`${relative(repoRoot, file)}: ${pkg}`);
        }
      }
    }
    expect(findings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — it must fail on the current tree**

```bash
pnpm --filter @goproceed/testing exec vitest run src/app-entry.test.ts 2>&1 | tail -25
```

Expected: 3 failed — two css files (`globals.css`, `dash/dash-theme.css`), a long list of retired names (`text-foreground` in five files, `goproceed-app` in `layout.tsx`, `font-display` in the pages and in `globals.css`, …), and the four retired imports in `src/ui/*` + `app/layout.tsx`.

- [ ] **Step 3: Commit the red test**

```bash
git add packages/testing/src/app-entry.test.ts
git commit -m "test(app): apps/app must have one stylesheet, the system's — red until the field client migrates

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The `destructive` Button variant, with a counted call site

**Files:**
- Modify: `packages/testing/src/component-contract.test.ts:196-202`
- Modify: `packages/ui/src/components/Button.tsx:19-24, 35-41`
- Modify: `apps/landing/app/kitchen-sink/components/page.tsx:116-126`

**Interfaces:** Produces `ButtonVariant` including `"destructive"`; Task 4's `capture.tsx` is the one permitted call site.

- [ ] **Step 1: Rewrite the contract (red)**

In `component-contract.test.ts`, replace the `it("Button has no destructive variant", …)` block with:

```ts
  it("Button's destructive variant has exactly one call site", () => {
    // [Correction, 2026-09-05.] This ruling used to read «Button has no
    // destructive variant: nothing under /app/** deletes anything». That
    // stopped being true when the field client's capture island shipped
    // «Скасувати фото» — it drops a photo the server does not have,
    // irreversibly — and the field client answered by keeping a private
    // Button with the variant (apps/app/src/ui/button.tsx, deleted 2026-09-05).
    // One Button for the system, then; and the variant is held to the shape
    // of the old ruling by COUNTING its call sites. A second irreversible
    // action is a deliberate act that edits this number, never a drift.
    expect(code("Button.tsx")).toMatch(/destructive:/);
    const callSites: string[] = [];
    for (const root of ["apps/app/app", "apps/app/src", "apps/landing/app", "apps/landing/components"]) {
      for (const file of walkTsx(join(repoRoot, root))) {
        if (file.includes("kitchen-sink") || /\.test\.tsx?$/.test(file)) continue;
        const text = readFileSync(file, "utf8");
        if (/variant=["']destructive["']/.test(text)) callSites.push(relative(repoRoot, file));
      }
    }
    expect(callSites).toEqual(["apps/app/app/(app)/a/[assignmentId]/capture.tsx"]);
  });
```

and add, next to the other helpers at the top of the file (after `const code = …`):

```ts
import { statSync } from "node:fs";
import { relative } from "node:path";

function* walkTsx(path: string): Generator<string, void, unknown> {
  let st;
  try { st = statSync(path); } catch { return; }
  if (st.isFile()) { if (path.endsWith(".tsx")) yield path; return; }
  for (const entry of readdirSync(path)) {
    if (entry === "node_modules" || entry === ".next") continue;
    yield* walkTsx(join(path, entry));
  }
}
```

(merge the two `import` lines into the existing `node:fs`/`node:path` imports rather than adding duplicates).

- [ ] **Step 2: Run — red**

```bash
pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts -t "destructive" 2>&1 | tail -12
```

Expected: FAIL — `code("Button.tsx")` does not match `/destructive:/`.

- [ ] **Step 3: The variant**

In `Button.tsx`, replace the docstring paragraph

```
 * There is NO `destructive` variant. Nothing under `/app/**` deletes anything,
 * so a destructive variant could only ever be used by being reached for
 * wrongly — and a variant that exists is a variant that will be used.
```

with

```
 * `destructive` — irreversible, and only irreversible. Outlined at rest,
 *   filled on hover: the border and the ink carry it, so beside a signal
 *   primary it does not out-shout the action the person is there to take.
 *   [Added 2026-09-05. This paragraph used to say there was NO destructive
 *   variant because nothing under /app/** deletes anything. The field
 *   client's «Скасувати фото» drops a photo the server never received, and
 *   it had kept a private Button for that one control. One Button now; the
 *   contract test counts the variant's call sites — one — so a second
 *   irreversible action is a deliberate edit to that number.]
```

change «Five variants, and the set is closed.» to «Six variants, and the set is closed.», and add to `VARIANT` after `link`:

```ts
  destructive:
    "border border-status-blocked-line bg-surface text-status-blocked-fg " +
    "hover:bg-status-blocked-fg hover:text-action-fg",
```

- [ ] **Step 4: The kitchen sink**

In `apps/landing/app/kitchen-sink/components/page.tsx`, Case 01: change the `rule` to

```
rule="Шість варіантів, набір закритий. destructive — лише для незворотної дії, і в продукті рівно один виклик: контракт-тест їх рахує. Сигнальна дія — не більше однієї на екран."
```

and add, after the `link` button:

```tsx
            <Button variant="destructive" size="sm">Скасувати фото</Button>
```

- [ ] **Step 5: Green, and the neighbours**

```bash
pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts src/tw-merge.test.ts 2>&1 | tail -6
pnpm --filter @goproceed/landing test 2>&1 | grep -E "Test Files|Tests "
pnpm --filter @goproceed/ui typecheck 2>&1 | tail -2
```

Expected: contract green (the call-site scan matches the text `variant="destructive"`, which `capture.tsx` already carries — it does not matter that the file still imports the legacy Button until Task 4), landing green, typecheck green. If the landing's `ui-components.test.tsx` asserts the sink's Button case, update that assertion.

- [ ] **Step 6: Commit**

```bash
git add packages/testing/src/component-contract.test.ts packages/ui/src/components/Button.tsx apps/landing/app/kitchen-sink/components/page.tsx
git commit -m "feat(ui): Button gains destructive — outlined, for irreversible actions, with a counted call site

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The migration — five files, one stylesheet, one Button

**Files:**
- Modify: `apps/app/app/(app)/page.tsx`, `apps/app/app/(app)/a/[assignmentId]/page.tsx`, `apps/app/app/(app)/a/[assignmentId]/capture.tsx`, `apps/app/app/(auth)/login/page.tsx`, `apps/app/app/(auth)/login/otp-form.tsx`
- Delete: `apps/app/src/ui/button.tsx`, `apps/app/src/ui/cn.ts`, `apps/app/app/dash/dash-theme.css`
- Rewrite: `apps/app/app/globals.css`
- Modify: `apps/app/app/layout.tsx`, `apps/app/app/dash/layout.tsx`, `apps/app/package.json`

**Interfaces:** Consumes `Button`, `Input`, `Label` from `@goproceed/ui/components` (Task 3 for `destructive`). Produces the tree Task 2's test is green on and Task 5's harness runs against.

- [ ] **Step 1: Read the installed docs first (CLAUDE.md rule)**

```bash
ls node_modules/.pnpm | grep -E "^tailwindcss@|^@tailwindcss\+postcss@"
sed -n 1,80p node_modules/.pnpm/tailwindcss@4.3.3/node_modules/tailwindcss/preflight.css
```

Confirm in the installed Preflight: `*, ::before, ::after { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid }`, `a { color: inherit; text-decoration: inherit }`, `button, input, select, optgroup, textarea { font: inherit }`, `ol, ul, menu { list-style: none }`, `table { border-collapse: collapse }`, `img, svg, … { display: block }`. Cite the path in the commit body. If any of these is absent in 4.3.3, keep that one rule in `globals.css`'s `@layer base` with a comment saying so.

- [ ] **Step 2: The five files — imports**

In every one of the five, replace the legacy import with the shared one:

| file | old | new |
|---|---|---|
| `(app)/page.tsx` | `import { Button } from "../../src/ui/button";` | `import { Button } from "@goproceed/ui/components";` |
| `(app)/a/[assignmentId]/page.tsx` | `import { Button } from "../../../../src/ui/button";` | same |
| `(app)/a/[assignmentId]/capture.tsx` | `import { Button } from "../../../../src/ui/button";` | same |
| `(auth)/login/otp-form.tsx` | `import { Button } from "../../../src/ui/button";` | `import { Button, Input, Label } from "@goproceed/ui/components";` |
| `(auth)/login/page.tsx` | *(no Button import)* | — |

- [ ] **Step 3: The five files — classes (spec §4.1, exhaustive)**

Apply these literal replacements across the five files (every occurrence):

```
text-foreground-secondary  →  text-ink-secondary
text-foreground-muted      →  text-ink-muted
text-foreground            →  text-ink            (after the two above)
text-destructive           →  text-status-blocked-fg
text-warning-foreground    →  text-status-attention-fg
bg-warning-surface         →  bg-status-attention
border-warning             →  border-status-attention-line
hover:bg-surface-muted     →  hover:bg-subtle
bg-surface-muted           →  bg-subtle
border-border              →  border-line
 font-display              →  (delete the class; keep the space tidy)
```

A script that does exactly that, run from the repo root:

```bash
python3 - <<'EOF'
import re, pathlib
files = [
  "apps/app/app/(app)/page.tsx",
  "apps/app/app/(app)/a/[assignmentId]/page.tsx",
  "apps/app/app/(app)/a/[assignmentId]/capture.tsx",
  "apps/app/app/(auth)/login/page.tsx",
  "apps/app/app/(auth)/login/otp-form.tsx",
]
pairs = [
  ("text-foreground-secondary", "text-ink-secondary"),
  ("text-foreground-muted", "text-ink-muted"),
  ("text-foreground", "text-ink"),
  ("text-destructive", "text-status-blocked-fg"),
  ("text-warning-foreground", "text-status-attention-fg"),
  ("bg-warning-surface", "bg-status-attention"),
  ("border-warning", "border-status-attention-line"),
  ("hover:bg-surface-muted", "hover:bg-subtle"),
  ("bg-surface-muted", "bg-subtle"),
  ("border-border", "border-line"),
  (" font-display", ""),
]
for f in files:
    p = pathlib.Path(f); s = p.read_text()
    for a, b in pairs: s = s.replace(a, b)
    p.write_text(s)
print("ok")
EOF
grep -rn "file:h-11" "apps/app/app/(app)/a/[assignmentId]/capture.tsx"
```

Then, by hand:

- `capture.tsx`: `file:h-11` → `file:h-(--gp-control-height-touch)`; `file:border-border` was already turned into `file:border-line` by the script — verify. Update the comment above `<dd className="break-all">` (it says `globals.css` clears `--font-*` and defines only `--font-display`/`--font-sans`): replace with «`break-all`, and no `font-mono` — the hash is a figure to copy, not code to read, and the system's mono face is for indices (`02-building-ui.md` §9).» Update the comment above the discard `<Button>` — it names `src/ui/button.tsx`; say «`@goproceed/ui`'s Button, whose contract test counts this as the variant's one call site».
- `otp-form.tsx`: the two `<label … className="text-data font-medium text-ink">…</label>` become `<Label htmlFor="otp-code">Код із листа</Label>` / `<Label htmlFor="otp-email">Електронна пошта</Label>`; the two `<input … className="h-11 rounded-control border border-line bg-surface px-3 text-body text-ink" />` become `<Input … />` with the same attributes and **no** `className`. Keep `autoFocus`, `inputMode`, `pattern`, `maxLength`, `autoComplete`, `required`, `value`, `onChange`, `name`, `id`, `type` exactly as they were.
- `(app)/a/[assignmentId]/page.tsx`: the back link keeps `variant="link" size="sm" className="self-start px-0 text-data"` — the shared `link` variant already applies `h-auto px-0`, so `px-0` is redundant but harmless; leave it.

- [ ] **Step 4: Delete the private Button and `cn`**

```bash
git rm apps/app/src/ui/button.tsx apps/app/src/ui/cn.ts
grep -rn "src/ui/" apps/app/app apps/app/src || echo "no importers left"
```

- [ ] **Step 5: `globals.css` — rewrite in place**

Replace the whole file with:

```css
/* ===========================================================================
 * apps/app — the ONE Tailwind entry point, since 2026-09-05.
 *
 * WHAT THIS FILE WAS. Until 2026-09-05 it was a 391-line hand-rolled
 * `@theme` from before `packages/tokens` existed: Evidence Atlas hex
 * (`#c6ff34` lime, `#171717` carbon, `#fbfbfb` paper), Inter for display
 * and data, its own type scale, radii and breakpoints, and a `.goproceed-app`
 * base layer that re-implemented Preflight by hand. It loaded from the root
 * layout on every route, so the dashboard — built on `@goproceed/ui` — had
 * to import the real system from a SECOND entry file (`dash/dash-theme.css`)
 * and pin `--font-display` back on `:root`, because this sheet read that
 * token on every heading. Two `@theme` blocks in one document, two Buttons,
 * two `cn` helpers.
 *
 * WHAT IT IS NOW. `@goproceed/ui/base.css` — Preflight, the generated theme
 * from `packages/tokens/src/tokens.json`, the focus ring, the reduced-motion
 * block, `body`'s face (Onest) and colour, tabular figures on th/td/output/
 * time/data, the `touch` and `dark` variants. Every rule the old base layer
 * carried is Preflight's own (tailwindcss 4.3.3, preflight.css): box-sizing,
 * zero margins, `a { color: inherit; text-decoration: inherit }`,
 * `button/input/select/textarea { font: inherit }`, `ol,ul { list-style:
 * none }`, `table { border-collapse: collapse }`, `svg { display: block }`.
 * Dropped with no call site: `text-wrap: pretty/balance`, `--spacing-strip`.
 *
 * Every number in this app comes from a token or it does not appear. There is
 * no `@theme` here and there must never be one: a second theme block is how
 * the cascade race this file's predecessor documented came back.
 * Spec: docs/superpowers/specs/2026-09-05-app-daylight-migration-design.md §3.
 * Gate: packages/testing/src/app-entry.test.ts.
 * ========================================================================= */

@import "@goproceed/ui/base.css";

/* Shared components carry utilities that never appear in this app's own
 * source (Dialog/DropdownMenu's `shadow-modal`, `bg-overlay`, …). */
@source "../../../packages/ui/src";

/* Tailwind v4 scans the whole project and does not distinguish a test fixture
 * from a component; v1 shipped deliberately-unapproved fixture colours as
 * production CSS this way. */
@source not "../tests";
@source not "../qa";
@source not "../.next";

/* The one rule base.css does not carry: the product's own figure hooks.
 * base.css makes th/td/output/time/data tabular; these attributes are how a
 * money or count figure outside a table asks for the same treatment. */
@layer base {
  [data-money],
  [data-numeric] {
    font-variant-numeric: tabular-nums;
  }
}
```

- [ ] **Step 6: The layouts**

`apps/app/app/layout.tsx`:
- `import "@fontsource-variable/inter";` → `import "@fontsource-variable/onest";`
- `<body className="goproceed-app">{children}</body>` → `<body>{children}</body>`, and replace the JSX comment block above it with:

```tsx
      {/*
       * No scope class on <body> since 2026-09-05. The base rules — focus
       * ring, reduced motion, the face, the resets — come from
       * `@goproceed/ui/base.css` through `./globals.css`, and they are global
       * by design: every route in this app is on the one system.
       */}
```

`apps/app/app/dash/layout.tsx`:
- delete the comment beginning `// The dashboard runs on @goproceed/ui/base.css, whose --gp-font-sans is Onest` through `import "./dash-theme.css";` (both import lines go; Onest is loaded once, at the root).
- in the big docstring, the paragraph that starts «The field client's root route is out of this task's scope» stays; add one sentence at the end of the docstring: «Since 2026-09-05 the dashboard shares the app's one stylesheet (`app/globals.css`, on `@goproceed/ui/base.css`); the separate `dash-theme.css` entry and its `--font-display` pin are gone with the legacy sheet they existed to undo.»

```bash
git rm apps/app/app/dash/dash-theme.css
```

- [ ] **Step 7: Dependencies**

In `apps/app/package.json` remove `"@fontsource-variable/inter"`, `"@radix-ui/react-slot"`, `"class-variance-authority"`, `"clsx"`, `"tailwind-merge"` from `dependencies` (keep `@fontsource-variable/onest`, `tailwindcss`, `@tailwindcss/postcss`). Then:

```bash
pnpm install --offline 2>&1 | tail -2 || pnpm install 2>&1 | tail -2
git diff --stat pnpm-lock.yaml
```

- [ ] **Step 8: Green — the tests, the types, the build, the CSS**

```bash
pnpm --filter @goproceed/testing exec vitest run src/app-entry.test.ts src/component-contract.test.ts src/primitive-leak.test.ts 2>&1 | tail -6
pnpm turbo run typecheck 2>&1 | tail -2
pnpm --filter @goproceed/app exec vitest run --exclude "**/*.int.test.ts" 2>&1 | grep -E "Test Files|Tests "
pnpm --filter @goproceed/app build 2>&1 | tail -3
grep -l "shadow-modal\|bg-overlay" apps/app/.next/static/css/*.css | head -2
grep -c "Inter" apps/app/.next/static/css/*.css || true
```

Expected: the three suites green (the app-entry test now passes all three `it`s); typecheck 10/10; app unit suites 524 passed / 1 skipped; build compiles; at least one CSS chunk carries the dialog utilities; zero `Inter` in the built CSS.

- [ ] **Step 9: Commit**

```bash
git add -A apps/app packages pnpm-lock.yaml
git commit -m "feat(app): the field client on Daylight — one stylesheet, one Button, Onest

apps/app/app/globals.css is forty lines on @goproceed/ui/base.css; the
391-line legacy @theme (Evidence Atlas hex, Inter, a hand-rolled Preflight)
is gone, and with it dash/dash-theme.css and its --font-display pin,
src/ui/button.tsx and src/ui/cn.ts. The five field-client files use the
role vocabulary (spec §4.1) and the shared Button/Input/Label.

Preflight coverage of the old base layer checked against the installed
tailwindcss 4.3.3 (node_modules/.pnpm/tailwindcss@4.3.3/node_modules/
tailwindcss/preflight.css): box-sizing, margins, a/button/input resets,
list-style, border-collapse, svg display — all present.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `qa/field.mjs` — the font probe everywhere, and the daylight visual audit

**Files:**
- Modify: `apps/app/qa/field.mjs` (`EXPECTED_AUDITS` ~1496; the probe at ~3822-3846; a new `runAudit` block inserted immediately BEFORE `await runAudit(ctx, "dashboard profile and sign-out", …)` at ~3256)

**Interfaces:** Consumes the seeded ids in `main()`'s scope: `assignmentId`, `projectId`, `emptyProjectId`. Produces `qa-output/screenshots/daylight/*.png` and the findings Task 6 reads.

- [ ] **Step 1: Read puppeteer's API for what is used**

```bash
grep -n "emulateMediaFeatures\|setViewport\|screenshot(" node_modules/.pnpm/puppeteer-core@25.8.0/node_modules/puppeteer-core/lib/esm/puppeteer/api/Page.d.ts | head
```

Cite the path + version in the commit body.

- [ ] **Step 2: `EXPECTED_AUDITS`**

Insert before `"dashboard profile and sign-out"`:

```js
  // BEFORE SIGN-OUT, LIKE EVERYTHING AUTHENTICATED. Nine routes, six widths,
  // two reduced-motion passes; screenshots for the controller, assertions
  // for the machine. Added 2026-09-05 with the field client's migration onto
  // @goproceed/ui — the first pass that can cover the field screens at all.
  "daylight visual audit",
```

- [ ] **Step 3: Extract the font probe into a helper**

Replace the inline `faces` probe in the profile audit (from `// THE DASH RENDERS IN ONEST` through the `if (!/Onest/i.test(faces.body))` block) with:

```js
        // ONE FACE, EVERY SCREEN. [Corrected 2026-09-05: the cascade race this
        // probe used to guard — two stylesheets, two `--font-display` values on
        // one `:root` — no longer exists. apps/app has one entry point
        // (app/globals.css on @goproceed/ui/base.css) since the field client
        // migrated. The probe stays because the face has been lost twice
        // already; it now runs on every route in the daylight visual audit,
        // and here once more on the screen where it was first lost.]
        assertOnest(ctx, page, "/dash/settings/profile");
```

and add this helper next to `measureUaStyledLinks`:

```js
/**
 * The product renders in Onest, headings and body alike. A face that reverts
 * — to a UA serif, to a system sans — is silent in every other gate; only a
 * rendered page can see it.
 */
async function assertOnest(ctx, page, label) {
  const faces = await page.evaluate(() => {
    const h = document.querySelector("h1, h2");
    return {
      heading: h ? getComputedStyle(h).fontFamily : null,
      body: getComputedStyle(document.body).fontFamily,
    };
  });
  if (faces.heading !== null && !/Onest/i.test(faces.heading)) {
    ctx.findings.push(`${label}: the heading renders in "${faces.heading}" — must be Onest`);
  }
  if (!/Onest/i.test(faces.body)) {
    ctx.findings.push(`${label}: the body renders in "${faces.body}" — must be Onest`);
  }
}
```

(`assertOnest` is `async`; the call in the profile audit needs `await`.)

- [ ] **Step 4: The audit**

Insert immediately before `await runAudit(ctx, "dashboard profile and sign-out", async () => {`:

```js
    await runAudit(ctx, "daylight visual audit", async () => {
      // ═══════════════════════════════════════════════════════════════════
      // THE SIX-VIEWPORT PASS UNDER THE DAYLIGHT PALETTE — spec
      // 2026-09-05-app-daylight-migration-design.md §5.2.
      //
      // The tokens moved system-wide on 2026-09-05 and every surface
      // re-coloured through its roles with nobody looking. This audit is the
      // looking: nine routes × six widths, plus reduced motion at 1440 and
      // 390, a full-page capture of each for the controller's review, and
      // the assertions a machine can make — overflow, the touch floor, UA
      // link styling, the signal budget, status-never-colour-alone, the face.
      //
      // Runs BEFORE the sign-out audit because eight of the nine routes need
      // the session that audit destroys. The unauthenticated /login is
      // captured through a second browser context with an empty cookie jar,
      // so the signed-in page's session cannot leak into it.
      // ═══════════════════════════════════════════════════════════════════
      const DAYLIGHT_WIDTHS = [1920, 1440, 1240, 768, 390, 360];
      const DAYLIGHT_REDUCED = [1440, 390];
      const daylightShots = path.join(SHOTS, "daylight");
      await mkdir(daylightShots, { recursive: true });

      const routes = [
        { slug: "login", path: "/login", anonymous: true },
        { slug: "field-assignments", path: "/" },
        { slug: "field-obligation", path: `/a/${assignmentId}` },
        { slug: "dash-home", path: "/dash" },
        { slug: "dash-project", path: `/dash/projects/${projectId}` },
        { slug: "dash-register", path: `/dash/projects/${projectId}/assignments` },
        { slug: "dash-new-assignment", path: `/dash/projects/${emptyProjectId}/assignments/new` },
        { slug: "dash-evidence", path: `/dash/assignments/${assignmentId}` },
        { slug: "dash-profile", path: "/dash/settings/profile" },
      ];

      const inspect = async (page, label, width) => {
        const overflow = await measureHorizontalOverflow(page);
        if (overflow) {
          ctx.findings.push(`${label} @${width}: scrolls sideways by ${overflow.overflow}px (viewport ${overflow.viewport}px) — ${overflow.offender}`);
        }
        if (width <= 768) {
          for (const t of await measureSmallTargets(page)) {
            ctx.findings.push(`${label} @${width}: touch target below 44px — "${t.label}" ${t.w}x${t.h}`);
          }
        }
        for (const link of await measureUaStyledLinks(page)) {
          ctx.findings.push(`${label} @${width}: anchor "${link.label}" renders with user-agent link styling (${link.color}, ${link.decoration})`);
        }
        const budget = await page.evaluate(() => {
          const signal = getComputedStyle(document.documentElement).getPropertyValue("--gp-action-signal").trim();
          const probe = document.createElement("i");
          probe.style.backgroundColor = signal;
          document.body.append(probe);
          const resolved = getComputedStyle(probe).backgroundColor;
          probe.remove();
          const hits = [...document.querySelectorAll("*")].filter((el) => getComputedStyle(el).backgroundColor === resolved);
          return { resolved, count: hits.length, samples: hits.slice(0, 3).map((el) => `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""}`) };
        });
        if (budget.count > 1) {
          ctx.findings.push(`${label} @${width}: ${budget.count} elements carry the signal background (${budget.samples.join(", ")}) — at most one per screen`);
        }
        const silentStatus = await page.evaluate(() =>
          [...document.querySelectorAll('[class*="bg-status-"]')]
            .filter((el) => (el.textContent ?? "").trim().length === 0 && !el.querySelector("img, svg[aria-label]"))
            .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").find((c) => c.startsWith("bg-status-"))}`));
        for (const s of silentStatus) {
          ctx.findings.push(`${label} @${width}: ${s} carries a status colour and no text — status is never colour alone`);
        }
        await assertOnest(ctx, page, `${label} @${width}`);
      };

      const walkRoute = async (page, route) => {
        for (const width of DAYLIGHT_WIDTHS) {
          const touch = width <= 768;
          await page.setViewport({ width, height: 900, isMobile: touch, hasTouch: touch });
          const res = await page.goto(`${server.baseUrl}${route.path}`, { waitUntil: "networkidle0" });
          if (!res || res.status() !== 200) {
            ctx.findings.push(`${route.path} @${width}: expected 200, got ${res ? res.status() : "no response"}`);
            continue;
          }
          await waitForAnimations(page);
          await inspect(page, route.path, width);
          await page.screenshot({ path: path.join(daylightShots, `${route.slug}-${width}.png`), fullPage: true });
        }
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
        for (const width of DAYLIGHT_REDUCED) {
          const touch = width <= 768;
          await page.setViewport({ width, height: 900, isMobile: touch, hasTouch: touch });
          await page.goto(`${server.baseUrl}${route.path}`, { waitUntil: "networkidle0" });
          await waitForAnimations(page);
          await inspect(page, `${route.path} (reduced motion)`, width);
          await page.screenshot({ path: path.join(daylightShots, `${route.slug}-${width}-reduced.png`), fullPage: true });
        }
        await page.emulateMediaFeatures([]);
      };

      // The signed-in routes, in the default context.
      const diagnostics = await withPage(browser, async (page) => {
        for (const route of routes.filter((r) => !r.anonymous)) await walkRoute(page, route);

        // The sign-out confirm, open, at 1440 and 390 — the first screen the
        // TODOS entry named. Opened the way the sign-out audit opens it,
        // cancelled the way it cancels it, so the session survives.
        for (const width of [1440, 390]) {
          const touch = width <= 768;
          await page.setViewport({ width, height: 900, isMobile: touch, hasTouch: touch });
          await page.goto(`${server.baseUrl}/dash/settings/profile`, { waitUntil: "networkidle0" });
          const trigger = await visibleHandle(page, 'button[aria-label="Профіль і вихід"]');
          if (!trigger) { ctx.findings.push(`sign-out confirm @${width}: no visible profile control`); continue; }
          await trigger.click();
          const item = await visibleHandleWithText(page, '[role="menuitem"]', "Вийти");
          if (!item) { ctx.findings.push(`sign-out confirm @${width}: no «Вийти» item`); continue; }
          await item.click();
          await page.waitForFunction(
            () => [...document.querySelectorAll('[role="dialog"]')].some((d) => (d.innerText ?? "").includes("Вийти з системи?")),
            { timeout: 5_000 });
          await waitForAnimations(page);
          await inspect(page, "sign-out confirm", width);
          await page.screenshot({ path: path.join(daylightShots, `dash-sign-out-${width}.png`), fullPage: true });
          const cancel = await visibleHandleWithText(page, '[role="dialog"] button', "Скасувати");
          if (cancel) { await cancel.click(); await cancel.dispose(); }
          await page.keyboard.press("Escape");
        }
      });
      reportDiagnostics("daylight visual audit", diagnostics, ctx.findings, ctx.missingAssets);

      // /login and the OTP second step, in a context that has never signed in.
      const anonymous = await browser.createBrowserContext();
      try {
        const page = await anonymous.newPage();
        await walkRoute(page, routes[0]);
        // The second step: type an address, request a code, capture the form
        // that asks for it. The code itself is never entered here.
        for (const width of [1440, 390]) {
          const touch = width <= 768;
          await page.setViewport({ width, height: 900, isMobile: touch, hasTouch: touch });
          await page.goto(`${server.baseUrl}/login`, { waitUntil: "networkidle0" });
          await page.type("#otp-email", email);
          await page.click('button[type="submit"]');
          await page.waitForSelector("#otp-code", { timeout: 15_000 });
          await waitForAnimations(page);
          await inspect(page, "/login (code step)", width);
          await page.screenshot({ path: path.join(daylightShots, `login-code-${width}.png`), fullPage: true });
        }
        await page.close();
      } finally {
        await anonymous.close();
      }
    });
```

`mkdir` is already imported from `node:fs/promises` (line 1). `email` is `main()`'s `const email = \`pryklad-qa-field-${stamp}@example.test\`` (line ~1652), in scope. `browser.createBrowserContext()` is the API the external-plane audit already uses (line ~2649).

- [ ] **Step 5: Run the harness**

```bash
pnpm --filter @goproceed/app build 2>&1 | tail -2
pnpm --filter @goproceed/app qa 2>&1 | tail -30
ls apps/app/qa-output/screenshots/daylight | wc -l
```

Expected: `QA passed: 9 of 9 expected audits ran … zero findings`, **or** a list of findings from the new audit only. Findings from the new audit are Task 6's input, not this task's failure — record them verbatim in the report and in the evidence file under «Task 5 — first daylight run». Findings from any *other* audit are a regression of Task 4 and must be fixed before this task commits. Screenshot count: 9 routes × 6 + 9 × 2 reduced + 2 sign-out + 2 code-step = **76**.

- [ ] **Step 6: Commit**

```bash
git add apps/app/qa/field.mjs docs/superpowers/plans/evidence/2026-09-05-app-daylight-gate.md
git commit -m "test(app): the daylight visual audit — nine routes, six widths, reduced motion, the face on every screen

puppeteer-core 25.8.0 (node_modules/.pnpm/puppeteer-core@25.8.0/…/api/Page.d.ts):
setViewport, emulateMediaFeatures, screenshot({fullPage}).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The visual pass — the review, and the fixes it names

**Files:**
- Modify: `docs/superpowers/plans/evidence/2026-09-05-app-daylight-gate.md` (the review)
- Modify: whatever the review names under `apps/app/src/components/**`, `apps/app/src/layouts/**`, `apps/app/app/**` — never `packages/tokens`, never `packages/ui` beyond a documented defect in a component's own roles

**Interfaces:** Consumes `apps/app/qa-output/screenshots/daylight/*.png` (Task 5) and `apps/app/qa-output-before/` (Task 1). Produces a signed review and zero open findings in the harness.

This task has two halves with different owners. **The review is the controller's** (it is judgement, and the plan cannot pre-write its conclusions); **the fixes are an implementer's**, dispatched with the review as their brief.

- [ ] **Step 1 (controller): Read every capture**

Open, in this order, and note each defect as `<route> @<width>: <what> — <rule it breaks> — <fix>`:

1. `dash-sign-out-1440.png`, `dash-sign-out-390.png`, `login-code-1440.png`, `login-code-390.png` — the two screens the TODOS entry named first. The `signal` button: cobalt fill, white text, one per screen.
2. `dash-home-*`, `dash-profile-*` — the shell: rail on canvas with the 3px signal active bar (rewrite plan §10.1), `border-line` on its edge, labels `text-ink-secondary`, the drawer's `shadow-modal` at 390/360.
3. `dash-register-*`, `dash-project-*` — row rules `border-line-strong`, hover `bg-subtle`, status chips on the five triplets with their labels, money figures tabular and right-aligned, `MoneySummary` the only 32px figure (§10.2–10.3).
4. `dash-new-assignment-*`, `dash-evidence-*` — form controls on `Input`/`Select` heights, the photo frame, the review-link notice.
5. `field-assignments-*`, `field-obligation-*`, `login-*` — against `qa-output-before/screenshots/*.png` at 375/390: same layout, Daylight colours, Onest; nothing shifted more than the face change explains.
6. Every `*-reduced.png` — no animation frame caught mid-way; the drawer/dialog present without transform.

Rules to judge by: `DESIGN.md` Do/Don't; `02-building-ui.md` §6 (the six-viewport checklist) and §9; rewrite plan §10. **A finding is a defect the palette caused or a rule the screen breaks — not a feature the dashboard lacks.** The latter goes to `TODOS.md` (Task 7), named, not fixed here.

- [ ] **Step 2 (controller): Write the review into the evidence file**

Under a new heading `## Task 6 — the visual pass (<date>)`: the list of captures reviewed (count), the findings table (`#`, route@width, defect, rule, fix, fixed-here / TODOS), and the sentence «Reviewed by the controller against DESIGN.md, 02-building-ui §6/§9 and the rewrite plan §10; the captures are in `apps/app/qa-output/screenshots/daylight/` at commit <sha>.» If there are zero findings, say so, and say what was compared.

- [ ] **Step 3 (implementer): Fix each «fixed-here» finding**

For each: locate the component, change the role/utility, keep the change to the named defect, run `pnpm --filter @goproceed/app exec vitest run --exclude "**/*.int.test.ts"` and `pnpm turbo run typecheck`. No new component; no hex; no literal size; no `bg-action-signal` beyond one per screen.

- [ ] **Step 4: Re-run the harness**

```bash
pnpm --filter @goproceed/app build 2>&1 | tail -2
pnpm --filter @goproceed/app qa 2>&1 | tail -8
```

Expected: `QA passed: 9 of 9 expected audits ran`, zero findings. The controller re-reads only the captures whose routes changed.

- [ ] **Step 5: Commit**

```bash
git add -A apps/app/src apps/app/app docs/superpowers/plans/evidence/2026-09-05-app-daylight-gate.md
git commit -m "fix(app): what the daylight visual pass found — <one line per finding, or 'nothing to fix; the review is signed'>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The documents

**Files:**
- Modify: `.interface-design/system.md` (top), `docs/design/02-building-ui.md` (row ~93; §9 ~341), `docs/design/2026-08-19-design-system-rewrite-plan.md` (§10.1, §12 P4 row), `docs/design/03-ui-references.md` (line 4), `TODOS.md` (lines ~3588–3589 + one new entry + Task 6's out-of-scope findings), `HANDOFF.md` (new §0a.16 above §0a.15)

- [ ] **Step 1: `.interface-design/system.md`**

Insert after the title line:

```markdown
> **Superseded, 2026-09-05.** The system this file describes — Evidence Atlas
> paper/carbon/lime, Inter, the dark rail, the hand-rolled `@theme` in
> `apps/app/app/globals.css` — no longer exists in the tree. The design system
> is `DESIGN.md` (the Daylight finish) and `docs/design/02-building-ui.md`
> (the procedure and the gate); the tokens are `packages/tokens/src/tokens.json`,
> read through `docs/design/01-tokens.md`. This file stays for its **rulings
> that survived the palette** and are enforced elsewhere:
>
> - Button sizes carry two numbers and the small one is never below 44px on
>   touch (§5 «Button» — now `packages/ui/src/components/Button.tsx`, the
>   `touch` variant, `component-contract.test.ts`).
> - WorkRegister's three renderings are three hierarchies, not one DOM with
>   CSS (§5 «WorkRegister» — `apps/app/src/components/assignments/*`).
> - Tooltip is mounted only in the icon-rail band, and the label stays in the
>   DOM at every width (§5 «Tooltip»).
> - Density is decided once, in the base layer, and the default is prose
>   (§3 «Density» — `base.css`'s `body`).
>
> Every value below is historical. Do not use a number from this file.
```

- [ ] **Step 2: `02-building-ui.md`**

Row ~93: after `Audit-first, improves in place rather than rewriting — which is the constraint on `/app``, append ` *[2026-09-05: the field client migrated onto the roles (spec `2026-09-05-app-daylight-migration-design.md`); the skill's remaining use is a dashboard screen that reads wrong, never a stylesheet.]*`.

§9, after the existing `*[Correction, 2026-09-05: Onest for display and everything else …]*` paragraph, add a sibling: `*[Correction, 2026-09-05, later the same day: Onest on the field client too — `apps/app` has one stylesheet, `app/globals.css` on `@goproceed/ui/base.css`; the legacy sheet and its Inter are gone.]*`.

- [ ] **Step 3: the rewrite plan**

§12, the P4 row: replace the «Work» cell's text with `Retokenise the shell (D2), then the register, then the dashboard. *[2026-09-05: the shell and dashboard were built on the roles from the start (Plan D); the field client, which this row did not foresee as separate, migrated on 2026-09-05 — spec `2026-09-05-app-daylight-migration-design.md`. Rows-in-fold and the shell measurements are in that spec's evidence file.]*`. §10.1: after «The rail becomes `bg.canvas` …» append ` *[Shipped: `apps/app/src/components/dash-shell/sidebar.tsx` is `bg-canvas` with the signal bar; measured in the 2026-09-05 visual pass.]*`.

- [ ] **Step 4: `03-ui-references.md`**

Line 4: `**Applies to:** every screen under `apps/app/app/(dash)/**` — the office dashboard` → append ` *[2026-09-05: the token and component rules of this file also bind `app/(app)/**` and `app/(auth)/**` since the field client migrated onto `@goproceed/ui`; the plane-derived structure rules (§«The hierarchy») stay dashboard-only.]*`.

- [ ] **Step 5: `TODOS.md`**

Replace the two P2 bullets (lines ~3588–3589) with:

```markdown
- **P2 (CLOSED 2026-09-05, `/dash/**` half) — visual pass under the Daylight palette.** Done for the dashboard and the field client: nine routes × six widths + reduced motion, `qa/field.mjs`'s «daylight visual audit», review signed in `docs/superpowers/plans/evidence/2026-09-05-app-daylight-gate.md`. The `apps/mobile` half is the entry below.
- **P2 — visual pass of `apps/mobile` under Daylight.** Its icons and `app.json` colours moved with PR #71; its screens have not been looked at. Owner decision 2026-09-05: this belongs to the proper Expo application, in that scope and not before. Until then the field client's web screens are the reviewed surface.
- **P2 (CLOSED 2026-09-05) — `apps/app`'s field-client pages were on a legacy stylesheet.** One entry point now (`app/globals.css` on `@goproceed/ui/base.css`), Onest, the shared Button/Input/Label; `packages/testing/src/app-entry.test.ts` keeps it so. Spec `2026-09-05-app-daylight-migration-design.md`.
```

Then append Task 6's «TODOS» findings, if any, as bullets under a sub-heading `#### From the daylight visual pass (2026-09-05)` inside the Daylight section.

- [ ] **Step 6: `HANDOFF.md`**

Insert `### 0a.16 — apps/app on Daylight: the field client left its legacy stylesheet, the dashboard had its visual pass` above `### 0a.15`, with four paragraphs: what shipped (one entry point, deleted files, the Button variant, the audit); what the owner decided (D1–D4 of the spec); what the pass found and fixed (from the evidence file — counts, not adjectives); what is open (the mobile P2, anything Task 6 sent to TODOS). Update the count in §0a's lead («Fifteen pieces of work» → «Sixteen»).

- [ ] **Step 7: Validate and commit**

```bash
pnpm validate:canonical-docs 2>&1 | tail -1
git add .interface-design/system.md docs/design TODOS.md HANDOFF.md
git commit -m "docs(design): apps/app on Daylight — system.md superseded, building-ui and the rewrite plan dated, TODOS and HANDOFF

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The gate, the evidence, the branch

- [ ] **Step 1: The gate (spec §6.4) — paste, never paraphrase**

```bash
pnpm --filter @goproceed/tokens generate && git status --short
node packages/testing/qa/motion-audit.mjs
pnpm --filter @goproceed/testing exec vitest run src/token-fidelity.test.ts src/motion-audit.test.ts src/primitive-leak.test.ts src/component-contract.test.ts src/error-catalog-fidelity.test.ts src/tw-merge.test.ts src/copy-catalog-fidelity.test.ts src/contrast.test.ts src/motion-contract.test.ts src/palette-derivation.test.ts src/status-label-fidelity.test.ts src/app-entry.test.ts
pnpm turbo run typecheck
pnpm --filter @goproceed/app build
pnpm --filter @goproceed/app exec vitest run --exclude "**/*.int.test.ts"
pnpm --filter @goproceed/landing test
pnpm --filter @goproceed/app qa
pnpm validate:canonical-docs
```

Expected: no diff after generate; `motion-audit: clean`; 12 suites green; 10/10; build; 524/1 skipped; landing green (the sink renders the new variant); `QA passed: 9 of 9`; `canonical documentation: OK`. Paste under `## Task 8 — the gate (<date>, HEAD <sha>)` in the evidence file, with the DB-suite substitution ruling stated (the local stack is up for the harness, but `packages/testing`'s DB suites and `apps/app`'s `*.int.test.ts` are still CI's).

- [ ] **Step 2: Commit the evidence and push**

```bash
git add docs/superpowers/plans/evidence/2026-09-05-app-daylight-gate.md
git commit -m "docs(evidence): apps/app on Daylight — the gate is green, the pass is signed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin claude/daylight-app-p2
```

- [ ] **Step 3: The PR**

Then invoke `superpowers:finishing-a-development-branch`. The PR body: the spec's §0 in two paragraphs; the D1–D4 table; the gate table; «Docs checked» (tailwindcss 4.3.3 preflight path; puppeteer-core 25.8.0 Page.d.ts; `@fontsource-variable/onest` 5.3.1); before/after captures of `/login` and `/` at 390 and of `/dash` at 1440 (commit the four PNGs beside the evidence file, link by SHA); end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
