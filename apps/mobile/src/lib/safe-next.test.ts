import { describe, it, expect } from "vitest";
import { safeNext } from "./safe-next";

/**
 * `safeNext` guards the ONE navigation in `otp-form.tsx` that a signed-in
 * foreman actually follows (`router.replace(safeNext(next, origin))`), so a
 * gap here is a working open redirect, not a cosmetic bug — a link to the
 * real login domain, `…/login?next=%2F%5Cevil.example`, decodes to
 * `/\evil.example`, and once the foreman types their real one-time code the
 * app hands them off to `evil.example` the instant they succeed.
 *
 * THE ORIGIN THIS SUITE CHECKS AGAINST is a fixed placeholder
 * (`http://internal.invalid`), not `window.location.origin` — this module
 * has no `window` at module scope specifically so it runs here, in plain
 * Node `vitest`, with no DOM. The real call site passes the page's actual
 * `window.location.origin` at runtime; the placeholder here stands in for
 * "whatever origin is calling" and every case below is written to hold for
 * ANY origin, not just this one.
 */
const ORIGIN = "http://internal.invalid";

describe("safeNext — resolution, not prefix matching", () => {
  it("passes through a same-origin root-relative path unchanged", () => {
    expect(safeNext("/", ORIGIN)).toBe("/");
    expect(safeNext("/a/123", ORIGIN)).toBe("/a/123");
  });

  it("keeps the query string and fragment of a same-origin path", () => {
    expect(safeNext("/assignments?assignee=me", ORIGIN)).toBe("/assignments?assignee=me");
    expect(safeNext("/a#section", ORIGIN)).toBe("/a#section");
  });

  it("falls back to / for no value at all", () => {
    expect(safeNext(undefined, ORIGIN)).toBe("/");
    expect(safeNext(null, ORIGIN)).toBe("/");
    expect(safeNext("", ORIGIN)).toBe("/");
  });

  it("rejects a fully-absolute off-origin URL", () => {
    expect(safeNext("https://evil.com", ORIGIN)).toBe("/");
    expect(safeNext("http://evil.com", ORIGIN)).toBe("/");
  });

  it("rejects a protocol-relative (scheme-relative) URL", () => {
    // A leading `//` means "same scheme, different host" once a browser
    // resolves it — not a typo, an authority declaration.
    expect(safeNext("//evil.com", ORIGIN)).toBe("/");
  });

  it(
    "rejects the backslash form — THE CASE A PREFIX CHECK MISSES. " +
      "`/\\evil.example` fails a naive `startsWith(\"//\")` check (it has " +
      "only one leading slash), but the WHATWG URL spec normalises a " +
      "backslash to a forward slash for http/https, so a browser's own " +
      "`new URL(\"/\\\\evil.example\", location.href)` resolves to origin " +
      "`http://evil.example` — an off-origin redirect the string check " +
      "never saw coming. Resolving through `new URL` and comparing the " +
      "RESULTING origin catches this the same way the browser's own " +
      "router does, instead of trying to keep enumerating escape syntaxes.",
    () => {
      expect(safeNext("/\\evil.example", ORIGIN)).toBe("/");
      expect(safeNext("/\\\\evil.example", ORIGIN)).toBe("/");
      expect(safeNext("\\\\evil.example", ORIGIN)).toBe("/");
    },
  );

  it("rejects a non-http(s) scheme masquerading as a path", () => {
    expect(safeNext("javascript:alert(1)", ORIGIN)).toBe("/");
  });

  it(
    "a single-slash same-scheme prefix (`http:/evil.com`) is NOT an open " +
      "redirect, and resolving proves it rather than assuming it: per the " +
      "URL spec, when the scheme in the input matches the base's scheme " +
      "and only one slash follows (not `//`), the browser treats it as a " +
      "path-relative reference against the base, not as a new authority — " +
      "`evil.com` lands in the PATH of our own origin, never in the host.",
    () => {
      const result = safeNext("http:/evil.com", ORIGIN);
      expect(result).toBe("/evil.com");
      expect(new URL(result, ORIGIN).origin).toBe(ORIGIN);
    },
  );

  it("rejects an unparseable value instead of throwing", () => {
    // `new URL` throws on some malformed input; the guard must swallow
    // that and fall back, not propagate an exception out of a form submit
    // handler.
    expect(() => safeNext("http://", ORIGIN)).not.toThrow();
  });

  it(
    "the percent-encoded query-string form decodes to the same attack and " +
      "is rejected the same way — this is the exact shape a crafted link " +
      "carries: `/login?next=%2F%5Cevil.example`",
    () => {
      const rawFromQueryString = decodeURIComponent("%2F%5Cevil.example");
      expect(rawFromQueryString).toBe("/\\evil.example");
      expect(safeNext(rawFromQueryString, ORIGIN)).toBe("/");
    },
  );

  it("holds under a different (e.g. production https) origin, not just this placeholder", () => {
    const prod = "https://app.goproceed.example";
    expect(safeNext("/assignments", prod)).toBe("/assignments");
    expect(safeNext("//evil.com", prod)).toBe("/");
    expect(safeNext("/\\evil.example", prod)).toBe("/");
  });
});
