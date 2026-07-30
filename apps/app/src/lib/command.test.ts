import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

vi.mock("./auth", () => ({ requireUser: async () => ({ userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }) }));
import { commandRoute, queryRoute } from "./command";

const echo = commandRoute(z.object({ name: z.string().min(1) }), async (a) => ({
  status: 200, body: { got: a.body.name, key: a.idempotencyKey, hash: a.requestHash.length },
}));

const mk = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://x/v1/echo", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });

describe("commandRoute", () => {
  it("rejects a missing Idempotency-Key with 422 VALIDATION_FAILED", async () => {
    const res = await echo(mk(JSON.stringify({ name: "x" })), { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDATION_FAILED");
  });
  it("rejects invalid JSON with 422", async () => {
    const res = await echo(mk("{oops", { "idempotency-key": "k" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
  });
  it("rejects a zod-failing body with 422 + fieldErrors", async () => {
    const res = await echo(mk(JSON.stringify({ name: "" }), { "idempotency-key": "k" }), { params: Promise.resolve({}) });
    const b = await res.json();
    expect(res.status).toBe(422);
    expect(b.fieldErrors.length).toBeGreaterThan(0);
  });
  it("passes body, key, and sha256 hash through on success", async () => {
    const res = await echo(mk(JSON.stringify({ name: "ok" }), { "idempotency-key": "k1" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ got: "ok", key: "k1", hash: 64 });
  });
  it("sets Idempotency-Replay-Until from expiresAt", async () => {
    const until = new Date("2027-01-01T00:00:00.000Z");
    const r = commandRoute(z.object({}), async () => ({ status: 201, body: {}, expiresAt: until }));
    const res = await r(mk("{}", { "idempotency-key": "k2" }), { params: Promise.resolve({}) });
    expect(res.headers.get("Idempotency-Replay-Until")).toBe(until.toISOString());
  });
});

describe("queryRoute", () => {
  it("authenticates and passes params", async () => {
    const q = queryRoute(async (a) => ({ status: 200, body: { id: a.params.id, user: a.userId } }));
    const res = await q(new Request("http://x/v1/things/42"), { params: Promise.resolve({ id: "42" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("42");
  });
});
