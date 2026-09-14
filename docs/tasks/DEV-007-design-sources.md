# DEV-007 — Design sources of truth and the plan's remaining tails

## Assignment

- **Objective and user-visible outcome:** one normative design source, `DESIGN.md` plus `docs/design/`, with nothing in the tree that a skill or a reader can mistake for another. Stale design memory files and duplicates leave the tree, each with its restore command. The reference folders say what is live and what is history. The prospecting work in `outputs/` stays, and is described and reviewed for personal data.
- **State:** reviewing
- **Coordinator:** primary Claude Code session, 2026-09-14.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** agent instructions (`docs/design/02-building-ui.md`), executed validator code, and documentation → coordinator → `gp-reviewer` → `gp-qa` (`agents/COORDINATION.md`), with `gp-researcher` and `gp-security` as the plan orders.
- **Triggered stages and why:**
  - `gp-researcher`: the plan requires it before `.impeccable/` is deleted — whether the installed Impeccable needs a sidecar regenerated from `DESIGN.md`.
  - `gp-security`: the plan requires a read-only personal-data review of `outputs/`, which the security trigger «retention and deletion of personal data» covers. It deletes nothing; its findings become backlog entries.
  - `gp-architect`, `gp-ui-reviewer`, `gp-mobile`: not triggered. No schema, contract, catalog, RLS or auth path, and no path under `apps/landing`, `apps/app/app`, `apps/app/src/components`, `apps/mobile/src`, `packages/ui`, `packages/tokens` or `technical/copy-catalog.csv` is touched.
