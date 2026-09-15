import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hmacKeyProblems, parseHmacKeys } from "./deploy-preflight-keys.mjs";
import { loadKeyRegistry } from "../src/lib/hmac-key-registry";
import {
  linkKeys, sessionKeys, resetKeyRegistriesForTests,
} from "../src/lib/external-link";

// THE BUILD AND THE FIRST REQUEST MUST AGREE (DEV-009 → DEV-010, readiness gate
// 14). Until 2026-09-15 the deploy preflight checked only that the four
// EXTERNAL_* names were present: a key list with no key id, or an active id the
// list does not hold, built and shipped, and the runtime registry
// (`src/lib/external-link.ts` `loadRegistry`) threw on the first external
// request. The preflight now applies the registry's rules, and this table is
// what keeps the two from drifting: every case runs through both.

const k32 = (n) => Buffer.alloc(32, n).toString("base64");
const k16 = (n) => Buffer.alloc(16, n).toString("base64");
// Non-repeating key material, so a message that printed any PART of a secret is
// caught by an 8-character window, not only one that printed all of it.
const varied = (len, seed) =>
  Buffer.from(Array.from({ length: len }, (_, i) => (i * 37 + seed * 11 + 5) % 256)).toString("base64");
const noWindowOf = (text, secret) => {
  for (let i = 0; i + 8 <= secret.length; i += 1) {
    if (text.includes(secret.slice(i, i + 8))) return secret.slice(i, i + 8);
  }
  return null;
};

const CASES = [
  ["a valid single key", `k1:${k32(1)}`, "k1"],
  ["a valid rotation list, new key active", `k1:${k32(1)},k2:${k32(2)}`, "k2"],
  ["a valid rotation list, old key still active", `k1:${k32(1)},k2:${k32(2)}`, "k1"],
  ["spaces around entries", ` k1 : ${k32(1)} `, "k1"],
  ["no key id at all", "nokeyid", "k1"],
  ["an entry starting with the separator", `:${k32(1)}`, "k1"],
  ["a key id that trims to nothing", ` :${k32(1)}`, " "],
  ["a key shorter than 32 bytes", `k1:${k16(1)}`, "k1"],
  ["an active id the list does not hold", `k1:${k32(1)}`, "k9"],
  ["a trailing comma", `k1:${k32(1)},`, "k1"],
  ["an empty active id", `k1:${k32(1)}`, ""],
  ["an empty key list", "", "k1"],
  ["secret and key id reversed", `${k32(1)}:k1`, "k1"],
  ["a short secret before the separator", `${k16(1)}:k1`, "k1"],
  ["a duplicate key id (both accept it; the last entry wins)", `k1:${k32(1)},k1:${k32(2)}`, "k1"],
];

const PAIRS = [
  ["EXTERNAL_LINK_HMAC_KEYS", "EXTERNAL_LINK_ACTIVE_KEY_ID", linkKeys],
  ["EXTERNAL_SESSION_HMAC_KEYS", "EXTERNAL_SESSION_ACTIVE_KEY_ID", sessionKeys],
  // BL-085: the Telegram link keys use the same registry rules.
  ["TELEGRAM_LINK_HMAC_KEYS", "TELEGRAM_LINK_ACTIVE_KEY_ID",
    () => loadKeyRegistry(process.env, "TELEGRAM_LINK_HMAC_KEYS", "TELEGRAM_LINK_ACTIVE_KEY_ID")],
];

const saved = {};
beforeEach(() => {
  for (const [k, a] of PAIRS) { saved[k] = process.env[k]; saved[a] = process.env[a]; }
  resetKeyRegistriesForTests();
});
afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  resetKeyRegistriesForTests();
});

function runtimeRefuses(keysVar, activeVar, load, raw, active) {
  process.env[keysVar] = raw;
  process.env[activeVar] = active;
  resetKeyRegistriesForTests();
  try { load(); return false; } catch { return true; }
}

