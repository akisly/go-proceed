import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  EVIDENCE_BUCKET, EVIDENCE_URL_TTL_SECONDS,
  putObject, newEvidenceKey,
  createSignedReadUrl, createSignedReadUrls, openObjectStream,
} from "../src/lib/evidence-storage";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

describe("evidence storage: read access", () => {
  it("signs a URL that actually serves the bytes, and expires in 60 seconds", async () => {
    const key = newEvidenceKey();
    await putObject(key, JPEG, "image/jpeg");

    const url = await createSignedReadUrl(EVIDENCE_BUCKET, key);
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);

    // The TTL is OURS: the storage server enforces only `expiresIn >= 1`.
    // Decode the token rather than trusting the constant.
    const token = new URL(url).searchParams.get("token")!;
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"),
    ) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(EVIDENCE_URL_TTL_SECONDS);
    expect(EVIDENCE_URL_TTL_SECONDS).toBeLessThanOrEqual(60);
  });

  it("omits a key it could not sign instead of returning a broken URL", async () => {
    const good = newEvidenceKey();
    await putObject(good, JPEG, "image/jpeg");
    const missing = `${randomUUID()}/${randomUUID()}`;

    const map = await createSignedReadUrls(EVIDENCE_BUCKET, [good, missing]);
    expect(map.has(good)).toBe(true);
    expect(map.has(missing)).toBe(false);
    expect(map.get(good)).toMatch(/^http/);
  });

  it("streams without buffering, and never puts the key in the error", async () => {
    const key = newEvidenceKey();
    await putObject(key, JPEG, "image/jpeg");

    const stream = await openObjectStream(EVIDENCE_BUCKET, key);
    expect(stream).toBeInstanceOf(ReadableStream);
    const chunks: Uint8Array[] = [];
    for await (const c of stream as unknown as AsyncIterable<Uint8Array>) chunks.push(c);
    expect(Buffer.concat(chunks.map((c) => Buffer.from(c)))).toEqual(Buffer.from(JPEG));

    const gone = `${randomUUID()}/${randomUUID()}`;
    await expect(openObjectStream(EVIDENCE_BUCKET, gone)).rejects.toThrow(
      // The message must NOT carry the key — files-and-storage.md §Downloads.
      expect.objectContaining({ message: expect.not.stringContaining(gone) }) as Error,
    );
  });
});
