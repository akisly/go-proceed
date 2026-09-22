# DEV-033 — BL-088: image size limits at finalization, read from the header

## Assignment

- **Objective and user-visible outcome:** an uploaded image cannot become evidence when it declares a bitmap too large to decode safely, when its size cannot be read, or when it is an animated PNG. Finalization reads the declared size from the header without decoding it and refuses such an image with its own sentence; phone photos up to 200 MP and panoramas up to about 63 MP pass. `files-and-storage.md` «Content validation and malware boundary» asks for «image dimension/pixel-count and decoding-resource limits».
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** new behaviour inside existing boundaries: `gp-mobile` before design (it changes what a field capture may be) → coordinator → `gp-reviewer` + `gp-security` → `gp-qa`. Failing tests first.
- **Triggered stages and why:** `gp-mobile` — the field client's capture behaviour (a capture can now be refused for its size). `gp-security` — «evidence storage, signed URLs or uploads». `gp-architect` is not triggered: no migration, RLS or contract shape changes; the new values of `failureCode` are uncatalogued free strings refused through the existing `SCAN_REJECTED` and the existing `intent_authorized → scan_blocked` transition. `gp-ui-reviewer` is not triggered: no UI file or `technical/copy-catalog.csv` changes; the refusal sentences are server problem details, which the catalog holds none of (checked: no finalize or upload detail is catalogued).
- **Owning module and allowed edit paths:** `apps/app/src/lib/evidence-inspection.ts` (+ a new unit test); `apps/app/src/lib/evidence/finalize-upload-intent.ts` (the refusal sentences); the JPEG and PNG fixtures in `apps/app/tests/*.int.test.ts`, `apps/app/src/lib/evidence/evidence-service.test.ts`, `apps/app/qa/field.mjs` and `apps/mobile/qa/field-web.mjs` (a header the size check can read); `docs/BACKLOG.md` (BL-088 closed; BL-128 to BL-131 filed); `docs/delivery/production-readiness.md` §12, `docs/delivery/pilot-execution-runbook.md` §5.12; `docs/STATUS.md`; this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`; `apps/app/AGENTS.md`; `docs/architecture/files-and-storage.md`; ADR-007 (no recompression of the original); `production-readiness.md` §12; [DEV-012](DEV-012-m0-gate12-evidence.md) (BL-088's origin); [DEV-032](DEV-032-evidence-signed-read-download.md) (the stored-type check, the same finalize path).
- **Linked spec, ADR or earlier task:** BL-088. No ADR.
- **Baseline:** `f5a99e3` (DEV-032's last commit, on `claude/evidence-hardening`, stacked on PR #108).
- **Dependencies / constraints / out of scope:** no decoding on the server (and none added); PDF is not an image and is not size-checked; previews (BL-129); the quota a blocked upload holds (BL-128); AVIF detection (BL-130). Nothing hosted.
- **Required acceptance criteria:**
  1. `imageDimensions` reads JPEG by a libjpeg-style segment walk (fill and stray bytes skipped, segments skipped by length, exactly one frame before the first scan, nothing after it read), PNG by IHDR as the first chunk, HEIC by `meta` → `iprp` → `ipco` `ispe` properties plus each grid's and overlay's declared output size through `iinf`/`iloc`/`idat`; a zero edge, a broken structure or no size is null. Unit tests that went red first.
  2. `inspectContent` blocks `image_dimensions_exceeded` (over 268,402,689 pixels or 65,535 px on an edge), `image_dimensions_unreadable` and `image_animated`; admits a 200 MP frame and a 16,600 × 3,800 panorama; leaves PDF and the type-mismatch precedence alone; policy `m2a-magic-bytes-2`.
  3. On real files — every tracked JPEG and PNG, and HEIC made by macOS ImageIO including grids and 16,000 × 12,000 — every size equals `sips`'s and none is blocked.
  4. Finalization end to end: an over-size PNG and a size-less JPEG are `scan_blocked` with their codes and the refusal names the size; every suite on the finalize path passes with fixtures the check can read.
  5. `pnpm turbo run typecheck --force`, `pnpm validate:canonical-docs`, `pnpm validate:agents` pass.
  6. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-architect`, `gp-ui-reviewer` (see above).

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-23 | Cluster «Evidence»: BL-089, BL-088, BL-033, one PR, one record per entry; the coordinator picks and names the DB suites it runs | session brief |

