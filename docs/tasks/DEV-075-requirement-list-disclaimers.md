# DEV-075 — BL-156: the Telegram card and the office's blocked-reasons list print the requirement-list disclaimers

## Assignment

- Objective and user-visible outcome: every surface that prints a requirement list carries the disclaimers that `docs/product/hidden-works-content-rules.md` §"Required disclaimers" requires. The Telegram assignment card, the requirement-choice prompt and the office's «Заблоковані вимоги» panel print the довідковий disclaimer under the list. When an item on the list is labelled «за робочою документацією об'єкта», the project-sourced items note follows immediately after it. Before this change only the act and the native field screen printed them.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-24.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): executed code under `apps/app` that touches the Telegram channel workflow's card renderer and a dashboard component. Route: `gp-architect` → implementation with failing tests first → `gp-reviewer` + `gp-ui-reviewer` → `gp-qa`.
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why:
  - `gp-architect`: BL-156 asks for a reading of the content rules per surface, and the card belongs to the Telegram channel workflow.
  - `gp-ui-reviewer`: the change touches `apps/app/src/components`.
  - `gp-security` does not run: no security trigger path is touched. The card's text changes; its webhook, tokens and escaping do not.
  - `gp-mobile` does not run: `apps/mobile` is unchanged.
  - `gp-researcher` does not run: no third-party API decision is involved.
- Owning module and allowed edit paths:
  - `apps/app/src/lib/required-disclaimers.ts` (new);
  - `apps/app/src/lib/statutory-act-form.ts` (the move and re-export);
  - `apps/app/src/lib/telegram/cards.ts` and its test;
  - `apps/app/src/components/projects/blocked-reasons-list.tsx` and a new test;
  - `apps/app/tests/act-content-fidelity.test.ts`;
  - `docs/BACKLOG.md`, this record, `docs/tasks/README.md`.
- Read context and applicable local instructions:
  - root `AGENTS.md`, `apps/app/AGENTS.md`, `docs/design/02-building-ui.md`;
  - `hidden-works-content-rules.md` §"Required disclaimers" and prohibition T;
  - [DEV-058](DEV-058-field-project-sourced-disclaimer.md).
