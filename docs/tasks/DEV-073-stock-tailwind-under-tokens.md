# DEV-073 — BL-047: stock Tailwind stays whole, and `max-w-md` compiles again

## Assignment

- Objective and user-visible outcome: the generated theme stops clearing Tailwind's stock namespaces, the roles override or add to them (ADR-015), `cx()` extends stock tailwind-merge, and every dialog, the login column and the empty states get the width their class always named instead of the full width.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-24.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): a design-system change (`packages/tokens`, `packages/ui`, `apps/app`, agent instructions) → owner decision, implementation, the §5 gate and §6 pass, `gp-reviewer` + `gp-ui-reviewer`, `gp-qa`.
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: `gp-ui-reviewer` (packages/ui, packages/tokens, apps/app/app, apps/app/src/components, apps/landing kitchen sink), ADR-015 (a design-system ruling). No `gp-architect`, `gp-security` or `gp-mobile` trigger.
- Owning module and allowed edit paths: `packages/tokens/scripts/generate-theme.mjs`, `packages/tokens/scripts/generate-merge-config.mjs`, the files they generate (`packages/ui/src/{theme,tokens}.generated.css`, `tw-merge.generated.ts`, `docs/design/01-tokens.md`), `packages/ui/src/components/{cn,Label}.tsx`, `packages/testing/src/{tw-merge,primitive-leak}.test.ts`, `packages/testing/src/stock-tailwind.test.ts` (new), seven `apps/app` files with `max-w-112`/`max-w-96` workarounds, `AGENTS.md` rule 1, `docs/design/02-building-ui.md` (dated corrections), `docs/decisions/ADR-015-*.md` and its index row, `docs/BACKLOG.md` (BL-047), this record, `docs/tasks/README.md`.
- Read context and applicable local instructions: root `AGENTS.md`; `docs/design/02-building-ui.md` (read in full before the first line).
- Linked spec (`docs/specs/…`), ADR or earlier task: BL-047; ADR-015.
- Baseline: `origin/main` `3ded684a`.
- Dependencies / constraints / out of scope: no token value changes except the one DEV-074 adds.
- Required acceptance criteria: listed in «Acceptance evidence».
- Skipped stages and rationale: none.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
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

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## What is not true after this task

- A stock colour or size can now reach a screen without failing a build; the contrast suite measures roles only. The rule «a component names a role» is kept by review.
- Dialogs are still the full viewport width at 390/360 (the `w-full` they always had); only the desk width changed.
- The database suites (CI) did not run locally.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 no stock namespace cleared; roles still emitted | Yes | working tree | `stock-tailwind.test.ts` | PASS | |
| AC-2 `cx()` keeps stock classes and collapses them against roles | Yes | working tree | `tw-merge.test.ts` (new case + the existing ones) | PASS | |
| AC-3 `Dialog` and `/login` take their width | Yes | working tree | §6 pass (row 3): 448px / 384px at the desk | PASS | |
| AC-4 no workaround or stale «does not compile» claim left in code | Yes | working tree | `grep -rn 'max-w-112\|max-w-96' apps/app` → nothing | PASS | negative |
| AC-5 §5 gate | Yes | working tree | row 3 | PASS | step 3 DB suites NOT RUN locally |
| AC-6 full CI run | Yes | — | PR CI | NOT RUN | pending the PR |

## Sources

- Tailwind CSS v4 theme variables (`@theme`, namespace reset with `--ns-*: initial`), https://tailwindcss.com/docs/theme (installed `tailwindcss` in `packages/ui`; accessed 2026-09-24); the behaviour — a class whose namespace key is missing emits no rule — is measured in this repository (DEV-035-era comments, and the built CSS in row 3).
- tailwind-merge `extendTailwindMerge({ extend })` vs `override` (installed 3.6.0, its README).
- WCAG 2.2 2.5.8 Target Size (Minimum) 24×24 CSS px and 2.5.5 Target Size (Enhanced) 44×44, https://www.w3.org/TR/WCAG22/ (accessed 2026-09-24).

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: §5 gate, §6 pass, DB-free tests.
- Remaining risks / blocked requirements: database suites are CI's.
- Next bounded action and owner: `gp-reviewer`, `gp-ui-reviewer`, `gp-qa`; then the owner merges.
- Final state and reason: implementing.
