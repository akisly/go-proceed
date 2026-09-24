# DEV-057 — BL-135: the loose ends of the field PWA's retirement

## Assignment

- Objective and user-visible outcome: the field client's code says truthfully which of its modules are the only copy now and which are deliberate duplicates of `apps/app`, and the duplicates that print text a user reads are held equal by tests; dead web icons and the unused `safe-next.ts` are gone. Nothing a user sees changes.
- State: verifying
- Coordinator: Claude Code primary session, 2026-09-24.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): an `apps/mobile` change → `gp-mobile` for requirements; `gp-reviewer`, `gp-ui-reviewer` (paths under `apps/mobile/src`), `gp-security` (`apps/mobile/.env.example`), `gp-qa`.
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: `gp-mobile` (apps/mobile); `gp-ui-reviewer` (`apps/mobile/src`; no screen renders differently, so no §6 screenshots); `gp-security` (an `.env.example` comment). Not `gp-architect`, not `gp-researcher`.
- Owning module and allowed edit paths: `apps/mobile/src/lib/**` (headers, comments, the three guards, deleting `safe-next.ts` and its test), `apps/mobile/public/icons/*`, `apps/mobile/assets/{favicon.png,icon-concept-v2.png}`, `apps/app/public/{icon-192,icon-512,maskable-icon-512}.png`, `apps/mobile/.env.example` (comment), `scripts/generate-brand-icons.mjs`, `turbo.json` (test inputs), `.github/workflows/ci.yml` (comment), `infra/README-staging.md` (dated note), `docs/BACKLOG.md` (BL-135 note, BL-153), this record, `docs/tasks/README.md`.
- Read context and applicable local instructions: root `AGENTS.md`, `apps/mobile/AGENTS.md`, `docs/design/02-building-ui.md`, ADR-013, DEV-035, `docs/product/hidden-works-content-rules.md` §"Required disclaimers".
- Linked spec (`docs/specs/…`), ADR or earlier task: BL-135; DEV-035 (`gp-mobile` M1-03, M1-04, M1-06, M1-07); ADR-013.
- Baseline: `origin/main` `e43c5ecf`.
- Dependencies / constraints / out of scope: BL-135 (3)'s native harness and (6)'s device measurement stay open; switching the hand-copied contract types is BL-153.
- Required acceptance criteria: `gp-mobile` AC-13…AC-23, each in «Acceptance evidence».
- Skipped stages and rationale: none.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | Item (5): «Оставить 404, закрыть» — an old `/a/{id}` link keeps landing on the 404; wontfix | Owner's choice in this session |
| 2026-09-24 | Item (4): «Все веб-остатки» — delete the `apps/app` PWA icons and `apps/mobile/public/icons/*` with their generator lines | Owner's choice in this session |
| 2026-09-24 | `apps/mobile/src/lib/safe-next.ts`: «Удалить с тестом» | Owner's choice, on `gp-mobile` Q1 |
| 2026-09-24 | OTP messages: «Да, тест на совпадение» with the office login's | Owner's choice, on `gp-mobile` Q3 |
| 2026-09-24 | Also in this PR: delete `assets/icon-concept-v2.png`; correct `apps/mobile/.env.example`'s «web-first»; file a backlog entry for the contract types (BL-153) | Owner's choice, on `gp-mobile` Q2, Q4, Q5 |

## Plan

