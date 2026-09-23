# DEV-029 — GoProceed native field client

## Assignment

- Objective and user-visible outcome: implement the owner-approved native iOS/Android field client, replacing the web capture clients; reliable encrypted pending photos and internal beta preparation.
- State: implementing
- Coordinator: Codex primary session.
- Execution mode: independent project-role subagents for architecture, mobile, review and QA; bounded implementation slices.
- Selected route: schema/contract + native UI + security; all corresponding stages apply.
- Triggered stages: gp-mobile and gp-architect completed read-only planning; gp-researcher checked SDK 57 and native storage; gp-reviewer, gp-security, gp-ui-reviewer and gp-qa required over implementation.
- Owning module and allowed edit paths: apps/mobile; field retirement and reference-image BFF under apps/app; packages/contracts, packages/tokens where necessary; supabase/migrations; associated technical catalogs, content provisioning and docs.
- Baseline: 6d694f6, clean main; implementation branch codex/mobile-native.
- Linked spec: [Native mobile](../specs/2026-09-22-mobile-native.md); [ADR-013](../decisions/ADR-013-native-field-client.md).
- Constraints: no hosted migration/deploy, no database reset/truncation, no store publication or outbound messages in this development session. Real reference illustrations require licensed owner-supplied content.
- Required acceptance: authenticated assignments; exact requirements/reference pinning; native camera/gallery provenance; atomic encrypted save; restart reconciliation; identity quarantine; phone/tablet accessibility; physical install and upgrade on both platforms.
- Skipped stages: none claimed; missing evidence remains NOT RUN.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-22 | Implement the complete supplied native-mobile plan; remove field web clients at the beginning, keep dashboard/BFF; functional glass; phone/tablet support; email OTP; encrypted foreground queue; GoProceed-owned versioned reference library; com.lightholdlabs.goproceed; TestFlight/Play Internal beta | Owner's “PLEASE IMPLEMENT THIS PLAN” in this task |

## Plan

1. Record the approved transition and retire web runtime/field capture routes.
2. Align SDK 57 patches; implement native shell, tokens, auth and device configuration.
3. Add pinned reference-image storage, opt-in API and provisioning with contract/authorization tests.
4. Implement local native vault and queue; test ciphertext integrity, receipt cleanup and account isolation.
5. Connect camera, gallery, assignments, profile and foreground recovery.
6. Run scoped tests, types, native builds and UI evidence; independent reviews then final QA. Hardware/store checks stay open without devices/accounts.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-mobile, gp-architect, gp-researcher | Independent planning completed. Whole-buffer Expo Crypto is unsuitable for the chosen streaming vault; native libsodium secretstream selected. | Planning conversation and spec | Implement bounded slices |
| 2 | Coordinator | Clean baseline; Xcode 26.4 and Android SDK present, no adb device attached. | xcodebuild -version; adb devices | Native build checks |
| 3 | Coordinator | iOS device link failed: `_gp_*` undefined because the podspec compiled no `.c` and linked no libsodium. The podspec now compiles `GPVault.c` (top-level sources only, so sodium headers stay out of the umbrella), drops tvOS, and vendors `ios/Vendor/Sodium.xcframework` (gitignored) that `pod install` builds from the pinned 1.0.22 via `scripts/sodium-xcframework.mjs` (device arm64 + simulator arm64/x86_64). Android still has no libsodium/JNI build wiring. | `xcodebuild … generic/platform=iOS` and `… iOS Simulator`, `CODE_SIGNING_ALLOWED=NO`: BUILD SUCCEEDED; `nm` shows `_gp_encrypt_file`, `_crypto_secretstream_xchacha20poly1305_init_push` | Include in DEV-029 review diff; wire Android CMake + sodium |
| 4 | Coordinator | Metro failed: `_layout`, `login`, `session-gate`, `header-actions` and the `camera`/`queue`/`profile` routes imported files never written (`lib/native/runtime`, `screens/capture`, `screens/queue`, `screens/profile`). Owner chose to finish them here. Added the runtime provider (vault init, identity boundary → queue quarantine, last-workspace reopen per subject, foreground-only sending, authorize = current occurrence read with matching workspace and `captureAllowed`, launch sweep of `Caches/Camera` and `Caches/ImagePicker`), the three screens and `lib/native/item-labels.ts`; typed `queue.test.ts` mocks. `warnQuarantine`/`purgeExpired` are not wired: the native `warnQuarantine` needs an identity that quarantine has just cleared. | `tsc --noEmit` clean; `vitest run` 19 files / 152 tests pass; `expo export --platform ios` bundles. No simulator/device run: `apps/mobile/.env` absent | Reviews; wire warned retention; device run |

