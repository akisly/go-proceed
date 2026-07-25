# 25. Security Architecture and Threat Model

## 1. Security objectives

1. Prevent cross-tenant/project/location disclosure or mutation.
2. Prevent loss/duplication/corruption of evidence, quantity and money records.
3. Preserve provenance without claiming real-world truth.
4. Limit customer/support/integration access by least privilege.
5. Detect and recover from account, provider, deployment and operational compromise.

## 2. Trust boundaries

Untrusted: public browser, external-review browser, mobile device, uploaded file, email/SMS channel, integration endpoint, client timestamps/metadata.

Controlled boundaries:

- CDN/WAF/public web;
- BFF/API authorization boundary;
- Supabase Auth/Postgres/RLS;
- private object storage;
- worker/queue;
- observability/security account;
- vendor/operator administrative plane.

Client may access only the explicitly exposed low-risk `api.project_list` projection with complete RLS. `public` is not exposed through the Data API. All mutations, signed URLs, money transitions, package generation, external decisions and support operations go through BFF/command handlers. Service credentials never ship to web/mobile, and `service_role` is not a normal BFF/worker credential.

## 3. Principal threats and controls

| Threat | Control set | Verification |
|---|---|---|
| cross-tenant IDOR | explicit org context, composite tenant FKs, RLS, server resource lookup | negative matrix, fuzz IDs |
| privilege escalation | fixed roles/scopes, deny override, recent auth, SoD | permission contract tests |
| stolen token/share | short TTL, hash, MFA/OTP, revoke, rate limit, session binding | expiry/replay tests |
| malicious upload | private quarantine, MIME detect, size/type limit, AV, safe preview | EICAR/polyglot/corrupt fixtures |
| mobile loss | app sandbox, short credentials, revoke, local minimization | device-loss drill |
| duplicate/lost command | transactional outbox, idempotency, ledger reconciliation | chaos/replay tests |
| document tampering | immutable snapshot, hashes, signed manifest, restricted renderer | golden/hash tests |
| insider/support abuse | no default access, time-bound grant, dual break-glass, audit/alerts | quarterly review/drill |
| webhook/integration abuse | scoped secret, signature, egress allowlist where feasible, retry/replay controls | signature/SSRF tests |
| supply-chain/deployment | lockfiles, review, SBOM, scanning, signed CI artifacts, protected prod | CI/security gate |
| log/analytics leak | structured allowlist/redaction, no tokens/free text/media/URLs | automated log tests |
| backup compromise | encrypted provider backups, restricted restore, separate credentials, drills | restore evidence/access review |
| client version downgrade | `X-Min-Client-Version` handshake, 426 на рискованные команды, safe-mode лишь выгружает уже сохранённый outbox и не создаёт новых команд; отозванное устройство не получает свежий lease | downgrade/spoof-версии тесты; проверка, что safe-mode на revoked-membership не капчит |
| platform-billing audience confusion | `x-audience: platform_billing` + `aktflow_platform_billing`, отдельная identity/MFA; tenant-токен и `X-Organization-Id` не дают этой аудитории; invoice-организация выводится из immutable invoice-записи | попытка эскалации tenant→billing, подмена invoice-payment |
| offline lease forgery / use-after-invalidation | server-issued lease, привязанный к membership/assignment/policy/bundle версиям; часы устройства не доказательство; parent-mismatch → quarantine (CA-010); рестриктивные переходы инвалидируют lease в той же транзакции | lease-forgery, use-after-revoke, device-clock-tamper тесты |
| spreadsheet formula injection (импорт CSV/XLSX) | значения ячеек, начинающиеся с `=+-@`, экранируются/помечаются при импорте и НИКОГДА не выполняются; экспортные CSV также экранируют формулы | formula-injection фикстуры на import и export |
| export-link enumeration | download-grant — short-lived, single-purpose, привязан к актору и точному ресурсу; неугадываемый идентификатор; попытки перебора rate-limited и логируются | grant-enumeration и cross-actor доступ тесты |

## 4. Authentication/session controls

- MFA for every live Pilot user; recent-auth step-up for privileged/export/close/waiver/security commands; GA keeps this baseline and adds recovery/session evidence required by the ASVS L2 profile;
- password breach/strength provider controls;
- magic/invite/reset links one-time and short-lived;
- refresh rotation/session inventory/revoke;
- membership version checked after scope/revoke;
- step-up recent auth for sensitive operations;
- generic auth errors prevent account enumeration;
- brute-force/rate limit with user-safe recovery per `technical/rate-limits.csv` (per-endpoint/per-tenant/burst, OTP max-attempts+cooldown, public-intake caps).

Числовой session-контракт (граница конфигурации Supabase Auth; значения фиксируются как config, не как код):

