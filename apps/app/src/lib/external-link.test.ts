import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { assuranceLadder, requiredDisclaimers } from "../../tests/helpers/content-rules";
import {
  EXTERNAL_CONFIRMATION_TEXT, EXTERNAL_CONFIRMATION_TEXT_VERSION,
  EXTERNAL_CSRF_HEADER, EXTERNAL_LEVEL_STATEMENT, EXTERNAL_NOT_A_SIGNATURE,
  EXTERNAL_SESSION_ABSOLUTE_SECONDS, EXTERNAL_SESSION_COOKIE,
  EXTERNAL_SESSION_IDLE_SECONDS,
  allowedExternalOrigin, buildReviewLink, clearedExternalSessionCookie,
  externalSecurityHeaders, externalSessionCookie, hmacOf, linkKeys, newSecret,
  readExternalSessionCookie, resetKeyRegistriesForTests, sessionKeys,
  signWithActiveKey, verifiersEqual, verifyAgainstAnyKey, receiptHash,
} from "./external-link";
import { LEVEL_3_NOT_A_SIGNATURE_TEXT } from "./statutory-act-form";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No `pnpm`, no `vitest`, no database:
 * these assertions have never run and no claim is made that they pass. The only
 * check performed was `node --experimental-strip-types --check`, which PARSES
 * and does not typecheck.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M5, the pure half: the token, the keys, the cookie, the headers, and the
 * words the технагляд submits under.
 *
 * This is the only M5 suite that needs no database, and it is the one most
 * likely to fail on a REAL defect rather than on a fixture — because two of its
 * cases compare product strings against an Approved document rather than against
 * the product.
 */

const LINK_KEYS = "k1:" + Buffer.alloc(32, 1).toString("base64")
  + ",k2:" + Buffer.alloc(32, 2).toString("base64");
const SESSION_KEYS = "s1:" + Buffer.alloc(32, 3).toString("base64")
  + ",s2:" + Buffer.alloc(32, 4).toString("base64");

const SAVED = { ...process.env };

beforeEach(() => {
  resetKeyRegistriesForTests();
  process.env.EXTERNAL_LINK_HMAC_KEYS = LINK_KEYS;
  process.env.EXTERNAL_LINK_ACTIVE_KEY_ID = "k2";
  process.env.EXTERNAL_SESSION_HMAC_KEYS = SESSION_KEYS;
  process.env.EXTERNAL_SESSION_ACTIVE_KEY_ID = "s1";
  process.env.EXTERNAL_LINK_ORIGIN = "https://app.example";
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in SAVED)) delete process.env[k];
  Object.assign(process.env, SAVED);
  resetKeyRegistriesForTests();
});

describe("the key registry refuses rather than defaulting", () => {
  it("throws when no key material is configured", () => {
    delete process.env.EXTERNAL_LINK_HMAC_KEYS;
    // A deployment with no external key MUST NOT be able to issue a link. A
    // default here would be a key in the source tree, which is a key in every
    // deployment that forgot to set one — the failure `supabase/seed.sql` was
    // emptied to prevent.
    expect(() => linkKeys()).toThrow(/EXTERNAL_LINK_HMAC_KEYS/);
  });

  it("throws when the active key id names a key that is not in the list", () => {
    process.env.EXTERNAL_LINK_ACTIVE_KEY_ID = "k9";
    expect(() => linkKeys()).toThrow(/EXTERNAL_LINK_ACTIVE_KEY_ID/);
  });

  it("throws on a key shorter than the tag it produces", () => {
    process.env.EXTERNAL_LINK_HMAC_KEYS = "k1:" + Buffer.alloc(16, 7).toString("base64");
    process.env.EXTERNAL_LINK_ACTIVE_KEY_ID = "k1";
    // A 16-byte key behind a 32-byte tag is a 16-byte secret wearing a larger
    // number.
    expect(() => linkKeys()).toThrow(/shorter than 32 bytes/);
  });
});

