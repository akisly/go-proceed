# DEV-087 — BL-191 and BL-192: the XLSX guard checks the archive the parser reads, and caps its real inflation

## Assignment

- Objective and user-visible outcome:
  - A crafted workbook that the guard passed but JSZip read differently is now refused as `XLSX_MALFORMED`. That covers:
    - uncounted central records;
    - a directory that does not end at its end record;
    - a local name that differs from its central name;
    - a Unicode Path extra field;
    - zip64 records;
    - a later end record;
    - overlapping entries;
    - a name that is not UTF-8.
  - An entry that inflates past its declared size is refused as `XLSX_BOMB_SIZE` before ExcelJS sees it (BL-192). An encrypted entry is refused as `XLSX_ENCRYPTED_OR_LEGACY`. A name JSZip would rewrite (`.` or empty inner segments) is refused as `XLSX_MALFORMED`.
  - The upload route runs the guard only after the caller is authorized (gp-security S1).
  - Workbooks from LibreOffice, openpyxl and Info-ZIP, checked in as fixtures, still pass and parse. None from Excel, Google Sheets or Numbers is tested (below).
- State: reviewing
- Coordinator: Claude Code primary session, 2026-09-25.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): the change touches executed code under `packages/domain` on the import upload path. The route is implementation → `gp-reviewer` + `gp-security` → `gp-qa`.
- Triggered stages:
  - `gp-reviewer` and `gp-qa`: always.
  - `gp-security`: uploads (the import files route), and INV-016's archive limits.
  - `gp-architect` is not triggered: no migration, contract, error code or catalog of states changes; every refusal uses an existing `XlsxGuardError`.
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered. The library behaviour was read from the installed source (below).
- Owning module and allowed edit paths:
  - `packages/domain/src/import/xlsx-guard.ts`, `xlsx.test.ts`, `version.ts`, and `__fixtures__/` (three workbooks, new);
  - `apps/app/app/v1/import-batches/[batchId]/files/route.ts` and `apps/app/tests/imports.int.test.ts` (gp-security S1);
  - `scripts/validate-canonical-docs.mjs` (`UNREADABLE_APPROVED_PATHS` and its comment only, owner);
  - `docs/BACKLOG.md` (BL-203 new);
  - `technical/database/invariant-catalog.csv` (INV-016);
  - `docs/BACKLOG.md` (BL-191, BL-192), this record, and `docs/tasks/README.md`.
- Read context:
  - [DEV-082](DEV-082-xlsx-parse-reads-the-buffer-pool.md) (gp-security S4 and S5, which filed BL-191 and BL-192);
  - jszip 3.10.1 `lib/zipEntries.js` (`readEndOfCentral`, `readCentralDir`, `readLocalFiles`) and `lib/zipEntry.js` (`readLocalPart`, `readCentralPart`, `handleUTF8`), as installed;
  - exceljs 4.4.0 `lib/xlsx/xlsx.js` (`load` calls `JSZip.loadAsync`).
