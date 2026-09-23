# DEV-033 — BL-088: image size limits at finalization, read from the header

## Assignment

- **Objective and user-visible outcome:** an uploaded image cannot become evidence when it declares a bitmap too large to decode safely, when its size cannot be read, or when it is an animated PNG. Finalization reads the declared size from the header without decoding it and refuses such an image with its own sentence; phone photos up to 200 MP and panoramas up to about 63 MP pass. `files-and-storage.md` «Content validation and malware boundary» asks for «image dimension/pixel-count and decoding-resource limits».
- **State:** done
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
| 3 | implementing (coordinator) | Unit tests extended (red, 6 of 22), then the parser: `jpegDimensions` (libjpeg walk, one frame before SOS), PNG IHDR, `isAnimatedPng` (`acTL` before IDAT), `heicDimensions` (box walk; `itemTypes` from `iinf`, `itemExtents` from `iloc` v0–2, grid/overlay output sizes from `idat` or the file), `MAX_STRUCTURE_ENTRIES` 1,000; limits 268,402,689 / 65,535; codes `image_dimensions_exceeded`, `image_dimensions_unreadable`, `image_animated`; policy `m2a-magic-bytes-2`: **green, 22 of 22**. **Real files:** 83 (every tracked JPEG and PNG; HEIC made by `sips` from tracked images, six of them grids, one 16,000 × 12,000): every size equal to `sips`'s, none blocked. `scanRejectedDetail` gives each code its sentence. Fixtures: the eleven-byte JPEG (SOI + a truncated APP0) and nine-byte PNG, in 12 test files and both QA harnesses, become SOI + a 1×1 frame + EOI and a signature + IHDR; two finalize tests added (over-size PNG, size-less JPEG) and the policy assertion moved to `-2`. The Telegram suite then failed 11 cases with `no_content`: its fake `storage.objects` write used `on conflict do nothing` on keys that repeat across runs, so rows left by earlier runs at 11 bytes no longer matched — fixed in DEV-032's round 2 (an upsert). **Suites:** inspection unit 22, evidence-service 1, finalize 25, storage-read 7, storage 7, telegram-evidence 22, finalize-vanishing-bytes 1, field-capture 5, upload-intents-get 9, evidence-read 4, external-evidence 12, evidence-purge 17, concurrency 9, vertical-m2a 10 | `scratchpad/dev033-unit-all.txt`, `dev033-real-files.txt` (+ `dev033-real.test.ts`), `dev033-suite-*.txt`, `dev033-checks.txt` (typecheck 10/10, validators) | Commit (`36cc4a7`); reviews |
| 4 | reviewing (`gp-reviewer`, `gp-security`, native) on `36cc4a7` | **`gp-security`: HOLD** — S1-01 major: the limit bounds the declared size, not the decoding cost; a flat 1-bit PNG at 16,383² (~33 KB) decodes to ~1 GB in every browser, and the texts claimed bombs were stopped; S1-02 major (= `gp-reviewer` R1-01): a malformed `iinf` (trailing bytes, over 1,000 entries) read as «no items» (`?? []`) hides a grid — fail-open; S1-03 minor: `isAnimatedPng` fails open (1,000 chunks, an overrun, no IDAT); S1-04 minor: duplicate boxes and item ids resolved arbitrarily; S1-05 minor (= R1-05): a top-level `moov` (an image sequence) never sized; S1-06 minor: JPEG MPF secondary images are a size channel with no entry; S1-07 info: markers libjpeg refuses are skipped; S1-08 info: stale fixture comments. **`gp-reviewer`: CHANGES REQUESTED** — R1-01 major (= S1-02), R1-02 minor (the unit fixtures cover one `iloc` layout), R1-03 minor (the oversize sentence advised against the very captures the limits admit), R1-04 low (stale comments), R1-05 low (the leftover decoding gaps have no entry; `moov`), R1-06 low (the real-file run named a pre-commit revision) | review reports | Stated fixes |
| 5 | rework (coordinator), stated fixes | **Red first:** the unit tests gain the `iloc` layouts of R1-02 (v0 with a file offset into `mdat`, v2, base and index sizes, 8-byte fields, a 16-bit grid, a readable overlay, a largesize `meta` — these passed at once: the reader already handled them, now pinned) and the fail-open cases: trailing bytes in `iinf`, an `entry_count` that disagrees, a duplicate item, two `iloc`s, two `meta`s, a top-level `moov`, 1,001 boxes; reserved, DHP and JPG markers and a second SOI; a PNG without IDAT, with a length past the end, with 1,000 chunks before IDAT — **red, 3 tests**. **Fix:** `itemTypes` refuses a broken or miscounted entry list and a duplicate id; `itemExtents` a duplicate id; `only()` refuses a second `meta`, `iprp`, `ipco`, `iinf`, `iloc`, `idat`; a top-level `moov` is refused; JPEG markers are allowlisted as libjpeg reads them before a scan; a PNG must walk to its first IDAT within 1,000 chunks, and the animation check reads that walk (S1-03). **Green, 27.** The int tests' PNG fixture becomes a real 1×1 PNG with IDAT and IEND (69 bytes, read by `sips`). **R1-03:** «Зображення завелике: понад 268 мегапікселів або 65 535 пікселів по стороні. Зменште його або надішліть звичайне фото.» **R1-04 / S1-08:** comments in both harnesses and the finalize test. **S1-01:** BL-088's closure, BL-129 (retitled; the attacker path, every browser, the pixels-per-byte floor as an owner option), §12 and «What is not true» say the limit bounds the declared size, not the cost. **S1-06 / R1-05:** BL-132. **R1-06:** real files re-run on the rework — 83 of 83 equal to `sips`, none blocked. **Suites:** unit 37 (inspection, stored-type, storage), finalize 25, purge 17, get 9, telegram 22, field-capture 5, evidence-read 4, external 12, concurrency 9, vertical-m2a 10, vanishing-bytes 1, storage 8, storage-read 7; typecheck 10/10 | `scratchpad/dev033-r1-red.txt`, `dev033-r1-unit.txt`, `dev033-r1-real-files.txt`, `dev033-r1-suite-*.txt`, `dev033-r1-checks.txt` | `gp-security` re-check (S1-01, S1-02); `gp-qa` |
| 6 | reviewing (`gp-security` re-check, native) on `946a5de` | **PASS** — S1-01, S1-02, S1-03, S1-05, S1-07, S1-08 resolved; S1-04 resolved in code but not pinned; S1-06 tracked (BL-132). New: S2-01 minor (three gate texts implied only export blocks gate 12), S2-02 minor (the duplicate-id checks were never reached by a test: the fixture failed earlier on its entry count), S2-03 info (an `iloc` entry with no extent escaped the duplicate check), S2-04 info (the marker comment was wrong about DNL), S2-05 info (IHDR's length unchecked) | re-check report | Stated fixes |
| 7 | rework (coordinator), stated fixes | **S2-02, S2-03 red first:** the builder's entry count follows its `infe`s; new cases — a later `infe` reusing the grid's id as `hvc1`, a duplicate `iloc` entry with one extent and with none, a second `iprp`, a second `idat`, an IHDR of 14 bytes: red on the no-extent case; then the id check moves before the extent loop (a `seen` set). **Mutants:** removing `itemTypes`' duplicate check → 1 red; removing `itemExtents`' → 1 red; restored. **S2-05:** IHDR must declare 13 bytes. **S2-04:** the comment says DNL is refused although libjpeg would skip it — stricter, never looser. **S2-01:** §12's gate annotation, §5.12's note and the STATUS «M0 gates» row say BL-129 and BL-132 remain for the gate. Unit 27 | `scratchpad/dev033-r2-red.txt`, `dev033-r2-mutants.txt`, `dev033-r2-*.txt` | `gp-qa` |
| 8 | verifying (`gp-qa`, native) on `33b3cbd` | **Verified for the scoped criteria:** 1–5 PASS, 6 NOT RUN (not required). Its own runs: unit 27; 17 adversarial probes (hostile APPn and COM segments in real JPEGs, an appended fake MP4, a flat 16,383² PNG of 32,695 bytes that passes — BL-129 measured —, grids placed through `iloc` method 0 and real ImageIO grids rewritten to 60,000², all refused); truncation at every length of seven real files (~208,000 prefixes: none passed with a wrong size); a differential fuzz of 9,000 header mutants against `sips` (never a smaller size than ImageIO reads; 22 cases larger — over-refusal only); 8 mutants, 6 red; the real files 83 of 83; 12 finalize-path suites (129 tests); the app browser harness 9 of 9 at HEAD; typecheck; validators. New: Q1-01 low (the S2-05 test passed with the length check removed: a misaligned walk refused it anyway), Q1-02 info (§5.12's closure condition narrower than §12 and STATUS), Q1-03 info (the parser can over-refuse, never under-refuse — BL-131) | QA report; `scratchpad/qa-dev033-*.txt` | Closing |
| 9 | closing (coordinator), stated fixes after QA | Q1-01: the case now declares and carries a 14-byte IHDR, and an «IEND before any IDAT» case is added; with the length check removed (M4) the test turns red, restored. Q1-02: §5.12 names BL-129 and BL-132. Unit 27. Applied after QA; not re-verified by an independent stage (a test and a sentence) | `scratchpad/dev033-q1-fix.txt` | Push, PR |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1-01 | major | the closure texts | Actual: claimed bombs stopped | coordinator | Reworded; BL-129 carries the cost (row 5) |
| S1-02 / R1-01 | major | `iinf` `?? []` | Actual: fail-open | coordinator | Refused; entry count checked (row 5) |
| S1-03 | minor | `isAnimatedPng` | Actual: fail-open | coordinator | The PNG walk must reach IDAT (row 5) |
| S1-04 | minor | duplicates | Actual: resolved arbitrarily | coordinator | Refused (row 5) |
| S1-05 / R1-05 | minor / low | `moov`; leftover gaps | Actual: unsized; no entry | coordinator | `moov` refused; BL-132 |
| S1-06 | minor | MPF | Actual: no entry | coordinator | BL-132 |
| S1-07 | info | JPEG markers | Actual: skipped | coordinator | Allowlisted (row 5) |
| S1-08 / R1-04 | info / low | comments | Actual: stale | coordinator | Fixed |
| R1-02 | minor | `iloc` fixtures | Actual: one layout | coordinator | Seven layouts pinned (row 5) |
| R1-03 | minor | the oversize sentence | Actual: wrong advice | coordinator | Rewritten |
| R1-06 | low | evidence revision | Actual: pre-commit | coordinator | Re-run (row 5) |
| S2-01 | minor | gate texts | Actual: export alone implied | coordinator | Reworded (row 7) |
| S2-02 | minor | duplicate-id tests | Actual: never reached | coordinator | Reached; mutants red (row 7) |
| S2-03 | info | no-extent duplicate | Actual: escaped | coordinator | Checked before the extents (row 7) |
| S2-04 | info | marker comment | Actual: wrong about DNL | coordinator | Corrected |
| S2-05 | info | IHDR length | Actual: unchecked | coordinator | Must be 13 (row 7) |
| Q1-01 | low | the S2-05 test | Actual: passed for the wrong reason | coordinator | Rebuilt; M4 red (row 9) |
| Q1-02 | info | §5.12 note | Actual: narrower condition | coordinator | Aligned (row 9) |
| Q1-03 | info | over-refusal | The largest `ispe` wins | coordinator | Recorded; BL-131 |

Rework count and hypothesis changes: the raw-scan hypothesis was replaced before the first commit (row 1). No QA round yet; the review fixes precede QA.

## What is not true after this task

- **No file from a real phone was checked** (BL-131): iPhone HEIF Max and panoramas, Samsung 200 MP, Motion Photos and scroll captures, Pixel Ultra HDR. The real-file check used ImageIO-made HEIC, not an iPhone's.
- **The limits bound the declared size, not the decoding cost.** A bitmap at the limit decodes to about 1 GB, and a flat 1-bit PNG reaches it from about 33 KB (`gp-security` S1-01); every browser decodes it when the evidence card or the review page shows it, and a legitimate 200 MP photo costs the same. HEIC does not show in Chrome, Edge or Firefox. Both are BL-129 (a preview, or an owner-set pixels-per-byte floor).
- **Evidence finalized before this change is not re-checked.**
- **Channels the size check does not read** (BL-132): a JPEG's MPF secondary images (gain maps), which carry their own size; the HEVC stream's own dimensions, not compared with `ispe`; a progressive JPEG's scan count.
- **PDF is not size-checked.**
- **A blocked upload still holds its reserved quota** until the purge (BL-128), and a retry uploads the whole file again.
- **The field clients show the server's sentence**; they did not change, and no client checks size before upload.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. The structural parser, red first | yes | `33b3cbd` | `gp-qa`: unit 27, 17 probes, truncation and differential fuzz, mutants (`qa-dev033-*.txt`); red-first `dev033-red-unit.txt`, `dev033-r1-red.txt`, `dev033-r2-red.txt` | PASS | the S2-05 case was fixed after QA (row 9; M4 red) |
| 2. The three codes; phone captures admitted; PDF and precedence; policy `-2` | yes | `33b3cbd` | `gp-qa`: unit tests and probes (16,383² passes, 16,384² refused, APNG refused in a real favicon) | PASS | — |
| 3. Real files equal to `sips`, none blocked | yes | `33b3cbd` | `gp-qa`: 83 of 83, six grids, 16,000 × 12,000 (`qa-dev033-real-files.txt`) | PASS | ImageIO HEIC, not a phone's (BL-131) |
| 4. Finalize end to end; the finalize-path suites | yes | `33b3cbd` | `gp-qa`: 12 suites, 129 tests; the app harness 9/9 at HEAD (`qa-dev033-app-harness.txt`) | PASS | local stack only |
| 5. Typecheck; validators | yes | `33b3cbd` | `gp-qa`: typecheck 10/10; both validators | PASS | — |
| 6. CI `verify` | no | — | — | NOT RUN | environmental: GitHub Actions starts no jobs until October 2026; settled by CI `verify` on the PR head |

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

- Changed / inspected files: `apps/app/src/lib/evidence-inspection.ts` (+ test); `apps/app/src/lib/evidence/finalize-upload-intent.ts`; the fixtures in 12 test files and both QA harnesses; `docs/BACKLOG.md` (BL-088; BL-128 to BL-132); `production-readiness.md` §12; runbook §5.12; `docs/STATUS.md`; this record; the index. Commits `36cc4a7`, `946a5de`, `22958ea`, and the closing commit.
- Review independence: independent — `gp-mobile` before design, `gp-reviewer` (CHANGES REQUESTED, stated fixes), `gp-security` (HOLD, then PASS), `gp-qa` on `33b3cbd`, all native subagents.
- Verified scope: criteria 1–5 PASS; 6 NOT RUN, not required.
- Remaining risks / blocked requirements: «What is not true»; BL-129 (the decoding cost; P2), BL-131 (phone files; owner), BL-128 (quota; owner), BL-130, BL-132. The limits were set by the coordinator on `gp-mobile`'s advice and are the owner's to revise.
- Next bounded action and owner: owner — the limits, BL-128 and BL-131's files; review and merge the stacked pull request after #108.
- Final state and reason: done — every required criterion PASS; every finding fixed or filed.
