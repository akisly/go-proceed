# DEV-042 — GoProceed native field client

## Assignment

- Objective and user-visible outcome: implement the owner-approved native iOS/Android field client, replacing the web capture clients; reliable encrypted pending photos and internal beta preparation.
- State: blocked (merged in #115 and deployed 2026-09-23; waiting on owner consent for the database suites, devices and store accounts, the Android native build, and the owner decisions below)
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
| 3 | Coordinator | iOS device link failed: `_gp_*` undefined because the podspec compiled no `.c` and linked no libsodium. The podspec now compiles `GPVault.c` (top-level sources only, so sodium headers stay out of the umbrella), drops tvOS, and vendors `ios/Vendor/Sodium.xcframework` (gitignored) that `pod install` builds from the pinned 1.0.22 via `scripts/sodium-xcframework.mjs` (device arm64 + simulator arm64/x86_64). Android still has no libsodium/JNI build wiring. | `xcodebuild … generic/platform=iOS` and `… iOS Simulator`, `CODE_SIGNING_ALLOWED=NO`: BUILD SUCCEEDED; `nm` shows `_gp_encrypt_file`, `_crypto_secretstream_xchacha20poly1305_init_push` | Include in DEV-042 review diff; wire Android CMake + sodium |
| 4 | Coordinator | Metro failed: `_layout`, `login`, `session-gate`, `header-actions` and the `camera`/`queue`/`profile` routes imported files never written (`lib/native/runtime`, `screens/capture`, `screens/queue`, `screens/profile`). Owner chose to finish them here. Added the runtime provider (vault init, identity boundary → queue quarantine, last-workspace reopen per subject, foreground-only sending, authorize = current occurrence read with matching workspace and `captureAllowed`, launch sweep of `Caches/Camera` and `Caches/ImagePicker`), the three screens and `lib/native/item-labels.ts`; typed `queue.test.ts` mocks. `warnQuarantine`/`purgeExpired` are not wired: the native `warnQuarantine` needs an identity that quarantine has just cleared. | `tsc --noEmit` clean; `vitest run` 19 files / 152 tests pass; `expo export --platform ios` bundles. No simulator/device run: `apps/mobile/.env` absent | Reviews; wire warned retention; device run |
| 5 | Coordinator | Owner chose the full rollout route (2026-09-23): commit, merge main, review the unreviewed slices, apply migrations to staging, open a PR; the owner merges and sets `PURGE_DB_URL`/`CRON_SECRET`. Merging main (46 commits) collided on numbers: this task was DEV-029 (main's DEV-029 is the landing depth task) and is now DEV-042; migration 0090 is now 0095 (main owns 0090–0094); catalog rows DA-185…187 → DA-191…193 and INV-105/106 → INV-108/109. One merge conflict: `apps/mobile/qa/field-web.mjs` (retired here, touched by main's DEV-033) — deleted. | `git merge origin/main`; duplicate-ID scan of the catalogs | Validators, reviews of the reference-image BFF/migration/web retirement, staging |
| 6 | gp-reviewer, gp-security, gp-ui-reviewer | First review of the slices no one had reviewed (0095, reference-image BFF, catalogs, web retirement, Codex's field screens). Security: no vulnerability. Reviewer: **no-go for staging** — with the manifest empty, 0095's insert guard refuses every library-rule publication (main's build: 500; this build: 422) and ~17 apps/app integration suites fail in fixture setup; INV-108 has no database test; `goproceed-field` Vercel project left undefined; INV-086 now false. UI: HOLD (4 high, 8 medium). Security and UI high items fixed in `13f6490`. The hosted apply of 0090 was refused by the session's permission classifier before any statement ran; staging is unchanged (schema observed at 0089). *[Corrected 2026-09-23 (gp-qa FAIL-3): the refused attempt was the Supabase MCP apply of this task's migration, then numbered `0090` (`0095` since row 5's renumbering); nothing reached staging through MCP. `0095` later reached staging through `supabase db push` after a local dry run and the owner's permission (row 8).]* | Review reports; `13f6490` | **Owner decisions**: pin-if-present vs publication freeze; `goproceed-field`; permission for the hosted apply |
| 7 | Owner + coordinator | Owner (2026-09-23): library rules pin the latest illustration **if one exists** (spec and INV-108 amended; 0095 guard and `latestReferenceImagePin` changed; integration test now expects an unpinned 201; unit test; new INV-108 database probes in `m1-project-sourced-schema.test.ts`); **delete `goproceed-field`** — the owner deletes the Vercel project (irreversible; not an agent action) and `FIELD_CLIENT_ORIGINS` can then be emptied; **grants permission** for the hosted apply. Also: INV-086 amended for native provenance; relationship-catalog and DA-194 storage rows; `lock_timeout` in 0095; the dead `@goproceed/mobile qa` script removed and AGENTS.md's harness line corrected; API origin trailing slash. Deferred: guards fail closed on an invisible parent (no path reaches it), illustration caching, strict `v1` parse, glass header and ember icons (owner), per-requirement primaries vs «one primary action» (spec), handoff page (superseded by deletion). | typecheck 10/10; mobile 178; app unit 18; `validate:agents` OK; canonical docs green except the STATUS marker | Hosted apply after the owner's permission; database suites NOT RUN |
| 8 | Coordinator | Re-reviews: security **go** with conditions; reviewer **conditional go** (record numeric versions, local dry run first, no provisioning while main's build serves staging); UI HOLD R1/R2 fixed (`d0bac4e`); reviewer F1–F6 fixed (`d99c48a`). Owner deleted `goproceed-field`, removed `FIELD_CLIENT_ORIGINS` (verified by env-name listing) and set `PURGE_DB_URL`/`CRON_SECRET` (names verified, values not read); owner pushed `0090`–`0094`; purge roles verified (LOGIN/NOINHERIT/NOBYPASSRLS, member of `goproceed_purge_worker` only, EXECUTE on the five functions). `0095`: local dry run in a rolled-back transaction, applied locally (`--single-transaction`), `supabase db push --linked --dry-run` listed only `0095`, then pushed to staging. | Staging read-back: registry head `0095:the_reference_pinned_before_the_photo`; RLS on; only `goproceed_app:SELECT`; private 5 MiB bucket; 0 client storage policies; 3 triggers; 0 images, 0 pinned rules | PR; owner merges; do not provision illustrations until this build serves staging |
| 9 | Coordinator | `main` moved while this branch was pushed: #114 took DEV-041 (hosted staging migrations 0059–0094). This task is renumbered DEV-042 (it was DEV-029, then DEV-041). Migration 0095's header still says DEV-041 — the number at apply time; an applied migration is not rewritten. | `git ls-tree origin/main docs/tasks/` | Merge main again; PR |
| 10 | Coordinator + gp-qa, gp-reviewer, gp-ui-reviewer | Owner option (a) sweep (`36df971f`): gp-qa **PASS** on all docs criteria (331 hits classified; scope wording unchanged; catalogs parse). gp-reviewer on the gp-mobile trigger change: no blocker; role now reads ADR-013/spec, vault guidance and native acceptance cases; AGENTS.md/COORDINATION.md say «installation» and name the vault (`3cbf692b`). gp-ui-reviewer on the discard copy: HOLD → fixed (`44d03106`: ITEM_GONE ≠ received, per-item pending state, modal outcomes, honest RECEIPT_PENDING copy) → **PASS**. gp-reviewer on that fix: no blocker; follow-ups fixed (identity switch → SUPERSEDED, concurrent delete → ITEM_GONE, synchronous guard, tests). iOS: `pod install` + `xcodebuild` Debug device and simulator BUILD SUCCEEDED at `6ed52bf` (code identical to `ff3079c`; later commits JS/docs only). | mobile vitest 181; tsc clean; validators OK | gp-qa confirms the last fix; owner merges #115 |
| 11 | Coordinator + gp-qa, gp-reviewer | gp-qa at `ed3baa69`: a switch during the discard's receipt read still reported «gone» (FAIL); Android-wrapped `VAULT_NOT_FOUND`; `agents/README.md` row. Fixed in `3789fda6` → gp-qa **PASS** on all three (mutation-checked against the parent). gp-reviewer **PASS**; its test gaps and the optional receipt-read-failure case fixed in the next commit (identity re-checked in that catch → SUPERSEDED; tests for a switch during the native delete, a switch during a failing receipt read, and a non-matching native code). Android `discard` lacks the iOS native refusal/cancel — already open with the Android wiring. | mobile vitest 186; tsc clean; validators OK | Owner merges #115 |
| 12 | Coordinator | **Merged and deployed.** PR #115 merged by the owner (`8f63739`, 2026-09-23). Vercel `goproceed-app` production deployment `dpl_G5M9Rs1Z7mzREne6L3BGTg8VmV3n` READY on `8f63739` (region arn1), aliased to `goproceed-app.vercel.app`. Unauthenticated probes: `/login` 200; `/` 307; `/v1/me/context`, `/v1/assignments/{id}/requirement-occurrences?referenceImages=v1`, `/v1/occurrences/{id}/reference-image` (404 before this deploy) and `/internal/evidence/purge` all 401; the reference-image route sends `private, no-store`, `nosniff`, `default-src 'none'; sandbox`, `cross-origin-resource-policy: same-origin`. Vercel runtime errors, first hour: none. Not observed: any authenticated request (sign-in needs the owner's OTP). State → **blocked** on the items below, not done: required gates are still NOT RUN. | Vercel deployment and runtime-errors reads; `curl` probes | Owner: sign in on a device; database-suite consent; decisions below |

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
| `src/app/index.tsx` comment names the deleted `token-proof` route; `screens/token-proof.tsx` unused | gp-qa nit | Open: pre-existing DEV-042 web-retirement cleanup, outside rows 3–4. *[Fixed 2026-09-23 (gp-qa FAIL-2 slice): nothing imported `screens/token-proof.tsx` (grep), so it is deleted, and the `index.tsx` comment dates the route's removal. `packages/testing/src/status-label-fidelity.test.ts` still names the file in a historical comment — outside that slice's paths; **coordinator** decides whether to date it.]* *[2026-09-23 (gp-qa FAIL-3b slice): that comment now carries a dated DEV-042 note.]* |
| Offline sign-out fails closed | reviewer M4 | **Owner decision owed** (listed separately at QA's request) |
| Auth keychain may survive app deletion | security m7 | **Owner acceptance owed**: internal beta on testers' own devices only until the device check and a first-launch reset |
| Stale `authenticate` reopening the native identity; minisign digest verification | security | **Owner acceptance owed** for the internal beta |
| Android vault unbuilt (CMake/JNI, `cancel` async, shared-queue blocking) | QA | Open; blocks the both-platforms criterion |

FAIL-1 re-verification: gp-qa PASS (criterion 5; 177 tests, typecheck exit 0); gp-security «fixed» (only finalize creates evidence, under the intent row lock; terminal statuses are irreversible). No new blocker; round 3 not opened. Rework count: 2.

| Remaining item | Source | Resolution |
|---|---|---|
| A refused discard (`RECEIPT_PENDING`) is followed by the queue sending that photo, so a photo the user wanted gone can still become evidence | security re-check (medium) | Copy made truthful (dialog depends on `intentId`; refusal says the app will finish sending). **Owner decision owed**: local «discard requested» hold, or a server command moving `intent_authorized` → `orphaned_for_purge` (gp-architect, new route) |
| Item stuck when no expiry sweep runs (`expire_upload_intents` needs pg_cron) or GET keeps failing | gp-qa, security | **Deferred**: treat `expiresAt` past a margin as terminal, or confirm the staging cron. *[2026-09-23: **owner decision owed**, with **gp-architect** if the client rule is chosen. Observed in the tree: the purge route also expires intents (`apps/app/src/lib/evidence-purge.ts` calls `app.expire_upload_intents()`), `apps/app/vercel.json` schedules `/internal/evidence/purge` four times a day, and DEV-041 recorded those cron entries registered on `goproceed-app` production with a manual run answering 200. Whether that sweep releases a stuck native item in practice, and the GET-keeps-failing case, were not observed.]* |
| Android `discard` has no native refusal/cancel | security | Open with the Android wiring |
| Discard has no timeout on its GET / run wait | security | Deferred (info). *[2026-09-23: **owner decision owed** — accept for the internal beta or schedule a bounded timeout; no gp-architect route needed unless the refusal semantics change.]* |
| New discard copy not UI-reviewed | gp-qa | Copy-only QA fix; gp-ui-reviewer on the next UI pass |


### Escalation (2026-09-23) — three QA rounds on the final branch

- **Failure history.** Final QA at `2ad7d5d`: FAIL-1 (owner's permission rule swept into `.claude/settings.json` by `git add -A`), FAIL-2 (catalogs/harness naming the retired web client), FAIL-3 (STATUS, architecture docs, ADRs, record). Fixed in `737f6e0`, `ff3079c`. Re-check: FAIL-1/2 PASS, FAIL-3b (release scope, roadmap, delivery, runbooks, backlog). Fixed in `6ed52bf`. Re-check: those notes PASS, but a wider sweep found 11 more live statements of the old client (roadmap accounts row and M2 exit gates, runbook §8.3 and Plan C, README-staging §6.9, BL-001/BL-136, personas-and-workflows, vision-and-positioning, scope-and-boundaries v0.3 paragraph, production-readiness).
- **Root cause.** The web field client was the pilot's surface for months; its description is spread across dozens of product, delivery and infra documents, and each QA pass swept a wider net than the last. No code, build or migration finding is open.
- **Options.** (a) One more docs-only slice with an exhaustive repository sweep (all of `docs/product`, `docs/delivery`, `infra`, `docs/BACKLOG.md`) before QA; (b) accept with documented limits: merge with the remaining stale prose recorded as a backlog item; (c) defer the sweep to its own task after merge.
- **Decision (owner, 2026-09-23):** option (a) — one exhaustive docs-only sweep, then one QA pass.

## What is not true after this task

This record does not assert a beta exists, a migration was applied, a backup exclusion was verified or an app was published. Physical-device, signing, content and independent-review gates remain open until evidence below establishes them.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| Physical iPhone, Android phone, iPad and Android tablet workflow | Yes | ff3079c | Device matrix in spec | NOT RUN | environmental: devices not connected |
| TestFlight / Play Internal install and upgrade | Yes | ff3079c | Store distribution runbook | NOT RUN | environmental: account/signing access not established |
| Mobile unit tests and types | Yes | ff3079c | `pnpm --filter @goproceed/mobile test` 20 files / 178 tests; `pnpm --filter @goproceed/mobile typecheck` exit 0 (re-run by gp-qa at `ff3079c`, 2026-09-23; first re-run by the FAIL-2/FAIL-3 slice on the tree `ff3079c` then committed) | PASS | No database suites involved |
| Vault crypto container (C) | Yes | tree committed as `ff3079c` (run before that commit; the commit changed no vault source) | `node modules/goproceed-vault/scripts/test-container.mjs` (re-run 2026-09-23): `PASS: stream roundtrip, chunking, wrong key, identity binding, size/hash mismatch, cap, corruption, trailing bytes, truncated final tag` | PASS | Host build only |
| iOS native link with pinned libsodium | Yes | rows 3–4 working tree (the base recorded here was `6d694f6`); not re-run at 2ad7d5d | `pod install`; `xcodebuild` Debug generic iOS and Release simulator BUILD SUCCEEDED; `nm` shows `_gp_*` and secretstream symbols | PASS | Android not built; a rebuild at the final revision is owed |
| Simulator launch | Yes | same as the row above | Ad-hoc-signed Release on iPhone 16 Pro (iOS 18.1): Ukrainian login screen, no keychain/JS errors in the first log window | PASS (launch only) | Sign-in needs an owner OTP; no post-login screen |
| Independent reviews of rows 3–4 | Yes | rows 3–4 working tree | gp-reviewer: no blocker/major after round 2; gp-security: no blocker/major, FAIL-1 fix confirmed; gp-ui-reviewer: H1/H2 fixed as stated (not re-reviewed after the last copy change); gp-qa: FAIL-1 re-verified PASS | PASS for rows 3–4 | Owner decisions and device/Android gates below still block done |
| Independent reviews of the other slices (0095, reference-image BFF, catalogs, web retirement) | Yes | `d99c48a` and earlier (rows 6–8) | gp-security go with conditions; gp-reviewer conditional go, F1–F6 fixed in `d99c48a`; gp-ui-reviewer R1/R2 fixed in `d0bac4e` | PASS with conditions | Conditions in row 8 |
| Database suites (`apps/app` integration, `packages/testing`, including the INV-108 probes) | Yes | — | not run: they truncate or reset the local database and need the owner's authorization | NOT RUN | Blocks done |
| Android native vault build | Yes | — | no CMake/JNI/libsodium wiring | NOT RUN | Blocks the both-platforms criterion |

## Sources

Accessed 2026-09-22. Expo installed baseline 57.0.9 / RN 0.86.2; patch alignment required by expo install --check.

- https://docs.expo.dev/versions/v57.0.0/sdk/camera/ (updated 2026-08-13).
- https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/ (updated 2026-08-15).
- https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/ (updated 2026-07-20).
- https://docs.expo.dev/versions/v57.0.0/sdk/crypto/ (updated 2026-08-15).
- https://docs.expo.dev/versions/v57.0.0/sdk/securestore/ (updated 2026-07-20).
- https://doc.libsodium.org/secret-key_cryptography/secretstream and https://github.com/jedisct1/libsodium/releases/tag/1.0.22-RELEASE (new pinned native dependency; release publication date not independently recorded).

## Completion / handoff

- Review independence: planning independent; rows 3–4 reviewed by independent gp-reviewer, gp-security, gp-ui-reviewer and gp-qa subagents (Claude Code session, 2026-09-23); other DEV-042 slices not yet reviewed.
- Verified scope: inspection only at task creation.
- Remaining risks / blocked requirements: native compilation, device integrity/backup/performance, licensed illustrations, signing/store installation.
- Next bounded action: implement foundation and independent backend/vault slices.
- Rows 3–4 (2026-09-23, Claude Code): iOS build fixed, runtime and three screens written, three review rounds, QA PASS at unit/build/launch level. Owner decisions owed: offline sign-out, vault-error sign-out, warned retention, keychain-after-deletion limit, R8 offline label, refused-discard behaviour.
- Final state: implementing; no done claim. *[Superseded 2026-09-23 by the closure below.]*
- *[Refreshed 2026-09-23, after gp-qa FAIL-2/FAIL-3 on `2ad7d5d`.]* Reviews: rows 3–4 went through three review rounds and final QA (above); the other slices — `0095`, the reference-image BFF, the catalogs and the web retirement — had a first review and re-reviews (rows 6–8: security go with conditions, reviewer conditional go, UI R1/R2 fixed). QA: FAIL-1 re-verified PASS; FAIL-2 (catalogs, harness strings, retired-origin comments, token-proof leftover) and FAIL-3 (STATUS, architecture docs, ADR supersession notes, this record) addressed by a documentation slice awaiting gp-qa re-verification. Hosted: `0095` applied to staging (row 8); `goproceed-field` deleted and `FIELD_CLIENT_ORIGINS` removed by the owner. PR #115 open, not merged.
- Remaining NOT RUN: database suites (`apps/app` integration and `packages/testing`, owner authorization needed); Android native vault build; the physical device matrix (iPhone, Android phone, iPad, Android tablet); signing, TestFlight and Play Internal install and upgrade; an iOS rebuild at the final revision.
- Owner decisions owed: offline sign-out; vault-error sign-out; warned retention (seven-day expiry not wired, ADR-013 annotated); keychain-after-deletion limit; R8 offline label; refused-discard behaviour; the stuck-item rule; discard timeout; stale `authenticate` and minisign digest acceptance. gp-architect: per-subject pending count after restart; a server discard command if chosen.
- Next bounded action: gp-qa re-verifies FAIL-2/FAIL-3; the owner rules the decisions above and authorizes the database suites.

### Closure (2026-09-23, after merge)

- **Delivered:** PR #115 merged (`8f63739`); production `goproceed-app` serves it (row 12); staging database at `0095` (row 8). The owner deleted `goproceed-field`, removed `FIELD_CLIENT_ORIGINS` and set the purge secrets.
- **Verified:** reviews by gp-reviewer, gp-security and gp-ui-reviewer, and gp-qa PASS on the final code and documentation (rows 3–11); mobile unit tests (186), types, validators, the C vault container test, iOS device and simulator builds, a Release simulator launch, and the unauthenticated production probes.
- **State: blocked**, not done. Still NOT RUN: the database suites (`apps/app` integration and `packages/testing`, including the INV-108 probes — need the owner's consent to reset the local database); an authenticated end-to-end pass on a device (owner OTP); the Android native vault build (CMake/JNI/libsodium); the physical device matrix; signing and TestFlight/Play Internal. CI does not run until the Actions billing block lifts.
- **Owner decisions owed:** offline sign-out; vault-error sign-out; warned retention (seven-day expiry not wired); keychain after app deletion; R8 offline label; refused-discard behaviour; the stuck-item rule; discard timeout; accepting the stale `authenticate` and minisign-digest risks. gp-architect: per-subject pending count after restart; a server discard command if chosen.
- **Next:** reference illustrations may now be provisioned on staging (the deployed build pins them) once licensed content and the owner's authorization exist.
