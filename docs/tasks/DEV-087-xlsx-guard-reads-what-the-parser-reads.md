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
  - An entry that inflates past its declared size is refused as `XLSX_BOMB_SIZE` before ExcelJS sees it (BL-192). An encrypted entry is refused as `XLSX_ENCRYPTED_OR_LEGACY`.
  - Genuine workbooks are unaffected.
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
  - `packages/domain/src/import/xlsx-guard.ts`, `xlsx.test.ts`, `version.ts`;
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
  - AC-3: genuine workbooks still parse: the existing guard and parser cases, the seeded fuzz, and the domain suite pass.
  - AC-4: `PARSER_VERSION` is bumped (the file's own rule), INV-016 names the new enforcement, and the validator and `typecheck` pass.
  - AC-5: CI green on the pull request, with `xlsx.test.ts` and the import integration suites shown running in the log.
- Skipped stages and rationale: see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | Take the next item after BL-099; BL-191 and BL-192 together, the hardening DEV-082 filed | Coordinator, under the owner's standing order («мержи и давай дальше») |

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
| 2 | Coordinator | The guard:<br>• the end record is the last signature in the final 65 557 bytes, and its comment ends the file;<br>• one disk, the record counts equal, no zip64 sentinel, and `cdOffset + cdSize` is the end record;<br>• each central record lies before the end record, names disk 0, has no zip64 or Unicode Path extra field, and a valid UTF-8 name;<br>• each local header is at its stated offset, carries the same name bytes, and its data ends before the directory;<br>• the walk ends exactly at the end record, and no two entries' spans overlap;<br>• an encrypted flag refuses as `XLSX_ENCRYPTED_OR_LEGACY`, a method other than stored or deflate as `XLSX_MALFORMED`;<br>• after the declared checks pass, each entry is inflated with `inflateRawSync(…, { maxOutputLength: declared })`. An overrun (`ERR_BUFFER_TOO_LARGE`) refuses as `XLSX_BOMB_SIZE`; a short or broken stream, or a stored entry whose sizes differ, as `XLSX_MALFORMED`.<br>`PARSER_VERSION` is `goproceed-import/1.0.2`: the guard refuses archives 1.0.1 accepted | `git diff` | Tests |
| 3 | Coordinator | Tests: a hand-built ZIP writer, and 10 new cases.<br>• Against the **baseline guard**: all 10 fail.<br>• Against the new guard: all 10 pass, and so do the 12 existing ones, including the seeded fuzz: `xlsx.test.ts` 22 of 22; the domain suite 114 of 114; `typecheck` clean for `@goproceed/domain` and `@goproceed/app` | Session output | Demonstration |
| 4 | Coordinator | Each divergence reproduced **against JSZip 3.10.1 itself**, on the crafted archives:<br>• an uncounted record: JSZip lists `xl/worksheets/sheet1.xml` **and `xl/vbaProject.bin`**;<br>• a local name that differs: JSZip lists only `xl/vbaProject.bin`;<br>• a Unicode Path extra field: JSZip lists only `xl/vbaProject.bin`.<br>The baseline guard passed all three as one sheet.<br>**The bomb, measured** (a 398 KiB upload declaring 1 KiB, inflating to 400 MiB, built in a separate process): JSZip inflated all of it before throwing «uncompressed data size mismatch», **peak RSS 479 MiB** from 55; the new guard refused it as `XLSX_BOMB_SIZE` at **peak RSS 69 MiB** from 67. A 20 MiB upload, the size limit, at the same ratio would ask JSZip for about 20 GiB | `scratchpad/jszip-divergence.cjs`, `jszip-bomb-rss.cjs`, `guard-bomb-rss.mts` | Reviews |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none.

## What is not true after this task

- The guard now matches the JSZip 3.10.1 and ExcelJS 4.4.0 pair installed. An upgrade of either needs this record's reading repeated.
- A genuine workbook is inflated twice, once by the guard and once by JSZip; each is bounded by the declared sizes, at most 100 MB in total.
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

## Sources

- jszip 3.10.1, `lib/zipEntries.js` and `lib/zipEntry.js`, read as installed in `node_modules/.pnpm/jszip@3.10.1` and exercised (row 4).
- exceljs 4.4.0, `lib/xlsx/xlsx.js`, read as installed.
- Node.js 24 `zlib` `maxOutputLength` option (`ERR_BUFFER_TOO_LARGE` when exceeded), observed on the local Node 22.22.2 in the tests (row 3); CI runs Node 24.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: the reviews follow.
- Verified scope: rows 1–4.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-reviewer` and `gp-security`.
- Final state and reason: reviewing.
