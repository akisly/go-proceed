# DEV-073 — BL-047: stock Tailwind stays whole, and `max-w-md` compiles again

## Assignment

- Objective and user-visible outcome: the generated theme stops clearing Tailwind's stock namespaces, the roles override or add to them (ADR-015), `cx()` extends stock tailwind-merge, and every dialog, the login column and the empty states get the width their class always named instead of the full width.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-24.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): a design-system change (`packages/tokens`, `packages/ui`, `apps/app`, agent instructions) → owner decision, implementation, the §5 gate and §6 pass, `gp-reviewer` + `gp-ui-reviewer`, `gp-qa`.
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: `gp-ui-reviewer` (packages/ui, packages/tokens, apps/app/app, apps/app/src/components, apps/landing kitchen sink), ADR-015 (a design-system ruling). No `gp-architect`, `gp-security` or `gp-mobile` trigger.
- Owning module and allowed edit paths: `packages/tokens/scripts/generate-theme.mjs`, `packages/tokens/scripts/generate-merge-config.mjs`, the files they generate (`packages/ui/src/{theme,tokens}.generated.css`, `tw-merge.generated.ts`, `docs/design/01-tokens.md`), `packages/ui/src/components/cn.ts`, `Label.tsx`, `Field.tsx` (comment), `apps/app/src/components/evidence/evidence-card.tsx` (comment), `packages/testing/qa/motion-audit.mjs`, `packages/testing/src/{motion-audit,token-fidelity}.test.ts`, `agents/roles/gp-ui-reviewer.md` and its generated profiles, `packages/testing/src/{tw-merge,primitive-leak}.test.ts`, `packages/testing/src/stock-tailwind.test.ts` (new), seven `apps/app` files with `max-w-112`/`max-w-96` workarounds, `AGENTS.md` rule 1, `docs/design/02-building-ui.md` (dated corrections), `docs/decisions/ADR-015-*.md` and its index row, `docs/BACKLOG.md` (BL-047), this record, `docs/tasks/README.md`.
- Read context and applicable local instructions: root `AGENTS.md`; `docs/design/02-building-ui.md` (read in full before the first line).
- Linked spec (`docs/specs/…`), ADR or earlier task: BL-047; ADR-015.
- Baseline: `origin/main` `3ded684a`.
- Dependencies / constraints / out of scope: no token value changes except the one DEV-074 adds.
- Required acceptance criteria: listed in «Acceptance evidence».
- Skipped stages and rationale: none.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | «Полностью свободно» — stock colours stay allowed, no test refuses them; preferring the role is a review rule (asked after `gp-ui-reviewer` U3) | Owner, in this session (ADR-015 «Approval») |
| 2026-09-24 | «нет я хочу что бы Tailwind работал нормально, а уже на нем накатывались наши токены»; «наши токены должны переписать существующие, или быть дополнением к уже тем что есть» — after the coordinator explained the cleared namespaces | Owner, in this session (ADR-015 «Approval») |

## Plan

