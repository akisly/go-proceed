import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { inspect } from "node:util";
import {
  EVIDENCE_BUCKET, newEvidenceKey, createSignedUpload, putObject,
  downloadObject, objectExists, objectInfo, removeObject, EvidenceStorageError,
} from "../src/lib/evidence-storage";
import { q } from "./helpers/fixtures";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("evidence storage keys", () => {
  it("issues opaque two-uuid keys that never repeat", () => {
    const a = newEvidenceKey();
    const b = newEvidenceKey();
    expect(a).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });

  it("carries no business identifier", () => {
    // Keys must not leak filenames, workspace names or contract numbers.
    const key = newEvidenceKey();
    for (const leak of ["кошторис", "Приклад", "Д-2026", ".csv", ".jpg"]) {
      expect(key).not.toContain(leak);
    }
  });
});

describe("evidence bucket round trip", () => {
  it("stores and returns bytes unchanged", async () => {
    const key = newEvidenceKey();
    const payload = bytes("Приклад-доказ");
    await putObject(key, payload, "image/jpeg");

    const back = await downloadObject(key);
    expect(Buffer.from(back).equals(Buffer.from(payload))).toBe(true);
  });

  it("issues a signed upload that a client can use without credentials", async () => {
    const key = newEvidenceKey();
    const { signedUrl, token } = await createSignedUpload(key);
    expect(signedUrl).toContain(EVIDENCE_BUCKET);
    expect(token).toBeTruthy();

    // The token-bearing client holds no service key.
    const anon = createClient(SUPABASE_URL, PUBLISHABLE,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await anon.storage.from(EVIDENCE_BUCKET)
      .uploadToSignedUrl(key, token, bytes("від клієнта"), { contentType: "image/jpeg" });
    expect(error).toBeNull();

    expect(Buffer.from(await downloadObject(key)).toString()).toBe("від клієнта");
  });

  it("removes an object, and removing an absent key is not an error", async () => {
    const key = newEvidenceKey();
    await putObject(key, bytes("тимчасово"), "image/jpeg");
    expect(await objectExists(key)).toBe(true);

    await removeObject(key);
    expect(await objectExists(key)).toBe(false);
    await expect(removeObject(key)).resolves.toBeUndefined();
  });
});

describe("the evidence bucket takes only the four evidence types (BL-126)", () => {
  // Every other layer checks the type after the bytes are stored (DEV-032:
  // finalize requires the stored type to equal the detected one). The bucket's
  // allow-list refuses the rest at the door, so a hostile type is never stored.
  // Measured on the local storage-api v1.69.0: the match is exact and
  // case-sensitive, and a type with parameters is refused
  // (`scratchpad/dev040-mime-probe.txt`).
  const ALLOWED = ["application/pdf", "image/heic", "image/jpeg", "image/png"];

  it("is configured with exactly the four types the upload grant accepts", async () => {
    const rows = await q<{ allowed_mime_types: string[] | null }>(
      "select allowed_mime_types from storage.buckets where id = $1", [EVIDENCE_BUCKET]);
    expect([...(rows[0]?.allowed_mime_types ?? [])].sort()).toEqual(ALLOWED);
  });

  it("stores each of the four", async () => {
    for (const type of ALLOWED) {
      const key = newEvidenceKey();
      await putObject(key, bytes("доказ"), type);
      expect(await objectInfo(key, EVIDENCE_BUCKET)).toEqual({ size: 5 * 2, contentType: type });
      await removeObject(key);
    }
  });

  it.each([
    "text/html", "TEXT/HTML", "image/svg+xml", "text/plain", "application/octet-stream",
    "image/webp", "IMAGE/JPEG", "image/jpeg; charset=binary", "image/jpeg;x=1, TEXT/HTML",
  ])("refuses %s, through the helper and through the client's own signed URL", async (type) => {
    const key = newEvidenceKey();
    const err = await putObject(key, bytes("<html>"), type).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(EvidenceStorageError);
    // storage-js reports the refusal as code InvalidMimeType, status 400; the
    // raw response body says 415 invalid_mime_type (the probe, and below).
    expect((err as Error).message).toBe("storage: upload failed (InvalidMimeType) [400]");
    expect(await objectInfo(key, EVIDENCE_BUCKET)).toBeNull();

    const other = newEvidenceKey();
    const { signedUrl } = await createSignedUpload(other);
    const res = await fetch(signedUrl, { method: "PUT", headers: { "content-type": type }, body: bytes("<html>") });
    expect(res.ok).toBe(false);
    expect(await res.text()).toMatch(/invalid_mime_type|not supported/);
    expect(await objectInfo(other, EVIDENCE_BUCKET)).toBeNull();
  });
});

describe("the allow-list holds on every upload shape a signed token opens (BL-126, DEV-040 S1-02)", () => {
  // `putObject` and the field client send a raw body. Storage also takes a
  // multipart form on the same signed URL, where the type comes from the file
  // part or a `contentType` field, and a TUS resumable upload. Measured on the
  // local storage API v1.69.0 (`scratchpad/dev040-s1-02-probe.txt`).
  const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });

  it.each([
    ["a file part typed text/html", (fd: FormData) => fd.append("", new Blob(["<html>"], { type: "text/html" }), "x")],
    ["an image/jpeg part with a contentType field of text/html",
      (fd: FormData) => { fd.append("contentType", "text/html"); fd.append("", jpeg(), "x"); }],
    ["a file part with no type", (fd: FormData) => fd.append("", new Blob(["<html>"]), "x")],
  ])("refuses a multipart upload with %s", async (_label, build) => {
    const key = newEvidenceKey();
    const { signedUrl } = await createSignedUpload(key);
    const fd = new FormData();
    build(fd);
    const res = await fetch(signedUrl, { method: "PUT", body: fd });
    expect(res.ok).toBe(false);
    expect(await res.text()).toMatch(/invalid_mime_type/);
    expect(await objectInfo(key, EVIDENCE_BUCKET)).toBeNull();
  });

  it("stores a multipart upload of an allowed type (the positive control)", async () => {
    const key = newEvidenceKey();
    const { signedUrl } = await createSignedUpload(key);
    const fd = new FormData();
    fd.append("", jpeg(), "x");
    const res = await fetch(signedUrl, { method: "PUT", body: fd });
    expect(res.status).toBe(200);
    expect((await objectInfo(key, EVIDENCE_BUCKET))?.contentType).toBe("image/jpeg");
    await removeObject(key);
  });

  it("refuses a TUS resumable upload declaring a disallowed type", async () => {
    const key = newEvidenceKey();
    const { signedUrl } = await createSignedUpload(key);
    const token = new URL(signedUrl).searchParams.get("token")!;
    const meta = (o: Record<string, string>) => Object.entries(o)
      .map(([k, v]) => `${k} ${Buffer.from(v).toString("base64")}`).join(",");
    const create = (contentType: string) => fetch(`${SUPABASE_URL}/storage/v1/upload/resumable/sign`, {
      method: "POST",
      headers: {
        "tus-resumable": "1.0.0", "upload-length": "4", "x-signature": token,
        "upload-metadata": meta({ bucketName: EVIDENCE_BUCKET, objectName: key, contentType }),
      },
    });
    const refused = await create("text/html");
    expect(refused.status).toBe(415);
    expect(await refused.text()).toMatch(/not supported/);
    // The positive control: the same request shape with an allowed type is taken.
    const allowed = await create("image/jpeg");
    expect(allowed.status).toBe(201);
    expect(await objectInfo(key, EVIDENCE_BUCKET)).toBeNull();
  });
});

