# Expo Field Client (web-first) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the field client (login → «Мої доручення» → obligation screen → capture → receipt) in `apps/mobile` (Expo SDK 57), shipped as an Expo-web SPA on a third Vercel project, talking to `apps/app`'s `/v1` with `Authorization: Bearer` through Plan B's CORS layer — to the parity gate of README-staging §6.9 + INV-081, measured by a ported browser QA harness. The PWA in `apps/app` is NOT touched and keeps serving the pilot until the phones pass (ADR-009 parity gate).

**Architecture:** expo-router SPA (`web.output` default "single"), screens in `src/screens`, routes in `src/app` (existing convention). Auth: supabase-js (already 2.112.3 in the workspace) with `signInWithOtp({shouldCreateUser:false})` → `verifyOtp({type:"email"})`; on web the session persists in localStorage (supabase-js default when `window` exists); every `/v1` call attaches `Authorization: Bearer <session.access_token>`. Data flow is the PWA's, client-side: `GET /v1/projects` → per-project `GET /v1/projects/{id}/assignments?assignee=me`; obligation screen `GET /v1/assignments/{id}/requirement-occurrences`. Capture is the PWA's exact wire protocol: SHA-256 of the bytes → `POST /v1/assignments/{id}/upload-intents` → `PUT signedUrl` (only `content-type`, NO auth headers — the signed token IS the grant, and this PUT is ALREADY cross-origin today) → `POST /v1/upload-intents/{id}/finalize` `{}` → receipt renders the SERVER's `contentHash`/`serverReceivedAt` plus client-local device time. Camera: `expo-image-picker`'s `launchCameraAsync` — on web it degrades to `<input type="file" capture="environment">`, byte-for-byte the PWA's control; hashing via `expo-crypto` `Crypto.digest("SHA-256", bytes)` (works web + native, one path). Pure logic (assignments builder, capture state machine, otp-error copy) is PORTED verbatim from `apps/app` with its unit tests — transitional duplication, retired with the PWA per ADR-009.

**Tech Stack:** Expo 57.0.9 / RN 0.86.2 / expo-router 57.0.9 (pinned, installed), react-native-web, @goproceed/tokens (`color[THEME][role]` per token-proof convention), supabase-js 2.112.x, expo-image-picker + expo-crypto (to add via `npx expo install`), puppeteer QA harness ported from `apps/app/qa/field.mjs`.

**Spec:** ADR-009 (`docs/decisions/ADR-009-three-pilot-surfaces.md`) + the parity checklist it names: `infra/README-staging.md` §6 item 9 and INV-081 (`technical/database/invariant-catalog.csv:82`), applied VERBATIM — never re-authored. Research record: the five-reader workflow of 2026-08-20 (facts cited inline below as file:line / doc URL).

## Global Constraints

- **`apps/app` is not touched by any task.** The one production change on its side is the `FIELD_CLIENT_ORIGINS` env value — dashboard, owner's hands, Task 7.
- Ukrainian copy is LOAD-BEARING and ports byte-identically: the QA harness asserts exact strings (list heading, empty states, disclaimer, banner, state labels). Never rephrase; never invent. «Приклад-» rule for anything synthetic.
- Every third-party call was read from current docs on 2026-08-20 (Expo v57 sdk pages, supabase-js reference, guides/using-supabase; URLs in the research record); implementers follow the citations in their briefs, not memory. `apps/mobile/AGENTS.md` additionally mandates the v57 docs.
- CI is billing-paused until 2026-09-01: verify locally in CI's shape (`turbo run typecheck`, `test --concurrency=1` with local Supabase up, `build`), plus this plan's own QA harness.
- `pnpm validate:canonical-docs` after every docs edit. `EXPO_PUBLIC_*` env reads use DOT NOTATION ONLY (`process.env.EXPO_PUBLIC_X`) — destructuring и index access are not inlined by Metro.
- Receipt semantics: the displayed SHA-256 is the SERVER's hash from the finalize response, never the locally computed one (they are equal only because finalize 422s on mismatch — rendering the local value changes the claim's meaning). Device time is labelled «Час пристрою (не перевірено)». No success is reported before `status==="available"` && contentHash && evidenceObjectId && serverReceivedAt (INV-081).
- The capture PUT to storage carries NO `Authorization`/`apikey` header.
- Token usage per the token-proof convention: `const THEME: ThemeName = "light"` pinned; roles as `color[THEME]["role-name"]`; status surface+fg taken as a PAIR from the same `status-*` role; ≥44×44 touch targets via explicit `minHeight/minWidth: 44` on every pressable.

## File structure (`apps/mobile`)

