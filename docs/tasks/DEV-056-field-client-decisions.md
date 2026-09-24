# DEV-056 — The field client's open owner decisions

## Assignment

- Objective and user-visible outcome: carry out the owner's decisions on DEV-042's open questions. After this task:
  - a field worker can sign out offline;
  - a phone whose vault cannot open no longer traps its user;
  - a reinstalled iPhone does not resume the earlier session;
  - a photo the user asked to delete is never sent afterwards;
  - the queue card names the requirement even offline;
  - a discard never waits unbounded.
- State: implementing
- Coordinator: Claude Code primary session (2026-09-24).
- Execution mode: independent subagents for the stages root `AGENTS.md` requires.
- Selected route and why: native client, sign-out session code, the vault and retention of personal data. That means `gp-mobile` and `gp-architect` before design (auth and session code always takes the architect and security route), then `gp-reviewer`, `gp-security`, `gp-ui-reviewer` (screens in `apps/mobile/src`) and `gp-qa`.
- Triggered stages: `gp-mobile` (row 1), `gp-architect` (row 2), `gp-reviewer`, `gp-security` (auth/session, retention and deletion), `gp-ui-reviewer`, `gp-qa`.
- Owning module and allowed edit paths:
  - `apps/mobile/src/**`;
  - `apps/mobile/modules/goproceed-vault/{src,ios,android}/**`;
  - `technical/states/transition-catalog.csv`;
  - `technical/database/invariant-catalog.csv`;
  - `docs/decisions/ADR-013-native-field-client.md`;
  - `docs/specs/2026-09-22-mobile-native.md`;
  - this record;
  - `docs/tasks/README.md`.
- Read context: DEV-042 (Findings, «Owner decisions owed»), DEV-046, ADR-013, the spec's vault section, `docs/product/hidden-works-content-rules.md` (INV-073).
- Linked: [DEV-042](DEV-042-mobile-native.md), [DEV-046](DEV-046-android-vault.md), [ADR-013](../decisions/ADR-013-native-field-client.md).
- Baseline: `origin/main` `e43c5ecf`; branch `claude/field-decisions` in worktree `.claude/worktrees/android-vault`. `origin/main` `406f5efe` was merged in on 2026-09-24 (commit `ed400aa3`): main's cluster had taken DEV-047…055 and INV-113/114, so this task became DEV-056 and its invariants INV-115/116.
- Dependencies / constraints / out of scope:
  - No server change: no migration, grant, contract or error code.
  - No OTP email is triggered by the agent, so signed-in paths need the owner.
  - Out of scope: gp-architect's «per-subject pending count after restart».
