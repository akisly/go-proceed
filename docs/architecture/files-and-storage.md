# Files, storage, and import safety

**Status:** Approved

**Applies to:** v0.0 and v0.1

**Last reviewed:** 2026-08-03

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md)

## Purpose and boundary

This document defines how GoProceed preserves evidence, import sources, generated
artifacts, and temporary upload bytes without turning object storage into a
second source of truth.

PostgreSQL owns identity, authorization scope, provenance, lifecycle, and
receipts. Private object storage owns bytes addressed by opaque immutable keys.
An object existing in storage does not make it evidence, an import, or a package
artifact. The corresponding relational fact and lifecycle gate must also exist.

v0.1 supports:

- whole-file online evidence upload from `apps/mobile`;
- controlled XLSX and CSV contract-baseline import;
- immutable evidence originals, derivatives, import sources, and package
  artifacts;
- deterministic PDF, XLSX, ZIP, and manifest package output;
- manual retention, export, deletion, and restore controls required before real
  pilot data.

v0.1 does not support resumable chunk upload, offline task authorization,
background offline synchronization, authoritative PDF baseline extraction, or an
automated legal-hold/retention engine.

## Storage authority and object identity

All buckets are private. Public bucket access, anonymous listing, predictable
tenant paths, and permanent download URLs are forbidden.

Every stored object has:

- a server-generated opaque storage key;
- workspace and owning-domain identity in PostgreSQL;
- object kind and lifecycle state;
- byte size and server-verified cryptographic content hash;
- validated media type and untrusted original filename;
- storage provider, region, and creation time;
- actor or service principal that caused storage;
- source command, upload intent, import file, evidence object, derivative, or
  package artifact identity;
- retention class and deletion/tombstone state.

Storage keys and content hashes are immutable after a domain object becomes
available or an artifact is published. Bytes are never overwritten in place.
Correction, annotation, redaction, rendition, reimport, or regeneration creates
a new key and an explicit relationship to its source.

User filenames, workspace names, email addresses, contract numbers, and other
business identifiers do not form storage keys. They remain metadata so keys do
not leak personal or commercial information.

Staging is also append-only by attempt. A retry under the same upload intent may
receive a new short-lived attempt key, but it never overwrites a partial or
failed object. The intent remains the idempotent business identity and converges
on one successful evidence receipt.

## Bucket and access separation

Logical storage classes are separated by policy even when one provider hosts
them:

| Class | Examples | Access rule |
|---|---|---|
| Upload staging | Uncommitted mobile/import bytes | Write only to one intent-bound key; no domain reads |
| Evidence originals | Available original photos, files, and forms | Exact workspace/project/evidence authorization |
| Evidence derivatives | Thumbnails, previews, annotations, redactions | Same or narrower scope than the source |
| Import sources | Original XLSX/CSV and immutable parser inputs | Authorized contract-import roles only |
| Package artifacts | Frozen PDF/XLSX/ZIP/manifest output | Exact package-version and grant/session scope |
| Restricted quarantine | Scan-blocked or orphaned bytes awaiting purge/remediation | No ordinary product download |

Provider credentials are held only by narrowly scoped server/worker identities.
The browser and mobile client never receive bucket-wide credentials or list
permission.

### Downloads and signed URLs

Every download begins at the BFF, which rechecks current workspace membership,
project access, object state, package/grant scope, and applicable retention or
revocation state before issuing access.

A storage signed URL is a bearer capability. It:

- points to one exact immutable key;
- uses the shortest practical TTL, normally no more than 60 seconds;
- is issued only after the BFF authorization check;
- is never stored in domain records, analytics, audit payloads, or notifications;
- is returned with safe filename/content-disposition handling;
- cannot be used to list adjacent objects.

An already issued provider signed URL is not assumed to be immediately
revocable. For data that requires immediate revocation, or when external-session
scope may change during the transfer, the BFF/authorized download service
streams or proxies the object instead of exposing a provider URL. Revocation is
then enforced before and during the controlled response.

Expired URLs are not refreshed without a new authorization check. Logs record
the domain object and authorization result, never the signed URL or raw storage
key.

## Expo pending-original protection

