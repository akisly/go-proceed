# v0.1-M2-B0 — Foundations — design

**Date:** 2026-08-01
**Branch:** `claude/m2-b0-foundations`, from `main` @ `7728f47`
**Slice:** the first of four in v0.1-M2-B. No product code.

## Why M2-B is four slices

A scope map of M2-B (six parallel readers over the product corpus and the
shipped server) found that the milestone as written is a platform build, a
security engineering project, a design-system port, a procurement track and a
manual QA campaign under one label. The M2-A design already recorded the reason
the milestone was split once: "M2-B's exit gates depend on the owner's developer
accounts and hardware. A plan that mixes them with server work cannot reach a
green state in one execution pass." That applies with equal force inside M2-B.

- **B0 — Foundations.** This document. Accounts and devices procured, tokens
  reconciled into a source both platforms can consume, the copy catalog aligned
  with the vocabulary the server actually ships, and an Expo app that installs.
- **B1 — Capture and receipt.** The three-call upload protocol, the assignment
  list, the capture screen, retry.
- **B2 — Custody.** INV-013 and INV-014: an upload failure must not delete the
  local original, and a restart must not lose a pending capture.
- **B3 — Acceptance and distribution.** The device matrix, and the combined M2
  gate record.

### Rulings already made, recorded so they are not re-argued

- **Offline-first is v0.3.** The lease-bound authorization, multipart grants with
  per-part checksums, and atomic capture-session submit in
  `docs/23-offline-media-protocol.md` describe a server that does not exist and
  that `docs/delivery/version-0.1.md` scopes to v0.3. The M2-B client is
  online-only.
- **INV-013 and INV-014 stay in M2.** They are not about offline. Even an
  online-only client holds a pending original while an upload is in flight and
  after it fails.
- **INV-053 splits.** Envelope encryption of pending originals defers to v0.3
  under the documented risk acceptance `docs/23-offline-media-protocol.md:15`
  already provides for. Quarantine-not-delete on logout stays in M2, because
  without it INV-013 is violated directly: logging out during a failed upload is
  exactly the case INV-013 forbids losing.

## What B0 delivers

Four things, none of which is a screen a foreman would recognise.

### 1. A token source both platforms can consume

The audit that motivates this is not "the tokens drifted". It is worse in three
separate ways.

**React Native cannot import the shared package at all.**
`packages/ui/package.json` declares exactly one export, `"./tokens.css"`. There
is no `main`, no `module`, no `types`, no `react-native`, no `exports["."]`. The
package ships a stylesheet and nothing else. This is not a porting problem; it
is an availability problem.

**Eleven of the twelve normative colour tokens disagree with what shipped.**
Only `paper` agrees on both name and value. The most dangerous row is `muted`,
where the *name* matches exactly and the value does not — `#686E6A` in
`docs/05-design-system.md:30`, `#666979` in `packages/ui/src/tokens.css:24`. A
mismatch that announces itself is a bug; a mismatch that renders is a wrong
colour nobody reports.

**Five of seven categories do not exist.** Typography, spacing, radius, border
width and motion have no tokens in the shared package at all, while the code
carries 3,073 pixel literals, 214 `border-radius` declarations across 31
distinct values, and 781 colour literals. Of 215 distinct pixel values, 112 are
off the four-pixel grid `docs/05-design-system.md:44` declares mandatory.

**B0 tokenises colour and shadow only.** The other five categories are
tokenised in B1, when a screen consumes them. The reason is the lesson this
project has now learned three times: a token with no consumer is an untested
assertion, and it drifts exactly as silently as the colour table did. A spacing
ladder nobody renders is a spacing ladder nobody validates.

**The ruling rule for divergence.** Both sides have a claim —
`docs/05-design-system.md` is the approved specification and the only place
semantic intent is written; `packages/ui/src/tokens.css` is a faithful copy of
the prototype that was actually rendered and accepted. Authority follows
evidence:

- **Measured beats asserted.** Where a token is load-bearing for a WCAG
  threshold and one side carries a recorded measurement, that side wins.
  `--color-foreground-muted: #666979; /* 5.86:1 */` and
  `--color-accent-ink: #667f12; /* 4.56:1 */` are measured in
  `apps/demo/src/styles/theme.css:120,133`. The document's `#686E6A` and
  `#84A625` appear nowhere in the repository and carry no measurement anywhere.
- **Rendered beats written** where neither side is measured.
- **Naming is the document's job, without exception.** A name change renders
  nothing differently, and `docs/05-design-system.md:157` requires components to
  consume semantic names. The prototype's `--ink-2`, `--signal-dark` are a
  prototype's convenience.
