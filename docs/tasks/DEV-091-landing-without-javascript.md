# DEV-091 — BL-116: with scripting off, the landing shows every entrance at rest

## Assignment

- **Objective and user-visible outcome.** A reader whose browser runs no JavaScript now sees each landing page whole: a reader mode, a crawler that does not execute, a locked-down browser.
  - **Before.** `Reveal`, `Stagger`'s items and `StaggerItem` server-render their hidden first frame inline, and only JavaScript ever clears it. On the server that frame is `opacity: 0`, because `useReduced()` is true there and the reduced branch renders. Such a reader saw each page's h1 and little else, and `/pilot`'s form was not among what painted.
  - **After.** Each entrance is shown at rest, at its final opacity with no offset.
  - **With scripting on, nothing changes.** First paint and every entrance stay as they were.
- **State:** done
- **Coordinator:** Claude Code primary session, 2026-09-25.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why** (`agents/COORDINATION.md`, `agents/PLAYBOOKS.md` UI change): the change touches `packages/ui` and `apps/landing`. The route is the UI procedure (`docs/design/02-building-ui.md`) → `gp-reviewer` and `gp-ui-reviewer` → `gp-qa`.
- **Triggered stages:**
  - `gp-reviewer`, `gp-qa`: always.
  - `gp-ui-reviewer`: the change touches `packages/ui` and `apps/landing`.
  - `gp-architect`, `gp-security`, `gp-mobile` and `gp-researcher`: not triggered. There is no contract, schema, auth or secret change. The `<noscript>` body is a stylesheet the page's own code writes, with no user input.
- **Owning module and allowed edit paths:**
  - `packages/ui/src/motion/no-script.ts` (new), `Reveal.tsx`, `Stagger.tsx`, `index.ts`;
  - `apps/landing/app/layout.tsx`;
  - `apps/landing/qa/landing.mjs` (the «no-script» pass);
  - `apps/landing/tests/no-script-entrances.test.tsx` (new), and one regex in `apps/landing/tests/landing-render.test.tsx`;
  - one exclusion in `packages/testing/src/component-contract.test.ts`;
  - `docs/BACKLOG.md` (BL-116, BL-207), this record, and `docs/tasks/README.md`.
- **Read context:**
  - BL-116;
  - `docs/design/02-building-ui.md` §§1–3, §5, §6, §7.3 and §8;
  - `packages/ui/src/motion/{Reveal,Stagger,CrossFade,PinnedTabs}.tsx`;
  - `packages/ui/src/base.css`'s CSS `.entrance`;
  - `apps/landing/AGENTS.md`;
  - Next 16's `from-create-react-app.md` (no hand-written `<title>`/`<meta>` in the root layout's head; a `<noscript>` in the body is outside that).
