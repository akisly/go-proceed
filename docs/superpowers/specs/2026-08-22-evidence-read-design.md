# Evidence read — the design

**Date:** 2026-08-22
**Slice:** Plan D, D1
**Status:** approved by the owner 2026-08-22 (four decisions recorded below)
**Read with:** [`../plans/2026-08-21-plan-d-dashboard.md`](../plans/2026-08-21-plan-d-dashboard.md),
[`../../design/04-role-pain-map.md`](../../design/04-role-pain-map.md),
[`../../architecture/files-and-storage.md`](../../architecture/files-and-storage.md) §Downloads,
[`../../architecture/tenancy-and-security.md`](../../architecture/tenancy-and-security.md) §Storage RLS

## Why this slice exists, and what brainstorming found that the plan did not know

Plan D anchored D1 as one gap: the office dashboard cannot show a photo, because
no `/v1` route reads evidence. That is true. **It is not the only gap, and it is
not the one that blocks the pilot.**

`apps/app/app/external/occurrence/route.ts` records the second one in its own
header, as the largest functional gap its milestone left: the M5 acceptance walk
says технагляд reads the requirement in the standard's own wording **with the
photo**, and that route returns the requirement, the photo's identity, size,
media type, hash and provenance — but not the photo. Its own words: a reviewer
who cannot see the photo will not accept.

So `04-role-pain-map.md`'s statement that технагляд's path is «already built» is
true and incomplete. It is built without the image. The product thesis is that
технагляд accepts or returns **without an account**; today that person can read
what is claimed and cannot see what is claimed about.

`technical/openapi/scope-v0.1.csv` confirms both: five external operations, none
serving bytes, and on the member plane only `evidence_decisions.create`. Nothing
in the catalogued API surface returns an evidence original to anyone.

## Decisions

| # | Decision | Owner's answer, 2026-08-22 |
|---|---|---|
| 1 | Scope | D1 closes **both planes** — the member read and the external stream |
| 2 | Navigation | project → assignments → evidence; D1 builds the assignments list **read-only**, D3 adds creation on top of it |
| 3 | The external link | issuing it moves **into** D1 — today `occurrence_grants.issue` is reachable only by curl, so even a working external read would still need the owner's hands |
| 4 | Byte delivery | **two mechanisms**, each matched to its plane's rule (approach A below) |

Approach B — streaming on both planes — was considered and rejected. It is
simpler and removes signed URLs from the system entirely, but it erases a
distinction the architecture makes deliberately: external access must be
revocable, member access need not be, and `tenancy-and-security.md` grants the
cheaper path to the member plane explicitly. Approach C — signed URLs on both —
violates the external revocation rule outright.

## Architecture

### The rule that splits the two paths

`tenancy-and-security.md` §Storage RLS: «Available-object download uses a
short-lived signed URL **or** same-origin authorized stream after current access
revalidation.»

`files-and-storage.md` §Downloads: an already-issued provider signed URL «is not
assumed to be immediately revocable», and for data requiring immediate
revocation, or when external-session scope may change during the transfer, the
BFF **streams or proxies the object instead**.

An external grant is revocable by design (`external_grants.revoke_reissue` is a
catalogued operation). Therefore the external plane streams. The member plane
does not carry that requirement and takes the signed URL.

### The storage helper

`apps/app/src/lib/evidence-storage.ts` today exports `createSignedUpload`,
`putObject`, `downloadObject`, `objectSize`, `objectExists`, `removeObject` —
**no signed-read helper**. It gains one, on the same memoized service client:

- `createSignedReadUrl(key, ttlSeconds)` — single object.
- a batch form over `@supabase/storage-js`'s `createSignedUrls(paths, expiresIn)`,
  so one screen costs one storage call rather than one per photo.

`expiresIn` is **seconds**. The default and the ceiling are both **60** —
`files-and-storage.md` says «normally no more than 60 seconds», and a helper
whose default is the ceiling cannot drift upward by inattention.

**To verify against the installed package during implementation, not assumed
here:** the exact signature and return shape of `createSignedUrls` in the
`@supabase/storage-js` version `apps/app` actually resolves, and whether it
reports per-path failure inline or throws. CLAUDE.md forbids implementing an SDK
call from memory.