- Linked spec, ADR or earlier task: BL-191; BL-192; INV-016.
- Baseline: `5341a364`, whose tree is `origin/main` after #168.
- Dependencies / constraints / out of scope:
  - The CSV path is unchanged.
  - Any size limit tuning is out of scope; the limits are unchanged.
  - BL-190 (the owner's audit of hosted parses) is separate.
- Required acceptance criteria:
  - AC-1: each divergence BL-191 names, and each one found while reading JSZip, has a crafted archive that the guard refuses. Every such test fails against the guard at the baseline.
  - AC-2: an entry declaring 1 KiB that inflates to 200 MB is refused as `XLSX_BOMB_SIZE` by the guard and by `parseXlsx`, without the memory or time a full inflation takes.
  - AC-3: genuine workbooks still parse: the existing guard and parser cases, the seeded fuzz, workbooks from three writers other than JSZip, and the domain suite pass.
  - AC-6: the upload route refuses an unauthorized caller before the guard runs (gp-security S1).
  - AC-4: `PARSER_VERSION` is bumped (the file's own rule), INV-016 names the new enforcement, and the validator and `typecheck` pass.
  - AC-5: CI green on the pull request, with `xlsx.test.ts` and the import integration suites shown running in the log.
- Skipped stages and rationale: see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | Take the next item after BL-099; BL-191 and BL-192 together, the hardening DEV-082 filed | Coordinator, under the owner's standing order («мержи и давай дальше») |
| 2026-09-25 | The three workbook fixtures, refused by the BL-079 contactPoint guard once pushed, are approved in `UNREADABLE_APPROVED_PATHS` rather than dropped | Owner's answer in the session («Approve the three paths»), after the guard's history clause stopped the stage (row 8) |

## Plan

1. Read JSZip 3.10.1's directory walk and ExcelJS's load path, as installed.
2. Rewrite `listZipEntries` to require the one reading JSZip makes, and inflate each entry with its declared size as the ceiling.
3. A hand-built ZIP writer in the test, one crafted archive per divergence, run against the old guard and the new.
4. Demonstrate each divergence against JSZip itself, and measure the bomb.
5. `gp-reviewer` + `gp-security`, then `gp-qa`; CI.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | Read the installed JSZip 3.10.1.<br>• `readEndOfCentral` takes the **last** end signature in the whole file, re-bases the reader when the directory ends before the end record (prepended bytes), and follows zip64 sentinels.<br>• `readCentralDir` reads records while their signature matches and only warns when the count differs.<br>• `readLocalPart` reads the entry's name from the local header and its data from after the local name and extra.<br>• `handleUTF8` names a non-UTF-8-flagged entry from a Unicode Path extra field (0x7075) when present.<br>ExcelJS 4.4.0's `load` calls `JSZip.loadAsync` and reads entries with `async('nodebuffer')` | `node_modules/.pnpm/jszip@3.10.1/…/lib/zipEntries.js`, `zipEntry.js`; `exceljs@4.4.0/…/lib/xlsx/xlsx.js:279` | Implementation |
| 2 | Coordinator | The guard:<br>• the end record is the last signature in the final 65 557 bytes, and its comment ends the file;<br>• one disk, the record counts equal, no zip64 sentinel, and `cdOffset + cdSize` is the end record;<br>• each central record lies before the end record, names disk 0, has no zip64 or Unicode Path extra field, and a valid UTF-8 name;<br>• each local header is at its stated offset, carries the same name bytes, and its data ends before the directory;<br>• the walk ends exactly at the end record, and no two entries' spans overlap;<br>• an encrypted flag refuses as `XLSX_ENCRYPTED_OR_LEGACY`, a method other than stored or deflate as `XLSX_MALFORMED`;<br>• after the declared checks pass, each entry is inflated with `inflateRawSync(…, { maxOutputLength: max(1, declared) })`. An overrun (`ERR_BUFFER_TOO_LARGE`) refuses as `XLSX_BOMB_SIZE`; a short or broken stream, or a stored entry whose sizes differ, as `XLSX_MALFORMED`.<br>`PARSER_VERSION` is `goproceed-import/1.0.2`: the guard refuses archives 1.0.1 accepted | `git diff` | Tests |
| 3 | Coordinator | Tests: a hand-built ZIP writer, and 11 new cases (10 refusals and a control).<br>• Against the **baseline guard**: the 10 refusals fail; the control passes, by design.<br>• Against the new guard: all 11 pass, and so do the 11 existing ones, including the seeded fuzz: `xlsx.test.ts` 22 of 22; the domain suite 114 of 114; `typecheck` clean for `@goproceed/domain` and `@goproceed/app` | Session output | Demonstration |
| 4 | Coordinator | Each divergence reproduced **against JSZip 3.10.1 itself**, on the crafted archives:<br>• an uncounted record: JSZip lists `xl/worksheets/sheet1.xml` **and `xl/vbaProject.bin`**;<br>• a local name that differs: JSZip lists only `xl/vbaProject.bin`;<br>• a Unicode Path extra field: JSZip lists only `xl/vbaProject.bin`.<br>The baseline guard passed all three as one sheet.<br>**The bomb, measured** (a 398 KiB upload declaring 1 KiB, inflating to 400 MiB, built in a separate process): JSZip inflated all of it before throwing «uncompressed data size mismatch», **peak RSS 479 MiB** from 55; the new guard refused it as `XLSX_BOMB_SIZE` at **peak RSS 69 MiB** from 67. A 20 MiB upload, the size limit, at the same ratio would ask JSZip for about 20 GiB | `scratchpad/jszip-divergence.cjs`, `jszip-bomb-rss.cjs`, `guard-bomb-rss.mts` (outside the repository: the in-repo witnesses are row 3's tests) | Reviews |
| 5 | gp-security | PASS, no blocker or major, on `e8e3f9f9`. The guard closes BL-191 and BL-192 for the installed pair: data descriptors, gaps, duplicate names, CRC, stored entries, the EOCD window, JSZip's signed `readInt`, overflow, extra fields, zip64, disks and re-basing all traced against JSZip's source; every path fails closed; ExcelJS fetches and evaluates nothing. Findings S1–S3, I1–I4 (below) | Subagent report (session) | Fixes |
| 6 | gp-reviewer | HOLD on `e8e3f9f9`: R1, the claim that genuine workbooks pass rested only on JSZip-written ones; R2, the overlap test passed on a name mismatch. Every other point traced against JSZip matched. Findings R1–R7 (below) | Subagent report (session) | Fixes |
| 7 | Coordinator | Fixes:<br>• **S1:** the upload route's format sniffing and guard moved inside the idempotent command, after `authorize`, before the batch is locked; an integration case (CI only) posts a bomb as a `project.view`-only member (403), as a user with no membership (404), and to a batch that does not exist (404);<br>• **S2, R3:** a name JSZip's `utils.resolve` would rewrite is refused; three names tested;<br>• **S3, R4:** the header states the pako-equals-zlib assumption; a genuine workbook is inflated three times (the upload's guard, the validate's guard, JSZip), and `chunkSize` now equals the ceiling, so the guard's output lands in one buffer and its peak is the entry, not twice it;<br>• **I4:** a test pins JSZip 3.10.1;<br>• **R1:** three workbooks from other writers checked in and parsed: **LibreOffice Calc 24.2.7** (data descriptors, the UTF-8 flag), **openpyxl 3.1.5** on Python 3.11 (zipfile), and the LibreOffice file **repacked by Info-ZIP Zip 3.0 through a pipe** (data descriptors, 0x5455 and 0x7875 extra fields, stored directory entries); plus hand-built accepted shapes (a descriptor, 0x5455 and 0x000a extras, duplicate names);<br>• **R2:** the overlap case uses one name; with the overlap check removed it fails;<br>• **R5:** a signature in the final 21 bytes, and a disk-1 end record, refused;<br>• **R7:** `ignoreBOM` makes the guard's names byte-exact; the stricter refusals are kept and listed below.<br>`xlsx.test.ts` 26 of 26; `typecheck` clean for domain and app | Session output | gp-qa |
| 8 | Coordinator | PR #170's first `verify` failed at `validate:canonical-docs`: the BL-079 contactPoint guard refuses the three fixtures as tracked spreadsheets it cannot read. The local validator had passed before they were staged, since it reads tracked files. The guard's clause for a pushed file is to stop and ask the owner; the stage stopped, said so on the PR, and asked. The fixtures hold the three synthetic rows and each writer's metadata («LibreOffice/24.2.7.2», «openpyxl», timestamps), no person. **Owner: approve.** The three paths are in `UNREADABLE_APPROVED_PATHS` with that reason; the validator passes | CI job log; PR comment; session output | gp-security (the approval) |
| 9 | gp-security | The approval: exact literal paths in a `Set`, checked with `Set.has` against `git ls-files` paths; nothing else exempted; the reason accurate. HOLD on procedure only (S1): it could not inflate `openpyxl.xlsx`. The coordinator dumped every part of **the three committed blobs** (`git show f91d1ae4:…`): cell text is only the seven strings «Назва, Од, К-сть, Ціна, Мурування, м2, Штукатурення» with 10, 199.99, 5.5 and 150; `docProps` holds `dc:creator` «openpyxl» or empty, timestamps and the writer names; the sheet is «Кошторис» or «koshtorys»; no comment; every Info-ZIP `ux` field is uid 0, gid 0. S1 is cleared as the reviewer set out. S2 (approval binds the path, not the content) filed as BL-203 (P3); S3 and S4 worded | `scratchpad/fxdump/dump.txt`; subagent report (session) | gp-qa |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1 | minor | `files/route.ts`, the guard before `authorize` | Any signed-in user could make the server inflate up to 100 MB per request | Coordinator | Fixed: the guard runs after authorization; integration case |
| S2 | minor | Names JSZip normalizes | `xl/./macros/…` passed the macro check and reached ExcelJS as `xl/macros/…` | Coordinator | Fixed: non-canonical names refused |
| S3 | minor | The record; the guard's header | «inflated twice»; the pako-equals-zlib assumption unstated | Coordinator | Fixed |
| I1 | info | BOM in names | The guard stripped it, JSZip keeps it | Coordinator | Fixed: `ignoreBOM` |
| I2 | info | The bomb test's memory and time bounds | Weak witnesses; the error code carries the test | — | No action: row 4 holds the peak evidence |
| I3 | info | Writers other than JSZip | Untested | Coordinator | Fixed as R1 for three writers; Excel, Google Sheets and Numbers remain (below) |
| I4 | info | JSZip version drift | Nothing failed on an upgrade | Coordinator | Fixed: a test pins 3.10.1 |
| R1 | major | Genuine-workbook evidence | JSZip-written files only | Coordinator | Fixed for LibreOffice, openpyxl and Info-ZIP |
| R2 | minor | The overlap case | Passed on a name mismatch | Coordinator | Fixed; shown to kill the overlap check |
| R3 | minor | = S2 | | Coordinator | Fixed |
| R4 | minor | Inflation count and peak | Three inflations; peak twice the entry | Coordinator | Record corrected; `chunkSize` halves the guard's peak |
| R5 | nit | End-record and disk cases | The baseline-divergent tail signature and a multi-disk record untested | Coordinator | Fixed |
| R6 | nit | Row 2, row 3, Sources | `max(1, declared)`; the counts; no zlib doc URL | Coordinator | Fixed |
| S1′ | procedure | The approval review | `openpyxl.xlsx` not read at part level | Coordinator | Cleared: every part of the three committed blobs dumped (row 9) |
| S2′ | minor | `UNREADABLE_APPROVED_PATHS` | Bound to the path, not the content | Owner | Deferred to BL-203 (P3) |
| S3′ | nit | The list's header comment | «holds one file» stale | Coordinator | Fixed |
| S4′ | info | The entry's reason | Archiver metadata unnamed | Coordinator | Fixed |
| R7 | info | Refusals stricter than JSZip | Bytes after the comment, a trailing or overrunning extra block, an inert zip64 extra field, a Unicode Path field with the UTF-8 flag set, a zero-length deflate entry, non-UTF-8 names | — | Kept: none is known from a mainstream writer, and each is refused rather than read |

Rework count and hypothesis changes: none.

## What is not true after this task

- The guard now matches the JSZip 3.10.1 and ExcelJS 4.4.0 pair installed. An upgrade of either needs this record's reading repeated.
- A genuine workbook is inflated three times: by the upload's guard, by the validate's guard, and by JSZip. Each is bounded by the declared sizes, at most 100 MB in total, and blocks the event loop while it runs; the time was not measured.
- No workbook from Excel, Google Sheets or Numbers is tested. The guard is stricter than JSZip in the ways R7 lists; a real export refused by one of them would show as `XLSX_MALFORMED`.
- That JSZip's pako inflates a stream to the same length as Node's zlib is assumed, not shown (S3).
- CRC-32 is not checked, by the guard or by JSZip's default load.
- Hosted parses before this change are the subject of BL-190.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 each divergence refused, each test failing at the baseline | Yes | | | | |
| AC-2 the inflation bomb refused without the memory | Yes | | | | |
| AC-3 genuine workbooks unaffected | Yes | | | | |
| AC-4 version, INV-016, validator, typecheck | Yes | | | | |
| AC-5 CI green, the suites in the log | Yes | | | | |
| AC-6 the upload route authorizes before the guard | Yes | | | | |

## Sources

- jszip 3.10.1, `lib/zipEntries.js` and `lib/zipEntry.js`, read as installed in `node_modules/.pnpm/jszip@3.10.1` and exercised (row 4).
- exceljs 4.4.0, `lib/xlsx/xlsx.js`, read as installed.
- Node.js v24.21.0 `zlib` documentation, https://nodejs.org/docs/latest-v24.x/api/zlib.html (read 2026-09-25): `maxOutputLength` «limits output size when using convenience methods», default `buffer.kMaxLength`; `chunkSize` default `16 * 1024`; both accepted by `inflateRawSync`. The page does not name the error an overrun throws. `ERR_BUFFER_TOO_LARGE` was observed on the local Node 22.22.2; on Node 24, CI's bomb test fails if the code differs, since the entry would then be refused as `XLSX_MALFORMED`.
- LibreOffice 24.2.7.2, openpyxl 3.1.5 on Python 3.11.15, and Info-ZIP Zip 3.0, used in this container to write the fixtures (row 7).

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: `gp-security` and `gp-reviewer` ran as independent native subagents.
- Verified scope: rows 1–7.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-qa`.
- Final state and reason: reviewing.
