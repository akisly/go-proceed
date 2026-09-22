# DEV-034 — BL-033: evidence storage errors carry no key and no provider message

## Assignment

- **Objective and user-visible outcome:** no error thrown by `apps/app/src/lib/evidence-storage.ts` carries a raw storage key or the storage provider's message, which can name the key. Such errors reach the log through `toProblemResponse`, and `files-and-storage.md` §Downloads says logs never record «the signed URL or raw storage key».
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a bounded bug with an understood cause: coordinator → `gp-reviewer` + `gp-security` → `gp-qa`; failing tests first.
- **Triggered stages and why:** `gp-security` — «evidence storage». `gp-architect`, `gp-ui-reviewer`, `gp-mobile`: not triggered (no contract, schema, UI or client change).
- **Owning module and allowed edit paths:** `apps/app/src/lib/evidence-storage.ts`; `apps/app/src/lib/evidence-storage.test.ts` (new); `apps/app/tests/evidence-storage.int.test.ts`; `docs/BACKLOG.md` (BL-033 closed); this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`; `apps/app/AGENTS.md`; `files-and-storage.md` §Downloads; the `EvidenceStorageError` block in `evidence-storage.ts` (the read helpers' style since 2026-08-22).
- **Linked spec, ADR or earlier task:** BL-033 (legacy cite `TODOS.md`). No ADR.
- **Baseline:** `9771402` on `claude/evidence-hardening`.
- **Dependencies / constraints / out of scope:** callers branch on nothing in these messages (grep: no caller matches the old text). BL-035 (structured logging) is separate.
- **Required acceptance criteria:**
  1. The five helpers that interpolated the key (`createSignedUpload`, `putObject`, `downloadObject`, `objectInfo`, `removeObject`) throw `EvidenceStorageError` carrying the provider's code and status and neither the key, any part of it, nor the provider's message: a unit test with a fake client, red first.
  2. Against the local stack, a download of a key the storage server refuses — whose message names the raw key — yields an `EvidenceStorageError` with code `InvalidKey` and no part of the key.
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
| 2 | implementing (coordinator): red, then green | A first integration-only test was red for the wrong reason (the calls it expected to fail did not); replaced by the unit test and one integration case. **Red** at `9771402`'s `evidence-storage.ts`: the five unit cases fail, the messages reading «storage: signed upload failed for 0b8c3…», «download failed for …», «list failed for evidence/…», «remove failed for …»; the integration case fails too. The five `throw new Error(…${key}…${error.message})` become `throw readFailed("<operation>", error)`; the file's comment block updated. **Green:** unit 5, evidence-storage 8, evidence-storage-read 7, upload-intents-finalize 25, evidence-purge 17, telegram-evidence 22, finalize-vanishing-bytes 1 | `scratchpad/dev034-red.txt`, `dev034-red-int.txt`, `dev034-green-unit.txt`, `dev034-suite-*.txt` | Commit; reviews |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

- **Other files may still log keys or provider messages**: this task covers `evidence-storage.ts` only. No structured logging exists yet (BL-035).
- **The error names the operation and the provider's code**, which is enough to tell a missing object from a refused key; the bucket is no longer named either.

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