describe("the token", () => {
  it("is 256 bits, base64url, unpadded — the shape the wire contract asserts", () => {
    for (let i = 0; i < 32; i += 1) {
      const s = newSecret();
      expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(s, "base64url")).toHaveLength(32);
    }
  });

  it("does not repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 512; i += 1) seen.add(newSecret());
    expect(seen.size).toBe(512);
  });

  it("signs with the ACTIVE key and verifies against the key the row names", () => {
    const token = newSecret();
    const signed = signWithActiveKey(linkKeys(), token);
    expect(signed.keyId).toBe("k2");
    expect(signed.verifier).toHaveLength(32);

    // THE ROTATION PROPERTY, which is the whole reason `hmac_key_id` is stored
    // beside the verifier: a grant written under k1 must keep verifying while k2
    // is active, and must NOT verify under k2.
    const underK1 = hmacOf(linkKeys(), "k1", token);
    expect(verifyAgainstAnyKey(linkKeys(), token, "k1", underK1)).toBe(true);
    expect(verifyAgainstAnyKey(linkKeys(), token, "k2", underK1)).toBe(false);
    expect(verifiersEqual(underK1, signed.verifier)).toBe(false);
  });

  it("verifies nothing under a key id the registry does not hold", () => {
    const token = newSecret();
    const v = hmacOf(linkKeys(), "k1", token);
    process.env.EXTERNAL_LINK_HMAC_KEYS = "k2:" + Buffer.alloc(32, 2).toString("base64");
    process.env.EXTERNAL_LINK_ACTIVE_KEY_ID = "k2";
    resetKeyRegistriesForTests();
    // A retired key is a key that stops verifying. It does not throw and it does
    // not fall back to the active key — either would turn a rotation into an
    // outage or into an acceptance.
    expect(verifyAgainstAnyKey(linkKeys(), token, "k1", v)).toBe(false);
  });

  it("the link and the session registries are SEPARATE key spaces", () => {
    const secret = newSecret();
    // Same secret, same key id string, different registry → different tag. A
    // product that used one registry for both would let a session verifier be
    // presented as a grant token.
    expect(verifiersEqual(hmacOf(linkKeys(), "k1", secret),
                          hmacOf(sessionKeys(), "s1", secret))).toBe(false);
  });

  it("the constant-time comparison refuses a length mismatch instead of throwing", () => {
    // `crypto.timingSafeEqual` throws on differing lengths, which would turn a
    // malformed verifier into a 500. The guard is why this wrapper exists.
    expect(verifiersEqual(Buffer.alloc(32, 1), Buffer.alloc(16, 1))).toBe(false);
    expect(verifiersEqual(Buffer.alloc(32, 1), Buffer.alloc(32, 1))).toBe(true);
  });
});

describe("the link puts the token in the FRAGMENT — INV-010", () => {
  it("builds <origin>/external/review#<token> and nothing else", () => {
    const token = newSecret();
    const url = buildReviewLink(token);
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://app.example");
    expect(parsed.pathname).toBe("/external/review");
    // THE THREE ASSERTIONS THAT MATTER. A browser never sends the fragment, so
    // an email scanner's GET carries no token and consumes nothing. A token in
    // the path or the query would be in access logs, in Referer headers, in CDN
    // caches and in the server's own request line — and the prefetch would BE
    // the consumption.
    expect(parsed.hash).toBe(`#${token}`);
    expect(parsed.search).toBe("");
    expect(parsed.pathname).not.toContain(token);
  });

  it("refuses a plaintext origin that is not localhost", () => {
    process.env.EXTERNAL_LINK_ORIGIN = "http://app.example";
    expect(() => buildReviewLink(newSecret())).toThrow(/https/);
  });

  it("refuses to build a link when no origin is configured", () => {
    delete process.env.EXTERNAL_LINK_ORIGIN;
    expect(() => buildReviewLink(newSecret())).toThrow(/EXTERNAL_LINK_ORIGIN/);
    expect(() => allowedExternalOrigin()).toThrow(/EXTERNAL_LINK_ORIGIN/);
  });

  it("normalises a trailing slash so the Origin comparison cannot drift", () => {
    process.env.EXTERNAL_LINK_ORIGIN = "https://app.example/";
    // The exchange compares `Origin` for EQUALITY against this value; a trailing
    // slash would make every legitimate browser request fail.
    expect(allowedExternalOrigin()).toBe("https://app.example");
    expect(new URL(buildReviewLink("x".repeat(43))).origin).toBe("https://app.example");
  });
});

