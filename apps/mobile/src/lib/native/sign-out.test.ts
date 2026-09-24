import { describe, expect, it } from "vitest";
import { createClient, processLock } from "@supabase/supabase-js";
import { createSessionStorage } from "./session-storage";
import { defaultAuthStorageKey, signOutLocally } from "./sign-out";

const URL_ = "https://abcdefghijklmnopqrst.supabase.co";
const KEY = defaultAuthStorageKey(URL_);
const KEYS = [KEY, `${KEY}-user`, `${KEY}-code-verifier`];

function stored(expiresInSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({ access_token: "header.payload.signature", refresh_token: "refresh", token_type: "bearer",
    expires_in: expiresInSeconds, expires_at: now + expiresInSeconds, user: { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated" } });
}

/** A real supabase-js client over the app's storage adapter, with a scripted network. */
async function world(options: { fetch: typeof fetch; expiresIn?: number; boundary?: () => Promise<void> }) {
  const values = new Map<string, string>();
  const events: string[] = [];
  const raw = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
  const storage = createSessionStorage(raw, options.boundary ?? (async () => { events.push("quarantine"); }));
  await storage.setItem(KEY, stored(options.expiresIn ?? 3600));
  events.length = 0;
  const client = createClient(URL_, "sb_publishable_test", {
    auth: { storage, storageKey: KEY, lock: processLock, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
    global: { fetch: options.fetch },
  });
  client.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") events.push("SIGNED_OUT"); });
  return { client, storage, events };
}
const offline = (async () => { throw new TypeError("Network request failed"); }) as typeof fetch;
const hanging = (() => new Promise<Response>(() => {})) as typeof fetch;
const online = (async () => new Response(null, { status: 204 })) as typeof fetch;

describe("local sign-out", () => {
  it("pins exactly supabase-js's default storage key", () => {
    const unpinned = createClient(URL_, "sb_publishable_test", { auth: { persistSession: false } });
    expect((unpinned.auth as unknown as { storageKey: string }).storageKey).toBe(KEY);
  });
  it("online: the library removes the session, after the identity boundary", async () => {
    const w = await world({ fetch: online });
    await signOutLocally({ auth: w.client.auth, storage: w.storage, key: KEY, keys: KEYS });
    expect(await w.storage.getItem(KEY)).toBeNull();
    expect(w.events[0]).toBe("quarantine");
    expect(w.events).toContain("SIGNED_OUT");
  });
  it("offline with a valid token: signed out, not reported as a failure", async () => {
    const w = await world({ fetch: offline });
    await expect(signOutLocally({ auth: w.client.auth, storage: w.storage, key: KEY, keys: KEYS })).resolves.toBeUndefined();
    expect(await w.storage.getItem(KEY)).toBeNull();
    expect(w.events[0]).toBe("quarantine");
  });
  it("offline with an expired token: removed here, after the identity boundary", async () => {
    const w = await world({ fetch: offline, expiresIn: -60 });
    await signOutLocally({ auth: w.client.auth, storage: w.storage, key: KEY, keys: KEYS, waitMs: 200 });
    expect(await w.storage.getItem(KEY)).toBeNull();
    expect(w.events[0]).toBe("quarantine");
    // auth-js keeps retrying the refresh under its lock (up to ~30 s), so SIGNED_OUT may
    // not arrive in time; the runtime clears its own state instead of waiting for it.
  });
  it("a request that never answers does not keep the user signed in", async () => {
    const w = await world({ fetch: hanging });
    const started = Date.now();
    await signOutLocally({ auth: w.client.auth, storage: w.storage, key: KEY, keys: KEYS, waitMs: 100 });
    expect(await w.storage.getItem(KEY)).toBeNull();
    expect(Date.now() - started).toBeLessThan(2_000);
  });
  it("a refresh that lands after the sign-out does not bring the session back", async () => {
    const w = await world({ fetch: offline });
    await signOutLocally({ auth: w.client.auth, storage: w.storage, key: KEY, keys: KEYS });
    // What auth-js's in-flight refresh would do once its lock is released.
    await expect(w.storage.setItem(KEY, stored(3600))).rejects.toThrow("SIGNED_OUT");
    expect(await w.storage.getItem(KEY)).toBeNull();
  });
  it("keeps the session when unsent photos could not be locked first", async () => {
    let locked = false;
    const w = await world({ fetch: offline, boundary: async () => { if (locked) throw new Error("journal locked"); } });
    locked = true;
    await expect(signOutLocally({ auth: w.client.auth, storage: w.storage, key: KEY, keys: KEYS })).rejects.toThrow();
    expect(await w.storage.getItem(KEY)).not.toBeNull();
  });
});