`apps/mobile` is the Expo/React Native iOS/Android field client. v0.1 capture is
online-authorized, but a connection or process interruption must not lose the
original selected while authorization was current.

### Local encryption

Expo SecureStore is used only for small secrets or wrapping keys. Evidence bytes
must not be placed in SecureStore, and Expo FileSystem storage must not be
treated as encrypted by itself.

Each pending original is protected with envelope encryption:

1. generate a unique random per-file content-encryption key;
2. encrypt the bytes with an authenticated-encryption scheme such as AES-GCM or
   ChaCha20-Poly1305, using a unique nonce and authenticated workspace/subject
   metadata;
3. store only ciphertext and non-secret retry metadata in the app's sandboxed
   file area;
4. wrap the per-file key with an installation/account/workspace-bound key held in
   iOS Keychain or Android Keystore through SecureStore or a vetted native
   module;
5. exclude ciphertext, wrapping keys, and recovery metadata from cloud/device
   backup unless an explicitly reviewed recovery design later authorizes it.

Another signed-in identity must not enumerate, decrypt, preview, upload, export,
or delete the pending original without the explicit recovery/deletion flow.
Sensitive plaintext and keys are removed from memory as soon as practical.

### Local states

The client persists the original, expected hash/size, upload-intent identity,
attempt state, and last receipt check across an ordinary app/process restart.

```text
not_sent → sending → awaiting_receipt → server_confirmed
              │              │
              └──→ failed ←──┘

not_sent / sending / failed / awaiting_receipt
  ── logout, account switch, or revoked authorization ──→ quarantined

quarantined
  ├── same subject + same workspace reauthorized ──→ not_sent
  ├── explicit warned deletion ──→ discarded
  └── seven-day expiry after warning ──→ expired_purged
```

Only reauthentication as the same subject in the same workspace can restore an
upload. Account switching keeps the item hidden and quarantined. Permanently
revoked scope cannot be uploaded or exported by GoProceed in v0.1.

The app may delete local ciphertext only after it has persisted an `available`
server receipt whose content identity, size, and hash match the local original,
or after an explicit warned user deletion. Deletion retains only the minimum
non-content metadata required to explain the outcome. Merely sending bytes or
receiving a storage response is not cleanup authorization.

No new capture begins when current server authorization cannot be checked. This
restart-safe pending queue is not the v0.3 offline outbox.

## Whole-upload intent and server lifecycle

An upload intent is the idempotent server contract for one original. It records:

- workspace, project, assignment, occurrence, and actor scope;
- device capture identifier and bounded idempotency key;
- expected byte size, client hash, allowed content family, and claimed media
  type;
- quota reservation and expiry;
- issued staging attempt(s);
- terminal evidence identity/receipt or named failure.

The server validates current actor, assignment, requirement, expected size/type,
quota, and idempotency request hash before issuing a narrowly scoped staging
destination. The client uploads the whole original without transforming it.

Server states are distinct:

```text
intent_authorized
  ├──→ available
  ├──→ scan_blocked
  ├──→ orphaned_for_purge
  └──→ expired
```

`staged`, `integrity_verified`, and `scan_pending` exist in the CHECK constraint
(`supabase/migrations/0015`) but are reserved for the v0.3 resumable protocol;
v0.1 writes none of them. Integrity verification and content inspection happen
synchronously inside the finalization command and are never recorded as
intermediate row states.

State rules:

1. `staged`, `integrity_verified`, and `scan_pending` are reserved for the v0.3
   resumable protocol; not written in v0.1 (supabase/migrations/0015 permits the
   values; no code writes them).
2. `available` requires integrity success, a final authorization recheck,
   content-policy inspection, and atomic creation/return of the evidence object
   plus receipt.
3. `scan_blocked` is not evidence available for review or packaging. It remains
   in restricted quarantine for the documented remediation/retention period.
4. Authorization failure before finalization produces no evidence object. The
   intent becomes `orphaned_for_purge` directly from `intent_authorized`.

Finalization rechecks current membership/project permission, assignment and
requirement scope, workspace quota, intent expiry, and any relevant revocation or
object version. A successful retry with the same idempotency key and identical
request returns the original receipt. Reuse with a different hash, size, or
scope fails as an idempotency conflict.

