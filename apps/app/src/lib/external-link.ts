import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  ASSURANCE_LEVEL_LABEL, LEVEL_3_NOT_A_SIGNATURE_TEXT, assuranceLevelOf,
} from "./statutory-act-form";

/**
 * The bearer link's cryptography, its key registry, its cookie, and the exact
 * words a технагляд submits under (v0.1-M5).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS AND IS NOT A SECRET HERE
 *
 * Three secrets exist and none of them is ever stored:
 *
 *   * the GRANT TOKEN — 256 bits, base64url, delivered only in a URL fragment.
 *     `HMAC-SHA-256(link key, token)` is stored, with the id of the key that
 *     computed it (INV-044);
 *   * the SESSION VALUE — 256 bits, the opaque contents of the
 *     `__Host-goproceed_external` cookie. Its HMAC is stored;
 *   * the CSRF TOKEN — 256 bits, returned in the exchange BODY so the page's own
 *     script can echo it in a header. Its HMAC is stored (INV-058).
 *
 * Two keyed families, two key ids, both rotatable without re-deriving anything:
 * a verifier is checked against the key its own row names, and new verifiers are
 * written with whichever key is currently active.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * «NOTHING HERE WAS EXECUTED. No test has been run against this file; the only
 * check performed on it is `node --experimental-strip-types --check`, which
 * PARSES and does not typecheck.» — RETRACTED 2026-08-22 (Plan D slice D1
 * final fix wave), and retracted rather than edited because it was
 * load-bearing: a header telling its next reader that the module holding this
 * product's HMAC registry is unexercised invites them to distrust it, or to
 * rewrite it without a safety net, on a claim that is no longer true.
 *
 * WHAT EXERCISES IT NOW, named so the claim can be re-checked rather than
 * taken:
 *
 *   * `src/lib/external-link.test.ts` — 29 tests, in the app suite, over the
 *     key registry, `signWithActiveKey`/`verifyAgainstAnyKey`,
 *     `readExternalSessionCookie`, `externalSecurityHeaders` and the mandated
 *     submission strings;
 *   * `tests/m5-external.int.test.ts` and `tests/external-evidence.int.test.ts`
 *     — both drive the real external routes against a live database, so the
 *     token HMAC, the `__Host-` cookie and the CSP header run end to end;
 *   * `qa/field.mjs`'s seventh audit — a real browser, a second context with an
 *     empty cookie jar, opening a real link.
 *
 * What is still unexercised is narrower and named where it lives: the DECIDE
 * path (`app/external/review/route.ts`'s own header — that audit issues a
 * view-only grant, so the submission this file's mandated strings sit above has
 * never been pressed in a browser).
 */

/* ── key registry ──────────────────────────────────────────────────────────── */

export interface KeyRegistry {
  activeKeyId: string;
  keys: Map<string, Buffer>;
}

/**
 * `EXTERNAL_LINK_HMAC_KEYS` / `EXTERNAL_SESSION_HMAC_KEYS`:
 *   `<keyId>:<base64 secret>[,<keyId>:<base64 secret>…]`
 * `EXTERNAL_LINK_ACTIVE_KEY_ID` / `EXTERNAL_SESSION_ACTIVE_KEY_ID`:
 *   which of them signs new material.
 *
 * IT THROWS RATHER THAN DEFAULTING. A default key would be a key in the source
 * tree, and a key in the source tree is a key in every deployment that forgot to
 * set one — the failure `supabase/seed.sql` was emptied to prevent
 * (`scripts/set-local-app-password.mjs`:1-6). A deployment with no external key
 * cannot issue a link, and that is the correct behaviour.
 *
 * The minimum length is 32 bytes because the output is 32 bytes: a 16-byte key
 * behind a 32-byte tag is a 16-byte secret wearing a larger number.
 */
function loadRegistry(keysVar: string, activeVar: string): KeyRegistry {
  const raw = process.env[keysVar];
  const activeKeyId = process.env[activeVar];
  if (!raw) throw new Error(`${keysVar} is not set`);
  if (!activeKeyId) throw new Error(`${activeVar} is not set`);
  const keys = new Map<string, Buffer>();
  // Errors name the entry by POSITION, never by key id: a list pasted in the
  // wrong order (`<secret>:k1`) puts the secret where the id belongs, and this
  // message reaches the server log (DEV-010).
  for (const [index, entry] of raw.split(",").entries()) {
    const at = entry.indexOf(":");
    if (at <= 0) throw new Error(`${keysVar} entry ${index + 1} is not <keyId>:<base64>`);
    const id = entry.slice(0, at).trim();
    const secret = Buffer.from(entry.slice(at + 1).trim(), "base64");
    if (id.length === 0) throw new Error(`${keysVar} entry ${index + 1} has an empty key id`);
    if (secret.length < 32) throw new Error(`${keysVar} entry ${index + 1} is shorter than 32 bytes`);
    keys.set(id, secret);
  }
  if (!keys.has(activeKeyId)) {
    throw new Error(`${activeVar} names a key that is not in ${keysVar}`);
  }
  return { activeKeyId, keys };
}

