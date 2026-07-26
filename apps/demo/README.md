# `apps/demo`

Static Vite SPA. Public, Ukrainian-language, unauthenticated discovery demo
for cold/warm outreach (see
`.superpowers/sdd/2026-07-26-p0a-child-a-discovery-prototype/`). No backend,
no Supabase client, no server-rendered routes — `pnpm --filter @aktflow/demo
build` produces a fully static `dist/` that any static host can serve.

This file is **not** a record that the site has been deployed. Nothing in
this repository has run a deploy for `apps/demo`. It documents how to deploy
it correctly, and the prerequisites that currently block doing so.

## 1. Recommended host: Vercel

**Recommendation: Vercel**, for one reason — `infra/README-staging.md`
already provisions `apps/app` and `apps/landing` as Vercel projects from
this same pnpm/Turborepo monorepo, so adding `apps/demo` as a third Vercel
project reuses an already-working install/build pipeline and keeps every
AktFlow surface on one hosting provider instead of introducing a second one
for this app alone.

Project settings (same pattern as the two existing projects in
`infra/README-staging.md` §4):

- **Root directory:** `apps/demo`
- **Framework preset:** Other (static build — Vite is not a first-class
  Vercel framework preset the way Next.js is; `vercel.json` in this
  directory carries the build/output/rewrite configuration explicitly
  instead of relying on preset auto-detection)
- **Build command:** `cd ../.. && pnpm turbo run build --filter=@aktflow/demo`
  (set in `vercel.json`; Vercel's monorepo auto-detect would also work, but
  the explicit form matches `infra/README-staging.md`'s existing two
  projects and removes any ambiguity about which workspace gets built)
- **Install command:** `pnpm install` (repo root — pnpm workspaces require
  this, same note as the other two projects)
- **Output directory:** `dist`
- **Environment variables:** none required to build. Optionally,
  `VITE_PILOT_ENDPOINT` (Production + Preview) — see §3 below; unset by
  default, which is what ships today (the `/pilot` page's `mailto:`
  fallback).
- **Domain:** unresolved — see §2.

This is a recommendation, not a decision already acted on: no Vercel
project has been created for `apps/demo`, and this task does not create one.

## 2. Domain — unresolved, do not invent one

`aktflow.com` appears in this repository only as **planned** infrastructure
(`infra/README-staging.md:207`, and referenced again as the eventual
`apps/landing` domain at line 231). Nothing in this repository shows that
`aktflow.com` is registered or that anyone controls its DNS. Doc 40 §A.3.8
prefers `demo.aktflow.com` over a `*.vercel.app` project subdomain for
credibility and deliverability in a cold email, but that preference is
conditional on the domain actually being controlled — which is not yet
established.

Deploy target hostname: **`{{DEMO_HOSTNAME}}`** — a placeholder, in the same
style as the two placeholder tokens already in the source
(`{{CONTACT_EMAIL}}`, `{{FORM_PROCESSOR}}` — see §3). Before deploying,
replace it with either:

- `demo.aktflow.com`, once `aktflow.com` is confirmed registered and its DNS
  is controlled by whoever is running this deploy, or
- the Vercel-assigned project subdomain (`<project-name>.vercel.app`), if
  a real domain is not yet available and the team decides to proceed
  without one.

This is the single unresolved decision carried from the design, engineering
and CEO reviews (see the "Open dependency" section of
`task-20-brief.md`). It blocks cold sending only — the CEO review ungated
the warm, community and public-corpus outreach tracks from having a
custom domain. Nobody should invent an answer on this app's behalf; it
needs a decision from whoever owns the `aktflow.com` registration question.

## 3. Launch blockers — must be resolved before publishing

Two literal placeholder tokens are rendered as visible text on `/legal/privacy`
and used again in `/pilot`. Neither has an authorised real value. Both carry
`LAUNCH BLOCKER` comments at their point of definition:

| Token | Defined in | Used in |
|---|---|---|
| `{{CONTACT_EMAIL}}` | `apps/demo/src/pages/Legal.tsx:29`, `apps/demo/src/pages/Pilot.tsx:32` | `/legal/privacy` (three places), `/legal/terms` route family, `/pilot`'s `mailto:` fallback and success receipt |
| `{{FORM_PROCESSOR}}` | `apps/demo/src/pages/Legal.tsx:30` | `/legal/privacy` only (two places) |

**The site must not be published until, for each token, one of the
following is true:**

1. it is replaced with a real, authorised value (a monitored mailbox for
   `{{CONTACT_EMAIL}}`; the actual third-party form-processing service name
   for `{{FORM_PROCESSOR}}`), or
2. the sentence containing it is removed.

