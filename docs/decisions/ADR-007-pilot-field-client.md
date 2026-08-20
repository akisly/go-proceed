# ADR-007: The pilot field client is a PWA

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-08-06

**Related decisions:** [ADR-001](ADR-001-product-boundary.md),
[ADR-003](ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](ADR-004-roadmap-demo-and-documentation.md),
[ADR-005](ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](ADR-006-pilot-shaped-v0.1.md),
[ADR-009](ADR-009-three-pilot-surfaces.md)

> **Amendment note.** This ADR amends
> [ADR-004](ADR-004-roadmap-demo-and-documentation.md) on exactly one sentence
> and reverses it. **As approved on 2026-08-06**, ADR-004 read: «Online mobile
> use is included in v0.1 as a separate native client, **not a responsive-web
> substitute**.» For v0.1 that is wrong, and this document is the record of the
> reversal and of what it costs.
>
> *(Citation corrected 2026-08-11. That quotation was written in the present
> tense against `ADR-004:70-71`, and the correction owed by the first row of
> §"Corrections owed" below has since landed — so the quoted sentence is no
> longer what those lines say, and an Approved ADR was misquoting the document
> it amends. The paragraph as it now stands is `ADR-004:70-78`; it states the
> v0.3 boundary and points back here. Line numbers in this document are a
> reading aid and go stale by design as the corrections owed are made; the
> quoted text above is historical and should be read as such.)*
>
> Everything else in ADR-004 stands, including the v0.3 offline boundary at
> `ADR-004:90-94`. ADR-001, ADR-002 and ADR-003 are untouched: this decision
> changes the client, not the domain, not the API, and not the gate.
>
> **ADR-005 is touched on one clause, and saying otherwise would be false.** Its
> §"Untouched" list carries «the separate online-only Expo/React Native field
> client» as part of the v0.1 boundary it leaves alone. Decisions 1–2 below
> replace exactly that item for v0.1 and nothing else in ADR-005: the gate, the
> refusals, the predicate, the blocked-reason object and every decision of ADR-005
> stand unaltered.
>
> **Relationship to [ADR-006](ADR-006-pilot-shaped-v0.1.md).** Both were decided
> on 2026-08-06 and neither depends on the other. ADR-006 fixes **what** v0.1 is —
> six steps, of which step 2 is the field client — and this ADR fixes **which
> client** step 2 is written in. Where this document says "v0.1", the contents of
> v0.1 are ADR-006's decision 1 and decision 4, not the pre-re-cut list.
>
> **Authority, and a rule this ADR had to clear.** The owner proposed this on
> 2026-08-06 and accepted it. That instruction is the authority for this ADR and
> the only one.
>
> The point matters more here than usual.
> [`validated-assumptions.md`](../discovery/validated-assumptions.md) §"What this would change if it were validated"
> records the founder-reported Telegram signal of 2026-08-05 — unnamed companies,
> no dates, no notes, zero customer documents — and then rules that until `A-8`
> leaves `Unvalidated` it «must not drive a capture-UX decision, a roadmap change,
> or a positioning sentence». **This ADR is a capture-UX decision**, so that
> prohibition is directly in its path and it is complied with rather than
> reasoned around: the founder report is cited below only to say where the
> Telegram comparison is written down, never as a reason for anything. `A-4` —
> «Field crews will capture evidence through a mobile client at the moment of
> work» — is still **Unvalidated**
> ([`validated-assumptions.md`](../discovery/validated-assumptions.md) §"Assumption ledger", row A-4), and
> this decision does not improve its status by an inch.
>
> **Approved is not deployed.** Nothing in this document exists in the runtime.
> The repository baseline is 33 tables plus migrations `0036`–`0040`, which
> create no table; none of the ADR-005 gate exists; and
> `upload_intents.requirement_occurrence_id` is still a placeholder column with
> its foreign key deferred
> (`supabase/migrations/0015_execution_evidence_module.sql:251`). There is not
> yet an obligation for any client to capture against. No baseline state, test
> count, or green-suite claim is made here.
>
> *(Qualified 2026-08-08 — «deployed» and «written» have come apart, and every sentence above
> is about the first. All of it is still exactly true of the **applied** migrations, `0001`–`0040`,
> which define 33 tables. Migrations `0041`–`0050` are ten files written on an uncommitted branch and
> **applied nowhere**; between them they carry `create table` for **seventeen of the twenty-six** v0.1
> tables, plus every CHECK, trigger, policy and grant the readiness gate is made of. Having DDL is not
> existing, and none of the ten files has ever been executed.)*
>
> **«There is not yet an obligation for any client to capture against» has
> changed, 2026-08-08.** Migration `0050` gives the work line a `work_type_key`,
> so a hand-typed baseline materialises requirement occurrences and the field
> client has something to show. Written, not applied — and an **imported**
> baseline still materialises nothing.

