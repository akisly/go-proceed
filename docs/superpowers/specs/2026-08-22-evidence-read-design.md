# Evidence read — the design

**Date:** 2026-08-22
**Slice:** Plan D, D1
**Status:** approved by the owner 2026-08-22 (four decisions recorded below);
revised the same day against source, see «What research changed»
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
distinction the architecture makes deliberately. Approach C — signed URLs on
both — is now known to be impossible, not merely wrong: see the CSP finding.

## What research changed, and one thing it refuted

Four questions this design left as «verify, do not assume» were answered against
the installed packages and the running database. Recorded here rather than
silently folded in, because two of them contradict what an earlier draft of this
file asserted.

**REFUTED — «a revoked grant stops the bytes mid-transfer».** Nothing in this
repository can do that, and nothing in the plan may claim it. Revocation is
revalidated **per request**, twice over: `app.resolve_external_session` refuses a
revoked grant in the session-resolution transaction before any handler runs, and
every external RLS policy re-resolves `app.external_session_scope()`, which
repeats the same predicates, on every statement. That is genuine and sufficient
for «before». The «during» half that `files-and-storage.md` §Downloads asks for
is **not implemented anywhere** — there is no chunked read, no abort path, no
cancellation token in the repo. (The installed SDK does accept an `AbortSignal`
on `download`, so building it later is mechanically possible; it would be new
mechanism, not a consequence of choosing to stream, and it is best-effort at any
granularity — bytes already sent cannot be recalled.) The design keeps the
stream; it drops the false justification and states the real limit.

**STRENGTHENED — the external plane cannot use a signed URL at all, for a reason
that survives even if the revocation argument is disputed.** The external shell
serves `default-src 'none'; … img-src 'self' data:`
(`external-link.ts:265-284`, `img-src` on :272 — corrected 2026-08-22 from
`:248-267`, which this branch's own edits to that file moved off the header and
onto the cookie reader beside it, leaving the design's strongest argument
pointing at prose about `__Host-` cookies).
A same-origin `<img src="/external/evidence?…">` is admitted; a Supabase-hosted
signed URL is **blocked by the page's own CSP**. This is now the primary reason
that plane streams.

**CORRECTED — «there is no scan state to filter on» was literally false.**
`evidence_objects.inspection_status` exists and is `NOT NULL`. What is true is
the weaker, sufficient statement: its CHECK admits only `'passed'` and
`'not_required'`, and `finalize/route.ts` throws before any insert when the
inspection outcome is `blocked` — so a blocked object is *unrepresentable*, and
a filter would be a no-op. Say that, not «the column does not exist»; a reviewer
who greps will find the column.

**NEW AND LOAD-BEARING — an intent may legally carry no occurrence.**
`upload_intents.requirement_occurrence_id` is nullable by design:
`packages/contracts/src/uploads.ts:23` marks it optional and its own comment
calls the optionality «the fallback's only remaining door», and migration
`0043`'s FK is MATCH SIMPLE for the same reason. Every upload captured outside
the requirement flow has none. **A screen that groups by occurrence with an
inner join, a `where … is not null`, or a JS map keyed on a possibly-undefined
id silently drops those photos** — showing an assignment as having no evidence
when it has evidence, which is precisely the ПТВ pain this slice exists to end.
There is a «no occurrence» bucket, it is ordered last, and it has a Ukrainian
label.

## Architecture

### The rule that splits the two paths

`tenancy-and-security.md` §Storage RLS: «Available-object download uses a
short-lived signed URL **or** same-origin authorized stream after current access
revalidation.» Both are sanctioned; the plane decides which.

- **Member plane → signed URL.** No CSP forbids it, access need not be revocable
  mid-flight, and it keeps multi-megabyte originals off the serverless function.
- **External plane → same-origin stream.** The page's CSP admits nothing else,
  and `files-and-storage.md` prefers a stream wherever access must be revocable.

### The storage helper

