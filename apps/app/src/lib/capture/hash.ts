/**
 * The client-computed content hash of ADR-007 decision 5 — the one provenance
 * claim v0.1 makes. It binds the UPLOADED ARTIFACT and not the sensor output:
 * the browser may transcode before the page ever sees the bytes, so no copy
 * anywhere may describe it as binding what the camera produced.
 *
 * `crypto.subtle` requires a secure context, which is HTTPS or localhost.
 */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