## Context

> **How to read the citations below.** This Context describes the package **as it
> stood on 2026-08-06, before this decision landed**. Several of the documents it
> cites were rewritten against this ADR the same day, so their line numbers no
> longer resolve to the quoted text; where that has happened the citation names
> the section instead. **No row of the table below is a claim about the present
> state of any document** — it is the chain this decision was made against.

### The current design puts a procurement chain in front of one photo

To hand a foreman the approved v0.1 client, the canonical package required all
of the following **before** the milestone could be entered or closed:

| Requirement | Where it was stated on 2026-08-06 | Status on 2026-08-06 |
|---|---|---|
| An actual pilot-device inventory confirming the iOS 16.4+ / Android 10+ floor, before capture UX is frozen | [`roadmap.md`](../product/roadmap.md) M2 entry evidence, [`ADR-004:80-84`](ADR-004-roadmap-demo-and-documentation.md), [`scope-and-boundaries.md`](../product/scope-and-boundaries.md) §"M2 — The phone" | Did not exist — [`roadmap.md`](../product/roadmap.md) §"Entry-evidence status as of 2026-08-06", [`TODOS.md:334-342`](../../TODOS.md) |
| One physical supported iPhone and one lower-resource physical Android device for acceptance testing | [`roadmap.md`](../product/roadmap.md) M2 entry evidence | Recorded as **unprocured** — [`TODOS.md:342`](../../TODOS.md) |
| An Apple Developer Program membership, a Google Play Console account, and a funded Expo plan with build minutes | [`2026-08-01-b0-procurement.md:66-75`](../superpowers/plans/evidence/2026-08-01-b0-procurement.md) | «none of the three exists yet»; organisational Apple enrolment additionally needs a D-U-N-S number |
| The test iPhone's UDID registered under that membership before an internal-distribution build will install on it | [`TODOS.md:357-361`](../../TODOS.md) | Not started |
| EAS internal preview builds installing on both platforms, and pilot distribution ready through TestFlight and the Google Play internal-testing track | [`roadmap.md`](../product/roadmap.md) M2 exit gates, [`ADR-004:86-88`](ADR-004-roadmap-demo-and-documentation.md), [`system-overview.md`](../architecture/system-overview.md) §"Deployment and secret rules", [`scope-and-boundaries.md`](../product/scope-and-boundaries.md) §"Offline and device operation" | Not started, and [`version-0.1.md`](../delivery/version-0.1.md) §"v0.1-M2 — The phone" made EAS internal build installation on both platforms part of M2's **closing evidence** |

The device-install step has never been performed at all: no EAS command has ever
successfully resolved `apps/mobile/eas.json`, and the build profiles in it were
verified by reading them against the documented schema rather than by an
execution
([`2026-08-01-b0-procurement.md:31-63`](../superpowers/plans/evidence/2026-08-01-b0-procurement.md)).

A browser page removes that entire chain. It needs an HTTPS origin, which the
product already requires for `apps/app`.

### What `apps/mobile` actually contains

`apps/mobile` is a committed pnpm workspace of 22 tracked files on Expo SDK
57.0.9 ([`system-overview.md`](../architecture/system-overview.md) §"Current repository baseline"). Its
whole route table is `apps/mobile/src/app/_layout.tsx` (14 lines) and
`apps/mobile/src/app/index.tsx` (8 lines), and the one screen they render is
`apps/mobile/src/screens/token-proof.tsx`, whose stated purpose is to make two
generated artifacts fail visibly on a device. `apps/mobile/package.json`
declares no camera and no image-picker dependency. **No capture code exists in
it.** `apps/mobile/app.json` registers the `goproceed` custom scheme, which is
the one deep-linking mechanism that is real
([`system-overview.md`](../architecture/system-overview.md) §"Field-client links").

