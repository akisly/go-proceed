/**
 * THE STORED CONTENT TYPE MUST BE EXACTLY THE RECORDED ONE (BL-089, DEV-032).
 *
 * Storage serves an evidence object with the type its upload PUT declared,
 * verbatim, and a signed read's `download=` flag is not signed, so a URL
 * holder can open the object inline. Finalization therefore refuses an object
 * whose stored type is not the type it records — and «is» has to be read the
 * way a browser reads a Content-Type (the Fetch standard's MIME parsing):
 *
 * - HTTP whitespace (space and tab) may surround the value and a `;`; nothing
 *   else counts as whitespace — not U+00A0, which JavaScript's `trim()`
 *   strips and a browser keeps (S3-01);
 * - ASCII case is folded, and only ASCII: the `i` flag without `u` never maps
 *   a non-ASCII character onto an ASCII letter;
 * - after the type, only plain `; name=value` parameters of token characters —
 *   no comma (a browser reads the last type of a list, and
 *   `image/jpeg;x=1, TEXT/HTML` rendered as HTML, S2-01), no quote;
 * - the expected type is matched as text: every regex metacharacter escaped.
 */
const TOKEN = "[A-Za-z0-9!#$&^_.+-]+";
const WS = "[ \\t]*";

export function storedTypeIs(stored: string | null, expected: string): boolean {
  if (stored === null) return false;
  const literal = expected.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`^${WS}${literal}(?:${WS};${WS}${TOKEN}=${TOKEN})*${WS}$`, "i").test(stored);
}
