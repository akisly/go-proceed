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

    const url = await createSignedReadUrl(key, EVIDENCE_BUCKET);
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

    const map = await createSignedReadUrls([good, missing], EVIDENCE_BUCKET);
    expect(map.has(good)).toBe(true);
    expect(map.has(missing)).toBe(false);
    expect(map.get(good)).toMatch(/^http/);
  });

  it("throws instead of silently returning an empty map when every key in a batch fails", async () => {
    // A bucket that does not exist makes the storage API answer 200 with
    // EVERY entry carrying a per-path error — indistinguishable, entry by
    // entry, from "none of these objects exist yet". Measured against the
    // local stack: this is a real 200, not a thrown error, so the guard on
    // the outer `{ data, error }` never fires; only the "did we get anything
    // back" check does. This is the case fix-round-1 finding 3 covers: a
    // whole-batch failure (lost `select` grant, renamed bucket, …) must not
    // read the same as "this assignment truly has no photos".
    await expect(
      createSignedReadUrls([newEvidenceKey(), newEvidenceKey()], "does-not-exist-bucket"),
    ).rejects.toThrow();
  });

  it("carries the provider's error code so a caller can discriminate without parsing a message", async () => {
    // Measured against the local stack: a missing object answers HTTP 400 on
    // the wire with body `code: "NoSuchKey"`. `status` is 400 either way and
    // cannot tell "missing" apart from most other storage failures — `code`
    // can, which is the point of carrying it through instead of collapsing
    // every failure into one indistinguishable bare `Error`.
    const missing = `${randomUUID()}/${randomUUID()}`;
    await expect(createSignedReadUrl(missing, EVIDENCE_BUCKET)).rejects.toMatchObject({
      code: "NoSuchKey",
    });
  });

  it("streams without buffering, and never puts the key in the error", async () => {
    const key = newEvidenceKey();
    await putObject(key, JPEG, "image/jpeg");

    const stream = await openObjectStream(key, EVIDENCE_BUCKET);
    expect(stream).toBeInstanceOf(ReadableStream);
    const chunks: Uint8Array[] = [];
    for await (const c of stream as unknown as AsyncIterable<Uint8Array>) chunks.push(c);
    expect(Buffer.concat(chunks.map((c) => Buffer.from(c)))).toEqual(Buffer.from(JPEG));

    const gone = `${randomUUID()}/${randomUUID()}`;
    await expect(openObjectStream(gone, EVIDENCE_BUCKET)).rejects.toThrow(
      // The message must NOT carry the key — files-and-storage.md §Downloads.
      expect.objectContaining({ message: expect.not.stringContaining(gone) }) as Error,
    );

    // `gone` is a well-formed key the server has simply never seen, so its
    // failure text ("Object not found") never contained a key to begin with
    // — the assertion above would pass even if the wrapper relayed the
    // provider's message verbatim. Prove it actually strips the key by using
    // one the server's OWN name validator rejects and echoes back verbatim:
    // measured against the local stack, a key containing `<` answers HTTP 400
    // `InvalidKey` with `message: "Invalid key: <the raw key>"` — on BOTH the
    // sign and the download endpoint. This is fix-round-1 finding 1.
    const rejected = `${randomUUID()}/a<b`;
    await expect(openObjectStream(rejected, EVIDENCE_BUCKET)).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(rejected) }) as Error,
    );
  });
});