let linkRegistry: KeyRegistry | null = null;
let sessionRegistry: KeyRegistry | null = null;

export function linkKeys(): KeyRegistry {
  linkRegistry ??= loadRegistry("EXTERNAL_LINK_HMAC_KEYS", "EXTERNAL_LINK_ACTIVE_KEY_ID");
  return linkRegistry;
}
export function sessionKeys(): KeyRegistry {
  sessionRegistry ??= loadRegistry("EXTERNAL_SESSION_HMAC_KEYS", "EXTERNAL_SESSION_ACTIVE_KEY_ID");
  return sessionRegistry;
}
/** Test-only: the registries are process-lifetime singletons in the server. */
export function resetKeyRegistriesForTests(): void {
  linkRegistry = null;
  sessionRegistry = null;
}

/* ── secrets ───────────────────────────────────────────────────────────────── */

/**
 * 256 random bits, base64url, no padding — 43 characters, matching
 * `externalExchangeRequest.token`'s pattern.
 *
 * `randomBytes` and not `Math.random`, and not a uuid: a uuid is 122 bits of
 * entropy wearing 128, and tenancy-and-security.md §"Grant creation" item 1 says
 * 256 with a cryptographically secure generator.
 */
export function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hmacOf(registry: KeyRegistry, keyId: string, secret: string): Buffer {
  const key = registry.keys.get(keyId);
  if (!key) throw new Error(`unknown key id ${keyId}`);
  return createHmac("sha256", key).update(secret, "utf8").digest();
}

export function signWithActiveKey(
  registry: KeyRegistry, secret: string,
): { keyId: string; verifier: Buffer } {
  return { keyId: registry.activeKeyId, verifier: hmacOf(registry, registry.activeKeyId, secret) };
}

/**
 * `crypto.timingSafeEqual`, guarded on length because it throws on a mismatch.
 *
 * WHY THIS EXISTS WHEN THE ROW WAS FOUND BY AN INDEX PROBE. The lookup in
 * `app.exchange_external_grant` is `where hmac_key_id = $1 and token_hmac = $2`,
 * and a B-tree comparison is not constant time. It also cannot leak the raw
 * token — an attacker would have to already possess the HMAC to run it — but
 * tenancy-and-security.md §"Grant creation" item 4 says «compare verifiers in
 * constant time» and this is the comparison that does. Both layers run: the
 * index finds the candidate, this confirms it.
 */
export function verifiersEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Which of the candidate keys verifies this secret against a stored tag.
 * Returns the key id, or null. Used on rotation: a session written under key
 * `k1` keeps working while `k2` is active.
 */
export function verifyAgainstAnyKey(
  registry: KeyRegistry, secret: string, storedKeyId: string, stored: Buffer,
): boolean {
  if (!registry.keys.has(storedKeyId)) return false;
  return verifiersEqual(hmacOf(registry, storedKeyId, secret), stored);
}

/* ── the link ──────────────────────────────────────────────────────────────── */

/**
 * `<origin>/external/review#<token>`.
 *
 * THE FRAGMENT IS THE WHOLE OF INV-010. A browser never sends it, so the GET
 * that an email scanner, a link preview, a CDN or a health check performs
 * carries no token, reaches a shell that touches no table, and consumes nothing.
 * Putting the token in the path or the query would put it in access logs, in
 * `Referer` headers, in CDN caches and in the server's own request line — and
 * would make the prefetch a consumption.
 *
 * `EXTERNAL_LINK_ORIGIN` is required and is not derived from the request: a
 * link built from a `Host` header is a link an attacker can point at their own
 * origin by sending one.
 */
export function buildReviewLink(token: string): string {
  const origin = process.env.EXTERNAL_LINK_ORIGIN;
  if (!origin) throw new Error("EXTERNAL_LINK_ORIGIN is not set");
  const trimmed = origin.replace(/\/+$/, "");
  if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://localhost")) {
    throw new Error("EXTERNAL_LINK_ORIGIN must be https (or http://localhost for development)");
  }
  return `${trimmed}/external/review#${token}`;
}

