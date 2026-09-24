# DEV-075 — BL-156: the Telegram card and the office's blocked-reasons list print the requirement-list disclaimers

## Assignment

- Objective and user-visible outcome: every surface that prints a requirement list carries the disclaimers that `docs/product/hidden-works-content-rules.md` §"Required disclaimers" requires. The Telegram assignment card, the requirement-choice prompt and the office's «Заблоковані вимоги» panel print the довідковий disclaimer under the list. When an item on the list is labelled «за робочою документацією об'єкта», the project-sourced items note follows immediately after it. Before this change only the act and the native field screen printed them.
- State: verifying
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
| 7 | Coordinator | Committed `80259340` as work in progress and pushed it to the task branch only. The container had already restarted once in this session, and the session's stop hook asks for pushed work. No pull request is opened before the findings below are settled | `git log` | — |
| 8 | gp-ui-reviewer | PASS, with U1 (advisory) and U2 (optional). Roles only; `text-meta`/`text-ink-muted` match the field screen's `meta secondary`. It agrees that no copy-catalog row is right. Not run: the live route, and four of the six widths as images (they are seen through the measurements) | Subagent report (session) | — |
| 9 | gp-reviewer | PASS WITH FINDINGS, no blocker or major: R1–R6 (below). It confirmed that the moved texts are the same bytes, that the act's output and `RENDERER_VERSION` are unchanged, and that the prompt-subset argument holds (candidates come from the card's snapshot, `0084`; occurrences are immutable, `0043`). It also found that the panel's bundle does not pull in `node:crypto` | Subagent report (session) | Fixes |
| 10 | Coordinator | R1: BL-163 filed `open`, not `deferred (owner)`, since the owner has not ruled; U1 added to it. R2: re-run read-only through the connector on `goproceed-staging` as `postgres` (`rolbypassrls` true), with positive controls: `communication_messages` 0, `requirement_occurrences` 1, `schema_migrations` 102. R3: the moved comment names `statutory-act-form.ts`, and the double blank line is gone. R6: the prompt cases assert «once» with `split(…)`. `cards.test.ts` 31 of 31 | Connector result; session output | gp-qa |
| 11 | gp-qa | On `aaf02810`: AC-1 to AC-5 PASS, AC-6 PASS (partial), AC-7 NOT RUN (no pull request yet). Mutations killed: note dropped, order swapped, helper always both, one byte changed, a second copy, disclaimers moved above «Джерела», empty-list guard removed. The moved blocks hash the same (sha256 `557dd825…`); `RENDERER_VERSION` is `statutory-act-render/2`. Every stated fix is in place. Q1 (minor): an expandable quote or a `<details>` survived. Q2 (nit): the §6 fixture used the role key `technical_supervision`; the real key is `technical_supervisor`, so the screenshot shows the raw fallback under «Хто вирішує». Tree clean after the run | Subagent report (session) | Fix Q1 |
| 12 | Coordinator | Q1: «never collapses them» cases in `cards.test.ts` (card and prompt: no `<blockquote`, no `<tg-spoiler`) and `blocked-reasons-list.test.tsx` (no `<details`). Mutations: each disclaimer wrapped in its own `<blockquote expandable>` fails 3 (the new case and two adjacency checks); the panel's block wrapped in `<details>` fails 1; both restored. The two files: 37 of 37. Q2 recorded here: a fixture artifact, not a label bug | Session output | Pull request, CI |
| 13 | gp-qa | Q1 PASS at `0dbc45ed`: the whole block wrapped in `<blockquote expandable>` (M7) or `<tg-spoiler>` (M7b) fails the new card case; the panel block wrapped in `<details>` (M8) fails the new panel case; tree restored each time. Two record corrections, applied here (row 12's mutation named; AC-6's limitation) | Subagent report (session) | CI |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1 | minor | gp-reviewer; `docs/BACKLOG.md` BL-163 | Filed `deferred (owner)` with no owner ruling recorded | Coordinator | Fixed: `open`, no Resume field (row 10) |
| R2 | minor | gp-reviewer; row 2 | «No rows» had no role and no positive control | Coordinator | Fixed: re-run as `postgres` bypassing RLS, with controls (row 10) |
| R3 | nit | gp-reviewer; `required-disclaimers.ts` | The moved comment said «in this file»; a double blank line | Coordinator | Fixed (row 10) |
| R4 | nit | gp-reviewer; `apps/mobile/src/lib/field/disclaimer.ts` header | It says the app's constants live in `statutory-act-form.ts`; they are defined in `required-disclaimers.ts` and re-exported there | Coordinator | Not fixed here: the path is outside this task's allowed paths and would add `apps/mobile/src` to the route. The statement is still true as an import site. Left for the next change to that file |
| R5 | nit | gp-reviewer; `technical/copy-catalog.csv` `dash.project_money.*` | Every other string on the panel has a catalog row; the disclaimers have none | Coordinator | No change, reason recorded: these are regulatory strings whose one source is the content rules, checked byte for byte by `act-content-fidelity.test.ts`. A catalog row would be the second copy the sweep forbids. The act's disclaimers have no row either. gp-architect (row 1) and gp-ui-reviewer (row 8) concur |
| R6 | nit | gp-reviewer; `cards.test.ts` prompt case | AC-1's «once» was not asserted on the prompt | Coordinator | Fixed (row 10) |
| U1 | minor (advisory) | gp-ui-reviewer | The approved text bolds two phrases; every surface prints them plain | Coordinator | Not this diff's (a precedent across the act, mobile and now these surfaces); added to BL-163 for the owner's ruling |
| U2 | optional | gp-ui-reviewer; the disclaimer block | It has a row's padding and border, so it could be read as a third row | Coordinator | Stays as is: the block's muted 12px text and lack of a criterion line already set it apart from a row, and the finding is marked optional |
| Q1 | minor | gp-qa; both surfaces | Nothing tested «never collapsed»: a `<blockquote expandable>` on the card or a `<details>` on the panel survived | Coordinator | Fixed: tests with mutations (row 12). A test-only change to a stated fix |
| Q2 | nit | gp-qa; §6 fixture | The fixture's role key is `technical_supervision`, not `technical_supervisor` | Coordinator | Recorded (row 12); evidence only, the product is unaffected |

