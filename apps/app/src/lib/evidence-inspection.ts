export type InspectionOutcome = "passed" | "not_required" | "blocked";

export interface InspectionResult {
  outcome: InspectionOutcome;
  /** What the bytes actually are, as far as sniffing can tell. */
  detectedMediaType: string | null;
  failureCode: string | null;
  policyVersion: string;
}

/**
 * The policy a recorded inspection ran under. `-1` was the magic-byte check
 * alone; `-2` adds the image size limits below (BL-088, DEV-033). Rows keep
 * the version they were inspected under.
 */
export const INSPECTION_POLICY_VERSION = "m2a-magic-bytes-2";

/**
 * IMAGE SIZE LIMITS, READ FROM THE HEADER, NEVER BY DECODING (BL-088).
 *
 * `files-and-storage.md` «Content validation and malware boundary» requires
 * «image dimension/pixel-count and decoding-resource limits» before an object
 * becomes available. The bucket's byte limit does not bound a bitmap: a few
 * kilobytes of PNG or JPEG can declare a frame that decodes to gigabytes in
 * the office member's or reviewer's browser, the moment the evidence card or
 * the review page shows it.
 *
 * The limits admit the largest captures a phone makes — a 200 MP frame
 * (16,320 × 12,240) and a 63 MP panorama (about 16,600 px wide) — and bound
 * what a decoder must allocate (DEV-033 records the sources):
 *
 * - MAX_IMAGE_PIXELS is 0x3FFF × 0x3FFF, sharp/libvips' default
 *   `limitInputPixels`, so a later server-side thumbnail worker can decode
 *   everything admitted today;
 * - MAX_IMAGE_EDGE_PX is JPEG's own format maximum; an edge limit guards no
 *   memory the pixel limit does not, and a lower one refuses panoramas.
 */
export const MAX_IMAGE_EDGE_PX = 65_535;
export const MAX_IMAGE_PIXELS = 268_402_689;

/** Parsing is linear in the file and bounded in structure (libheif allows 1,000 items). */
const MAX_STRUCTURE_ENTRIES = 1_000;

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

export interface ImageDimensions { width: number; height: number }

const u16be = (b: Uint8Array, at: number) => (b[at]! << 8) | b[at + 1]!;
const u32be = (b: Uint8Array, at: number) => ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!;
/** An unsigned big-endian integer of 0, 4 or 8 bytes, or null if it does not fit a safe integer. */
function uintBE(b: Uint8Array, at: number, size: number): number | null {
  if (size === 0) return 0;
  if (size === 4) return u32be(b, at);
  if (size === 8) return u32be(b, at) === 0 ? u32be(b, at + 4) : null;
  return null;
}

function largest(found: ImageDimensions[]): ImageDimensions | null {
  if (found.length === 0) return null;
  const size = {
    width: Math.max(...found.map((d) => d.width)),
    height: Math.max(...found.map((d) => d.height)),
  };
  // A zero edge is no size at all (JPEG's DNL case, which libjpeg-turbo does not decode).
  return size.width > 0 && size.height > 0 ? size : null;
}

/**
 * The declared pixel size of an image, from its header alone, or null when
 * none can be read. It walks each format's STRUCTURE the way a decoder does,
 * and returns null — which the caller treats as a refusal — where that
 * structure breaks, rather than guessing past it.
 *
 * - JPEG: segment by segment from SOI, as libjpeg does: fill bytes and stray
 *   bytes before a marker are skipped, each segment is skipped by its length,
 *   up to the first scan (SOS). Exactly one start-of-frame segment (FFC0–FFCF
 *   but FFC4 DHT, FFC8 JPG, FFCC DAC) must come before it; libjpeg refuses a
 *   second. NOT a raw byte scan: EXIF maker notes, ICC profiles and a Motion
 *   Photo's appended video hold arbitrary bytes, and a random FF Cx there
 *   would read as a frame of any size and refuse an ordinary photo. Nothing
 *   after the scan is read.
 * - PNG: the IHDR chunk, which must be the first chunk (a decoder rejects the
 *   file otherwise).
 * - HEIC: the largest of every `ispe` (image spatial extents) property in
 *   `meta` → `iprp` → `ipco`, and of every grid (`grid`) item's declared
 *   output size, read from its data through `iinf`, `iloc` and `idat` — a
 *   decoder allocates the grid by that, whatever its `ispe` says. HEIF
 *   requires an `ispe` on every image item. An overlay (`iovl`) item is read
 *   likewise. Boxes are walked by their sizes; `mdat` and a Motion Photo's
 *   `mpvd` are never read as boxes.
 */
