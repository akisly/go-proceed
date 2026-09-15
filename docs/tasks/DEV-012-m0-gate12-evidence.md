# DEV-012 — M0 readiness gate 12: the upload and import controls that are built, and the pilot's malware decision

## Assignment

- **Objective and user-visible outcome:** readiness gate 12 («Upload and import safety», `docs/delivery/production-readiness.md`), which carries runbook M0 item 12, gains recorded evidence for its built halves (runbook §5.14 order 3): content-type enforcement from magic bytes, the upload resource-exhaustion controls, and the frozen importer's safety limits with its hostile-fixture tests. The owner's decision on the malware half is recorded with its risk named. **The gate cannot close in this task:** its export-neutralization half has no export to neutralize (runbook §5.12, item 3).
- **State:** done
- **Coordinator:** primary Claude Code session, 2026-09-15.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** evidence recording inside existing boundaries, as DEV-009 and DEV-010: coordinator gathers and records → `gp-reviewer` + `gp-security` → `gp-qa`. `gp-security` joins because the task records a decision to accept uploads without a malware scanner (uploads and evidence storage).
- **Triggered stages and why:** `gp-security` (above). `gp-architect` is not triggered: no table, migration, RLS, contract or catalog change. `gp-ui-reviewer` and `gp-mobile` are not triggered.
- **Owning module and allowed edit paths:** `docs/delivery/production-readiness.md` §12, `docs/delivery/pilot-execution-runbook.md` §5.12, §5.14 row 3, §10 Q-10, §5.7 and §8.1 (DEV-011 notes), `docs/STATUS.md`, `docs/BACKLOG.md` (BL-079, BL-085, BL-088, BL-089), this record and the index. No code or schema change; a gap the evidence shows becomes a backlog entry.
- **Read context:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/delivery/production-readiness.md` §12 and «Evidence format»; `docs/delivery/version-0.1.md` §M0; runbook §5.12, §5.14; `docs/architecture/files-and-storage.md` «Content validation and malware boundary» (Approved); `docs/delivery/test-strategy.md` «Import fuzz»; `technical/asvs-profile.csv` ASVS-FILE-01..08; [DEV-009](DEV-009-m0-gate10-evidence.md) and [DEV-010](DEV-010-m0-gate14-evidence.md) as precedents.
- **Linked spec, ADR or earlier task:** ADR-006 decision 6 (import frozen, not deleted); DEV-009; DEV-010.
- **Baseline:** `48ba14e` (main after PR #92).
- **Dependencies / constraints / out of scope:** GitHub Actions starts no jobs until October 2026; the owner allowed four database test files locally (below), no `supabase db reset`. Out of scope: building a scanner, export (item 3) and its neutralization, the other gates. Also carried here, as documentation only: DEV-011's post-merge notes (BL-085 closed, «until it merges» removed) and the owner's BL-079 decision.
- **Required acceptance criteria:**
  1. Every built control the evidence note names is located in code or a migration by file (and line where it matters), with the values stated as the code states them.
  2. Each named control is exercised by a test that ran in this task and passed, without skips, and the note names those tests; what did not run is named as such.
  3. The owner's malware decision is recorded with its date, what is accepted, the risk it leaves, and the Approved text it departs from (`files-and-storage.md`), without claiming a scanner or an ADR.
  4. Gate 12 is recorded as not closed everywhere it is summarised (`production-readiness.md` §12, runbook §5.12 and §5.14 row 3, STATUS), with export neutralization and BL-088 as what it waits on; `version-0.1.md` §M0 gains no gate 12 entry.
  5. Gaps the evidence found become backlog entries (BL-088).
  6. DEV-011's post-merge notes and the BL-079 decision are recorded without changing anything else in those entries.
  7. `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  8. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** above.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-15 | Next task: M0 readiness gate 12 (runbook §5.14 order 3) | chat, answer «M0 gate 12» |