- **Owning module and allowed edit paths:** the plan's PR-E targets (`.impeccable/`, `.interface-design/system.md`, `sources/`, `output/`, `design-qa.md`, `.gstack/security-reports/`, `design-references/README.md`, `design-references/evidence-atlas/README.md`, `docs/design/2026-08-19-design-system-rewrite-plan.md`, `outputs/README.md`); `docs/reviews/security/`; `.gitignore`; `docs/design/02-building-ui.md` and `docs/design/03-ui-references.md` (pointers to removed files); `scripts/validate-canonical-docs.mjs` (exemptions and comments naming moved or removed paths); `docs/BACKLOG.md`; `docs/STATUS.md`; this record; `docs/tasks/README.md`.
- **Read context:** the approved migration plan (PR-E, owner-approved 2026-09-13, outside the repository); root `AGENTS.md`; `START_HERE.md`; `agents/COORDINATION.md`; `docs/README.md` «Status meanings»; `docs/design/02-building-ui.md`; [DEV-006](DEV-006-freeze-todos.md).
- **Linked spec, ADR or earlier task:** [DEV-006](DEV-006-freeze-todos.md); DEV-001's owner decision to keep `outputs/`.
- **Baseline:** `d8a860a` (main, «Merge pull request #87»).
- **Dependencies / constraints / out of scope:**
  - `outputs/` is kept (owner, 2026-09-13); nothing in it is moved, redacted or deleted.
  - `.gitignore` keeps `.superpowers/` and `.gstack/`.
  - `DESIGN.md`'s own residuals (BL-060) and the visual-directions README (BL-060) are not fixed here.
  - Files under `packages/tokens` (including the generator of `01-tokens.md`) are not edited.
  - No test suite runs.
- **Required acceptance criteria:** see Acceptance evidence.
- **Skipped stages and rationale:** as «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-13 | PR-E scope as the approved plan states it; `outputs/` is kept | Owner, in conversation (plan; DEV-001) |
| 2026-09-14 | Start DEV-007 after #87 merged | Owner, in conversation |

## Plan

1. Inventory every PR-E target at the baseline: tracked files, bytes, last commit, and who reads each (docs, scripts, CI, skills). Check: `git ls-files`, `git grep`.
2. Research and review in parallel: `gp-researcher` on `.impeccable/`, `gp-security` on `outputs/`.
3. Move each live ruling of `.interface-design/system.md` to a live home (`02-building-ui.md` or a backlog entry), then remove the file; remove `sources/`; record restore commands.
4. After `gp-security` returns: remove `output/` (and ignore it) and `design-qa.md`; move the 2026-07-30 `/cso` report to `docs/reviews/security/`, and change the validator's exemptions without moving any cited validator line.
5. After `gp-researcher` returns: `.impeccable/` as it recommends.
6. Banners and READMEs: `design-references/README.md`, `evidence-atlas/README.md`, the rewrite plan to Historical with a backlog entry for the ADR, `outputs/README.md`, the STATUS «Outreach» row.
7. Checks, `gp-reviewer`, rework, `gp-qa`, the PR, CI.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoped (coordinator) | #87 merged as `d8a860a` (2026-09-14 11:32 UTC); branch `claude/design-sources` from `origin/main`. **Inventory at the baseline** (tracked files, bytes, last commit): `.impeccable/` 2, 31,890, `bbfc705`; `.interface-design/system.md` 1, 20,773, `db80308`; `sources/` 1, 12,412, `bbfc705`, byte-identical to `docs/discovery/research-ua-demand-2026-08-21.md` (`cmp`); `output/` 64 (62 PNG screenshots and one WebM recording from Playwright, one Impeccable brief; corrected in Progress row 5), 17,221,054, `bbfc705`, read by nothing; `design-qa.md` 1, 2,804, `8de7f8b`, absolute paths into `/tmp` and `~/.codex`; `.gstack/` 1 (the 2026-07-30 `/cso` JSON), 8,042, `4d511c3`, tracked although `.gitignore` ignores `.gstack/`; `design-references/` 31, 17,973,028; `outputs/` 250 in one session directory, 312,542,484, all added in `bbfc705`, a commit titled as a landing table fix. There is no top-level `evidence-atlas/`: the plan's banner target is `design-references/evidence-atlas/README.md`. The repository is private (`gh repo view`) | `git ls-files`; `wc -c`; `git log -1 -- <path>`; `cmp` | Research and review |
| 2 | scoped (coordinator) | **Deviation from the plan: `design-references/` is not all history.** `brand/*.svg` is the live source of every icon (`scripts/generate-brand-icons.mjs:2`, `:11`); `contest-2026-09/daylight/` is the prototype the landing reproduces (`apps/landing/app/layout.tsx:76`) and a motion token cites (`packages/tokens/src/tokens.json:842`); `evidence-atlas/assets/` is read by `apps/landing/qa/grounds.mjs:36`. The new README names each folder's standing instead of one «historical exploration» banner. **`.interface-design/system.md`:** already marked superseded on 2026-09-05; the vendored `interface-design` skill treats the file as decisions made (`.agents/skills/interface-design/SKILL.md:288`). Its live rulings were checked against the rules: the §6 traps and «assert the rendered result» are in `02-building-ui.md` §8; §5 «WorkRegister» is BL-054, which now carries the ruling; the Button 44px floor and base-layer density are enforced in `packages/ui`; the Tooltip ruling described a rail that no longer exists. Still to move: §8's «QA hooks are `data-*` attributes; an assertion names the contract», into `02-building-ui.md` §8 after `gp-researcher` has read that file. **Rewrite plan:** to Historical, since D1–D7 were never recorded in an ADR (§12 P0) and Daylight departed from them; BL-078 tracks the ADR | `git grep` per path; `02-building-ui.md` §8; BL-054 | Implement the independent parts |
| 3 | implementing (coordinator) | `gp-researcher` (`.impeccable/`) and `gp-security` (`outputs/`, plus the `/cso` report, `design-qa.md` and `output/`) launched in parallel. Applied the parts neither reads: `sources/` and `.interface-design/system.md` removed; `03-ui-references.md:5` points at `DESIGN.md` with a dated bracket (same line); the validator's comment names the removal (same line); the rewrite plan's Status is Historical, under a banner; `design-references/README.md` added; the evidence-atlas README carries a banner; BL-054, BL-060 and the new BL-078 updated. `output/`, `design-qa.md`, the `/cso` report and `.impeccable/` wait for the two stages | `git status`; validator | Wait for the stages |
| 4 | researching (`gp-researcher`, native) | **Delete both `.impeccable/` files; regenerate nothing.** The installed Impeccable is the vendored v4.0.3 (`.agents/skills/impeccable/SKILL.md:4`). Nothing requires `design.json`: its absence raises no boot or `doctor` finding (`scripts/lib/staleness.mjs:248`), and it is optional extension data a model writes by hand (`reference/document.md:253`, `:383`). Kept, it is harmful to the one use `02-building-ui.md:105-107` allows, a critique pass: critique's detector adds the sidecar's 26 Evidence Atlas colours and their ramps to its allowlist (`detector/design-system.mjs:271-280`, `:432`), hiding hard-coded colours of the superseded palette. The staleness notice compares file times, not content. The critique snapshot is a report except that `polish` reads the latest one for the same file (`reference/polish.md:29-35`). Upstream `main` is v4.3.1; its docs agree on these points, its scripts were not read | Researcher report; Sources | Remove `.impeccable/`; move the `data-*` ruling |
| 5 | reviewing (`gp-security`, native), personal-data review of `outputs/` | **Personal data of natural persons is tracked, against the project's own rule; no credentials; nothing deploys or uploads it.** Majors: S1-01, buyer-side contact persons in the five raw ProZorro search dumps; S1-02, sole traders under personal names with ten-digit identifiers. Mediums: S1-03, A1-N01 outreach routes called corporate while most are free-mail or mobile; S1-04, private customers named in copied tender titles; S1-05, doc 40 §B.5 (live through `.gitignore`) keeps lead data out of git history, with retention and erasure a tracked copy cannot honour; S1-09, nothing stops a repeat. Lows: S1-06, absolute home-directory paths in 34 scripts and `design-qa.md`; S1-07, the `/cso` report is safe to move and must stay exempt from the rename guard; S1-08, `output/` safe to remove. **Coordinator's re-run at `d8a860a`, with its own method:** 6,371 `contactPoint` objects in the five `search_hits` files, each with a name and an email, 2,444 distinct name–email pairs, 4,760 on a fifteen-domain free-mail list (the review: 4,699 on its list); 9,788 ten-digit `edrpou` values in 52 files (as reviewed); 101 «Замовник: surname initial.» matches in 22 files (the review: 99); 7 A1-N01 recipient addresses, 6 free-mail (as reviewed); 34 files with `/Users/` paths (as reviewed); `output/` is 62 PNG, 1 WebM and 1 Markdown file, so Progress row 1's «63 screenshots» was wrong. **Decisions:** S1-01, S1-02 and S1-05 become BL-079 (P1, the owner's decision on how `outputs/` is kept); S1-03 and S1-04 BL-080 (P2); S1-09 BL-081 (P2). S1-06 is accepted for `outputs/` as a dated record, the rename guard's existing reasoning, and is moot for `design-qa.md`, which leaves the tree. S1-07 and S1-08 are carried out here. The majors are deferred to the owner, not fixed, so there is no fix for `gp-security` to re-check | Security review report; the coordinator's count script | Carry out S1-07 and S1-08; write BL-079 to BL-081, `outputs/README.md`, STATUS |
| 6 | implementing (coordinator) | S1-07 and S1-08 carried out: `output/` removed and ignored (`/output/`); `design-qa.md` removed; the `/cso` report moved to `docs/reviews/security/2026-07-30-cso.json`. The validator's two `.gstack` exemptions went, replaced in place so no line moved (2,167 lines before and after; its lines cited elsewhere, `:169-179` and `:172`, stay put): the exported predicates now exempt the moved report from both the rename and the retired-workflow guards through `docs/reviews/`, and exempt neither the old path nor `.gstack/x.md`. BL-079 to BL-081 written. `outputs/README.md` sorts all 250 session files into five groups; the first grouping left 59 files unplaced, and the script's completeness assert stopped it before it wrote anything. STATUS: the «Agent workflow» row re-observed at `d8a860a` (`git log --merges --oneline -10` ends at #79), the «Outreach» row's last sentence and «Next action» 1–2 rewritten in place (52 lines). Checks: every remaining mention of a removed path is in a record (the frozen files, `docs/superpowers/`, `docs/legacy/`, `migration/`, DEV-005), in a dated note this task wrote, or in the Historical rewrite plan; the relative links of the five edited or new documents resolve; `scripts/validate_package.py` requires only the four concept PNGs, which stay; `git diff --name-status d8a860a -- outputs` shows only the README added | Acceptance evidence | Commit; `gp-reviewer` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## Owner questions

1. **`design-references/contest-2026-09/`.** The plan asks whether it is still current. The landing reproduces its Daylight prototype and a motion token cites it, so this task keeps it as a reference for the shipped landing. Is that the standing you want, or should it become history once the landing is the reference?

2. **How `outputs/` is kept** (BL-079). It holds personal data of natural persons that the project's own rule keeps out of git history. The options the review lists: keep it with a recorded purpose, lawful basis and retention date; move it to private storage behind a pointer README; or redact the personal fields in place. Moving or redacting leaves the data in commit `bbfc705` unless history is rewritten, which is a further decision (force-push, every clone re-made).

## Removed paths and how to restore them

| Path | Why | Restore |
|---|---|---|
| `sources/research_ua_ptv_foreman_techsupervision_demand_2026-08-21.md` | Byte-identical duplicate of `docs/discovery/research-ua-demand-2026-08-21.md` | `git checkout d8a860a -- sources/` |
| `.interface-design/system.md` | Superseded 2026-09-05; a skill reads it as decisions made; its live rulings moved (Progress row 2) | `git checkout d8a860a -- .interface-design/system.md` |
| `.impeccable/design.json`, `.impeccable/critique/2026-08-26T08-27-14Z__apps-landing-components-visuals-readiness-map-tsx.md` | Evidence Atlas sidecar and a pre-Daylight critique; optional, and harmful to critique's detector (Progress row 4) | `git checkout d8a860a -- .impeccable/` |
| `output/` (64 files) | Playwright screenshots, one recording and an Impeccable brief that nothing reads (Progress row 1; review S1-08) | `git checkout d8a860a -- output/`; the new ignore rule then hides it, so re-tracking needs `git add -f` |
| `design-qa.md` | The 2026-08-21 mark QA, which points at files in `/tmp` and `~/.codex` that no one else has (review S1-06); an older design QA snapshot stays at `docs/legacy/design-qa.md` | `git checkout d8a860a -- design-qa.md` |

**Moved:** `.gstack/security-reports/2026-07-30-120350.json` → `docs/reviews/security/2026-07-30-cso.json` (review S1-07). To undo: `git mv docs/reviews/security/2026-07-30-cso.json .gstack/security-reports/2026-07-30-120350.json` and restore the validator's two exemptions from `d8a860a`.

## What is not true after this task

- **`outputs/` still holds personal data, in the tree and in history.** Nothing was redacted, moved or deleted; BL-079 and BL-080 are the owner's decisions. Every session that reads the directory, this task's security review included, sends what it reads to a model provider.
- **Nothing stops a repeat** (BL-081). `.gitignore` does not ignore `outputs/`.
- **`interface-design` can still recreate `.interface-design/system.md`** if a session accepts its save step. One sentence in `02-building-ui.md` §3.2 declines it; no check enforces that.
- **D1–D7 have no ADR** (BL-078). `02-building-ui.md` and the generated `01-tokens.md` still call the rewrite plan's §3 «the rulings», now inside a Historical document; `packages/tokens/scripts/generate-docs.mjs` was not edited.
- **The rewrite plan's banner moved its lines down by two.** No live file cites it by line; frozen `TODOS.md` does (`:225`, `:344`) and cannot be corrected.
- **Mentions of removed paths remain in records** and in the Historical rewrite plan; they name files that are gone, and the table above restores them.
- **`brand/`'s README row** says icons are rasterised from its files; `scripts/generate-brand-icons.mjs` names eight of the nine by file name, not `goproceed-mark.svg`.
- **The vendored Impeccable is 4.0.3; upstream is 4.3.1.** Not upgraded; the researcher did not read the upstream scripts.
- **Not re-observed:** every STATUS row except «Agent workflow»; `DESIGN.md`'s residuals and the visual-directions README (BL-060).
- **No test suite, landing QA harness or typecheck ran.** No executed code changed apart from the validator's exemption lists and comments; `apps/landing/qa/grounds.mjs`'s inputs are untouched.
- **S1-06 is accepted** for the scripts in `outputs/` as a dated record.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. Every removed path had no live reader, and each has a restore command | yes | working tree over `d8a860a` | `git grep -F` per path: remaining mentions are records, dated notes of this task, or the Historical rewrite plan (Progress row 6); `scripts/validate_package.py` requires only the four concept PNGs; «Removed paths» table | PASS | — |
| 2. The live rulings of `.interface-design/system.md` have live homes | yes | working tree | §8 `data-*` ruling → `02-building-ui.md` §8; §5 WorkRegister → BL-054; §6 traps and «assert the rendered result» already in `02-building-ui.md` §8; the 44px floor and base-layer density enforced in `packages/ui`; the Tooltip ruling obsolete (Progress row 2) | PASS | Coordinator's reading; `gp-reviewer` samples it |
| 3. `.impeccable/` handled as `gp-researcher` recommends, with sources | yes | working tree | Progress row 4; Sources | PASS | Upstream scripts not read |
| 4. `design-references/README.md` gives each folder the standing its readers show; the evidence-atlas README carries a banner | yes | working tree | Readers: `scripts/generate-brand-icons.mjs`, `apps/landing/app/layout.tsx:76`, `packages/tokens/src/tokens.json:842`, `apps/landing/qa/grounds.mjs:36`; relative links resolve (script) | PASS | Owner question 1 |
| 5. The rewrite plan is Historical with a banner; BL-078 tracks the ADR; BL-060's item is closed | yes | working tree | Status line `Historical`; validator status enum green; BL-060 and BL-078 | PASS | — |
| 6. The `/cso` report is moved and stays exempt; the `.gstack` exemptions are gone; no validator line moved | yes | working tree | Exported predicates: `docs/reviews/security/2026-07-30-cso.json` role-exempt and retired-exempt `true`; the old path and `.gstack/x.md` `false`. `wc -l`: 2,167 before and after | PASS | — |
| 7. `output/` is ignored | yes | working tree | `git check-ignore -v output/playwright/x.png` → `.gitignore:114:/output/` | PASS | — |
| 8. `outputs/` is kept, described and reviewed; the review's findings are backlog entries | yes | working tree | `git diff --name-status d8a860a -- outputs`: only `A outputs/README.md`; 251 tracked files; README groups sum to 250; `gp-security` S1-01…S1-09 → BL-079 to BL-081 or carried out (Progress rows 5–6) | PASS | Owner question 2 |
| 9. Files cited by line keep their cited lines | yes | working tree | `wc -l` against `d8a860a`: STATUS 52, `03-ui-references.md` 162, validator 2,167 unchanged; `02-building-ui.md` 403 → 407 with lines 1–230 identical except `:107`, and nothing cites it after `:230` | PASS | — |
| 10. `pnpm validate:canonical-docs` green | yes | working tree | `node scripts/validate-canonical-docs.mjs` → `canonical documentation: OK` | PASS | `node` run directly |
| 11. `pnpm validate:agents` green | yes | working tree | `python3 scripts/sync-agents.py --check` → 16 profiles verified | PASS | — |
| 12. Independent `gp-reviewer` with no unresolved finding | yes | — | — | NOT RUN | Next |
| 13. Independent `gp-qa` on the final revision | yes | — | — | NOT RUN | After review |
| 14. CI `verify` green | yes | — | — | NOT RUN | After the PR |

## Sources

- Impeccable, vendored v4.0.3: `.agents/skills/impeccable/` in this repository (`SKILL.md:4`; `skills-lock.json` locks it from `pbakaus/impeccable`). Read 2026-09-14.
- [impeccable.style/docs/document](https://impeccable.style/docs/document/), [/critique](https://impeccable.style/docs/critique/), [/doctor](https://impeccable.style/docs/doctor/): no publication date shown; accessed 2026-09-14. They describe upstream `main`, v4.3.1 ([SKILL.md](https://raw.githubusercontent.com/pbakaus/impeccable/main/.agents/skills/impeccable/SKILL.md)). The installed version and the docs disagree on the version only; the points this task relies on match. Upgrading the vendored skill is not in scope; nothing in the product depends on it.

## Completion / handoff

- **Changed files:** see «Owning module and allowed edit paths» and «Removed paths».
- **Review independence:** `gp-researcher` and `gp-security` ran as native `gp-*` subagents; `gp-reviewer` and `gp-qa` to follow.
- **Verified scope:** criteria 1–11 by the coordinator.
- **Remaining risks / blocked requirements:** «What is not true after this task»; owner questions 1 and 2.
- **Next bounded action and owner:** `gp-reviewer` (coordinator).
- **Final state and reason:** reviewing.