`apps/app/src/lib/evidence-storage.ts` today exports `createSignedUpload`,
`putObject`, `downloadObject`, `objectSize`, `objectExists`, `removeObject` —
no signed-read helper, and no streaming read. It gains both, on the same
memoized service client.

Established against `@supabase/storage-js@2.112.3`, which is what `apps/app`
resolves through `supabase-js@2.112.3` (it is **not** a direct dependency —
importing it directly does not resolve and must not be added):

- `createSignedUrl(path, expiresIn, options?)` → `{ data: { signedUrl }, error: null }`
  or `{ data: null, error: StorageError }`. It does **not** throw for storage
  failures. Success carries `signedUrl` **only** — no path, no expiry echo.
- `createSignedUrls(paths, expiresIn, options?)` reports **per-path failures
  inline**: the call returns HTTP 200 with entries carrying `error` set and
  `signedUrl: null`. The top-level `error` is non-null only for whole-call
  failures. A batch helper must check every entry.
  - Two shape traps: each entry has both `signedURL` (server-relative) and
    `signedUrl` (absolute) — only the second is usable — and the batch form has
    no `transform` option.
- `expiresIn` is **seconds**, verified by decoding the returned token's `exp`.
  The server enforces a **lower** bound (`>= 1`) and **no upper bound** —
  `999999999` was accepted. The 60-second ceiling is therefore entirely this
  helper's own discipline; nothing below it will enforce it. The helper's
  default is its ceiling, and it does not take a value above it.
- A missing object returns HTTP **400** with a body `statusCode: "404"`. Mapping
  `error.status` straight through would turn «object gone» into a client error.
- **Do not use the `download` option for a Ukrainian filename.** In 2.112.3 the
  value is percent-encoded by `URLSearchParams` and then the whole URL is passed
  through `encodeURI`, so `%` becomes `%25` and the user saves a file literally
  named `%D1%84%D0%BE…`. The option is also appended *outside* the signature, so
  it is a UX hint and never a control. Content-disposition is set by us, on our
  own response, where we can encode it once.
- Streaming exists and does not go through a Blob: `download(path).asStream()`
  resolves to the raw `Response.body` as a `ReadableStream`. `downloadObject`'s
  buffering into a `Uint8Array` is a choice, not a limit.

### Route 1 — the member plane

```
GET /v1/assignments/{assignmentId}/evidence
capability: project.view
```

Returns the evidence bound to the assignment, grouped by requirement occurrence
**and by the no-occurrence bucket**, each object carrying `media_type`,
`byte_size`, `content_hash`, `original_filename`, `origin_method`,
`capture_time_trust`, `claimed_capture_time`, `server_received_at`, and a signed
read URL.

Authorization follows the house pattern verbatim
(`v1/assignments/[assignmentId]/requirement-occurrences/route.ts`): resolve the
assignment with no workspace predicate — RLS supplies it — read `workspace_id`
and `project_id` off that row, then `requireActiveMembership` followed by
`requireProjectCapability(..., "project.view")`. **No workspace id is ever taken
from the client.**

**`Cache-Control: no-store` is not expressible through `queryRoute` today**, and
this is the plan's first real task rather than a detail. `HandlerResult` is
`{ status, body, expiresAt? }` and `queryRoute` calls `ok(..., {})` with a
hard-coded empty header map; `ok()` already accepts an `extraHeaders` argument
that nothing fills. No member-plane GET currently sets any cache directive at
all. Either `queryRoute` grows a headers channel — the better answer, since the
next route that needs one will be along — or this route bypasses the wrapper the
way `external/review/route.ts` already does. **A missing header produces no
error; the response simply looks fine.**

### Route 2 — the external plane

```
GET /external/evidence?evidenceObjectId=…
```

Streams the object bytes, same-origin, after the session's grant is revalidated
by the resolution transaction and by the row policy.