- Linked spec (`docs/specs/…`), ADR or earlier task: BL-156; DEV-058 (`gp-reviewer`'s separate question); ADR-005; ADR-011.
- Baseline: `origin/main` `248053c6`.
- Dependencies / constraints / out of scope:
  - No database, migration, contract or catalog change.
  - The mobile copy of the texts stays as DEV-058 left it.
  - Changing the довідковий wording is out of scope (BL-163).
- Required acceptance criteria:
  - AC-1: the card and the prompt carry the довідковий text once, after «Джерела» and before the instruction.
  - AC-2: the project-sourced note follows immediately when a printed citation is `PROJECT_DOCUMENTATION`, and not otherwise; a withheld citation adds no note.
  - AC-3: the prompt is never longer than the card it came from. A card that fits only without the disclaimers is refused with `assignment_card_too_long`, never shortened.
  - AC-4: the blocked-reasons panel prints the same texts under its list, in the same order and never collapsed, and prints none for an empty list.
  - AC-5: one source for the texts in `apps/app`; the act's bytes and `RENDERER_VERSION` unchanged; the byte-for-byte guard still passes.
  - AC-6: the §5 gate and a §6 look at the panel.
  - AC-7: full CI on the pull request.
- Skipped stages and rationale: `gp-security`, `gp-mobile`, `gp-researcher` (see above).

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | Take BL-156 as the next task after DEV-073/074's closure | Owner's message in the session («сейчас закрыть DEV-073/074», then «след по списку») |

## Plan

1. `gp-architect` reads the rules per surface and sets the budget option.
2. Failing tests in `cards.test.ts` and `blocked-reasons-list.test.tsx`; the red run.
3. Move the two texts into `required-disclaimers.ts` with `requirementListDisclaimers`; `cards.ts` and the panel use it; `statutory-act-form.ts` re-exports. Check: green, act tests unchanged.
4. The single-source sweep in `act-content-fidelity.test.ts`, with a mutation.
5. The §5 gate, the app build, the DB-free `apps/app` tests, and a §6 fixture pass.
6. `gp-reviewer` + `gp-ui-reviewer`, then `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | Both surfaces are generated requirement lists: the card by prohibition T (`hidden-works-content-rules.md:270-286`), the panel in substance (its title «Заблоковані вимоги», Додаток Н criteria with citations; the same argument the act makes). Budget option (i), both texts in full: a shortened text would edit an Approved document, and a link would collapse the text. Constants go to a dependency-free module that `statutory-act-form.ts` re-exports, so no byte and no `RENDERER_VERSION` changes. No ADR, migration, contract, INV or copy-catalog row. Two items for the owner: the довідковий sentence misdescribes a list with no Додаток Н item (recommended: print as written, file separately → BL-163); and pre-change cards could break the prompt's budget argument (a read-only check) | Subagent report (session) | Check hosted rows |
| 2 | Coordinator | Read-only through the Supabase connector on `goproceed-staging`: `select kind, count(*) from public.communication_messages group by kind` returned no rows, so no card published before this change exists and the prompt's budget argument holds | Connector result, 2026-09-24 | Implement |
| 3 | Coordinator | Red run: 8 of 35 failed as expected in the two files. Two new cases passed before the change: «prints no disclaimer when there is no list» (negative) and «refuses a card that fits only without its disclaimers», whose title length is computed from the rendered card and exercises the boundary only once the disclaimers exist. Green: the two files plus `statutory-act-form.test.ts` and `act-content-fidelity.test.ts`, 100 of 100 | Session output | Sweep |
| 4 | Coordinator | Single-source sweep added. Mutation: appending `// відтворений дослівно` to `cards.ts` fails it (1 failed, 22 passed); restored | Session output | Gate |
| 5 | Coordinator | §5 gate on the working tree at `248053c6`: step 1 skipped (`tokens.json` unchanged); step 2 `motion-audit: clean`; step 3 the fourteen DB-free `packages/testing` files 209/209 (the rest call `resetDb()`, NOT RUN locally, CI runs them); step 4 `pnpm turbo run typecheck` 10/10; step 5 `pnpm --filter @goproceed/landing build` exit 0. Also `apps/app` `pnpm build` exit 0 and `vitest run src tests/act-content-fidelity.test.ts tests/project-path-ids.test.ts` 572 passed, 1 skipped, in 63 files | `scratchpad/dev075-gate.log` | §6 |
| 6 | Coordinator | §6 on a fixture: the panel rendered with `renderToStaticMarkup` (one Додаток Н reason, one project-sourced reason; and the Додаток Н one alone) inside the built app's CSS, measured with puppeteer at 1920, 1440, 1240, 768 (fine pointer), 390 and 360 (touch). Mixed list: two disclaimers; Додаток Н alone: one; 12px `text-ink-muted`; 680px wide (`measure`) at the desk and 356/326px at 390/360; no horizontal scroll and no overflowing element at any width. A sample card with both reasons is 1,282 of 4,096 characters. The fixture file was deleted after the run | `scratchpad/dev075/mixed-1440.png`, `mixed-390.png`, `telegram-card.txt` | Reviews |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## What is not true after this task

- No real Telegram group has seen the card. The webhook is enabled nowhere (BL-024), so the card's rendering in a Telegram client is unobserved; the text is checked as a string only.
- The panel was seen on a fixture, not on `/projects/{projectId}` with a signed-in session and seeded data: the local stack was not running. The fixture's fonts fell back to the browser's own, because the built CSS's font URLs were not served.
- The довідковий sentence still states «Наведений перелік — це довідковий Додаток Н… відтворений дослівно» on a list with no Додаток Н item (all project-sourced or custom rules), as the act and the field client already do (BL-163).
- The mobile copy of the texts is still a second copy, answering to the content rules, not to this module.
- The database suites were not run locally (CI's).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

No third-party documentation was needed: the change renders fixed strings through existing code. Telegram's 4096-character message limit is the existing `MAX_TELEGRAM_MESSAGE_CHARACTERS`, not re-checked here.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: rows 3–6.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-reviewer` and `gp-ui-reviewer`.
- Final state and reason: implementing.
