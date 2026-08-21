// PORT of apps/app/src/lib/safe-next.ts — byte-identical logic and copy. Transitional duplication under ADR-009: the PWA original retires when the Expo client passes the parity gate; until then fix bugs in BOTH files.

/**
 * Turns an untrusted `next` query-string value into either a same-origin
 * path safe to hand to `router.replace`, or `"/"`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY RESOLUTION, NOT PREFIX MATCHING (fix-round-1, task 5)
 *
 * The first version of this guard was string-prefix matching: reject
 * anything that doesn't start with exactly one `/`. It rejected
 * `//evil.example` (protocol-relative — an extra leading slash IS an
 * authority declaration) and `https://evil.example`, and looked complete.
 *
 * It was not. `/\evil.example` — one leading slash, then a BACKSLASH — sailed
 * straight through: it starts with `/`, and the second character isn't a
 * second `/`, so the string check waved it on. But `router.replace(href)` in
 * Next's client router does not treat that string as a literal path; it
 * resolves it with `new URL(href, location.href)`, and the WHATWG URL spec
 * normalises a backslash to a forward slash for special (http/https)
 * schemes — precisely so that browsers keep treating "IE-style" backslash
 * paths as slashes for compatibility. `new URL("/\\evil.example",
 * "http://localhost:3000").origin` is `"http://evil.example"`. The string
 * check saw one slash and stopped looking; the URL parser the router
 * actually uses saw an authority.
 *
 * A crafted `…/login?next=%2F%5Cevil.example` — a link to the REAL login
 * page, on the real domain, nothing about the link itself looks wrong —
 * decodes to exactly that string. A foreman trusts the domain, receives and
 * types their genuine one-time code, authenticates, and `router.replace`
 * bounces them to `evil.example` the instant they succeed.
 *
 * The fix is not "add a backslash check": that only re-opens the same hole
 * for whatever the next encoding trick turns out to be (URL parsers have a
 * long history of these — mixed slash counts, `\t`/`\n` stripped from the
 * scheme, IDNA tricks, and so on). Instead this resolves the candidate with
 * the SAME algorithm the router will actually use (`new URL`) against the
 * page's real origin, and accepts it only if the resulting origin is
 * byte-identical to that origin. Whatever the input's syntax, if resolving
 * it lands somewhere else, it is rejected — by construction, not by
 * enumeration.
 *
 * `origin` is a required parameter, not read from `window` in here: this
 * file has no DOM access at module scope, on purpose, so `safe-next.test.ts`
 * can exercise it under plain Node `vitest` with no browser environment.
 * The one real call site (`otp-form.tsx`) passes `window.location.origin`.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function safeNext(next: string | null | undefined, origin: string): string {
  if (!next) return "/";

  let resolved: URL;
  try {
    resolved = new URL(next, origin);
  } catch {
    // Some inputs (e.g. a bare "http://") throw rather than resolve to
    // something with a comparable origin. Falling back is correct here:
    // this function's only job is "safe path or '/'", never an exception
    // escaping a form-submit handler.
    return "/";
  }

  if (resolved.origin !== origin) return "/";

  // Only the path/query/fragment survive, and only once resolution has
  // already proved they sit on OUR origin — never the raw input, which is
  // exactly what let `/\evil.example` (unresolved) look harmless.
  return resolved.pathname + resolved.search + resolved.hash;
}
