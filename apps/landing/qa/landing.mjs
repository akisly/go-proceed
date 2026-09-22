#!/usr/bin/env node
// Builds and starts the landing, then photographs each of its four pages
// (DEV-022) at seven widths, checks for horizontal overflow and console errors,
// repeats under reduced motion, follows every internal link, measures the
// Border Beam on the settled product frame, measures the pointer-reactive canvas
// words (DEV-024 — a second browser with software WebGL for the particle dome),
// and writes public/og.png from /og.
// Run: pnpm --filter @goproceed/landing qa
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import sharp from "sharp";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(app, "qa-output");
// Emptied first: a shorter page shoots fewer folds, and a stale `home-1920-07.png`
// from an earlier composition sat beside the new ones and was read as current (B2-06).
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const PORT = 3111;
const WIDTHS = [1920, 1440, 1240, 1024, 768, 390, 360];
// The four pages (DEV-022). Keep in step with `landingContent.pages`; the link
// check below fails if a page links to a path that is not served.
const ROUTES = [["home", "/"], ["product", "/product"], ["roles", "/roles"], ["pilot", "/pilot"]];

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: app, stdio: "inherit", ...opts });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

await run("pnpm", ["exec", "next", "build"]);
const server = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], { cwd: app, stdio: "inherit" });
await new Promise((r) => setTimeout(r, 4000));

