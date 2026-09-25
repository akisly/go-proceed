# DEV-090 — BL-124 (2): the prospecting-data guard reads the commits a change adds

## Assignment

- **Objective and user-visible outcome.** A prospecting dump committed on a branch and deleted in a later commit on the same branch no longer passes CI.
  - **Before this task.** The DEV-031 guards read only the index, the tree a branch ends on. The deleted dump passed them, while its bytes stayed in the branch's history and in the pull request's refs.
  - **After it.** `scripts/validate-canonical-docs.mjs --commits <range>` runs the same path, binary and contactPoint rules over every blob any commit in the range added or changed. CI's `verify` job runs it over what a pull request or a push to main adds.
- **State:** reviewing
- **Coordinator:** Claude Code primary session, 2026-09-25.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why** (`agents/COORDINATION.md`): the change touches executed code under `scripts/` and `.github/workflows/`. The route is implementation → `gp-reviewer` and `gp-security` → `gp-qa`.
- **Triggered stages:**
  - `gp-reviewer` and `gp-qa`: always.
  - `gp-security`: the change is a guard against committing personal data (BL-079, BL-081), and it edits a CI workflow. The permissions and action pins are unchanged, but the checkout depth is not.
  - `gp-architect`: not triggered. There is no schema, contract, catalog or worker change.
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher`: not triggered.
- **Owning module and allowed edit paths:**
  - `scripts/validate-canonical-docs.mjs` (`parseRawLog`, `commitRangeEntries`, `commitRangeErrors`, the `--commits` mode, and self-tests);
  - `.github/workflows/ci.yml` (the `verify` job's checkout depth, and one step);
  - `docs/BACKLOG.md` (BL-124), this record, and `docs/tasks/README.md`.
- **Read context:**
  - BL-124, BL-079 and BL-081;
  - [DEV-031](DEV-031-outputs-guards.md);
  - the index guard in `validate-canonical-docs.mjs` (`prospectingPathErrors`, `binaryBlobErrors`, `contactPointErrors`, `parseCatFileBatch`);
  - `actions/checkout` v7.0.1's README at the pinned SHA.
- **Linked spec, ADR or earlier task:** BL-124 item (2); DEV-031.
- **Baseline:** `b81a2492`: `origin/main` `90517713` plus the DEV-089 closure (#175).
- **Dependencies, constraints and out of scope:**
  - Items (1), a pre-commit hook that prevents rather than detects, and (3), more detectors, stay open.
  - The history that main already holds is not rescanned by CI. BL-079 keeps it by the owner's decision.
  - No history rewrite.
- **Required acceptance criteria:**
  - AC-1: a dump committed and deleted within a range is refused by `--commits`, by path and by content, while the tree mode passes it. Shown end to end in a scratch clone, both on a plain range and through a pull request's merge commit (`HEAD^1..HEAD^2`).
  - AC-2: the guard fails closed on an unresolvable range, an unreadable blob, or an argument that is not a range.
  - AC-3: the self-tests cover the raw-log parse (a deletion and a submodule skipped, a path with a space), both refusals, a clean range, the closed failure and the argument check. A mutation sweep of the guard is killed except for the mutants recorded as equivalent.
  - AC-4: `pnpm validate:canonical-docs` passes. `--commits` passes over main's recent push range and over this change's own range.
  - AC-5: CI runs the new step on this pull request and it passes; the `verify` log shows it.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | Take BL-124 item (2) after DEV-089: a P2 whose item (2) depends on nothing | Coordinator, under the owner's standing order («мержи и давай дальше») |

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | **Design.**<br>• `git log --format= --raw -z --no-abbrev --no-renames -m --diff-filter=AMT <range> --` lists every blob a commit in the range added or changed. With `-m`, a merge's own changes are read; with `--no-renames`, a moved file is read at its new path.<br>• Entries are deduplicated by (path, blob). Their bodies are read with the same strict `git cat-file --batch` parse, and the same three rules apply.<br>• Every error says a commit in the range added the file, and that deleting it later leaves it in history.<br>• CI checks out with `fetch-depth: 0`. The range is `HEAD^1..HEAD^2` for a pull request, whose checkout is its merge commit (`refs/pull/N/merge`, actions/checkout v7 README), and `before..HEAD` for a push to main.<br>• The event values reach the script through env, never interpolated. | This record | Implement |
| 2 | Coordinator | **Implemented, with self-tests.**<br>• The tree mode and the new self-tests pass.<br>• `--commits origin/main~5..origin/main` and `--commits 2c33404d..90517713` (main's last push, merges included) print OK.<br>• End to end in a scratch clone (`git clone --local`): after a commit adding `outputs/s/hits.json` with a `contactPoint`, then a commit deleting it, the tree mode prints OK. `--commits <base>..HEAD` exits 1 with two problems, the path and the content. Merged into a moved base with `--no-ff`, `--commits HEAD^1..HEAD^2` exits 1 with the same two; a clean range exits 0. `--commits deadbeef..HEAD` fails closed. | Session output | Sweep |
| 3 | Coordinator | **Mutation sweep**, each mutant restored by sha256, the validator's self-test as the oracle.<br>• Killed: the path rule dropped; the content rule dropped; the cat-file error dropped; the whole deletion-and-zero-blob skip dropped (dropping `status === "D"` alone is equivalent, since a deletion's blob is all zeros: gp-qa Q4); the submodule skip dropped; the range check dropped. With that check gone, the argument `--output=x` made `git log` write a 2 MB file `x` into the worktree during the sweep; it was removed. That is the reason the check exists.<br>• Survived: the empty-range shortcut dropped. It is equivalent, since `git cat-file` over no blobs returns nothing. | Session output | History |
| 4 | Coordinator | **The whole history, for information.** `--commits <root>..origin/main` reports 299 problems; the range excludes the root commit itself. 298 fall on the 250 files of `outputs/01a033d9…`, which `bbfc705` added and DEV-030 removed: 250 by path, 9 by format, 9 as binaries, and 30 contactPoint lines. Those 30 lines are five shown and a count for each of the five ProZorro dumps, 6,371 `contactPoint` lines in all, which is DEV-007's count. BL-079 keeps them in history by the owner's decision. The other problem is `output/playwright/readiness-workflow/motion.webm`, a video that is untracked now (gp-reviewer R1 corrected this row). CI never scans this range: a pull request's range excludes everything its base already holds. Recorded in BL-124 | `scratchpad/dev090-history.txt` | Reviews |
| 5 | gp-security | **PASS WITH FINDINGS**, no blocker or major.<br>• Permissions and the six pins are unchanged.<br>• Full history widens nothing: `verify` uploads no artifact, and `app-qa` stays shallow.<br>• The event values go through env, quoted.<br>• A fork runs its own script, the same trust as the gate before it.<br>• Renames, merges, submodules and symlinks are handled as the index rule handles them.<br>• Every failure is closed.<br>• The errors print paths and line numbers, never content. The history output holds no name, no Cyrillic and no identifier.<br>S1–S5 (below). | Subagent report (session) | Fixes |
| 6 | gp-reviewer | **PASS WITH FINDINGS**, no blocker or major.<br>• `HEAD^1..HEAD^2` on a merge ref is correct, and `fetch-depth: 0` is required and changes nothing else: no script assumes a shallow clone, and turbo takes no ref filter.<br>• The parse, deduplication, fail-closed paths and exit codes are correct.<br>R1–R6 (below); R3 and R4 are S2 and S1. | Subagent report (session) | Fixes |
| 7 | Coordinator | **Fixes.**<br>• S1/R4: `trackedIgnoredErrors` runs over the range's paths through `git -c core.excludesFile=/dev/null check-ignore --no-index -z --stdin`, where exit 1 means none are ignored and any other status throws.<br>• S2/R3: `--diff-merges=separate` and `--no-show-signature` replace `-m`, and `parseRawLog` throws on any token it cannot read.<br>• R2: a pure `isCommitRange`, self-tested on eight negatives and three positives, so the self-test never runs git; `--end-of-options` goes before the range (git 2.43.0 here).<br>• R5: range-mode errors add «a pushed branch clears this only by rewriting it, and the remote keeps the old commits: tell the owner».<br>• R6: the CI comment names a future trigger with no `before`.<br>• R1: row 4 and BL-124 corrected.<br>End to end in the scratch clone: a forced `.env.local` committed and then removed gives OK in tree mode and exit 1 with `.env.local` named in range mode. `--commits 2c33404d..90517713` (merges included) is OK.<br>Mutations, each caught and restored by sha256: the predicate loosened to `/\.\./`, or refusing everything; the strict parse relaxed; the ignore rule dropped; the score digit refused. | Session output | gp-qa |
| 8 | gp-qa | **At `37e15376`, AC-1 to AC-4 PASS; AC-5 NOT RUN (CI's).**<br>• In its own scratch clone, each of these, committed then removed, passes tree mode and is refused by range mode, directly and through a `--no-ff` merge's `HEAD^1..HEAD^2`: a dump under `outputs/` (3 problems since S1: path, ignore, content), a forced `.env.local`, a content-only `docs/notes.csv`, a dump renamed into `outputs/`, and an evil merge adding a dump.<br>• The push shape `<base>..<merge>` is refused too.<br>• Eight bad arguments and a missing object fail closed, and no file is written.<br>• Hostile `GIT_CONFIG_*` settings (`log.showSignature`, `log.diffMerges=off`, `diff.renames=copies`, `diff.external`, `core.abbrev`) change nothing.<br>• Of 20 mutants: the self-test kills 7, its end-to-end runs kill 5, and the rest are equivalent or never triggered.<br>• Every stated fix is confirmed.<br>• Q1–Q4 (below). | Subagent report (session) | Fixes |
| 9 | Coordinator | **Q1:** the `git log` arguments are the exported `COMMIT_RANGE_LOG_ARGS`; the self-test holds seven flags to it, with `--end-of-options` last.<br>**Q2:** `ignoredPaths` reads `check-ignore -v -n -z`, and `gitignoredOf` keeps only a match from a `.gitignore` file whose pattern is not a negation; self-tested.<br>**Q3:** `--commits=<range>` is refused with exit 1.<br>**Q4:** row 3 corrected.<br>End to end in the scratch clone: the forced `.env.local` still exits 1; a clean file excluded only through `.git/info/exclude` now passes (OK).<br>Mutations, each restored by sha256: the source filter loosened, the negation check dropped, and `--no-renames` removed are killed by the self-test; the `--commits=` refusal dropped fails open (exit 0), which the manual run catches.<br>`--commits b81a2492..HEAD` OK. | Session output | gp-qa re-check, CI |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1 / R4 | low / minor | `commitRangeErrors` | The ignore rule was not applied, so a forced `.env.local` committed and deleted passed | Coordinator | Fixed: `check-ignore`; a self-test; an end-to-end run |
| S2 / R3 | low / minor | `parseRawLog`, `-m` | Unknown tokens were skipped, and `log.diffMerges` or `log.showSignature` could change the input on a developer's machine | Coordinator | Fixed: strict parse, `--diff-merges=separate`, `--no-show-signature`; self-tests |
| R2 | minor | the argument self-test | It ran git with refused arguments, tested the outcome rather than the regex, and had no positive case | Coordinator | Fixed: `isCommitRange`, positives, `--end-of-options` |
| R1 | minor | row 4, BL-124 | «298 files» were 298 problems over 250 files, and the root commit is outside the range | Coordinator | Fixed |
| R5 | info | the remedy text | «Not yet committed / not pushed» never applies in CI | Coordinator | Fixed: a range-mode remedy line; «What is not true» |
| R6 | info | CI trigger edges | A future trigger with no `before` fails the step | Coordinator | Fixed: named in the step's comment |
| Q1 | minor | the git call and `main()` wiring | Flags the reading depends on had no regression check | Coordinator | Fixed: `COMMIT_RANGE_LOG_ARGS` self-tested; the `main()` wiring stays covered by end-to-end runs only |
| Q2 | low | `ignoredPaths` | `.git/info/exclude` counted, which the index rule does not read | Coordinator | Fixed: `gitignoredOf` |
| Q3 | low | `--commits=<range>` | Fell through to tree mode, exit 0 | Coordinator | Fixed: refused, exit 1 |
| Q4 | info | row 3 | Overstated one kill | Coordinator | Fixed |
| S3 | info | commit and tag messages | Not scanned | — | Recorded in «What is not true» and BL-124 |
| S4 | info | Git LFS pointers | A pointer's content is never read (both modes; no LFS today) | — | Recorded in «What is not true» and BL-124 |
| S5 | info | coverage; the Actions log | A branch with no pull request is never scanned, and a stacked pull request leaves out its base's commits; refused paths stay in the run log after a history rewrite | — | Recorded in «What is not true» and BL-124 |

Rework count and hypothesis changes: none.

## What is not true after this task

- **Detection, not prevention.** The guard still detects after the push, so the data is already on the remote. Item (1)'s hook is what prevents.
- **An edit not yet staged is still unscanned.** A `git commit -a` commits it unscanned. That half of item (2) is the pre-commit hook's.
- **Main's existing history is not scanned by CI.** It holds BL-079's directory by the owner's decision.
- **A force-push that rewrites main** leaves `before` unresolvable, and the step fails closed until someone runs the guard over the new range by hand.
- **Only pull requests and pushes to main are scanned** (gp-security S5). A branch pushed with no pull request never is, and a pull request stacked on another branch leaves that branch's commits to its own pull request. «No longer passes CI» holds once a pull request is open.
- **Commit and tag messages are not scanned** (S3). A dump pasted into a commit body passes.
- **A Git LFS pointer's content is never read**, in either mode (S4). The repository uses no LFS today.
- **Clearing a refusal means rewriting the branch** (gp-reviewer R5). A refused intermediate commit, even a false positive, clears only when the branch is rewritten and force-pushed, and the remote keeps the old commits. The paths refused stay in the Actions run log, which a history rewrite does not remove; delete those runs if a file name identifies a person.
- **Evil merges.** A merge commit whose resolution adds content neither parent had is read through `-m`. That path is covered by reasoning, not by a test.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 a deleted dump refused | Yes | | | | |
| AC-2 fails closed | Yes | | | | |
| AC-3 self-tests and sweep | Yes | | | | |
| AC-4 the validator passes | Yes | | | | |
| AC-5 the step on CI | Yes | | | | |

## Sources

- `actions/checkout` v7 README at the pinned SHA `3d3c42e5aac5ba805825da76410c181273ba90b1`. It says `fetch-depth` defaults to 1 and "0 indicates all history for all branches and tags", and that a pull request checks out the merge commit (`refs/pull/N/merge`). Fetched 2026-09-25.
- `git log --raw -z` and `-m` behaviour, observed with the installed git in the scratch clone (row 2).

## Completion / handoff

- **Changed / inspected files:** see «Owning module».
- **Review independence:** every stage runs as an independent native subagent.
- **Verified scope:** rows 1–9.
- **Remaining risks / blocked requirements:** see «What is not true after this task».
- **Next bounded action and owner:** `gp-qa` (Q1–Q3), CI.
- **Final state and reason:** reviewing.