| 2026-09-15 | Malware half for the pilot: accept magic-byte content sniffing, the narrow allow-list (JPEG, PNG, PDF, HEIC) and the size, quota and quarantine limits as the pilot's malware control, with the risk named in the dated evidence; no new ADR | chat, answer «Принять с риском в записи» |
| 2026-09-15 | Run locally, one at a time, `apps/app/tests/upload-intents-create.int.test.ts`, `upload-intents-finalize.int.test.ts`, `evidence-purge.int.test.ts`, `imports.int.test.ts` against the local database at `0085`; tenant tables and local Storage may be cleared; no `supabase db reset` | chat, answer «Да, 4 файла» |
| 2026-09-15 | BL-079 (`outputs/` personal data): move the directory to private storage behind a pointer README; the data stays in `bbfc705` without a history rewrite. A task for it is opened later | chat, answer «В приватное хранилище» |
| 2026-09-15 | After `gp-security` S1-01: accept the fuller malware risk (polyglots pass a leading-byte check; office members open files through inline Storage signed URLs with the stored content type and without `nosniff` or a sandbox; images decode in the viewer's browser on page view; Telegram files come from group participants), worded as «in place of a malware control, no file is scanned», with revisit triggers (before real customer data, before the Telegram webhook is enabled, before the first PDF evidence path, before links go to real reviewers, at the pilot's end); the compensating controls (attachment download, stored type from the detected type) become a backlog entry | chat, answer «Принять полный риск + условия пересмотра» |

## Plan

