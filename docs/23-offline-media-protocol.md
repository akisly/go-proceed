# 23. Offline, Sync and Media Protocol

## 1. Objective

Field worker must be able to finish a 1–2 minute capture with intermittent connectivity without losing, duplicating or falsely reporting evidence/quantity.

## 2. Local stores

- SQLite: assignments subset, rule snapshot, capture metadata, outbox commands, upload state, receipts.
- App-private file storage: original media pending upload and derivatives.
- OS secure storage: refresh credential/device key references only.
- No auth token or secrets in SQLite logs/analytics.
- Local schema versioned with migrations; failed migration enters safe recovery/export-support mode.

Encryption decision: rely on OS app sandbox/file encryption for Pilot only after documented device risk acceptance. GA security gate evaluates encrypted SQLite/file vault based on customer data sensitivity. App lock/biometric is optional policy, not substitute for server authorization.

## 3. Outbox transaction

One local transaction writes:

1. capture/session draft version;
2. quantity command(s);
3. evidence manifest with local file hashes;
4. outbox command with `clientOperationId`;
5. durable local receipt.

Only then UI shows `Збережено на пристрої`. `Підтверджено сервером` (canonical `mobile_capture.server_confirmed` label) appears after server receipt.

## 4. Sync phases

1. refresh auth and membership version when network exists;
2. while online, accept and start the exact assignment; only then idempotently issue its execution bundle and persist a bounded server authorization lease binding organization/subscription/project/contract versions, membership/version, assignment/version, authorized user, policy version, bundle/context hashes, server issue time and expiry;
3. allocate one stable `clientOperationId` for the capture; no server capture-session ID is required before media upload;
4. request a short-lived multipart grant only after the server persists an `intent_authorized` upload intent with exact organization/project/purpose and, for evidence, the work item + assignment + location + authorization lease ID/hash + capture-client-operation subject, object key, declared type, byte size, SHA-256, expiry and a server-selected retention class; occurrence is deliberately not part of the upload intent because one verified object may support several occurrences;
5. upload parts with checksum/retry;
6. complete upload; the server atomically compares every immutable intent field including the lease, transitions `intent_authorized → available` (there is no `sealed` state: `public.upload_intents.status` permits eight values — `intent_authorized`, `staged`, `integrity_verified`, `scan_pending`, `available`, `scan_blocked`, `orphaned_for_purge`, `expired` — per the CHECK constraint in `supabase/migrations/0015_execution_evidence_module.sql`, and no later migration alters it; `sealed` and `authorized` come from the superseded `technical/schema.sql` and were never permitted values), creates one verification job/receipt and then waits for detected MIME/scan;
7. submit manifest + exact authorization lease + explicit `evidenceLinks` + Pilot quantity commands (`progress`, `correction`, `reversal`) atomically using the same client operation; the server idempotently creates the capture session, materializes only verified upload intents whose lease/assignment subject and actor equal the capture subject and validates every linked occurrence in that same assignment;
8. receive server receipt and projection status;
9. compact local media only after retention/cache rule permits.

## 5. Retry

- exponential backoff with jitter and connectivity/app lifecycle hints;
- user retry resets only safe transient state;
- 401 pauses and refreshes; revoked membership becomes terminal with support/export-of-own-draft path;
- 409 produces explicit conflict object;
- 413 offers compression/document split only if original policy allows; original is retained;
- 422 names field/rule correction;
- malware reject is terminal and explains safe recapture;
- retry does not create new quantity entry.

## 6. Conflict types

| Conflict | Default |
|---|---|
| assignment/parent authorization changed before first server receipt | never infer pre-change capture time; quarantine for independent Security Admin recovery or reject according to the frozen policy |
| contract/rule version changed | evaluate against captured snapshot and current rule; show delta |
| work item lineage superseded/cancelled | hold; never relink server history; invalidate and recapture/migrate through an audited plan |
| duplicate quantity operation | replay server receipt |
| same draft edited on two devices | keep both local revisions; association may change only before either draft is submitted |
| membership revoked | normal upload is denied; a first-seen draft may enter quarantine only through the explicit recovery policy; preserve local draft for the defined recovery window |
| server already decided | create correction/revision, never overwrite decision |
| subject tuple mismatch | reject the link/upload as terminal data-integrity error; never infer location/occurrence |
| evidence later invalidated | keep local/server receipt and original hash; create dependency refresh/correction, never delete or retarget |

Non-restrictive parent changes: инвалидация lease по parent mismatch относится только к рестриктивным переходам родителей (suspend/cancel/close/membership или assignment revoke/entitlement-сужение). Нерестриктивный bump версии подписки (upgrade/plan change без сужения entitlements) не является mismatch: capture с прежним lease принимается, а lease переиздаётся при ближайшем sync. Классификация перехода фиксируется в side effects родительской машины (см. CA-009/CA-010 notes).

## 7. Media integrity