/** Every origin an external POST may legitimately come from: exactly one. */
export function allowedExternalOrigin(): string {
  const origin = process.env.EXTERNAL_LINK_ORIGIN;
  if (!origin) throw new Error("EXTERNAL_LINK_ORIGIN is not set");
  return origin.replace(/\/+$/, "");
}

/* ── the cookie ────────────────────────────────────────────────────────────── */

/**
 * `__Host-` forbids `Domain` and requires `Secure` and `Path=/`, which is
 * exactly the shape tenancy-and-security.md §"External session cookie" asks
 * for: it cannot be set by a sibling subdomain and cannot be scoped away from
 * the origin that set it.
 *
 * ONE CONSEQUENCE THAT WAS STATED AND IS NOT TRUE — CORRECTED 2026-08-22.
 *
 * WHAT STOOD HERE: «`Secure` means a browser refuses this cookie over plain
 * `http`, so the external plane does not work on `http://localhost` in a real
 * browser… a developer clicking a link in a local browser is not [unaffected].»
 * That is the spec's rule for ordinary origins and it is NOT the rule browsers
 * apply to loopback, which is a potentially-trustworthy origin: Chrome accepts
 * a `Secure` cookie set over plain `http` from `localhost` and from
 * `127.0.0.1`. MEASURED, not recalled — a ten-line http server that sets this
 * exact cookie (`__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`) and
 * echoes the `Cookie` header back returned it on both spellings, on
 * Chrome 152.0.7977.42, before `qa/field.mjs`'s seventh audit was written
 * against it. That audit now opens a real link in a real browser over
 * `http://localhost:<port>` on every run, so the claim is checked rather than
 * argued.
 *
 * WHAT IS STILL TRUE, and is the reason the shape does not change: `__Host-`
 * forbids `Domain`, requires `Secure` and requires `Path=/`, so it cannot be
 * set by a sibling subdomain and cannot be scoped away from the origin that set
 * it. Dropping it in development would mean the thing under test is not the
 * thing that ships. What is not true is that it costs anything locally. A
 * browser on a NON-loopback plain-http origin does still refuse it, which is
 * correct: that is a deployment that must not be serving this plane at all.
 */
export const EXTERNAL_SESSION_COOKIE = "__Host-goproceed_external";

export const EXTERNAL_SESSION_IDLE_SECONDS = 30 * 60;
export const EXTERNAL_SESSION_ABSOLUTE_SECONDS = 12 * 60 * 60;

export function externalSessionCookie(value: string): string {
  return [
    `${EXTERNAL_SESSION_COOKIE}=${value}`,
    "Path=/",
    "Secure",
    "HttpOnly",
    "SameSite=Lax",
    // Bounded by the ABSOLUTE ceiling, not the idle window: a cookie that
    // outlived the absolute expiry would be a cookie the server rejects on
    // every request, which reads to a user as a broken link rather than as an
    // expired session. The idle window is enforced server-side, where it can be
    // slid.
    `Max-Age=${EXTERNAL_SESSION_ABSOLUTE_SECONDS}`,
  ].join("; ");
}

