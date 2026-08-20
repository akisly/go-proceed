# Three Pilot Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the pilot into three separately-deployed surfaces — landing (`apps/landing`), the system (`apps/app`), and the field client (`apps/mobile` as Expo, web-first) — recording the decision as ADR-009 and deploying the landing, without breaking the working PWA pilot path.

**Architecture:** `apps/app` keeps the `/v1` BFF (60+ routes, already live) and gains the dashboard UI-minimum later (Plan D); the existing field PWA inside it stays the WORKING pilot client until the Expo client passes a parity checklist on physical phones. `apps/mobile` (today a 4-file Expo skeleton) becomes the field client, shipped as Expo-web during the pilot, native later — talking to the same `/v1` with `Authorization: Bearer` (already supported: `apps/app/src/lib/auth.ts` gives Bearer priority over the cookie session, with «mobile» named in its own comment). `apps/landing` deploys as a second Vercel project now.

**Tech Stack:** Next 16.3.1 (app, landing), Expo SDK 57 / RN 0.86 (mobile), supabase-js 2.47.10 (OTP + bearer), Vercel (three projects), Turborepo.

**Spec:** the owner's decision of 2026-08-20, recorded in «Decision record» below (no separate spec file; this section is the spec the tasks argue from).

## Global Constraints

- Synthetic names carry the «Приклад-» prefix; never plausible invented Ukrainian company names.
- `pnpm validate:canonical-docs` must pass after every docs edit (dated records are never rewritten — corrections are dated additions).
- GitHub Actions is refusing all jobs until 2026-09-01 (billing; owner decision to wait). Every task verifies LOCALLY in the shape CI runs it: `pnpm turbo run typecheck`, `pnpm turbo run test --concurrency=1` (local Supabase up), `pnpm turbo run build`.
- UI work in `apps/app/app/**`, `packages/ui/**`, `packages/tokens/**` reads `docs/design/02-building-ui.md` FIRST (role names, no raw ramp values, §5 gate).
- Third-party behaviour (Expo modules, Vercel fields, Supabase auth) is read from CURRENT docs at implementation time, never from memory (CLAUDE.md rule; cite version + URL in the commit).
- The pilot is never blocked: the PWA in `apps/app` remains deployed and functional until ADR-009's parity gate is measured on phones. No task in any plan removes it before that.

## Decision record (the spec)

Owner's decisions, 2026-08-20, after being shown the costs (this amends ADR-007 decision 1; the reversal costs were presented twice and accepted):

1. **Three pilot surfaces, separately deployed:** landing site; the system («дашборд») = `/v1` BFF + office UI-minimum; the field client («моб приложение») for the person taking photos.
2. **The field client's codebase is `apps/mobile` (Expo), shipped as Expo-web for the pilot** — chosen over (a) keeping the PWA as-is with its own domain and (b) extracting a separate Next app. Native phones come later from the same codebase.
3. **Dashboard pilot scope is UI-minimum:** the screens without which the owner cannot run the pilot without curl — create workspace/project + access grants; create assignment; view photo evidence. Not the full register.
4. **Landing deploys now** as a second Vercel project, on `*.vercel.app` until the domain decision.

What ADR-007 keeps (unchanged, load-bearing): decision 2 — `apps/mobile` is the native path's codebase (now also the pilot client's); decision 3 — one contract boundary, the field client speaks the same `/v1`. What is amended: decision 1's «the v0.1 field client is a PWA served from `apps/app`» — true until the Expo client passes parity; then `apps/app`'s field pages retire.

Known costs, accepted: login/list/capture/receipt are rebuilt in RN; Expo-web camera in a browser is still the browser API (native capture measurements stay v0.3, as ADR-007 already held); the store distribution chain stays deferred.

## File structure (this plan)