So the question this ADR answers is not «rewrite the field client or keep it».
It is «which client do we write the capture screen in», and that question is
open because the capture screen has not been written in either.

### The owner's constraint on the interaction

The binding constraint the owner set is that capture must take **fewer actions
than sending a photo to a Telegram group**. A PWA has no install step at all —
a link opens the capture screen. That is the strongest available answer to the
constraint, and it is the whole argument for this decision.

The Telegram incumbent is recorded as `A-8` in
[`validated-assumptions.md`](../discovery/validated-assumptions.md) §"Assumption ledger", row A-8 with the
evidence kind **founder-reported** and the status **Unvalidated**, and the
sentence «the product's first job is to be easier for a foreman than sending a
photo to a group chat» is written at
[`validated-assumptions.md`](../discovery/validated-assumptions.md) §"What this would change if it were validated" as
something that **would** follow **if** the signal were validated — held back
deliberately, by the same paragraph that forbids it from driving a capture-UX
decision. It is named here because the owner's constraint refers to it, not as
evidence for it. If the owner had not given this instruction, that record alone
would not have been enough to move anything, and it still is not.

### Iteration speed

A pilot iterates daily. Store review does not, and neither does a distribution
chain whose first link is a D-U-N-S registration. Over a pilot that exists to
find out whether a foreman will read a requirement before covering a stage, the
difference between «push and reload» and «build, submit, wait, ask every tester
to update» is the difference between learning and not learning.

## Decision

### 1. The v0.1 field client is a PWA served from `apps/app`

