# DEV-002 — Workflow switch: rules for the gp-* roles

## Assignment

- **Objective and user-visible outcome.** The repository's development process becomes the `gp-*` roles, replacing the retired skill-driven workflow.
  - Root `AGENTS.md` requires independent review and QA on every behavior change and adds the triggered stages. `CLAUDE.md` imports it and keeps the test and UI rules.
  - `agents/COORDINATION.md`, `agents/PLAYBOOKS.md` and `agents/TASK_TEMPLATE.md` define the routes, task states and records.
  - Project settings disable the retired workflow plugin and cap subagent nesting.
  - The validator refuses any live instruction that prescribes the retired workflow.
- **State:** verifying. Required criteria 8 (fresh-session discovery) and 9 (CI) are NOT RUN.
- **Coordinator:** primary Claude Code session, 2026-09-13.
- **Execution mode:** independent subagents for the required stages — see Progress for the host used.
- **Selected route and why:** agent instructions or profiles → coordinator → `gp-reviewer` → `gp-qa` (`agents/COORDINATION.md`). This change *is* the rules deciding when agents run, so it is a behavior change.
- **Triggered stages:**
  - `gp-security`: the change touches `.claude/settings.json` (host configuration) and CI-read validation, but no secret, permission or trust boundary. It is not triggered by the list in root `AGENTS.md`; recorded as skipped below.
  - Architect, UI reviewer, mobile, researcher: not triggered. `docs/design/02-building-ui.md` changes only its process rows, not UI code.
- **Owning module and allowed edit paths:**
  - `AGENTS.md`, `START_HERE.md`, `CLAUDE.md`
  - `.claude/settings.json`
  - `agents/**`, `.claude/agents/**`, `.codex/agents/**`
  - `apps/app/AGENTS.md`, `apps/app/CLAUDE.md`
  - `docs/ai-workflow.md`, `docs/tasks/**`
  - `docs/design/02-building-ui.md` (§2 step 6, §3.2 process rows, `Last reviewed`)
  - `scripts/validate-canonical-docs.mjs` (retired-workflow guard, workflow link check, self-tests)
  - `docs/delivery/pilot-execution-runbook.md` (one dated banner only; added in rework for R1-02)
- **Read context.**
  - The approved migration plan.
  - DEV-001.
  - The deploy-doc reference: `AGENTS.md`, `START_HERE.md`, `agents/COORDINATION.md`, `agents/PLAYBOOKS.md`, `agents/TASK_TEMPLATE.md`.
  - The unmerged routing branch `claude/claude-md-agent-routing` (`fc45f97`), whose `docs/ai-workflow.md` and "what the tests pass means" section are absorbed here.
  - `HANDOFF*.md` §7.
  - The installed Next.js agent-file generator (`apps/app/node_modules/next/dist/server/lib/generate-agent-files.js`).
