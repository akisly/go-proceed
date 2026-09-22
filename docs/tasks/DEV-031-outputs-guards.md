# DEV-031 — BL-081: guards against committing prospecting data again

## Assignment

- **Objective and user-visible outcome:** nothing stops a session from committing prospecting data again (BL-081): commit `bbfc705`, a landing layout change, tracked a whole session directory in passing. After this task `.gitignore` ignores everything under `outputs/` except its pointer README, and `pnpm validate:canonical-docs` refuses a tracked file carrying a ProZorro `contactPoint` object, any tracked file under `outputs/` other than the README, and any tracked spreadsheet. The validator's two `outputs/` exemptions, written for the session DEV-030 moved out, are removed.
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** new behaviour inside existing boundaries (an executed script under `scripts/`): coordinator → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-security` — «retention and deletion of personal data»: the guard is the control that keeps personal data out of git. `gp-architect` is not triggered: no migration, RLS, contract or catalog changes; the validator is repository tooling. `gp-ui-reviewer` and `gp-mobile`: nothing under their paths.
- **Owning module and allowed edit paths:** `.gitignore`; `scripts/validate-canonical-docs.mjs` (the guard, its self-test, the two exemptions); `outputs/README.md` (one sentence); `docs/BACKLOG.md` (BL-081 closed); `docs/STATUS.md` («Next action» item 1, the preamble); this record and `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`; `agents/COORDINATION.md`; BL-081; [DEV-030](DEV-030-outputs-private-storage.md), including its `gp-security` report's list of what DEV-031 must cover; [DEV-007](DEV-007-design-sources.md) S1-09; the validator's existing guards 11 and 12 (the rename and retired-workflow walks).
- **Linked spec, ADR or earlier task:** BL-081; DEV-030 (same pull request). No ADR.
- **Baseline:** `9d5ea5c` (DEV-030 after its review fixes), on `44e05cd`.
- **Dependencies / constraints / out of scope:** BL-079 decided what stays tracked (only the pointer). Out of scope: the root `discovery/` store, which `.gitignore` covers only for named lead files (S1-02's remark in DEV-030; recorded below); a deny rule for agent sessions (BL-123).
- **Required acceptance criteria:**
  1. `.gitignore` ignores any new file or directory under `outputs/` and does not ignore `outputs/README.md` (`git check-ignore`).
  2. The validator refuses a ProZorro `contactPoint` in each form a dump takes — a JSON object, JSON escaped in a string, a Python dict, a JS object literal, a YAML block key, a flattened CSV column, a pretty-printed object with the brace on the next line — naming file and line; it does not refuse the prose in `discovery/*.md`, `docs/BACKLOG.md` or the task records. Shown by self-test fixtures that went red on a stub first, and by forced-in mutations.
  3. The validator refuses a tracked path under `outputs/` other than the README and any tracked spreadsheet, shown the same way.
  4. Over the tree before DEV-030 (`44e05cd`) the checks refuse the five ProZorro dumps (6,371 lines, DEV-007's count), the 250 session paths and the workbooks; over the current tree they refuse nothing.
  5. The two `outputs/` record exemptions are gone and a self-test holds that; `pnpm validate:canonical-docs`, `pnpm validate:agents` and `pnpm turbo run typecheck --force` pass.
  6. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026, so the validator is enforced only where someone runs it until then).
- **Skipped stages and rationale:** `gp-architect`, `gp-ui-reviewer`, `gp-mobile` (see above).

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-23 | BL-081's guards: ignore new directories under `outputs/` (only the pointer README tracked), and a validator check that refuses tracked files carrying ProZorro `contactPoint` objects outside approved paths; decide what is approved; revisit the validator's `outputs/` exemptions once only the pointer remains | session brief |

## Plan

1. Self-test fixtures for the `contactPoint` forms and the removed exemptions, against a stub: red. Then the detector: green.
2. The same for the path rules (`outputs/`, spreadsheets), taken from DEV-030's `gp-security` report.
3. The walk in `main()`, over every tracked file; the exemptions removed; `.gitignore`.
4. Mutations forced past the ignore rule, each red naming its site; the pre-move tree through the exported checks.
5. Docs; runs; `gp-reviewer` + `gp-security` → stated fixes → `gp-qa`.

**What is approved.** Detection is by the forms a data dump takes, so the prose that names the field (`suppliers[].contactPoint.email` in `discovery/*.md`, `docs/BACKLOG.md`, DEV-007) needs no approval. The approved list holds only the validator itself, whose self-test spells the forms out; a synthetic fixture that must be tracked joins it with its reason. The spreadsheet list is empty (none is tracked).

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | implementing (coordinator): the content rule | Tracked files naming `contactPoint` at `9d5ea5c`: six, all prose (`discovery/HANDOFF-B0.1-PROZORRO.md`, `PROMPT-lead-research-handoff.md`, `prozorro-contractor-extraction-spike.md`, `sources.md`; `docs/BACKLOG.md`; `docs/tasks/DEV-007-design-sources.md`), none in an object form. Eleven self-test lines, against a stub `contactPointErrors` returning `[]`: **red**, 8 named failures (the six forms, the line number, the exemption). The detector: an object regex (quoted, unquoted, escaped, `=`, brace across a newline), a YAML key alone on its line, any occurrence in a `.csv`/`.tsv`; one error per line. Walk: `git ls-files -z`, every extension, binaries skipped by a NUL in the first 8,000 bytes. The `outputs/` entries left `ROLE_RECORD_DIRS` and `RETIRED_WORKFLOW_RECORD_DIRS` with a dated note | `scratchpad/dev031-red-selftest.txt` | Path rules |
| 2 | implementing (coordinator): the path rules | From DEV-030's `gp-security` list: a text scan cannot read an `.xlsx` (a zip), and a session directory holds more than `contactPoint` objects. `prospectingPathErrors`: any tracked `outputs/` path but the README; any `.xlsx`/`.xlsm`/`.xls`/`.ods`/`.numbers` not in the (empty) approved set. Five self-test lines against a stub: **red**, 4 named failures; then green | `scratchpad/dev031-red-selftest-paths.txt` | Mutations |
| 3 | implementing (coordinator): mutations and the pre-move tree | `.gitignore`: `/outputs/*` and `!/outputs/README.md`. **Seven mutations**, each force-added, the validator run, then untracked and deleted: a JSON dump under `outputs/` (ignored without `-f`; refused twice, path and line), an ndjson dump in `docs/`, a flattened CSV in `discovery/`, a YAML fixture in `packages/testing/`, a pretty-printed dump with an unusual extension in `apps/app/`, a note with no `contactPoint` under `outputs/`, an `.xlsx` in `docs/` — each exit 1 naming its site; the tree after: only this task's edits, validator exit 0. **Pre-move tree** through the exported checks, blob by blob (paths and counts only): at `44e05cd`, 5 files and 6,371 lines refused (the five ProZorro dumps; DEV-007 counted 6,371 objects), 259 path refusals (250 `outputs/` paths, 9 workbooks); at `9d5ea5c`, none. Validator time over the tree: about 1.5 s | `scratchpad/dev031-mutations.sh`, `dev031-mutations.txt`, `dev031-pre-move.mjs`, `dev031-pre-move.txt` | Docs, runs |
| 4 | implementing (coordinator): docs and runs over `9d5ea5c` + the working tree | The pointer names the guards; BL-081 closed with its limits; STATUS item 1 and the preamble; the index. `git check-ignore`: the README not ignored (rc 1), `outputs/new/x.json` and `outputs/y.csv` ignored by `.gitignore:121`. `pnpm validate:canonical-docs` OK; `pnpm validate:agents` 16 profiles; `pnpm turbo run typecheck --force` 10/10 | `scratchpad/dev031-check-ignore.txt`, `dev031-canonical-docs.txt`, `dev031-agents.txt`, `dev031-typecheck.txt` | Commit; `gp-reviewer`, `gp-security` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

- **The ignore rule does not stop `git add -f`,** and the validator stops it only where someone runs it: GitHub Actions starts no jobs until October 2026, and no pre-commit hook runs the validator.
- **Not every personal-data shape is detected.** The content rule knows ProZorro's `contactPoint`; a sole trader's name and tax number in some other export, an outreach route, or a screenshot of a workbook passes it outside `outputs/`. Images are not read, and `.numbers` bundles (directories) are not matched.
- **The root `discovery/` store is only partly ignored**: `.gitignore` names `leads.csv`, `outreach-log.csv`, `suppression.csv`, `drafts/` and `*.db`; another file dropped there is tracked by default (DEV-030 S1-02's remark). The content and spreadsheet rules still apply to it.
- **History is unchanged**: the guard reads the tracked tree, not `bbfc705`.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- Git, «gitignore» — https://git-scm.com/docs/gitignore (page «last updated in 2.55.0»); installed `git version 2.50.1 (Apple Git-155)`; accessed 2026-09-23. Relied on for: a separator at the start makes a pattern relative to the `.gitignore`'s own directory; a file cannot be re-included when a parent directory is excluded — so the rule is `/outputs/*` (the directory itself stays unexcluded) with `!/outputs/README.md`, as the page's `/*`, `!/foo` example does. Confirmed locally with `git check-ignore -v` (row 3).
- `git add -h` on the installed git: `-f, --force  allow adding otherwise ignored files` — why the validator is the second line.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