1. Tests first: `stock-tailwind.test.ts` (no `--ns-*: initial`; roles still declared); `tw-merge.test.ts` pairs for stock beside roles (`text-sm text-ink` kept; `text-sm text-data`, `rounded-md rounded-panel`, `shadow-md shadow-raised`, `font-light font-medium`, `max-w-md max-w-content`, `bg-red-500 bg-canvas` collapse). Check: red.
2. The theme generator drops the clearing block; the merge generator emits `TW_MERGE_EXTEND` (with the container roles in `max-w`) and `cx()` uses `extend`. Check: green; the §5 gate.
3. Replace the `max-w-112`/`max-w-96` workarounds with `max-w-md`/`max-w-sm` and cut the comments that explained the gap; correct `Label.tsx`, `primitive-leak.test.ts`, `AGENTS.md` rule 1 and `02-building-ui.md`. Check: §6 widths.
4. ADR-015 transcribing the owner's ruling.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | Measured: the theme cleared eighteen stock namespaces; a class whose key is missing emits no rule, so `Dialog`'s `max-w-md`, `/login`'s `max-w-sm`, two empty states and `shell-error` ran full width; seven files carried spacing workarounds. A scan of `apps/app`, `apps/landing` and `packages/ui` for stock classes that would come alive found only those `max-w-*` uses — the frequent `font-medium`/`leading-*`/`tracking-*` are already roles of the same name | session | Owner |
| 2 | Owner | ADR-015 ruling (Owner decisions) | Session | Implement |
| 3 | Coordinator | Plan steps 1–4. The tests were red as expected (5 of 10 in `tw-merge`/`stock-tailwind` before the generators changed), then green. UI gate (`docs/design/02-building-ui.md` §5) on the working tree at base `3ded684a`: step 1 `pnpm --filter @goproceed/tokens generate` regenerated `theme.generated.css`, `tokens.generated.css`, `tw-merge.generated.ts`, `01-tokens.md`; step 2 `motion-audit: clean`; step 3 the fourteen DB-free `packages/testing` files (the thirteen usual plus the new `stock-tailwind.test.ts`) 205/205 — the rest call `resetDb()` and are NOT RUN locally (CI runs them); step 4 `pnpm turbo run typecheck --force` 10/10; step 5 `pnpm --filter @goproceed/landing build` exit 0; also `pnpm --filter @goproceed/app build` exit 0, `apps/landing` tests 272/272, `apps/app` DB-free tests 650 in 67 files. §6 pass (puppeteer against `next start` of both apps; 1920, 1440, 1240, 768 with a fine pointer, 390 and 360 with `hasTouch`/`isMobile` so `(pointer: coarse)` matches): kitchen-sink `Dialog` 448px wide (`max-width: 448px`) at the four desk widths and the full viewport at 390/360; `apps/app` `/login` column 384px (`max-width: 384px`), 360 at 360; no horizontal scroll at any width; reduced motion: the dialog opens with `animation-name: none`. The compiled `apps/app` CSS carries `.max-w-md{max-width:var(--container-md)}` and `.max-w-sm{…}`. The 404 page redirects to sign-in without a session (307), so its `max-w-md` was checked in the CSS, not on screen. 25 screenshots | scratchpad `ui-gate.log`, `gate-step3.txt`, `shots/` | Review |
| 4 | gp-reviewer, gp-ui-reviewer; Owner; Coordinator | gp-reviewer: no blocker, R1–R8. gp-ui-reviewer: HOLD on U1–U5. Owner on U3: «Полностью свободно». Fixed per «Findings». Compile check with the installed `@tailwindcss/node` 4.3.3 of `sm:grid md:grid lg:grid xl:grid wide:grid max-w-md max-w-content font-medium text-sm text-data bg-neutral-200 animate-spin`: media order 640px < 768px < 1024px < 1240px < 1280px; `.font-medium` reads `--gp-font-weight-medium` (the role wins); `.text-sm`, `.max-w-md`, `.bg-neutral-200` (stock) and `.animate-spin` compile. §6 re-shoot: both kitchen-sink checkboxes paint at the column's left edge (1440: 148/148 and 165/165; 390: 24/24 and 41/41), checked fill `rgb(12, 12, 10)` (ink); kitchen sink `max-w-xl` 576px and `max-w-2xl` 672px at 1440, 342px at 390; landing home no horizontal scroll | scratchpad `shots2/` | Re-check, gp-qa |
| 5 | gp-ui-reviewer (re-check) | HOLD: U1, U2, U5, R7 fixed; remaining U3-text, U4-rest and a new U6 (DEV-074). Fixed per «Findings»; gate re-run below | Subagent report (session) | gp-qa |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| U1 / R1 | major | `generate-theme.mjs`, breakpoints and containers | stock `sm`/`lg`/`xl`/`2xl` in rem beside px roles: Tailwind 4.3.3 orders breakpoints by unit before value, so `sm:`/`lg:` rules land after `md:`/`wide:` and win | Coordinator | Fixed: stock breakpoints and container sizes restated in px (`STOCK_IN_PX`); `stock-tailwind.test.ts` asserts one unit and the installed values × 16; a compile of `sm: md: lg: wide: xl:` with `@tailwindcss/node` 4.3.3 emits `640px < 768px < 1024px < 1240px < 1280px` |
| U2 / R2 | major | `motion-audit.mjs` rule 4 | stock `animate-spin|ping|pulse|bounce` compile now and the audit only saw `infinite` declarations | Coordinator | Fixed: rule 4b refuses the four classes; `motion-audit.test.ts` fixture (assembled at runtime); repository still `motion-audit: clean` |
| U3 | major | stock colours | a stock colour, including Tailwind's `neutral` that shares this system's ramp name, compiles with no guard | Owner | Owner: «Полностью свободно» — no guard test; ADR-015 decision 4, `AGENTS.md` rule 1, `02-building-ui.md` §1 and `gp-ui-reviewer.md` say the role is preferred by review and name the palette collision |
| U4 / R3 | minor / medium | `02-building-ui.md:40`, `generate-theme.mjs` colour comment, `Field.tsx:9-11`, `evidence-card.tsx`, `token-fidelity.test.ts` | «does not compile» claims now false; AC-4 was marked PASS on a `max-w-112` grep alone | Coordinator | Fixed: each dated or rewritten; `02-building-ui.md` header names ADR-015; AC-4 re-run below |
| R4 | medium-low | `agents/roles/gp-ui-reviewer.md` | the reviewer role still listed only «role tokens only» | Coordinator | Fixed: a line on stock utilities and the palette-name collision; profiles regenerated (`sync-agents.py --write`, `validate:agents` OK) |
| R5 | low | ADR-015 decisions 3 and 4 | the owner had not ruled on them | Owner / Coordinator | Decision 4 is now the owner's «Полностью свободно»; decisions 3, 5, 6 are named as coordinator detail the merge is asked to ratify |
| R6 | low | ADR-015 «five», DEV-073 scan, Sources | seven files, not five; the scan missed the kitchen sink's `max-w-xl`/`max-w-2xl`; Sources lacked the installed Tailwind version | Coordinator | Fixed: ADR text; §6 shot the kitchen-sink cases (576px / 672px at 1440, 342px at 390); Sources name Tailwind 4.3.3 |
| U3-text | minor | ADR-015 «does NOT authorise» | a bullet read as a prohibition of stock colours the owner declined | Coordinator | Fixed: «No test or rule refusing stock colours (decision 4)…» |
| U4-rest | minor | `generate-docs.mjs` → `01-tokens.md` | still said `bg-neutral-200` does not compile | Coordinator | Fixed and regenerated; `grep -n 'does not compile' docs/design/01-tokens.md` → nothing |
| R8 | low | `stock-tailwind.test.ts` | reads the generated file, not the compiled CSS | Coordinator | Partly: the one-unit and installed-values checks added; the compiled order checked once by hand with `@tailwindcss/node` (row 4), not as a test |

