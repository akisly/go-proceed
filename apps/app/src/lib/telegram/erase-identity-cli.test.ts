import { describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { join } from "node:path";
import {
  erase, erasureKeys, keyCheckValues, parseArgs, subjectHmacs, KEY_CHECK_LABEL,
} from "../../../scripts/telegram-erase-identity.mjs";

const WS = "a1a1a1a1-2222-4222-8222-222222222222";
const k32 = (n: number) => Buffer.alloc(32, n).toString("base64");
const varied = (len: number, seed: number) =>
  Buffer.from(Array.from({ length: len }, (_, i) => (i * 37 + seed * 11 + 5) % 256)).toString("base64");
const noWindowOf = (text: string, secret: string) => {
  for (let i = 0; i + 8 <= secret.length; i += 1) {
    if (text.includes(secret.slice(i, i + 8))) return secret.slice(i, i + 8);
  }
  return null;
};
const env = (keys: string | undefined, active: string | undefined) =>
  ({ TELEGRAM_ERASURE_HMAC_KEYS: keys, TELEGRAM_ERASURE_ACTIVE_KEY_ID: active });
const ERASE_SQL = "select * from app.erase_telegram_identity($1::uuid, $2::bigint, $3::text, $4::text[], $5::text[], $6::text[])";

/**
 * A fake pg.Client-shaped object: `query` is a `vi.fn()` recording every
 * `(text, params)` call. `onErase` decides what the definer call does.
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

function normalizedQueryCalls(client: ReturnType<typeof fakeClient>) {
  return client.query.mock.calls.map(([text, params]) => ({ text: text.replace(/\s+/g, " ").trim(), params }));
}

describe("telegram-erase-identity — the operator's entry, without a database", () => {
  it("parses --workspace and --telegram-user-id and refuses anything else", () => {
    expect(parseArgs(["--workspace", WS, "--telegram-user-id", "700001"])).toEqual({ workspace: WS, telegramUserId: "700001" });
    expect(() => parseArgs(["--workspace", WS])).toThrow(/--telegram-user-id/);
    expect(() => parseArgs(["--workspace", "not-a-uuid", "--telegram-user-id", "1"])).toThrow(/uuid/i);
    expect(() => parseArgs(["--workspace", WS, "--telegram-user-id", "-5"])).toThrow(/positive/);
    expect(() => parseArgs(["--workspace", WS, "--telegram-user-id", "1", "--extra"])).toThrow(/unknown argument/);
  });

  it("reads the erasure key registry with key ids and refuses what it cannot use (BL-085)", () => {
    const keys = erasureKeys(env(`k1:${k32(1)},k2:${k32(2)}`, "k2"));
    expect(keys.activeKeyId).toBe("k2");
    expect([...keys.keys.keys()]).toEqual(["k1", "k2"]);
    expect(() => erasureKeys(env(undefined, "k1"))).toThrow(/TELEGRAM_ERASURE_HMAC_KEYS is not set/);
    expect(() => erasureKeys(env(`k1:${k32(1)}`, undefined))).toThrow(/TELEGRAM_ERASURE_ACTIVE_KEY_ID is not set/);
    expect(() => erasureKeys(env(`k1:${k32(1)}`, "k9"))).toThrow(/TELEGRAM_ERASURE_ACTIVE_KEY_ID/);
    expect(() => erasureKeys(env(`k1:${Buffer.alloc(16, 1).toString("base64")}`, "k1"))).toThrow(/entry 1 is shorter than 32 bytes/);
  });

  it("refuses a repeated erasure key id, because the later secret would silently change what the id means", () => {
    expect(() => erasureKeys(env(`k1:${k32(1)},k1:${k32(2)}`, "k1"))).toThrow(/TELEGRAM_ERASURE_HMAC_KEYS entry 2 repeats a key id/);
  });

  it("never prints key material in a refusal, whatever the order", () => {
    const long = varied(32, 7);
    const short = varied(16, 7);
    for (const raw of [`k1:${short}`, `${long}:k1`, `k1:${long},k1:${varied(32, 8)}`]) {
      let message = "";
      try { erasureKeys(env(raw, "k1")); } catch (e) { message = String(e); }
      expect(message).toContain("TELEGRAM_ERASURE_HMAC_KEYS");
      expect(noWindowOf(message, long)).toBeNull();
      expect(noWindowOf(message, short)).toBeNull();
    }
  });

  it("computes one HMAC per key over the erasure-prefixed input, in key order", () => {
    const keys = erasureKeys(env(`k1:${k32(1)},k2:${k32(2)}`, "k2"));
    const out = subjectHmacs(keys, WS, "700001");
    expect(out.keyIds).toEqual(["k1", "k2"]);
    expect(out.hmacs).toEqual([
      createHmac("sha256", Buffer.alloc(32, 1)).update(`erasure:${WS}:700001`, "utf8").digest("hex"),
      createHmac("sha256", Buffer.alloc(32, 2)).update(`erasure:${WS}:700001`, "utf8").digest("hex"),
    ]);
  });

  it("a legacy entry holding the old pepper's UTF-8 bytes reproduces the HMAC the registry already stores", () => {
    const pepper = "p".repeat(32);
    const keys = erasureKeys(env(`legacy:${Buffer.from(pepper, "utf8").toString("base64")}`, "legacy"));
    expect(subjectHmacs(keys, WS, "700001").hmacs[0])
      .toBe(createHmac("sha256", pepper).update(`erasure:${WS}:700001`, "utf8").digest("hex"));
  });

  it("derives a key check value per key from a fixed label, apart from every subject HMAC and intent verifier", () => {
    const keys = erasureKeys(env(`k1:${k32(1)},k2:${k32(2)}`, "k2"));
    const checks = keyCheckValues(keys);
    expect(KEY_CHECK_LABEL).toBe("goproceed:telegram-erasure:key-check:v1");
    expect(checks).toEqual([
      createHmac("sha256", Buffer.alloc(32, 1)).update(KEY_CHECK_LABEL, "utf8").digest("hex"),
      createHmac("sha256", Buffer.alloc(32, 2)).update(KEY_CHECK_LABEL, "utf8").digest("hex"),
    ]);
    expect(checks).not.toContain(subjectHmacs(keys, WS, "700001").hmacs[0]);
    const asIntent = createHmac("sha256", Buffer.alloc(32, 1)).update(`${WS}:700001`, "utf8").digest("hex");
    expect(subjectHmacs(keys, WS, "700001").hmacs[0]).not.toBe(asIntent);
  });

  it("erase() runs begin, role, workspace GUC, the definer call with the key arrays, then commit — and never passes key material", async () => {
    const workspace = "11111111-1111-4111-8111-111111111111";
    const telegramUserId = "700001";
    const secrets = [varied(32, 1), varied(32, 2)];
    const keys = erasureKeys(env(`k1:${secrets[0]},k2:${secrets[1]}`, "k2"));
    const { keyIds, hmacs } = subjectHmacs(keys, workspace, telegramUserId);
    const checkValues = keyCheckValues(keys);
    const cannedRow = {
      surrogate_user_id: 42, messages: 2, events: 3, links: 1,
      attachments: 0, pending_updates_for_subject: 0, already_erased: false,
    };
    const client = fakeClient(() => ({ rows: [cannedRow] }));

    const row = await erase({
      workspace, telegramUserId, activeKeyId: keys.activeKeyId, keyIds, hmacs, checkValues, clientFactory: () => client,
    });

    const calls = normalizedQueryCalls(client);
    expect(calls.map((c) => c.text)).toEqual([
      "begin", "set local role goproceed_service", "select set_config('app.organization_id', $1, true)", ERASE_SQL, "commit",
    ]);
    expect(calls[2]!.params).toEqual([workspace]);
    expect(calls[3]!.params).toEqual([workspace, telegramUserId, "k2", ["k1", "k2"], hmacs, checkValues]);
    expect(row).toEqual(cannedRow);
    expect(client.end).toHaveBeenCalledTimes(1);

    const everything = JSON.stringify(calls) + JSON.stringify(row);
    for (const secret of secrets) {
      expect(noWindowOf(everything, secret)).toBeNull();
      expect(everything).not.toContain(Buffer.from(secret, "base64").toString("hex").slice(0, 16));
    }
  });

  it("erase() rolls back and rethrows when the definer call fails, and still closes the connection", async () => {
    const workspace = "11111111-1111-4111-8111-111111111111";
    const keys = erasureKeys(env(`k1:${k32(1)}`, "k1"));
    const { keyIds, hmacs } = subjectHmacs(keys, workspace, "700001");
    const failure = new Error("erasure workspace is not the declared workspace");
    const client = fakeClient(() => { throw failure; });

    await expect(erase({
      workspace, telegramUserId: "700001", activeKeyId: "k1", keyIds, hmacs,
      checkValues: keyCheckValues(keys), clientFactory: () => client,
    })).rejects.toBe(failure);

    const calls = normalizedQueryCalls(client);
    expect(calls.map((c) => c.text)).toEqual([
      "begin", "set local role goproceed_service", "select set_config('app.organization_id', $1, true)", ERASE_SQL, "rollback",
    ]);
    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it("the script refuses to run on the old pepper alone, before it connects to any database", () => {
    const r = spawnSync(process.execPath, [
      join(import.meta.dirname, "../../../scripts/telegram-erase-identity.mjs"),
      "--workspace", WS, "--telegram-user-id", "700001",
    ], {
      env: {
        PATH: process.env.PATH,
        SERVICE_DB_URL: "postgresql://nobody:nothing@127.0.0.1:1/none",
        TELEGRAM_LINK_PEPPER: "p".repeat(32),
      } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("TELEGRAM_ERASURE_HMAC_KEYS is not set");
    expect(r.stderr).not.toMatch(/ECONNREFUSED|connect/i);
  });
});
