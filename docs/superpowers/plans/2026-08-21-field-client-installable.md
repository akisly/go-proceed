# Field Client Installable (PWA manifest) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Expo-web field client installable on a phone's home screen (README-staging §6.9 item 5): a served web manifest with Ukrainian name and icons, the iOS standalone meta tags, and the harness asserting all of it — closing the gap measured on 2026-08-21 (`/manifest.webmanifest` on the field origin answered `200 text/html`: the SPA rewrite swallowed it; no manifest existed).

**Architecture:** Expo SDK 57's "single" (SPA) export generates no manifest and ignores `+html.tsx` (measured, see `scripts/set-html-lang.mjs`'s header). So: static files in `apps/mobile/public/` (copied into `dist/` by `expo export`, served before the SPA rewrite by Vercel's filesystem-first routing and by the harness's static server), and the existing post-export HTML patch generalised from «set lang» to «finalize head»: inject `<link rel="manifest">`, `<meta name="theme-color">`, the `apple-mobile-web-app-*` trio and `<link rel="apple-touch-icon">`. Icons are generated ONCE from `assets/icon.png` with macOS `sips` and committed — no build-time image dependency. Colours come from `@goproceed/tokens` light theme (`bg-canvas` #FBFBF9 background, `action-primary-bg` #11100F theme), read from `tokens.generated.ts` at authoring time and cited.

**Tech Stack:** W3C Web App Manifest (MDN), Expo SDK 57 web export (`public/` copy semantics — docs.expo.dev/deploy/web, read 2026-08-20), Vercel static routing, the existing puppeteer harness.

**Spec:** ADR-009 parity gate = README-staging §6.9 verbatim; item 5: «Add the app to the home screen (the manifest is served); reopen it from there; confirm the session survived.» The PWA's own harness asserted: manifest 200, `lang` "uk", non-empty `name`, non-empty `icons` (qa/field.mjs:841-933) — restored here with equal strictness.

## Global Constraints

- `apps/app` untouched. `pnpm validate:canonical-docs` after docs edits. CI billing-paused: verify locally (mobile tests, typecheck, `pnpm --filter @goproceed/mobile qa` → ok:true).
- The post-export script keeps its loud-failure contract for EVERY patch it makes (lang, manifest link, each meta): a missing anchor is a failed build, never a silent skip.
- Copy in Ukrainian: manifest `name` «GoProceed — польовий клієнт», `short_name` «GoProceed», `lang` «uk», `description` «Фіксація прихованих робіт: фото з підтвердженням сервера.» (new strings — not in copy-catalog; record them in the manifest only; the catalog governs in-app copy).
- Session-survival note (item 5): iOS standalone web apps run in their own storage partition — the first launch from the home screen signs in again; what must survive is relaunch-to-relaunch of the installed app. Record this in the runbook so the tester does not read the first re-login as a failure.

### Task 1: manifest, icons, head finalization

**Files:** Create `apps/mobile/public/manifest.webmanifest`, `apps/mobile/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180); Rename `apps/mobile/scripts/set-html-lang.mjs` → `scripts/finalize-web-html.mjs` (keep the lang step and its header's history; add the head injections); Modify `apps/mobile/vercel.json` (buildCommand's script name), `apps/mobile/qa/field-web.mjs` (export step's script name).

- [ ] Generate icons: `sips -z 192 192 assets/icon.png --out public/icons/icon-192.png` (likewise 512, 180 for apple-touch-icon); maskable 512 = the same image (Expo's icon has safe padding) with `"purpose": "maskable"` — state in the manifest comment-free JSON via the `purpose` field only.
- [ ] Manifest JSON: `{ "name", "short_name", "lang": "uk", "dir": "ltr", "start_url": "/", "scope": "/", "display": "standalone", "orientation": "portrait", "background_color": "#FBFBF9", "theme_color": "#11100F", "description", "icons": [ {src:"/icons/icon-192.png", sizes:"192x192", type:"image/png"}, {src:"/icons/icon-512.png", sizes:"512x512", type:"image/png"}, {src:"/icons/icon-maskable-512.png", sizes:"512x512", type:"image/png", purpose:"maskable"} ] }`.
- [ ] `finalize-web-html.mjs`: after the lang replacement, inject before `</head>` (anchor must exist or fail): `<link rel="manifest" href="/manifest.webmanifest">`, `<meta name="theme-color" content="#11100F">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<meta name="apple-mobile-web-app-title" content="GoProceed">`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`. Idempotent: if the manifest link is already present, fail loudly (a double run means the pipeline ran twice — surface it).
- [ ] Verify: `expo export --platform web --clear` + the script → `dist/manifest.webmanifest` and `dist/icons/*` exist; `dist/index.html` carries all six injected tags and `lang="uk"`. Commit.

### Task 2: the harness asserts installability

**Files:** Modify `apps/mobile/qa/field-web.mjs` (unauthenticated-surface audit), its static server (content-type map: `.webmanifest` → `application/manifest+json`, `.png` → `image/png`).

- [ ] Restore the PWA harness's manifest assertions with equal strictness (qa/field.mjs:841-933 shape): fetch `/manifest.webmanifest` directly → 200, content-type contains `application/manifest+json`, JSON with `lang === "uk"`, non-empty `name`, non-empty `icons`; each icon `src` fetches 200 `image/png`; `/` HTML contains `<link rel="manifest"` and `apple-mobile-web-app-capable`. A SPA rewrite swallowing the manifest (200 text/html) must be a FINDING (that is precisely the defect measured on the field origin).
- [ ] Run `pnpm --filter @goproceed/mobile qa` → ok:true, 5/5. Commit.

### Task 3: docs

- [ ] `infra/README-staging.md` §4.5: the manifest/icons/head facts, the Vercel filesystem-before-rewrite reliance (verify on the live origin after merge: `curl -sI https://goproceed-field.vercel.app/manifest.webmanifest` → `application/manifest+json`), and the iOS storage-partition note for §6.9 item 5. `TODOS.md`: two follow-ups surfaced by the phone test — (a) `GET /v1/projects/{id}/assignments?assignee=me` lists `cancelled` assignments (route has no status filter; both clients show them — decide filter-in-route vs client); (b) the in-flight wording of the INV-081 banner (proposal: a «надсилання триває» variant while sending/awaiting, the current text on failure — catalog + both clients + tests + harness; owner decision pending). Validate, commit.

## Self-review
- §6.9 item 5 coverage: manifest served (T1), asserted (T2), tester guidance (T3). Placeholders: none. Names consistent (`finalize-web-html.mjs` in vercel.json + harness + T1).