- `src/lib/env.ts` — EXPO_PUBLIC_ reads (dot notation): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_API_ORIGIN`.
- `src/lib/supabase.ts` — the one client; `src/lib/api.ts` — bearer fetch + problem+json reader (`readProblem` port).
- `src/lib/otp-error.ts` (+ test) — verbatim port from `apps/app/src/lib/otp-error.ts`.
- `src/lib/field/assignments.ts` (+ test) — verbatim port of the decision logic + copy constants from `apps/app/src/lib/field/assignments.ts` (+ its test file).
- `src/lib/capture/state.ts` (+ test) — verbatim port of `apps/app/src/lib/capture/state.ts` (states, `UNSAVED_PHOTO_WARNING`, `serverDoesNotHaveThePhoto`, `holdsUnsavedBytes`).
- `src/lib/capture/upload.ts` (+ test) — port of `apps/app/src/lib/capture/upload.ts` with two deltas: fetch goes through `api.ts` (bearer instead of cookie); bytes/hash come from the picker asset (`asset.file.arrayBuffer()` on web) via `expo-crypto` `Crypto.digest`.
- `src/lib/status-labels.ts` — extend `ClientState` with `"discarded"` (the generated JSON already has 7 keys; the type has 6) and add the row to token-proof's `TONE`/`STATES`.
- `src/screens/login.tsx`, `src/screens/my-assignments.tsx`, `src/screens/assignment.tsx` (+ capture component `src/screens/capture.tsx`); routes `src/app/login.tsx`, `src/app/index.tsx` (replaces TokenProof as `/` — TokenProof moves to `src/app/token-proof.tsx`), `src/app/a/[assignmentId].tsx`.
- `qa/field-web.mjs` — the parity harness (ported five audits), `package.json` gains `qa` script; `vercel.json`; `.env.example`.
- Docs: TODOS (Plan C progress — NOT closed; closes only on phones), runbook §6.9 pointer, ADR-009 filename resolution, **CLAUDE.md dated correction** (the 2.47.10 note is stale — installed is 2.112.3, the legacy-key workaround no longer applies).

---

### Task 1: deps, env, supabase client, bearer API layer

**Files:** Create `src/lib/env.ts`, `src/lib/supabase.ts`, `src/lib/api.ts`, `src/lib/api.test.ts`; Modify `apps/mobile/package.json` (deps via `npx expo install expo-image-picker expo-crypto` + `pnpm add @supabase/supabase-js@^2.112.3` in apps/mobile), `.env.example` (new file: the three EXPO_PUBLIC_ vars with comments; local values: URL `http://127.0.0.1:54321`, the publishable key from `apps/app/qa/field.mjs` defaults, API origin `http://localhost:3000`).

**Interfaces produced:** `supabase` (client, `detectSessionInUrl:false`); `apiGet(path): Promise<Response>` / `apiPost(path, body, idempotencyKey): Promise<Response>` — both attach `Authorization: Bearer` from `supabase.auth.getSession()`, base `EXPO_PUBLIC_API_ORIGIN`; `readProblem(res): Promise<{detail?, userAction?, code?}>` ported from `apps/app/src/lib/capture/upload.ts`; `ApiSession` helper `requireSession(): Promise<Session | null>`.

Steps: TDD `api.test.ts` (bearer attached when session exists; no header when not; problem+json parsed; non-JSON error → generic shape) with a fake `supabase.auth.getSession` and fake fetch → implement → `pnpm --filter @goproceed/mobile typecheck` + vitest run (mobile has no vitest yet — add `vitest` devDep + minimal `vitest.config.ts`, node env, and register the package in root `vitest.workspace.ts`) → commit `feat(mobile): env, supabase client, bearer /v1 layer`.

### Task 2: pure-logic ports with their tests

**Files:** Create `src/lib/otp-error.ts` + `.test.ts`, `src/lib/field/assignments.ts` + `.test.ts`, `src/lib/capture/state.ts` + `.test.ts`; Modify `src/lib/status-labels.ts` (+ `"discarded"`), `src/screens/token-proof.tsx` (7th row: discarded → `status-idle` pair).

**Port rule (binding):** source files in `apps/app/src/lib/**` are the SPEC — copy logic, exported names, and every Ukrainian string byte-identically; each ported file's header names its source path and states the transitional-duplication contract («retired with the PWA per ADR-009; fix bugs in BOTH until then»). Port the PWA's unit tests alongside (`otp-error.test.ts`, `field/assignments.test.ts`, `capture/state.test.ts` exist in apps/app — adapt import paths only). Steps: copy tests → fail → copy impl → pass → typecheck → commit `feat(mobile): the field client's pure logic, ported with its tests`.

### Task 3: login screen

