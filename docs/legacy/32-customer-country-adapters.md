# 32. Customer and Country Adapter Framework

## 1. Objective

Support real contract/document differences without forks or arbitrary code in templates.

## 2. Adapter package

Versioned package contains:

- metadata: country/customer/project applicability, owner, status;
- source schema/import mappings;
- work/rule applicability mappings;
- document template definitions and locale strings;
- calculation/rounding declarations referencing approved core functions;
- validation rules with hard/warning severity;
- submission channel metadata and assurance labels;
- retention/capture/privacy policies;
- golden input/output fixtures and expected hashes/semantic values;
- migration notes and compatibility range.

No executable tenant-supplied code in Pilot/GA initial design. Templates use allowlisted DSL/components/functions.

## 3. Lifecycle

`draft → validating → approved → published → deprecated → retired`.

This lifecycle is the single normative adapter lifecycle for the whole package; the release gate for reaching `published` is defined in `docs/34-production-gate-checklist.md` §6. The adapter registry is platform-level configuration, not a tenant domain: each adapter version is an immutable versioned artifact referenced from tenant data by `adapter_key`/`adapter_version`, which is why it intentionally does not appear in `technical/state-catalog.csv`.

Published version immutable. Project pins adapter version. Upgrade shows document/rule/calculation impact and requires authorized confirmation. Submitted packages remain bound to original version.

## 4. Customer adapter gate

- at least one accepted and one problematic artifact where available;
- mandatory fields/calculations signed by customer process owner;
- privacy/security restrictions recorded;
- golden fixtures pass;
- rendered visual review and totals reconciliation;
- legal wording/assurance claim reviewed where relevant;
- fallback generic export remains available.

## 5. Country pack

Adds language, formats, currency/unit rules, privacy/employee notice, e-signature providers/assurance, construction/accounting document catalogue, retention and data residency/transfer assessment. Country pack cannot weaken core tenant/security controls.

## 6. Change monitoring

Owner monitors official schema/regulation/provider changes, records source/date/impact, creates new version and regression fixtures. Auto-update never silently changes active project or historical package.

## 7. Failure behavior

If adapter fails or is outdated:

- core ledger/evidence remains available;
- package job fails with adapter/version/error code;
- no partial artifact is marked ready;
- user can generate generic evidence export;
- alert/support receives redacted failure metadata;
- fixed adapter produces new package version.

