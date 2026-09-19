#!/usr/bin/env node
// Builds and starts the landing, then photographs each of its four pages
// (DEV-022) at seven widths, checks for horizontal overflow and console errors,
// repeats under reduced motion, follows every internal link, measures the
// Border Beam on the settled product frame, and writes public/og.png from /og.
// Run: pnpm --filter @goproceed/landing qa
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
  // (a) or (b) of the contract fires immediately. Only the home page carries a
  // `ScrollSettle`, so only the home page is asked.
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
    const checkSettled = route === "home" && (reduced || width >= 768);
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
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle0" }); // the board is the home page's
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
      const el = document.querySelector(".beam");
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
    const handle = present ? await page.$(".beam") : null;
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

  for (const route of ROUTES) for (const w of WIDTHS) await audit(route, w, false);
  for (const route of ROUTES) for (const w of [1440, 390]) await audit(route, w, true);

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

    // HOME — the hero's depth layers and the one tilted surface.
    const wide = await open("/", WIDE);
    const depthAtTop = await wide.evaluate(() => [...document.querySelectorAll("[data-depth]")].map((el) => getComputedStyle(el).transform));
    await wide.evaluate(() => window.scrollTo(0, 600));
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

    // PRODUCT — the sticky route stack.
    const product = await open("/product", WIDE);
    out.stackOnWide = await product.evaluate(() => document.querySelector("[data-scroll-stack]")?.getAttribute("data-scroll-stack"));
    await product.close();

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

    const narrow = await open("/", NARROW);
    out.tiltOnNarrow = await narrow.evaluate(() => document.querySelectorAll('[data-tilt="on"]').length);
    out.depthFlatNarrow = await narrow.evaluate(() => [...document.querySelectorAll("[data-depth]")].every((el) => getComputedStyle(el).transform === "none"));
    await narrow.close();
    const narrowProduct = await open("/product", NARROW);
    out.stackOnNarrow = await narrowProduct.evaluate(() => document.querySelector("[data-scroll-stack]")?.getAttribute("data-scroll-stack"));
    await narrowProduct.close();

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
  // [DEV-022] One tilted surface on the whole site — the hero's board. The
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
    && p.tiltOnWide === 1 && same(p.magneticOnWide, { home: 8, product: 2, roles: 2, pilot: 2 }) && p.stackOnWide === "on"
    && p.stepperProgress >= 0.99
    // the board's two review cards on the home page, the «пілот» chip on /product
    && same(p.pulsing, { home: 2, product: 1, roles: 0, pilot: 0 })
    && same(p.flowing, { home: 0, product: 3, roles: 0, pilot: 0 })
    && p.tiltOnNarrow === 0 && p.depthFlatNarrow && p.stackOnNarrow === "off"
    && p.perpetualUnderReduce === 0
    && p.routeChange.scrolledBefore > 1000 && p.routeChange.scrollYAfter === 0;
  console.log(`parity: ${parityOk ? "ok" : "PROBLEM"} ${JSON.stringify(p)}`);

  const og = await browser.newPage();
  await og.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await og.goto(`http://localhost:${PORT}/og`, { waitUntil: "networkidle0" });
  await og.screenshot({ path: join(app, "public/og.png"), clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log("wrote public/og.png");

  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
  const allOk = [...Object.values(report.widths), ...Object.values(report.reduced)].every((r) => r.ok) && linksOk && beamOk && parityOk;
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
