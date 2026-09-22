# DEV-031 — BL-081: guards against committing prospecting data again

## Assignment

- **Objective and user-visible outcome:** nothing stops a session from committing prospecting data again (BL-081): commit `bbfc705`, a landing layout change, tracked a whole session directory in passing. After this task `.gitignore` ignores everything under `outputs/` except its pointer README, and `pnpm validate:canonical-docs` refuses a tracked file carrying a ProZorro `contactPoint` object, any tracked file under `outputs/` other than the README, and any tracked spreadsheet. The validator's two `outputs/` exemptions, written for the session DEV-030 moved out, are removed.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** new behaviour inside existing boundaries (an executed script under `scripts/`): coordinator → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-security` — «retention and deletion of personal data»: the guard is the control that keeps personal data out of git. `gp-architect` is not triggered: no migration, RLS, contract or catalog changes; the validator is repository tooling. `gp-ui-reviewer` and `gp-mobile`: nothing under their paths.
- **Owning module and allowed edit paths:** `.gitignore` (the `outputs/` rule; the discovery store's data files, after review); `scripts/validate-canonical-docs.mjs` (the guard, its self-test, the two exemptions, one stale comment); `outputs/README.md` (one sentence); `docs/BACKLOG.md` (BL-081 closed; BL-124 and BL-125 filed from review); `docs/STATUS.md` («Next action» item 1, the preamble); this record and `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`; `agents/COORDINATION.md`; BL-081; [DEV-030](DEV-030-outputs-private-storage.md), including its `gp-security` report's list of what DEV-031 must cover; [DEV-007](DEV-007-design-sources.md) S1-09; the validator's existing guards 11 and 12 (the rename and retired-workflow walks).
- **Linked spec, ADR or earlier task:** BL-081; DEV-030 (same pull request). No ADR.
- **Baseline:** `9d5ea5c` (DEV-030 after its review fixes), on `44e05cd`.
- **Dependencies / constraints / out of scope:** BL-079 decided what stays tracked (only the pointer). Out of scope: a deny rule for agent sessions (BL-123); a commit hook, a branch-range mode and a tax-number detector (BL-124). The `discovery/` store was first out of scope and came in after review (S1-02).
- **Required acceptance criteria:**
  1. `.gitignore` ignores any new file or directory under `outputs/` and does not ignore `outputs/README.md` (`git check-ignore`).
  2. The validator refuses a ProZorro `contactPoint` in each form a dump takes — a JSON object or array (`:`, `=`, brace on the next line), JSON escaped once or twice, a Python dict, a JS object literal, a YAML block key, a flattened key in JSON, ndjson or Python, a flattened column in a markdown table, CSV (any case, `_`) or tab-separated `.txt`, UTF-16 text — naming file and line, at most five lines per file plus a count; it does not refuse the prose in `discovery/*.md`, `docs/BACKLOG.md` or the task records, or a named type; an approved file is still refused for a non-synthetic email or telephone; each message names the remedy for an uncommitted, committed and pushed file. It reads the index, so a staged dump deleted from disk is read. Shown by self-test fixtures that went red on a stub or the old detector first, and by forced-in mutations (amended after review: R1-01, R1-03, R1-04, R1-05, R1-07, S1-01, S1-04, S1-05, S1-08).
  3. The validator refuses a tracked path under `outputs/` other than the README, any tracked file it cannot read (spreadsheets including `.xlsb` and `.numbers` bundles, archives, PDFs, documents, parquet, SQLite) but one approved PDF, any data file in the `discovery/` store, and any tracked file an ignore rule covers; `.gitignore` ignores the discovery store's data files. Shown the same way (amended after review: S1-02, S1-03, S1-06, R1-06).
  4. Over the tree before DEV-030 (`44e05cd`) the checks refuse the five ProZorro dumps (6,371 lines, DEV-007's count), the 250 session paths and the workbooks; over the current tree they refuse nothing; the stated limits say how much of the session content and format alone would catch (amended after review: R1-02).
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
| 5 | reviewing (`gp-reviewer`, `gp-security`, native) on `21c6ea8` | **`gp-reviewer`: CHANGES REQUESTED** — R1-01 medium (a flattened key in JSON, ndjson or Python passes), R1-02 medium (the limits omit that the content and format rules would have caught few of the session's files, and the formats skipped unread), R1-03 low (inline object types and docs refused, and the message offers only approval), R1-04 low (line numbers quadratic, a real dump floods the output), R1-05 low (UTF-16 skipped as binary; `.txt` exports), R1-06 low (`.numbers` bundles, `.xlsb`), R1-07 low (the brace-on-next-line, `=` and `[` forms not in the self-test), R1-08 nit (a stale comment names the session outputs as records), R1-09 nit (the working tree read, not the index). **`gp-security`: HOLD** — S1-01 medium (the remedy `git rm --cached` leaves a committed dump in history), S1-02 medium (the discovery store's docs say its CSVs are ignored; only three are), S1-04 medium (an approved path lets real data pass as a «synthetic fixture»), S1-03 low (files forced past other ignore rules), S1-05 low (flattened keys, case, double escapes), S1-06 low (archives, PDFs, documents, UTF-16, bundles), S1-07 low (CI detects after a push; the leftovers need an entry), S1-08 low (= R1-09, and symlinks followed), S1-09 nit (the `.gitignore` comment). Its re-check of DEV-030's S1-01 to S1-07: all addressed | review reports | Stated fixes |
| 6 | rework (coordinator), stated fixes | **Self-test first:** 28 new or changed lines against the old detector and stubs for the two new helpers: **red**, 16 named failures. **Content rule:** case-insensitive `contact[_-]?point`; four forms (an object or array under the key with any number of escapes; a quoted key naming the field, flattened or not; a YAML block key; a flattened column after `\|`, `,` or a tab); any occurrence in `.csv`, `.tsv`, `.psv`, `.txt`; line numbers by a newline index and binary search; five lines per file then «…and N more»; the remedy for uncommitted, committed and pushed files, for types and documents, and «never approve a real ProZorro response». **Approved files still scanned:** emails must be on an RFC 2606 or RFC 6761 reserved domain, telephones all zeros after `+380`. **`decodeTrackedText`:** UTF-16 behind a BOM decoded. **Index read:** `git ls-files -s -z` then `git cat-file --batch`, submodules skipped, symlinks read as their target path. **Path rules:** unreadable formats (spreadsheets incl. `.xlsb`, `.xltx`, `.numbers/`, archives, PDF, `.doc`/`.docx`/`.odt`/`.rtf`, parquet, SQLite) with the one PDF approved; the discovery store's data files; `trackedIgnoredErrors` over `git ls-files -ci --exclude-standard` (0 today). `.gitignore`: the discovery store's data files; the comment reworded. The stale retired-workflow comment fixed. **Green** on the tree. **Twelve mutations**, each exit 1 naming its site (the seven before, plus a flattened JSON key, a UTF-16LE export with BOM — first written through a shell substitution that dropped its NULs, rewritten to a file — a `.zip`, `discovery/leads.csv` without a `contactPoint`, and a dump staged then deleted from disk); tree after: validator exit 0. **Pre-move:** 5 dumps, 6,371 lines (5 shown + the count, per file), 259 path refusals; the content rule's time over the five dumps 6,760 ms before, 134 ms after; of the session's 250 files, 14 caught by content or format alone. BL-081's closure rewritten with its limits; BL-124 (a commit hook, a branch-range mode, a tax-number detector) and BL-125 (guards 11 and 12 split `ls-files` by newline; latent, no such path tracked) filed | `scratchpad/dev031-timing-before.txt`, `dev031-r1-red-selftest.txt`, `dev031-r1-canonical-docs.txt`, `dev031-r1-mutations.txt`, `dev031-r1-pre-move.txt` | Runs |
| 7 | implementing (coordinator): the index read, observed | Run on the unstaged edits, the validator passed; staged, it refused three lines: this record quoted an inline object type, and the validator's own negative fixtures for an approved file (a real-looking email and telephone) failed its approved-file scan — the S1-04 control catching its own file. The record reworded; the two fixtures assembled from parts, with a comment. Consequence, now in «What is not true»: the content rule sees what is staged, so it is run after `git add`. Validators, agents, typecheck and the mutations re-run on the staged tree | `scratchpad/dev031-r2-*.txt` | Commit; `gp-security` re-check (S1-01, S1-02, S1-04); `gp-qa` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1-01 | medium | the messages; the tree walk | Actual: `git rm --cached` offered; a committed dump stays in history | coordinator | Remedy by state (row 6); the branch-range mode is BL-124 and a stated limit |
| S1-02 | medium | `discovery/` store | Actual: docs say its CSVs are ignored; three were | coordinator | Ignore rules and a path rule (row 6) |
| S1-04 | medium | approved paths | Actual: approval exempts real data | coordinator | Approved files scanned for non-synthetic contacts; `gp-security` on additions (row 6) |
| R1-01 / S1-05 | medium / low | the object regex | Actual: flattened keys, case, double escapes pass | coordinator | Four forms, case-insensitive (row 6) |
| R1-02 | medium | limits | Actual: understated | coordinator | 14 of 250 stated; BL-081 closure; BL-124 |
| S1-03 | low | forced files | Actual: undetected past other ignore rules | coordinator | `trackedIgnoredErrors` (row 6) |
| S1-06 / R1-06 | low | unreadable formats | Actual: only spreadsheets, bundles missed | coordinator | Widened, one PDF approved (row 6) |
| S1-07 | low | CI wording; leftovers | Actual: «stops»; no entry | coordinator | «detects after a push»; BL-124 |
| S1-08 / R1-09 | low / nit | working tree read | Actual: staged-then-deleted skipped; symlinks followed | coordinator | Index read (row 6) |
| R1-03 | low | types and docs | Actual: refused; remedy only approval | coordinator | Message names the alternatives; a named type pinned green; inline object types stay refused |
| R1-04 | low | line numbers | Actual: quadratic; flood | coordinator | Index + binary search, 5 per file (6,760 → 134 ms) |
| R1-05 | low | UTF-16, `.txt` | Actual: skipped; no rule | coordinator | Decoded; `.txt` in the delimited set |
| R1-07 | low | self-test | Actual: three forms only in mutations | coordinator | Pinned (row 6) |
| R1-08 / S1-09 | nit | comments | Actual: stale | coordinator | Fixed |

Rework count and hypothesis changes: none counted — no QA FAIL; the HOLD's fixes precede QA.

## What is not true after this task

- **Nothing prevents a commit.** The ignore rules do not stop `git add -f`, and the validator stops it only where someone runs it: CI, once GitHub Actions runs again (October 2026), detects after a push, when the data is already on the remote and in pull-request refs. No hook runs the validator (BL-124).
- **The guard reads the tree, not a branch's commits**: a dump committed and then removed in a later commit passes (BL-124).
- **One field is known.** Outside `outputs/`, content and format alone would have refused 14 of the session's 250 files; sole traders' tax numbers, outreach routes and customers named in tender titles pass the content rule (BL-124). Images are not read.
- **Inline object types are refused**: a `contactPoint` field typed with an inline object literal fails closed, and the message says to name the type.
- **The content rule reads the index**: an edit not yet staged is not scanned by it, so the validator is run after `git add` (the other guards read the working tree).
- **History is unchanged**: `bbfc705` still holds the session.
- **Guards 11 and 12** split `git ls-files` by newline and would skip a quoted path (BL-125; none is tracked).

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