describe("the session cookie", () => {
  it("carries __Host-, Secure, HttpOnly, SameSite=Lax, Path=/ and no Domain", () => {
    const c = externalSessionCookie("a".repeat(43));
    expect(EXTERNAL_SESSION_COOKIE).toBe("__Host-goproceed_external");
    expect(c.startsWith("__Host-goproceed_external=")).toBe(true);
    expect(c).toContain("Path=/");
    expect(c).toContain("Secure");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    // `__Host-` FORBIDS Domain. A cookie with one is rejected by the browser
    // outright, so a Domain attribute here would not be a weakening — it would
    // be an outage that looks like a login loop.
    expect(c).not.toContain("Domain");
  });

  it("expires with the ABSOLUTE ceiling and not with the idle window", () => {
    expect(EXTERNAL_SESSION_IDLE_SECONDS).toBe(30 * 60);
    expect(EXTERNAL_SESSION_ABSOLUTE_SECONDS).toBe(12 * 60 * 60);
    // A cookie bounded by the idle window would be discarded by the browser
    // while the server still considered the session live, which reads to a
    // reviewer as a broken link. The idle window is enforced server-side, where
    // it can slide.
    expect(externalSessionCookie("b".repeat(43)))
      .toContain(`Max-Age=${EXTERNAL_SESSION_ABSOLUTE_SECONDS}`);
  });

  it("reads only its own cookie, and only a well-formed value", () => {
    const value = newSecret();
    const req = (cookie: string) => new Request("https://app.example/x", { headers: { cookie } });
    expect(readExternalSessionCookie(
      req(`other=1; ${EXTERNAL_SESSION_COOKIE}=${value}; third=2`))).toBe(value);
    expect(readExternalSessionCookie(req("other=1"))).toBeNull();
    expect(readExternalSessionCookie(new Request("https://app.example/x"))).toBeNull();
    // A malformed value is NOT passed through to the database lookup. It cannot
    // match anything, but a lookup that never happens is a lookup that cannot be
    // timed.
    expect(readExternalSessionCookie(req(`${EXTERNAL_SESSION_COOKIE}=short`))).toBeNull();
    expect(readExternalSessionCookie(
      req(`${EXTERNAL_SESSION_COOKIE}=${"a".repeat(44)}`))).toBeNull();
    // A cookie whose NAME merely ends with ours must not be read as ours.
    expect(readExternalSessionCookie(
      req(`x__Host-goproceed_external=${value}`))).toBeNull();
  });

  it("clears with the same attributes, so the browser matches the cookie it set", () => {
    const cleared = clearedExternalSessionCookie();
    for (const attr of ["Path=/", "Secure", "HttpOnly", "SameSite=Lax", "Max-Age=0"]) {
      expect(cleared).toContain(attr);
    }
  });
});

