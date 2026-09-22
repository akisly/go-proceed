import { describe, it, expect } from "vitest";
import {
  imageDimensions, isAnimatedPng, inspectContent, INSPECTION_POLICY_VERSION,
  MAX_IMAGE_EDGE_PX, MAX_IMAGE_PIXELS,
} from "./evidence-inspection";

// Header-only fixtures: the smallest byte sequences that carry each format's
// declared size where a decoder reads it. No pixel data — nothing here is
// ever decoded, which is the point of the check (BL-088).
const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** SOI, optional segments, then a start-of-frame segment of the given kind. */
function jpeg(w: number, h: number, { sof = 0xc0, before = [] as number[] } = {}): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, ...before,
    0xff, sof, ...u16(11), 8, ...u16(h), ...u16(w), 1, 1, 0x11, 0,
    0xff, 0xd9,
  ]);
}
/** An APP1 segment whose payload is a tiny JPEG thumbnail — as EXIF carries one. */
function app1With(inner: Uint8Array): number[] {
  return [0xff, 0xe1, ...u16(inner.length + 2), ...inner];
}
const chunk = (type: string, body: number[]) => [...u32(body.length), ...ascii(type), ...body, ...u32(0)];
const IDAT_IEND = [...chunk("IDAT", [0x78, 0x9c, 0x63, 0, 0, 0, 1, 0, 1]), ...chunk("IEND", [])];
/** Signature, the first chunk, `more`, then IDAT and IEND unless `tail` says otherwise. */
function png(w: number, h: number, firstChunk = "IHDR", more: number[] = [], tail: number[] = IDAT_IEND): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk(firstChunk, [...u32(w), ...u32(h), 8, 2, 0, 0, 0]), ...more, ...tail,
  ]);
}
const box = (type: string, body: number[]) => [...u32(8 + body.length), ...ascii(type), ...body];
const ispe = (w: number, h: number) => box("ispe", [0, 0, 0, 0, ...u32(w), ...u32(h)]);
/**
 * ftyp, then meta (a full box) → hdlr, iinf (item 1 of `gridType`, when a grid
 * is given), iloc (item 1's data in idat), idat (the ImageGrid), iprp → ipco
 * holding the ispe properties; then mdat.
 */
function heic(sizes: [number, number][], mdat: number[] = [],
  grid?: { w: number; h: number; type?: string }): Uint8Array {
  const gridData = grid ? [0, 1, 0, 0, ...u32(grid.w), ...u32(grid.h)] : []; // version 0, 32-bit fields, 1×1 tiles
  const items = grid ? [
    ...box("iinf", [0, 0, 0, 0, ...u16(1), ...box("infe", [2, 0, 0, 0, ...u16(1), ...u16(0), ...ascii(grid.type ?? "grid"), 0])]),
    // iloc v1: offset_size 4, length_size 4, base_offset_size 0, index_size 0; one item, construction_method 1 (idat)
    ...box("iloc", [1, 0, 0, 0, 0x44, 0x00, ...u16(1), ...u16(1), 0, 1, ...u16(0), ...u16(1), ...u32(0), ...u32(gridData.length)]),
    ...box("idat", gridData),
  ] : [];
  return new Uint8Array([
    ...box("ftyp", [...ascii("heic"), 0, 0, 0, 0, ...ascii("mif1"), ...ascii("heic")]),
    ...box("meta", [0, 0, 0, 0, ...box("hdlr", [0, 0, 0, 0, 0, 0, 0, 0, ...ascii("pict")]),
      ...items, ...box("iprp", box("ipco", sizes.flatMap(([w, h]) => ispe(w, h))))]),
    ...box("mdat", mdat),
  ]);
}

const u64 = (n: number) => [...u32(Math.floor(n / 2 ** 32)), ...u32(n >>> 0)];
const uint = (n: number, size: number) => (size === 0 ? [] : size === 4 ? u32(n) : size === 8 ? u64(n) : u16(n));

/**
 * A HEIC with one derived item (id 1) whose data the `iloc` locates, built in
 * any `iloc` layout, so each branch of the reader is exercised (R1-02).
 */