- **Linked:**
  - [DEV-001](DEV-001-agent-infrastructure.md).
  - Follow-up DEV-003 (runbook §3–§4, §6.6, §7 normative rewrite; removes the validator's temporary runbook exemption).
- **Baseline:** `85bdcb9` (main, "Merge pull request #79").
- **Out of scope:** runbook rewrite (DEV-003); status layer, ADR lifecycle and index, source register (PR-C); `TODOS.md`/HANDOFF triage and freeze (PR-D1/D2); design source-of-truth cleanup (PR-E). The rule that upgrade deadlines go into `TODOS.md` stays until the backlog replaces it.
- **Required acceptance criteria:** see Acceptance evidence.
- **Skipped stages and rationale:**
  - `gp-security`: no trigger from root `AGENTS.md` applies. The settings change a plugin toggle and add one `env` entry, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`. That entry is a host-tool setting that narrows what subagents can do. It is not an application environment variable (`.env*`, `NEXT_PUBLIC_*`, hosted secrets) or a secret. R1-09 reworded the trigger to say so. No permission, secret or CI permission is altered.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-13 | Start B1 only after #79 merges; #79 merged | Owner, in conversation |
| 2026-09-13 | The retired workflow plugin is disabled for this project only; the gate pack is removed from the rules, not blocked | Owner, in conversation (plan) |
| 2026-09-13 | An RLS or grant defect: QA reports, implementer fixes; QA stays read-only | Owner, in conversation (plan) |

## Plan

1. Branch from `85bdcb9`.
2. Write root `AGENTS.md`, `START_HERE.md` and the rewritten `CLAUDE.md`. The five UI rules and the current-docs rule stay verbatim in substance. The QA-RLS rule takes its new form.
3. Write `agents/COORDINATION.md`, `PLAYBOOKS.md` and `TASK_TEMPLATE.md`, adapted to GoProceed's path triggers.
4. Write `docs/ai-workflow.md`: the cases behind the rules, the history of the retired workflow, and the habits from HANDOFF §7.
5. Write `.claude/settings.json`: plugin disabled, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`.
6. Write `apps/app/AGENTS.md` and `CLAUDE.md`. The Next.js block is byte-identical to the generator's, so `next dev` leaves them alone.
7. Turn "Use proactively" on for reviewer, security, qa and ui-reviewer. Drop the "if they exist" conditionals. Regenerate the profiles.
8. Replace the normative skill rows in `docs/design/02-building-ui.md`.
9. Add a validator guard with self-tests, and a link check over the workflow documents.
10. Run `gp-reviewer` → rework → `gp-qa`. Open the PR.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoped (coordinator) | Normative references to the retired workflow exist in exactly three live files: `CLAUDE.md`, `docs/design/02-building-ui.md`, runbook. The runbook is left for DEV-003 behind a temporary, named exemption | `git grep` over tracked files excluding records | Implement |
| 2 | implementing (coordinator) | Plan steps 1–9 done; staged tree over `85bdcb9` | See Acceptance evidence 1–5 | Review |
| 3 | reviewing (`gp-reviewer`, independent subagent via Markdown fallback), round 1 | Native `gp-*` agent types are not discoverable in this session (`Agent type 'gp-reviewer' not found`: the session started before the profiles existed). The stage was run by an independent general-purpose subagent told to read `agents/COMMON.md` + `agents/roles/gp-reviewer.md` and act strictly as that role (read-only; Read only). This is the fallback `agents/README.md` documents. Result: nine findings, R1-01 to R1-09; one major, one medium | `dev-002.diff` over `85bdcb9` | Rework |
| 4 | rework (coordinator), after review round 1 | All nine resolved as stated fixes; see Findings. R1-03 moved sections between files but changed no rule text beyond R1-01 and R1-09 | See Findings | `gp-qa` |
| 5 | verifying (`gp-qa`, independent subagent via Markdown fallback), QA round 1 | **Needs fixes.**
  - **Passed:** A (validator), B (profiles), C (scratch-clone positive control: 10 failures on base `CLAUDE.md`, 17 with base `02-building-ui.md`), D (links, with a positive control), F (nothing lost), G (settings, runbook banner only, Next block `cmp`), and all R1 stated fixes in place.
  - **Failed:** E3 (major) and E1 (low); see Q1-01 and Q1-02.
  - **Not run:** H, which needs a fresh session | QA report; scratch clone built from `git diff --cached 85bdcb9` applied to `85bdcb9` | Rework |
| 6 | rework (coordinator), rework round 1 (after QA FAIL) | Q1-01 and Q1-02 fixed as stated fixes. Before rewriting, the coordinator re-measured Q1-01 against the files | See Findings | `gp-qa` round 2 |
| 7 | verifying (`gp-qa`, Markdown fallback), QA round 2 | **Needs fixes.**
  - **Passed:** A, B, D, E1, E2. Q1-02 in place. Q1-01 in place, and nothing changed beyond the stated fixes.
  - **Failed:** E3, see Q2-01: the "only guard callers skip" sentence is still false.
  - **Not run:** H | QA round 2 report; `qa-dev002-r2/suite-matrix.txt` | Rework |
| 8 | rework (coordinator), rework round 2 | Q2-01 fixed as a stated fix. This time every suite was measured before any word changed: a per-file scan of skip condition, connection target and truncate calls over all `apps/app/tests/*.int.test.ts` | See Findings | `gp-qa` round 3 |
| 9 | verifying (`gp-qa`, Markdown fallback), QA round 3, tree `a86b2cc` | **Verified for the scoped criteria.**
  - **Passed:** A, B, E3, and scope X (only the stated fixes changed since round 2). Q2-01 is in place.
  - **Low, non-blocking:** Q3-01.
  - **Not run:** H.
  - **Re-measured independently:** 9 of 55 suites skip (5 guard, 2 inline with three variables, 2 inline with two); 46 run (11 hard-code 54322, 33 use the fixtures fallback, 2 use Storage only); 39 of the 46 truncate for real | QA round 3 report; `qa-dev002-r3/` scans | Apply Q3-01 |
| 10 | rework (coordinator), stated fix after a passing QA | Q3-01 applied as a one-sentence stated fix in three files, and the profiles were regenerated. This is not a rework round: no QA FAIL preceded it. `gp-qa` re-verifies only A, B and the changed sentence | See Findings | `gp-qa` narrow re-verification |
| 11 | verifying (`gp-qa`, Markdown fallback), narrow re-verification on `11054ea` | **Needs fixes (low).**
  - **Passed:** A, B, X, S1, S2. The Q3-01 fix is in place.
  - **Failed:** S3, see Q3b-01.
  - **Not run:** H | Narrow QA report; `qa-dev002-r3b/` | Rework |
| 12 | rework (coordinator), stated fix | Q3-01 and Q3b-01 came from the same error: attempts to enumerate which suites reach Storage. The fix removes the enumeration rather than refining it, so the sentence now names the stack (Postgres 54322 and, depending on the suite, Storage 54321) and makes no per-suite claim. The safety statement is unchanged | See Findings | `gp-qa` narrow re-verification |
| 13 | verifying (`gp-qa`, Markdown fallback), narrow re-verification on `ec3f767` | **Verified for the scoped criteria**, no new finding.
  - **Passed:** A, B, S1–S4, X.
  - S4 re-read the whole "What the tests pass means" section of `AGENTS.md` against the code, sentence by sentence.
  - **Not run:** H | Narrow QA report; `qa-dev002-r3c/` | Commit; open PR; CI; fresh-session check |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | major | `CLAUDE.md` test section and `agents/COMMON.md`: "most of `packages/testing/`" skip without credentials | Expected: true test semantics. Actual: `packages/testing/src/pg.ts` falls back to `127.0.0.1:54322`, and `rls.test.ts`, `m1-rls-baseline.test.ts`, `m1-rls-workspace.test.ts` and `m1-schema.test.ts` call `resetDb()`, which runs `supabase db reset`. `pnpm turbo run test` with the stack up wipes the local DB | coordinator | Test section rewritten (now in `AGENTS.md`): only `apps/app` int suites skip, and `packages/testing` resets the stack and needs owner confirmation. Same correction in `agents/COMMON.md`, `agents/roles/gp-qa.md` and `agents/PLAYBOOKS.md`. Evidence: `grep -rln 'resetDb()' packages/testing/src` |
| R1-02 | medium | `docs/delivery/pilot-execution-runbook.md` §3.2, §3.4, §4.0 (exempt from the guard) still let QA edit RLS, grants and migrations, and cite `CLAUDE.md` by line | Expected: no live contradiction left undisclosed. Actual: contradiction with root `AGENTS.md`; line citations now point at different content | coordinator | Dated banner after the runbook's metadata: root `AGENTS.md` wins, the QA–RLS rule stated, `CLAUDE.md:<line>` citations refer to `85bdcb9`, DEV-003 rewrites. Disclosed below |
| R1-03 | low | Host-neutral rules (commands, test semantics, UI rules, current-docs rule) lived only in `CLAUDE.md` | Expected: every host gets them. Actual: a primary Codex session reaches them only indirectly | coordinator | Moved into root `AGENTS.md`. `CLAUDE.md` now holds only Claude Code specifics under its imports |
| R1-04 | low | `agents/COMMON.md` local AGENTS.md list omitted `apps/app` | Expected: roles pointed at `apps/app/AGENTS.md`. Actual: not listed | coordinator | Added `apps/app`; profiles regenerated |
| R1-05 | low | `docs/specs/` named as the home for specs but does not exist | Expected: accurate wording. Actual: implied existence | coordinator | `agents/COORDINATION.md`: "the first such spec creates the directory". DEV-002 "What is not true" corrected |
| R1-06 | low | `docs/design/02-building-ui.md` §2 step 6 omitted `gp-reviewer` | Expected: code review on UI slices. Actual: checklist named only UI reviewer and QA | coordinator | Step 6 now reads "gp-reviewer + gp-ui-reviewer … then gp-qa" |
| R1-07 | low | Guard exemptions: `docs/tasks/` blanket covered the live index; the old CLAUDE.md line "Use Superpowers for:" was not matched; self-tests synthetic only | Expected: records exempt, live files scanned, the real block caught | coordinator | `docs/tasks/` narrowed to `DEV-NNN-*.md`. Added the `use superpowers` form. Self-test fixture is the pre-2026-09-13 `CLAUDE.md` block (expects 4). `.agents/` exemption removed, so the vendored skills are scanned as live files. The validator's own regex, run over the 314 tracked text files in `.agents/`, `discovery/` and `design-references/`, finds 0 matches. A looser `grep` without word boundaries had first suggested a match in `ui-ux-pro-max`'s WPF catalog; that was a false positive of the grep, not of the guard. No exemption is added for `discovery/` or `design-references/` |
| R1-08 | low | "When workflows conflict, the approved design and implementation plan take precedence" had no home | Expected: carried forward. Actual: lost | coordinator | `agents/COORDINATION.md` "Approved design and plan" paragraph |
| R1-09 | low | `gp-security` triggers disagreed: COORDINATION added it for every migration; routing row said "workflow change"; `env` in settings literally matched "environment variables" | Expected: one trigger set. Actual: three versions | coordinator | Trigger table split (migrations → architect; RLS/grants/definer/roles/data-access-surface → architect + security). Routing row says "Telegram channel workflow" and "+ gp-security when its triggers match". Trigger wording is "application environment variables (`.env*`, `NEXT_PUBLIC_*`, hosted secrets)" in `AGENTS.md`, COORDINATION and the registry. Skip rationale addresses `env` |
| Q1-01 | major | R1-01's rewording claimed that `apps/app/tests/*.int.test.ts` skip without credentials. It appeared in `AGENTS.md`, `agents/COMMON.md`, `agents/PLAYBOOKS.md` and `apps/app/AGENTS.md` ("Most") | Expected: true semantics. Actual: only the suites calling `hasIsolatedDatabaseCredentials()` skip. Re-measured by the coordinator: 5 of 55 call it (`m3-refusal`, `telegram-processing`, `telegram-evidence`, `upload-intents-create`, `upload-intents-finalize`). The rest reach `127.0.0.1:54322` (13 hard-coded; the others through `ADMIN_URL`'s `LOCAL_ADMIN_URL` fallback in `fixtures.ts`), and 44 test or helper files contain `truncate`. So `pnpm --filter @goproceed/app test` with the stack up erases local data | coordinator | All four places say only guard-calling suites skip, that the rest connect and mostly truncate, and that the owner-confirmation sentence covers `pnpm --filter @goproceed/app test` too. The wording follows the no-counts habit. `gp-qa.md` aligned. Profiles regenerated |
| Q2-01 | medium | The Q1-01 fix said only suites calling `hasIsolatedDatabaseCredentials()` skip, cited "the Telegram suites" as examples, and said the rest connect to `127.0.0.1:54322`. It appears in `AGENTS.md`, `agents/COMMON.md`, `agents/PLAYBOOKS.md`, `agents/roles/gp-qa.md` and `apps/app/AGENTS.md`. The Q1-01 row's "5 of 55" counted guard callers only | Expected: the skip set stated truly. Actual, re-measured by the coordinator per file:
  - **9 of 55 suites skip.** 5 use the guard; 4 use an inline check (`project-communications`, `telegram-delivery`, `telegram-bindings`, `telegram-ingress`).
  - **`telegram-bindings` and `telegram-ingress`** check only `APP_DB_URL` and `SERVICE_DB_URL`.
  - **`telegram-schema`** does not skip.
  - **The evidence-storage suites** use the Storage API on `127.0.0.1:54321`.
  - The error pointed the safe way: fewer suites were said to skip than actually do | coordinator | All five places now say the suites that *check database credentials* skip, whether through the guard or an inline `APP_DB_URL`/`SERVICE_DB_URL` check, and that the rest use the local stack (Postgres 54322, Storage 54321) and mostly truncate. No list of Telegram examples, no counts, and an instruction to read the run's output. Profiles regenerated. Out of scope and unchanged: the comment in `.github/workflows/ci.yml` that credits the guard with "seven suites" |