## Findings and rework

First review of rows 3–4 (2026-09-23): `gp-reviewer` changes requested (1 blocker, 3 major), `gp-security` no blocker (1 major, 7 minor), `gp-ui-reviewer` HOLD (R1–R8). Rework count: 0 (first review).

| Finding | Source | Resolution |
|---|---|---|
| Upload blocks Expo's shared AsyncFunction queue ≤185 s; `cancel` waits behind it (sign-out/switch cannot abort, SecureStore stalls) | reviewer B1, security M1 | Fixed: vault `call` on its own concurrent queue, `cancel` a synchronous `Function`; `upload` releases the journal lock during transfer and re-reads the row before writing; identity and upload generations split so a pause no longer quarantines a committed import |
| One refused project capability quarantined the whole workspace | reviewer M2 | Fixed: `lib/native/authorize.ts` maps capability/workspace/occurrence refusals to item-only failures (status 0); tests |
| Membership loss answers 404 and did not quarantine; storage 401/403 quarantined everything | security m1 | Fixed: authorize 404 → `ACCESS_REVOKED` (quarantine); storage failure status 0; tests |
| «All sent» / «Усі фото отримано» / no sign-out warning when the journal was not read | reviewer M3, UI R1 | Fixed: runtime `itemsKnown`, `accessChanged`; `pendingSummary`; sign-out warns unless known empty |
| `signOut` ignored `{error}` | reviewer M4 | Fixed: throws; state cleared only on success. Offline sign-out fails closed (user stays signed in, sees an error) — owner decision owed |
| Import could be stamped with a superseded workspace; bearer subject unchecked | reviewer m5, security m3 | Fixed: `activate` throws `SUPERSEDED`; `importPhoto` refuses unless the open identity equals the screen-authorized workspace and subject; authorize compares session subject (401 otherwise); owner resolved from the auth client |
| Reopen at launch restored quarantined items without server read | security m2 | Fixed: `LAST_WORKSPACE` deleted in the identity boundary and on revocation |
| Plaintext left after rejected/failed imports | reviewer m6, security m4 | Fixed: best-effort delete on every non-commit path; sweep also in the boundary and on background when no import is in flight |
| Stale/partial xcframework or tarball reused | reviewer m7, security m5 | Fixed: `scripts/sodium-pin.json`; versioned build dirs; atomic extract; stamp-checked, staged xcframework. Independent minisign verification of the digest: open |
| No sending on reconnect though copy promised it | UI R2 | Fixed: provider runs the queue when connectivity returns (foreground only) |
| Labels contradicted the copy catalog | UI R3 | Fixed: titles from `clientStateLabel`; `field.capture.saved_local` as detail |
| VoiceOver silent; Android back mid-save; glass over camera on iOS; landscape insets | UI R4–R7 | Fixed: announcements, `BackHandler` block, `overCamera` → solid everywhere (+test), `insets.left/right` |
| Capture dead ends, raw MIME/MiB copy, picker quality, UUID params, discard weight, tablet width, podspec boilerplate, unhandled `run()` rejections | reviewer m9/nits, UI optional | Fixed |
| Queue card does not say which requirement a photo belongs to | UI R8 | **Deferred — owner decision**: needs a label snapshot in the vault journal schema |
| Vault-error state locks sign-out/account switch | reviewer m8, security m6 | **Deferred — owner decision**: fails closed with explicit copy; a confirmed «wipe vault and sign out» needs a new native operation |
| Auth keychain likely survives app deletion on iOS | security m7 | **Deferred**: needs a device check, then an installation-marker reset |
| Local stack (`http://127.0.0.1`) always puts the vault in `error` | reviewer m10 | By design (https-only storage origin); recorded |
| Same queue blocking on Android; Android vault not built | — | Open with the Android wiring |

