# ADR-009: Three pilot surfaces, separately deployed

**Status:** Approved

**Applies to:** v0.1 and v0.3

**Last reviewed:** 2026-08-20

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
new client by the follow-up plan `2026-08-XX-expo-field-client.md`, which
authors no new checklist. Passing is a measurement taken on hardware, not a
code review, and it is taken on the same **two physical phones** ADR-007's
Context table already required and this decision does not remove. Until it
happens, `apps/app`'s PWA is the pilot's only working field client and stays
deployed. No task in any of the three follow-up plans
(`2026-08-XX-v1-cors-bearer.md`, `2026-08-XX-expo-field-client.md`,
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
  `2026-08-XX-v1-cors-bearer.md`, not built by this decision.
- **The pilot is never blocked.** At every point between this decision and the
  parity gate being measured, a foreman has a working client: the `apps/app`
  PWA, unchanged and deployed. This ADR adds a second client in parallel; it
  does not take the first one away before its replacement is proven on
  hardware.
- **`apps/landing` stops costing nothing for being unreachable.** Once
  deployed, the landing site is a real second surface with its own build,
  deploy and ignore path — the first entry in `README.md`'s "Product
  surfaces" section that is not also a claim about `apps/app`.

## Replacement rule

Reverting to a single deployed surface, or moving the field client back into
`apps/app` before the parity gate is measured, requires a superseding ADR:
either move undoes decision 1's separately-deployable-surface argument, and
the second additionally spends decision 3's client-agnostic boundary — the
property this ADR exercises — without re-deriving it.