export function imageDimensions(bytes: Uint8Array, mediaType: string): ImageDimensions | null {
  if (mediaType === "image/jpeg") return jpegDimensions(bytes);
  if (mediaType === "image/png") {
    return bytes.length >= 24 && ascii(bytes, "IHDR", 12)
      ? largest([{ width: u32be(bytes, 16), height: u32be(bytes, 20) }]) : null;
  }
  if (mediaType === "image/heic") return heicDimensions(bytes);
  return null;
}

function jpegDimensions(b: Uint8Array): ImageDimensions | null {
  const frames: ImageDimensions[] = [];
  let i = 2; // after SOI
  for (let segments = 0; segments < MAX_STRUCTURE_ENTRIES; segments++) {
    while (i < b.length && b[i] !== 0xff) i++; // stray bytes before a marker
    while (i < b.length && b[i] === 0xff) i++; // fill bytes
    if (i >= b.length) return null;
    const m = b[i]!;
    i++;
    if (m === 0x00 || m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) continue; // no length
    if (m === 0xd9 || m === 0xda) return frames.length === 1 ? largest(frames) : null; // EOI, or the first scan
    if (i + 2 > b.length) return null;
    const len = u16be(b, i);
    if (len < 2 || i + len > b.length) return null;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      if (len < 8) return null;
      frames.push({ height: u16be(b, i + 3), width: u16be(b, i + 5) });
    }
    i += len;
  }
  return null;
}

/**
 * True when a PNG declares animation (an `acTL` chunk, which APNG requires
 * before the first IDAT). An animated PNG's frame count is not bounded by its
 * IHDR, and no field capture is animated, so it is refused.
 */
export function isAnimatedPng(b: Uint8Array): boolean {
  let i = 8;
  for (let n = 0; n < MAX_STRUCTURE_ENTRIES && i + 8 <= b.length; n++) {
    if (ascii(b, "acTL", i + 4)) return true;
    if (ascii(b, "IDAT", i + 4)) return false;
    i += 12 + u32be(b, i);
  }
  return false;
}

interface Box { type: string; start: number; end: number }

/** Boxes directly inside [from, to), or null if any size is malformed or there are too many. */
function boxes(b: Uint8Array, from: number, to: number): Box[] | null {
  const out: Box[] = [];
  let i = from;
  while (i + 8 <= to) {
    if (out.length >= MAX_STRUCTURE_ENTRIES) return null;
    let size = u32be(b, i);
    const type = String.fromCharCode(b[i + 4]!, b[i + 5]!, b[i + 6]!, b[i + 7]!);
    let header = 8;
    if (size === 1) {
      if (i + 16 > to) return null;
      const large = uintBE(b, i + 8, 8);
      if (large === null) return null; // a box of 4 GiB or more: not in an evidence file
      size = large;
      header = 16;
    } else if (size === 0) {
      size = to - i; // runs to the end of its container
    }
    if (size < header || i + size > to) return null;
    out.push({ type, start: i + header, end: i + size });
    i += size;
  }
  return i === to ? out : null;
}

const child = (list: Box[] | null, type: string) => list?.find((x) => x.type === type);

/** item_ID → item_type, from `iinf` (a full box) and its `infe` entries of version 2 or 3. */
function itemTypes(b: Uint8Array, iinf: Box): Map<number, string> | null {
  const version = b[iinf.start]!;
  const entriesAt = iinf.start + 4 + (version === 0 ? 2 : 4);
  const types = new Map<number, string>();
  for (const infe of boxes(b, entriesAt, iinf.end) ?? []) {
    if (infe.type !== "infe") continue;
    const v = b[infe.start]!;
    if (v < 2) continue; // no item_type before version 2
    const idSize = v === 2 ? 2 : 4;
    const at = infe.start + 4;
    if (at + idSize + 6 > infe.end) return null;
    const id = idSize === 2 ? u16be(b, at) : u32be(b, at);
    types.set(id, String.fromCharCode(...b.subarray(at + idSize + 2, at + idSize + 6)));
  }
  return types;
}