Do not invent a plausible-looking value for either — an unmonitored
placeholder address would make the privacy page's deletion-request
instructions go nowhere, and naming the wrong form processor would
misdescribe who actually receives submitted data (exactly the failure the
disclosure exists to prevent — see the full comment blocks at the source
locations above).

**`{{FORM_PROCESSOR}}` is conditional on `VITE_PILOT_ENDPOINT`.** `/pilot`
(`apps/demo/src/pages/Pilot.tsx:47`) reads `VITE_PILOT_ENDPOINT` at build
time. Unset (today's state, and Vercel's default if the env var above is
left empty), `submitPilotDraft` never calls `fetch`, and the `mailto:`
fallback is what actually ships — in that case `{{FORM_PROCESSOR}}` never
receives anything and its two sentences on `/legal/privacy` describe a
hypothetical, not current behavior. The moment `VITE_PILOT_ENDPOINT` is set
to a real submission URL for a build, `{{FORM_PROCESSOR}}` stops being
hypothetical: that service actually starts receiving all nine field values,
and the privacy page's disclosure of that fact must be true rather than a
placeholder. **Do not set `VITE_PILOT_ENDPOINT` to a real value without also
resolving `{{FORM_PROCESSOR}}` in the same change** — doing one without the
other means the privacy page misdescribes what the site does with
submitted data.

## 4. The SPA rewrite rule

`apps/demo` is client-routed (`apps/demo/src/App.tsx`): a `<Routes>` tree
with a catch-all —

```tsx
<Route path="*" element={<Navigate to="/demo" replace />} />
```

— that sends every never-written path to the guided `/demo` story instead
of a 404 or a blank screen (spec A.3.2, A.4.3). That catch-all is
JavaScript inside `index.html`'s bundle; it only runs once the browser has
actually loaded `index.html`. If the host serves its own 404 for an unknown
path instead of `index.html`, the catch-all never gets the chance to run
and a visitor following e.g. `/onboarding` or `/app/billing` gets a bare
CDN 404 page instead — the exact failure A.4.3 exists to prevent.

The fix is **not** a blanket "rewrite everything to `index.html`." A
genuinely missing asset — a stale link to a `.png` that was never shipped,
a typo'd `.pdf` path — must still return a real 404. If it instead silently
returns `index.html` with a `200`, two things break: a broken `<img>` fails
without an error a developer can see, and `apps/demo/qa/verify.mjs`'s own
missing-asset accounting (`looksLikeAssetPath` — a dot in the last path
segment means "this is an asset, a miss here is a real 404") becomes
meaningless, because its local dev server would no longer be modeling what
production actually does.

`apps/demo/vercel.json` (added by this task) encodes exactly that
distinction:

```json
{
  "rewrites": [
    { "source": "/((?!.*\\..*).*)", "destination": "/index.html" }
  ]
}
```

The pattern matches a path **only if it contains no `.` anywhere** — i.e.
only route-like paths (`/demo`, `/app/work`, `/onboarding`, any
never-written path). A path with a `.` in it (`/assets/index-abc.js`,
`/favicon.ico`, `/package-demo.pdf`, `/assets/nonexistent.png`) is excluded
from the rewrite and falls through to Vercel's normal static-file handling:
served if the file exists in `dist/`, a real `404` if it does not. This is
the same rule `apps/demo/qa/verify.mjs`'s local server already implements
(`looksLikeAssetPath` in that file) — the QA harness and the production
rewrite agree on what counts as "a route" versus "an asset," so a QA pass
locally is evidence about production behavior rather than a divergent
approximation of it.

Verified against the full route set before writing this file — every one
of the 10 shipped routes and all 18 never-written paths in
`apps/demo/qa/routes.mjs` match the rewrite pattern (none contain a `.`);
every asset path actually present in `apps/demo/dist/` does not match it
(all contain a `.`).

## 5. Local verification before any deploy

```bash
pnpm --filter @aktflow/demo build   # -> apps/demo/dist
pnpm --filter @aktflow/demo qa      # headless-Chrome route/redirect/claim crawl against dist
```

`apps/demo/qa/verify.mjs` serves `dist/` locally with the same
route-vs-asset fallback logic described in §4 and crawls every shipped
route, every never-written redirect, the `/demo` journey, the drawer focus
trap, and scans the bundle for forbidden claim classes and real company
names. It writes its report to the gitignored `apps/demo/qa-output/` and
leaves the tracked tree unchanged — a run should never appear in
`git status`.

Full twenty-item verification gate record (per doc 40 §A.3.8 and this
task's brief):
`.superpowers/sdd/2026-07-26-p0a-child-a-discovery-prototype/task-20-report.md`.
**Do not deploy `apps/demo` until that record shows every one of the
twenty items passed** — as of this file's last update, it does not (see
that report for the current state and what is outstanding).