- Create: `docs/decisions/ADR-009-three-pilot-surfaces.md` — the decision record.
- Modify: `docs/decisions/ADR-007-pilot-field-client.md` — dated amendment pointer under its Decision §1 (append-only; the record is not rewritten).
- Modify: `README.md` — «Product surfaces» list reflects the trio.
- Modify: `TODOS.md` — new P1 tracking the three follow-up plans; supersedes nothing.
- Create: `apps/landing/vercel.json` — build config for the second Vercel project.
- Modify: `infra/README-staging.md` §4 — the landing project subsection gets the real steps + measured verification.

Follow-up plans (separate files, separate execution — scope-split per writing-plans):

- **Plan B — `/v1` cross-origin access:** `2026-08-XX-v1-cors-bearer.md`. Anchors discovered now: `proxy.ts`'s matcher EXCLUDES `/v1`, so CORS cannot live in middleware — it goes into the shared route wrappers (`apps/app/src/lib/command.ts` `queryRoute`/`commandRoute`) plus an `OPTIONS` export; allowlist via a new `FIELD_CLIENT_ORIGINS` env (declared in `turbo.json` `build.env` and §4.3 of the runbook, or the preflight will report it unset); bearer path already works (`auth.ts`: Bearer beats cookie).
- **Plan C — Expo-web field client to parity:** `2026-08-XX-expo-field-client.md`. Parity checklist = README-staging §6.9 + INV-081, verbatim: OTP login (`signInWithOtp` `shouldCreateUser:false` → `verifyOtp` type `email`), «Мої доручення» via `GET /v1/projects` + `GET /v1/projects/{id}/assignments?assignee=me`, assignment screen with the довідковий disclaimer and ≥44pt controls, capture → upload-intent → finalize → receipt (device time / server time / SHA-256) with the unsaved-photo banner, session in `expo-secure-store`, bearer on every `/v1` call. Deployed as the THIRD Vercel project (`expo export --platform web`). Parity is measured on the two physical phones, then — and only then — `apps/app`'s field pages retire in a task of their own.
- **Plan D — dashboard UI-minimum:** `2026-08-XX-dashboard-ui-minimum.md`. Three slices (S1 workspace/project+grants, S2 assignment, S3 evidence view), each behind `docs/design/02-building-ui.md`'s gate, consuming the existing `/v1` routes named in this repo's route listing (no new API).

---

### Task 1: ADR-009 + amendment pointer + README + TODOS

**Files:**
- Create: `docs/decisions/ADR-009-three-pilot-surfaces.md`
- Modify: `docs/decisions/ADR-007-pilot-field-client.md` (under `### 1. The v0.1 field client is a PWA served from apps/app`, append a dated amendment paragraph)
- Modify: `README.md` («Product surfaces» section)
- Modify: `TODOS.md` (new P1 after the closed SMTP P1)

**Interfaces:**
- Consumes: nothing.
- Produces: ADR id `ADR-009` that Plans B/C/D cite; README wording other docs link to.

- [ ] **Step 1: Write ADR-009** with: Status Approved; Context (what existed on 2026-08-20: landing built/undeployed, app = BFF + 2-page field PWA live at goproceed-app.vercel.app, mobile = 4-file skeleton); the four decisions from «Decision record» above, verbatim; the amendment relationship to ADR-007 (§1 amended, §2/§3 strengthened); the accepted costs; the parity gate («apps/app field pages retire only after the Expo client passes §6.9 on the two physical phones, measured»); Consequences (three Vercel projects; three hostnames in the domain decision; pilot un-blocked throughout).
- [ ] **Step 2: Append to ADR-007 §1** (do not edit existing text): `> **Amended 2026-08-20 by [ADR-009](ADR-009-three-pilot-surfaces.md):** the field client's codebase moves to apps/mobile (Expo, web-first); this section remains the accurate record of v0.1 as shipped, and the PWA it describes stays in service until ADR-009's parity gate is measured.`
- [ ] **Step 3: Rewrite README «Product surfaces»** to name the trio and the transition state (PWA serving until parity; mobile = pilot client codebase, not just v0.3 parking).
- [ ] **Step 4: Add the TODOS P1** «Three pilot surfaces (ADR-009): plans B, C, D» — one paragraph each, linking the plan filenames above, stating the parity gate and that the pilot runs on the PWA meanwhile.
- [ ] **Step 5: Validate + commit**

