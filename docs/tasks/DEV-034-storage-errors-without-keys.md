# DEV-034 — BL-033: evidence storage errors carry no key and no provider message

## Assignment

- **Objective and user-visible outcome:** no error thrown by `apps/app/src/lib/evidence-storage.ts` carries a raw storage key or the storage provider's message, which can name the key. Such errors reach the log through `toProblemResponse`, and `files-and-storage.md` §Downloads says logs never record «the signed URL or raw storage key».
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a bounded bug with an understood cause: coordinator → `gp-reviewer` + `gp-security` → `gp-qa`; failing tests first.
- **Triggered stages and why:** `gp-security` — «evidence storage». `gp-architect`, `gp-ui-reviewer`, `gp-mobile`: not triggered (no contract, schema, UI or client change).
- **Owning module and allowed edit paths:** `apps/app/src/lib/evidence-storage.ts` (the throws; `readFailed`'s identifier and status rules, after review); `apps/app/src/lib/evidence-storage.test.ts` (new); `apps/app/tests/evidence-storage.int.test.ts`; `docs/BACKLOG.md` (BL-033 closed); this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`; `apps/app/AGENTS.md`; `files-and-storage.md` §Downloads; the `EvidenceStorageError` block in `evidence-storage.ts` (the read helpers' style since 2026-08-22).
- **Linked spec, ADR or earlier task:** BL-033 (legacy cite `TODOS.md`). No ADR.
- **Baseline:** `9771402` on `claude/evidence-hardening`.
- **Dependencies / constraints / out of scope:** callers branch on nothing in these messages (grep: no caller matches the old text); one caller stores the text — the purge worker's `upload_intents.purge_failure` (`evidence-purge.ts`), considered in row 4. `TODOS.md`'s suggestion to throw the domain object's id instead was not followed: these helpers take only a key, and the log line already carries the `requestId` to correlate by. BL-035 (structured logging) is separate.
- **Required acceptance criteria:**
  1. Every helper that throws (`createSignedUpload`, `putObject` at both of its steps, `downloadObject`, `objectInfo`, `removeObject`, `createSignedReadUrl`, `createSignedReadUrls`' wholesale failure, `openObjectStream`) throws `EvidenceStorageError` whose message is exactly `storage: <operation> failed (<code>) [<status>]`, and nothing the error prints — message, `util.inspect`, JSON — carries the key, any part of it, or the provider's message; a provider code that is not an identifier is dropped: a unit test with a fake client, red first, and two mutants (the key back in `putObject`'s upload branch; the SDK error kept as `cause`) turn it red (amended after review: R1-01, S1-01 to S1-04).
  2. Against the local stack, a download of a key the storage server refuses — whose own message is shown to name the raw key — yields an `EvidenceStorageError` with code `InvalidKey` and no part of the key in its message or inspection (positive control added after review, R1-03).
  3. The suites on the evidence path pass; `pnpm turbo run typecheck --force`, `pnpm validate:canonical-docs`, `pnpm validate:agents` pass.
  4. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-23 | Cluster «Evidence»: BL-089, BL-088, BL-033, one PR, one record per entry | session brief |

## Plan

1. Probe which storage calls fail, and how, on the local stack.
2. A unit test with a fake client (every call fails naming the key) and an integration test for the real leak; red.
3. `readFailed` in the five helpers; green; the evidence suites.
4. `gp-reviewer` + `gp-security` → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | implementing (coordinator): probe | On the local stack: signing an upload for a key with `{` succeeds; `list` and `remove` on a missing bucket return no error; `download` of a key with `{` answers `InvalidKey` with «Invalid key: <the raw key>»; a signed upload for a missing bucket answers «The related resource does not exist». So only the download leak is reachable end to end; the other four helpers' failures are pinned with a fake client | the probe's output, in this row | Tests |
| 2 | implementing (coordinator): red, then green | A first integration-only test was red for the wrong reason (the calls it expected to fail did not); replaced by the unit test and one integration case. **Red** at `9771402`'s `evidence-storage.ts`: the five unit cases fail, the messages reading «storage: signed upload failed for 0b8c3…», «download failed for …», «list failed for evidence/…», «remove failed for …»; the integration case fails too. The five `throw new Error(…${key}…${error.message})` become `throw readFailed("<operation>", error)`; the file's comment block updated. **Green:** unit 5, evidence-storage 8, evidence-storage-read 7, upload-intents-finalize 25, evidence-purge 17, telegram-evidence 22, finalize-vanishing-bytes 1 | `scratchpad/dev034-red.txt`, `dev034-red-int.txt`, `dev034-green-unit.txt`, `dev034-suite-*.txt` | Commit (`dbb6658`); reviews |
| 3 | reviewing (`gp-reviewer`, `gp-security`, native) on `dbb6658` | **`gp-security`: PASS** — the leak is closed for the five helpers; S1-01 minor (the unit test never reached `putObject`'s own upload branch: its signed-upload step failed first), S1-02 minor (the tests read `.message`, not what `console.error` prints; a `cause` would bring the key back), S1-03 minor (the provider's `code` is copied unchecked into the message), S1-04 minor (three more throwing helpers untested); out of scope: OOS-01 the purge worker stores the message, OOS-02 a node-pg `DatabaseError.detail` could name a key on a unique violation (not reachable: fresh uuid keys; BL-035), OOS-03 Storage's own access logs record paths. **`gp-reviewer`: CHANGES REQUESTED** — R1-01 minor (= S1-01), R1-02 minor (the purge worker's `purge_failure` loses its reason when there is no code), R1-03 nit (no positive control that the server's message names the key), R1-04 nit (state; the legacy «throw the domain object's id») | review reports | Stated fixes |
| 4 | rework (coordinator), stated fixes | **Tests first** (red, 9 of 9 — the meaningful one S1-03: a code `x/<key>` reached `err.code` and the message; the others by the new exact format): every throwing helper in one table, an exact message per operation, `util.inspect` and JSON checked; `putObject` with a signed upload that succeeds, so its upload branch throws. **Fix:** `readFailed` keeps a code only when it is an identifier (`^[A-Za-z][A-Za-z0-9]{0,63}$`), a status only when it is an integer, and adds the error's class name when there is no code; the message carries them — `storage: remove failed (InvalidKey) [400]`, `storage: download failed [502] <StorageUnknownError>` — so `purge_failure` still says why (R1-02). **Mutants:** the key back in `putObject`'s upload branch → 1 red; the SDK error kept as `cause` → 9 red; both restored. The integration test asserts the server's own message names the key before checking ours (R1-03). **Green:** unit 9, evidence-storage 8, storage-read 7, purge 17, finalize 25, external 12, telegram 22; typecheck 10/10 | `scratchpad/dev034-r1-red.txt`, `dev034-r1-mutants.txt`, `dev034-r1-suite-*.txt`, `dev034-r1-checks.txt` | `gp-qa` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1-01 / R1-01 | minor | the `putObject` case | Actual: its upload branch untested | coordinator | The signed upload succeeds in that case; exact messages; mutant red (row 4) |
| S1-02 | minor | what the log prints | Actual: `.message` only | coordinator | `util.inspect` and JSON checked; `cause` mutant red (row 4) |
| S1-03 | minor | the provider's `code` | Actual: copied unchecked | coordinator | Identifier only (row 4) |
| S1-04 | minor | three more helpers | Actual: untested | coordinator | In the table (row 4) |
| R1-02 / OOS-01 | minor / info | `purge_failure` | Actual: no reason without a code | coordinator | Status and error class in the message (row 4); rows written before keep the old text |
| R1-03 | nit | the integration test | Actual: no positive control | coordinator | The server's message asserted first (row 4) |
| R1-04 | nit | state; the legacy suggestion | Actual: stale; unaddressed | coordinator | State set; reason recorded under «Dependencies» |
| OOS-02 | info | `DatabaseError.detail` | A unique violation could name a key; not reachable | coordinator | Noted here for BL-035 |
| OOS-03 | info | Storage access logs | Paths and upload tokens there | coordinator | Outside the app; noted for BL-035 |

Rework count and hypothesis changes: none counted (no QA FAIL).

## What is not true after this task

- **Other files may still log keys or provider messages**: this task covers `evidence-storage.ts` only. No structured logging exists yet (BL-035).
- **The error names the operation, the provider's code, the status and, without a code, the error's class**; the bucket is no longer named. `upload_intents.purge_failure` rows written before this change keep the old text, which named the key — on the same row as `staging_storage_key`, so no new exposure.
- **Storage's own access logs** record object paths and signed-upload tokens; that is outside the app's logs and this task (OOS-03).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- `@supabase/storage-js` 2.112.3, `dist/index.d.mts`: `StorageApiError(message, status, statusCode, namespace?, code?)`, whose `code` is «Service-specific error code from the Storage API response body» (https://supabase.com/docs/guides/storage/debugging/error-codes, cited there); read 2026-09-23.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
