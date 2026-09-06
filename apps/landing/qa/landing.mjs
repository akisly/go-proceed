#!/usr/bin/env node
// Builds and starts the landing, then photographs it at seven widths, checks
// for horizontal overflow and console errors, repeats under reduced motion,
// measures the Border Beam on the settled product frame, and writes
// public/og.png from /og. Run: pnpm --filter @goproceed/landing qa
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import sharp from "sharp";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(app, "qa-output");
mkdirSync(out, { recursive: true });
const PORT = 3111;
const WIDTHS = [1920, 1440, 1240, 1024, 768, 390, 360];

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: app, stdio: "inherit", ...opts });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

await run("pnpm", ["exec", "next", "build"]);
const server = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], { cwd: app, stdio: "inherit" });
await new Promise((r) => setTimeout(r, 4000));

const report = { widths: {}, reduced: {}, errors: [] };
let browser;
let exitCode = 1;

try {
  browser = await puppeteer.launch({
    ...(process.env.GOPROCEED_CHROME_PATH ? { executablePath: process.env.GOPROCEED_CHROME_PATH } : {}),
    headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  // `data-settled` is `ScrollSettle`'s own contract (packages/ui/src/motion/ScrollSettle.tsx):
  // "false" on first paint, latched "true" once the frame is scrolled into place,
  // the viewport is narrow, or the resolved OS preference is reduced motion.
  // The QA harness pins the controller's ruling on it: at every width the full-
  // motion pass photographs a desktop fold (>= 768px), the frame must still read
  // "false" the instant the page has loaded and before any scroll happens; under
  // reduced motion the latch must already read "true" by the same point, since
  // (a) or (b) of the contract fires immediately.
  async function audit(width, reduced) {
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle0" });

    // Give React's mount effects (the `matchMedia` reads inside `ScrollSettle`)
    // one tick to settle before reading `data-settled`, still before any scroll.
    await new Promise((r) => setTimeout(r, 150));
    let settledAtLoad = null;
    const checkSettled = reduced || width >= 768;
    if (checkSettled) {
      settledAtLoad = await page.evaluate(() => document.querySelector("[data-settled]")?.getAttribute("data-settled") ?? null);
    }
    const expectedSettled = reduced ? "true" : "false";
    const settledOk = !checkSettled || settledAtLoad === expectedSettled;

    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const step = Math.floor(900 * 0.8);
    let shot = 0;
    for (let y = 0; y < total; y += step) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await new Promise((r) => setTimeout(r, 350));
      await page.screenshot({ path: join(out, `${reduced ? "reduced-" : ""}${width}-${String(shot++).padStart(2, "0")}.png`) });
    }
    const overflow = await page.evaluate(() => {
      const vw = window.innerWidth;
      // The route media halves carry a blurred `media-glow` (base.css) offset
      // by a negative inset — the prototype's `.glowc` — inside a `relative
      // overflow-hidden` container (route.tsx's `.landing-media-grid`). That is
      // the same shape the border-beam comment above already names: an
      // absolutely positioned decorative child whose containing block clips it,
      // so nothing paints past the edge and no scrollbar exists (`scrollWidth`
      // already equals `innerWidth` for exactly this reason). A raw
      // `getBoundingClientRect()` does not know about the clip, so it reports
      // the glow as reaching past the viewport at every width narrower than
      // `wide`'s two-column layout, even though that portion is never visible.
      // `visibleRight` intersects the element's box with every ancestor whose
      // computed `overflow`/`overflow-x` is not `visible`, so only genuine,
      // paintable overflow — the bug this check exists to catch — still fails.
      function visibleRight(el) {
        let right = el.getBoundingClientRect().right;
        for (let node = el.parentElement; node; node = node.parentElement) {
          const cs = getComputedStyle(node);
          if (cs.overflow === "visible" && cs.overflowX === "visible") continue;
          right = Math.min(right, node.getBoundingClientRect().right);
        }
        return right;
      }
      const wide = [...document.querySelectorAll("body *")]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && visibleRight(el) > vw + 1; })
        .map((el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className).split(" ")[0]}`)
        .slice(0, 10);
      return { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, wide };
    });
    await page.close();
    const ok = overflow.scrollWidth === overflow.innerWidth && overflow.wide.length === 0 && errors.length === 0 && settledOk;
    (reduced ? report.reduced : report.widths)[width] = { ok, ...overflow, errors, settledAtLoad };
    console.log(`${reduced ? "reduced " : ""}${width}px: ${ok ? "ok" : "PROBLEM"} scrollWidth=${overflow.scrollWidth} wide=${overflow.wide.length} errors=${errors.length} settledAtLoad=${settledAtLoad === null ? "n/a" : settledAtLoad}`);
  }

  // THE BORDER BEAM, MEASURED. It is a decorative overlay that no other gate
  // can see: it renders in the kitchen sink and, while `@utility beam` sat at
  // `inset: -1px`, all but invisibly on the page — the Board is `relative
  // overflow-hidden` on the very element that hosts the ring, an absolutely
  // positioned child's containing block is the padding box, and `overflow`
  // clips to that same box, so the whole visible band lay in the clipped
  // region. Nothing failed; a screenshot at seven widths cannot tell.
  //
  // So: settle the frame, screenshot the beam element itself (an element
  // handle, NOT `page.screenshot({clip})` — clip is document-relative while
  // `getBoundingClientRect` is viewport-relative, and the page is scrolled by
  // then), and count the non-neutral pixels in a 2px band around its whole
  // perimeter. The whole perimeter because the conic gradient paints a ~28 %
  // arc that rotates: which side carries the light depends on when the shutter
  // opened, but some side always does while the animation runs.
  //
  // Measured on this machine at 1440, full motion, over a full 7s revolution:
  // 460–1051 painted with `inset: 0`, and 64 with `inset: -1px` (the corner
  // slivers the parent's rounded clip leaves behind). The floor is 200 — an
  // order of magnitude below the healthy range and three times the clipped
  // one — rather than «greater than zero», which the broken version passed.
  const BEAM_FLOOR = 200;
  async function beamPixels() {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle0" });
    const settled = await page.evaluate(async () => {
      const el = document.querySelector(".beam");
      if (!el) return false;
      el.parentElement.scrollIntoView({ block: "center" });
      await new Promise((r) => setTimeout(r, 700));
      return document.querySelector('[data-settled="true"]') !== null;
    });
    const handle = settled ? await page.$(".beam") : null;
    if (handle === null) { await page.close(); return null; }
    const shot = await handle.screenshot();
    await page.close();
    const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    const BAND = 2;
    let painted = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (!(x < BAND || y < BAND || x >= info.width - BAND || y >= info.height - BAND)) continue;
        const i = (y * info.width + x) * info.channels;
        // paper, white and ink are all near-neutral; the beam is cobalt
        if (Math.abs(data[i] - data[i + 1]) > 8 || Math.abs(data[i + 1] - data[i + 2]) > 8 || Math.abs(data[i] - data[i + 2]) > 8) painted++;
      }
    }
    return painted;
  }

  for (const w of WIDTHS) await audit(w, false);
  for (const w of [1440, 390]) await audit(w, true);

  report.beamPixels = await beamPixels();
  const beamOk = typeof report.beamPixels === "number" && report.beamPixels >= BEAM_FLOOR;
  console.log(`border beam at 1440 (full motion): ${beamOk ? "ok" : "PROBLEM"} paintedPixels=${report.beamPixels} floor=${BEAM_FLOOR}`);

  const og = await browser.newPage();
  await og.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await og.goto(`http://localhost:${PORT}/og`, { waitUntil: "networkidle0" });
  await og.screenshot({ path: join(app, "public/og.png"), clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log("wrote public/og.png");

  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
  const allOk = [...Object.values(report.widths), ...Object.values(report.reduced)].every((r) => r.ok) && beamOk;
  console.log(allOk ? "landing qa: ok" : "landing qa: PROBLEMS — see qa-output/report.json");
  exitCode = allOk ? 0 : 1;
} catch (err) {
  console.error("landing qa: crashed", err);
  exitCode = 1;
} finally {
  // process.exit() inside the try would skip this block and orphan the server —
  // the exit happens after the teardown, never before it.
  await browser?.close?.();
  server.kill();
}
process.exit(exitCode);
