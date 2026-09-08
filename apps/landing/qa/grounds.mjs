/**
 * Derives the route cards' photographic grounds, and is the record of how.
 *
 * WHY THE ROUTE CARDS HAVE GROUNDS AT ALL. Card 01 sits over a photograph of a
 * drawing folio — the sheet the ДБН clause is pinned to — and the other four
 * sat over a gradient alone, so the section read as one finished card followed
 * by four empty ones. Each stage of the route produces or consumes a physical
 * artefact, and that artefact is the card's ground: a drawing sheet for the
 * requirement, the site frame for the capture, the schematic the supervisor
 * checks against, the stamped plan for the decision, the loose sheets under a
 * clip for the draft act. The ground is the argument, not decoration.
 *
 * WHY THE TONE IS COPIED, NOT CHOSEN. Every ground is normalised to the tone
 * `photo-blueprint.jpg` already has — mean RGB 225/219/212, per-channel
 * standard deviation ~14 — because that is what makes a photograph usable
 * here: pale enough that the white UI panel stays the brightest thing in the
 * media half, flat enough that its linework never competes with the panel's
 * own, and neutral enough that the card's coloured glow still carries the
 * per-stage identity. The site frame arrives at mean 109 / sd 49 and takes the
 * whole treatment; the folio crops need very little. Per channel the mapping
 * is x' = a·x + b, with `a` set by the standard deviation and `b` by the mean.
 *
 * SOURCES. Both masters are synthetic and customer-data-free
 * (`design-references/evidence-atlas/README.md`), and the crops obey the crop
 * rules stated there: the folio is cut at 4:3 and 3:2 with paper edges
 * preserved, the site frame at 4:5 with the central cable bend kept.
 *
 * Run from anywhere: `node apps/landing/qa/grounds.mjs`. It rewrites the four
 * files in `apps/landing/public/images/` and prints the tone it measured
 * before and after, which is the evidence that they match card 01.
 */
import sharp from "sharp";
import { join } from "node:path";

const here = import.meta.dirname;
const REF = join(here, "..", "..", "..", "design-references", "evidence-atlas", "assets");
const OUT = process.argv[2] ?? join(here, "..", "public", "images");

/** The tone of `photo-blueprint.jpg`, measured on that file, not picked. */
const TARGET = { mean: [225, 219, 212], sd: 14 };

const GROUNDS = [
  { name: "photo-site-trays", src: "cable-tray-evidence.png", crop: { left: 640, top: 60, width: 700, height: 875 }, note: "02 — the frame the master takes: the tray run and its central bend, 4:5" },
  { name: "photo-schematic", src: "blueprint-folio.png", crop: { left: 860, top: 512, width: 720, height: 480 }, note: "03 — the electrical schematic the supervisor checks against, 3:2" },
  { name: "photo-plan-stamped", src: "blueprint-folio.png", crop: { left: 830, top: 130, width: 680, height: 510 }, note: "04 — the plan carrying the stamp: a decision recorded on the sheet, 4:3" },
  { name: "photo-tracing", src: "blueprint-folio.png", crop: { left: 20, top: 490, width: 660, height: 495 }, note: "05 — loose tracing sheets under a clip: the draft being assembled, 4:3" },
];

const tone = async (image) => {
  const s = await image.clone().stats();
  return { mean: s.channels.slice(0, 3).map((c) => c.mean), sd: s.channels.slice(0, 3).map((c) => c.stdev) };
};
const round = (xs) => xs.map((x) => Math.round(x)).join(",");

for (const g of GROUNDS) {
  // `stats()` reads the INPUT image, not the pipeline, so the crop has to be
  // materialised before it can be measured — otherwise every crop of one
  // master reports that master's tone and they all get the same correction.
  const cropped = await sharp(join(REF, g.src)).extract(g.crop).png().toBuffer();
  const before = await tone(sharp(cropped));
  const a = before.sd.map((sd) => TARGET.sd / sd);
  const b = a.map((ai, i) => TARGET.mean[i] - ai * before.mean[i]);
  const long = Math.max(g.crop.width, g.crop.height);
  await sharp(cropped)
    .linear(a, b)
    .resize(Math.round((g.crop.width / long) * 1200), Math.round((g.crop.height / long) * 1200), { fit: "fill" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(join(OUT, `${g.name}.jpg`));
  const after = await tone(sharp(join(OUT, `${g.name}.jpg`)));
  console.log(`${g.name}.jpg — ${g.note}`);
  console.log(`   before mean=${round(before.mean)} sd=${round(before.sd)}   after mean=${round(after.mean)} sd=${round(after.sd)}`);
}