Orphaned and expired staging objects are inaccessible and purged by an
idempotent job within 24 hours. The purge records intent/key hash, reason,
attempt, and outcome without preserving file content. Repeated purge failure
raises an operational alert and never makes the object available.

## Content validation and malware boundary

File extension, browser/mobile media type, original filename, and spreadsheet
cell content are untrusted input.

Before availability or parsing, GoProceed applies:

- allowlisted file families per command and requirement;
- magic-byte/content sniffing independent of the claimed MIME type;
- rejection of extension, claimed type, and detected type conflicts unless an
  explicit safe normalization rule exists;
- request, per-file, per-workspace, and storage quota checks;
- expected-size validation before upload and actual-size validation after it;
- image dimension/pixel-count and decoding-resource limits;
- archive entry-count, nesting-depth, path-length, compression-ratio, and total
  uncompressed-byte limits;
- parser CPU, memory, wall-time, row, column, cell-length, and worksheet limits;
- filename/path normalization that rejects traversal and control characters;
- malware/content inspection using a pinned scanner/policy version.

Inspection fails closed. A rejected or unrecognised content check enters
`scan_blocked`; it never becomes `available`. (Scanner error/timeout/unavailable
handling for a longer-running scan, and the `scan_pending` value that would
record it in progress, are reserved for the v0.3 resumable protocol — v0.1's
inspection is synchronous within finalization.) The inspection result,
engine/policy version, time, and disposition are retained as provenance.

Original EXIF/GPS and document metadata are untrusted sensitive data. Their
retention and authorized exposure must be defined before pilot use. A
privacy-safe preview or redaction is a derivative with its own hash and key; it
does not overwrite the original.

Download responses use the validated media type, safe `Content-Disposition`,
`X-Content-Type-Options: nosniff`, and a restrictive content security policy for
any in-browser preview.

## Contract-baseline import pipeline

The import pipeline is draft-producing until an authorized user explicitly
publishes a contract version.

```text
source upload
→ finalized upload (integrity verified + content inspected)
→ format-specific safe parse
→ immutable raw row/cell provenance
→ mapping and localized normalization
→ row validation and blocking-error report
→ reviewed preview
→ explicit publish command
→ immutable contract version and work-item lineage
```

Every import preserves:

- original file identity, storage key, byte size, and content hash;
- detected format, original filename, and upload actor/time;
- parser name, exact parser version, configuration, and execution attempt;
- mapping definition/version and who selected or confirmed it;
- worksheet/table identity and one-based source row/column coordinates;
- exact source values and formulas as inert text where retention is permitted;
- locale, decimal/grouping interpretation, unit normalization, and warnings;
- normalized preview and per-row validation result;
- publish actor, timestamp, source manifest hash, and predecessor/diff lineage.

Parser retries are idempotent by source hash, parser version, configuration, and
mapping version. Updating a parser or mapping creates a distinct result; it does
not silently rewrite a published contract version.

### XLSX

XLSX is treated as an untrusted ZIP container:

- macros, embedded scripts, external links, data connections, and formulas are
  never executed;
- formula cells are imported only as inert source text plus cached value when
  available and explicitly labeled;
- archive paths are normalized and traversal is rejected;
- encrypted workbooks are rejected unless a separately approved secure handling
  path exists;
- entry count, nesting, compression ratio, and total uncompressed bytes are
  checked before full expansion;
- worksheets, rows, columns, merged ranges, shared strings, and cell lengths are
  bounded before materialization.

A ZIP-bomb, decompression-limit breach, parser timeout, or unsupported workbook
feature fails the import with no publishable rows.

### CSV

CSV parsing pins encoding, delimiter, quote/escape rules, header interpretation,
locale, and row/column limits. Invalid encoding, inconsistent records beyond the
approved tolerance, oversized fields, NUL/control characters, and resource-limit
breaches produce explicit validation failure.

CSV content is data, never executable input. Spreadsheet-looking values remain
untrusted strings until mapped and validated into an allowlisted typed field.

### PDF

PDF is not an authoritative contract-baseline import format in v0.1. A PDF may
be stored as a private reference/evidence object after the ordinary integrity,
malware, active-content, size, and parser-resource checks.

