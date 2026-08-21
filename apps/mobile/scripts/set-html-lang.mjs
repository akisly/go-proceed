// POST-EXPORT PATCH, NOT THE FIRST THING TRIED. expo-router's documented
// root-document customization point is `src/app/+html.tsx`
// (docs.expo.dev/router/web/static-rendering, read 2026-08-21 —
// `export default function Root({ children }) { return <html lang="uk">…
// </html>; }`), and that was tried first. It does NOT work here, confirmed
// empirically rather than assumed: with that file in place, `expo export
// --platform web --clear` produced a `dist/index.html` BYTE-IDENTICAL to
// the one produced without it — still `lang="en"`. The docs describe
// `+html.tsx` under STATIC rendering (`web.output: "static"`, one HTML
// file per route); this project runs the DEFAULT `web.output: "single"`
// (SPA, one `index.html` for every route — `app.json` sets no explicit
// `web.output`), and that mode does not honour the file at all. There is
// also no `app.json` config key for this: `@expo/config-types@57.0.2` (the
// schema this project resolves) carries no `lang` field anywhere under
// `expo.web`.
//
// So this is the honest fallback the task brief asked for when the
// documented mechanism doesn't apply: a direct string replacement on the
// ONE `index.html` a "single"-mode export produces. Ukrainian is the only
// language this client ever renders (every screen, every string —
// `apps/mobile/src/lib/status-labels.generated.json`, the disclaimer, every
// hand-written copy string), so there is no locale switching this script
// could get wrong by hardcoding the replacement.
//
// FAILS LOUDLY IF THE PATTERN IS ABSENT, rather than silently doing
// nothing. A future Expo upgrade that changes the generated template's
// exact `lang` spelling, or a project switch to `web.output: "static"`
// (where `dist/` would gain per-route files this script never looks at),
// must not leave this script quietly reporting success while the wrong
// language ships.
//
// RUN AFTER EVERY `expo export --platform web`, not optionally: wired into
// `apps/mobile/qa/field-web.mjs`'s own export step, and Task 7's
// `vercel.json` `buildCommand` must append this same script after its own
// `expo export` call — see that task's own note.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distIndexPath = join(import.meta.dirname, "..", "dist", "index.html");
const FROM = '<html lang="en"';
const TO = '<html lang="uk"';

const html = readFileSync(distIndexPath, "utf8");
if (!html.includes(FROM)) {
  console.error(
    `scripts/set-html-lang.mjs: expected to find ${JSON.stringify(FROM)} in ${distIndexPath}, ` +
    "did not find it — the export's generated template may have changed shape. Refusing to " +
    "silently leave the wrong <html lang> in place; update this script's FROM/TO pair once " +
    "the new shape is confirmed.",
  );
  process.exit(1);
}
writeFileSync(distIndexPath, html.replace(FROM, TO));
console.log(`scripts/set-html-lang.mjs: ${distIndexPath} now carries ${TO}`);