The limits (`gp-mobile`'s Q-1 and Q-2) were set by the coordinator on `gp-mobile`'s recommendation, as engineering values the owner may revise: see «Progress» row 2.

## Plan

1. `gp-mobile` before design: the largest real captures, browser decode limits, HEIC structure, fail-closed safety, the field client's handling of a 422.
2. Unit tests of `imageDimensions`/`inspectContent`, red; the parser; real files.
3. Fixtures the check can read; the refusal sentences; the finalize suites.
4. Docs; runs; `gp-reviewer` + `gp-security` → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | implementing (coordinator), first draft | A draft read JPEG frames by a raw byte scan for SOF markers and HEIC `ispe` by a raw search; unit tests went red first (9 of 13), then green. Replaced before any commit: EXIF, ICC and appended data hold arbitrary bytes, so a raw scan would read random `FF Cx` pairs as frames of any size and refuse ordinary photos; the tests were changed to demand a segment walk and a box walk (red, 3), then green | `scratchpad/dev033-red-unit.txt` | `gp-mobile` |
| 2 | designing (`gp-mobile`, native) | Headline: segment walk, not raw scan (a Motion Photo's appended MP4 would give ~600 false frames); the draft edge limit 16,384 px would refuse a full iPhone panorama (up to 63 MP, ~16,600 px wide); keep a pixel limit. Recommended **268,402,689 pixels** (0x3FFF², sharp/libvips' `limitInputPixels`, so a later thumbnail worker decodes all it admits) and **65,535 px** on an edge (JPEG's format maximum); zero edges unreadable; libjpeg rules (fill and stray bytes, two frames before a scan refused); HEIC grid and overlay output sizes as well as `ispe`; `mdat`/`mpvd` never read as boxes; animated PNG refused; parsing bounded (1,000 entries, as libheif); distinct refusal sentences (the default «Тип вмісту не розпізнано.» would be false); the field clients map `recapture_or_contact_support` to `failed` with no retry loop. Open for the owner: the quota a blocked upload holds (BL-128), previews and HEIC in non-Safari browsers (BL-129), real device files (BL-131). Also AVIF with `mif1` passes as HEIC (BL-130). Adopted: all requirements; the limits as recommended | `gp-mobile` report (sources in «Sources») | Implement |
| 3 | implementing (coordinator) | Unit tests extended (red, 6 of 22), then the parser: `jpegDimensions` (libjpeg walk, one frame before SOS), PNG IHDR, `isAnimatedPng` (`acTL` before IDAT), `heicDimensions` (box walk; `itemTypes` from `iinf`, `itemExtents` from `iloc` v0–2, grid/overlay output sizes from `idat` or the file), `MAX_STRUCTURE_ENTRIES` 1,000; limits 268,402,689 / 65,535; codes `image_dimensions_exceeded`, `image_dimensions_unreadable`, `image_animated`; policy `m2a-magic-bytes-2`: **green, 22 of 22**. **Real files:** 83 (every tracked JPEG and PNG; HEIC made by `sips` from tracked images, six of them grids, one 16,000 × 12,000): every size equal to `sips`'s, none blocked. `scanRejectedDetail` gives each code its sentence. Fixtures: the eleven-byte JPEG (SOI + a truncated APP0) and nine-byte PNG, in 12 test files and both QA harnesses, become SOI + a 1×1 frame + EOI and a signature + IHDR; two finalize tests added (over-size PNG, size-less JPEG) and the policy assertion moved to `-2`. The Telegram suite then failed 11 cases with `no_content`: its fake `storage.objects` write used `on conflict do nothing` on keys that repeat across runs, so rows left by earlier runs at 11 bytes no longer matched — fixed in DEV-032's round 2 (an upsert). **Suites:** inspection unit 22, evidence-service 1, finalize 25, storage-read 7, storage 7, telegram-evidence 22, finalize-vanishing-bytes 1, field-capture 5, upload-intents-get 9, evidence-read 4, external-evidence 12, evidence-purge 17, concurrency 9, vertical-m2a 10 | `scratchpad/dev033-unit-all.txt`, `dev033-real-files.txt` (+ `dev033-real.test.ts`), `dev033-suite-*.txt`, `dev033-checks.txt` (typecheck 10/10, validators) | Commit; reviews |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: the raw-scan hypothesis was replaced before the first commit (row 1).

## What is not true after this task

- **No file from a real phone was checked** (BL-131): iPhone HEIF Max and panoramas, Samsung 200 MP, Motion Photos and scroll captures, Pixel Ultra HDR. The real-file check used ImageIO-made HEIC, not an iPhone's.
- **A legitimate 200 MP photo is admitted and still decodes in full in a desktop browser**, and HEIC does not show in Chrome, Edge or Firefox (BL-129). The limits stop decompression bombs, not the cost of large originals.
- **Evidence finalized before this change is not re-checked.**
- **Decoding cost beyond size is not bounded**: a progressive JPEG with many scans, a PNG's compressed data; the HEVC stream's own dimensions are not compared with `ispe`; MPF secondary images in a JPEG are not read.
- **PDF is not size-checked.**
- **A blocked upload still holds its reserved quota** until the purge (BL-128), and a retry uploads the whole file again.
- **The field clients show the server's sentence**; they did not change, and no client checks size before upload.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

`gp-mobile`'s report, 2026-09-23 (web sources read that day; none has a page date unless given):

- Apple, «About Apple ProRAW» (HEIF Max 48 MP) — https://support.apple.com/en-us/119916; «iPhone 17 – Tech Specs» (Panorama up to 63 MP) — https://support.apple.com/en-us/125089.
- Samsung ISOCELL HP2 (200 MP) — https://semiconductor.samsung.com/image-sensor/mobile-image-sensor/isocell-hp2/.
- Chromium `content/child/blink_platform_impl.cc` (`MaxDecodedImageBytes`) and `third_party/blink/renderer/platform/image-decoders/jpeg/jpeg_image_decoder.cc` — https://chromium.googlesource.com/chromium/src/+/main/.
- WebKit, «WebKit Features in Safari 17.0» (2023-09-18; HEIC) — https://webkit.org/blog/14445/webkit-features-in-safari-17-0/.
- ISO/IEC 23008-12 §6.5.3 (`ispe` mandatory on every image item), as quoted in https://github.com/nokiatech/heif_conformance/issues/11.
- libheif `security_limits.cc` (1,000 items; 32,768² pixels) — https://raw.githubusercontent.com/strukturag/libheif/master/libheif/security_limits.cc.
- Android, «Motion Photo format 1.0» and «Ultra HDR image format» — https://developer.android.com/media/platform/motion-photo-format, https://developer.android.com/media/platform/hdr-image-format.
- sharp, constructor `limitInputPixels` (default 0x3FFF × 0x3FFF) — https://sharp.pixelplumbing.com/api-constructor.

Local: macOS `sips` (ImageIO) made the HEIC samples and gave the reference sizes.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