describe("the deploy preflight refuses exactly the HMAC key settings the runtime registry refuses", () => {
  for (const [keysVar, activeVar, load] of PAIRS) {
    for (const [label, raw, active] of CASES) {
      it(`${keysVar}: ${label}`, () => {
        const env = { [keysVar]: raw, [activeVar]: active };
        const buildRefuses = hmacKeyProblems(env, keysVar, activeVar).length > 0;
        expect(buildRefuses).toBe(runtimeRefuses(keysVar, activeVar, load, raw, active));
      });
    }
  }

  it("names the variable and never prints key material, in either path, whatever the order", () => {
    const long = varied(32, 7);
    const short = varied(16, 7);
    for (const raw of [`k1:${short}`, `${long}:k1`, `${short}:k1`]) {
      const problems = hmacKeyProblems(
        { EXTERNAL_LINK_HMAC_KEYS: raw, EXTERNAL_LINK_ACTIVE_KEY_ID: "k1" },
        "EXTERNAL_LINK_HMAC_KEYS", "EXTERNAL_LINK_ACTIVE_KEY_ID").join("\n");
      expect(problems).toContain("EXTERNAL_LINK_HMAC_KEYS");
      expect(noWindowOf(problems, long)).toBeNull();
      expect(noWindowOf(problems, short)).toBeNull();

      process.env.EXTERNAL_LINK_HMAC_KEYS = raw;
      process.env.EXTERNAL_LINK_ACTIVE_KEY_ID = "k1";
      resetKeyRegistriesForTests();
      let runtime = "";
      try { linkKeys(); } catch (e) { runtime = String(e); }
      expect(runtime).toContain("EXTERNAL_LINK_HMAC_KEYS");
      expect(noWindowOf(runtime, long)).toBeNull();
      expect(noWindowOf(runtime, short)).toBeNull();
    }
  });
});

describe("parseHmacKeys — the parsed registry the erasure script uses (BL-085)", () => {
  it("returns the keys in order and the active id when there is no problem", () => {
    const parsed = parseHmacKeys({ A_KEYS: `k1:${k32(1)},k2:${k32(2)}`, A_ACTIVE: "k2" }, "A_KEYS", "A_ACTIVE");
    expect(parsed.problems).toEqual([]);
    expect(parsed.activeKeyId).toBe("k2");
    expect([...parsed.keys.keys()]).toEqual(["k1", "k2"]);
    expect(parsed.keys.get("k1")).toEqual(Buffer.alloc(32, 1));
  });

  it("agrees with hmacKeyProblems on every case", () => {
    for (const [, raw, active] of CASES) {
      const env = { A_KEYS: raw, A_ACTIVE: active };
      expect(parseHmacKeys(env, "A_KEYS", "A_ACTIVE").problems).toEqual(hmacKeyProblems(env, "A_KEYS", "A_ACTIVE"));
    }
  });

  it("refuses a repeated key id only when asked to, naming the position", () => {
    const env = { A_KEYS: `k1:${k32(1)},k1:${k32(2)}`, A_ACTIVE: "k1" };
    expect(parseHmacKeys(env, "A_KEYS", "A_ACTIVE").problems).toEqual([]);
    expect(parseHmacKeys(env, "A_KEYS", "A_ACTIVE", { rejectDuplicateIds: true }).problems)
      .toEqual(["A_KEYS entry 2 repeats a key id"]);
  });
});