Numbered steps. For each step, name the files it touches and the check that proves it. A step that adds a contract, refusal or invariant starts with its failing test.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoping (coordinator) on `48ba14e` | Gate 12 has two boxes in `production-readiness.md` §12 (malware, content-type and resource-exhaustion controls on uploads; the import hostile-fixture corpus still runs), and M0 item 12 adds the importer's limits and export neutralization. Export does not exist (item 3), so the gate cannot close here. `docs/architecture/files-and-storage.md` (Approved) lists the controls the product applies «before availability or parsing», including «image dimension/pixel-count and decoding-resource limits» and «malware/content inspection using a pinned scanner/policy version»; `technical/asvs-profile.csv` ASVS-FILE-01..08 are all `specified_no_runtime_evidence`. The owner's malware decision accepts the gap for the pilot without changing that document | `production-readiness.md:397-405`; `files-and-storage.md:306-336`; `asvs-profile.csv:7-14` | Code facts |
| 2 | gathering (coordinator): code facts | **Content type:** `apps/app/src/lib/evidence-inspection.ts` `sniffMediaType` recognises JPEG, PNG, PDF and HEIC brands from magic bytes; `defaultInspector` blocks `unrecognised_content` and `declared_type_mismatch`, policy `m2a-magic-bytes-1`, and states «v0.1 ships no anti-malware engine» (`:38`). **Uploads:** `evidence` bucket private, `file_size_limit` 52 428 800 (`0020`); per-workspace `evidence_quota_bytes`, NULL = unlimited (`0026`); orphan purge (`0021`); `scan_blocked` purged after seven days (`0027`). **Import:** `packages/domain/src/import/xlsx-guard.ts` `XLSX_LIMITS` (maxBytes 20 971 520, maxEntries 10 000, maxTotalUncompressed 104 857 600, maxCompressionRatio 100, maxRows 20 000, maxCols 256, maxCellChars 32 768), the central directory scanned without inflating; `csv.ts` `CSV_LIMITS` (maxBytes 20 971 520, maxRows 20 000, maxCols 256, maxFieldChars 32 768). **Gap found:** no image dimension, pixel-count or decoding-resource limit exists in the code (`grep -i 'pixel\|dimension'` over `apps/app/src/lib`, `apps/app/app`, `packages/domain/src` finds none related) | files named | Tests |
| 3 | gathering (coordinator): unit tests | `packages/domain` `vitest run src/import`: 4 files, 48 passed, rc 0 — `xlsx.test.ts` (CFB legacy/encrypted, non-zip, macro `vbaProject`, declared-size ZIP bomb without inflating, path traversal, malformed central directory, inert formulas, 100 seeded mutations fail closed) and `csv.test.ts` (NUL bytes, invalid UTF-8, unbalanced quote, column/byte and row limits with named codes, untrusted strings, 200 seeded mutations never throw), plus `validate` and `publish` | `scratchpad/dev012-domain-import.txt` | Database tests |
| 4 | gathering (coordinator): database tests, owner-approved | Local database at `0085`, local Storage; `APP_DB_URL`, `SERVICE_DB_URL`, `TEST_DB_ADMIN_URL` set to the loopback URLs, so `hasIsolatedDatabaseCredentials()` held and nothing skipped. One file at a time: `upload-intents-create.int.test.ts` 23 passed (the pinned template's media allow-list and size limit; malformed hash and non-positive size; unlimited without a quota; refused over the workspace quota); `upload-intents-finalize.int.test.ts` 19 passed («content sniffing»: blocks content that disagrees with the declared type and creates no evidence (`declared_type_mismatch`); blocks unrecognised content; size and hash mismatch; expired, blocked and purge-claimed intents refused); `evidence-purge.int.test.ts` 17 passed (expiry, byte deletion, scan-blocked content kept inside its window and purged after it with the record kept); `imports.int.test.ts` 13 passed (executable bytes and ZIP bombs refused with `IMPORT_FILE_UNSUPPORTED`; inert `FORMULA_CELL`; corrupted XLSX fails with named codes). All rc 0 | `scratchpad/dev012-int-upload-intents-create.txt`, `-finalize.txt`, `-evidence-purge.txt`, `-imports.txt` | Record the evidence |
| 5 | recording (coordinator) | `production-readiness.md` §12: a dated «not closed» evidence note under each box and the owner's malware acceptance with its risk named; runbook §5.12 status and §5.14 row 3; STATUS «Next action»; BL-088 for the missing image limits. Also, documentation only: DEV-011's post-merge notes (BL-085 `closed → DEV-011`; «until it merges» replaced by «merged in #92» in STATUS, `production-readiness.md` and runbook §5.7 and §8.1; §5.14 row 2) and the owner's BL-079 decision (state `open`, decision recorded) | this diff | Validators, reviews |
| 6 | reviewing (`gp-reviewer`, `gp-security`, native) on `949a5a4` | **`gp-security`: HOLD** — S1-01 major (the accepted risk omits polyglots, the member plane's inline signed URLs with the stored content type and no `nosniff`/sandbox, automatic image decoding, Telegram senders; the external route's sandbox CSP does not stop Chrome's PDF viewer), S1-02 major (ASVS-FILE-08 not named as departed from; no revisit trigger; compensating controls unnamed), S1-03 minor («as the malware control» reads as scanning), S1-04 minor (BL-088's browser exposure is present, not future), S1-05 minor (STATUS still shows the `outputs/` decision pending). **`gp-reviewer`: CHANGES REQUESTED** — R1-01 medium (the bucket's 50 MiB limit listed as exercised; no test that ran touches it), R1-02 low (Q-10 still open in STATUS and runbook §10), R1-03 low (STATUS item 2 contradicts item 3), R1-04 low (BL-079 keeps a superseded Resume line). The owner was asked about S1-01 and accepted the fuller risk with triggers (Owner decisions) | review reports | Stated fixes |
| 7 | rework (coordinator), stated fixes | `production-readiness.md` §12: the malware bullet rewritten as the owner accepted it — «in place of a malware control», what `passed` means, the four risk paths, the existing controls, the departures from `files-and-storage.md` and ASVS-FILE-08 (the undefined `waiver_policy` noted), five revisit triggers; the bucket limit stated as not exercised; BL-089 under «Open». Runbook §5.12 status reworded and §10 Q-10 given a dated note. STATUS: Q-10 marked answered; item 2 rewritten, item 3's BL-079 clause dropped; the Outreach row's BL-079 clause annotated; the DEV-012 preamble sentence names them. BACKLOG: BL-079 Resume marked superseded; BL-088's exposure and deadline cover the live browser path; BL-089 (P2) for the member plane's inline reads. Committed in `57f8c39`; this record's row and paths in the next commit (the first edit script stopped on an ambiguous anchor after the other files were written) | `dev012-rework-r1.diff`; `dev012-validate-*.txt` | `gp-security` re-check; `gp-qa` |
| 8 | reviewing (`gp-security`, native), narrow re-check on `7571dea` | **PASS**: S1-01 to S1-05 closed, every code reference checked against `7571dea`, the §12 nesting reads as part of the checklist item, no scanner, ADR or CI claimed. Two low findings: S2-01 (the PDF trigger implies PDF is not reachable, while `FALLBACK_MEDIA` in `apps/app/src/lib/evidence/authorize-upload-intent.ts:57-60` already accepts `application/pdf` through `/v1`), S2-02 (BL-089 named the Telegram MIME type as a source of a differing stored type; on that path the stored type equals the inspected claim) | security report | Stated fixes |
| 9 | rework (coordinator), stated fixes | S2-01: the trigger reads «before any client offers PDF evidence (the `/v1` upload API already accepts `application/pdf`)»; the Owner decisions row keeps the owner's words. S2-02: BL-089 names the holder of the signed upload URL as the source, and Telegram only for its senders. No `gp-reviewer` re-run owed: wording only within stated fixes | this diff | `gp-qa` |
| 10 | verifying (`gp-qa`, native, read-focused) on `fe07c3a` | Criteria 1–7 PASS (2 and 7 assisted), 8 NOT RUN (not required); all ten findings' fixes in place; it re-checked every code cite, the test titles against source (finalize 17 `it` + 2 `it.each` = 19), no `it.skip`, `version-0.1.md` unchanged (rc 0), 85 migrations, and the validator files' timestamps. Findings Q1-01 to Q1-03 low, Q1-04 info | QA report | Q1 fixes, completion |
| 11 | rework (coordinator), stated fixes, prose only | Q1-01: runbook §5.14 row 3 «partly done … waits on item 3, BL-088 and BL-089»; STATUS M0 row and «Next action» 1 and the index row name the same three. Q1-02 and Q1-03: recorded in the Acceptance evidence and here — BL-079's «Depends on» line was also rewritten, and it gained an «Owner decision» line outside «How an entry reads», which the validator accepts. Q1-04: the full path in row 8. Applied after QA; not re-verified by an independent stage (wording and record only) | this diff; `dev012-validate-*.txt` | Push, PR |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1-01 | major | `production-readiness.md` §12 malware bullet | Actual: risk named as one sentence; polyglots, member-plane inline signed URLs with the stored content type and no `nosniff`/sandbox, automatic image decoding, Telegram senders and the PDF viewer under the sandbox CSP unstated | owner / coordinator | Owner accepted the fuller statement (2026-09-15); bullet rewritten; compensating controls BL-089 (row 7) |
| S1-02 | major | Same; runbook §5.12 | Actual: only `files-and-storage.md` named; no revisit trigger; compensating controls unnamed | coordinator | ASVS-FILE-08 named (row stays `specified_no_runtime_evidence`; `waiver_policy` `none` noted as undefined in the catalog); five revisit triggers; the existing controls named (row 7) |
| S1-03 | minor | Same; runbook §5.12 | Actual: «as the malware control» | coordinator | «in place of a malware control; no file is scanned for malware; `inspection_status = 'passed'` means only that the leading bytes match an allowed type» (row 7) |
| S1-04 | minor | BL-088 | Actual: exposure described as future | coordinator | Present in office members' and reviewers' browsers on page view; deadline covers the browser path (row 7) |
| S1-05 / R1-03 | minor / low | `docs/STATUS.md` item 2, item 3, Outreach row | Actual: the `outputs/` decision still pending in item 2 and the Outreach row | coordinator | Item 2 rewritten, item 3's BL-079 clause dropped, Outreach row annotated (row 7) |
| R1-01 | medium | `production-readiness.md` §12 box 1 | Actual: the bucket's `file_size_limit` counted as exercised | coordinator | Stated as located in `0020` and not exercised by any test that ran (row 7) |
| R1-02 | low | STATUS M0 row; runbook §10 Q-10 | Actual: Q-10 still an open owner decision | coordinator | Marked answered for the pilot with dated notes; question text unchanged (row 7) |
| R1-04 | low | BL-079 Resume | Actual: the options line survives the decision | coordinator | Prefixed as superseded (row 7) |
| S2-01 | low | `production-readiness.md` §12 trigger | Actual: «before the first PDF evidence path ships» while `/v1` accepts PDF | coordinator | Reworded (row 9) |
| S2-02 | low | BL-089 Why | Actual: Telegram's MIME type named as a differing stored type | coordinator | Reworded (row 9) |
| Q1-01 | low | §5.14 row 3; STATUS M0 row and «Next action» 1; index row | Actual: different blocker sets for gate 12; row 3 «done» | coordinator | All name item 3, BL-088 and BL-089; «partly done» (row 11) |
| Q1-02 | low | Evidence outputs | Actual: several named passes known only from file totals, not title lines | coordinator | Stated in the Acceptance evidence Limitation (criterion 2); a `--reporter=verbose` re-run would give titles |
| Q1-03 | low | BL-079 | Actual: «Depends on» rewritten and an «Owner decision» line added, beyond «state and decision» | coordinator | Recorded in row 11; backlog unchanged |
| Q1-04 | info | Row 8 | Actual: cite without directory | coordinator | Full path (row 11) |

Rework count and hypothesis changes:

## What is not true after this task

- **Readiness gate 12 is not closed.** Export neutralization waits on export (item 3), and BL-088 and BL-089 are open. `version-0.1.md` §M0 has no gate 12 entry.
- **No file is scanned for malware.** The owner accepted that for the pilot, with the risk and five revisit triggers in `production-readiness.md` §12; `files-and-storage.md` and ASVS-FILE-08 are unchanged and not satisfied.
- **Nothing ran in CI** (GitHub Actions billing until October 2026). The tests ran once, locally, against the local database at `0085` and local Storage.
- **The bucket's 50 MiB `file_size_limit` is not exercised** by any test that ran.
- **Several named passes are known from file totals only** (Q1-02): the saved output lists slow tests by title, not every test.
- **Nothing was checked on a hosted project**, including what Supabase Storage sends on a signed read (BL-089).
- **The BL-079 move is not done**; only the owner's decision is recorded.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. Controls located with values as coded | yes | `fe07c3a` | Row 2; `gp-qa` row 10 re-checked every cite | PASS | — |
| 2. Each named control exercised by a test that ran, no skips; what did not run named | yes | `48ba14e` code, runs on 2026-09-15 | `dev012-domain-import.txt` 48; `dev012-int-*.txt` 23, 19, 17, 13; all rc 0 | PASS | assisted: owner-approved local runs, database at `0085`, not in CI; several passes known from file totals only (Q1-02); the bucket limit not exercised, and said so |
| 3. The malware decision recorded with date, acceptance, risk, departures, no scanner or ADR claimed | yes | `fe07c3a` | `production-readiness.md` §12; Owner decisions; `gp-security` PASS (row 8) | PASS | — |
| 4. Gate 12 not closed everywhere it is summarised; no `version-0.1.md` entry | yes | closing commit | §12, runbook §5.12 and §5.14 row 3, STATUS, index; `git diff --quiet 48ba14e -- docs/delivery/version-0.1.md` rc 0 | PASS | — |
| 5. Gaps become backlog entries | yes | `fe07c3a` | BL-088, BL-089 | PASS | — |
| 6. DEV-011 post-merge notes and the BL-079 decision recorded | yes | `fe07c3a` | BL-085 closed; «until it merges» gone outside DEV-012's record; BL-079 state, decision, superseded Resume | PASS | BL-079's «Depends on» also rewritten (Q1-03) |
| 7. `validate:canonical-docs` and `validate:agents` pass | yes | closing commit's tree | `node scripts/validate-canonical-docs.mjs` and `python3 scripts/sync-agents.py --check` rc 0 (`dev012-validate-*.txt`) | PASS | assisted: coordinator's runs |
| 8. CI `verify` on the PR head | no | — | — | NOT RUN | environmental: GitHub Actions starts no jobs until October 2026 (owner, 2026-09-14) |

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

The Limitation column opens with at most one qualifier from this closed set, then its detail:

- **PASS:** `negative` (the command correctly produced nothing, and the absence is the evidence); `assisted:` what had to be arranged by hand first; `owner-reported` (the owner's report, not a session observation).
- **FAIL:** `known-red baseline:` the named set of pre-existing failures, with no case outside it failing.
- **NOT RUN:** `environmental:` the cause and the command that settles it; `not-provable-locally:` what would settle it; or, with no qualifier, the reason: why it was deliberately not attempted, or why a PASS was earned for the wrong reason (`agents/roles/gp-qa.md`).

Gate records written before 2026-09-13 keep their own tokens; `docs/delivery/pilot-execution-runbook.md` §7.4 maps them onto this set.

## Sources

Third-party documentation and primary sources checked for this task. Give each one its URL, the installed version it applies to, its publication date if known (never substitute today's date) and the access date.

## Completion / handoff

- Changed / inspected files: `docs/delivery/production-readiness.md`, `docs/delivery/pilot-execution-runbook.md`, `docs/STATUS.md`, `docs/BACKLOG.md`, this record, `docs/tasks/README.md`; commits `949a5a4`, `57f8c39`, `7571dea`, `fe07c3a` and the closing commit.
- Review independence: independent — `gp-security` (round 1 HOLD, narrow re-check PASS), `gp-reviewer` (round 1 CHANGES REQUESTED, fixes verified by `gp-qa`), `gp-qa` on `fe07c3a`. The Q1 fixes after QA are prose and record only and were not re-verified by an independent stage.
- Verified scope: criteria 1–7 PASS; criterion 8 NOT RUN, not required.
- Remaining risks / blocked requirements: «What is not true» above.
- Next bounded action and owner: owner — review and merge the PR; then a task for BL-079 (move `outputs/` to private storage) or runbook §5.14 order 4 (item 11's coverage checker).
- Final state and reason: done — every required criterion PASS; every finding fixed or recorded with its reason.