Run: `pnpm validate:canonical-docs` → expect `OK`.
```bash
git add docs/decisions README.md TODOS.md && git commit -m "adr-009: three pilot surfaces — landing, system, Expo-web field client (amends ADR-007 §1)"
```

### Task 2: `apps/landing/vercel.json`

**Files:**
- Create: `apps/landing/vercel.json`

**Interfaces:**
- Produces: the build config Task 3's Vercel project reads.

- [ ] **Step 1: Write the file** (landing has NO env vars — verified by grep on 2026-08-20 — so no production-only guard and no preflight; previews are harmless and useful; no `regions` — no database, static marketing is CDN-served):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=@goproceed/landing",
  "ignoreCommand": "cd ../.. && npx turbo-ignore @goproceed/landing"
}
```
- [ ] **Step 2: Verify the build command works locally**

Run: `pnpm turbo run build --filter=@goproceed/landing` → expect `Tasks: 1 successful` (plus cached deps).
- [ ] **Step 3: Commit**
```bash
git add apps/landing/vercel.json && git commit -m "landing: vercel.json for the second Vercel project (no env, previews allowed, turbo-ignore)"
```

### Task 3: Create the Vercel project and deploy

**Files:**
- Modify: `infra/README-staging.md` §4 (landing subsection: real steps instead of «optional», then the measured result)

**Interfaces:**
- Consumes: Task 2's `vercel.json`.
- Produces: a live `https://goproceed-landing-*.vercel.app` origin the README/Status cites.

- [ ] **Step 1: Create the project** — dashboard: Add New → Project → import `akisly/go-proceed` → **Root Directory: `apps/landing`** → name `goproceed-landing` → Deploy (no env vars to set). MCP alternative (`create_git_project` / `deploy_to_vercel`) only with the owner watching — it is an account-level action.
- [ ] **Step 2: Open Deployment Protection** — same trap §5.4 records for the app: a new project ships with Vercel Authentication protecting `*.vercel.app`; set it to «Only Preview Deployments» or every visitor gets a 302 to vercel.com SSO.
- [ ] **Step 3: Verify, measured** — `curl -sI https://<assigned-domain>/` → expect `200`, `content-type: text/html`, and `x-vercel-id` present; paste the actual lines into §4's landing subsection with the date.
- [ ] **Step 4: Update runbook + commit**
```bash
git add infra/README-staging.md && git commit -m "runbook §4: the landing is a real second project now — steps and the measured 200"
```

### Task 4: Local full verification + PR

- [ ] **Step 1:** `pnpm validate:canonical-docs` → `OK`; `pnpm turbo run typecheck` → 10/10 (9 after demo removal — read the count the run reports and expect all successful); `pnpm turbo run build` → all successful.
- [ ] **Step 2:** Push the branch, open the PR titled «ADR-009: three pilot surfaces — the record, and the landing goes live», body naming: the decision, the parity gate, what is deliberately NOT in this PR (Plans B/C/D), and that CI will not run until 2026-09-01 (billing) with the local verification pasted.

---

## Self-review

- Spec coverage: decision 1 → ADR-009 (Task 1); decision 2 → ADR-009 + Plans B/C named with anchors; decision 3 → Plan D named; decision 4 → Tasks 2–3. The parity gate and pilot-never-blocked constraints appear in Global Constraints, ADR-009 content, and Plan C. No gaps.
- Placeholder scan: the only deferred content is in the three FOLLOW-UP plan files, which is the scope split writing-plans prescribes, not a placeholder inside this plan's tasks; `2026-08-XX` in their filenames is resolved by whoever opens each plan on its day.
- Type consistency: no code interfaces cross tasks here; the one produced identifier (`ADR-009`) is used consistently.
