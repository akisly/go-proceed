# DEV-032 — BL-089: member-plane evidence reads are downloads, never an inline render

## Assignment

- **Objective and user-visible outcome:** an office member's signed read URL for evidence no longer renders the uploader's content type on the Storage origin when opened as a page. Every signed read `evidence-storage.ts` issues passes `download: true`, so Storage answers `Content-Disposition: attachment`: a navigation saves the file, and the photo in the evidence card (`<img>`) shows as before.
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a bounded bug with an understood cause: coordinator → `gp-reviewer` + `gp-security` → `gp-qa`. A failing test first.
- **Triggered stages and why:** `gp-security` — «evidence storage, signed URLs or uploads». `gp-architect` is not triggered: the `/v1` response keeps its shape (`readUrl` stays a URL string; only its query gains `download=`), and no migration, RLS, catalog or state changes. `gp-ui-reviewer`: no UI file changes; the card's `<img>` is checked in a browser pass. `gp-mobile`: `apps/mobile` reads no `readUrl` (grep).
- **Owning module and allowed edit paths:** `apps/app/src/lib/evidence-storage.ts` (the signing options); `apps/app/tests/evidence-storage-read.int.test.ts`; `docs/BACKLOG.md` (BL-089 closed; BL-126 filed); `docs/delivery/production-readiness.md` §12 and `docs/delivery/pilot-execution-runbook.md` §5.12 (dated notes); `docs/STATUS.md`; this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`; `apps/app/AGENTS.md`; `docs/architecture/files-and-storage.md` «Downloads and signed URLs» and «Content validation and malware boundary»; `docs/delivery/production-readiness.md` §12 (the owner's malware acceptance of 2026-09-15, which names BL-089 as a risk path); [DEV-012](DEV-012-m0-gate12-evidence.md).
- **Linked spec, ADR or earlier task:** BL-089; DEV-012. No ADR.
- **Baseline:** `56ceb58`, the head of `claude/data-outputs-private` (PR #108), which this branch `claude/evidence-hardening` stacks on: `docs/BACKLOG.md` ids must run in sequence (the validator), and #108 took BL-122 to BL-125. The code under change is identical at `44e05cd` (`origin/main`); the first measurements were taken there.
- **Dependencies / constraints / out of scope:** the external review route already streams with the detected type, `nosniff` and a sandbox CSP and is unchanged. Out of scope: setting the Storage object's content type to the detected one (BL-126). Nothing hosted.
- **Required acceptance criteria:**
  1. Both `createSignedReadUrl` and `createSignedReadUrls` produce URLs whose response carries `Content-Disposition: attachment` and the unchanged bytes (a failing test first; `evidence-storage-read.int.test.ts`, Storage only).
  2. In a browser, against the local stack: before the change, opening a signed URL of an object stored as `image/svg+xml` runs its script; after, the navigation downloads and runs nothing; an `<img>` with the new URL still renders.
  3. The member evidence route and its callers are otherwise unchanged; `pnpm turbo run typecheck --force`, `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
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

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

- **The object keeps the uploader's content type**, and Storage sends no `nosniff` (BL-126). What removes the render is the download disposition.
- **Hosted Storage was not measured**; the headers are the local storage API v1.69.0's.
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
