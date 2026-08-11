# Design — the v0.1 pilot field client (PWA)

**Status:** Approved by the owner on 2026-08-10, section by section.
**Implements:** [ADR-007](../../decisions/ADR-007-pilot-field-client.md), which is
Approved and settles almost every interaction question this design would
otherwise have to ask.
**Milestone:** v0.1-M2 «The phone» — step 2 of ADR-006's six.

---

## 1. What this is

One route group in `apps/app`, on the same origin and the same member session as
the rest of the product, that does exactly the two things ADR-007 decision 4
names:

1. **show the foreman what must be photographed before covering**, in the
   standard's own Ukrainian wording, before work starts;
2. **take the photo.**

It is a client and not a feature. **Both obligations already have a complete
server vertical** — this is the strongest fact behind the whole design, and it is
why the work is small:

| Obligation | Server surface, already built |
|---|---|
| Show the obligation | `GET /v1/assignments/{assignmentId}/requirement-occurrences` — `apps/app/app/v1/assignments/[assignmentId]/requirement-occurrences/route.ts`, contract `packages/contracts/src/requirement-occurrences.ts` |
| Take the photo | `POST /v1/assignments/{assignmentId}/upload-intents`, `GET /v1/upload-intents/{intentId}`, `POST /v1/upload-intents/{intentId}/finalize` |

The occurrence route already returns the obligations sorted in the order work
meets them, with `acceptanceCriterion` copied verbatim from the Додаток Н library
at rule-version publication and `normRef` machine-composed as
`{text, verification, source}`. Nothing about the domain, the API or the gate
moves — ADR-007 decision 3, and it is what makes decision 9's reversal cheap.

## 2. Approach

**Server-rendered reads, client-side capture, cookie session.** Chosen over a
client-side SPA holding a bearer token.

The obligation screen is a React Server Component: the server already holds the
session and re-reads capability on every request, so the screen renders as HTML
and needs no JavaScript to be correct. Three consequences, and each is a reason:

- **It paints on a bad connection**, which is where this is used.
- **The довідковий disclaimer cannot be lost.**
  `hidden-works-content-rules.md` §"Required disclaimers" requires it under every
  generated requirement list, **never collapsed**. Server-rendered, a hydration
  failure cannot drop it.
- **No bearer token in `localStorage`.** Cost 2 of ADR-007 is precisely that iOS
  evicts script-writable site storage; putting the session there would be
  building on the sand the ADR names.

Only the capture widget is `"use client"`, because it has to be:
`crypto.subtle.digest`, `File` and the `PUT` to Supabase Storage are browser
APIs. It calls `/v1` same-origin, so the cookie rides along with no token
handling of its own.

**The server components call the same `/v1` routes over HTTP, forwarding the
session cookie, rather than reaching into `src/lib` directly.** An in-process
call would be one fewer hop and is the obvious optimisation; it is refused
because it would create a second authorization path that has to be kept in step
with the first by discipline. Going through the route means the page and a future
native client are authorised by the same code, which is what ADR-007 decision 3's
replaceability actually rests on. If the hop ever measures as a problem, the fix
is a shared read function called by both — not a page that authorises itself.

**Rejected — full client SPA with a bearer token.** It is the closest shape to
what an Expo client would do, which flatters ADR-007 decision 9. But the ADR
buys reversibility at the *contract* level, not the rendering level, so the SPA
pays iOS eviction and a blank pre-hydration screen for portability it already
has.

**Rejected — server-rendered forms with no client JS.** It cannot work.
`expectedContentHash` is required at intent creation, so the file must be hashed
in the browser before a destination can be requested; the alternative is
uploading bytes through Next.js, which the current design deliberately avoids.

## 3. Scope

### In

- The app shell that does not exist: `viewport` and `metadata` exports, a
  stylesheet, a font, icons, `public/`, a web manifest.
- Sign-in by email + 6-digit OTP.
- «Мої доручення» — the foreman's own assignments.
- The assignment screen: obligations, then capture.
- The pure capture core and its tests; integration tests for the page reads; a
  puppeteer browser pass with its own CI job.

