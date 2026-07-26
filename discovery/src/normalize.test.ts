import { describe, expect, it } from "vitest";
import { normalizeDomain, normalizeEmail } from "./normalize";

describe("normalizeDomain", () => {
  it("strips scheme, www and path", () => {
    expect(normalizeDomain("https://www.example.com.ua/projects?a=1")).toBe("example.com.ua");
  });

  it("reduces a subdomain to the registrable domain", () => {
    expect(normalizeDomain("shop.example.com.ua")).toBe("example.com.ua");
  });

  // ER-4 MANDATORY TEST: a naive "last two labels" implementation returns
  // "com.ua" for both of these and silently collapses the entire lead list.
  it("distinguishes two companies under the same public suffix", () => {
    expect(normalizeDomain("example.com.ua")).not.toBe(normalizeDomain("other.com.ua"));
    expect(normalizeDomain("example.com.ua")).toBe("example.com.ua");
    expect(normalizeDomain("other.com.ua")).toBe("other.com.ua");
  });

  it("handles Ukrainian oblast and city public suffixes", () => {
    expect(normalizeDomain("http://firma.kyiv.ua")).toBe("firma.kyiv.ua");
    expect(normalizeDomain("www.montazh.lviv.ua/about")).toBe("montazh.lviv.ua");
  });

  it("uppercases and whitespace are normalized away", () => {
    expect(normalizeDomain("  HTTPS://WWW.Example.COM.UA  ")).toBe("example.com.ua");
  });

  it("throws on input with no registrable domain", () => {
    expect(() => normalizeDomain("com.ua")).toThrow();
    expect(() => normalizeDomain("")).toThrow();
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Info@Example.COM.UA ")).toBe("info@example.com.ua");
  });

  // B.4.3: for non-Gmail domains a +tag and a dot are semantically distinct
  // addresses, so stripping them would merge two real mailboxes into one lead.
  it("preserves +tags and dots", () => {
    expect(normalizeEmail("o.petrenko+pto@example.com.ua")).toBe("o.petrenko+pto@example.com.ua");
  });

  it("throws on a non-address", () => {
    expect(() => normalizeEmail("not-an-email")).toThrow();
    expect(() => normalizeEmail("")).toThrow();
  });
});