function heicDerived(o: {
  version?: 0 | 1 | 2; offsetSize?: 0 | 4 | 8; lengthSize?: 0 | 4 | 8; baseSize?: 0 | 4 | 8; indexSize?: 0 | 4 | 8;
  method?: 0 | 1; base?: number; type?: "grid" | "iovl"; data: number[]; ispe?: [number, number];
  iinfTrailing?: number[]; entryCount?: number; extraMeta?: number[]; topLevel?: number[]; duplicateItem?: boolean;
}): Uint8Array {
  const v = o.version ?? 1, os = o.offsetSize ?? 4, ls = o.lengthSize ?? 4, bs = o.baseSize ?? 0, is = o.indexSize ?? 0;
  const method = o.method ?? 1, base = o.base ?? 0;
  const infe = box("infe", [2, 0, 0, 0, ...u16(1), ...u16(0), ...ascii(o.type ?? "grid"), 0]);
  const iinf = box("iinf", [0, 0, 0, 0, ...u16(o.entryCount ?? 1), ...infe, ...(o.duplicateItem ? infe : []), ...(o.iinfTrailing ?? [])]);
  const ilocFor = (dataOffset: number) => {
    const item = [...(v < 2 ? u16(1) : u32(1)), ...(v > 0 ? u16(method) : []), ...u16(0), ...uint(base, bs), ...u16(1),
      ...(v > 0 && is > 0 ? uint(0, is) : []), ...uint(dataOffset - base, os), ...uint(o.data.length, ls)];
    const count = o.duplicateItem ? 2 : 1;
    return box("iloc", [v, 0, 0, 0, (os << 4) | ls, (bs << 4) | (v > 0 ? is : 0), ...(v < 2 ? u16(count) : u32(count)),
      ...item, ...(o.duplicateItem ? item : [])]);
  };
  const ftyp = box("ftyp", [...ascii("heic"), 0, 0, 0, 0, ...ascii("mif1"), ...ascii("heic")]);
  const [w, h] = o.ispe ?? [1000, 1000];
  const metaWith = (dataOffset: number) => box("meta", [0, 0, 0, 0, ...box("hdlr", [0, 0, 0, 0, 0, 0, 0, 0, ...ascii("pict")]),
    ...iinf, ...ilocFor(dataOffset), ...(method === 1 ? box("idat", o.data) : []),
    ...box("iprp", box("ipco", ispe(w, h))), ...(o.extraMeta ?? [])]);
  // Method 0 locates the data in the file: in mdat, after ftyp and meta (whose length does not depend on the offset).
  const fileOffset = ftyp.length + metaWith(0).length + (o.topLevel?.length ?? 0) + 8;
  return new Uint8Array([...ftyp, ...metaWith(method === 1 ? 0 : fileOffset), ...(o.topLevel ?? []),
    ...box("mdat", method === 0 ? o.data : [])]);
}
const grid32 = (w: number, h: number) => [0, 1, 0, 0, ...u32(w), ...u32(h)];