Any later PDF extraction:

- runs in a sandboxed worker with no document script, network, attachment, or
  embedded-action execution;
- produces a reviewable draft, never a published contract fact;
- records source page/region, extractor and model version, confidence, and raw
  extracted text;
- requires explicit human mapping, validation, and publish confirmation;
- cannot reuse the PDF filename or visual appearance as proof of correctness.

Introducing authoritative PDF import requires a superseding version decision and
new acceptance/security tests.

## Export and generated artifacts

Package artifacts are generated only from one frozen package-version manifest.
The manifest pins every source identity/hash, template version/hash, renderer
version/configuration, author, and generation command. Repeating the same
generation identity returns/verifies the same artifact; a changed renderer or
template creates a new artifact key.

CSV/XLSX export treats every user-controlled value as hostile spreadsheet input.
For CSV cells beginning, after leading whitespace/control characters, with
`=`, `+`, `-`, `@`, tab, carriage return, or line feed, the exporter applies the
documented formula-neutralization encoding and quotes the field. It does not
strip the character invisibly. The export manifest records the neutralization
policy/version so a consumer can distinguish safe representation from source
value.

Generated ZIP files use safe relative entry names, have no traversal or
duplicate-normalized paths, and include a checksum manifest. Export generation
has bounded file count, total bytes, runtime, and workspace quota.

## Retention, deletion, export, and restore

No real pilot data enters GoProceed until the following are approved and tested:

- a versioned retention schedule for originals, derivatives, imports, package
  artifacts, scan-blocked content, staging data, local quarantine, audit-safe
  deletion metadata, and backups;
- a privacy notice and explicit policy for EXIF/GPS, contacts, filenames, and
  security telemetry;
- a workspace export that reproduces authorized originals and artifacts with a
  manifest, hashes, provenance, and named omissions;
- a manual workspace closure/deletion procedure with authorization,
  separation-of-duties where applicable, dry-run inventory, export offer,
  confirmation, and recorded outcome;
- encrypted backup policy with access separation, retention, and deletion
  behavior;
- a successful restore exercise that verifies relational rows, object bytes,
  hashes, tenant boundaries, and package/evidence links.

Staging/orphan purge and the seven-day local quarantine use the fixed bounds
defined above. Other durations are not invented by implementation; they must be
declared in the approved retention schedule before pilot admission.

Deletion never overwrites an immutable object under the same key. The authorized
workflow removes inaccessible bytes and derivatives from all active storage
locations, records a minimal tombstone/deletion receipt where policy permits, and
preserves no content merely because an audit row exists. Known contractual or
legal preservation requirements are checked manually in v0.1; an automated
legal-hold engine remains deferred.

Backup expiration and deletion latency are disclosed. A restore must not
silently resurrect a deleted workspace or object: deletion/tombstone records are
reapplied before restored data can become reachable. Restore occurs first in an
isolated environment, validates checksums and authorization boundaries, and
becomes production-visible only through an approved recovery procedure.

## Required verification

- storage buckets reject anonymous/public listing and reads;
- one workspace cannot issue or use a URL for another workspace's object;
- signed URL expiry and proxied immediate revocation behave as documented;
- storage-key overwrite and hash mutation fail;
- blocked and orphaned bytes are not package-visible (`staged`,
  `integrity_verified`, and `scan_pending` are reserved for v0.3 and not
  writable in v0.1, so there is nothing to verify for them yet);
- authorization revoked between intent creation and finalization produces no
  evidence object;
- orphan purge completes within 24 hours and repeated failure alerts;
- an app restart preserves encrypted pending bytes and retry state;
- another account/workspace cannot enumerate or decrypt local pending content;
- logout/revocation quarantines rather than silently deleting the original;
- cleanup requires the matching `available` receipt;
- MIME spoofing, quota breach, malware, oversized images, parser exhaustion,
  path traversal, and ZIP-bomb fixtures fail closed;
- XLSX formulas/macros/external links are never executed;
- CSV export neutralizes spreadsheet formulas without losing source provenance;
- PDF extraction cannot publish authoritative contract data;
- export manifests and restored objects reproduce expected hashes;
- deletion followed by restore does not make deleted content reachable.