Rework count and hypothesis changes: one rework after the first review (not a round: no QA FAIL, no blocker); every change is a stated fix above.

## What is not true after this task

- A stock colour or size can now reach a screen without failing a build (owner: «Полностью свободно»); the contrast suite measures roles only, and Tailwind's `neutral`/`green`/`amber`/`violet` palettes share this system's ramp names. Preferring the role is kept by review.
- `Field`'s horizontal orientation centres a control on its content (`items-center`); shadcn's own adds `has-[>[data-slot=field-content]]:items-start`. A checkbox beside a two-line description therefore sits mid-block, as it did before this task.
- Dialogs are still the full viewport width at 390/360 (the `w-full` they always had); only the desk width changed.
- The database suites (CI) did not run locally.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 no stock namespace cleared; roles still emitted | Yes | working tree | `stock-tailwind.test.ts` | PASS | |
| AC-2 `cx()` keeps stock classes and collapses them against roles | Yes | working tree | `tw-merge.test.ts` (new case + the existing ones) | PASS | |
| AC-3 `Dialog` and `/login` take their width | Yes | working tree | §6 pass (row 3): 448px / 384px at the desk | PASS | |
| AC-4 no workaround or stale «does not compile» claim left in code | Yes | working tree | `grep -rn 'max-w-112\|max-w-96' apps/app` → nothing; the five further claims R3 listed rewritten | PASS | after rework (first marked PASS on the grep alone, R3) |
| AC-5 §5 gate | Yes | working tree | row 3 | PASS | step 3 DB suites NOT RUN locally |
| AC-6 full CI run | Yes | — | PR CI | NOT RUN | pending the PR |

## Sources

- Tailwind CSS v4 theme variables (`@theme`, namespace reset with `--ns-*: initial`), https://tailwindcss.com/docs/theme (installed `tailwindcss` 4.3.3; accessed 2026-09-24); its breakpoint sort (unit before value) read in the installed `dist/lib.mjs` by `gp-reviewer` and `gp-ui-reviewer`; the behaviour — a class whose namespace key is missing emits no rule — is measured in this repository (DEV-035-era comments, and the built CSS in row 3).
- tailwind-merge `extendTailwindMerge({ extend })` vs `override` (installed 3.6.0, its README).
- WCAG 2.2 2.5.8 Target Size (Minimum) 24×24 CSS px and 2.5.5 Target Size (Enhanced) 44×44, https://www.w3.org/TR/WCAG22/ (accessed 2026-09-24).

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: §5 gate, §6 pass, DB-free tests.
- Remaining risks / blocked requirements: database suites are CI's.
- Next bounded action and owner: `gp-reviewer`, `gp-ui-reviewer`, `gp-qa`; then the owner merges.
- Final state and reason: implementing.