export function clearedExternalSessionCookie(): string {
  return `${EXTERNAL_SESSION_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readExternalSessionCookie(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at <= 0) continue;
    if (part.slice(0, at).trim() !== EXTERNAL_SESSION_COOKIE) continue;
    const value = part.slice(at + 1).trim();
    return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
  }
  return null;
}

/** The header the page echoes its synchronizer token in (INV-058). */
export const EXTERNAL_CSRF_HEADER = "x-goproceed-external-csrf";

/* ── browser policy ────────────────────────────────────────────────────────── */

/**
 * tenancy-and-security.md §"Browser policy", one header at a time.
 *
 * `default-src 'none'` and then nothing added back except a nonced inline
 * script and inline styles: no third-party script, frame, font, image,
 * analytics or error collector can receive the token-bearing URL, because none
 * can load at all. `connect-src 'self'` is the exchange POST and nothing else.
 * `form-action 'none'` matters more than it looks: without it a submit could
 * carry the fragment off-origin.
 */
export function externalSecurityHeaders(nonce: string): Record<string, string> {
  return {
    "content-security-policy": [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      "style-src 'unsafe-inline'",
      "connect-src 'self'",
      "img-src 'self' data:",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
    "referrer-policy": "no-referrer",
    "cache-control": "no-store, no-cache, must-revalidate, private",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  };
}

export function newCspNonce(): string {
  return randomBytes(16).toString("base64");
}

/* ── the words the reviewer submits under ──────────────────────────────────── */

/**
 * THE TWO MANDATED STRINGS ARE IMPORTED, NOT TRANSCRIBED.
 *
 * `docs/product/hidden-works-content-rules.md` §"Required disclaimers" mandates,
 * «Next to every rendered decision or signatory block», the level line, and «for
 * level 3 only, immediately after it» the denial. Both already exist as
 * constants in `statutory-act-form.ts`, and `act-content-fidelity.test.ts`
 * already compares them BYTE FOR BYTE against that Approved document. Writing a
 * second copy here would create exactly the drift that suite exists to catch —
 * the renderer and the reviewer's screen would be comparing themselves with
 * themselves.
 *
 * The order is the rule's: level, then denial.
 */
const EXTERNAL_LEVEL = assuranceLevelOf("LINK_CONFIRMATION");

export const EXTERNAL_LEVEL_STATEMENT =
  `Рівень підтвердження: ${EXTERNAL_LEVEL === null
    ? "" : ASSURANCE_LEVEL_LABEL[EXTERNAL_LEVEL]}.`;

export const EXTERNAL_NOT_A_SIGNATURE = LEVEL_3_NOT_A_SIGNATURE_TEXT;

/**
 * THE CONFIRMATION SENTENCE IS UNREVIEWED PRODUCT COPY, and it is the third time
 * this project has had to say so (`technical/copy-catalog.csv` carries no row
 * for the act render either — migration 0047 §11 item 11, progress §5 item 31).
 *
 * It is written to assert NOTHING legal. It does not say the confirmation is
 * admissible evidence: `hidden-works-content-rules.md` line 248 files
 * «підтвердження за посиланням є допустимим доказом» as **UNVERIFIED** and
 * records that three canonical documents had to be corrected for stating it
 * flatly. It says only what the mechanism is and what the person is doing, and
 * then prints the mandated negative statement, which asserts nothing and
 * therefore needs no source.
 */
export const EXTERNAL_CONFIRMATION_TEXT =
  "Я ознайомився з вимогою та доданими матеріалами і фіксую своє рішення щодо неї. "
  + "Моє імʼя, компанія та посада нижче — це відомості, які я повідомляю про себе; "
  + "вони не є підтвердженою особою.";

/**
 * The version id stored on every receipt, WITH A DIGEST OF THE TEXT INSIDE IT.
 *
 * A plain version literal would let the wording change while the id stayed put,
 * and every receipt written before and after would then claim the same
 * confirmation. Embedding the digest makes that impossible: change any of the
 * three strings and the id changes with it, which is the property
 * `confirmation_text_version` exists to have. The prefix is human-readable so a
 * receipt is legible without a lookup table.
 */
export const EXTERNAL_CONFIRMATION_TEXT_VERSION = (() => {
  const digest = createHash("sha256")
    .update([EXTERNAL_CONFIRMATION_TEXT, EXTERNAL_LEVEL_STATEMENT, EXTERNAL_NOT_A_SIGNATURE]
      .join(" "), "utf8")
    .digest("hex")
    .slice(0, 12);
  return `external-occurrence-decision/1+${digest}`;
})();

/**
 * The receipt hash. Over a key-sorted canonical serialisation, so it does not
 * depend on JavaScript's object key order — the same discipline
 * `statutory-act.ts` uses for `contentHash`, and for the same reason.
 *
 * IT IS DELIBERATELY NOT KEYED. A keyed digest is something only the server can
 * produce, which is one property away from a signature, and this product must
 * not produce anything that looks like one at ladder level 3 (prohibition S, and
 * the ladder's own standing rule that assurance is about the mechanism). A plain
 * SHA-256 tells a reader that the receipt they are holding is the receipt that
 * was written, and claims nothing else — which is exactly as much as
 * `LINK_CONFIRMATION` is allowed to claim.
 *
 * `fields` MUST BE FLAT. The array form of `JSON.stringify`'s replacer both
 * orders and FILTERS keys, and it applies the same key list at every depth — so
 * a nested object would silently lose any key not present at the top level. The
 * one caller passes strings and numbers only.
 */
export function receiptHash(fields: Record<string, string | number | boolean | null>): Buffer {
  const canonical = JSON.stringify(fields, Object.keys(fields).sort());
  return createHash("sha256").update(canonical, "utf8").digest();
}