- Required acceptance criteria: see the table below.
- Skipped stages and rationale: none.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | Offline sign-out: allowed locally; the server session is not revoked offline (accepted) | Owner's choices in this session |
| 2026-09-24 | A vault that cannot open: both «Вийти» (items stay locked) and «Стерти й вийти»; the wipe deletes every account's unsent photos on the phone, and the copy says so | Owner's choices in this session |
| 2026-09-24 | Reinstall: reset the session on first launch | Owner's choice in this session |
| 2026-09-24 | A refused discard: hold it and never send it; up to about 30 h until the server expires the intent; no cancel | Owner's choices in this session |
| 2026-09-24 | Quarantine: kept without expiry in the beta, until a public store launch | Owner's choice in this session |
| 2026-09-24 | The queue card shows the requirement | Owner's choice in this session |
| 2026-09-24 | Discard timeouts; stuck intents are released by the server purge cron | Owner's choice in this session |
| 2026-09-24 | Accepted for the beta: the stale-`authenticate` race; libsodium verified by sha256 without minisign | Owner's choice in this session |

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-mobile | Requirements R1–R31 and acceptance cases AC-1…AC-39. The findings that changed the design:<br>• the label must stay verbatim (INV-073), so it is not normalized or truncated;<br>• the hold is a flag, not a state, because quarantine/restore overwrite `state`;<br>• the refresh token does not expire by itself;<br>• an update must not be taken for a reinstall (an existing vault directory marks an update);<br>• signing in with a broken vault failed at the boundary. | gp-mobile report (session) | Owner questions |
| 2 | gp-architect | Design for sign-out, the wipe, the reinstall reset and the hold. No server change: an unfinalized intent expires after 24 h via `expire_upload_intents` in the purge cron, and only the creator's finalize makes it `available`. Catalog changes: the transition rows and INV-053 are revised, and INV-115 and INV-116 are added. An ADR-013 amendment and a spec correction are required. | gp-architect report (session); installed `@supabase/auth-js` 2.112.3 `GoTrueClient.js` | Owner questions |
| 3 | Coordinator | Implementation. | See «What changed» below | Builds, device pass, reviews |
| 4 | Coordinator | **Unit tests.** `apps/mobile`: 206/206, run with no database. New cases:<br>• sign-out against the real supabase-js 2.112.3 client with a scripted `fetch`: online; offline with a valid token; offline with an expired token; a hung request; a failing boundary; and the pinned key compared with the unpinned default;<br>• the hold, the timeouts and `stop`;<br>• held counts and the verbatim label;<br>• the storage gate and `clearPersisted`.<br>Observed along the way: with an expired token offline, auth-js keeps retrying the refresh under its lock for up to about 30 s, so `SIGNED_OUT` may not fire. The session is removed anyway and the runtime clears its own state.<br>**Builds.** Android debug and release for ARM, and iOS Debug for the simulator, all succeed. | `pnpm --filter @goproceed/mobile test`; `./gradlew :app:assembleDebug :app:assembleRelease`; `xcodebuild … -sdk iphonesimulator` | Emulator and simulator |
| 5 | Coordinator | **Vault pass on the arm64 Android 16 emulator and the iOS 18.1 iPhone 16 Pro simulator** (debug builds, calls over the Hermes debugger, identical results on both platforms):<br>• The installation check reads `fresh:false` after launch; the app has already checked and marked.<br>• A multi-line label with `’` and `№` is stored and listed verbatim. A 2001-unit label is refused (`VAULT_INVALID_ARGUMENT`) and nothing is written. An import without a label works.<br>• `requestDiscard` without confirmation is refused, and is idempotent. On a held photo, `upload`, `markAwaitingReceipt` and a new `setUploadIntent` are refused with `VAULT_DISCARD_REQUESTED`.<br>• Holds survive quarantine → authenticate → restore.<br>• `wipe` without confirmation is refused. The wipe returns all three parts done. `list` then reads `VAULT_AUTH_REQUIRED`, the marker is kept, and re-initialize, authenticate and list give an empty vault.<br>**Install detection:** no marker with a vault present reads as an update (`fresh:false`); no marker and no vault reads as a new install (`fresh:true`).<br>**iOS reinstall with real keychain values:**<br>• after an update, both values remain;<br>• after uninstall and install (new container), `gp.runtime.workspace` is `null`, while a control key survives. That proves the keychain outlives deletion, which is the bug being fixed.<br>• The marker is under Application Support with `com_apple_backup_excludeItem`; on Android it is under `no_backup`.<br>**A vault that cannot open.** On iOS, the corrupt journal gives the login screen's error card, and «Стерти фото на пристрої» → confirmation → «Стерти» re-initializes in-process and the card goes away. On Android, a corrupt journal is deleted and recreated by the platform's `DefaultDatabaseErrorHandler` (logcat), so the vault self-heals with its items lost. The error state was forced by a file in place of the vault directory instead, and then showed the same card, confirmation and recovery. | `cdp-run.mjs` steps; `simctl`, `adb run-as`, `uiautomator`; screenshots | Reviews |
| 6 | gp-ui-reviewer, gp-security, gp-reviewer (first round) | UI: HOLD (U1–U15, P1 base drift). Security: FAIL (S-01 reinstall reset fails open; S-02 a run started during a discard could finalize a held photo; S-03–S-06). Reviewer: major R1 (= S-02), R2 (= U1/S-06), R3 (Android deletes a corrupt journal); minor/nit R4–R14. | Subagent reports (session) | Rework |
| 7 | Coordinator (rework) | Stated fixes applied; see Findings. `apps/mobile` 210/210. Mutation check: with the S-02 fix removed, the two new race tests fail; restored, they pass. Rebuilt Android (arm64 debug) and iOS (simulator debug); the row 5 vault pass repeated on both with identical results (iOS `keysDeleted` now verified by `SecItemCopyMatching` returning not-found). R3 on the emulator: a photo imported, the journal corrupted → the app opens to the error card; the corrupt journal and the `.vault` stay on disk (no `DefaultDatabaseErrorHandler` deletion in logcat); «Стерти фото на пристрої» (attention colour) → confirm → vault recreated, card gone. U7: iOS screenshots recaptured with Metro running (error card, confirmation, after wipe). | `pnpm --filter @goproceed/mobile test`; `cdp-run.mjs`; `adb`, `simctl`; screenshots `a16-corrupt-card.png`, `a16-after-wipe2.png`, `ios-broken-login.png`, `ios-wipe-alert.png`, `ios-after-wipe.png` | Re-review, QA |

