# DEV-058 — BL-154: the field obligation list prints the project-sourced items disclaimer

## Assignment

- Objective and user-visible outcome: a foreman who opens an obligation list containing items labelled «за робочою документацією об'єкта» sees the project-sourced items disclaimer that `docs/product/hidden-works-content-rules.md` §"Required disclaimers" mandates. It appears only on such a list, immediately after the довідковий disclaimer. Lists without such an item do not change.
- State: done
- Coordinator: Claude Code primary session, 2026-09-24.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): an `apps/mobile` change, so `gp-mobile` sets requirements first; then `gp-reviewer`, `gp-ui-reviewer` (paths under `apps/mobile/src`) and `gp-qa`.
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: `gp-mobile` (`apps/mobile`); `gp-ui-reviewer` (`apps/mobile/src/screens`). Not `gp-security`: no trigger path is touched, and the fixture harness used for the screenshots was never committed. Not `gp-architect`: no contract, catalog or database change. Not `gp-researcher`: no third-party API is involved.
- Owning module and allowed edit paths: `apps/mobile/src/lib/field/{disclaimer,obligations}.ts` and their tests, `apps/mobile/src/screens/assignment.tsx`, `docs/BACKLOG.md` (BL-154 note), this record, `docs/tasks/README.md`.
- Read context and applicable local instructions: root `AGENTS.md`, `apps/mobile/AGENTS.md`, `docs/design/02-building-ui.md`, `hidden-works-content-rules.md` §"Required disclaimers" and §"Project-sourced strings", `apps/app/src/lib/statutory-act-form.ts` (`PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT`, placement `"conditional"`), `apps/app/tests/act-content-fidelity.test.ts`.
- Linked spec (`docs/specs/…`), ADR or earlier task: BL-154; DEV-057 (`gp-ui-reviewer` U1); ADR-010 and migration `0059` (`PROJECT_DOCUMENTATION`).
- Baseline: `90cb9b63`, the tip of the local branch `claude/mobile-loose-ends` (DEV-056, DEV-057, merged with `origin/main` `406f5efe`); work started on its earlier tip `8f9a1ea1`. That branch holds BL-154 and `disclaimer.test.ts`, which this task extends; it is not yet on `origin/main`.
- Dependencies / constraints / out of scope: no database, no local stack, no `supabase db reset` and no database suites. The shared rendering of the other screens is out of scope, and so is moving the mobile contract types (BL-146).
- Required acceptance criteria: `gp-mobile` AC-01…AC-12 (below).
- Skipped stages and rationale: `gp-security`, `gp-architect` and `gp-researcher` (not triggered, see above).

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | BL-154 is a separate task from DEV-057 | BL-154 entry (owner, 2026-09-24) |
| 2026-09-24 | No database is needed; never run `supabase db reset` or the database suites for this task | Owner's task statement |

## Plan

