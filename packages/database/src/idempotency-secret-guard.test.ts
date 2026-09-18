import { describe, expect, it } from "vitest";
import type { Tx } from "./tx";
import { IdempotencySecretError, withIdempotency } from "./idempotency";

/**
 * DEV-023 / BL-108 / INV-102: `withIdempotency` stores what its callback
 * returns, so a route that returned a bearer secret from inside the block
 * stored it for the retention window — how BL-104 happened. The helper now
 * refuses such a body before the insert. No database: a fake transaction
 * answers the lock, the lookup and the insert, and records what reached it.
 */
function fakeTx(log: string[], prior: { body: unknown } | null = null): Tx {
  const query = async (sql: string, params?: unknown[]) => {
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
    if (sql.includes("from public.idempotency_records")) {
      return prior
        ? { rows: [{ state: "completed", response_status: 201, response_body: prior.body,
            request_hash: "a".repeat(64), expires_at: new Date(Date.now() + 86_400_000) }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (sql.includes("insert into public.idempotency_records")) {
      log.push(`insert ${String(params?.[6])}`);
      return { rows: [{ expires_at: new Date(Date.now() + 86_400_000) }], rowCount: 1 };
    }
    throw new Error(`unexpected statement: ${sql}`);
  };
  return { query } as unknown as Tx;
}

const ARGS = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  actorScope: "user:00000000-0000-4000-8000-0000000000a1",
  operationId: "widgets.create", key: "k-1", requestHash: "a".repeat(64),
  authorize: async () => undefined,
};
const SECRET = "s3cr3t-value-that-must-not-leak";

async function store(body: unknown) {
  const log: string[] = [];
  const out = withIdempotency(fakeTx(log), ARGS, async () => ({ status: 201, body }));
  return { out, log };
}

describe("withIdempotency refuses to store a secret (BL-108)", () => {
  it.each([
    ["a top-level token", { widgetId: "w-1", token: SECRET }, "token"],
    ["a nested signed URL", { widgetId: "w-1", upload: { signedUrl: SECRET } }, "upload.signedUrl"],
    ["a key inside an array", { items: [{ id: 1 }, { telegramUrl: SECRET }] }, "items[1].telegramUrl"],
    ["a …Link suffix", { reviewLink: SECRET }, "reviewLink"],
    ["a plural", { tokens: [SECRET] }, "tokens"],
    ["a plural suffix", { accessTokens: [SECRET] }, "accessTokens"],
    ["a plural url", { urls: [SECRET] }, "urls"],
    ["a key produced by a nested toJSON", { grant: { toJSON: () => ({ token: SECRET }) } }, "grant.token"],
    ["an upper-case name", { TOKEN: SECRET }, "TOKEN"],
    ["a csrf-prefixed name", { csrfValue: SECRET }, "csrfValue"],
    ["a …Secret suffix", { clientSecret: SECRET }, "clientSecret"],
    ["a …Password suffix", { adminPassword: SECRET }, "adminPassword"],
    ["the bare names", { link: SECRET }, "link"],
    ["url", { url: SECRET }, "url"],
    ["secret", { secret: SECRET }, "secret"],
    ["password", { password: SECRET }, "password"],
  ])("refuses %s before the insert, naming the key but not the value", async (_label, body, path) => {
    const { out, log } = await store(body);
    const error = await out.then(() => null, (e: unknown) => e as Error);
    expect(error).toBeInstanceOf(IdempotencySecretError);
    expect((error as IdempotencySecretError).paths).toEqual([path]);
    expect(error!.message).toContain("widgets.create");
    expect(error!.message).not.toContain(SECRET);
    expect(log).toEqual([]);
  });

  it("stores a body without secret-shaped keys, including near misses", async () => {
    const body = { widgetId: "w-1", tokenHash: "h", urlSafe: true, linkedAt: "t", passwordPolicy: "p", storage: { key: "k" }, expiresAt: "t", status: "ok", results: [] };
    const { out, log } = await store(body);
    await expect(out).resolves.toMatchObject({ replayed: false, body });
    expect(log).toEqual([`insert ${JSON.stringify(body)}`]);
  });

  it("checks what is stored: a key whose value JSON drops is not refused", async () => {
    const { out, log } = await store({ widgetId: "w-1", link: undefined });
    await expect(out).resolves.toMatchObject({ replayed: false });
    expect(log).toEqual([`insert ${JSON.stringify({ widgetId: "w-1" })}`]);
  });

  it("stores a body that is not an object", async () => {
    for (const body of [null, "ok", 3, [1, 2]]) {
      const { out, log } = await store(body);
      await expect(out).resolves.toMatchObject({ replayed: false });
      expect(log).toHaveLength(1);
    }
  });

  it("does not look at a stored body on replay", async () => {
    const log: string[] = [];
    const replay = await withIdempotency(fakeTx(log, { body: { token: "stored-before-the-guard" } }), ARGS,
      async () => { throw new Error("fn must not run on a replay"); });
    expect(replay).toMatchObject({ replayed: true });
    expect(log).toEqual([]);
  });
});
