# ADR-015: Stock Tailwind stays whole; the design tokens ride on top of it

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-09-24

**Related decisions:** [docs/design/02-building-ui.md](../design/02-building-ui.md) §1 and §4.1 (the procedure this amends); the rewrite plan's D-rulings (Historical)

> **Authority.** Drafted by the coordinator of [DEV-073](../tasks/DEV-073-stock-tailwind-under-tokens.md)
> and approved by the owner on 2026-09-24 (see «Approval»). It amends the
> procedure's founding sentence — «ramp steps are deliberately unreachable as
> utilities… everything else follows» — in the one respect of whether Tailwind's
> stock namespaces exist; it changes no token value and no role.

## Context

The generated theme (`packages/ui/src/theme.generated.css`, from
`packages/tokens/scripts/generate-theme.mjs`) opened with
`@theme { --color-*: initial; --text-*: initial; --container-*: initial; … }`,
eighteen stock namespaces cleared, so that only this system's roles compiled.
A stock class then compiled to *nothing*, silently. The cost showed up as
BL-047: no role meant «a dialog», so `Dialog`'s `max-w-md` default, the login
column's `max-w-sm`, two empty states and the shell error ran full width, and
five other screens carried spacing-scale workarounds (`max-w-112`,
`max-w-96`) with long comments explaining why `max-w-md` could not be used.

## Decision

1. **The theme clears no stock namespace.** Tailwind's own theme stays whole:
   `max-w-md`, `sm:`/`lg:`/`xl:`, `text-sm`, `shadow-md`, `rounded-md`, the
   stock palette and the rest compile.
2. **The roles ride on top.** Every role is still emitted; a role whose name a
   stock value shares (`md` breakpoint, `font-medium`, `leading-tight`,
   `tracking-tight`, `ease-out`) overrides the stock value; every other role is
   added beside the stock scale.
3. **`cx()` extends stock tailwind-merge instead of overriding it**, so stock
   classes stay recognised and collapse against the roles of the same group
   (`text-sm text-data` → `text-data`; `max-w-md max-w-content` →
   `max-w-content`).
4. **A component still names a role.** What changes is enforcement: a stock
   class is no longer a build error. Choosing the role is a review rule
   (`gp-ui-reviewer`), and this system's own ramp steps stay unreachable as
   utilities (`primitive-leak.test.ts` still refuses a raw `var(--gp-neutral-*)`).

## Consequences

- The workarounds go: `max-w-112` → `max-w-md`, `max-w-96` → `max-w-sm`; the
  dead `max-w-md`/`max-w-sm` compile (DEV-073).
- `02-building-ui.md` §1 and the §4.1 rows that said «does not compile» /
  «resolves to nothing» carry a dated correction; root `AGENTS.md` rule 1
  says the same.
- A stock colour (`bg-red-500`) or size (`text-sm`) can now reach a screen
  unnoticed by the build; the contrast suite measures roles only.
- `packages/testing/src/stock-tailwind.test.ts` fails if the theme clears a
  stock namespace again.

## What this decision does NOT authorise

- No change to any token value, role or the contrast pairs.
- No stock colour in a component as a substitute for a missing role: a missing
  role is still added to `tokens.json`.

## Approval

**Approved by the owner on 2026-09-24, in conversation**, after the
coordinator explained why `max-w-sm`/`max-w-md` compiled to nothing:

- «нет я хочу что бы Tailwind работал нормально, а уже на нем накатывались наши
  токены» — decisions 1 and 2.
- «наши токены должны переписать существующие, или быть дополнением к уже тем
  что есть» — decision 2's override-or-add rule.

The owner ruled on those words, not on this text. Decisions 3 and 4 are the
coordinator's detail of the ruling, and the owner's merge ratifies them with
the rest. The coordinator wrote this section and the Status to transcribe the
ruling (`docs/README.md` «ADR lifecycle and approval»).
