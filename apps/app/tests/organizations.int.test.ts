import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
// Must match the route's own import specifier exactly ("../../../src/lib/auth"
// relative to apps/app/app/v1/organizations/route.ts, i.e. apps/app/src/lib/auth
// with no extension) so this mock actually intercepts.
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: A }) }));

// Atomicity proof: force a failure late in the transaction (after
// organizations/memberships/legal_entities/audit_events have all been
// inserted, but before commit) and verify the whole transaction rolls back.
// Toggled per-test via forceOutboxFailure; real enqueueOutbox otherwise.
const state = { forceOutboxFailure: false };
vi.mock("@aktflow/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aktflow/database")>();
  return {
    ...actual,
    enqueueOutbox: async (...args: Parameters<typeof actual.enqueueOutbox>) => {
      if (state.forceOutboxFailure) throw new Error("forced failure for atomicity test");
      return actual.enqueueOutbox(...args);
    },
  };
});

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
async function count(sql: string, p: unknown[]): Promise<number> {
  const c = new Client({ connectionString: admin }); await c.connect();
  const r = await c.query(sql, p); await c.end(); return Number(r.rows[0].n);
}

beforeEach(async () => {
  const c = new Client({ connectionString: admin }); await c.connect();
  await c.query("truncate public.organizations, public.legal_entities, public.memberships, public.audit_events, public.transaction_outbox, public.idempotency_records cascade");
  await c.end();
});

afterEach(() => { state.forceOutboxFailure = false; });

describe("POST /v1/organizations", () => {
  it("creates org+legal_entity+owner membership+audit+outbox atomically", async () => {
    const { POST } = await import("../app/v1/organizations/route");
    const res = await POST(new Request("http://x/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "k1" },
      body: JSON.stringify({ legalName: "ТОВ Е", displayName: "Е" }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.role).toBe("owner");
    expect(await count("select count(*) n from public.legal_entities", [])).toBe(1);
    expect(await count("select count(*) n from public.audit_events where action='organization.created'", [])).toBe(1);
    expect(await count("select count(*) n from public.transaction_outbox where topic='organization.created'", [])).toBe(1);
    // Idempotency-Replay-Until (docs/22-data-api-contract.md:166): lets a
    // client tell "still replayable" from "window expired" so a late retry
    // doesn't silently create a second organization.
    const replayUntil = res.headers.get("Idempotency-Replay-Until");
    expect(replayUntil).toBeTruthy();
    expect(new Date(replayUntil!).toString()).not.toBe("Invalid Date");
  });

  it("replays idempotently — same key does not create a second org", async () => {
    const { POST } = await import("../app/v1/organizations/route");
    const make = () => POST(new Request("http://x/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "dup" },
      body: JSON.stringify({ legalName: "A", displayName: "B" }),
    }));
    const r1 = await make();
    const b1 = await r1.json();
    const r2 = await make();
    const b2 = await r2.json();
    expect(await count("select count(*) n from public.organizations", [])).toBe(1);
    // Replay must return the ORIGINAL 201 body, not a fresh execution's output.
    expect(r2.status).toBe(201);
    expect(b2).toEqual(b1);
    // Both the fresh 201 and the replayed 201 must carry a valid
    // Idempotency-Replay-Until header (same underlying expiry either way).
    const until1 = r1.headers.get("Idempotency-Replay-Until");
    const until2 = r2.headers.get("Idempotency-Replay-Until");
    expect(until1).toBeTruthy();
    expect(until2).toBeTruthy();
    expect(new Date(until1!).toString()).not.toBe("Invalid Date");
    expect(new Date(until2!).toString()).not.toBe("Invalid Date");
    expect(until2).toBe(until1);
  });

  it("rejects a missing Idempotency-Key with 422 VALIDATION_FAILED (catalog-governed)", async () => {
    const { POST } = await import("../app/v1/organizations/route");
    const res = await POST(new Request("http://x/v1/organizations", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ legalName: "A", displayName: "B" }),
    }));
    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fieldErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "Idempotency-Key" })]),
    );
  });

  it("rejects an invalid JSON body with 422 VALIDATION_FAILED", async () => {
    const { POST } = await import("../app/v1/organizations/route");
    const res = await POST(new Request("http://x/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "bad-json" },
      body: "{not valid json",
    }));
    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a zod-failing body with 422 VALIDATION_FAILED and non-empty fieldErrors", async () => {
    const { POST } = await import("../app/v1/organizations/route");
    const res = await POST(new Request("http://x/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "zod-fail" },
      body: JSON.stringify({ legalName: "", displayName: "" }),
    }));
    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(Array.isArray(body.fieldErrors)).toBe(true);
    expect(body.fieldErrors.length).toBeGreaterThan(0);
  });

  it("same key + different body → 409 IDEMPOTENCY_CONFLICT, no second org", async () => {
    const { POST } = await import("../app/v1/organizations/route");
    const first = await POST(new Request("http://x/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "conflict-key" },
      body: JSON.stringify({ legalName: "A", displayName: "B" }),
    }));
    expect(first.status).toBe(201);

    const second = await POST(new Request("http://x/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "conflict-key" },
      body: JSON.stringify({ legalName: "DIFFERENT", displayName: "C" }),
    }));
    expect(second.status).toBe(409);
    expect(second.headers.get("content-type")).toContain("application/problem+json");
    const body = await second.json();
    expect(body.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(await count("select count(*) n from public.organizations", [])).toBe(1);
  });

  it("rolls back org+membership+legal_entity+audit when a later step fails (full atomicity)", async () => {
    state.forceOutboxFailure = true;
    const { POST } = await import("../app/v1/organizations/route");
    const res = await POST(new Request("http://x/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "atomic-fail" },
      body: JSON.stringify({ legalName: "Rollback Co", displayName: "R" }),
    }));
    expect(res.status).toBe(500);
    expect(await count("select count(*) n from public.organizations", [])).toBe(0);
    expect(await count("select count(*) n from public.memberships", [])).toBe(0);
    expect(await count("select count(*) n from public.legal_entities", [])).toBe(0);
    expect(await count("select count(*) n from public.audit_events", [])).toBe(0);
    expect(await count("select count(*) n from public.transaction_outbox", [])).toBe(0);
    expect(await count("select count(*) n from public.idempotency_records", [])).toBe(0);
  });
});
