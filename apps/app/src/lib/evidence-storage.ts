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
// local stack without env setup. The secret key falls back ONLY when the URL is
// the local stack's, so a deployment missing SUPABASE_SECRET_KEY fails
// loudly at startup instead of carrying a literal credential from source into an
// environment it was never meant for. The local value is the published Supabase
// demo secret, not a real one.
//
// THIS IS THE `sb_secret_…` FORM, AND THE VARIABLE IS NAMED FOR IT since
// 2026-08-19. It was `SUPABASE_SERVICE_ROLE_KEY` — the legacy JWT's name — while
// the value below was ALREADY the new-format local secret the CLI issues, so
// the name and the value disagreed for as long as nobody looked. Supabase's
// legacy `service_role`/`anon` JWTs stop working at the end of 2026;
// supabase-js 2.112 classifies `sb_secret_`/`sb_publishable_` explicitly
// (`isNewApiKey`), and that SDK is what this file now runs on. Both forms are
// accepted by the hosted platform today — measured on goproceed-staging — so
// the rename is about being on the side that survives 2027, not about the old
// one failing now.
const LOCAL_URL = "http://127.0.0.1:54321";
const SUPABASE_URL = process.env.SUPABASE_URL ?? LOCAL_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY
  ?? (SUPABASE_URL === LOCAL_URL ? "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz" : "");

if (SERVICE_KEY === "") {
  throw new Error(
    "evidence storage: SUPABASE_SECRET_KEY is required when SUPABASE_URL is not the local stack",
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

/**
 * THE CEILING IS OURS AND NOTHING BELOW US ENFORCES IT.
 *
 * `docs/architecture/files-and-storage.md` §Downloads: a signed URL «uses the
 * shortest practical TTL, normally no more than 60 seconds». Measured against
 * the local storage API on 2026-08-22, the server enforces only a LOWER bound —
 * `expiresIn: 0` and `-1` are rejected with «body/expiresIn must be >= 1», and
 * `999999999` (about 31 years) was accepted and produced a token with that
 * expiry. So this constant, and the fact that no function here takes a TTL
 * argument, is the entire enforcement.
 */
export const EVIDENCE_URL_TTL_SECONDS = 60;

/**
 * NO KEY IN ANY MESSAGE THROWN FROM HERE DOWN.
 *
 * The functions above this line interpolate the storage key into their errors,
 * which reach `console.error` through `toProblemResponse`'s unmapped branch —
 * against `files-and-storage.md`'s «Logs record the domain object and
 * authorization result, never the signed URL or raw storage key». That is a
 * recorded defect (TODOS.md) and deliberately NOT the style copied here.
 * A key is the input to a signing operation the service key can perform; a
 * leaked key narrows an attacker's search to nothing.
 */
function readFailed(what: string, message: string): Error {
  return new Error(`storage: ${what} failed: ${message}`);
}

/** A short-lived read grant for exactly one object. */
export async function createSignedReadUrl(bucket: string, key: string): Promise<string> {
  const { data, error } = await storage(bucket)
    .createSignedUrl(key, EVIDENCE_URL_TTL_SECONDS);
  // NOTE: a missing object arrives as HTTP 400 with a body saying 404, so
  // `error.status` must not be mapped to a response status by any caller.
  if (error || !data) throw readFailed("signed read", error?.message ?? "no data");
  return data.signedUrl;
}

/**
 * The batch form. One storage call per screen rather than one per photo.
 *
 * PER-PATH FAILURES ARE REPORTED INLINE, NOT THROWN: the call returns 200 with
 * entries carrying `error` and a null URL. A key that could not be signed is
 * ABSENT from the returned map — never present with a broken value, so a caller
 * cannot render a dead image and call it evidence.
 *
 * Each entry carries both `signedURL` (server-relative) and `signedUrl`
 * (absolute). Only the second is usable.
 */
export async function createSignedReadUrls(
  bucket: string, keys: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (keys.length === 0) return out;
  const { data, error } = await storage(bucket)
    .createSignedUrls(keys, EVIDENCE_URL_TTL_SECONDS);
  if (error || !data) throw readFailed("signed read batch", error?.message ?? "no data");
  for (const entry of data) {
    if (entry.error || !entry.path || !entry.signedUrl) continue;
    out.set(entry.path, entry.signedUrl);
  }
  return out;
}

/**
 * The object as a stream, for the external plane's same-origin proxy.
 *
 * `download(key).asStream()` resolves to the raw `Response.body`; nothing is
 * buffered, unlike `downloadObject` above, which reads the whole object into a
 * `Uint8Array` because its one caller needs the bytes in hand to hash them.
 */
export async function openObjectStream(
  bucket: string, key: string,
): Promise<ReadableStream<Uint8Array>> {
  const { data, error } = await storage(bucket).download(key).asStream();
  if (error || !data) throw readFailed("stream", error?.message ?? "no data");
  return data as ReadableStream<Uint8Array>;
}
