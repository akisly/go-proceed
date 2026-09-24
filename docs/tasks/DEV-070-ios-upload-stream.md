# DEV-070 — iOS photo uploads no longer crash the app

## Assignment

- Objective and user-visible outcome: on iOS, sending a photo no longer kills the app. The vault's upload body is a bound stream pair fed by a producer thread, instead of an `InputStream` subclass that CFNetwork cannot drive.
- State: verifying
- Coordinator: Claude Code primary session (2026-09-24).
- Execution mode: independent subagents for the stages root `AGENTS.md` requires.
- Selected route and why: native client vault and uploads. So `gp-mobile` before design, then `gp-reviewer`, `gp-security` (uploads, evidence storage) and `gp-qa`. There is no UI change, so no `gp-ui-reviewer`.
- Owning module and allowed edit paths: `apps/mobile/modules/goproceed-vault/ios/NativeVault.swift`, this record, `docs/tasks/README.md`.
- Read context: DEV-042 (the vault; finding N5, "no reader use after close"), DEV-061 (the signed-in pass that found this).
- Linked: [DEV-042](DEV-042-mobile-native.md), [DEV-061](DEV-061-field-client-decisions.md).
- Baseline: `origin/main` `9d050cca`; branch `claude/ios-upload-stream` (worktree `.claude/worktrees/android-vault`). Independent of DEV-061's PR #135.
- Numbering: opened as DEV-062; parallel branches hold DEV-062…DEV-069 (`claude/tooling-deps`, `claude/app-qa-otp-flake`), so this task is DEV-070.
- Dependencies / constraints / out of scope: Android is not affected, because it streams through `HttpsURLConnection`. No server change.
- Required acceptance criteria: see the table below.
- Skipped stages and rationale: `gp-ui-reviewer`, because no screen changes.

## Plan