describe("browser policy", () => {
  it("denies everything by default and adds back only the nonced script", () => {
    const h = externalSecurityHeaders("NONCE123");
    const csp = h["content-security-policy"]!;
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'nonce-NONCE123'");
    // The three that decide whether a token-bearing URL can leave: no
    // third-party connection, no off-origin form target, no framing.
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    // `'unsafe-inline'` in script-src would make the nonce decorative and would
    // admit an injected script. `'unsafe-eval'` the same.
    expect(csp).not.toContain("'unsafe-inline'; script");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toContain("'unsafe-eval'");
    // No third-party host may appear anywhere in the policy.
    expect(csp).not.toMatch(/https?:\/\//);
  });

  it("sets no-referrer, no-store and the two sniffing/framing headers", () => {
    const h = externalSecurityHeaders("N");
    expect(h["referrer-policy"]).toBe("no-referrer");
    expect(h["cache-control"]).toContain("no-store");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
  });

  it("names the CSRF header once, in the constant both sides read", () => {
    // The server checks this header and the shell writes it; both read this
    // constant, so a rename cannot make one of them silently stop checking.
    expect(EXTERNAL_CSRF_HEADER).toBe("x-goproceed-external-csrf");
  });
});

describe("the words the reviewer submits under", () => {
  it("prints the ladder's level-3 denial byte for byte from the ACT RENDERER's constant", () => {
    // NOT a second transcription. `apps/app/tests/act-content-fidelity.test.ts`
    // already compares `LEVEL_3_NOT_A_SIGNATURE_TEXT` byte for byte against the
    // Approved `docs/product/hidden-works-content-rules.md`; importing it here
    // means the reviewer's screen and the printed act carry the SAME string, and
    // that one fidelity suite governs both. A copy pasted into this file would
    // make both green while they drifted apart.
    expect(EXTERNAL_NOT_A_SIGNATURE).toBe(LEVEL_3_NOT_A_SIGNATURE_TEXT);
    expect(Buffer.from(EXTERNAL_NOT_A_SIGNATURE, "utf8")
      .equals(Buffer.from(LEVEL_3_NOT_A_SIGNATURE_TEXT, "utf8"))).toBe(true);
  });

  it("states the level in the LADDER'S OWN label, read out of the Approved table", () => {
    // Not a literal. `assuranceLadder()` parses the table in
    // `hidden-works-content-rules.md`; if row 3's label ever changes, this fails
    // here and the act renderer's `ASSURANCE_LEVEL_LABEL` fails in
    // `act-content-fidelity.test.ts`. Both are supposed to.
    const level3 = assuranceLadder().find((l) => l.level === 3);
    expect(level3).toBeDefined();
    expect(EXTERNAL_LEVEL_STATEMENT).toBe(`Рівень підтвердження: ${level3!.label}.`);
    // Prohibition S, by construction: no level below 4 has «підпис» in its name.
    expect(level3!.label).not.toContain("підпис");
  });

  it("the level-3 denial is BYTE-IDENTICAL to the blockquote that mandates it", () => {
    // A THIRD, INDEPENDENT READ, and the strongest of the three: it does not go
    // through the renderer at all. `requiredDisclaimers()` returns the
    // blockquotes of §"Required disclaimers" with their introductions; the
    // level-3 denial is the one introduced «for level 3 only, immediately after
    // it». Comparing BYTES rather than `===` is the M4 rule and it is the rule
    // here: a Latin «c» in «підпис», a NO-BREAK SPACE or a different apostrophe
    // reads identically and is a different string on a regulated surface.
    const mandated = requiredDisclaimers()
      .find((d) => d.introduction.includes("level 3 only"));
    expect(mandated).toBeDefined();
    const ours = Buffer.from(EXTERNAL_NOT_A_SIGNATURE, "utf8");
    const theirs = Buffer.from(mandated!.body, "utf8");
    if (!ours.equals(theirs)) {
      // A first-difference reporter, because otherwise the failure looks like a
      // broken test rather than like a content defect.
      const n = Math.min(ours.length, theirs.length);
      let at = n;
      for (let i = 0; i < n; i += 1) if (ours[i] !== theirs[i]) { at = i; break; }
      throw new Error(
        `level-3 denial differs at byte ${at}: product `
        + `U+${(EXTERNAL_NOT_A_SIGNATURE.codePointAt(at) ?? 0).toString(16)} vs document `
        + `U+${(mandated!.body.codePointAt(at) ?? 0).toString(16)}`);
    }
    expect(ours.equals(theirs)).toBe(true);
  });

  it("asserts nothing legal about the confirmation", () => {
    // `hidden-works-content-rules.md` files «підтвердження за посиланням є
    // допустимим доказом» as UNVERIFIED and records that three canonical
    // documents had to be corrected for stating it flatly. This sentence must
    // not join them.
    for (const banned of ["допустим", "доказ", "електронний підпис є",
                          "має юридичну силу", "юридичн"]) {
      expect(EXTERNAL_CONFIRMATION_TEXT).not.toContain(banned);
    }
    // Prohibition S: «підпис» appears in the DENIAL and must not appear in the
    // confirmation, where it would read as a claim rather than as a refusal.
    expect(EXTERNAL_CONFIRMATION_TEXT).not.toContain("підпис");
  });

  it("binds the version id to a digest of the exact wording", () => {
    const expected = createHash("sha256")
      .update([EXTERNAL_CONFIRMATION_TEXT, EXTERNAL_LEVEL_STATEMENT,
               EXTERNAL_NOT_A_SIGNATURE].join("\n"), "utf8")
      .digest("hex").slice(0, 12);
    expect(EXTERNAL_CONFIRMATION_TEXT_VERSION).toBe(`external-occurrence-decision/1+${expected}`);
    // THE PROPERTY THIS EXISTS FOR: change any of the three strings and the id
    // changes with it, so a receipt written under the old wording can never be
    // read as having been taken under the new one. A plain literal version would
    // have let both claim the same confirmation.
    const drifted = createHash("sha256")
      .update([EXTERNAL_CONFIRMATION_TEXT + ".", EXTERNAL_LEVEL_STATEMENT,
               EXTERNAL_NOT_A_SIGNATURE].join("\n"), "utf8")
      .digest("hex").slice(0, 12);
    expect(drifted).not.toBe(expected);
  });
});

describe("the receipt hash", () => {
  it("is order-independent over its fields", () => {
    const a = receiptHash({ b: 2, a: 1, c: "x" });
    const b = receiptHash({ c: "x", a: 1, b: 2 });
    expect(a.equals(b)).toBe(true);
  });

  it("changes when any field changes", () => {
    const base = receiptHash({ a: 1, b: "x" });
    expect(receiptHash({ a: 2, b: "x" }).equals(base)).toBe(false);
    expect(receiptHash({ a: 1, b: "y" }).equals(base)).toBe(false);
    expect(receiptHash({ a: 1, b: "x", c: null }).equals(base)).toBe(false);
  });

  it("is a plain SHA-256 and not a keyed digest", () => {
    // A keyed digest is something only the server can produce, which is one
    // property away from a signature — and ladder level 3 must not produce
    // anything that looks like one (prohibition S). Recomputable by anyone
    // holding the receipt's fields is the correct property here.
    const fields = { a: 1, b: "x" };
    const canonical = JSON.stringify(fields, Object.keys(fields).sort());
    expect(receiptHash(fields).equals(
      createHash("sha256").update(canonical, "utf8").digest())).toBe(true);
  });

  it("is 32 bytes, which is what the column's CHECK admits", () => {
    expect(receiptHash({ a: 1 })).toHaveLength(32);
  });
});
