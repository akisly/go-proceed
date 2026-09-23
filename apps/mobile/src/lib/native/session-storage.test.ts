import { describe, expect, it } from "vitest";
import { createSessionStorage } from "./session-storage";

function fixture() {
  const values = new Map<string, string>();
  let failWrite = false;
  const events: string[] = [];
  const storage = createSessionStorage({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { if (failWrite && !key.endsWith("manifest")) throw Error("disk"); values.set(key, value); },
    removeItem: async (key) => { events.push("remove"); values.delete(key); },
  }, async () => { events.push("quarantine"); });
  return { values, events, storage, fail: () => { failWrite = true; } };
}
const session = (id: string, metadata = "") => JSON.stringify({ user: { id, metadata }, access_token: "token" });

describe("protected session persistence", () => {
  it("round-trips large Unicode sessions through bounded SecureStore values", async () => {
    const f = fixture();
    const value = session("one", "ї😀".repeat(4000));
    await f.storage.setItem("auth", value);
    expect(await f.storage.getItem("auth")).toBe(value);
    expect([...f.values.values()].every((v) => new TextEncoder().encode(v).length < 2048)).toBe(true);
  });
  it("keeps the old committed session if a new generation write fails", async () => {
    const f = fixture(); await f.storage.setItem("auth", session("one")); f.fail();
    await expect(f.storage.setItem("auth", session("one", "refreshed"))).rejects.toThrow();
    expect(await f.storage.getItem("auth")).toBe(session("one"));
  });
  it("quarantines before replacing a subject or removing auth", async () => {
    const f = fixture(); await f.storage.setItem("auth", session("one")); f.events.length = 0;
    await f.storage.setItem("auth", session("two")); expect(f.events[0]).toBe("quarantine");
    f.events.length = 0; await f.storage.removeItem("auth");
    expect(f.events[0]).toBe("quarantine"); expect(await f.storage.getItem("auth")).toBeNull();
  });
  it("fails closed when quarantine fails", async () => {
    const f = fixture(); await f.storage.setItem("auth", session("one"));
    const guarded = createSessionStorage({
      getItem: async (key) => f.values.get(key) ?? null,
      setItem: async (key, value) => { f.values.set(key, value); },
      removeItem: async (key) => { f.values.delete(key); },
    }, async () => { throw Error("journal locked"); });
    await expect(guarded.removeItem("auth")).rejects.toThrow("journal locked");
    expect(await guarded.getItem("auth")).toBe(session("one"));
  });
});
