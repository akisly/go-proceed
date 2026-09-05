# `apps/app` on Daylight — the field client leaves its legacy stylesheet, the dashboard gets its visual pass

**Status:** Draft for owner review, 2026-09-05
**Scope:** `apps/app` (field client `app/(app)/**`, `app/(auth)/**`; dashboard `app/dash/**`), `packages/ui` (one Button variant), `packages/testing` (two tests), `apps/app/qa/field.mjs`, the design documents that describe them.
**Closes:** the two P2 entries «Opened by the Daylight landing (2026-09-05)» in `TODOS.md` — the dashboard visual pass, and the field client's legacy stylesheet. The `apps/mobile` half of the first entry is **deferred, not done** (§7).
**Authorities:** `docs/superpowers/specs/2026-09-05-landing-daylight-design.md` (D1: palette and typeface system-wide), `docs/design/2026-08-19-design-system-rewrite-plan.md` (§10 app surfaces, §12 phase P4, D5 «retire the sheet», D7 «system.md becomes a pointer»), `docs/design/02-building-ui.md` (the procedure and the gate), `DESIGN.md` (the Daylight finish).

## 0. Why this exists

The Daylight tokens moved system-wide on 2026-09-05 (PR #71). Two surfaces did not follow:

- **The dashboard** re-coloured through its role names with no one looking at it. `apps/app/qa/field.mjs` proves it *works* at 1280 and 390; nothing proves it *reads* at the six viewports `02-building-ui.md` §6 names, under reduced motion, with real strings.
- **The field client** never used the roles. `apps/app/app/globals.css` is a 391-line hand-rolled `@theme` from before `packages/tokens` existed: Evidence Atlas hex (`#c6ff34` lime, `#171717` carbon, `#fbfbfb` paper), Inter, its own type scale and radii, and a `.goproceed-app` base layer that re-implements Preflight by hand. It loads from the root layout on **every** route, dashboard included, which is why `app/dash/dash-theme.css` exists at all: a second Tailwind entry point whose only non-import content is a pin (`:root { --font-display: var(--gp-font-sans) }`) that undoes the legacy sheet's `h1,h2,h3 { font-family: var(--font-display) }` on dash headings. Two `@theme` blocks in one document, two `Button`s (`src/ui/button.tsx` on cva, `@goproceed/ui`'s), two `cn` helpers with two tailwind-merge configs.

The rewrite plan's phase P4 («retokenise the shell, then the register, then the dashboard») was written when the field client *was* the app. The dashboard was built later, directly on `packages/ui`, so P4's remaining work is the field client — and the sheet that both surfaces still share.

## 1. Decisions (owner, 2026-09-05)

| # | Decision | Ruling |
|---|---|---|
| D1 | Scope of this session | The two Daylight P2s, **without `apps/mobile`**. The mobile visual pass belongs to the future proper Expo application and is recorded as such in `TODOS.md`. |
| D2 | Migration shape | **One entry point.** `globals.css` is rewritten in place onto `@goproceed/ui/base.css`; `dash-theme.css`, `src/ui/button.tsx`, `src/ui/cn.ts` are deleted; the five field-client files move to the role vocabulary. Not the alias-in-place alternative (keeping the legacy names as `var(--gp-*)` aliases), which would keep two entry points, the font pin and two Buttons for good. |
| D3 | `destructive` Button | **Added to `packages/ui`.** The field client already has an irreversible action («Скасувати фото» in `capture.tsx`) and kept a private Button for it. One Button for the system; the component contract's «no destructive» ruling becomes «destructive exists and has exactly one call site», dated. |
| D4 | Typeface on the field client | **Onest**, per the landing spec's D1 (typeface system-wide). The 2026-08-11 argument for Inter was «one variable font on a foreman's connection»; that argument holds unchanged for one variable Onest. `@fontsource-variable/inter` leaves `apps/app`. |

## 2. Facts the design rests on (measured 2026-09-05, commit efc2cdb)

