// PORT of apps/app/src/lib/capture/hash.ts — same exported name, signature,
// and output, adapted for the one delta the platform forces: no `crypto.
// subtle` global exists on native RN, so this goes through expo-crypto's
// `Crypto.digest` instead of calling `crypto.subtle.digest` directly.
// Verified against expo-crypto@57.0.1 (the version installed here — see
// `package.json`) and https://docs.expo.dev/versions/v57.0.0/sdk/crypto,
// read 2026-08-20: `digest(algorithm, data)` takes a `BufferSource` (an
// `ArrayBuffer` qualifies) and resolves an `ArrayBuffer`, matching this
// function's own signature with no extra copy or view needed.
//
// ON WEB — this build's actual target today (AGENTS.md; `src/screens/
// capture.tsx`'s own header) — expo-crypto's own web implementation
// (`node_modules/expo-crypto/build/ExpoCrypto.web.js`, read 2026-08-20) does
// exactly `crypto.subtle.digest(algorithm, data)` under the hood. So on the
// one platform this client ships on today, this function computes the exact
// same digest the source's `crypto.subtle.digest("SHA-256", bytes)` does —
// the indirection through expo-crypto exists only so the same call also
// resolves on a real device once the native path (see capture.tsx's TODO)
// lands.
//
// NOT UNIT TESTED HERE, unlike recover.ts/upload.ts/obligations.ts.
// Importing `expo-crypto` pulls in `expo-modules-core` → `react-native`,
// and `react-native`'s own entry point (`import typeof * as
// ReactNativePublicAPI from …`, Flow syntax) fails to parse under this
// package's plain-Node `vitest.config.ts` — verified directly against this
// repo's installed `react-native@0.86.2`, not assumed. `upload.ts` takes its
// hasher as a REQUIRED, no-default parameter for exactly this reason: no
// module reachable from this package's test suite may import this file, so
// `src/screens/capture.tsx` (the one real call site, never exercised by
// `vitest`) is where `sha256Hex` and `uploadCapture` are actually wired
// together.
import * as Crypto from "expo-crypto";

/**
 * The client-computed content hash of ADR-007 decision 5 — the one provenance
 * claim v0.1 makes. It binds the UPLOADED ARTIFACT and not the sensor output:
 * the platform may transcode before this function ever sees the bytes, so no
 * copy anywhere may describe it as binding what the camera produced.
 */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