Re-review of the rework (round 1 by AGENTS.md counting): `gp-reviewer` changes requested (major: a lost `project.view` answers 404 and still quarantined the workspace), `gp-security` no blocker (N1 discard vs running upload, N2 concurrent-queue reordering, N3 404/null-session over-quarantine), `gp-ui-reviewer` HOLD (H1 other workspaces, H2 gallery on the camera-denied screen). Rework count: 1.

| Finding | Source | Resolution |
|---|---|---|
| 404 from a lost project grant quarantined the whole workspace | reviewer N1, security N3 | Fixed: on 404 `authorize` reads `/v1/me/context`; active membership in the item's workspace → item-only `ASSIGNMENT_NOT_VISIBLE`, otherwise 403 `ACCESS_REVOKED`; tests for each branch |
| Null session on a failed refresh quarantined everything | security N3 | Fixed: item-only `SESSION_UNAVAILABLE`; test |
| «Доступ змінився» inferred from a null identity | reviewer N2 | Fixed: `NativeQueue.revoked` set only in the 401/403 branch; runtime checks it for the same subject; tests |
| Discard during a running upload; `markFailed` on a vanished row aborted the loop | reviewer N4, security N1 | Fixed: native `discard` cancels the transfer whose id matches; `markFailed` failures no longer abort `run()`; test |
| Concurrent queue could stamp an import with a reordered identity; quarantine op left identity open | security N2 | Fixed: native `importPhoto` requires `expectedSubjectId/expectedWorkspaceId` equal to its open identity, read with the generation under one lock; native `quarantine` closes the identity and cancels |
| Timeout close racing URLSession reads; task slot cleared unconditionally | reviewer N5, nit | Fixed: `VaultInputStream` read/close under a lock; on timeout cancel and wait for callbacks; one native transfer slot (`VAULT_UPLOAD_BUSY`); `task` cleared only if it is ours |
| Other workspaces' unsent photos invisible to «all sent» and sign-out | UI H1, reviewer N3 | Partly fixed: switch confirmation when leaving a workspace with pending photos (`parkedBySwitch`, tested); success copy scoped to «у цьому робочому просторі»; in-session `pendingElsewhere` notice and sign-out warning. After a restart other workspaces are unknown — a native per-subject count needs a journal subject-hash column: **gp-architect decision, deferred** |
| Gallery on the camera-denied screen gave no feedback | UI H2 | Fixed: progress, result card, error, controls disabled while saving |
| Background sweep could delete a photo still being written | reviewer nit | Fixed: `holdCapture()` from shutter/picker to commit |
| `dropPlaintext` accepted any URI | security nit | Fixed: only under `Paths.cache` |
| Sodium tree/build named by version only; truncated install reused; stamp ignored script changes | security m5 residuals, reviewer nit | Fixed: digest-tagged source and build dirs, `.installed` marker, stamp = hash of pin + both scripts; `.build/` and `ios/Vendor/` rebuilt from the verified tarball |
| Wrong error code in a test | reviewer nit | Fixed: `MEMBERSHIP_INACTIVE` |
| Android `cancel` still an AsyncFunction | reviewer nit | Open with the Android wiring |
| R8 cheaper option | UI | Done: «Відкрити доручення» link per queue card; offline requirement label still deferred |

Round-2 re-review: `gp-reviewer` no blocker/major (m1 revoked-flag race, m2 discard of `awaiting_receipt`, m3 flag changes not rebuilding slices); `gp-security` no blocker/major (1 discard does not stop a finalize in flight, 2 stale `authenticate` reopening the native identity, 3 `SCOPE_PROJECT_DENIED` at create/finalize quarantining, 4 slice builds ignore script changes, 5 test gaps); `gp-ui-reviewer` HOLD on two H1 restart cases (queue empty-state copy, silent sign-out after a restart). No new blocker, so no new round. Rework count: 1.

