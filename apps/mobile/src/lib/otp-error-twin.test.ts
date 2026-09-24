import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as mobile from "./otp-error";

/**
 * The office dashboard's login (`apps/app/src/lib/otp-error.ts`) and this
 * client's print the same messages: one person signs in to both, and a
 * wording change in one should be a decision about both. The app's file is
 * read as text, not imported — this package does not depend on `apps/app`.
 * Every `export const OTP_… = "…";` on either side must exist on the other,
 * equal as UTF-8 bytes: two apostrophes or two spaces can look alike.
 */
const APP_SOURCE = readFileSync(new URL("../../../app/src/lib/otp-error.ts", import.meta.url), "utf8");

const appMessages = new Map(
  [...APP_SOURCE.matchAll(/export const (OTP_[A-Z_]+) =\s*("(?:[^"\\]|\\.)*");/g)]
    .map((m) => [m[1]!, JSON.parse(m[2]!) as string]));
const mobileMessages = new Map<string, string>();
for (const [name, value] of Object.entries(mobile as Record<string, unknown>)) {
  if (name.startsWith("OTP_") && typeof value === "string") mobileMessages.set(name, value);
}

describe("the OTP messages, byte-identical to the office login's", () => {
  it("declares the same messages on both sides", () => {
    expect(appMessages.size).toBeGreaterThan(0);
    expect([...appMessages.keys()].sort()).toEqual([...mobileMessages.keys()].sort());
  });

  it.each([...mobileMessages])("%s", (name, value) => {
    expect(Buffer.from(value, "utf8").equals(Buffer.from(appMessages.get(name) ?? "", "utf8"))).toBe(true);
  });
});
