import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OTP_RATE_LIMITED, OTP_SEND_FAILED, OTP_VERIFY_FAILED } from "./otp-error";

/**
 * The office dashboard's login (`apps/app/src/lib/otp-error.ts`) and this
 * client's print the same three messages: one person signs in to both, and a
 * wording change in one should be a decision about both. The app's file is
 * read as text, not imported — this package does not depend on `apps/app`.
 * Compared as UTF-8 bytes: two apostrophes or two spaces can look alike.
 */
const APP_SOURCE = readFileSync(new URL("../../../app/src/lib/otp-error.ts", import.meta.url), "utf8");

function appConstant(name: string): string {
  const match = new RegExp(`export const ${name} =\\s*("(?:[^"\\\\]|\\\\.)*");`).exec(APP_SOURCE);
  if (!match) throw new Error(`apps/app/src/lib/otp-error.ts no longer declares ${name} as one string literal`);
  return JSON.parse(match[1]!) as string;
}

describe("the OTP messages, byte-identical to the office login's", () => {
  it.each([
    ["OTP_RATE_LIMITED", OTP_RATE_LIMITED],
    ["OTP_SEND_FAILED", OTP_SEND_FAILED],
    ["OTP_VERIFY_FAILED", OTP_VERIFY_FAILED],
  ])("%s", (name, value) => {
    expect(Buffer.from(value, "utf8").equals(Buffer.from(appConstant(name), "utf8"))).toBe(true);
  });
});