| Finding | Source | Resolution |
|---|---|---|
| Revoked flag set after awaiting quarantine could mark a newly opened workspace | reviewer m1 | Fixed: flag set before the await; race test |
| Discard of an item already accepted by storage / finalize in flight | reviewer m2, security 1 | Fixed: native `discard` refuses `awaiting_receipt`; `NativeQueue.discard` aborts and waits for any run, re-lists, and refuses with `ALREADY_RECEIVED` when the intent is available; UI copy for that case; tests |
| Project grant lost between authorize and create/finalize quarantined the identity | security 3 | Fixed: `SCOPE_PROJECT_DENIED` inside `process()` is item-only; test |
| Slice builds ignored flag/script changes; tarball named by version | reviewer m3, security 4, nit | Fixed: build dir keyed by digest tag + sha256 of configure args/CC/CFLAGS/LDFLAGS/AR; tarball named by digest tag |
| Busy check wrote `sending` first; stream `status` unlocked | reviewer nits | Fixed: slot taken before the journal write (released if the write fails); stream status under the lock |
| Test gaps (later items after a vanished row; membership read 401/invalid/5xx; misleading test name) | reviewer, security 5 | Fixed |
| Sign-out silent after a restart; queue empty-state promised other workspaces' photos | UI H1 | Fixed: runtime `othersUnknown` (true unless `/v1/me/context` shows exactly one active membership); sign-out warns unless the open workspace is known empty and others are known; empty-state copy scoped and keeps the don't-delete warning; «щонайменше N» when others may exist |
| Stale `authenticate` can reopen the native identity after quarantine (JS stays closed; import requires the expected identity; rows stay quarantined) | security 2, reviewer nit | **Deferred**: needs a synchronous native epoch; not exploitable per both reviewers |
| Warned retention (`warnQuarantine`/`purgeExpired`) dormant: quarantined ciphertext stays until the same subject returns | security | **Owner acceptance owed** for the beta |

Final QA (gp-qa, 2026-09-23): FAIL on criterion 5 — a `failed` item with an intent could be discarded while a finalize (aborted client-side, still running server-side, or from before a restart) went on to make the evidence `available`; the test asserted that behaviour. This QA FAIL closes round 2. Rework count: 2.