**Files:** Create `src/screens/login.tsx`, route `src/app/login.tsx`; Test `src/lib/login-flow.test.ts` (extract the phase reducer/submit-guard logic into `src/lib/login-flow.ts` so it is testable without RN rendering).

**Binding copy (from `apps/app/app/(auth)/login/otp-form.tsx`, asserted by QA):** heading «GoProceed»; intro contains «Вхід за одноразовим кодом»; labels «Електронна пошта», «Код із листа»; buttons «Надіслати код»/«Надсилаємо…», «Увійти»/«Перевіряємо…», «Змінити адресу пошти»; sent-line «Код надіслано на {email}.». Flow: `signInWithOtp({email, options:{shouldCreateUser:false}})` → phase "code" → `verifyOtp({email, token, type:"email"})` → `router.replace(next-or-"/")` where `next` comes from `useLocalSearchParams` and passes the ported `safeNext` check (port `apps/app/src/lib/safe-next.ts` + test into `src/lib/`). Errors via ported `otpErrorMessage(phase, status)`. Re-entrancy: single in-flight guard (port the SubmitGuard idea as a `useRef` boolean). All pressables ≥44pt; `testID`/`nativeID` `otp-email`, `otp-code` (web renders ids the harness types into). Commit per step convention.

### Task 4: «Мої доручення» (index route)

**Files:** Create `src/screens/my-assignments.tsx`, replace `src/app/index.tsx` (auth-gate + screen; move TokenProof to `src/app/token-proof.tsx` keeping it reachable), Test: extend `src/lib/field/assignments.test.ts` only if the screen adds logic (it must not — the ported builder IS the logic).

Behavior: on focus, `requireSession()`; no session → `router.replace("/login?next=%2F")`. With session: `apiGet("/v1/projects")` → parallel `apiGet(\`/v1/projects/${id}/assignments?assignee=me\`)` per project, each failure caught → `{status:"failed", project}`; a 401 anywhere → sign-out + redirect to login (port `isSessionExpired` semantics). Feed results to the PORTED `buildMyAssignmentsScreen`; render the four kinds with byte-identical copy (heading «Мої доручення»; the two empty-state strings; error state «Не вдалося завантажити ваші доручення. Спробуйте ще раз.» + «Оновити» button; `failedProjectMessage`; `rowSubtitle` with « · » joins; `showProjectName` rule). Rows are `Link` to `/a/{assignmentId}`, minHeight 44. Pull-to-refresh optional — omit (YAGNI). Tokens per convention.

### Task 5: obligation screen + capture

**Files:** Create `src/screens/assignment.tsx`, `src/screens/capture.tsx`, route `src/app/a/[assignmentId].tsx`, `src/lib/field/obligations.ts` + test (verbatim port from `apps/app/src/lib/field/obligations.ts` + its test), `src/lib/capture/upload.ts` + test (per File structure).

