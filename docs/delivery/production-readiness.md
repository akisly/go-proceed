# Production and pilot readiness gates

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md)

## Hard rule

No real pilot data enters GoProceed until every gate below is approved and
tested. These are the "before real customer data" controls from the canonical
design (§16) and
[files-and-storage.md](../architecture/files-and-storage.md); durations that
are not fixed by the architecture (24-hour orphan purge, seven-day quarantine,
30-minute/12-hour session TTLs) must come from the approved retention
schedule, not from implementation defaults.

## Gates

### 1. Privacy notice

- [ ] Published privacy notice covering evidence content, EXIF/GPS policy,
      contacts, filenames, and security telemetry.
- [ ] Versioned external decision confirmation text; the version is pinned on
      every approval requirement and decision batch.

### 2. Retention choice

- [ ] A versioned retention schedule for originals, derivatives, imports,
      package artifacts, scan-blocked content, staging data, local
      quarantine, audit-safe deletion metadata, and backups.
- [ ] Security telemetry access, purpose, and retention bounds are declared.

### 3. Export

- [ ] Workspace export reproduces authorized originals and artifacts with a
      manifest, hashes, provenance, and named omissions.

### 4. Manual deletion

- [ ] Manual workspace closure/deletion procedure with authorization,
      separation of duties where applicable, dry-run inventory, export offer,
      confirmation, and recorded outcome.
- [ ] Deletion followed by restore does not resurrect deleted content
      (tombstones reapplied before restored data is reachable).

### 5. Backup and restore

- [ ] Encrypted backup policy with access separation, retention, and deletion
      behavior; backup expiration and deletion latency disclosed.
- [ ] One successful restore exercise verifying relational rows, object bytes,
      hashes, tenant boundaries, and package/evidence links, performed in an
      isolated environment first.

### 6. Monitoring

- [ ] The observability metrics/alerts from
      [jobs-events-and-audit.md](../architecture/jobs-events-and-audit.md)
      (outbox age, job/retry/dead-letter, lease/fence, artifact hash mismatch,
      projection lag, orphan purge, provider errors) are live and owned.

### 7. Incident path

- [ ] Security signal routing (revocation, suspicious exchange, repeated CSRF
      failure, cross-tenant denial, privileged-function denial) with a named
      responder.
- [ ] Leaked-credential playbook: revoke, rotate, scrub history, audit
      exposure window, check for abuse.

### 8. Link-assurance copy

- [ ] The external review surface and exports state that `bearer_email_link`
      proves possession of the link, not verified identity or a qualified
      signature; reviewer name/company/title are labeled self-declared; IP is
      telemetry, not identity proof.

### 9. Demo and data separation

- [ ] No production/customer data in any demo, test, or sample workspace.
- [ ] The v0.2 `/demo` design keeps a server-side demo principal structurally
      denied access to customer workspaces; `?demo=true` can never switch a
      customer session (ADR-004). Until then, no demo surface uses real data.

### 10. Environment safety

- [ ] Development seed credentials cannot be applied to
      preview/staging/production (v0.0 gate 4; 2026-07-30 security-gate
      finding on `supabase/seed.sql` + `[db.seed] enabled = true`).
- [ ] Per-environment secret stores with rotation runbooks; HMAC and session
      verifier keys carry key IDs.

## Evidence format

Each gate closes with a dated evidence entry (test run, exercise record, or
approved document) linked from the v0.1-M6 entry checklist in
[version-0.1.md](version-0.1.md). Gates stay verified throughout the pilot;
a regression reopens the gate and blocks new pilot data.