describe("imageDimensions: read from the header, never decoded (BL-088)", () => {
  it("reads a baseline and a progressive JPEG's frame size", () => {
    expect(imageDimensions(jpeg(4032, 3024), "image/jpeg")).toEqual({ width: 4032, height: 3024 });
    expect(imageDimensions(jpeg(640, 480, { sof: 0xc2 }), "image/jpeg")).toEqual({ width: 640, height: 480 });
  });

  it("walks segments: an EXIF thumbnail's frame and stray marker bytes inside a segment do not count", () => {
    // A decoder skips an APPn payload by its length, and so does this; a raw
    // byte scan would read random FF Cx pairs in EXIF or ICC data as frames.
    expect(imageDimensions(jpeg(8064, 6048, { before: app1With(jpeg(160, 120)) }), "image/jpeg"))
      .toEqual({ width: 8064, height: 6048 });
    expect(imageDimensions(jpeg(100, 100, { before: app1With(jpeg(60000, 60000)) }), "image/jpeg"))
      .toEqual({ width: 100, height: 100 });
  });

  it("skips fill bytes and stray bytes between markers, as libjpeg does", () => {
    const j = jpeg(640, 480);
    const withGarbage = new Uint8Array([0xff, 0xd8, 0x12, 0x34, 0xff, 0xff, ...j.subarray(2)]);
    expect(imageDimensions(withGarbage, "image/jpeg")).toEqual({ width: 640, height: 480 });
  });

  it("ignores anything after the image: a Motion Photo's appended video", () => {
    const video = [...ascii("ftypmp42"), 0xff, 0xc0, 0x00, 0x11, 8, 0x7f, 0xff, 0x7f, 0xff];
    expect(imageDimensions(new Uint8Array([...jpeg(4032, 3024), ...video]), "image/jpeg"))
      .toEqual({ width: 4032, height: 3024 });
  });

  it("reads nothing from two frames before the scan, or a zero-sized frame", () => {
    const two = new Uint8Array([...jpeg(10, 10).subarray(0, 15), ...jpeg(20, 20).subarray(2)]);
    expect(imageDimensions(two, "image/jpeg")).toBeNull();
    expect(imageDimensions(jpeg(0, 480), "image/jpeg")).toBeNull();
    expect(imageDimensions(png(0, 10), "image/png")).toBeNull();
  });

  it("reads nothing from a JPEG whose segment structure breaks before its frame", () => {
    // A segment length running past the end.
    expect(imageDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00]), "image/jpeg")).toBeNull();
    // A frame after the first scan is not the image's frame, and none before it is unreadable.
    expect(imageDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, ...jpeg(10, 10).subarray(2)]), "image/jpeg")).toBeNull();
  });

  it("does not mistake a DHT, JPG or DAC marker for a frame", () => {
    for (const marker of [0xc4, 0xc8, 0xcc]) {
      expect(imageDimensions(jpeg(100, 100, { sof: marker }), "image/jpeg")).toBeNull();
    }
  });

  it("reads PNG's IHDR only as the first chunk", () => {
    expect(imageDimensions(png(1170, 2532), "image/png")).toEqual({ width: 1170, height: 2532 });
    expect(imageDimensions(png(1170, 2532, "tEXt"), "image/png")).toBeNull();
  });

  it("takes the largest HEIC ispe property: a grid's full size beside its tiles", () => {
    expect(imageDimensions(heic([[512, 512], [4032, 3024], [512, 512]]), "image/heic"))
      .toEqual({ width: 4032, height: 3024 });
    expect(imageDimensions(heic([]), "image/heic")).toBeNull();
  });

  it("counts a HEIC grid's and overlay's declared output size beside its ispe", () => {
    expect(imageDimensions(heic([[1000, 1000]], [], { w: 60000, h: 60000 }), "image/heic"))
      .toEqual({ width: 60000, height: 60000 });
    expect(imageDimensions(heic([[1000, 1000]], [], { w: 50000, h: 40, type: "iovl" }), "image/heic")).toBeNull(); // an iovl's data is not an ImageGrid: unreadable
    expect(imageDimensions(heic([[8064, 6048]], [], { w: 8064, h: 6048 }), "image/heic"))
      .toEqual({ width: 8064, height: 6048 });
  });

  it("reads HEIC properties by box structure, not an ispe pattern in the coded data", () => {
    expect(imageDimensions(heic([[4032, 3024]], ispe(60000, 60000)), "image/heic"))
      .toEqual({ width: 4032, height: 3024 });
    expect(imageDimensions(heic([], ispe(4032, 3024)), "image/heic")).toBeNull();
  });

  it("finds an animated PNG before its image data", () => {
    const actl = chunk("acTL", [...u32(2), ...u32(0)]);
    expect(isAnimatedPng(png(10, 10, "IHDR", actl))).toBe(true);
    expect(isAnimatedPng(png(10, 10, "IHDR", [], [...chunk("IDAT", [0]), ...actl, ...chunk("IEND", [])]))).toBe(false);
    expect(isAnimatedPng(png(10, 10))).toBe(false);
  });

  it("reads a grid's output size in every iloc layout (R1-02)", () => {
    const big = { width: 60000, height: 60000 };
    expect(imageDimensions(heicDerived({ data: grid32(60000, 60000) }), "image/heic")).toEqual(big);
    expect(imageDimensions(heicDerived({ version: 0, method: 0, data: grid32(60000, 60000) }), "image/heic")).toEqual(big);
    expect(imageDimensions(heicDerived({ version: 2, data: grid32(60000, 60000) }), "image/heic")).toEqual(big);
    expect(imageDimensions(heicDerived({ baseSize: 4, indexSize: 4, base: 0, data: grid32(60000, 60000) }), "image/heic")).toEqual(big);
    expect(imageDimensions(heicDerived({ version: 0, method: 0, baseSize: 8, base: 7, data: grid32(60000, 60000) }), "image/heic")).toEqual(big);
    expect(imageDimensions(heicDerived({ offsetSize: 8, lengthSize: 8, data: grid32(60000, 60000) }), "image/heic")).toEqual(big);
    expect(imageDimensions(heicDerived({ data: [0, 0, 0, 0, ...u16(60000), ...u16(40000)] }), "image/heic"))
      .toEqual({ width: 60000, height: 40000 }); // a 16-bit grid
    expect(imageDimensions(heicDerived({ type: "iovl", data: [0, 1, ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(60000), ...u32(20)] }), "image/heic"))
      .toEqual({ width: 60000, height: 1000 }); // a readable overlay, beside the 1000×1000 ispe
  });

  it("refuses a HEIC whose item structure is broken or ambiguous, rather than guessing past it", () => {
    const ok = { data: grid32(60000, 60000) };
    expect(imageDimensions(heicDerived({ ...ok, iinfTrailing: [0, 0, 0, 0] }), "image/heic")).toBeNull(); // S1-02 / R1-01
    expect(imageDimensions(heicDerived({ ...ok, entryCount: 2 }), "image/heic")).toBeNull(); // entry_count disagrees
    expect(imageDimensions(heicDerived({ ...ok, duplicateItem: true }), "image/heic")).toBeNull(); // S1-04
    expect(imageDimensions(heicDerived({ ...ok, extraMeta: box("iloc", [1, 0, 0, 0, 0x44, 0, 0, 0]) }), "image/heic")).toBeNull(); // two ilocs
    expect(imageDimensions(heicDerived({ ...ok, topLevel: box("meta", [0, 0, 0, 0]) }), "image/heic")).toBeNull(); // two metas
    expect(imageDimensions(heicDerived({ ...ok, topLevel: box("moov", []) }), "image/heic")).toBeNull(); // S1-05: a sequence
    const many = heicDerived({ ...ok, iinfTrailing: Array.from({ length: 1001 }, () => box("free", [])).flat() });
    expect(imageDimensions(many, "image/heic")).toBeNull(); // more boxes than the parser walks
  });

  it("reads a HEIC whose meta is a largesize box", () => {
    const small = heic([[4032, 3024]]);
    const i = [...small].findIndex((_, k) => String.fromCharCode(...small.subarray(k + 4, k + 8)) === "meta");
    const size = (small[i]! << 24) | (small[i + 1]! << 16) | (small[i + 2]! << 8) | small[i + 3]!;
    const largesize = new Uint8Array([...small.subarray(0, i), ...u32(1), ...ascii("meta"), ...u64(size + 8),
      ...small.subarray(i + 8, i + size), ...small.subarray(i + size)]);
    expect(imageDimensions(largesize, "image/heic")).toEqual({ width: 4032, height: 3024 });
  });

  it("refuses a JPEG marker libjpeg refuses, and a second SOI (S1-07)", () => {
    const withMarker = (m: number[]) => new Uint8Array([0xff, 0xd8, ...m, ...jpeg(10, 10).subarray(2)]);
    expect(imageDimensions(withMarker([0xff, 0xf0, 0x00, 0x02]), "image/jpeg")).toBeNull(); // reserved
    expect(imageDimensions(withMarker([0xff, 0xde, 0x00, 0x02]), "image/jpeg")).toBeNull(); // DHP (hierarchical)
    expect(imageDimensions(withMarker([0xff, 0xc8, 0x00, 0x02]), "image/jpeg")).toBeNull(); // JPG
    expect(imageDimensions(withMarker([0xff, 0xd8]), "image/jpeg")).toBeNull(); // a second SOI
    // The markers a camera writes before its frame are fine: DQT, DRI, COM, APP15.
    expect(imageDimensions(withMarker([0xff, 0xdb, 0x00, 0x03, 0, 0xff, 0xdd, 0x00, 0x04, 0, 0, 0xff, 0xfe, 0x00, 0x02, 0xff, 0xef, 0x00, 0x02]), "image/jpeg"))
      .toEqual({ width: 10, height: 10 });
  });

  it("refuses a PNG whose chunks break before its image data", () => {
    expect(imageDimensions(png(10, 10, "IHDR", [], []), "image/png")).toBeNull(); // no IDAT at all
    expect(imageDimensions(png(10, 10, "IHDR", [...u32(1_000_000), ...ascii("tEXt")], []), "image/png")).toBeNull(); // a length past the end
    const padded = png(10, 10, "IHDR", Array.from({ length: 1000 }, () => chunk("tEXt", [])).flat());
    expect(imageDimensions(padded, "image/png")).toBeNull(); // more chunks before IDAT than the parser walks (S1-03)
  });

  it("reads nothing from a truncated header", () => {
    expect(imageDimensions(jpeg(4032, 3024).subarray(0, 8), "image/jpeg")).toBeNull();
    expect(imageDimensions(png(10, 10).subarray(0, 20), "image/png")).toBeNull();
  });
});

