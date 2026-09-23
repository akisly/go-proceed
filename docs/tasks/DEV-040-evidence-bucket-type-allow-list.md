# DEV-040 — BL-126 (the allow-list half): the evidence bucket stores only the four evidence types

## Assignment

- **Objective and user-visible outcome:** an upload PUT to the `evidence` bucket that declares any type but `image/jpeg`, `image/png`, `image/heic` or `application/pdf` is refused by Storage before an object exists, instead of being stored and refused later at finalization. A field client sends the type its grant already allows, so no legitimate upload changes.
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a migration touching Storage configuration: `gp-architect` (shared with DEV-036) → coordinator (tests first) → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` — a migration. `gp-security` — evidence storage and uploads. `gp-mobile`: not triggered — the field client's PUT sends `photo.mediaType`, the same value as its `claimedMediaType` (`apps/mobile/src/lib/capture/upload.ts:131`, `:254`), which the grant already restricts to these four; no client change. `gp-ui-reviewer`: not triggered.
- **Owning module and allowed edit paths:** `supabase/migrations/0093_*`; `apps/app/tests/evidence-storage.int.test.ts`; `apps/app/tests/helpers/bucket.ts` (new); the second-defence cases in `apps/app/tests/upload-intents-finalize.int.test.ts` and `apps/app/tests/evidence-storage-read.int.test.ts`; `technical/database/invariant-catalog.csv` (INV-107); `docs/architecture/files-and-storage.md` (content validation); `docs/STATUS.md` (migration marker); `docs/BACKLOG.md` (BL-126, which stays open); this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`; `apps/app/AGENTS.md`; `0020`; DEV-032 (the stored-type check and its tests); `authorize-upload-intent.ts` (`FALLBACK_MEDIA`, rule and template `allowed_media`); `evidence-inspection.ts` (`sniffMediaType`).
- **Linked spec, ADR or earlier task:** BL-126 (DEV-032's reviews R1-01, S1-01 to S1-04). No ADR.
- **Baseline:** `76163f5` (DEV-039) on `claude/storage-purge`.
- **Dependencies / constraints / out of scope:** the owner scoped this to the allow-list only. **Out of scope and still open under BL-126:** the hosted-Storage measurement of signed reads (it needs the owner's authorisation to write a test object to staging), a named download, and the comparison of stored types for objects finalized before DEV-032. Nothing hosted was touched.
- **Required acceptance criteria:**
  1. `0093` sets the bucket's `allowed_mime_types` to exactly the four; Storage stores each of the four and refuses `text/html`, `TEXT/HTML`, `image/svg+xml`, `text/plain`, `application/octet-stream`, `image/webp`, `IMAGE/JPEG`, `image/jpeg; charset=binary` and `image/jpeg;x=1, TEXT/HTML`, through `putObject` (`EvidenceStorageError` «storage: upload failed (InvalidMimeType) [400]») and through a client's own signed URL, and no object exists after — red first.
  2. The defence behind it still holds and is still tested: finalization's stored-type cases, the duplicate-PUT case and the signed read's `attachment` case stage their objects with the allow-list lifted (`withBucketAcceptingAnyType`, which restores it); a mutant that stops lifting turns those five cases red.
  3. The storage, finalize, create, read, external-evidence, Telegram evidence, purge, concurrency and vertical suites pass with `0093` applied.
  4. `pnpm turbo run typecheck --force`, `pnpm validate:canonical-docs`, `pnpm validate:agents` pass.
  5. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-23 | BL-126: only the part «the evidence bucket accepts any content type on upload» — a bucket `allowed_mime_types` for the four accepted types, as a new migration; the hosted-Storage measurement stays open (it needs the owner's authorisation to write to staging) | session brief |

## Plan

1. Measure how storage-api v1.69.0 matches `allowed_mime_types`, on a temporary bucket.
2. Tests red: the configured set, the four stored, nine refused.
3. `0093`; move the second-defence cases behind a helper that lifts the allow-list; green; a mutant on the helper.
4. `gp-reviewer` + `gp-security` on the cluster diff → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | implementing (coordinator): probe | On a temporary bucket `mime-probe` with the four types (deleted after through the Storage API; a direct `delete from storage.buckets` is refused by `storage.protect_delete()`): the four accepted and stored as sent; `IMAGE/JPEG`, `image/jpeg; charset=binary`, `IMAGE/JPEG; charset=binary`, `image/jpeg;x=1, TEXT/HTML`, `TEXT/HTML`, `text/html`, `text/plain`, `image/svg+xml`, `image/webp`, `application/octet-stream`, `image/heif` refused with 415 «mime type … is not supported»; an empty type refused («Invalid Content-Type header»); `image/jpeg ` (trailing space) accepted and stored as `image/jpeg`; a raw PUT with no Content-Type refused (Storage reads it as `application/octet-stream`) | `scratchpad/dev040-mime-probe.txt` | Tests |
| 2 | designing (`gp-architect`, native; DEV-036 row 1) | Accepted. The set is confirmed: `sniffMediaType` passes exactly these four and `FALLBACK_MEDIA` lists them; Telegram takes the three image types. **Behaviour shift:** a requirement rule or template may name another type (its contract admits any lowercase type), whose grant is then issued; such an upload now fails at the PUT, and finalize answers 409 «bytes not uploaded» until the intent expires, instead of 422 `SCAN_REJECTED` — no rule in `technical/requirements` does this today. Hosted: staging applied `0020`'s DML on `storage.buckets`, so the order relative to the app deploy does not matter and existing objects are untouched | architect report | Red |
| 3 | implementing (coordinator): red | evidence-storage 10 of 19 red: the configured set empty, and the nine types stored rather than refused; «stores each of the four» passes before and after, by design | `scratchpad/dev040-red.txt` | Green |
| 4 | implementing (coordinator): green | `0093` applied locally as `postgres` (version recorded). The refusal reaches `putObject` as code `InvalidMimeType` with status 400 (the response body carries 415), so the assertion was set to the exact message. Green: evidence-storage 19, storage-read 7, finalize 34, create 23, evidence-read 6, external-evidence 12, telegram-evidence 22, vertical-m2a 10, concurrency 9, purge 24, purge-route 13, purge-fencing 8, vanishing-bytes 1, upload-get 9. A first finalize run timed out three `beforeEach` hooks at 10 s while the machine's load average stood near 17; the re-run passed 34 of 34. **Mutant:** the helper stops lifting the allow-list → the four finalize cases and the storage-read case red; restored, and the bucket still carries the four. The helper's lift takes effect on the next request, so the local storage API does not cache the bucket's configuration | `scratchpad/dev040-green-*.txt`, `dev040-mutant-helper*.txt` | Commit; reviews |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## What is not true after this task

- **BL-126 is not closed.** The hosted-Storage measurement, the named download and the stored-type comparison for objects finalized before DEV-032 remain, and the first needs the owner's authorisation.
- **Hosted Storage's matching and caching are unmeasured.** The local storage API v1.69.0 matches exactly and reads the bucket per request; the hosted version was not observed.
- **Objects already stored are not re-checked**: Storage checks the type on upload only. Finalization's stored-type check still guards what becomes evidence.
- **A requirement that allows a fifth type now fails at the PUT** (row 2), with a less specific answer than before. None exists.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- Supabase, «Creating Buckets» — «Restricting uploads», https://supabase.com/docs/guides/storage/buckets/creating-buckets, and «Limits», https://supabase.com/docs/guides/storage/uploads/file-limits (via the Supabase MCP `search_docs`, accessed 2026-09-23; undated): per-bucket `allowedMimeTypes`; «If an upload request doesn't meet the above restrictions it will be rejected». The docs do not state case-sensitivity or the handling of parameters; those were measured (row 1).
- Installed: `@supabase/supabase-js` / `storage-js` 2.112.3; the local storage API v1.69.0.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: pending.
- Remaining risks / blocked requirements: see «What is not true».
- Next bounded action and owner: reviews (coordinator).
- Final state and reason: implementing.
