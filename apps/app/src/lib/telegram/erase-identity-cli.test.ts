import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { erase, parseArgs, subjectHmac } from "../../../scripts/telegram-erase-identity.mjs";

const WS = "a1a1a1a1-2222-4222-8222-222222222222";

/**
 * A fake pg.Client-shaped object: `query` is a `vi.fn()` recording every
 * `(text, params)` call. `connect`/`end` are `vi.fn()`s too. `erase`'s
 * `clientFactory` injection point (added in this fix round — without it,
 * `erase` always builds its own real `pg.Client` and cannot be exercised
 * without a database) hands this back instead of a real client.
 *
 * `onErase` decides what the `app.erase_telegram_identity(...)` call does:
 * return a row (the happy path) or throw (the failure path). Every other
 * query call succeeds with an empty row set.
 */
function fakeClient(onErase: () => { rows: unknown[] }) {
  return {
    query: vi.fn(async (text: string, _params?: unknown[]) => {
      if (/erase_telegram_identity/.test(text)) return onErase();
      return { rows: [] as unknown[] };
    }),
    connect: vi.fn(async () => undefined),
    end: vi.fn(async () => undefined),
  };
}

/** The recorded `(text, params)` calls, with whitespace collapsed for comparison. */
function normalizedQueryCalls(client: ReturnType<typeof fakeClient>) {
  return client.query.mock.calls.map(([text, params]) => ({
    text: text.replace(/\s+/g, " ").trim(),
    params,
  }));
}

describe("telegram-erase-identity — the operator's entry, without a database", () => {
  it("parses --workspace and --telegram-user-id and refuses anything else", () => {
    expect(parseArgs(["--workspace", WS, "--telegram-user-id", "700001"])).toEqual({ workspace: WS, telegramUserId: "700001" });
    expect(() => parseArgs(["--workspace", WS])).toThrow(/--telegram-user-id/);
    expect(() => parseArgs(["--workspace", "not-a-uuid", "--telegram-user-id", "1"])).toThrow(/uuid/i);
    expect(() => parseArgs(["--workspace", WS, "--telegram-user-id", "-5"])).toThrow(/positive/);
    expect(() => parseArgs(["--workspace", WS, "--telegram-user-id", "1", "--extra"])).toThrow(/unknown argument/);
  });

  it("computes the HMAC over the erasure-prefixed input and refuses a missing or short pepper", () => {
    const pepper = "p".repeat(32);
    expect(subjectHmac(pepper, WS, "700001"))
      .toBe(createHmac("sha256", pepper).update(`erasure:${WS}:700001`, "utf8").digest("hex"));
    expect(subjectHmac(pepper, WS, "700001")).toMatch(/^[0-9a-f]{64}$/);
    expect(() => subjectHmac(undefined, WS, "700001")).toThrow(/TELEGRAM_LINK_PEPPER/);
    expect(() => subjectHmac("p".repeat(31), WS, "700001")).toThrow(/32/);
  });

  it("keeps the HMAC domain apart from the intent-token verifier", () => {
    const pepper = "p".repeat(32);
    const asIntent = createHmac("sha256", pepper).update(`${WS}:700001`, "utf8").digest("hex");
    expect(subjectHmac(pepper, WS, "700001")).not.toBe(asIntent);
  });

  it("erase() runs begin, role, workspace GUC, the definer call, then commit — in that order — and never leaks the pepper", async () => {
    const workspace = "11111111-1111-4111-8111-111111111111";
    const telegramUserId = "700001";
    const pepper = "p".repeat(32);
    const hmac = subjectHmac(pepper, workspace, telegramUserId);
    const cannedRow = {
      surrogate_user_id: 42, messages: 2, events: 3, links: 1,
      attachments: 0, pending_updates_for_subject: 0, already_erased: false,
    };
    const client = fakeClient(() => ({ rows: [cannedRow] }));

    const row = await erase({ workspace, telegramUserId, hmac, clientFactory: () => client });

    const calls = normalizedQueryCalls(client);
    expect(calls.map((c) => c.text)).toEqual([
      "begin",
      "set local role goproceed_service",
      "select set_config('app.organization_id', $1, true)",
      "select * from app.erase_telegram_identity($1::uuid, $2::bigint, $3::text)",
      "commit",
    ]);
    expect(calls[2]!.params).toEqual([workspace]);
    expect(calls[3]!.params).toEqual([workspace, telegramUserId, hmac]);
    expect(hmac).toMatch(/^[0-9a-f]{64}$/);

    expect(row).toEqual(cannedRow);
    expect(client.end).toHaveBeenCalledTimes(1);

    // No recorded param, and nothing this call could print, ever carries the pepper.
    const everyParam = calls.flatMap((c) => c.params ?? []);
    expect(everyParam).not.toContain(pepper);
    expect(JSON.stringify(row)).not.toContain(pepper);
  });

  it("erase() rolls back and rethrows when the definer call fails, and still closes the connection", async () => {
    const workspace = "11111111-1111-4111-8111-111111111111";
    const telegramUserId = "700001";
    const pepper = "p".repeat(32);
    const hmac = subjectHmac(pepper, workspace, telegramUserId);
    const failure = new Error("erasure workspace is not the declared workspace");
    const client = fakeClient(() => { throw failure; });

    await expect(erase({ workspace, telegramUserId, hmac, clientFactory: () => client })).rejects.toBe(failure);

    const calls = normalizedQueryCalls(client);
    expect(calls.map((c) => c.text)).toEqual([
      "begin",
      "set local role goproceed_service",
      "select set_config('app.organization_id', $1, true)",
      "select * from app.erase_telegram_identity($1::uuid, $2::bigint, $3::text)",
      "rollback",
    ]);
    expect(calls.map((c) => c.text)).not.toContain("commit");
    expect(client.end).toHaveBeenCalledTimes(1);
  });
});