1. Failing tests first: in `obligations.test.ts`, the condition both ways; in `disclaimer.test.ts`, a byte-for-byte guard against the content rules' blockquote introduced by «only on a list that also carries project-sourced items», with the довідковий guard also found by its introduction. Check: the red run.
2. `disclaimer.ts` gets `PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT`. `buildObligationScreen` gets `projectSourcedDisclaimer` (the text or `null`). `assignment.tsx` renders it right after `model.disclaimer`. Check: AC-01…AC-09, the mobile tests and typecheck.
3. §5 gate, then §6 screenshots in the iOS simulator using an uncommitted fixture harness. Check: AC-10…AC-12 and the screenshots.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | Numbers checked. `origin/main` has DEV-055 and BL-152, the open closure PR #124 adds none, and `claude/mobile-loose-ends` has DEV-056/057, so this task is DEV-058. That branch filed the entry as BL-154, which collided with `main`'s BL-154 (#123). Its session merged `origin/main` (`90cb9b63`) and renumbered the entry to BL-154 (its message, 2026-09-24). This work was moved onto `90cb9b63` with a 3-way apply; the one overlapping comment in `disclaimer.ts` was resolved | `git show origin/main:docs/BACKLOG.md`; `git ls-tree` over every branch | gp-mobile |
| 2 | gp-mobile | Design confirmed, with requirements R1–R5 and AC-01…AC-12. R5: find the довідковий blockquote by its introduction, not index `[1]`; done in this change. Render with two separate elements, no grouping. §6 evidence comes from a fixture harness in the simulator, and the end-to-end route stays NOT RUN. No copy-catalog row: the catalog holds neither the довідковий disclaimer nor the norm-ref labels | Subagent report (session) | Implement |
| 3 | Coordinator | Red run: 3 of 17 failed, as expected (the project guard's byte comparison and both null cases). The present case passed because both sides were `undefined`, so the test now also asserts `typeof … === "string"`. Green run: `pnpm --filter @goproceed/mobile test` passed 195 tests in 22 files (188 at base); `typecheck` exit 0 | `~/GoProceed-private/outputs/DEV-058/red.log`, `gate.log` | Gate |
| 4 | Coordinator | UI gate (§5) at `8f9a1ea1` + working tree. Step 1 skipped (`tokens.json` unchanged vs HEAD). Step 2 printed `motion-audit: clean`. Step 3 ran the 13 named `packages/testing` files that touch no database: 202 passed in 13 files. The rest call `resetDb()` and are NOT RUN. Step 4 `pnpm turbo run typecheck`: 10/10. Step 5 `pnpm --filter @goproceed/landing build` exit 0. Also `pnpm validate:canonical-docs` OK | `gate.log` | §6 |
| 5 | Coordinator | §6 on the iOS Simulator (iPhone 16 Pro, iOS 18.1), using the existing Debug dev-client build with Metro serving this worktree on :8082 (:8081 belonged to another session). The temporary harness bypassed the session gate and returned a fixed three-item response; it was reverted and is saved as `fixture-harness.patch`. A list with one `PROJECT_DOCUMENTATION` item shows the довідковий text and then the note. The same list with that item as `VERIFIED_SECONDARY` shows only the довідковий text. At the largest accessibility size the note wraps, is not clipped, and directly follows the довідковий text. The simulator's accessibility inspect was unavailable | `01-project-list-end-default.png`, `02-no-project-list-end-default.png`, `03-project-list-end-ax5.png`, `04-project-list-boundary-ax5.png` | Reviews |
| 6 | gp-ui-reviewer | PASS; no changes required. It reports pre-existing issues outside this diff. The gear button over text at the largest size is the Expo dev-client tools overlay, present only in the Debug build and not in the product. The header's arrow action sits close to the shrunken title at the largest size | Subagent report (session) | — |
| 7 | gp-reviewer | PASS, with one optional nit R1 (below). It confirmed that the route sends `normRef` as `null` or a complete object (`apps/app/src/lib/requirement-content.ts:298-302`), so the label and the note appear together, and that the condition equals the act renderer's (`statutory-act-form.ts:818-822`). It raised a separate question: do the Telegram cards and the office's blocked-reasons list, which also print the project label, count as a "generated requirement list"? Left to the owner, not filed here | Subagent report (session) | Fix R1 |
| 8 | Coordinator | R1 fixed: `disclaimer.test.ts` asserts that the note's quoted label equals `NORM_REF_VERIFICATION_LABELS.PROJECT_DOCUMENTATION`. `pnpm --filter @goproceed/mobile test`: 196 passed in 22 files; `tsc` exit 0. AC-10 and AC-11 were checked in the simulator with the same harness, extended so the second fetch fails: for AC-10 it throws a network `TypeError`, for AC-11 it answers 403 with a problem body. Harness reverted and saved as `fixture-harness-ac10-11.patch` | `05-ac10-failed-refresh-note-stays.png`, `06-ac11-refusal-clears-list.png` | gp-qa |
| 9 | Coordinator | Moved onto `90cb9b63` (row 1). At `90cb9b63` + working tree: `pnpm --filter @goproceed/mobile test` 199 passed in 22 files (the base has 191, and this change adds 8 cases); `typecheck` exit 0; `motion-audit: clean`; `validate:canonical-docs` OK. The earlier gate and screenshots ran at `8f9a1ea1`. Between the two bases, the changes under `apps/mobile/src` are DEV-056/057 review fixes to comments and guards, and none of them touches the obligation screen | `~/GoProceed-private/outputs/DEV-058/rebased.log` | gp-qa |
| 10 | gp-qa | Every code criterion PASS. `pnpm --filter @goproceed/mobile test` 199 passed in 22 files; `typecheck` exit 0; `motion-audit: clean`; `validate:canonical-docs` OK. Five mutations, all killed: the text changed by one character; `.some`→`.every`; always the text; always `null`; the screen's label changed. The tree was restored (`code.diff` hash `64166333…` before and after). One finding, Q1 (below). No copy-catalog row needed | Subagent report (session) | Fix Q1 |
| 11 | Coordinator | Q1 fixed: same harness, the top of the page after the failed refresh. Harness reverted; the code-only diff (`git diff 90cb9b63 -- apps/`) hash `d08bbee3…` is unchanged | `05a-ac10-failed-refresh-notice.png` | gp-qa re-check |
| 12 | gp-qa | Q1 closed. AC-01…AC-12 PASS, and AC-10…AC-12 keep the fixture-harness qualifier. The §5 gate, the §6 screenshots and the copy-catalog check PASS. It verified the code unchanged since its mutation run by comparing hashes, not by re-running the tests | Subagent report (session) | Commit; owner: PR |
| 13 | Owner | #126 was merged into `claude/mobile-loose-ends` after #125 had already landed on `main`, so the same branch was reopened against `main` as #127. The owner merged #127 (`5c5bbb0c`, 2026-09-24 13:36 UTC). BL-154 is closed | #126, #127 | none |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| Q1 | minor | gp-qa; AC-10 row | The row cited the notice from screenshot 05, which shows only the end of the page | Coordinator | Fixed: `05a-ac10-failed-refresh-notice.png` captured with the same harness state (the top of the page), and the row now cites both images |
| R1 | nit | gp-reviewer; `disclaimer.test.ts` | The label the note quotes should be tied to the label the screen prints; before the fix they were tied only indirectly, through the document | Coordinator | Fixed: new case «quotes the very label the screen prints beside a project-sourced item»; row 8 |

Rework count and hypothesis changes: none. R1 was a nit applied before QA. Q1 was missing evidence, not a behaviour change; there has been no QA FAIL.

## What is not true after this task

- The note has not been seen with real data. The screenshots come from a fixture harness, so the route, a signed-in session, and a project-sourced requirement authored in a workspace are untested together.
- No screen reader has read the two disclaimers: not VoiceOver, not TalkBack, and the simulator's accessibility tree was unavailable.
- Android was not looked at, and neither was a physical device (BL-002).
- The render itself has no automated test. The package's vitest is Node-only, so the decision is tested in `buildObligationScreen` and the JSX line is checked by review and the screenshots.
- The mobile constant and the app's constant are two copies. Each answers to the content rules byte for byte, not to the other.
- The pre-existing word break of the «Обов’язкові фіксації» heading at the largest text size is unchanged.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-01 empty list, each of 4 coverage values → `null` | Yes | working tree | `obligations.test.ts` «is absent from an empty list» | PASS | |
| AC-02 all `normRef` null → `null` | Yes | working tree | «is absent when no item is project-sourced» | PASS | |
| AC-03 only `VERIFIED_*` → `null` | Yes | working tree | same case | PASS | |
| AC-04 one project item first / middle / last → the constant | Yes | working tree | «wherever the one project item sits» | PASS | |
| AC-05 every item project-sourced → the constant | Yes | working tree | «is present when every item is project-sourced» | PASS | |
| AC-06 `disclaimer` stays the довідковий text | Yes | working tree | «never replaces the довідковий disclaimer» | PASS | |
| AC-07 one blockquote introduced by the project sentence, byte-equal, «immediately after it», right after the довідковий one | Yes | working tree | `disclaimer.test.ts` | PASS | |
| AC-08 довідковий guard found by «never collapsed», not by index | Yes | working tree | `disclaimer.test.ts` | PASS | |
| AC-09 next sibling after `{model.disclaimer}`, `meta` `secondary`, no wrapper, grouping or label override | Yes | working tree | `assignment.tsx:125`; gp-reviewer and gp-ui-reviewer | PASS | |
| AC-10 lost signal after load: notice shown, label and note stay | Yes | working tree | `05a-ac10-failed-refresh-notice.png` (top of the page: «Не вдалося оновити вимоги. Спробуйте ще раз.», capture disabled) and `05-ac10-failed-refresh-note-stays.png` (end of the same page: the project label and both disclaimers) | PASS | assisted: fixture harness throwing a network error on refresh; the OS offline flag was not toggled |
| AC-11 server refusal: list, labels and note go together | Yes | working tree | `06-ac11-refusal-clears-list.png`: only the notice and «Спробувати ще раз» remain | PASS | assisted: fixture harness answering 403 on refresh |
| AC-12 a list without a project item never shows the note | Yes | working tree | `02-no-project-list-end-default.png` | PASS | assisted: fixture harness, not the real route |
| §5 gate | Yes | working tree | `gate.log` | PASS | step 3 limited to the 13 non-database suites |
| §6 screenshots | Yes | working tree | four PNGs above | PASS | assisted: fixture harness, iOS simulator only |

## Sources

No third-party documentation decided anything in this task. `expo` 57.0.24 and `expo-dev-client` ~57.0.19 are installed; the simulator run used the Debug build that already existed.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: independent: `gp-mobile`, `gp-reviewer` PASS, `gp-ui-reviewer` PASS, `gp-qa` PASS (after Q1).
- Verified scope: unit tests, typecheck, UI gate, and simulator screenshots with fixture data, including a failed refresh and a refusal.
- Remaining risks / blocked requirements: the end-to-end route, screen readers and Android are NOT RUN. CI is NOT RUN (Actions billing block).
- Next bounded action and owner: none; merged in #127. The open question of whether the Telegram cards and the office's blocked-reasons list also need the note (gp-reviewer) is the owner's.
- Final state and reason: done. Merged in #127 (`5c5bbb0c`, 2026-09-24) after gp-mobile, gp-reviewer, gp-ui-reviewer and gp-qa passed; the real route, screen readers, Android and CI stay NOT RUN as recorded.
