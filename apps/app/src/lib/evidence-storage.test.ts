import { describe, it, expect, vi, beforeEach } from "vitest";
import { inspect } from "node:util";

// A storage client whose calls fail the way the real server does for a key it
// refuses: a StorageApiError whose message carries the raw key. `mode` lets a
// case make the signed-upload step succeed, so `putObject`'s own upload
// branch is the one that throws (R1-01, S1-01), or give the provider a `code`
// that is not an identifier (S1-03).
const KEY = "0b8c3a3e-5d1f-4c55-9e0f-6a0d9d6b7c10/leak{secret-part}";
const mode = { signedUploadOk: false, code: "InvalidKey" as string };
vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/supabase-js")>();
  const fail = () => ({ data: null, error: new actual.StorageApiError(`Invalid key: ${KEY}`, 400, "400", "storage", mode.code) });
  const bucket = {
    createSignedUploadUrl: async () => (mode.signedUploadOk
      ? { data: { signedUrl: "http://x/upload", token: "t", path: KEY }, error: null } : fail()),
    uploadToSignedUrl: async () => fail(),
    download: (() => {
      const p = Promise.resolve(fail());
      return Object.assign(p, { asStream: async () => fail() });
    }),
    list: async () => fail(),
    remove: async () => fail(),
    createSignedUrl: async () => fail(),
    createSignedUrls: async () => fail(),
  };
  return { ...actual, createClient: () => ({ storage: { from: () => bucket } }) };
});

const storage = await import("./evidence-storage");
beforeEach(() => { mode.signedUploadOk = false; mode.code = "InvalidKey"; });

/** Everything a log line could print of the error: its message, its inspection (stack, fields, any cause) and its JSON. */
function everythingPrinted(err: unknown): string {
  return [(err as Error).message, inspect(err, { depth: null }), JSON.stringify(err)].join("\n");
}

describe("evidence storage errors carry no key and no provider message (BL-033)", () => {
  const calls: [string, string, () => Promise<unknown>][] = [
    ["createSignedUpload", "signed upload", () => storage.createSignedUpload(KEY)],
    ["downloadObject", "download", () => storage.downloadObject(KEY)],
    ["objectInfo", "list", () => storage.objectInfo(KEY, "evidence")],
    ["removeObject", "remove", () => storage.removeObject(KEY, "evidence")],
    ["createSignedReadUrl", "signed read", () => storage.createSignedReadUrl(KEY, "evidence")],
    ["createSignedReadUrls (a wholesale failure)", "signed read batch", () => storage.createSignedReadUrls([KEY], "evidence")],
    ["openObjectStream", "stream", () => storage.openObjectStream(KEY, "evidence")],
  ];
  for (const [name, op, call] of calls) {
    it(name, async () => {
      const err = await call().then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(storage.EvidenceStorageError);
      // Exact: proves which branch threw, and that neither the key nor the bucket is named.
      expect((err as Error).message).toBe(`storage: ${op} failed (InvalidKey) [400]`);
      const printed = everythingPrinted(err);
      expect(printed).not.toContain("secret-part");
      expect(printed).not.toContain(KEY.split("/")[0]!);
      expect(printed).not.toContain("Invalid key");
    });
  }

  it("putObject, failing at its own upload step", async () => {
    mode.signedUploadOk = true;
    const err = await storage.putObject(KEY, new Uint8Array([1]), "image/jpeg").then(() => null, (e: unknown) => e);
    expect((err as Error).message).toBe("storage: upload failed (InvalidKey) [400]");
    expect(everythingPrinted(err)).not.toContain("secret-part");
  });

  it("drops a provider code that is not an identifier, which could carry a key (S1-03)", async () => {
    mode.code = `x/${KEY}`;
    const err = await storage.downloadObject(KEY).then(() => null, (e: unknown) => e);
    expect((err as InstanceType<typeof storage.EvidenceStorageError>).code).toBeUndefined();
    expect((err as Error).message).toBe("storage: download failed [400] <StorageApiError>");
    expect(everythingPrinted(err)).not.toContain("secret-part");
  });
});
