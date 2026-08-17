# v0.1 Pilot Field Client (PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a foreman a URL he can open on a phone that shows what must be photographed before covering, in the standard's own Ukrainian wording, and takes the photo.

**Architecture:** One route group in the existing `apps/app` Next.js App Router project. Reads are React Server Components that call the existing `/v1` routes over HTTP with the session cookie forwarded, so there is exactly one authorization path. Only the capture widget is a client component, because `crypto.subtle.digest`, `File` and the `PUT` to Supabase Storage are browser APIs. No service worker, no offline queue, no durable local original.

**Tech Stack:** Next 16.2.11, React 19.2.0, `@supabase/ssr` 0.5.2, `@supabase/supabase-js` 2.47.10, zod 3.24.1, Tailwind v4 (ported from `apps/demo`), vitest 3.2.4 (Node), puppeteer 24.10.2 (new to `apps/app`).

**Design:** [`docs/superpowers/specs/2026-08-10-pwa-field-client-design.md`](../specs/2026-08-10-pwa-field-client-design.md)
**Decision:** [`ADR-007`](../../decisions/ADR-007-pilot-field-client.md) — Approved.

---

> ## ⚠ THIS PLAN IS A HISTORICAL ARTEFACT. IT IS NOT EDITED TO MATCH THE CODE.
>
> All eleven tasks landed and merged (PR #14, 2026-08-11). The code sections
> below are what was PLANNED, and three of them were superseded during
> implementation. They are left standing — a plan rewritten to agree with its
> outcome stops being evidence of anything — but a reader arriving here cold
> would otherwise copy a mapping and a signature the product deliberately
> abandoned. **The living documents are the design doc linked above and the
> source files themselves; where they and this file disagree, this file is
> wrong.**
>
> **Superseded, with dates:**
>
> 1. **The recovery mapping (task 6 — the `nextStateFor` switch and its tests
>    below).** This plan has `retry_part → "sending"` and
>    `refresh_upload_state_or_request_new_grant → "awaiting_receipt"`. **Both
>    return `failed` as of 2026-08-11** (final whole-branch review, Important
>    4). Nothing ever retried the PUT or re-GET the intent, so those two labels
>    told a foreman an operation was under way while nothing whatsoever was in
>    flight. See the design doc §6 and `apps/app/src/lib/capture/recover.ts`,
>    which states the whole reasoning.
>
> 2. **`holdsUnsavedBytes`'s signature (task 10 and its tests below).** Planned
>    as `holdsUnsavedBytes(s: ClientState)`. **It takes a `CaptureHold` — the
>    state plus `hasPickedFile` — as of 2026-08-11** (Critical 1). `not_sent` is
>    also the INITIAL state, so the state-only version put the red banner, the
>    discard control and a `beforeunload` listener on every untouched obligation
>    screen, about a photo that did not exist.
>
> 3. **The banner's gate (task 10 below).** Planned, and shipped, as the same
>    `holdsUnsavedBytes` call that gates the unload guard. **The banner moved to
>    its own predicate, `serverDoesNotHaveThePhoto`, on 2026-08-17**, because
>    `holdsUnsavedBytes` excludes `failed` and `invariant-catalog.csv:82`
>    requires the unsaved-photo warning on every failed upload. See the design
>    doc's «No silent loss — INV-081» and `src/lib/capture/state.ts`.

## Global Constraints

Every task's requirements implicitly include this section.

- **Language of the UI is Ukrainian.** Never Russian, never English. `<html lang="uk">` is already set.
- **Synthetic names carry the «Приклад-» prefix.** Never invent a plausible Ukrainian company, project or person name in a fixture, a test or a screenshot.
- **No regulatory string is ever typed.** `acceptanceCriterion` and `normRef.text` come from the API and are rendered verbatim. No normalisation: no `.trim()`, no `.normalize()`, no spell pass, no interior-space fix.
- **A normative string renders with its `verification` tag and its `source`, or it does not render.** `hidden-works-content-rules.md` §"Required disclaimers", architectural requirement.
- **The довідковий disclaimer renders under every generated requirement list, never collapsed.** Its exact text is in Task 8.
- **Nothing may say the photo is saved before the server receipt.** `status: "available"` is the only trigger. INV-081.
- **The `File` never touches a canvas and is never recompressed.** ADR-007 Cost 1.
- **`originMethod` is always `origin_not_distinguished`.** `native_camera` from this client is a defect, and Task 1 makes it a test failure. INV-086, ADR-007 decision 5.
- **No claim of camera-vs-gallery discrimination, tamper-evidence, or verified GPS.** Anywhere: screen, comment, commit message.
- **The database is local Postgres on `127.0.0.1:54322`.** Before any integration test: `supabase db reset && pnpm db:local-credentials`.
- **Never query that database while a test suite is running.** `truncateAll` takes ACCESS EXCLUSIVE between files; a single `select` from another shell produces `deadlock detected` and ten-second hook timeouts in unrelated suites. Read the vitest output file instead.
- **Run the whole suite with `pnpm turbo run test --concurrency=1`, one run at a time.**

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/contracts/src/uploads.ts` | MODIFY — `originMethod` gains `origin_not_distinguished` |
| `packages/contracts/src/assignments.ts` | MODIFY — `AssignmentSummary` gains `assigneeMemberId` |
| `apps/app/app/v1/projects/[projectId]/assignments/route.ts` | MODIFY — return the field, accept `?assignee=me` |
| `apps/app/src/lib/capture/state.ts` | CREATE — the six-state machine, pure, no DOM |
| `apps/app/src/lib/capture/hash.ts` | CREATE — bytes → lowercase hex sha256, pure |
| `apps/app/src/lib/capture/recover.ts` | CREATE — `userAction` → next state, pure |
| `apps/app/src/lib/capture/labels.ts` | CREATE — the six Ukrainian labels, narrowed union |
| `apps/app/src/lib/supabase-browser.ts` | CREATE — `createBrowserClient` |
| `apps/app/src/lib/api.ts` | CREATE — server-side fetch of `/v1` with the cookie forwarded |
| `apps/app/middleware.ts` | CREATE — refresh the cookie session, redirect with `?next=` |
| `apps/app/app/layout.tsx` | MODIFY — `metadata`, `viewport`, stylesheet |
| `apps/app/app/globals.css` | CREATE — Tailwind v4 entry + theme, ported from `apps/demo` |
| `apps/app/src/ui/cn.ts` | CREATE — the `extendTailwindMerge` helper, ported |
| `apps/app/src/ui/button.tsx` | CREATE — ported, keeps the 44px touch floor |
| `apps/app/public/manifest.webmanifest` | CREATE — no service worker, and it says so |
| `apps/app/app/(auth)/login/page.tsx` | MODIFY — replaces the 8-line stub |
| `apps/app/app/(auth)/login/otp-form.tsx` | CREATE — `"use client"` |
| `apps/app/app/(app)/page.tsx` | CREATE — «Мої доручення» |
| `apps/app/app/(app)/a/[assignmentId]/page.tsx` | CREATE — the obligation screen |
| `apps/app/app/(app)/a/[assignmentId]/capture.tsx` | CREATE — `"use client"`, the only island |
| `apps/app/qa/browser.mjs` | CREATE — ported puppeteer launcher |
| `apps/app/qa/field.mjs` | CREATE — the browser pass |
| `technical/permissions/responsibility-presets.csv` | MODIFY — `foreman` gains `project.view` |
| `technical/copy-catalog.csv` | MODIFY — unsaved-photo warning; `saved_local` marked native-only |
| `docs/decisions/ADR-004-roadmap-demo-and-documentation.md` | MODIFY — lines 70-74 to v0.3 |
| `.github/workflows/ci.yml` | MODIFY — new `app-qa` job |

**`apps/app/app/(app)/context/page.tsx` is left untouched.** It is the other existing stub, it is
not on the foreman's path, and replacing a stub nobody reached is scope this plan has no reason to
take.

**Not in any task, and it blocks the pilot rather than the code: there is no HTTPS origin for
`apps/app`.** No `vercel.json` for it, no CI deploy step, and `infra/README-staging.md` records that
staging has never been provisioned. Every task below can be completed and verified locally, and none
of them puts the client in a foreman's hand. Two things depend on that origin and are therefore
deferred with it: `crypto.subtle` needs a secure context (localhost qualifies, so local work is
fine), and ADR-007's two required measurements — how each engine handles EXIF and the `capture`
attribute, and the storage-eviction rule — need real devices against a real origin.

---

### Task 1: The contract admits `origin_not_distinguished`

INV-086 is a P0 that says no PWA capture may be recorded until this lands. The database has admitted the value since migration 0043 (`upload_intents_origin_method_check`); the zod contract has not, so the capture path cannot be written at all before this task.

**Files:**
- Modify: `packages/contracts/src/uploads.ts:29`
- Test: `packages/contracts/src/uploads.test.ts` (create)

**Interfaces:**
- Produces: `createUploadIntentRequest` whose `originMethod` accepts `"origin_not_distinguished"`. Every later task sends that value.

- [ ] **Step 1: Write the failing test**

Create `packages/contracts/src/uploads.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createUploadIntentRequest } from "./uploads";

