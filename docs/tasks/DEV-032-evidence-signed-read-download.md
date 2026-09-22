# DEV-032 — BL-089: evidence is served only as its detected type, and member-plane reads are issued as downloads

## Assignment

- **Objective and user-visible outcome:** an office member's signed read URL for evidence can no longer render an uploader-chosen, scriptable content type on the Storage origin. Finalization refuses an object whose stored content type is not the type detected from its bytes (added after review, when the second control proved strippable), and every signed read `evidence-storage.ts` issues passes `download: true`, so Storage answers `Content-Disposition: attachment`: a navigation to the URL as issued saves the file, and the photo in the evidence card (`<img>`) shows as before.
- **State:** reviewing
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a bounded bug with an understood cause: coordinator → `gp-reviewer` + `gp-security` → `gp-qa`. A failing test first.
- **Triggered stages and why:** `gp-security` — «evidence storage, signed URLs or uploads». `gp-architect` is not triggered: the `/v1` response keeps its shape (`readUrl` stays a URL string; only its query gains `download=`), no migration, RLS or grant changes, and no error code is added: the rework's `stored_type_mismatch` is a new value of `failureCode`, an uncatalogued free string (`packages/contracts` `string | null`; `failure_code` is unconstrained text), refused through the existing `SCAN_REJECTED` and the existing `intent_authorized → scan_blocked` transition, whose catalog guard «content inspection rejects the bytes» still reads true of a stored-type refusal (R2-04). `gp-ui-reviewer`: no UI file changes; the card's `<img>` is checked in a browser pass. `gp-mobile`: `apps/mobile` reads no `readUrl` (grep).
- **Owning module and allowed edit paths:** `apps/app/src/lib/evidence-storage.ts` (the signing options; `objectInfo` in place of `objectSize`, after review); `apps/app/src/lib/evidence/finalize-upload-intent.ts` (the stored-type check, after review); `apps/app/tests/evidence-storage-read.int.test.ts`, `upload-intents-finalize.int.test.ts`, `telegram-evidence.int.test.ts` (its storage mock); `docs/BACKLOG.md` (BL-089 closed; BL-126 and BL-127 filed); `docs/delivery/production-readiness.md` §12 and `docs/delivery/pilot-execution-runbook.md` §5.12 (dated notes); `docs/STATUS.md`; this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`; `apps/app/AGENTS.md`; `docs/architecture/files-and-storage.md` «Downloads and signed URLs» and «Content validation and malware boundary»; `docs/delivery/production-readiness.md` §12 (the owner's malware acceptance of 2026-09-15, which names BL-089 as a risk path); [DEV-012](DEV-012-m0-gate12-evidence.md).
- **Linked spec, ADR or earlier task:** BL-089; DEV-012. No ADR.
- **Baseline:** `56ceb58`, the head of `claude/data-outputs-private` (PR #108), which this branch `claude/evidence-hardening` stacks on: `docs/BACKLOG.md` ids must run in sequence (the validator), and #108 took BL-122 to BL-125. The code under change is identical at `44e05cd` (`origin/main`); the first measurements were taken there.
- **Dependencies / constraints / out of scope:** the external review route already streams with the detected type, `nosniff` and a sandbox CSP and is unchanged. Out of scope: what BL-126 tracks (hosted Storage measured, a bucket allow-list, a named download, a one-off check of objects finalized before this change). Nothing hosted.
- **Required acceptance criteria:**
  1. Both `createSignedReadUrl` and `createSignedReadUrls` produce URLs whose response carries `Content-Disposition: attachment` and the unchanged bytes, with the hostile type as a positive control (a failing test first; `evidence-storage-read.int.test.ts`, Storage only).
  1a. Finalization blocks (`scan_blocked`, `stored_type_mismatch`, 422 `SCAN_REJECTED`, no evidence row) an upload whose stored content type, case and parameters ignored, is not the detected type, and accepts the detected type in another case or with parameters (a failing test first; `upload-intents-finalize.int.test.ts`). Added after review (R1-01, S1-01, S1-02).
  2. In a browser, against the local stack: before the change, opening a signed URL of an object stored as `image/svg+xml` runs its script; after, the navigation downloads and runs nothing; an `<img>` with the new URL still renders.
  3. Every suite whose path finalizes an upload or signs a read passes (named in the evidence); `pnpm turbo run typecheck --force`, `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  4. BL-089 closed with what stays open (BL-126); §12 and §5.12 carry dated notes without rewriting the owner's accepted risk.
  5. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-architect`, `gp-ui-reviewer`, `gp-mobile` (see above).

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-15 | The pilot's malware position, with member-plane inline reads (BL-089) among the accepted risk paths and «before real customer data enters an environment» among the revisit triggers | `docs/delivery/production-readiness.md` §12 ([DEV-012](DEV-012-m0-gate12-evidence.md)) |
| 2026-09-23 | Cluster «Evidence»: BL-089, BL-088, BL-033, one PR, one record per entry; the coordinator picks and names the DB suites it runs | session brief |

## Plan

1. Measure what Storage sends for a signed read, with and without `download` (local stack). Evidence: `scratchpad/bl089-storage-headers*.txt`.
2. A failing test in `evidence-storage-read.int.test.ts`; then `download: true` on both signing calls.
3. A browser pass (puppeteer, local stack): the `<img>`, and the navigation before and after.
4. Docs; runs; `gp-reviewer` + `gp-security` → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoped (coordinator) on `44e05cd`, then rebased onto `56ceb58` | Callers of the signing functions: the member evidence route (`createSignedReadUrls`) only; `createSignedReadUrl` is used by tests. `readUrl` is consumed only by `evidence-card.tsx` as an `<img src>`; `apps/mobile` does not read it. Measured on the local stack (storage-api v1.69.0, supabase-js 2.112.3), uploading as the field client does (a raw PUT with the claimed type): `text/html` is served back as `text/plain`, `image/svg+xml` and `image/jpeg` as stored, inline; no `X-Content-Type-Options`, no CSP; `download: true` adds `Content-Disposition: attachment;` and changes nothing else. (An SDK upload of a `Blob` stored `application/octet-stream` — not the field client's path.) | `scratchpad/bl089-probe.mjs`, `bl089-storage-headers.txt`, `bl089-storage-headers-put.txt` | Test |
| 2 | implementing (coordinator): red, then green | The test stores an SVG with a script, signs it both ways and asserts `attachment` and the bytes: **red** (`expected '' to match /^attachment\b/`), 6 others passing. `SIGNED_READ_OPTIONS = { download: true }` on both calls, with the measured reason: **green**, 7 of 7 | `scratchpad/dev032-red.txt`, `dev032-green.txt` | Browser |
| 3 | implementing (coordinator): browser pass | Puppeteer 25.8.0 against the local stack, a 1×1 PNG and a scripted SVG: **without `download`**, the `<img>` renders (1×1) and navigating to the SVG's URL **ran its script** (page title set by it); **with `download: true`**, the `<img>` renders (1×1), the navigation aborts into a download (1 file), and no script runs | `scratchpad/dev032-browser.mjs`, `dev032-browser.txt` | Docs, runs |
| 4 | reviewing (`gp-reviewer`, `gp-security`, native) on `b5208a8` | **`gp-reviewer`: CHANGES REQUESTED** (docs only) — R1-01 major: `download` is not in the signature (storage-js appends it to the URL), so a URL holder can strip it and the docs' «no path is open today» is wrong; R1-02 minor: the browser pass signed through supabase-js on a blank page, not through `evidence-storage.ts` and the card; R1-03 minor: the test does not prove the hostile type is served; R1-04 minor: the green run's header names the pre-rebase revision. **`gp-security`: HOLD** — S1-01 medium (= R1-01; the holder can be the uploader, `foreman`), S1-02 low (whether the stripped path runs script depends on which stored types Storage rewrites: unmeasured variants), S1-03 low (the saved file's extension comes from the uploader's type), S1-04 low (hosted measurement untracked) | review reports | Measure S1-02 |
| 5 | implementing (coordinator): measurements | **Strippable, confirmed:** a URL signed with `download: true` and stripped of `download=` returns 200, the stored type, no disposition. **S1-02:** a JPEG-prefixed HTML polyglot PUT as `text/html`, `text/html; charset=utf-8` or ` text/html` is served as `text/plain`, but as `TEXT/HTML` it is served as `TEXT/HTML`; `application/xhtml+xml`, `image/svg+xml`, `text/xml`, `application/xml`, `text/javascript`, `application/hta` and `multipart/x-mixed-replace` are served as stored. **In Chrome, the `TEXT/HTML` polyglot opened by the stripped URL ran its script**; as issued, it downloaded. Storage's `list()` metadata carries the PUT's type verbatim (`IMAGE/JPEG`, `image/jpeg; charset=x`, `TEXT/HTML`; none → `application/octet-stream`). So docs alone would leave an open path: the fix is a stored-type check at finalization | `scratchpad/dev032-strip.txt`, `dev032-variants.txt`, `dev032-polyglot-browser.txt`, `dev032-metadata.txt` | Rework |
| 6 | rework (coordinator): the stored-type check | **Red first:** two tests in `upload-intents-finalize.int.test.ts` — the polyglot stored as `TEXT/HTML` must be `scan_blocked`/`stored_type_mismatch` with no evidence row (red: finalize answered 200), and `IMAGE/JPEG; charset=binary` must pass. (The first attempt skipped: zsh does not split an unquoted variable, so the DB environment never reached the suite; then it failed in setup: the local login roles had no password since the last reset — `node scripts/set-local-app-password.mjs`, the documented `db:local-credentials` half, set the dev values.) `objectInfo` replaces `objectSize` (size and the stored type from the same `list()`), and finalize blocks a passed inspection whose stored type — lowercased, parameters dropped — differs from the detected type; the refusal text is the type-mismatch sentence. The Telegram suite's storage mock records the PUT's type. The storage test gains the `content-type` control (R1-03). **Green**: finalize 21, storage-read 7, storage 7, telegram-evidence 22, finalize-vanishing-bytes 1, field-capture 5, upload-intents-get 9, evidence-read 4, external-evidence 12, evidence-purge 17, concurrency 9, vertical-m2a 10. **One flake:** telegram-evidence failed once at line 856 (two terminal receipts for the exhausted album part, a path that never reaches finalization), then passed nine reruns; the baseline passed five of five — BL-127. Docs: BL-089's closure names both controls and that the flag is advisory; BL-126 re-scoped to P2 (hosted unmeasured; no bucket allow-list; a named download) with BL-089's deadline; §12 and §5.12 notes; the code comment says the flag is unsigned. S1-03: with the stored type now one of the four allowed types, the browser's extension comes from an allowed type; a named download is in BL-126 | `scratchpad/local-credentials.txt`, `dev032-r1-red.txt`, `dev032-r1-finalize.txt`, `dev032-r1-suite-*.txt`, `dev032-flake-mine-*.txt`, `dev032-baseline-telegram-*.txt` | `gp-reviewer` round 2, `gp-security` re-check |
| 7 | reviewing (`gp-reviewer` round 2, `gp-security` re-check, native) on `85de15f` | **`gp-reviewer`: APPROVE** — R1-01 to R1-04 resolved (R1-04: QA to bind the runs to the final revision); R2-01 minor (the title, the index row and «every available object» overclaim; scope it to objects finalized from DEV-032 on), R2-02 minor (only `passed` was checked; `not_required` would skip it), R2-03 minor (the «accepts» test has no positive control), R2-04 minor (the architect rationale and out-of-scope line are stale), R2-05 nit (the stored-type refusal reused the type-mismatch sentence). **`gp-security`: HOLD** — S1-01 to S1-04 addressed; S2-01 medium: cutting the stored type at `;` accepts a comma LIST, and a browser reads the list's last type; S2-02 low: nothing pins that Storage refuses an overwrite after finalization; S2-03 low: «every available object» wider than shown | review reports | Measure S2-01 |
| 8 | rework (coordinator), stated fixes | **S2-01 measured:** a polyglot PUT as `image/jpeg;x=1, TEXT/HTML` is stored and served verbatim, and **its stripped URL ran the script in Chrome**; `image/jpeg, image/svg+xml` and `image/jpeg,TEXT/HTML` are refused by Storage (400); `image/jpeg; a="b", text/html` is served as `text/plain`. **Red first:** a finalize test for the list (with an `objectInfo` positive control) — red, finalize answered 200. **Fix:** `storedTypeIs` — the recorded type in any case, followed only by plain `name=value` parameters (no comma, no quote); applied to every outcome but `blocked`, against the type the row records (R2-02). **S2-02:** a test that re-PUTs `TEXT/HTML` to the original signed upload URL after finalization: refused, `objectInfo` unchanged (passes: it pins Storage's no-upsert behaviour); a comment at `createSignedUpload` says «no `upsert`» is load-bearing. **R2-03:** the «accepts» test asserts the stored `IMAGE/JPEG; charset=binary` first. **R2-05:** the stored-type refusal has its own sentence. **R2-01, S2-03, R2-04:** title, index row, BL-089, §12 scoped to objects finalized from DEV-032 on; BL-126 gains the one-off metadata check; rationale and out-of-scope lines updated. **The Telegram suite's fake `storage.objects` write** used `on conflict do nothing` on keys that repeat across runs and are never removed, so rows an earlier run left with another size made finalization answer `no_content` (11 failures, seen while DEV-033's fixture was tried): it upserts now. **Green:** finalize 23, telegram-evidence 22, storage-read 7, field-capture 5, upload-intents-get 9; typecheck 10/10 | `scratchpad/dev032-list-variants.txt` (+ `dev032-list.mjs`), `dev032-r2-red.txt`, `dev032-r2-suite-*.txt`, `dev032-r2-typecheck.txt` | `gp-security` re-check (S2-01); `gp-qa` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 / S1-01 | major / medium | `download` unsigned | Actual: a holder strips it; docs overclaimed | coordinator | The stored-type check (row 6); docs say the flag is advisory |
| S1-02 | low | stored types Storage keeps | Actual: `TEXT/HTML` and others kept; a stripped URL ran script | coordinator | Measured (row 5); blocked at finalization (row 6) |
| S1-03 | low | the saved file's extension | Actual: from the uploader's type | coordinator | Now an allowed type (row 6); a named download in BL-126 |
| S1-04 | low | hosted measurement | Actual: untracked | coordinator | BL-126 |
| R1-02 | minor | browser pass scope | Actual: not through `evidence-storage.ts` and the card | coordinator | Stated as a limit; the card end to end is QA's harness pass |
| R1-03 | minor | the storage test | Actual: no positive control | coordinator | `content-type` asserted (row 6) |
| R1-04 | minor | evidence revision | Actual: the pre-rebase revision | coordinator | Runs re-done on the rework (row 6); QA binds the final revision |
| S2-01 | medium | the stored-type normalisation | Actual: a comma list passed; its stripped URL ran script | coordinator | Strict `storedTypeIs` (row 8) |
| S2-02 | low | overwrite after finalization | Actual: unpinned | coordinator | Test and comment (row 8) |
| S2-03 / R2-01 | low / minor | «every available object», title, index | Actual: wider than shown | coordinator | Scoped (row 8) |
| R2-02 | minor | `not_required` outcome | Actual: unchecked | coordinator | Every outcome but `blocked` (row 8) |
| R2-03 | minor | «accepts» test | Actual: no positive control | coordinator | `objectInfo` asserted (row 8) |
| R2-04 | minor | record lines 10, 15 | Actual: stale | coordinator | Updated (row 8) |
| R2-05 | nit | refusal sentence | Actual: misdescribed the case | coordinator | Its own sentence (row 8) |

Rework count and hypothesis changes: none counted (no QA FAIL). The hypothesis changed at row 5: a download disposition alone was not enough, because it is not signed.

## What is not true after this task

- **The `download` flag is advisory**: storage-js appends it outside the signature, and a URL holder can strip it. What makes a stripped URL harmless is the stored-type check: every available object is stored as one of the four allowed types. Storage still sends no `nosniff`, and the bucket still accepts any type on upload (BL-126).
- **Evidence finalized before this change is not re-checked**: an object already available with another stored type keeps it; every claim here about available objects is about objects finalized from DEV-032 on. A one-off comparison of Storage metadata with `evidence_objects.media_type` is in BL-126.
- **Hosted Storage was not measured**; the headers and the type rewriting are the local storage API v1.69.0's (BL-126).
- **The browser pass signed through supabase-js on a blank page**, not through `evidence-storage.ts` and the evidence card (R1-02).
- **A PDF opened by a stripped URL renders in the browser's viewer**, as before; inside the owner's accepted risk.
- **Nothing here addresses the content itself**: the owner's 2026-09-15 malware acceptance stands (a polyglot, a crafted image, a PDF with active content).
- **Chrome's PDF viewer on the external plane** is unchanged (the §12 note).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- Supabase JavaScript reference, `createSignedUrl` («Create a signed URL which triggers the download of the asset», `download: true`) and `createSignedUrls` — https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl, https://supabase.com/docs/reference/javascript/file-buckets-createsignedurls; via the Supabase MCP `search_docs`; no page date; accessed 2026-09-23. Installed: `@supabase/supabase-js` 2.112.3, `@supabase/storage-js` 2.112.3, whose `dist/index.d.mts` declares `options?: { download?: string | boolean; … }` on both methods («triggers the file as a download if set to true»).
- Local storage API image `public.ecr.aws/supabase/storage-api:v1.69.0` (the local stack), measured 2026-09-23.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