### Out, deliberately

- **Any offline queue or durable local original.** ADR-007 decision 6.
- **Any service worker.** `system-overview.md` forbids caching authenticated
  responses or evidence originals, and with no push in v0.1 (decision 7) a
  service worker would buy nothing. The manifest ships without one and says so in
  the file: it gives a home-screen icon, not offline capability.
- **The reference image.** ADR-007 decision 4 names one and it exists in no form —
  no column, no contract field, no asset, no owner, no licence. The owner decided
  on 2026-08-10 to ship the obligation text without it. **The documents disagree
  about which milestone owns it** — ADR-007 decision 4 and `glossary.md` say
  v0.1-M2, `competitive-landscape.md` says v0.3, and `version-0.1.md`'s own M2
  exit-gate list omits it. That contradiction is recorded as owed work, not
  resolved here.
- **Stage closure, the readiness view, any satisfaction indicator.**
- **Reporting client-local states to the server.** See §6.

## 4. Prerequisites

Four must land with this work; one is the owner's.

1. **`packages/contracts/src/uploads.ts`** — `originMethod` is
   `z.enum(["native_camera","photo_picker","file_picker","form"])`. The database
   has admitted `origin_not_distinguished` since migration 0043
   (`upload_intents_origin_method_check`, verified against the running local
   database on 2026-08-10); the contract cannot express it, so **no PWA capture
   is recordable today**. INV-086 is a P0 saying exactly that. The enum gains the
   value, and migration 0043's owed test lands with it: a `native_camera` request
   from the PWA path is **rejected**.
2. **`foreman` gains `project.view`.** `capabilities.csv` already defines
   `project.view` as «this is also how the foreman reads the occurrence set for an
   assignment before work starts (ADR-006 step 2)», and
   `responsibility-presets.csv` grants the foreman only
   `progress.record evidence.record`. The gap bites twice: he can neither read the
   obligation nor name `requirementOccurrenceId` at intent creation, and without
   the second every upload silently falls to `FALLBACK_MEDIA`.
3. **`assignments.list` returns `assigneeMemberId` and accepts `assignee=me`.**
   It is accepted at creation (`createAssignmentRequest`) and never returned, so
   «my assignments» is not computable at all today.

   **The filter is `me`, not a member id, and that is not a convenience.**
   `meContextResponse` (`packages/contracts/src/me-context.ts`) returns
   `userId` and a membership list carrying `workspaceId`, `displayName`, `role`,
   `status` and `membershipVersion` — **and no member id**. A client therefore
   cannot name itself, and adding the id to that response would hand every client
   an identifier it has no other use for. Resolving `me` from the session inside
   the route keeps the answer where the session already is.