| Finding | Source | Resolution |
|---|---|---|
| Discard after a finalize was issued | gp-qa FAIL-1 | Fixed: `NativeQueue.discard` deletes an item with an intent only when the intent is terminal (`expired`, `scan_blocked`, `orphaned_for_purge`); unreadable or pre-final intent → `RECEIPT_PENDING` with copy; available → `ALREADY_RECEIVED`. Test inverted; positive controls for terminal intent and no intent; unreadable-intent test |
| `src/app/index.tsx` comment names the deleted `token-proof` route; `screens/token-proof.tsx` unused | gp-qa nit | Open: pre-existing DEV-029 web-retirement cleanup, outside rows 3–4 |
| Offline sign-out fails closed | reviewer M4 | **Owner decision owed** (listed separately at QA's request) |
| Auth keychain may survive app deletion | security m7 | **Owner acceptance owed**: internal beta on testers' own devices only until the device check and a first-launch reset |
| Stale `authenticate` reopening the native identity; minisign digest verification | security | **Owner acceptance owed** for the internal beta |
| Android vault unbuilt (CMake/JNI, `cancel` async, shared-queue blocking) | QA | Open; blocks the both-platforms criterion |

FAIL-1 re-verification: gp-qa PASS (criterion 5; 177 tests, typecheck exit 0); gp-security «fixed» (only finalize creates evidence, under the intent row lock; terminal statuses are irreversible). No new blocker; round 3 not opened. Rework count: 2.

| Remaining item | Source | Resolution |
|---|---|---|
| A refused discard (`RECEIPT_PENDING`) is followed by the queue sending that photo, so a photo the user wanted gone can still become evidence | security re-check (medium) | Copy made truthful (dialog depends on `intentId`; refusal says the app will finish sending). **Owner decision owed**: local «discard requested» hold, or a server command moving `intent_authorized` → `orphaned_for_purge` (gp-architect, new route) |
| Item stuck when no expiry sweep runs (`expire_upload_intents` needs pg_cron) or GET keeps failing | gp-qa, security | **Deferred**: treat `expiresAt` past a margin as terminal, or confirm the staging cron |
| Android `discard` has no native refusal/cancel | security | Open with the Android wiring |
| Discard has no timeout on its GET / run wait | security | Deferred (info) |
| New discard copy not UI-reviewed | gp-qa | Copy-only QA fix; gp-ui-reviewer on the next UI pass |


## What is not true after this task

This record does not assert a beta exists, a migration was applied, a backup exclusion was verified or an app was published. Physical-device, signing, content and independent-review gates remain open until evidence below establishes them.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| Physical iPhone, Android phone, iPad and Android tablet workflow | Yes | 6d694f6 | Device matrix in spec | NOT RUN | environmental: devices not connected |
| TestFlight / Play Internal install and upgrade | Yes | 6d694f6 | Store distribution runbook | NOT RUN | environmental: account/signing access not established |
| Mobile unit tests and types (rows 3–4) | Yes | working tree on 6d694f6 | `pnpm --filter @goproceed/mobile test` 20 files / 177 tests; `typecheck` exit 0 | PASS | No database suites involved |
| Vault crypto container (C) | Yes | same | `node modules/goproceed-vault/scripts/test-container.mjs` | PASS | Host build only |
| iOS native link with pinned libsodium | Yes | same | `pod install`; `xcodebuild` Debug generic iOS and Release simulator BUILD SUCCEEDED; `nm` shows `_gp_*` and secretstream symbols | PASS | Android not built |
| Simulator launch | Yes | same | Ad-hoc-signed Release on iPhone 16 Pro (iOS 18.1): Ukrainian login screen, no keychain/JS errors in the first log window | PASS (launch only) | Sign-in needs an owner OTP; no post-login screen |
| Independent reviews of rows 3–4 | Yes | same | gp-reviewer: no blocker/major after round 2; gp-security: no blocker/major, FAIL-1 fix confirmed; gp-ui-reviewer: H1/H2 fixed as stated (not re-reviewed after the last copy change); gp-qa: FAIL-1 re-verified PASS | PASS for rows 3–4 | Owner decisions and device/Android gates below still block done |

## Sources

Accessed 2026-09-22. Expo installed baseline 57.0.9 / RN 0.86.2; patch alignment required by expo install --check.

- https://docs.expo.dev/versions/v57.0.0/sdk/camera/ (updated 2026-08-13).
- https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/ (updated 2026-08-15).
- https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/ (updated 2026-07-20).
- https://docs.expo.dev/versions/v57.0.0/sdk/crypto/ (updated 2026-08-15).
- https://docs.expo.dev/versions/v57.0.0/sdk/securestore/ (updated 2026-07-20).
- https://doc.libsodium.org/secret-key_cryptography/secretstream and https://github.com/jedisct1/libsodium/releases/tag/1.0.22-RELEASE (new pinned native dependency; release publication date not independently recorded).

## Completion / handoff

- Review independence: planning independent; rows 3–4 reviewed by independent gp-reviewer, gp-security, gp-ui-reviewer and gp-qa subagents (Claude Code session, 2026-09-23); other DEV-029 slices not yet reviewed.
- Verified scope: inspection only at task creation.
- Remaining risks / blocked requirements: native compilation, device integrity/backup/performance, licensed illustrations, signing/store installation.
- Next bounded action: implement foundation and independent backend/vault slices.
- Rows 3–4 (2026-09-23, Claude Code): iOS build fixed, runtime and three screens written, three review rounds, QA PASS at unit/build/launch level. Owner decisions owed: offline sign-out, vault-error sign-out, warned retention, keychain-after-deletion limit, R8 offline label, refused-discard behaviour.
- Final state: implementing; no done claim.
