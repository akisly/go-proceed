# ADR-009: Three pilot surfaces, separately deployed

**Status:** Approved

**Applies to:** v0.1 and v0.3

**Last reviewed:** 2026-08-20

**Amended:** 2026-08-22 and 2026-08-28 — see «Amendment, 2026-08-22» and
«Amendment, 2026-08-28» at the end of this document. The original text above
them is unchanged.

**Related decisions:** [ADR-001](ADR-001-product-boundary.md),
[ADR-004](ADR-004-roadmap-demo-and-documentation.md),
[ADR-006](ADR-006-pilot-shaped-v0.1.md), [ADR-007](ADR-007-pilot-field-client.md)

> **Authority.** The owner's decision of 2026-08-20, taken after the reversal
> costs below were presented twice and accepted. This ADR amends
> [ADR-007](ADR-007-pilot-field-client.md) decision 1 for the same kind of
> reason ADR-007 amended ADR-004: the earlier boundary was correct when it was
> drawn, and the ground under it moved.

## Context

What existed on 2026-08-20, before this decision:

- `apps/landing` was built — a Next.js marketing app of nine tracked files —
  and undeployed: no `apps/landing/vercel.json`, no second Vercel project, no
  live origin.
- `apps/app` was the `/v1` BFF plus a two-page field PWA
  ([ADR-007](ADR-007-pilot-field-client.md) decision 1), live at
  `goproceed-app.vercel.app` and, per `TODOS.md`'s closed P0/P1 entries for
  that origin and its OTP delivery, actually reachable and actually able to
  sign a foreman in.
- `apps/mobile` was the four-file Expo route/screen skeleton
  ([ADR-007](ADR-007-pilot-field-client.md) §"What apps/mobile actually
  contains": `_layout.tsx`, `index.tsx`, `token-proof.tsx`, plus the generated
  `status-labels.ts`) inside a 22-file tracked workspace of config and assets,
  with no camera or image-picker dependency and no capture code — removed from
  the v0.1 path by ADR-007 decision 2 and held there as the future v0.3 native
  client.

The owner reviewed this shape — a marketing site nobody can reach, a pilot
field client living inside the product's own web app with no domain of its
own, and a native-client workspace doing nothing — and made the four decisions
below, having been shown the reversal costs twice.

## Decision

The owner's decisions of 2026-08-20, recorded verbatim from the implementation
plan's Decision record:

1. **Three pilot surfaces, separately deployed:** landing site; the system
   («дашборд») = `/v1` BFF + office UI-minimum; the field client
   («моб приложение») for the person taking photos.
2. **The field client's codebase is `apps/mobile` (Expo), shipped as Expo-web
   for the pilot** — chosen over (a) keeping the PWA as-is with its own domain
   and (b) extracting a separate Next app. Native phones come later from the
   same codebase.
3. **Dashboard pilot scope is UI-minimum:** the screens without which the
   owner cannot run the pilot without curl — create workspace/project + access
   grants; create assignment; view photo evidence. Not the full register.
4. **Landing deploys now** as a second Vercel project, on `*.vercel.app` until
   the domain decision.

### Relationship to ADR-007

This ADR amends [ADR-007](ADR-007-pilot-field-client.md) decision 1 outright:
«the v0.1 field client is a PWA served from `apps/app`» stops being the
client's destination and becomes a **transitional state** — true, and the
working pilot client, until the parity gate below is measured. ADR-007's §1
carries the pointer to this document, appended under its existing text rather
than rewritten, per this repository's own rule that a correction is a dated
addition, never a rewrite.

Decisions 2 and 3 of ADR-007 are **strengthened, not amended**. Decision 2
held that `apps/mobile` "is not dead code and not a v0.1 deliverable" — the
starting point for v0.3 native work and nothing sooner. That workspace is
given a job sooner than v0.3 by this decision, as the pilot's field-client
codebase shipped Expo-web; its identity as the native path's codebase does not
change, only its schedule. Decision 3 — "the API and the domain are unchanged,
so the client is replaceable" — is exactly what makes this move affordable:
moving the field client from a browser page to Expo-web costs no migration,
because both speak the same `/v1` contract. `apps/app/src/lib/auth.ts` already
gives an inbound `Authorization: Bearer` token priority over the cookie
session, with its own comment naming "mobile" among the callers that priority
is for. This decision is the first time that replaceability is exercised
rather than only argued for.

## Known costs, accepted

Presented to the owner twice before this decision, and accepted both times:

- **Login, list, capture and receipt are rebuilt in React Native.** Nothing in
  the PWA's implementation transfers; the Expo-web client is a second
  implementation of the same screens against the same `/v1` contract.