// THE SCRIPT, NOT ONLY THE FUNCTION. The table above proves the rules; this
// proves `deploy-preflight.mjs` applies them, so deleting its loop or inverting
// its guard fails a test and not only a manual exercise.
describe("deploy-preflight.mjs applies the key rules", () => {
  const SCRIPT_DIR = join(import.meta.dirname);
  const valid = {
    NEXT_PUBLIC_APP_ORIGIN: "https://app.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fakefakefakefake",
    APP_DB_URL: "postgresql://goproceed_app_login.ref:Zq8fakeA@pooler.example.test:5432/postgres",
    SERVICE_DB_URL: "postgresql://goproceed_service_login.ref:Zq8fakeB@pooler.example.test:5432/postgres",
    SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_fakefakefakefake",
    EXTERNAL_LINK_ORIGIN: "https://app.example.test",
    EXTERNAL_LINK_HMAC_KEYS: `k1:${k32(1)}`,
    EXTERNAL_LINK_ACTIVE_KEY_ID: "k1",
    EXTERNAL_SESSION_HMAC_KEYS: `s1:${k32(2)}`,
    EXTERNAL_SESSION_ACTIVE_KEY_ID: "s1",
  };
  const run = (overrides) => spawnSync(process.execPath, [join(SCRIPT_DIR, "deploy-preflight.mjs")], {
    env: { PATH: process.env.PATH, DEPLOY_PREFLIGHT: "1", ...valid, ...overrides },
    encoding: "utf8",
  });

  it("passes a complete, usable set", () => {
    const r = run({});
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("deploy preflight: OK");
  });

  it("refuses a key list the registry would refuse, and says which entry", () => {
    const r = run({ EXTERNAL_LINK_HMAC_KEYS: "nokeyid", EXTERNAL_SESSION_ACTIVE_KEY_ID: "s9" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("EXTERNAL_LINK_HMAC_KEYS entry 1 is not <keyId>");
    expect(r.stderr).toContain("EXTERNAL_SESSION_ACTIVE_KEY_ID names a key id that is not in EXTERNAL_SESSION_HMAC_KEYS");
  });

  it("checks the Telegram link keys when either name is set, and leaves them alone when neither is (BL-085)", () => {
    const bad = run({ TELEGRAM_LINK_HMAC_KEYS: "nokeyid", TELEGRAM_LINK_ACTIVE_KEY_ID: "k1" });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain("TELEGRAM_LINK_HMAC_KEYS entry 1 is not <keyId>");
    const half = run({ TELEGRAM_LINK_HMAC_KEYS: `t1:${k32(3)}` });
    expect(half.status).toBe(1);
    expect(half.stderr).toContain("TELEGRAM_LINK_ACTIVE_KEY_ID is not set");
    const good = run({ TELEGRAM_LINK_HMAC_KEYS: `t1:${k32(3)}`, TELEGRAM_LINK_ACTIVE_KEY_ID: "t1" });
    expect(good.status).toBe(0);
  });

  it("refuses more than eight Telegram link keys, which the app refuses at runtime", () => {
    const keys = Array.from({ length: 9 }, (_, i) => `t${i}:${k32(i + 10)}`).join(",");
    const r = run({ TELEGRAM_LINK_HMAC_KEYS: keys, TELEGRAM_LINK_ACTIVE_KEY_ID: "t0" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("TELEGRAM_LINK_HMAC_KEYS holds more than 8 keys");
  });

  it("refuses a deployment that carries the operator-only erasure keys, without printing them", () => {
    const secret = varied(32, 11);
    const r = run({ TELEGRAM_ERASURE_HMAC_KEYS: `e1:${secret}`, TELEGRAM_ERASURE_ACTIVE_KEY_ID: "e1" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("TELEGRAM_ERASURE_HMAC_KEYS is set on a deployment");
    expect(r.stderr).toContain("TELEGRAM_ERASURE_ACTIVE_KEY_ID is set on a deployment");
    expect(noWindowOf(r.stderr + r.stdout, secret)).toBeNull();
  });

  it("does not print a secret pasted before the separator", () => {
    const secret = varied(32, 9);
    const r = run({ EXTERNAL_LINK_HMAC_KEYS: `${secret}:k1` });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("EXTERNAL_LINK_HMAC_KEYS entry 1 is shorter than 32 bytes");
    expect(noWindowOf(r.stderr + r.stdout, secret)).toBeNull();
  });
});