- F1. The field client is five files: `app/(app)/page.tsx` (205 lines), `app/(app)/a/[assignmentId]/page.tsx` (248), `app/(app)/a/[assignmentId]/capture.tsx` (366), `app/(auth)/login/page.tsx` (32), `app/(auth)/login/otp-form.tsx` (222) — plus `src/ui/button.tsx` (106) and `src/ui/cn.ts` (43). Together they use **seventeen** colour/typography utilities, all from the legacy `@theme` (§4.1 maps them).
- F2. Nothing outside `src/ui/button.tsx` references a legacy-only token (`bg-carbon*`, `bg-accent*`, `text-accent-ink`, `ease-out-strong`, `rail-hover/line`, `readiness-*`, `evidence-*`, `info-*`, `success-*`, `shadow-drawer/raised`, `animate-chip-in`, `--spacing-strip`). The dashboard's `rail-width`/`rail-icons` come from `packages/ui`'s generated theme, not from `globals.css`.
- F3. `class-variance-authority`, `@radix-ui/react-slot`, `clsx` and `tailwind-merge` have no importer in `apps/app` outside `src/ui/`. `@fontsource-variable/inter` has exactly one (`app/layout.tsx`).
- F4. Tailwind v4 Preflight (imported by `@goproceed/ui/base.css`) already provides everything `globals.css`'s `.goproceed-app` base layer re-implements: `box-sizing: border-box`, zero margins and padding, `a { color: inherit; text-decoration: inherit }`, `button/input/select/textarea { font: inherit }`, `ol,ul { list-style: none }`, `table { border-collapse: collapse }`, `svg { display: block }`. `base.css` itself carries the focus ring, the reduced-motion block, `body` colour/family/features, and tabular figures on `th, td, output, time, data`.
- F5. What `base.css` does **not** carry and `globals.css` did: tabular figures on `[data-money]`/`[data-numeric]` (no current call site in `apps/app` — kept as one rule because the legacy sheet and `.interface-design/system.md` name the attributes as the product's figure hooks, and `qa` may add one), `text-wrap: pretty/balance` (dropped: no call site, and Onest's metrics were not measured with it), the `--spacing-strip: 37px` token (dropped: no call site — the dash top bar measures itself).
- F6. `qa/field.mjs` (4,233 lines) seeds a world through the product's own API, walks `/login`, `/`, `/a/{id}`, the capture banner, six `/dash/**` routes and the external plane, at 375/390/1000/1280 widths. Its font probe (`/dash/settings/profile`, corrected 2026-09-05) asserts Onest on the dash heading and body. It needs the local Supabase stack (`open -a Docker`; the local database is at migration 0083, equal to the repository; the owner never wants `supabase db reset` run without asking).
- F7. The role vocabulary the field client needs exists in full in `docs/design/01-tokens.md`: `ink`, `ink-secondary`, `ink-muted`, `surface`, `subtle`, `line`, `line-strong`, `status-attention`/`-line`/`-fg`, `status-blocked`/`-line`/`-fg`, `action-signal`, `action-fg`, the `text-h1…micro` scale, `rounded-control/field/panel`, `control-height-desk/-touch`.
- F8. `@goproceed/ui/components` exports `Button` (variants `primary | signal | outline | ghost | link`, sizes `default | sm | lg | icon`, `asChild`), `Input`, `Textarea`, `Label`, `cx`. The kitchen sink at `apps/landing/app/kitchen-sink/components/page.tsx` renders every component and is the component-contract render gate.

## 3. The stylesheet and the entry point

### 3.1 `apps/app/app/globals.css` — rewritten in place

Same path (no import changes, history stays attached), new content, about forty lines:

```css
/* GENERATED-FREE. The app's ONE Tailwind entry point since 2026-09-05. …header explains the migration… */
@import "@goproceed/ui/base.css";

/* Shared components carry utilities that never appear in this app's own source. */
@source "../../../packages/ui/src";

/* Tailwind v4 scans the whole project and does not distinguish a test fixture from a component. */
@source not "../tests";
@source not "../qa";
@source not "../.next";

/* The one rule base.css does not carry: the product's figure hooks. */
@layer base {
  [data-money], [data-numeric] { font-variant-numeric: tabular-nums; }
}
```

The header records, dated, what the previous file was (its own `@theme`, Evidence Atlas hex, Inter, the hand-rolled Preflight), why each of its rules is now covered by `base.css`/Preflight (F4), and what was dropped and why (F5). Nothing else in the file: every number comes from `packages/tokens` or it does not appear.

### 3.2 Deleted

- `apps/app/app/dash/dash-theme.css` — its import of `@goproceed/ui/base.css` moves to `globals.css`; its `--font-display` pin has nothing left to undo; its `@source` lines move to `globals.css`.
- `apps/app/src/ui/button.tsx`, `apps/app/src/ui/cn.ts` — replaced by `@goproceed/ui/components`.
- From `apps/app/package.json`: `@fontsource-variable/inter`, `class-variance-authority`, `@radix-ui/react-slot`, `clsx`, `tailwind-merge` (F3). `@fontsource-variable/onest` is added (it is currently reached through the dash layout only).