- **Linked spec, ADR or earlier task:** BL-116; DEV-026 and DEV-027 (the measurement).
- **Baseline:** `984ce6f0`, which is `origin/main` after the DEV-090 closure.
- **Dependencies, constraints and out of scope:**
  - **The mechanism** (BL-116's «decision on the mechanism»): the coordinator took BL-116's first candidate, a `<noscript>` rule scoped to a `data-*` mark the entrance words set.
    - It leaves the scripted first paint untouched.
    - It shows nothing hidden on purpose. `PinnedTabs`' inactive panels carry `hidden`, and `CrossFade` renders only its active child.
    - The second candidate, entrances that start visible, would change every page's first paint.
  - **Not covered: scripting on, but a chunk that never loads.** That is BL-207, filed here.
  - **No new motion word.** Two constants are exported, and the vocabulary is unchanged.
- **Required acceptance criteria:**
  - AC-1: with scripting off, on the built pages at 1440, no text-bearing element in `main` sits under opacity 0 (outside a `hidden` panel) once the fold's CSS entrance has finished, and `/pilot`'s form paints. With the rule removed, each route has such elements. The harness asserts this.
  - AC-2: with scripting on, the rule is never a node, and entrances below the fold still start hidden.
  - AC-3: the unit tests hold the chain: every element an entrance hides carries the mark and nothing else does; the rule names the mark alone and undoes opacity, transform and filter; the root layout ships it once, inside `<noscript>`.
  - AC-4: the §5 gate and a §6 look (the scriptless pages at the six widths).
  - AC-5: CI is green.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | Take BL-116 after DEV-090 | Coordinator, under the owner's standing order («мержи и давай дальше») |
| 2026-09-25 | The mechanism: a `<noscript>` rule scoped to `data-entrance`. The failed-chunk case is filed as BL-207 | Coordinator: a reversible technical choice between BL-116's two named candidates; open to the owner |

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | **Implemented.**<br>• `no-script.ts` holds `ENTRANCE_ATTRIBUTE` and `NO_SCRIPT_ENTRANCE_CSS` (`[data-entrance]{opacity:1!important;transform:none!important;filter:none!important}`); a stylesheet's `!important` beats the inline style Motion rendered.<br>• `Reveal` (both branches) and `StaggerItem` set `data-entrance`. The `Stagger` container hides nothing itself.<br>• The landing's root layout carries `<noscript dangerouslySetInnerHTML>` with the rule. | Diff | Measure |
| 2 | Coordinator | **Measured on the built landing** (`next build`, `next start`, puppeteer with scripting off, 1440).<br>Text elements in `main` under opacity 0, with the rule removed → with it:<br>• `/`: 89 → 0<br>• `/product`: 302 → 0<br>• `/roles`: 157 → 0<br>• `/pilot`: 56 → 0<br>`/pilot`'s form now paints. At the instant of load, 3 elements on `/` read 0: the hero's lead and actions. Their CSS `entrance` runs without JavaScript, and after 2 s they paint.<br>With scripting on, the `<noscript>` holds no style node, and the entrances below the fold still start hidden: `/` 23 of 23, `/roles` 16 of 16, `/pilot` 3 of 3, `/product` 34 of 44. | `scratchpad/dev091/nojs.txt`, `nojs-settled.txt` | Tests |
| 3 | Coordinator | **Tests and gate.**<br>• `tests/no-script-entrances.test.tsx`: 3 of 3.<br>• Two tests pinned the old markup and are updated: `landing-render.test.tsx`'s card wrapper regex, which now also asserts the mark; and `component-contract.test.ts`'s motion inventory, which excludes `no-script` beside `tokens` and `use-reduced`, since its exports are constants, not primitives.<br>• Landing unit suite 275 of 275; component contract 21 of 21.<br>• §5: step 1 skipped (tokens unchanged); step 2 `motion-audit: clean`; step 3, the fourteen DB-free `packages/testing` files, 209 of 209 after the exclusion; step 4 `typecheck` 10/10; step 5 in the harness's own `next build`. | `scratchpad/dev091-gate.log` | Harness |
| 4 | Coordinator | **The landing harness**, run as `GOPROCEED_CHROME_PATH=/opt/pw-browsers/chromium pnpm --filter @goproceed/landing qa`:<br>• Its own `next build`, which is §5 step 5: exit 0.<br>• 40 audits, 28 widths plus 12 reduced, all ok.<br>• First folds, internal links and the border beam: ok.<br>• The new **«no-script» pass: ok**, 0 hidden on every route against 89 / 302 / 157 / 56 with the rule removed, and `/pilot`'s form painting.<br>• **Parity and interactions: PROBLEM.** The failing fields are the pointer-lit canvas grounds (`gridLit`, `floorLit`, `gridLitBesideDome`, `gridLitAboveDome`), `arcsLean`/`arcsLeanReduced` and `orbit`; none reads an entrance or an opacity.<br>• The harness's `public/og.png` rewrite was restored with `git checkout`. | `scratchpad/dev091/harness.txt`; `apps/landing/qa-output/report.json` | Baseline |
| 5 | Coordinator | **Baseline.** The same harness on `origin/main` `984ce6f0`, in a separate worktree, gives parity PROBLEM and interactions PROBLEM with **no field differing** from this branch's report (a key-by-key comparison of both `report.json` files), and 39 passes where the branch has 40, the 40th being «no-script». The two failures come from this sandbox (a headless browser with no real pointer or GPU; the pointer-lit grounds and the orbit never register), not from this change. The worktree's `og.png` was restored and the worktree removed | `scratchpad/dev091/harness-base.txt` | §6 |
| 6 | Coordinator | **§6 with scripting off**: every route at 1920, 1440, 1240, 768 (fine pointer), 390 and 360 (touch), with no horizontal scroll at any width. `/pilot` at 1440 paints its heading, lead, the two lists, the form with its buttons, the plan and the FAQ; `/` at 1440 and 360 is also photographed. | `scratchpad/dev091/shots.txt`, `nojs-{home,pilot}-{1440,360}.png` | Reviews |
| 7 | gp-ui-reviewer | **HOLD.** The mechanism is right. **U1 (major):** the scriptless home at 1440 showed the h1 without the lead and actions, which are the hero's CSS `.entrance` wrappers and depend on the animation's timing. **U2 (major, needs a disposition):** the form now paints without script but cannot be sent. U3–U5 (below) | Subagent report (session) | Fixes |
| 8 | gp-reviewer | **PASS WITH FINDINGS**, no blocker or major. In the built HTML every `opacity:0` element carries the mark and no other does (pilot 9/9, roles 23/23, index 23/23). `<noscript dangerouslySetInnerHTML>` is safe under React 19.2.8 / Next 16.3.1: never reconciled, no hydration mismatch, one copy in the built page, the same string `renderToStaticMarkup` gives. The layout gets the real string, not a client reference. No marked element's class sets a transform or filter. R1–R4 (below) | Subagent report (session) | Fixes |
| 9 | Coordinator | **Fixes.**<br>• **U1:** the hero's two `.entrance` wrappers take `data-entrance`, since an `!important` declaration beats an animation; a unit case holds it. Scriptless `/` at 1920 and 1440: both wrappers read opacity 1 at `domcontentloaded` and after 2.5 s, and the viewport shot shows the lead and both actions.<br>• **U2:** filed as BL-208, the form's own no-script line with its copy row. **U3, U5:** filed as BL-209. **U4:** scriptless `/product` and `/roles` at 1440 photographed; the harness comment now names what it does not read.<br>• **R1:** `NodeLock` and the reduced branch of `TextBlurIn` and `LineReveal` take the mark; the fixture renders all five words and counts 7 hidden elements, all marked. **R2:** wording in `no-script.ts` and here. **R3:** the harness's no-script pass also loads each route with scripting on and requires no style node (`ruleScripted: 0`). **R4:** row order.<br>• Checks: landing suite 276 of 276; DB-free `packages/testing` 209 of 209; `motion-audit: clean`; `typecheck` 10/10. The harness re-run gave 40 passes; «no-script» is ok on every route with `ruleScripted` 0; parity and interactions still fail, as on the baseline. | `scratchpad/dev091/harness2.txt`, `shots2.txt`, `nojs-home-{1920,1440}-viewport.png`, `nojs-{product,roles}-1440.png` | gp-ui-reviewer re-check, gp-qa |
| 10 | gp-ui-reviewer | **PASS** at `44f5bd62`. U1 is fixed and verified: both hero wrappers are marked, read opacity 1 at 1920 and 1440, and the viewport shots show the lead and both actions. U2–U5 are filed or evidenced; the scriptless `/roles` and `/product` at 1440 paint in reading order with nothing overlapping. With scripting off the fold no longer animates, which it accepts. U6 (nit, below) | Subagent report (session) | — |
| 11 | gp-qa | **At `44f5bd62`: AC-1 to AC-4 PASS; AC-5 NOT RUN** (no CI yet).<br>• Its own build and scriptless measurement: 0 hidden on every route at all six widths, already at `load`, against 89/302/157/56 without the rule; the form paints.<br>• Every marked element computes opacity 1, no transform, no filter; the built HTML's `opacity:0` elements are all marked (23/49/23/9).<br>• Scripted: 0 style nodes, no stylesheet naming the mark, and entrances below the fold still start hidden.<br>• Mutations M1–M7 are caught by the unit tests.<br>• Every stated fix is confirmed. Q1 (below) | Subagent report (session) | Fixes |
| 12 | Coordinator | **Q1:** `ScrollStackCard`'s content `motion.div` takes the mark; the fixture renders it and counts 8 hidden elements, all marked; with the mark removed the fixture fails (restored). **U6:** BL-209 and this record no longer say `/product` has hidden tabs: `PinnedTabs` is used only on `/kitchen-sink`. Landing suite 276 of 276; `typecheck` 10/10; `motion-audit: clean` | Session output | gp-qa re-check, CI |
| 13 | gp-qa | **Re-check at `a84e1924`: AC-1 to AC-4 PASS**, no new finding.<br>• Q1 confirmed: the mutant fails the fixture; rebuilt, `/kitchen-sink` without script now reads 0 hidden (6 before the fix, 27 without the rule). Its only unmarked `opacity:0` elements are `ScrollStack`'s three decorative veils, rightly unmarked.<br>• U6 confirmed.<br>• Rows 10–12 accurate. | Subagent report (session) | CI |
| 14 | Coordinator | **Preview, CI and merge.**<br>• The Vercel preview of `a84e1924` serves `/pilot` (200) with the `<noscript>` rule, and its 9 `opacity:0` elements are all marked; fetched through the Vercel connector, since the sandbox's egress refuses the host.<br>• CI green on `a84e1924` (run 36201813222: `verify`, `app-qa`). The `verify` log shows `tests/no-script-entrances.test.tsx` (4), `tests/landing-render.test.tsx` (80) and `src/component-contract.test.ts` (21) passing, with the landing suite at 276 of 276.<br>• #178 merged as `8f81d3c6` under the owner's standing order («мержи и давай дальше»). BL-116 closed → DEV-091. | [akisly/go-proceed#178](https://github.com/akisly/go-proceed/pull/178), `verify` job 108289881067 | Done |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| U1 | major | the hero's `.entrance` wrappers | The scriptless fold relied on a CSS animation's timing | Coordinator | Fixed: marked; opacity 1 at load; a unit case |
| U2 | major | `/pilot`'s form without script | Visible now but cannot be sent, and says nothing | — | Filed: BL-208 (P2) |
| U3 | minor | closed disclosures | The FAQ answers cannot open without script; the harness skips `[hidden]` | — | Filed: BL-209; the harness comment says so |
| U4 | minor | the harness reads opacity only | Clip, mask, `visibility` unseen | Coordinator | `/product`, `/roles` photographed; the limit named in the harness |
| U5 | optional | the home's canvas band without script | An empty band where the dome draws | — | Filed: BL-209 |
| R1 | minor | `NodeLock`, `TextBlurIn`, `LineReveal` | Also render `opacity:0` on the server, unmarked | Coordinator | Fixed: marked; the fixture covers them |
| R2 | nit | the wording | «and an offset»: the server renders opacity only | Coordinator | Fixed |
| R3 | nit | AC-2 | Not held by the harness | Coordinator | Fixed: `ruleScripted` |
| R4 | nit | the record | Rows out of order | Coordinator | Fixed |
| U6 | nit | BL-209, the record | Said `/product`'s `PinnedTabs` hide panels; no public route uses `PinnedTabs` | Coordinator | Fixed |
| Q1 | minor | `ScrollStackCard` | Also renders `opacity:0` on the server, unmarked (only `/kitchen-sink` uses it) | Coordinator | Fixed: marked; the fixture covers it |

Rework count and hypothesis changes: none.

## What is not true after this task

- A browser with scripting on, whose chunk never loads, still sees BL-116's page: BL-207.
- Without script, `/pilot`'s form paints but cannot be sent (BL-208). The FAQ's answers cannot open, and the home's canvas words leave an empty band (BL-209).
- The harness's no-script pass reads opacity on text-bearing elements in `main` at 1440; a clip, mask or `visibility` would not register (the four routes are photographed without script instead).
- `/product` has 10 entrances below the fold that read visible with scripting on. Why was not examined here. This task cannot have caused it: with scripting on the rule is inert text, and no stylesheet outside `<noscript>` names the mark, so the mark changes no scripted behaviour.
- The rule is shipped by `apps/landing` only. `apps/app` imports no entrance word today.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 the scriptless pages paint | Yes | `44f5bd62`, `a84e1924` | The harness's «no-script» pass and gp-qa's own measurement: 0 hidden on every route at six widths against 89/302/157/56 without the rule; `/pilot`'s form paints | PASS | Opacity only; `hidden` panels excluded (BL-209) |
| AC-2 scripted paint unchanged | Yes | `a84e1924` | `ruleScripted: 0` on every route; no stylesheet names the mark; entrances below the fold start hidden | PASS | Not diffed against a base build; rests on the rule being inert |
| AC-3 the chain in unit tests | Yes | `a84e1924` | `no-script-entrances.test.tsx` 4 of 4; mutants M1–M8 caught | PASS | A word added later is held only if the fixture adds it |
| AC-4 §5 gate and §6 | Yes | `a84e1924` | motion-audit clean; DB-free `packages/testing` 209/209; `typecheck` 10/10; `next build` exit 0; §6 rows 6, 9, 11 | PASS | §6 on fixtures and local builds, not on the live preview |
| AC-5 CI green | Yes | `a84e1924` | Run 36201813222 green; the new test in the `verify` log | PASS | — |

## Sources

- `apps/landing/node_modules/next/dist/docs/01-app/02-guides/migrating/from-create-react-app.md`, the root layout's `<head>` guidance (Next as installed).
- HTML's `<noscript>`: parsed as markup only when scripting is disabled, and as inert text otherwise. Observed with puppeteer's `setJavaScriptEnabled(false)` against the installed Chromium (row 2).

## Completion / handoff

- **Changed / inspected files:** see «Owning module».
- **Review independence:** every stage runs as an independent native subagent.
- **Verified scope:** rows 1–14.
- **Remaining risks / blocked requirements:** see «What is not true after this task».
- **Next bounded action and owner:** none here. BL-207, BL-208 and BL-209 are open.
- **Final state and reason:** done: every acceptance criterion PASS, merged in #178 (`8f81d3c6`).
