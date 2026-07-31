import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The one private evidence bucket. Staged bytes and available originals live at
 * the same immutable key; what makes an object evidence is an evidence_objects
 * row in PostgreSQL, never its location. See migration 0020 for why there is no
 * staging/originals pair.
 */
export const EVIDENCE_BUCKET = "evidence";
export const STORAGE_PROVIDER = "supabase";

// Local defaults mirror packages/testing/src/pg.ts: the suites run against the
// local stack without env setup. The service key falls back ONLY when the URL is
// the local stack's, so a deployment missing SUPABASE_SERVICE_ROLE_KEY fails
// loudly at startup instead of carrying a literal credential from source into an
// environment it was never meant for. The local value is the published Supabase
// demo secret, not a real one.
const LOCAL_URL = "http://127.0.0.1:54321";
const SUPABASE_URL = process.env.SUPABASE_URL ?? LOCAL_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? (SUPABASE_URL === LOCAL_URL ? "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz" : "");

if (SERVICE_KEY === "") {
  throw new Error(
    "evidence storage: SUPABASE_SERVICE_ROLE_KEY is required when SUPABASE_URL is not the local stack",
  );
}

let client: SupabaseClient | null = null;
function storage(bucket: string = EVIDENCE_BUCKET) {
  client ??= createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.storage.from(bucket);
}

/**
 * An opaque key, issued once when the upload intent is authorized and never
 * rewritten. Two uuids and nothing else: user filenames, workspace names,
 * contract numbers and other business identifiers must not form storage keys,
 * so a key cannot leak personal or commercial information
 * (docs/architecture/files-and-storage.md).
 */
export function newEvidenceKey(): string {
  return `${randomUUID()}/${randomUUID()}`;
}

export interface SignedUpload { signedUrl: string; token: string; path: string }

/** A short-lived, single-key upload grant. Never persisted — it expires. */
export async function createSignedUpload(key: string): Promise<SignedUpload> {
  const { data, error } = await storage().createSignedUploadUrl(key);
  if (error) throw new Error(`storage: signed upload failed for ${key}: ${error.message}`);
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

/**
 * Uploads bytes with the server's own credentials. The client-facing path is
 * the signed URL above; this exists for tests and for server-side derivatives.
 */
export async function putObject(
  key: string, bytes: Uint8Array, contentType: string,
): Promise<void> {
  const { error } = await storage().uploadToSignedUrl(key, (await createSignedUpload(key)).token,
    bytes, { contentType });
  if (error) throw new Error(`storage: upload failed for ${key}: ${error.message}`);
}

export async function downloadObject(key: string): Promise<Uint8Array> {
  const { data, error } = await storage().download(key);
  if (error) throw new Error(`storage: download failed for ${key}: ${error.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * The stored object's size in bytes, or null when the key holds nothing.
 *
 * Read from storage metadata rather than by downloading. finalize used to pull
 * the whole object into memory before comparing it with the intent's declared
 * size, so a caller could declare ten bytes, upload fifty megabytes, and force
 * the server to buffer all of it just to reject it.
 */
export async function objectSize(
  key: string, bucket: string = EVIDENCE_BUCKET,
): Promise<number | null> {
  const slash = key.lastIndexOf("/");
  const prefix = slash === -1 ? "" : key.slice(0, slash);
  const name = slash === -1 ? key : key.slice(slash + 1);
  const { data, error } = await storage(bucket).list(prefix, { search: name, limit: 100 });
  if (error) throw new Error(`storage: list failed for ${bucket}/${key}: ${error.message}`);
  const found = data?.find((o) => o.name === name);
  const size = (found?.metadata as { size?: number } | undefined)?.size;
  return typeof size === "number" ? size : null;
}

export async function objectExists(key: string): Promise<boolean> {
  const { error } = await storage().download(key);
  return !error;
}

/**
 * Idempotent: removing an absent key is not an error.
 *
 * The bucket is a parameter because the purge worker is told which bucket to
 * clear by the database. Assuming the default there made "the object is not in
 * the bucket I happened to look in" indistinguishable from "the object is gone",
 * so a row could be marked purged while its bytes survived elsewhere.
 */
export async function removeObject(key: string, bucket: string = EVIDENCE_BUCKET): Promise<void> {
  const { error } = await storage(bucket).remove([key]);
  if (error) throw new Error(`storage: remove failed for ${bucket}/${key}: ${error.message}`);
}
