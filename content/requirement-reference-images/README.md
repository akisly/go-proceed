# Requirement reference illustrations

DEV-042 / ADR-013. This directory is the versioned source manifest, not an
assertion that licensed illustrations have been supplied. The initial manifest
is deliberately empty. New common-library rules cannot publish until an operator
provisions the relevant illustration. Existing rule and occurrence pins stay null.

Each `images` entry identifies `sourceStandard`, `positionCode`, `itemNo`, and a
positive `versionNo`; carries `file` relative to the manifest, `sha256`, `byteSize`,
`mimeType`, `width`, `height`, `altTextUk`, `rightsHolder`, `license`, `sourceUri`.
All fields are required. The owner supplies or licenses content and records real
provenance. A product illustration neither satisfies an obligation nor changes
the source or verification of its normative text.

Only upright single-frame JPEG, PNG and WebP are accepted: at most 5 MiB, at most
8192 pixels per side and 16 megapixels. Content and provenance are immutable.
Corrections use a higher version number. Never add client-uploaded examples here.

Validate locally without any writes:

```sh
node scripts/reference-image-provision.mjs --manifest content/requirement-reference-images/manifest.json
```

After migration 0095 is manually applied and the owner has authorized content
provisioning, supply `SUPABASE_DB_URL` (operator database connection),
`SUPABASE_URL`, `SUPABASE_SECRET_KEY` through the secret manager, then:

```sh
node scripts/reference-image-provision.mjs --manifest content/requirement-reference-images/manifest.json --workspace WORKSPACE_UUID --apply
```

Remote connections additionally require `--allow-remote`; that switch is not
authorization by itself. Never put credentials in CLI arguments, this manifest,
source control or logs. The provisioner does not apply migrations or create
buckets. It verifies the private bucket and uploaded bytes before publishing a
database row; retries verify the same opaque object key and never overwrite it.
An interrupted transaction may leave an unreferenced private object which the
same manifest retry adopts after verifying its digest. There is no automatic
cleanup of unreferenced objects.

Changes to the manifest do not update already-published rules or occurrences.
The app receives only occurrence-authorized BFF paths. Raw object keys and license
administration remain server-side.

Sources checked 2026-09-23: installed supabase-js 2.112.3 / storage-js, installed
sharp 0.34.5; [private buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets),
[downloads](https://supabase.com/docs/guides/storage/serving/downloads).