The object is named by row id, **never by a storage key** — a caller who can
name a key can name someone else's. The id is already disclosed to the session
by `GET /external/occurrence`, so this route adds no new disclosure, only bytes
for something the session was already told exists.

**No new grant and no new policy are needed.** `eo_external_select` already
admits exactly «objects finalized from an *available* intent on this session's
one occurrence», and `storage_key`/`storage_bucket` are already selectable — the
existing route simply does not select them. This was verified positively rather
than by catalog reading: a session with a fabricated id selecting those columns
returns zero rows and **no permission error**, while `audit_events` returns
`permission denied`, so the row filter denies evidence and the grant denies
audit. The stream route selects `where id = $1` and asserts one row came back,
so a policy that ever widened fails loudly instead of serving a sibling.

**`externalQueryRoute` cannot emit bytes** — it `JSON.stringify`s and hard-codes
`application/json`, and it has no `Content-Disposition` channel. It also passes
no route params, which is why the id travels in the query string. This route
therefore builds its own `Response`, following the one existing precedent for a
route the wrappers cannot serve (`external/review/route.ts`), and **re-applies
by hand** the four headers `externalNoStore` would have given it: `no-store`,
`no-referrer`, `nosniff`, `DENY`. `nosniff` makes the `Content-Type` load-bearing
— and `media_type` is server-sniffed at finalize, not client-declared, so it is
trustworthy for exactly that use.

### Both routes are catalogued

`technical/openapi/scope-v0.1.csv` gains a row for each, and ADR-009 gains a
**dated amendment, not a rewrite** — now covering two operations rather than the
one the plan anticipated.

## The screens

### `/dash/projects/{projectId}/assignments` — the assignments list, read-only

One call to the existing `GET /v1/projects/{projectId}/assignments`. D3 adds
creation on top of this list rather than building a second one.

### `/dash/assignments/{assignmentId}` — evidence by assignment

Grouped by requirement occurrence, with the no-occurrence bucket last. Beside
each photo, exactly the facts ПТВ transcribes by hand today: server-received
time, `origin_method`, `capture_time_trust`, `content_hash`.

Beside each occurrence: **«Відправити на перевірку»** →
`POST /v1/occurrences/{occurrenceId}/grants`. INV-044 governs what follows and
the screen must not soften it: the token is returned **once**, GoProceed cannot
reconstruct or retry it, and the only recovery is an authorized
revoke-and-reissue. That is said on the face of the result, not in a tooltip.

### A cost this design accepts and names

Supabase image transformation is a paid add-on, so the dashboard loads
originals. Lazy loading and fixed containers reduce the damage; twenty photos
are still twenty multi-megabyte files. Recorded in `TODOS.md` as a named cost.

## Data flow

Evidence carries no assignment and no occurrence. The link is `upload_intents`:

```
upload_intents (work_assignment_id = :assignmentId, status = 'available')
  → finalized_evidence_object_id
  → evidence_objects   joined on (workspace_id, id)
grouped by upload_intents.requirement_occurrence_id, nulls last
```

Three facts about this join, each established rather than assumed:

- **`'available'` is the only status that can carry a finalized object — but
  nothing in the schema enforces it.** No CHECK relates the two columns; what
  holds the invariant is a revoked UPDATE grant (`0031`) and a single
  `SECURITY DEFINER` writer, `app.finalize_upload_intent`. So the filter is
  logically redundant with the join and **is still written**, because a future
  migration re-granting UPDATE would break it with nothing red. Keep both
  directions of defence: join on `finalized_evidence_object_id` *and* filter on
  status — a test fixture already exists that violates one and not the other.
- **Derivatives and corrections cannot exist today.** `relation_kind` admits
  them and `upload_intent_id` is nullable, so an intent-less derivative is
  representable — but INSERT on `evidence_objects` is revoked from the app role,
  the sole writer hardcodes `'original'`, and an immutability trigger rejects
  UPDATE and DELETE. The join drops nothing. This is a statement about the
  current database, not about a documented future contract: nothing in the repo
  says what a derivative is meant to be produced by, and `origin_method` carries
  a `generated_derivative` value with no writer anywhere.
