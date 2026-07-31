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
// local stack without env setup, and any other environment overrides them.
const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

let client: SupabaseClient | null = null;
function storage() {
  client ??= createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.storage.from(EVIDENCE_BUCKET);
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

export async function objectExists(key: string): Promise<boolean> {
  const { error } = await storage().download(key);
  return !error;
}

/** Idempotent: removing an absent key is not an error. */
export async function removeObject(key: string): Promise<void> {
  const { error } = await storage().remove([key]);
  if (error) throw new Error(`storage: remove failed for ${key}: ${error.message}`);
}