| Q3-01 | low | `AGENTS.md`, `agents/COMMON.md`, `apps/app/AGENTS.md`: Storage API on 54321 attributed to "the evidence-storage suites"; `AGENTS.md` said they "also" use it | Expected: the Storage reach stated truly. Actual: at least five other non-skipping suites (`concurrency`, `evidence-purge`, `upload-intents-get`, `vertical-m2a`, `finalize-vanishing-bytes`) write or delete real objects through `src/lib/evidence-storage`, and the two `evidence-storage*` suites use Storage only. The error pointed the safe way, since every non-skipping suite is already said to erase local data | coordinator | All three now say "the suites that store evidence objects". `AGENTS.md` adds "some of them touch nothing else" instead of "also". Profiles regenerated |
| Q3b-01 | low | The Q3-01 fix in `AGENTS.md`, `agents/COMMON.md` and `apps/app/AGENTS.md` said Storage is used by "the suites that store evidence objects" | Expected: Storage reach stated truly. Actual: `m2-materialisation` and `requirement-occurrences` store no object but expect 201 from the upload-intents POST route, whose `createSignedUpload` → `createSignedUploadUrl` is a real Storage API call in the installed `@supabase/storage-js` 2.112.3. Safe direction again | coordinator | The per-suite attribution was removed: "the local Supabase stack … and, depending on the suite, the Storage API on `127.0.0.1:54321`". `AGENTS.md` drops "some of them touch nothing else". Profiles regenerated |
| Q1-02 | low | The `gp-security` trigger row in `agents/COORDINATION.md` lacked retention, signed URLs, bot tokens and identity erasure, which `AGENTS.md` and the registry list | Expected: the same subject set. Actual: four subjects missing | coordinator | Row now lists "evidence storage, signed URLs and uploads", "bot tokens and identity erasure" and "retention and deletion of personal data" |

