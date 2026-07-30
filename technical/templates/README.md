# GoProceed v0.1 template contract

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-003](../../docs/decisions/ADR-003-evidence-packages-and-acceptance.md)

## What a template is

A template is a published, immutable, versioned configuration. GoProceed v0.1
has two template families; both follow the same publication contract:

| Family | Table (target design) | Governs |
|---|---|---|
| Requirement templates | `requirement_template_versions` | Evidence obligations: type, allowed MIME/content rules, multiplicity, timing, severity, allowlisted condition expression, structured form schema, who may satisfy/review/except |
| Package templates | `package_template_versions` | Package document structure and the renderer contract used to generate PDF/XLSX/ZIP/manifest artifacts |

## Publication contract

1. A draft template version is editable under an optimistic version.
2. Publication freezes the full configuration, computes `template_hash`, and
   records the publisher and time.
3. A published version never changes (INV-015 layer set: no UPDATE/DELETE
   grants, mutation-rejecting trigger, successor-only correction).
4. Improvement publishes the next `version_no` of the same `template_key`;
   consumers pin exact versions:
   - a work assignment or requirement occurrence pins one
     `requirement_template_version`;
   - a package version pins one `package_template_version` plus the renderer
     version and configuration.
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

## What is deliberately absent in v0.1

- No template marketplace or cross-workspace template sharing.
- No sequential approval-routing templates (parallel approvers only).
- No AI-generated templates: AI may later *suggest* requirement templates, but
  a human publishes them (canonical design §15).