- **Expo-web's camera is still the browser API.** Running Expo for web does
  not grant native camera access; [ADR-007](ADR-007-pilot-field-client.md)
  Cost 1 (capture provenance — the `capture` attribute is a hint, not a
  guarantee, and a browser may strip or re-encode image metadata before the
  page ever sees the bytes) and Cost 2 (iOS evicts script-writable site
  storage after roughly seven days, so a pending original is not durable)
  apply to the Expo-web build exactly as they applied to the `apps/app` PWA,
  until the client is built and shipped native. Native capture measurement —
  and any provenance claim stronger than ADR-007 decision 5 allows — stays
  v0.3, as ADR-007 already held.
- **The store distribution chain stays deferred.** The Apple Developer
  Program membership, Google Play Console account, funded Expo build
  minutes, UDID registration, and TestFlight/Play internal-testing review
  latency that ADR-007's Context table priced out are not entered by this
  decision. Expo-web needs none of it; only the eventual native build will.

## The parity gate

`apps/app`'s field pages retire **only after** the Expo-web client passes a
parity checklist that **already exists** —
`infra/README-staging.md` §"6. End-to-end verification checklist", item 9
(OTP login, the assignment screen's disclaimer and control-size checks,
capture → receipt), plus INV-081
(`technical/database/invariant-catalog.csv:82`) — applied **verbatim** to the
new client by the follow-up plan `2026-08-20-expo-field-client.md`, which
authors no new checklist. Passing is a measurement taken on hardware, not a
code review, and it is taken on the same **two physical phones** ADR-007's
Context table already required and this decision does not remove. Until it
happens, `apps/app`'s PWA is the pilot's only working field client and stays
deployed. No task in any of the three follow-up plans
(`2026-08-20-v1-cors-bearer.md`, `2026-08-20-expo-field-client.md`,
`2026-08-XX-dashboard-ui-minimum.md`) removes it before that gate is measured.

## Consequences

- **Three Vercel projects, not one.** `apps/app` (existing), `apps/landing`
  (new — this plan), and, once the Expo-web follow-up plan ships, a third
  project serving the Expo-web export. Each deploys, builds and ignores
  independently via its own `vercel.json` and `turbo-ignore` filter.
- **Three hostnames enter the domain decision.** Today `infra/README-staging.md`
  §0 carries two placeholder tokens, `{{APP_HOSTNAME}}` and
  `{{LANDING_HOSTNAME}}`; a third — the field client's — joins them once its
  Vercel project exists. All three stay on `*.vercel.app` until the domain
  decision is taken; no literal hostname is invented here.
- **`/v1` gains a cross-origin caller.** The Expo-web export is served from a
  different origin than `apps/app`, so the BFF needs CORS and a bearer-friendly
  path it does not yet expose at the edge — scoped to the follow-up plan
  `2026-08-20-v1-cors-bearer.md`, not built by this decision.
- **The pilot is never blocked.** At every point between this decision and the
  parity gate being measured, a foreman has a working client: the `apps/app`
  PWA, unchanged and deployed. This ADR adds a second client in parallel; it
  does not take the first one away before its replacement is proven on
  hardware.
- **`apps/landing` stops costing nothing for being unreachable.** Once
  deployed, the landing site is a real second surface with its own build,
  deploy and ignore path — the first entry in `README.md`'s "Product
  surfaces" section that is not also a claim about `apps/app`.
- **Documentation debt: six files still describe `apps/mobile` as v0.3 / not on the v0.1 path.** Recorded 2026-08-20: `docs/domain/glossary.md:123`, `docs/product/roadmap.md`, `docs/product/vision-and-positioning.md`, `docs/product/personas-and-workflows.md`, `docs/delivery/test-strategy.md`, `docs/domain/execution-and-evidence.md` read true for the ADR-007 era and will be updated (not silently rewritten) as Plans B–D land.

## Replacement rule

Reverting to a single deployed surface, or moving the field client back into
`apps/app` before the parity gate is measured, requires a superseding ADR:
either move undoes decision 1's separately-deployable-surface argument, and
the second additionally spends decision 3's client-agnostic boundary — the
property this ADR exercises — without re-deriving it.


---

## Amendment, 2026-08-22 — D1 adds two catalogued read operations, and the two planes deliver bytes differently

*An addition. Nothing above this line is rewritten; decisions 1–4 and their
consequences stand exactly as the owner took them on 2026-08-20.*

### What this amendment records

Plan D slice D1 («evidence read») adds **two** operations to
[`technical/openapi/scope-v0.1.csv`](../../technical/openapi/scope-v0.1.csv),
both reads, both tagged `v0.1-M6`:

| Operation | Path | Plane | Capability | How bytes arrive |
|---|---|---|---|---|
| `evidence.list` | `GET /v1/assignments/{assignmentId}/evidence` | member | `project.view` | a short-lived **signed URL** per object (TTL 60 s) |
| `external.evidence_bytes` | `GET /external/evidence?evidenceObjectId=…` | external | `external.view_scope` | a same-origin **stream** through the BFF |

### Why the «no new API» rule bends, and exactly how far

Decision 3 scopes the dashboard pilot to **screens** — «the screens without
which the owner cannot run the pilot without curl». The plan that implements it
read that as a standing rule: reads go through the existing `/v1`, and a new
operation needs the owner's word. The owner gave it on 2026-08-21 for the member
read, and D1's design of 2026-08-22 found the second, larger reason the rule has
to bend — one that is not about the dashboard at all.

**`apps/app/app/external/occurrence/route.ts` had already recorded the gap
against itself**, as the largest functional gap `v0.1-M5` left, in its own
header: the M5 acceptance walk says технагляд reads the requirement in the
standard's own wording **with the photo**, and that route returns the
requirement, the photo's identity, size, media type, SHA-256 and provenance —
and not the photo. Its own conclusion: «a reviewer who cannot see the photo will
not accept, and that is the acceptance walk failing for a buildable reason.» It
declined to close it «with a seventh operation nobody catalogued».

So the exception is narrow and it is the opposite of an escape hatch:

- It is **two operations, both reads**, both catalogued in the same file every
  other operation is catalogued in, both governed by a capability row in
  [`technical/permissions/capabilities.csv`](../../technical/permissions/capabilities.csv),
  and both counted in
  [`docs/delivery/version-0.1.md`](../delivery/version-0.1.md)'s
  operations-per-milestone table. Nothing is «added quietly beside the API».
- **No new grant, no new RLS policy, no migration.** `eo_external_select`
  (migration 0049 §10) already admitted exactly «objects finalized from an
  *available* intent on this session's one occurrence», and `storage_key` /
  `storage_bucket` were already selectable — the shipped route simply never
  selected them. Verified positively rather than by catalog reading: an external
  session selecting those columns returns zero rows and **no permission error**,
  while the same session touching `audit_events` returns `permission denied`.
  The authorization surface is unchanged by this amendment; only the API surface
  grows.
- **No new external capability, and one was not available anyway.** Migration
  0049's `external_access_grants_permissions_check` pins the grant's permissions
  jsonb to exactly `external.view_scope` and `external.decide_evidence`, so a
  third external capability id would be a migration and a contract change rather
  than a catalog edit. `external.evidence_bytes` therefore joins
  `external.view_scope`, which is also the right grouping on its own terms: a
  grant that may read the requirement and the photo's hash but not the photo
  cannot complete the walk it exists for.
- **The rule itself is not repealed.** Slices D2–D3 add screens over existing
  `/v1` operations and no new ones. If a later slice needs a third, it needs its
  own dated amendment here — this one authorises these two and nothing else.

### Why the member plane signs and the external plane streams

`docs/architecture/tenancy-and-security.md` §"Storage RLS" sanctions **both**:
«Available-object download uses a short-lived signed URL **or** same-origin
authorized stream after current access revalidation.» The plane picks, and for
the external plane the pick was already made by a header this repository has
been sending since M5.

**The external review page's own CSP forbids a signed URL.**
`apps/app/src/lib/external-link.ts`'s `externalSecurityHeaders` serves the shell
with `default-src 'none'; … img-src 'self' data:`. A same-origin
`<img src="/external/evidence?…">` is admitted; a Supabase-hosted signed URL is
**blocked by the page's own policy** before a byte is requested. Streaming on
this plane is not a preference between two workable options — it is the only one
that works, and relaxing the CSP to admit a provider origin would spend the
property that makes the shell defensible (no third-party script, frame, font,
image, analytics or error collector can load at all, so none can receive a
token-bearing URL).

The member plane has no such constraint, and signing there keeps multi-megabyte
originals off the serverless function.

### What is deliberately NOT claimed by this amendment

**A revoked grant does not stop a transfer already in flight.** Revocation is
revalidated **per request**, twice over — `app.resolve_external_session` refuses
a revoked grant before the handler runs, and every external policy re-resolves
`app.external_session_scope()` at statement time inside the handler's
transaction. That is genuine and it is «before». The «during» half that
`docs/architecture/files-and-storage.md` §Downloads asks for is **implemented
nowhere in this repository**: no chunked re-check, no abort path, no
cancellation token. Choosing a stream did not buy it, no test asserts it, and it
would be new mechanism — best-effort at any granularity, because bytes already
sent cannot be recalled.

