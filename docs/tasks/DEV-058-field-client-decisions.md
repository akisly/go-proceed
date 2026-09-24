# DEV-058 — The field client's open owner decisions

## Assignment

- Objective and user-visible outcome: carry out the owner's decisions on DEV-042's open questions. After this task:
  - a field worker can sign out offline;
  - a phone whose vault cannot open no longer traps its user;
  - a reinstalled iPhone does not resume the earlier session;
  - a photo the user asked to delete is never sent afterwards;
  - the queue card names the requirement even offline;
  - a discard never waits unbounded.
- State: verifying
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
- Baseline: `origin/main` `e43c5ecf`; branch `claude/field-decisions` in worktree `.claude/worktrees/android-vault`. `origin/main` `406f5efe` was merged in on 2026-09-24 (commit `ed400aa3`): main's cluster had taken DEV-047…055 and INV-113/114, so this task became DEV-056 and its invariants INV-115/116. `origin/main` `599d337a` was merged in on 2026-09-24 (commit `50828fcf`): a parallel session had taken DEV-056 (libsodium minisign) and DEV-057, so this task is DEV-058.
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
| 2026-09-24 | Accepted for the beta: the stale-`authenticate` race; libsodium verified by sha256 without minisign — the minisign half was overtaken the same day by [DEV-056](DEV-056-sodium-minisign.md), which added the signature check | Owner's choice in this session |

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
| 8 | gp-ui-reviewer, gp-security, gp-reviewer (second round) | UI: HOLD (N1 major: a carried wipe message never cleared, and could be false; N2–N6 minor). Security: PASS (S-01…S-06 confirmed; S-07, S-08 Low; N-1, N-2 nits). Reviewer: no blocker or major (F1 = N1; F2–F7 minor or nit). | Subagent reports (session) | Rework |
| 9 | Coordinator (second rework) | Stated fixes applied; see Findings. `main` `599d337a` merged in (DEV-056, DEV-057), and this task renumbered to DEV-058. Merged tree: `apps/mobile` 217/217, typecheck clean. Android arm64 and iOS simulator rebuilt, and the row 5 vault pass repeated with identical results on both. S-07 on the emulator: the journal's index page corrupted while the table still reads (`sqlite3`: `select count(*)` = 1, `quick_check` fails) → the app opens to the error card; logcat shows `SQLiteDatabaseCorruptException` from `quick_check`, and the journal and `.vault` stay on disk. | `pnpm --filter @goproceed/mobile test`; `./gradlew`, `xcodebuild`; `cdp-run.mjs`; `a16-index-corrupt.png` | UI re-review, QA |
| 10 | gp-ui-reviewer (third round); Coordinator | UI: PASS. U3-1 (a sign-in after a failed reset now reopens the vault) and U3-2 (a clean wipe that left the user signed in is said as info) fixed; 217/217. | Subagent report (session); `pnpm --filter @goproceed/mobile test` | gp-qa |

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