It is an authenticated member surface behind the same BFF boundary that the web
product already uses
([`system-overview.md`](../architecture/system-overview.md) §"One backend for
every client"): the server
authenticates the subject, resolves membership, project access and permission,
and executes one bounded transaction. The client trusts nothing it holds.

This does **not** merge the field client with the protected external review
shell. That shell keeps its own discipline unchanged — fragment-only delivery,
POST exchange, short session, no account
([`system-overview.md`](../architecture/system-overview.md) §"Protected external
review") — and the
rule that it is never routed into a native client
([`system-overview.md`](../architecture/system-overview.md) §"Field-client
links") is simply
not engaged by v0.1, because v0.1 has no native client on its path.

> **Amended 2026-08-20 by [ADR-009](ADR-009-three-pilot-surfaces.md):** the
> field client's codebase moves to apps/mobile (Expo, web-first); this section
> remains the accurate record of v0.1 as shipped, and the PWA it describes
> stays in service until ADR-009's parity gate is measured.

### 2. `apps/mobile` is not deleted, and is not on the v0.1 path

The workspace stays in the tree, on Expo SDK 57.0.9, with its scheme registered
and its token-proof screen intact. It is removed from the v0.1 milestone
outcome, the v0.1 entry evidence, and the v0.1 closing evidence. It is the
starting point for the v0.3 work described in decision 8, not dead code and not
a v0.1 deliverable.

> **Amended 2026-08-20 by [ADR-009](ADR-009-three-pilot-surfaces.md):** the
> schedule moved — apps/mobile becomes the field client's codebase now (Expo,
> web-first for the pilot); this section's record of the v0.1 decision stands
> as written.

### 3. The API and the domain are unchanged, so the client is replaceable

Nothing below the client moves:

- the upload protocol
  ([`execution-and-evidence.md`](../domain/execution-and-evidence.md) §"Upload protocol") —
  client-computed hash and size, bounded idempotency key, whole-original upload
  to an intent-bound staging key, finalization verifying size and hash inside
  the committing transaction, `upload_received` never meaning
  `evidence_available`;
- the evidence identity and provenance record
  ([`execution-and-evidence.md`](../domain/execution-and-evidence.md) §"Evidence identity and provenance");
- the readiness predicate, the blocked-reason object, and every refusal in
  [ADR-005](ADR-005-readiness-gate-and-hidden-works.md);
- the ADR-005 sub-rule that the gate never refuses to record a fact.

The client is a consumer of those contracts and holds no authority of its own.
That is what makes this decision reversible in decision 9 without a migration.

### 4. What the PWA must do in v0.1

Exactly one of the owner's six pilot steps lives in it —
step 2, «The phone» ([ADR-006](ADR-006-pilot-shaped-v0.1.md) decision 1) — and it
is two obligations:

- **show the foreman what must be photographed before covering**, in the
  standard's own wording, with a reference image, before work starts — the
  advance-notice requirement of
  [ADR-005 decision 2](ADR-005-readiness-gate-and-hidden-works.md), restated at
  [`roadmap.md`](../product/roadmap.md) §"v0.1-M2 — The phone", which a
  placeholder appearing after the stage is covered does not satisfy;
- **take the photo.** One interaction.

Every regulatory string it renders is governed, without exception, by
[hidden-works-content-rules.md](../product/hidden-works-content-rules.md). This
ADR asserts no normative content, names no Додаток В field, and adds no Додаток Н
item. The provenance labels decided below are **product claims about our own
capture path**, not normative citations, and nothing in this document may be
read as adding a row to that document's allow-list.

### 5. What v0.1 may claim about a captured photo — and what it may not

**May not be claimed, in the UI, in a package, in a demo, or in a sales
sentence:**

- camera-only capture for blocking requirements;
- that a photo is distinguishable as camera-taken rather than gallery-supplied;
- tamper-evident provenance;
- verified capture-time GPS.

**May be claimed, and is all that may be claimed:**

- a **client-computed content hash**, verified at finalization against the bytes
  the server received
  ([`execution-and-evidence.md`](../domain/execution-and-evidence.md) §"Upload protocol").
  It proves the object was not altered between declaration and receipt. It
  proves nothing about where the bytes came from;
- a **server receipt time**, generated by the server and never by the client
  ([`execution-and-evidence.md`](../domain/execution-and-evidence.md) §"Evidence identity and provenance");
- a **device-claimed capture time**, stored beside the server time and
  **explicitly labelled untrusted**, exactly as the domain already requires —
  «Claimed device time is not authorization proof. Server receipt is not proof
  of when the photo was taken»
  ([`execution-and-evidence.md`](../domain/execution-and-evidence.md) §"Evidence identity and provenance").

Consequence for the evidence record: `origin method` enumerates «native camera,
photo picker, file picker, form, import, or generated derivative»
([`execution-and-evidence.md`](../domain/execution-and-evidence.md) §"Evidence identity and provenance"). No
object captured through the PWA may be recorded with a value that asserts a
native camera session. The domain layer must carry a value that says the origin
is **not distinguished**; this ADR states the requirement and deliberately does
not invent the token, which belongs to
[execution-and-evidence.md](../domain/execution-and-evidence.md) and the state
and entity catalogs.

Reasoning is in [Cost 1](#cost-1--capture-provenance-degrades-and-a-named-asset-is-withdrawn).

### 6. Pending originals are not durable, and the client says so

v0.1 capture is **online-only**, which the package already required for a
different reason — «no new offline capture begins when current authorization
cannot be checked»
([`execution-and-evidence.md`](../domain/execution-and-evidence.md) §"Native online capture — v0.3",
[`ADR-004:90-94`](ADR-004-roadmap-demo-and-documentation.md)) — and in addition
a **pending original must not be relied on as durable**, which is new here. The
client therefore:

- **never reports success before the receipt.** `upload_received` is not
  `evidence_available`
  ([`execution-and-evidence.md`](../domain/execution-and-evidence.md) §"Upload protocol"),
  and no screen may show a photo as recorded until the `available` receipt is
  persisted;
- **uploads immediately** rather than presenting a durable local queue, and does
  not offer a queue affordance it cannot honour;
- **warns rather than silently losing bytes.** If an upload cannot complete, or
  the page is about to be left with an in-flight or unsent original, the user is
  told plainly that GoProceed has not saved the photo and that it must be
  retaken or kept by them. A silent loss is the one outcome this decision must
  not produce;
- keeps the six client-state labels the PWA path actually has — `not_sent`,
  `sending`, `awaiting_receipt`, `server_confirmed`, `failed` and `discarded` —
  in [`technical/copy-catalog.csv:87-91`](../../technical/copy-catalog.csv) and
  [`technical/states/state-catalog.csv:38-42,44`](../../technical/states/state-catalog.csv),
  because a user still needs to tell not-sent from sending from confirmed from
  failed. Two corrections come with that count, and neither is optional:
  `copy-catalog.csv` has **no `discarded` row and owes one**; and
  `state-catalog.csv:38-45` is **eight** rows, not six, because `quarantined`
  (`:43`, `copy-catalog.csv:92`) and `expired_purged` (`:45`) are the two this
  decision declares native-only in the next paragraph.

`quarantined` and `expired_purged` are **native-client states**. The seven-day
warned quarantine of
[`files-and-storage.md`](../architecture/files-and-storage.md)
§"Expo pending-original protection" rests on a Keychain/Keystore-bound wrapping
key described in that same section, and on
storage the OS does not reclaim; a browser gives neither. v0.1 does not claim
that ladder. On logout, revocation or account switch the PWA discards the
in-memory original and says so.

Reasoning is in [Cost 2](#cost-2--ios-evicts-site-storage-and-the-pending-original-is-not-safe).

### 7. Push is not in v0.1, and iOS push is not free in v0.2 either

The v0.1 field client is pull-only, and the earliest push named anywhere in the
canonical package is the v0.2 statutory-notice push at notice-window opening
([`system-overview.md`](../architecture/system-overview.md) §"The v0.1 field client is a browser page",
[ADR-005 «Explicitly deferred»](ADR-005-readiness-gate-and-hidden-works.md)).
This ADR ships no push and claims none.

Recorded for v0.2: **web push on iOS requires the PWA to be installed to the
Home Screen and iOS 16.4 or later.** The OS requirement matches the stated
support floor of iOS 16.4+ exactly
([`ADR-004:80`](ADR-004-roadmap-demo-and-documentation.md),
[`scope-and-boundaries.md`](../product/scope-and-boundaries.md) §"M2 — The phone"), so the
floor costs nothing here. The **installation** requirement does not match, and
must not be glossed: it reintroduces an install step for the one capability the
no-install argument cannot cover. v0.2 must decide between an installed PWA for
recipients who want push, and the native client. It is not decided here, and no
document may describe v0.1 as push-capable on either platform.

### 8. Full offline is v0.3 and will very likely need the native client

This decision is scoped to the pilot, not to the product forever. The v0.3
offline capture, queue and sync boundary is unchanged
([ADR-005 «Explicitly deferred»](ADR-005-readiness-gate-and-hidden-works.md),
[`scope-and-boundaries.md`](../product/scope-and-boundaries.md) §"Offline and device operation",
[`ADR-004:90-94`](ADR-004-roadmap-demo-and-documentation.md)), and the two costs
below are precisely the properties an offline outbox cannot tolerate: storage
that the OS may reclaim under a policy the page does not control, and no
hardware-backed key to bind the ciphertext to. The honest expectation is
therefore that **v0.3 returns to `apps/mobile`**, and that is why decision 2
keeps it.

Anyone planning v0.3 should read this ADR as scoping a pilot client, never as
establishing that a browser is sufficient for the product.

### 9. The reversal path, and what it costs

Reverting to Expo/React Native for v0.1 costs:

- the full entry-condition chain of the Context table returns — Apple Developer
  Program membership (with D-U-N-S for organisational enrolment), Google Play
  Console, a funded Expo plan, UDID registration, and two physical devices — plus
  TestFlight and Google Play internal-testing review latency on every iteration;
- **no domain or API migration**, by construction: decision 3 keeps the client
  behind the same contracts, and the capture screen is written once in whichever
  client wins.

What is genuinely lost by reversing **late** rather than early: capture UX frozen
against a browser file input does not transfer to a native camera screen, so the
M2 UX-freeze evidence would have to be retaken on the device inventory. The
provenance claims withdrawn in decision 5 would become available again — that is
a gain on reversal, not a loss, and it is the clearest measure of what this
decision gives up.

## The costs

These are why this ADR exists. They are stated without softening, and none of
them is offset by the benefits above.

### Cost 1 — capture provenance degrades, and a named asset is withdrawn

The `capture` attribute on `<input type="file">` is a **hint about a preferred
source, not a guarantee**. A browser may honour it by opening a camera, or may
present an ordinary picker; either way the page receives a `File` and there is
no reliable signal on it saying whether those bytes came from the sensor a
moment ago or from a folder. A user can supply a gallery file, and the two
cannot be reliably distinguished.

The fallback the market analysis proposed for exactly this problem does not
survive either. [`competitive-landscape.md`](../product/competitive-landscape.md) §3.3
records ScaneReport shipping a client-side CAMERA/GALLERY badge, notes that it
is forgeable, and specifies the honest alternative: set `capture_source` on the
**server**, from EXIF presence and integrity plus a camera-session identity. In
a browser there is no camera-session identity, and **browsers may strip or
re-encode image metadata before the page ever sees the bytes** — on iOS the page
may be handed a transcoded JPEG rather than the sensor's original. So the
server-side inference loses both of its inputs.

Two consequences follow, and both are losses:

1. **The «honest camera-versus-gallery labelling» asset is withdrawn from v0.1.**
   [`competitive-landscape.md`](../product/competitive-landscape.md) §3.3
   made it a differentiator, and idea 12 of its ranked table carried
   **must / v0.1** when this ADR was written. Item 12's two enforceable halves
   survive — server receipt time
   kept separate from device-claimed time, and original bytes hashed rather than
   recompressed. Its provenance half does not, and it is withdrawn rather than
   restated in a weaker form that would still read as a claim.
2. **«Do not recompress the original on the client» becomes a rule with a
   caveat.** The PWA must upload the `File` bytes unmodified and must never draw
   a photo to a canvas before upload — that is the ScaneReport anti-pattern named
   at [`competitive-landscape.md`](../product/competitive-landscape.md) §3.3 and
   in its anti-pattern register, and it is binding. But the client can only promise that **it** did not
   transform the bytes; it cannot promise the browser did not. The hash therefore
   binds the uploaded artifact, not the sensor output, and no document may
   describe it as binding the sensor output.

**What must be measured, not assumed.** Which browser and OS versions strip EXIF,
which transcode, and how each honours `capture` varies by engine and version.
None of it may be asserted from memory in any customer-facing artifact. It is
measured on the two physical devices that
[«What this decision does not remove»](#what-this-decision-does-not-remove)
keeps as a requirement. The decision does not depend on how the measurement
resolves, because v0.1 withdraws the claim either way — the measurement decides
what may be said in v0.2, not whether the PWA ships.

### Cost 2 — iOS evicts site storage, and the pending original is not safe

Safari evicts script-writable site storage after roughly seven days of non-use.
That directly threatens the invariant that a pending original survives until
server receipt, which the package currently states three times:

| Invariant | Statement | Where |
|---|---|---|
| INV-013 | Upload failure does not delete the mobile original; local cleanup requires a persisted `available` receipt with a matching hash | [`invariant-catalog.csv`](../../technical/database/invariant-catalog.csv), row INV-013 |
| INV-014 | An ordinary app restart does not lose a pending online capture | [`invariant-catalog.csv`](../../technical/database/invariant-catalog.csv), row INV-014 |
| INV-053 | Pending originals are envelope-encrypted and inaccessible to another identity; logout or revocation quarantines rather than deletes | [`invariant-catalog.csv`](../../technical/database/invariant-catalog.csv), row INV-053 |

All three are scoped `mobile` in that catalog, and all three rest on native
platform facts: an OS-sandboxed app area
([`execution-and-evidence.md`](../domain/execution-and-evidence.md) §"Native online capture — v0.3") and a
per-file key wrapped by an installation/account/workspace-bound key held in the
iOS Keychain or Android Keystore
([`files-and-storage.md`](../architecture/files-and-storage.md) §"Expo pending-original protection"). A
browser has no equivalent of the second: a non-extractable Web Crypto key in
IndexedDB is bound to the **origin**, not to a secure element, and it is evicted
together with the ciphertext it was protecting rather than outliving it.

The seven-day eviction window is also the same order of magnitude as the
seven-day warned quarantine of
[`files-and-storage.md`](../architecture/files-and-storage.md) §"Expo pending-original protection", so a
quarantined original could simply disappear before the warning it was promised.
Backgrounding compounds it: v0.1 already promises no background upload after the
OS suspends the app
([`execution-and-evidence.md`](../domain/execution-and-evidence.md) §"Upload protocol"), and
a discarded browser tab takes an in-memory original with it.

**Consequence, decided in decision 6:** v0.1 capture is online-only and a pending
original is not durable. INV-013, INV-014 and INV-053 are **not claimed for the
PWA path**; they remain the native client's invariants and become v0.3
obligations. What v0.1 claims in their place is weaker and testable: no success
is reported before the receipt, and the loss of a pending original is always
surfaced to the user and never silent. That belongs in
[`technical/database/invariant-catalog.csv`](../../technical/database/invariant-catalog.csv)
as a new row; this ADR deliberately assigns it no identifier, because inventing
a catalog id here is how catalogs stop being authoritative.

**This is a real reduction in what the product guarantees a foreman.** It is
accepted for the pilot because the alternative is a client nobody can install,
not because the guarantee did not matter.

**Also to be measured, not assumed:** the exact eviction rule, and whether an
installed home-screen PWA is exempt from it. Measured on the devices, and until
measured the client behaves as though eviction can happen at any time.

### Cost 3 — web push on iOS needs an installed PWA

Stated in decision 7 and not repeated. The iOS 16.4+ half costs nothing because
it matches the support floor already fixed at
[`ADR-004:80`](ADR-004-roadmap-demo-and-documentation.md). The installed-PWA half
is a genuine cost deferred into v0.2, and it must not be described as solved by
this decision.

### What this decision does **not** remove

Stated because a reader reaching for the benefit will otherwise assume it.

- **The physical device inventory is still required, and matters more, not
  less.** [`TODOS.md:334-361`](../../TODOS.md) and
  [`roadmap.md`](../product/roadmap.md) §"v0.1-M2 — The phone" require one physical supported
  iPhone and one lower-resource physical Android device. What this ADR removes
  is the **distribution** chain — the store accounts, the UDID registration, the
  internal-distribution tracks. It removes nothing about testing. Browser
  behaviour on EXIF, on `capture`, and on storage eviction varies by engine and
  version in ways a native camera API does not, so the inventory is now the only
  way to know what the client actually does. Both costs above end in a
  measurement that needs those two devices.
- **The support floor.** iOS 16.4+ and Android 10+ still has to be confirmed
  against real hardware rather than assumed
  ([`roadmap.md`](../product/roadmap.md) §"Entry-evidence status as of 2026-08-06").
- **The link host question.** The Universal/App Link host is undecided and
  neither well-known file exists
  ([`system-overview.md`](../architecture/system-overview.md) §"Field-client links",
  [`TODOS.md:363-418`](../../TODOS.md) split item 2). A PWA turns it from an app
  association problem into a plain URL problem, which is easier — but a
  GoProceed domain still has to be chosen, and «a link is a destination, never an
  authorization» ([`system-overview.md`](../architecture/system-overview.md) §"Field-client links")
  binds the PWA unchanged.
- **The camera-permission failure path.** «Permission explanation and file/photo
  alternative» ([`execution-and-evidence.md`](../domain/execution-and-evidence.md) §"Failure behavior")
  still applies; in a browser it is a permission prompt with different wording,
  not an absent problem.

## Consequences

### Documents that must be corrected

This ADR is the decision; it does not silently rewrite the documents it
contradicts. Each row below was a correction owed **when this ADR was approved on
2026-08-06**, and delivery of any slice that depends on one stops until it lands
([docs/README.md](../README.md) §«Source of truth»).

**Read the right-hand column as the end state each document must reach, never as
a claim that it has not reached it.** Whether a given correction has landed is
checked in the document itself; a table that says «owed» does not become false by
being satisfied, but a reader who treats it as current state will halt planning
on a premise that may already be closed — which is the failure this package has
had twice.

| Document | The end state it must reach |
|---|---|
| [`ADR-004:70-78`](ADR-004-roadmap-demo-and-documentation.md) | The «separate native client, not a responsive-web substitute» sentence and the OS-sandboxed-persistence sentence are v0.3, not v0.1 |
| [`scope-and-boundaries.md`](../product/scope-and-boundaries.md) §"M2 — The phone" and §"Offline and device operation" | The Expo client, the EAS/TestFlight/Play distribution line, and the pending-original persistence line leave v0.1 scope |
| [`roadmap.md`](../product/roadmap.md) §"v0.1-M2 — The phone" | M2 entry evidence loses the account/UDID/store chain and keeps the device inventory; the three `apps/mobile` exit gates are replaced by PWA gates |
| [`version-0.1.md`](../delivery/version-0.1.md) §"v0.1-M2 — The phone" | The vertical test and the closing evidence stop naming EAS internal build installation |
| [`system-overview.md`](../architecture/system-overview.md) §"Approved product surfaces", §"One backend for every client" and §"Deployment and secret rules" | The surface table, the one-backend section, and the deployment rules name the PWA as the v0.1 field client and `apps/mobile` as v0.3 |
| [`execution-and-evidence.md`](../domain/execution-and-evidence.md) §«Native online capture» | That section becomes the **v0.3** section; v0.1 gets the online-only, non-durable client of decision 6, and `origin method` gains the not-distinguished value of decision 5. This one matters most: the domain layer is precedence **level 2** and an un-recut domain document outranks this ADR ([docs/README.md](../README.md) §«Source of truth») |
| [`files-and-storage.md`](../architecture/files-and-storage.md) §«Expo pending-original protection» | Marked **v0.3**; the PWA has no Keychain/Keystore path and no seven-day quarantine. Same precedence point: architecture is level 2 |
| [`invariant-catalog.csv`](../../technical/database/invariant-catalog.csv) rows **INV-013, INV-014, INV-053** | Re-scoped to the native client, and the weaker v0.1 invariant of decision 6 added **with its own identifier** |
| [`state-catalog.csv`](../../technical/states/state-catalog.csv) machine `mobile_pending_original` | Keeps its six PWA-live states; `quarantined` and `expired_purged` are recorded as native-only |
| [`copy-catalog.csv`](../../technical/copy-catalog.csv) keys `status.client_state.*` | Gains the missing `discarded` row, and `quarantined` is marked native-only so a PWA screen cannot render a label for a state it cannot reach |
| [`competitive-landscape.md`](../product/competitive-landscape.md) §3.3 and idea 12 of its ranked table | The camera-versus-gallery provenance row is withdrawn from v0.1. That document is Draft and market evidence only, so it is corrected, never cited as authority |

### Standing consequences

- **The product's provenance story is weaker in v0.1 than the market analysis
  planned, and the positioning must not paper over it.** The claim that survives
  is: original bytes, hashed on the client and verified on the server; a server
  receipt time; and a device-claimed time labelled untrusted. Anything stronger
  is a lie told to an engineer whose client's lawyer reads it, which is the same
  failure mode
  [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
  exists to prevent in the regulatory layer.
- **The gate is unaffected.** Nothing here weakens `can_close_stage`,
  `is_package_eligible`, the refusal-with-a-reason-object rule, or the
  back-dating impossibility of
  [`execution-and-evidence.md`](../domain/execution-and-evidence.md) §"Original, derivative, and correction".
  Server receipt time, notice `sent_at`, closure time and decision time remain
  server-generated regardless of which client sent the bytes.
- **A weaker guarantee to the field is the price paid for reaching the field at
  all.** Under the native plan, no foreman holds anything until a D-U-N-S
  registration completes. Under this plan a foreman holds a link and the product
  promises less about what happens to a photo that fails to upload. Both halves
  of that sentence are true and the second is not a footnote.
- **`apps/mobile` continues to cost something while it sits.** It is a workspace
  in CI with an Expo SDK that will age, and it now ages without being on the
  delivery path. That is accepted for the reason in decision 8; it is not free.

## Replacement rule

This ADR amends ADR-004 and supersedes nothing. Changing the decision — making
`apps/mobile` the v0.1 client again, or extending the PWA to v0.3 offline —
requires a superseding ADR that identifies the user evidence, the version
impact, the data ownership, the security impact, and the migration cost.

Three specific protections:

1. **Re-asserting a withdrawn provenance claim requires an ADR, not a UI
   change.** Camera-only capture for a blocking requirement, a
   camera-versus-gallery label, tamper-evident provenance, and verified
   capture-time GPS are each a boundary change while the field client is a
   browser page, whatever a screen, a badge, a demo or a landing page would find
   convenient.
2. **Claiming a durable pending original requires an ADR.** INV-013, INV-014 and
   INV-053 may not be re-scoped back onto the PWA path by a catalog edit; decision
   6 and Cost 2 are what they rest on.
3. **The domain and the API stay client-agnostic.** A PWA-specific field on an
   evidence object, an upload intent, or a requirement occurrence would destroy
   the replaceability that decision 3 buys and that decision 9 depends on, and is
   prohibited without an ADR that says so on purpose.
