import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  EVIDENCE_BUCKET, EVIDENCE_URL_TTL_SECONDS,
  putObject, newEvidenceKey,
  createSignedReadUrl, createSignedReadUrls, openObjectStream,
} from "../src/lib/evidence-storage";
import { withBucketAcceptingAnyType } from "./helpers/bucket";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9, 0x00]);

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

  it("signs URLs a browser downloads rather than renders: Content-Disposition attachment (BL-089)", async () => {
    // The member plane shows evidence in an <img>, which ignores
    // Content-Disposition. Opening the same URL as a page is what renders an
    // uploader-chosen type (an SVG with a script, stored as image/svg+xml) on
    // the Storage origin; `attachment` turns that navigation into a download.
    const key = newEvidenceKey();
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>');
    // Staged with the bucket's allow-list lifted: 0093 refuses this type at the
    // PUT, and this case pins the defence behind it for objects stored before.
    await withBucketAcceptingAnyType(() => putObject(key, svg, "image/svg+xml"));

    const single = await createSignedReadUrl(key, EVIDENCE_BUCKET);
    const { urls } = await createSignedReadUrls([key], EVIDENCE_BUCKET);
    for (const url of [single, urls.get(key)!]) {
      const res = await fetch(url);
      expect(res.status).toBe(200);
      // The positive control: the hostile type IS what Storage serves.
      expect(res.headers.get("content-type")).toBe("image/svg+xml");
      expect(res.headers.get("content-disposition") ?? "").toMatch(/^attachment\b/);
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(svg);
    }
  });

  it("omits a key it could not sign from `urls`, and reports it in `failedKeys` instead", async () => {
    const good = newEvidenceKey();
    await putObject(good, JPEG, "image/jpeg");
    const missing = `${randomUUID()}/${randomUUID()}`;

    const { urls, failedKeys } = await createSignedReadUrls([good, missing], EVIDENCE_BUCKET);
    expect(urls.has(good)).toBe(true);
    expect(urls.has(missing)).toBe(false);
    expect(urls.get(good)).toMatch(/^http/);
    expect(failedKeys).toEqual([missing]);
  });

  it("reports every key as failed, and throws nothing, when every key in a batch fails to sign", async () => {
    // A bucket that does not exist makes the storage API answer 200 with
    // EVERY entry carrying a per-path error — indistinguishable, entry by
    // entry, from "none of these objects exist yet". Measured against the
    // local stack: this is a real 200, not a thrown error, so the guard on
    // the outer `{ data, error }` never fires.
    //
    // SUPERSEDES fix-round-1 finding 3's remedy (throwing when the map came
    // back empty): for a bucket contributing exactly one key, "1 of 1 failed"
    // is indistinguishable from a wholesale failure, so that throw turned a
    // single vanished photo into a 500 for the whole assignment. The actual
    // requirement — a whole-batch failure (lost `select` grant, renamed
    // bucket, …) must not read the same as "this assignment truly has no
    // photos" — is met by every key coming back in `failedKeys` rather than
    // vanishing, not by an exception.
    const k1 = newEvidenceKey();
    const k2 = newEvidenceKey();
    const { urls, failedKeys } = await createSignedReadUrls([k1, k2], "does-not-exist-bucket");
    expect(urls.size).toBe(0);
    expect(failedKeys.sort()).toEqual([k1, k2].sort());
  });

  it("still throws on a genuine wholesale failure — the top-level SDK error, not a per-path one", async () => {
    // A per-path failure (the two cases above) is reported at HTTP 200 and
    // must never throw. What SHOULD still throw is the outer `{ error }` the
    // SDK returns for something that is not a per-object condition at all —
    // exercised here the same way `createSignedReadUrl`'s NoSuchKey case
    // proves the single form's error path, by giving the call something it
    // cannot even attempt: an empty bucket name is rejected by the storage
    // API before it gets anywhere near individual paths.
    await expect(
      createSignedReadUrls([newEvidenceKey()], ""),
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
