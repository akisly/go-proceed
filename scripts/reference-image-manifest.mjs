import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import sharp from "sharp";

const MAX_BYTES = 5 * 1024 * 1024;
const MIME = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const text = (value, max = 500) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const integer = (value, max) => Number.isInteger(value) && value > 0 && value <= max;

/** Strict manifest validation also runs in --check, with no network or database. */
export function validateManifest(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.images)
      || Object.keys(value).some((key) => !["schemaVersion", "images"].includes(key))) {
    throw new Error("Expected reference image manifest schemaVersion 1");
  }
  const names = new Set();
  const allowed = new Set(["sourceStandard", "positionCode", "itemNo", "versionNo", "file", "sha256",
    "byteSize", "mimeType", "width", "height", "altTextUk", "rightsHolder", "license", "sourceUri"]);
  for (const image of value.images) {
    if (!image || Object.keys(image).some((key) => !allowed.has(key))
      || !text(image.sourceStandard, 200) || !text(image.positionCode, 100)
      || !integer(image.itemNo, 10000) || !integer(image.versionNo, 2147483647)
      || !text(image.file, 500) || !/^[a-f0-9]{64}$/.test(image.sha256 ?? "")
      || !integer(image.byteSize, MAX_BYTES) || !Object.values(MIME).includes(image.mimeType)
      || !integer(image.width, 8192) || !integer(image.height, 8192)
      || image.width * image.height > 16777216 || !text(image.altTextUk)
      || !text(image.rightsHolder) || !text(image.license, 2000) || !text(image.sourceUri, 2000)) {
      throw new Error("Invalid reference image entry; every content and rights field is required");
    }
    const source = new URL(image.sourceUri);
    if (source.protocol !== "https:" || source.username || source.password) throw new Error("sourceUri must be public HTTPS provenance");
    const key = JSON.stringify([image.sourceStandard, image.positionCode, image.itemNo, image.versionNo]);
    if (names.has(key)) throw new Error("Duplicate library item/version in manifest");
    names.add(key);
  }
  return value;
}

export async function loadManifest(path) {
  const raw = await readFile(path);
  const manifest = validateManifest(JSON.parse(raw.toString("utf8")));
  const root = await realpath(dirname(resolve(path)));
  const images = [];
  for (const entry of manifest.images) {
    const file = await realpath(resolve(root, entry.file));
    const inside = relative(root, file);
    if (!inside || inside.startsWith(`..${sep}`) || inside === ".." || resolve(root, inside) !== file) {
      throw new Error("Image must be a file inside the manifest directory");
    }
    const bytes = await readFile(file);
    if (bytes.length !== entry.byteSize || digest(bytes) !== entry.sha256) throw new Error("Image bytes differ from manifest");
    const meta = await sharp(bytes, { limitInputPixels: 16777216 }).metadata();
    if (MIME[meta.format] !== entry.mimeType || meta.width !== entry.width || meta.height !== entry.height
        || (meta.pages ?? 1) !== 1 || (meta.orientation ?? 1) !== 1) {
      throw new Error("Image must be a single upright raster matching the manifest");
    }
    images.push({ ...entry, bytes });
  }
  return { sha256: digest(raw), images };
}

/** Opaque reproducible UUID-shaped keys let retries verify an orphaned upload. */
export function storageIdentity(workspaceId, libraryItemId, versionNo) {
  const hex = digest(JSON.stringify(["goproceed-reference-v1", workspaceId, libraryItemId, versionNo]));
  const uuid = (s) => `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-8${s.slice(17, 20)}-${s.slice(20, 32)}`;
  return { id: uuid(hex.slice(0, 32)), key: `${uuid(hex.slice(0, 32))}/${uuid(hex.slice(32))}` };
}
