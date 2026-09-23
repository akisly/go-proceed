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