describe("the bucket is genuinely private", () => {
  it("denies an anonymous client both download and listing", async () => {
    // The assertion that matters: without this the bucket is only undocumented,
    // not private.
    const key = newEvidenceKey();
    await putObject(key, bytes("секрет"), "image/jpeg");

    const anon = createClient(SUPABASE_URL, PUBLISHABLE,
      { auth: { persistSession: false, autoRefreshToken: false } });

    const download = await anon.storage.from(EVIDENCE_BUCKET).download(key);
    expect(download.error).not.toBeNull();

    const list = await anon.storage.from(EVIDENCE_BUCKET).list();
    expect(list.error === null ? list.data : []).toEqual([]);

    await removeObject(key);
  });

  it("serves no public URL that resolves", async () => {
    const key = newEvidenceKey();
    await putObject(key, bytes("секрет"), "image/jpeg");

    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/${EVIDENCE_BUCKET}/${key}`);
    expect(res.ok).toBe(false);

    await removeObject(key);
  });
});

describe("evidence storage errors carry no key (BL-033)", () => {
  // Measured on the local stack: downloading a key the storage server's name
  // validator refuses answers «Invalid key: <the raw key>». A bare Error that
  // relays that message reaches the log verbatim through `toProblemResponse`,
  // against `files-and-storage.md` §Downloads. The other functions' failures
  // are pinned in `src/lib/evidence-storage.test.ts`, with a fake client.
  it("for a download of a key the server refuses, whose own message names it", async () => {
    const bad = `${randomUUID()}/leak{${randomUUID()}}`;
    // The positive control: the server's own message does name the key.
    const raw = await createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz",
      { auth: { persistSession: false } }).storage.from(EVIDENCE_BUCKET).download(bad);
    expect(raw.error?.message).toContain(bad);
    const err = await downloadObject(bad).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(EvidenceStorageError);
    expect((err as EvidenceStorageError).code).toBe("InvalidKey");
    expect((err as Error).message).not.toContain(bad.split("/")[1]!);
    // Everything a log line could print: the message, its inspection, its JSON (DEV-034 Q1-03).
    const printed = [(err as Error).message, inspect(err, { depth: null }), JSON.stringify(err)].join("\n");
    for (const half of bad.split("/")) expect(printed).not.toContain(half);
    expect(printed).not.toContain("Invalid key");
  });
});
