# 27. QA, Traceability and Acceptance System

## 1. Quality principle

AktFlow release quality is proven by linked evidence, not page count. Master relation:

`REQ → FLOW → SCREEN/STATE → TRANSITION → PERMISSION → API → DB/RLS → EVENT → TEST → RELEASE EVIDENCE`.

Machine-readable files:

- `technical/traceability.csv`;
- `technical/state-transitions.csv`;
- `technical/error-catalog.csv`;
- `technical/permissions.csv`;
- `technical/entitlements.csv`;
- `technical/events.csv`;
- `technical/state-catalog.csv`, `technical/terminology.csv` and `technical/data-access-surface.csv`;
- `technical/data-retention-catalog.csv` — complete SQL-table lifecycle classification and V-003 linkage;
- `technical/test-catalog.csv` — 149 named test contracts at this revision;
- `technical/ui-actions.csv` — exhaustive primary/mutation action closure;
- `technical/entity-aliases.csv` — explicit conceptual-name aliases/deferred boundaries;
- `technical/asvs-profile.csv` and `technical/mobile-security-profile.csv`.
- `technical/openapi-redocly-report.txt` — attached independent OpenAPI lint evidence; runtime conformance remains a separate test.

Every `test_id` referenced by traceability, backlog, gate or prose must exist in `test-catalog.csv`. A title alone is not a test: catalogue rows require preconditions, procedure, deterministic expected result, evidence type, automation mode, blocker class and owner. CI rejects missing/orphan IDs and malformed CSV rows.

Часть контрактов — cross-cutting / gate / structural / adapter (напр. `T-STATE-REACHABILITY-001`, `T-PILOT-ADMISSION-001`, `T-ADAPTER-001/002`, `T-BUSINESS-CALENDAR-001`, `T-PAYMENT-FINGERPRINT-001`): они не привязаны к отдельному requirement по построению, а трассируются через задачу в `implementation-backlog.csv` (ось task→test). Ни один тест не висит вне обеих осей (requirement и backlog); отсутствие в requirement-матрице для этих ~16 контрактов — норма, а не пробел покрытия.

`scripts/validate_package.py` additionally fails on unresolved OpenAPI refs/path parameters/flows, non-Problem error responses, SQL/state enum drift, unmapped Data API tables, public exposure, transition errors, trace references, unknown external gates, backlog dependency/release cycles, missing prototype loops, failed/missing `prototype/qa-results.json` evidence and stale human-readable API counts. Semantic checks require every mutating OpenAPI operation to map exactly once to screen/surface, release, permission, transition domain, release-compatible tests and events; reject API/data/state release drift, unresolved entity alias/column targets, project-bound tables without composite organization/project integrity and tenant roles with identical permission vectors. Its pass proves consistency of the specification—not runtime security or external validation.

## 2. Test layers

- pure domain tests: readiness, quantity, money, dates, entitlement;
- database tests: constraints, migrations, RLS/grants, concurrency;
- API contract tests: OpenAPI, auth, errors, idempotency, ETags;
- worker tests: retries, deduplication, dead letter, renderer determinism;
- mobile sync tests: process/network/device failure matrix;
- component/accessibility tests;
- E2E critical journeys;
- security abuse tests;
- restore/migration/rollback drills;
- pilot UAT with representative artifacts.

Coverage norm: каждый переход покрыт хотя бы одним из валидных классов — (a) поимённый pos/neg/authz тест, (b) доменный E2E-lifecycle тест (`T-COMMERCIAL-LIFECYCLE-001`, `T-VARIATION-LIFECYCLE-001`, `T-BILLING-STATE-001` и т.п.), либо (c) структурный `T-STATE-001`/reachability + concurrency/retry классовые матрицы (`T-CONCURRENCY-001`, idempotency-семейство). E2E-lifecycle и структурный класс — полноправные способы покрытия edge-команд (receivable dispute/write_off, package withdraw/supersede), а не пробел; per-transition именованные дубли не требуются. Каждый Pilot-переход имеет хотя бы один класс; GA edge-команды могут докрываться точечными negative-тестами при активации соответствующего GA-гейта.

## 3. P0 acceptance examples

Ниже — только быстрые human-readable примеры. Полный нормативный набор находится в `technical/test-catalog.csv`; эти абзацы не заменяют его.

### T-TENANT-001 Cross-tenant read

Given active member of organization A and valid resource ID from B, when any client/API/storage/report/export path is used, then no B existence or data is disclosed, response is safe, denial is logged without resource content.

### T-CAPTURE-001 Offline exactly-once

Given offline worker with two photos and 48 m, when submit is tapped repeatedly, app killed, network returns and upload retries, then one capture manifest and one 48 m quantity command exist; local and server receipts share operation ID.

### T-READY-001 Explainable total

Given fixed contract/rules/ledger/evidence fixture, when engine evaluates, then state/reasons/value exactly match golden snapshot and can be recomputed by engine version.