### 3.3 Layouts

- `app/layout.tsx`: `import "@fontsource-variable/onest"` replaces Inter; `<body>` loses `className="goproceed-app"` (the scope class has no stylesheet to scope). The long comment explaining the class is replaced by two lines saying where the base rules now live.
- `app/dash/layout.tsx`: the Onest and `dash-theme.css` imports go; the comment that explained «the field-client pages … still on the legacy stylesheet» is rewritten to say the app has one entry point.

## 4. The field client on the role vocabulary

### 4.1 The mapping (exhaustive — F1's seventeen utilities)

| Legacy utility | Role utility | Notes |
|---|---|---|
| `text-foreground` | `text-ink` | |
| `text-foreground-secondary` | `text-ink-secondary` | |
| `text-foreground-muted` | `text-ink-muted` | |
| `text-destructive` | `text-status-blocked-fg` | 6.34:1 on canvas |
| `text-warning-foreground` | `text-status-attention-fg` | |
| `bg-warning-surface` | `bg-status-attention` | |
| `border-warning` | `border-status-attention-line` | |
| `bg-surface` | `bg-surface` | same name |
| `bg-surface-muted`, `hover:bg-surface-muted` | `bg-subtle`, `hover:bg-subtle` | |
| `border-border` | `border-line` | |
| `rounded-panel`, `rounded-control` | same | same pixel values in both systems |
| `text-h1`, `text-body`, `text-data`, `text-meta` | same | same pixel values |
| `font-display` | *(removed)* | headings render in `font-sans`; `.display` is marketing-only by `base.css`'s ruling |
| `font-semibold`, `font-medium` | same | |
| `h-11` on `<input>` (otp-form ×2) | `<Input>` from `@goproceed/ui` | token heights: `control-height-desk`, `touch:` 44px |
| `file:h-11 file:rounded-control file:border-border file:bg-surface …` (capture) | `file:h-(--gp-control-height-touch) file:rounded-control file:border-line file:bg-surface …` | the file-selector pseudo keeps its own classes; only the names change |
| `<label className="text-data font-medium text-foreground">` | `<Label>` from `@goproceed/ui` | |

Layout utilities (`flex`, `gap-*`, `px-*`, `max-w-lg`, `min-h-dvh`, `grid-cols-[…]`) are untouched: they come from Tailwind's spacing scale, which both systems keep.

### 4.2 Buttons

Every `<Button>` in the five files imports from `@goproceed/ui/components`. Variant and size names are unchanged (`signal`, `outline`, `ghost`, `link`, `destructive`, `sm`) — the legacy Button was shadcn-shaped like the shared one. `asChild` works the same. The legacy `default` size was `h-11 md:h-9`; the shared `default` is `control-height-desk` with `touch:` 44px — a capability query instead of a breakpoint, which is the system's ruling and is what the QA's touch-floor check measures.

### 4.3 What the field client must still satisfy (its own QA, unchanged)

`qa/field.mjs`'s field audits keep passing without edit to their assertions: the redirect to `/login`, `lang="uk"`, the viewport meta with no zoom cap, the two Ukrainian strings, no touch target under 44px at 375, no horizontal overflow, **no anchor with UA link styling** (Preflight's `a { color: inherit }` is what keeps this true after `.goproceed-app a` is gone — the source test in §6.1 does not check it, the browser does), the capture banner. The font probe is widened (§5.3).

## 5. `packages/ui` — the sixth Button variant, and the dashboard visual pass

### 5.1 `destructive`

```ts
destructive:
  "border border-status-blocked-line bg-surface text-status-blocked-fg " +
  "hover:bg-status-blocked-fg hover:text-action-fg",
```

Outlined at rest, filled on hover — the field client's existing treatment, on roles. The docstring's «There is NO destructive variant» paragraph becomes a dated correction: the variant exists for irreversible actions only, has one call site (`apps/app/app/(app)/a/[assignmentId]/capture.tsx`, the photo discard), and the contract test counts call sites so a second one is a test failure, not a drift. The kitchen sink's Button case (`apps/landing/app/kitchen-sink/components/page.tsx`, Case 01) renders the variant and its Ukrainian rule text drops «Немає destructive…» for «`destructive` — лише для незворотної дії, один виклик у продукті». `TW_MERGE_OVERRIDE` needs no change (variants are not merge groups).

### 5.2 The visual pass — what is looked at and how

