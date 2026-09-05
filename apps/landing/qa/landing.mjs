#!/usr/bin/env node
// Builds and starts the landing, then photographs it at seven widths, checks
// for horizontal overflow and console errors, repeats under reduced motion,
// and writes public/og.png from /og. Run: pnpm --filter @goproceed/landing qa
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

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
const browser = await puppeteer.launch({
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
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1; })
      .map((el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className).split(" ")[0]}`)
      .slice(0, 10);
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, wide };
  });
  await page.close();
  const ok = overflow.scrollWidth === overflow.innerWidth && overflow.wide.length === 0 && errors.length === 0 && settledOk;
  (reduced ? report.reduced : report.widths)[width] = { ok, ...overflow, errors, settledAtLoad };
  console.log(`${reduced ? "reduced " : ""}${width}px: ${ok ? "ok" : "PROBLEM"} scrollWidth=${overflow.scrollWidth} wide=${overflow.wide.length} errors=${errors.length} settledAtLoad=${settledAtLoad === null ? "n/a" : settledAtLoad}`);
}

for (const w of WIDTHS) await audit(w, false);
for (const w of [1440, 390]) await audit(w, true);

const og = await browser.newPage();
await og.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await og.goto(`http://localhost:${PORT}/og`, { waitUntil: "networkidle0" });
await og.screenshot({ path: join(app, "public/og.png"), clip: { x: 0, y: 0, width: 1200, height: 630 } });
console.log("wrote public/og.png");

await browser.close();
server.kill();
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
const allOk = [...Object.values(report.widths), ...Object.values(report.reduced)].every((r) => r.ok);
console.log(allOk ? "landing qa: ok" : "landing qa: PROBLEMS — see qa-output/report.json");
process.exit(allOk ? 0 : 1);
