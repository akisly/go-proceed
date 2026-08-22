# Plan D — the office dashboard (master plan + slice D0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the office roles a screen for every job they do today through curl, SQL or a phone call to me — in the order the demand evidence ranks the pain — without touching the field client and without inventing a second design system.

**Architecture:** A new route group `apps/app/app/(dash)/**` inside the existing app (ADR-009 decision 1: the dashboard IS the system, not a fourth surface), workspace-scoped the way [`circle`](https://github.com/ln-dev7/circle) scopes by `[orgId]`. Every component it needs is added to **`packages/ui`** on the Radix already installed there — never a parallel `apps/app/components/ui` tree. Screen patterns are taken from [`shadcn-admin`](https://github.com/satnaing/shadcn-admin) (MIT, attribute), structure from [`plane`](https://github.com/makeplane/plane) (**AGPL — structure only, never its code**). Reads go through the existing `/v1`; the one exception is slice D1, which needs a route that does not exist.

**Tech Stack:** Next 16.3 App Router (server components + `apiGet` self-fetch, the pattern `app/(app)/page.tsx` already uses), `packages/ui` + `packages/tokens`, `radix-ui@1.6.7`, vitest, the design gate of `docs/design/02-building-ui.md`.

**Spec:** [`docs/design/04-role-pain-map.md`](../../design/04-role-pain-map.md) (which screen serves whom, sourced to the demand scan), [`docs/design/03-ui-references.md`](../../design/03-ui-references.md) (what may be copied from where), ADR-009 decision 3.

## Status — slice D0 complete (2026-08-22)

Tasks 1–3 are done and reviewed; Task 4 is this docs pass and the PR.
Commits, in order: `04715b3`, `3e5bfaa`, `4f22d51` (Task 1), `f8da539`,
`f64ce85`, `d688179` (Task 2 and its fix round), `6420f9c`, `52e94a7`
(Task 3 and its fix round).

**Two things this slice proved wrong in the text below, left in place rather
than rewritten so the correction is visible:** the route group `(dash)` named
in Task 2 collides with the field client's `(app)` — both resolve to `/` and
Next refuses the build, so the path is `/dash` as a real segment, and Task 3's
paths are `app/dash/settings/profile/` and `src/components/dash-shell/*` in
kebab-case; and `GET /v1/me/context` carries no email, so the signed-in
address comes from the Supabase session rather than from `/v1`.

Residuals that outlived the slice are in `TODOS.md` under «Surfaced by Plan D
slice D0 (the dashboard shell), 2026-08-22» — six of them, including one
missing token role that makes every future dashboard dialog full-width.

## Global Constraints

- **The design gate binds and decides.** `docs/design/02-building-ui.md` is a procedure: read §3.1 before the first line, answer §3.3's three questions, and run §5 — **all five commands, output pasted** — before any task claims done:
  ```
  pnpm --filter @goproceed/tokens generate     # only if tokens.json changed
  node packages/testing/qa/motion-audit.mjs    # must print "motion-audit: clean"
  pnpm --filter @goproceed/testing test
  pnpm turbo run typecheck
  pnpm --filter @goproceed/landing build
  ```
  Plus, for this plan, `pnpm --filter @goproceed/app build` and `pnpm --filter @goproceed/app test`.
- **`apps/app` is dense and border-led** (§3.3): no marketing scale, no `radius-card`/`surface`/`section`, no `shadow-float`; «`shadow-md` on a panel → nothing, use `border border-line`». The references lean on cards and shadows — that part does not come across.
- **Role names, never values.** A hex, an `oklch()`, a `var(--gp-neutral-*)`, a stock `text-sm`, a `bg-${tone}` template literal — each is a defect with a test that already catches it.
- **A component goes in `packages/ui/src/components`**, is exported from its index, and its entry in that index's «deliberately NOT here» note is removed in the same commit. Building a second Button is the failure mode §3.1 names.
- **No screen for the foreman, no account for технагляд** — `04-role-pain-map.md` explains why both are deliberate.
- Ukrainian copy only, from `technical/copy-catalog.csv` where a key exists; new user-facing strings get catalog rows.
- CI is billing-paused until 2026-09-01: verify locally in CI's shape.
- `apps/mobile` and `apps/landing` are untouched by every slice.

## The slice sequence, and why this order

| Slice | Screen | Serves | Why here |
|---|---|---|---|
| **D0** (this plan) | shell: route group, sidebar, header, workspace/project switch, **profile + sign-out** | everyone | nothing else has a home without it; and there is currently **no way to sign out anywhere in the product** |
| D1 | evidence by assignment (+ the read route that does not exist) | ПТВ | the scan's most concrete pain: «several days searching photos in chats» |
| D2 | overview — blocked value, blocked reasons, readiness | owner / commercial | the payer's question, «acceptance delays cash»; the routes already exist and nothing reads them |
| D3 | assignments list + create, over the full contract chain | ПТВ | today this is SQL; biggest slice, best done once the shell and its components exist |
| D4 | members & access | ПТВ / admin | smallest value per unit of work of the five, and blocked on a UX problem D0 cannot fix (see below) |

### Anchors already discovered — do not re-research these

Recorded here so D1–D4 are cheap to write and nobody rediscovers them the expensive way.

**D1 — evidence read.** `GET /v1/upload-intents/{id}` is the only evidence-ish read and returns **no storage key by design** («a key in a response is a capability leak»). `apps/app/src/lib/evidence-storage.ts` has **no read-URL helper** — only `createSignedUpload`; a `createSignedReadUrl` must be added there, reusing the same memoized service client. `@supabase/storage-js@2.112.3` (what `apps/app` actually resolves) does expose `createSignedUrl(path, expiresIn, {download})` and `createSignedUrls(paths, …)` for batching — `expiresIn` is **seconds**. `docs/architecture/files-and-storage.md` §Downloads binds: the BFF rechecks authorization first, TTL «normally no more than 60 seconds», the URL is **never** written to audit, outbox, idempotency bodies or logs, and it must not permit listing adjacent objects. A member-plane read may hand out a provider URL; an **external-plane** read must stream through the BFF instead (revocation). New route: `GET /v1/assignments/{assignmentId}/evidence`, capability `project.view`. **This is the ADR-009 «no new API» exception the owner approved on 2026-08-21 — record it in ADR-009 as a dated amendment, not a rewrite.**

**D3 — the contract chain, with three traps.**
1. **`/v1/parties/{partyId}/legal-profile` is `PUT`, not `POST`** (the file exports only `PUT`; a POST gets Next's 405). It is an upsert: 201 create, 200 update.
2. **Ordering trap:** a work item carrying `workTypeKey` is refused unless a `requirement_rule_versions` row with that exact key is already **published** in the workspace (`app.work_type_key_is_bindable`, ARM 1) — so **`POST /v1/workspaces/{ws}/requirement-rule-versions` runs BEFORE any classified line**, not after. An untyped line is legal but produces zero occurrences — which is exactly the empty obligation screen the owner hit on the phone on 2026-08-21.
3. **Publish needs a client-computed hash.** `confirmedManifestHash` = sha256 of `JSON.stringify({scheme:"goproceed-manual-baseline/2", pins:{currency,taxMode,taxRateBps,midpoint}, lines: […16-element tuples…]})` — `lineManifestHash`, recomputed from `GET /v1/contracts/{contractId}/versions/{versionNo}`. Publish also refuses with 409 `RULE_BINDING_REQUIRED` when nothing is bound (INV-083) and 422 when there are no lines.
   Capabilities that are **not** implied by `project.admin`: `contracts.edit` (steps 4–6, 8) and `rule_bindings.manage` (step 7). Both are separate grants.

**D4 — the UX problem.** `GET /v1/workspaces/{ws}/members` returns `{memberId, userId, role, status}` and **no email, no name**: the office user would be granting capabilities to UUIDs. `POST /v1/workspaces/{ws}/invitations` returns a token to deliver out of band. Deciding what identity to show is product work, not layout — it belongs in D4's own brainstorming, and D4 is last for that reason.

---

## Slice D0 — the shell

### Task 1: the components the shell needs, in `packages/ui`

**Files:** Create `packages/ui/src/components/{Dialog,DropdownMenu,Avatar}.tsx` (+ tests where the contract suite expects them); Modify `packages/ui/src/components/index.ts` (export them; delete their lines from the «deliberately NOT here» note), `packages/tokens/src/tokens.json` only if a role is genuinely missing (§3.3 question 2 — a missing colour is a missing ROLE).

**Interfaces produced:** `Dialog` (Radix `Dialog` composition: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`), `DropdownMenu` (`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuLabel`), `Avatar` (`Avatar`, `AvatarFallback` — no image source exists in the product yet, initials only).

- [x] **Step 1: Read the gate first.** `docs/design/02-building-ui.md` §3.1 (which sends you to `packages/ui/src/components/index.ts` and `packages/ui/src/motion/index.ts` — read both), then §3.3, then §4.1's substitution table. Note in the report which of the three questions each component answered.
- [x] **Step 2: Write the components.** Structure and behaviour follow shadcn/ui's own implementations of the same Radix primitives (MIT — header each file with `// Structure follows shadcn/ui's <name> (MIT); styling is this system's token roles.`). Styling is ours: role classes only, `h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch)` for controls, `border border-line` instead of shadows, motion from `@goproceed/ui/motion` (never `motion/react` — that is a build failure). Focus-visible, Escape, and Radix's own portal/overlay semantics stay as the primitive gives them.
- [x] **Step 3: Update the inventory note** in `index.ts` — remove Dialog/DropdownMenu (and Avatar) from the absent list, leaving the rest of the note intact; it is a record, not a placeholder.
- [x] **Step 4: Run the §5 gate** (all five commands above) and paste the output. `motion-audit` must print `motion-audit: clean`.
- [x] **Step 5: Commit** — `feat(ui): Dialog, DropdownMenu and Avatar — the Phase 4 components the app shell needs`.

### Task 2: the route group and its shell

**Files:** Create `apps/app/app/(dash)/layout.tsx`, `apps/app/app/(dash)/page.tsx` (placeholder that redirects to the first project or shows the empty state), `apps/app/src/components/dash/{Sidebar,TopBar,WorkspaceSwitch}.tsx`; Modify `apps/app/proxy.ts` **only if** the matcher does not already gate the new paths (read its comment block first — it is an exclude list and its own header calls a bad matcher «the single most likely thing in this file to be wrong in a way that fails silently»).

**Interfaces consumed:** `apiGet` (`apps/app/src/lib/api.ts`), `GET /v1/me/context` (memberships), `GET /v1/projects`.

- [x] **Step 1:** Server component layout: `requireUser`-backed session via the existing proxy gate; fetch `/v1/me/context` and `/v1/projects` once in the layout; pass down. Empty states in Ukrainian: no workspace → «У вас ще немає робочого простору.»; no project → «У цьому просторі ще немає проєктів.» (add catalog rows).
- [x] **Step 2:** Sidebar and top bar — structure after circle's `components/layout/{sidebar,headers}` (MIT, attribute), rendered with our components. Desktop rail + mobile drawer (the `Dialog`/`DropdownMenu` from Task 1). Navigation items are only the slices that exist: Overview (D2, disabled placeholder), Assignments (D3, placeholder), Evidence (D1, placeholder), Members (D4, placeholder), plus the profile menu from Task 3. A disabled item renders as disabled with a title, never as a dead link.
- [x] **Step 3:** `pnpm --filter @goproceed/app build` and the §5 gate; then the §6 visual pass — six viewports and reduced motion, with real Ukrainian strings.
- [x] **Step 4: Commit** — `feat(dash): the route group and its shell — sidebar, top bar, workspace switch`.

### Task 3: profile and sign-out

**Files:** Create `apps/app/app/(dash)/settings/profile/page.tsx`, `apps/app/src/components/dash/ProfileMenu.tsx`, `apps/app/src/components/dash/SignOutDialog.tsx` (client); Modify `technical/copy-catalog.csv`.

- [x] **Step 1:** Profile page shows what the product actually knows: email from the session, workspace memberships and role from `/v1/me/context`. No editable fields — there is no route to write them, and inventing one is out of scope.
- [x] **Step 2:** Sign-out: `supabaseBrowser().auth.signOut()` then `router.replace("/login")`, behind a confirm dialog (pattern from shadcn-admin's `sign-out-dialog`, MIT). Copy: «Вийти з системи?» / «Ви зможете увійти знову за одноразовим кодом.» / «Вийти» / «Скасувати».
- [x] **Step 3:** A test that pins the two things worth pinning: the dialog does not sign out until confirmed, and sign-out clears the session (mock the client).
- [x] **Step 4:** §5 gate + app build + tests. **Commit** — `feat(dash): profile, and the first way to sign out that this product has ever had`.

### Task 4: docs and the PR

- [ ] `TODOS.md`: Plan D's progress — D0 done, D1–D4 named with the anchors above. `infra/README-staging.md` needs nothing (no new env, no new project). Validate docs, run the full local suite in CI's shape, open the PR citing all three references and the role each screen serves.

---

## Self-review

- Spec coverage: `04-role-pain-map.md` screen 6 (profile/sign-out) and the shell that screens 1–5 need are D0; screens 1–5 map to D1–D4 with their anchors recorded. The «no foreman screen / no технагляд account» rules are in Global Constraints.
- Placeholder scan: D1–D4 are deliberately named-not-tasked (the scope-split writing-plans prescribes); everything inside D0's four tasks carries its files, its commands and its copy.
- Type consistency: the component names Task 1 produces are the names Tasks 2–3 consume; `apiGet` and the two GET routes are named identically to their existing implementations.