4. **`ADR-004:70-74`** — the one un-landed row of ADR-007's correction table,
   still reading «a separate native client, not a responsive-web substitute».
   ADR-007 stops delivery of any slice depending on an un-landed row. The owner
   asked for the edit to be made here and approved in review.
   *(Landed 2026-08-11 by task 3 of this plan. The amended paragraph is now
   `ADR-004:70-78`, ADR-004's «Related decisions» header names ADR-007, and
   ADR-007's own citations were re-pointed at the shifted lines.)*

**Not solved here, and it blocks the pilot rather than the code.** There is no
HTTPS origin for `apps/app` — no `vercel.json` for it, no CI deploy step, and
`infra/README-staging.md` records that staging has never been provisioned. Until
one exists, «a foreman opens it on a phone» cannot happen and ADR-007's two
required measurements (EXIF and `capture` behaviour by engine; the storage
eviction rule) cannot be taken.

## 5. Screens

```
apps/app/
  public/                                  NEW  icons + manifest.webmanifest, no service worker
  middleware.ts                            NEW  refresh cookie session; redirect with ?next=
  app/layout.tsx                           gains viewport + metadata + tokens.css + font
  app/(auth)/login/page.tsx                REPLACES the 8-line stub
  app/(auth)/login/otp-form.tsx            NEW  "use client"
  app/(app)/page.tsx                       NEW  «Мої доручення»        (server component)
  app/(app)/a/[assignmentId]/page.tsx      NEW  the obligation screen   (server component)
  app/(app)/a/[assignmentId]/capture.tsx   NEW  "use client" — the only island
  src/lib/supabase-browser.ts              NEW  createBrowserClient
  src/lib/capture/                         NEW  the pure core (§7)
```

`app/(app)/context/page.tsx` — the other existing stub, which says the
organisation list «завантажується через /v1/me/context» and loads nothing — is
left in place and untouched. It is not on the foreman's path, and replacing a
stub nobody reached is scope this design has no reason to take.

**S1 — Вхід.** Email → `signInWithOtp` → 6-digit code → `verifyOtp`.
`@supabase/ssr` writes the cookie and `middleware.ts` refreshes it. `?next=`
is preserved, so a link opened cold lands on the right assignment after sign-in.
Chosen over a password because a password is more actions than Telegram, which is
the constraint ADR-007 exists to satisfy; `supabase/config.toml` already enables
email OTP with confirmations off.

**S2 — Мої доручення.** Server component over the filtered assignment list. It
renders even when there is exactly one assignment rather than auto-redirecting —
surprise navigation on a phone is worse than one tap. Primary entry is still a
direct link to S3; this screen exists so a foreman who lost the link is not stuck.

**S3 — Доручення.** The obligation list in the route's own timing order
(`before_work` → `during` → `before_concealment` → `after` → `before_package`).
Per obligation: `acceptanceCriterion` verbatim, `normRef.text` beneath it with its
verification tag and source, and `allowedMedia` with `min..maxEvidenceCount` as
the real constraint. Then:

- **the довідковий disclaimer under the list, never collapsed**;
- **all four `coverage` values rendered distinctly** — `covered`, `no_bindings`,
  `no_matching_rule`, `work_type_unresolved`. Three are refusals and each gets an
  actionable Ukrainian sentence; an empty list must never read as «nothing is
  required»;
- **no satisfaction indicator.** The server cannot compute one in this milestone,
  and a client-side one would be a lie.

## 6. The capture flow

Six states, expressed as a narrowed union so that `quarantined` — native-only per
ADR-007 decision 6 — is unrepresentable in the type system rather than merely
unused:

```
not_sent → sending → awaiting_receipt → server_confirmed
                  ↘ failed          ↘ discarded
```

Labels come from `technical/copy-catalog.csv` rows `status.client_state.*`, which
are already approved. The steps:

1. `<input type="file" accept="image/*" capture="environment">`. **The `File`
   never touches a canvas.** Cost 1 of ADR-007 makes «do not recompress the
   original» binding; the client can only promise that *it* did not transform the
   bytes, and no copy anywhere may say the hash binds the sensor output.
2. `crypto.subtle.digest("SHA-256", bytes)` → lowercase hex, plus `file.size`.
   Both are required *before* a destination can be requested.
3. Create the intent: `originMethod: "origin_not_distinguished"`,
   `requirementOccurrenceId` set to the obligation being answered,
   `claimedCaptureTime` from `file.lastModified` — rendered with its untrusted
   label and never placed beside the server time without one — and
   `deviceCaptureId`, **one UUID per photo and not per attempt**. A retry of the
   same photo carries the same id, because that is what the field means; a new id
   on every retry would make one capture look like several to anyone reading the
   records afterwards. Retry safety is the `Idempotency-Key`'s job, which the
   route already requires.
4. `PUT` the bytes to the signed URL → `sending`.
5. `POST` finalize → `awaiting_receipt`.
6. **Only `status: "available"` produces `server_confirmed`.** Nothing earlier may
   say «збережено». `upload_received` is not `evidence_available`.

**Recovery reads the `userAction` taxonomy, and the v0.1 client acts on none of
it automatically.** *(Corrected 2026-08-11 by the final whole-branch review —
Important 4. This paragraph previously read «`retry_part` retries the PUT;
`request_new_upload_grant` creates a new intent;
`refresh_upload_state_or_request_new_grant` re-GETs the intent, whose replay path
returns the stored receipt and* is *the flaky-connection recovery», in the present
tense, and none of it was ever built:* `uploadCapture` *sets a client state and
returns. Nothing retries the PUT, nothing creates a second intent, and*
`GET /v1/upload-intents/{intentId}` *is not called from this client at all. The
document is corrected rather than the code expanded, because a half-built
recovery loop is worse than an honest absence.)*

What v0.1 does: the refusal's `userAction` decides which client state the screen
rests in, and the file input — which doubles as the retry control — is how the
foreman restarts the whole pipeline, hash through finalize, with a fresh intent
and a fresh `Idempotency-Key` but the same `deviceCaptureId`.

- `retry_part` → `failed`. The PUT is not retried here.
- `refresh_upload_state_or_request_new_grant` → `failed`. The intent is not
  re-GETted here.
- `request_new_upload_grant` → `not_sent`. No new intent is created
  automatically; picking the file again creates one.
- `recapture_or_contact_support` → `failed`.
- `sign_in` → `not_sent`, and the sign-in screen is reached with `next`.
- anything this build does not recognise → `failed`.

`failed`'s approved label is «Потрібна дія» and `not_sent`'s is «Не надіслано»;
neither asserts that an operation is under way, which is the property that
matters. `sending` and `awaiting_receipt` are reachable **only** while a request
really is in flight — a refusal may never leave the screen resting on one, and
`recover.test.ts` asserts that across the whole taxonomy.

**The intent re-GET is the recovery worth building next**, and it is the cheapest:
`GET /v1/upload-intents/{intentId}`'s replay path returns the stored receipt, so
it is the genuine answer to a connection that dropped between the PUT and the
receipt. It is not in v0.1.

**No silent loss — INV-081.** A `beforeunload` guard whenever any capture is in
`not_sent`, `sending` or `awaiting_receipt`, plus an in-page banner. This needs
new Ukrainian copy the catalog does not have. In the same change,
`copy-catalog.csv` `field.capture.saved_local` = «Збережено на пристрої» is marked
native-only: it is a string the PWA can never truthfully render.

**Client-local states are NOT reported to the server.** They stay in page memory.
No server write path exists for `sending` or `awaiting_receipt`, and reporting
them would require widening the `capture_events.client_state` CHECK
(migration 0015) for `discarded` plus a second write endpoint — neither serves
either ADR-007 obligation.

## 7. Testing

`apps/app` has Node-only vitest with `fileParallelism:false`, no jsdom, no
testing-library and no browser. Rather than bolt a DOM runtime on, the logic moves
out of the DOM.

- **A pure core in `src/lib/capture/`** — the state machine, hex encoding, and the
  `userAction` → next-state mapping, as functions with zero DOM. They run in the
  existing Node vitest with no new dependency. **«No success before the receipt»
  becomes an assertion here**, not a comment.
- **Integration tests** for the page reads, in the shape the existing suites
  already use against the local Postgres.
- **A puppeteer browser pass with its own CI job**, modelled on `demo-qa`. It is
  the only way to exercise INV-081's third family: the `beforeunload` warning
  actually firing, the disclaimer rendered uncollapsed, the viewport meta, and
  touch-target sizes.

## 8. Styling

Port `apps/demo`'s Tailwind v4 `@theme` and the shadcn components actually used,
**including its non-stock `cn` with `extendTailwindMerge`** — not optional if the
components come along, because their variants depend on it. `apps/demo`'s 44px
touch floor below `md` is already encoded in the button variants and is right for
a gloved hand. Design tokens wire in the way `apps/landing/app/layout.tsx` already
does it.

## 9. What this design does not claim

Restating ADR-007 decision 5, because a screen is where these get re-asserted by
accident. The client may claim a **client-computed content hash** verified at
finalization, a **server receipt time**, and a **device-claimed capture time
explicitly labelled untrusted**. It may not claim camera-only capture, that a
photo is distinguishable as camera-taken, tamper-evident provenance, or verified
capture-time GPS. Re-asserting any of them is an ADR, never a UI change.
