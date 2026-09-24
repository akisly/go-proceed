# ADR-013 — Native field client for the pilot

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-09-22

**Related decisions:** [ADR-007](ADR-007-pilot-field-client.md), [ADR-009](ADR-009-three-pilot-surfaces.md)

Approved by the owner on 2026-09-22 in the task's explicit implementation request for the complete native-mobile plan.

## Decision

The field client becomes native Expo iOS/Android in apps/mobile, supporting phones and tablets. This supersedes ADR-007's PWA client/distribution decisions and ADR-009's Expo-web deployment and delayed-retirement gate. Other evidence, regulatory, tenancy and acceptance boundaries stand.

The owner explicitly chose immediate source retirement of both web field clients, before native hardware parity. Keep office dashboard, shared auth, BFF and external browser flows; old field links become an app handoff page. There is no capture fallback during implementation. No hosted deployment is authorized by this ADR alone.

*[2026-09-23, DEV-042 — the «app handoff page» was superseded by the owner's decision of 2026-09-23 to delete the Vercel project `goproceed-field` outright: old field links now reach no deployment and there is no handoff page. The owner deleted the project and removed `FIELD_CLIENT_ORIGINS` from `goproceed-app` ([DEV-042](../tasks/DEV-042-mobile-native.md) rows 7–8).]*

Email OTP, current bearer API, camera primary and labeled gallery fallback. The code path records native_camera or photo_picker; no claim of sensor authenticity or trusted device time. Durable encrypted pending captures move into this beta from v0.3. Full offline tasks, background synchronization, push, OTA and public store launch remain later work.

The vault uses native streaming libsodium secretstream with device-bound key protection and a transactional journal. A photo is locally saved only after vault commit; the UI distinguishes the pre-commit saving interval. Quarantine lasts seven days after a displayed warning and remains identity-isolated. The exact design and failure cases are in the [approved spec](../specs/2026-09-22-mobile-native.md).

*[2026-09-23, DEV-042 — not wired yet: quarantine is identity-isolated as decided, but the displayed warning and the seven-day expiry (`warnQuarantine`/`purgeExpired`) are dormant, so quarantined ciphertext stays until the same subject returns. Owner acceptance for the internal beta is owed ([DEV-042](../tasks/DEV-042-mobile-native.md) «Findings and rework»).]*

GoProceed-owned reference illustrations are immutable, workspace-scoped and pinned by requirement rule/occurrence. They are product content, not normative authority. Existing versions remain unchanged.

## Consequences and release gate

Topology: landing and office/BFF web deployments plus native binaries. Display name GoProceed; com.lightholdlabs.goproceed for iOS/Android. Internal beta targets TestFlight and Google Play Internal Testing. Physical phone/tablet testing, memory/backup evidence, signing and store installation are required; source compilation cannot close them. Missing evidence is NOT RUN in [DEV-042](../tasks/DEV-042-mobile-native.md).

## Amendment, 2026-09-24 — sign-out, wipe, discard hold and retention for the internal beta

The owner decided these on 2026-09-24 (task [DEV-061](../tasks/DEV-061-field-client-decisions.md)). gp-architect and gp-mobile shaped the design. The approved spec's vault paragraph is corrected on the same date.

1. **Retention.** In the v0.1 internal beta, quarantine has no seven-day expiry and no warning ladder. Quarantined originals stay, encrypted and identity-isolated, until the same subject and workspace return. This replaces «Quarantine lasts seven days after a displayed warning» until a public store launch. The warned seven-day expiry returns before that launch.
2. **Offline sign-out.** Sign-out works without a network. Success means that no session is readable through the storage adapter. Every removal passes the identity boundary, which quarantines before the session goes. With no network, the refresh token is deleted from the phone but not revoked on the server, and the owner accepts that. Signing out online still revokes the session when the request completes; after a bounded wait the phone removes its copy regardless.
3. **A vault that cannot open.** When initialize fails, no identity is open in the vault (and the app closes the native identity again), so signing out, and signing in, leave its items where they are. A confirmed «стерти» deletes every identity's unsent items on the phone, keys first, without opening the journal. The journal cannot be read, so the deletion cannot be scoped to one identity, and the confirmation says so. This is the one exception to «another identity cannot delete the item» (INV-053).
4. **A refused discard is held.** When the server may still receive a photo (it has a non-terminal upload intent), the photo is held rather than kept for sending. No upload, new intent or finalize request is sent for it after the hold is recorded (INV-116); a finalize already in flight may still commit, and the user is then told. It is removed once the server reports the intent expired, scan_blocked or orphaned_for_purge. The server expires an unfinalized intent after 24 h through the purge cron. If an earlier finalize lands, the photo is confirmed and the user is told. The user cannot cancel a hold.
5. **Reinstall.** On iOS the auth session can survive app deletion in the keychain. So an installation marker outside backup is checked before any auth storage read. A new installation (no marker and no vault) never resumes an earlier installation's session. An update keeps the vault directory and is not reset (INV-117).
6. **Accepted for the beta.** A stale-`authenticate` race that heals at the next sign-in. The owner also accepted libsodium verified by its pinned sha256 digest alone; that acceptance was overtaken the same day, when [DEV-056](../tasks/DEV-056-sodium-minisign.md) added the minisign signature check.