/** The first extent of each item, from `iloc`: { construction method, absolute or idat-relative offset, length }. */
function itemExtents(b: Uint8Array, iloc: Box): Map<number, { method: number; offset: number; length: number }> | null {
  const version = b[iloc.start]!;
  if (version > 2) return null;
  let i = iloc.start + 4;
  const offsetSize = b[i]! >> 4, lengthSize = b[i]! & 15, baseSize = b[i + 1]! >> 4;
  const indexSize = version === 0 ? 0 : b[i + 1]! & 15;
  i += 2;
  const count = version < 2 ? u16be(b, i) : u32be(b, i);
  i += version < 2 ? 2 : 4;
  if (count > MAX_STRUCTURE_ENTRIES) return null;
  const out = new Map<number, { method: number; offset: number; length: number }>();
  for (let n = 0; n < count; n++) {
    const id = version < 2 ? u16be(b, i) : u32be(b, i);
    i += version < 2 ? 2 : 4;
    const method = version === 0 ? 0 : u16be(b, i) & 15;
    if (version > 0) i += 2;
    i += 2; // data_reference_index
    const base = uintBE(b, i, baseSize);
    i += baseSize;
    const extents = u16be(b, i);
    i += 2;
    if (base === null || extents > MAX_STRUCTURE_ENTRIES) return null;
    for (let e = 0; e < extents; e++) {
      i += indexSize;
      const offset = uintBE(b, i, offsetSize);
      i += offsetSize;
      const length = uintBE(b, i, lengthSize);
      i += lengthSize;
      if (offset === null || length === null || i > iloc.end) return null;
      if (e === 0) out.set(id, { method, offset: base + offset, length });
    }
  }
  return i <= iloc.end ? out : null;
}

function heicDimensions(b: Uint8Array): ImageDimensions | null {
  const meta = child(boxes(b, 0, b.length), "meta");
  if (!meta || meta.end - meta.start < 4) return null;
  const inMeta = boxes(b, meta.start + 4, meta.end); // meta is a full box
  const ipco = child(boxes(b, child(inMeta, "iprp")?.start ?? 0, child(inMeta, "iprp")?.end ?? 0), "ipco");
  const props = ipco ? boxes(b, ipco.start, ipco.end) : null;
  if (!props) return null;
  const found: ImageDimensions[] = [];
  for (const p of props) {
    if (p.type !== "ispe") continue;
    if (p.end - p.start < 12) return null;
    found.push({ width: u32be(b, p.start + 4), height: u32be(b, p.start + 8) });
  }
  // Derived images: a decoder allocates a grid or an overlay by its own declared output size.
  const iinf = child(inMeta, "iinf");
  const types = iinf ? itemTypes(b, iinf) : new Map<number, string>();
  if (types === null) return null;
  const derived = [...types].filter(([, t]) => t === "grid" || t === "iovl");
  if (derived.length > 0) {
    const iloc = child(inMeta, "iloc");
    const extents = iloc ? itemExtents(b, iloc) : null;
    const idat = child(inMeta, "idat");
    if (!extents) return null;
    for (const [id, type] of derived) {
      const ext = extents.get(id);
      if (!ext) return null;
      const at = ext.method === 1 ? (idat ? idat.start + ext.offset : -1) : ext.method === 0 ? ext.offset : -1;
      const end = at + ext.length;
      if (at < 0 || end > (ext.method === 1 ? idat!.end : b.length)) return null;
      const wide = (b[at + 1]! & 1) === 1; // flags bit 0: 32-bit output sizes
      const sizeAt = at + 2 + (type === "grid" ? 2 : 8); // grid: rows, columns; overlay: four 16-bit fill values
      const need = sizeAt + (wide ? 8 : 4);
      if (need > end) return null;
      found.push(wide
        ? { width: u32be(b, sizeAt), height: u32be(b, sizeAt + 4) }
        : { width: u16be(b, sizeAt), height: u16be(b, sizeAt + 2) });
    }
  }
  return largest(found);
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
  if (detected.startsWith("image/")) {
    const size = imageDimensions(bytes, detected);
    // Fails closed: an image whose size cannot be read is one a decoder might
    // still size differently, so it never becomes available.
    const failureCode = size === null ? "image_dimensions_unreadable"
      : size.width > MAX_IMAGE_EDGE_PX || size.height > MAX_IMAGE_EDGE_PX
        || size.width * size.height > MAX_IMAGE_PIXELS ? "image_dimensions_exceeded"
      : detected === "image/png" && isAnimatedPng(bytes) ? "image_animated"
      : null;
    if (failureCode !== null) {
      return { outcome: "blocked", detectedMediaType: detected, failureCode, policyVersion: INSPECTION_POLICY_VERSION };
    }
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
