# GoProceed template contract

**Status:** Approved

**Applies to:** v0.2 — see "Neither family is a v0.1 family" below

**Last reviewed:** 2026-08-06

**Related decisions:** [ADR-003](../../docs/decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-005](../../docs/decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../../docs/decisions/ADR-006-pilot-shaped-v0.1.md)

## Neither family is a v0.1 family

Corrected 2026-08-06. This document was written on 2026-07-30 and said
"GoProceed **v0.1** has two template families". Both statements about v0.1 have
since been decided otherwise, and until this edit an Approved v0.1-scoped
document contradicted two Approved decisions:

- **Requirement templates are retired, not deferred.**
  [ADR-005](../../docs/decisions/ADR-005-readiness-gate-and-hidden-works.md)
  decision 2 replaces the one-template-per-assignment model with requirement
  rules and their immutable rule versions, and `docs/domain/glossary.md` retires
  the term. `requirement_template_versions` exists only because migration 0015
  created it and applied migrations are append-only history; its authoring
  routes and the `requirement_templates.manage` capability are still live in
  running code and are owed a removal slice
  (`docs/delivery/version-0.1.md` §v0.1-M1). Nothing below is a v0.1 obligation
  for that family, and **no v0.1 obligation may be derived from it**: the v0.1
  rule source is the shipped Додаток Н library and rule versions are publish/
  retire only (INV-067).
- **Package templates are v0.2.**
  [ADR-006](../../docs/decisions/ADR-006-pilot-shaped-v0.1.md) decision 5 moves
  package versions, package lines, artifacts and approval requirements to v0.2.
  `package_template_versions` is `v0.2` in
  [`entity-catalog.csv`](../database/entity-catalog.csv), no operation in
  either scope CSV authors one, and v0.1 has no artifact renderer: the only
  document v0.1 produces is the statutory act through `statutory_acts.render`.

The publication contract below is unchanged and remains the approved shape for
the package family in v0.2. It is kept in one piece rather than cut down,
because deleting it would lose the renderer-identity rules that v0.2 needs.

## What a template is

A template is a published, immutable, versioned configuration. Two template
families follow the same publication contract:

| Family | Table (target design) | Version | Governs |
|---|---|---|---|
| Requirement templates | `requirement_template_versions` | **Retired** (ADR-005 decision 2); deployed and not a build target | Evidence obligations: type, allowed MIME/content rules, multiplicity, timing, severity, allowlisted condition expression, structured form schema, who may satisfy/review/except. Superseded by `requirement_rule_versions`, whose nine pinned fields carry the same obligations with no free `severity` axis |
| Package templates | `package_template_versions` | **v0.2** (ADR-006 decision 5) | Package document structure and the renderer contract used to generate PDF/XLSX/ZIP/manifest artifacts |

## Publication contract

1. A draft template version is editable under an optimistic version.
2. Publication freezes the full configuration, computes `template_hash`, and
   records the publisher and time.
3. A published version never changes (INV-015 layer set: no UPDATE/DELETE
   grants, mutation-rejecting trigger, successor-only correction).
4. Improvement publishes the next `version_no` of the same `template_key`;
   consumers pin exact versions:
   - a package version pins one `package_template_version` plus the renderer
     version and configuration.
   - The requirement-template pin is **retired**: a requirement occurrence
     stores `rule_version_id` (INV-067), and
     `work_assignments.requirement_template_version_id` is retired by a new
     migration in `v0.1-M2` (`docs/delivery/version-0.1.md` §v0.1-M2).
5. Condition expressions come from a closed allowlist only; no template may
   introduce executable content (consistent with INV-016).

## Renderer and artifact identity

Package artifacts are deterministic products of one frozen snapshot:

```text
artifact identity = frozen package version
                  + artifact kind (pdf | xlsx | zip | manifest)
                  + renderer version
                  + renderer configuration hash
```

Repeating the same identity returns/verifies the same artifact record and
content hash; a changed renderer or configuration creates a new immutable
identity and storage key. No retry overwrites an earlier key (INV-045,
docs/architecture/jobs-events-and-audit.md "Artifact generation").

CSV/XLSX artifact generation applies the documented formula-neutralization
encoding to hostile spreadsheet input and records the neutralization
policy/version in the export manifest
(docs/architecture/files-and-storage.md "Export and generated artifacts").

## What is deliberately absent when the package family ships

- No template marketplace or cross-workspace template sharing.
- No sequential approval-routing templates (parallel approvers only).
- No AI-generated templates: AI may later *suggest* requirement templates, but
  a human publishes them (canonical design §15).
