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
  // DEV-022 / BL-112: the hash a handler receives binds the path target, so a
  // key reused with the same body on another target cannot replay the first.
  it("gives the same body on two targets two request hashes", async () => {
    const seen: string[] = [];
    const route = commandRoute(z.object({}).strict(), async (a) => {
      seen.push(a.requestHash);
      return { status: 200, body: {} };
    });
    const req = () => new Request("http://x/v1/items/x/archive",
      { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "k" }, body: "{}" });
    await route(req(), { params: Promise.resolve({ itemId: "0f0e0d0c-0b0a-4000-8000-000000000001" }) });
    await route(req(), { params: Promise.resolve({ itemId: "0f0e0d0c-0b0a-4000-8000-000000000002" }) });
    await route(req(), { params: Promise.resolve({ itemId: "0F0E0D0C-0B0A-4000-8000-000000000001" }) });
    expect(seen).toHaveLength(3);
    expect(seen[0]).not.toBe(seen[1]);
    expect(seen[2]).toBe(seen[0]);
    expect(seen[0]).toMatch(/^[0-9a-f]{64}$/);
  });

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

  /**
   * THE `path` STRING IS THE USER-VISIBLE HALF OF A 422 and, until the zod 4
   * upgrade on 2026-08-24, nothing pinned its SHAPE — only that `fieldErrors`
   * was non-empty. `commandRoute` builds it with `i.path.join(".")` over
   * `parsed.error.issues`, and zod 4 «dramatically streamlined» the issue
   * types, so this is precisely the kind of thing a library bump can reshape
   * without a single type error and without a red test.
   *
   * It did NOT change: `issue.path` is still an ordered array of keys
   * (`zod/v4/core/errors.d.ts:9` declares `readonly path: PropertyKey[]`), and
   * an array index is still a NUMBER in that array, so a nested field comes
   * out `items.1.qty` exactly as it did under zod 3. This test is the record
   * of that, and the guard for the next bump — a Ukrainian-speaking caller
   * reads this string to find the field they have to correct.
   */
  it("names the failing field by its dotted path, array indices included", async () => {
    const nested = commandRoute(
      z.object({ items: z.array(z.object({ qty: z.number().int().positive() })) }),
      async () => ({ status: 200, body: {} }),
    );
    const res = await nested(
      mk(JSON.stringify({ items: [{ qty: 1 }, { qty: -3 }] }), { "idempotency-key": "k" }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(422);
    const b = await res.json();
    expect(b.fieldErrors.map((f: { path: string }) => f.path)).toEqual(["items.1.qty"]);
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

  // `HandlerResult.headers` shipped bound to `queryRoute` only, while its doc
  // comment sat on the interface BOTH wrappers return and read as though it
  // governed both. A command route setting a `Location`, a `Retry-After` or a
  // cache directive served none of them, silently.
  describe("headers channel", () => {
    it("passes a handler's headers through to the response", async () => {
      const r = commandRoute(z.object({}), async () => ({
        status: 201, body: {}, headers: { "cache-control": "no-store", "retry-after": "30" },
      }));
      const res = await r(mk("{}", { "idempotency-key": "k3" }), { params: Promise.resolve({}) });
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("retry-after")).toBe("30");
      expect(res.headers.get("content-type")).toBe("application/json");
    });

    it("sends no such header when the handler asks for none", async () => {
      const r = commandRoute(z.object({}), async () => ({ status: 201, body: {} }));
      const res = await r(mk("{}", { "idempotency-key": "k4" }), { params: Promise.resolve({}) });
      expect(res.headers.get("cache-control")).toBeNull();
    });

    // The wrapper's own idempotency statement is not a handler's to rewrite:
    // `expiresAt` is applied AFTER the spread, so a handler naming the same
    // header loses. Asserted rather than assumed, because the spread order is
    // one line and reversing it is a silent change.
    it("does not let a handler overwrite Idempotency-Replay-Until", async () => {
      const until = new Date("2027-01-01T00:00:00.000Z");
      const r = commandRoute(z.object({}), async () => ({
        status: 201, body: {}, expiresAt: until,
        headers: { "Idempotency-Replay-Until": "1999-01-01T00:00:00.000Z" },
      }));
      const res = await r(mk("{}", { "idempotency-key": "k5" }), { params: Promise.resolve({}) });
      expect(res.headers.get("Idempotency-Replay-Until")).toBe(until.toISOString());
    });
  });
});

describe("queryRoute", () => {
  it("authenticates and passes params", async () => {
    const q = queryRoute(async (a) => ({ status: 200, body: { id: a.params.id, user: a.userId } }));
    const res = await q(new Request("http://x/v1/things/42"), { params: Promise.resolve({ id: "42" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("42");
  });

  describe("headers channel", () => {
    it("passes a handler's headers through to the response", async () => {
      const REQ_ID = "0123456789abcdef";
      const req = new Request("http://x/v1/thing", { headers: { "x-request-id": REQ_ID } });
      const route = queryRoute(async () => ({
        status: 200, body: { ok: true }, headers: { "cache-control": "no-store" },
      }));
      const res = await route(req, { params: Promise.resolve({}) });
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("content-type")).toBe("application/json");
      expect(res.headers.get("x-request-id")).toBe(REQ_ID);
    });

    it("sends no cache directive when the handler asks for none", async () => {
      const req = new Request("http://x/v1/thing");
      const route = queryRoute(async () => ({ status: 200, body: {} }));
      const res = await route(req, { params: Promise.resolve({}) });
      expect(res.headers.get("cache-control")).toBeNull();
    });
  });
});
