# DEV-040 — BL-126 (the allow-list half): the evidence bucket stores only the four evidence types

## Assignment

- **Objective and user-visible outcome:** an upload PUT to the `evidence` bucket that declares any type but `image/jpeg`, `image/png`, `image/heic` or `application/pdf` is refused by Storage before an object exists, instead of being stored and refused later at finalization. A field client sends the type its grant already allows, so no legitimate upload changes.
- **State:** done
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
| 5 | reviewing (`gp-reviewer`, `gp-security`, native) on `52d6b63` (the five commits plus a merge of `origin/main` 206abec: DEV-035, #110 and #111, landed first; one conflict in the task index) | **`gp-security`: PASS WITH FINDINGS** (S1-01, S1-02 minor; S1-03 to S1-06 info). **`gp-reviewer`: CHANGES REQUESTED** (R1-01 to R1-06 minor, R1-07 and R1-08 nits). No blocker, no major. Both confirmed: only the purge role can call the purge functions; the abandon path answers only for the creator; the purge cannot reach an available object's bytes | review reports; `scratchpad/review1.diff` | Stated fixes |
| 6 | rework (coordinator), stated fixes, tests first | **S1-02** measured first: a multipart PUT to the signed URL with a `text/html` part, with an `image/jpeg` part and a `contentType=text/html` field, or with an untyped part is refused (415 `invalid_mime_type`), an `image/jpeg` part is stored; a POST is not a signed-upload path (403); a TUS create with the signed token and `contentType: text/html` is refused (415) and with `image/jpeg` accepted (201). Five cases added; with the allow-list lifted, the four refusals turn red. **S1-06** the helper refuses to lift an allow-list that is not `0093`'s and restores the literal set. Green: evidence-storage 24 | `scratchpad/dev040-s1-02-probe.txt`, `dev040-s1-02.txt`, `dev040-s1-02-mutant.txt` | Re-review; `gp-qa` |
| 7 | re-review (`gp-reviewer`, native) on `51e31bb` | **CHANGES REQUESTED**: every round-1 finding fixed (S1-03's optional revokes deferred with a reason); new R2-01 minor (the new log lines logged `err.name`, which node-postgres sets to "error" for every database error, so a missing function looked like a misconfigured login), R2-02 to R2-05 nits. Confirmed: a finish error spends no attempt and leaves `exhausted`/`overdue` untouched; rows past the deadline are reclaimed by a later run; `0094` preserves `0092` exactly (`created_by_member_id` is NOT NULL) | re-review report; `scratchpad/review2.diff` | Stated fixes |
| 8 | rework (coordinator), stated fixes | **R2-05** the allow-list constant moved above the helper's doc comment. Green: storage-read 7, finalize 36 | `scratchpad/r2-*.txt` | `gp-qa` |
| 9 | verifying (`gp-qa`, native) on `37b7f11` | **All criteria PASS; CI `verify` NOT RUN (not required).** Its own runs, one suite at a time, none skipped for credentials: purge 24, principal 8, route 13, fencing 10, storage 24, storage-read 7, evidence-read 6, finalize 36, create 23, get 9, vanishing-bytes 1, external-evidence 12, telegram-evidence 22, telegram-processing 17, vertical-m2a 10, concurrency 9; unit 515 (572 before the merge of DEV-035, which removed the PWA's tests); `packages/testing` 0038 section 2; typecheck, docs and agents validators; the live database's roles, grants, functions and constraint; everything its suites revoke, rename or lift restored. Every stated fix in place. New: Q1-01 info (the route's «run failed» line logged the raw error, whose database detail can quote a row), Q1-02 nit (no committed test of the route's request id) | QA report; `scratchpad/qa1-*.txt` | Closing |
| 10 | closing (coordinator) | QA's Q1-01 and Q1-02 belong to DEV-036 and were fixed there | DEV-036 | Push, PR |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1-02 | minor | the other upload shapes | Actual: multipart and TUS unmeasured | coordinator | Measured; five cases; mutant red (row 6) |
| S1-06 | info | `tests/helpers/bucket.ts` | Actual: a crash mid-lift could leave the local bucket open for later runs | coordinator | Fail fast unless the set is `0093`'s; restore the literal set (row 6). The `purge_guard_probe` role is dropped before it is created, so a stale one does not survive the next run |
| R2-05 | nit | `tests/helpers/bucket.ts` | Actual: the constant sat between the helper and its JSDoc | coordinator | Moved (row 8) |

Rework count and hypothesis changes: none counted — no QA FAIL and no blocker; two review rounds fixed minor findings and nits before QA.

## What is not true after this task

- **BL-126 is not closed.** The hosted-Storage measurement, the named download and the stored-type comparison for objects finalized before DEV-032 remain, and the first needs the owner's authorisation.
- **Hosted Storage's matching and caching are unmeasured.** The local storage API v1.69.0 matches exactly and reads the bucket per request; the hosted version was not observed.
- **Objects already stored are not re-checked**: Storage checks the type on upload only. Finalization's stored-type check still guards what becomes evidence.
- **A requirement that allows a fifth type now fails at the PUT** (row 2), with a less specific answer than before. None exists.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. The four stored; nine types refused through the helper and the signed URL; multipart and TUS refused | yes | `37b7f11` | `gp-qa`: evidence-storage 24 (`qa1-evidence-storage.txt`), `qa1-dbstate.txt`; `dev040-red.txt` red first | PASS | |
| 2. The second defence still tested behind the helper; the mutant | yes | `37b7f11` | `gp-qa`: finalize 36, storage-read 7; `dev040-mutant-helper*.txt` | PASS | assisted: the mutant ran before S1-06 and R2-05, which added a fail-fast guard and moved a constant; the lift is unchanged |
| 3. The storage, upload, read, Telegram, purge, concurrency and vertical suites | yes | `37b7f11` | all 16 `qa1-*` suites | PASS | |
| 4. Typecheck, docs, agents | yes | `37b7f11` | `gp-qa` static checks | PASS | |
| 5. CI `verify` | no | — | — | NOT RUN | environmental: GitHub Actions starts no jobs until October 2026 (billing); settled by CI `verify` on the PR head |

## Sources

- Supabase, «Creating Buckets» — «Restricting uploads», https://supabase.com/docs/guides/storage/buckets/creating-buckets, and «Limits», https://supabase.com/docs/guides/storage/uploads/file-limits (via the Supabase MCP `search_docs`, accessed 2026-09-23; undated): per-bucket `allowedMimeTypes`; «If an upload request doesn't meet the above restrictions it will be rejected». The docs do not state case-sensitivity or the handling of parameters; those were measured (row 1).
- Installed: `@supabase/supabase-js` / `storage-js` 2.112.3; the local storage API v1.69.0.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: independent — `gp-architect`, `gp-reviewer` (two rounds), `gp-security` and `gp-qa`, native project agents; the coordinator implemented.
- Verified scope: the scoped criteria on the local storage API v1.69.0; hosted Storage unmeasured (BL-126 stays open).
- Remaining risks / blocked requirements: see «What is not true».
- Next bounded action and owner: the owner — merge the PR; then apply `0090`–`0094` to the hosted project before the production deploy that carries this build, set the purge login's password and `PURGE_DB_URL` and `CRON_SECRET` (Production only), per `infra/README-staging.md` §3.3.
- Final state and reason: done — every required criterion PASS on `37b7f11`; CI not required. BL-126 stays open for its hosted half.
