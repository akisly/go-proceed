import { describe, it, expect } from "vitest";
import { ApiError, isSessionExpired, resolveBaseOrigin, UntrustedHostError } from "./api";

/**
 * `resolveBaseOrigin` had NO unit test at all until the final whole-branch
 * review — it was verified once, by hand, by standalone reproduction (task 7's
 * own deferred-minor list says so). It is the function that decides which host
 * this process hands a foreman's entire Supabase auth cookie jar to, so
 * "verified by hand once" was the wrong amount of proof.
 *
 * Every test below is about one of two questions: does a legitimate
 * deployment/dev machine still resolve, and can a request name a host of its
 * own choosing and be believed.
 */

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("resolveBaseOrigin — a good host resolves", () => {
  it("returns NEXT_PUBLIC_APP_ORIGIN verbatim when the operator set one", () => {
    expect(resolveBaseOrigin(headers({ host: "app.goproceed.example" }), "https://app.goproceed.example"))
      .toBe("https://app.goproceed.example");
  });

  it("resolves localhost with its dev port over plain http — next dev / next start", () => {
    expect(resolveBaseOrigin(headers({ host: "localhost:3000" }), undefined))
      .toBe("http://localhost:3000");
  });

  it("resolves every loopback spelling the harnesses actually use", () => {
    for (const host of ["localhost", "127.0.0.1:54321", "[::1]:3000", "app.localhost:3000"]) {
      expect(resolveBaseOrigin(headers({ host }), undefined), host).toBe(`http://${host}`);
    }
  });

  it("treats a loopback host case-insensitively rather than refusing it", () => {
    // Previously a deferred minor: `Host: LOCALHOST` fell through the
    // case-sensitive compare. It used to fail toward `https` (a broken fetch);
    // it would now fail toward a refusal, which is safe but wrong.
    expect(resolveBaseOrigin(headers({ host: "LOCALHOST:3000" }), undefined))
      .toBe("http://LOCALHOST:3000");
  });
});

describe("resolveBaseOrigin — a foreign Host is refused, not fetched", () => {
  it("throws rather than building a target out of an attacker-supplied Host", () => {
    // THE CRITICAL. `apiGet` attaches `cookie: c.toString()` — the whole
    // Supabase auth cookie jar — to whatever this returns. A request carrying
    // `Host: attacker.example` used to make a server component fetch
    // `https://attacker.example/v1/projects` with a real session on it.
    expect(() => resolveBaseOrigin(headers({ host: "attacker.example" }), undefined))
      .toThrow(UntrustedHostError);
  });

  it("refuses a host that merely ends with a trusted-looking suffix", () => {
    for (const host of [
      "localhost.attacker.example",
      "notlocalhost",
      "127.0.0.1.attacker.example",
      "evil-localhost",
      "attacker.example:3000",
    ]) {
      expect(() => resolveBaseOrigin(headers({ host }), undefined), host)
        .toThrow(UntrustedHostError);
    }
  });

  it("refuses a missing Host header rather than fetching a relative nowhere", () => {
    expect(() => resolveBaseOrigin(headers({}), undefined)).toThrow(UntrustedHostError);
  });

  it("does not consult Host at all once NEXT_PUBLIC_APP_ORIGIN is set", () => {
    // The override must not be composable with the header: an attacker who
    // can set `Host` must not be able to influence the result even by one
    // character when an operator has named the origin.
    expect(resolveBaseOrigin(headers({ host: "attacker.example" }), "https://app.goproceed.example"))
      .toBe("https://app.goproceed.example");
  });
});

describe("resolveBaseOrigin — no header can downgrade the scheme", () => {
  it("does not let x-forwarded-proto: http take a public host to cleartext", () => {
    // `x-forwarded-proto` used to be trusted unconditionally and was the
    // first thing consulted. It is as forgeable as `Host`, and since the
    // derived scheme for a non-loopback host is already https, it could only
    // ever downgrade — sending the session cookie in the clear with nothing
    // failing. It is no longer read. A public host now needs
    // NEXT_PUBLIC_APP_ORIGIN, and that value carries its own scheme.
    expect(() => resolveBaseOrigin(
      headers({ host: "app.goproceed.example", "x-forwarded-proto": "http" }), undefined,
    )).toThrow(UntrustedHostError);

    expect(resolveBaseOrigin(
      headers({ host: "app.goproceed.example", "x-forwarded-proto": "http" }),
      "https://app.goproceed.example",
    )).toBe("https://app.goproceed.example");
  });

  it("does not let x-forwarded-proto rewrite a loopback origin either", () => {
    expect(resolveBaseOrigin(
      headers({ host: "localhost:3000", "x-forwarded-proto": "ftp" }), undefined,
    )).toBe("http://localhost:3000");
  });
});

describe("isSessionExpired", () => {
  it("is true for a 401 ApiError and nothing else", () => {
    expect(isSessionExpired(new ApiError(401, {}))).toBe(true);
    expect(isSessionExpired(new ApiError(403, {}))).toBe(false);
    expect(isSessionExpired(new ApiError(500, {}))).toBe(false);
    expect(isSessionExpired(new Error("network down"))).toBe(false);
    expect(isSessionExpired(new UntrustedHostError("attacker.example"))).toBe(false);
    expect(isSessionExpired(undefined)).toBe(false);
  });
});