- **`storage_bucket` is a per-row column, not a constant.** Sign against the
  row's bucket; the uniques are on `(storage_bucket, storage_key)` and
  `(workspace_id, storage_key)`.

`byte_size` is `bigint` and arrives as a string; cast `::text` and convert, the
way the shipped external route already does.

## Error handling

- **Expired signed URL.** Not refreshed without a new authorization check. On a
  failed image load the screen re-requests the route, never the URL. This is
  what makes a 60-second TTL survivable rather than hostile.
- **Revoked grant.** The next request is refused — established, twice over. An
  in-flight transfer is **not** stopped, and no test will claim it is.
- **Missing object.** Distinguish «the row says there is an object, storage
  disagrees» from «you may not see this». Remember that storage reports the
  first as HTTP 400.
- **Occurrence with no evidence**, and **evidence with no occurrence**, are both
  normal states with Ukrainian copy, not errors.

## Verification

Beyond the standard gate (`02-building-ui.md` §5, both builds, the app suite):

1. **The browser pass gains a seventh audit**, and it is the whole loop: ПТВ
   finds a photo by assignment, issues a review link, and **a second browser
   context with no account opens that link and sees the image**. Asserted on the
   image's natural dimensions being non-zero and on the DOM around it — never on
   a screenshot looking right.
2. **A leak test with a caveat that must be stated, not hidden.** After a member
   read, no signed URL appears in `audit_events`, in `transaction_outbox`, or in
   any idempotency body — those are real tables and the assertion is real.
   «Never in logs» **cannot be asserted today, because there is no application
   logging at all**: three `console.error` calls exist in the whole app, all on
   error paths. The rule still binds every future line, and the nearest house
   style is a hazard — every function in `evidence-storage.ts` interpolates the
   raw storage key into its thrown error message, and those reach
   `console.error` through the unmapped-error branch. The new helpers must not
   copy that style, and the existing leak goes to `TODOS.md`.
3. **A revocation test**: revoke the grant, then assert the next external
   request is refused. Not an in-flight test — that guarantee does not exist.
4. **A TTL test**: the helper's default is 60 seconds and a caller cannot raise
   it. This is the only thing standing between us and a 31-year URL.
5. **A null-occurrence test**: an assignment carrying one occurrence-bound photo
   and one fallback photo shows **both**.

## Out of scope for D1

- Thumbnails or any image transformation (paid add-on; recorded).
- Video, audio and document rendering. The routes serve whatever `media_type`
  the row carries; the screen renders images and lists the rest by filename.
- Typed evidence records (`typed_evidence_records`) — a different table, a
  different screen.
- Aborting an in-flight external transfer on revocation. Named, not built.
- Anything on the foreman's surface. `04-role-pain-map.md` is explicit: the
  dashboard's obligation to the foreman is negative.

## Recorded findings, not fixed here

**`technical/schema.sql` reads as current truth and is a design-time
reference.** Its own first line says «AktFlow Pilot v2.9 executable reference
schema. Convert to ordered reviewed migrations before runtime use» — the design
the migrations were derived from. A migration departing from it is the process
working. The hazard is that nothing says *which* tables departed while
`validate-canonical-docs.mjs` lists it among the canonical documents;
`evidence_objects` is the worst case found, and it bit this design before the
migration was read. Filed in `TODOS.md`; the fix is a header, not a rewrite.

**`evidence-storage.ts` puts raw storage keys in error messages** that reach
`console.error`. `files-and-storage.md` says logs record the domain object and
the authorization result, never the raw storage key. Filed in `TODOS.md`.

**Migration text still says `aktflow_app` / `aktflow_service`** where the live
roles are `goproceed_app` / `goproceed_service` / `goproceed_worker` (renamed
around `0057`). Nothing new may copy the old names.