| Параметр | Значение Pilot | Примечание |
|---|---|---|
| access token TTL | 30 минут | JWT; сервер всегда сверяет membership version поверх claims |
| refresh token TTL (absolute) | 14 дней | по истечении — повторный вход |
| refresh rotation | при каждом использовании | reuse ранее использованного refresh → инвалидация всей цепочки (reuse detection) |
| idle timeout | 72 часа без активности | далее refresh отклоняется |
| recent-auth window (step-up) | 10 минут | для ownership/billing/export-all/close/waiver/security-команд |
| max параллельных сессий на пользователя | 10 | превышение вытесняет старейшую; все видны в session inventory |
| device binding | нет (Pilot) | сессия не привязана к устройству; отзыв — через revoke/revoke-all; GA пересматривает |
| инвалидация при событии | смена пароля, MFA reset, membership revoke, recovery-code use | инвалидируют все активные сессии пользователя атомарно |

Точные соответствия в Supabase Auth: `JWT expiry`=1800s, `Refresh token rotation`=on + `Reuse interval`=0, `Refresh token expiry`=14d, `Max sessions`=10; всё остальное поверх — серверный слой AktFlow (membership-version check, session inventory).

## 5. Authorization controls

- deny by default at API and DB;
- complete RLS/grants for exposed tables;
- external share is exact-resource capability with separate read/download/decide;
- worker resolves tenant/resource from stored job, not payload-only client IDs;
- exports/reports preserve source scope;
- platform authorization lives in separate admin plane/account roles.

## 6. Data protection

- TLS in transit; provider encryption at rest;
- secrets in managed secret store, rotated and access-audited;
- private storage buckets and short signed grants;
- hashes for integrity, not proof of truth;
- sensitive fields classified and minimized;
- production data prohibited in local/dev;
- support screenshots/exports treated as customer content.

Field-level encryption is added only for identified threat/compliance need; application encryption must include key rotation/search/backup/recovery design, not checkbox cryptography.

## 7. Secure SDLC

- protected main, mandatory CI even solo;
- dependency lock and automated update review;
- secret, SAST, dependency and container scans;
- SBOM/release provenance;
- migration and RLS tests;
- threat-model update for new boundary/integration;
- security review for auth, billing, export, external share, file and support features;
- vulnerability disclosure/security contact;
- independent pre-GA application/infra review.

## 8. Logging and detection

Security events: privileged login/MFA/reset, membership/role/scope change, owner transfer, export, external-share abuse, support grant, integration secret, unusual bulk download, RLS-denied patterns, break-glass, retention/legal-hold change.

Audit is append-only for app roles, partitioned/retained, query access controlled. Alerts route by severity; product analytics is not security audit.

Неизменяемость аудита против привилегированного креда (не только app-роли): миграция делает `REVOKE UPDATE, DELETE ON audit_events, security_events FROM PUBLIC` и от всех runtime-ролей (`aktflow_app`, `aktflow_worker`, `aktflow_external`, `aktflow_support`); INSERT-only через security-definer функцию с fixed search_path. Дополнительно — tamper-evidence: каждая партиция несёт hash-chain (`prev_row_hash` в каждой строке, периодический анкор-хеш партиции), а критические security-события дублируются в append-only off-box sink (например, отдельный WORM-бакет), куда пишет и break-glass. `service_role`/DBA может физически изменить строку, но разрывает hash-chain и расходится с off-box анкором — это детектируется сверкой и алертит. Задача реализации — P0-A07 (DoD включает revoke-грант, INSERT-only функцию, hash-chain и off-box sink).

Форензик-корреляция: `audit_events`/`security_events` намеренно не хранят IP/device (PII-минимизация, doc 09 §6). Для инцидент-таймлайна IP/session/device-форензика живёт в edge/WAF-логах с join-ключом `request_id` (общим с audit) и собственным retention; экран внешнего ревьюера, обещающий «device/session records» (doc 04 §7), показывает данные `external_sessions` + этот edge-join, а не tenant-audit. Таким образом SEV1-расследование (§9) восстанавливает цепочку по `request_id`, не расширяя PII в самом ledger.

## 9. Security incident severities

- SEV1: confirmed/suspected cross-tenant disclosure, destructive compromise, widespread auth failure.
- SEV2: single-tenant sensitive exposure, evidence integrity risk, material provider compromise.
- SEV3: limited vulnerability/abuse without confirmed sensitive impact.
- SEV4: low-risk issue/operational defect.

SEV1/2 stop non-essential deploys, preserve evidence and invoke customer/legal notification assessment.

## 10. Pre-GA gate

- threat model reviewed against deployed architecture;
- no critical/high unresolved tenant/auth/data-loss finding;
- RLS/storage/API negative tests complete;
- restore and lost-device/support-abuse drills complete;
- SBOM and dependency policy active;
- incident contacts and secure backup credentials tested;
- security claims match actual provider configuration.
