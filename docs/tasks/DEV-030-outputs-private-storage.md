# DEV-030 — BL-079: `outputs/` moves to private storage behind a pointer README

## Assignment

- **Objective and user-visible outcome:** the 250 files of prospecting session `01a033d9-c008-7011-bf7b-e1dbd14e2e9d`, which hold personal data of natural persons, leave the tracked tree. They move to a private folder outside every clone, `~/GoProceed-private/outputs/`, with a SHA-256 manifest verified before `git rm`. `outputs/README.md` becomes a pointer that names the location, the manifest checksum and the fact that commit `bbfc705` still holds the data, and carries no personal data itself. Nothing is uploaded anywhere.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** the owner's decision carried out: coordinator → `gp-reviewer` + `gp-security` → `gp-qa`. The removal changes no executed code, but it deletes tracked personal data and rewrites the canonical status and backlog, and the owner asked for the full route.
- **Triggered stages and why:** `gp-security` — «retention and deletion of personal data». `gp-architect` is not triggered: no migration, RLS, contract, catalog or product retention job changes; the move is a repository-hygiene step the owner ruled. `gp-ui-reviewer` and `gp-mobile`: nothing under their paths changes.
- **Owning module and allowed edit paths:** `outputs/` (the session directory removed, `README.md` rewritten); `docs/BACKLOG.md` (BL-079 closed, BL-080 re-pointed, BL-122 and BL-123 filed from review); `docs/STATUS.md` (the «Outreach» row, «Next action» items 1–3, the preamble); this record and `docs/tasks/README.md`. Outside the repository: `~/GoProceed-private/outputs/` (created).
- **Read context and applicable local instructions:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/BACKLOG.md` BL-079, BL-080, BL-081; [DEV-007](DEV-007-design-sources.md) (the personal-data review, S1-01 to S1-09); [DEV-012](DEV-012-m0-gate12-evidence.md) «Owner decisions» (2026-09-15); `.gitignore`'s «Child B discovery» block.
- **Linked spec, ADR or earlier task:** BL-079; DEV-007; DEV-012. No ADR: the owner ruled the option on 2026-09-15.
- **Baseline:** `44e05cd` (`origin/main`, 2026-09-23), branch `claude/data-outputs-private`.
- **Dependencies / constraints / out of scope:** no history rewrite (owner, 2026-09-15). The backup of the private folder is the owner's. BL-080 (redacting routes and customer names) stays deferred by the owner. BL-081's guards are DEV-031, the next commits of the same PR. No database, no hosted service.
- **Required acceptance criteria:**
  1. `~/GoProceed-private/outputs/` holds all 250 files of the session directory, byte-identical to their git blobs at `bbfc705` and at the baseline (blob id per file), with a `MANIFEST.sha256` that `shasum -a 256 -c` accepts, and no entry in the folder carries a group or other permission or an ACL (amended after review, S1-04: first evidenced for the root only).
  2. The session directory is no longer tracked: `git ls-files outputs` lists only `outputs/README.md`.
  3. `outputs/README.md` is a pointer: the location, the file count and size, the manifest's checksum and how to check it, the history clause (`bbfc705`, no rewrite, owner 2026-09-15), a rule never to upload or copy the data back; and it contains no personal data (no name, email, phone, tax number or customer of the session).
  4. BL-079 reads `closed → DEV-030`; BL-080's evidence says where its files now are; STATUS «Outreach» and «Next action» agree; `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  5. Nothing tracked depends on the removed files: `git grep` for `outputs/` and the session id finds only prose, the pointer's own link, and the validator's two `outputs/` exemptions (which DEV-031 removes); and `pnpm turbo run typecheck --force` passes as the regression check (amended after review, R1-05: typecheck alone never sees `outputs/`).
  6. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-architect`, `gp-ui-reviewer`, `gp-mobile` (see above).

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-15 | BL-079: move the directory to private storage behind a pointer README; the data stays in `bbfc705` without a history rewrite | [DEV-012](DEV-012-m0-gate12-evidence.md) Owner decisions |
| 2026-09-23 | Storage is a local folder outside the repository, e.g. `~/GoProceed-private/outputs/`; copy with a SHA-256 manifest and verify before `git rm`; the pointer README names the location, the checksum and that `bbfc705` still holds the data, and carries no personal data; the owner makes the backup; never upload the data anywhere external | session brief |
| 2026-09-23 | Clusters «Данные» (BL-079 + BL-081) then «Evidence»; one PR per cluster; each backlog entry its own DEV record and commits | session brief |

## Plan

1. Copy the session directory from git (`git archive HEAD`, so the copy is the tracked bytes, not whatever the working tree holds) into `~/GoProceed-private/outputs/`; write `MANIFEST.sha256`; `chmod 700` the root. Check: `shasum -c` and a blob-id comparison against `bbfc705` and the baseline (`scratchpad/verify-copy.sh`).
2. `git rm -r` the session directory; rewrite `outputs/README.md` as the pointer. Check: `git ls-files outputs`; a personal-data scan of the pointer.
3. BACKLOG BL-079 and BL-080, STATUS, the task index. Check: validators, typecheck.
4. `gp-reviewer` + `gp-security` → stated fixes → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoped (coordinator) on `44e05cd` | Highest task number on `origin/main` and every remote branch: DEV-029 (the main checkout's uncommitted `DEV-029-mobile-native.md` collides with main's DEV-029 and is not this session's). This PR takes DEV-030 (BL-079) and DEV-031 (BL-081). `outputs/` tracks 251 files: the session directory's 250 (312,542,484 bytes, unchanged since `bbfc705`: `git diff --stat bbfc705 HEAD` on it is empty) and `README.md`. Files elsewhere that name the session: only `docs/BACKLOG.md` | `git ls-tree -r -l HEAD outputs/…`; `git grep -l 01a033d9` | Copy |
| 2 | implementing (coordinator): the copy | `git archive HEAD <dir> \| tar -x` into `~/GoProceed-private/`; the DEV-007 README saved beside it as `README-DEV-007-2026-09-14.md`; `MANIFEST.sha256` (250 lines, `shasum -a 256`, paths relative to `~/GoProceed-private/outputs/`); root `drwx------`. **Verified:** `shasum -c` 250 OK, 0 not OK; blob ids 250 of 250 equal at `44e05cd` and at `bbfc705`; bytes 312,542,484 both sides. Manifest SHA-256 `22dbc4d990180ce4b44e5321eb75961a5d2db4ce42cd86c9bd97dd8951df3e94` | `scratchpad/dev030-copy-verify.txt`, `dev030-copy-verify-bbfc705.txt` (each with HEAD and exit 0) | `git rm` |
| 3 | implementing (coordinator): the removal and the pointer | `git rm -r -q` the session directory (250 deletions); `outputs/README.md` rewritten as the pointer. BL-079 closed; BL-080's evidence annotated with the move; STATUS «Outreach» row, «Next action» items 1–3 (item 1 and item 3's BL-109 clause were stale: DEV-024 merged in #105, `0514602`), and the preamble (its DEV-022 to DEV-026 sentences were garbled by a merge; rebuilt from `docs/tasks/README.md` and those tasks' records — no clean copy exists in any branch, R1-02) | this diff | Runs |
| 4 | implementing (coordinator): runs over `44e05cd` + the working tree, committed as `0d2de1f` | Pointer scan: no email, phone, 8–10-digit number or Cyrillic word in `outputs/README.md`; `git ls-files outputs` lists only it. `pnpm validate:canonical-docs` OK; `pnpm validate:agents` 16 profiles. `pnpm turbo run typecheck --force` first failed in `@goproceed/ui` (`three` not found: the worktree's `node_modules` dated from 2026-09-06, before `three` was added); after `pnpm install --frozen-lockfile`, 10/10 | `scratchpad/dev030-pointer-scan.txt`, `dev030-canonical-docs.txt`, `dev030-agents.txt`, `dev030-typecheck-stale-node-modules.txt`, `dev030-typecheck.txt` | Commit; `gp-reviewer`, `gp-security` |
| 5 | reviewing (`gp-reviewer`, `gp-security`, native) on `0d2de1f` | **`gp-reviewer`: APPROVE** — no blocker, major or medium. R1-01 low (BL-080's Resume still offers the `discovery/` store, inside every clone), R1-02 low (the rebuilt DEV-022 sentence omitted item 4's deploy note; provenance unstated), R1-03 low (BL-079 said DEV-031 «followed» before it exists), R1-04 low (the manifest does not cover the saved README), R1-05 nit (typecheck never sees `outputs/`: evidence the absence of dependants by `git grep`), R1-06 nit («Данные» unglossed in English), R1-07 nit (the Outreach row lacks «on its branch»; the record's state), R1-08 nit (BL-080's inserted date reads as a measurement date). **`gp-security`: PASS** — no personal data in anything added; the copy check sound for integrity. S1-01 medium (the residual list omits the GitHub remote, whose cached views and PR refs outlive a force-push, and the agent transcripts sent to a model provider), S1-02 medium (= R1-01), S1-03 low (the pointer does not keep agents out of the folder or out of history), S1-04 low (only the root's mode evidenced), S1-05 low (no purpose, retention or backup rule for the copy; erasure cannot reach history), S1-06 low (= R1-03; CI does not enforce the validator until October), S1-07 info (= R1-04). Its list of what DEV-031 must cover is taken into DEV-031 | review reports | Stated fixes |
| 6 | rework (coordinator), stated fixes | S1-01: «What is not true» names the GitHub remote, the agent transcripts and model provider, and Vercel's Git builds; the pointer's history bullet names the remote and GitHub Support (GitHub's guide, Sources). S1-02 / R1-01: BL-080's `discovery/` option marked superseded. S1-03: the pointer's «Agents stay out» bullet; the enforcing deny rule is BL-123 (an agent-instructions change, not made here). S1-04: `chmod -R go-rwx ~/GoProceed-private`: 257 entries had group or other bits before, 0 after, 0 ACLs, root `drwx------`, the manifest still verifies. S1-05: the pointer's backup row (encrypted media the owner holds, never a sync service) and a retention clause pointing at BL-122 (deferred, owner); «What is not true» gains it. S1-06 / R1-03: «BL-081's guards are DEV-031, in the same pull request»; CI enforcement is in DEV-031. S1-07 / R1-04: «one line per session file (250); the saved README is outside it». R1-02: DEV-022's sentence names item 4; the provenance stated in row 3. R1-05: criterion 5 amended; `git grep` evidence. R1-06: glossed. R1-07: «on its branch, unmerged»; state set. R1-08: «measured by DEV-007 at `d8a860a`» | `scratchpad/dev030-permissions.txt`, `dev030-references.txt`; this diff | `gp-security` re-check (S1-01, S1-02); `gp-qa` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1-01 | medium | the record's «What is not true»; the pointer's history bullet | Actual: GitHub remote, agent transcripts, Vercel builds unnamed | coordinator | Named (row 6) |
| S1-02 / R1-01 | medium / low | BL-080 Resume | Actual: offers moving the data back inside a clone | coordinator | Superseded (row 6) |
| S1-03 | low | the pointer | Actual: agents not told to stay out of the folder and history | coordinator | «Agents stay out» (row 6); enforcement BL-123 |
| S1-04 | low | criterion 1 | Actual: only the root's mode shown | coordinator | `chmod -R go-rwx`; 0 entries, 0 ACLs (row 6) |
| S1-05 | low | the pointer; «What is not true» | Actual: no purpose, retention or backup rule | coordinator | Backup row; BL-122 (deferred, owner) |
| S1-06 / R1-03 | low | BL-079 closure | Actual: DEV-031 stated as done | coordinator | Reworded (row 6) |
| S1-07 / R1-04 | info / low | the pointer's manifest row | Actual: overstated coverage | coordinator | Reworded (row 6) |
| R1-02 | low | STATUS preamble | Actual: DEV-022's item 4 omitted; provenance unstated | coordinator | Fixed (rows 3, 6) |
| R1-05 | nit | criterion 5 | Actual: typecheck cannot show the absence of dependants | coordinator | Amended; `git grep` (row 6) |
| R1-06 | nit | STATUS item 1 | Actual: Russian unglossed | coordinator | Glossed |
| R1-07 | nit | STATUS Outreach row; the record's state | Actual: no branch qualifier | coordinator | Added |
| R1-08 | nit | BL-080 Evidence | Actual: date read as a measurement date | coordinator | Reworded |

Rework count and hypothesis changes: none counted — no QA FAIL, no blocker; the fixes precede QA.

## What is not true after this task

- **The data is still in git.** Commit `bbfc705` holds every file, and every clone, worktree and CI checkout made from it holds them too. Removing them from history is a separate owner decision (force-push; every clone re-made).
- **The GitHub remote still holds the data**, in `bbfc705` on `main`'s history; a force-push alone would leave cached views and pull-request references reachable until GitHub Support removes them (S1-01).
- **Agent sessions that read the directory before the move** (DEV-007's review among them) left local transcripts, and what they read went to the model provider. Vercel's Git builds clone the repository; whether Vercel keeps the source was not checked.
- **No backup is recorded, and no purpose or retention date.** The private folder is one copy on one disk until the owner makes the backup; an erasure request can reach it and its backups, not `bbfc705` or the remote (BL-122). Whether Time Machine or FileVault cover the disk was not checked.
- **Only prose keeps agents out of the private folder** (BL-123).
- **The worktrees on this machine still hold copies.** Any worktree checked out before this change has the session directory in its working tree until it moves past this commit or is removed; the main checkout is on another agent's branch and is not touched here.
- **BL-080 is not done.** The outreach routes and the tender-title customers are unredacted, now in the private copy; the owner deferred that decision.
- **Nothing stops a repeat yet** — until DEV-031's commits in the same PR.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- GitHub Docs, «Removing sensitive data from a repository» — https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository; no page date shown; accessed 2026-09-23. Relied on for: a rewrite plus force-push leaves commits reachable elsewhere; cached views and pull-request references are removed through GitHub Support; other users' clones and forks keep the data.

No installed library's behaviour is relied on. `shasum` is the macOS system Perl script (`shasum -a 256`, `-c`, `--quiet`); `git archive`, `git ls-tree` and `git hash-object` are git's own.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
