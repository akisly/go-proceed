#!/usr/bin/env node
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import pg from "pg";
import { digest, loadManifest, storageIdentity } from "./reference-image-manifest.mjs";

const BUCKET = "requirement-reference-images";
const GUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const { values } = parseArgs({ options: { manifest: { type: "string" }, workspace: { type: "string" },
  apply: { type: "boolean", default: false }, "allow-remote": { type: "boolean", default: false } } });

async function main() {
  if (!values.manifest) throw new Error("Supply --manifest; default is validation only, --apply performs provisioning");
  const manifest = await loadManifest(values.manifest);
  if (!values.apply) {
    console.log(`Validated ${manifest.images.length} licensed-manifest entries; no writes performed.`);
    return;
  }
  if (!GUID.test(values.workspace ?? "")) throw new Error("--apply requires --workspace UUID");
  if (!manifest.images.length) throw new Error("Empty manifest cannot provision a reference library");
  const databaseUrl = process.env.SUPABASE_DB_URL;
  const storageUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!databaseUrl || !storageUrl || !key) throw new Error("SUPABASE_DB_URL, SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  const local = (value) => ["127.0.0.1", "localhost", "[::1]"].includes(new URL(value).hostname);
  if ((!local(databaseUrl) || !local(storageUrl)) && !values["allow-remote"]) {
    throw new Error("Remote provisioning requires explicit --allow-remote and owner authorization");
  }
  const requireApp = createRequire(new URL("../apps/app/package.json", import.meta.url));
  const { createClient } = requireApp("@supabase/supabase-js");
  const storage = createClient(storageUrl, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  const bucket = await storage.getBucket(BUCKET);
  if (bucket.error || !bucket.data || bucket.data.public || Number(bucket.data.file_size_limit) !== 5242880) {
    throw new Error("Private reference bucket is absent or misconfigured; apply migration0090 first");
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  let inserted = 0;
  try {
    for (const image of manifest.images) {
      await client.query("begin");
      try {
        const lib = await client.query(`select id from public.requirement_library_items
          where workspace_id=$1 and source_standard=$2 and position_code=$3 and item_no=$4`,
          [values.workspace, image.sourceStandard, image.positionCode, image.itemNo]);
        if (lib.rows.length !== 1) throw new Error("Manifest item does not identify a library item in the selected workspace");
        const libraryId = lib.rows[0].id;
        await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",
          [`reference-image|${values.workspace}|${libraryId}`]);
        const prior = await client.query(`select * from public.requirement_reference_image_versions
          where workspace_id=$1 and requirement_library_item_id=$2 and version_no=$3`,
          [values.workspace, libraryId, image.versionNo]);
        const metadata = { sha256: image.sha256, byte_size: image.byteSize, mime_type: image.mimeType,
          width: image.width, height: image.height, alt_text_uk: image.altTextUk,
          rights_holder: image.rightsHolder, license: image.license, source_uri: image.sourceUri };
        if (prior.rows[0] && Object.entries(metadata).some(([k, v]) => prior.rows[0][k] !== v)) {
          throw new Error("Published version is immutable; publish a new version number");
        }
        const identity = storageIdentity(values.workspace, libraryId, image.versionNo);
        const storageKey = prior.rows[0]?.storage_key ?? identity.key;
        // Never upsert: a crash after upload but before commit leaves a retryable
        // object at the same opaque key. Verify its bytes before adopting it.
        const existing = await storage.from(BUCKET).download(storageKey);
        if (existing.data) {
          if (digest(new Uint8Array(await existing.data.arrayBuffer())) !== image.sha256) {
            throw new Error("Existing private object differs from the immutable version");
          }
        } else {
          if (prior.rows[0]) throw new Error("Published reference object is missing; investigate instead of overwriting it");
          const upload = await storage.from(BUCKET).upload(storageKey, image.bytes,
            { contentType: image.mimeType, upsert: false, cacheControl: "0" });
          if (upload.error) throw new Error("Private reference upload failed");
        }
        if (!prior.rows[0]) {
          await client.query(`insert into public.requirement_reference_image_versions
            (id,workspace_id,requirement_library_item_id,version_no,storage_key,sha256,byte_size,
             mime_type,width,height,alt_text_uk,rights_holder,license,source_uri,manifest_sha256)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [identity.id, values.workspace, libraryId, image.versionNo, storageKey, image.sha256,
              image.byteSize,image.mimeType,image.width,image.height,image.altTextUk,image.rightsHolder,
              image.license,image.sourceUri,manifest.sha256]);
          inserted += 1;
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      }
    }
  } finally { await client.end(); }
  console.log(`Verified ${manifest.images.length} reference versions; inserted ${inserted}.`);
}
main().catch(() => {
  // Driver/provider diagnostics may contain connection credentials or private
  // object keys. Fail closed without printing those error objects.
  console.error("Reference provisioning failed. Check the manifest, rights, bucket configuration and database access; no published row was overwritten.");
  process.exitCode = 1;
});