Rework count and hypothesis changes: none. R1, R2, R3, R6 and Q1 are stated fixes; no QA FAIL and no new blocker, so no round is counted.

## What is not true after this task

- No real Telegram group has seen the card. The webhook is enabled nowhere (BL-024), so the card's rendering in a Telegram client is unobserved; the text is checked as a string only.
- The panel was seen on a fixture, not on `/projects/{projectId}` with a signed-in session and seeded data: the local stack was not running. The fixture's fonts fell back to the browser's own, because the built CSS's font URLs were not served.
- The довідковий sentence still states «Наведений перелік — це довідковий Додаток Н… відтворений дослівно» on a list with no Додаток Н item (all project-sourced or custom rules), as the act and the field client already do (BL-163).
- The mobile copy of the texts is still a second copy, answering to the content rules, not to this module.
- The database suites were not run locally (CI's).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 once, after «Джерела», before the instruction | Yes | `aaf02810` + Q1 tests | `cards.test.ts`; gp-qa mutation (moved above «Джерела») | PASS | string only; no Telegram client (BL-024) |
| AC-2 the project note only for a printed `PROJECT_DOCUMENTATION` citation | Yes | `aaf02810` | `cards.test.ts`, `blocked-reasons-list.test.tsx`; gp-qa mutations | PASS | |
| AC-3 prompt ≤ card; over-limit card refused, not shortened | Yes | `aaf02810` | subset and boundary cases (4086 without, over 4096 with); staging query row 10 | PASS | assisted: the no-earlier-cards premise is the coordinator's staging query |
| AC-4 panel texts under the list, in order, never collapsed, none when empty | Yes | `aaf02810` + Q1 tests | `blocked-reasons-list.test.tsx` 5/5 with the `<details` mutation; `mixed-390.png` | PASS | seen on a fixture, not the live route |
| AC-5 one source; act bytes and `RENDERER_VERSION` unchanged | Yes | `aaf02810` | same sha256 for the moved blocks; byte-for-byte guard; sweep with mutation | PASS | |
| AC-6 §5 gate and §6 | Yes | `248053c6` + working tree; `aaf02810` | rows 5, 6, 11 | PASS | assisted: §6 on a fixture with browser fonts; database suites NOT RUN locally (CI's); gp-qa did not re-run the landing or app builds and saw one of the two screenshots (`mixed-390.png`) |
| AC-7 full CI on the pull request | Yes | — | pending | NOT RUN | environmental: no pull request yet; settled by the PR's `verify` and `app-qa` |

## Sources

No third-party documentation was needed: the change renders fixed strings through existing code. Telegram's 4096-character message limit is the existing `MAX_TELEGRAM_MESSAGE_CHARACTERS`, not re-checked here.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: independent — `gp-architect`, `gp-reviewer` and `gp-ui-reviewer` (native subagents); `gp-qa` (native subagents).
- Verified scope: rows 3–6.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: the pull request's CI (AC-7); then the owner's merge.
- Final state and reason: verifying — AC-1 to AC-6 PASS (gp-qa row 11, Q1 fixed in row 12); AC-7 waits on CI.