Rework count and hypothesis changes:
- **Review round 1.** Nine findings, fixed as stated fixes. R1-03 moved text between files. `gp-reviewer` did not re-run.
- **Rework round 1.** QA round 1 FAILed on Q1-01 and Q1-02. Q1-01 is a defect *introduced* by the R1-01 fix: it generalised a claim to a whole directory from one file (`fixtures.ts`), without checking which suites import the guard. Changed hypothesis: every claim about test behaviour is measured per suite before it is written. Both fixes are stated fixes, so `gp-qa` round 2 re-verifies A, B, D and E.
- **Rework round 2.** QA round 2 FAILed on Q2-01. The Q1-01 fix used a real measurement of the wrong thing: it counted guard callers, not skip conditions. The hypothesis now has two parts: measure the *behaviour* (how each suite skips, what it connects to), not a proxy symbol; and read the actual run output rather than trust a doc. The fix is a stated fix; `gp-qa` round 3 re-verifies A, B and E3.
- **Counts.** Two of the three rework rounds allowed before escalation are used.

## What is not true after this task

- The runbook (`docs/delivery/pilot-execution-runbook.md`) still describes the retired slice loop until DEV-003.
- There is no `docs/STATUS.md`, `docs/BACKLOG.md`, ADR index or source register yet. Upgrade deadlines still go to `TODOS.md`.
- `docs/specs/` does not exist yet. It is named as the home of new design specs, and the first spec creates it.
- The runbook's §3.2, §3.4 and §4.0 still say QA may edit RLS, grants and their migration, and its `CLAUDE.md:<line>` citations point at the pre-2026-09-13 file. A dated banner at the top says root `AGENTS.md` wins. The sections themselves are rewritten in DEV-003.
- Running `pnpm turbo run test` or the `apps/app` and `packages/testing` suites against a live local stack still truncates or resets it. This task documents that behaviour but does not change it.
- The comment in `.github/workflows/ci.yml` that credits `hasIsolatedDatabaseCredentials()` with "seven suites" is stale: 5 call it, and 4 more skip through an inline check. It is outside this task's paths and is left for a CI-touching task.
- Whether a project-level `enabledPlugins: false` overrides a user-level `true` has not been observed. The Claude Code settings documentation establishes the precedence order but does not describe how the `enabledPlugins` object merges.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. Canonical-docs validator green, including the new guard, its self-tests and the workflow link check | yes | staged tree over `85bdcb9`, after rework round 1 | `node scripts/validate-canonical-docs.mjs` → `canonical documentation: OK` (self-test failures would exit 2 before main) | PASS | — |
| 2. The guard catches the retired workflow in live files (positive control) | yes | `85bdcb9` versions of `CLAUDE.md` and `02-building-ui.md` restored on disk | Before rework: 16 `prescribes the retired skill-driven workflow` failures (e.g. `CLAUDE.md:3` `Superpowers is`, `:13` `gstack`, `:14` `/plan-ceo-review`). After rework round 1 (the `use superpowers` form added): 17. Files restored each time; `git diff --quiet` equal to staged; validator OK again. The self-test also pins the old block (4 matches) | PASS | — |
| 3. Generated profiles match sources; four stage descriptions say "Use proactively" | yes | staged tree | `pnpm validate:agents` → `Verified 16 host profiles from 8 canonical roles (gp: 8).`; `grep -c 'Use proactively'` = 1 in `gp-qa`, `gp-reviewer`, `gp-security`, `gp-ui-reviewer`, 0 elsewhere | PASS | — |
| 4. No new or changed live file names the retired workflow | yes | staged tree after rework round 1 | The validator's own regex (extracted from the file), run over the 32 changed files that are not records (all changed paths except `docs/tasks/DEV-*`, `docs/ai-workflow.md`, the validator and the runbook), finds 0 matches. It also finds 0 matches over the 314 tracked text files in `.agents/`, `discovery/` and `design-references/`, which is why the `.agents/` exemption was dropped | PASS | — |
| 5. `apps/app` agent files are left alone by `next dev` | yes | staged tree | Managed block lines 1–9 of `apps/app/AGENTS.md` byte-identical to `apps/landing/AGENTS.md` (`cmp`); generator writes only when the current block is missing | PASS | `next dev` not run in `apps/app` |
| 6. Independent `gp-reviewer` with no unresolved finding | yes | `dev-002.diff` over `85bdcb9` | Round 1 (Markdown-fallback subagent): nine findings, R1-01 to R1-09, all resolved as stated fixes; see Findings | PASS | Fixes are verified by `gp-qa`, not re-reviewed, as `AGENTS.md` prescribes for stated fixes |
| 7. Independent `gp-qa` on the final revision | yes | staged tree after the Q3-01 stated fix | QA round 1: needs fixes (Q1-01, Q1-02). QA round 2: needs fixes (Q2-01). QA round 3 on `a86b2cc`: verified for the scoped criteria, with Q3-01 low. Narrow re-verification on `11054ea`: Q3-01 fix in place, new low Q3b-01. Narrow re-verification on `ec3f767`: verified for the scoped criteria, no new finding | PASS | Stages ran through the Markdown fallback (independent general-purpose subagents following `agents/COMMON.md` and the role file), not native `gp-*` agent types |
| 8. Fresh session: `/agents` lists `gp-*`; the retired workflow plugin's skills are absent; its session hook does not fire | yes | — | Requires a new Claude Code session on this branch | NOT RUN | environmental: this session predates the change |
| 9. CI `verify` green | yes | PR head | GitHub Actions | NOT RUN | Runs when the PR opens |

