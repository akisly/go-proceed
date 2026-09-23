import { describe, expect, it } from "vitest";
import { nativeNext } from "./destinations";

const id = "11111111-1111-1111-1111-111111111111";
describe("native deep-link allowlist", () => {
  it("accepts assignments but never opens the camera without preparation", () => {
    expect(nativeNext(`goproceed://a/${id}`)).toBe(`/a/${id}`);
    expect(nativeNext(`goproceed:///a/${id}`)).toBe(`/a/${id}`);
    expect(nativeNext(`goproceed:///a/${id}/capture/${id}`)).toBe("/");
    expect(nativeNext("/queue")).toBe("/queue");
  });
  it.each([
    "https://evil.example/a/x", "//evil.example", "/external/secret", "/login?next=/pending",
    "/a/../../pending", "/a/%2e%2e/pending", "/pending?token=secret", "/pending#x",
    "goproceed://user@pending", "goproceed://pending:123", "/a/not-an-id", "/pending\\x",
  ])("refuses %s without forwarding parameters", (value) => {
    expect(nativeNext(value)).toBe("/");
  });
});
