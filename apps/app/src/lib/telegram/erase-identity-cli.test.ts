import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { parseArgs, subjectHmac } from "../../../scripts/telegram-erase-identity.mjs";

const WS = "a1a1a1a1-2222-4222-8222-222222222222";

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
});