- **A kind change has no winner.** An opaque hex and a 17%-alpha colour are not
  the same class of object and rounding cannot reconcile them.

**Three rulings need a render, not an argument, and they block generation.**

- **`line`** — three declared values exist (`#D9DBD5`,
  `rgba(72,76,94,.18)`, `rgba(72,76,94,.17)`) and the shipped one matches no
  document. The question is not which grey but *do borders composite* — React
  Native border colours are commonly authored opaque and RN has no custom
  properties to composite through.
- **`blue-500`** — four candidates for one role: the doc's `#5278D8` survives
  only as a focus outline, `--blue: #65719a` ships but is never used as an
  informational status, `theme.css:143` fills that role with `#3756a1`, and
  `--atlas-blue: #18376a` is a third. (This spec previously cited
  `theme.css:157`; reading the file puts `--color-info-foreground: #3756a1;` at
  line **143**, while 157 opens the "Evidence" comment block further down. The
  gate record corrected the citation; this spec is now corrected to match.)
- **The shadow ladder** — the shipped six use a different ink base than the
  document's stated intent, and a 70px blur is not the "shallow" the document
  asks for. A second implementer independently read the document and shipped its
  reading at `theme.css:215`.

These are scheduled as a visual QA step, not discovered during implementation.
`docs/05-design-system.md:246` already requires that gate; B0 is the first slice
that has to actually hold it.

**The source format.** A new `packages/tokens` with `src/tokens.json` as the
single source and two generators. `packages/ui` becomes a consumer of generated
output rather than the source, because the generator must not live behind a
CSS-only export map.

Three shape rules, each forced by React Native rather than by taste:

- **No colour carries baked-in alpha.** Every colour is
  `{ "hex": "#RRGGBB", "alpha": <0..1> }`. RN's `shadowOpacity` defaults to `0`
  and multiplies with the colour's alpha, so an `rgba()` string passed as
  `shadowColor` renders nothing at all.
- **No shadow is a CSS string.** Shadows are arrays of numeric layers with an
  explicitly authored `androidElevation`, because elevation encodes offset, blur
  and opacity in one scalar and cannot be derived from them.
- **The blur conversion is declared, not hidden.** CSS blur radius is roughly
  twice RN's `shadowRadius` sigma; that approximation is a reviewable field in
  the source, not a constant inside a generator.

**The guard.** `packages/testing/src/error-catalog-fidelity.test.ts` is this
repository's working precedent: it fails when a route emits a problem code the
catalog does not define. The token equivalent asserts that the generated CSS
matches the source and that every token the document's table names exists in the
source under its documented name.

Stated honestly, that guard does **not** catch: a wrong-but-consistent value
(the `muted` failure mode — it would pass happily once generated), a token the
document never named, or any of the 781 colour literals in app code that bypass
tokens entirely. It catches drift between source and output, which is the drift
that recurs mechanically. The rest needs the visual gate.

### 2. A copy catalog that matches the server

`technical/copy-catalog.csv` carries `status.upload_intent.*` labels for
`authorized`, `cancelled`, `expired` and `sealed`. The server ships
`intent_authorized`, `staged`, `integrity_verified`, `scan_pending`,
`available`, `scan_blocked`, `orphaned_for_purge`, `expired`. One of four
matches. `sealed` and `cancelled` do not exist; `available`, `scan_blocked` and
`orphaned_for_purge` — the states a client actually observes — have no label.

Two state vocabularies also compete. `technical/state-catalog.csv` registers a
five-state `mobile_capture` machine and is the only place approved Ukrainian
labels live. `technical/states/state-catalog.csv` registers an eight-state
`mobile_pending_original` machine and has no label column at all. The shipped
database settles which machine is real:
`supabase/migrations/0015_execution_evidence_module.sql:365` constrains
`client_state` to `not_sent, sending, awaiting_receipt, server_confirmed,
failed, quarantined`.

B0 reissues `status.upload_intent.*` against the shipped vocabulary, authors
`status.client_state.*` for the six constrained values, and adds a fidelity test
that fails when a status the server can emit has no Ukrainian label. The test is
the part that matters: without it this reconciliation is a one-time cleanup that
drifts again.

### 3. An Expo app that installs

Initialised with `create-expo-app`, which resolves to Expo SDK **57.0.9**
(verified against npm on 2026-08-01).

This contradicts a normative document and the contradiction is recorded rather
than smoothed over. `docs/07-technical-architecture.md:8` names "Expo SDK 56",
and `:20` sets it as the version baseline with the rule "Pin exact patch
versions and image digests". That document carries no Historical marker and does
not sit under `docs/legacy`, so by `docs/README.md:25-41` it is target version
design — precedence rank 2, normative for architecture.