**Routes** (nine): `/login`, `/` («Мої доручення»), `/a/{assignmentId}`; `/dash`, `/dash/projects/{id}`, `/dash/projects/{id}/assignments`, `/dash/projects/{id}/assignments/new`, `/dash/assignments/{id}`, `/dash/settings/profile`. **Widths** (six): 1920, 1440, 1240, 768, 390, 360 — `02-building-ui.md` §6's list. **Plus** reduced motion at 1440 and 390 (`page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }])`). The sign-out dialog (open, at 1440 and 390) and the OTP form's second step are captured as states of their routes.

**Assertions, per route × width**, in a new `runAudit(ctx, "daylight visual audit", …)` section of `qa/field.mjs`, placed after the dash seeding so it uses the same world:

1. No horizontal overflow (`measureHorizontalOverflow`, already in the file).
2. At widths ≤ 768: no interactive target under 44 × 44 (`measureSmallTargets`, already in the file).
3. No anchor with UA link styling (`measureUaStyledLinks`, already in the file).
4. **At most one** element whose computed `background-color` equals the resolved `--gp-action-signal` (rule 10 of `02-building-ui.md`, as corrected 2026-09-05).
5. Every element whose class list carries a `bg-status-*` utility has non-empty visible text (status is never colour alone).
6. Computed `font-family` of the first `h1` and of `body` both contain `Onest` (the existing profile probe, run on every route).
7. A full-page screenshot to `qa-output/screenshots/daylight/<route-slug>-<width>[-reduced].png`.

**Judgement** is not automated: the controller reads the screenshots against DESIGN.md's Do/Don't and the rewrite plan §10 (rail on canvas with a 3px signal bar, register rows on `line-strong`, `MoneySummary` the only 32px figure, status chips on the five triplets). Each finding becomes a fix in this branch and a line in the evidence file; a finding judged out of scope becomes a `TODOS.md` line. The pass is done when the audit is green and the controller has signed the screenshot review in the evidence file.

### 5.3 The font probe

The existing probe at `/dash/settings/profile` is generalised into assertion 6 above and the dated comment above it is rewritten: the app has one stylesheet, the cascade race it guarded no longer exists, and the probe now guards against a *regression to any other face*, on every screen.

## 6. Tests

### 6.1 `packages/testing/src/app-entry.test.ts` (new, node)

Source-level, in the style of `primitive-leak.test.ts`:

- exactly one `.css` file under `apps/app/app/**`, and its text contains `@import "@goproceed/ui/base.css"`;
- no file under `apps/app/{app,src}/**` (`.ts`, `.tsx`, `.css`) contains a retired token name: `text-foreground`, `bg-surface-muted`, `bg-surface-sunken`, `border-border`, `text-destructive`, `-warning-`, `bg-carbon`, `bg-accent`, `text-accent-ink`, `readiness-`, `font-display`, `goproceed-app`, `ease-out-strong`, `shadow-drawer`, `animate-chip-in`;
- no file under `apps/app` imports `@fontsource-variable/inter`, `class-variance-authority`, `tailwind-merge` or `clsx` directly;
- the exclusion list (if any) names only files that exist.

Written first, red (the legacy sheet and the five files fail it), green after §3–§4.

### 6.2 `packages/testing/src/component-contract.test.ts`

`it("Button has no destructive variant")` becomes `it("Button's destructive variant has exactly one call site")`: `Button.tsx` matches `/destructive/`, and a scan of `apps/**/*.tsx` (excluding tests and kitchen sinks) finds `variant="destructive"` exactly once, at the capture discard. The comment carries the 2026-09-05 correction. Written first, red (the variant does not exist), green after §5.1.

### 6.3 Existing gates

- The kitchen-sink render gate covers the new variant once the sink renders it.
- `tw-merge.test.ts`, `primitive-leak.test.ts`, `motion-audit` unchanged; `primitive-leak` still scans `apps/app` (F: `ROOTS` names it).
- `apps/app`'s unit suites (`vitest run --exclude "**/*.int.test.ts"`) stay green; nothing in them imports `src/ui/*` (F3).
- `qa/field.mjs` — full run on the local stack, with the new section, green.

### 6.4 The gate (§5 of `02-building-ui.md`, pasted into the evidence file)