describe("inspectContent: image size limits fail closed (BL-088)", () => {
  it("admits the largest phone captures: a 200 MP frame and a 63 MP panorama", async () => {
    expect((await inspectContent(jpeg(16320, 12240), "image/jpeg")).outcome).toBe("passed");
    expect((await inspectContent(jpeg(16600, 3800), "image/jpeg")).outcome).toBe("passed");
  });

  it("blocks an animated PNG", async () => {
    const r = await inspectContent(png(10, 10, "IHDR", chunk("acTL", [...u32(2), ...u32(0)])), "image/png");
    expect(r).toMatchObject({ outcome: "blocked", failureCode: "image_animated" });
  });

  it("passes a phone-sized photo and names the policy", async () => {
    const r = await inspectContent(jpeg(8064, 6048), "image/jpeg");
    expect(r).toMatchObject({ outcome: "passed", detectedMediaType: "image/jpeg", failureCode: null });
    expect(r.policyVersion).toBe(INSPECTION_POLICY_VERSION);
  });

  it("passes the limits exactly", async () => {
    const side = Math.floor(Math.sqrt(MAX_IMAGE_PIXELS));
    expect((await inspectContent(png(MAX_IMAGE_EDGE_PX, 1), "image/png")).outcome).toBe("passed");
    expect((await inspectContent(png(side, side), "image/png")).outcome).toBe("passed");
  });

  it("blocks an edge over the limit", async () => {
    const r = await inspectContent(png(MAX_IMAGE_EDGE_PX + 1, 1), "image/png");
    expect(r).toMatchObject({ outcome: "blocked", failureCode: "image_dimensions_exceeded", detectedMediaType: "image/png" });
  });

  it("blocks a pixel count over the limit even with both edges inside it", async () => {
    const side = Math.ceil(Math.sqrt(MAX_IMAGE_PIXELS)) + 1;
    expect(side).toBeLessThanOrEqual(MAX_IMAGE_EDGE_PX);
    const r = await inspectContent(heic([[side, side]]), "image/heic");
    expect(r).toMatchObject({ outcome: "blocked", failureCode: "image_dimensions_exceeded" });
  });

  it("blocks an image whose size cannot be read", async () => {
    const soiOnly = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
    const r = await inspectContent(soiOnly, "image/jpeg");
    expect(r).toMatchObject({ outcome: "blocked", failureCode: "image_dimensions_unreadable", detectedMediaType: "image/jpeg" });
  });

  it("leaves a PDF to the type check alone", async () => {
    const r = await inspectContent(new TextEncoder().encode("%PDF-1.7\n"), "application/pdf");
    expect(r.outcome).toBe("passed");
  });

  it("still reports a type mismatch before any size", async () => {
    const r = await inspectContent(png(10, 10), "image/jpeg");
    expect(r.failureCode).toBe("declared_type_mismatch");
  });
});