| N1 / F1 | Major / minor | `login.tsx`, `runtime.tsx` | a carried wipe message is shown once and is never false | Coordinator | Fixed: `lastWipe` kept only when the wipe signed out; login reads it once and clears it (`clearLastWipe`) |
| N2 | Minor | `login.tsx` | sign-in and wipe do not run together | Coordinator | Fixed: both disabled while the other runs |
| N3 | Minor | `queue.tsx` | the label toggle meets the touch target | Coordinator | Fixed: `minHeight: touchHeight` |
| N4 | Minor | `primitives.tsx` | the destructive treatment is a decision, not drift | Coordinator | Recorded: the field client's mobile primitives carry a destructive button for the vault wipe, as `status-attention-fg` on `bg-subtle` (the queue discard's precedent). This is outside the web component contract, so `component-contract.test.ts` does not scan it. Owner or architect to confirm at merge |
| N5 | Minor (evidence) | Android screenshots | the LogBox toast | Coordinator | Recorded: «Can't perform a React state update on a component that hasn't mounted yet» already appeared on the DEV-046 debug build before this task (Metro log 2026-09-24). It is a development-only warning that this diff did not introduce; not investigated |
| N6 | Minor | `wipe-note.ts`, login | a clean wipe is said | Coordinator | Fixed: «Фото на пристрої стерто.» as a non-error announced notice; tests |
| F2 | minor | `item-labels.ts` | a held photo's problem never asks to resend | Coordinator | Fixed: «Сервер отримав інший файл, ніж на пристрої. Повідомте керівника проєкту.»; test |
| F3 / S-08 | minor / Low | `runtime.tsx`, screens | a failed reinstall reset is not a broken vault | Coordinator | Fixed: `errorReason` `installation` shows «звільніть місце й перезапустіть» with no wipe, and is retried when the app returns to the foreground |
| F4 | minor | `runtime.tsx` | after a successful wipe, nothing reports it as failed | Coordinator | Fixed: the session read is inside the reported-outcome guard |
| F5 | nit | catalogs | the enforcement column and transition rows say what native code guards and what JavaScript guards | Coordinator | Fixed |
| F6 | nit | `queue.ts` | the discard's supersede only when a run is active | Coordinator | Fixed |
| F7 | minor (record) | this record | state, acceptance and the deferred items | Coordinator | Fixed in this revision |
| S-07 | Low | `NativeVault.kt`, `NativeVault.swift` | corruption the open does not touch lands in the error state | Coordinator | Fixed: `PRAGMA quick_check` in `openJournal` on both platforms (row 9) |
| N-1 | Nit | `runtime.tsx` | `wipe()` checks the state itself | Coordinator | Fixed: refused unless the vault cannot open |
| N-2 | Nit | `supabase.ts` | one reset retry at a time | Coordinator | Fixed |
| U3-1 | Minor | `runtime.tsx` | a sign-in after a failed reinstall reset reaches ready without waiting for a foreground event | Coordinator | Fixed: the vault reopens when a session arrives while the reason is `installation` |
| U3-2 | Nit | `profile.tsx` | a clean wipe that left the user signed in is said, not as an error | Coordinator | Fixed: a separate info notice |
| S-03 residual | Low | sign-out | a sign-in inside auth-js's pending-refresh window | Owner | Deferred to [BL-155](../BACKLOG.md#bl-155) |

Owner questions raised by gp-security, recorded (none blocks):
1. A time-box or inactivity timeout for hosted sessions left unrevoked by an offline sign-out. This needs the Supabase Pro plan and the hosted settings were not inspected; the owner already accepted non-revocation.
2. An online sign-out whose request times out also becomes local-only, with no copy saying so. That is a limit.
3. A held photo whose `available` receipt does not match cannot be resolved, and the user cannot cancel the hold. That is a limit, and the problem is now shown on the card.

Rework count and hypothesis changes: 0 failed rounds (no QA FAIL, no new blocker); two review rounds with rework.

## What is not true after this task