### T-PACK-001 Deterministic package

Given identical snapshot/template/renderer version, when generation retries, then manifest logical content and normalized document hashes match; user can see retry/version behavior.

### T-PAY-001 Allocation invariant

Given partial payment, duplicate import and concurrent allocation, then committed allocation never exceeds payment/receivable and duplicate source returns original result/warning.

### T-SUSPEND-001 Safe suspension

Given expired grace, when tenant signs in, existing data/read/export/pay/support work and new restricted consumption returns entitlement error; no data is deleted.

## 4. RLS/permission matrix

For every resource/action test:

- correct role/scope;
- lower/wrong role;
- wrong project;
- wrong location;
- another tenant;
- revoked/suspended membership;
- stale JWT/membership version;
- archived/closed resource;
- external token wrong/expired/revoked/exact-version;
- platform user without/with expired support grant.

Positive-only permission tests are insufficient.

## 5. Data and calculation fixtures

Golden fixtures include:

- decimals comma/dot, zero/negative correction, rounding boundaries;
- unit precision/conversion;
- VAT inclusive/exclusive/none;
- retention/deduction/partial acceptance/payment;
- contract re-import with submitted lines;
- waiver expiry;
- package version differences;
- timezone/DST/month-end;
- Cyrillic/Latin lookalikes and long names;
- corrupted/duplicate/large files.

No production personal/customer content in automated fixtures.

## 6. Performance budgets

Test at Pilot and GA reference datasets:

- 100 organizations, 2,000 users, 1,000,000 evidence metadata rows design target;
- project: 10k work items, 50k evidence, 24 periods;
- work list p95 API target <800 ms after cache/DB warm definition;
- initial office meaningful render target <2.5 s on agreed network/device;
- field task local open <1 s from synced cache;
- package queue protects interactive API under load;
- export/report bounded and async.

Targets are validated and revised with measured traces/EXPLAIN; no synthetic benchmark becomes SLA automatically.

## 7. Accessibility/localization

- WCAG 2.2 AA target for web/reviewer;
- keyboard and visible focus for office/reviewer;
- semantic labels/error association/live regions;
- contrast and status not color-only;
- 200% zoom and 320 px width without critical loss;
- reduce motion;
- screen-reader review of auth, capture, review and package decision;
- Ukrainian complete in `technical/copy-catalog.csv` (canonical UI-string source: status labels derived from state-catalog, per-screen states, key actions); Russian/English/country locales only when the copy catalogue is translated/reviewed;
- pseudo-localization catches expansion and hardcoded strings;
- dates/money/units carry locale and source timezone/currency.

## 8. Browser/device matrix

Web: current and previous major Chrome/Edge, current Safari, current Firefox; mobile web external review on iOS Safari/Android Chrome. Native field: supported Expo/OS matrix defined at implementation and tested on at least one low/mid Android physical device plus supported iPhone. Camera/offline cannot be signed off using emulator only.

## 9. Release gates

Block release on:

- critical/high tenant/auth/data-loss/integrity/security issue;
- duplicate/corrupt money/quantity/package;
- broken backup/rollback for risky release;
- critical flow lacking audit/observability/recovery;
- inaccessible primary action;
- unknown migration backfill result;
- legal/claim gate missing for enabled customer-specific/signature feature.

Medium defect needs owner, workaround, impact, target and acceptance by release owner. Flaky critical test is failure, not pass.

## 10. Evidence bundle per release

- commit/build/SBOM identifiers;
- migration and rollback/compatibility result;
- automated test summary;
- RLS/security scan result;
- screenshots/interaction proof for changed flow;
- performance/invariant metrics;
- restore freshness;
- known issues;
- feature flags/tenants;
- release/rollback decision and owner.

## 11. v2.9 mandatory regression families

The release suite must include the exact contracts in `technical/test-catalog.csv` for:

- primary-screen read closure and scope-before-pagination;
- all four occurrence strategies, canonical rule preview/publish payload and per-row atomic assignment materialization;
- server-available-before-invalidation versus first-seen-after-invalidation capture, every parent invalidation and composite lease identity;
- 0, 500, 501 and 1,000+ offboarding dependencies, stale plan, every responsibility type and project-only scope removal;
- measured-only BOQ policy plus re-import lineage availability/double-reservation prevention;
- evidence association correction, waiver revoke, review correction receipt plus later decision successor, and authoritative reporting-date confirm/reject;
- package financial outcomes plus multiple issues, incomplete/no-effect reconciliation and period close/reopen cycles;
- acceptance successor with draft/issued/part-paid/paid downstream states, payment fingerprint races, numbering lifecycle and export cancellation fencing;
- state reachability, reversal-command existence, command matrix default deny and critical OpenAPI↔SQL parity.

The package validator proves that these contracts are present and cross-linked. It does not count them as executed runtime evidence. Each implementation task remains `not_started` until its own automated/manual evidence is attached.