const report = { widths: {}, reduced: {}, heights: {}, errors: [] };
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
  // (a) or (b) of the contract fires immediately. Only /product carries a
  // `ScrollSettle` — the application view, which was the home hero until
  // DEV-023 — so only /product is asked.
  async function audit([route, path], width, reduced) {
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: "networkidle0" });

    // Give React's mount effects (the `matchMedia` reads inside `ScrollSettle`)
    // one tick to settle before reading `data-settled`, still before any scroll.
    await new Promise((r) => setTimeout(r, 150));
    let settledAtLoad = null;
    const checkSettled = route === "product" && (reduced || width >= 768);
    if (checkSettled) {
      settledAtLoad = await page.evaluate(() => document.querySelector("[data-settled]")?.getAttribute("data-settled") ?? null);
    }
    const expectedSettled = reduced ? "true" : "false";
    const settledOk = !checkSettled || settledAtLoad === expectedSettled;

    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    if (!reduced) (report.heights[route] ??= {})[width] = total;
    const h1Count = await page.evaluate(() => document.querySelectorAll("h1").length);
    const step = Math.floor(900 * 0.8);
    let shot = 0;
    for (let y = 0; y < total; y += step) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await new Promise((r) => setTimeout(r, 350));
      await page.screenshot({ path: join(out, `${reduced ? "reduced-" : ""}${route}-${width}-${String(shot++).padStart(2, "0")}.png`) });
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
    const ok = overflow.scrollWidth === overflow.innerWidth && overflow.wide.length === 0 && errors.length === 0 && settledOk && h1Count === 1;
    (reduced ? report.reduced : report.widths)[`${route}@${width}`] = { ok, ...overflow, errors, settledAtLoad, h1Count, height: total };
    console.log(`${reduced ? "reduced " : ""}${route} ${width}px: ${ok ? "ok" : "PROBLEM"} height=${total} scrollWidth=${overflow.scrollWidth} wide=${overflow.wide.length} errors=${errors.length} h1=${h1Count} settledAtLoad=${settledAtLoad === null ? "n/a" : settledAtLoad}`);
  }

  // EVERY INTERNAL LINK LANDS (DEV-022). On one page a dead anchor scrolled
  // nowhere; across four pages it is a 404, or a `/product#trust` that opens
  // the page at the top because the id moved. Each page's `a[href^="/"]` is
  // fetched, and its fragment — if it has one — must be an id on the page it
  // points to.
  async function links() {
    // Plain `fetch`, not `page.goto`: a second navigation to a URL the browser
    // has already cached answers 304, which reads as «not served».
    const broken = [];
    const pages = new Map();
    async function load(path) {
      if (!pages.has(path)) {
        const res = await fetch(`http://localhost:${PORT}${path}`);
        pages.set(path, res.status === 200 ? await res.text() : null);
      }
      return pages.get(path);
    }
    const hrefs = new Set();
    for (const [, path] of ROUTES) {
      const html = await load(path);
      if (html === null) { broken.push(`${path}: not served`); continue; }
      for (const m of html.matchAll(/<a\b[^>]*\shref="(\/[^"]*)"/g)) hrefs.add(m[1]);
    }
    for (const href of [...hrefs].sort()) {
      const [path, fragment] = href.split("#");
      const html = await load(path);
      if (html === null) broken.push(`${href}: not served`);
      else if (fragment && !html.includes(` id="${fragment}"`)) broken.push(`${href}: no #${fragment} on ${path}`);
    }
    return { checked: hrefs.size, broken };
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
    await page.goto(`http://localhost:${PORT}/product`, { waitUntil: "networkidle0" }); // the board is /product's (DEV-023)
    // The ring runs from first paint now (spec 2026-09-06 §5.1) — it no longer
    // waits on `ScrollSettle`'s latch, so the measurement only needs the beam
    // element scrolled into view, not `data-settled="true"` — AND the frame's
    // own entrance to have landed. The frame rises 60px over `grand` after a
    // .35s delay (product-frame.tsx's `Reveal`), and since the hydration-gate
    // fix (2026-09-06, later) that rise really happens: an element handle
    // screenshot clips to a box measured an instant before the shot, so a
    // ring still travelling shifts a few pixels between the two and the 2px
    // perimeter band lands beside it — paintedPixels=0 with the beam plainly
    // running. A fixed 700ms was that defect. Instead, poll until the beam's
    // box has not moved for two reads AND every ancestor is at full opacity,
    // capped at 4s so a broken entrance still fails loudly (as 0 pixels).
    const present = await page.evaluate(async () => {
      // `#board`: the ink pills carry a beam too since DEV-023, and the header's is first in the document.
      const el = document.querySelector("#board .beam");
      if (!el) return false;
      el.parentElement.scrollIntoView({ block: "center" });
      const box = () => { const r = el.getBoundingClientRect(); return `${r.top.toFixed(1)}:${r.height.toFixed(1)}`; };
      const opaque = () => { for (let n = el; n; n = n.parentElement) if (parseFloat(getComputedStyle(n).opacity) < 1) return false; return true; };
      let prev = box();
      for (let waited = 0; waited < 4000; waited += 100) {
        await new Promise((r) => setTimeout(r, 100));
        const next = box();
        if (next === prev && opaque()) break;
        prev = next;
      }
      return true;
    });
    const handle = present ? await page.$("#board .beam") : null;
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
        // paper, white and ink are all near-neutral; the beam is the signal (ember
        // since 2026-09-22, cobalt before it) — either way the one chromatic thing here
        if (Math.abs(data[i] - data[i + 1]) > 8 || Math.abs(data[i + 1] - data[i + 2]) > 8 || Math.abs(data[i] - data[i + 2]) > 8) painted++;
      }
    }
    return painted;
  }

  for (const route of ROUTES) for (const w of WIDTHS) await audit(route, w, false);
  for (const route of ROUTES) for (const w of [1440, 390]) await audit(route, w, true);

  // NOTHING IN A FIRST FOLD STAYS HIDDEN (DEV-023). A `whileInView` entrance on
  // content that is already in view when the reduced-motion gate opens can be
  // left on its hidden label for good — measured on /roles, whose role cells
  // stayed at opacity 0 in three loads out of five once the grid moved into the
  // first fold. It is a race, so one load proves nothing: each page is loaded
  // three times, and any text-bearing element of the first viewport still
  // below full opacity after 3s fails. Decorative (`aria-hidden`) and
  // scroll-linked (`data-scroll-tint`) elements are not entrances.
  // [R-03] Also the deep links the site itself hands out — a reader who lands
  // mid-page has content in view at hydration, which is the same condition.
  // Measured 2026-09-19: the race did not reproduce on any of them at 1440 (four
  // loads each). At 390 two pre-existing blocks (capture, provenance) keep a
  // tall stacked `Stagger` below its 25 % threshold — deterministic, not a race,
  // older than DEV-022, and filed under BL-059; the deep links are therefore
  // checked at 1440 only.
  const DEEP_LINKS = [["roles#compare", "/roles#compare"], ["product#capture", "/product#capture"], ["product#trust", "/product#trust"], ["pilot#request", "/pilot#request"]];
  async function firstFold() {
    const stuck = [];
    for (const [route, path] of [...ROUTES, ...DEEP_LINKS]) {
      for (let load = 0; load < 3; load++) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
        await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: "networkidle0" });
        await new Promise((r) => setTimeout(r, 3000));
        const hidden = await page.evaluate(() => [...document.querySelectorAll("main *")].filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.top > window.innerHeight || r.bottom < 60 || r.height === 0) return false;
          if (el.closest('[aria-hidden="true"], [data-scroll-tint]')) return false;
          if ((el.textContent || "").trim().length === 0) return false;
          const parent = el.parentElement;
          if (parent && parseFloat(getComputedStyle(parent).opacity) < 0.99) return false; // report the outermost only
          return parseFloat(getComputedStyle(el).opacity) < 0.99;
        }).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`).slice(0, 4));
        if (hidden.length) stuck.push(`${route} load ${load + 1}: ${hidden.join(", ")}`);
        await page.close();
      }
    }
    return stuck;
  }
  report.firstFoldStuck = await firstFold();
  const firstFoldOk = report.firstFoldStuck.length === 0;
  console.log(`first folds (3 loads a page): ${firstFoldOk ? "ok" : "PROBLEM"} stuck=${JSON.stringify(report.firstFoldStuck)}`);

  report.links = await links();
  const linksOk = report.links.checked > 0 && report.links.broken.length === 0;
  console.log(`internal links: ${linksOk ? "ok" : "PROBLEM"} checked=${report.links.checked} broken=${JSON.stringify(report.links.broken)}`);

  report.beamPixels = await beamPixels();
  const beamOk = typeof report.beamPixels === "number" && report.beamPixels >= BEAM_FLOOR;
  console.log(`border beam at 1440 (full motion): ${beamOk ? "ok" : "PROBLEM"} paintedPixels=${report.beamPixels} floor=${BEAM_FLOOR}`);

  // PARITY CHECKS (spec 2026-09-06 §9). Each is a fact the seven screenshots
  // cannot show: a transform that changes with the scroll, an attribute that
  // flips with the viewport, a CSS variable that reaches 1.
  async function parity() {
    const out = {};
    const open = async (path, viewport, reduced = false) => {
      const page = await browser.newPage();
      await page.setViewport(viewport);
      if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 300));
      return page;
    };
    const WIDE = { width: 1440, height: 900, deviceScaleFactor: 1 };
    const NARROW = { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true };

    // PRODUCT — the application view's depth layers and the one tilted surface
    // (the home hero's until DEV-023). Bring the view in, read, scroll on, read.
    const wide = await open("/product", WIDE);
    await wide.evaluate(() => { const el = document.querySelector("#board"); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 200, behavior: "instant" }); });
    await new Promise((r) => setTimeout(r, 1600));
    const depthAtTop = await wide.evaluate(() => [...document.querySelectorAll("[data-depth]")].map((el) => getComputedStyle(el).transform));
    await wide.evaluate(() => window.scrollBy({ top: 500, behavior: "instant" }));
    await new Promise((r) => setTimeout(r, 400));
    const depthScrolled = await wide.evaluate(() => [...document.querySelectorAll("[data-depth]")].map((el) => getComputedStyle(el).transform));
    out.depthLayers = depthAtTop.length;
    out.depthMoves = depthAtTop.length === 3 && depthAtTop.some((t, i) => t !== depthScrolled[i]);
    await wide.close();

    // `perspective` only reaches a descendant through an unbroken
    // `transform-style: preserve-3d` chain — a `[data-tilt]` element sitting
    // under a `perspective` ancestor with a FLAT node in between never
    // tilts in 3D no matter what `data-tilt="on"` says, and an attribute
    // count alone cannot see that: this exact defect shipped past
    // `tiltOnWide === 8` (the final review's F1). For every `[data-tilt]`
    // element, walk `parentElement` upward; every node before the first
    // ancestor whose computed `perspective` is not `none` must itself carry
    // `transform-style: preserve-3d`, and the walk must actually find such
    // an ancestor. Summed over the four pages, because a block that moved to
    // another page must stay as still there as it was on the one page.
    out.tiltTotal = 0; out.tiltOnWide = 0; out.tiltChainsOk = 0; out.magneticOnWide = {}; out.pulsing = {}; out.flowing = {};
    for (const [route, path] of ROUTES) {
      const page = await open(path, WIDE);
      const counts = await page.evaluate(() => {
        let chains = 0;
        for (const tilt of document.querySelectorAll("[data-tilt]")) {
          let node = tilt.parentElement;
          let foundPerspective = false;
          let broken = false;
          while (node) {
            const cs = getComputedStyle(node);
            if (cs.perspective !== "none") { foundPerspective = true; break; }
            if (cs.transformStyle !== "preserve-3d") { broken = true; break; }
            node = node.parentElement;
          }
          if (foundPerspective && !broken) chains++;
        }
        return {
          tilt: document.querySelectorAll("[data-tilt]").length,
          tiltOn: document.querySelectorAll('[data-tilt="on"]').length,
          chains,
          magnetic: document.querySelectorAll('[data-magnetic="on"]').length,
          pulsing: document.querySelectorAll(".pulse-dot").length,
          flowing: document.querySelectorAll(".flow-dash").length,
        };
      });
      out.tiltTotal += counts.tilt; out.tiltOnWide += counts.tiltOn; out.tiltChainsOk += counts.chains;
      out.magneticOnWide[route] = counts.magnetic; out.pulsing[route] = counts.pulsing; out.flowing[route] = counts.flowing;
      await page.close();
    }

    // PRODUCT — the sticky list marks the step in view (DEV-023: the
    // reference's feature list, where Fora's pinned stack used to be).
    const product = await open("/product", WIDE);
    await product.evaluate(() => { const el = document.querySelector("#step-03"); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 300, behavior: "instant" }); });
    await new Promise((r) => setTimeout(r, 500));
    out.stickyCurrent = await product.evaluate(() => document.querySelector('#stages nav [aria-current="true"]')?.getAttribute("href") ?? null);
    out.stickyPosition = await product.evaluate(() => getComputedStyle(document.querySelector("#stages nav")).position);
    // [R-11] …and that it actually stays: `top-24` is 96px under the viewport's top.
    out.stickyTop = await product.evaluate(() => Math.round(document.querySelector("#stages nav").getBoundingClientRect().top));
    await product.close();

    // HOME — the first screen's two new words run, and stand still when asked to.
    const first = await open("/", WIDE);
    out.rain = await first.evaluate(() => document.querySelector("[data-pixel-rain]")?.getAttribute("data-pixel-rain") ?? null);
    out.orbit = await first.evaluate(() => document.querySelector("[data-orbit]")?.getAttribute("data-orbit") ?? null);
    out.heroFillsViewport = await first.evaluate(() => document.querySelector("#hero").getBoundingClientRect().height >= window.innerHeight);
    // [DEV-024, seventh pass; 2026-09-22, owner: «хедер всегда сделай таким типа прозрачным, а не только на скрол»]
    // the header is frosted glass at EVERY scroll position: the same layer, the same opacity, at the top and below it,
    // and no attribute to carry a state. The hero's field still starts at the very top edge, behind the bar.
    // [R2-07] The ground's OPACITY alone stopped distinguishing anything the day
    // it became a constant: an `<i>` with no rule at all reports `1` too. The
    // blur and the ground colour are read with it, so the probe still knows
    // frosted glass from an empty element.
    const veil = () => first.evaluate(() => {
      const s = getComputedStyle(document.querySelector("[data-header-veil]"));
      return { atTop: document.querySelector("header").getAttribute("data-at-top"), opacity: s.opacity, blurred: /blur\(/.test(s.backdropFilter || s.webkitBackdropFilter || ""), ground: s.backgroundColor, rainTop: Math.round(document.querySelector("[data-pixel-rain]").getBoundingClientRect().top + scrollY) };
    });
    out.veilAtTop = await veil();
    // [B7-01] under the glass header the raster stays DIM: every cell still holds a dot, none darker than a dim one —
    // on paper a bright dot beside the wordmark read as a full stop. Max alpha in the band vs the field below it (control).
    out.rainUnderHeader = await first.evaluate(() => {
      const c = document.querySelector("[data-pixel-rain]"); const k = c.height / c.getBoundingClientRect().height;
      const px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      const band = Math.round(58 * k); let top = 0, below = 0, dotsInBand = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const a = px[(y * c.width + x) * 4 + 3]; if (y < band) { if (a > top) top = a; if (a > 0) dotsInBand += 1; } else if (a > below) below = a; }
      // [R7b-01] DOTS, not pixels: a band dot is 2 × 2 CSS px, so painted pixels / (4k²) is the number of dots,
      // set against the number of cells the band holds (8px pitch, seven whole rows above 58px).
      const cells = Math.ceil(c.getBoundingClientRect().width / 8) * 7;
      return { maxAlphaInBand: top, maxAlphaBelow: below, dotsInBand: Math.round(dotsInBand / (4 * k * k)), cellsInBand: cells };
    });
    await first.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" })); await new Promise((r) => setTimeout(r, 700));
    out.veilScrolled = await veil();
    await first.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await new Promise((r) => setTimeout(r, 700));
    // [B2-01] the closing heading once broke into six one-word lines at 1440: its
    // measure sat on a wrapper, where `ch` is 16px. Lines = height / line-height.
    out.closingHeadingLines = await first.evaluate(() => { const h = document.querySelector("#cta-final h2"); const s = getComputedStyle(h); return Math.round(h.getBoundingClientRect().height / parseFloat(s.lineHeight)); });
    // [R-11] The label says «running»; the bitmap says whether anything is
    // drawn and whether it changes. `getAnimations()` cannot see a rAF loop.
    const frames = async (page) => page.evaluate(async () => {
      const canvas = document.querySelector("[data-pixel-rain]");
      const blank = document.createElement("canvas"); blank.width = canvas.width; blank.height = canvas.height;
      const a = canvas.toDataURL();
      await new Promise((r) => setTimeout(r, 700));
      const b = canvas.toDataURL();
      return { painted: a !== blank.toDataURL(), changed: a !== b };
    });
    out.rainFrames = await frames(first);
    await first.close();
    const firstReduced = await open("/", WIDE, true);
    out.rainReduced = await firstReduced.evaluate(() => document.querySelector("[data-pixel-rain]")?.getAttribute("data-pixel-rain") ?? null);
    out.orbitReduced = await firstReduced.evaluate(() => document.querySelector("[data-orbit]")?.getAttribute("data-orbit") ?? null);
    out.rainFramesReduced = await frames(firstReduced);
    // [B-04] a beam that cannot travel is not drawn
    // [R2-03] …counted through the pill's `data-beam` hook as well as the older `.beam` class, and
    // with a positive control: «none shown» of none found would pass for the wrong reason.
    out.beamsFoundReduced = await firstReduced.evaluate(() => document.querySelectorAll(".beam, [data-beam]").length);
    out.beamsShownReduced = await firstReduced.evaluate(() => [...document.querySelectorAll(".beam, [data-beam]")].filter((el) => getComputedStyle(el).display !== "none").length);
    await firstReduced.close();

    // PILOT — the stepper's progress line. `html { scroll-behavior: smooth }`
    // (globals.css) is deliberate (spec 2026-09-06 R1), so the jump names
    // `behavior: "instant"`, which overrides the CSS property; the two-argument
    // `scrollTo(x, y)` used elsewhere in this file defers to CSS, and those
    // checks only need *some* scroll delta.
    const pilot = await open("/pilot", WIDE);
    await pilot.evaluate(() => {
      const el = document.querySelector("#pilot");
      if (!el) return;
      const target = el.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 400;
      window.scrollTo({ top: target, behavior: "instant" });
    });
    await new Promise((r) => setTimeout(r, 400));
    out.stepperProgress = await pilot.evaluate(() => Number(document.querySelector("[data-scroll-progress]")?.style.getPropertyValue("--gp-progress") ?? "0"));
    await pilot.close();

    // A CLIENT-SIDE PAGE CHANGE OPENS THE NEXT PAGE AT ITS TOP, AT ONCE (R-01).
    // globals.css sets `scroll-behavior: smooth`, and since Next 16 the router
    // suspends it during a route transition only when `<html>` carries
    // `data-scroll-behavior="smooth"`. Without the attribute the viewport
    // animates up through the whole of the new page, and nothing that only
    // `goto`s can see it. So: go to the foot of `/`, follow a footer link with
    // no fragment, and read `scrollY` a moment after the URL changes — a smooth
    // scroll from ~5 000px is nowhere near finished by then.
    const nav = await open("/", WIDE);
    await nav.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await new Promise((r) => setTimeout(r, 200));
    const scrolledBefore = await nav.evaluate(() => window.scrollY);
    await nav.click('footer a[href="/roles"]');
    await nav.waitForFunction(() => window.location.pathname === "/roles", { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 120));
    out.routeChange = { scrolledBefore, scrollYAfter: await nav.evaluate(() => window.scrollY), h1: await nav.evaluate(() => document.querySelector("h1")?.textContent?.slice(0, 24) ?? null) };
    await nav.close();

    const narrow = await open("/product", NARROW);
    // below `md` the header is two rows of links and keeps its ground, at the top of the page too
    const narrowHome = await open("/", NARROW);
    // [QA, 2026-09-22] The same reading as the wide probe, for the same reason:
    // with the ground constant, an opacity of 1 is also what an `<i>` carrying
    // no rule at all reports. R2-07 strengthened the wide pin and left this one.
    out.veilNarrowAtTop = await narrowHome.evaluate(() => {
      const s = getComputedStyle(document.querySelector("[data-header-veil]"));
      return { opacity: s.opacity, blurred: /blur\(/.test(s.backdropFilter || s.webkitBackdropFilter || ""), ground: s.backgroundColor };
    });
    await narrowHome.close();
    out.tiltOnNarrow = await narrow.evaluate(() => document.querySelectorAll('[data-tilt="on"]').length);
    out.depthFlatNarrow = await narrow.evaluate(() => [...document.querySelectorAll("[data-depth]")].every((el) => getComputedStyle(el).transform === "none"));
    // Below `wide` the sticky list is not shown at all; the rows stand alone.
    out.stickyOnNarrow = await narrow.evaluate(() => getComputedStyle(document.querySelector("#stages nav")).display);
    await narrow.close();

    /**
     * The five perpetual CSS loops, under reduced motion.
     *
     * Their entire stop is one deliberately-unlayered `@media` block at the end
     * of `packages/ui/src/base.css`, and NOTHING in the vitest suites can see
     * it: jsdom applies no CSS, so a `motion-audit` pass and a green contract
     * run would both survive that block being moved into `@layer base` — where
     * `!important` inverts layer order and it would silently stop winning. The
     * marquee, the border beam, the review pulse, the receipt drift and the
     * dashed flow would go on running for a reader who asked for no motion,
     * with nothing anywhere reporting it. This is the assertion that sees it —
     * on every page, since the loops are spread over them now.
     */
    out.perpetualUnderReduce = 0;
    for (const [, path] of ROUTES) {
      const reducedPage = await open(path, WIDE, true);
      await reducedPage.evaluate(async () => {
        const height = document.documentElement.scrollHeight;
        for (let y = 0; y < height; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
      });
      await new Promise((r) => setTimeout(r, 400));
      out.perpetualUnderReduce += await reducedPage.evaluate(() =>
        document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).length);
      await reducedPage.close();
    }
    return out;
  }
  report.parity = await parity();
  const p = report.parity;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Every tilted element must reach a perspective ancestor through an
  // unbroken preserve-3d chain, and the page must not quietly lose its
  // tilted surfaces — 21 today (hero frame, 3 capture channels, 4 roles,
  // 2 comparison cards, 3 provenance cells, 3 pilot boxes, 5 route mocks).
  // All three numbers must agree. Comparing only `tiltChainsOk` against
  // `tiltOnWide` is not enough: the chain walk counts every `[data-tilt]`
  // while `tiltOnWide` counts only the enabled ones, so three disabled or
  // three broken elements cancel out and the equality still holds. That is
  // not hypothetical — a stale build reported 21/21 against a page that
  // actually rendered more, and this gate passed it (2026-09-07).
  //
  // [DEV-023] The counts below follow the reference's form: the board and its
  // three satellites are on /product; every ink pill is a magnetic control.
  // [DEV-022] One tilted surface on the whole site — the board. The
  // historical count above (21) is the 2026-09-07 page's; the rule it argues
  // for, that all three numbers must agree, is unchanged.
  //
  // `magneticOnWide` on the home page is 8, not 5: five controls (the pill, the
  // hero's two buttons, the offer's two) plus the hero's receipt and two pills,
  // which follow the pointer by translating. Every other page carries two — the
  // offer's, or on /pilot the form's. They used to tilt, and
  // that was wrong twice over — a 2.58° rotation moved the 251px receipt 0.6px,
  // and the 3D context `Tilt` requires re-sorted the hero's layers so the board
  // painted over both pills.
  const parityOk = p.depthMoves && p.tiltTotal === p.tiltOnWide && p.tiltChainsOk === p.tiltTotal
    && p.tiltOnWide === 1 && same(p.magneticOnWide, { home: 5, product: 4, roles: 1, pilot: 2 })
    && p.stickyCurrent === "#step-03" && p.stickyPosition === "sticky" && Math.abs(p.stickyTop - 96) <= 2 && p.stickyOnNarrow === "none"
    && p.closingHeadingLines <= 3
    && p.rainFrames.painted && p.rainFrames.changed && p.rainFramesReduced.painted && !p.rainFramesReduced.changed && p.beamsFoundReduced >= 1 && p.beamsShownReduced === 0
    && p.rainUnderHeader.maxAlphaInBand <= 90 && p.rainUnderHeader.maxAlphaBelow >= 150 && p.rainUnderHeader.dotsInBand >= 0.9 * p.rainUnderHeader.cellsInBand
    && p.veilAtTop.atTop === null && p.veilAtTop.opacity === "1" && p.veilAtTop.rainTop === 0 && p.veilScrolled.atTop === null && p.veilScrolled.opacity === "1" && p.veilNarrowAtTop.opacity === "1" && p.veilNarrowAtTop.blurred && p.veilNarrowAtTop.ground === p.veilAtTop.ground
    && p.veilAtTop.blurred && p.veilScrolled.blurred && p.veilAtTop.ground !== "rgba(0, 0, 0, 0)" && p.veilScrolled.ground === p.veilAtTop.ground
    && p.rain === "running" && p.orbit === "turning" && p.rainReduced === "still" && p.orbitReduced === "still" && p.heroFillsViewport
    && p.stepperProgress >= 0.99
    // the board's two review cards on the home page, the «пілот» chip on /product
    && same(p.pulsing, { home: 0, product: 3, roles: 0, pilot: 0 })
    && same(p.flowing, { home: 0, product: 3, roles: 0, pilot: 0 })
    && p.tiltOnNarrow === 0 && p.depthFlatNarrow
    && p.perpetualUnderReduce === 0
    && p.routeChange.scrolledBefore > 1000 && p.routeChange.scrollYAfter === 0;
  console.log(`parity: ${parityOk ? "ok" : "PROBLEM"} ${JSON.stringify(p)}`);

  /**
   * DEV-024 — THE POINTER-REACTIVE CANVAS WORDS, measured, because nothing else
   * can see them: `motion-audit` reads CSS and imports, vitest has no canvas,
   * and a `data-*` label only says what the word believes about itself.
   *
   *  - `CellField` (the hero floor, the fact band's grid): dark at rest; lit
   *    after the pointer crosses it; DARK AGAIN once the trail has faded;
   *  - `ArcField` (the closing block): the fan changes while the pointer is over
   *    the block and returns to the very same picture after it leaves;
   *  - AT REST NOTHING ASKS FOR A FRAME: with the closing block on screen, and
   *    the hero and the dome off it, `requestAnimationFrame` is not called at
   *    all — the rain and the sphere are cancelled, the arcs and the cells rest;
   *  - under reduced motion none of them reacts, and no frame is asked for
   *    anywhere on the page;
   *  - on a touch device (`pointer: coarse`) the cells stay dark;
   *  - `ParticleSphere`: in this browser (`--disable-gpu`: no WebGL) it keeps
   *    its still 2D dome and logs nothing; in a second browser with software
   *    WebGL the scene runs, its picture changes, and its loop is `paused` once
   *    the block is off screen; three.js is in none of the first screen's
   *    scripts, in exactly one of those fetched on approach, and in none at all
   *    where WebGL is missing;
   *  - a card hovered under reduced motion changes its border and moves nothing.
   */
  async function interactions() {
    const out = {};
    const WIDE = { width: 1440, height: 900, deviceScaleFactor: 1 };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const openIn = async (b, path, { reduced = false, viewport = WIDE } = {}) => {
      const page = await b.newPage();
      await page.setViewport(viewport);
      if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      await page.evaluateOnNewDocument(() => {
        const raf = window.requestAnimationFrame.bind(window);
        window.__rafCalls = 0;
        window.requestAnimationFrame = (cb) => { window.__rafCalls += 1; return raf(cb); };
      });
      const errors = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: "networkidle0" });
      await sleep(400);
      return { page, errors };
    };
    // Opaque pixels of a 2D canvas — 0 is a blank canvas.
    const lit = (page, selector) => page.evaluate((sel) => {
      const c = document.querySelector(sel);
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n += 1;
      return n;
    }, selector);
    const rafOver = async (page, ms) => { const a = await page.evaluate(() => window.__rafCalls); await sleep(ms); return (await page.evaluate(() => window.__rafCalls)) - a; };
    const bring = async (page, selector, block = "center") => { await page.evaluate((sel, b) => document.querySelector(sel).scrollIntoView({ block: b, behavior: "instant" }), selector, block); await sleep(500); };

    // 1 — the fact band's grid
    const { page: home } = await openIn(browser, "/");
    await bring(home, "#facts", "start");
    const GRID = "#facts > canvas[data-cell-field]";
    await home.mouse.move(8, 8);
    out.gridRest = await lit(home, GRID);
    // Over the FREE grid above the heading: since the owner's third pass the tiles are barred
    // to the field («что бы под карточками не подсвечивался квадраты»), and the old sweep crossed them.
    // …measured from the SECTION's own box, not from the viewport: the page settles after the
    // jump and the band's top lands wherever it lands (146px in one run, not the 80px of its
    // `scroll-mt`), and a fixed y swept the dotted band above the block instead (harness run 6).
    const freeRow = (page) => page.evaluate(() => { const r = document.querySelector("#facts").getBoundingClientRect(); return { x0: r.left + 170, x1: r.right - 170, y: r.top + 40 }; });
    const fr = await freeRow(home);
    await home.mouse.move(fr.x0, fr.y); await home.mouse.move(fr.x1, fr.y + 12, { steps: 20 });
    out.gridLit = await lit(home, GRID);
    await home.mouse.move(8, 8); await sleep(1500);
    out.gridFaded = await lit(home, GRID);
    // [owner, third pass] no cell lights under the tiles — nor one that only overlaps their box
    const tiles = await home.evaluate(() => { const r = document.querySelector("[data-tiles]").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await home.mouse.move(tiles.x + 20, tiles.y + tiles.h / 2); await home.mouse.move(tiles.x + tiles.w - 20, tiles.y + tiles.h / 2, { steps: 24 });
    out.gridLitUnderTiles = await lit(home, GRID);
    // [R3-07] …and the pointer really was over them: a sweep below the viewport delivers no event and reads 0 for the wrong reason
    out.tilesHovered = await home.evaluate(() => !!document.querySelector("[data-tiles] :hover"));
    await home.mouse.move(8, 8); await sleep(300);
    // [owner, second pass] «чтобы под этим глобусом не подсвечивались квадраты»; [seventh pass] «ховер на
    // квадраты так же должен работать вокруг глобуса, но не на самом глобусе». So the bar is the dome's DISC,
    // which `ParticleSphere` publishes on its box (`data-disc`, its own px), not the strip it stands in:
    //  - a sweep ACROSS the dome, well inside the disc, lights nothing;
    //  - a sweep BESIDE the dome, inside the same strip, lights cells — the control, and the owner's ask;
    //  - a sweep along the strip's whole width, crossing the dome's limb twice, lights cells on both sides of it
    //    and not one lit pixel lies within the disc (the bar keeps 10px of margin; 6 are asked here).
    await bring(home, "[data-dome]");
    const domeBox = await home.evaluate(() => { const r = document.querySelector("[data-dome]").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const disc = await home.evaluate(() => { const el = document.querySelector("[data-particle-sphere]"); const r = el.getBoundingClientRect(); const [cx, cy, radius] = (el.getAttribute("data-disc") ?? "").split(" ").map(Number); return { cx: r.x + cx, cy: r.y + cy, r: radius }; });
    out.disc = { r: disc.r, published: Number.isFinite(disc.cx + disc.cy + disc.r) && disc.r > 100 };
    const chord = (y) => Math.sqrt(Math.max(0, disc.r * disc.r - (disc.cy - y) * (disc.cy - y)));
    const yIn = domeBox.y + domeBox.h * 0.7;
    await home.mouse.move(disc.cx - chord(yIn) * 0.7, yIn); await home.mouse.move(disc.cx + chord(yIn) * 0.7, yIn, { steps: 24 });
    out.gridLitUnderDome = await lit(home, GRID);
    await home.mouse.move(8, 8); await sleep(300);
    const yBeside = domeBox.y + domeBox.h * 0.25;
    await home.mouse.move(domeBox.x + 24, yBeside); await home.mouse.move(Math.min(disc.cx - chord(yBeside) - 90, domeBox.x + 320), yBeside, { steps: 16 });
    out.gridLitBesideDome = await lit(home, GRID);
    await home.mouse.move(8, 8); await sleep(1500);
    // [R7-01] TWO sweeps, each read at once: a lit cell fades in under a second, so one long sweep read at its end
    // could find its first cells already dark on a slow machine — a FAIL with nothing wrong.
    const readLimb = () => home.evaluate((sel, d) => {
      const c = document.querySelector(sel); const r = c.getBoundingClientRect(); const k = c.width / r.width;
      const px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let lit = 0, inside = 0, nearest = Infinity;
      for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
        if (px[(y * c.width + x) * 4 + 3] === 0) continue;
        lit += 1;
        const dist = Math.hypot(r.x + x / k - d.cx, r.y + y / k - d.cy);
        if (dist < nearest) nearest = dist;
        if (dist < d.r + 6) inside += 1;
      }
      return { lit, inside, clearance: lit ? Math.round(nearest - d.r) : null };
    }, GRID, disc);
    // …and OUTWARD, from the dome's centre line to the strip's edge (R7b-04): the cells read are then the freshest.
    await home.mouse.move(disc.cx, yIn); await home.mouse.move(domeBox.x + 24, yIn, { steps: 14 });
    const leftHalf = await readLimb();
    await home.mouse.move(8, 8); await sleep(1500);
    await home.mouse.move(disc.cx, yIn); await home.mouse.move(domeBox.x + domeBox.w - 24, yIn, { steps: 14 });
    const rightHalf = await readLimb();
    out.gridAcrossLimb = { lit: leftHalf.lit + rightHalf.lit, inside: leftHalf.inside + rightHalf.inside, left: leftHalf.lit, right: rightHalf.lit, clearance: Math.min(leftHalf.clearance ?? Infinity, rightHalf.clearance ?? Infinity) };
    await home.mouse.move(8, 8); await sleep(1500);
    // [R3-01] THE CONTROL is computed, not a fixed line: since the tiles are barred too, a row
    // at «dome top − 80» is clear only for some grid alignments. The first row that starts at
    // or below the tiles' foot must end at or above the dome's top — at 1440 the 128px gap
    // always holds one (128 ≥ 2·62 − 1) — and the sweep runs along ITS middle.
    const clearRow = await home.evaluate(() => { const c = document.querySelector("#facts > canvas[data-cell-field]").getBoundingClientRect(); const t = document.querySelector("[data-tiles]").getBoundingClientRect(); const d = document.querySelector("[data-dome]").getBoundingClientRect(); const top = Math.ceil((t.bottom - c.top) / 62) * 62; return { top, fits: top + 62 <= d.top - c.top, y: c.top + top + 31 }; });
    out.clearRow = clearRow;
    await home.mouse.move(domeBox.x + domeBox.w * 0.15, clearRow.y);
    await home.mouse.move(domeBox.x + domeBox.w * 0.85, clearRow.y, { steps: 24 });
    out.gridLitAboveDome = await lit(home, GRID);
    await home.mouse.move(8, 8); await sleep(1500);
    // the primary pill's border travels: the ring's angle moves, 3 s a lap
    out.pillBeam = await home.evaluate(async () => {
      const el = document.querySelector('[data-pill="ink"] [data-beam="pill"]');
      if (!el) return null;
      const s = getComputedStyle(el);
      // [owner, sixth pass] the reference's construction: the light travels ALONG THE OUTLINE (a motion path), it is not an
      // angle turning. So what must move is `offset-distance`, and the box itself round the pill; the constant border is the
      // 2px the face leaves uncovered.
      const pill = el.closest("[data-pill]");
      const face = pill.querySelector('[data-pill-layer="face"]');
      const ringLayer = pill.querySelector('[data-pill-layer="ring"]');
      const where = () => { const r = el.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)}`; };
      // [R6-02] BOTH must move, each on its own: with the path lost, `offset-distance` still animates in computed
      // style while the light sits parked in the pill's corner — and with the keyframes lost, nothing moves at all.
      const d0 = getComputedStyle(el).offsetDistance; const b0 = where(); await new Promise((r) => setTimeout(r, 400)); const d1 = getComputedStyle(el).offsetDistance; const b1 = where();
      const pr = pill.getBoundingClientRect(); const fr = face.getBoundingClientRect();
      return { moves: d0 !== d1 && b0 !== b1, distanceMoves: d0 !== d1, boxMoves: b0 !== b1, animation: s.animationName, path: s.offsetPath.slice(0, 40), duration: s.animationDuration, ring: `${Math.round(fr.x - pr.x)}px`, faceIsPillColour: getComputedStyle(face).backgroundColor === getComputedStyle(pill).backgroundColor, ringPainted: getComputedStyle(ringLayer).backgroundColor !== "rgba(0, 0, 0, 0)", clipped: getComputedStyle(pill).overflow, count: document.querySelectorAll('[data-beam="pill"]').length, inkPills: document.querySelectorAll('[data-pill="ink"]').length, onPaper: document.querySelectorAll('[data-pill="paper"] [data-beam]').length };
    });
    // [B2-04] …and it steps aside for the focus ring: two coloured rings round one control blur which is the focus
    await home.keyboard.press("Tab");
    out.pillBeamFocused = await home.evaluate(() => { const a = document.querySelector('#hero [data-pill="ink"]'); a.focus(); const shown = getComputedStyle(a.querySelector("[data-beam]")).display; const visible = a.matches(":focus-visible"); a.blur(); return { focusVisible: visible, beam: shown }; });
    // the dome's dots and lights are the accent, the grid stays ink
    out.domeColours = await home.evaluate(() => {
      const probe = document.createElement("i"); probe.className = "text-accent"; document.body.append(probe);
      const accent = getComputedStyle(probe).color; probe.remove();
      // [R2-04] not the class again — a PAINTED pixel of the still 2D dome (this browser has no
      // WebGL, so that layer is what shows), and the lights' computed gradient.
      const still = document.querySelector('[data-sphere-layer="still"]');
      const d = still.getContext("2d").getImageData(0, 0, still.width, still.height).data;
      let best = -1; for (let i = 3; i < d.length; i += 4) if (d[i] > (best < 0 ? 200 : d[best + 3])) best = i - 3;
      const [r, g, b] = accent.match(/[\d.]+/g).map(Number);
      const near = (x, y) => Math.abs(x - y) <= 6;
      const lights = getComputedStyle(document.querySelector("[data-dome] .landing-dome-light")).backgroundImage;
      return {
        dotsAreAccent: getComputedStyle(document.querySelector("[data-particle-sphere]")).color === accent,
        // [owner, third pass] the lit cells — here and on the hero's floor — and the closing arcs are the accent too; the pixel field stays ink
        gridIsAccent: getComputedStyle(document.querySelector("#facts > canvas[data-cell-field]")).color === accent,
        floorIsAccent: getComputedStyle(document.querySelector("#hero .landing-floor-plane canvas")).color === accent,
        arcsAreAccent: getComputedStyle(document.querySelector("#cta-final canvas[data-arc-field]")).color === accent,
        rainIsAccent: getComputedStyle(document.querySelector("[data-pixel-rain]")).color === accent,
        // the dome's canvas stands 96px taller than its box, and its topmost painted dot is clear of the canvas's top edge
        domeHeadroom: (() => { const c = document.querySelector('[data-sphere-layer="still"]'); const box = document.querySelector("[data-dome]").getBoundingClientRect(); const cr = c.getBoundingClientRect(); const px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let top = -1; for (let y = 0; y < c.height && top < 0; y++) for (let x = 0; x < c.width; x++) if (px[(y * c.width + x) * 4 + 3] > 0) { top = y; break; } return { above: Math.round(box.top - cr.top), firstPaintedRow: Math.round(top / (c.width / cr.width)) }; })(),
        paintedDot: best < 0 ? null : [d[best], d[best + 1], d[best + 2]], accent: [r, g, b],
        paintedDotIsAccent: best >= 0 && near(d[best], r) && near(d[best + 1], g) && near(d[best + 2], b),
        lightsAreGradients: (lights.match(/radial-gradient/g) ?? []).length === 2 && /linear-gradient/.test(lights),
      };
    });

    // 2 — the hero floor, read through its perspective
    await home.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await sleep(500);
    const FLOOR = "#hero .landing-floor-plane canvas[data-cell-field]";
    out.floorRest = await lit(home, FLOOR);
    await home.mouse.move(260, 780); await home.mouse.move(520, 840, { steps: 12 });
    out.floorLit = await lit(home, FLOOR);
    await home.mouse.move(8, 8); await sleep(1500);
    out.floorFaded = await lit(home, FLOOR);

    // 3 — the closing block's arcs, and the page at rest. At the FOOT of the
    // page: with the block centred the dome above it still reaches 18px into the
    // viewport, under the header, and its loop is rightly running.
    const ARCS = "#cta-final canvas[data-arc-field]";
    const toFoot = async (page) => { await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })); await sleep(700); };
    const inBlock = (page, fx, fy) => page.evaluate((x, y) => { const r = document.querySelector("#cta-final").getBoundingClientRect(); const top = Math.max(r.top, 70); return { x: r.left + r.width * x, y: top + (Math.min(r.bottom, innerHeight) - top) * y }; }, fx, fy);
    await toFoot(home);
    await home.mouse.move(8, 8); await sleep(900);
    const picture = () => home.evaluate((sel) => document.querySelector(sel).toDataURL(), ARCS);
    const arcsRest = await picture();
    out.rafAtRest = await rafOver(home, 600);
    const from = await inBlock(home, 0.2, 0.3); const to = await inBlock(home, 0.3, 0.6);
    await home.mouse.move(from.x, from.y); await home.mouse.move(to.x, to.y, { steps: 8 }); await sleep(500);
    out.arcsLean = (await picture()) !== arcsRest;
    out.arcsState = await home.evaluate((sel) => document.querySelector(sel).getAttribute("data-arc-field"), ARCS);
    // leave the block: the header is outside it
    await home.mouse.move(8, 8); await sleep(1800);
    out.arcsReturn = (await picture()) === arcsRest;
    out.rafAfterLeave = await rafOver(home, 600);
    await home.close();

    // 4 — reduced motion: no reaction, no frames
    const { page: calm } = await openIn(browser, "/", { reduced: true });
    await bring(calm, "#facts", "start");
    const frCalm = await freeRow(calm);
    await calm.mouse.move(frCalm.x0, frCalm.y); await calm.mouse.move(frCalm.x1, frCalm.y + 12, { steps: 20 });
    out.gridLitReduced = await lit(calm, GRID);
    out.sphereReduced = await calm.evaluate(() => document.querySelector("[data-particle-sphere]").getAttribute("data-particle-sphere"));
    out.stillDomePainted = (await lit(calm, '[data-sphere-layer="still"]')) > 0;
    await toFoot(calm);
    const calmArcs = await calm.evaluate((sel) => document.querySelector(sel).toDataURL(), ARCS);
    const c1 = await inBlock(calm, 0.2, 0.3); const c2 = await inBlock(calm, 0.3, 0.6);
    await calm.mouse.move(c1.x, c1.y); await calm.mouse.move(c2.x, c2.y, { steps: 8 }); await sleep(400);
    out.arcsLeanReduced = (await calm.evaluate((sel) => document.querySelector(sel).toDataURL(), ARCS)) !== calmArcs;
    out.arcsPaintedReduced = (await lit(calm, ARCS)) > 0;
    out.rafReduced = await rafOver(calm, 600);
    // [B-02] A hover under reduced motion changes a ground or a border and MOVES
    // NOTHING: the reduced block narrows `transition-property`, it does not undo
    // a translate that `:hover` sets — only `motion-safe:` on the class does.
    await bring(calm, '[data-scene="review"]');
    await calm.mouse.move(8, 8); await sleep(300);
    const widgetBox = () => calm.evaluate(() => [...document.querySelectorAll('[data-scene="review"] [aria-hidden="true"] *')].map((el) => { const r = el.getBoundingClientRect(); return `${r.x.toFixed(1)},${r.y.toFixed(1)}`; }).join(";"));
    const border = () => calm.evaluate(() => getComputedStyle(document.querySelector('[data-scene="review"]')).borderTopColor);
    const boxBefore = await widgetBox(); const borderBefore = await border();
    const cardAt = await calm.evaluate(() => { const r = document.querySelector('[data-scene="review"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.4 }; });
    await calm.mouse.move(cardAt.x, cardAt.y); await sleep(500);
    const boxAfter = await widgetBox();
    out.cardHoverReduced = { moved: boxBefore === boxAfter ? 0 : 1, answered: (await border()) !== borderBefore };
    await calm.close();

    // 5 — a touch device: the cells stay dark
    const { page: thumb } = await openIn(browser, "/", { viewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
    await bring(thumb, "#facts", "start");
    await thumb.touchscreen.tap(190, 300); await thumb.mouse.move(100, 300); await thumb.mouse.move(300, 360, { steps: 10 });
    out.gridLitTouch = await lit(thumb, GRID);
    // wherever the thumb lands, the word is not even mounted there (R-06) — the zero above is not an accident of where it swept
    out.gridStateTouch = await thumb.evaluate((sel) => document.querySelector(sel).getAttribute("data-cell-field"), GRID);
    await thumb.close();

    // 6 — the dome without WebGL (this browser): the still layer, no error
    const { page: flat, errors: flatErrors } = await openIn(browser, "/");
    await bring(flat, "[data-dome]"); await sleep(1500);
    out.sphereNoWebgl = await flat.evaluate(() => document.querySelector("[data-particle-sphere]").getAttribute("data-particle-sphere"));
    out.stillDomePaintedNoWebgl = (await lit(flat, '[data-sphere-layer="still"]')) > 0;
    out.errorsNoWebgl = flatErrors;
    // [R-10] …and it never downloads three.js to find that out.
    out.threeWithoutWebgl = await flat.evaluate(async () => {
      const hits = [];
      for (const name of performance.getEntriesByType("resource").map((e) => e.name).filter((n) => /\.js(\?|$)/.test(n))) { const text = await fetch(name).then((r) => r.text()).catch(() => ""); if (text.includes("WebGLRenderer")) hits.push(name.split("/").pop()); }
      return hits;
    });
    await flat.close();

    // 7 — the dome with (software) WebGL, in a browser of its own
    const gl = await puppeteer.launch({
      ...(process.env.GOPROCEED_CHROME_PATH ? { executablePath: process.env.GOPROCEED_CHROME_PATH } : {}),
      headless: true, protocolTimeout: 300000,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
    });
    try {
      const { page: scene, errors: sceneErrors } = await openIn(gl, "/");
      // [R-07] Not «one more script arrived» — a prefetched link would satisfy that.
      // Which scripts carry the renderer: none of the first screen's, one of those
      // that arrive once the dome nears the viewport.
      const scripts = () => scene.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => /\.js(\?|$)/.test(n)));
      const carriesThree = (names) => scene.evaluate(async (list) => {
        const hits = [];
        for (const name of list) { const text = await fetch(name).then((r) => r.text()).catch(() => ""); if (text.includes("WebGLRenderer")) hits.push(name.split("/").pop()); }
        return hits;
      }, names);
      const early = await scripts();
      out.threeInFirstScreen = await carriesThree(early);
      await bring(scene, "[data-dome]");
      // WAIT FOR THE STATE, don't sleep at it. This was `sleep(2500)`, and twice
      // on a loaded machine the software-WebGL browser had not finished fetching
      // and compiling the scene chunk by then: the run failed with
      // `sphere: "still"` and an empty `threeOnApproach` while every other probe
      // on the same page — `sphereTurns`, `sphereLoopOnScreen` — showed the scene
      // running. A fixed sleep asserts the machine's speed, not the product's
      // behaviour. Twelve seconds is a ceiling, not a wait: a dome that arrives
      // in 300ms is read in 300ms, and one that never arrives still fails.
      out.sphere = await scene.waitForFunction(
        // A SETTLED state, not «anything but still»: the first version of this
        // wait took `loading` for an answer and then read the script list before
        // the chunk had arrived, which failed the run for the same reason the
        // fixed sleep did. `running` and `fallback` are the two ends of the
        // scene's life; `still` and `loading` are on the way.
        () => { const v = document.querySelector("[data-particle-sphere]").getAttribute("data-particle-sphere"); return v === "running" || v === "fallback" ? v : null; },
        { timeout: 12000, polling: 100 },
      ).then((h) => h.jsonValue()).catch(() => "still");
      out.threeOnApproach = await carriesThree((await scripts()).filter((n) => !early.includes(n)));
      const box = await scene.evaluate(() => { const r = document.querySelector("[data-dome]").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      const clip = { x: box.x, y: box.y + (await scene.evaluate(() => scrollY)), width: box.width, height: box.height };
      const a = await scene.screenshot({ clip, captureBeyondViewport: false });
      await sleep(900);
      const b = await scene.screenshot({ clip, captureBeyondViewport: false });
      out.sphereTurns = !a.equals(b);
      // [R3-02] THE SCENE keeps its headroom too — the still layer proving it says nothing about
      // WebGL. With the pointer parked, the strip above the dome's box (12px clear of the apex's
      // breath) holds only the static haze, so two shots of it are equal; lose `head` in the scene
      // and the dome grows into the strip, where its turning dots make them differ.
      await scene.mouse.move(8, 8); await sleep(1200);
      const strip = { x: clip.x, y: clip.y - 96, width: clip.width, height: 84 };
      const s1 = await scene.screenshot({ clip: strip, captureBeyondViewport: false });
      await sleep(900);
      const s2 = await scene.screenshot({ clip: strip, captureBeyondViewport: false });
      out.sceneHeadroomStill = s1.equals(s2);
      out.sphereLoopOnScreen = await scene.evaluate(() => document.querySelector('[data-sphere-layer="scene"]').getAttribute("data-sphere-loop"));
      await scene.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })); await sleep(700);
      out.sphereLoopOffScreen = await scene.evaluate(() => document.querySelector('[data-sphere-layer="scene"]').getAttribute("data-sphere-loop"));
      out.errorsWebgl = sceneErrors;
      await scene.close();
    } finally { await gl.close(); }
    return out;
  }
  report.interactions = await interactions();
  const x = report.interactions;
  const interactionsOk = x.gridRest === 0 && x.gridLit > 0 && x.gridFaded === 0
    && x.disc.published && x.gridLitUnderDome === 0 && x.gridLitBesideDome > 0 && x.gridLitAboveDome > 0
    && x.gridAcrossLimb.lit > 0 && x.gridAcrossLimb.inside === 0 && x.gridAcrossLimb.left > 0 && x.gridAcrossLimb.right > 0
    && x.pillBeam && x.pillBeam.moves && x.pillBeam.distanceMoves && x.pillBeam.boxMoves && x.pillBeam.path.startsWith("inset(") && x.pillBeam.animation === "gp-beam-travel" && x.pillBeam.duration === "3s" && x.pillBeam.ring === "2px" && x.pillBeam.faceIsPillColour && x.pillBeam.ringPainted && x.pillBeam.clipped === "hidden" && x.pillBeam.inkPills >= 3 && x.pillBeam.count === x.pillBeam.inkPills && x.pillBeam.onPaper === 0
    && x.pillBeamFocused.focusVisible && x.pillBeamFocused.beam === "none"
    && x.gridLitUnderTiles === 0 && x.tilesHovered && x.clearRow.fits
    && x.domeColours.dotsAreAccent && x.domeColours.gridIsAccent && x.domeColours.floorIsAccent && x.domeColours.arcsAreAccent && !x.domeColours.rainIsAccent
    && x.domeColours.paintedDotIsAccent && x.domeColours.lightsAreGradients
    && x.domeColours.domeHeadroom.above === 96 && x.domeColours.domeHeadroom.firstPaintedRow >= 80
    && x.floorRest === 0 && x.floorLit > 0 && x.floorFaded === 0
    && x.arcsLean && x.arcsState === "leaning" && x.arcsReturn && x.rafAtRest === 0 && x.rafAfterLeave === 0
    && x.gridLitReduced === 0 && x.sphereReduced === "still" && x.stillDomePainted && !x.arcsLeanReduced && x.arcsPaintedReduced && x.rafReduced === 0
    && x.gridLitTouch === 0 && x.gridStateTouch === "off"
    && x.sphereNoWebgl === "fallback" && x.stillDomePaintedNoWebgl && x.errorsNoWebgl.length === 0
    && x.sphere === "running" && x.sphereTurns && x.sceneHeadroomStill && x.sphereLoopOnScreen === "running" && x.sphereLoopOffScreen === "paused"
    && x.threeInFirstScreen.length === 0 && x.threeOnApproach.length === 1 && x.errorsWebgl.length === 0
    && x.threeWithoutWebgl.length === 0
    && x.cardHoverReduced.moved === 0 && x.cardHoverReduced.answered;
  console.log(`interactions: ${interactionsOk ? "ok" : "PROBLEM"} ${JSON.stringify(x)}`);

  const og = await browser.newPage();
  await og.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await og.goto(`http://localhost:${PORT}/og`, { waitUntil: "networkidle0" });
  await og.screenshot({ path: join(app, "public/og.png"), clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log("wrote public/og.png");

  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
  const allOk = [...Object.values(report.widths), ...Object.values(report.reduced)].every((r) => r.ok) && firstFoldOk && linksOk && beamOk && parityOk && interactionsOk;
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