The owner's instruction to initialise with `create-expo-app` governs, and the
document's own rule is honoured on the part that survives: B0 pins the exact
resolved version in the lockfile rather than tracking a range. Updating doc 07's
baseline to the version actually shipped is a follow-up this slice does not
make, because editing a normative architecture document is not a foundations
slice's call — it is recorded in `TODOS.md` instead.

Layout follows the Expo convention: code under `src/`, `src/app` routes-only,
`src/screens` for screen bodies, `src/components` for reusable UI, kebab-case
filenames. Chosen now because B1 grows screens into it, and restructuring
mid-slice costs more than picking correctly once.

Scope is deliberately one screen, and what it renders is chosen to be evidence
rather than decoration: the six `client_state` values with their Ukrainian
labels read from the generated copy module, each on a surface coloured from the
generated token module.

**What that screen does and does not prove.** This spec originally said the
screen "fails visibly if either generator is wrong, if a label is missing, or
if the React Native token module did not build". Only the second and third of
those are true, and a reviewer demonstrated the gap: a label that is *stale* —
the catalog changed and the generator was not re-run — renders exactly as
confidently as a correct one. Rendering catches an artifact that is **missing**
(a missing token throws at import, a missing label throws in
`clientStateLabel`); it cannot catch one that is **wrong**, because the screen
has no access to the source it drifted from. Drift is caught by comparison
against the source, not by display, and that is a test's job:
`packages/testing/src/token-fidelity.test.ts` for the two token artifacts and
`packages/testing/src/status-label-fidelity.test.ts` for the generated label
JSON. The screen's real contribution is narrower and still worth having — it is
what makes "the generators ran and the native module builds" observable on a
device, which no test in this repository can assert.

Nothing else. No authentication, no API calls, no camera, no navigation beyond
the one route. Those are B1.

### 4. Procurement, recorded rather than claimed

No document in the corpus mentions the Apple Developer Program, App Store
Connect, D-U-N-S, provisioning profiles, keystores or a bundle identifier. For
a Ukrainian legal entity, organisational Apple enrolment is the longest-lead
item in the milestone. EAS itself is a paid service whose build and submit jobs
need a plan with build minutes, so the account list is three, not two.

B0 produces `eas.json` and the build profiles, and a procurement checklist that
names the long-lead items and what is unrecoverable if lost — the Android upload
keystore, which `docs/26-sre-operations.md:145-154` omits from its solo-founder
continuity list.

B0 does **not** produce a build on a device. That step is recorded as blocked on
procurement, in the same words the M2-A gate record used for the undeployed
purge worker: not done, with the reason, rather than quietly absent.

## Exit gate

- `pnpm turbo run test --concurrency=1 --force` green, including the two new
  fidelity tests.
- `packages/tokens` generates both outputs from one source, and the generated
  CSS *replaces* the hand-maintained `packages/ui/src/tokens.css`. The
  replacement diff is reviewed and recorded — it is the visible consequence of
  the three rulings, and reviewing it is how anyone checks the rulings were
  applied as decided rather than as remembered.
- Every `upload_intents.status` and `capture_events.client_state` value the
  server can emit has a Ukrainian label.
- `apps/mobile` builds locally and its screen renders generated tokens.
- The three pixel rulings are recorded with the ruled value and the reason.
- The procurement checklist exists, and the device-install step is recorded as
  blocked with what it is blocked on.

## Out of scope

Capture, upload, authentication, camera, the pending-original state machine,
encryption, the device acceptance matrix, and the five untokenised categories.
Also out of scope: the 781 colour literals and 3,073 pixel literals in existing
app code. B0 makes the source exist; migrating consumers onto it is not this
slice, and pretending otherwise would put a week of unrelated refactoring inside
a foundations slice.

## Known limitations

- **The guard cannot catch a wrong-but-consistent value.** Once a value is in
  the source, generation makes it consistent everywhere, which is precisely how
  `muted` would pass. Only the visual gate catches that class.
- **`packages/ui` has one consumer today** (`apps/landing`). `apps/demo`
  re-declares the palette locally and `apps/app` imports no stylesheet at all.
  `apps/mobile` will be the second consumer, not the fourth. The phrase "the
  shared design system" overstates what exists.
- **Fonts are web-only.** `@fontsource-variable/*` ships `.woff2`; React Native
  needs `.ttf` or `.otf`. B0 records this; sourcing the native font files is
  B1's problem, when a screen needs type.