### What changed

- **Native vault, iOS and Android:**
  - `requirementLabel`: optional, verbatim, at most 2000 UTF-16 units, no NUL, not in the ciphertext binding.
  - `requestDiscard` sets `discardRequestedAt`. It cancels a matching transfer. `upload`, `markAwaitingReceipt` and a new `setUploadIntent` then refuse with `VAULT_DISCARD_REQUESTED`.
  - `wipe` does not open the journal. It deletes the keys, then the directory, and returns which parts are gone.
  - `installationCheck` / `installationMark`: the marker sits outside backup; «fresh» means no marker and no vault directory.
  - iOS now runs a WAL checkpoint after clean-up, as Android already did.
- **JS:**
  - `signOutLocally`: success when no session is readable through the adapter. After a bounded wait it falls back to removing the session through the adapter, so the boundary always runs.
  - The storage adapter is gated on the installation reset.
  - The supabase-js storage key is pinned to its default.
  - The runtime's identity boundary skips the native quarantine when the vault never opened or was wiped.
  - `wipe` in the runtime, followed by re-initialization in the same process.
  - Queue: the hold, `resolveHold`, bounded waits (5 s run, 10 s discard read, 15 s hold read) and `stop()`.
  - Held photos are counted apart from unsent ones.
  - Screens: the label on the queue card, the held title and copy, the «received anyway» notice, profile sign-out copy for offline and error states with «Стерти фото й вийти», and a wipe card on the login screen when the vault cannot open.
- **Catalogs and docs:** transition rows, INV-053, INV-115, INV-116, the ADR-013 amendment and the spec correction.

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S-01 / R4 | Medium / minor | `runtime.tsx`, `supabase.ts` | a failed reinstall reset must keep the vault closed, or the retry reads an update | Coordinator | Fixed: `initialize` only when `installationReady()` is true (mount and wipe) |
| S-02 / R1 | Medium / major | `queue.ts` | a run started during a discard must never finalize the held photo | Coordinator | Fixed: generation bump and abort after `requestDiscard`; the native hold is re-read before create and finalize (`notHeld`); two tests that fail without the fix (row 7) |
| S-03 / R5 | Low / minor | `sign-out.ts`, `session-storage.ts` | a refresh in flight must not write the session back after a sign-out | Coordinator | Fixed: the adapter refuses session writes after a local sign-out until the login screen reopens it before `verifyOtp`; test. Residual (nit, deferred): a sign-in within the ~30 s of auth-js's pending refresh could still be overwritten by it |
| S-04 / R6 | Low / minor | `runtime.tsx`, vault bridge | the error-state skip must close the native identity; a sign-out failing after a wipe must not strand state | Coordinator | Fixed: `queue.stop()` calls `closeIdentity()` (native `cancel(true)`); `wipe()` reports `signedOut`/`reopened` instead of throwing, `wiped` cleared in `finally`; test |
| S-05 / R8 | Low / minor | `NativeVault.swift`, `NativeVault.kt` | an unlistable surviving directory is not «deleted»; iOS keys verified gone | Coordinator | Fixed on both platforms; iOS `keysDeleted` = `SecItemCopyMatching` not-found |
| S-06 / U1 / R2 | Low / major / major | `profile.tsx` | the wipe only for a vault that cannot open (owner decision) | Coordinator | Fixed: button only when `status === "error"`; failure copy follows the cause (U9) |
| R3 | major (existing code) | `NativeVault.kt` openJournal | a corrupt journal must not be deleted by the platform | Coordinator | Fixed: a non-deleting `DatabaseErrorHandler`; the error state and the user's own wipe decide (row 7) |
| U2 | Major | `vault-wipe.ts`, `runtime.tsx` | a wipe whose sign-out failed must not say «не вдалося стерти» | Coordinator | Fixed: messages built from the reported outcome |
| U3 | Major | `profile.tsx` | held photos are not «всі підтверджено» | Coordinator | Fixed: held count shown |
| U4 | Major | `queue.tsx` | the verbatim label must be readable in full | Coordinator | Fixed: expand toggle as on the camera screen. The citation question (rule T / INV-073 on the native card) is recorded as open for the owner or gp-architect |
| U5 | Major | `primitives.tsx`, login, profile | the wipe must look destructive | Coordinator | Fixed: `Button destructive` in the attention role (screenshots row 7) |
| U6 | Major | login, profile | progress while wiping; no parallel actions | Coordinator | Fixed: «Стираємо…», buttons disabled |
| U7 | Major (evidence) | screenshots | the iOS «after wipe» image showed LogBox | Coordinator | Fixed: recaptured with Metro running (row 7) |
| U8 | Minor | `profile.tsx` | offline copy must be true; no extra tap when nothing is at stake | Coordinator | Fixed |
| U9 | Minor | `profile.tsx` | failure copy names the real cause | Coordinator | Fixed |
| U10 | Minor | `queue.tsx` | «надішлемо» not promised for held photos | Coordinator | Fixed |
| U11 | Minor | `queue.tsx` | the received-anyway notice is announced | Coordinator | Fixed: string body with `announce` |
| U12 / R13 | Minor / nit | `runtime.tsx`, `item-labels.ts` | one event reported once; a held mismatch is shown | Coordinator | Fixed: an item already reported by the discard alert is not reported again; a held photo with `RECEIPT_MISMATCH` shows the problem. Residual (nit): the card reads «Буде видалено» until the next run confirms it |
| U13 | Minor | `profile.tsx`, `login.tsx` | a wipe's outcome reaches the screen the user lands on | Coordinator | Fixed: `runtime.lastWipe` shown on login |
| U14, U15 | Nit | copy, comment | «зняти або додати знову»; comment | Coordinator | Fixed |
| R7 | nit | `runtime.tsx` | reset `known` on sign-out | Coordinator | Fixed |
| R9 | minor | tests, INV-116 witness | tests that can fail; witnesses named | Coordinator | Fixed: the timeout test releases the run after the hold; R1 tests; INV-116 names the device pass and marks the error-state choice unwitnessed |
| R10, R11, R12 | nit | INV-115/116, ADR, transition row | wording matches the mechanism | Coordinator | Fixed |
| R14 / P1 | minor | the diff, the record | review the rebuilt diff from the merge base; renumber | Coordinator | Renumbered (Baseline); the re-review uses a diff against `origin/main` `406f5efe` |

