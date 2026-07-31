export type InspectionOutcome = "passed" | "not_required" | "blocked";

export interface InspectionResult {
  outcome: InspectionOutcome;
  /** What the bytes actually are, as far as sniffing can tell. */
  detectedMediaType: string | null;
  failureCode: string | null;
  policyVersion: string;
}

export const INSPECTION_POLICY_VERSION = "m2a-magic-bytes-1";

const starts = (b: Uint8Array, sig: readonly number[], at = 0): boolean =>
  b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);

const ascii = (b: Uint8Array, s: string, at = 0): boolean =>
  starts(b, [...s].map((ch) => ch.charCodeAt(0)), at);

/**
 * Media type from the bytes themselves. Filenames and client-declared types are
 * untrusted metadata (docs/architecture/files-and-storage.md), so the only
 * evidence of what a file is, is the file.
 */
export function sniffMediaType(bytes: Uint8Array): string | null {
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, "%PDF")) return "application/pdf";
  // ISO base media: the brand sits at offset 8, after the 'ftyp' box header.
  if (ascii(bytes, "ftyp", 4)) {
    for (const brand of ["heic", "heix", "hevc", "hevx", "mif1", "msf1"]) {
      if (ascii(bytes, brand, 8)) return "image/heic";
    }
  }
  return null;
}

/**
 * v0.1 ships no anti-malware engine, and this does not pretend otherwise.
 *
 * What it does do is refuse to take the client's word for what the bytes are.
 * An earlier revision re-read the claimed MIME string and recorded
 * inspection_status = 'passed' on the strength of it — false provenance rather
 * than a safe stub (engineering review, finding D7). Sniffing the magic bytes
 * and requiring them to agree with the claim makes 'passed' mean something
 * modest but true: the bytes are of a recognised type, and that type is the one
 * the upload was authorized for.
 *
 * Real content scanning stays out of scope and is named as such in the spec.
 */
function defaultInspector(bytes: Uint8Array, claimedMediaType: string): InspectionResult {
  const detected = sniffMediaType(bytes);
  if (detected === null) {
    return {
      outcome: "blocked", detectedMediaType: null,
      failureCode: "unrecognised_content", policyVersion: INSPECTION_POLICY_VERSION,
    };
  }
  if (detected !== claimedMediaType) {
    return {
      outcome: "blocked", detectedMediaType: detected,
      failureCode: "declared_type_mismatch", policyVersion: INSPECTION_POLICY_VERSION,
    };
  }
  return {
    outcome: "passed", detectedMediaType: detected,
    failureCode: null, policyVersion: INSPECTION_POLICY_VERSION,
  };
}

type Inspector = (bytes: Uint8Array, claimedMediaType: string)
  => InspectionResult | Promise<InspectionResult>;

let inspector: Inspector = defaultInspector;

/** Tests inject a blocking inspector to exercise the scan_blocked branch. */
export function setInspector(fn: Inspector): void { inspector = fn; }
export function resetInspector(): void { inspector = defaultInspector; }

export function inspectContent(
  bytes: Uint8Array, claimedMediaType: string,
): Promise<InspectionResult> {
  return Promise.resolve(inspector(bytes, claimedMediaType));
}
