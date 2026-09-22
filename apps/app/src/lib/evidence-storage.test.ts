import { describe, it, expect, vi } from "vitest";

// A storage client whose every call fails the way the real server does for a
// key it refuses: a StorageApiError whose message carries the raw key.
const KEY = "0b8c3a3e-5d1f-4c55-9e0f-6a0d9d6b7c10/leak{secret-part}";
vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/supabase-js")>();
  const fail = () => ({ data: null, error: new actual.StorageApiError(`Invalid key: ${KEY}`, 400, "400", "storage", "InvalidKey") });
  const bucket = {
    createSignedUploadUrl: async () => fail(),
    uploadToSignedUrl: async () => fail(),
    download: async () => fail(),
    list: async () => fail(),
    remove: async () => fail(),
  };
  return { ...actual, createClient: () => ({ storage: { from: () => bucket } }) };
});

const storage = await import("./evidence-storage");

describe("evidence storage errors carry no key and no provider message (BL-033)", () => {
  const calls: [string, () => Promise<unknown>][] = [
    ["createSignedUpload", () => storage.createSignedUpload(KEY)],
    ["putObject", () => storage.putObject(KEY, new Uint8Array([1]), "image/jpeg")],
    ["downloadObject", () => storage.downloadObject(KEY)],
    ["objectInfo", () => storage.objectInfo(KEY, "evidence")],
    ["removeObject", () => storage.removeObject(KEY, "evidence")],
  ];
  for (const [name, call] of calls) {
    it(name, async () => {
      const err = await call().then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(storage.EvidenceStorageError);
      const message = (err as Error).message;
      expect(message).not.toContain("secret-part");
      expect(message).not.toContain(KEY.split("/")[0]!);
      expect(message).not.toContain("Invalid key");
      expect((err as InstanceType<typeof storage.EvidenceStorageError>).code).toBe("InvalidKey");
      expect((err as InstanceType<typeof storage.EvidenceStorageError>).status).toBe(400);
    });
  }
});
