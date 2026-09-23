# Native field client

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-09-22

**Related decisions:** [ADR-013](../decisions/ADR-013-native-field-client.md)

Approved by the owner on 2026-09-22 in the task's “PLEASE IMPLEMENT THIS PLAN” message. Execution record: [DEV-041](../tasks/DEV-041-mobile-native.md).

## Product and presentation

Foreman / performer / evidence recorder: assignment → exact requirement and reference illustration → photograph → durable local save → server receipt. Public copy is Ukrainian. Email OTP; native Stack on narrow windows and list/detail at tablet width; camera full-screen; profile and pending queue accessible from headers. One primary action per screen.

Use GoProceed Autumn role tokens. Commissioner renders Ukrainian UI; Hanken Grotesk renders the Latin brand. Content remains opaque. MobileGlassSurface applies glass only to chrome, sheets and compact controls: iOS 26 native GlassEffect with availability and Reduce Transparency checks; older iOS BlurView; Android SDK31+ BlurTargetView; older Android and camera overlay use solid tonal fallback. Respect font scaling, VoiceOver/TalkBack, Reduce Motion, safe areas and rotation. Native components live in apps/mobile/src/ui; they do not import DOM components or CSS font stacks.

## Native baseline

Expo SDK57 compatible patches, iOS16.4+, Android API29+, phones and tablets. Display name GoProceed; both identifiers com.lightholdlabs.goproceed; scheme goproceed. Protected deep links resolve only after current server authorization. External capability links remain browser routes. No full offline assignments, new offline capture, background upload, push, OTA or public store release.

## Reference illustrations

Versioned GoProceed-owned source manifest, provisioned per workspace into private immutable storage. Append-only image-version rows bind workspace and library item; published rule and materialized occurrence pin the exact image version. Old rows remain null. New common-library publications require an image; project-sourced rules can remain null. Add referenceImages=v1 opt-in to occurrence response; legacy shape remains byte-shape compatible. Deliver via authorized occurrence-scoped BFF proxy, never a permanent storage URL. Images are product illustrations, never a normative source or evidence. No illustration is claimed licensed without its manifest provenance.

## Vault and recovery

Local Expo module using pinned libsodium 1.0.22 secretstream XChaCha20-Poly1305, per-file keys wrapped with Keychain/Keystore. Streaming native hash/encryption/upload; no photo bytes in JS. SQLite journal, backup-excluded durable directory, atomic part/rename/journal recovery. At most one import/upload at a time, effective maximum min(server media limit,20 MiB), no silent recompression.

CameraView caches a temporary plaintext artifact. Import immediately, remove after ciphertext commit; sweep abandoned import files on launch. Before commit show saving, never saved. The durability guarantee begins at committed local save, not at shutter tap; failure before commit requires retake. Do not claim secure erase on flash.

Persist local capture identity, immutable request and idempotency keys. Never persist signed URLs or bearer tokens in queue records. Reconcile GET upload intent before retry; refresh grant through replay; whole-file upload; finalize then GET to validate available receipt identity/hash/size before cleanup. No success claim based on PUT alone.

Logout/account switch/revocation aborts sending and quarantines before session removal. Another identity cannot enumerate, decrypt, preview, send or delete the item. Same subject/workspace reauthorization restores it. Warned deletion is explicit; seven-day expiry begins after displayed warning. No background expiry claim when the app is not running.

## Verification

Unit/contract tests: legacy/opt-in API, immutable pinning, unauthorized cross-workspace access, media limits/provenance, permission cancellation, duplicate attempt guard, restart at every commit/upload boundary, corruption/truncation, receipt mismatch, identity switching, warned retention, deep-link allowlist and glass fallback.

Native builds and device matrix: iPhone, lower-resource Android phone, iPad, Android tablet; portrait/landscape/narrow multitasking; font scaling, screen reader, reduced transparency/motion; 20 MiB bounded-memory import/upload; backup/restore exclusion; kill/restart; install/upgrade through TestFlight and Play Internal. Simulator passes do not substitute for physical criteria. gp-reviewer, gp-security, gp-ui-reviewer and gp-qa operate on final diffs and actual evidence. Database suites that reset/truncate need an authorized disposable database.