- compute SHA-256 locally and verify server-side;
- neither multipart retry nor completion may change purpose, capture, object key, declared type, expected size, hash or retention class; an expired/cancelled/available intent cannot be reused;
- `import_files` and original `evidence_objects` inherit the server-selected retention class through the same-tenant upload-intent FK, so provenance and lifecycle policy do not end at a signed URL;
- server-created evidence derivatives do not reuse an upload intent: they require a same-tenant parent and use `evidence_derivative`; original and derivative lifecycle remain independently enumerable.
- retain original EXIF only where privacy policy permits; separately store normalized trusted/untrusted metadata;
- server detects MIME and dimensions; client declaration is not trusted;
- strip active content from previews; originals private/quarantined until scan;
- annotation/redaction creates derivative linked to original hash;
- package chooses original/derivative via explicit policy;
- download uses short-lived signed authorization and audit.

Duplicate policy: сервер детектирует точный дубль по SHA-256 в пределах subject/occurrence и помечает его warning-ом (не auto-reject — легитимные повторные ракурсы разрешены); дедуп команд — по `clientOperationId`. Perceptual near-duplicate (pHash) — GA-кандидат и до введения не влияет на readiness.

## 8. Camera/gallery/location policies

Each rule version defines:

- camera required/optional/gallery allowed;
- min/max photo count;
- video/audio/document allowed, with microphone permission and size/duration policy;
- location method: selected hierarchy, optional GPS, required GPS with safety fallback;
- timestamp/device metadata behavior;
- example guidance;
- quality warnings.

Until customer/legal validation: gallery allowed with visible source label; GPS optional and never blocks safety-critical work; faces/plates may be redacted via derivative; no biometric inference.

Location trust: mock-location флаг ОС и accuracy хуже конфигурируемого порога записываются в normalized untrusted metadata и порождают тот же anomaly-warning путь, что и конфликт EXIF/устройства; они не блокируют capture и не считаются доказательством/опровержением полномочий. Жёсткость политики для sensitive sites — предмет V-004.

## 9. Device lifecycle

- logout with unsynced drafts warns and requires keep/sync/discard authorization;
- remote revoke stops future sync but cannot erase offline device reliably; disclose limitation;
- suspension/reassignment/revoke invalidates server lease use immediately; local timestamps cannot extend it;
- project pause/complete/archive, contract complete/terminate and organization/subscription suspension/closure also invalidate affected leases transactionally;
- device lost flow revokes sessions and flags pending operation IDs;
- low storage warns before camera and offers safe cleanup of confirmed cached files;
- OS background limits mean app may require foreground resume; UI never promises guaranteed background upload;
- app update maintains outbox compatibility for at least one supported prior version.

Version handshake: приложение сравнивает свою версию с `X-Min-Client-Version` при каждом sync. Устаревший клиент переходит в safe mode: новые capture/команды остановлены с кодом `CLIENT_VERSION_UNSUPPORTED`, уже сохранённый outbox выгружается, read остаётся; принудительный upgrade не может уничтожить несинхронизированные доказательства.

## 10. Observability without sensitive payload

Metrics: outbox depth/age, upload retry count, receipt latency, conflict/error codes, app/version/device-class buckets. Never send photo, filename, exact GPS, work description, free-text comment or exact money to product analytics.

## 11. Test matrix

- airplane mode before/during/after each phase;
- app kill and device restart after every local/server boundary;
- duplicate taps and parallel sync;
- token expiry/revocation;
- multipart part corruption;
- low disk/camera denied/microphone denied/location denied;
- 1 MB/50 MB/large batch;
- clock ±24h and deliberate device-clock rollback/forward; authorization result must not change;
- claimed field date around timezone midnight/cutoff/closed period; only a separately confirmed authoritative reporting date may enter quantity/package calculations;
- lease issue replay, expiry, reassignment, suspension and revoke at every upload/capture boundary;
- contract/rule update while offline;
- Android/iOS supported versions and background constraints;
- server replay proves one quantity/evidence manifest.
- exact-subject negative fixtures reject cross-assignment/location/occurrence links even inside one project;
- invalidation replay is idempotent and submitted package snapshots remain reproducible.

## 12. Chronology and reporting-date boundary

The server distinguishes three facts:

1. the lease was valid when issued;
2. bytes or a capture manifest were durably received before invalidation;
3. the device claims a capture/reporting time.

Only item 2 is server-verifiable chronology. Item 1 does not prove when unseen work occurred; item 3 is untrusted input. A first receipt after invalidation therefore cannot satisfy a requirement, create authoritative quantity or advance readiness until the security exception is resolved.

`claimedReportingDate`/`claimedOccurredOn` remain immutable claims. The authoritative date is set by server rules or a separate authorized `confirm` decision, in the project timezone, against the versioned business calendar and an open period. `reject` leaves the authoritative date empty and requires a new corrected capture/revision; a unique confirmation record cannot later be rewritten. Both authorization-exception disposition and reporting-date decision persist the client operation, exact target version, reason, actor and SHA-256 receipt. Evidence-only captures legitimately return an empty affected-quantity list. Closed-period backdating is rejected; reopening is a separate guarded commercial workflow.

Security quarantine resolution is deliberately independent: it requires a minimized evidence summary and can only release to scan/review or reject. It neither certifies when the device created bytes nor sets the reporting date.

Evidence/work/occurrence association may be edited while the capture is only a local draft. Once the server receives it, the exact subject tuple is immutable. A mistake requires evidence invalidation plus a new audited capture/link; neither UI nor support may silently retarget the original.
