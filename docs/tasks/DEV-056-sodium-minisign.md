# DEV-056 — Every libsodium build verifies the author's minisign signature

## Assignment

- Objective and user-visible outcome: the pinned libsodium archive the field client's vault is built from must carry libsodium's own minisign signature, checked on every build that uses it, besides the sha256 digest it already had. This closes DEV-042's open «Independent minisign verification of the digest» (security m5). No user-visible change; the library's bytes are unchanged.
- State: reviewing
- Coordinator: Claude Code primary session, 2026-09-24.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): a build supply-chain change in `apps/mobile` → `gp-mobile` for requirements, then implementation, `gp-reviewer` + `gp-security`, `gp-qa`.
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: `gp-mobile` (apps/mobile build and signing chain); `gp-security` (the build supply chain; closes DEV-042's security m5). Not `gp-architect` (no schema or contract), not `gp-ui-reviewer` (no UI path), not `gp-researcher` (the two primary sources were read directly, see Sources).
- Owning module and allowed edit paths: `apps/mobile/modules/goproceed-vault/scripts/{minisign.mjs,minisign.test.mjs,prepare-sodium.mjs,sodium-pin.json,sodium-xcframework.mjs}`, `apps/mobile/modules/goproceed-vault/android/build.gradle`, `apps/mobile/vitest.config.ts`, `docs/tasks/DEV-042-mobile-native.md` (dated annotations), this record, `docs/tasks/README.md`.
- Read context and applicable local instructions: root `AGENTS.md`, `apps/mobile/AGENTS.md`, ADR-013, DEV-042 and DEV-046 records.
- Linked spec (`docs/specs/…`), ADR or earlier task: DEV-042 (findings rows «Stale/partial xcframework or tarball reused» and «Stale `authenticate` …; minisign digest verification»); DEV-046.
- Baseline: `origin/main` `e43c5ecf`.
- Dependencies / constraints / out of scope: no new dependency or binary (`node:crypto` only); the extracted source tree in `.build/` is reused without re-verification, as it already was for the digest.
- Required acceptance criteria: `gp-mobile` AC-1…AC-12 (row 1), each in «Acceptance evidence».
- Skipped stages and rationale: none.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | «Проверка при сборке»: verify the signature in `prepare-sodium.mjs` with `node:crypto`, the author's key pinned | Owner's choice in this session |

## Plan

1. `scripts/minisign.mjs`: a side-effect-free verifier (strict base64 and lengths, `ED` only, key id, global signature, exact `file:` token, BLAKE2b-512 + Ed25519) and the libsodium key as a constant apart from the pin. Check: `minisign.test.mjs` (synthetic key pair, the committed pin) — AC-1…AC-5.
2. `sodium-pin.json` gains the 1.0.22 `.minisig` verbatim; `prepare-sodium.mjs` verifies after the digest, before extraction; the xcframework stamp and the Gradle inputs cover `minisign.mjs`. Check: host, iOS and Android runs, tampered and restored — AC-6…AC-10.
3. Records: DEV-042 annotations; the pin-bump procedure in `prepare-sodium.mjs`'s header. Check: review — AC-12.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-mobile | Requirements R1–R10 and AC-1…AC-12; the key must live apart from the pin (a bump could otherwise swap key, digest and signature together); on iOS the check runs whenever the xcframework is (re)built, not on every Xcode build; Android runs it on every Gradle build; no device needed | Subagent report (session) | Implement |
| 2 | Coordinator | Prototype on the cached 1.0.22 archive: algorithm `ED`, key id equal to the published key's, file and global signatures valid, a one-bit tamper refused; the `.minisig` from the GitHub release and from download.libsodium.org are byte-identical (sha256 `c0186d6c…abbff0f3`), and the committed JSON string hashes the same | scratchpad `verify.mjs`; `shasum -a 256` | Implement |
| 3 | Coordinator | Implemented plan steps 1–3. Unit: 7 tests pass. Host: `node scripts/prepare-sodium.mjs host` exit 0; with one character of the global signature changed, exit 1 `Error: minisign: the trusted comment does not verify`, no new `.build/` entry; restored, exit 0. iOS: `sodium-xcframework.mjs` rebuilt once (stamp changed, 2.4 s, exit 0), a second run exited at once with the same stamp; tampered, exit 1 with the minisign error and the old stamp left in place; restored, exit 0 without work. Android (fresh `expo prebuild --platform android` in this worktree, `-PreactNativeArchitectures=armeabi-v7a,arm64-v8a`): `:goproceed-vault:prepareSodium` built both ABIs, BUILD SUCCESSFUL; tampered, `prepare-sodium failed for armeabi-v7a: … Error: minisign: the trusted comment does not verify`; restored, BUILD SUCCESSFUL in 2 s, the same two build directories | scratchpad `ac9.log`, `ac10.log` | gp-reviewer, gp-security |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## What is not true after this task

- On iOS the signature is checked when `pod install` (re)builds the xcframework, not on every Xcode build: `sodium-xcframework.mjs` exits early on a current stamp. The stamp now covers `minisign.mjs`, so a verifier change re-verifies.
- The extracted source tree under `.build/libsodium-<tag>` is reused without re-checking either the digest or the signature (unchanged threat model: a local attacker who can write `.build/` can also write the scripts).
- The trust root is one key read from doc.libsodium.org on 2026-09-24. If libsodium rotates its key, the next pin bump fails until the key constant is changed in its own reviewed diff — intended.
- No EAS build ran (no account); CI does not run until the Actions billing block ends.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 verifier imports without side effects | Yes | working tree | `minisign.test.mjs` imports it; `git status` shows no new tracked or untracked file from the run | PASS | |
| AC-2 committed pin: `ED`, key id, global signature, `file:` token | Yes | working tree | `minisign.test.mjs` «reads the committed signature» | PASS | |
| AC-3 file signature valid / data flip / signature flip | Yes | working tree | `minisign.test.mjs` | PASS | |
| AC-4 refusals: legacy `Ed`, key id, edited comment, flipped global signature, bad base64, 73/75 bytes, missing line, CRLF | Yes | working tree | `minisign.test.mjs` | PASS | |
| AC-5 a key changed only in the pin fails | Yes | working tree | the key is a constant in `minisign.mjs`, and the test pins its value and the pin's keys (`digest`, `minisig`, `version`) | PASS | |
| AC-6 committed `.minisig` equals the published file | Yes | working tree | row 2: GitHub and download.libsodium.org copies byte-identical, sha256 equal to the committed string's | PASS | |
| AC-7 tampered pin fails a real build, nothing left behind | Yes | working tree | row 3 (host) | PASS | |
| AC-8 the real archive passes | Yes | working tree | row 3 (host, iOS, Android) | PASS | |
| AC-9 iOS rebuilds once, then not; failure surfaces | Yes | working tree | row 3 (iOS) | PASS | the podspec `raise` itself not driven through `pod install` with a tampered pin; the script's non-zero exit is what it tests |
| AC-10 Android failure in `GradleException`, no recompile after restore | Yes | working tree | row 3 (Android) | PASS | |
| AC-11 the test runs in the package suite; typecheck | Yes | working tree | `pnpm --filter @goproceed/mobile test` 188 passed (22 files; `main` 186 in 20 files); `typecheck` exit 0 | PASS | shared with DEV-057's changes |
| AC-12 records and pin-bump procedure | Yes | working tree | DEV-042 rows annotated; `prepare-sodium.mjs` header and `build.gradle` comment | PASS | |

## Sources

- libsodium, «Installation — Integrity checking», https://doc.libsodium.org/installation (page updated about 2026-08-27, accessed 2026-09-24): the minisign key `RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3`; applies to libsodium 1.0.22 (pinned).
- minisign, «Signature format», https://jedisct1.github.io/minisign/ (accessed 2026-09-24): `ED` = Ed25519 over BLAKE2b-512 of the file; the global signature covers the signature and the trusted comment.
- The release asset `libsodium-1.0.22.tar.gz.minisig`, https://github.com/jedisct1/libsodium/releases/download/1.0.22-RELEASE/ and https://download.libsodium.org/libsodium/releases/ (fetched 2026-09-24; trusted comment `timestamp:1775774745`).
- Node.js 24.18.0 (installed): `crypto.verify(null, …)` for Ed25519 and `createHash('blake2b512')`, exercised by the tests.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: independent — `gp-mobile`; reviews pending.
- Verified scope: host, iOS xcframework and Android Gradle builds on this Mac; unit tests.
- Remaining risks / blocked requirements: CI NOT RUN (billing block); EAS NOT RUN.
- Next bounded action and owner: `gp-reviewer`, `gp-security`, `gp-qa`; then the owner merges.
- Final state and reason: reviewing.