## Sources

- Claude Code settings precedence: https://code.claude.com/docs/en/settings, accessed 2026-09-13. Precedence runs managed > command line > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`.
- Claude Code plugins: https://code.claude.com/docs/en/discover-plugins, accessed 2026-09-13. Plugins are enabled per scope, and a project can declare `enabledPlugins` in `.claude/settings.json`.
- Claude Code subagents: https://code.claude.com/docs/en/sub-agents, accessed 2026-09-13. `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`; "Set to 1 to disable nesting entirely".
- Next.js 16.3.1 agent-file generator, installed at `apps/app/node_modules/next/dist/server/lib/generate-agent-files.js`. It writes the managed block into `AGENTS.md` and `@AGENTS.md` into `CLAUDE.md` when the block is missing.

## Completion / handoff

- **Changed / inspected files:** the owning paths above, plus 16 regenerated profiles and one dated runbook banner.
- **Review independence:**
  - `gp-reviewer` round 1 and `gp-qa` rounds 1–3, plus two narrow re-verifications, each ran as an independent subagent through the Markdown fallback.
  - The coordinator verified none of its own fixes as independent evidence.
  - Native `gp-*` agent types were not available in this session.
- **Verified scope:** criteria 1–7.
- **Remaining risks / blocked requirements:**
  - Criterion 8, fresh-session discovery: includes whether a project-level `enabledPlugins: false` overrides the user-level enable, and whether the retired plugin's session hook stops firing.
  - Criterion 9, CI.
  - Both are required and NOT RUN.
  - Two rework rounds of three were used (Q1, Q2). Q3-01 and Q3b-01 were stated fixes after passing QA.
- **Next bounded action and owner:**
  - Coordinator: open the PR and record CI.
  - Owner: run the fresh-session check (`/agents` on this branch) and decide the merge.
  - Follow-up: DEV-003 (runbook rewrite; removes the validator's temporary runbook exemption).
- **Final state and reason:** not final. Blocked on criteria 8 and 9.