`pnpm --filter @goproceed/tokens generate` (no diff) · `node packages/testing/qa/motion-audit.mjs` · the eleven non-DB `packages/testing` suites **plus the new one** · `pnpm turbo run typecheck` · `pnpm --filter @goproceed/app build` · `pnpm --filter @goproceed/app exec vitest run --exclude "**/*.int.test.ts"` · `pnpm --filter @goproceed/landing test` (the kitchen sink lives there) · `pnpm --filter @goproceed/app qa` · `pnpm validate:canonical-docs`. Evidence goes to `docs/superpowers/plans/evidence/2026-09-05-app-daylight-gate.md` with the screenshot review signed.

## 7. Documents

| File | Change |
|---|---|
| `.interface-design/system.md` | A dated banner at the top: superseded 2026-09-05 by `DESIGN.md` and `docs/design/02-building-ui.md`; the token, colour and rail sections describe a retired sheet. The rulings that survive are listed in the banner by name (Button sizes carry two numbers and the small one is never below 44px; WorkRegister's three renderings are three hierarchies, not one DOM; Tooltip is mounted only in the icon-rail band). Rewrite plan D7 — reduced to a pointer plus its surviving rulings. |
| `docs/design/02-building-ui.md` | The `redesign-existing-projects` row («Phase 4, restyling `apps/app`») gets a dated note: the field client migrated 2026-09-05, the skill's remaining use is the dashboard's own screens. §9's typography correction gets one more clause: the field client is on Onest too. |
| `docs/design/2026-08-19-design-system-rewrite-plan.md` | §12 P4 row: dated status — the field client is on the roles; the shell and register measurements the row asks for are recorded in the evidence file. §10.1's «the rail becomes bg.canvas» is confirmed as shipped (the dash sidebar already is). |
| `docs/design/03-ui-references.md` | «Applies to» gains `app/(app)/**` and `app/(auth)/**` for the token and component rules (not for the plane-derived structure rules, which stay dashboard-only), dated. |
| `apps/app/app/globals.css`, `app/layout.tsx`, `app/dash/layout.tsx`, `qa/field.mjs` | Headers and comments rewritten as §3–§5 say; no comment may still claim a legacy stylesheet exists. |
| `TODOS.md` | The two Daylight P2 entries close (dated, pointing at this spec and the evidence). A new P2: «visual pass of `apps/mobile` under Daylight — in scope of the proper Expo application, not before» (D1). Any out-of-scope finding from §5.2. |
| `HANDOFF.md` | §0a.16. |
| `apps/app/AGENTS.md` | Does not exist; not created — `apps/landing/AGENTS.md` exists because the landing has deploy-time secrets to explain. |

## 8. Out of scope

- `apps/mobile` (D1). Its icons and `app.json` colours already moved with PR #71; its screens are not looked at here.
- The dashboard's *structure* (routes, services, shell geometry): the pass fixes what the Daylight palette broke or what reads wrong under it, not what the dashboard lacks.
- The external plane (`app/external/**`) carries no legacy utility name (measured: zero hits for the seventeen), so the migration does not touch its files; the source test in §6.1 still scans it, so a later regression there fails the same test.
- `.interface-design/system.md`'s content beyond the banner (D7 says pointer, not rewrite).
- Any new component in `packages/ui` beyond the Button variant. The OTP form uses `Input`/`Label`, which exist.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Preflight differs from the hand-rolled reset in some rule this spec did not list, and a field screen shifts. | The five screens are captured before (current `qa-output`) and after at 375/390; the QA's overflow, touch and link probes are the same code on both sides. Any visual difference is inspected in the screenshot review, not assumed away. |
| `@goproceed/ui`'s Button `default` height (36px desk / 44px touch) differs from the legacy `h-11 md:h-9` (44 / 36 by breakpoint). | Identical numbers, different predicate: at 375 with `hasTouch: true` the QA sees 44px either way. On a desktop viewport with a mouse the legacy gave 36px too. |
| Deleting `dash-theme.css` changes which `@source` lines are in effect for the dash. | They move verbatim to `globals.css`, which now serves every route; the dash's `Dialog`/`DropdownMenu` utilities keep compiling because `@source "../../../packages/ui/src"` is there. The build's generated CSS is checked for `shadow-modal` and `bg-overlay`. |
| The local stack: `qa/field.mjs` seeds users and truncates nothing, but the owner's rule is never to reset the database. | `open -a Docker`, no `db reset`; migrations already match (0083). The harness deletes only the users it minted. |
| The visual pass finds more than a fix wave should carry. | Each finding is classified in the evidence file: fixed here (palette-caused or reads-wrong), or `TODOS.md` (missing feature, structural). The pass is not a redesign. |