- **No signed-in path ran.** No real sign-out, reinstall with a real session, hold resolved against staging, or screen with real data was exercised; everything ran through the vault directly. See the NOT RUN rows.
- **The hold waits on the server.** A held photo disappears only once the server expires its intent: 24 h plus the next purge cron, observed only while the app is open and online. The user cannot cancel a hold. A held photo whose `available` receipt does not match cannot be resolved; the card shows the problem.
- **Offline sign-out does not revoke the server session.** The refresh token is deleted from the phone but stays valid on the server; hosted session limits need the Supabase Pro plan and were not inspected. An online sign-out whose request times out also becomes local-only, with no copy saying so.
- **The S-03 residual.** A sign-in inside auth-js's pending-refresh window can still be overwritten ([BL-155](../BACKLOG.md#bl-155)).
- **Quarantine without expiry** until a public store launch (ADR-013 amendment); the seven-day warned expiry is not wired.
- **The wipe is device-wide.** It deletes every account's unsent photos when the vault cannot open. A vault that opens but later fails a write (a full disk) can still refuse sign-out without offering the wipe; `quick_check` covers corruption, not a full disk.
- **U4's citation question.** Whether the queue card's verbatim requirement text must carry a verification tag and source (INV-073, content rules) is open for the owner or gp-architect.
- **Development builds only.** A React warning («Can't perform a React state update on a component that hasn't mounted yet») appears in development builds; it predates this task and was not investigated.
- **Physical devices:** none used (BL-002).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| Unit: sign-out paths against real supabase-js 2.112.3 (online, offline valid, offline expired, hung request, boundary failure, late refresh), pinned key | Yes | final commit | `pnpm --filter @goproceed/mobile test` (rows 4, 7, 9) | PASS | |
| Unit: hold, the S-02 race (mutation-checked), timeouts, `stop`, labels, storage gate and latch, wipe notes | Yes | final commit | same | PASS | |
| Native builds: Android arm64 debug, iOS simulator debug | Yes | final commit | `./gradlew`, `xcodebuild` (row 9) | PASS | the release and 16 KB checks are DEV-046's; not repeated here |
| Emulator and simulator vault pass: verbatim label, hold and its guards, holds survive quarantine and restore, wipe, installation marker | Yes | final commit | row 9 (both platforms) | PASS | assisted: driven over the debugger with test UUIDs, no server |
| iOS reinstall reset with real keychain values (an update keeps them; uninstall and reinstall clear them while a control key survives) | Yes | `ea47c24b` | row 5 | PASS | assisted: debugger-seeded values; that code path is unchanged since |
| A vault that cannot open: the error card, confirmation, wipe, in-process reopen; R3 (Android keeps a corrupt journal); S-07 (a corrupt index reaches the error state) | Yes | final commit | rows 5, 7, 9; screenshots | PASS | the Android wipe confirmation has no screenshot at the final commit (row 5 has one) |
| UI gate (`docs/design/02-building-ui.md` §5) | Yes | final commit | `dev058-gate.txt`: motion-audit clean, typecheck 10/10, landing build, tokens unchanged | PASS | step 3 NOT RUN: `@goproceed/testing` resets the local database (owner confirmation); this change touches no database, contract or catalog those suites read |
| Signed-in paths: offline sign-out on a device, the reinstall reset with a real session, a hold resolved against staging, the queue card, the held item, the received-anyway notice, the profile states, «Стираємо…» | Yes | — | — | NOT RUN | environmental: needs the owner's OTP sign-in on staging (simulator or emulator) or a device; settled by a signed-in pass (see What is not true) |
| A failed reinstall reset shows its own card and is retried (S-08) | Yes | — | code review only | NOT RUN | not-provable-locally: it needs a keychain or disk fault injected on a device or simulator |

## Sources

- `@supabase/auth-js` 2.112.3 (installed): `GoTrueClient.js` `_signOut`, `_useSession`, `_callRefreshToken`, `_removeSession`; read 2026-09-24.
- Supabase, «signOut», https://supabase.com/docs/reference/javascript/auth-signout, and «Signing out», https://supabase.com/docs/guides/auth/signout, via the Supabase MCP `search_docs`, 2026-09-24: scopes, and access tokens valid until `exp`. Neither page covers offline behaviour.
- Expo SDK 57, SecureStore, https://docs.expo.dev/versions/v57.0.0/sdk/securestore/ (accessed 2026-09-24): data persists across uninstall on iOS but not on Android.
- Expo SDK 57, FileSystem, https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/ (accessed 2026-09-24): `Paths.document` is not purged by the system, unlike `Paths.cache`.

## Completion / handoff

- Changed files: `apps/mobile/src/**` (native runtime, queue, sign-out, session storage, supabase, item labels, wipe notes, screens, primitives, `ui/vault-wipe.ts`), `apps/mobile/modules/goproceed-vault/{src,ios,android}/**`, `technical/states/transition-catalog.csv`, `technical/database/invariant-catalog.csv`, `docs/decisions/ADR-013-native-field-client.md`, `docs/specs/2026-09-22-mobile-native.md`, `docs/BACKLOG.md` (BL-155), this record, `docs/tasks/README.md`.
- Review independence: independent — `gp-mobile`, `gp-architect`; `gp-reviewer` and `gp-security` two rounds each; `gp-ui-reviewer` three rounds; `gp-qa` pending. All subagents.
- Verified scope: unit tests, native builds, the vault on the Android emulator and iOS simulator, iOS reinstall behaviour, and the vault-error UI.
- Remaining risks / blocked requirements: see What is not true; the signed-in pass needs the owner.
- Next bounded action and owner: gp-qa on the final commit; the owner merges.
- Final state and reason: verifying — every review stage passed (gp-ui-reviewer PASS in its third round, gp-security PASS, gp-reviewer with no blocker or major); gp-qa is pending.