const base = {
  expectedContentHash: "a".repeat(64),
  expectedByteSize: 1024,
  claimedMediaType: "image/jpeg",
  deviceCaptureId: "11111111-1111-4111-8111-111111111111",
};

describe("origin method — ADR-007 decision 5 and INV-086", () => {
  it("admits origin_not_distinguished, which is the only value the PWA may send", () => {
    const r = createUploadIntentRequest.safeParse({
      ...base, originMethod: "origin_not_distinguished",
    });
    expect(r.success).toBe(true);
  });

  it("still admits the four native values, so no existing caller breaks", () => {
    for (const v of ["native_camera", "photo_picker", "file_picker", "form"]) {
      expect(createUploadIntentRequest.safeParse({ ...base, originMethod: v }).success,
        v).toBe(true);
    }
  });

  it("refuses a value the database CHECK would refuse", () => {
    expect(createUploadIntentRequest.safeParse({
      ...base, originMethod: "camera",
    }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch the first case fail**

Run: `cd packages/contracts && pnpm vitest run src/uploads.test.ts`
Expected: FAIL — the first case, because the enum has four values.

- [ ] **Step 3: Widen the enum**

In `packages/contracts/src/uploads.ts`, replace the `originMethod` line with:

```ts
  /**
   * ADDED 2026-08-10: `origin_not_distinguished`, the value ADR-007 decision 5
   * requires and INV-086 makes a P0.
   *
   * THE DATABASE HAS ADMITTED IT SINCE MIGRATION 0043 and this enum has not, so
   * until now no PWA capture was recordable at all — the browser page had no
   * value it was permitted to send. A browser has no camera-session identity and
   * may be handed transcoded bytes, so the origin cannot be established; the
   * vocabulary says that rather than asserting a camera.
   *
   * THE FOUR NATIVE VALUES ARE NOT REMOVED. They are the native client's, and
   * `apps/mobile` stays in the tree for v0.3 (ADR-007 decision 2). What is
   * forbidden is the PWA SENDING one, which is a test in
   * apps/app/tests/field-capture.int.test.ts and not a narrowing here.
   */
  originMethod: z.enum([
    "native_camera", "photo_picker", "file_picker", "form",
    "origin_not_distinguished",
  ]),
```

- [ ] **Step 4: Run the test and the contracts suite**

Run: `cd packages/contracts && pnpm vitest run`
Expected: PASS, and the pre-existing contracts tests still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/uploads.ts packages/contracts/src/uploads.test.ts
git commit -m "feat(contracts): the upload intent can finally say the origin is not distinguished"
```

---

### Task 2: `assignments.list` answers «which are mine»

`assigneeMemberId` is accepted at creation and never returned, so «my assignments» is not computable. `meContextResponse` carries no member id either, so the filter must be `me`, resolved from the session inside the route.

**Files:**
- Modify: `packages/contracts/src/assignments.ts:83-95`
- Modify: `apps/app/app/v1/projects/[projectId]/assignments/route.ts`
- Test: `apps/app/tests/assignments.int.test.ts` (exists — add cases)

**Interfaces:**
- Consumes: nothing.
- Produces: `AssignmentSummary.assigneeMemberId: string | null`; `GET /v1/projects/{projectId}/assignments?assignee=me` returning only rows whose `assignee_member_id` equals the caller's membership id.

- [ ] **Step 1: Write the failing test**

`apps/app/tests/assignments.int.test.ts` already has `createAssignment(body, contractId)` and
`listAssignments(projectId)` helpers at lines 12-20. **Use them — do not write new ones.**
`listAssignments` builds `new Request("http://x")` with no query string, so add one sibling helper
beside it and then the three cases:

```ts
async function listMine(projectId = fx.projectId): Promise<Response> {
  const { GET } = await import("../app/v1/projects/[projectId]/assignments/route");
  return GET(new Request("http://x?assignee=me"), { params: Promise.resolve({ projectId }) });
}

async function listAssignee(value: string, projectId = fx.projectId): Promise<Response> {
  const { GET } = await import("../app/v1/projects/[projectId]/assignments/route");
  return GET(new Request(`http://x?assignee=${encodeURIComponent(value)}`),
    { params: Promise.resolve({ projectId }) });
}

describe("assignments.list answers «which are mine» — the field client's entry", () => {
  it("returns assigneeMemberId, which was accepted at creation and never read back", async () => {
    const created = await createAssignment({
      workItemId: fx.workItemId, assigneeMemberId: fx.memberId, plannedQuantity: "1",
    });
    expect(created.status).toBe(201);
    // Read the body ONCE, before the find. An `await` inside a `.find()`
    // predicate does not do what it looks like — the callback is synchronous and
    // returns a Promise, which is always truthy, so `.find()` matches the first
    // element whatever the comparison says.
    const { assignmentId } = await created.json();
    const body = await (await listAssignments()).json();
    const row = body.assignments.find(
      (x: { assignmentId: string }) => x.assignmentId === assignmentId);
    expect(row.assigneeMemberId).toBe(fx.memberId);
  });

  it("filters to the caller's own with ?assignee=me", async () => {
    await createAssignment({
      workItemId: fx.workItemId, assigneeMemberId: fx.memberId, plannedQuantity: "1",
    });
    const res = await listMine();
    expect(res.status).toBe(200);
    const { assignments } = await res.json();
    expect(assignments.length).toBeGreaterThan(0);
    for (const a of assignments) expect(a.assigneeMemberId).toBe(fx.memberId);
  });

  it("refuses any assignee value other than me — a member id on the wire is not a filter", async () => {
    const res = await listAssignee(fx.memberId);
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDATION_FAILED");
  });
});
```

`fx.workItemId` is whatever the file's existing fixture already exposes for its other creation
calls — read the `createAssignment` uses above your new block and pass the same field.

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/app && pnpm vitest run tests/assignments.int.test.ts`
Expected: FAIL — `assigneeMemberId` is `undefined`.

- [ ] **Step 3: Widen the contract**

In `packages/contracts/src/assignments.ts`, add to `AssignmentSummary`:

```ts
  /**
   * ADDED 2026-08-10. Accepted by `createAssignmentRequest` since M2 and never
   * returned, which made «my assignments» uncomputable and left the field client
   * with no entry point at all. Nullable because an assignment need not have an
   * assignee.
   */
  assigneeMemberId: string | null;
```

- [ ] **Step 4: Implement the read and the filter**

In the assignments list route: add `a.assignee_member_id` to the SELECT, map it to `assigneeMemberId`, and before the query:

```ts
  // `me` AND NOTHING ELSE. A member id on the wire would be a filter one member
  // could point at another, and `meContextResponse` does not carry a member id
  // for a client to send in the first place. The session already knows who this
  // is; resolving it here keeps the answer where the identity is.
  const assignee = new URL(a.request.url).searchParams.get("assignee");
  if (assignee !== null && assignee !== "me") {
    throw new HttpProblem(422, problem("VALIDATION_FAILED",
      "Фільтр assignee підтримує лише значення me.",
      { requestId: a.requestId, retryable: false, userAction: "correct_and_retry" }));
  }
```

and add `and (a.assignee_member_id = $N or $N is null)` with `assignee === "me" ? m.memberId : null`.

- [ ] **Step 5: Run the test**

Run: `cd apps/app && pnpm vitest run tests/assignments.int.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/assignments.ts apps/app/app/v1/projects/\[projectId\]/assignments/route.ts apps/app/tests/assignments.int.test.ts
git commit -m "feat(assignments): the list says which are mine, and takes no member id from the wire"
```

---

### Task 3: The catalogs and the one un-landed ADR row

No code. These are the paperwork prerequisites, and ADR-007 stops delivery of a dependent slice until the ADR-004 row lands.

**Files:**
- Modify: `technical/permissions/responsibility-presets.csv:12`
- Modify: `technical/copy-catalog.csv` (append one row; edit `field.capture.saved_local`)
- Modify: `docs/decisions/ADR-004-roadmap-demo-and-documentation.md:70-74`

- [ ] **Step 1: Grant the foreman the capability the catalog already says is his**

In `responsibility-presets.csv:12`, change `progress.record evidence.record` to `progress.record evidence.record project.view` and extend the description with:

```
CORRECTED 2026-08-10: project.view added. capabilities.csv:14 already defines it as «this is also how the foreman reads the occurrence set for an assignment before work starts (ADR-006 step 2)» and names requirement_occurrences.list among its operations, while this preset withheld it — so the persona the capability names could not perform the read the capability exists for. The gap bit twice: without it the foreman can neither read the obligation nor name requirementOccurrenceId at intent creation, and an intent with no occurrence falls to FALLBACK_MEDIA silently
```

- [ ] **Step 2: Add the unsaved-photo warning copy INV-081 requires**

Append to `copy-catalog.csv`:

```
warning.capture.not_saved,GoProceed не зберіг це фото. Зробіть його ще раз або збережіть у себе.,global,warning,"INV-081 — the unsaved-photo warning. The v0.1 PWA holds the original in memory only; on a failed upload or an abandoned in-flight one the loss must be surfaced and never silent (ADR-007 decision 6). Added 2026-08-10 with the field client; the catalog carried no such string"
```

- [ ] **Step 3: Mark the string the PWA can never truthfully render**

In `copy-catalog.csv:278`, extend `field.capture.saved_local`'s context column with:

```
 — NATIVE CLIENT ONLY from 2026-08-10: «Збережено на пристрої» claims a durable local original, which INV-081 forbids the v0.1 PWA from claiming and ADR-007 Cost 2 explains it cannot deliver. A PWA screen may not render this label
```

- [ ] **Step 4: Land ADR-007's last un-corrected row**

In `ADR-004-roadmap-demo-and-documentation.md:70-74`, mark the «separate native client, not a responsive-web substitute» sentence and the OS-sandboxed-persistence sentence as **v0.3**, and add a pointer to ADR-007 as the amending decision. Do not delete the sentences — ADR-007 amends ADR-004 rather than superseding it.

- [ ] **Step 5: Verify the documentation gate**

Run: `node scripts/validate-canonical-docs.mjs`
Expected: `canonical documentation: OK`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add technical/permissions/responsibility-presets.csv technical/copy-catalog.csv docs/decisions/ADR-004-roadmap-demo-and-documentation.md
git commit -m "docs: the foreman gets the capability the catalog already named as his"
```

---

### Task 4: The app shell

`apps/app` has three `.tsx` files totalling 25 lines, no `public/`, no CSS, and no `viewport` export — a phone does not even get a correct viewport meta today.

**Files:**
- Modify: `apps/app/app/layout.tsx`
- Create: `apps/app/app/globals.css`, `apps/app/src/ui/cn.ts`, `apps/app/src/ui/button.tsx`
- Create: `apps/app/public/manifest.webmanifest`, `apps/app/public/icon-192.png`, `apps/app/public/icon-512.png`
- Modify: `apps/app/package.json` (add `tailwindcss`, `@tailwindcss/postcss`, `clsx`, `tailwind-merge`, `class-variance-authority`, `@fontsource-variable/inter`)

**Interfaces:**
- Produces: `cn(...)` from `src/ui/cn.ts`; `Button` from `src/ui/button.tsx`; global Tailwind classes available to every later task.

- [ ] **Step 1: Add the dependencies**

```bash
cd apps/app && pnpm add tailwindcss@^4.3.3 @tailwindcss/postcss@^4.3.3 clsx@^2.1.1 tailwind-merge@^3.6.0 class-variance-authority@^0.7.1 @fontsource-variable/inter@5.3.0
```

- [ ] **Step 2: Port `cn` verbatim**

Copy `apps/demo/src/lib/utils.ts` to `apps/app/src/ui/cn.ts` unchanged. It is `extendTailwindMerge` with project overrides, and the ported components' variants depend on those overrides — a stock `cn` silently merges the wrong classes.

- [ ] **Step 3: Port the theme**

Copy `apps/demo/src/styles/theme.css` to `apps/app/app/globals.css`, dropping only its `@source` exclusions that name `apps/demo` paths. Add at the top a comment recording that it is a port and that the two must not drift silently.

- [ ] **Step 4: Port the Button**

Copy `apps/demo/src/components/ui/button.tsx` to `apps/app/src/ui/button.tsx`, changing only the `cn` import path. **Its 44px touch floor below `md` is the reason it is ported rather than rewritten** — a gloved hand on a construction site is the target.

- [ ] **Step 5: Write the manifest, and say what it does not do**

`apps/app/public/manifest.webmanifest`:

```json
{
  "name": "GoProceed",
  "short_name": "GoProceed",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "lang": "uk",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Create the two icons as solid-colour PNGs with the wordmark; they are placeholders for brand work and must not be described as final.

- [ ] **Step 6: Rewrite the root layout**

```tsx
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoProceed",
  description: "Фіксація прихованих робіт на об'єкті.",
  manifest: "/manifest.webmanifest",
};

/**
 * NO SERVICE WORKER, AND THE MANIFEST IS NOT ONE.
 *
 * The manifest buys a home-screen icon and nothing else. `system-overview.md`
 * forbids a service worker from caching an authenticated domain response or an
 * evidence original, and ADR-007 decision 7 ships no push in v0.1 — so a service
 * worker would have nothing it is allowed to do. Adding one "for offline" would
 * be building the durable local tier ADR-007 decision 6 and Cost 2 refuse.
 *
 * `maximumScale` is deliberately absent: capping zoom on a page a foreman reads
 * in daylight is an accessibility failure, and it is not needed for layout.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Verify the build**

Run: `cd apps/app && NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=x pnpm build`
Expected: build succeeds and reports the routes.

- [ ] **Step 8: Commit**

```bash
git add apps/app/app/layout.tsx apps/app/app/globals.css apps/app/src/ui apps/app/public apps/app/package.json pnpm-lock.yaml
git commit -m "feat(app): a shell a phone can render — viewport, tokens, a 44px touch floor, and no service worker"
```

---

### Task 5: Sign in with an email code

**Files:**
- Create: `apps/app/src/lib/supabase-browser.ts`, `apps/app/middleware.ts`, `apps/app/app/(auth)/login/otp-form.tsx`
- Modify: `apps/app/app/(auth)/login/page.tsx`

**Interfaces:**
- Produces: a cookie session readable by `requireUser`; `middleware.ts` redirecting unauthenticated navigation to `/login?next=<path>`.

- [ ] **Step 1: The browser client**

`apps/app/src/lib/supabase-browser.ts`:

```ts
"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * The ONLY browser-side Supabase client. It exists to run the OTP exchange and
 * nothing else: every domain read and write goes through `/v1`, which
 * authenticates server-side and re-reads capability on every request.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: The OTP form**

`apps/app/app/(auth)/login/otp-form.tsx` — `"use client"`, two phases in one component: email → `signInWithOtp({ email, options: { shouldCreateUser: false } })`, then a 6-digit field → `verifyOtp({ email, token, type: "email" })`, then `router.replace(next ?? "/")`. `shouldCreateUser: false` is load-bearing: a pilot member is invited, and self-signup from a login form would create members nobody granted anything to.

- [ ] **Step 3: The middleware**

`apps/app/middleware.ts` refreshes the cookie session via `createServerClient` and redirects unauthenticated navigation to `/login?next=<pathname>`. Its `config.matcher` must exclude `/v1`, `/external`, `/_next`, and `/manifest.webmanifest` — the API answers 401 with a problem document and must not be turned into a redirect.

- [ ] **Step 4: Verify by hand against the local stack**

Run `preview_start` for `apps/app`, open `/`, confirm the redirect to `/login?next=%2F`, request a code, read it from Mailpit at `http://127.0.0.1:54324`, and confirm the redirect back to `/`.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/supabase-browser.ts apps/app/middleware.ts "apps/app/app/(auth)/login"
git commit -m "feat(app): sign in with an email code, which is fewer actions than a password on a phone"
```

---

### Task 6: The capture core, with no DOM in it

This is where INV-081 becomes an assertion. `apps/app` has Node-only vitest and no jsdom, so the logic lives outside the DOM by design rather than by necessity.

**Files:**
- Create: `apps/app/src/lib/capture/labels.ts`, `state.ts`, `hash.ts`, `recover.ts`
- Test: `apps/app/src/lib/capture/state.test.ts`, `hash.test.ts`, `recover.test.ts`

**Interfaces:**
- Produces:
  - `type ClientState = "not_sent" | "sending" | "awaiting_receipt" | "server_confirmed" | "failed" | "discarded"`
  - `CLIENT_STATE_LABEL: Record<ClientState, string>`
  - `isSaved(s: ClientState): boolean`
  - `holdsUnsavedBytes(s: ClientState): boolean`
  - `sha256Hex(bytes: ArrayBuffer): Promise<string>`
  - `nextStateFor(userAction: string): ClientState`

- [ ] **Step 1: Write the failing tests**

`apps/app/src/lib/capture/state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CLIENT_STATE_LABEL, holdsUnsavedBytes, isSaved, type ClientState } from "./state";

const ALL: ClientState[] = [
  "not_sent", "sending", "awaiting_receipt", "server_confirmed", "failed", "discarded",
];

describe("INV-081 — no success is reported before the receipt", () => {
  it("calls exactly ONE state saved, and it is the one the receipt produces", () => {
    expect(ALL.filter(isSaved)).toEqual(["server_confirmed"]);
  });

  it("treats every pre-receipt state as holding bytes the server does not have", () => {
    expect(ALL.filter(holdsUnsavedBytes))
      .toEqual(["not_sent", "sending", "awaiting_receipt"]);
  });

  it("does not treat a finished state as holding bytes", () => {
    expect(holdsUnsavedBytes("server_confirmed")).toBe(false);
    expect(holdsUnsavedBytes("failed")).toBe(false);
    expect(holdsUnsavedBytes("discarded")).toBe(false);
  });
});

describe("the six labels are the approved copy, and the seventh is unreachable", () => {
  it("carries copy-catalog.csv:87-93's Ukrainian verbatim", () => {
    expect(CLIENT_STATE_LABEL).toEqual({
      not_sent: "Не надіслано",
      sending: "Надсилання",
      awaiting_receipt: "Очікування підтвердження",
      server_confirmed: "Підтверджено сервером",
      failed: "Потрібна дія",
      discarded: "Видалено користувачем",
    });
  });

  it("has no key for a native-only state", () => {
    expect(Object.keys(CLIENT_STATE_LABEL)).not.toContain("quarantined");
    expect(Object.keys(CLIENT_STATE_LABEL)).not.toContain("expired_purged");
  });
});
```

`apps/app/src/lib/capture/hash.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sha256Hex } from "./hash";

describe("the client-computed content hash", () => {
  it("is lowercase hex of exactly 64 characters", async () => {
    const out = await sha256Hex(new TextEncoder().encode("").buffer);
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reproduces the published SHA-256 of the empty input", async () => {
    expect(await sha256Hex(new TextEncoder().encode("").buffer))
      .toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("reproduces the published SHA-256 of «abc»", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc").buffer))
      .toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
```

`apps/app/src/lib/capture/recover.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextStateFor } from "./recover";

// ⚠ SUPERSEDED 2026-08-11 — see this document's header. `retry_part` and
// `refresh_upload_state_or_request_new_grant` both return "failed" in the
// shipped code; nothing ever retried the PUT or re-GET the intent, so these two
// expectations pin labels that told a foreman an operation was under way while
// nothing was in flight. Live version: src/lib/capture/recover.test.ts.
describe("the problem+json userAction decides what the screen does next", () => {
  it("keeps bytes in hand for every recoverable action", () => {
    expect(nextStateFor("retry_part")).toBe("sending");
    expect(nextStateFor("request_new_upload_grant")).toBe("not_sent");
    expect(nextStateFor("refresh_upload_state_or_request_new_grant")).toBe("awaiting_receipt");
  });

  it("gives up only where the server says the capture itself is finished", () => {
    expect(nextStateFor("recapture_or_contact_support")).toBe("failed");
  });

  it("never invents a saved state from an error", () => {
    for (const a of ["retry_part", "request_new_upload_grant", "sign_in",
                     "refresh_upload_state_or_request_new_grant",
                     "recapture_or_contact_support", "something_new"]) {
      expect(nextStateFor(a), a).not.toBe("server_confirmed");
    }
  });

  it("falls back to failed for an action it does not know, rather than to a guess", () => {
    expect(nextStateFor("something_new")).toBe("failed");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd apps/app && pnpm vitest run src/lib/capture`
Expected: FAIL — the modules do not exist.

- [ ] **Step 3: Implement `state.ts`**

```ts
/**
 * THE SIX STATES THE PWA PATH ACTUALLY REACHES, as a closed union.
 *
 * `state-catalog.csv:38-45` carries EIGHT rows for `mobile_pending_original`.
 * Two of them — `quarantined` and `expired_purged` — are NATIVE CLIENT ONLY
 * (ADR-007 decision 6): both rest on a Keychain/Keystore-bound wrapping key and
 * on storage the OS does not reclaim, and a browser gives neither. They are
 * absent from this type rather than merely unused, so a screen cannot render a
 * label for a state it can never be in — `copy-catalog.csv:92` says exactly that
 * about `quarantined`, and a comment would not have enforced it.
 */
export type ClientState =
  | "not_sent" | "sending" | "awaiting_receipt"
  | "server_confirmed" | "failed" | "discarded";

/** copy-catalog.csv:87-93, verbatim. Not translated here, ever. */
export const CLIENT_STATE_LABEL: Record<ClientState, string> = {
  not_sent: "Не надіслано",
  sending: "Надсилання",
  awaiting_receipt: "Очікування підтвердження",
  server_confirmed: "Підтверджено сервером",
  failed: "Потрібна дія",
  discarded: "Видалено користувачем",
};

/**
 * INV-081's first half, as a function. `upload_received` is not
 * `evidence_available`: only the persisted `available` receipt makes a photo
 * recorded, and this is the ONLY place that judgement is made.
 */
export function isSaved(s: ClientState): boolean {
  return s === "server_confirmed";
}

/**
 * INV-081's second half. True while the browser holds bytes the server does not,
 * which is exactly when leaving the page loses a photo. `failed` and `discarded`
 * are false because the user has already been told.
 *
 * ⚠ SUPERSEDED TWICE — see this document's header. It takes a `CaptureHold`
 * (state + `hasPickedFile`) as of 2026-08-11, and as of 2026-08-17 it no longer
 * gates the banner at all — `serverDoesNotHaveThePhoto` does, because this
 * function excludes `failed` and the invariant requires the warning there. The
 * sentence above, "the user has already been told", is exactly the assumption
 * that turned out to be false on a `failed` upload carrying a server `detail`.
 * Live version: src/lib/capture/state.ts.
 */
export function holdsUnsavedBytes(s: ClientState): boolean {
  return s === "not_sent" || s === "sending" || s === "awaiting_receipt";
}
```

- [ ] **Step 4: Implement `hash.ts` and `recover.ts`**

```ts
// hash.ts
/**
 * The client-computed content hash of ADR-007 decision 5 — the one provenance
 * claim v0.1 makes. It binds the UPLOADED ARTIFACT and not the sensor output:
 * the browser may transcode before the page ever sees the bytes, so no copy
 * anywhere may describe it as binding what the camera produced.
 *
 * `crypto.subtle` requires a secure context, which is HTTPS or localhost.
 */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

```ts
// recover.ts
import type { ClientState } from "./state";

/**
 * The route's own `userAction` taxonomy decides recovery, so the screen does not
 * carry a second opinion about what a failure means.
 *
 * THE DEFAULT IS `failed`, NOT A RETRY. An action this build does not recognise
 * is one the server learned after this client shipped; retrying blindly against
 * an unknown condition is how a client hammers a server that just told it to
 * stop. `failed` is honest and the user is told the photo is not saved.
 */
// ⚠ SUPERSEDED 2026-08-11 — see this document's header. Both `retry_part` and
// `refresh_upload_state_or_request_new_grant` return "failed" in the shipped
// code. Live version: src/lib/capture/recover.ts.
export function nextStateFor(userAction: string): ClientState {
  switch (userAction) {
    case "retry_part": return "sending";
    case "request_new_upload_grant": return "not_sent";
    case "refresh_upload_state_or_request_new_grant": return "awaiting_receipt";
    case "sign_in": return "not_sent";
    default: return "failed";
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `cd apps/app && pnpm vitest run src/lib/capture`
Expected: PASS, all cases.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/lib/capture
git commit -m "feat(app): the capture core, where «no success before the receipt» is an assertion"
```

---

### Task 7: «Мої доручення»

**Files:**
- Create: `apps/app/src/lib/api.ts`, `apps/app/app/(app)/page.tsx`

**Interfaces:**
- Consumes: Task 2's `?assignee=me`.
- Produces: `apiGet<T>(path: string): Promise<T>` — a server-side fetch of `/v1` that forwards the incoming cookie header.

- [ ] **Step 1: Write `api.ts`**

```ts
import { cookies, headers } from "next/headers";

/**
 * A SERVER COMPONENT'S READ GOES THROUGH THE ROUTE, NOT AROUND IT.
 *
 * Calling `src/lib` directly would be one fewer hop and is the obvious
 * optimisation. It is refused because it would create a second authorization
 * path that has to be kept in step with the first by discipline: the route
 * checks membership, then project capability, then reads under RLS, and a page
 * that assembled its own query would be one edit away from checking less. Going
 * through `/v1` means this page and a future native client are authorised by the
 * same code, which is what ADR-007 decision 3's replaceability rests on.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const h = await headers();
  const c = await cookies();
  const base = process.env.NEXT_PUBLIC_APP_ORIGIN ?? `https://${h.get("host")}`;
  const res = await fetch(new URL(path, base), {
    headers: { cookie: c.toString() },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return await res.json() as T;
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly problem: unknown) { super("api"); }
}
```

- [ ] **Step 2: Write the page**

A server component listing the caller's assignments across their projects, each row linking to `/a/{assignmentId}` and showing `description`, `workCode` and `unitCode`. It renders even with one row rather than redirecting.

- [ ] **Step 3: Verify by hand**

`preview_start`, sign in, and confirm the list renders with the seeded fixture data.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/lib/api.ts "apps/app/app/(app)/page.tsx"
git commit -m "feat(app): «мої доручення», so a foreman who lost the link is not stuck"
```

---

### Task 8: The obligation screen

The screen ADR-007 decision 4 calls the first of two obligations: show what must be photographed, in the standard's wording, **before** work starts.

**Files:**
- Create: `apps/app/app/(app)/a/[assignmentId]/page.tsx`
- Test: `apps/app/tests/field-obligations.int.test.ts`

**Interfaces:**
- Consumes: `apiGet`, `ListRequirementOccurrencesResponse`.

- [ ] **Step 1: Write the failing test**

Assert against the assembled props rather than the DOM (there is no jsdom): a `buildObligationScreen(response)` pure function returning the ordered list, the coverage message, and the disclaimer text. Cases: order is `before_work` first; each obligation carries `normRef.text` **and** its `verification` and `source`, or is rendered without the citation; each of the four `coverage` values produces a non-empty Ukrainian sentence; the disclaimer is present for every coverage value.

- [ ] **Step 2: Run and watch it fail**

Run: `cd apps/app && pnpm vitest run tests/field-obligations.int.test.ts`

- [ ] **Step 3: Implement**

The page renders, per obligation: `acceptanceCriterion` verbatim; `normRef.text` with its tag and source beneath it; `evidenceKind`; `minEvidenceCount`..`maxEvidenceCount`; `allowedMedia.mimeTypes`. Then the disclaimer, **never collapsed**.

**IMPORT THE DISCLAIMER, DO NOT TYPE IT.** `apps/app/src/lib/statutory-act-form.ts:363` already
exports `DOVIDKOVYI_DISCLAIMER_TEXT`, transcribed from
`hidden-works-content-rules.md` §"Required disclaimers" and used by the act renderer:

```ts
import { DOVIDKOVYI_DISCLAIMER_TEXT } from "../../../../src/lib/statutory-act-form";
```

A second copy of a mandated regulatory disclaimer is two strings that can drift, and the one that
drifts is the one nobody is looking at. Assert in the Task 8 test that the rendered text is
byte-identical to that constant.

And **no satisfaction indicator of any kind.**

- [ ] **Step 4: Run the tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/app/app/(app)/a" apps/app/tests/field-obligations.int.test.ts
git commit -m "feat(app): the obligation screen, in the standard's own wording and with its disclaimer"
```

---

### Task 9: The capture island

**Files:**
- Create: `apps/app/app/(app)/a/[assignmentId]/capture.tsx`
- Test: `apps/app/tests/field-capture.int.test.ts`

**Interfaces:**
- Consumes: Task 1's enum value, Task 6's core.

- [ ] **Step 1: Write the failing integration test**

Drive the three routes in sequence as the client will: create an intent with `originMethod: "origin_not_distinguished"`, PUT bytes, finalize, and assert `status === "available"` with a matching `contentHash`. Add the test migration 0043 owes: a `native_camera` intent created through the field path is **rejected**.

- [ ] **Step 2: Run and watch it fail**

- [ ] **Step 3: Implement the island**

`"use client"`. The body of the upload, with the four details that are easy to get wrong written out:

```tsx
async function upload(file: File, occurrenceId: string, assignmentId: string) {
  // THE FILE IS NEVER DRAWN TO A CANVAS. ADR-007 Cost 1 makes "do not recompress
  // the original" binding, and a canvas round-trip is the ScaneReport
  // anti-pattern it names. We read the bytes and send exactly those bytes.
  const bytes = await file.arrayBuffer();
  const expectedContentHash = await sha256Hex(bytes);

  const created = await fetch(`/v1/assignments/${assignmentId}/upload-intents`, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": attemptKey() },
    body: JSON.stringify({
      requirementOccurrenceId: occurrenceId,
      expectedContentHash,
      expectedByteSize: file.size,
      claimedMediaType: file.type,
      originalFilename: file.name,
      // ONE UUID PER PHOTO, NOT PER ATTEMPT. A retry of the same photo carries
      // the same id, because that is what "device capture id" means; a fresh id
      // on every retry would make one capture read as several to anyone
      // reviewing the records later. Retry safety is the Idempotency-Key above.
      deviceCaptureId: photoId,
      // The one value this client is permitted to send (ADR-007 decision 5,
      // INV-086). A browser has no camera-session identity and may be handed
      // transcoded bytes, so the origin is not distinguished — and saying so is
      // the honest claim, not a weaker version of a camera claim.
      originMethod: "origin_not_distinguished",
      // DEVICE-CLAIMED, AND LABELLED SO WHEREVER IT IS SHOWN. It is the file's
      // own mtime, which the user's device asserts and nobody verified; it is
      // never rendered beside the server receipt time without that label.
      claimedCaptureTime: new Date(file.lastModified).toISOString(),
    }),
  });
  // …PUT the bytes to created.upload.signedUrl → "sending"
  // …POST /v1/upload-intents/{id}/finalize → "awaiting_receipt"
  // …only status === "available" → "server_confirmed"
}
```

**Client-local states stay in this component and are never sent to the server.** There is no server
write path for `sending` or `awaiting_receipt`, and reporting them would need the
`capture_events.client_state` CHECK (migration 0015) widened for `discarded` plus a second write
endpoint — neither of which serves either ADR-007 obligation. If a future slice wants them, that is
the migration it owes.

- [ ] **Step 4: Run the tests**

- [ ] **Step 5: Commit**

```bash
git add "apps/app/app/(app)/a/[assignmentId]/capture.tsx" apps/app/tests/field-capture.int.test.ts
git commit -m "feat(app): take the photo — one interaction, and no claim about where the bytes came from"
```

---

### Task 10: The unsaved-photo warning

**Files:**
- Modify: `apps/app/app/(app)/a/[assignmentId]/capture.tsx`
- Test: `apps/app/src/lib/capture/state.test.ts` (extend)

- [ ] **Step 1: Extend the test**

Assert that `holdsUnsavedBytes` is what gates the guard, and that the warning copy is the catalog's row `warning.capture.not_saved` verbatim.

- [ ] **Step 2: Implement**

A `beforeunload` listener registered while any capture `holdsUnsavedBytes`, plus a persistent in-page banner carrying the catalog string. The banner is not dismissible while the condition holds.

> ⚠ SUPERSEDED 2026-08-17 — see this document's header. The listener still keys off `holdsUnsavedBytes`; the **banner** keys off `serverDoesNotHaveThePhoto`, which additionally covers `failed`. Gating both on one call is what let the banner vanish on a failed upload, which `invariant-catalog.csv:82` forbids.

- [ ] **Step 3: Run and commit**

```bash
git add "apps/app/app/(app)/a/[assignmentId]/capture.tsx" apps/app/src/lib/capture/state.test.ts
git commit -m "feat(app): a lost photo is never lost silently (INV-081)"
```

---

### Task 11: The browser pass and its CI job

The only way to exercise INV-081's third test family. Modelled on `demo-qa`.

**Files:**
- Create: `apps/app/qa/browser.mjs`, `apps/app/qa/field.mjs`
- Modify: `apps/app/package.json` (add `"qa": "node qa/field.mjs"`, devDependency `puppeteer@24.10.2`)
- Modify: `.github/workflows/ci.yml` (new `app-qa` job)

- [ ] **Step 1: Port the launcher**

Copy `apps/demo/qa/browser.mjs` unchanged, including its `AKTFLOW_CHROME_PATH` override.

- [ ] **Step 2: Write the pass**

`next build && next start` on an ephemeral port, then assert: the viewport meta exists and is `width=device-width`; the довідковий disclaimer is present and not inside any collapsed element; every interactive control is at least 44×44 CSS px at a 375px viewport; the unsaved-photo banner appears after a stubbed failing upload; and no element renders the string «Збережено на пристрої».

Write findings as `qa-output/qa-report.json` and set `process.exitCode = 1` on any finding, exactly as `apps/demo/qa/verify.mjs` does. **`qa-output/` must be gitignored** — CI asserts the tree is clean afterwards.

- [ ] **Step 3: Add the CI job**

Copy the `demo-qa` job, changing the filter to `@goproceed/app`. Keep every step: the explicit `pnpm exec puppeteer browsers install chrome`, the apt install of Chrome shared libraries, the "Verify Chrome launches" step that imports the real `launch()`, and the clean-tree assertion.

- [ ] **Step 4: Run it locally**

Run: `cd apps/app && pnpm build && pnpm qa`
Expected: exit 0, `qa-output/qa-report.json` written with `ok: true`.

- [ ] **Step 5: Commit**

```bash
git add apps/app/qa apps/app/package.json .github/workflows/ci.yml .gitignore pnpm-lock.yaml
git commit -m "test(app): a browser pass, because INV-081's third family cannot be tested in Node"
```

---

## Final verification

- [ ] `pnpm turbo run typecheck` — 10 of 10
- [ ] `supabase db reset && pnpm db:local-credentials`
- [ ] `pnpm turbo run test --concurrency=1` — every package green, **one run at a time, and no other query against that database while it runs**
- [ ] `pnpm turbo run build` — 3 of 3
- [ ] `node scripts/validate-canonical-docs.mjs` — exit 0
- [ ] `pnpm --filter @goproceed/demo preflight` — exit 0
- [ ] `cd apps/app && pnpm qa` — exit 0
- [ ] Update `TODOS.md` and `HANDOFF.md`: ADR-007 is implemented, INV-086's "NOT YET IMPLEMENTABLE" note is closed, and the reference-image debt plus the milestone contradiction between ADR-007, `glossary.md`, `competitive-landscape.md` and `version-0.1.md` is recorded as owed.
