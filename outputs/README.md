# Prospecting session outputs — moved to private storage

This directory held the files of one prospecting session, `01a033d9-c008-7011-bf7b-e1dbd14e2e9d` (2026-08-24 and 2026-08-25). They include personal data of natural persons, which the project's own rule keeps out of git ([BL-079](../docs/BACKLOG.md#bl-079)). On 2026-09-15 the owner decided to move them to private storage behind this pointer, without rewriting history. [DEV-030](../docs/tasks/DEV-030-outputs-private-storage.md) carried out the move on 2026-09-23.

Nothing else belongs here.

## Where the files are

| | |
|---|---|
| Location | `~/GoProceed-private/outputs/` on the owner's machine, outside every clone and worktree |
| Contents | the session directory `01a033d9-c008-7011-bf7b-e1dbd14e2e9d/` (250 files, 312,542,484 bytes); `MANIFEST.sha256`; the description this README carried before the move, as `README-DEV-007-2026-09-14.md` |
| Manifest | `MANIFEST.sha256`: one `shasum -a 256` line per session file (250), paths relative to `~/GoProceed-private/outputs/`; the saved README is outside it |
| Manifest checksum | SHA-256 `22dbc4d990180ce4b44e5321eb75961a5d2db4ce42cd86c9bd97dd8951df3e94` |
| Checked against | the git blob of every file at `bbfc705` and at `44e05cd` (250 of 250 equal) |
| Permissions | owner only: the folder and everything in it carry no group or other permission, and no ACL (2026-09-23) |
| Backup | the owner's to make and keep, on encrypted media the owner holds; never a sync or cloud service (iCloud, Google Drive, Dropbox or the like). None is recorded here |

Only the owner checks the copy:

```bash
cd ~/GoProceed-private/outputs && shasum -a 256 MANIFEST.sha256 && shasum -a 256 -c --quiet MANIFEST.sha256
```

The first line must print the checksum above; the second prints nothing when every file matches.

## What the move did not change

- **History still holds the data.** Commit `bbfc705` (2026-08-28) added the directory, and the GitHub remote and every clone of the repository still contain it there. The owner decided on 2026-09-15 not to rewrite history. Rewriting it would be a separate decision: a force-push, every clone and worktree re-made, and a request to GitHub Support to remove cached views and pull-request references, which a force-push alone leaves reachable.
- **The private copy is personal data too.** Never upload it, share it, attach it or paste from it into any external service, issue, pull request or agent prompt. Never copy it back into a clone.
- **Agents stay out.** An agent session does not open, list, search or hash anything under `~/GoProceed-private/`, and does not read or restore the directory from history (`git show bbfc705:outputs/…`, `git checkout bbfc705 -- outputs/…`: a checkout stages it again). What a session reads goes to its model provider.
- **The open decisions stay open.** How the outreach routes and the tender-title customers are handled is BL-080, deferred by the owner. The copy's purpose, retention date and backup, and how an erasure request would be honoured, are BL-122.