1. Headers: canonical copies (`capture/{state,recover,attempt,hash}.ts`, `field/{assignments,obligations}.ts` and the three ported tests) say the original is gone; the three with a live twin say «deliberate duplicate» and name their guard; the false «not a mobile app dependency» comments are corrected. Check: AC-13, AC-14.
2. Guards: `field/disclaimer.test.ts` (against the content rules' blockquote, through `apps/app/tests/helpers/content-rules.ts`), `otp-error-twin.test.ts`, and a new case in `field/norm-ref-labels.test.ts` (against `apps/app`'s files as text); `turbo.json` test inputs gain the four files read. Check: AC-15…AC-17, AC-19.
3. Delete `safe-next.ts` and its test; fix `login-flow.ts`'s two mentions. Check: AC-18.
4. Delete the nine icon files and their generator lines; `ci.yml` and `.env.example` comments; `infra/README-staging.md` note; BL-135 note and BL-153. Check: AC-20…AC-23.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-mobile | Requirements and AC-13…AC-23; findings: `hash.ts` and three test headers also say PORT; `safe-next.ts` is dead (native login uses `nativeNext`); the «not a mobile app dependency» comments are false since DEV-042; ADR-013's own dated note already supersedes its handoff-page sentence, so (5) needs no ADR change; the disclaimer should answer to the Approved document, not to the app's copy; the guards read files outside the package, so `turbo.json` inputs must list them | Subagent report (session) | Owner questions |
| 2 | Owner | Q1–Q5 answered (Owner decisions) | Session | Implement |
| 3 | Coordinator | Implemented plan steps 1–4. `pnpm --filter @goproceed/mobile typecheck` exit 0; `test` 188 passed in 22 files (`main`: 186 in 20; −`safe-next.test.ts`, +`disclaimer.test.ts`, `otp-error-twin.test.ts`, one norm-ref case, and DEV-056's 7). `expo export --platform ios --platform android` on `main` and on this tree: both exit 0; the file lists (hashes masked) differ in exactly `icons/apple-touch-icon.png`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, which the native export had been copying from `public/` into `dist/` although nothing native references them (unmasked, the Hermes bundle names also differ — iOS `entry-e88bc6a4…` → `entry-83e9e8ca…`, Android `entry-493f696b…` → `entry-9791ae45…` — expected from the comment edits shifting source positions, not measured; that no rendered string changed rests on the comment-only diff); `expo config --type public` names no favicon or web icon. `validate:canonical-docs` needed BL numbers to stay sequential, so the new entry is BL-153 and code comments cite «a backlog entry», not the number — renumbered BL-153 and BL-154 when `main` with #123 (BL-146…BL-152) was merged in | scratchpad `ac22.log` | Gate, reviews |
| 4 | Coordinator | UI gate (`docs/design/02-building-ui.md` §5) at `e43c5ecf` + working tree: step 1 skipped (`tokens.json` unchanged); step 2 `motion-audit: clean`; step 3 only the thirteen `packages/testing` files that touch no database (contrast, token-fidelity, palette-derivation, primitive-leak, component-contract, app-entry, motion-audit, motion-contract, copy-catalog-fidelity, status-label-fidelity, tw-merge, subtle-body-copy, error-catalog-fidelity): 202 passed in 13 files — the rest call `resetDb()` (`supabase db reset`) and are NOT RUN without the owner; step 4 `pnpm turbo run typecheck` first failed on `@goproceed/app#typecheck` in this fresh worktree before any `next build` had generated its route types, then passed 10/10 (`--force`) after step 5; step 5 `pnpm --filter @goproceed/landing build` exit 0; `pnpm --filter @goproceed/app build` exit 0 (AC-21) | scratchpad `gate.log` | Reviews |
| 5 | gp-reviewer, gp-ui-reviewer, gp-security; Coordinator | gp-ui-reviewer: PASS (U1 pre-existing major → BL-154; U2 minor; U3, U4 optional). gp-reviewer: PASS with findings (R1–R3 minor, R7–R9 nit for this task). gp-security: PASS, and the `safe-next.ts` deletion removes no live protection (`nativeNext` is a stricter allow-list). Fixed R1–R3, R7, R9, U2–U4; R8 kept (Findings). Re-run: `pnpm --filter @goproceed/mobile typecheck` exit 0; `test` 191 passed in 22 files; `validate:canonical-docs` OK; the gate log gained the step 3 and step 4 re-runs | scratchpad `gate.log` | gp-qa |
| 6 | gp-qa | gp-qa on `36cb88bd`: all 23 criteria PASS (AC-1…AC-23 across DEV-056 and DEV-057), every Fixed finding in place; typecheck exit 0, 191 tests in 22 files, `validate:canonical-docs` OK, `validate:agents` OK; the committed signature re-verified independently with OpenSSL 3.6.3 (`dgst -blake2b512`, `pkeyutl -verify -rawin`); host, iOS and Gradle (`--offline`) tampered runs fail and restored runs pass with build outputs unchanged; mutations: U+02BC in the disclaimer, a Latin `o` in a label, an extra key in the app's label map, a double space in the app's label, `!` in `OTP_VERIFY_FAILED`, an extra `OTP_EXTRA` in the app — each fails its guard; AC-19: mobile test cache hit → miss after a blank line in `apps/app/src/lib/otp-error.ts` → hit after restore; `git status` empty at the end. New: Q1 (nit) — the verifier-call guard matched a commented-out call; Q2 — a misleading `exit 0` in `tamper-podinstall.log`; Q1 and Q2 are DEV-056's | scratchpad `qa-*.log` | Owner merges |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1 | minor | `login-flow.ts:23`; AC-13 | «`otp-error.ts`'s own PORT header» survived, so AC-13's grep was not empty | Coordinator | Fixed: «own header»; AC-13 re-run with `\bPORT\b` → no output (exit 1) |
| R2 | minor | `field/norm-ref-labels.ts`, its test | named «the office's act» as a user of the app's labels | Coordinator | Fixed: «the project money overview's blocked-reasons list and the Telegram cards» |
| R3, U4 | minor | `field/norm-ref-labels.test.ts`; `otp-error-twin.test.ts` | each guard checked a fixed name list, so a label or message only one side had went unseen | Coordinator | Fixed: any upper-case key / any `export const OTP_…` string on either side, compared as sets, then byte for byte |
| R7, U3 | nit | `otp-error.ts:33`, `otp-error.test.ts:21`, `field/disclaimer.ts:10-11` | named `safe-next.ts`/`submit-guard.ts` and «its source» as if present in `apps/mobile` | Coordinator | Fixed: «`apps/app`'s …», «the retired `apps/app` copy» |
| R8 | nit | `turbo.json` | the four inputs sit on the global `test` task | Coordinator | Kept: follows the `status-labels.generated.json` precedent; also makes `@goproceed/app#test` re-run on a content-rules edit |
| R9 | nit | BL-153 Evidence | the grep missed `norm-ref-labels.ts`'s wording | Coordinator | Fixed: the grep names both phrases |
| U1 | major (pre-existing) | `apps/mobile/src/screens/assignment.tsx` | the project-sourced items disclaimer is never printed | Owner | Filed as BL-154, a separate task at the owner's word; «What is not true» |
| U2 | minor | row 3 | «differ in exactly the four icons» held only with hashes masked | Coordinator | Fixed: row 3 now says the Hermes bundle names differ too |

Rework count and hypothesis changes: one rework after the first review (not a round: no QA FAIL, no blocker); every change is a stated fix above.

## What is not true after this task

- The native field client still has no browser or device harness, in CI or out of it (BL-135 (3) open).
- What an icon installed from the old PWA does on a real phone is unmeasured (BL-135 (6), BL-002).
- The mobile copies of contract shapes are still hand-written (BL-153); only the comments about them were corrected.
- The guards compare text a user reads, not logic: `otp-error.ts`'s rule and the norm-ref function are held equal only by each side's mirrored tests.
- The guards read `apps/app` files by path; renaming one breaks the mobile test, loudly.
- The field obligation screen does not satisfy §"Required disclaimers" in full: it never prints the project-sourced items disclaimer beside items labelled «за робочою документацією об'єкта» (`gp-ui-reviewer` U1; pre-existing, also absent from the retired PWA). Filed as BL-154, a separate task at the owner's word (2026-09-24).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-13 no stale PORT/«BOTH files»/«parity gate» header on a canonical copy; no «not a mobile app dependency» claim | Yes | working tree | `grep -rn -E '\bPORT\b|BOTH files|parity gate|not a mobile app dependency' apps/mobile/src` → no output, exit 1 (after R1) | PASS | negative |
| AC-14 live twins say «deliberate duplicate» and name the guard | Yes | working tree | headers of `otp-error.ts`, `field/norm-ref-labels.ts`, `field/disclaimer.ts` | PASS | |
| AC-15 disclaimer guard; mutation fails it | Yes | working tree | `field/disclaimer.test.ts` passes | PASS | mutation run left to gp-qa |
| AC-16 norm-ref label guard; mutation fails it | Yes | working tree | `field/norm-ref-labels.test.ts` passes | PASS | mutation run left to gp-qa |
| AC-17 OTP message guard; mutation fails it | Yes | working tree | `otp-error-twin.test.ts` passes | PASS | mutation run left to gp-qa |
| AC-18 `safe-next` gone; tests and typecheck pass | Yes | working tree | `grep -rn 'safe-next\|safeNext' apps/mobile/src` → only `otp-error.ts`/`otp-error.test.ts` comments describing `apps/app`'s twin; row 3 | PASS | |
| AC-19 an `apps/app`-only edit of a read file misses the turbo cache for `@goproceed/mobile#test` | Yes | working tree | — | NOT RUN | left to gp-qa |
| AC-20 `ci.yml` diff is comments only and names no deleted command | Yes | working tree | diff; YAML parses | PASS | |
| AC-21 the nine files deleted, the generator writes none, nothing references them; `apps/app` builds | Yes | working tree | grep; `pnpm --filter @goproceed/app build` (gate log) | PASS | |
| AC-22 native export unaffected except the four copied icons | Yes | working tree | row 3 | PASS | EAS NOT RUN: no account |
| AC-23 BL-135 dated note; staging README note | Yes | working tree | `docs/BACKLOG.md` BL-135; `infra/README-staging.md` §Installable | PASS | |

## Sources

- Expo SDK 57 app config (`platforms`, `web.favicon`), https://docs.expo.dev/versions/v57.0.0/config/app/ (accessed 2026-09-24 by `gp-mobile`); `expo` 57.0.24 installed. The export behaviour for `public/` was measured (row 3), not taken from the docs.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: independent — `gp-mobile`, `gp-reviewer`, `gp-ui-reviewer`, `gp-security`, `gp-qa` (all subagents).
- Verified scope: unit tests, typecheck, native export comparison.
- Remaining risks / blocked requirements: CI NOT RUN (billing block).
- Next bounded action and owner: the owner reviews and merges the PR; then the coordinator records `done`.
- Final state and reason: verifying — every required criterion PASS (gp-qa row); `done` is recorded after the owner merges.
