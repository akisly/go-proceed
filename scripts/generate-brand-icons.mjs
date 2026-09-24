#!/usr/bin/env node
// Rasterises every icon file in the repository from design-references/brand/*.svg.
// One source, one script: a mark that lives in nine PNGs by hand is nine marks.
// Run: node scripts/generate-brand-icons.mjs
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = (f) => join(root, "design-references/brand", f);
const svg = (f) => readFileSync(brand(f));

async function png(source, size, out) {
  await sharp(svg(source), { density: 384 }).resize(size, size).png().toFile(join(root, out));
  console.log(`wrote ${out} (${size}px from ${source})`);
}

/** A single-image ICO wrapping one PNG — the shape the existing favicon.ico files already have. */
async function ico(source, size, out) {
  const image = await sharp(svg(source), { density: 384 }).resize(size, size).png().toBuffer();
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header.writeUInt8(size === 256 ? 0 : size, 6); header.writeUInt8(size === 256 ? 0 : size, 7);
  header.writeUInt8(0, 8); header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(image.length, 14); header.writeUInt32LE(22, 18);
  writeFileSync(join(root, out), Buffer.concat([header, image]));
  console.log(`wrote ${out} (${size}px ICO from ${source})`);
}

// apps/landing — the favicon is the mark on a WHITE tile (spec F10).
await png("goproceed-landing-icon.svg", 512, "apps/landing/app/icon.png");
// The apple-touch icon is FULL BLEED (rx 0): iOS masks the corners itself and
// paints transparency black, so the rounded tile showed a dark arc at each one.
await png("goproceed-apple-icon.svg", 180, "apps/landing/app/apple-icon.png");
await ico("goproceed-landing-icon.svg", 64, "apps/landing/app/favicon.ico");

// apps/app — the ink tile. (The 192/512/maskable PWA icons left with the
// manifest; DEV-057 deleted them. The field client's web icons went with its
// web export, ADR-013.)
copyFileSync(brand("goproceed-app-icon.svg"), join(root, "apps/app/public/icon.svg"));
copyFileSync(brand("goproceed-mask.svg"), join(root, "apps/app/public/safari-pinned-tab.svg"));
await png("goproceed-app-icon.svg", 16, "apps/app/public/favicon-16.png");
await png("goproceed-app-icon.svg", 32, "apps/app/public/favicon-32.png");
await ico("goproceed-app-icon.svg", 32, "apps/app/public/favicon.ico");
await png("goproceed-app-icon.svg", 180, "apps/app/public/apple-touch-icon.png");

// apps/mobile — Expo's icon set, at the sizes the current files have.
await png("goproceed-app-icon.svg", 1024, "apps/mobile/assets/icon.png");
await png("goproceed-adaptive-foreground.svg", 1024, "apps/mobile/assets/android-icon-foreground.png");
await png("goproceed-adaptive-monochrome.svg", 1024, "apps/mobile/assets/android-icon-monochrome.png");
await png("goproceed-solid-background.svg", 1024, "apps/mobile/assets/android-icon-background.png");
// The splash mark comes from the MASKABLE file, not the adaptive foreground:
// the adaptive foreground is scaled to Android's 66dp safe circle, and the
// splash screen has no launcher mask to survive, so it would only shrink.
await png("goproceed-maskable-icon.svg", 1024, "apps/mobile/assets/splash-icon.png");