Owner questions raised by gp-security, recorded (none blocks):
1. A time-box or inactivity timeout for hosted sessions left unrevoked by an offline sign-out. This needs the Supabase Pro plan and the hosted settings were not inspected; the owner already accepted non-revocation.
2. An online sign-out whose request times out also becomes local-only, with no copy saying so. That is a limit.
3. A held photo whose `available` receipt does not match cannot be resolved, and the user cannot cancel the hold. That is a limit, and the problem is now shown on the card.

Rework count and hypothesis changes: 0 failed rounds (no QA FAIL yet); one review round with rework.

## What is not true after this task

Filled at closure.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| Unit: sign-out paths against real supabase-js (online, offline valid, offline expired, hung request, boundary failure), pinned key | Yes | working tree | row 4 | PASS | |
| Unit: hold, timeouts, stop, labels, storage gate | Yes | working tree | row 4 | PASS | |
| Native builds, iOS simulator and Android emulator | Yes | working tree | row 4 | PASS | |
| Emulator/simulator: wipe of a vault that cannot open, re-initialized to ready; hold and label through the vault; installation check; iOS reinstall reset | Yes | working tree | row 5 | PASS | assisted: driven over the debugger in debug builds; Android error state forced with a file in place of the directory |
| UI gate (docs/design/02-building-ui.md §5) | Yes | working tree | motion-audit clean; `pnpm turbo run typecheck` 10/10; landing build; step 1 not needed (tokens unchanged) | PASS | step 3 (`@goproceed/testing`) NOT RUN: it resets the local database (owner confirmation); no database, contract or catalog those suites read changed |
| Signed-in paths (offline sign-out on a device, reinstall reset with a real session, hold resolution against staging) | Yes | — | — | NOT RUN | needs the owner's OTP sign-in |

## Sources

- `@supabase/auth-js` 2.112.3 (installed): `GoTrueClient.js` `_signOut`, `_useSession`, `_callRefreshToken`, `_removeSession`; read 2026-09-24.
- Supabase, «signOut», https://supabase.com/docs/reference/javascript/auth-signout, and «Signing out», https://supabase.com/docs/guides/auth/signout, via the Supabase MCP `search_docs`, 2026-09-24: scopes, and access tokens valid until `exp`. Neither page covers offline behaviour.
- Expo SDK 57, SecureStore, https://docs.expo.dev/versions/v57.0.0/sdk/securestore/ (accessed 2026-09-24): data persists across uninstall on iOS but not on Android.
- Expo SDK 57, FileSystem, https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/ (accessed 2026-09-24): `Paths.document` is not purged by the system, unlike `Paths.cache`.

## Completion / handoff

Filled at closure.