1. Replace the `InputStream` subclass with a bound stream pair fed by a producer thread (Apple's supported pattern for a streamed `URLSession` body).
2. `gp-mobile` before the final design; apply its tightenings (T1–T10).
3. Verify on the iOS simulator against staging: the crashed photo, a normal send, a corrupt ciphertext and a mid-transfer cancel (fault injection with `lldb`).
4. `gp-reviewer` and `gp-security` on the diff; fix or record every finding; `gp-qa` on the final revision.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | Fix the crash as a separate task now, then resume DEV-061's signed-in pass | Owner's choice in this session |

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator (found in DEV-061 row 12) | On the iOS 18.1 simulator, signed in to staging, the first automatic send killed the process. The error was `NSInvalidArgumentException: -setDelegate: only defined for abstract class. Define -[…VaultInputStream setDelegate:]`, raised from `CFReadStreamSetClient` ← `RequestBodyStream::_onqueue_setupStream` ← `HTTP2Connection::submitRequest`. A pending photo re-sends at every launch, so the app crash-loops. | `log show` on the simulator, 17:51:54 | Design |
| 2 | Coordinator (first revision; superseded by rows 5 and 7) | Implementation. `VaultInputStream` is replaced by `VaultBody`:<br>• a `Stream.getBoundStreams` pair (64 KiB);<br>• a producer thread decrypts chunks with `gp_reader` and writes each one fully to the output side, polling `hasSpaceAvailable` and never blocking in `write`. It checks the stop flag and the upload generation between writes, wipes each chunk after writing it, and closes the output. That gives a complete body at EOF, or a short body the server rejects against `Content-Length` when cancelled or corrupt;<br>• URLSession gets the input side once, through `needNewBodyStream`;<br>• `stop()` sets the flag and joins the producer (bounded, 10 s), or frees the reader itself if the producer never started. It runs after the session is invalidated.<br>The reader is used and freed only by the producer, which keeps DEV-042 N5. The slot, generations, header allow-list, redirects off and ephemeral configuration are unchanged. `request.httpBodyStream` is no longer set: the streamed task takes its body from the delegate. | `NativeVault.swift` | Build, simulator |
| 3 | Coordinator (first revision) | Simulator build succeeds. The fixed build was installed over the crashing one; that is an update, so the session and the pending photo were kept. At launch the queue sent the photo that had crashed the app, and the app stayed up. «Надсилання» reads «У цьому робочому просторі все надіслано». On staging, the newest upload intent (created 14:51:53 UTC by the crashed attempt) is `available` at 2,567,402 bytes. The server finalized it, having checked the content hash and size against the intent. | `xcodebuild`; simulator screenshots; staging SQL, read-only | Reviews |
| 4 | `gp-mobile` | Endorses the bound pair (Apple DTS's pattern for a streamed body) and asks for tightenings:<br>• T3: a producer error or stop cancels the task, not just ends the body short;<br>• T4: success needs a 2xx **and** the producer's authenticated EOF **and** bytes written = `byteSize`;<br>• T7: hold one chunk back, so the last bytes leave only after the reader has verified the final tag and the whole-file hash;<br>• T10: plaintext in one allocated buffer, wiped after each write and on exit;<br>• T2/T8/T9: only the producer touches the output stream and (once started) the reader; the input stream is never opened by us; a 1–2 ms poll; a short join bound that never frees the reader.<br>Open questions for the owner: `Content-Length` vs chunked, a crash-loop breaker, host throttling and fault injection for the cancel cases. | gp-mobile handoff (this session) | Rework |
| 5 | Coordinator (second revision) | `VaultBody` reworked:<br>• the producer reads one chunk ahead and writes a chunk only after the next read succeeds; on EOF (`gp_reader_read == 0`, which the C reader returns only after the final tag, size and SHA-256 check) it writes the held chunk and sets `complete` only if bytes sent = `byteSize` (T4, T7);<br>• any exit without `complete` calls `onFailure`, which cancels the `URLSessionTask`, before the output closes (T3);<br>• two `UnsafeMutablePointer<UInt8>` chunk buffers, wiped with `gp_wipe` after each write and on exit, then freed (T10);<br>• writes poll `hasSpaceAvailable` every 1 ms and stop on the stop flag, a generation change, or a closed/errored stream (T9);<br>• `stop()` waits at most 2 s for the producer and returns `complete`; a producer that has not stopped keeps the reader (T2). `upload()` calls `stop()` after the transfer and requires its `true` together with the 2xx;<br>• the halt check reads the stop flag under the body's lock and calls the generation check outside it, so the two locks never nest.<br>Simulator: build succeeds. The first launch after the install resolved the Caches directory in a new data container while the vault stayed in the old one (a simulator install artefact; imports failed `VAULT_INVALID_IMPORT` / `VAULT_IMPORT_FAILED`). After a plain relaunch both resolve to one container. A 2,148,290-byte JPEG (33 chunks) was imported through the native module and sent from «Надсилання»; the app stayed up and the staging intent `6ba4a393…` is `available` and finalized (server checked hash and size). | `xcodebuild`; debugger `importPhoto`; staging SQL, read-only | Reviews |
| 6 | `gp-reviewer`, `gp-security` | Independent reviews of the second revision. `gp-reviewer`: no blocker; lock order, the reader's single close, the fail-closed success gate and the defer order are correct; findings R1–R6. `gp-security`: PASS with findings; no plaintext on disk, no truncated or unauthenticated body can count as sent, nothing crosses identities; findings S-1–S-3. | Findings table below | Rework |
| 7 | Coordinator (third revision) | Stated fixes only:<br>• S-2: `authenticate` reads the running task under the `cancellation` lock with the generation bump and cancels it after unlocking, as `quarantine` does;<br>• R1: the write poll sleeps 5 ms instead of 1 ms;<br>• R2: on failure the producer calls `onFailure` and leaves the output open, so the cancel, not an early end of body, ends the request; `stop()` closes it once the producer has exited; the type comment now says the cancel is best effort and names the real guarantees (`Content-Length`, finalize's hash check, `stop() == true`);<br>• R5: the two buffers are swapped instead of copied;<br>• R4, R6, S-1: record notes (this row, row 2's label, «What is not true»). | `NativeVault.swift` | Simulator |
| 8 | Coordinator | Third revision, iOS 18.1 simulator against staging, installed with `simctl install` and relaunched (one data container):<br>• **A, normal send:** capture `284c4581…` (2,148,290 bytes, 33 chunks) → intent `efbe8096…` `available`, finalized.<br>• **B, corrupt ciphertext:** `lldb` breakpoint on the second `gp_reader_open` (after `gp_verify_file`) ran a host script that flipped the byte at offset 1,500,000 of capture `a94a0e31…`'s `.vault`. The item ended `failed`; intent `97c6a8cf…` stayed `intent_authorized`, not finalized, and Storage holds no object at its staging key. No crash.<br>• **C, cancel mid-transfer:** a breakpoint on `gp_reader_read` limited to thread `goproceed-vault-body` slept 0.4 s per read. After 19 producer reads `cancelUpload` (`cancel(false)`) was called; the producer made 2 more reads (the chunk it had already read ahead) and stopped. Intent `3103c485…` stayed `intent_authorized`, no object stored. The runtime then marked the item `failed` (existing JS behaviour).<br>• **`authenticate` mid-transfer:** retrying the same item under the same breakpoint, `authenticate` was called part-way through; the transfer stopped before completing and the intent stayed unfinalized. This shows no regression but does not isolate S-2's fix: a producer stalled inside a read stops on the generation bump alone. S-2's own case (the producer has already written its last chunk while CFNetwork is still sending) is verified by code inspection only (row 9).<br>• **Read counts:** `dev070-lldb-c.log` has 43 producer reads and no per-transfer markers. The first cancel's split (19 reads before `cancel(false)`, 2 after) is exact; later counts missed the reads between the pull and the first sample. A complete transfer of this capture is 34 reads.<br>• **Recovery:** with `lldb` detached, a plain retry uploaded the cancelled item into the same intent `3103c485…`, now `available`.<br>The app process stayed up throughout. | `lldb` logs, debugger `list`, staging SQL (read-only) | QA |
| 9 | `gp-security` (re-check) | S-1, S-2, S-3 PASS. S-2 is correct by inspection: `authenticate` takes the task under `cancellation` with the generation bump and cancels after unlocking; lock order stays `work` → `cancellation`; no reentrancy. The R2 change hands the output from producer to `stop()` cleanly (only after `exited`, only once). New: N-1 (minor, record) the `authenticate` run cannot tell the fix from the old code; N-2 (nit) the log's read counts did not add up. Both fixed in row 8's wording. | gp-security handoff | QA |
| 10 | `gp-qa` | No FAIL. Every stated fix confirmed in the code (S-2, R1, R2, R5; R4/R6/S-1 notes). The lldb target was the final revision: `GoProceed.debug.dylib` was built after the last Swift edit, from this worktree, contains `goproceed-vault-body` and no `VaultInputStream`. Checks: `pnpm validate:canonical-docs` OK; `pnpm --filter @goproceed/mobile test` 22 files, 199 tests passed (no database); `pnpm --filter @goproceed/mobile typecheck` exit 0 — none exercises Swift. Swift build NOT RUN by QA (coordinator's build, row 8). Record nits (Plan section, row 8 A citation, S-2 wording, read counts, the poll comment) applied afterwards; the poll comment edit is comment-only. | gp-qa handoff | PR |

## Findings and rework

Rework count and hypothesis changes: 1 (the second revision after gp-mobile, row 5, is design input, not rework; row 7 is the one rework).

| ID | Severity | Area | Finding | Owner | Resolution |
|---|---|---|---|---|---|
| R1 | Minor | CPU | The 1 ms poll wakes the producer 1,000 times a second on a slow uplink | Coordinator | Fixed: 5 ms (row 7); not measured on a device (BL-002) |
| R2 | Minor | Wording / hardening | `URLSessionTask.cancel()` is asynchronous, so "cancels the task before the body ends" overstated it | Coordinator | Fixed: output left open on failure, closed by `stop()`; comment names the real guarantees (row 7) |
| R3 | Minor | Evidence | The cancel and corrupt-ciphertext criteria were NOT RUN | Coordinator | Fixed: run under `lldb` (row 8, B and C) |
| R4 | Nit | Timing | The explicit `stop()` can add up to 2 s while `work` is held | Coordinator | Recorded: the worst case is 185 s + 10 s + 2 s |
| R5 | Nit | Memory | `memcpy` made an extra plaintext copy | Coordinator | Fixed: buffers swapped (row 7) |
| R6 | Nit | Record | Row 2 described the first revision; the pair's buffer residue was unrecorded | Coordinator | Fixed: row 2 labelled superseded; «What is not true» |
| S-1 | Minor | Memory | The bound pair's 64 KiB buffer and CFNetwork's buffers hold plaintext that is freed without being wiped | Coordinator | Recorded in «What is not true» (same as the old stream) |
| S-2 | Minor | Identity | `authenticate` did not cancel a running transfer; the last pipe-full could still go out | Coordinator | Fixed: `authenticate` cancels the task (row 7); verified by inspection (row 9); row 8's run shows no regression only |
| N-1 | Minor | Evidence | The `authenticate` run cannot distinguish S-2's fix from the old code | Coordinator | Fixed: row 8 wording; S-2 recorded as inspection-verified |
| N-2 | Nit | Evidence | The cancel log's read counts did not add up | Coordinator | Fixed: row 8 states the exact and the approximate counts |
| S-3 | Minor | Evidence | The two security criteria were NOT RUN | Coordinator | Fixed: row 8, B and C |

## What is not true after this task

- Nothing was tested on a physical iPhone (BL-002).
- Cancellation was exercised through `cancelUpload` and `authenticate` (row 8). Discard, quarantine and sign-out share the same generation bump and `task.cancel()`, but were not run mid-stream here; the 185 s deadline was not run.
- Plaintext of up to one 64 KiB pipe-full, plus CFNetwork's own buffers, can remain in freed memory after a cancelled or failed transfer; neither is wiped (S-1, unchanged from the old stream).
- The worst-case duration of one `upload` call is 185 s + 10 s + 2 s (R4); `work` is held during the last 12 s.
- The 5 ms poll's CPU and battery cost was not measured on a device.
- A cancelled upload ends `failed` rather than `not_sent` on screen, because the JavaScript queue marks an interrupted transfer failed; this is existing behaviour, and a retry sends it.
- Test B left capture `a94a0e31…` with deliberately corrupt ciphertext on the simulator; it cannot be discarded until its intent `97c6a8cf…` expires (main's discard waits for a possible receipt).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| An iOS upload no longer crashes; a photo that crashed the previous build is sent at the next launch | Yes | first revision | row 3 | PASS | simulator, staging, one photo |
| The reworked body (T3/T4/T7/T10) uploads a multi-chunk photo end to end | Yes | second and third revisions | rows 5 and 8 A (intents `6ba4a393…`, `efbe8096…` `available`) | PASS | simulator, staging |
| The server accepts the body (hash and size) | Yes | all three revisions | rows 3, 5 and 8 A (intents `available`) | PASS | |
| Cancel mid-transfer cancels the task, the item is not marked sent, and the reader is freed only by the producer | Yes | third revision (working tree) | row 8 C and S-2 | PASS | simulator; stall injected with `lldb`; `cancelUpload` exercised; `authenticate`'s S-2 case by inspection only |
| A corrupt ciphertext never completes a 2xx upload (T4) | Yes | third revision (working tree) | row 8 B | PASS | simulator; corruption injected with `lldb` after the pre-send verify |
| Android unaffected | Yes | — | the Android vault code is unchanged | PASS | negative |

## Sources

- Apple, `Stream.getBoundStreams(withBufferSize:inputStream:outputStream:)`: https://developer.apple.com/documentation/foundation/stream/getboundstreams(withbuffersize:inputstream:outputstream:) (checked 2026-09-24, iOS 18.1 simulator SDK).
- Apple Developer Forums, Quinn "The Eskimo!" on streamed `URLSession` upload bodies (bound pair fed by a producer; an `InputStream` subclass is unsupported), cited by gp-mobile in row 4.
- Apple, `URLSessionTaskDelegate.urlSession(_:task:needNewBodyStream:)`: https://developer.apple.com/documentation/foundation/urlsessiontaskdelegate/urlsession(_:task:neednewbodystream:)

## Completion / handoff

Filled at closure.
