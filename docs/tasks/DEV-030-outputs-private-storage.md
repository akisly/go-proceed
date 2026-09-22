# DEV-030 — BL-079: `outputs/` moves to private storage behind a pointer README

## Assignment

- **Objective and user-visible outcome:** the 250 files of prospecting session `01a033d9-c008-7011-bf7b-e1dbd14e2e9d`, which hold personal data of natural persons, leave the tracked tree. They move to a private folder outside every clone, `~/GoProceed-private/outputs/`, with a SHA-256 manifest verified before `git rm`. `outputs/README.md` becomes a pointer that names the location, the manifest checksum and the fact that commit `bbfc705` still holds the data, and carries no personal data itself. Nothing is uploaded anywhere.
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** the owner's decision carried out: coordinator → `gp-reviewer` + `gp-security` → `gp-qa`. The removal changes no executed code, but it deletes tracked personal data and rewrites the canonical status and backlog, and the owner asked for the full route.
- **Triggered stages and why:** `gp-security` — «retention and deletion of personal data». `gp-architect` is not triggered: no migration, RLS, contract, catalog or product retention job changes; the move is a repository-hygiene step the owner ruled. `gp-ui-reviewer` and `gp-mobile`: nothing under their paths changes.
- **Owning module and allowed edit paths:** `outputs/` (the session directory removed, `README.md` rewritten); `docs/BACKLOG.md` (BL-079 closed, BL-080's evidence re-pointed); `docs/STATUS.md` (the «Outreach» row, «Next action» items 1–3, the preamble); this record and `docs/tasks/README.md`. Outside the repository: `~/GoProceed-private/outputs/` (created).
- **Read context and applicable local instructions:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/BACKLOG.md` BL-079, BL-080, BL-081; [DEV-007](DEV-007-design-sources.md) (the personal-data review, S1-01 to S1-09); [DEV-012](DEV-012-m0-gate12-evidence.md) «Owner decisions» (2026-09-15); `.gitignore`'s «Child B discovery» block.
- **Linked spec, ADR or earlier task:** BL-079; DEV-007; DEV-012. No ADR: the owner ruled the option on 2026-09-15.
- **Baseline:** `44e05cd` (`origin/main`, 2026-09-23), branch `claude/data-outputs-private`.
- **Dependencies / constraints / out of scope:** no history rewrite (owner, 2026-09-15). The backup of the private folder is the owner's. BL-080 (redacting routes and customer names) stays deferred by the owner. BL-081's guards are DEV-031, the next commits of the same PR. No database, no hosted service.
- **Required acceptance criteria:**
  1. `~/GoProceed-private/outputs/` holds all 250 files of the session directory, byte-identical to their git blobs at `bbfc705` and at the baseline (blob id per file), with a `MANIFEST.sha256` that `shasum -a 256 -c` accepts, and the folder is readable by the owner only.
  2. The session directory is no longer tracked: `git ls-files outputs` lists only `outputs/README.md`.
  3. `outputs/README.md` is a pointer: the location, the file count and size, the manifest's checksum and how to check it, the history clause (`bbfc705`, no rewrite, owner 2026-09-15), a rule never to upload or copy the data back; and it contains no personal data (no name, email, phone, tax number or customer of the session).
  4. BL-079 reads `closed → DEV-030`; BL-080's evidence says where its files now are; STATUS «Outreach» and «Next action» agree; `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  5. `pnpm turbo run typecheck --force` passes (nothing executed changed; the check guards against an import of the removed files).
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
| 3 | implementing (coordinator): the removal and the pointer | `git rm -r -q` the session directory (250 deletions); `outputs/README.md` rewritten as the pointer. BL-079 closed; BL-080's evidence annotated with the move; STATUS «Outreach» row, «Next action» items 1–3 (item 1 and item 3's BL-109 clause were stale: DEV-024 merged in #105, `0514602`), and the preamble (its DEV-022 to DEV-026 sentence was garbled by a merge and is restored from the index) | this diff | Runs |
| 4 | implementing (coordinator): runs over `44e05cd` + the working tree | Pointer scan: no email, phone, 8–10-digit number or Cyrillic word in `outputs/README.md`; `git ls-files outputs` lists only it. `pnpm validate:canonical-docs` OK; `pnpm validate:agents` 16 profiles. `pnpm turbo run typecheck --force` first failed in `@goproceed/ui` (`three` not found: the worktree's `node_modules` dated from 2026-09-06, before `three` was added); after `pnpm install --frozen-lockfile`, 10/10 | `scratchpad/dev030-pointer-scan.txt`, `dev030-canonical-docs.txt`, `dev030-agents.txt`, `dev030-typecheck-stale-node-modules.txt`, `dev030-typecheck.txt` | Commit; `gp-reviewer`, `gp-security` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

- **The data is still in git.** Commit `bbfc705` holds every file, and every clone, worktree and CI checkout made from it holds them too. Removing them from history is a separate owner decision (force-push; every clone re-made).
- **No backup is recorded.** The private folder is one copy on one disk until the owner makes the backup.
- **The worktrees on this machine still hold copies.** Any worktree checked out before this change has the session directory in its working tree until it moves past this commit or is removed; the main checkout is on another agent's branch and is not touched here.
- **BL-080 is not done.** The outreach routes and the tender-title customers are unredacted, now in the private copy; the owner deferred that decision.
- **Nothing stops a repeat yet** — until DEV-031's commits in the same PR.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

No third-party library or hosted service behaviour is relied on. `shasum` is the macOS system Perl script (`shasum -a 256`, `-c`, `--quiet`); `git archive`, `git ls-tree` and `git hash-object` are git's own.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
