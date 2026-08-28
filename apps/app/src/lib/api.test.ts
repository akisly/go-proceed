import { describe, it, expect } from "vitest";
import { ApiError, isSessionExpired, resolveBaseOrigin, UntrustedHostError, apiPost, type FetchLike } from "./api";

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

describe("resolveBaseOrigin — a production build has no header-derived fallback", () => {
  // THE HOLE: the loopback branch takes its PORT from the request. With
  // `NEXT_PUBLIC_APP_ORIGIN` unset, `Host: 127.0.0.1:9200` resolved to
  // `http://127.0.0.1:9200` and `apiGet` sent the foreman's entire Supabase
  // cookie jar there — an SSRF to an attacker-chosen port on the app's own
  // loopback interface, carrying a real session. The host allowlist closed the
  // "which machine" half of this; the port was still whatever the request said.
  //
  // Only reachable on a deployment that forgot to set the variable, which is
  // why it was parked rather than treated as critical. But "already broken" is
  // not a security boundary, and the fallback has no legitimate user in a
  // production build: every deployment that is not a developer's own machine
  // must name its origin anyway.
  //
  // `nodeEnv` is a parameter with a default for the same reason `appOrigin` is
  // — so both branches can be driven here without mutating the environment.
  // In a real build it is not read at runtime at all: Next inlines
  // `process.env.NODE_ENV` at compile time, so `next build` bakes "production"
  // in and no runtime environment can talk a shipped bundle back into the
  // developer fallback.

  it("refuses a request-chosen loopback port in production", () => {
    expect(() => resolveBaseOrigin(headers({ host: "127.0.0.1:9200" }), undefined, "production"))
      .toThrow(UntrustedHostError);
  });

  it("refuses every loopback spelling in production, not just the suspicious-looking one", () => {
    for (const host of ["localhost", "localhost:3000", "127.0.0.1:54321", "[::1]:3000", "app.localhost:3000"]) {
      expect(() => resolveBaseOrigin(headers({ host }), undefined, "production"), host)
        .toThrow(UntrustedHostError);
    }
  });

  it("still resolves NEXT_PUBLIC_APP_ORIGIN in production — that is the supported path", () => {
    // The refusal must not be reachable for a correctly configured deployment,
    // or this would be a denial of service dressed as a hardening change.
    expect(resolveBaseOrigin(headers({ host: "app.goproceed.example" }), "https://app.goproceed.example", "production"))
      .toBe("https://app.goproceed.example");
    // Including when the operator legitimately names a loopback origin, which
    // is what `qa/field.mjs` does against its own ephemeral `next start` port.
    expect(resolveBaseOrigin(headers({ host: "127.0.0.1:41234" }), "http://127.0.0.1:41234", "production"))
      .toBe("http://127.0.0.1:41234");
  });

  it("keeps the loopback fallback outside a production build — next dev must still work", () => {
    for (const env of ["development", "test", undefined]) {
      expect(resolveBaseOrigin(headers({ host: "localhost:3000" }), undefined, env), String(env))
        .toBe("http://localhost:3000");
    }
  });
});

describe("resolveBaseOrigin — the allowlist advertises no spelling it cannot accept", () => {
  it("refuses a bracketless ::1, which is what the code has always done", () => {
    // TODOS.md recorded this as «a bracketless `Host: ::1` passes the allowlist
    // and then makes `new URL` throw, surfacing as the generic error screen
    // rather than UntrustedHostError». Measured: it does not. The port-strip
    // regex `/:\d+$/` matches the trailing `:1`, so a bare `::1` is normalised
    // to `":"`, which is on no allowlist and is refused — with exactly the
    // error whose message names the remedy.
    //
    // What was real is the other half: the allowlist carried a
    // `hostname === "::1"` arm that this same normalisation made unreachable,
    // while the function's own comment advertised `::1` as an accepted
    // spelling. A comment claiming more than the code does is the failure class
    // this repository cares most about, so the arm is gone and the comment
    // names only the bracketed form — which is the only one RFC 7230 permits in
    // a Host header, and the only one `new URL` can parse.
    expect(() => resolveBaseOrigin(headers({ host: "::1" }), undefined)).toThrow(UntrustedHostError);
    expect(() => resolveBaseOrigin(headers({ host: "::" }), undefined)).toThrow(UntrustedHostError);
  });

  it("returns an origin `new URL` can actually parse for every host it accepts", () => {
    // The guarantee the dead arm would have broken if it had ever matched:
    // `apiGet` immediately does `new URL(path, base)`, so an accepted host that
    // produces an unparseable origin surfaces as the generic error screen
    // rather than as anything a reader could act on. Walked over every spelling
    // the allowlist admits, so a future addition to it cannot reintroduce one.
    for (const host of ["localhost", "localhost:3000", "127.0.0.1", "127.0.0.1:54321",
      "[::1]", "[::1]:3000", "app.localhost:3000", "LOCALHOST:3000"]) {
      const base = resolveBaseOrigin(headers({ host }), undefined);
      expect(() => new URL("/v1/me/context", base), host).not.toThrow();
    }
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

describe("apiPost", () => {
  it("sends the body, the content type and the idempotency key", async () => {
    let seen: RequestInit | undefined;
    const fake = async (_input: string, init?: RequestInit) => { seen = init; return new Response("{}", { status: 201 }); };
    await apiPost("/v1/contracts/c1/assignments", { workItemId: "w1" }, "key-1", fake);
    expect(seen?.method).toBe("POST");
    const headers = seen?.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["Idempotency-Key"]).toBe("key-1");
    expect(seen?.body).toBe(JSON.stringify({ workItemId: "w1" }));
  });

  it("returns the response rather than throwing on a refusal", async () => {
    const fake = async () => new Response("{}", { status: 422 });
    const res = await apiPost("/v1/x", {}, "key-2", fake);
    expect(res.status).toBe(422);
  });
});
