// POST-EXPORT PATCH, NOT THE FIRST THING TRIED. expo-router's documented
// root-document customization point is `src/app/+html.tsx`
// (docs.expo.dev/router/web/static-rendering, read 2026-08-21 —
// `export default function Root({ children }) { return <html lang="uk">…
// </html>; }`), and that was tried first. It does NOT work here, confirmed
// empirically rather than assumed: with that file in place, `expo export
// --platform web --clear` produced a `dist/index.html` BYTE-IDENTICAL to
// the one produced without it — still `lang="en"` and no room to inject a
// `<link rel="manifest">` or the `apple-mobile-web-app-*` meta trio either.
// The docs describe `+html.tsx` under STATIC rendering (`web.output:
// "static"`, one HTML file per route); this project runs the DEFAULT
// `web.output: "single"` (SPA, one `index.html` for every route —
// `app.json` sets no explicit `web.output`), and that mode does not honour
// the file at all. There is also no `app.json` config key for any of this:
// `@expo/config-types@57.0.2` (the schema this project resolves) carries no
// `lang` field, and no manifest/PWA-head field, anywhere under `expo.web`.
//
// So this is the honest fallback the task brief asked for when the
// documented mechanism doesn't apply: a direct string patch on the ONE
// `index.html` a "single"-mode export produces — originally just the
// `lang` attribute (`set-html-lang.mjs`, this file's former name), now
// generalised to every other head fact this export never writes either:
// the installability tags README-staging §6.9 item 5 needs (`<link
// rel="manifest">`, `theme-color`, the `apple-mobile-web-app-*` trio, and
// `apple-touch-icon`). Ukrainian is the only language this client ever
// renders (every screen, every string —
// `apps/mobile/src/lib/status-labels.generated.json`, the disclaimer, every
// hand-written copy string), so there is no locale switching the lang patch
// could get wrong by hardcoding the replacement. The manifest itself and
// every icon it points at live under `apps/mobile/public/` — copied
// byte-for-byte into `dist/` by `expo export` (docs.expo.dev/deploy/web,
// read 2026-08-20) and generated ONCE from `assets/icon.png` with macOS
// `sips`, committed rather than regenerated at build time, so this script
// only ever links to files that already exist on disk by the time it runs.
//
// FAILS LOUDLY IF AN EXPECTED PATTERN IS ABSENT, rather than silently doing
// nothing — for EVERY patch this script makes, not just the lang one. A
// future Expo upgrade that changes the generated template's exact `lang`
// spelling or `</head>` shape, or a project switch to `web.output: "static"`
// (where `dist/` would gain per-route files this script never looks at),
// must not leave this script quietly reporting success while the wrong
// language or a manifest-less head ships. Equally, if `<link rel="manifest"`
// is ALREADY present in the export's `index.html`, that means this script
// ran twice against the same `dist/` — also a loud failure, not a silent
// no-op, since a second run means the pipeline's own invariant (run exactly
// once per export) broke somewhere upstream.
//
// RUN AFTER EVERY `expo export --platform web`, not optionally: wired into
// `apps/mobile/qa/field-web.mjs`'s own export step, and `vercel.json`'s
// `buildCommand` appends this same script after its own `expo export` call.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distIndexPath = join(import.meta.dirname, "..", "dist", "index.html");
let html = readFileSync(distIndexPath, "utf8");

function fail(message) {
  console.error(`scripts/finalize-web-html.mjs: ${message}`);
  process.exit(1);
}

// Idempotency guard FIRST, before ANY patch (lang included): a manifest
// link already present means this script already ran against this exact
// dist/ — a second run means the build pipeline invoked it twice, which
// this script must surface rather than silently re-patch (or worse,
// double-inject). Checked ahead of the lang replacement on purpose — a
// second invocation would ALSO fail the lang check below (lang is already
// "uk" by then), but that failure would misreport the actual cause as a
// template-shape change rather than a double run; this guard names the
// real problem first.
if (html.includes('rel="manifest"')) {
  fail(
    `${distIndexPath} already carries a <link rel="manifest"> — this script appears to have run ` +
    "twice against the same export. That means the build pipeline (vercel.json's buildCommand, or " +
    "qa/field-web.mjs's export step) invoked it more than once; fix the double invocation rather " +
    "than re-running this script.",
  );
}

// ── <html lang="uk"> ────────────────────────────────────────────────────
const LANG_FROM = '<html lang="en"';
const LANG_TO = '<html lang="uk"';
if (!html.includes(LANG_FROM)) {
  fail(
    `expected to find ${JSON.stringify(LANG_FROM)} in ${distIndexPath}, did not find it — the ` +
    "export's generated template may have changed shape. Refusing to silently leave the wrong " +
    "<html lang> in place; update this script's LANG_FROM/LANG_TO pair once the new shape is confirmed.",
  );
}
html = html.replace(LANG_FROM, LANG_TO);

// ── Installability head tags (README-staging §6.9 item 5) ─────────────────
const HEAD_CLOSE = "</head>";
if (!html.includes(HEAD_CLOSE)) {
  fail(
    `expected to find ${JSON.stringify(HEAD_CLOSE)} in ${distIndexPath} to inject the manifest ` +
    "link and PWA meta tags before it, did not find it — the export's generated template may have " +
    "changed shape.",
  );
}

const HEAD_INJECTIONS = [
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<meta name="theme-color" content="#11100F">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<meta name="apple-mobile-web-app-title" content="GoProceed">',
  '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
].join("");
html = html.replace(HEAD_CLOSE, `${HEAD_INJECTIONS}${HEAD_CLOSE}`);

writeFileSync(distIndexPath, html);
console.log(
  `scripts/finalize-web-html.mjs: ${distIndexPath} now carries ${LANG_TO}, a manifest link, and ` +
  "the apple-mobile-web-app-* meta trio",
);
