import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hmacKeyProblems } from "./deploy-preflight-keys.mjs";
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
];

const PAIRS = [
  ["EXTERNAL_LINK_HMAC_KEYS", "EXTERNAL_LINK_ACTIVE_KEY_ID", linkKeys],
  ["EXTERNAL_SESSION_HMAC_KEYS", "EXTERNAL_SESSION_ACTIVE_KEY_ID", sessionKeys],
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

  it("names the variable and never prints key material", () => {
    const secret = k16(7);
    const problems = hmacKeyProblems(
      { EXTERNAL_LINK_HMAC_KEYS: `k1:${secret}`, EXTERNAL_LINK_ACTIVE_KEY_ID: "k1" },
      "EXTERNAL_LINK_HMAC_KEYS", "EXTERNAL_LINK_ACTIVE_KEY_ID");
    expect(problems.join("\n")).toContain("EXTERNAL_LINK_HMAC_KEYS");
    expect(problems.join("\n")).not.toContain(secret);
  });
});
