# 13. QA strategy and acceptance catalog

## 1. Risk-based test pyramid

- Unit/property tests: money/quantity, readiness evaluation, state machine, permissions, document adapters.
- Integration: Postgres/RLS, storage quarantine, worker retries, imports, idempotency, webhooks.
- Contract: OpenAPI, event schemas, template fixtures, external providers.
- E2E: critical office/field/external/billing paths.
- Exploratory: real messy files, poor network, bright/mobile field usage, Ukrainian content.
- Security/performance/accessibility: automated baseline plus manual gates.

## 2. Critical E2E journeys

1. **Pilot:** owner creates org, project, imports estimate, publishes rules, invites scoped users.
2. **Pilot:** foreman downloads assignments, goes offline, captures two evidence items/quantity, restarts app, syncs exactly once.
3. **Pilot:** PTO returns one requirement; foreman corrects; PTO approves; ready amount recalculates exactly.
4. **GA:** PTO records variation without overwriting contract line.
5. **Pilot/GA:** billing closes period and generates deterministic version; GA compare produces exact v2 diff.
6. **GA:** external reviewer link expires/revokes; valid reviewer returns/approves and receives receipt.
7. **GA:** accepted amount creates receivable; partial payments and retention reconcile.
8. **Pilot+GA:** cross-tenant IDs, URLs, search and exports reveal nothing.
9. **Pilot+GA:** suspension/downgrade preserves existing data and allowed read/export access.
10. **Pilot+GA:** full tenant export contains manifest, binaries and relationships.
11. **Pilot:** platform issues an immutable payment request, records one bank settlement idempotently and restores entitlement without consulting project money.
12. **Pilot:** user lists/marks own notifications read and updates versioned preferences while unavailable channels stay disabled.

## 3. Readiness engine acceptance

Golden fixtures cover required photo counts/moments, location, quantity bounds, document, reviewer, waiver/override, rule migration, contract version, partial quantities and before-concealment. For every total, test invariant `performed = ready + risk/other classified states` within defined scope and currency. Rebuild projection from ledger and compare.

## 4. Import QA

Fixtures: Ukrainian/English headers, commas/dots/spaces, formula cells, merged headers, duplicate codes, blank rows, negative/zero qty, multiple sheets, Cyrillic encoding, huge file, malicious macro/zip bomb, changed version. Dry run must not mutate. Re-upload with same idempotency key cannot duplicate.

## 5. Offline/mobile matrix

Test airplane mode before/inside/after capture; process kill; device reboot; low storage; permissions denied/revoked; slow/flapping network; token expiry; rule/assignment changed; duplicate tap; large photo; clock/timezone drift; two devices same item. The user always knows local-saved versus server-confirmed.

## 6. Permission and tenant matrix

For each endpoint/table action test unauthenticated, wrong org, correct org wrong role, correct role wrong project/location, archived, entitled/not entitled and elevated happy path. Database policy tests bypass UI. External tokens are tested for guessing, replay, expiry, revocation and object substitution.

## 7. Document QA

Golden rendered fixtures compare structure/text/data; PDF opens in common viewers; fonts embedded; Ukrainian glyphs; page breaks; large evidence appendix; long names; hashes/manifest; template version; deterministic retry. Machine-readable export schema validates. Visual click-signature is never labeled КЕП.

## 8. Performance budgets

- 10k work items/project and 100k/org test dataset;
- filtered work first page p95 <700 ms staging target;
- dashboard projection <2 s cached / <5 s rebuild target;
- mobile list 1k scoped assignments without blocked interaction;
- 20 MB resumable upload with retry;
- 500-page package job remains bounded and cancelable.

Load tests prioritize realistic concurrent close-day usage and worker queue, not vanity request rate.

## 9. Accessibility QA

Automated axe-like scan plus keyboard/manual screen-reader sampling on landing, auth, onboarding, dashboard, table/detail, package and billing. Mobile tests include dynamic text and screen-reader labels. Status contrast/color-independent; error focus and summary; dialog trapping/return focus.

## 10. Release gates

No release with critical/high tenant isolation, authz, data loss, duplicate money/quantity or corrupt package defect. Medium defects require owner/workaround/target. Critical E2E, migration smoke, RLS, backup state, error budget and rollback checked before production.

## 11. Pilot UAT script

Use a redacted real project. Participants independently import, assign, capture offline, return/correct, close a sample period and reconcile totals with existing process. Record task completion, help needed, time, errors, trust rating and missing blocking field. A demo performed by founder is not UAT.

## 12. Prototype validation included in this package

The packaged prototype is a visual/interaction proof, not production security architecture. Validate route rendering, desktop/mobile breakpoints, primary navigation, onboarding mapping controls, dashboard filtering, work-item selection, billing selection and field offline path. Findings live in `16-fidelity-ledger.md`.
