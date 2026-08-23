import { randomUUID } from "node:crypto";
import { createClient, StorageApiError, type SupabaseClient } from "@supabase/supabase-js";

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
 * NO KEY, AND NO PROVIDER MESSAGE, IN ANY ERROR THROWN FROM HERE DOWN.
 *
 * The functions above this line interpolate the storage key into their errors,
 * which reach `console.error` through `toProblemResponse`'s unmapped branch —
 * against `files-and-storage.md`'s «Logs record the domain object and
 * authorization result, never the signed URL or raw storage key». That is a
 * recorded defect (TODOS.md) and deliberately NOT the style copied here.
 *
 * Relaying the provider's own `error.message` verbatim is not a safe
 * substitute for interpolating the key ourselves — the message can carry the
 * key too. Measured against the local stack on 2026-08-22: signing
 * (`POST .../object/sign/evidence/…`) *and* downloading
 * (`GET .../object/evidence/…`) a key containing a character the storage
 * server's name validator rejects (one of `{ } < > # % [ ] | \ ^ "` or a
 * backtick) both answer HTTP 400 with
 * `{"code":"InvalidKey","message":"Invalid key: <the raw key>"}` — the key,
 * verbatim, in the message. Every key this codebase issues is
 * `newEvidenceKey()`, two uuids, which always validates, so this path is not
 * reachable today through this file's own callers; it becomes reachable the
 * day a key stops being a uuid pair, or a caller outside this file passes one
 * through, and the guarantee has to hold then too — not only for the keys
 * this file currently chooses to mint.
 *
 * So nothing below relays `error.message`. `readFailed` carries forward only
 * `error.code` — a closed, provider-defined enum (`NoSuchKey`, `NoSuchBucket`,
 * `InvalidKey`, … see
 * https://supabase.com/docs/guides/storage/debugging/error-codes) — and
 * `error.status`. A code is an enum member and cannot contain a key; a status
 * is a number and cannot either. `code` is also the discriminator a caller
 * should branch on instead of parsing text: see the NOTE on
 * `createSignedReadUrl` for why `status` alone is not enough to tell a
 * missing object from most other storage failures.
 */
export class EvidenceStorageError extends Error {
  /** The storage API's own error code (`NoSuchKey`, `InvalidKey`, …). Undefined for a failure that never reached the API (e.g. a network error). */
  readonly code: string | undefined;
  /** The HTTP status the provider answered with, when there was one. */
  readonly status: number | undefined;

  constructor(what: string, code: string | undefined, status: number | undefined) {
    super(`storage: ${what} failed${code ? ` (${code})` : ""}`);
    this.name = "EvidenceStorageError";
    this.code = code;
    this.status = status;
  }
}

function readFailed(what: string, error: unknown): Error {
  const code = error instanceof StorageApiError ? error.code : undefined;
  const status = error instanceof Error && "status" in error
    ? (error as { status?: number }).status
    : undefined;
  return new EvidenceStorageError(what, code, status);
}

/** A short-lived read grant for exactly one object. `bucket` is required and never defaulted: the caller's `evidence_objects` row names its own bucket, and a caller must not be able to silently fall back to a constant. */
export async function createSignedReadUrl(key: string, bucket: string): Promise<string> {
  const { data, error } = await storage(bucket)
    .createSignedUrl(key, EVIDENCE_URL_TTL_SECONDS);
  // NOTE: a missing object arrives as HTTP 400 with a body saying 404 (code
  // `NoSuchKey`), so `error.status` must not be mapped to a response status by
  // any caller — branch on `EvidenceStorageError.code` instead.
  if (error || !data) throw readFailed("signed read", error);
  return data.signedUrl;
}

/**
 * What the batch form returns: the keys that signed, and the keys that
 * didn't. Never a throw for a per-object condition — see the function's own
 * comment for why that was tried and superseded.
 */
export interface SignedReadUrls {
  /** Key -> absolute signed URL, for every key that signed successfully. */
  urls: Map<string, string>;
  /**
   * Keys present in the request that could NOT be signed — a purged object, a
   * revoked read grant on that one row, .... Carried as keys, same as the
   * input; not a message, so nothing here needs the log-safety of
   * `EvidenceStorageError`. A caller renders one row per input key regardless
   * of which list it landed in, with `readUrl` present or absent — this array
   * exists so a caller CAN count or reason about failures without having to
   * diff `urls` against its own input list.
   */
  failedKeys: string[];
}

/**
 * The batch form. One storage call per screen rather than one per photo.
 *
 * PER-PATH FAILURE IS REPORTED, NEVER THROWN — for one key or for every key in
 * the batch alike. This function used to throw when `out.size === 0`
 * (fix-round-1's remedy for the finding below), and that was the wrong fix
 * for a right diagnosis: for a bucket contributing exactly one key — the modal
 * shape at pilot start — "1 of 1 failed" is indistinguishable from a wholesale
 * failure, so an assignment with ONE photo whose object vanished out of band
 * turned the THROW into a 500 that killed the whole assignment's read, which
 * is a worse failure than the one being guarded against. The actual danger —
 * a service key that lost `select` on `storage.objects`, or a renamed bucket,
 * silently reading as "this assignment has no photos" — is closed by NEVER
 * being silent, not by throwing: every key the caller asked to sign comes back
 * in exactly one of `urls` or `failedKeys`, so the caller (the evidence route)
 * emits a row per evidence object either way, with `readUrl` present or
 * absent. A screen rendering ten rows each saying "недоступне" is the correct
 * shape for a wholesale failure; a screen dying is not.
 *
 * Each entry carries both `signedURL` (server-relative) and `signedUrl`
 * (absolute). Only the second is usable. `entry.path` echoes the REQUESTED
 * path on both success and failure — measured against the local stack: a
 * mixed batch of one real key and one that does not exist returns the failed
 * entry with `path` still set to the key that was asked for, `error` a string,
 * and `signedURL`/`signedUrl` both null. That is what makes `failedKeys`
 * buildable at all; the `!entry.path` branch below is a defensive fallback for
 * a shape the API does not appear to produce, not the expected case.
 *
 * A GENUINE WHOLESALE FAILURE STILL THROWS: the top-level `{ error }` from the
 * SDK call itself (auth, network, a malformed request) is not a per-object
 * condition and carries no keys to report per-row, so `readFailed` still
 * fires on it, unchanged from before.
 */
export async function createSignedReadUrls(
  keys: string[], bucket: string,
): Promise<SignedReadUrls> {
  const urls = new Map<string, string>();
  const failedKeys: string[] = [];
  if (keys.length === 0) return { urls, failedKeys };
  const { data, error } = await storage(bucket)
    .createSignedUrls(keys, EVIDENCE_URL_TTL_SECONDS);
  if (error || !data) throw readFailed("signed read batch", error);
  for (const entry of data) {
    if (entry.error || !entry.signedUrl) {
      if (entry.path) failedKeys.push(entry.path);
      continue;
    }
    if (!entry.path) continue;
    urls.set(entry.path, entry.signedUrl);
  }
  return { urls, failedKeys };
}

/**
 * The object as a stream, for the external plane's same-origin proxy.
 *
 * `download(key).asStream()` resolves to the raw `Response.body`; nothing is
 * buffered, unlike `downloadObject` above, which reads the whole object into a
 * `Uint8Array` because its one caller needs the bytes in hand to hash them.
 *
 * The caller owns the returned stream and must consume it fully or call
 * `cancel()` on it; this function takes no `AbortSignal` of its own —
 * `download()` accepts one via its `parameters` argument, but wiring a
 * client's abort through to it belongs with the same-origin proxy route that
 * is this function's one caller, not here.
 */
export async function openObjectStream(
  key: string, bucket: string,
): Promise<ReadableStream<Uint8Array>> {
  const { data, error } = await storage(bucket).download(key).asStream();
  if (error || !data) throw readFailed("stream", error);
  return data as ReadableStream<Uint8Array>;
}
