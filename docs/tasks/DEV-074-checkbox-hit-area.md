# DEV-074 — BL-048: `Checkbox` reaches the touch floor with a larger hit area than its paint

## Assignment

- Objective and user-visible outcome: `Checkbox`'s button — what a pointer hits and the harness measures — is 24×24 at the desk and 44×44 under `touch:`, while the visible box stays 16px, so desk density does not change and the first dashboard screen that uses it passes the 44px touch-target audit.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-24.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): a design-system change (`packages/tokens`, `packages/ui`, `apps/app`, agent instructions) → owner decision, implementation, the §5 gate and §6 pass, `gp-reviewer` + `gp-ui-reviewer`, `gp-qa`.
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: `gp-ui-reviewer` (packages/ui, packages/tokens, apps/app/app, apps/app/src/components, apps/landing kitchen sink). No `gp-architect`, `gp-security` or `gp-mobile` trigger.
- Owning module and allowed edit paths: `packages/tokens/src/tokens.json` (`control-target-desk`, 24px) and its generated files, `packages/ui/src/components/Checkbox.tsx`, `packages/testing/src/component-contract.test.ts`, `apps/landing/app/kitchen-sink/components/page.tsx` (the case's rule text), `docs/BACKLOG.md` (BL-048), this record, `docs/tasks/README.md`.
- Read context and applicable local instructions: root `AGENTS.md`; `docs/design/02-building-ui.md` (read in full before the first line).
- Linked spec (`docs/specs/…`), ADR or earlier task: BL-048; ADR-015.
- Baseline: `origin/main` `3ded684a`.
- Dependencies / constraints / out of scope: no token value changes except the one DEV-074 adds.
- Required acceptance criteria: listed in «Acceptance evidence».
- Skipped stages and rationale: none.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | «Зона 44 на таче, 24 на десктопе» | Owner, in this session |

## Plan

1. Test first: `component-contract.test.ts` requires `touch:size-(--gp-control-height-touch)` and `size-(--gp-control-target-desk)` in `Checkbox.tsx`. Check: red.
2. Token `control-target-desk` 24px (WCAG 2.2 2.5.8), regenerate; the Radix root becomes the transparent hit area and the 16px box an inner span styled through `group-data-[state=…]`/`group-aria-invalid`. Check: green; §6 measurement.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Owner | Hit area 44 on touch, 24 at the desk | Session | Implement |
| 2 | Coordinator | Contract test red, then green after the token and the component. §6: at 1920/1440/1240/768 (fine pointer) the checkbox button measures 24×24 with a 16×16 box; at 390/360 (`pointer: coarse`) 44×44 with a 16×16 box. UI gate (`docs/design/02-building-ui.md` §5) on the working tree at base `3ded684a`: step 1 `pnpm --filter @goproceed/tokens generate` regenerated `theme.generated.css`, `tokens.generated.css`, `tw-merge.generated.ts`, `01-tokens.md`; step 2 `motion-audit: clean`; step 3 the fourteen DB-free `packages/testing` files (the thirteen usual plus the new `stock-tailwind.test.ts`) 205/205 — the rest call `resetDb()` and are NOT RUN locally (CI runs them); step 4 `pnpm turbo run typecheck --force` 10/10; step 5 `pnpm --filter @goproceed/landing build` exit 0; also `pnpm --filter @goproceed/app build` exit 0, `apps/landing` tests 272/272, `apps/app` DB-free tests 650 in 67 files | scratchpad `shots/measure.json`, `sink-checkbox-*.png` | Review |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| U5 | minor | `Checkbox.tsx` | the 16px box sat 4px (desk) / 14px (touch) in from the column edge | Coordinator | Fixed: `-mx-1 touch:-mx-3.5`; §6: painted left edge equals the column edge at 1440 and 390 (DEV-073 row 4) |
| R7 | low | `Checkbox.tsx` | an unnamed `group` let any ancestor `.group` with `data-state="checked"` paint the box | Coordinator | Fixed: `group/checkbox` with `group-data-[state=checked]/checkbox:` and `group-aria-invalid/checkbox:`; compiled rule `:where(.group\/checkbox)[data-state=checked] *` |

Rework count and hypothesis changes: one rework after the first review (not a round); every change is a stated fix above.

## What is not true after this task

- No dashboard screen uses `Checkbox` yet, so the harness has not audited one in context.
- The hit area is the button's box: two checkboxes placed closer than 44px apart on touch would overlap their targets.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 contract test | Yes | working tree | `component-contract.test.ts` | PASS | |
| AC-2 24×24 desk, 44×44 touch, 16px paint | Yes | working tree | §6 measurement (row 2) | PASS | |
| AC-3 §5 gate | Yes | working tree | DEV-073 row 3 | PASS | |

## Sources

- WCAG 2.2 2.5.8 Target Size (Minimum) 24×24 CSS px and 2.5.5 Target Size (Enhanced) 44×44, https://www.w3.org/TR/WCAG22/ (accessed 2026-09-24).
- Radix Checkbox (installed `radix-ui`), structure read in `node_modules`: the Indicator renders inside the Root's context.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: §5 gate, §6 pass, DB-free tests.
- Remaining risks / blocked requirements: database suites are CI's.
- Next bounded action and owner: `gp-reviewer`, `gp-ui-reviewer`, `gp-qa`; then the owner merges.
- Final state and reason: implementing.