Behavior: `apiGet(\`/v1/assignments/${id}/requirement-occurrences\`)`; 401 → login redirect with `next=/a/{id}`; error → ported error copy («Не вдалося завантажити перелік обов'язкових фіксацій. Спробуйте ще раз.» or server `detail`). Render EXACTLY what the response ordered (never re-sort). The довідковий disclaimer renders VISIBLE (no collapsed containers), byte-identical to the constant in `apps/app` (source: `statutory-act-form.ts` constant, also in `qa/field.mjs:766-771`). Capture component: `launchCameraAsync({mediaTypes: images, cameraType: back})` inside the press handler (user-gesture requirement on web); asset → `file = asset.file` (web) → `bytes = await file.arrayBuffer()` → `Crypto.digest("SHA-256", bytes)` hex → the three-request pipeline with EXACT body fields from the PWA (`requirementOccurrenceId, expectedContentHash, expectedByteSize, claimedMediaType, originalFilename, deviceCaptureId, originMethod:"origin_not_distinguished", claimedCaptureTime` from `file.lastModified`); fresh `Idempotency-Key` per attempt, `deviceCaptureId` stable per photo; PUT with only content-type; finalize `{}`; success ONLY per INV-081 rule; receipt `<dl>`-equivalent with the three labelled claims («Час пристрою (не перевірено)», «Підтверджено сервером», «Контрольна сума файлу (SHA-256)» — server values for the last two); banner `UNSAVED_PHOTO_WARNING` per `serverDoesNotHaveThePhoto`; `nextStateFor(userAction)` recovery port; state labels via `clientStateLabel`. Commit.

### Task 6: the parity QA harness

**Files:** Create `apps/mobile/qa/field-web.mjs`; Modify `apps/mobile/package.json` (`"qa": "node qa/field-web.mjs"`), `apps/mobile/.gitignore`-relevant entries in root `.gitignore` (`apps/mobile/qa-output/`, `apps/mobile/dist/`).

Port from `apps/app/qa/field.mjs` (copy helpers with attribution header; both files cross-reference; the PWA copy retires with the PWA): same localhost-only safety guard, same seedWorld (drives ONLY /v1 with a password-grant bearer against the LOCAL apps/app server), same Mailpit OTP reader with the labelled-then-stripped extraction. Differences: (1) boot TWO servers — `apps/app` `next start` (ephemeral port, `FIELD_CLIENT_ORIGINS=http://localhost:<qa-port>` in its env — this makes the harness exercise Plan B's CORS on the real wire) and a static server for `apps/mobile/dist` (run `expo export -p web` first; serve `dist/` with a catch-all rewrite to /index.html); (2) browser opens the FIELD origin; (3) the five audits ported: unauthenticated surface (login renders, lang, viewport — manifest check N/A for SPA export: assert instead that the page loads over the static server), sign-in (type email → Mailpit code → «Мої доручення»), list (heading + seeded description + absent empty-states + row link), obligation screen (disclaimer 3-way visibility + 44×44 sweep + horizontal-overflow ≤1px), capture in-flight banner (stub `/upload-intents` POST → 500 after 700 ms; banner visible during flight and after failure; «Надсилання» within 2 s; at-rest banner absence). Report to `qa-output/qa-report.json`, same shape. Run: `pnpm --filter @goproceed/mobile qa` → ok:true. Commit.

### Task 7: vercel.json + deploy + wire-up (account steps flagged)

**Files:** Create `apps/mobile/vercel.json` — from the vendor's own guide (docs.expo.dev/guides/publishing-websites, fetched 2026-08-20), adapted to the workspace:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm --filter @goproceed/tokens generate && pnpm --filter @goproceed/mobile exec expo export --platform web",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "rewrites": [{ "source": "/:path*", "destination": "/" }]
}
```
Steps: commit the file; controller creates Vercel project `goproceed-field` (root `apps/mobile`) via MCP per the owner's standing instruction, reads back Deployment Protection; **owner (dashboard, exact values listed in the runbook edit):** set `EXPO_PUBLIC_SUPABASE_URL=https://asrvzhjaueyvrfozxpzo.supabase.co`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_DheHWf443RiuOjXMu0AkZw_rAwhG3wt`, `EXPO_PUBLIC_API_ORIGIN=https://goproceed-app.vercel.app` on goproceed-field + redeploy; set `FIELD_CLIENT_ORIGINS=https://goproceed-field.vercel.app` on goproceed-app (Production) + redeploy. Wire measurement after both: `curl -si -X OPTIONS https://goproceed-app.vercel.app/v1/projects -H "Origin: https://goproceed-field.vercel.app" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization"` → allow-origin echo; `curl -sI https://goproceed-field.vercel.app/` → 200 text/html; paste both into the runbook.

### Task 8: docs

**Files:** Modify `TODOS.md` (Plan C section: what shipped, what the parity gate still needs — the PHONES; explicitly NOT closed), `infra/README-staging.md` §6.9 (a dated pointer: the Expo client exists at the field origin; §6.9's five boxes are now measured against IT on the phones; PWA remains fallback), `docs/decisions/ADR-009-three-pilot-surfaces.md` (resolve `2026-08-XX-expo-field-client.md` → `2026-08-20-expo-field-client.md`), **`CLAUDE.md`** — a dated correction paragraph inside the third-party-docs rule: the 2026-08-19 example's «installed supabase-js 2.47.10 … cannot accept the new format» is stale — the workspace has 2.112.3 (bumped in PR #30), which handles `sb_publishable_` keys; the RULE stands, the example is history, marked as such (do not delete the story — it is the rule's origin). Validate, commit.

---

## Self-review

- Spec coverage: §6.9 item 1 → Tasks 3–4 + harness sign-in audit; item 2 → Task 5 disclaimer + 44px + harness; item 3 → Task 5 capture/banner/receipt + harness in-flight audit (receipt path covered by upload tests — same NOT_COVERED boundary as the PWA's harness, inherited deliberately); items 4–5 → phones, out of code's reach, stated in Task 8's TODOS entry; INV-081 → state.ts port + banner audit. Bearer/CORS → Task 1 + Task 6's FIELD_CLIENT_ORIGINS wiring + Task 7 wire curl.
- Placeholders: none — where code is not inlined, the binding source file is named and the port rule (byte-identical copy) makes it exact.
- Type consistency: `api.ts` names (`apiGet/apiPost/readProblem/requireSession`) used identically in Tasks 4–5; `ClientState` 7-state extension (Task 2) precedes upload.ts use (Task 5).