### Route 1 — the member plane

```
GET /v1/assignments/{assignmentId}/evidence
capability: project.view          wrapper: queryRoute
```

Returns, per requirement occurrence, the evidence objects bound to it: id,
`media_type`, `byte_size`, `content_hash`, `original_filename`, `origin_method`,
`capture_time_trust`, `claimed_capture_time`, `server_received_at`, and a signed
read URL.

Binding rules that the route's shape must satisfy:

- `Cache-Control: no-store` on the response. A signed URL in a shared cache is a
  capability handed to whoever asks next.
- Logs record the evidence object id and the authorization result, **never the
  signed URL and never the raw storage key** — the doc's words.
- The URL is never written to audit, outbox, idempotency bodies or
  notifications. A GET has no idempotency body, so that half of the rule is
  satisfied by the route's form rather than by anyone's discipline; the other
  half is a test, listed below.

### Route 2 — the external plane

```
GET /external/evidence            wrapper: externalQueryRoute
```

Streams the object bytes, same-origin, after revalidating the session's grant.

The object is named by `?evidenceObjectId=…` — **never by a storage key**. A
caller who could name a key could name someone else's; a caller who names a row
id can only reach what the session's own policy already admits. The id comes
from `GET /external/occurrence`, which already returns `evidenceObjectId` for
every object on the occurrence, so this route adds no new disclosure — only the
bytes for something the session was already told exists.

The session is scoped to exactly one occurrence by `ro_external_select`, the
same policy `external/occurrence/route.ts` relies on. That route's pattern is
adopted deliberately: it does not filter by id, it **asserts** it, so a policy
that ever widened fails the route loudly instead of silently returning a
sibling. The stream route does the same.

Content-disposition and filename handling follow `files-and-storage.md`'s «safe
filename/content-disposition handling». The response must not permit listing
adjacent objects — which the route's shape gives, since it never accepts a
storage key from the caller.

### Both routes are catalogued

`technical/openapi/scope-v0.1.csv` gains a row for each. This is the ADR-009
«no new API» exception the owner approved on 2026-08-21, and it lands in ADR-009
as a **dated amendment, not a rewrite** — now covering two operations rather
than the one the plan anticipated.

### One check that is not needed, and why knowing that matters

The real `evidence_objects` has **no scan state to filter on**. Migration
`0015_execution_evidence_module.sql` states it directly above the table: a
scan-blocked upload never produces an evidence row at all, because the blocked
state lives on the intent. The existence of the row *is* the scan guarantee.

This is worth writing down because the obvious defensive instinct — «filter out
quarantined objects before serving bytes» — would be filtering on a column that
does not exist, and the reviewer who asks for it is reading `technical/schema.sql`
(see the recorded finding at the end).

## The screens

### `/dash/projects/{projectId}/assignments` — the assignments list, read-only

One call to the existing `GET /v1/projects/{projectId}/assignments`. D3 adds
creation on top of this list rather than building a second one.

### `/dash/assignments/{assignmentId}` — evidence by assignment

The pain, from the demand scan, is days spent searching photos in chats and
transcribing facts into Word. So the screen shows evidence **grouped by
requirement occurrence** — not a feed — and shows, beside each photo, exactly
the facts that are being transcribed by hand today: server-received time,
`origin_method`, `capture_time_trust`, and `content_hash`.

Beside each occurrence: **«Відправити на перевірку»** → `POST /v1/occurrences/{occurrenceId}/grants`.

INV-044 governs what happens next and the screen must not soften it: the token
is returned **once**, GoProceed cannot reconstruct or retry it, and the only
recovery is an authorized revoke-and-reissue. The screen says so on the face of
the result, not in a tooltip.

### A cost this design accepts and names

Supabase image transformation is a paid add-on, so the dashboard loads
originals. Lazy loading and fixed-size containers reduce the damage; twenty
photos are still twenty multi-megabyte files. This is recorded in `TODOS.md` as
a named cost rather than discovered later as a surprise.

## Data flow

Evidence does not carry an assignment or occurrence id. The link is
`upload_intents`, which carries `work_assignment_id` and
`requirement_occurrence_id` and points at the finished object through
`finalized_evidence_object_id`:

```
upload_intents (work_assignment_id = :assignmentId, status = 'available')
  → finalized_evidence_object_id
  → evidence_objects  (joined on (workspace_id, id))
grouped by upload_intents.requirement_occurrence_id
```

RLS is the tenancy filter, as everywhere else on this plane — no workspace id is
sent by the client.

**To verify during implementation:** that `'available'` is the only intent status
whose `finalized_evidence_object_id` is non-null and settled (the status check
constraint also carries `scan_blocked`, `orphaned_for_purge` and `expired`), and
whether any evidence can reach an assignment by a path other than an upload
intent — `relation_kind` admits `derivative` and `correction`, and a derivative
points at its source rather than at an intent.

## Error handling

- **Expired signed URL.** Not refreshed without a new authorization check —
  the doc's rule. On a failed image load the screen re-requests the route, never
  the URL. This is what makes the 60-second TTL survivable rather than hostile.
- **Revoked grant, mid-transfer.** The external stream must stop. This is the
  reason that plane streams; a test asserts a revoked grant cannot continue to
  read, not merely that a new request is refused.
- **Missing or unreadable object.** Distinguish «the row says there is an
  object, storage disagrees» from «you may not see this» — the first is a defect
  worth surfacing loudly, the second is an ordinary refusal.
- **Occurrence with no evidence** is a normal state and gets a Ukrainian empty
  line, not an error.

## Verification

Beyond the standard gate (`02-building-ui.md` §5, both builds, the app suite):

1. **The browser pass gains a seventh audit** and it is the whole loop: ПТВ
   finds a photo by assignment, issues a review link, and **a second browser
   context with no account opens that link and sees the image**. Nothing about
   this is asserted from a screenshot; the assertion is on the image's natural
   dimensions being non-zero and its bytes matching the recorded
   `content_hash` length, plus the DOM state around it.
2. **A leak test against real tables, not intent**: after a member read, no
   signed URL appears in `audit_events`, in the outbox, in any idempotency body,
   or in the captured logs. The assertion greps for the URL's own signature
   parameter, so it fails if any part of the URL is persisted anywhere.
3. **A revocation test**: revoke the grant, then assert the external stream
   refuses — and that an in-flight read cannot be continued.
4. **A TTL test**: the helper's default is 60 and a caller cannot raise it.

## Out of scope for D1

- Thumbnails or any image transformation (paid add-on; recorded).
- Video, audio and document evidence rendering. The routes serve whatever
  `media_type` the row carries; the screen renders images and lists the rest by
  filename. Rendering the others is not the ПТВ pain the scan measured.
- Typed evidence records (`typed_evidence_records`) — a different table and a
  different screen.
- Anything on the foreman's surface. `04-role-pain-map.md` is explicit: the
  dashboard's obligation to the foreman is negative.

## Recorded finding, not fixed here

**`technical/schema.sql` and the migrations describe different
`evidence_objects` tables, and the file is not what its readers assume.**

`schema.sql` has `organization_id`, `sha256`, `mime_type`, `scan_state`,
`lifecycle_state`, `assignment_id`, `work_item_id`;
`supabase/migrations/0015_execution_evidence_module.sql` has `workspace_id`,
`content_hash`, `media_type`, `inspection_status`, `storage_bucket`,
`relation_kind` and no scan or lifecycle column at all. The shipped external
route reads the migration's columns, so the migrations are what runs.

**The divergence is not itself a defect.** `technical/schema.sql`'s own first
line calls it the «AktFlow Pilot v2.9 executable reference schema» and says
«Convert to ordered reviewed migrations before runtime use» — it is a
design-time reference that the migrations were derived from, not a snapshot of
the database. A migration departing from it is the process working.

The hazard is narrower and real: **nothing in the file says which tables have
departed**, and `scripts/validate-canonical-docs.mjs` lists it among the
canonical documents, so it reads as current truth. Anyone — human or agent —
who checks a column against it for `evidence_objects` gets a confident wrong
answer, which is exactly what happened while this design was being written. The
fix is a line in the file's header naming its status and pointing at the
migrations as the runtime authority, not a rewrite of the schema. It goes to
`TODOS.md`, not into this slice.
