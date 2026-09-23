import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { inspect } from "node:util";
import {
  EVIDENCE_BUCKET, newEvidenceKey, createSignedUpload, putObject,
  downloadObject, objectExists, removeObject, EvidenceStorageError,
} from "../src/lib/evidence-storage";

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
    await putObject(key, payload, "text/plain");

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
      .uploadToSignedUrl(key, token, bytes("від клієнта"), { contentType: "text/plain" });
    expect(error).toBeNull();

    expect(Buffer.from(await downloadObject(key)).toString()).toBe("від клієнта");
  });

  it("removes an object, and removing an absent key is not an error", async () => {
    const key = newEvidenceKey();
    await putObject(key, bytes("тимчасово"), "text/plain");
    expect(await objectExists(key)).toBe(true);

    await removeObject(key);
    expect(await objectExists(key)).toBe(false);
    await expect(removeObject(key)).resolves.toBeUndefined();
  });
});

describe("the bucket is genuinely private", () => {
  it("denies an anonymous client both download and listing", async () => {
    // The assertion that matters: without this the bucket is only undocumented,
    // not private.
    const key = newEvidenceKey();
    await putObject(key, bytes("секрет"), "text/plain");

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
    await putObject(key, bytes("секрет"), "text/plain");

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
