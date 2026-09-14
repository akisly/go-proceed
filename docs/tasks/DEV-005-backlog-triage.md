# DEV-005 — Backlog triage: `TODOS.md` and the HANDOFF files into `docs/BACKLOG.md`

## Assignment

- **Objective and user-visible outcome:** one live list of open and deferred work, [docs/BACKLOG.md](../BACKLOG.md), built by checking every open item of `TODOS.md` (3,723 lines, 80 headings) and the three `HANDOFF*.md` files against the tree. A reader no longer has to read about 5,600 lines of dated records to learn what is open.
  - HANDOFF facts reach `docs/STATUS.md` only after a check against git.
  - Lessons the handoffs taught that no live rule carries yet go to `docs/ai-workflow.md` «Habits».
  - Live instructions stop sending new follow-ups to `TODOS.md`.
- **State:** reviewing
- **Coordinator:** primary Claude Code session, 2026-09-14.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types. Three read-only `Explore` subagents checked item verdicts against the tree; they are research helpers, not review stages.
- **Selected route and why:** agent instructions, executed validator code and documentation → coordinator → `gp-reviewer` → `gp-qa` (`agents/COORDINATION.md`). Root `AGENTS.md`, `START_HERE.md`, `agents/COORDINATION.md`, `docs/design/02-building-ui.md` and the runbook's process rules are agent instructions; `scripts/validate-canonical-docs.mjs` is executed code.
- **Triggered stages and why:** none beyond reviewer and QA. No schema, contract, catalog, RLS, auth, CI, UI or mobile path is touched. The backlog describes such work and changes none of it.
- **Owning module and allowed edit paths:**
  - new: `docs/BACKLOG.md`, this record;
  - `docs/STATUS.md` (the «Agent workflow» row, backlog ids in place of `TODOS.md:<n>`, «Open issues», «Next action»);
  - `docs/README.md` (the observation-layers row); `docs/tasks/README.md`;
  - `docs/ai-workflow.md` («Habits this codebase rewards»);
  - `AGENTS.md` (the current-docs rule, step 3); `START_HERE.md` («Current development»); `agents/COORDINATION.md` («Findings»);
  - `docs/delivery/pilot-execution-runbook.md` (§3.1's Senior Project Manager row, §4 rule 5 and §7.1: the three live statements naming `TODOS.md` as where work is filed);
  - `docs/design/02-building-ui.md` (one dated correction);
  - `scripts/validate-canonical-docs.mjs` (`WORKFLOW_DOCS`).
- **Read context:** the approved migration plan (PR-D1, owner-approved 2026-09-13, outside the repository); root `AGENTS.md`; `START_HERE.md`; `agents/COORDINATION.md`; [DEV-004](DEV-004-status-layer.md); `TODOS.md`, `HANDOFF.md`, `HANDOFF-2026-08-24.md` and `HANDOFF-2026-08-27.md`, read in full.
- **Linked spec, ADR or earlier task:** [DEV-004](DEV-004-status-layer.md), whose observation-layers table named the backlog for this task.
- **Baseline:** `5480d2e` (main, «Merge pull request #84»). This is also the freeze point F of the plan: the triage reads the four files as they are at F.

  | File | Last changed | sha256 at F |
  |---|---|---|
  | `TODOS.md` | `bd08da9` (2026-09-09) | `6d3cd3ca217fb89dcce7a578a4cc19dec37d67852d4dd649e58eaffd2228f757` |
  | `HANDOFF.md` | `db80308` (2026-09-06) | `c090243acd874a76080ebe05422a65ecbcfebf4235b3e745332d917f65c2bdb7` |
  | `HANDOFF-2026-08-24.md` | `5c4c82c` (2026-08-24) | `70a22426988248e6a0e0f43a56357ff7594854bc0d774af0eccb2d4486b50c9a` |
  | `HANDOFF-2026-08-27.md` | `6a3de28` (2026-08-28) | `527ea840d381e0748b79bbba9320f8c702004ef6c558eef76fd0b6de0f1588c7` |

- **Dependencies / constraints / out of scope:**
  - **The four files are not edited**, not even with a banner. Freezing them is DEV-006.
  - **Live `TODOS.md:<n>` citations are not rewritten** in code, ADRs, the runbook or other documents; DEV-006 does that from the «Citation map» below. The exception is `docs/STATUS.md`, which only the coordinator writes and which used those citations as pointers to open work.
  - **No validator guard for backlog ids, fields or legacy cites**; DEV-006 adds the BL-id guard. This task checks them with a one-off script.
  - **No item is fixed.** Entries describe work; they do not do it.
  - `docs/superpowers/` is untouched. Design sources, including `.interface-design/system.md`'s pointers into `TODOS.md`, are DEV-007.
- **Required acceptance criteria:** see Acceptance evidence.
- **Skipped stages and rationale:** `gp-architect`, `gp-security`, `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered. No third-party fact decides anything here; entries whose future work needs one say so under «Depends on».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-13 | PR-D1 scope as the approved plan states it: triage `TODOS.md` and the HANDOFF files into `docs/BACKLOG.md` with the BL entry fields; HANDOFF facts to STATUS after a git check; live habits to `docs/ai-workflow.md`; `gp-reviewer` samples the classifications against the code | Owner, in conversation (plan) |
| 2026-09-14 | Start DEV-005 | Owner, in conversation |

## Plan

1. Fix F and inventory the 80 headings of `TODOS.md` with line ranges (Inventory A) and the sections of the three handoffs (Inventory B). Check: heading count from `awk`, row count of Inventory A.
2. Classify each item: `closed`, `open-defect`, `open-residual`, `record` or `superseded`. An item marked CLOSED stays closed. Anything else is open unless a commit or a test proves closure; closure candidates without such evidence go to the owner as a list.
3. Check every open item against the tree at F: three read-only subagents by area, then the coordinator re-runs every «fixed» verdict and samples the «open» ones.
4. Write `docs/BACKLOG.md`: the entry fields, an index generated from the entries, and a script that checks ids, fields and legacy cites.
5. Move HANDOFF facts into STATUS after checking them against git; add the lessons no live rule carries to `docs/ai-workflow.md`.
6. Find every live statement, by meaning, of where follow-ups and upgrades are filed, and point it at the backlog.
7. Add `docs/BACKLOG.md` to the validator's `WORKFLOW_DOCS` link check.
8. Checks (Acceptance evidence), then `gp-reviewer`, rework, `gp-qa`, the PR and CI.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoped (coordinator) | Measured at F: `TODOS.md` has 3,723 lines and 80 headings outside code fences: 61 `##`, 16 `###`, 3 `####`. The plan's «68 `###`» does not reproduce. No local or remote branch changes `TODOS.md` or a HANDOFF file ahead of `origin/main`. The live `TODOS.md:<n>` citations point at lines that have since moved; each was resolved against the file at the commit that introduced it, or by meaning where even that did not match (Citation map) | `awk '/^```/{f=!f} !f && /^#{2,4} /'`; `git log origin/main..<ref> -- TODOS.md HANDOFF*.md` for every ref; `git log -S` per citation | Classify |
| 2 | scoped (coordinator) | **The unit of triage is the item, not the heading.** Fourteen headings are containers holding several items (bullets, numbered residuals, bold sub-entries); Inventory A names each container's items in its destination cell. **Live instructions move to the backlog in this task, not in DEV-006.** A list triaged at F, with rules still sending follow-ups to `TODOS.md`, would diverge at the first follow-up. The runbook's own rule already said «in `TODOS.md` until a backlog replaces it». DEV-006 keeps the freeze banner and the citation rewrite | Plan PR-D1 and PR-D2; `AGENTS.md:156`; `agents/COORDINATION.md:149`; runbook §7.1 | Check items against the tree |
| 3 | implementing (coordinator, 3 `Explore` subagents) | Three read-only passes over the tree at F: 33 database and API items (28 open, 4 fixed, 1 partly), 34 tooling and UI items (26 open, 4 fixed, 3 partly, 1 cannot tell), and the 59 final-review minors (51 open, of which 4 partly; 8 fixed). The coordinator re-ran the evidence for all 16 «fixed» verdicts (the file line, and `git merge-base --is-ancestor` for the commit), for the three «partly» verdicts the backlog relies on (A03, B09, B16), and for nine «open» verdicts as a sample (M21, M27, M28, M38, M43, M53, B30, B54, A29). All held. The coordinator also checked: the two CLOSED IN CODE entries (the external review's click gate and the inverted `progress.adjust` case) are closed with their tests running in CI; `docs/delivery/version-0.1.md:834-837` supersedes the handoff's «M6 cannot close without the headline measures», so BL-012 was reframed; `docs/design/02-building-ui.md:289-295` was stale, because the kitchen-sink scan landed in `13157b9` | Subagent reports; the commands under Acceptance evidence 2 | Write the backlog |
| 4 | implementing (coordinator) | `docs/BACKLOG.md`: 76 entries. States: 58 `open`, 16 `deferred (owner)`, 2 `closed` (kept because live code cites them). Priorities: P0 1, P1 4, P2 23, P3 48. The index is generated from the entries; 84 legacy cites. STATUS: the «Agent workflow» row re-observed, `TODOS.md:<n>` pointers replaced by backlog ids, «Open issues» and «Next action» updated. `docs/ai-workflow.md`: nine lessons from `HANDOFF.md` §0, §0a and §4 and `HANDOFF-2026-08-27.md` §4 that no live rule carried. Live rules pointed at the backlog: `AGENTS.md` step 3, `START_HERE.md`, `agents/COORDINATION.md` «Findings», runbook §4 rule 5 and §7.1, the observation-layers row. `02-building-ui.md` gained a dated correction. The validator link-checks `docs/BACKLOG.md` | Acceptance evidence | Run the checks, then `gp-reviewer` |
| 5 | implementing (coordinator) | Criteria 1–9 pass. The checks corrected the work twice. STATUS first had #84 merging on 2026-09-13; it merged on 2026-09-14. The search by meaning found runbook §3.1's Senior Project Manager row and §1.6's account of it, beyond the three statements first searched, plus five Citation map rows the first pass missed (ADR-007 `:111`; runbook `:491`, `:500`, `:501`, `:1415`). **Line counts:** every edited file that other files cite by line keeps its count (`AGENTS.md`, `START_HERE.md`, `agents/COORDINATION.md`, `docs/README.md`, the runbook). `02-building-ui.md` grew only after its last cited line (`:216`). The validator grew by two lines inside `WORKFLOW_DOCS`, after `:563`; ADR-011's `:1431-1437` already pointed at the brand-guard self-tests at F | `wc -l` against `git show 5480d2e:<file>`; `git grep` for `<file>:<n>` citations | Commit; `gp-reviewer` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## Owner questions

1. **BL-011, the retired demo's Vercel project.** No repository record says whether it was deleted or paused. This is the only closure candidate with no evidence either way. Confirm, and the entry closes as owner-reported.
2. **The standing UI instructions of `HANDOFF-2026-08-24.md` §3.**
   - Items 1 and 2 (shadcn/ui one-to-one; TanStack Table for tables) are recorded in `packages/ui/src/components/index.ts`'s header.
   - Item 5 (plane for structure only) is in `docs/design/03-ui-references.md`.
   - Items 3 («a form validates with the same zod schema the route parses») and 4 («latest versions, no pins») are in no live rule, only in the handoff and in `TODOS.md`. Today `sharp` is pinned at `0.34.5` and vitest at `3.2.4` (BL-055, BL-061).

   Should items 3 and 4 be written into `docs/design/02-building-ui.md` or root `AGENTS.md`, or stay history when DEV-006 freezes the handoff?
3. **Priorities DEV-005 assigned** where the source had none, each marked «ranked by DEV-005» in its entry: BL-003 (P1), BL-004, BL-009, BL-010, BL-023, BL-024 (P2), and the P3s. Confirm or re-rank.

## What is not true after this task

- `TODOS.md` and the HANDOFF files carry no banner, and nothing stops a new entry in them. DEV-006 freezes them.
- Live code, ADR-007, the runbook, `docs/architecture/tenancy-and-security.md`, `infra/README-staging.md` and about sixty source comments still cite `TODOS.md`, by line or by entry name. The line citations point at moved lines; DEV-006 re-points them from the Citation map. A prose pointer still resolves through the entry whose «Legacy cite» quotes its source.
- The validator checks the backlog's links only, not its ids, fields or legacy cites; this task checked those with a one-off script (criterion 3).
- «Open» verdicts are subagent readings spot-checked on nine items. Every «fixed» verdict was re-run by the coordinator.
- Nothing hosted was observed: not the Vercel projects, the staging §6 runs or the Brevo account.
- BL-064 (the unreproduced vertical-m1 red): CI history was not searched for a recurrence.
- Priorities on handoff-derived entries are DEV-005's ranking, not the owner's (Owner question 3).
- Runbook §1.6, measured on 2026-09-03, still counts `TODOS.md` entries; it is a dated measurement and was not re-measured.
- No closed item was re-opened. A closed entry's own stated evidence was taken as recorded, except where Inventory A names a check.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. Every heading of `TODOS.md` at F (80) has an Inventory A row with its line range, class and destination, and every container names its items | yes | working tree over `5480d2e` | A one-off Python check (the coordinator's scratchpad) recomputes the heading ranges from `git show 5480d2e:TODOS.md`: `C1 headings 80 inventory rows 80 ranges equal True`; every backlog id the record names exists, and every entry is named by the record | PASS | — |
| 2. Every open item has a backlog entry with State, Legacy cite, Why, Evidence, Depends on and Deadline; every `deferred (owner)` entry has Resume; no item is closed without a commit or a test; closure candidates without evidence are listed for the owner | yes | working tree | Same check: `C2 entries 76 field problems 0` (it also rejects a State outside the vocabulary). The 16 «fixed» verdicts were re-run (Progress row 3). One closure candidate without evidence: BL-011 (Owner question 1) | PASS | «Open» verdicts are subagent readings, nine spot-checked |
| 3. Backlog ids are unique and sequential, and every legacy cite is found by `grep -F` on one line of its file at F | yes | working tree | Same check against `git show 5480d2e:<file>`: `C3 unique True sequential True cites 84 missing 0`; `index rows 76 match entries True` | PASS | — |
| 4. Every live `TODOS.md:<n>` citation outside dated records maps to a backlog id or a stated reason | yes | `5480d2e` and the working tree | `` git grep -nE 'TODOS\.md(`?\]\([^)]*\))?`?:[0-9]+' 5480d2e -- . ':!TODOS.md' ':!HANDOFF*.md' ':!docs/superpowers' ':!docs/tasks/DEV-00[1-4]-*' `` lists 26 locations: STATUS's four, replaced here, and 22 others, each in a Citation map row | PASS | Unnumbered prose mentions are not mapped (see the note under the map) |
| 5. Every HANDOFF section has an Inventory B disposition; facts moved to STATUS were re-checked against git; lessons not already in `docs/ai-workflow.md` were added | yes | working tree | Inventory B covers every `##` and `###` section of the three files. The «Agent workflow» row: `git log -1 --format='%h %ad %s' 5480d2e` (#84, 2026-09-14) and `014b852` (#83, 2026-09-13). Before adding lessons, `grep -i` over `docs/ai-workflow.md`, `agents/COMMON.md` and `agents/roles/` found only the empty-table check in `agents/roles/gp-reviewer.md:41` | PASS | The empty-table lesson overlaps that reviewer check and is kept as a habit |
| 6. No live rule sends follow-ups or upgrades to `TODOS.md` | yes | working tree | `git grep -n -i TODOS` over root and app `AGENTS.md`, `CLAUDE.md`, `START_HERE.md`, `agents/`, `docs/design/02-building-ui.md`, `docs/README.md`, `docs/specs/README.md`, plus a destination-shaped grep of the runbook. What remains is the records list (`agents/COMMON.md:126`), the observation-layers row's provenance, and dated brackets (`02-building-ui.md`, runbook §1.6, §3.1, §4, §7.1) | PASS | — |
| 7. `TODOS.md` and the three HANDOFF files are byte-identical to F | yes | working tree | `git diff --stat 5480d2e -- TODOS.md 'HANDOFF*.md'` prints nothing; `shasum -a 256` equals the Baseline table for all four | PASS | `negative` |
| 8. `pnpm validate:canonical-docs` green, and a broken link planted in `docs/BACKLOG.md` fails it | yes | working tree | `node scripts/validate-canonical-docs.mjs` → `canonical documentation: OK`. With `See [nowhere](no-such-file.md).` appended to the backlog → `1 problem(s)`, `docs/BACKLOG.md: broken relative link -> no-such-file.md`; the file was restored and `cmp` matched | PASS | Coordinator's run; `gp-qa` re-runs it |
| 9. `pnpm validate:agents` green | yes | working tree | `pnpm validate:agents` → `Verified 16 host profiles from 8 canonical roles (gp: 8).` | PASS | — |
| 10. Independent `gp-reviewer` with no unresolved finding, including a sample of classifications checked against the code | yes | — | — | NOT RUN | Not started |
| 11. Independent `gp-qa` on the final revision | yes | — | — | NOT RUN | Not started |
| 12. CI `verify` green | yes | — | — | NOT RUN | Not started |

## Sources

No third-party documentation decides anything in this task.

## Completion / handoff

- **Changed files:** see «Owning module and allowed edit paths».
- **Review independence:** to be recorded.
- **Verified scope:** to be recorded.
- **Remaining risks / blocked requirements:** «What is not true after this task»; the owner questions.
- **Next bounded action and owner:** DEV-006, the freeze and the citation rewrite, after this task merges.
- **Final state and reason:** implementing.

## Inventory A — `TODOS.md` at `5480d2e`

Classes: `closed` (closed, with the evidence named or recorded in the entry); `open-defect`; `open-residual` (an owed follow-up, decision or gap that is not a defect); `record` (context, kept as history, nothing owed); `superseded` (overtaken by a later entry, decision or document); `container` (the items are classed in the destination cell).

| Lines | Heading | Class | Destination |
|---|---|---|---|
| 8–59 | What the M1–M6 build and the work-type carrier did to this file (2026-08-08) | record | The «two counts still say ten» note → BL-074; the rest is superseded by the later entries it annotates |
| 60–185 | Surfaced while verifying the 2026-08-04 package review | container | `service_role` TRUNCATE: closed (`0058`). OpenAPI README sentence: open-defect → BL-027. `0026` attribution: open-residual → BL-071. Tenancy «before domain expansion» list: closed. `baseline-verification.md`: open-residual → BL-072. Service grants: closed (accepted and bounded), residual → BL-019. `outbox-drain` outside the workspace: open-residual → BL-068 |
| 186–202 | P3 — `app.accept_invitation` ignores the invited email address | open-defect | BL-013 |
| 203–216 | P3 — a suspended or ended member can never be re-admitted | open-defect | BL-014 |
| 217–237 | P3 — responsibility assignments can never be ended | open-defect | BL-015 |
| 238–332 | P1 (CLOSED 2026-08-18) — the act's signatory slots … | closed; open-residual | The two routes: closed. «Still open and named» → BL-016 |
| 333–342 | Closed by v0.1-M2-A (2026-07-31) | closed | — |
| 343–357 | P2 — a zero unit price used to break publish (fixed, kept as context) | closed | — |
| 358–432 | P2 (CLOSED 2026-08-19, same day) — the Supabase API keys were the legacy JWT form | closed | — |
| 433–560 | P2 (item 1 CLOSED 2026-08-24) — three major-version migrations | container | zod: closed; its `datetime()` basic-offset note: record. vitest: open-residual → BL-061. TypeScript: open-residual → BL-062 |
| 561–606 | P0 (CLOSED 2026-08-19) — the field client is built and NOBODY CAN OPEN IT | closed; open-residual | Origin: closed. §6.1–6.8 → BL-010; §6.9 → BL-001; SMTP → the next row |
| 607–664 | P1 (CLOSED 2026-08-20) — OTP email for outsiders | closed (owner waiver of the non-team test); open-residual | «Spawned, still open» (sender domain, free-tier cap) → BL-004 |
| 665–752 | P1 — Three pilot surfaces (ADR-009): plans B, C, D | container | Plan B: closed (2026-08-20). Plan C parity gate → BL-001. Plan D: D0–D3 closed (#45, #46, #48, #54); «D1–D4 remain» superseded; D4 → BL-045 |
| 753–834 | Surfaced by Plan D slice D0 (the dashboard shell), 2026-08-22 | container | Container role → BL-047. Georgia headings: closed (fixed 2026-08-22). `next=/dash` → BL-049. Reopen race → BL-050. `src/ui/button.tsx`: closed (`24fd9f3`, directory gone). Kitchen-sink entries: closed (`13157b9`); `DialogClose` → BL-051 |
| 835–868 | P2 — `evidence-storage.ts` puts raw storage keys into error messages | open-defect | BL-033 |
| 869–899 | P3 — the kitchen-sink obligation is enforced by nothing | closed | `13157b9` («renders every component module in the kitchen sink»; `Form*` retired). `02-building-ui.md` corrected by this task |
| 900–931 | P2 — a project access grant can be issued … and never taken back | open-defect | BL-021 |
| 932–957 | P3 — about twenty-five routes put English into `fieldErrors[].message` | open-residual | BL-025 |
| 958–987 | P3 — the browser pass cannot assert «no signed URL in the logs» | open-residual | BL-035 |
| 988–1017 | P3 — `technical/schema.sql` reads as current truth | open-residual | BL-070 |
| 1018–1038 | P3 — `generate-palette.mjs` still writes into the deleted `apps/demo` tree | closed | `3e5bfaa` (`outDir` is `packages/testing/qa`) |
| 1039–1093 | P2 — a page render costs ~3 auth round trips and 2 self-fetch hops | open-residual | BL-065 |
| 1094–1131 | Record (2026-08-20) — `apps/demo` and its CI job are retired | record; open-residual | The owner's Vercel project → BL-011 |
| 1132–1178 | P2 — `scripts/validate_package.py` is orphaned | open-residual | BL-063 |
| 1179–1192 | P3 — `turbo-ignore` is deprecated | open-residual | BL-066 |
| 1193–1270 | P3 — CI's `apt-get` step hung for 17 minutes once | open-residual; superseded | Lines 1193–1201 → BL-067. Lines 1203–1269 are a stray copy of the origin P0's body (heading-less, «This is the largest open item»): superseded by the closed P0 at 561 |
| 1271–1360 | P1 (CLOSED 2026-08-17) — seven residuals from the field-client final review | closed | — |
| 1361–1460 | P1 (CLOSED 2026-08-10) — valuation funding was first-come … | closed | Cited by live code → BL-075 |
| 1461–1546 | P1 (CLOSED 2026-08-10) — M4 prints | closed; record | The eight blank Додаток В fields are the owner's decision of 2026-08-10 («fill what the product knows»): record, no entry |
| 1547–1592 | P1 (CLOSED 2026-08-10) — apps/demo could be published with an unreplaced placeholder | closed | — |
| 1593–1613 | P3 — the two retention figures v0.1-M2-A had to choose are defaults | open-residual | BL-006 |
| 1614–1632 | P2 — purge claims are not fenced | open-defect | BL-031 |
| 1633–1659 | CLOSED — nothing proves inspection actually ran | closed | `0034`, `0035` |
| 1660–1682 | CLOSED — capture_events cannot tell the server's assertion from a member's | closed | `0034`, `0035` |
| 1683–1705 | P2 — a deactivated member cannot abandon their own upload through the route | open-defect | BL-032 |
| 1706–1720 | P2 — the evidence purge worker still runs nowhere | open-residual | BL-030 |
| 1721–1767 | P3 (CLOSED 2026-08-18) — the Supabase CLI was unpinned | closed | — |
| 1768–1787 | CLOSED 2026-08-06 — doc 07's Expo SDK baseline | closed | — |
| 1788–1824 | P2 — the pilot-device inventory does not exist | open-residual | BL-002 |
| 1825–1959 | P1 (CLOSED 2026-08-18) — the product is renamed to GoProceed | closed | Its link-host residual is in the row at 2010 |
| 1960–2009 | DOMAINS AND ENV VARS CLOSED 2026-08-18 | closed | — |
| 2010–2086 | CLOSED 2026-08-18 — the rename is finished, and the gate is now total | closed; open-residual | The link host and well-known files → BL-004 |
| 2087–2105 | Opened by the v0.1 M1–M6 build (2026-08-06 → 2026-08-08) | record | Section introduction; its entries follow |
| 2106–2172 | P0 (CLOSED 2026-08-10) — the pool stranded … | closed | Cited by live code → BL-076 |
| 2173–2247 | P0 (CLOSED IN CODE) — a positive `progress.adjust` … carves the pool | closed; open-residual | Closed: the route gate (`adjustments/route.ts:191`) and the inverted case in `progress-adjust.int.test.ts` run in CI. The belt-and-braces bound → BL-018 |
| 2248–2272 | P1 — the external review shell auto-exchanges | closed; open-residual | Closed: the click gate (`external/review/route.ts:379`, `isTrusted` at `:391`). The rate-limit gap → BL-023 |
| 2273–2295 | P1 (CLOSED 2026-08-17) — six project-plane capabilities were in no preset | closed | — |
| 2296–2341 | CLOSED 2026-08-18 — the two couplings that mapping left open | closed; open-residual | The accepted act coupling's successor → BL-029 |
| 2342–2398 | CLOSED 2026-08-17 — all six mapped | closed | — |
| 2399–2434 | P0 (CLOSED 2026-08-10) — every act would freeze and then be unrenderable | closed | — |
| 2435–2504 | P1 (CLOSED 2026-08-10) — Додаток Н printed a provenance line that was false | closed | — |
| 2505–2538 | P2 (OPEN, UNREPRODUCED) — vertical-m1 steps 7 and 8 went red once | open-defect | BL-064 |
| 2539–2556 | P2 — a hand-typed zero-priced line and an imported one store different provenance | open-defect | BL-022 |
| 2557–2656 | BLOCKER — CLOSED 2026-08-10 | closed; superseded | The owed `version-0.1.md` sentence about the refusal is superseded: acts render |
| 2657–2693 | P3 — `app.work_type_key_is_bindable` arm 2 is not scoped to a draft | open-defect | BL-017 |
| 2694–2709 | P3 — INV-090 is allocated and two catalogs do not point at it | open-residual | BL-028 |
| 2710–2791 | CLOSED 2026-08-10/11 — ADR-007 is implemented | closed; open-residual | The origin: closed at 561. The reference image → BL-007 |
| 2792–2811 | P3 — `?assignee=me` has no status filter | open-defect | BL-026 |
| 2812–2843 | P3 — INV-081's banner reads as a failure while the upload is in flight | open-residual | BL-008 |
| 2844–2857 | P3 — the install hint does not recognise an iPad in desktop-class mode | open-defect | BL-042 |
| 2858–2887 | P3 — the evidence screen renders full-size originals | open-residual | BL-038 |
| 2888–2922 | P2 — the evidence screen formats `serverReceivedAt` in a default zone | open-residual | BL-034 |
| 2923–2951 | P3 — the evidence screen labels an occurrence group with its bare UUID | open-residual | BL-037 |
| 2952–2982 | P3 — occurrence groups come back in UUID order | open-residual | BL-037 |
| 2983–3018 | P3 — the evidence route discards `failedKeys` | open-residual | BL-036 |
| 3019–3075 | P3 — `readiness.ts`'s `codeFor` cites a bare `state-catalog.csv` | open-residual | BL-073 |
| 3076–3221 | Surfaced by the Plan D UI-foundation correction, 2026-08-23 | container | Versions: closed (2026-08-24). TanStack v9 opt-in features: record. `Checkbox` → BL-048. Two form answers: closed (`index.ts` «RESOLVED 2026-08-28», «RETIRED 2026-08-30», `13157b9`). `class-variance-authority`: closed. Second Button: closed (`24fd9f3`). `data-[…]` height: fixed; the unguarded rule → BL-052. Kitchen-sink tables: closed. `blocked-reasons-list.tsx` not a table: record |
| 3222–3280 | P2 (CLOSED 2026-08-31) — the landing merge imports `motion/react` | closed | The CI half: `motion-audit.test.ts` «finds nothing» runs under `ci.yml`'s `pnpm turbo run test` |
| 3281–3312 | Residuals left by the project-sourced-requirements slice (2026-08-27) | container | 1 → BL-046. 2: record (the duplication rule). 3: superseded (STATUS carries the migration head). 4: closed (`0060`). 5 → BL-069. 6: closed. 7: closed. 8: closed (`e54a151`). 9: closed |
| 3313–3398 | P2 — retention durations are owed (0081 shipped inert) | container | 1 and 2 → BL-005. 3, 4 and 5 → BL-039. 6 → BL-009 |
| 3399–3410 | P3 — workspace closure procedure | open-residual | BL-040 |
| 3411–3432 | Parked findings from the erasure slice, not fixed | open-residual | BL-020 |
| 3433–3540 | P1 (CLOSED 2026-09-04) — eighteen `apps/app` cases fail in CI | closed | #69 (`9b9bf65`) |
| 3541–3584 | P2 (CLOSED 2026-09-08) — the assignment card renders a normative string without its tag | closed; open-residual | The remaining webhook blockers → BL-024 |
| 3585–3615 | P3 (CLOSED 2026-09-04) — the Telegram sender of `origin_not_distinguished` has no test pin | closed | — |
| 3616–3631 | Opened by the Daylight landing (2026-09-05) | container | `/dash/**` visual pass: closed. `apps/mobile` pass → BL-041. Legacy stylesheet: closed. Decision D4 items: closed. Per-instance rate limit and eviction order → BL-057. Literal `1240px`: closed. `FeatureCell` icon box, channel badge, raw mailto fields, caption `span`, stale test title → BL-058. Motion docstrings: closed |
| 3632–3638 | From the daylight visual pass (2026-09-05) | container | Rail → BL-053. Register → BL-054. Bare «м» → BL-043. `Press` chunk → BL-044 |
| 3639–3712 | Final review minors (2026-09-05) | container | 54 lines. Foundation → BL-055. `packages/ui` → BL-056. `apps/landing` → BL-059. Documents and configuration → BL-060. The seven lines found fixed are named in BL-059 and BL-060 |
| 3713–3720 | From the re-review of the fix wave (2026-09-05) | container | Five lines. Beam probe: closed (`f254049`). No-JS submit, sr-only caption, `li` role → BL-059. Splash icon → BL-055 |
| 3721–3723 | From the card-citation slice (2026-09-08) | closed | `0084` |

## Inventory B — the HANDOFF files at `5480d2e`

| File and section | Disposition |
|---|---|
| `HANDOFF.md` §0a.16 (apps/app on Daylight) | record. The `apps/mobile` pass → BL-041; the three visual-pass findings → BL-053, BL-054, BL-043. The `apps/app/.env.local` harness fact is already in `apps/app/AGENTS.md:25` |
| §0a.15 (Daylight landing) | record. Its P3s → BL-057, BL-058; its minors → BL-055, BL-056, BL-059, BL-060 |
| §0a.14 (the origin exists) | record; closed. Auth Site URL set by the owner on 2026-08-20 (`TODOS.md` SMTP entry). §6.1–6.8 → BL-010; the phones → BL-001; the domain → BL-004 |
| §0a.13 (libraries current) | record. vitest, TypeScript → BL-061, BL-062; `turbo-ignore` → BL-066; the `apt-get` hang → BL-067 |
| §0a.12 (the act was unreachable) | closed. Residuals → BL-016 |
| §0a.11 (the CLI pin) | closed. The CLI-default lesson → `docs/ai-workflow.md` |
| §0a.10 (the P0 prepared) | superseded by §0a.14 |
| §0a.9 (`/context` deleted) | closed |
| §0a.8 (the capability mapping) | closed. The narrower-guard lesson → `docs/ai-workflow.md`; `statutory_acts.view` → BL-029 |
| §0a.7 (least privilege) | closed (accepted and bounded). The empty-table lesson → `docs/ai-workflow.md`; the successor → BL-019 |
| §0a.6 (TRUNCATE) | closed (`0058`). The default-ACL lesson → `docs/ai-workflow.md`. Its «still open» paragraph is superseded by §0a.7 |
| §0a.5 (the rename finished) | closed |
| §0a.4 (the runbook's domains) | closed. The narrower-guard lesson (as §0a.8) |
| §0a.3 (roles renamed) | closed. The probe lesson → `docs/ai-workflow.md` |
| §0a.2 (six capabilities) | closed |
| §0a.1 (seven residuals) | closed. The parked-hypothesis lesson → `docs/ai-workflow.md`; its `/context` stub is superseded by §0a.9 |
| §0 (current state, 2026-08-17) | superseded by §0a.14. The CLI-default lesson → `docs/ai-workflow.md`; the reference image → BL-007 |
| §1–§3 (M4 prints) | record; every item closed in `TODOS.md` |
| §4 (state, measured) | record (counts dated 2026-08-10, not restated). The do-not-probe lesson → `docs/ai-workflow.md` |
| §5 (do this next) | Items 1 and 2: closed. Item 3, the eight blank fields: record of the owner's decision. Item 4 → BL-012 |
| §6 (what a customer can touch) | superseded by STATUS |
| §7 (habits) | already in `docs/ai-workflow.md` (DEV-003) |
| §8 (market evidence) | → BL-003 |
| `HANDOFF-2026-08-24.md` §1, §4 | record (#45 to #49 merged) |
| §2 (read these first) | superseded by `START_HERE.md` and STATUS |
| §3 (the owner's standing instructions) | Items 1, 2 and 5 are in live files; items 3 and 4 are not (Owner question 2) |
| §5.1 (the requirement library) | closed (#51, ADR-010) |
| §5.2 (Plan D slice D3) | closed (#54, merged as `9e5ea3b`). The members' identity → BL-045 |
| §6 (owner-only) | The parity gate → BL-001; validation → BL-003. The CI billing pause ended on 2026-09-01: record |
| §7 (how the session worked) | already in `docs/ai-workflow.md` (DEV-003) |
| §8 | → BL-003 |
| `HANDOFF-2026-08-27.md` §1, §3 | record (#51 merged as `6d065fc`) |
| §2 | superseded |
| §4 (three defects that never reached a user) | record. The policy-question and forced-concurrency lessons → `docs/ai-workflow.md` |
| §5 (do this next) | 1: closed (`aa4cf19`). 2: closed (`0060`). 3: closed (`2e1504e`). 4: closed (`e54a151`; the catalog correction closed on 2026-08-28). 5: closed (residual 7). 6: closed (#54). 7: the CI pause ended (record). 8 → BL-046 |
| §6 (owner-only) | The parity gate → BL-001; validation and one real document → BL-003. The local repair: closed; the checkout's `.git` is a directory and `git worktree list` works, observed on 2026-09-14 |
| §7 (failure modes) | already in `docs/ai-workflow.md` (DEV-003) |
| §8 | → BL-003 |

## Citation map for DEV-006

Live citations of a `TODOS.md` line outside dated records, resolved by meaning against the file at the commit that added them. The dated records (`docs/tasks/DEV-003-*`, `DEV-004-*`) keep theirs.

| Citing file and line at F | Cites | Entry meant | Backlog |
|---|---|---|---|
| `apps/app/src/lib/admission.ts:502` | `TODOS.md:238` | Valuation funding (at `a306ec2`, line 238) | BL-075 |
| `apps/app/src/lib/valuation-writer.ts:310` | `TODOS.md:238` | Valuation funding | BL-075 |
| `apps/app/tests/admission-valuation.int.test.ts:511` | `TODOS.md:238` | Valuation funding | BL-075 |
| `apps/app/src/lib/valuation-writer.ts:161` | `TODOS.md:585` | The pool stranded (at `0a7c407`) | BL-076 |
| `apps/app/tests/progress-adjust.int.test.ts:728` | `TODOS.md:585` | The pool stranded | BL-076 |
| `packages/domain/src/valuation.ts:234` | `TODOS.md:585` | The pool stranded | BL-076 |
| `apps/app/tests/evidence-read.int.test.ts:224` | `TODOS.md:783` | No logs to assert against (at `8143149`) | BL-035 |
| `docs/decisions/ADR-007-pilot-field-client.md:111` | `TODOS.md:334-342` | The pilot-device inventory | BL-002 |
| `docs/decisions/ADR-007-pilot-field-client.md:112` | `TODOS.md:342` | Two physical devices, unprocured | BL-002 |
| `docs/decisions/ADR-007-pilot-field-client.md:114` | `TODOS.md:357-361` | UDID registration for an internal build | none: ADR-007 removed the distribution chain; DEV-006 words it as history |
| `docs/decisions/ADR-007-pilot-field-client.md:511` | `TODOS.md:334-361` | The physical device inventory (the ADR's own sentence; the line numbers match nothing at `c2ca50d`) | BL-002 |
| `docs/decisions/ADR-007-pilot-field-client.md:526` | `TODOS.md:363-418` | The rename's «split item 2», the link host | BL-004 |
| `docs/delivery/pilot-execution-runbook.md:279`, `:304` | `TODOS.md:741-745` | «D1–D4 remain» | BL-045 |
| `docs/delivery/pilot-execution-runbook.md:491`, `:1415` | `TODOS.md:712-716` | Plan C «EXPLICITLY NOT CLOSED»: the parity gate | BL-001 |
| `docs/delivery/pilot-execution-runbook.md:500` | `TODOS.md:900-930` | A grant only a superuser can revoke | BL-021 |
| `docs/delivery/pilot-execution-runbook.md:501` | `TODOS.md:746-750` | «Meanwhile, the pilot runs on the PWA»: no task removes the PWA field pages first | BL-001 |
| `docs/delivery/pilot-execution-runbook.md:1353` | `TODOS.md:3089-3092` | The slice report the harness refused to write | none: record |
| `docs/delivery/pilot-execution-runbook.md:1568` | `TODOS.md:1788-1796` | The pilot-device inventory | BL-002 |
| `docs/delivery/pilot-execution-runbook.md:1681` | `TODOS.md:2248-2257` | The auto-exchange and the rate-limit gap | BL-023 |
| `docs/delivery/pilot-execution-runbook.md:1687` | `TODOS.md:900-930` | A grant only a superuser can revoke | BL-021 |

`docs/STATUS.md`'s citations (`:665`, `:741`, `:3313`, `:3433`) were replaced in this task. Unnumbered prose mentions of `TODOS.md` in source comments and documents are listed by `git grep -n 'TODOS' -- apps packages docs infra scripts`; each resolves through the backlog entry whose legacy cite quotes its source.