**Streaming behaviour on Vercel's Node runtime is not established.**
`external.evidence_bytes` is the first streaming response and the first non-JSON
route on either plane in this codebase, so there is no deployed evidence that
the platform passes it through without buffering. Correctness is identical
either way; only memory behaviour differs. Recorded here rather than asserted.

### Consequence for decision 3

Decision 3's list — «create workspace/project + access grants; create
assignment; view photo evidence» — now has a **second** reading of its third
item, and both are in scope: ПТВ views photo evidence in the dashboard, and the
external технагляд views it in the review page with no account. The second was
the product thesis all along; until this slice it was the one part of the thesis
the software could not perform.

---

## Amendment, 2026-08-28 — decision 3 authorises «create assignment» and not the baseline it stands on; the manual chain earns screens, import and КБ-2в do not

**The original is unchanged.** Decision 3's sentence stands word for word,
«Not the full register» included. This amendment answers a question the
original did not: which side of that line the manual contract-baseline chain
falls on. The implementation ran into it, so it is settled here rather than in
a commit message.

### What forced the question

Decision 3 puts **create assignment** inside the dashboard's pilot scope.
Measured against the tree on 2026-08-28, no screen can create one until a
published contract version exists to take a line from: `createAssignmentRequest`
requires exactly one field, `workItemId`
(`packages/contracts/src/assignments.ts:6-12`), and a work item belongs to a
contract version that must already be published. Reaching that state from an
empty workspace is fourteen command calls over thirteen distinct operations —
`baselineFixture` (`apps/app/tests/helpers/fixtures.ts:102-146`) spends seven of
them before a contract can be created at all, and its eighth is the contract.
It also reads the caller's own `memberId` out of `public.memberships` by SQL,
because the access-grant step needs one and no read on the member plane returns
it.

So decision 3 as written authorises a screen whose precondition it does not
authorise. The owner has been meeting that precondition with curl and SQL,
which is the exact state the decision's own words — «the screens without which
the owner cannot run the pilot without curl» — were written to end.

### What this amendment authorises

**The manual contract-baseline chain may carry screens, as an operability
surface.** Named, so the authorisation cannot creep: `parties.create`,
`parties.legal_profile.put`, `parties.own_profile.create`, `contracts.create`,
`requirement_rule_versions.publish`, `contract_versions.create`,
`work_items.create`, `contract_versions.bind_rules`,
`contract_versions.publish`, `assignments.create`, and the
`project_access.grant` step the chain silently requires — `project.admin`
implies only `project.view` and `readiness.view`
(`apps/app/src/lib/authz.ts:98`), so a member who created the project still
gets 403 on `contracts.create` until that grant exists.

### What stays outside — and this is the line decision 3 was drawing

**Import batches, КБ-2в and packages get no screen.** `import_batches.create`,
`import_files.add`, `import_batches.validate`, `import_batches.get`,
`import_resolutions.create` and `import_batches.publish` are shipped operations
(`technical/openapi/scope-v0.1.csv:23-28`) and stay API-only. They are «the full
register» the clause was written against: the surface that would make this a
кошторис application, and the one whose demand is unvalidated — assumption A-6
is still open and this repository has still never read one real sanitized
кошторис.

The distinction is not a technicality. The manual chain types the minimum a
baseline needs in order to exist; the register reconciles a document somebody
else produced.

### Whom these screens serve, and how that is checked

**The owner or a workspace admin standing up a pilot — not ПТВ.** They rest on
decision 3's operability clause, not on a pain the demand scan measured.
[`docs/design/04-role-pain-map.md`](../design/04-role-pain-map.md) records them
in a category of their own for that reason and states in terms that no scan
sentence supports them.

That cuts both ways, and both halves are binding: the bar is lower — these
screens are not owed the workflow polish a ПТВ screen is owed — and it is
different, because operability is falsifiable where polish is not. **The
acceptance criterion for every slice that follows:** a person holding only a
browser and an email address creates a workspace, a project, two parties, a
contract, a published baseline carrying at least one typed line, and one
assignment, with no curl, no psql and no SQL.

### What is deliberately NOT claimed

**No demand evidence.** Claim 4 of the demand scan — «a named buyer will adopt
and pay» — is still unsupported and nothing here moves it. A screen justified by
operability earns its place by taking curl out of the owner's hands and by
nothing else.

**No requirement-authoring screen.**
[ADR-010](ADR-010-project-sourced-requirements.md)'s prohibition stands. Its
dated correction of the same date records what the arrival of a
`requirement_rule_versions.publish` screen does to its reasoning — it retires
one of that bullet's three grounds and leaves the other two carrying it.

**No new API operation.** This amendment authorises screens over operations
that already exist. The reads those screens will need are a separate question
with its own dated amendment when it is answered; the «no new API» rule bends
only where an amendment says it bends, and this one bends it nowhere.
